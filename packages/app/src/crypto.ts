import { app, safeStorage } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Logger } from './logger';

const logger = Logger('crypto');

// --- 常量 ---
/** 主密钥文件名（位于 userData，与 config.json 同级） */
const KEY_FILE_NAME = 'ocs.key';
/** 密钥文件前缀：safeStorage 异步 API 包裹（首选） */
const KEY_PREFIX_SS = 'v1:ssa:';
/** 密钥文件前缀：safeStorage 不可用时的明文回退（混淆级防护） */
const KEY_PREFIX_PLAIN = 'v1:plain:';
/** 密码加密导出格式前缀 */
const EXPORT_PREFIX = 'v1:scrypt';
/** keytar 存量密钥条目（阶段 1 保留：升格读取；不删除，保留回滚路径） */
const KEYTAR_SERVICE = 'ocs-desktop';
const KEYTAR_ACCOUNT = 'aes-key';
/** 导出密码的 scrypt 派生参数（写入密文格式，未来可调整） */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

// --- 状态 ---
let masterKey: Buffer | null = null;
/** 初始化 Promise 缓存：保证并发调用（bootstrap 并行任务 / 渲染进程加载前兜底）只执行一次 */
let initPromise: Promise<void> | null = null;

/**
 * 将 Buffer 转为 TS 5.7+ 兼容的 Uint8Array<ArrayBuffer>
 *
 * TS 5.7+ 将 Buffer 视为 Uint8Array<ArrayBufferLike>（.buffer 可能为 SharedArrayBuffer），
 * 无法赋给期望 ArrayBufferView<ArrayBuffer> 的 crypto API 形参（CipherKey / BinaryLike 等）。
 * 这里拷贝为一份新的 Uint8Array<ArrayBuffer> 以满足类型签名。
 */
function toBytes(buf: Buffer): Uint8Array {
	return new Uint8Array(buf);
}

/**
 * 异步初始化加密模块（并发幂等）——信封加密
 *
 * 架构：自管理 AES-256-GCM 主密钥（进程内缓存），主密钥由 safeStorage 异步 API
 * 包裹后存于 ocs.key 文件。safeStorage 每启动仅调用 1~2 次（解决 macOS Keychain
 * 频繁弹窗与逐次调用开销），数据加解密全部为进程内 AES（微秒级）。
 *
 * 主密钥解析顺序：
 * 1. ocs.key 解包（v1:ssa: safeStorage 包裹 / v1:plain: 明文回退）
 * 2. keytar 存量密钥升格（3.x 用户 AES 数据零迁移；不删条目，保留回滚路径）
 * 3. 全新生成
 *
 * ⚠️ 必须在 initStore() 之前调用
 */
export function initCrypto(): Promise<void> {
	if (!initPromise) {
		initPromise = resolveMasterKey().catch((e) => {
			// 任何分支失败都不上抛：最差退化为内存态密钥（重启后旧数据不可读，
			// 由 decryptRenderString 兜底 '{}'）
			logger.error('主密钥初始化失败', e);
		});
	}
	return initPromise;
}

async function resolveMasterKey(): Promise<void> {
	const keyFile = path.join(app.getPath('userData'), KEY_FILE_NAME);

	// ── 1. ocs.key 解包 ──
	if (fs.existsSync(keyFile)) {
		const content = fs.readFileSync(keyFile, 'utf-8');
		if (content.startsWith(KEY_PREFIX_SS)) {
			const blob = Buffer.from(content.slice(KEY_PREFIX_SS.length), 'base64');
			const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(blob);
			masterKey = Buffer.from(result, 'hex');
			// OS 密钥轮换（key rotation）：异步重写包裹，不阻塞启动
			if (shouldReEncrypt) {
				wrapAndStoreKey(keyFile).catch((e) => logger.warn('密钥轮换重写失败', e));
			}
			logger.info('从 ocs.key 解包主密钥');
			return;
		}
		if (content.startsWith(KEY_PREFIX_PLAIN)) {
			masterKey = Buffer.from(content.slice(KEY_PREFIX_PLAIN.length), 'hex');
			logger.warn('safeStorage 不可用，主密钥为明文存储（混淆级防护）');
			return;
		}
		logger.error('ocs.key 格式无法识别，按无密钥处理（旧 AES 数据将不可读，由解密兜底处理）');
	}

	// ── 2. keytar 存量密钥升格（3.x AES 数据零迁移） ──
	const legacy = await readKeytarKey();
	if (legacy) {
		masterKey = legacy;
		await wrapAndStoreKey(keyFile);
		logger.info('keytar 密钥已升格为主密钥（原 keytar 条目保留，待后续版本清理）');
		return;
	}

	// ── 3. 全新生成 ──
	masterKey = crypto.randomBytes(32);
	await wrapAndStoreKey(keyFile);
	logger.info('生成新主密钥并存入 ocs.key');
}

/**
 * 惰性加载 keytar 读取存量密钥
 *
 * 原生绑定缺失（macOS 安装期 prebuild 失败）时动态 import 会 reject，
 * 此处捕获返回 null 降级，不再让模块加载期崩溃阻断启动。
 */
async function readKeytarKey(): Promise<Buffer | null> {
	try {
		const mod: any = await import('keytar');
		const keytar = mod.default ?? mod;
		const hex = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
		return hex ? Buffer.from(hex, 'hex') : null;
	} catch (e) {
		logger.warn('keytar 不可用，跳过存量密钥升格', e);
		return null;
	}
}

async function wrapAndStoreKey(keyFile: string): Promise<void> {
	if (!masterKey) return;
	let content: string;
	if (await safeStorage.isAsyncEncryptionAvailable()) {
		const wrapped = await safeStorage.encryptStringAsync(masterKey.toString('hex'));
		content = KEY_PREFIX_SS + wrapped.toString('base64');
	} else {
		content = KEY_PREFIX_PLAIN + masterKey.toString('hex');
	}
	fs.writeFileSync(keyFile, content, { mode: 0o600 });
}

/**
 * 主密钥是否就绪
 */
export function isCryptoReady(): boolean {
	return masterKey !== null;
}

/**
 * 同步获取主密钥
 * ⚠️ 仅在 isCryptoReady() 为 true 时调用
 */
function getMasterKey(): Buffer {
	if (!masterKey) {
		throw new Error('Master key not available. initCrypto() has not completed.');
	}
	return masterKey;
}

// ────────────────────────────────────────────
//  AES-256-GCM 加解密（进程内，热路径）
// ────────────────────────────────────────────

/**
 * AES-256-GCM 加密
 * @returns 格式: iv:authTag:ciphertext（base64 编码）
 */
export function encryptAes(plaintext: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', toBytes(getMasterKey()), toBytes(iv));
	let encrypted = cipher.update(plaintext, 'utf8', 'base64');
	encrypted += cipher.final('base64');
	const authTag = cipher.getAuthTag();
	return iv.toString('base64') + ':' + authTag.toString('base64') + ':' + encrypted;
}

/**
 * AES-256-GCM 解密
 * @param ciphertext 格式: iv:authTag:ciphertext
 */
export function decryptAes(ciphertext: string): string {
	const parts = ciphertext.split(':');
	const iv = Buffer.from(parts[0], 'base64');
	const authTag = Buffer.from(parts[1], 'base64');
	const data = parts.slice(2).join(':');
	const decipher = crypto.createDecipheriv('aes-256-gcm', toBytes(getMasterKey()), toBytes(iv));
	decipher.setAuthTag(toBytes(authTag));
	let decrypted = decipher.update(data, 'base64', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}

// ────────────────────────────────────────────
//  渲染进程数据加解密（自适应方案）
// ────────────────────────────────────────────

/**
 * 加密渲染进程数据：固定走主密钥 AES-256-GCM（格式: iv:authTag:ciphertext）
 */
export function encryptRenderString(plaintext: string): string {
	return encryptAes(plaintext);
}

/**
 * 解密渲染进程数据（自适应新旧格式，并自动修复「重复加密」的历史损坏数据）
 * - 含冒号 → AES-256-GCM 格式（3.0 至今）
 * - 纯 base64 → safeStorage 直通格式（< 3.0 旧数据，下次保存自动升级为 AES 格式）
 *
 * 历史 bug：启动竞态导致解密失败时渲染端把密文字符串当数据再次加密写回（双重加密），
 * 解密一层后 JSON.parse 得到字符串而非对象。此处逐层解密，直到还原出对象 JSON 文本。
 *
 * 任何一层解密失败（密钥丢失/数据损坏/跨机器密文）均兜底返回 '{}'，
 * 不再上抛（上抛会导致渲染端把密文再次写回，形成污染链路）。
 */
export function decryptRenderString(encrypted: string): string {
	let current = encrypted;
	// 最多解 5 层，防止异常数据死循环
	for (let layer = 1; layer <= 5; layer++) {
		let decrypted: string;
		try {
			decrypted = current.includes(':')
				? decryptAes(current)
				: safeStorage.decryptString(Buffer.from(current, 'base64'));
		} catch (e) {
			logger.error(`渲染进程数据解密失败（第 ${layer} 层），按空数据处理`, e);
			return '{}';
		}
		try {
			const parsed = JSON.parse(decrypted);
			if (typeof parsed === 'string') {
				// 解密结果仍是密文字符串（被重复加密），继续向下解
				logger.warn(`检测到渲染进程数据被重复加密（第 ${layer} 层），正在逐层恢复`);
				current = parsed;
				continue;
			}
			// 正常的对象 JSON 文本
			return decrypted;
		} catch {
			// 非 JSON 内容，按原样返回保持兼容
			return decrypted;
		}
	}
	logger.error('渲染进程数据加密层数过多，无法恢复，按空数据处理');
	return '{}';
}

/**
 * 获取解密后的渲染进程数据
 */
export function getDecryptedRenderData(store: { store: { render: any } }): any {
	if (typeof store?.store?.render === 'string') {
		return JSON.parse(decryptRenderString(store.store.render));
	}
	return store?.store?.render || {};
}

// ────────────────────────────────────────────
//  导出/导入：用户密码加密（跨机器可移植）
// ────────────────────────────────────────────

/**
 * 用用户密码加密导出数据
 *
 * 主密钥/本机密钥链均为机器绑定，无法用于跨机器迁移；
 * 此处由用户密码经 scrypt 派生密钥，密文自包含全部参数，任何机器可解。
 *
 * @returns 格式: v1:scrypt:<N>:<r>:<p>:<salt>:<iv>:<tag>:<ct>（后四段 base64）
 */
export function encryptWithPassword(plaintext: string, password: string): string {
	const salt = crypto.randomBytes(16);
	const key = crypto.scryptSync(password, toBytes(salt), 32, SCRYPT_PARAMS);
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', toBytes(key), toBytes(iv));
	let ct = cipher.update(plaintext, 'utf8', 'base64');
	ct += cipher.final('base64');
	const { N, r, p } = SCRYPT_PARAMS;
	return [
		EXPORT_PREFIX,
		N,
		r,
		p,
		salt.toString('base64'),
		iv.toString('base64'),
		cipher.getAuthTag().toString('base64'),
		ct
	].join(':');
}

/**
 * 用用户密码解密导出数据
 * @param payload 格式: v1:scrypt:<N>:<r>:<p>:<salt>:<iv>:<tag>:<ct>
 * @throws 格式不符或密码错误（GCM 完整性校验失败）
 */
export function decryptWithPassword(payload: string, password: string): string {
	const parts = payload.split(':');
	if (parts[0] + ':' + parts[1] !== EXPORT_PREFIX || parts.length !== 9) {
		throw new Error('不是密码加密的导出数据');
	}
	const [, , n, r, p, salt, iv, tag, ct] = parts;
	const key = crypto.scryptSync(password, toBytes(Buffer.from(salt, 'base64')), 32, {
		N: Number(n),
		r: Number(r),
		p: Number(p)
	});
	const decipher = crypto.createDecipheriv('aes-256-gcm', toBytes(key), toBytes(Buffer.from(iv, 'base64')));
	decipher.setAuthTag(toBytes(Buffer.from(tag, 'base64')));
	let decrypted = decipher.update(ct, 'base64', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}

/**
 * 是否为密码加密的导出数据
 */
export function isPasswordEncrypted(payload: string): boolean {
	return payload.startsWith(EXPORT_PREFIX + ':');
}

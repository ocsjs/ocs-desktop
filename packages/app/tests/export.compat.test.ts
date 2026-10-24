import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── 导出文件跨版本兼容性回归测试 ──
//
// 背景：导出/导入格式历经三代——
//   < 3.0   safeStorage 直通（纯 base64，机器绑定）
//   3.0.x   keytar + AES-256-GCM（iv:authTag:ciphertext，机器绑定）
//   3.1+    信封加密（同 3.0 格式）+ 导出可选密码加密（v1:scrypt:...，跨机器）
// 本测试锁定各版本导出文件在新旧版本导入逻辑下的行为，防止上线后格式不兼容。
//
// 真实导出样本：仓库 .codebuddy 目录下的 .ocsdata（存在时启用，缺失则跳过 fixture 用例）

const mocks = vi.hoisted(() => ({
	userDataDir: '',
	ssAvailable: true,
	shouldReEncrypt: false,
	keytarHex: null as string | null
}));

vi.mock('electron', () => ({
	app: {
		getPath: () => mocks.userDataDir,
		// initCrypto 必须等待 ready（safeStorage 异步加密器 ready 后才初始化）
		whenReady: async () => undefined
	},
	safeStorage: {
		isAsyncEncryptionAvailable: async () => mocks.ssAvailable,
		encryptStringAsync: async (hex: string) => Buffer.from('SS:' + hex),
		decryptStringAsync: async (buf: Buffer) => ({
			result: buf.toString().replace(/^SS:/, ''),
			shouldReEncrypt: mocks.shouldReEncrypt
		}),
		// 旧格式兼容读取：测试中密文即 base64(明文)
		decryptString: (buf: Buffer) => buf.toString()
	}
}));

vi.mock('keytar', () => ({
	default: {
		getPassword: vi.fn(async () => mocks.keytarHex),
		setPassword: vi.fn(async () => undefined)
	}
}));

vi.mock('../src/logger', () => ({
	Logger: () => ({ info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined })
}));

async function loadCrypto() {
	vi.resetModules();
	return await import('../src/crypto');
}

beforeEach(() => {
	mocks.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-compat-test-'));
	mocks.ssAvailable = true;
	mocks.shouldReEncrypt = false;
	mocks.keytarHex = null;
});

// ── 测试工具：复刻旧版本行为 ──

/** 用指定密钥生成 3.0.x 时代的机器绑定 AES 密文 */
function aesEncryptWith(key: Buffer, plaintext: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', new Uint8Array(key), new Uint8Array(iv));
	let ct = cipher.update(plaintext, 'utf8', 'base64');
	ct += cipher.final('base64');
	return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct].join(':');
}

/**
 * 旧版 3.0.1 导入逻辑复刻（Title.vue@3.0.1 + crypto.ts@3.0.1）：
 * - render 非字符串 → 直接导入
 * - 含冒号 → 本机 keytar 密钥 AES 解密（失败直接抛错，外层 catch 提示"数据有误"）
 * - 纯 base64 → safeStorage 直通解密
 */
function legacyV3Import(render: unknown, keytarKey: Buffer): any {
	if (typeof render !== 'string') return render;
	if (render.includes(':')) {
		const parts = render.split(':');
		const decipher = crypto.createDecipheriv(
			'aes-256-gcm',
			new Uint8Array(keytarKey),
			new Uint8Array(Buffer.from(parts[0], 'base64'))
		);
		decipher.setAuthTag(new Uint8Array(Buffer.from(parts[1], 'base64')));
		let out = decipher.update(parts.slice(2).join(':'), 'base64', 'utf8');
		out += decipher.final('utf8');
		return JSON.parse(out);
	}
	return JSON.parse(Buffer.from(render, 'base64').toString());
}

/** 新版导入流程复刻（Title.vue 现状）：返回 render 对象，失败抛错 */
async function currentImport(render: unknown, mod: any, password?: string): Promise<any> {
	if (typeof render !== 'string') return render; // 明文直接导入
	if (mod.isPasswordEncrypted(render)) {
		// 密码加密：密码错误时 decryptWithPassword 抛错（UI 提示"密码错误或文件已损坏"）
		return JSON.parse(mod.decryptWithPassword(render, password ?? ''));
	}
	const decrypted = mod.decryptRenderString(render);
	const probe = JSON.parse(decrypted);
	if (typeof probe !== 'object' || probe === null || Object.keys(probe).length === 0) {
		throw new Error('该文件由其他电脑加密导出，无法在本机解密');
	}
	return probe;
}

const SAMPLE_RENDER = {
	browser: { root: { uid: 'root-folder', type: 'root', children: {} } },
	setting: { ocs: { store: { token: 'xxx' }, openSync: false } },
	scripts: []
};

// ── 真实导出样本（存在时启用） ──
const FIXTURE = path.resolve(process.cwd(), '../../.codebuddy/OCS软件数据导出_-2026-10-19.ocsdata');
const fixture = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : null;

describe('真实导出样本（.ocsdata fixture）', () => {
	it.skipIf(!fixture)('样本为明文 render 对象：新旧版本均原样兼容', async () => {
		expect(typeof fixture.render).not.toBe('string');

		// 新版导入
		const mod = await loadCrypto();
		await mod.initCrypto();
		const imported = await currentImport(fixture.render, mod);
		expect(imported).toEqual(fixture.render);

		// 旧版 3.0.1 导入（非字符串直接通过）
		const legacy = legacyV3Import(fixture.render, crypto.randomBytes(32));
		expect(legacy).toEqual(fixture.render);
	});

	it.skipIf(!fixture)('样本结构完整：browser.root 存在（导入流程的遍历前提）', () => {
		expect(fixture.render.browser?.root).toBeDefined();
		expect(fixture.render.browser.root.type).toBe('root');
	});
});

describe('新版本导出 → 旧版本导入（前向兼容）', () => {
	it('明文导出（留空密码）：旧版 3.0.1 可直接导入', async () => {
		const mod = await loadCrypto();
		await mod.initCrypto();
		// 明文导出 = render 原样为对象
		const legacy = legacyV3Import(
			JSON.parse(JSON.stringify(SAMPLE_RENDER)).browser && SAMPLE_RENDER,
			crypto.randomBytes(32)
		);
		expect(legacy).toEqual(SAMPLE_RENDER);
	});

	it('密码加密导出：旧版 3.0.1 导入失败但安全降级（抛错被外层捕获，不崩溃不污染数据）', async () => {
		const mod = await loadCrypto();
		await mod.initCrypto();
		const payload = mod.encryptWithPassword(JSON.stringify(SAMPLE_RENDER), 'pw-123');

		// 旧版逻辑：含冒号 → 当本机 AES 密文处理 → GCM 校验失败抛错
		expect(() => legacyV3Import(payload, crypto.randomBytes(32))).toThrow();
	});
});

describe('旧版本导出 → 新版本导入（后向兼容）', () => {
	it('3.0.x 本机 AES 导出（同机同密钥）：新版正常解密', async () => {
		// 模拟 3.0.x 环境：keytar 密钥升格为主密钥
		const legacyKey = crypto.randomBytes(32);
		mocks.keytarHex = legacyKey.toString('hex');
		const legacyPayload = aesEncryptWith(legacyKey, JSON.stringify(SAMPLE_RENDER));

		const mod = await loadCrypto();
		await mod.initCrypto();
		const imported = await currentImport(legacyPayload, mod);
		expect(imported).toEqual(SAMPLE_RENDER);
	});

	it('3.0.x 本机 AES 导出（跨机器）：新版解密失败 → 空对象探测 → 明确报错', async () => {
		const foreignPayload = aesEncryptWith(crypto.randomBytes(32), JSON.stringify(SAMPLE_RENDER));

		const mod = await loadCrypto();
		await mod.initCrypto(); // 本机全新密钥
		await expect(currentImport(foreignPayload, mod)).rejects.toThrow('无法在本机解密');
	});

	it('< 3.0 safeStorage 直通导出（纯 base64）：新版兼容读取', async () => {
		const legacyPayload = Buffer.from(JSON.stringify(SAMPLE_RENDER)).toString('base64');

		const mod = await loadCrypto();
		await mod.initCrypto();
		const imported = await currentImport(legacyPayload, mod);
		expect(imported).toEqual(SAMPLE_RENDER);
	});
});

describe('新版本导出 → 新版本导入（自身闭环）', () => {
	it('密码加密导出 → 正确密码导入', async () => {
		const mod = await loadCrypto();
		await mod.initCrypto();
		const payload = mod.encryptWithPassword(JSON.stringify(SAMPLE_RENDER), 'pw-123');
		expect(await currentImport(payload, mod, 'pw-123')).toEqual(SAMPLE_RENDER);
	});

	it('密码加密导出 → 跨机器导入（另一枚主密钥环境）', async () => {
		const modA = await loadCrypto();
		await modA.initCrypto();
		const payload = modA.encryptWithPassword(JSON.stringify(SAMPLE_RENDER), 'pw-123');

		// 另一台机器：独立密钥环境
		mocks.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-compat-test-b-'));
		const modB = await loadCrypto();
		await modB.initCrypto();
		expect(await currentImport(payload, modB, 'pw-123')).toEqual(SAMPLE_RENDER);
	});

	it('密码加密导出 → 错误密码导入抛错（UI 提示密码错误）', async () => {
		const mod = await loadCrypto();
		await mod.initCrypto();
		const payload = mod.encryptWithPassword(JSON.stringify(SAMPLE_RENDER), 'pw-123');
		await expect(currentImport(payload, mod, 'wrong')).rejects.toThrow();
	});
});

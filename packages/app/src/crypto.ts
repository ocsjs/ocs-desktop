import { safeStorage } from 'electron';
import crypto from 'crypto';
import keytar from 'keytar';
import { Logger } from './logger';

const logger = Logger('crypto');

// --- 常量 ---
const SERVICE_NAME = 'ocs-desktop';
const ACCOUNT_NAME = 'aes-key';

// --- 状态 ---
let cachedAesKey: Buffer | null = null;

/**
 * 异步初始化加密模块
 *
 * 两种加密方案：
 * 1. keytar + AES：密钥存入 OS 密钥链，用 AES-256-GCM 加解密数据（优先）
 * 2. safeStorage：Electron safeStorage 直通加解密（降级）
 *
 * ⚠️ 必须在 initStore() 之前调用
 */
export async function initAesKey(): Promise<void> {
	if (cachedAesKey) return;

	try {
		// ── keytar 方案 ──

		// 从密钥链读取已有密钥
		const hex = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
		if (hex) {
			cachedAesKey = Buffer.from(hex, 'hex');
			logger.info('从密钥链加载 AES 密钥');
			return;
		}

		// 密钥链中没有，生成新密钥并存入
		cachedAesKey = crypto.randomBytes(32);
		await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, cachedAesKey.toString('hex'));
		logger.info('生成新 AES 密钥并存入密钥链');
	} catch (e) {
		// keytar 不可用时 cachedAesKey 保持 null，所有加解密走 safeStorage
		logger.warn('keytar 初始化失败，使用 safeStorage 方案', e);
	}
}

/**
 * AES 密钥是否可用（即 keytar 方案是否生效）
 */
export function isAesAvailable(): boolean {
	return cachedAesKey !== null;
}

/**
 * 同步获取缓存的 AES 密钥
 * ⚠️ 仅在 isAesAvailable() 为 true 时调用
 */
export function getAesKey(): Buffer {
	if (!cachedAesKey) {
		throw new Error('AES key not available. keytar is not loaded.');
	}
	return cachedAesKey;
}

// ────────────────────────────────────────────
//  AES-256-GCM 加解密（keytar 方案专用）
// ────────────────────────────────────────────

/**
 * AES-256-GCM 加密
 * @returns 格式: iv:authTag:ciphertext（base64 编码）
 */
export function encryptAes(plaintext: string): string {
	const key = getAesKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
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
	const key = getAesKey();
	const parts = ciphertext.split(':');
	const iv = Buffer.from(parts[0], 'base64');
	const authTag = Buffer.from(parts[1], 'base64');
	const data = parts.slice(2).join(':');
	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(authTag);
	let decrypted = decipher.update(data, 'base64', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}

// ────────────────────────────────────────────
//  渲染进程数据加解密（自适应方案）
// ────────────────────────────────────────────

/**
 * 加密渲染进程数据
 * - keytar 可用 → AES-256-GCM（格式: iv:authTag:ciphertext）
 * - keytar 不可用 → safeStorage 直通（格式: 纯 base64）
 */
export function encryptRenderString(plaintext: string): string {
	if (isAesAvailable()) {
		return encryptAes(plaintext);
	}
	return safeStorage.encryptString(plaintext).toString('base64');
}

/**
 * 解密渲染进程数据（自适应新旧格式）
 * - 含冒号 → AES-256-GCM 格式（keytar 方案）
 * - 纯 base64 → safeStorage 格式（旧数据）
 */
export function decryptRenderString(encrypted: string): string {
	if (encrypted.includes(':')) {
		return decryptAes(encrypted);
	}
	// safeStorage 格式
	return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
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

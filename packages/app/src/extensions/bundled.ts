/**
 * 内置拓展运行时模块（主进程专用）。
 *
 * 拓展 zip 在构建期由 scripts/fetch-extensions.js 从官方渠道获取并打入 asar
 * （asar 完整性由 Electron fuse EnableEmbeddedAsarIntegrityValidation + exe 签名背书），
 * 运行时零网络依赖：
 *
 * - ensureExtensionsIntegrity()：App 启动时对「已释放」的拓展做完整性校验，
 *   快检（文件数+总字节，比对 asar 内官方清单）→ 可疑则逐文件全量哈希 → 不符自动从 asar 重释放；
 * - installBundledExtension(id)：按需（环境补全/应用中心切换）从 asar 释放指定拓展，
 *   释放后按官方清单逐文件校验，失败即抛错；
 * - getBundledExtensions()：内置清单（供渲染进程能力探测）。
 *
 * 安全边界：asar 外（释放目录）的防护依赖「每次启动浏览器前重算指纹」；
 * 已具备用户级写权限的针对性攻击者不在防护范围（见 plans/extension-bundled-release-final-plan.md）。
 *
 * 注意：worker 子进程为纯 Node 环境（ELECTRON_RUN_AS_NODE），无 asar 补丁，
 * 因此 asar 读取/解压/校验全部在本模块（主进程）完成，worker 只接收解压后的磁盘路径。
 */
import { app } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { unzip } from '../utils';
import { downloadFile } from '../utils/download';
import { store } from '../store';
import { Logger } from '../logger';
import { quickVerifyExtension, fullVerifyExtension } from './verify';

const logger = Logger('extensions');

/** 构建期生成的逐文件哈希清单（asar 内，防篡改链的基准） */
export interface BundledExtensionManifest {
	id: string;
	name: string;
	version: string;
	license: string;
	sourceUrl: string;
	homepage: string;
	/** 打入 asar 的 zip 字节 SHA256 */
	sha256: string;
	/** 包格式（crx 运行时兜底下载后需剥头；zip 直接使用） */
	format?: 'zip' | 'crx';
	/** 锁定下载源（按序兜底；由构建期从 extensions.lock.json 带入，供 asar 释放失败时远程下载兜底） */
	sources?: string[];
	fileCount: number;
	totalBytes: number;
	/** 相对路径（正斜杠）→ 文件内容 SHA256 */
	files: Record<string, string>;
}

export interface BundledExtensionInfo {
	id: string;
	name: string;
	version: string;
	license: string;
	sourceUrl: string;
	homepage: string;
}

export interface ExtensionIntegrityResult {
	id: string;
	/** ok=校验通过；repaired=校验失败已从 asar 重释放；skipped=未安装（按需安装，不强制释放）；failed=修复失败 */
	status: 'ok' | 'repaired' | 'skipped' | 'failed';
	error?: string;
}

/** asar 内的内置拓展目录（dev 模式下 getAppPath 指向源码包目录，路径逻辑一致） */
function bundledDir() {
	return path.join(app.getAppPath(), 'resources', 'extensions');
}

function extensionsFolder() {
	// store 为 electron-store 实例，完整数据需经 .store 访问（同 utils/ocr.ts）
	return store.store.paths.extensionsFolder;
}

function extensionDir(id: string) {
	return path.join(extensionsFolder(), id);
}

/** 读取 asar 内的全部内置拓展清单 */
export function listBundledExtensions(): BundledExtensionManifest[] {
	try {
		return fs
			.readdirSync(bundledDir())
			.filter((f) => f.endsWith('.manifest.json'))
			.map((f) => JSON.parse(fs.readFileSync(path.join(bundledDir(), f), 'utf-8')) as BundledExtensionManifest);
	} catch (e) {
		// asar 中无内置拓展（如本地打包使用了 OCS_SKIP_EXTENSIONS）时降级为空列表
		logger.warn('读取内置拓展清单失败：' + String(e));
		return [];
	}
}

export function getBundledExtensions(): BundledExtensionInfo[] {
	return listBundledExtensions().map(({ id, name, version, license, sourceUrl, homepage }) => ({
		id,
		name,
		version,
		license,
		sourceUrl,
		homepage
	}));
}

/** 并发去重：同一拓展的释放/修复共享同一 in-flight Promise */
const extractInflight = new Map<string, Promise<string>>();

/**
 * 从 asar 释放拓展到 extensionsFolder（原子换入，失败不污染旧目录）。
 * 流程：asar 流式读 zip（同时算哈希比对钉值）→ 临时文件 → 统一解压管线（含 zip-slip 防护）→ 全量校验。
 */
export async function extractBundledExtension(manifest: BundledExtensionManifest): Promise<string> {
	const running = extractInflight.get(manifest.id);
	if (running) return running;

	const job = (async () => {
		const zipInAsar = path.join(bundledDir(), manifest.id + '.zip');
		if (!fs.existsSync(zipInAsar)) {
			throw new Error(`内置拓展 ${manifest.name} 的安装包缺失（${zipInAsar}），请重新安装软件`);
		}

		fs.mkdirSync(extensionsFolder(), { recursive: true });
		const tempZip = path.join(extensionsFolder(), `.tmp-${manifest.id}-${Date.now()}.zip`);
		try {
			// 流式读出 asar 内 zip，同时计算 SHA256 比对官方钉值
			const hash = crypto.createHash('sha256');
			await new Promise<void>((resolve, reject) => {
				const reader = fs.createReadStream(zipInAsar);
				const writer = fs.createWriteStream(tempZip);
				reader.on('data', (chunk) => hash.update(chunk));
				reader.on('error', reject);
				writer.on('error', reject);
				writer.on('finish', () => resolve());
				reader.pipe(writer);
			});
			const actual = hash.digest('hex');
			if (actual !== manifest.sha256) {
				throw new Error(
					`内置拓展 ${manifest.name} 安装包校验失败（期望 ${manifest.sha256}，实际 ${actual}），请重新安装软件`
				);
			}

			// 统一解压管线：暂存解压（含 zip-slip 防护）→ 原子换入，失败时旧目录保持可用
			const target = extensionDir(manifest.id);
			await unzip(tempZip, target);

			// 释放后按官方清单逐文件校验，杜绝"解压链路上的任何污染"
			if (!fullVerifyExtension(target, manifest)) {
				fs.rmSync(target, { recursive: true, force: true });
				throw new Error(`内置拓展 ${manifest.name} 释放后完整性校验失败，请重新安装软件`);
			}
			logger.info(`${manifest.name} 已就绪：${target}（v${manifest.version}）`);
			return target;
		} finally {
			fs.rmSync(tempZip, { force: true });
		}
	})();

	extractInflight.set(manifest.id, job);
	try {
		return await job;
	} finally {
		extractInflight.delete(manifest.id);
	}
}

/** 剥离 crx 头，返回 zip 字节（支持 crx2/crx3；与 scripts/fetch-extensions.js 同逻辑） */
function stripCrxHeader(buf: Buffer): Buffer {
	if (buf.toString('ascii', 0, 4) !== 'Cr24') throw new Error('不是有效的 CRX 文件（魔数不符）');
	const version = buf.readUInt32LE(4);
	if (version === 3) {
		const headerSize = buf.readUInt32LE(8);
		return buf.subarray(12 + headerSize);
	}
	if (version === 2) {
		const pubkeyLen = buf.readUInt32LE(8);
		const sigLen = buf.readUInt32LE(12);
		return buf.subarray(16 + pubkeyLen + sigLen);
	}
	throw new Error('不支持的 CRX 版本: ' + version);
}

/**
 * 兜底：asar 释放链路失败（安装包缺失/钉值不符/解压损坏）时，从锁定源远程下载，
 * 重走同一套钉值校验 + 解压 + 逐文件校验管线。sources/format 由构建期 manifest 携带。
 */
async function downloadBundledExtensionFallback(manifest: BundledExtensionManifest): Promise<string> {
	if (!manifest.sources?.length) {
		throw new Error(`内置拓展 ${manifest.name} asar 释放失败，且无可用下载源兜底`);
	}
	const errors: string[] = [];
	for (const url of manifest.sources) {
		const tempFile = path.join(extensionsFolder(), `.tmp-dl-${manifest.id}-${Date.now()}`);
		try {
			logger.warn(`${manifest.name} 从 asar 释放失败，远程下载兜底：${url}`);
			await downloadFile(url, tempFile);
			let zipBuf = fs.readFileSync(tempFile);
			if (manifest.format === 'crx') {
				zipBuf = stripCrxHeader(zipBuf);
			}
			const actual = crypto.createHash('sha256').update(zipBuf).digest('hex');
			if (actual !== manifest.sha256) {
				throw new Error(`下载校验失败（期望 ${manifest.sha256}，实际 ${actual}）`);
			}
			const tempZip = tempFile + '.zip';
			fs.writeFileSync(tempZip, zipBuf);
			const target = extensionDir(manifest.id);
			await unzip(tempZip, target);
			if (!fullVerifyExtension(target, manifest)) {
				fs.rmSync(target, { recursive: true, force: true });
				throw new Error('释放后完整性校验失败');
			}
			logger.info(`${manifest.name} 远程下载兜底成功：${target}（v${manifest.version}）`);
			return target;
		} catch (e: any) {
			errors.push(`${url}：${e?.message || e}`);
		} finally {
			fs.rmSync(tempFile, { force: true });
			fs.rmSync(tempFile + '.zip', { force: true });
		}
	}
	throw new Error(`内置拓展 ${manifest.name} 远程下载兜底失败：\n${errors.join('\n')}`);
}

/** 按需安装指定内置拓展（环境补全/应用中心切换脚本管理器），返回拓展目录 */
export async function installBundledExtension(id: string): Promise<string> {
	const manifest = listBundledExtensions().find((m) => m.id === id);
	if (!manifest) {
		throw new Error(
			`「${id}」不是内置拓展，无法安装（内置列表：${
				getBundledExtensions()
					.map((m) => m.id)
					.join(', ') || '空'
			}）`
		);
	}
	try {
		return await extractBundledExtension(manifest);
	} catch (e) {
		// asar 释放链路整体失败 → 远程下载兜底（同一钉值/校验管线）
		return await downloadBundledExtensionFallback(manifest);
	}
}

/**
 * 启动时完整性校验：仅处理「已释放」的拓展（未安装的按需安装，不强制释放）。
 * 快检 → 全量哈希 → 不符自动从 asar 重释放。返回每个已安装拓展的处理结果。
 */
export async function ensureExtensionsIntegrity(): Promise<ExtensionIntegrityResult[]> {
	const results: ExtensionIntegrityResult[] = [];
	for (const manifest of listBundledExtensions()) {
		const dir = extensionDir(manifest.id);
		if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
			results.push({ id: manifest.id, status: 'skipped' });
			continue;
		}
		try {
			if (quickVerifyExtension(dir, manifest) || fullVerifyExtension(dir, manifest)) {
				results.push({ id: manifest.id, status: 'ok' });
				continue;
			}
			logger.warn(`${manifest.name} 完整性校验失败，自动重释放：${dir}`);
			// 走 installBundledExtension：asar 释放失败时自动远程下载兜底
			await installBundledExtension(manifest.id);
			results.push({ id: manifest.id, status: 'repaired' });
		} catch (e: any) {
			logger.error(`${manifest.name} 完整性修复失败：${e?.message || e}`);
			results.push({ id: manifest.id, status: 'failed', error: e?.message || String(e) });
		}
	}
	return results;
}

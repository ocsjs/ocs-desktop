import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {
	BUILTIN_CHROME_SHA256,
	ChromeDownloadSource,
	getChromeDownloadSources,
	resolveCftPlatform
} from '@ocs-desktop/common';
import { Logger } from '../logger';
import { store } from '../store';
import { downloadFile } from '../utils/download';

const logger = Logger('chrome-downloader');

export interface ChromeDownloadProgress {
	/** 当前下载源展示名 */
	sourceName: string;
	/** 当前源序号（从 1 开始，用于展示「第 x/y 个下载源」） */
	sourceIndex: number;
	sourceCount: number;
	/** 当前源下载进度 0-100 */
	rate: number;
	totalLength: number;
	chunkLength: number;
}

/**
 * 三级源降级下载内置浏览器压缩包。
 *
 * 按 getChromeDownloadSources() 优先级（国内镜像 → 谷歌官方 → OCS 自建 CDN）依次尝试：
 * 1. 下载到 destZipPath + '.downloading' 临时文件（防止中断残留被误判为可用）
 * 2. 下载过程中流式计算 SHA256，与内置常量比对
 * 3. 校验通过 rename 为 destZipPath 并返回；下载失败或校验失败删除临时文件并切换下一源
 *
 * 全部源失败时抛出聚合错误（message 含各源失败原因），由调用方引导用户手动获取文件。
 */
export async function downloadBuiltinChromeZip(
	destZipPath: string,
	onProgress?: (progress: ChromeDownloadProgress) => void
): Promise<void> {
	const platform = resolveCftPlatform();
	const expectedSha256 = BUILTIN_CHROME_SHA256[platform];
	// 开发者设置中可强制指定下载源（测试下载链路），默认按优先级降级
	const sourceOverride = store.store.updater?.chromeSource;
	const allSources = getChromeDownloadSources(undefined, platform);
	const sources = sourceOverride ? allSources.filter((s) => s.type === sourceOverride) : allSources;
	const tempZipPath = destZipPath + '.downloading';

	if (sourceOverride && sources.length > 0) {
		logger.info(`使用开发者指定的下载源: ${sources[0].name}`, { url: sources[0].url });
	}

	fs.mkdirSync(path.dirname(destZipPath), { recursive: true });

	const failures: string[] = [];

	for (let i = 0; i < sources.length; i++) {
		const source = sources[i];
		logger.info(`尝试从 ${source.name} 下载内置浏览器`, { url: source.url });
		try {
			await downloadAndVerify(source, expectedSha256, tempZipPath, (rate, totalLength, chunkLength) => {
				onProgress?.({
					sourceName: source.name,
					sourceIndex: i + 1,
					sourceCount: sources.length,
					rate,
					totalLength,
					chunkLength
				});
			});
			fs.renameSync(tempZipPath, destZipPath);
			logger.info(`内置浏览器下载完成（${source.name}）`, { destZipPath });
			return;
		} catch (e) {
			const reason = formatError(e);
			logger.error(`${source.name} 下载失败`, { url: source.url, reason });
			failures.push(`${source.name}：${reason}`);
			fs.rmSync(tempZipPath, { force: true });
		}
	}

	throw new Error(failures.join('\n'));
}

/**
 * 下载单个源并校验 SHA256（统一下载器：分块并发 + 断点续传，慢网速下显著提速）。
 * 下载完成但校验不通过同样抛错（交给上层切换下一源）。
 */
async function downloadAndVerify(
	source: ChromeDownloadSource,
	expectedSha256: string,
	tempZipPath: string,
	onRate: (rate: number, totalLength: number, chunkLength: number) => void
): Promise<void> {
	await downloadFile(source.url, tempZipPath, { onProgress: onRate });

	// 下载完成后整体校验（分块并发下无法边下边算；150MB 读盘哈希约 1s，可忽略）
	const hash = crypto.createHash('sha256');
	for await (const chunk of fs.createReadStream(tempZipPath)) {
		hash.update(chunk as Buffer);
	}
	const actualSha256 = hash.digest('hex');
	if (actualSha256 !== expectedSha256) {
		throw new Error(`文件校验失败（SHA256 不匹配），期望 ${expectedSha256}，实际 ${actualSha256}`);
	}
}

/** 提取可读错误信息：HTTP 状态码优先，其次 axios/系统错误信息 */
function formatError(e: any): string {
	if (axios.isAxiosError(e)) {
		if (e.response) {
			return `HTTP ${e.response.status}`;
		}
		if (e.code === 'ECONNABORTED') {
			return '下载超时（60 秒无数据传输）';
		}
		return e.message;
	}
	return String(e && e.message ? e.message : e);
}

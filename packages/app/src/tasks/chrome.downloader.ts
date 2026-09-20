import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import {
	BUILTIN_CHROME_SHA256,
	ChromeDownloadSource,
	getChromeDownloadSources,
	resolveCftPlatform
} from '@ocs-desktop/common';
import { Logger } from '../logger';
import { store } from '../store';

const logger = Logger('chrome-downloader');

/** 单源下载空闲超时：60 秒无任何数据传输判定为失败，切换下一源 */
const DOWNLOAD_IDLE_TIMEOUT = 60 * 1000;

/** 进度回调节流间隔，避免日志/状态刷屏 */
const PROGRESS_THROTTLE = 500;

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
 * 下载单个源并流式校验 SHA256。
 * 下载完成但校验不通过同样抛错（交给上层切换下一源）。
 */
async function downloadAndVerify(
	source: ChromeDownloadSource,
	expectedSha256: string,
	tempZipPath: string,
	onRate: (rate: number, totalLength: number, chunkLength: number) => void
): Promise<void> {
	const { data, headers } = await axios.get(source.url, {
		responseType: 'stream',
		// 自建源文件可能不存在，404 等错误状态直接抛错切换下一源
		validateStatus: (status) => status >= 200 && status < 300,
		timeout: DOWNLOAD_IDLE_TIMEOUT
	});

	const totalLength = parseInt(headers['content-length']) || 0;
	const hash = crypto.createHash('sha256');
	let chunkLength = 0;
	let lastReportTime = 0;

	data.on('data', (chunk: Buffer) => {
		hash.update(chunk);
		chunkLength += chunk.length;
		const now = Date.now();
		if (totalLength > 0 && now - lastReportTime >= PROGRESS_THROTTLE) {
			lastReportTime = now;
			const rate = Math.min(100, (chunkLength / totalLength) * 100);
			onRate(parseFloat(rate.toFixed(2)), totalLength, chunkLength);
		}
	});

	// pipeline 会传播 data/writer 任一侧的错误（如连接中断、磁盘写入失败），避免 pipe 静默挂起
	await pipeline(data, fs.createWriteStream(tempZipPath));

	onRate(100, totalLength, chunkLength);

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

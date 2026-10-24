import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';

const logger = Logger('download');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 瞬时网络错误自动重试。
 * Node 19+ http 全局 Agent 默认 keepAlive，可能复用到刚被对端关闭的空闲连接
 * （ECONNRESET / socket hang up），重试即可拿到新连接；CDN 断连同理。
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
	for (let i = 0; ; i++) {
		try {
			return await fn();
		} catch (e: any) {
			const transient =
				e?.code === 'ECONNRESET' || e?.code === 'ECONNABORTED' || String(e?.message).includes('socket hang up');
			if (!transient || i >= retries) throw e;
			await sleep(300 * (i + 1));
		}
	}
}

/** 默认分块并发数 */
const DEFAULT_CONCURRENCY = 6;
/** 最小分块大小：小于该尺寸的文件不拆分（并发收益抵不过连接开销） */
const MIN_CHUNK_SIZE = 4 * 1024 * 1024;
/** 单块失败重试次数（重试时从块内已写字节处续传） */
const CHUNK_RETRIES = 3;
/** 空闲超时：无任何数据传输超过该时长判定连接失效 */
const IDLE_TIMEOUT = 60 * 1000;
/** 进度回调节流间隔 */
const PROGRESS_THROTTLE = 300;

/** 断点续传元数据（存储于 `<dest>.ocsdl.json` 旁车文件） */
interface DownloadMeta {
	url: string;
	size: number;
	/** 资源版本标识（etag 或 last-modified），变化则放弃续传 */
	etag: string;
	chunkSize: number;
	/** 已完成的分块索引 */
	done: number[];
}

export interface DownloadFileOptions {
	/** 分块并发数（默认 6） */
	concurrency?: number;
	/** 单块大小（默认 max(4MB, size/并发*4)，限制总块数） */
	chunkSize?: number;
	/** 单块重试次数（默认 3） */
	retries?: number;
	/** 进度回调：rate 0-100、总字节、已下载字节 */
	onProgress?: (rate: number, totalLength: number, loadedLength: number) => void;
}

/**
 * 统一下载器：分块并发 + 断点续传（业界主流下载器做法，参考 IDM/aria2/electron-updater）。
 *
 * 流程：
 * 1. Range 探测（GET bytes=0-0）：服务器支持 206 且文件足够大 → 分块并发；
 *    否则回退单流下载（不支持续传，覆盖写）。
 * 2. 分块并发：文件预分配全尺寸，N 个 worker 按 Range 拉取分块、按偏移写入；
 *    单块失败重试时从块内已写字节处续传；每块完成即落盘旁车元数据。
 * 3. 断点续传：重启/重试时若旁车元数据（url+size+etag）与目标文件尺寸一致，
 *    跳过已完成分块，仅补缺失分块。
 * 4. 全部完成：清理旁车元数据。
 */
export async function downloadFile(fileURL: string, outputURL: string, options: DownloadFileOptions = {}) {
	const { concurrency = DEFAULT_CONCURRENCY, retries = CHUNK_RETRIES, onProgress } = options;
	logger.info('downloadFile', fileURL, outputURL);
	fs.mkdirSync(path.dirname(outputURL), { recursive: true });

	const probe = await probeRangeSupport(fileURL);
	// 不支持 Range 或文件太小：单流下载
	if (!probe.supported || probe.size < MIN_CHUNK_SIZE * 2) {
		await simpleDownload(fileURL, outputURL, probe.size, onProgress);
		fs.rmSync(metaPathOf(outputURL), { force: true });
		return outputURL;
	}

	const chunkSize = options.chunkSize || Math.max(MIN_CHUNK_SIZE, Math.ceil(probe.size / (concurrency * 4)));
	const chunkCount = Math.ceil(probe.size / chunkSize);
	const metaPath = metaPathOf(outputURL);

	// ── 断点续传：校验旁车元数据与目标文件尺寸 ──
	let done = new Set<number>();
	let meta: DownloadMeta | undefined;
	if (fs.existsSync(metaPath) && fs.existsSync(outputURL)) {
		try {
			meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
		} catch {
			meta = undefined;
		}
	}
	const stat = fs.existsSync(outputURL) ? fs.statSync(outputURL) : undefined;
	const resumable =
		meta &&
		meta.url === fileURL &&
		meta.size === probe.size &&
		meta.etag === probe.etag &&
		meta.chunkSize === chunkSize &&
		stat &&
		stat.size === probe.size;
	if (resumable) {
		done = new Set(meta!.done.filter((i) => i >= 0 && i < chunkCount));
		if (done.size > 0) {
			logger.info(`断点续传：已完成 ${done.size}/${chunkCount} 块`, { outputURL });
		}
	} else {
		fs.rmSync(metaPath, { force: true });
	}

	const handle = fs.openSync(outputURL, resumable ? 'r+' : 'w');
	if (!resumable) {
		// 预分配全尺寸：避免碎片，且续传时可凭文件尺寸校验完整性
		fs.ftruncateSync(handle, probe.size);
	}

	/** 已下载字节（含已完成块 + 进行中块已写部分），多 worker 共享 */
	let loaded = 0;
	for (const i of done) {
		loaded += chunkLengthOf(i, chunkSize, probe.size);
	}
	let lastReportAt = 0;
	const report = (force = false) => {
		if (!onProgress) return;
		const now = Date.now();
		if (!force && now - lastReportAt < PROGRESS_THROTTLE) return;
		lastReportAt = now;
		onProgress(parseFloat(Math.min(100, (loaded / probe.size) * 100).toFixed(2)), probe.size, loaded);
	};
	report(true);

	const persistMeta = () => {
		const snapshot: DownloadMeta = { url: fileURL, size: probe.size, etag: probe.etag, chunkSize, done: [...done] };
		fs.writeFileSync(metaPath, JSON.stringify(snapshot));
	};

	const downloadChunk = async (index: number) => {
		const start = index * chunkSize;
		const end = Math.min(start + chunkSize, probe.size) - 1;
		let offset = start;
		for (let attempt = 0; ; attempt++) {
			try {
				const res = await axios.get(fileURL, {
					headers: { Range: `bytes=${offset}-${end}` },
					responseType: 'stream',
					// 非 206 视为失败（含 200 全量响应：服务器不支持 Range，交给上层回退）
					validateStatus: (s) => s === 206,
					timeout: IDLE_TIMEOUT
				});
				// 空闲看门狗：axios timeout 只管响应头，body 停滞需要自行判定
				let lastDataAt = Date.now();
				const watchdog = setInterval(() => {
					if (Date.now() - lastDataAt > IDLE_TIMEOUT) {
						res.data.destroy(new Error(`分块 ${index} 空闲超时（${IDLE_TIMEOUT / 1000}s 无数据）`));
					}
				}, 1000);
				try {
					for await (const data of res.data as AsyncIterable<Buffer>) {
						lastDataAt = Date.now();
						fs.writeSync(handle, data, 0, data.length, offset);
						offset += data.length;
						loaded += data.length;
						report();
					}
				} finally {
					clearInterval(watchdog);
				}
				if (offset - 1 !== end) {
					throw new Error(`分块 ${index} 数据不完整（期望 ${end - start + 1} 字节，实际 ${offset - start}）`);
				}
				return;
			} catch (e) {
				if (attempt >= retries) {
					throw new Error(`分块 ${index}/${chunkCount} 下载失败：${formatError(e)}`);
				}
				logger.warn(`分块 ${index} 下载失败，${500 * 2 ** attempt}ms 后重试（第 ${attempt + 1} 次）`, {
					error: String(e)
				});
				await sleep(500 * 2 ** attempt);
			}
		}
	};

	// worker 池：固定并发数，轮流领取未完成的分块
	let nextIndex = 0;
	const worker = async () => {
		while (true) {
			const index = nextIndex++;
			if (index >= chunkCount) return;
			if (done.has(index)) continue;
			await downloadChunk(index);
			done.add(index);
			persistMeta();
			report(true);
		}
	};

	try {
		await Promise.all(Array.from({ length: Math.min(concurrency, chunkCount) }, () => worker()));
	} finally {
		fs.closeSync(handle);
	}
	fs.rmSync(metaPath, { force: true });
	report(true);
	return outputURL;
}

/** Range 支持探测：GET bytes=0-0，206 则支持分块；同时取资源版本标识用于续传校验 */
async function probeRangeSupport(url: string): Promise<{ supported: boolean; size: number; etag: string }> {
	try {
		const res = await withRetry(() =>
			axios.get(url, {
				headers: { Range: 'bytes=0-0' },
				responseType: 'stream',
				validateStatus: (s) => s < 400,
				timeout: 30 * 1000
			})
		);
		// 只取响应头，立即断开，不下载 body
		res.data.destroy();
		if (res.status === 206) {
			const contentRange = String(res.headers['content-range'] || '');
			const total = Number(contentRange.split('/')[1]) || 0;
			return {
				supported: total > 0,
				size: total,
				etag: String(res.headers.etag || res.headers['last-modified'] || '')
			};
		}
		return { supported: false, size: Number(res.headers['content-length']) || 0, etag: '' };
	} catch (e) {
		logger.warn('Range 探测失败，回退单流下载', { url, error: String(e) });
		return { supported: false, size: 0, etag: '' };
	}
}

/** 单流下载（服务器不支持 Range 时回退）：带空闲看门狗与进度回调，不支持断点续传 */
async function simpleDownload(
	url: string,
	dest: string,
	totalLength: number,
	onProgress?: (rate: number, totalLength: number, loadedLength: number) => void
) {
	const { data } = await withRetry(() =>
		axios.get(url, {
			responseType: 'stream',
			validateStatus: (s) => s >= 200 && s < 300,
			timeout: IDLE_TIMEOUT
		})
	);

	let lastDataAt = Date.now();
	const watchdog = setInterval(() => {
		if (Date.now() - lastDataAt > IDLE_TIMEOUT) {
			data.destroy(new Error(`下载空闲超时（${IDLE_TIMEOUT / 1000}s 无数据）`));
		}
	}, 1000);

	let loaded = 0;
	let lastReportAt = 0;
	data.on('data', (chunk: Buffer) => {
		lastDataAt = Date.now();
		loaded += chunk.length;
		if (totalLength > 0 && onProgress && Date.now() - lastReportAt >= PROGRESS_THROTTLE) {
			lastReportAt = Date.now();
			// clamp 到 0-100，防止 content-length 与实际数据不匹配（如 gzip 解压、分块传输等）
			onProgress(parseFloat(Math.min(100, (loaded / totalLength) * 100).toFixed(2)), totalLength, loaded);
		}
	});

	try {
		const writer = fs.createWriteStream(dest);
		data.pipe(writer);
		await new Promise<void>((resolve, reject) => {
			writer.on('finish', resolve);
			writer.on('error', reject);
			data.on('error', reject);
		});
	} finally {
		clearInterval(watchdog);
	}
	onProgress?.(100, totalLength, loaded);
}

function metaPathOf(dest: string) {
	return dest + '.ocsdl.json';
}

function chunkLengthOf(index: number, chunkSize: number, total: number) {
	const start = index * chunkSize;
	return Math.min(chunkSize, total - start);
}

/** 提取可读错误信息：HTTP 状态码优先，其次 axios/系统错误信息 */
function formatError(e: any): string {
	if (axios.isAxiosError(e)) {
		if (e.response) {
			return `HTTP ${e.response.status}`;
		}
		if (e.code === 'ECONNABORTED') {
			return '下载超时（无数据传输）';
		}
		return e.message;
	}
	return String(e && e.message ? e.message : e);
}

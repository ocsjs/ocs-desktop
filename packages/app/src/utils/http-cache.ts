/**
 * HTTP 磁盘缓存：为速度不稳定的站点（脚本猫/GreasyFork/智慧树/超星等）加速。
 * - 新鲜缓存（TTL 内）直接返回，避免重复请求；
 * - 网络失败时回退过期缓存（stale fallback），弱网兜底；
 * - 内存 + 磁盘双层：进程内秒回，重启软件后磁盘缓存仍可用；
 * - 条目携带站点 id，支持按站点统计与清理；
 * - 无 Electron 依赖（worker 纯 Node 进程共用），使用前须 initHttpCache 指定缓存根目录。
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { siteOfUrl } from '@ocs-desktop/common';

interface CacheEntry {
	time: number;
	/** 内容（binary 为 true 时是 base64） */
	body: string;
	/** 归属站点 id（站点级统计/清理） */
	site?: string;
	/** 二进制内容以 base64 存储 */
	binary?: boolean;
	/** 原始响应头（缓存回放时还原，缺失 Content-Type 会导致浏览器拒绝执行 JS/CSS） */
	headers?: Record<string, string>;
}

/** 内存层条目数上限（LRU 淘汰最旧；磁盘层有 200MB 上限，内存层防静态资源大条目累积膨胀） */
const MEMORY_CACHE_MAX = 100;

const memory = new Map<string, CacheEntry>();

/** 内存层写入（超上限时淘汰最旧条目；Map 迭代序即插入序） */
function memorySet(url: string, entry: CacheEntry) {
	if (memory.size >= MEMORY_CACHE_MAX && !memory.has(url)) {
		const firstKey = memory.keys().next().value;
		if (firstKey !== undefined) memory.delete(firstKey);
	}
	memory.set(url, entry);
}

/** 缓存根目录（initHttpCache 指定：主进程 app userData；worker 为 store 的 user-data-path） */
let cacheBaseDir: string | undefined;

/** 磁盘缓存上限（200MB），超出时按时间最旧优先淘汰 */
const MAX_CACHE_BYTES = 200 * 1024 * 1024;

/** 初始化缓存根目录（两个进程各自调用一次） */
export function initHttpCache(baseDir: string) {
	cacheBaseDir = path.join(baseDir, 'cache', 'http');
	evictOldestCache();
}

/** 容量淘汰：超过上限时删除最旧的条目直至达标（静默容错） */
function evictOldestCache() {
	try {
		const files = fs
			.readdirSync(cacheDir())
			.map((name) => path.join(cacheDir(), name))
			.filter((f) => fs.statSync(f).isFile())
			.map((f) => ({
				path: f,
				time: (JSON.parse(fs.readFileSync(f, 'utf-8')) as CacheEntry).time ?? 0,
				size: fs.statSync(f).size
			}))
			.sort((a, b) => a.time - b.time);
		let total = files.reduce((sum, f) => sum + f.size, 0);
		for (const f of files) {
			if (total <= MAX_CACHE_BYTES) break;
			fs.rmSync(f.path, { force: true });
			total -= f.size;
		}
	} catch {}
}

function cacheDir() {
	if (!cacheBaseDir) throw new Error('http-cache 未初始化（请先调用 initHttpCache）');
	return cacheBaseDir;
}

function keyOf(url: string) {
	return crypto.createHash('sha256').update(url).digest('hex').slice(0, 24);
}

function fileOf(url: string) {
	return path.join(cacheDir(), keyOf(url) + '.json');
}

/** 读取缓存（内存优先，磁盘兜底；无缓存返回 undefined） */
export function readHttpCache(url: string): CacheEntry | undefined {
	const mem = memory.get(url);
	if (mem) return mem;
	try {
		const data = JSON.parse(fs.readFileSync(fileOf(url), 'utf-8')) as CacheEntry;
		if (typeof data.time === 'number' && typeof data.body === 'string') {
			memorySet(url, data);
			return data;
		}
	} catch {}
	return undefined;
}

/** 写入缓存（内存 + 磁盘，失败静默；自动标记归属站点；可携带原始响应头供回放还原） */
export function writeHttpCache(url: string, body: string | Buffer, binary = false, headers?: Record<string, string>) {
	const entry: CacheEntry = {
		time: Date.now(),
		body: binary ? (body as Buffer).toString('base64') : String(body),
		binary,
		site: siteOfUrl(url)?.id,
		headers
	};
	memorySet(url, entry);
	try {
		fs.mkdirSync(cacheDir(), { recursive: true });
		// 原子写：先写临时文件再重命名，避免进程崩溃/主+worker 并发写产生半个 JSON
		const tmpFile = fileOf(url) + `.tmp-${process.pid}`;
		fs.writeFileSync(tmpFile, JSON.stringify(entry));
		fs.renameSync(tmpFile, fileOf(url));
	} catch {}
}

/** HTTP 缓存统计：按站点分组的条数与总字节数（含 unknown 分组） */
export function httpCacheStatsBySite(): Record<string, { count: number; bytes: number }> {
	const stats: Record<string, { count: number; bytes: number }> = {};
	try {
		for (const name of fs.readdirSync(cacheDir())) {
			const file = path.join(cacheDir(), name);
			try {
				if (!fs.statSync(file).isFile()) continue;
				const entry = JSON.parse(fs.readFileSync(file, 'utf-8')) as CacheEntry;
				const site = entry.site || 'unknown';
				siteCacheStatsInit(stats, site);
				stats[site].count++;
				stats[site].bytes += fs.statSync(file).size;
			} catch {}
		}
	} catch {}
	return stats;
}

function siteCacheStatsInit(stats: Record<string, { count: number; bytes: number }>, site: string) {
	stats[site] = stats[site] || { count: 0, bytes: 0 };
}

/** HTTP 缓存统计（全部站点合计） */
export function httpCacheStats(): { count: number; bytes: number } {
	const bySite = httpCacheStatsBySite();
	return Object.values(bySite).reduce((sum, s) => ({ count: sum.count + s.count, bytes: sum.bytes + s.bytes }), {
		count: 0,
		bytes: 0
	});
}

/** 清空指定站点的缓存（siteId 为空时清空全部） */
export function clearHttpCache(siteId?: string) {
	if (!siteId) {
		fs.rmSync(cacheDir(), { recursive: true, force: true });
		memory.clear();
		return;
	}
	for (const [url, entry] of memory) {
		if (entry.site === siteId) memory.delete(url);
	}
	try {
		for (const name of fs.readdirSync(cacheDir())) {
			const file = path.join(cacheDir(), name);
			try {
				const entry = JSON.parse(fs.readFileSync(file, 'utf-8')) as CacheEntry;
				if (entry.site === siteId) fs.rmSync(file, { force: true });
			} catch {}
		}
	} catch {}
}

/**
 * 带缓存的 GET：
 * - TTL 内新鲜缓存直接命中；
 * - 未命中/过期则请求，成功写缓存；
 * - 请求失败且存在（过期）缓存时回退缓存内容，弱网兜底。
 */
export async function cachedHttpGet(url: string, ttlMs: number, fetcher: () => Promise<string>): Promise<string> {
	const cached = readHttpCache(url);
	if (cached && Date.now() - cached.time < ttlMs) {
		return cached.body;
	}
	try {
		const body = await fetcher();
		writeHttpCache(url, body);
		return body;
	} catch (e) {
		if (cached) {
			console.warn(`[http-cache] 请求失败，回退过期缓存：${url}（${String(e).slice(0, 120)}）`);
			return cached.body;
		}
		throw e;
	}
}

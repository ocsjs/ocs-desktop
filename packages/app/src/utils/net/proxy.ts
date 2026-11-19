import { Logger } from '../../logger';

const logger = Logger('net:proxy');

/**
 * 手动代理提供器（由主进程 store 侧经 NetUtils.setManualProxyProvider 注入）。
 * 本模块刻意不静态依赖 store/electron：保持 vitest（Node 测试）与
 * worker 子进程（无 Electron 环境）下可安全 import。
 */
let manualProxyProvider: (() => string | undefined) | undefined;

/** 注入手动代理读取函数（remote.register.ts 主进程启动时调用） */
export function setManualProxyProvider(provider: () => string | undefined): void {
	manualProxyProvider = provider;
}

/** 解析出的代理信息 */
export interface NetProxyInfo {
	host: string;
	port: number;
	/** 来源：manual 手动配置 / system 系统代理 / env 环境变量 */
	source: 'manual' | 'system' | 'env';
}

/** 代理解析缓存 TTL（per-host，60s；下载器分块请求共享同 host 一次解析） */
const PROXY_CACHE_TTL = 60 * 1000;
const proxyCache = new Map<string, { proxy: NetProxyInfo | null; time: number }>();

/** 本地/回环地址永不走代理（本地 OCR 服务、导航页接口等） */
function isLocalHost(hostname: string): boolean {
	return /^(localhost|127\.|0\.0\.0\.0|::1|\[::1\])/.test(hostname);
}

/** 解析代理 URL（http://host:port 或 host:port），非法返回 null */
export function parseProxyUrl(input: string): { host: string; port: number } | null {
	try {
		const u = new URL(input.includes('://') ? input : 'http://' + input);
		const port = parseInt(u.port || '8080', 10);
		if (!u.hostname || !Number.isFinite(port)) return null;
		return { host: u.hostname, port };
	} catch {
		return null;
	}
}

/**
 * 解析目标 URL 应使用的代理（主进程统一入口）。
 *
 * 优先级：开发者设置手动代理 > 系统代理解析（session.resolveProxy：
 * 系统代理设置 + WPAD/PAC，等价于「浏览器能否上网」的判定）> 环境变量。
 * 结果按 host 缓存 60s（下载器分块请求共享同 host 一次解析）。
 */
export async function resolveProxy(url: string): Promise<NetProxyInfo | null> {
	let hostname = '';
	try {
		hostname = new URL(url).hostname;
	} catch {
		return null;
	}
	if (isLocalHost(hostname)) {
		return null;
	}

	// 手动代理配置优先，不缓存（随设置即时生效）
	const manual = String(manualProxyProvider?.() || '').trim();
	if (manual) {
		const parsed = parseProxyUrl(manual);
		if (parsed) {
			return { ...parsed, source: 'manual' };
		}
		logger.warn('手动代理配置格式非法，已忽略', { proxyUrl: manual });
	}

	const cached = proxyCache.get(hostname);
	if (cached && Date.now() - cached.time < PROXY_CACHE_TTL) {
		return cached.proxy;
	}

	const proxy = await resolveSystemProxy(url);
	proxyCache.set(hostname, { proxy, time: Date.now() });
	return proxy;
}

/** 经 Chromium 代理解析（系统代理 + WPAD/PAC），环境变量兜底 */
async function resolveSystemProxy(url: string): Promise<NetProxyInfo | null> {
	try {
		// 懒加载 electron（vitest/worker 无 Electron 环境时 require 抛错或 mock 缺 session，静默跳过）
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { session } = require('electron');
		const result: string | undefined = await session?.defaultSession?.resolveProxy?.(url);
		if (!result) {
			throw new Error('session 不可用');
		}
		// 返回值形如 "PROXY host:port"、"PROXY h1:p1; PROXY h2:p2"、"SOCKS5 host:port"、"DIRECT"
		const first = result.split(';')[0]?.trim() || '';
		const match = /^(PROXY|HTTPS?|SOCKS5?)\s+(\S+?):(\d+)$/i.exec(first);
		if (match) {
			if (/^SOCKS/i.test(match[1])) {
				// axios 不支持 SOCKS 代理：记录并直连（用户可在开发者设置中配置 HTTP 代理）
				logger.warn('检测到 SOCKS 代理（axios 不支持），使用直连', { proxy: first });
				return null;
			}
			return { host: match[2], port: parseInt(match[3], 10), source: 'system' };
		}
	} catch (e) {
		logger.warn('系统代理解析失败', { error: String(e) });
	}

	const envProxy =
		process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
	if (envProxy) {
		const parsed = parseProxyUrl(envProxy);
		if (parsed) {
			return { ...parsed, source: 'env' };
		}
	}
	return null;
}

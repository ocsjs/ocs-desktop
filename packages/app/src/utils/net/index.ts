/**
 * NetUtils —— 主进程统一网络工具门面。
 *
 * 主进程所有出网能力（请求/下载/代理解析/弱网探测）的唯一入口，
 * 内部按职责拆分：proxy（代理解析）、request（统一请求）、download（分块下载）、status（弱网探测）。
 *
 * 统一约定：
 * - 请求/下载自动注入系统代理（系统设置 + WPAD/PAC + env + 手动配置），
 *   代理链路失败自动降级直连重试（覆盖代理软件残留配置未运行的场景）；
 * - localhost/回环地址永不走代理；
 * - 本模块不静态依赖 store/electron（session 懒加载、手动代理经
 *   setManualProxyProvider 注入），vitest 与 worker 子进程可安全 import。
 *
 * worker 子进程注意：worker 无 Electron session，其外部请求请使用
 * scripts/utils 的 getBase64（OCS_PROXY_URL 由主进程 fork 时注入）。
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { parseProxyUrl, resolveProxy, setManualProxyProvider } from './proxy';
import { get, getText } from './request';
import { download } from './download';
import { probeNetwork } from './status';

export type { NetProxyInfo } from './proxy';
export type { DownloadOptions } from './download';
export { DownloadAbortedError, isDownloadAborted } from './download';

export class NetUtils {
	// ── 代理解析 ──

	/** 注入手动代理读取函数（主进程 store 侧启动时调用一次） */
	static setManualProxyProvider = setManualProxyProvider;

	/** 解析目标 URL 应使用的代理：手动配置 > 系统代理（WPAD/PAC）> env；per-host 缓存 60s */
	static resolveProxy = resolveProxy;

	/** 解析代理 URL（http://host:port 或 host:port），非法返回 null */
	static parseProxyUrl = parseProxyUrl;

	// ── 请求 ──

	/** 统一 GET：自动代理注入 + 代理失效降级直连重试 */
	static get: (url: string, config?: AxiosRequestConfig) => Promise<AxiosResponse> = get;

	/** 统一 GET（文本响应）：返回 string */
	static getText: (url: string, config?: AxiosRequestConfig) => Promise<string> = getText;

	// ── 下载 ──

	/** 统一下载器：分块并发 + 断点续传（小文件自动回退单流） */
	static download = download;

	// ── 状态 ──

	/** 弱网探测（CDN 探针，3s 超时，结果缓存 30s） */
	static probeNetwork = probeNetwork;
}

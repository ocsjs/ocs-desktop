import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from '../../logger';
import { resolveProxy } from './proxy';

const logger = Logger('net:request');

/**
 * 判定为「代理链路失败」的错误（可降级直连重试）：
 * 代理已死/不可达/超时，或企业代理 MITM 证书不被 Node 信任。
 */
function isProxyChainError(e: any): boolean {
	const code = String(e?.code || '');
	return (
		['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'ECONNABORTED'].includes(code) ||
		code.startsWith('UNABLE_TO_') ||
		code.includes('CERT') ||
		code.includes('SSL')
	);
}

/**
 * 统一 HTTP GET：主进程所有出网请求的唯一入口。
 *
 * 自动注入系统代理（NetUtils.resolveProxy）；代理链路失败（代理已死/证书拦截等）
 * 自动降级直连重试一次，覆盖「代理软件残留配置但代理未运行」的场景。
 */
export async function get(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
	const proxy = await resolveProxy(url);
	const requestConfig: AxiosRequestConfig = proxy
		? { ...config, proxy: { host: proxy.host, port: proxy.port, protocol: 'http' } }
		: config;
	try {
		return await axios.get(url, requestConfig);
	} catch (e: any) {
		if (proxy && isProxyChainError(e)) {
			logger.warn('代理链路失败，降级直连重试', {
				url,
				proxy: `${proxy.host}:${proxy.port}`,
				source: proxy.source,
				error: e?.code || e?.name || String(e)
			});
			return await axios.get(url, { ...config, proxy: false });
		}
		throw e;
	}
}

/** 统一 GET（文本响应）：返回 string，省去调用方 .data 取值与类型判定 */
export async function getText(url: string, config: AxiosRequestConfig = {}): Promise<string> {
	const res = await get(url, { ...config, responseType: 'text' });
	return typeof res.data === 'string' ? res.data : String(res.data);
}

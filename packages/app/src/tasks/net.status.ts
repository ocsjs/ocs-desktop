import axios from 'axios';
import { OCS_API } from '@ocs-desktop/common';
import { Logger } from '../logger';

const logger = Logger('net-status');

/** 单次探测超时：3s 内拿不到 CDN 响应即判定弱网 */
const PROBE_TIMEOUT = 3 * 1000;
/** 探测结果缓存 30s，避免各模块在同一时间窗内重复探测 */
const PROBE_CACHE_TTL = 30 * 1000;

let lastProbeAt = 0;
/** 乐观默认为在线，首次探测前不影响任何功能 */
let lastProbeResult = true;
let inflight: Promise<boolean> | undefined;

/**
 * 探测外网连通性（以软件 CDN 为探针：更新检测/资源配置/书签数据均依赖它）。
 * 结果缓存 30s；并发调用合并为同一次请求。
 *
 * 判定规则：拿到任意 HTTP 响应（含 4xx）即视为在线；超时/TCP/TLS/DNS 失败视为弱网。
 */
export function probeNetwork(force = false): Promise<boolean> {
	const now = Date.now();
	if (!force && now - lastProbeAt < PROBE_CACHE_TTL) {
		return Promise.resolve(lastProbeResult);
	}
	if (inflight) {
		return inflight;
	}
	inflight = axios
		.get(OCS_API.infos, { timeout: PROBE_TIMEOUT, validateStatus: () => true })
		.then((res) => res.status > 0)
		.catch(() => false)
		.then((ok) => {
			lastProbeAt = Date.now();
			lastProbeResult = ok;
			inflight = undefined;
			if (!ok) {
				logger.warn('网络探测失败（3s 无响应），进入弱网模式：跳过更新检测、图标直接返回兜底');
			}
			return ok;
		});
	return inflight;
}

/**
 * 渲染层全局错误过滤（合并自原 main.ts 与 utils/index.ts 两处重复的 errorFilter）：
 * - ResizeObserver loop：arco design 已知问题（tooltip/dropdown/modal 反复触发），无需处理；
 * - CrashpadMetrics：playwright 问题，暂时无需处理。
 */
export function shouldIgnoreRenderError(str: string): boolean {
	if (str.includes('ResizeObserver loop')) {
		return true;
	}
	if (str.includes('CrashpadMetrics')) {
		return true;
	}
	return false;
}

/**
 * 瞬时网络错误判定：超时/连接失败/域名解析失败等（静默，仅在 UI 显示错误态）。
 * 覆盖 axios（ECONNABORTED）与 Chromium 网络栈（ERR_*）及 Node TCP 错误。
 *
 * ⚠️ 本模块必须保持零依赖：remote.ts（被 utils/index.ts 反向引用）也使用本函数，
 * 若放入 utils/index.ts 会形成 index ↔ remote 循环依赖导致 TDZ 白屏崩溃。
 */
export function isTransientNetworkError(err: unknown): boolean {
	const text = err instanceof Error ? `${err.name} ${err.message} ${(err as any).code || ''}` : String(err);
	const features = [
		'timeout',
		'ETIMEDOUT',
		'ECONNABORTED',
		'ECONNRESET',
		'ECONNREFUSED',
		'ENOTFOUND',
		'ENETUNREACH',
		'EHOSTUNREACH',
		'ERR_',
		'Network Error',
		'fetch failed'
	];
	return new RegExp(features.join('|'), 'i').test(text);
}

/**
 * remote 层错误通知过滤：以下错误属噪音或调用方已处理的预期情况，全局兜底通知时忽略。
 * - CrashpadMetrics：playwright 问题，暂时无需处理；
 * - 外部站点瞬时网络错误：UI 层已有降级展示；本地回环连接失败保留（本地服务故障属重要错误）；
 * - HTTP 404：资源不存在属应用层预期情况（教程/搜索等调用方各自处理）；5xx 等保留通知。
 */
export function shouldIgnoreRemoteError(message: string): boolean {
	if (String(message).includes('CrashpadMetrics')) {
		return true;
	}
	if (isTransientNetworkError(message) && !/127\.0\.0\.1|localhost|\[::1\]/.test(message)) {
		return true;
	}
	return false;
}

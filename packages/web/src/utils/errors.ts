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

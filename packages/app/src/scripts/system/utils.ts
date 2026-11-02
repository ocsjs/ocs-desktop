/** 系统自动化程序共享小工具 */

import type { Page } from 'playwright-core';

export function sleep(t: number) {
	return new Promise((resolve) => setTimeout(resolve, t));
}

/**
 * 页面停留：自动化页面从打开到关闭至少停留 minMs（默认 1s），防界面一闪而过。
 * 用法：newPage 时记录 t0 = Date.now()，close 前调用。
 */
export async function stay(t0: number, minMs = 1000) {
	const elapsed = Date.now() - t0;
	if (elapsed < minMs) await sleep(minMs - elapsed);
}

/**
 * 页面内事件驱动等待：谓词轮询（默认 200ms）直到返回 truthy 或超时（静默返回 false）。
 * 用于替代「固定 sleep + 单次 evaluate」的暴力等待（React 异步渲染/菜单动画/弹窗出现场景），
 * 元素就绪立即继续，未出现按超时兜底，比固定等待更快且更稳。
 */
export async function waitPageAction(
	page: Page,
	predicate: (arg?: any) => unknown,
	arg?: any,
	opts?: { timeout?: number; polling?: number }
): Promise<boolean> {
	return page
		.waitForFunction(predicate, arg, { timeout: opts?.timeout ?? 5 * 1000, polling: opts?.polling ?? 200 })
		.then(() => true)
		.catch(() => false);
}

/**
 * 窗口关闭流程看门狗（主进程侧状态）。
 *
 * 用户点击关闭按钮后主进程向渲染层发送 'close' 事件并启动看门狗：
 * - 渲染层开始处理（弹询问框/执行退出流程）时经 methods.cancelCloseWatchdog 取消看门狗；
 * - 渲染层真正无响应（白屏/主线程阻塞）时取消不会发生，看门狗超时强制销毁窗口，防止僵尸窗口。
 */

let closeWatchdog: ReturnType<typeof setTimeout> | undefined;

/** 启动/重置无响应看门狗（重复触发 close 时只保留最后一次） */
export function startCloseWatchdog(onTimeout: () => void, timeoutMs = 3000): void {
	if (closeWatchdog) {
		clearTimeout(closeWatchdog);
	}
	closeWatchdog = setTimeout(() => {
		closeWatchdog = undefined;
		onTimeout();
	}, timeoutMs);
}

/** 渲染层接管关闭流程后取消无响应看门狗（经 methods.cancelCloseWatchdog 暴露给渲染层） */
export function cancelCloseWatchdog(): void {
	if (closeWatchdog) {
		clearTimeout(closeWatchdog);
		closeWatchdog = undefined;
	}
}

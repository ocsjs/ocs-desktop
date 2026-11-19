// @ts-check
/**
 * 父子进程消息通道兼容层。
 * worker 可能运行在两种宿主：
 * - 主进程 utilityProcess.fork：通信走 process.parentPort（MessagePort 机制）；
 * - 兼容旧路径 child_process.fork：通信走 process.send / process.on('message')。
 * utilityProcess 环境下 process.send/process.on('message') 均不可用，必须经 parentPort。
 */

// eslint-disable-next-line no-undef
const parentPort: any = (process as any).parentPort;

/** 向父进程发送消息 */
export function sendToParent(message: any): void {
	if (parentPort) {
		parentPort.postMessage(message);
	} else {
		// eslint-disable-next-line no-undef
		process.send?.(message);
	}
}

/** 监听父进程消息（parentPort 的 MessageEvent 取 data 字段） */
export function onParentMessage(handler: (message: any) => void): void {
	if (parentPort) {
		parentPort.on('message', (e: any) => handler(e.data));
	} else {
		// eslint-disable-next-line no-undef
		process.on('message', handler);
	}
}

/** 父进程断开/通道关闭（等价 child_process 的 disconnect 事件） */
export function onParentDisconnect(handler: () => void): void {
	if (parentPort) {
		parentPort.on('close', handler);
	} else {
		// eslint-disable-next-line no-undef
		process.on('disconnect', handler);
	}
}

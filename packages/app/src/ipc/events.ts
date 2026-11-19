import type { WebContents } from 'electron';
import type { IpcEventMap } from '@ocs-desktop/common';

/**
 * 类型化事件推送（主进程 → 渲染进程）。
 * 频道与负载由 @ocs-desktop/common types.ts 的 IpcEventMap 约束，
 * 替代散落的 webContents.send 字符串字面量，重构时获得编译期保障。
 */
export function sendToRenderer<K extends keyof IpcEventMap>(
	webContents: WebContents | undefined | null,
	channel: K,
	...args: IpcEventMap[K]
) {
	try {
		if (webContents && !webContents.isDestroyed()) {
			webContents.send(channel as string, ...args);
		}
	} catch {}
}

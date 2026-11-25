/**
 * 初始化 loading 闪屏窗口的专用 preload。
 *
 * 与主窗口 preload（src/preload/index.ts 的 window.ocs）完全隔离：
 * 仅暴露 3 个窄接口（状态订阅/读取/关闭），sandbox + contextIsolation 下
 * loading 页无任何网络与 Node 能力（CSP 亦不含 connect-src）。
 *
 * 通道前缀 ocs-init:*，与主进程既有通道（ocs-quit-app、{name}-call 等）无交集。
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { InitStatusState } from '../tasks/init.status';

contextBridge.exposeInMainWorld('ocsInit', {
	/** 订阅初始化状态推送（主进程状态变化时主动推送，无需轮询） */
	onStatus: (callback: (state: InitStatusState) => void) => {
		const listener = (_e: unknown, state: InitStatusState) => callback(state);
		ipcRenderer.on('ocs-init:status', listener);
		return () => ipcRenderer.removeListener('ocs-init:status', listener);
	},
	/** 主动读取当前状态（页面加载时拉取一次，覆盖订阅前已产生的进度） */
	getStatus: (): Promise<InitStatusState> => ipcRenderer.invoke('ocs-init:get-status'),
	/** 关闭初始化窗口 */
	close: () => ipcRenderer.send('ocs-init:close'),
	/** 切换为高速下载源（OCS CDN）：中断当前下载并用 CDN 源重新下载 */
	switchSource: () => ipcRenderer.send('ocs-init:switch-source'),
	/** 立即停止初始化流程并退出软件（不重启），经页面内确认后调用 */
	forceQuit: () => ipcRenderer.send('ocs-init:force-quit')
});

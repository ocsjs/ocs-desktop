/**
 * preload 脚本：渲染进程访问底层能力的唯一通道（contextIsolation 边界）。
 *
 * 通过 contextBridge 暴露 window.ocs（bridge 统一门面，生成器见 src/ipc/preload.facade.ts，
 * 形态类型见 OcsBridge 生成产物）：
 * - methods/fs/path/os/win/webContents/app/dialog/electronStore/logger：facade 方法域
 *   （自省 ipc:introspect 清单生成，主进程侧白名单 + sender 校验兜底）；
 * - on：类型化事件订阅（IpcEventMap）；
 * - platform / shell / clipboard / quitApp：窄接口。
 *
 * 注意：sandbox 模式下 preload 仅可使用 electron 等少数模块，本文件不得引入其他运行时依赖
 * （类型导入在编译期擦除，不受影响）。
 */
import { contextBridge, ipcRenderer } from 'electron';
import { createBridge } from '../ipc/preload.facade';

const bridge = createBridge();

const api = {
	// bridge 统一门面（methods/fs/path/os/win/webContents/app/dialog/electronStore/logger）
	...bridge,
	platform: process.platform,
	// sandbox 模式下 preload 无法访问 electron.shell/clipboard（仅暴露 ipcRenderer/contextBridge 等），
	// 转发到主进程 methods 实现（shellOpenPath/shellShowItemInFolder/shellOpenExternal/clipboardWriteText）
	shell: {
		openPath: (p: string) => bridge.methods.shellOpenPath(p),
		showItemInFolder: (p: string) => bridge.methods.shellShowItemInFolder(p),
		openExternal: (url: string) => bridge.methods.shellOpenExternal(url)
	},
	clipboard: {
		writeText: (text: string) => bridge.methods.clipboardWriteText(text)
	},
	quitApp: () => ipcRenderer.send('ocs-quit-app'),
	on: (channel: string, callback: (...args: any[]) => void) => {
		const listener = (_e: any, ...args: any[]) => (callback as (...a: any[]) => void)(...args);
		ipcRenderer.on(channel, listener);
		return () => ipcRenderer.removeListener(channel, listener);
	}
};

contextBridge.exposeInMainWorld('ocs', api);

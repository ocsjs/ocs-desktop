/**
 * preload 脚本：渲染进程访问底层能力的唯一通道（contextIsolation 边界）。
 *
 * 通过 contextBridge 暴露 window.ocs：
 * - bridge 门面（createBridge 自省生成，methods/fs/path/os/win/... 统一异步方法域）；
 * - remote：旧泛化 remote 对象代理（迁移期并存，web 调用点迁移完成后拆除）；
 * - on：类型化事件订阅（IpcEventMap）；
 * - platform / shell / clipboard / quitApp：窄接口。
 *
 * 注意：sandbox 模式下 preload 仅可使用 electron 等少数模块，本文件不得引入其他运行时依赖
 * （类型导入在编译期擦除，不受影响）。
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { BrowserWindow, App, Dialog, WebContents } from 'electron';
import type fs from 'fs';
import type os from 'os';
import type path from 'path';
import type Store from 'electron-store';
import type { RemoteMethods, LoggerCore } from '@ocs-desktop/common';
import { createBridge, toError } from '../ipc/preload.facade';

/** 远程对象调用器形态（迁移期并存用，P3 拆除 remote 面后删除） */
type RemoteInvoker<T> = {
	get<K extends keyof T>(property: K): any;
	set<K extends keyof T>(property: K, value: any): any;
	call<K extends keyof T>(property: K, ...args: any[]): Promise<any>;
	callSync<K extends keyof T>(property: K, ...args: any[]): any;
};

/** 注册渲染进程和主进程的远程通信（迁移期并存；类型由泛型 T 约束，运行时由主进程白名单兜底） */
function registerRemote<T>(eventName: string): RemoteInvoker<T> {
	function sendSync(channel: string, ...args: any[]): any {
		return ipcRenderer.sendSync(channel, ...args);
	}

	async function send(channel: string, args: any[]): Promise<any> {
		const payload = await ipcRenderer.invoke(channel, args);
		if (payload?.error) {
			throw toError(payload.error);
		}
		return payload?.data;
	}

	return {
		get<K extends keyof T>(property: K): any {
			const res = sendSync(eventName + '-get', [property]);
			if (res?.error) throw toError(res.error);
			return res;
		},
		set<K extends keyof T>(property: K, value: any): any {
			const res = sendSync(eventName + '-set', [property, value]);
			if (res?.error) throw toError(res.error);
			return res;
		},
		call<K extends keyof T>(property: K, ...args: any[]): Promise<any> {
			return send(eventName + '-call', [property, ...args]);
		},
		callSync<K extends keyof T>(property: K, ...args: any[]): any {
			const response = sendSync(eventName + '-call-sync', [property, ...args]);
			if (response?.error) {
				throw toError(response.error);
			}
			return response?.data;
		}
	};
}

/** remote 命名空间表（迁移期并存，与主进程 remoteRegister 注册一一对应） */
const remote = {
	'electron-store': registerRemote<Store>('electron-store'),
	fs: registerRemote<typeof fs>('fs'),
	path: registerRemote<typeof path>('path'),
	os: registerRemote<typeof os>('os'),
	win: registerRemote<BrowserWindow>('win'),
	webContents: registerRemote<WebContents>('webContents'),
	app: registerRemote<App>('app'),
	dialog: registerRemote<Dialog>('dialog'),
	methods: registerRemote<RemoteMethods>('methods'),
	logger: registerRemote<LoggerCore>('logger')
};

const bridge = createBridge();

const api = {
	// bridge 统一门面（methods/fs/path/os/win/webContents/app/dialog/electronStore/logger）
	...bridge,
	// 旧 remote 面（迁移期并存；web 调用点迁移完成后随主进程通道收敛一并拆除）
	remote,
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

import { BrowserWindow, App, Dialog, WebContents } from 'electron';
import type { RemoteMethods, LoggerCore } from '@ocs-desktop/common/web';
import type fs from 'fs';
import type os from 'os';
import type path from 'path';
import type Store from 'electron-store';
import { electron } from './node';
const { ipcRenderer } = electron;

/** 远程异步调用默认超时时间（ms），主进程未回复时拒绝并清理监听，避免 Promise 永久 pending */
const REMOTE_CALL_TIMEOUT = 30000;

/**
 * 将主进程序列化后的错误载荷还原为 Error 实例。
 * 主进程通过 serializeError 把 Error 拍平为 { __error, name, message, stack } 跨 IPC 传输，
 * 此处还原为带 stack 的 Error，便于上层 catch 与日志展示。
 */
function toError(payload: any): Error {
	if (payload && typeof payload === 'object' && payload.__error) {
		const err = new Error(payload.message || 'Unknown remote error');
		err.name = payload.name || 'Error';
		if (payload.stack) err.stack = payload.stack;
		// 标记为 remote 错误：全局错误兜底（main.ts）据此识别并兜底通知；
		// 调用方已捕获时不再出现「remote 模块错误 + 业务错误提示」的双重报错
		Object.assign(err, { __ocsRemote: true });
		return err;
	}
	if (payload instanceof Error) {
		Object.assign(payload, { __ocsRemote: true });
		return payload;
	}
	return new Error(String(payload));
}

/**
 * 注册渲染进程和主进程的远程通信
 * @param eventName
 * @returns
 */
function registerRemote<T>(eventName: string) {
	function sendSync(channel: string, ...args: any[]): any {
		const res = ipcRenderer.sendSync(channel, ...args);
		if (res?.error) {
			// 不在此处全局通知：错误已标记（__ocsRemote），callSync 会抛出，
			// 未捕获时由全局 error 兜底处理器通知（见 main.ts），避免与业务错误提示重复
			console.log(res);
		}
		return res;
	}

	function send(channel: string, args: any[]): Promise<any> {
		return new Promise((resolve, reject) => {
			const respondChannel = args[0];
			let settled = false;
			const cleanup = () => {
				clearTimeout(timer);
				ipcRenderer.removeListener(respondChannel, onRespond);
			};
			const onRespond = (_e: any, payload: any) => {
				if (settled) return;
				settled = true;
				cleanup();
				if (payload?.error) {
					const err = toError(payload.error);
					// 不在此处全局通知：toError 已标记（__ocsRemote），未捕获时由全局
					// unhandledrejection 兜底处理器通知（见 main.ts），避免与业务错误提示重复
					console.log({ payload, channel, args });
					reject(err);
				} else {
					resolve(payload?.data);
				}
			};
			// 超时兜底：主进程未回复（如 webContents 已销毁、reply 抛错）时拒绝并清理监听，避免 Promise 永久 pending
			const timer = setTimeout(() => {
				if (settled) return;
				settled = true;
				cleanup();
				reject(Object.assign(new Error(`remote 调用超时：${channel}`), { __ocsRemote: true }));
			}, REMOTE_CALL_TIMEOUT);
			ipcRenderer.on(respondChannel, onRespond);
			// 直接使用 Electron 原生 structured clone 传输，支持 Buffer/Date/Map/Set/undefined/循环引用
			// （此前用 JSON.parse(JSON.stringify(args)) 会丢失这些类型，与同步路径行为不一致）
			ipcRenderer.send(channel, args);
		});
	}

	return {
		/** 获取远程变量 */
		get<K extends keyof T>(property: K): T[K] extends { (...args: any[]): any } ? ReturnType<T[K]> : any {
			return sendSync(eventName + '-get', [property]);
		},
		/** 设置远程变量 */
		set<K extends keyof T>(property: K, value: any): T[K] extends { (...args: any[]): any } ? ReturnType<T[K]> : any {
			return sendSync(eventName + '-set', [property, value]);
		},

		/** 异步调用远程方法 */
		call<K extends keyof T>(
			property: K,
			...args: T[K] extends { (...args: any[]): any } ? Parameters<T[K]> : any[]
		): Promise<Awaited<T[K] extends { (...args: any[]): any } ? ReturnType<T[K]> : any>> {
			// 回调名
			const respondChannel = getRespondChannelId(property.toString());
			return send(eventName + '-call', [respondChannel, property, ...args]);
		},

		/** 同步调用远程方法 */
		callSync<K extends keyof T>(
			property: K,
			...args: T[K] extends { (...args: any[]): any } ? Parameters<T[K]> : any[]
		): T[K] extends { (...args: any[]): any } ? ReturnType<T[K]> : any {
			const response = sendSync(eventName + '-call-sync', [property, ...args]);
			if (response?.error) {
				// 直接抛出还原后的 Error（已标记 __ocsRemote，未捕获时由全局兜底通知）
				throw toError(response.error);
			}
			return response?.data;
		}
	};
}

function getRespondChannelId(property: string) {
	return `${property}-${(Math.random() * 1000).toFixed(0)}-${Date.now()}`;
}

export const remote = {
	// nodejs
	'electron-store': registerRemote<Store>('electron-store'),
	fs: registerRemote<typeof fs>('fs'),
	path: registerRemote<typeof path>('path'),
	os: registerRemote<typeof os>('os'),

	// 注册 window 通信
	win: registerRemote<BrowserWindow>('win'),
	// 注册 window 通信
	webContents: registerRemote<WebContents>('webContents'),
	// 注册 app 通信
	app: registerRemote<App>('app'),
	// 注册 dialog 通信
	dialog: registerRemote<Dialog>('dialog'),
	// 暴露方法
	methods: registerRemote<RemoteMethods>('methods'),
	// 日志
	// eslint-disable-next-line no-undef
	logger: registerRemote<LoggerCore>('logger')
};

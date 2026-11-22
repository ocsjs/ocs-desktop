import { ipcMain, app, dialog, BrowserWindow, nativeTheme } from 'electron';
import type * as Electron from 'electron';
import { Logger } from '../logger';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { StoreData } from '../store';
import { initHttpCache } from '../utils/http-cache';
import { sendToRenderer } from './events';
import { methods } from './methods';
import { bundledExtensionsApi } from '../extensions/api';
import { remoteWhitelists } from '@ocs-desktop/common';

/**
 * 将错误序列化为可跨 IPC 传输的普通对象。
 * Electron 的 structured clone 对 Error 支持不完整（message/stack 会丢失），
 * 因此在跨进程传递前统一拍平为普通对象，渲染进程侧通过 __error 标记还原。
 */
function serializeError(e: any) {
	if (e instanceof Error) {
		return { __error: true, name: e.name, message: e.message, stack: e.stack };
	}
	return { __error: true, message: String(e) };
}

/**
 * 危险属性名黑名单：防止通过字符串属性名访问/篡改原型链
 * （-set 通道 `target[property] = value` 存在原型污染面，-get/-call 可读取 constructor 等）
 */
const FORBIDDEN_PROPERTY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** 校验一次远程访问的合法性：调用来源必须为主窗口 webContents，且属性名通过黑名单 + 白名单检查 */
function assertRemoteAccess(name: string, sender: Electron.WebContents, property: string) {
	if (win && sender !== win.webContents) {
		throw new Error(`拒绝来自非主窗口的 remote 调用：${name}.${property}`);
	}
	if (FORBIDDEN_PROPERTY_KEYS.has(property)) {
		throw new Error(`禁止访问危险属性：${name}.${property}`);
	}
	// methods 命名空间白名单：直接以契约实现对象的方法名判定（hasOwnProperty），
	// 随 methods 自动同步，无需手工维护清单；in 操作符会放通 Object.prototype 成员（toString 等）
	if (name === 'methods') {
		if (!Object.prototype.hasOwnProperty.call(methods, property)) {
			throw new Error(`方法不存在：methods.${property}`);
		}
		return;
	}
	const whitelist = (remoteWhitelists as Record<string, readonly string[]>)[name];
	if (whitelist && !whitelist.includes(property)) {
		throw new Error(`方法不在白名单：${name}.${property}`);
	}
}

/**
 * 注册主进程远程通信事件（统一 invoke 异步通道）。
 *
 * 历史通道 -get/-set/-call-sync（sendSync 同步调用）已随 bridge 统一门面全异步化移除：
 * facade 全部经 -call 调用，唯一保留的同步 IPC 是 preload 构建期的 ipc:introspect 自省。
 *
 * @param name 事件前缀名称
 * @param target 事件目标
 */
/**
 * 注册主进程远程通信事件（统一 invoke 异步通道）。
 *
 * 历史通道 -get/-set/-call-sync（sendSync 同步调用）已随 bridge 统一门面全异步化移除：
 * facade 全部经 -call 调用，唯一保留的同步 IPC 是 preload 构建期的 ipc:introspect 自省。
 */
function registerRemoteEvent(name: string, target: any) {
	const logger = Logger('remote');
	try {
		/**
		 * 异步调用（invoke/handle）
		 * 由框架管理请求-回复关联，替代旧的「一次性回调频道 + send」方案：
		 * 消除回调频道碰撞（同毫秒同名方法并发导致响应串扰）与手写超时兜底
		 */
		ipcMain.handle(name + '-call', async (event, [property, ...args]) => {
			// logger.info({ event: name + '-call', args });
			try {
				assertRemoteAccess(name, event.sender, property);
				return { data: await target[property](...args) };
			} catch (e) {
				return { error: serializeError(e) };
			}
		});
	} catch (err) {
		logger.error(err);
	}
}

let win: BrowserWindow | undefined;

/**
 * 初始化远程通信
 */
export function remoteRegister(_win: BrowserWindow) {
	win = _win;
	// HTTP 磁盘缓存根目录（主进程）：userData/cache/http
	initHttpCache(StoreData.get().paths['user-data-path']);
	// electron-store 命名空间注册已移除：渲染端整树读取经 methods.getStore（facade 特判分支），
	// 写路径统一 methods.saveStore；remoteWhitelists.electronStore 仍保留以驱动 facade 创建该域
	registerRemoteEvent('fs', fs);
	registerRemoteEvent('os', os);
	registerRemoteEvent('path', path);

	registerRemoteEvent('win', _win);
	registerRemoteEvent('webContents', _win.webContents);
	registerRemoteEvent('app', app);
	registerRemoteEvent('dialog', dialog);
	registerRemoteEvent('methods', methods);
	registerRemoteEvent('logger', Logger('render'));
	// 内置拓展域（bridge.bundledExtensions.*）：列举/安装/卸载/检测/完整性校验
	registerRemoteEvent('bundledExtensions', bundledExtensionsApi);

	/**
	 * 自省通道：preload facade 生成器启动时取「命名空间 → 方法名清单」。
	 * 输出与 guard 共用 remote.whitelists（唯一真相源），methods 取实现对象自有键。
	 */
	ipcMain.on('ipc:introspect', (event) => {
		event.returnValue = {
			namespaces: remoteWhitelists,
			methods: Object.keys(methods)
		};
	});

	// 系统深浅色变化时通知渲染层（用于「自动」模式跟随系统，matchMedia 在 Electron 不稳定）
	nativeTheme.on('updated', () => {
		sendToRenderer(win?.webContents, 'system-theme-change', nativeTheme.shouldUseDarkColors);
	});
}

const _registerRemoteEvent = registerRemoteEvent;
export { _registerRemoteEvent as registerRemoteEvent };

/**
 * 应用启动初始化状态共享模块。
 *
 * 用于在主进程 initChrome 阶段记录初始化进度，经 IPC 推送到 loading 闪屏页
 * （preload 暴露 window.ocsInit，通道前缀 ocs-init:*；历史上为本地服务器轮询，已废弃）。
 *
 * 每次调用 setInitStatus 会在 logs 中追加一条日志条目（前一条 active 自动转为 done），
 * 这样弹窗可以展示完整流程日志（准备、解压、查找、移动、清理、配置、重启等）。
 */

import { app, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';

export type InitStatus = 'idle' | 'loading' | 'done' | 'error' | 'restart';
export type InitLogState = 'done' | 'active' | 'error';

export interface InitLogEntry {
	text: string;
	state: InitLogState;
	/** 序号，便于前端去重/排序 */
	index: number;
}

/** loading 页订阅的状态载荷（经 ocs-init:status 推送 / ocs-init:get-status 返回） */
export interface InitStatusState {
	status: InitStatus;
	message: string;
	logs: InitLogEntry[];
	/** 是否显示「切换为高速下载」按钮（非 CDN 源下载超时未完成后置 true） */
	canSwitchToCdn?: boolean;
}

const initStatus: InitStatusState = {
	status: 'idle',
	message: '',
	logs: []
};

let logIndex = 0;

/**
 * 更新初始化状态，并把 message 作为一条日志追加到 logs。
 * 已存在的 active 日志自动转为 done（表示该步骤已完成）。
 */
export function setInitStatus(partial: { status: InitStatus; message: string }): void {
	// 前一条 active 转为 done（表示该步骤已完成）
	const last = initStatus.logs[initStatus.logs.length - 1];
	if (last && last.state === 'active') {
		last.state = 'done';
	}
	if (partial.message) {
		initStatus.logs.push({
			text: partial.message,
			state: partial.status === 'error' ? 'error' : 'active',
			index: ++logIndex
		});
	}
	initStatus.status = partial.status;
	initStatus.message = partial.message;
	pushInitStatus();
}

/**
 * 原地更新当前 active 日志条目的文本（不追加新条目）。
 * 用于下载进度等高频刷新场景，避免日志列表被进度文案刷屏。
 * 当前没有 active 条目时静默忽略。
 */
export function updateInitLogText(text: string): void {
	const last = initStatus.logs[initStatus.logs.length - 1];
	if (last && last.state === 'active') {
		last.text = text;
		initStatus.message = text;
		pushInitStatus();
	}
}

/** 读取初始化状态（返回副本，避免外部直接修改） */
export function getInitStatus(): InitStatusState {
	return {
		status: initStatus.status,
		message: initStatus.message,
		logs: initStatus.logs.map((l) => ({ ...l })),
		canSwitchToCdn: initStatus.canSwitchToCdn
	};
}

/** 重置为初始状态 */
export function resetInitStatus(): void {
	initStatus.status = 'idle';
	initStatus.message = '';
	initStatus.logs = [];
	initStatus.canSwitchToCdn = undefined;
	logIndex = 0;
}

/** 设置「切换为高速下载」按钮可见性并推送（值不变时不重复推送） */
export function setInitCanSwitchToCdn(v: boolean): void {
	if (initStatus.canSwitchToCdn === v) return;
	initStatus.canSwitchToCdn = v;
	pushInitStatus();
}

/** 「切换为高速下载」处理器（initChrome 下载期间注册，下载结束注销） */
let switchSourceHandler: (() => void) | undefined;
export function setInitSwitchSourceHandler(fn: (() => void) | undefined): void {
	switchSourceHandler = fn;
}

/** 初始化 loading 窗口引用（供 ocs-init:close 通道关闭、状态推送定位） */
let initLoadingWindow: BrowserWindow | undefined;

/** ocs-init:* 通道是否已注册（懒注册：首次创建 loading 窗口时挂载，避免重复） */
let initIpcRegistered = false;

/**
 * 注册初始化 loading 窗口（initChrome 创建窗口后调用，重建时需重新注册）。
 * 同时懒注册 ocs-init:* 通道（get-status 读取 / close 关闭）。
 */
export function setInitLoadingWindow(win: BrowserWindow | undefined): void {
	initLoadingWindow = win;
	if (win && !initIpcRegistered) {
		initIpcRegistered = true;
		ipcMain.handle('ocs-init:get-status', () => getInitStatus());
		ipcMain.on('ocs-init:close', () => closeInitLoadingWindow());
		// 「切换为高速下载」：loading 页按钮触发，由下载方注册的处理器中断并换源重下
		ipcMain.on('ocs-init:switch-source', () => switchSourceHandler?.());
		ipcMain.on('ocs-init:force-quit', () => {
			// 用户在初始化期间确认放弃：立即停止初始化流程并退出软件（不重启，
			// 与初始化成功路径的 relaunch 相反；进程退出即在途下载/解压一并中止）
			closeInitLoadingWindow();
			app.exit(0);
		});
	}
}

/** 状态变化时推送到 loading 窗口（IPC 推送，替代原 HTTP 轮询） */
function pushInitStatus(): void {
	if (initLoadingWindow && !initLoadingWindow.isDestroyed()) {
		initLoadingWindow.webContents.send('ocs-init:status', getInitStatus());
	}
}

/** 关闭初始化 loading 窗口（loading 页内关闭按钮经 ocs-init:close 通道调用） */
export function closeInitLoadingWindow(): void {
	if (initLoadingWindow && !initLoadingWindow.isDestroyed()) {
		initLoadingWindow.destroy();
	}
}

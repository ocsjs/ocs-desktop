/**
 * OcsBridge 门面类型入口（「实现即真相源」管线的类型源文件）。
 * 经 tsc --emitDeclarationOnly 发射为 common/src/bridge.generated.ts（pnpm gen:contract 重新生成）。
 *
 * 类型推导链：白名单数组（remote.whitelists.ts）= 运行时 guard = 自省输出 = 此处 Pick 键集，
 * 三方一致由构造保证，无漂移可能。electron 域复用官方类型（参数随 Electron 升级自动跟随）。
 */
import type { BrowserWindow, WebContents, App, Dialog } from 'electron';
import type { RemoteMethods } from '@ocs-desktop/common';
import {
	fsWhitelist,
	pathWhitelist,
	osWhitelist,
	winWhitelist,
	webContentsWhitelist,
	appWhitelist,
	dialogWhitelist
} from '@ocs-desktop/common';

/** 同步签名 → 异步（Promise 包装返回类型；已是 Promise/非函数的不重复包装） */
type Asyncify<T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => infer R
		? R extends Promise<any>
			? T[K]
			: (...args: A) => Promise<R>
		: T[K];
};

/** 门面总类型（web 侧 bridge 的类型，渲染端 window.ocs 的形状） */
export type OcsBridge = {
	/** methods 域：facade 恒经 invoke 异步返回，故整体 Asyncify（实现中的同步方法类型自动 Promise 化） */
	methods: Asyncify<RemoteMethods>;
	fs: Asyncify<Pick<typeof import('fs'), (typeof fsWhitelist)[number]>>;
	path: Asyncify<Pick<typeof import('path'), (typeof pathWhitelist)[number]>> & {
		/** 路径分隔符（preload 本地推导常量，非 IPC：win32='\\' 其余='/'） */
		readonly sep: '\\' | '/';
	};
	os: Asyncify<Pick<typeof import('os'), (typeof osWhitelist)[number]>>;
	win: Asyncify<Pick<BrowserWindow, (typeof winWhitelist)[number]>>;
	webContents: Asyncify<Pick<WebContents, (typeof webContentsWhitelist)[number]>>;
	app: Asyncify<Pick<App, (typeof appWhitelist)[number]>>;
	dialog: Pick<Dialog, (typeof dialogWhitelist)[number]>;
	/** electron-store 域（机械转驼峰；整树读取经 methods.getStore 异步实现；
	 *  写路径统一走 methods.saveStore（含加密），故不提供 set） */
	electronStore: {
		get(): Promise<any>;
	};
	/** logger 转发（fire-and-forget） */
	logger: {
		info(...msg: any[]): void;
		warn(...msg: any[]): void;
		error(...msg: any[]): void;
	};
	// 既有窄接口（preload 现有实现，非生成器产物）
	shell: {
		openPath(p: string): Promise<string>;
		showItemInFolder(p: string): void;
		openExternal(url: string): Promise<void>;
	};
	clipboard: { writeText(text: string): void };
	// eslint-disable-next-line no-undef
	platform: NodeJS.Platform;
	quitApp(): void;
	on(channel: string, cb: (...args: any[]) => void): () => void;
};

import { ipcMain, app, dialog, BrowserWindow, nativeTheme, net } from 'electron';
import { Logger } from '../logger';
import { autoLaunch } from './auto.launch';
import axios, { AxiosRequestConfig } from 'axios';
import { downloadFile, unzip } from '../utils';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getValidBrowsers } from '@ocs-desktop/common/node';
import { store } from '../store';
import { exportExcel } from '../utils/index';
import { readdir, stat } from 'fs/promises';
import { updateApp, updater } from './updater';
import { AutomationScripts } from '../scripts';
import { getBrowserMajorVersion, getExtensionPaths } from '../utils/browser';
import { installBuiltinChrome } from './init.chrome';
import type { AppStore, RawAutomationScript, RemoteMethods } from '@ocs-desktop/common';
import {
	encryptRenderString,
	decryptRenderString,
	isCryptoReady,
	encryptWithPassword,
	decryptWithPassword,
	isPasswordEncrypted
} from '../crypto';
import { hideToTray, quitApp, cancelQuit, destroyTray } from '../tray';

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
 * 注册主进程远程通信事件
 * @param name 事件前缀名称
 * @param target 事件目标
 */
function registerRemoteEvent(name: string, target: any) {
	const logger = Logger('remote');
	try {
		ipcMain
			.on(name + '-get', (event, [property]) => {
				try {
					// logger.info({ event: name + '-get', args: [property] });
					event.returnValue = target[property];
				} catch (e) {
					event.returnValue = { error: serializeError(e) };
				}
			})
			.on(name + '-set', (event, [property, value]) => {
				try {
					// logger.info({ event: name + '-set', args: [property, value] });
					event.returnValue = target[property] = value;
				} catch (e) {
					event.returnValue = { error: serializeError(e) };
				}
			})

			/** 异步调用 */
			.on(
				name + '-call',
				async (
					event,
					[
						/** 回调id */
						respondChannel,
						property,
						...args
					]
				) => {
					// logger.info({ event: name + '-call', args });
					try {
						const result = await target[property](...args);
						event.reply(respondChannel, { data: result });
					} catch (e) {
						event.reply(respondChannel, { error: serializeError(e) });
					}
				}
			)

			/** 同步调用 */
			.on(name + '-call-sync', (event, [property, ...args]) => {
				// logger.info({ event: name + '-call-sync', args: [property] });
				try {
					const result = target[property](...args);
					event.returnValue = { data: result };
				} catch (e) {
					event.returnValue = { error: serializeError(e) };
				}
			});
	} catch (err) {
		logger.error(err);
	}
}

let win: BrowserWindow | undefined;

/** 需远程共享的方法（类型契约见 @ocs-desktop/common contract.ts） */
const methods: RemoteMethods = {
	autoLaunch,
	get: (url: string, config?: AxiosRequestConfig<any> | undefined) => axios.get(url, config).then((res) => res.data),
	getWithStatus: (url: string, config?: AxiosRequestConfig<any> | undefined) =>
		axios.get(url, { ...config, validateStatus: () => true }).then((res) => ({ status: res.status, data: res.data })),
	download: (channel: string, url: string, dest: string) => {
		/** 下载文件 */
		return downloadFile(url, dest, (rate: any, totalLength: any, chunkLength: any) => {
			win?.webContents?.send('download', channel, rate, totalLength, chunkLength);
		});
	},
	unzip: unzip,
	getValidBrowsers: getValidBrowsers,
	getBrowserMajorVersion: getBrowserMajorVersion,
	getExtensionPaths: getExtensionPaths,
	/**
	 * 下载并安装内置浏览器（供前端「环境修复」复用多源下载，不重启应用）。
	 * 进度通过 webContents.send('builtin-chrome-install-progress', progress) 推送。
	 * @returns 安装完成后的浏览器可执行文件路径
	 */
	installBuiltinChrome: (): Promise<string> =>
		installBuiltinChrome((progress) => {
			if (win && !win.isDestroyed()) {
				win.webContents.send('builtin-chrome-install-progress', progress);
			}
		}),
	exportExcel: exportExcel,
	statisticFolderSize: statisticFolderSize,
	getPlatform: () => process.platform,
	/** 读取系统当前是否为深色主题（nativeTheme.themeSource 默认 system，跟随 OS） */
	getSystemDark: () => nativeTheme.shouldUseDarkColors,
	updateApp: updateApp,
	/** 手动检查更新（设置页「更新设置」卡片使用），返回当前/最新版本与是否有更新 */
	checkUpdate: updater,
	/** 隐藏主窗口到系统托盘（后台运行） */
	hideToTray: hideToTray,
	/** 程序化退出（置位 isQuitting 后 app.exit，绕过「隐藏到托盘」） */
	quitApp: quitApp,
	/** 取消程序化退出，复位 isQuitting */
	cancelQuit: cancelQuit,
	/** 销毁托盘图标 */
	destroyTray: destroyTray,
	/**
	 * 重置设置并重启：渲染层已同步保存重置后的 store（render.setting + window 等），
	 * 此处仅负责重启。通过 quitApp 程序化退出，绕过「隐藏到托盘」逻辑。
	 */
	resetApp: () => {
		app.relaunch();
		quitApp(0);
	},
	/**
	 * 数据加密是否可用（信封加密方案：主密钥就绪即可加密）。
	 * 语义变更：历史上返回 safeStorage.isEncryptionAvailable()（Linux 无密钥环时为 false，
	 * 数据明文落盘）；信封加密下 safeStorage 不可用时主密钥以 v1:plain: 明文回退存储，
	 * 数据仍可 AES 加密（混淆级防护），故此处统一返回主密钥就绪状态。
	 */
	isEncryptionAvailable: () => {
		return isCryptoReady();
	},
	isDirectory: (path: string) => fs.statSync(path).isDirectory(),
	getRawScripts: () => JSON.parse(JSON.stringify(AutomationScripts)) as RawAutomationScript[],
	encryptRenderString,
	decryptRenderString,
	/** 导出数据：用户密码加密（跨机器可移植，scrypt 派生密钥） */
	encryptExportString: encryptWithPassword,
	/** 导入数据：用户密码解密（密码错误时 GCM 校验抛错） */
	decryptExportString: decryptWithPassword,
	/** 判断导出文件中的 render 是否为密码加密格式 */
	isPasswordEncrypted,
	/** 一次性完成加密和存储，避免二次 IPC 调用 */
	saveStore: (plainStoreJson: string, shouldEncrypt: boolean): void => {
		const storeData: AppStore = JSON.parse(plainStoreJson);
		if (shouldEncrypt && isCryptoReady()) {
			if (typeof storeData.render === 'string') {
				// render 应为对象；字符串说明渲染端数据已损坏（如历史解密竞态残留的密文）。
				// 绝不能再加密写回（会产生重复加密导致解密后是字符串而非对象），保留磁盘原数据。
				Logger('remote').error('saveStore 收到字符串形态的 render，已跳过该字段写入以避免重复加密');
				// @ts-ignore
				storeData.render = store.store.render;
			} else {
				// @ts-ignore
				storeData.render = encryptRenderString(JSON.stringify(storeData.render));
			}
		}
		store.store = storeData;
	},
	/**
	 * 批量预下载远程用户脚本到临时目录，供本地服务器代理给拓展拦截安装。
	 * 规避远程 .user.js 网络波动导致拓展拦截失败。失败项返回 success:false，调用方据此剔除并通知用户。
	 */
	downloadUserscripts: async (urls: string[]) => {
		const tmpDir = path.resolve(app.getPath('temp'), './ocs-userscripts');
		// 确保临时目录存在。不清空：避免多浏览器并行启动时互相删除对方正在使用的临时文件；
		// 文件名按 url hash 命名，同脚本覆盖写，不同脚本不冲突。
		await fs.promises.mkdir(tmpDir, { recursive: true });

		const TIMEOUT = 30 * 1000;
		const logger = Logger('remote');
		type FetchResult = { data?: string; error?: string };

		/**
		 * Chromium 网络栈下载：net.fetch 走默认 session，自动遵循系统代理与 Chromium 证书策略，
		 * 与用户浏览器网络行为一致。net.fetch 无超时参数，用 AbortController 实现。
		 */
		const fetchViaNet = async (u: string): Promise<FetchResult> => {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), TIMEOUT);
			try {
				const res = await net.fetch(u, { signal: controller.signal });
				if (!res.ok) {
					return { error: `HTTP ${res.status} ${res.statusText}`.trim() };
				}
				return { data: await res.text() };
			} catch (e: any) {
				// AbortError 即超时；其余为 Chromium 网络错误（ERR_PROXY_CONNECTION_FAILED、ERR_NAME_NOT_RESOLVED 等）
				const reason =
					e?.name === 'AbortError'
						? `请求超时（${TIMEOUT / 1000} 秒）`
						: `${e?.name || 'Error'}: ${e?.message || String(e)}`;
				return { error: reason };
			} finally {
				clearTimeout(timer);
			}
		};

		/** axios 直连兜底（Node 网络栈）：失败返回真实错误，不再吞错。 */
		const fetchViaAxios = async (u: string): Promise<FetchResult> => {
			try {
				const res = await axios.get(u, { timeout: TIMEOUT, responseType: 'text', validateStatus: () => true });
				if (!res.status || res.status < 200 || res.status >= 300) {
					return { error: `HTTP ${res.status || 'unknown'}` };
				}
				return { data: typeof res.data === 'string' ? res.data : String(res.data) };
			} catch (e: any) {
				// axios 网络错误携带 code（ECONNRESET、ETIMEDOUT、ENOTFOUND、证书错误等）
				return { error: e?.code ? `${e.code}: ${e.message}` : e?.message || String(e) };
			}
		};

		return Promise.all(
			urls.map(async (url) => {
				try {
					// net.fetch 优先（系统代理，与浏览器一致），失败回退 axios 直连，各自保留真实错误原因
					let result = await fetchViaNet(url);
					if (result.error) {
						const netError = result.error;
						result = await fetchViaAxios(url);
						if (result.error) {
							result.error = `代理网络栈失败[${netError}]，直连失败[${result.error}]`;
						}
					}
					if (result.error) {
						logger.error('用户脚本预下载失败', { url, error: result.error });
						return { url, path: '', success: false, error: result.error };
					}
					const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
					const filePath = path.join(tmpDir, `${hash}.user.js`);
					await fs.promises.writeFile(filePath, result.data!, 'utf-8');
					return { url, path: filePath, success: true };
				} catch (e: any) {
					const reason = e?.message || String(e);
					logger.error('用户脚本预下载异常', { url, error: reason });
					return { url, path: '', success: false, error: reason };
				}
			})
		);
	}
};

/**
 * 初始化远程通信
 */
export function remoteRegister(_win: BrowserWindow) {
	win = _win;
	registerRemoteEvent('electron-store', store);
	registerRemoteEvent('fs', fs);
	registerRemoteEvent('os', os);
	registerRemoteEvent('path', path);

	registerRemoteEvent('win', _win);
	registerRemoteEvent('webContents', _win.webContents);
	registerRemoteEvent('app', app);
	registerRemoteEvent('dialog', dialog);
	registerRemoteEvent('methods', methods);
	registerRemoteEvent('logger', Logger('render'));

	// 系统深浅色变化时通知渲染层（用于「自动」模式跟随系统，matchMedia 在 Electron 不稳定）
	nativeTheme.on('updated', () => {
		win?.webContents?.send('system-theme-change', nativeTheme.shouldUseDarkColors);
	});
}

const _registerRemoteEvent = registerRemoteEvent;
export { _registerRemoteEvent as registerRemoteEvent };

async function statisticFolderSize(dir: string) {
	const files = await readdir(dir, { withFileTypes: true });

	const paths: Promise<number>[] = files.map(async (file) => {
		const _path = path.join(dir, file.name);
		if (file.isDirectory()) return await statisticFolderSize(_path);

		if (file.isFile()) {
			const { size } = await stat(_path);
			return size;
		}
		return 0;
	});

	return (await Promise.all(paths)).flat().reduce((i, size) => i + size, 0);
}

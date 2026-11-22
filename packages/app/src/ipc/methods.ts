import { app, shell, clipboard, safeStorage, nativeTheme } from 'electron';
import { Logger } from '../logger';
import { autoLaunch } from '../tasks/auto.launch';
import type { AxiosRequestConfig } from 'axios';
import { NetUtils } from '../utils/net';
import { unzip, isDevMode, getCurrentWebContents } from '../utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getValidBrowsers } from '@ocs-desktop/common/node';
import { StoreData } from '../store';
import { exportExcel } from '../utils/index';
import {
	cachedHttpGet,
	readHttpCache,
	writeHttpCache,
	httpCacheStats,
	httpCacheStatsBySite,
	clearHttpCache
} from '../utils/http-cache';
import { siteOfUrl } from '@ocs-desktop/common';
import { readdir, stat } from 'fs/promises';
import { updateApp, updater } from '../tasks/updater';
import { AutomationScripts } from '../scripts';
import { SystemScripts } from '../scripts/system';
import { getBrowserMajorVersion, getExtensionPaths } from '../utils/browser';
import { installBuiltinChrome } from '../tasks/init.chrome';
import type { AppStore, RawAutomationScript } from '@ocs-desktop/common';
import {
	encryptRenderString,
	decryptRenderString,
	isCryptoReady,
	encryptWithPassword,
	decryptWithPassword,
	isPasswordEncrypted
} from '../crypto';
import { hideToTray, quitApp, cancelQuit, destroyTray } from '../tray';
import { getServerToken } from '../tasks/server.auth';
import { iconCacheStats, clearIconCache } from '../tasks/startup.server';
import { canOCR } from '../utils/ocr';
import { sendToRenderer } from './events';
import { scriptWorkerLaunch, scriptWorkerSend, scriptWorkerKill } from './worker.host';
import { cancelCloseWatchdog } from '../close.watchdog';

/**
 * 主进程 methods 远程调用实现（RemoteMethods 契约的唯一真相源）。
 * 类型经 tsc 声明发射自动推导生成（export type RemoteMethods = typeof methods），
 * 契约产物见 common/src/remote-methods.generated.ts（pnpm gen:contract 重新生成）。
 */

/** 网络缓存加速开关判定：全局开关 + 站点级开关（缺省均视为开启） */
function isNetworkCacheEnabled(url?: string) {
	const browserSetting = StoreData.get().render?.setting?.browser;
	if (browserSetting?.networkCache === false) return false;
	if (url) {
		const site = siteOfUrl(url);
		if (site && browserSetting?.networkCacheSites?.[site.id] === false) return false;
	}
	return true;
}

// 统一网络层：注入手动代理读取（NetUtils 刻意不依赖 store，保持 vitest/worker 环境可用）
NetUtils.setManualProxyProvider(() => StoreData.get().updater?.proxyUrl);

export const methods = {
	autoLaunch: () => autoLaunch(),
	// 默认 15s 超时（可经 config 覆盖）：无超时时 TCP 连接挂起要等 OS 级超时（20s+），
	// 脚本搜索/信息查询等 UI 链路需要更快失败以进入降级分支
	get: (url: string, config?: AxiosRequestConfig<any> | undefined) =>
		NetUtils.get(url, { timeout: 15 * 1000, ...config }).then((res) => res.data),
	/**
	 * 带磁盘缓存的 GET（脚本猫/GreasyFork 等速度不稳定站点加速）：
	 * TTL 内直接命中缓存；请求失败时回退过期缓存（弱网兜底）。
	 * 「网络缓存加速」设置关闭时恢复原始实时加载（不读写缓存）。
	 */
	cachedGet: (url: string, ttlMs: number) => {
		if (!isNetworkCacheEnabled(url)) {
			return NetUtils.get(url, { timeout: 15 * 1000 }).then((res) => res.data);
		}
		return cachedHttpGet(url, ttlMs, async () => {
			const res = await NetUtils.get(url, { timeout: 15 * 1000, responseType: 'text' });
			return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
		}).then((text) => {
			try {
				return JSON.parse(text);
			} catch {
				return text;
			}
		});
	},
	getWithStatus: (url: string, config?: AxiosRequestConfig<any> | undefined) =>
		NetUtils.get(url, { ...config, validateStatus: () => true }).then((res) => ({
			status: res.status,
			data: res.data
		})),
	download: (channel: string, url: string, dest: string) => {
		/** 下载文件 */
		return NetUtils.download(url, dest, {
			onProgress: (rate, totalLength, chunkLength) => {
				sendToRenderer(getCurrentWebContents(), 'download', channel, rate, totalLength, chunkLength);
			}
		});
	},
	unzip: (input: string, output: string) => unzip(input, output),
	getValidBrowsers: () => getValidBrowsers(),
	getBrowserMajorVersion: (executablePath: string) => getBrowserMajorVersion(executablePath),
	getExtensionPaths: (extensionsFolder: string) => getExtensionPaths(extensionsFolder),
	// 内置拓展 API 已收敛至独立命名空间（bridge.bundledExtensions.*，见 extensions/api.ts）
	/** 系统自动化程序清单（开发者设置-自动化程序管理展示） */
	getSystemScripts: () => SystemScripts.map((s) => ({ name: s.name, label: s.label, phase: s.phase, order: s.order })),
	/**
	 * 下载并安装内置浏览器（供前端「环境修复」复用多源下载，不重启应用）。
	 * 进度通过 'builtin-chrome-install-progress' 事件推送。
	 * @returns 安装完成后的浏览器可执行文件路径
	 */
	installBuiltinChrome: (): Promise<string> =>
		installBuiltinChrome((progress) => {
			sendToRenderer(getCurrentWebContents(), 'builtin-chrome-install-progress', progress);
		}),
	exportExcel: (...args: Parameters<typeof exportExcel>) => exportExcel(...args),
	statisticFolderSize: statisticFolderSize,
	getPlatform: () => process.platform,
	/** 读取系统当前是否为深色主题（nativeTheme.themeSource 默认 system，跟随 OS） */
	getSystemDark: () => nativeTheme.shouldUseDarkColors,
	updateApp: () => updateApp(),
	/** 手动检查更新（设置页「更新设置」卡片使用），返回当前/最新版本与是否有更新 */
	checkUpdate: (config?: AppStore['updater']) => updater(config),
	/** 隐藏主窗口到系统托盘（后台运行） */
	hideToTray: () => hideToTray(),
	/** 程序化退出（置位 isQuitting 后 app.exit，绕过「隐藏到托盘」） */
	quitApp: (code?: number) => quitApp(code),
	/** 取消程序化退出，复位 isQuitting */
	cancelQuit: () => cancelQuit(),
	/** 渲染层开始处理 'close' 事件时调用，取消主进程无响应看门狗（3s 强制销毁窗口） */
	cancelCloseWatchdog: () => cancelCloseWatchdog(),
	/** 销毁托盘图标 */
	destroyTray: () => destroyTray(),
	/** 本地 OCR 识别模块是否可用（启动前环境检测：needOCR 的自动化程序依赖） */
	canOCR: () => canOCR(),
	/** 是否 electron-vite dev 开发模式（pnpm dev），dev 下软件无法自动重启 */
	isDevMode: () => isDevMode(),
	/**
	 * 重置设置并重启：渲染层已同步保存重置后的 store（render.setting + window 等），
	 * 此处仅负责重启。通过 quitApp 程序化退出，绕过「隐藏到托盘」逻辑。
	 * dev 模式（pnpm dev）下跳过 relaunch 仅退出：electron-vite 会在 quit 后杀死 dev
	 * 进程，relaunch 的新实例加载已失效的 dev server 地址会变白屏僵尸窗口；
	 * 渲染层负责在此之前提示用户手动重跑 pnpm dev（见 web utils/restart.ts）。
	 */
	resetApp: () => {
		if (isDevMode()) {
			quitApp(0);
			return;
		}
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
	/** 获取本地服务访问令牌（内存态，不落盘；供渲染端注入 worker/导航页） */
	getServerToken: () => getServerToken(),
	/**
	 * 获取 Linux 密钥环后端（'basic_text' 表示无可用密钥环，如 gnome-keyring/kwallet）。
	 * 非 Linux 平台返回 undefined（该 API 仅 Linux 有意义）。
	 */
	getStorageBackend: () => (process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : undefined),
	getDisplayEnv: () => {
		// Linux 打包版：Chromium 沙箱会清理渲染进程环境变量（DISPLAY 丢失），
		// worker 由渲染进程 fork 继承残缺 env，内置 Chrome 报 "Missing X server"。
		// 从主进程返回真实显示变量，供 fork worker 时合并（非 Linux 为空对象，合并无副作用）
		const keys = ['DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY', 'XDG_RUNTIME_DIR', 'XDG_SESSION_TYPE'];
		const env: Record<string, string> = {};
		for (const key of keys) {
			if (process.env[key]) {
				env[key] = process.env[key] as string;
			}
		}
		return env;
	},
	/** HTTP 磁盘缓存统计（网络缓存加速的缓存检测） */
	httpCacheStats: () => httpCacheStats(),
	/** HTTP 磁盘缓存统计（按站点分组） */
	httpCacheStatsBySite: () => httpCacheStatsBySite(),
	/** 清空 HTTP 磁盘缓存（siteId 为空时清空全部） */
	clearHttpCache: (siteId?: string) => clearHttpCache(siteId),
	/** 网站图标缓存统计（条数 + 总字节数） */
	iconCacheStats: () => iconCacheStats(),
	/** 清空网站图标缓存（内存 + 磁盘） */
	clearIconCache: () => clearIconCache(),
	isDirectory: (path: string) => fs.statSync(path).isDirectory(),
	getRawScripts: () => JSON.parse(JSON.stringify(AutomationScripts)) as RawAutomationScript[],
	encryptRenderString: (content: string) => encryptRenderString(content),
	decryptRenderString: (content: string) => decryptRenderString(content),
	/** 导出数据：用户密码加密（跨机器可移植，scrypt 派生密钥） */
	encryptExportString: (content: string, password: string) => encryptWithPassword(content, password),
	/** 导入数据：用户密码解密（密码错误时 GCM 校验抛错） */
	decryptExportString: (content: string, password: string) => decryptWithPassword(content, password),
	/** 判断导出文件中的 render 是否为密码加密格式 */
	isPasswordEncrypted: (content: string) => isPasswordEncrypted(content),
	/** 读取整棵 store 树（bridge electronStore.get 的异步实现；写路径走 saveStore） */
	getStore: () => StoreData.get(),
	/** 一次性完成加密和存储，避免二次 IPC 调用 */
	saveStore: (plainStoreJson: string, shouldEncrypt: boolean): void => {
		const storeData: AppStore = JSON.parse(plainStoreJson);
		if (shouldEncrypt && isCryptoReady()) {
			if (typeof storeData.render === 'string') {
				// render 应为对象；字符串说明渲染端数据已损坏（如历史解密竞态残留的密文）。
				// 绝不能再加密写回（会产生重复加密导致解密后是字符串而非对象），保留磁盘原数据。
				Logger('remote').error('saveStore 收到字符串形态的 render，已跳过该字段写入以避免重复加密');
				// @ts-ignore
				storeData.render = StoreData.get().render;
			} else {
				// @ts-ignore
				storeData.render = encryptRenderString(JSON.stringify(storeData.render));
			}
		}
		StoreData.replaceAll(storeData);
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
		 * 统一经 NetUtils.get 下载（系统代理自动注入 + 代理链路失败自动降级直连），
		 * 替代原 net.fetch/axios 双栈 hack —— 统一层落地后两条栈行为已一致。
		 */
		const fetchScript = async (u: string): Promise<FetchResult> => {
			try {
				const res = await NetUtils.get(u, { timeout: TIMEOUT, responseType: 'text', validateStatus: () => true });
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
				// 脚本下载磁盘缓存：TTL 内直接复用（官方站点速度不稳定加速），网络失败回退过期缓存；
				// 「网络缓存加速」设置关闭时不读不写缓存，恢复原始实时加载
				const cacheEnabled = isNetworkCacheEnabled(url);
				const SCRIPT_CACHE_TTL = 30 * 60 * 1000;
				const writeTmp = async (body: string) => {
					const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
					const filePath = path.join(tmpDir, `${hash}.user.js`);
					await fs.promises.writeFile(filePath, body, 'utf-8');
					return filePath;
				};
				try {
					const cached = cacheEnabled ? readHttpCache(url) : undefined;
					if (cached && Date.now() - cached.time < SCRIPT_CACHE_TTL) {
						return { url, path: await writeTmp(cached.body), success: true };
					}
					// URL 归一化：脚本托管地址可能含中文/空格等未转义字符
					// （如 ScriptCat 托管脚本），Node 网络栈（axios）会直接抛 ERR_UNESCAPED_CHARACTERS，
					// 统一经 URL 构造器百分号编码后再请求
					let fetchUrl = url;
					try {
						fetchUrl = new URL(url).href;
					} catch {}
					// 统一 NetUtils 单栈下载（代理感知 + 失败自动降级直连）
					const result = await fetchScript(fetchUrl);
					if (result.error) {
						// 网络失败回退过期缓存（弱网兜底，安装旧版本优于安装失败）
						if (cached) {
							logger.error('用户脚本预下载失败，回退过期缓存', { url, error: result.error });
							return { url, path: await writeTmp(cached.body), success: true };
						}
						logger.error('用户脚本预下载失败', { url, error: result.error });
						return { url, path: '', success: false, error: result.error };
					}
					if (cacheEnabled) {
						writeHttpCache(url, result.data!);
					}
					return { url, path: await writeTmp(result.data!), success: true };
				} catch (e: any) {
					const reason = e?.message || String(e);
					logger.error('用户脚本预下载异常', { url, error: reason });
					return { url, path: '', success: false, error: reason };
				}
			})
		);
	},
	launchBrowserDetached: (executablePath: string, args: string[]) => {
		// detached + unref：浏览器生命周期独立于应用（应用退出后浏览器保持运行）
		const child = spawn(executablePath, args, { detached: true, stdio: 'ignore' });
		child.unref();
	},
	scriptWorkerLaunch: (uid: string) => scriptWorkerLaunch(uid),
	scriptWorkerSend: (...args: Parameters<typeof scriptWorkerSend>) => scriptWorkerSend(...args),
	scriptWorkerKill: (uid: string, expectedPid?: number) => scriptWorkerKill(uid, expectedPid),
	shellOpenPath: (p: string) => shell.openPath(p),
	shellShowItemInFolder: (p: string) => shell.showItemInFolder(p),
	shellOpenExternal: (url: string) => shell.openExternal(url),
	clipboardWriteText: (text: string) => clipboard.writeText(text),
	testMethod: () => 1
};

/** 契约类型 = 实现类型（tsc 声明发射时展平为完整结构类型，真相源唯一） */
export type RemoteMethods = typeof methods;

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

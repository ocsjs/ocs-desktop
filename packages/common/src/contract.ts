/**
 * 跨进程共享契约：主进程（@ocs-desktop/app）与渲染进程（@ocs-desktop/web）共同依赖的
 * 类型定义集中于此，保证依赖方向单向为 app → common ← web。
 *
 * 本文件仅包含类型（type/interface），不产生运行时代码，可安全用于浏览器环境。
 */
import type { AxiosRequestConfig } from 'axios';
import type { LaunchOptions } from 'playwright-core';
import type { AutomationScript } from './scripts/script';
import type { Config } from './scripts/interface';
import type { UpdateInformationResource } from './api';
import type { getValidBrowsers } from './utils/valid.browser';

/** 应用持久化存储结构（主进程 electron-store 与渲染进程共享） */
export interface AppStore {
	name: string;
	version: string;
	/** 路径数据 */
	paths: {
		'app-path': string;
		'user-data-path': string;
		'exe-path': string;
		'logs-path': string;
		'config-path': string;
		/** 浏览器用户数据文件夹 */
		userDataDirsFolder: string;
		/** 浏览器下载文件夹 */
		downloadFolder: string;
		/** 加载拓展路径 */
		extensionsFolder: string;
	};
	/** 窗口设置 */
	window: {
		/** 窗口置顶 */
		alwaysOnTop: boolean;
		/** 开机自启 */
		autoLaunch: boolean;
		/** 后台运行：关闭窗口时自动隐藏到系统托盘，浏览器保持运行 */
		hideToTrayOnClose: boolean;
	};
	/** 本地服务器数据 */
	server: {
		port: number;
		authToken: string;
	};
	/** 更新设置（测试/调试用途，正式用户留空即为线上默认） */
	updater: {
		/** 自定义更新源目录（latest.yml 所在 URL），留空使用构建时 publish.url 默认源 */
		feedUrl: string;
		/** 自定义软件信息接口 URL（更新日志来源），留空使用默认 ocs-app-infos.json */
		infosUrl: string;
		/** 允许降级/同版本覆盖安装（重复测试用，对应 electron-updater allowDowngrade） */
		allowDowngrade: boolean;
		/** 强制指定内置浏览器下载源（'' 默认按优先级降级；npmmirror/official/ocs-cdn 用于测试下载链路） */
		chromeSource: string;
	};
	/** 渲染进程数据（磁盘上可能为加密后的字符串，由主进程解密） */
	render: { [x: string]: any };
}

/** 用户脚本（渲染进程持久化结构） */
export interface UserScripts {
	id: number;
	/** 用户脚本链接 */
	url: string;
	/** 启动自动安装脚本 */
	enable: boolean;
	/**
	 * 脚本信息
	 */
	info: any;
	/** 是否为本地脚本 */
	isLocalScript: boolean;
	/** 是否为网络链接加载的脚本 */
	isInternetLinkScript: boolean;
	/** 上次成功安装到浏览器的版本，undefined 表示从未通过 OCS 安装过 */
	lastInstalledVersion?: string;
	/** 脚本信息上次更新时间（最新版本、描述等信息），0 表示从未更新 */
	lastInfoUpdateTime?: number;
}

/** 自动化脚本的纯数据形态（跨进程传输时丢失方法/事件，仅保留数据字段） */
export type RawAutomationScript = Pick<AutomationScript, 'configs' | 'name' | 'icon'>;

/** 批量预下载用户脚本的单项结果 */
export interface DownloadUserscriptResult {
	url: string;
	path: string;
	success: boolean;
	error?: string;
}

/**
 * 主进程 methods 远程调用契约。
 * 实现见 @ocs-desktop/app src/tasks/remote.register.ts（const methods: RemoteMethods）。
 */
export interface RemoteMethods {
	autoLaunch: () => void;
	get: (url: string, config?: AxiosRequestConfig<any> | undefined) => Promise<any>;
	getWithStatus: (url: string, config?: AxiosRequestConfig<any> | undefined) => Promise<{ status: number; data: any }>;
	download: (channel: string, url: string, dest: string) => Promise<string>;
	unzip: (input: string, output: string) => Promise<void>;
	getValidBrowsers: typeof getValidBrowsers;
	getBrowserMajorVersion: (executablePath: string) => number | undefined;
	getExtensionPaths: (extensionsFolder: string) => string[];
	/** 生成（或复用）浏览器专属的导航页扩展（chrome_url_overrides.newtab），返回扩展目录路径 */
	ensureNewTabExtension: (dir: string, opts: { uid: string; port: number }) => string;
	/** 下载并安装内置浏览器，返回安装完成后的可执行文件路径 */
	installBuiltinChrome: () => Promise<string>;
	exportExcel: (excel: { sheetName: string; list: any[] }[], filename: string) => void;
	statisticFolderSize: (dir: string) => Promise<number>;
	// eslint-disable-next-line no-undef
	getPlatform: () => NodeJS.Platform;
	getSystemDark: () => boolean;
	updateApp: (newVersion: UpdateInformationResource) => Promise<void>;
	/** 手动检查更新，返回当前/最新版本与是否有更新（undefined 表示检查失败）。
	 *  可携带渲染层最新的 updater 配置，避免持久化防抖未落盘导致主进程读到旧值 */
	checkUpdate: (
		config?: AppStore['updater']
	) => Promise<{ current: string; latest: string; hasUpdate: boolean; message?: string } | undefined>;
	hideToTray: () => void;
	quitApp: (code?: number) => void;
	cancelQuit: () => void;
	destroyTray: () => void;
	resetApp: () => void;
	isEncryptionAvailable: () => boolean;
	isDirectory: (path: string) => boolean;
	getRawScripts: () => RawAutomationScript[];
	encryptRenderString: (plaintext: string) => string;
	decryptRenderString: (encrypted: string) => string;
	saveStore: (plainStoreJson: string, shouldEncrypt: boolean) => void;
	downloadUserscripts: (urls: string[]) => Promise<DownloadUserscriptResult[]>;
}

/** worker 初始化参数中的自动化脚本纯数据形态 */
export type ScriptWorkerAutomationScript = { name: string; configs: Record<string, Config> };

export interface ScriptWorkerBrowserInfo {
	name: string;
	notes: string;
	tags: { color: string; name: string }[];
}

export interface ScriptWorkerBrowserConfig {
	/** 是否启用弹窗 */
	enable_dialog?: boolean;
	/** 是否启用浏览器界面预览（Page.startScreencast 推流） */
	screenshot_preview?: boolean;
	/** 浏览器增强（防休眠/防冻结）：附加防节流启动参数 + 注入静音音频豁免脚本 */
	browser_enhancement?: boolean;
}

export interface ScriptWorkerLangs {
	error_when_executable_not_found?: string;
	error_when_browser_version_too_high?: string;
	error_when_browser_launch_failed_too_fast?: string;
	error_when_extension_version_too_low?: string;
	error_when_playwright_selector_timeout?: string;
	error_when_extension_not_found?: string;
}

export interface ScriptWorkerInitOptions {
	store: AppStore;
	uid: string;
	cachePath: string;
	automationScripts: ScriptWorkerAutomationScript[];
	browserInfo: ScriptWorkerBrowserInfo;
	config: ScriptWorkerBrowserConfig;
	langs: ScriptWorkerLangs;
}

export type ScriptWorkerLaunchOptions = Required<Pick<LaunchOptions, 'executablePath' | 'headless' | 'args'>> & {
	userDataDir: string;
	userscripts: string[];
	/** 总共启用的用户脚本数量（用于区分"无脚本"和"无需更新"） */
	enabledScriptCount: number;
};

export interface ScreencastOptions {
	everyNthFrame?: number;
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
}

/** 可推流页面信息（worker 通过 pages-changed 事件广播给渲染进程） */
export interface ScreencastPageInfo {
	url: string;
	title: string;
	/** 网站图标 URL（页面未声明 favicon 时回退为 origin/favicon.ico） */
	icon: string;
}

/** pages-changed 事件负载 */
export interface ScreencastPagesChangedPayload {
	/** 当前全部可推流页面（已排除 chrome:// 等内部页面） */
	pages: ScreencastPageInfo[];
	/** 当前推流目标页 URL（无则空串） */
	current: string;
}

/**
 * 脚本工作进程（worker）调用契约。
 * 实现见 @ocs-desktop/app src/worker/index.ts（class ScriptWorker implements ScriptWorker）。
 */
export interface ScriptWorker {
	init(options: ScriptWorkerInitOptions): void;
	launch(options: ScriptWorkerLaunchOptions): Promise<void>;
	close(): Promise<void>;
	bringToFront(): Promise<void>;
	startScreencast(opts?: ScreencastOptions): Promise<void>;
	pauseScreencast(): Promise<void>;
	stopScreencast(): Promise<void>;
	/** 切换 screencast 推流目标到指定 URL 的页面（用户在预览卡片上手动选择） */
	switchScreencastPage(url: string): Promise<void>;
	kill(): void;
	debug(...msg: any[]): void;
	warn(...msg: any[]): void;
	info(...msg: any[]): void;
	error(...msg: any[]): void;
}

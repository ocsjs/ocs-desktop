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

/** 生成产物（remote-methods.generated.ts）所需的类型转发 */
export type { ValidBrowser } from './interface';
export type { SystemScriptPhase } from './scripts/script';
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
		/** 手动 HTTP 代理（如 http://127.0.0.1:7890），优先级高于系统代理自动检测；留空走自动检测 */
		proxyUrl: string;
	};
	/** 脚本资源覆盖（开发者设置-脚本调试，留空使用默认线上地址 OCS_SCRIPT_RESOURCES） */
	scriptResources: {
		/** OCS index 脚本地址 */
		index: string;
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
export type RawAutomationScript = Pick<AutomationScript, 'configs' | 'name' | 'icon' | 'needOCR'>;

/** 批量预下载用户脚本的单项结果 */
export interface DownloadUserscriptResult {
	url: string;
	path: string;
	success: boolean;
	error?: string;
}

/** 内置拓展清单信息（供渲染进程能力探测与展示；实现见 app src/extensions/bundled.ts） */
export interface BundledExtensionInfo {
	id: string;
	name: string;
	version: string;
	license: string;
	sourceUrl: string;
	homepage: string;
	/** 展示元数据（构建期 lock 清单透传） */
	description?: string;
	icon?: string;
}

/** 内置拓展完整性校验单项结果 */
export interface ExtensionIntegrityResult {
	id: string;
	/** ok=校验通过；repaired=校验失败已从 asar 重释放；skipped=未安装（按需安装，不强制释放）；failed=修复失败 */
	status: 'ok' | 'repaired' | 'skipped' | 'failed';
	error?: string;
}

/**
 * 主进程 methods 远程调用契约（实现即真相源，生成产物）。
 * 真相源：@ocs-desktop/app src/tasks/remote.methods.ts 的 methods 实现对象；
 * 产物由 packages/app/scripts/gen-remote-contract.mjs 经 tsc 声明发射生成（pnpm gen:contract）。
 */
export type { RemoteMethods } from './types/remote-methods.generated';

/** 渲染端 window.ocs 门面类型（bridge 统一门面；生成产物，真相源同上 + remote.whitelists.ts） */
export type { OcsBridge } from './types/bridge.generated';

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
	/**
	 * 软件辅助：监听浏览器路由（ocs-environment / ocs-script-actions）与用户脚本联动。
	 * 默认 true；关闭后脚本不再识别为软件环境（自动化增强不可用），用于卡顿排查。
	 */
	script_assistance?: boolean;
	/**
	 * 文件下载优化：恢复浏览器原生下载行为（真实文件名 + 原生落盘）。
	 * 默认 true；关闭后回退为 Playwright 托管下载，可能无法下载文件。
	 */
	download_optimization?: boolean;
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
	/** 渲染端汇报已消费的推流帧数（背压反馈：释放在途额度并冲刷暂缓的 ack） */
	screencastConsumed(count: number): void;
	/** 切换 screencast 推流目标到指定 URL 的页面（用户在预览卡片上手动选择） */
	switchScreencastPage(url: string): Promise<void>;
	kill(): void;
	debug(...msg: any[]): void;
	warn(...msg: any[]): void;
	info(...msg: any[]): void;
	error(...msg: any[]): void;
}

/** ScriptWorker 子进程事件负载（主进程 script-worker.host 转发，script-worker 频道） */
export interface ScriptWorkerEventPayload {
	uid: string;
	kind: 'message' | 'stdout' | 'stderr' | 'exit' | 'event';
	/** kind=event：worker 业务事件名 */
	event?: string;
	/** kind=event：worker 业务事件参数 */
	args?: any[];
	/** kind=stdout/stderr：输出文本块 */
	chunk?: string;
	/** kind=exit：退出码 */
	code?: number | null;
}

/**
 * 内置浏览器文件完整性检查结果（checkBuiltinChromeIntegrity 返回值）。
 * 实现见 @ocs-desktop/app src/tasks/chrome.integrity.ts（特性代码后续提交）。
 */
export interface ChromeIntegrityResult {
	/** ok：完整；corrupted：文件被杀软等删改；missing：浏览器未安装/可执行文件不存在 */
	status: 'ok' | 'corrupted' | 'missing';
	/** 是否存在逐文件哈希基准清单（旧版本安装无清单，仅做关键文件降级检查） */
	hasManifest: boolean;
	/** status=corrupted 时的损坏详情（缺失/被篡改文件示例） */
	detail?: string;
}

/**
 * 内置浏览器安装进度（builtin-chrome-install-progress 事件负载）。
 * 实现见 @ocs-desktop/app src/tasks/init.chrome.ts。
 */
export interface BuiltinChromeInstallProgress {
	phase: 'download' | 'extract' | 'configure';
	/** 下载阶段才有：源名/进度 */
	sourceName?: string;
	sourceIndex?: number;
	sourceCount?: number;
	rate?: number;
	message: string;
}


/**
 * 主进程 → 渲染进程 事件推送契约：频道名 → 参数元组。
 * 消灭散落的字符串字面量频道，重构时获得编译期保障。
 *
 * 发送侧封装：@ocs-desktop/app src/tasks/ipc.events.ts sendToRenderer
 * 监听侧封装：@ocs-desktop/web src/utils/ipc.ts onRendererEvent
 */
export interface IpcEventMap {
	/** 文件下载进度（remote.methods.download 的进度回调推送，对齐 downloadFile 参数格式） */
	download: [channel: string, rate: number, totalLength: number, chunkLength: number];
	/** 内置浏览器安装进度（installBuiltinChrome 推送） */
	'builtin-chrome-install-progress': [progress: BuiltinChromeInstallProgress];
	/** 系统深浅色变化（nativeTheme updated，用于「自动」模式跟随系统） */
	'system-theme-change': [dark: boolean];
	/** 更新包下载进度（electron-updater download-progress，参数对齐 download 格式） */
	'update-download': [bytesPerSecond: number, totalLength: number, transferred: number];
	/** 检测到新版本（含更新日志 markdown） */
	'detect-new-app-version': [info: UpdateInformationResource];
	/** 在软件内定位显示指定浏览器（本地服务 HTTP 接口触发） */
	'show-browser-in-app': [uid: string];
	/** 系统关联/拖入打开文件（未找到文件参数时为 undefined） */
	'open-file': [path: string | undefined];
	/** 窗口即将关闭（渲染层接管关闭流程，决定隐藏托盘或退出） */
	close: [];
	/** 应用即将退出 */
	quit: [];
	/** ScriptWorker 子进程事件转发（主进程托管 utilityProcess → 渲染进程，按 uid 过滤） */
	'script-worker': [payload: ScriptWorkerEventPayload];
}

/** 类型化事件订阅（主进程 → 渲染进程），返回取消订阅函数 */
export type OcsEventSubscriber = <K extends keyof IpcEventMap>(
	channel: K,
	callback: (...args: IpcEventMap[K]) => void
) => () => void;

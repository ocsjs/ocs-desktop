import { Page } from 'playwright-core';
import { BaseAutomationEvents, Config, ConfigValueRecord, EventsRecord, TypedEventEmitter } from './interface';

export type RunFunction = (...args: any[]) => any;

export interface ScriptOptions<Run extends RunFunction = RunFunction> {
	name: string;
	run: Run;
	/** 图标 URL（网站地址或图片地址，经本地服务 /icon 代理解析） */
	icon?: string;
	/**
	 * 是否依赖 OCR 识别模块（破解登录验证码）。
	 * 声明后启动浏览器前会先做环境检测：未安装 OCR 模块则终止启动并引导用户下载。
	 */
	needOCR?: boolean;
}

export abstract class Script<Run extends RunFunction = RunFunction, E extends EventsRecord = EventsRecord>
	extends TypedEventEmitter<E>
	implements ScriptOptions
{
	name: string;
	run: Run;
	icon?: string;
	needOCR?: boolean;

	constructor(opts: ScriptOptions<Run>) {
		super();
		this.name = opts.name;
		this.run = opts.run;
		this.icon = opts.icon;
		this.needOCR = opts.needOCR;
	}
}

/** 收集脚本 */
export abstract class CollectorScript<
	RF extends RunFunction = RunFunction,
	E extends EventsRecord = EventsRecord
> extends Script<RF, E> {}

/** 自动化程序基类 */
export abstract class BaseAutomationScript<
	RF extends RunFunction = RunFunction,
	E extends EventsRecord = EventsRecord
> extends Script<RF, E> {}

export class ConfigsRequiredAutomationScript<
	C extends Record<string, Config> = Record<string, Config>,
	RF extends RunFunction = RunFunction,
	E extends EventsRecord = EventsRecord
> extends BaseAutomationScript<RF, E> {
	name: string;
	configs: C;

	constructor(configs: C, options: ScriptOptions<RF>) {
		super(options);
		this.name = options.name;
		this.run = options.run;
		this.configs = configs;
	}
}

/** 脚本运行方法类型声明 */
export type AutomationScriptRunFunction<C extends Record<string, Config> = Record<string, Config>> = {
	// 第一个，和第二个参数类型固定，剩下的参数类型由实例化时方法的参数类型决定
	(page: Page, configs: ConfigValueRecord<C>, ...args: any[]): void | Promise<void>;
};

/** 自动化程序（需要配置的自动化程序） */
export class AutomationScript<
	C extends Record<string, Config> = Record<string, Config>,
	RF extends AutomationScriptRunFunction<C> = AutomationScriptRunFunction<C>
> extends ConfigsRequiredAutomationScript<C, RF, BaseAutomationEvents> {}

/** 步骤提示函数（worker 导航页进度渲染） */
export type SystemScriptStep = (tips: string | string[], opts?: { loading?: boolean; warn?: boolean }) => Promise<void>;

/** 系统自动化程序执行阶段：launch=关键路径（失败中断启动）；post=后台段（失败仅告警） */
export type SystemScriptPhase = 'launch' | 'post';

/**
 * 系统自动化程序运行上下文（由 worker 注入）。
 * 与用户自动化程序的区别：拿到的是整个 BrowserContext（而非单个 Page），
 * 且带有 worker 通信与导航页提示通道。
 */
export interface SystemScriptContext {
	browser: import('playwright-core').BrowserContext;
	uid: string;
	/** AppStore 快照（启动时传入；import type 避免与 contract 循环依赖） */
	store: import('../contract').AppStore | undefined;
	/** worker→渲染端事件上报 */
	send: (event: string, ...args: any[]) => void;
	step: SystemScriptStep;
	/** 浏览器可执行文件路径（用于 Edge 判定等） */
	executablePath: string;
	/** 本次加载的拓展路径列表 */
	extensionPaths: string[];
	/** 浏览器 profile 目录（缓存目录） */
	userDataDir: string;
	/** 本次待安装的用户脚本 URL 列表（已由渲染端预下载/构造） */
	userscripts: string[];
	/** 启用的用户脚本总数（区分"无脚本"与"无需更新"） */
	enabledScriptCount: number;
	/** 需自动关闭的拓展主页 host 列表 */
	closeableExtensionHomepages: string[];
}

/**
 * 系统自动化程序：软件内置的静态自动化流程（开发者模式、用户脚本权限、脚本安装、状态同步等）。
 * 与用户自动化程序同基类（共享事件/日志设施），但由系统注册表统一编排：
 * 不可在 UI 删除/停用，浏览器启动后按 order 自动运行。
 */
export class SystemAutomationScript extends BaseAutomationScript<(ctx: SystemScriptContext) => void | Promise<void>> {
	/** 执行顺序（同阶段内越小越早） */
	order: number;
	/** 执行阶段 */
	phase: SystemScriptPhase;

	constructor(
		opts: ScriptOptions<(ctx: SystemScriptContext) => void | Promise<void>> & {
			order: number;
			phase: SystemScriptPhase;
		}
	) {
		super(opts);
		this.order = opts.order;
		this.phase = opts.phase;
	}
}

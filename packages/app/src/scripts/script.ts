import { Page } from 'playwright-core';
import { BaseAutomationEvents, Config, ConfigValueRecord, EventsRecord, TypedEventEmitter } from './interface';

export type RunFunction = (...args: any[]) => any;

export interface ScriptOptions<Run extends RunFunction = RunFunction> {
	name: string;
	run: Run;
	/** 图标 URL（网站地址或图片地址，经本地服务 /icon 代理解析） */
	icon?: string;
}

export abstract class Script<Run extends RunFunction = RunFunction, E extends EventsRecord = EventsRecord>
	extends TypedEventEmitter<E>
	implements ScriptOptions
{
	name: string;
	run: Run;
	icon?: string;

	constructor(opts: ScriptOptions<Run>) {
		super();
		this.name = opts.name;
		this.run = opts.run;
		this.icon = opts.icon;
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

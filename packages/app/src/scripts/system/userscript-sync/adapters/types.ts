import type { Page } from 'playwright-core';

/** 脚本管理器内的脚本条目（name 与软件侧 info.name 匹配） */
export interface ManagerScriptInfo {
	name: string;
	enabled: boolean;
}

/**
 * 脚本管理器管理页适配器：定位器全部来自拆包实测（resources/extensions/*.zip），
 * 随拓展版本更迭维护；拓展升级导致结构变化时以运行时日志告警为准。
 */
export interface ScriptManagerAdapter {
	/** 拓展目录名标识（小写匹配 extensionPath basename） */
	id: 'scriptcat' | 'tampermonkey';
	/** 管理页相对路径（相对拓展根目录） */
	pagePath: string;
	/** 页面打开后的准备钩子（如关闭首次进入的欢迎/导览弹窗，避免阻挡后续操作） */
	preparePage?(page: Page): Promise<void>;
	/** 列出管理器内全部脚本 */
	listScripts(page: Page): Promise<ManagerScriptInfo[]>;
	/** 按名称设置启用/停用（状态一致时不点击） */
	setEnabled(page: Page, name: string, enabled: boolean): Promise<void>;
	/** 按名称删除脚本 */
	remove(page: Page, name: string): Promise<void>;
}

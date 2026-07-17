export type PlusModuleId =
	| 'today'
	| 'browser'
	| 'ai-question'
	| 'question-bank'
	| 'documents'
	| 'tasks'
	| 'model-config'
	| 'settings'
	| 'legacy';

export interface PlusModule {
	id: PlusModuleId;
	path: string;
	title: string;
	icon: string;
	order: number;
	enabled: boolean;
	description: string;
	status?: string;
}

const modules = [
	{
		id: 'today',
		path: '/today',
		title: '今日学习',
		icon: 'home',
		order: 10,
		enabled: true,
		description: '课程、进度、任务和学习概览'
	},
	{
		id: 'browser',
		path: '/browser',
		title: '网课浏览器',
		icon: 'public',
		order: 20,
		enabled: true,
		description: '内置课程浏览器和平台入口',
		status: '框架'
	},
	{
		id: 'ai-question',
		path: '/ai-question',
		title: 'AI 题目助手',
		icon: 'smart_toy',
		order: 30,
		enabled: false,
		description: '完整 AI 识题、模型解析与答题辅助不进入第一阶段 MVP',
		status: 'P2 / 暂未开放'
	},
	{
		id: 'question-bank',
		path: '/question-bank',
		title: '错题本',
		icon: 'disabled_by_default',
		order: 40,
		enabled: false,
		description: '题库缓存、错题整理和 ZError 深度接入属于后续规划',
		status: 'P2 / 暂未开放'
	},
	{
		id: 'documents',
		path: '/documents',
		title: '资料库',
		icon: 'folder',
		order: 50,
		enabled: false,
		description: '课件、PDF、笔记和资料摘要暂未接入真实数据来源',
		status: 'P2 / 暂未开放'
	},
	{
		id: 'tasks',
		path: '/tasks',
		title: '任务提醒',
		icon: 'event_available',
		order: 60,
		enabled: false,
		description: '完整任务系统暂未开放，MVP 仅保留首页基础状态提示',
		status: 'P2 / 开发中'
	},
	{
		id: 'model-config',
		path: '/model-config',
		title: '模型配置',
		icon: 'dns',
		order: 70,
		enabled: false,
		description: 'AI 平台、API Key、模型测试和额度管理不进入第一阶段 MVP',
		status: 'P2 / 暂未开放'
	},
	{
		id: 'settings',
		path: '/settings',
		title: '设置中心',
		icon: 'settings',
		order: 80,
		enabled: true,
		description: '应用偏好、浏览器路径、同步和高级选项'
	},
	{
		id: 'legacy',
		path: '/legacy',
		title: '高级/原版',
		icon: 'tune',
		order: 90,
		enabled: true,
		description: '原 OCS 浏览器、脚本、资源、监控和设置入口'
	}
] satisfies PlusModule[];

export const plusModules: PlusModule[] = modules.sort((a, b) => a.order - b.order);

export const enabledPlusModules = plusModules.filter((module) => module.enabled && module.id !== 'legacy');

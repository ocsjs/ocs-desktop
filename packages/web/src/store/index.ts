import { reactive } from 'vue';
import { remote } from '../utils/remote';
import defaultsDeep from 'lodash/defaultsDeep';
import type { AppStore, UserScripts } from '@ocs-desktop/common/web';
import { CommonUserScript } from '../types/user.script';
import { FolderOptions } from '../fs/interface';
import { Browser } from '../fs/browser';
import { Folder } from '../fs/folder';

export type StoreUserScript = { info?: CommonUserScript } & Omit<UserScripts, 'info'>;

export type WebStore = {
	scripts: StoreUserScript[];
	notifies: any[];

	browser: {
		currentFolderUid: string;
		currentBrowserUid: string;
		/** 根目录 */
		root: FolderOptions<'root', Browser | Folder>;
		tags: Record<string, { color: string; count: number }>;
		search: {
			/** 名字或者备注搜素 */
			value: string;
			tags: string[];
		};
	};
	dashboard: {
		/** 显示标签和备注 */
		details: {
			tags: boolean;
			notes: boolean;
		};
		/** 列数控制 */
		num: number;
	};
	setting: {
		browserType: 'diy' | 'local' | 'setup';
		/** 界面模式：简洁模式 / 专业模式 */
		mode: 'simple' | 'professional';
		/** 是否显示侧边栏文字 */
		showSideBarText: boolean;
		/** 简洁模式卡片布局列数 */
		simpleCardColumns: 1 | 2 | 3 | 4;
		/** 浏览器启动参数 */
		launchOptions: {
			custom: boolean;
			executablePath: string;
		};
		/** 当前的主题 */
		theme: {
			/** 主题模式：light 白天 / dark 夜间 / auto 跟随系统 */
			mode: 'light' | 'dark' | 'auto';
			/** 主题颜色：blue 默认蓝（对应 theme.less 中 body[theme-color='xxx'] 预设） */
			color: 'blue' | 'purple' | 'orange' | 'green' | 'cyan';
		};
		/** ocs 特殊配置 */
		ocs: {
			/** 当前配置名 */
			currentProjectName: string;
			/** 全局配置 */
			store: any;
			/** 是否同步OCS配置 */
			openSync: boolean;
		};
		browser: {
			/** 浏览器缓存大小预警阈值（GB） */
			cachesSizeWarningPoint: number;
			/** 是否启用浏览器原版对话框 */
			enableDialog: boolean;
			/** 是否强制更新/安装脚本 */
			forceUpdateScript: boolean;
			/** 点击「新建浏览器」时是否自动打开初始化弹窗并执行初始化 */
			autoInitNewBrowser: boolean;
			/** 是否在浏览器卡片/监控页面中显示运行时界面预览（Page.startScreencast 推流） */
			screenshotPreview: boolean;
			/** 预览帧率档位：high(~30fps) / medium(~15fps) / low(~6fps) */
			screenshotFramerate: 'high' | 'medium' | 'low';
			/** 预览画质档位：控制分辨率与 jpeg 质量，high / medium / low */
			screenshotQuality: 'high' | 'medium' | 'low';
			/** 浏览器增强（防休眠/防冻结）：启动时附加防节流参数并注入静音音频豁免，仅对新启动的浏览器生效 */
			browserEnhancement: boolean;
			/** 导航页设置 */
			bookmarkPage: {
				/** 是否启用自定义导航页（关闭后不更改浏览器新建页面，显示默认空白导航页） */
				enable: boolean;
				/** 是否启用导航页搜索引擎功能 */
				enableSearch: boolean;
				/** 是否启用导航页快捷平台访问 */
				enableQuickAccess: boolean;
				/** 自定义网站列表（加载在快捷访问上方） */
				customSites: { name: string; url: string }[];
			};
		};
	};

	langs: Record<string, string>;
	state: {
		/** 是否展示初始化设置  */
		setup: boolean;
		/** 是否展示「欢迎使用」引导弹窗（首次进入且需要初始化时显示，点击「开始初始化」后关闭） */
		welcome: boolean;
		/** 是否展示「新建浏览器自动初始化」弹窗 */
		newBrowserSetup: boolean;
		mini: boolean;
		responsive: 'mini' | 'small';
		height: number;
		/** 已读的提示记录 */
		read_record: {
			user_script_usage: boolean;
			browser_usage: boolean;
			automation_script_usage: boolean;
			/** 应用设置-使用提示：折叠状态 */
			resources_usage: boolean;
			/** 监控列表的-使用提示：折叠状态 */
			dashboard_usage: boolean;
		};
		/** 新手使用指引完成记录（达成一次即永久标记） */
		guide: {
			/** 步骤1：软件设置/浏览器环境就绪 */
			init: boolean;
			/** 步骤2：成功启动浏览器 */
			launch: boolean;
		};
	};
};

/** 渲染进程数据的默认值。用于：
 * 1) 首次加载时与磁盘 store 做 defaultsDeep 合并；
 * 2) 解密后的 render 对象再做一次 defaultsDeep，补齐后续版本新增的字段（如 state.guide）。
 *    必须复用同一份，避免新增字段时漏补导致渲染端读取 undefined。 */
export const DEFAULT_RENDER = {
	scripts: [],
	notifies: [],
	browser: {
		currentFolderUid: '',
		currentBrowserUid: '',
		root: {
			name: '根目录',
			parent: undefined,
			createTime: Date.now(),
			type: 'root',
			uid: 'root-folder',
			children: {},
			renaming: false
		},
		tags: {},
		search: {
			value: '',
			tags: [],
			results: undefined
		}
	},
	dashboard: {
		details: {
			tags: false,
			notes: false
		},
		num: 4
	},
	setting: {
		browserType: 'diy',
		mode: 'simple' as const,
		showSideBarText: true,
		simpleCardColumns: 2 as const,
		launchOptions: {
			custom: false,
			executablePath: ''
		},
		theme: {
			mode: 'auto' as const,
			color: 'blue' as const
		},
		ocs: {
			currentProjectName: '',
			store: {},
			openSync: false
		},
		browser: {
			cachesSizeWarningPoint: 10,
			enableDialog: false,
			forceUpdateScript: false,
			autoInitNewBrowser: true,
			screenshotPreview: true,
			screenshotFramerate: 'low' as const,
			screenshotQuality: 'medium' as const,
			browserEnhancement: false,
			bookmarkPage: {
				enable: true,
				enableSearch: true,
				enableQuickAccess: true,
				customSites: []
			}
		}
	},
	langs: {},
	state: {
		first: true,
		setup: true,
		welcome: true,
		newBrowserSetup: false,
		mini: false,
		responsive: 'small',
		height: document.documentElement.clientHeight,
		read_record: {
			user_script_usage: false,
			browser_usage: false,
			automation_script_usage: false,
			resources_usage: false,
			dashboard_usage: false
		},
		guide: {
			init: false,
			launch: false
		}
	}
} as WebStore;

const _store: AppStore & { render: WebStore } = defaultsDeep(remote['electron-store'].get('store'), {
	render: DEFAULT_RENDER,
	// 补齐主进程 window 配置中可能缺失的字段（旧版本用户未触发版本迁移时），后台运行默认关闭
	window: { hideToTrayOnClose: false },
	// 补齐更新/调试配置（旧版本用户的磁盘 store 无此字段）
	updater: { feedUrl: '', infosUrl: '', allowDowngrade: false, chromeSource: '' }
});

// 解密数据（兼容新旧加密格式）
// @ts-ignore - render 在磁盘上可能是加密后的字符串
if (typeof _store.render === 'string') {
	try {
		console.log('_store', _store);
		// @ts-ignore
		const renderStr = _store.render as string;
		const data = JSON.parse(remote.methods.callSync('decryptRenderString' as any, renderStr));
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			// 迁移：旧版 screenshotQuality 语义为帧率，拆分为 screenshotFramerate(帧率) + screenshotQuality(画质)
			const _oldBrowser = data?.setting?.browser;
			if (_oldBrowser && !('screenshotFramerate' in _oldBrowser) && 'screenshotQuality' in _oldBrowser) {
				_oldBrowser.screenshotFramerate = _oldBrowser.screenshotQuality;
				_oldBrowser.screenshotQuality = 'medium';
			}
			// 解密后的 render 是历史持久化对象，可能缺少后续版本新增的字段，
			// 再次与默认值合并以补齐（如 state.guide），避免渲染端读取 undefined。
			Reflect.set(_store, 'render', defaultsDeep(data, DEFAULT_RENDER));
		} else {
			// 解密结果不是对象（历史重复加密等数据损坏场景，主进程已尝试逐层恢复）。
			// 字符串会让 defaultsDeep 产出装箱 String，Vue 对其响应式追踪失效（界面点击无反应），
			// 因此必须回退为全新默认对象，保证 render 永远是普通对象。
			console.error('渲染进程数据损坏（解密结果非对象），已重置为默认设置');
			Reflect.set(_store, 'render', defaultsDeep({}, DEFAULT_RENDER));
		}
	} catch (e) {
		// 解密失败同样必须回退为默认对象，绝不能让 render 残留为字符串
		console.error('数据解密失败：' + e);
		Reflect.set(_store, 'render', defaultsDeep({}, DEFAULT_RENDER));
	}
}

// 迁移：旧版 theme.dark(boolean) -> theme.mode('light'|'dark'|'auto')
// defaultsDeep 已补齐 mode:'auto'，此处根据旧 dark 值修正：dark:true -> 'dark'，dark:false -> 'auto'
const _theme = _store.render?.setting?.theme as { dark?: boolean; mode?: 'light' | 'dark' | 'auto' } | undefined;
if (_theme && _theme.dark !== undefined) {
	_theme.mode = _theme.dark ? 'dark' : 'auto';
	delete _theme.dark;
}

/** 数据存储对象 */
export const store: AppStore & { render: WebStore } = reactive(_store);

/**
 * 开发者会话状态（非持久化）：独立于 store，不经过 saveStore 写入 config.json，
 * 因此软件重启后自动恢复默认值。用于「开发者设置」卡片的显隐控制
 * （左上角「工具 → 开发者工具」点击后置为 true）。
 */
export const devSession = reactive({
	/** 是否显示设置页的「开发者设置」卡片 */
	enabled: false
});

console.log('store', store);
// @ts-ignore
window.store = store;

/** 根目录 */
export const files = reactive<File[]>([]);

/** 打开的文件 */
export const openedFiles = reactive(new Map<string, File>());

export function t(key: string, def?: string, params?: Record<string, any>) {
	let text = store.render.langs[key];
	if (!text) {
		text = def || '';
	}
	if (params) {
		Object.keys(params).forEach((k) => {
			text = text.replace(new RegExp(`{{${k}}}`, 'g'), params[k]);
		});
	}
	return text;
}

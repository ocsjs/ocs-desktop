import { reactive } from 'vue';
import { remote } from '../utils/remote';
import defaultsDeep from 'lodash/defaultsDeep';
import { AppStore, UserScripts } from '@ocs-desktop/app';
import { CommonUserScript } from '../types/user.script';
import { FolderOptions } from '../fs/interface';
import { Browser } from '../fs/browser';
import { Folder } from '../fs/folder';
import { inBrowser } from '../utils/node';

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
		/** 视频设置 */
		video: {
			/** 横纵比 */
			aspectRatio?: number;
			/** 帧率 */
			frameRate?: number;
		};
	};
	setting: {
		browserType: 'diy' | 'local' | 'setup';
		/** 浏览器启动参数 */
		launchOptions: {
			executablePath: string;
		};
		/** 显示侧边栏文字 */
		showSideBarText: boolean;
		/** 当前的主题 */
		theme: {
			dark: boolean;
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
		};
	};
	state: {
		/** 是否第一次打开 */
		first: boolean;
		/** 是否展示一键安装  */
		setup: boolean;
		mini: boolean;
		responsive: 'mini' | 'small';
		height: number;
	};
};

const _store: AppStore & { render: WebStore } = defaultsDeep(
	inBrowser ? JSON.parse(localStorage.getItem('ocs-app-store') || '{}') : remote['electron-store'].get('store'),
	{
		render: {
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
				num: 4,
				video: {
					aspectRatio: 0,
					frameRate: 0.1
				}
			},
			setting: {
				browserType: 'diy',
				showSideBarText: true,
				launchOptions: {
					executablePath: ''
				},
				theme: {
					dark: false
				},
				ocs: {
					currentProjectName: '',
					store: {},
					openSync: false
				},
				browser: {
					cachesSizeWarningPoint: 10,
					enableDialog: false
				}
			},
			state: {
				first: true,
				setup: true,
				mini: false,
				responsive: 'small',
				height: document.documentElement.clientHeight
			}
		} as WebStore
	}
);

try {
	JSON.parse(JSON.stringify(_store.render));
} catch (e) {
	try {
		const data = JSON.parse(
			await remote.methods.call(
				'decryptString',
				// @ts-ignore
				_store.render
			)
		);
		// 解密
		Reflect.set(_store, 'render', data);
	} catch (e) {
		console.error(e);
	}
}

/** 数据存储对象 */
export const store: AppStore & { render: WebStore } = reactive(_store);

console.log('store', store);
// @ts-ignore
window.store = store;

/** 根目录 */
export const files = reactive<File[]>([]);

/** 打开的文件 */
export const openedFiles = reactive(new Map<string, File>());

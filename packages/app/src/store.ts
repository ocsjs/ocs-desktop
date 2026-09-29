import { app } from 'electron';
import path from 'path';
import Store from 'electron-store';
import type { AppStore } from '@ocs-desktop/common';
import { getDecryptedRenderData } from './crypto';

// IO操作只能在 app.getPath('userData') 下进行，否则会有权限问题。

export const OriginalAppStore: AppStore = {
	name: app.getName(),
	version: app.getVersion(),
	/** 路径数据 */
	paths: {
		'app-path': app.getAppPath(),
		'user-data-path': app.getPath('userData'),
		'exe-path': app.getPath('exe'),
		'logs-path': app.getPath('logs'),
		'config-path': path.resolve(app.getPath('userData'), './config.json'),
		/** 浏览器用户数据文件夹 */
		userDataDirsFolder: '',
		/** 浏览器下载文件夹 */
		downloadFolder: path.resolve(app.getPath('userData'), './downloads'),
		/** 加载拓展路径 */
		extensionsFolder: path.resolve(app.getPath('userData'), './downloads/extensions')
	},
	/** 窗口设置 */
	window: {
		/** 开机自启 */
		alwaysOnTop: false,
		autoLaunch: false,
		/** 后台运行：关闭窗口时自动隐藏到系统托盘，浏览器保持运行（默认关闭） */
		hideToTrayOnClose: false
	},
	/** 本地服务器数据 */
	server: {
		port: 15319,
		authToken: ''
	},
	/** 更新设置（测试/调试用途，正式用户留空即为线上默认） */
	updater: {
		/** 自定义更新源目录（latest.yml 所在 URL），留空使用构建时 publish.url 默认源 */
		feedUrl: '',
		/** 自定义软件信息接口 URL（更新日志来源），留空使用默认 ocs-app-infos.json */
		infosUrl: '',
		/** 允许降级/同版本覆盖安装（重复测试用） */
		allowDowngrade: false,
		/** 强制指定内置浏览器下载源（'' 默认按优先级降级） */
		chromeSource: ''
	},
	/** 脚本资源覆盖（开发者设置-脚本调试，留空使用默认线上地址） */
	scriptResources: {
		/** OCS index 脚本地址 */
		index: '',
		/** EasyUs 脚本地址 */
		easyUs: ''
	},
	/** 渲染进程数据 */
	render: {} as { [x: string]: any }
};

/**
 * - electron 本地存储对象
 * - 可以使用 store.store 访问
 * - 设置数据请使用 store.set('key', value)
 */
export const store = new Store<typeof OriginalAppStore>();

/**
 * 获取解密后的渲染进程数据
 */
export { getDecryptedRenderData };

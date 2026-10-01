import { app } from 'electron';
import path from 'path';
import { existsSync, readFileSync, copyFileSync } from 'fs';
import Store from 'electron-store';
import { coerce, valid, lt } from 'semver';
import type { AppStore } from '@ocs-desktop/common';
import { getDecryptedRenderData } from './crypto';
import { Logger } from './logger';

const logger = Logger('store');

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
 * 低版本（< 3.0）配置文件备份
 *
 * 背景：3.0 引入 keytar + AES 加密迁移（旧版为 safeStorage 纯 base64），
 * 迁移/解密一旦异常可能污染 config.json，需要保留迁移前的原始配置用于恢复。
 *
 * 时机约束：必须在 new Store()（electron-store 实例化即首次读取 config.json）
 * 以及 initAesKey / initStore 等全部配置读取、写入之前执行，保证 .bak 是
 * 未经 3.0 加密迁移触碰的原始状态。
 *
 * - 仅当 config.json 记录的版本低于 3.0.0（或版本缺失/无法解析，视为旧配置）时备份
 * - .bak 已存在则跳过：确保备份永远是首次遇到的迁移前原始配置，
 *   即使迁移中途损坏、下次启动仍检测到 < 3.0，也不会用损坏数据反向覆盖备份
 */
function backupPreV3Config() {
	// 与 electron-store 默认落盘位置一致
	const configPath = path.resolve(app.getPath('userData'), './config.json');
	const backupPath = configPath + '.bak';

	try {
		if (!existsSync(configPath)) return;
		if (existsSync(backupPath)) return;

		let version: string | null = null;
		try {
			const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
			const rawVersion = (raw as { version?: unknown })?.version;
			if (typeof rawVersion === 'string') {
				version = valid(coerce(rawVersion));
			}
		} catch {
			// JSON 解析失败：同样视为旧配置，保留原始文件以便人工恢复
		}

		// 版本可解析且不低于 3.0.0，说明已完成迁移，无需备份
		if (version && !lt(version, '3.0.0')) return;

		copyFileSync(configPath, backupPath);
		logger.info(`检测到低版本（${version || '未知'}）配置文件，已备份至 ${backupPath}`);
	} catch (e) {
		// 备份失败不阻断启动
		logger.warn('低版本配置备份失败', e);
	}
}

// ⚠️ 备份必须先于 new Store()：实例化即触发 config.json 首次读取
backupPreV3Config();

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

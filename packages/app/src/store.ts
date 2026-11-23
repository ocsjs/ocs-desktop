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
		/** @deprecated 安全加固后令牌改内存态持有（见 tasks/server.auth.ts），此字段恒为空，仅为兼容旧配置保留 */
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
		chromeSource: '',
		/** 手动 HTTP 代理（留空走系统代理自动检测） */
		proxyUrl: ''
	},
	/** 脚本资源覆盖（开发者设置-脚本调试，留空使用默认线上地址） */
	scriptResources: {
		/** OCS index 脚本地址 */
		index: ''
	},
	/** 渲染进程数据 */
	render: {} as { [x: string]: any }
};

/**
 * 低版本（< 3.0）配置文件备份
 *
 * 背景：3.0 引入 AES 加密迁移（旧版为 safeStorage 纯 base64；3.x 后续版本
 * 演进为信封加密：自管理主密钥 + safeStorage 包裹，见 crypto.ts），
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
 * electron 本地存储实例（内部实现细节，不导出）。
 * 外部一律经 StoreData 工具对象访问（见下）。
 */
const store = new Store<typeof OriginalAppStore>();

/**
 * store 数据访问工具库（store 的唯一公开入口）。
 *
 * 为什么不允许直接导出 store 实例：conf@10 的 `.store` getter 每次调用都
 * readFileSync + JSON.parse 重新反序列化——对返回值做属性赋值改的是一次性副本
 * （写入静默丢失），且每次访问都读盘。统一收口到本对象的三类操作：
 * - get()：整树读取（进程内缓存，任何写入自动失效）
 * - set()：点路径写入（唯一推荐写入入口）
 * - invalidateCache()：手动失效（绕过 set 的写入兜底）
 */
let storeDataCache: typeof OriginalAppStore | undefined;

/** 任何写入（set/顶层 setter）后使整树缓存失效 */
store.onDidAnyChange?.(() => {
	storeDataCache = undefined;
});

export const StoreData = {
	/** 整树读取（进程内缓存，写入即失效；消除 conf getter 每次读盘的开销） */
	get(): typeof OriginalAppStore {
		if (!storeDataCache) {
			storeDataCache = store.store;
		}
		return storeDataCache;
	},
	/** 点路径写入（如 set('paths.downloadFolder', x)） */
	set(key: string, value: unknown): void {
		store.set(key, value);
	},
	/** 整树替换（仅初始化/迁移/IPC 全量写回使用） */
	replaceAll(value: typeof OriginalAppStore): void {
		store.store = value;
		StoreData.invalidateCache();
	},
	/** 手动失效缓存（对绕过 set/replaceAll 的写入兜底） */
	invalidateCache(): void {
		storeDataCache = undefined;
	},
	/** 订阅指定顶层键变化（如托盘同步监听 window 键） */
	onDidChange(key: string, callback: () => void): void {
		(store as any).onDidChange?.(key, callback);
	}
} as const;

/**
 * 获取解密后的渲染进程数据
 */
export { getDecryptedRenderData };

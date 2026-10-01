// @ts-check

import { app, dialog } from 'electron';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { OriginalAppStore, store } from '../store';
import { valid, coerce, clean, gt, SemVer } from 'semver';
import defaultsDeep from 'lodash/defaultsDeep';
import { Logger } from '../logger';
import path from 'path';

const logger = Logger('store-init');

/**
 * 初始化配置
 */
export function initStore() {
	const version = store.store.version;
	logger.log('version', version);

	if (typeof version === 'string') {
		// 当前app版本
		const appVersion = parseVersion(app.getVersion());
		// 本地存储的app版本
		const originVersion = parseVersion(version);
		// 是否需要更新设置
		if (gt(appVersion, originVersion)) {
			store.store = defaultsDeep(store.store, OriginalAppStore);
		}
	}
	//  初始化
	else {
		const render = store.store.render ? JSON.parse(JSON.stringify(store.store.render)) : {};
		OriginalAppStore.render = render;
		// 初始化设置
		store.store = OriginalAppStore;

		logger.log('store', store.store);
	}

	// 同步存储版本号为当前应用版本：
	// 上面的 defaultsDeep 只补缺不覆盖，version 会永远停留在首次写入的旧值，
	// 导致 config.json 与「设置-更新设置-当前版本」显示历史版本号
	store.set('version', app.getVersion());

	/**
	 * 如果浏览器缓存为空，则初始化，如果不为空那就是用户自己设置了
	 */
	if (!store.store.paths.userDataDirsFolder) {
		OriginalAppStore.paths.userDataDirsFolder = path.resolve(app.getPath('userData'), './userDataDirs');
	} else {
		OriginalAppStore.paths.userDataDirsFolder = store.store.paths.userDataDirsFolder;
	}

	/**
	 * 目录可写性保障：自定义目录不可写（如无权限的系统目录）时回退到 userData 下
	 * 默认目录并弹框提示，避免异常穿透启动流程导致软件无法启动。
	 */
	OriginalAppStore.paths.userDataDirsFolder = ensureWritableDir(
		OriginalAppStore.paths.userDataDirsFolder,
		'浏览器缓存',
		path.resolve(app.getPath('userData'), './userDataDirs')
	);
	ensureWritableDir(OriginalAppStore.paths.downloadFolder, '文件下载', OriginalAppStore.paths.downloadFolder);
	ensureWritableDir(OriginalAppStore.paths.extensionsFolder, '拓展', OriginalAppStore.paths.extensionsFolder);

	// 强制更新路径
	store.set('paths', OriginalAppStore.paths);
}

/**
 * 确保目录存在且可写：不可写时回退到 fallback 目录并弹框提示用户。
 * 探测方式：创建后立即删除一个临时文件（mkdirSync 成功不代表可写，如只读挂载/权限变更）。
 *
 * @returns 实际生效的目录路径（保证可写，或已尽力回退）
 */
function ensureWritableDir(targetPath: string, label: string, fallbackPath: string): string {
	try {
		if (!existsSync(targetPath)) {
			mkdirSync(targetPath, { recursive: true });
		}
		const probe = path.join(targetPath, `.ocs-write-test-${Date.now()}`);
		writeFileSync(probe, '');
		rmSync(probe, { force: true });
		return targetPath;
	} catch (e) {
		logger.error(`${label}目录不可写，已回退到默认目录`, { targetPath, error: String(e) });
		// showErrorBox 可在 app ready 前安全调用，专用于启动早期错误上报
		dialog.showErrorBox(
			`${label}目录没有写入权限`,
			`目录：${targetPath}\n\n软件已将该目录重置为默认位置：\n${fallbackPath}\n\n如需自定义，请在「设置-软件路径」中选择当前用户有写入权限的目录（如用户主目录下的文件夹）。`
		);
		try {
			if (!existsSync(fallbackPath)) {
				mkdirSync(fallbackPath, { recursive: true });
			}
		} catch (fallbackError) {
			// userData 默认目录理论上必定可写；兜底防止异常再次穿透启动流程
			logger.error(`${label}默认目录创建失败`, { fallbackPath, error: String(fallbackError) });
		}
		return fallbackPath;
	}
}

/** 字符串转换成版本对象 */
function parseVersion(version: string) {
	return new SemVer(valid(coerce(clean(version, { loose: true }))) || '0.0.0');
}

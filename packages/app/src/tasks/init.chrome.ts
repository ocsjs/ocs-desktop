import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { sleep, unzip } from '../utils';
import { Logger } from '../logger';
import { glob } from 'glob';
import child_process from 'child_process';
import { getBuiltinChromeRoot } from '@ocs-desktop/common';
import { store } from '../store';

const logger = Logger('chrome-init');

export async function initChrome(win: BrowserWindow): Promise<boolean> {
	try {
		// chrome.zip 来源：打包模式 resources/bin/chrome，开发模式 项目根 bin/chrome/<platform>-<arch>
		const chromeResourcePath = getBuiltinChromeRoot();
		// 解压目标：userData 下可写目录（AppImage 的 /tmp/.mount_* 只读，无法直接写入）
		const chromeRuntimePath = path.join(app.getPath('userData'), 'bin', 'chrome');
		const chromeZipPath = path.join(chromeResourcePath, 'chrome.zip');
		const chromeTempPath = path.join(chromeRuntimePath, 'chrome_temp');

		if (!fs.existsSync(chromeZipPath)) {
			logger.error(`内置浏览器压缩包不存在: ${chromeZipPath}`);
			return false;
		}

		const chrome_filename =
			process.platform === 'win32'
				? 'chrome.exe'
				: process.platform === 'linux'
				? 'chrome'
				: 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

		const chromeFinalPath = path.join(chromeRuntimePath, 'chrome', chrome_filename);
		if (fs.existsSync(chromeFinalPath)) {
			ensureChromeExecutablePermission(chromeFinalPath);
			migrateLegacyBuiltinBrowserPath(chromeFinalPath);
			logger.log(`内置浏览器已存在，无需初始化`);
			return false;
		}

		fs.mkdirSync(chromeRuntimePath, { recursive: true });

		const ab = new AbortController();
		dialog.showMessageBox(win, {
			title: app.name,
			message: '正在初始化资源...，请稍等',
			type: 'info',
			noLink: true,
			signal: ab.signal
		});
		try {
			if (process.platform === 'darwin') {
				child_process.execSync('unzip -o "' + chromeZipPath + '" -d "' + chromeTempPath + '"');
			} else {
				await unzip(chromeZipPath, chromeTempPath);
			}
			const searchPattern =
				process.platform === 'darwin' ? '**/*/' + 'Google Chrome for Testing.app' : '**/*/' + chrome_filename;

			const chrome_file = await glob(searchPattern, {
				nodir: process.platform !== 'darwin',
				absolute: true,
				cwd: chromeTempPath
			});
			logger.log('chrome_file', chrome_file);
			if (!chrome_file || chrome_file.length === 0) {
				throw new Error('浏览器压缩包数据错误');
			}
			fs.renameSync(path.dirname(chrome_file[0]), path.join(chromeRuntimePath, 'chrome'));
			fs.rmSync(chromeTempPath, { recursive: true, force: true });

			ensureChromeExecutablePermission(chromeFinalPath);
			migrateLegacyBuiltinBrowserPath(chromeFinalPath);

			dialog.showMessageBox(win, {
				title: app.name,
				message: '内置浏览器初始化完成，即将重启...',
				type: 'info',
				noLink: true
			});
			await sleep(1000);
			if (process.platform === 'linux' && process.env.APPIMAGE) {
				app.relaunch({
					execPath: process.env.APPIMAGE,
					args: process.argv.slice(1)
				});
			} else {
				app.relaunch();
			}
			app.quit();
			return true;
		} catch (e) {
			logger.error('初始化谷歌浏览器失败', e);
			dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
			return false;
		} finally {
			ab.abort();
		}
	} catch (e) {
		logger.error('初始化谷歌浏览器失败', e);
		dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
		return false;
	}
}

function ensureChromeExecutablePermission(chromeFinalPath: string) {
	if (process.platform !== 'linux' && process.platform !== 'darwin') {
		return;
	}

	const executablePaths = [chromeFinalPath];
	if (process.platform === 'linux') {
		const chromeDir = path.dirname(chromeFinalPath);
		executablePaths.push(path.join(chromeDir, 'chrome_crashpad_handler'));
		executablePaths.push(path.join(chromeDir, 'chrome-sandbox'));
		executablePaths.push(path.join(chromeDir, 'chrome-wrapper'));
	}

	for (const executablePath of executablePaths) {
		if (!fs.existsSync(executablePath)) continue;
		try {
			fs.chmodSync(executablePath, 0o755);
		} catch (e) {
			logger.error('chmod chrome executable failed', { executablePath, error: String(e) });
		}
	}
}

function migrateLegacyBuiltinBrowserPath(chromeFinalPath: string) {
	try {
		const render = store.store.render;
		if (!render || typeof render !== 'object') {
			return;
		}

		const currentPath = render?.setting?.launchOptions?.executablePath;
		const legacyChromeRoot = path.join(process.resourcesPath, 'bin', 'chrome');
		if (typeof currentPath === 'string' && currentPath.startsWith(legacyChromeRoot) && fs.existsSync(chromeFinalPath)) {
			render.setting.launchOptions.executablePath = chromeFinalPath;
			store.set('render', render);
			logger.log('migrate builtin browser path', { from: currentPath, to: chromeFinalPath });
		}
	} catch (e) {
		logger.error('迁移内置浏览器路径失败', e);
	}
}

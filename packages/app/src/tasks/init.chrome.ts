import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { unzip } from '../utils';
import { Logger } from '../logger';
import { glob } from 'glob';
const logger = Logger('chrome-init');

export async function initChrome() {
	try {
		// 解压浏览器内核
		const chromePath = path.join(process.resourcesPath, 'bin', 'chrome');
		if (!fs.existsSync(chromePath)) {
			logger.error(`内置浏览器目录不存在: ${chromePath}`);
			return;
		}

		if (fs.existsSync(path.join(chromePath, 'chrome', 'chrome.exe'))) {
			logger.log(`内置浏览器已存在，无需初始化`);
			return;
		}

		const win = new BrowserWindow({ width: 1, height: 1 });
		dialog.showMessageBox(win, {
			title: app.name,
			message: '正在初始化资源...，请稍等',
			type: 'info',
			noLink: true
		});
		try {
			await unzip(path.join(chromePath, 'chrome.zip'), path.join(chromePath, 'chrome_temp'));
			const chrome_file = await glob('**/*/chrome.exe', {
				nodir: true,
				absolute: true,
				cwd: chromePath
			});
			if (!chrome_file || chrome_file.length === 0) {
				throw new Error('浏览器压缩包数据错误');
			}
			fs.renameSync(path.dirname(chrome_file[0]), path.join(chromePath, 'chrome'));
			fs.rmdirSync(path.join(chromePath, 'chrome_temp'), { recursive: true });
			// @ts-ignore
			dialog.showMessageBox(win, {
				title: app.name,
				message: '内置浏览器初始化完成，即将重启...',
				type: 'info',
				noLink: true
			});
			setTimeout(() => {
				app.relaunch();
				app.quit();
			}, 1000);
		} catch (e) {
			logger.error('初始化谷歌浏览器失败', e);
			dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
		} finally {
			win.close();
		}
	} catch (e) {
		logger.error('初始化谷歌浏览器失败', e);
		dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
	}
}

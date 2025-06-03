import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { sleep, unzip } from '../utils';
import { Logger } from '../logger';
import { glob } from 'glob';
const logger = Logger('chrome-init');

export async function initChrome(win: BrowserWindow) {
	try {
		// 解压浏览器内核
		const chromePath = path.join(process.resourcesPath, 'bin', 'chrome');
		if (!fs.existsSync(chromePath)) {
			logger.error(`内置浏览器目录不存在: ${chromePath}`);
			return;
		}

		const chrome_filename =
			process.platform === 'win32'
				? 'chrome.exe'
				: process.platform === 'linux'
				? 'chrome'
				: 'Google Chrome for Testing';

		if (fs.existsSync(path.join(chromePath, 'chrome', chrome_filename))) {
			logger.log(`内置浏览器已存在，无需初始化`);
			return;
		}

		const ab = new AbortController();
		dialog.showMessageBox(win, {
			title: app.name,
			message: '正在初始化资源...，请稍等',
			type: 'info',
			noLink: true,
			signal: ab.signal
		});
		try {
			await unzip(path.join(chromePath, 'chrome.zip'), path.join(chromePath, 'chrome_temp'));
			const chrome_file = await glob('**/*/' + chrome_filename, {
				nodir: true,
				absolute: true,
				cwd: path.join(chromePath, 'chrome_temp')
			});
			if (!chrome_file || chrome_file.length === 0) {
				throw new Error('浏览器压缩包数据错误');
			}
			fs.renameSync(path.dirname(chrome_file[0]), path.join(chromePath, 'chrome'));
			fs.rmdirSync(path.join(chromePath, 'chrome_temp'), { recursive: true });

			dialog.showMessageBox(win, {
				title: app.name,
				message: '内置浏览器初始化完成，即将重启...',
				type: 'info',
				noLink: true
			});
			await sleep(1000);
			app.relaunch();
			app.quit();
		} catch (e) {
			logger.error('初始化谷歌浏览器失败', e);
			dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
		} finally {
			ab.abort();
		}
	} catch (e) {
		logger.error('初始化谷歌浏览器失败', e);
		dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
	}
}

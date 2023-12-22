import { app, dialog, clipboard } from 'electron';
import { lt } from 'semver';
import { Logger } from '../logger';
import AdmZip from 'adm-zip';
import { join } from 'path';
import { downloadFile, getCurrentWebContents, moveWindowToTop } from '../utils';
import { OCSApi, UpdateInformationResource } from '@ocs-desktop/common';
import { writeFileSync, rmSync } from 'fs';

export async function updater() {
	const logger = Logger('updater');
	const infos = await OCSApi.getInfos();

	const versions = infos.versions || [];

	const newVersion = versions.find((version) => lt(app.getVersion(), version.tag));

	logger.info('updater', { versions, newVersion });

	/** 自动更新 */
	if (newVersion) {
		moveWindowToTop();
		getCurrentWebContents().send('detect-new-app-version', newVersion);
	}
}

export async function updateApp(newVersion: UpdateInformationResource) {
	const logger = Logger('update-app');
	const { tag, url } = newVersion;

	const appPath = app.getAppPath();
	/** 日志路径 */
	const logPath = join(appPath, `../update-${tag}.log`);
	/** 安装路径 */
	const dest = join(appPath, `../app-${tag}.zip`);
	/** 解压路径 */
	const unzipDest = join(appPath, './');

	logger.info('path : ' + JSON.stringify({ appPath, logPath, dest, unzipDest }));

	/** 删除app */
	rmSync(unzipDest, { recursive: true, force: true });
	/** 添加日志 */
	writeFileSync(logPath, JSON.stringify(Object.assign(newVersion, { dest, unzipDest }), null, 4));

	logger.info('更新文件 : ' + dest);
	logger.info('解压路径 : ' + unzipDest);
	try {
		/** 下载最新版本 */
		await downloadFile(url, dest, (rate: any, totalLength: any, chunkLength: any) => {
			getCurrentWebContents().send('update-download', rate, totalLength, chunkLength);
		});

		/** 解压缩 */
		const zip = new AdmZip(dest);

		new Promise<void>((resolve) => {
			zip.extractAllTo(unzipDest, true);
			resolve();
		})
			.then(() => {
				// @ts-ignore
				dialog.showMessageBox(null, {
					title: 'OCS更新程序',
					message: '更新完毕，即将重启软件...',
					type: 'warning',
					noLink: true
				});
				setTimeout(() => {
					app.relaunch();
					app.quit();
				}, 1000);
			})
			.catch((err) => logger.error('更新失败', err));
	} catch (e) {
		// @ts-ignore
		const { response } = await dialog.showMessageBox(null, {
			title: 'OCS更新程序',
			message: 'OCS更新失败:\n' + e,
			type: 'error',
			noLink: true,
			defaultId: 1,
			buttons: ['继续使用', '复制错误日志']
		});
		if (response === 1) {
			clipboard.writeText(String(e));
		}
		logger.error('更新失败', e);
	}
}

import { ipcMain, app, dialog, BrowserWindow, desktopCapturer, safeStorage } from 'electron';
import { Logger } from '../logger';
import { autoLaunch } from './auto.launch';
import axios, { AxiosRequestConfig } from 'axios';
import { downloadFile, moveWindowToTop, unzip, zip } from '../utils';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { OCSApi, getValidBrowsers } from '@ocs-desktop/common';
import si from 'systeminformation';
import { store } from '../store';
import { exportExcel } from '../utils/index';
import { readdir, stat } from 'fs/promises';
import { updateApp } from './updater';
import { scripts } from '../scripts';
import { PlaywrightScript } from '../scripts/script';
import { getBrowserMajorVersion } from '../utils/browser';

export type RawPlaywrightScript = Pick<PlaywrightScript, 'configs' | 'name'>;

/**
 * 注册主进程远程通信事件
 * @param name 事件前缀名称
 * @param target 事件目标
 */
function registerRemoteEvent(name: string, target: any) {
	const logger = Logger('remote');
	try {
		ipcMain
			.on(name + '-get', (event, [property]) => {
				try {
					// logger.info({ event: name + '-get', args: [property] });
					event.returnValue = target[property];
				} catch (e) {
					event.returnValue = { error: e };
				}
			})
			.on(name + '-set', (event, [property, value]) => {
				try {
					// logger.info({ event: name + '-set', args: [property, value] });
					event.returnValue = target[property] = value;
				} catch (e) {
					event.returnValue = { error: e };
				}
			})

			/** 异步调用 */
			.on(
				name + '-call',
				async (
					event,
					[
						/** 回调id */
						respondChannel,
						property,
						...args
					]
				) => {
					// logger.info({ event: name + '-call', args });
					try {
						const result = await target[property](...args);
						event.reply(respondChannel, { data: result });
					} catch (e) {
						event.reply(respondChannel, { error: e });
					}
				}
			)

			/** 同步调用 */
			.on(name + '-call-sync', (event, [property, ...args]) => {
				// logger.info({ event: name + '-call-sync', args: [property] });
				try {
					const result = target[property](...args);
					event.returnValue = { data: result };
				} catch (e) {
					event.returnValue = { error: e };
				}
			});
	} catch (err) {
		logger.error(err);
	}
}

let win: BrowserWindow | undefined;

/** 需远程共享的方法 */
const methods = {
	autoLaunch,
	get: (url: string, config?: AxiosRequestConfig<any> | undefined) => axios.get(url, config).then((res) => res.data),
	post: (url: string, config?: AxiosRequestConfig<any> | undefined) => axios.post(url, config).then((res) => res.data),
	download: (channel: string, url: string, dest: string) => {
		/** 下载文件 */
		return downloadFile(url, dest, (rate: any, totalLength: any, chunkLength: any) => {
			win?.webContents?.send('download', channel, rate, totalLength, chunkLength);
		});
	},
	zip: zip,
	unzip: unzip,
	getValidBrowsers: getValidBrowsers,
	getBrowserMajorVersion: getBrowserMajorVersion,
	systemProcesses: () => si.processes(),
	exportExcel: exportExcel,
	statisticFolderSize: statisticFolderSize,
	getPlatform: () => process.platform,
	updateApp: updateApp,
	moveWindowToTop: moveWindowToTop,
	encryptString: (text: string) => safeStorage.encryptString(text).toString('base64'),
	decryptString: (text: string) => {
		return safeStorage.decryptString(Buffer.from(text, 'base64'));
	},
	isEncryptionAvailable: () => {
		return safeStorage.isEncryptionAvailable();
	},
	getRawScripts: () => JSON.parse(JSON.stringify(scripts)) as RawPlaywrightScript[]
};

/**
 * 初始化远程通信
 */
export function remoteRegister(_win: BrowserWindow) {
	win = _win;
	registerRemoteEvent('electron-store', store);
	registerRemoteEvent('fs', fs);
	registerRemoteEvent('os', os);
	registerRemoteEvent('path', path);
	registerRemoteEvent('crypto', crypto);
	registerRemoteEvent('OCSApi', OCSApi);

	registerRemoteEvent('win', _win);
	registerRemoteEvent('webContents', _win.webContents);
	registerRemoteEvent('app', app);
	registerRemoteEvent('dialog', dialog);
	registerRemoteEvent('methods', methods);
	registerRemoteEvent('logger', Logger('render'));
	registerRemoteEvent('desktopCapturer', desktopCapturer);
}

export type RemoteMethods = typeof methods;

const _registerRemoteEvent = registerRemoteEvent;
export { _registerRemoteEvent as registerRemoteEvent };

async function statisticFolderSize(dir: string) {
	const files = await readdir(dir, { withFileTypes: true });

	const paths: Promise<number>[] = files.map(async (file) => {
		const _path = path.join(dir, file.name);
		if (file.isDirectory()) return await statisticFolderSize(_path);

		if (file.isFile()) {
			const { size } = await stat(_path);
			return size;
		}
		return 0;
	});

	return (await Promise.all(paths)).flat().reduce((i, size) => i + size, 0);
}

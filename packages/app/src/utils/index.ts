import { BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { finished, pipeline } from 'stream/promises';
import { Logger } from '../logger';
import xlsx from 'xlsx';
import unzipper from 'unzipper';
import fs from 'fs';

const taskLogger = Logger('task');
const logger = Logger('utils');

export async function task(name: string, func: any) {
	const time = Date.now();
	const res = await func();
	taskLogger.info(name, ' 耗时:', Date.now() - time);
	return res;
}

/**
 * 下载文件
 */
export async function downloadFile(fileURL: string, outputURL: string, rateHandler: any) {
	logger.info('downloadFile', fileURL, outputURL);

	const { data, headers } = await axios.get(fileURL, {
		responseType: 'stream'
	});
	const totalLength = parseInt(headers['content-length']) || 0;

	let chunkLength = 0;
	data.on('data', (chunk: any) => {
		chunkLength += chunk.length;
		if (totalLength > 0) {
			// clamp 到 0-100，防止 content-length 与实际数据不匹配（如 gzip 解压、分块传输等）
			const rate = Math.min(100, (chunkLength / totalLength) * 100);
			rateHandler(parseFloat(rate.toFixed(2)), totalLength, chunkLength);
		}
	});

	// 创建文件夹
	if (existsSync(path.dirname(outputURL)) === false) {
		mkdirSync(path.dirname(outputURL), { recursive: true });
	}

	const writer = createWriteStream(outputURL);
	data.pipe(writer);
	await finished(writer);
	rateHandler(100, totalLength, chunkLength);

	return outputURL;
}

/**
 * 压缩文件
 */

export function zip(input: string, output: string) {
	return new Promise<void>((resolve, reject) => {
		const zip = new AdmZip();
		zip.addLocalFile(input, './');
		zip.writeZip(output, (err: any) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

/**
 * 解压文件（流式）。
 *
 * 不使用 unzipper.Open.file()：它会将整个压缩包一次性读入内存（fs.readFile），
 * 大文件（如 OCR 识别模块/内置浏览器，数百 MB）解压时会造成主进程内存暴涨、事件循环被占满，
 * 表现为整个软件卡死。流式 Extract 边读边解压，内存占用恒定，不阻塞主进程。
 */
export async function unzip(input: string, output: string) {
	await pipeline(createReadStream(input), unzipper.Extract({ path: output }));
}

export function getProjectPath() {
	/** 这里多退出一层是因为打包后是运行在 ./lib 下面的 */
	return app.isPackaged ? app.getAppPath() : path.resolve('./');
}

/**
 * 导出excel
 */
export function exportExcel(excel: { sheetName: string; list: any[] }[], filename: string) {
	dialog
		.showSaveDialog({
			title: '导出Excel',
			defaultPath: filename
		})
		.then(({ canceled, filePath }) => {
			if (!canceled && filePath) {
				const book = xlsx.utils.book_new();
				for (const item of excel) {
					xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(item.list), item.sheetName);
				}
				xlsx.writeFile(book, filePath);
			}
		});
}

export function moveWindowToTop() {
	const win = BrowserWindow.getAllWindows()[0];
	// 置顶应用
	const onTop = win.isAlwaysOnTop();
	win.setAlwaysOnTop(true);
	win.setAlwaysOnTop(onTop);
	return win;
}

export function getCurrentWebContents() {
	return BrowserWindow.getAllWindows()[0].webContents;
}

export function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(true);
		}, ms);
	});
}

/**
 * Linux 沙箱是否不可用（需要 no-sandbox）。
 *
 * 背景：no-sandbox 会导致 Linux 下 DevTools 渲染进程崩溃（SIGTRAP, exitCode 5，
 * 已用最小对照实验确认），因此仅在沙箱确实无法初始化时才追加：
 * - Ubuntu 23.10+ 通过 AppArmor 禁止非特权 user namespace（kernel.apparmor_restrict_unprivileged_userns=1）
 * - Debian 系默认关闭非特权 userns（kernel.unprivileged_userns_clone=0）
 * 其余环境（如 Ubuntu 20.04）内核支持 userns，沙箱可正常工作，保持开启。
 */
export function isLinuxSandboxUnavailable(): boolean {
	if (process.platform !== 'linux') return false;
	try {
		if (fs.readFileSync('/proc/sys/kernel/apparmor_restrict_unprivileged_userns', 'utf8').trim() === '1') {
			return true;
		}
	} catch {
		// 该 sysctl 不存在（< Ubuntu 23.10），表示无 AppArmor 限制
	}
	try {
		if (fs.readFileSync('/proc/sys/kernel/unprivileged_userns_clone', 'utf8').trim() === '0') {
			return true;
		}
	} catch {
		// 非 Debian 系无此 sysctl
	}
	return false;
}

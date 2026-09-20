import { BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { finished, pipeline } from 'stream/promises';
import { Logger } from '../logger';
import xlsx from 'xlsx';
import unzipper from 'unzipper';

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

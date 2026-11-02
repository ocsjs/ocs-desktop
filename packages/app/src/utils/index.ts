import { BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { Logger } from '../logger';
import { downloadFile as smartDownloadFile } from './download';
import xlsx from 'xlsx';

const taskLogger = Logger('task');

export async function task(name: string, func: any) {
	const time = Date.now();
	const res = await func();
	taskLogger.info(name, ' 耗时:', Date.now() - time);
	return res;
}

/**
 * 下载文件（统一下载器：分块并发 + 断点续传，实现见 utils/download.ts）
 */
export async function downloadFile(fileURL: string, outputURL: string, rateHandler: any) {
	return smartDownloadFile(fileURL, outputURL, { onProgress: rateHandler });
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

// moveDirWithRetry / unzip 已抽离至 electron-free 的 ./unzip（worker 纯 Node 进程共用），此处再导出保持兼容
export { moveDirWithRetry, unzip } from './unzip';

export function getProjectPath() {
	/** 这里多退出一层是因为打包后是运行在 ./lib 下面的 */
	return app.isPackaged ? app.getAppPath() : path.resolve('./');
}

/**
 * 是否 electron-vite dev 开发模式（pnpm dev）。
 * dev 下不能 relaunch + quit：quit 会让 electron-vite 判定应用退出并杀死整个 dev 进程
 * （dev server 随之停止），relaunch 拉起的新实例加载已失效的 dev server 地址，
 * 表现为白屏僵尸窗口（见 init.chrome.ts 的同型处理）。
 */
export function isDevMode() {
	return !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL;
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

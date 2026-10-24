import { BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import AdmZip from 'adm-zip';
import fs, { existsSync, mkdirSync } from 'fs';
import extractZip from 'extract-zip';
import { Logger } from '../logger';
import { downloadFile as smartDownloadFile } from './download';
import xlsx from 'xlsx';

const taskLogger = Logger('task');
const logger = Logger('utils');

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

/**
 * 目录迁移（重试 + 兜底）。
 *
 * Windows 上刚解压的大目录会被 Defender/第三方杀软实时扫描临时占用，
 * 此时 fs.renameSync 抛 EPERM/EBUSY（管理员权限可绕过，故用户提权后偶发"修复"）。
 * 处理策略（与 npm/rimraf 对 Windows 文件锁的处理一致）：
 * 1. 等待目标目录真正消亡（Windows 目录删除是最终一致的）；
 * 2. rename 指数退避重试（最多约 8 次 / ~25s），覆盖杀软扫描窗口；
 * 3. 仍失败则降级为「复制 + 删除源」：读取通常不被扫描锁拦截，可规避 rename 语义限制；
 *    源目录删除失败不视为错误（残留由调用方/下次运行清理）。
 */
export async function moveDirWithRetry(src: string, dest: string): Promise<void> {
	const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EEXIST', 'ENOTEMPTY']);

	// 1) 等待目标目录消亡
	for (let i = 0; i < 20 && existsSync(dest); i++) {
		await sleep(100);
	}

	// 2) rename 退避重试
	let lastErr: any;
	for (let attempt = 0; attempt < 8; attempt++) {
		try {
			fs.renameSync(src, dest);
			return;
		} catch (e: any) {
			lastErr = e;
			if (!RETRY_CODES.has(e?.code)) throw e;
			await sleep(Math.min(200 * 2 ** attempt, 2000));
		}
	}

	// 3) 复制兜底
	logger.warn('rename 持续失败（可能被杀毒软件占用），降级为复制迁移', { src, dest, error: String(lastErr) });
	try {
		// dereference:true：遇到符号链接复制其目标内容，避免 Windows 上创建软链需要提权而再次 EPERM
		fs.cpSync(src, dest, { recursive: true, dereference: true });
	} catch {
		throw new Error(`移动文件失败（可能被杀毒软件拦截，请将 ${dest} 加入白名单后重试）：${String(lastErr)}`);
	}
	try {
		fs.rmSync(src, { recursive: true, force: true });
	} catch (e) {
		logger.warn('清理迁移源目录失败（残留将由下次运行清理）', { src, error: String(e) });
	}
}

/**
 * 解压文件（统一管线，参考主流桌面软件做法：Chrome/electron-updater/VS Code 均为
 * 「暂存解压 → 原子换入 → 失败清理」，不在目标位置就地解压）：
 * 1. 预检：压缩包必须存在且为 zip（PK 魔数）；
 * 2. 暂存：解压到 output 同卷的暂存目录，失败/中断不污染 output（旧版本保持可用）；
 * 3. 解压：extract-zip（yauzl 内核，npm 周下载千万级、puppeteer 依赖）——
 *    恢复符号链接与 unix 执行位、内置 zip-slip 路径校验；
 * 4. 清理 __MACOSX 资源叉垃圾目录；
 * 5. 原子换入：rename（带 Windows 文件锁退避重试/复制兜底），失败清理暂存目录。
 *
 * 已知边界：Windows 创建符号链接需提权/开发者模式，含软链的 zip 在 win32 上会失败——
 * 目前仅 darwin 版资源（OCR 模块）含软链，win/linux 分发包均无软链，不会触发。
 */
export async function unzip(input: string, output: string) {
	if (!existsSync(input)) {
		throw new Error('压缩包不存在：' + input);
	}
	const header = Buffer.alloc(4);
	const fd = fs.openSync(input, 'r');
	try {
		fs.readSync(fd, header, 0, 4, 0);
	} finally {
		fs.closeSync(fd);
	}
	if (header.readUInt16LE(0) !== 0x4b50 /* 'PK' */) {
		throw new Error('文件不是有效的 ZIP 压缩包：' + input);
	}

	// 同卷暂存目录（保证后续 rename 不跨卷）
	const staging = `${output}.extracting-${process.pid}-${Date.now()}`;
	fs.rmSync(staging, { recursive: true, force: true });
	mkdirSync(staging, { recursive: true });

	try {
		await extractZip(input, { dir: path.resolve(staging) });
		// 剥离 macOS 压缩产生的资源叉垃圾目录
		fs.rmSync(path.join(staging, '__MACOSX'), { recursive: true, force: true });
		// 原子换入：先移除旧目录，再 rename（Windows 文件锁重试/复制兜底）
		fs.rmSync(output, { recursive: true, force: true });
		await moveDirWithRetry(staging, output);
	} catch (e) {
		fs.rmSync(staging, { recursive: true, force: true });
		throw e;
	}
}

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

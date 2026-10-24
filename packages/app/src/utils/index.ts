import { BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import AdmZip from 'adm-zip';
import fs, { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { Logger } from '../logger';
import { downloadFile as smartDownloadFile } from './download';
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

/** zip 条目 unix 文件类型位（externalFileAttributes 高 16 位） */
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

/**
 * 读取 zip 中央目录，返回「条目路径 → unix mode」映射。
 *
 * 流式 Parse 只解析本地文件头（无 externalFileAttributes 字段），
 * unix 属性仅存于中央目录；Open.file 按需 range 读取元数据，不整包入内存。
 */
async function readArchiveEntryModes(input: string): Promise<Map<string, number>> {
	const modes = new Map<string, number>();
	try {
		const dir = await unzipper.Open.file(input);
		for (const f of dir.files) {
			const mode = (f.externalFileAttributes >>> 16) & 0xffff;
			if (mode) modes.set(f.path.replace(/\\/g, '/'), mode);
		}
	} catch (e) {
		logger.warn('读取 zip 中央目录失败，跳过 unix 属性还原', { input, error: String(e) });
	}
	return modes;
}

/**
 * 流式解压 zip 到目录：单趟解析、逐条落盘、背压受控、内存恒定。
 *
 * 不使用 unzipper.Extract：其 duplexer2 管道在背压下会丢条目（实测 50 个文件仅落盘 19 个），
 * 且 pipeline() 会在写盘完成前提前 resolve（竞态）。此处基于 unzipper.Parse 逐条处理：
 * - zip-slip 防护：越界条目直接丢弃；
 * - __MACOSX 资源叉垃圾目录跳过；
 * - 符号链接条目（S_IFLNK，内容即目标路径）重建为真实软链，
 *   创建失败（如 Windows 无提权/开发者模式）回退写文本占位（历史兼容行为）；
 * - 非 win32 按原始 mode 还原执行位（unzipper 不恢复 unix 权限）。
 * 全平台统一此实现（含 darwin，替代原系统 unzip 分支）。
 */
async function extractZipStreaming(input: string, dest: string): Promise<void> {
	const destResolved = path.resolve(dest);
	const modes = await readArchiveEntryModes(input);
	const parser = createReadStream(input).pipe(unzipper.Parse({ forceStream: true }));
	for await (const entry of parser) {
		const relPath = String(entry.path).replace(/\\/g, '/');
		const target = path.resolve(dest, relPath);
		// zip-slip 防护：目标必须落在 dest 内
		if (target !== destResolved && !target.startsWith(destResolved + path.sep)) {
			entry.autodrain();
			continue;
		}
		// macOS 压缩产生的资源叉垃圾
		if (relPath === '__MACOSX' || relPath.startsWith('__MACOSX/')) {
			entry.autodrain();
			continue;
		}
		if (entry.type === 'Directory') {
			mkdirSync(target, { recursive: true });
			entry.autodrain();
			continue;
		}

		// 本地头无 unix 属性，查中央目录映射
		const mode = modes.get(relPath) || 0;
		// 符号链接：条目内容即链接目标路径（通常几十字节）
		if ((mode & S_IFMT) === S_IFLNK) {
			mkdirSync(path.dirname(target), { recursive: true });
			const linkTarget = (await entry.buffer()).toString('utf-8');
			fs.rmSync(target, { force: true });
			try {
				fs.symlinkSync(linkTarget, target);
			} catch (e) {
				logger.warn('创建符号链接失败，写入文本占位', { path: target, error: String(e) });
				fs.writeFileSync(target, linkTarget);
			}
			continue;
		}

		mkdirSync(path.dirname(target), { recursive: true });
		await new Promise<void>((resolve, reject) => {
			const writer = createWriteStream(target);
			entry.on('error', reject);
			writer.on('error', reject);
			writer.on('finish', resolve);
			entry.pipe(writer);
		});
		// 还原执行位（如 ocr 可执行文件）
		if (process.platform !== 'win32' && mode & 0o111) {
			try {
				fs.chmodSync(target, mode & 0o777);
			} catch {}
		}
	}
}

/**
 * 解压文件（统一管线，参考主流桌面软件做法：Chrome/electron-updater/VS Code 均为
 * 「暂存解压 → 原子换入 → 失败清理」，不在目标位置就地解压）：
 * 1. 预检：压缩包必须存在且为 zip（PK 魔数）；
 * 2. 暂存：解压到 output 同卷的暂存目录，失败/中断不污染 output（旧版本保持可用）；
 * 3. 平台语义保真：extractZipStreaming 恢复符号链接/执行位、剥离 __MACOSX、防 zip-slip；
 * 4. 原子换入：rename（带 Windows 文件锁退避重试/复制兜底），失败清理暂存目录。
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
		await extractZipStreaming(input, staging);
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

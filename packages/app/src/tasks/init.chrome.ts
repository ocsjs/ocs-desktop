import { app, BrowserWindow, clipboard, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { sleep, unzip } from '../utils';
import { Logger } from '../logger';
import { glob } from 'glob';
import child_process from 'child_process';
import { BUILTIN_CHROME_FILENAME, getBuiltinChromeRoot, getBuiltinChromeRuntimePath } from '@ocs-desktop/common/node';
import { store } from '../store';
import { createLoadingWindow } from '../window';
import { setInitStatus, updateInitLogText } from './init.status';
import { downloadBuiltinChromeZip } from './chrome.downloader';

const logger = Logger('chrome-init');

/**
 * 内置浏览器安装进度回调（阶段 + 可选下载进度）。
 * 供前端 Setup「环境修复」实时展示。
 */
export interface BuiltinChromeInstallProgress {
	phase: 'download' | 'extract' | 'configure';
	/** 下载阶段才有：源名/进度 */
	sourceName?: string;
	sourceIndex?: number;
	sourceCount?: number;
	rate?: number;
	message: string;
}

/**
 * 解压内置浏览器压缩包并完成配置（移动、chmod、旧路径迁移）。
 * initChrome 与远程 installBuiltinChrome 共用此逻辑。
 *
 * @returns 安装完成后的浏览器可执行文件路径
 */
async function extractAndConfigureBuiltinChrome(
	chromeZipPath: string,
	onProgress?: (p: BuiltinChromeInstallProgress) => void
): Promise<string> {
	const chromeRuntimePath = path.join(app.getPath('userData'), 'bin', 'chrome');
	const chromeTempPath = path.join(chromeRuntimePath, 'chrome_temp');
	const chromeFinalPath = getBuiltinChromeRuntimePath();

	onProgress?.({ phase: 'extract', message: '正在解压内置浏览器...' });
	fs.rmSync(chromeTempPath, { recursive: true, force: true });
	if (process.platform === 'darwin') {
		child_process.execSync('unzip -o "' + chromeZipPath + '" -d "' + chromeTempPath + '"');
	} else {
		await unzip(chromeZipPath, chromeTempPath);
	}

	onProgress?.({ phase: 'extract', message: '正在查找浏览器可执行文件...' });
	// darwin 下需匹配 .app 目录（而非可执行文件本身），其余平台匹配可执行文件名
	const searchPattern =
		process.platform === 'darwin' ? '**/*/' + 'Google Chrome for Testing.app' : '**/*/' + BUILTIN_CHROME_FILENAME;
	const chrome_file = await glob(searchPattern, {
		nodir: process.platform !== 'darwin',
		absolute: true,
		cwd: chromeTempPath
	});
	logger.log('chrome_file', chrome_file);
	if (!chrome_file || chrome_file.length === 0) {
		throw new Error('浏览器压缩包数据错误');
	}

	onProgress?.({ phase: 'extract', message: '正在移动浏览器文件...' });
	// 已存在旧目录时先移除，避免 rename 冲突
	fs.rmSync(path.join(chromeRuntimePath, 'chrome'), { recursive: true, force: true });
	fs.renameSync(path.dirname(chrome_file[0]), path.join(chromeRuntimePath, 'chrome'));

	fs.rmSync(chromeTempPath, { recursive: true, force: true });
	// 解压完成后删除 userData 下的压缩包副本以释放磁盘（resources 下的只读压缩包不受影响）
	fs.rmSync(path.join(chromeRuntimePath, 'chrome.zip'), { force: true });

	onProgress?.({ phase: 'configure', message: '正在配置浏览器环境...' });
	ensureChromeExecutablePermission(chromeFinalPath);
	migrateLegacyBuiltinBrowserPath(chromeFinalPath);

	return chromeFinalPath;
}

/**
 * 下载并安装内置浏览器（供前端「环境修复」复用，不重启应用）。
 * 本地压缩包优先（resources 旧版完整包 / userData 残留），缺失时多源降级下载 + SHA256 校验。
 *
 * @returns 安装完成后的浏览器可执行文件路径
 */
export async function installBuiltinChrome(onProgress?: (p: BuiltinChromeInstallProgress) => void): Promise<string> {
	const chromeFinalPath = getBuiltinChromeRuntimePath();
	if (fs.existsSync(chromeFinalPath)) {
		ensureChromeExecutablePermission(chromeFinalPath);
		migrateLegacyBuiltinBrowserPath(chromeFinalPath);
		return chromeFinalPath;
	}

	const chromeResourcePath = getBuiltinChromeRoot();
	const chromeRuntimePath = path.join(app.getPath('userData'), 'bin', 'chrome');
	fs.mkdirSync(chromeRuntimePath, { recursive: true });

	let chromeZipPath = [path.join(chromeResourcePath, 'chrome.zip'), path.join(chromeRuntimePath, 'chrome.zip')].find(
		(p) => fs.existsSync(p)
	);

	if (!chromeZipPath) {
		chromeZipPath = path.join(chromeRuntimePath, 'chrome.zip');
		await downloadBuiltinChromeZip(chromeZipPath, (progress) => {
			onProgress?.({
				phase: 'download',
				sourceName: progress.sourceName,
				sourceIndex: progress.sourceIndex,
				sourceCount: progress.sourceCount,
				rate: progress.rate,
				message:
					`正在下载内置浏览器（${progress.sourceName}，` +
					`第 ${progress.sourceIndex}/${progress.sourceCount} 个下载源）... ${progress.rate}%`
			});
		});
	}

	return extractAndConfigureBuiltinChrome(chromeZipPath, onProgress);
}

export async function initChrome(_win: BrowserWindow): Promise<boolean> {
	try {
		// chrome.zip 来源：打包模式 resources/bin/chrome（旧版完整包），开发模式 项目根 bin/chrome/<platform>-<arch>
		const chromeResourcePath = getBuiltinChromeRoot();
		// 解压目标：userData 下可写目录（AppImage 的 /tmp/.mount_* 只读，无法直接写入）
		const chromeRuntimePath = path.join(app.getPath('userData'), 'bin', 'chrome');

		const chromeFinalPath = getBuiltinChromeRuntimePath();
		if (fs.existsSync(chromeFinalPath)) {
			ensureChromeExecutablePermission(chromeFinalPath);
			migrateLegacyBuiltinBrowserPath(chromeFinalPath);
			logger.log(`内置浏览器已存在，无需初始化`);
			return false;
		}

		fs.mkdirSync(chromeRuntimePath, { recursive: true });

		// 仅在需要解压/下载时才创建并显示透明 loading 闪屏窗口，进度由 /api/init/status 拉取
		const loadingWin = createLoadingWindow();
		loadingWin.once('ready-to-show', () => loadingWin.show());
		setInitStatus({ status: 'loading', message: '正在准备初始化环境...' });
		try {
			// 本地压缩包优先：resources（旧版完整包/开发模式）→ userData（上次下载完成但解压中断的残留，下载时已通过校验）
			let chromeZipPath = [
				path.join(chromeResourcePath, 'chrome.zip'),
				path.join(chromeRuntimePath, 'chrome.zip')
			].find((p) => fs.existsSync(p));

			// 精简版安装包不再内置浏览器压缩包：本地不存在时从远程下载源拉取（三级源自动降级 + SHA256 校验）
			if (!chromeZipPath) {
				chromeZipPath = path.join(chromeRuntimePath, 'chrome.zip');
				setInitStatus({ status: 'loading', message: '正在下载内置浏览器...' });
				try {
					await downloadBuiltinChromeZip(chromeZipPath, (progress) => {
						updateInitLogText(
							`正在下载内置浏览器（${progress.sourceName}，` +
								`第 ${progress.sourceIndex}/${progress.sourceCount} 个下载源）... ${progress.rate}%`
						);
					});
				} catch (e) {
					// 全部下载源失败/网络不可用：引导用户加群联系客服手动获取浏览器文件
					logger.error('内置浏览器下载失败，所有下载源均不可用', e);
					setInitStatus({ status: 'error', message: '内置浏览器下载失败，请检查网络后重启软件重试' });
					// @ts-ignore
					const { response } = await dialog.showMessageBox(null, {
						title: '内置浏览器下载失败',
						message:
							'内置浏览器下载失败，所有下载源均不可用。\n\n' +
							'请检查网络连接后重启软件重试；若仍无法下载，请前往官方网站找到软件交流群并加入，联系管理员。\n\n' +
							'你也可以暂时使用系统中已安装的其他浏览器。',
						detail: String(e),
						type: 'error',
						noLink: true,
						defaultId: 0,
						buttons: ['我知道了', '复制错误信息']
					});
					if (response === 1) {
						clipboard.writeText(String(e));
					}
					return false;
				}
				setInitStatus({ status: 'loading', message: '内置浏览器下载完成' });
			}

			// 解压 + 移动 + 配置（与前端环境修复共用同一套逻辑）
			await extractAndConfigureBuiltinChrome(chromeZipPath, (p) => {
				setInitStatus({ status: 'loading', message: p.message });
			});

			// 开发模式（electron-vite dev）下不能 relaunch + quit：
			// quit 会让 electron-vite 判定应用退出并杀死整个 dev 进程（dev server 随之停止），
			// 而 relaunch 拉起的新实例脱离其进程管理，仍加载已失效的 dev server 地址，
			// 表现为白屏僵尸窗口（渲染进程未加载，close 事件无人响应，只能任务管理器强杀）。
			// 浏览器二进制已就绪，直接继续正常启动流程即可，无需重启。
			if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
				setInitStatus({ status: 'done', message: '内置浏览器初始化完成' });
				return true;
			}

			setInitStatus({ status: 'restart', message: '内置浏览器初始化完成，即将重启...' });
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
			setInitStatus({ status: 'error', message: '初始化谷歌浏览器失败：' + String(e) });
			dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
			return false;
		} finally {
			// 应用即将 quit 时销毁无碍；错误分支也需关闭闪屏
			if (!loadingWin.isDestroyed()) {
				loadingWin.destroy();
			}
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

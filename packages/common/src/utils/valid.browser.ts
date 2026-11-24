import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { ValidBrowser } from '../interface';
import {
	BUILTIN_CHROME_FILENAME,
	getBuiltinChromeRuntimePath,
	getBuiltinChromeRoot,
	getSupermiumRuntimePath
} from './chrome.path';

/**
 * 惰性读取 electron 的 process.resourcesPath。
 * 本模块经 common 的 node-only 入口（./node）仅在主进程使用，但 worker 子进程也会间接
 * 加载 common，故此处不在模块顶层静态 import electron，避免纯 Node 子进程崩溃。
 * 非 Electron 环境（如 worker 误调用）回退 undefined，由调用方过滤。
 */
function getResourcesPath(): string | undefined {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		return (require('electron') as typeof import('electron')).app ? process.resourcesPath : undefined;
	} catch {
		return undefined;
	}
}

/**
 * 获取可用浏览器路径。
 *
 * win32：内置浏览器 + 系统浏览器（Edge/Chrome 常见安装路径）。
 *   Win7 适配（feat/win7-compat）：Win7 无法运行内置 CfT 137（要求 Win10+），
 *   必须探测系统低版本浏览器（Chrome/Edge ≤109）作为主力，版本过滤由调用方按
 *   SUPPORTED_BROWSER_MAX_MAJOR(_WIN7) 阈值完成。
 * 其他平台：仅返回软件内置浏览器（版本不可控，拓展/脚本兼容性无法保证）。
 */
export function getValidBrowsers(): ValidBrowser[] {
	/** 内置浏览器（darwin/linux 同样解压到 userData，见 chrome.path.ts）。
	 *  注意：Win7 无内置浏览器（init.chrome.ts 整体跳过），此处仅作历史残留路径的兜底探测，
	 *  残留的 CfT 137/Supermium 会被调用方的 ≤109 版本阈值过滤 */
	const builtin = [
		{
			name: '软件内置浏览器-谷歌(Chrome)',
			path: resolveBuiltinBrowserPath()
		}
	].filter((b) => b.path) as ValidBrowser[];

	if (os.platform() !== 'win32') {
		return builtin;
	}

	return [
		...builtin,
		// 软件自动下载的 Supermium（initChrome 的 Win7 内置浏览器安装目标）
		{
			name: 'Supermium 浏览器（软件下载）',
			path: resolveSupermiumRuntimePath()
		},
		{
			name: '微软浏览器(Microsoft Edge)',
			path: resolveSystemBrowserPath('Microsoft\\Edge\\Application\\msedge.exe')
		},
		{
			name: '谷歌浏览器(Chrome)',
			path: resolveSystemBrowserPath('Google\\Chrome\\Application\\chrome.exe')
		},
		// Supermium（Chromium 移植版，Win7 可用）：默认装在用户目录 LocalAppData
		{
			name: 'Supermium 浏览器',
			path: resolveSystemBrowserPath('Supermium\\Application\\chrome.exe', true)
		}
	].filter((b) => b.path) as ValidBrowser[];
}

/**
 * 解析内置 Chrome 运行时路径。
 *
 * 优先探测 init.chrome.ts 解压到 userData 的可执行文件（打包后 resourcesPath 只读，
 * 实际运行时副本位于 userData）；回退到历史 resourcesPath 布局以兼容旧版本解压位置；
 * 开发模式追加项目根 bin/chrome/<platform>-<arch> 探测（2.x 4634090 移植：本地手动
 * 放置解压目录时直接可用，无需启动下载流程）。
 */
function resolveBuiltinBrowserPath() {
	const resourcesPath = getResourcesPath();
	let devRootCandidate: string | undefined;
	try {
		// getBuiltinChromeRoot 内部引用 electron app，非 Electron 环境（worker）回退跳过
		devRootCandidate = join(getBuiltinChromeRoot(), 'chrome', BUILTIN_CHROME_FILENAME);
	} catch {
		devRootCandidate = undefined;
	}
	return [
		getBuiltinChromeRuntimePath(),
		...(resourcesPath ? [join(resourcesPath, 'bin', 'chrome', 'chrome', BUILTIN_CHROME_FILENAME)] : []),
		...(devRootCandidate ? [devRootCandidate] : [])
	].find((p) => existsSync(p));
}

/** 解析软件下载的 Supermium 运行时路径（非 Electron 环境回退 undefined，由调用方过滤） */
function resolveSupermiumRuntimePath() {
	try {
		const p = getSupermiumRuntimePath();
		return existsSync(p) ? p : undefined;
	} catch {
		return undefined;
	}
}

/** 解析系统浏览器路径（win32）：按常见安装目录探测（ProgramFiles 环境变量 + C 盘兜底）。
 *  includeLocalAppData 时额外探测用户目录（Supermium 等免管理员安装位置） */
function resolveSystemBrowserPath(commonPath: string, includeLocalAppData = false) {
	const candidates: string[] = [];
	if (process.env.ProgramFiles) candidates.push(join(process.env.ProgramFiles, commonPath));
	if (process.env['ProgramFiles(x86)']) candidates.push(join(process.env['ProgramFiles(x86)'], commonPath));
	candidates.push(join('C:\\Program Files', commonPath), join('C:\\Program Files (x86)', commonPath));
	if (includeLocalAppData && process.env.LOCALAPPDATA) {
		candidates.push(join(process.env.LOCALAPPDATA, commonPath));
	}
	return candidates.find((p) => existsSync(p));
}

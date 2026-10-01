import { existsSync } from 'fs';
import { join } from 'path';
import { ValidBrowser } from '../interface';
import os from 'os';
import { BUILTIN_CHROME_FILENAME, getBuiltinChromeRuntimePath } from './chrome.path';

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

// 获取可用浏览器路径
export function getValidBrowsers(): ValidBrowser[] {
	/** 内置浏览器（darwin/linux 同样解压到 userData，见 chrome.path.ts） */
	const builtin = [
		{
			name: '软件内置浏览器-谷歌(Chrome)',
			path: resolveBuiltinBrowserPath()
		}
	].filter((b) => b.path) as ValidBrowser[];

	switch (os.platform()) {
		case 'win32': {
			return [
				...builtin,
				{
					name: '微软浏览器(Microsoft Edge)',
					path: resolveBrowserPath('Microsoft\\Edge\\Application\\msedge.exe')
				},
				{
					name: '谷歌浏览器(Chrome)',
					path: resolveBrowserPath('Google\\Chrome\\Application\\chrome.exe')
				}
			].filter((b) => b.path) as ValidBrowser[];
		}
		default: {
			// darwin / linux：仅提供内置浏览器
			return builtin;
		}
	}
}

/**
 * 解析内置 Chrome 运行时路径。
 *
 * 优先探测 init.chrome.ts 解压到 userData 的可执行文件（打包后 resourcesPath 只读，
 * 实际运行时副本位于 userData）；回退到历史 resourcesPath 布局以兼容旧版本解压位置。
 */
function resolveBuiltinBrowserPath() {
	const resourcesPath = getResourcesPath();
	return [
		getBuiltinChromeRuntimePath(),
		...(resourcesPath ? [join(resourcesPath, 'bin', 'chrome', 'chrome', BUILTIN_CHROME_FILENAME)] : [])
	].find((p) => existsSync(p));
}

function resolveBrowserPath(commonPath: string) {
	const resourcesPath = getResourcesPath();
	return [
		...(resourcesPath ? [join(resourcesPath, commonPath)] : []),
		...(process.platform === 'win32'
			? [
					// @ts-ignore
					join(process.env.ProgramFiles, commonPath),
					// @ts-ignore
					join(process.env['ProgramFiles(x86)'], commonPath),
					join('C:\\Program Files', commonPath),
					join('C:\\Program Files (x86)', commonPath)
			  ]
			: [])
	].find((p) => existsSync(p));
}

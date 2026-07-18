import { existsSync } from 'fs';
import { join } from 'path';
import { ValidBrowser } from '../interface';
import os from 'os';
import 'electron';
import { getBuiltinChromeRoot } from './chrome.path';

// 获取可用浏览器路径
export function getValidBrowsers(): ValidBrowser[] {
	switch (os.platform()) {
		case 'darwin': {
			return [
				{
					name: '软件内置浏览器-谷歌(Chrome)',
					path: resolveBuiltinChromePath(
						join('chrome', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
					)
				}
			].filter((b) => b.path) as ValidBrowser[];
		}
		case 'win32': {
			return [
				{
					name: '软件内置浏览器-谷歌(Chrome)',
					path: resolveBuiltinChromePath(join('chrome', 'chrome.exe'))
				},
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
			return [];
		}
	}
}

/**
 * 解析内置 Chrome 可执行文件路径。
 * relativeTail 为 `bin/chrome` 之后的相对路径（如 `chrome/chrome.exe`）。
 * - 打包模式：resources/bin/chrome/<relativeTail>
 * - 开发模式：<projectRoot>/bin/chrome/<platform>-<arch>/<relativeTail>
 */
function resolveBuiltinChromePath(relativeTail: string): string | undefined {
	return [join(process.resourcesPath, 'bin', 'chrome', relativeTail), join(getBuiltinChromeRoot(), relativeTail)].find(
		(p) => existsSync(p)
	);
}

function resolveBrowserPath(commonPath: string) {
	return [
		join(process.resourcesPath, commonPath),
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

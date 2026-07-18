import path from 'path';
import { app } from 'electron';

/**
 * 内置 Chrome 解压根目录。
 *
 * - 打包模式：`resources/bin/chrome`
 *   （electron-builder 的 extraResources 把 `bin/chrome/<platform>-<arch>/` 拍平到此）
 * - 开发模式：`<projectRoot>/bin/chrome/<platform>-<arch>`
 *   （scripts/chrome.install.js 的 pack() 输出到该平台子目录）
 *
 * 平台串 `<platform>-<arch>` 与 chrome.install.js 的 `${PLATFORM || 'win'}-${ARCH || 'x64'}` 保持一致。
 */
export function getBuiltinChromeRoot(): string {
	if (app.isPackaged) {
		return path.join(process.resourcesPath, 'bin', 'chrome');
	}
	const platformName = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
	// dev 下 app.getAppPath() 为 packages/app，../.. 回到项目根目录
	return path.join(app.getAppPath(), '..', '..', 'bin', 'chrome', `${platformName}-${process.arch}`);
}

import { existsSync } from 'fs';
import { join } from 'path';
import { ValidBrowser } from '../interface';
import { BUILTIN_CHROME_FILENAME, getBuiltinChromeRuntimePath, getBuiltinChromeRoot } from './chrome.path';

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
 * 获取可用浏览器路径——仅返回软件内置浏览器。
 * 历史原因：内置 Chrome 版本已固定（137），本机浏览器（Edge/系统 Chrome）版本不可控，
 * 拓展/脚本兼容性无法保证，故不再提供本机浏览器探测。
 */
export function getValidBrowsers(): ValidBrowser[] {
	return [
		{
			name: '软件内置浏览器-谷歌(Chrome)',
			path: resolveBuiltinBrowserPath()
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

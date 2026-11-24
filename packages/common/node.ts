/**
 * Node/Electron 主进程专用入口：包含依赖 electron 或仅适用于主进程的能力
 * （内置 Chrome 路径解析、浏览器探测等）。仅供 @ocs-desktop/app 主进程使用；
 * worker 子进程与渲染进程禁止使用本入口（worker 用主入口，渲染进程用 ./web）。
 */
export * from './index';
export { getValidBrowsers } from './src/utils/valid.browser';
export {
	BUILTIN_CHROME_FILENAME,
	getBuiltinChromeRoot,
	getBuiltinChromeRuntimePath,
	getSupermiumRuntimePath
} from './src/utils/chrome.path';

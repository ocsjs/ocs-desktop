import type { OcsBridge } from '@ocs-desktop/common/web';
import { inBrowser } from './node';

/**
 * 渲染进程统一底层能力门面（bridge）。
 *
 * 桌面端读取 preload 注入的 window.ocs（bridge 门面：methods/fs/path/os/win/... +
 * platform/shell/clipboard/quitApp/on 窄接口，类型 OcsBridge 为实现即真相源的生成产物）；
 * 纯浏览器宿主（受管 Chromium 导航页，inBrowser）提供安全空操作/降级回退。
 */

/** 纯浏览器宿主下的平台推断（导航页 UI 适配用，精度要求低） */
// eslint-disable-next-line no-undef
function detectBrowserPlatform(): NodeJS.Platform {
	const p = (typeof navigator !== 'undefined' && navigator.platform) || '';
	if (/mac/i.test(p)) return 'darwin';
	if (/linux/i.test(p)) return 'linux';
	return 'win32';
}

/** 无操作异步函数（浏览器宿主下任意 facade 方法的安全降级：resolve undefined） */
const noopAsync = () => Promise.resolve(undefined);

/** 纯浏览器宿主回退：shell/clipboard/platform/quitApp 保留可用降级，其余能力空操作 */
const browserFallbackBridge: OcsBridge = {
	methods: new Proxy({}, { get: () => noopAsync }) as any,
	fs: new Proxy({}, { get: () => noopAsync }) as any,
	path: new Proxy({}, { get: (t, p) => (p === 'sep' ? '/' : noopAsync) }) as any,
	os: new Proxy({}, { get: () => noopAsync }) as any,
	win: new Proxy({}, { get: () => noopAsync }) as any,
	webContents: new Proxy({}, { get: () => noopAsync }) as any,
	app: new Proxy({}, { get: () => noopAsync }) as any,
	dialog: new Proxy({}, { get: () => noopAsync }) as any,
	electronStore: { get: () => Promise.resolve(undefined) },
	logger: { info: () => {}, warn: () => {}, error: () => {} },
	platform: detectBrowserPlatform(),
	shell: {
		openPath: () => Promise.resolve(''),
		showItemInFolder: () => {},
		openExternal: (url) => {
			window.open(url, '_blank');
			return Promise.resolve();
		}
	},
	clipboard: {
		writeText: (text) => {
			navigator.clipboard?.writeText(text).catch(() => {});
		}
	},
	quitApp: () => window.close(),
	on: () => () => {}
};

// eslint-disable-next-line no-undef
export const bridge: OcsBridge = inBrowser ? browserFallbackBridge : ((window as any).ocs as OcsBridge);

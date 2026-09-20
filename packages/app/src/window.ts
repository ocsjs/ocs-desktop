// @ts-check
import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import url from 'url';
import { store } from './store';
import { DEFAULT_SERVER_PORT } from '@ocs-desktop/common';

export function createWindow() {
	const win = new BrowserWindow({
		title: 'ocs',
		icon: path.resolve('./public/favicon.ico'),
		minWidth: 700,
		minHeight: 400,
		width: 900,
		height: 600,
		center: true,
		hasShadow: true,
		autoHideMenuBar: true,
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: 'white',
			symbolColor: 'black'
		},
		frame: false,
		show: false,
		webPreferences: {
			zoomFactor: 1,
			// 关闭拼写矫正
			spellcheck: false,
			webSecurity: true,
			// 开启node
			nodeIntegration: true,
			contextIsolation: false
		}
	});

	win.webContents.on('will-navigate', (event, url) => {
		// 允许应用内部导航（开发服务器或本地文件），避免 Vite 热更新整页刷新时打开浏览器
		if (url.startsWith('http://localhost') || url.startsWith('file://')) {
			return;
		}
		event.preventDefault();
		shell.openExternal(url);
	});

	win.webContents.setWindowOpenHandler((detail) => {
		shell.openExternal(detail.url);
		return {
			action: 'deny'
		};
	});

	return win;
}

/**
 * 创建应用启动初始化期间的透明闪屏窗口。
 *
 * 仅在内置 Chrome 需要解压（首次运行）时由 initChrome 创建并显示，
 * 加载独立的 public/loading.html（不依赖 web/Vue 项目），背景透明、只显示一个 loading 弹窗。
 * 进度文案由 loading.html 内轮询 /api/init/status 拉取，端口通过 query 注入。
 */
export function createLoadingWindow(): BrowserWindow {
	const win = new BrowserWindow({
		title: 'ocs-loading',
		icon: path.resolve('./public/favicon.ico'),
		width: 480,
		height: 360,
		center: true,
		frame: false,
		transparent: true,
		hasShadow: false,
		resizable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		skipTaskbar: true,
		alwaysOnTop: true,
		show: false,
		webPreferences: {
			zoomFactor: 1,
			spellcheck: false,
			webSecurity: true,
			nodeIntegration: true,
			contextIsolation: false
		}
	});

	// 加载独立 loading.html（file://），端口由 store 读取并注入 query，默认 15319。
	// 开发模式：loading.html 源文件位于 web 项目 packages/web/public/（vite publicDir），
	//   打包时由 vite 复制到 packages/app/public/；故两模式下分别从对应位置以 file:// 加载，
	//   不依赖 vite dev server，且打包不会被 vite 覆盖（源文件受 web 项目管理）。
	const port = (store.store.server?.port as number | undefined) || DEFAULT_SERVER_PORT;
	// 渲染产物经 electron-vite 输出到 out/renderer（含 publicDir 拷贝的 loading.html）；
	// dev 模式直接读 web 源文件（vite publicDir），不依赖 dev server。
	const loadingHtmlPath = app.isPackaged
		? path.join(app.getAppPath(), 'out', 'renderer', 'loading.html')
		: path.join(app.getAppPath(), '..', 'web', 'public', 'loading.html');
	win.loadURL(url.pathToFileURL(loadingHtmlPath).href + `?port=${port}`);

	return win;
}

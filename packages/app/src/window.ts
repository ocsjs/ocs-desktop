// @ts-check
import { app, BrowserWindow, nativeImage, shell } from 'electron';
import path from 'path';
import url from 'url';
import fs from 'fs';

/**
 * 窗口图标路径：
 * Linux 对 .ico 支持差（任务栏/dock 缩放锯齿），使用 256px PNG；
 * Windows 使用 .ico；macOS 窗口图标由系统 Dock/包内 icns 负责。
 */
function windowIconPath() {
	return process.platform === 'linux' ? path.resolve('./public/icons/256.png') : path.resolve('./public/favicon.ico');
}

export function createWindow() {
	if (process.platform === 'darwin' && !app.isPackaged) {
		// 开发模式下 macOS Dock 默认显示 Electron 图标，替换为应用图标
		app.dock?.setIcon(nativeImage.createFromPath(path.resolve('./public/icons/512.png')));
	}

	const win = new BrowserWindow({
		title: 'ocs',
		icon: windowIconPath(),
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
			symbolColor: 'black',
			// 显式指定覆盖层高度（与渲染端 --title-height 一致），
			// 否则 Linux 下系统控制按钮（最小化/最大化/关闭）默认高度偏小，渲染位置太靠上
			height: 32
		},
		frame: false,
		// Electron 43 起 roundedCorners 支持 Linux：支持 CSD 的桌面环境（GNOME/mutter）
		// 下无边框窗口获得原生圆角；阴影与焦点区分由系统合成器绘制，
		// 取代此前「透明窗口 + CSS 阴影」方案（弹窗溢出/按钮错位/无焦点区分等缺陷）。
		// 无合成器的 WM（如 i3）下退化为直角无阴影，可接受。
		roundedCorners: true,
		show: false,
		webPreferences: {
			zoomFactor: 1,
			// 关闭拼写矫正
			spellcheck: false,
			webSecurity: true,
			// 阶段 C 安全基线：preload + contextIsolation + sandbox，
			// 渲染进程仅可访问 window.ocs 白名单 API（见 src/preload/index.ts）
			preload: path.join(__dirname, '../preload/index.js'),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true
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
 * 状态经 IPC 推送（preload 暴露 window.ocsInit，通道 ocs-init:*），无网络能力。
 */
export function createLoadingWindow(): BrowserWindow {
	const win = new BrowserWindow({
		title: 'ocs-loading',
		icon: windowIconPath(),
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
			// loading 专用窄接口 preload（window.ocsInit，与主窗口 window.ocs 隔离）
			preload: path.join(__dirname, '../preload/loading.js'),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true
		}
	});

	// 加载独立 loading.html（file://）。按形态探测首个存在的路径：
	// 1. 打包（asar 根下 out/renderer，publicDir 拷贝产物）
	// 2. 构建产物直跑（getAppPath=out/main，上一级即 out/renderer）
	// 3. dev 模式读 web 源文件（packages/web/public，不依赖 dev server）
	const loadingHtmlCandidates = [
		path.join(app.getAppPath(), 'out', 'renderer', 'loading.html'),
		path.join(app.getAppPath(), '..', 'renderer', 'loading.html'),
		path.join(app.getAppPath(), '..', 'web', 'public', 'loading.html')
	];
	const loadingHtmlPath = loadingHtmlCandidates.find((p) => fs.existsSync(p)) ?? loadingHtmlCandidates[1];
	win.loadURL(url.pathToFileURL(loadingHtmlPath).href);

	return win;
}

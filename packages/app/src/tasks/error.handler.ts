import { app, BrowserWindow, WebContents } from 'electron';
import { Logger } from '../logger';

/**
 * 处理错误
 */
export function handleError() {
	const logger = Logger('error');

	app.on('render-process-gone', (e, contents, details) => {
		const url = contents.getURL?.() ?? '';
		logger.error('render-process-gone', details, `type=${contents.getType()}`, `url=${url}`);
		// DevTools 渲染进程崩溃不应导致整个应用退出：
		// Linux 下沙箱不可用（Ubuntu 23.10+ AppArmor 限制非特权 user namespace）时被迫使用
		// no-sandbox，该模式下 DevTools 渲染进程会崩溃（SIGTRAP, exitCode 5），
		// 主窗口与业务功能完全不受影响，此处仅记录日志并忽略。
		if (url.startsWith('devtools://') || isDevToolsWebContents(contents)) {
			logger.warn('DevTools 渲染进程崩溃，已忽略（主窗口不受影响）');
			return;
		}
		process.exit(0);
	});
	app.on('child-process-gone', (e, details) => {
		logger.error('child-process-gone', details);
		process.exit(0);
	});

	process.on('uncaughtException', (e) => {
		logger.error('rejectionHandled', e);
	});
	process.on('unhandledRejection', (e) => {
		logger.error('unhandledRejection', e);
	});
}

/** 判断崩溃的 webContents 是否为某个窗口的 DevTools */
function isDevToolsWebContents(contents: WebContents): boolean {
	return BrowserWindow.getAllWindows().some((win) => {
		try {
			return win.webContents.devToolsWebContents?.id === contents.id;
		} catch {
			return false;
		}
	});
}

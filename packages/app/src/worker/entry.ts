// @ts-check
/**
 * worker 子进程入口（由渲染进程/主进程 fork 为纯 Node 子进程运行）。
 * 经 electron-vite 打包为 out/main/script.js，替代原 app 根目录的 script.js CJS 壳。
 * 注意：本进程非 Electron 环境，依赖链必须保持 electron-free。
 */
import { ScriptWorker } from './index';

const worker = new ScriptWorker();

// 监听消息
process.on('message', (message: { event: any; args: any }) => {
	/** 根据 event 名直接调用方法 */
	(worker as any)[message.event](...message.args);
});

/**
 * 自我回收：尽力关闭浏览器（含 Chromium）后退出。
 *
 * 触发场景：
 * - disconnect：父进程（渲染进程）退出或被强杀（如 dev 调试 Ctrl+C），IPC 通道断开；
 * - SIGINT / SIGTERM：worker 被直接终止（POSIX；Windows 的 TerminateProcess 无法拦截）。
 *
 * 不做此回收时，worker（node）及其 Chromium 会成为孤儿进程并占用终端控制台，
 * 导致 dev 调试 Ctrl+C 后控制台进程卡死。
 */
let disposing = false;
function disposeAndExit(code = 0) {
	if (disposing) return;
	disposing = true;
	// 硬超时兜底：browser.close() 可能因页面挂起/原生弹窗永不返回，
	// 超时后强制退出（进程退出时 Playwright 会同步清理 Chromium 子进程）
	const forceTimer = setTimeout(() => process.exit(code), 5000);
	worker
		.dispose()
		.catch(() => {})
		.finally(() => {
			clearTimeout(forceTimer);
			process.exit(code);
		});
}

process.on('disconnect', () => disposeAndExit(0));
process.on('SIGINT', () => disposeAndExit(0));
process.on('SIGTERM', () => disposeAndExit(0));

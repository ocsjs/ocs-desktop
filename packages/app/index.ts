import { app } from 'electron';
import path from 'path';
import { remoteRegister } from './src/tasks/remote.register';
import { initStore } from './src/tasks/init.store';
import { autoLaunch } from './src/tasks/auto.launch';
import { createWindow } from './src/window';
import { createTray, isAppQuitting } from './src/tray';
import { globalListenerRegister } from './src/tasks/global.listener';
import { isLinuxSandboxUnavailable, task } from './src/utils';
import { handleError } from './src/tasks/error.handler';
import { updater } from './src/tasks/updater';
import { startupServer } from './src/tasks/startup.server';
import { initChrome } from './src/tasks/init.chrome';
import { initCrypto } from './src/crypto';

app.setName('OCS Desktop');

// 部分启动方式（GearLever/flatpak 等桌面启动器）会把 stdout/stderr 接到已关闭的管道：
// 任一 console.log 都会触发 EPIPE 异步异常 → 全局错误处理器记日志时再次 console.log → 无限递归，
// 表现为窗口永不显示、终端无输出、error.log 以数十 MB/s 的速度膨胀直至写满磁盘。
// 为流挂上 error 监听后 EPIPE 不再升级为 uncaughtException（写不出去的日志直接丢弃）。
for (const stream of [process.stdout, process.stderr]) {
	stream?.on?.('error', (err: Error & { code?: string }) => {
		if (err.code !== 'EPIPE') throw err;
	});
}

// 设置应用用户模型 ID，使 Windows 通知（托盘气泡等）显示应用名 "OCS Desktop" 而非进程名 "Electron"。
// 打包后与 electron-builder 的 appId（快捷方式 AUMID）保持一致，以正确关联应用图标与名称。
app.setAppUserModelId(app.isPackaged ? 'ocs.enncy.cn' : 'OCS Desktop');

// 防止软件崩溃以及兼容
// Windows/macOS 维持原有 no-sandbox 行为不变；Linux 仅在沙箱不可用时才追加（见上）
if (process.platform !== 'linux' || isLinuxSandboxUnavailable()) {
	app.commandLine.appendSwitch('no-sandbox');
	app.commandLine.appendSwitch('--no-sandbox');
}
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.disableHardwareAcceleration();

if (process.platform === 'linux') {
	// Linux 透明窗口（无边框 CSS 圆角）需要显式启用 RGBA visuals，
	// 否则透明区域按不透明渲染，窗口四角仍是实心直角（Electron 官方要求与 disable-gpu 配合使用）
	app.commandLine.appendSwitch('enable-transparent-visuals');
}

/** 获取单进程锁 */
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
} else {
	bootstrap();
}

/** 启动渲染进程 */
function bootstrap() {
	task('OCS启动程序', () =>
		Promise.all([
			task('初始化错误处理', () => handleError()),
			// 密钥初始化必须在 initStore 之前完成（initStore 同步调用 getDecryptedRenderData）
			task('初始化加密密钥', () => initCrypto()).then(() =>
				task('初始化本地设置', async () => {
					initStore();
					await task('启动接口服务', () => startupServer());
				})
			),
			task('初始化自动启动', () => autoLaunch()),
			task('启动渲染进程', async () => {
				await app.whenReady();
				const window = createWindow();
				const relaunched = await task('初始化谷歌浏览器', () => initChrome(window));
				if (relaunched) {
					return;
				}

				app.on('quit', (e) => {
					e.preventDefault();
					// 交给渲染层去关闭浏览器；程序化退出走 'quit' 以绕过「隐藏到托盘」
					// 销毁保护（2.x 4634090 移植）：AppImage 重启链路等场景下窗口可能已销毁
					if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
						window.webContents.send(isAppQuitting() ? 'quit' : 'close');
					}
				});

				// 渲染层是否已成功加载（close 消息由渲染层响应）
				let rendererReady = false;
				window.webContents.on('did-finish-load', () => {
					rendererReady = true;
				});

				window.on('close', (e) => {
					// 渲染层尚未成功加载（如 dev server 未就绪/加载失败）时没有人响应 'close' 消息，
					// 直接销毁窗口，避免出现白屏且无法关闭的僵尸窗口
					if (!rendererReady || window.webContents.isCrashed()) {
						window.destroy();
						return;
					}
					e.preventDefault();
					// 程序化退出（quitApp / before-quit 标记）-> 'quit'：走完整退出流程（关浏览器 + 存数据）
					// 用户点击关闭按钮 -> 'close'：交由渲染层按「后台运行」开关决定隐藏到托盘或退出
					// 销毁保护（2.x 4634090 移植）
					if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
						window.webContents.send(isAppQuitting() ? 'quit' : 'close');
					}
				});

				window.webContents.once('did-finish-load', () => {
					setTimeout(() => {
						// 因为需要对渲染进程发送信息，所以要在显示完成后开始监听
						if (app.isPackaged) {
							task('软件更新', () => updater());
						}
					}, 1000);
				});

				task('初始化远程通信模块', () => remoteRegister(window));
				task('注册app事件监听器', () => globalListenerRegister(window));
				task('初始化系统托盘', () => createTray(window));

				// 渲染进程启动时会同步调用 decryptRenderString/saveStore 等加密 IPC，
				// 必须先确保主密钥就绪（initCrypto 并发幂等，此处等待并行的初始化任务完成），
				// 否则解密失败会导致渲染端把密文当数据再次加密写回（重复加密），进而引发响应式失效。
				await initCrypto();

				if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
					await window.loadURL(process.env.ELECTRON_RENDERER_URL);
					window.webContents.openDevTools();
				} else {
					await window.loadFile(path.join(app.getAppPath(), 'out/renderer/index.html'));
				}

				// 加载完成显示，解决一系列的显示/黑屏问题
				window.show();
			})
		])
	);
}

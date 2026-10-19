import { app } from 'electron';
import path from 'path';
import { remoteRegister } from './src/tasks/remote.register';
import { initStore } from './src/tasks/init.store';
import { autoLaunch } from './src/tasks/auto.launch';
import { createWindow } from './src/window';
import { createTray, isAppQuitting } from './src/tray';
import { globalListenerRegister } from './src/tasks/global.listener';
import { task } from './src/utils';
import { handleError } from './src/tasks/error.handler';
import { updater } from './src/tasks/updater';
import { startupServer } from './src/tasks/startup.server';
import { initChrome } from './src/tasks/init.chrome';
import { initCrypto } from './src/crypto';

app.setName('OCS Desktop');

// 设置应用用户模型 ID，使 Windows 通知（托盘气泡等）显示应用名 "OCS Desktop" 而非进程名 "Electron"。
// 打包后与 electron-builder 的 appId（快捷方式 AUMID）保持一致，以正确关联应用图标与名称。
app.setAppUserModelId(app.isPackaged ? 'ocs.enncy.cn' : 'OCS Desktop');

// 防止软件崩溃以及兼容
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('--no-sandbox');
app.disableHardwareAcceleration();

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
				await task('初始化谷歌浏览器', () => initChrome(window));

				app.on('quit', (e) => {
					e.preventDefault();
					// 交给渲染层去关闭浏览器；程序化退出走 'quit' 以绕过「隐藏到托盘」
					window.webContents.send(isAppQuitting() ? 'quit' : 'close');
				});

				window.on('close', (e) => {
					e.preventDefault();
					// 程序化退出（quitApp / before-quit 标记）-> 'quit'：走完整退出流程（关浏览器 + 存数据）
					// 用户点击关闭按钮 -> 'close'：交由渲染层按「后台运行」开关决定隐藏到托盘或退出
					window.webContents.send(isAppQuitting() ? 'quit' : 'close');
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

import { app } from 'electron';
import { remoteRegister } from './src/tasks/remote.register';
import { initStore } from './src/tasks/init.store';
import { autoLaunch } from './src/tasks/auto.launch';
import { createWindow } from './src/window';
import { globalListenerRegister } from './src/tasks/global.listener';
import { task } from './src/utils';
import { handleError } from './src/tasks/error.handler';
import { updater } from './src/tasks/updater';
import { startupServer } from './src/tasks/startup.server';
import { initChrome } from './src/tasks/init.chrome';
import { store } from './src/store';

app.setName('ocs');

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
			task('初始化本地设置', () => {
				initStore();
				task('启动接口服务', () => startupServer());
			}),
			task('初始化自动启动', () => autoLaunch()),
			task('启动渲染进程', async () => {
				// 设置 webrtc 的影像帧率比例，最高100，太高会造成卡顿，参数默认50
				app.commandLine.appendSwitch(
					'webrtc-max-cpu-consumption-percentage',
					(store.store.app?.video_frame_rate ?? 1).toString()
				);

				await app.whenReady();
				const window = createWindow();
				await task('初始化谷歌浏览器', () => initChrome(window));

				app.on('quit', (e) => {
					e.preventDefault();
					// 交给渲染层去关闭浏览器
					window.webContents.send('close');
				});

				window.on('close', (e) => {
					e.preventDefault();
					window.webContents.send('close');
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

				if (app.isPackaged) {
					await window.loadFile('./public/index.html');
				} else {
					await window.loadURL('http://localhost:3000');
					window.webContents.openDevTools();
				}

				// 加载完成显示，解决一系列的显示/黑屏问题
				window.show();
			})
		])
	);
}

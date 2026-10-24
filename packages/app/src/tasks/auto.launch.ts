import { app } from 'electron';
import { store } from '../store';

/** 配置自动启动 */
export function autoLaunch() {
	if (app.isPackaged) {
		app.setLoginItemSettings({
			// 「初始化自动启动」与「初始化本地设置」为并行任务，全新配置下 store 可能尚未就绪，
			// 此时按未开启自启处理，避免 TypeError（Cannot read properties of undefined）
			openAtLogin: store.store?.window?.autoLaunch ?? false
		});
	}
}

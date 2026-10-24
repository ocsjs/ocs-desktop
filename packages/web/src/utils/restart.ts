import { Modal } from '@arco-design/web-vue';
import { remote } from './remote';

/** 是否 electron-vite dev 开发模式（pnpm dev） */
export function isDevMode(): boolean {
	return remote.methods.callSync('isDevMode');
}

/**
 * 重启软件（dev 感知）。
 *
 * - 生产：resetApp（relaunch + 程序化退出）；
 * - pnpm dev：无法自动重启——quit 会让 electron-vite 判定应用退出并杀死整个 dev 进程
 *   （dev server 停止），relaunch 拉起的新实例加载已失效的 dev server 地址会变白屏僵尸窗口。
 *   此时仅提示用户：关闭软件后在终端手动重新运行 pnpm dev。
 *
 * @param reason 可选的前置说明（如「OCR 识别模块安装完成」）
 */
export function restartAppGuarded(reason?: string): void {
	if (isDevMode()) {
		Modal.confirm({
			title: '开发模式提示',
			content:
				(reason ? reason + '\n' : '') +
				'当前处于 pnpm dev 开发模式，软件无法自动重启（重启会终止 dev 进程）。请点击「关闭软件」后，在终端重新运行 pnpm dev 启动。',
			okText: '关闭软件',
			cancelText: '取消',
			onOk: () => {
				// dev 下 resetApp 已退化为仅退出（不 relaunch）
				remote.methods.call('resetApp');
			}
		});
		return;
	}
	remote.methods.call('resetApp');
}

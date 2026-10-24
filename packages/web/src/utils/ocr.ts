import { h, ref } from 'vue';
import { Button, Modal, Message, Notification } from '@arco-design/web-vue';
import type { RawAutomationScript } from '@ocs-desktop/common/web';
import { remote } from './remote';
import { electron } from './node';
import { resourceLoader } from './resources.loader';
import { getRemoteInfos } from '.';
import { notify } from './notify';
import { restartAppGuarded } from './restart';

const { ipcRenderer } = electron;

/** 查询 OCR 识别模块的资源定义 */
async function getOcrResourceFile() {
	const infos = await getRemoteInfos();
	return infos?.resourceGroups.find((g) => g.name === 'apps')?.files.find((f) => f.id === 'ocr');
}

/**
 * 当前系统是否支持 OCR 识别模块。
 * 判定依据远程资源定义：win32 使用默认包，其余平台需 platforms 显式提供对应包
 * （如 darwin → ocr-darwin.zip）；未提供（如 linux）则表示不支持，
 * 避免下载到 win32 二进制导致「安装后仍检测不到」的假安装。
 */
export async function isOcrSupported(): Promise<boolean> {
	const platform = await remote.methods.call('getPlatform');
	if (platform === 'win32') return true;
	const ocrFile = await getOcrResourceFile();
	return !!ocrFile?.platforms?.some((p) => p.platform === platform);
}

/**
 * 浏览器启动后的 OCR 依赖提示（非阻塞，不阻止浏览器使用）。
 *
 * 自动化程序声明 needOCR（登录流程需破解验证码）且本地未安装 OCR 识别模块时，
 * 弹出常驻通知，提供「立即安装」按钮一键下载安装；
 * 安装完成后提示重启软件（部分系统中 ocr 执行文件可能无法及时被访问）。
 */
export async function notifyOcrMissingAfterLaunch(scripts?: RawAutomationScript[]): Promise<void> {
	if (!scripts?.some((s) => s.needOCR)) return;
	if (await remote.methods.call('canOCR')) return;

	// 平台不支持（如 Linux 无对应包）：不提供安装入口，只提示手动输入验证码，
	// 避免引导用户安装一个在当前系统必然不可用的 win32 二进制
	if (!(await isOcrSupported())) {
		notify(
			'OCR 识别模块暂不支持当前系统',
			'当前浏览器的自动化程序需要破解登录验证码；OCR 识别模块暂不支持当前系统（仅支持 Windows/macOS），出现验证码时请手动输入。',
			'ocr-unsupported',
			{ type: 'warning', duration: 10 * 1000 }
		);
		return;
	}

	notify(
		'缺少 OCR 识别模块',
		'当前浏览器的自动化程序需要破解登录验证码，建议安装 OCR 识别模块；不安装也可以手动输入验证码，浏览器正常使用不受影响。',
		'ocr-missing',
		{
			type: 'warning',
			// 常驻通知，由用户主动关闭或点击安装
			duration: 0,
			btn: h(
				Button,
				{
					type: 'primary',
					size: 'small',
					onClick: () => {
						Notification.remove('ocr-missing');
						installOcrWithProgress();
					}
				},
				'立即安装'
			)
		}
	);
}

/**
 * 下载并安装 OCR 识别模块（带进度弹窗），成功后提示重启软件。
 * 供「启动后通知的安装按钮」与「应用中心手动安装」复用。
 */
export async function installOcrWithProgress(): Promise<boolean> {
	const ocrFile = await getOcrResourceFile();
	if (!ocrFile) {
		Message.error('未找到 OCR 识别模块资源，请前往「设置 → 应用中心」手动安装');
		return false;
	}
	// 平台兜底：notify 入口已做门控，此处防止其他调用方在不支持的平台触发安装
	if (!(await isOcrSupported())) {
		Message.warning('OCR 识别模块暂不支持当前系统');
		return false;
	}

	// 统一下载器（分块并发 + 断点续传），进度实时展示
	// Modal 服务不支持 update content，用响应式 ref + 渲染函数实现进度更新
	const progressText = ref('准备下载...');
	const modal = Modal.info({
		title: '正在安装 OCR 识别模块',
		content: () => h('div', progressText.value),
		footer: false,
		closable: false,
		maskClosable: false
	});
	const listener = (_e: any, channel: string, rate: number) => {
		if (channel === 'download-file-ocr') {
			progressText.value = `下载中... ${rate}%`;
		}
	};
	ipcRenderer.on('download', listener);
	try {
		await resourceLoader.download('apps', ocrFile);
		progressText.value = '下载完成，正在解压安装...';
		await resourceLoader.unzip('apps', ocrFile);
		Message.success('OCR 识别模块安装完成');
		promptRestartAfterOcrInstall();
		return true;
	} catch (e: any) {
		Message.error('OCR 识别模块安装失败：' + (e?.message || String(e)));
		return false;
	} finally {
		ipcRenderer.removeListener('download', listener);
		modal.close();
	}
}

/**
 * OCR 安装完成后的重启提示：
 * 部分系统（如 macOS Gatekeeper 首次校验、杀软扫描新文件）中 ocr 执行文件可能无法及时被访问，
 * 建议重启软件后再运行自动化程序。
 */
export function promptRestartAfterOcrInstall(): void {
	Modal.confirm({
		title: '安装完成',
		content: 'OCR 识别模块安装完成。部分系统中 OCR 执行文件可能无法及时被访问，建议重启软件后再运行自动化程序。',
		okText: '立即重启',
		cancelText: '稍后重启',
		onOk: () => {
			// dev 感知重启：pnpm dev 下提示手动重跑终端（见 utils/restart.ts）
			restartAppGuarded('OCR 识别模块安装完成。');
		}
	});
}

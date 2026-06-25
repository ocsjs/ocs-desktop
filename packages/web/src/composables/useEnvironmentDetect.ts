import { reactive, watch } from 'vue';
import { Environment } from '../utils/environment';
import type { ValidBrowser } from '@ocs-desktop/common/lib/src/interface';
import { store } from '../store';

const state = reactive({
	/** 环境是否就绪 */
	isReady: true,
	/** 当前浏览器是否受支持 */
	isCurrentBrowserSupported: true,
	/** 检测到的可用浏览器 */
	supportedBrowser: null as ValidBrowser | undefined | null,
	/** 检测到的脚本管理器 */
	supportedExtension: null as any | undefined | null,
	/** 检测到的默认用户脚本 */
	validUserScript: null as any | undefined | null,
	/** 修复弹窗是否可见 */
	envSetupFixVisible: false,
	/** 修复弹窗是否可见 */
	setupTitle: '',
	/** 是否正在检测中 */
	isLoading: true
});

async function updateEnvironmentDetect() {
	state.isLoading = true;
	await Environment.init();
	const [isCurrentBrowserSupported, supportedBrowser, supportedExtension, validUserScript] = await Promise.all([
		Environment.isCurrentBrowserSupported(),
		Environment.getSupportedBrowser(),
		Environment.getSupportedExtension(),
		Environment.getValidUserScript()
	]);
	state.isCurrentBrowserSupported = isCurrentBrowserSupported;
	state.supportedBrowser = supportedBrowser;
	state.supportedExtension = supportedExtension;
	state.validUserScript = validUserScript;
	state.isReady = isCurrentBrowserSupported && !!supportedBrowser && !!supportedExtension && !!validUserScript;
	state.isLoading = false;
}

watch(
	() => [store.render.setting.launchOptions.executablePath],
	() => {
		updateEnvironmentDetect();
	}
);

export function useEnvironmentDetect() {
	return {
		state,
		updateEnvironmentDetect,
		openSetupModal: (setupTitle: string) => {
			state.envSetupFixVisible = true;
			state.setupTitle = setupTitle;
		}
	};
}

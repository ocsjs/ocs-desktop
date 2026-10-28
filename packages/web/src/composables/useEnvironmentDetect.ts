import { reactive } from 'vue';
import { Environment } from '../utils/environment';
import type { ValidBrowser } from '@ocs-desktop/common/web';

/**
 * 环境检测状态（供新手引导等展示层使用）。
 *
 * 检测刷新为显式调用（updateEnvironmentDetect），无模块级 watch 副作用；
 * 环境补全不在这里做——启动浏览器时由 utils/env-bootstrap.ts 自动执行。
 */
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

export function useEnvironmentDetect() {
	return {
		state,
		updateEnvironmentDetect
	};
}

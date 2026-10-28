import { store } from '../store';
import { remote } from './remote';
import { electron } from './node';
import { Environment } from './environment';
import { installExtensions } from './extension';
import { addScriptFromUrl } from './user-scripts';
import { useEnvironmentDetect } from '../composables/useEnvironmentDetect';
import { Status } from './statusBar';

const { ipcRenderer } = electron;

/**
 * 环境被动检测与自动补全（启动浏览器时由 Browser.launch 调用）。
 *
 * 设计目标：用户对环境无感——
 * - 环境就绪时零打扰（检测全部通过则直接返回，无任何提示）；
 * - 缺失时全自动补全，进度展示在右下角状态栏（Status.loading），
 *   不使用弹窗阻挡用户屏幕；
 * - 并发启动共享同一次补全（模块级 in-flight Promise），批量启动不重复执行。
 *
 * 失败分级：
 * - 浏览器二进制不可用（无可用浏览器且内置浏览器安装失败）→ 抛错，中断启动；
 * - 脚本管理器/官方脚本补全失败（多为弱网）→ 仅告警，允许启动，下次启动重试。
 */

/** 并发启动共享的进行中 Promise */
let inFlight: Promise<void> | null = null;

/** 启动前确保环境就绪（浏览器二进制/脚本管理器拓展/官方用户脚本） */
export function ensureEnvironmentReady(): Promise<void> {
	if (!inFlight) {
		inFlight = doEnsure().finally(() => {
			inFlight = null;
		});
	}
	return inFlight;
}

async function doEnsure(): Promise<void> {
	// 远程资源信息是拓展/脚本检测的前提
	await Environment.init();
	if (!Environment.infos.value) {
		throw new Error('无法获取远程资源信息，请检查网络后重试。');
	}

	// 先静默检测，全部就绪则零打扰直接返回
	const [browserSupported, supportedExtension, officialScript] = await Promise.all([
		Environment.isCurrentBrowserSupported(),
		Environment.getSupportedExtension(),
		Environment.getValidUserScript()
	]);
	const scriptInstalled = officialScript ? store.render.scripts.some((s) => s.url === officialScript.url) : true;
	if (browserSupported && supportedExtension && scriptInstalled) {
		return;
	}

	// 有缺失项：状态栏展示进度并自动补全（无弹窗、无确认框）
	const setProgress = (text: string) => Status.loading(text);
	setProgress('正在自动准备环境...');

	// 内置浏览器安装进度（主进程 IPC 推送）实时展示
	const chromeProgressHandler = (_e: any, progress: { message?: string }) => {
		if (progress?.message) setProgress(progress.message);
	};
	ipcRenderer.on('builtin-chrome-install-progress', chromeProgressHandler);

	try {
		// 1. 浏览器二进制：当前路径不受支持时自动切换可用浏览器，都没有则安装内置浏览器
		if (!browserSupported) {
			const supportedBrowser = await Environment.getSupportedBrowser();
			if (supportedBrowser) {
				store.render.setting.launchOptions.executablePath = supportedBrowser.path;
				setProgress(`已切换浏览器：${supportedBrowser.name}`);
			} else {
				setProgress('未检测到可用浏览器，正在下载安装内置浏览器（约 150MB）...');
				const executablePath: string = await remote.methods.call('installBuiltinChrome');
				store.render.setting.launchOptions.executablePath = executablePath;
				setProgress('内置浏览器安装完成。');
			}
		}

		// 2. 脚本管理器拓展：未安装或非 MV3 时自动安装官方默认拓展
		if (!supportedExtension) {
			setProgress('正在安装脚本管理器拓展...');
			try {
				const extensions = await Environment.getExtensions();
				const defaultExtension = extensions[0];
				if (!defaultExtension) throw new Error('远程资源中无可用脚本管理器');
				const installed = await installExtensions(extensions, defaultExtension, { force_install: true });
				if (!installed) throw new Error('安装流程未返回安装路径');
			} catch (e) {
				console.error('脚本管理器自动安装失败：', e);
				setProgress('脚本管理器安装失败（可稍后在「设置 → 应用中心」手动安装），将继续启动浏览器...');
			}
		}

		// 3. 官方用户脚本：未加入脚本列表时自动添加（启动时由 worker 注入）
		if (!scriptInstalled && officialScript) {
			setProgress(`正在添加官方脚本：${officialScript.name}...`);
			try {
				await addScriptFromUrl(officialScript.url);
			} catch (e) {
				console.error('官方脚本自动添加失败：', e);
				setProgress('官方脚本添加失败（可稍后手动添加），将继续启动浏览器...');
			}
		}
	} finally {
		ipcRenderer.removeListener('builtin-chrome-install-progress', chromeProgressHandler);
		Status.clear();
	}

	// 补全后刷新环境检测状态（供新手引导等展示层感知）
	useEnvironmentDetect().updateEnvironmentDetect();
}

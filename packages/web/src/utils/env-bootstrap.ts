import { store, StoreUserScript } from '../store';
import { remote } from './remote';
import { electron } from './node';
import { Environment } from './environment';
import { installExtensions } from './extension';
import { addScriptFromUrl } from './user-scripts';
import { useEnvironmentDetect } from '../composables/useEnvironmentDetect';
import { Status } from './statusBar';
import { notify } from './notify';
import { config } from '../config';

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

/**
 * 兜底修复损坏的脚本猫脚本条目：API 结构变更期间（script_id 字段移位）安装的脚本
 * 写入了 undefined ID，url/code_url 均为 .../undefined/... 无效链接，每次启动 404 重试。
 * 检测到此类条目时按脚本名重新搜索脚本猫，精确名称匹配后修复 id/url/info（含 code_url）。
 * 修复失败不删除用户条目，仅提示（用户可自行删除重装）。
 */
async function repairBrokenScriptcatScripts(): Promise<void> {
	const isBroken = (s: StoreUserScript) => {
		if (s.isLocalScript) return false;
		const url = s.url || '';
		const codeUrl = s.info?.code_url || '';
		return (
			/scriptcat\.org/.test(url + codeUrl) &&
			(String(s.id) === 'undefined' || url.includes('/undefined') || codeUrl.includes('/undefined/'))
		);
	};
	const broken = store.render.scripts.filter(isBroken);
	if (broken.length === 0) return;

	const engine = config.scriptSearchEngines.find((e) => e.type === 'scriptcat');
	if (!engine) return;

	for (const script of broken) {
		const name = script.info?.name;
		if (!name) continue;
		try {
			const results = await engine.search(name, 1, 10);
			// 精确名称匹配，避免误修到同名前缀的其他脚本
			const matched = results.find((r) => r.name === name);
			if (matched) {
				script.id = matched.id;
				script.url = matched.url;
				script.info = { ...script.info, ...matched };
				console.log(`[repair] 已修复损坏的脚本条目：${name}（id=${matched.id}）`);
			} else {
				notify(
					'脚本条目修复失败',
					`「${name}」的安装信息损坏（脚本猫 API 变更所致），自动修复未找到匹配项。请在脚本列表中删除后重新添加。`,
					'repair-fail-' + name,
					{ duration: 60 * 1000, type: 'warning', copy: true }
				);
			}
		} catch (e) {
			console.warn('[repair] 修复脚本条目失败：', name, e);
		}
	}
}

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
	// 内置拓展完整性校验（asar 基准）：每次启动浏览器前对已释放拓展重算指纹，
	// 篡改/损坏自动从 asar 重释放；失败仅告警不阻断（检测环节会兜底按需安装）
	try {
		const results: { id: string; status: string; error?: string }[] = await remote.methods.call(
			'ensureBuiltinExtensionsIntegrity'
		);
		for (const r of results || []) {
			if (r.status === 'repaired') console.warn(`内置拓展 ${r.id} 已被篡改/损坏，已自动修复`);
			if (r.status === 'failed') console.error(`内置拓展 ${r.id} 完整性修复失败：${r.error}`);
		}
	} catch (e) {
		console.error('内置拓展完整性校验失败：', e);
	}

	// 远程资源信息仅「官方脚本补全」与「远程拓展清单」需要；离线/弱网时降级为纯本地检测：
	// 浏览器与拓展检测均支持本地路径（getSupportedExtension 有本地目录扫描兜底），
	// 本地环境完整则直接放行，不再因拉取远程信息失败而中断启动
	await Environment.init();
	const offline = !Environment.infos.value;
	if (offline) {
		console.warn('[env-bootstrap] 远程资源信息不可用（离线/弱网），降级为本地环境检测');
	}

	// 兜底修复损坏的脚本猫脚本条目（undefined 链接），修复需联网，离线跳过
	if (!offline) {
		await repairBrokenScriptcatScripts();
	}

	// 先静默检测，全部就绪则零打扰直接返回
	const [browserSupported, supportedExtension, officialScript] = await Promise.all([
		Environment.isCurrentBrowserSupported(),
		Environment.getSupportedExtension(),
		// 离线时跳过官方脚本检测（添加脚本必须联网，缺失留待下次联网启动时补全）
		offline ? Promise.resolve(undefined) : Environment.getValidUserScript()
	]);
	// 官方脚本仅在脚本列表为空时初始化安装；列表已有任何脚本（用户自建/其他来源）时跳过，
	// 否则属于强制安装行为（覆盖用户的选择）
	const scriptInstalled = officialScript ? store.render.scripts.length > 0 : true;
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
			} else if (offline) {
				// 离线且本地无可用浏览器：内置浏览器必须联网下载，给出明确指引后中断
				throw new Error(
					'离线状态下未检测到可用浏览器，无法下载安装内置浏览器。请联网后重试，或在「设置 → 浏览器设置」中手动指定浏览器路径。'
				);
			} else {
				setProgress('未检测到可用浏览器，正在下载安装内置浏览器（约 150MB）...');
				const executablePath: string = await remote.methods.call('installBuiltinChrome');
				store.render.setting.launchOptions.executablePath = executablePath;
				setProgress('内置浏览器安装完成。');
			}
		}

		// 2. 脚本管理器拓展：未安装或非 MV3 时自动从 asar 释放官方内置拓展（释放本身无网络下载）
		if (!supportedExtension) {
			setProgress('正在安装脚本管理器拓展...');
			try {
				const bundled: { id: string }[] = await remote.methods.call('getBundledExtensions');
				if (offline) {
					// 离线：远程资源清单不可用，直接释放首个内置拓展（asar 释放为纯本地操作）
					if (!bundled.length) throw new Error('无可用内置脚本管理器');
					await remote.methods.call('installBundledExtension', bundled[0].id);
				} else {
					const extensions = await Environment.getExtensions();
					// 默认安装远程列表中首个有内置包的拓展（当前为 ScriptCat）
					const defaultExtension = extensions.find((e) => bundled.some((b) => b.id === e.id));
					if (!defaultExtension) throw new Error('无可用内置脚本管理器');
					const installed = await installExtensions(extensions, defaultExtension, { force_install: true });
					if (!installed) throw new Error('安装流程未返回安装路径');
				}
			} catch (e) {
				console.error('脚本管理器自动安装失败：', e);
				setProgress('脚本管理器安装失败（可稍后在「设置 → 应用中心」手动安装），将继续启动浏览器...');
			}
		}

		// 3. 官方用户脚本：仅脚本列表为空时初始化安装（启动时由 worker 注入）
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

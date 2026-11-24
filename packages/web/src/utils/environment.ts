import { getRemoteInfos } from '.';
import { store } from '../store';
import { bridge } from './bridge';
import {
	Infos,
	ResourceFile,
	SUPPORTED_BROWSER_MAX_MAJOR,
	SUPPORTED_BROWSER_MAX_MAJOR_WIN7,
	isSupermiumPath
} from '@ocs-desktop/common/web';
import { isWin7Platform } from './os';
import { ResourceLoader } from './resources.loader';
import _get from 'lodash/get';
import { ref } from 'vue';
type Extension = ResourceFile & { installed?: boolean };

/** 受支持的浏览器最高主版本号：Win7 平台限 109（110+ 无法运行），其余平台 137 */
async function supportedBrowserMaxMajor(): Promise<number> {
	return (await isWin7Platform()) ? SUPPORTED_BROWSER_MAX_MAJOR_WIN7 : SUPPORTED_BROWSER_MAX_MAJOR;
}

/** 资源加载器 */
const resourceLoader = new ResourceLoader({
	// getter 延迟求值：同 resources.loader.ts 的说明，避免模块加载时固化 undefined
	get resourceRootPath() {
		return store?.paths?.downloadFolder;
	}
});

export const Environment = {
	infos: ref(undefined as Infos | undefined),
	loading: ref(false),
	async init() {
		if (!this.infos.value) this.infos.value = await this.getRemoteInfos();
	},
	async getRemoteInfos() {
		if (!this.infos.value) {
			this.loading.value = true;
			try {
				this.infos.value = await getRemoteInfos();
			} catch (err) {
				// 网络异常时保持 infos 为空，由调用方展示错误与重试入口
				console.error('获取远程资源信息失败：', err);
			} finally {
				this.loading.value = false;
			}
		}
		return this.infos.value;
	},
	async getSupportedBrowser() {
		// 检测有效的浏览器路径（existsSync 与主版本探测均按浏览器并行，替代原串行同步链）
		const candidates = [
			{
				name: '默认设置浏览器',
				path: store.render.setting.launchOptions.executablePath || ''
			},
			...(await bridge.methods.getValidBrowsers())
		].filter((b) => b.path);
		let browsers = (
			await Promise.all(
				candidates.map(async (b) => {
					if (!(await bridge.fs.existsSync(b.path))) return undefined;
					return {
						...b,
						major_version: await bridge.methods.getBrowserMajorVersion(b.path)
					};
				})
			)
		).filter((b): b is NonNullable<typeof b> => b !== undefined);

		// 排序版本，从大到小
		browsers = browsers.sort((a, b) => (b.major_version || 0) - (a.major_version || 0));

		const win7 = await isWin7Platform();
		const maxMajor = win7 ? SUPPORTED_BROWSER_MAX_MAJOR_WIN7 : SUPPORTED_BROWSER_MAX_MAJOR;
		// Win7 下 Supermium 不受 109 上限约束（Chromium 150 移植版，Win7 可运行且保留 MV2）
		const isSupported = (b: (typeof browsers)[number]) =>
			!!b.major_version && (b.major_version <= maxMajor || (win7 && isSupermiumPath(b.path)));
		if (browsers.some(isSupported)) {
			return browsers.find(isSupported);
		}
	},

	// 检测当前浏览器是否支持
	async isCurrentBrowserSupported() {
		const current_browser_path = store.render.setting.launchOptions.executablePath;
		if (!current_browser_path) return false;
		const current_browser_version = await bridge.methods.getBrowserMajorVersion(current_browser_path);
		if (current_browser_version && current_browser_version <= (await supportedBrowserMaxMajor())) {
			return true;
		}
		// Win7 下 Supermium 不受 109 上限约束
		if ((await isWin7Platform()) && isSupermiumPath(current_browser_path)) {
			return true;
		}
		return false;
	},

	async getExtensions() {
		const infos = await this.getRemoteInfos();
		const extensions = (infos?.resourceGroups.find((group) => group.name === 'extensions')?.files || []) as Extension[];
		for (const extension of extensions) {
			extension.installed = await resourceLoader.isZipFileExists('extensions', extension);
		}
		return extensions;
	},

	async getSupportedExtension() {
		const infos = await this.getRemoteInfos();
		// 获取最新的拓展和用户脚本信息
		const extensions = (infos?.resourceGroups.find((group) => group.name === 'extensions')?.files || []) as Extension[];
		for (const extension of extensions) {
			extension.installed = await resourceLoader.isZipFileExists('extensions', extension);
		}
		// Win7（Chrome ≤109）：MV3 脚本管理器依赖 chrome.userScripts（Chrome 120+），
		// 只能使用 MV2 旧版（TM 4.x / ScriptCat 0.x），故放宽 manifest 版本下限
		const minManifestVersion = (await isWin7Platform()) ? 2 : 3;
		// 遍历所有"文件夹存在"的候选拓展：文件夹存在但 manifest 缺失/损坏/版本过低时继续检查下一个，
		// 避免安装中断留下的空目录（如篡改猴残留）遮蔽真正可用的脚本管理器（如脚本猫）
		for (const installed_extension of extensions.filter((e) => e.installed)) {
			let manifest: any;
			try {
				const manifestPath = await bridge.path.join(
					await resourceLoader.getUnzippedPath('extensions', installed_extension),
					'manifest.json'
				);
				// 先用 existsSync 探测：zip 已下载但未解压（或解压不完整）时 manifest.json 不存在，
				// 直接 readFileSync 会经 remote 层弹出「remote 模块错误」通知，属于误报
				if (!(await bridge.fs.existsSync(manifestPath))) {
					continue;
				}
				// manifest.json 可能是目录（残留污染/异常压缩包产生），readFileSync 目录会抛 EISDIR 弹错
				if (await bridge.methods.isDirectory(manifestPath)) {
					continue;
				}
				manifest = JSON.parse(String(await bridge.fs.readFileSync(manifestPath, 'utf-8')));
			} catch {
				// manifest.json 不存在或解析失败（如 OCR 等非扩展文件夹），跳过该候选
				continue;
			}
			// 跳过低于版本下限的拓展（常规平台要求 MV3，Win7 放宽到 MV2）
			if (_get(manifest, 'manifest_version', 2) < minManifestVersion) {
				continue;
			}
			return installed_extension;
		}

		// 兜底（2.x 移植）：远程资源列表未命中/网络异常时，直接扫描本地 extensions 目录
		try {
			// @ts-ignore
			const paths: string[] = await bridge.fs.readdirSync(store.paths.extensionsFolder);
			for (const file of paths.filter((f) => f !== '.DS_Store')) {
				const extensionPath = await bridge.path.join(store.paths.extensionsFolder, file);
				const isDirectory = await bridge.methods.isDirectory(extensionPath);
				if (!isDirectory) continue;
				const manifestPath = await bridge.path.join(extensionPath, 'manifest.json');
				const exists = await bridge.fs.existsSync(manifestPath);
				if (!exists) continue;
				// 同上：manifest.json 为目录时跳过，避免 readFileSync 抛 EISDIR 弹错
				if (await bridge.methods.isDirectory(manifestPath)) continue;

				const manifest = JSON.parse(String(await bridge.fs.readFileSync(manifestPath, 'utf-8')));
				if (_get(manifest, 'manifest_version', 2) >= minManifestVersion) {
					return {
						id: file,
						name: _get(manifest, 'name', file),
						url: '',
						installed: true
					} as Extension;
				}
			}
		} catch {}
		return undefined;
	},

	async getValidUserScript() {
		const infos = await this.getRemoteInfos();
		const userScripts = infos?.resourceGroups.find((group) => group.name === 'userjs')?.files || [];
		const default_user_script = userScripts[0];
		if (!default_user_script) {
			return;
		}
		return default_user_script;
	}
};

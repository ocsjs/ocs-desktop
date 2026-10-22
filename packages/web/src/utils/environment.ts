import { getRemoteInfos } from '.';
import { store } from '../store';
import { remote } from './remote';
import { Infos, ResourceFile } from '@ocs-desktop/common';
import { ResourceLoader } from './resources.loader';
import _get from 'lodash/get';
import { ref } from 'vue';
type Extension = ResourceFile & { installed?: boolean };

/** 资源加载器 */
const resourceLoader = new ResourceLoader({
	resourceRootPath: store?.paths?.downloadFolder
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
		// 检测有效的浏览器路径
		let browsers = await Promise.all(
			[
				{
					name: '默认设置浏览器',
					path: store.render.setting.launchOptions.executablePath || ''
				},
				...(await remote.methods.call('getValidBrowsers'))
			]
				.filter((b) => b.path && remote.fs.callSync('existsSync', b.path))
				.map(async (b) => {
					return {
						...b,
						major_version: await remote.methods.call('getBrowserMajorVersion', b.path)
					};
				})
		);

		// 排序版本，从大到小
		browsers = browsers.sort((a, b) => (b.major_version || 0) - (a.major_version || 0));

		if (browsers.some((b) => b.major_version && b.major_version <= 137)) {
			const valid_version_browser = browsers.find(
				(_, i) => browsers?.[i] && (browsers?.[i].major_version || 999) <= 137
			);
			return valid_version_browser;
		}
	},

	// 检测当前浏览器是否支持
	async isCurrentBrowserSupported() {
		const current_browser_path = store.render.setting.launchOptions.executablePath;
		if (!current_browser_path) return false;
		const current_browser_version = await remote.methods.call('getBrowserMajorVersion', current_browser_path);
		if (current_browser_version && current_browser_version <= 137) {
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
		// 遍历所有"文件夹存在"的候选拓展：文件夹存在但 manifest 缺失/损坏/版本过低时继续检查下一个，
		// 避免安装中断留下的空目录（如篡改猴残留）遮蔽真正可用的脚本管理器（如脚本猫）
		for (const installed_extension of extensions.filter((e) => e.installed)) {
			let manifest: any;
			try {
				const manifestPath = await remote.path.call(
					'join',
					await resourceLoader.getUnzippedPath('extensions', installed_extension),
					'manifest.json'
				);
				// 先用 existsSync 探测：zip 已下载但未解压（或解压不完整）时 manifest.json 不存在，
				// 直接 readFileSync 会经 remote 层弹出「remote 模块错误」通知，属于误报
				if (!remote.fs.callSync('existsSync', manifestPath)) {
					continue;
				}
				manifest = JSON.parse(String(await remote.fs.call('readFileSync', manifestPath, 'utf-8')));
			} catch {
				// manifest.json 不存在或解析失败（如 OCR 等非扩展文件夹），跳过该候选
				continue;
			}
			// 跳过 MV2 拓展
			if (_get(manifest, 'manifest_version', 2) < 3) {
				continue;
			}
			return installed_extension;
		}

		// 兜底（2.x 移植）：远程资源列表未命中/网络异常时，直接扫描本地 extensions 目录
		try {
			// @ts-ignore
			const paths: string[] = await remote.fs.call('readdirSync', store.paths.extensionsFolder);
			for (const file of paths.filter((f) => f !== '.DS_Store')) {
				const extensionPath = await remote.path.call('join', store.paths.extensionsFolder, file);
				const isDirectory = remote.methods.callSync('isDirectory', extensionPath);
				if (!isDirectory) continue;
				const manifestPath = await remote.path.call('join', extensionPath, 'manifest.json');
				const exists = await remote.fs.call('existsSync', manifestPath);
				if (!exists) continue;

				const manifest = JSON.parse(String(await remote.fs.call('readFileSync', manifestPath, 'utf-8')));
				if (_get(manifest, 'manifest_version', 2) >= 3) {
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

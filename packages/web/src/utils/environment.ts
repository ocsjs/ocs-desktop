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
			this.infos.value = await getRemoteInfos();
			this.loading.value = false;
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
		const extensions = (infos.resourceGroups.find((group) => group.name === 'extensions')?.files || []) as Extension[];
		for (const extension of extensions) {
			extension.installed = await resourceLoader.isZipFileExists('extensions', extension);
		}
		return extensions;
	},

	async getSupportedExtension() {
		const infos = await this.getRemoteInfos();
		// 获取最新的拓展和用户脚本信息
		const extensions = (infos.resourceGroups.find((group) => group.name === 'extensions')?.files || []) as Extension[];
		for (const extension of extensions) {
			extension.installed = await resourceLoader.isZipFileExists('extensions', extension);
		}
		const installed_extension = extensions.find((e) => e.installed);
		if (!installed_extension) return;

		const manifest = JSON.parse(
			String(
				await remote.fs.call(
					'readFileSync',
					await remote.path.call(
						'join',
						await resourceLoader.getUnzippedPath('extensions', installed_extension),
						'manifest.json'
					),
					'utf-8'
				)
			)
		);
		// 检查是否为 MV2 拓展，如果是则报错
		if (_get(manifest, 'manifest_version', 2) < 3) {
			return undefined;
		}

		return installed_extension;
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

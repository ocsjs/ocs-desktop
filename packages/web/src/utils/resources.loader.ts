import { store } from '../store';
import { remote } from './remote';
import { ResourceFile, ResourceLoaderOptions } from '@ocs-desktop/common/src/api';

export interface LocalResourceFile {
	groupname: string;
	filename: string;
	path: string;
}

/**
 *
 * 资源加载器
 *
 */
export class ResourceLoader {
	resourceRootPath: string;
	constructor(options: ResourceLoaderOptions) {
		this.resourceRootPath = options.resourceRootPath;
	}

	/** 返回本地绝对路径 */
	async getPath(group_name: string, file: ResourceFile) {
		return await remote.path.call('join', this.resourceRootPath, group_name, file.id);
	}

	/** 判断是否存在 */
	async isExists(group_name: string, file: ResourceFile) {
		const path = await this.getPath(group_name, file);
		return await remote.fs.call('existsSync', path);
	}

	/** 是否为压缩包文件 */
	isZipFile(file: ResourceFile) {
		return /\.(zip|rar|7z)$/.test(file.url);
	}

	/** 获取解压缩后的文件路径 */
	async getUnzippedPath(group_name: string, file: ResourceFile) {
		return await remote.path.call('join', this.resourceRootPath, group_name, file.id);
	}

	/** 判断压缩包是否存在 */
	async isZipFileExists(group_name: string, file: ResourceFile) {
		if (this.isZipFile(file)) {
			const path = await this.getUnzippedPath(group_name, file);
			return await remote.fs.call('existsSync', path);
		}
		return false;
	}

	/** 下载资源 */
	async download(group_name: string, file: ResourceFile) {
		const downloadPath = await remote.path.call(
			'join',
			this.resourceRootPath,
			group_name,
			this.isZipFile(file) ? file.id + '.zip' : file.id
		);

		// 判断文件是否存在，如果存在则删除
		if (await remote.fs.call('existsSync', downloadPath)) {
			await remote.fs.call('unlinkSync', downloadPath);
		}
		const platform = await remote.methods.call('getPlatform');
		const url =
			platform === 'win32'
				? file.url
				: // 优先安装对应平台的资源。如果没有对应平台的资源，则使用默认资源
				  file.platforms?.find((p) => p.platform === platform)?.url || file.url;
		if (!url) {
			throw new Error('资源下载失败，路径为空');
		}
		// 下载
		await remote.methods.call('download', 'download-file-' + file.id, url, downloadPath);
		return downloadPath;
	}

	/** 解压资源 */
	async unzip(group_name: string, file: ResourceFile) {
		const targetPath = await remote.path.call(
			'join',
			this.resourceRootPath,
			group_name,
			this.isZipFile(file) ? file.id + '.zip' : file.id
		);

		const to = await remote.path.call('join', this.resourceRootPath, group_name, file.id);
		// 判断文件夹是否存在，如果存在则删除
		if (await remote.fs.call('existsSync', to)) {
			await remote.fs.call('rmSync', to, {
				recursive: true
			});
		}
		await remote.methods.call('unzip', targetPath, to);
		// 删除压缩包
		await remote.fs.call('unlinkSync', targetPath);
		return to;
	}

	/** 删除资源 */
	async remove(group_name: string, file: ResourceFile) {
		if (this.isZipFile(file)) {
			const path = await this.getUnzippedPath(group_name, file);
			// 删除文件夹所有文件
			await remote.fs.call('rmSync', path, {
				recursive: true
			});
		} else {
			const path = await this.getPath(group_name, file);
			await remote.fs.call('unlinkSync', path);
		}
	}

	/**
	 * 获取资源列表
	 */
	async list() {
		const files: LocalResourceFile[] = [];
		// @ts-ignore
		const groupnames: string[] = await remote.fs.call('readdirSync', this.resourceRootPath);
		// TODO 检测是否是文件夹，如果不是则忽略
		for (const groupname of groupnames.filter((g) => g !== '.DS_Store')) {
			const folder = await remote.path.call('join', this.resourceRootPath, groupname);
			if (await remote.fs.call('existsSync', folder)) {
				const isDirectory = await remote.methods.callSync('isDirectory', folder);
				if (!isDirectory) continue;
				try {
					// @ts-ignore
					const filenames: string[] = await remote.fs.call('readdirSync', folder);
					for (const filename of filenames) {
						const path = await remote.path.call('join', folder, filename);
						files.push({ groupname, filename, path });
					}
				} catch (e) {
					console.error(e);
				}
			}
		}
		return files;
	}
}

/** 资源加载器 */
export const resourceLoader = new ResourceLoader({
	// 这里要加可选链，在浏览器环境中初始化时 store.paths 为 undefined
	resourceRootPath: store.paths?.downloadFolder
});

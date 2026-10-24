import { store } from '../store';
import { remote } from './remote';
import { ResourceFile, ResourceLoaderOptions } from '@ocs-desktop/common/web';

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

		// 不预删已存在的文件：统一下载器会依据旁车元数据（url+size+etag）自动断点续传，
		// 资源内容变化时元数据校验失败会自动全量重下
		const platform = await remote.methods.call('getPlatform');
		let url: string | undefined;
		if (platform === 'win32' || !file.platforms) {
			// win32 使用默认包；无 platforms 声明的为平台无关资源
			url = file.url;
		} else {
			// 声明了 platforms 的为平台专属二进制：无匹配平台时不可回退默认包（win32 二进制）
			// 否则会下载到当前系统不可运行的文件，造成「安装后仍检测不到」的假安装
			url = file.platforms.find((p) => p.platform === platform)?.url;
			if (!url) {
				throw new Error(`「${file.name}」暂不支持当前系统（${platform}），无法下载安装`);
			}
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
		// 删除压缩包与断点续传旁车元数据
		await remote.fs.call('unlinkSync', targetPath);
		await remote.fs.call('rmSync', targetPath + '.ocsdl.json', { force: true });
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
			// 清理可能残留的压缩包与断点续传旁车元数据（下载中断场景）
			const zipPath = await remote.path.call('join', this.resourceRootPath, group_name, file.id + '.zip');
			await remote.fs.call('rmSync', zipPath, { force: true });
			await remote.fs.call('rmSync', zipPath + '.ocsdl.json', { force: true });
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

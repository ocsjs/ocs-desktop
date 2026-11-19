import { store } from '../store';
import { bridge } from './bridge';
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
	private options: ResourceLoaderOptions;
	constructor(options: ResourceLoaderOptions) {
		this.options = options;
	}

	/**
	 * 延迟求值：实例可能在 store 异步初始化完成前创建（模块级实例，
	 * 静态 import 链先于 initStore 求值），路径必须在每次使用时读取。
	 * 构造方应传入带 getter 的 options（如 `{ get resourceRootPath() { return store.paths?.downloadFolder } }`）。
	 */
	get resourceRootPath(): string {
		return this.options.resourceRootPath;
	}

	/** 返回本地绝对路径 */
	async getPath(group_name: string, file: ResourceFile) {
		return await bridge.path.join(this.resourceRootPath, group_name, file.id);
	}

	/** 判断是否存在 */
	async isExists(group_name: string, file: ResourceFile) {
		const path = await this.getPath(group_name, file);
		return await bridge.fs.existsSync(path);
	}

	/** 是否为压缩包文件 */
	isZipFile(file: ResourceFile) {
		return /\.(zip|rar|7z)$/.test(file.url);
	}

	/** 获取解压缩后的文件路径 */
	async getUnzippedPath(group_name: string, file: ResourceFile) {
		return await bridge.path.join(this.resourceRootPath, group_name, file.id);
	}

	/** 判断压缩包是否存在 */
	async isZipFileExists(group_name: string, file: ResourceFile) {
		if (this.isZipFile(file)) {
			const path = await this.getUnzippedPath(group_name, file);
			return await bridge.fs.existsSync(path);
		}
		return false;
	}

	/** 下载资源 */
	async download(group_name: string, file: ResourceFile) {
		const downloadPath = await bridge.path.join(this.resourceRootPath,
			group_name,
			this.isZipFile(file) ? file.id + '.zip' : file.id
		);

		// 不预删已存在的文件：统一下载器会依据旁车元数据（url+size+etag）自动断点续传，
		// 资源内容变化时元数据校验失败会自动全量重下
		const platform = await bridge.methods.getPlatform();
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
		await bridge.methods.download('download-file-' + file.id, url, downloadPath);
		return downloadPath;
	}

	/** 解压资源 */
	async unzip(group_name: string, file: ResourceFile) {
		const targetPath = await bridge.path.join(this.resourceRootPath,
			group_name,
			this.isZipFile(file) ? file.id + '.zip' : file.id
		);

		const to = await bridge.path.join(this.resourceRootPath, group_name, file.id);
		// 判断文件夹是否存在，如果存在则删除
		if (await bridge.fs.existsSync(to)) {
			await bridge.fs.rmSync(to, {
				recursive: true
			});
		}
		await bridge.methods.unzip(targetPath, to);
		// 删除压缩包与断点续传旁车元数据
		await bridge.fs.unlinkSync(targetPath);
		await bridge.fs.rmSync(targetPath + '.ocsdl.json', { force: true });
		return to;
	}

	/** 删除资源 */
	async remove(group_name: string, file: ResourceFile) {
		if (this.isZipFile(file)) {
			const path = await this.getUnzippedPath(group_name, file);
			// 删除文件夹所有文件
			await bridge.fs.rmSync(path, {
				recursive: true
			});
			// 清理可能残留的压缩包与断点续传旁车元数据（下载中断场景）
			const zipPath = await bridge.path.join(this.resourceRootPath, group_name, file.id + '.zip');
			await bridge.fs.rmSync(zipPath, { force: true });
			await bridge.fs.rmSync(zipPath + '.ocsdl.json', { force: true });
		} else {
			const path = await this.getPath(group_name, file);
			await bridge.fs.unlinkSync(path);
		}
	}

	/**
	 * 获取资源列表
	 */
	async list() {
		const files: LocalResourceFile[] = [];
		// @ts-ignore
		const groupnames: string[] = await bridge.fs.readdirSync(this.resourceRootPath);
		// TODO 检测是否是文件夹，如果不是则忽略
		for (const groupname of groupnames.filter((g) => g !== '.DS_Store')) {
			const folder = await bridge.path.join(this.resourceRootPath, groupname);
			if (await bridge.fs.existsSync(folder)) {
				const isDirectory = await await bridge.methods.isDirectory(folder);
				if (!isDirectory) continue;
				try {
					// @ts-ignore
					const filenames: string[] = await bridge.fs.readdirSync(folder);
					for (const filename of filenames) {
						const path = await bridge.path.join(folder, filename);
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
	// getter 延迟求值：store 异步初始化（initStore）完成后才能拿到真实 paths，
	// 直接取值会在模块加载时固化为 undefined（store 空壳）
	get resourceRootPath() {
		return store.paths?.downloadFolder;
	}
});

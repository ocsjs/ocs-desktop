import axios from 'axios';
import { OCS_API } from './constants';

/** 资源文件 */
export interface ResourceFile {
	/** 唯一ID */
	id: string;
	name: string;
	url: string;
	description?: string;
	icon?: string;
	homepage?: string;
	platforms?: {
		// eslint-disable-next-line no-undef
		platform: NodeJS.Platform;
		url: string;
	}[];
}

/** 资源组 */
export interface ResourceGroup {
	/** 资源分组名，全英文，用于本地下载时文件夹分组 */
	name: string;
	/** 资源组描述 */
	description: string;
	/** 是否显示在应用中心页面 */
	showInResourcePage: boolean;
	/**  文件列表 */
	files: ResourceFile[];
}

export interface ResourceLoaderOptions {
	/** 本地资源下载根目录 */
	resourceRootPath: string;
}

/** 通知信息 */
export interface NotifyResource {
	id: string;
	content: string[];
}

/** Banner 通知 */
export interface BannerResource {
	title: string;
	content: string;
	type?: 'info' | 'warning' | 'success' | 'error';
}

/** 版本更新信息 */
export interface UpdateInformationResource {
	tag: string;
	/** markdown 格式的更新日志（由主进程从 CHANGELOG.md 按版本区间截取，3.0+ 弹窗使用） */
	markdown?: string;
	description: Record<'feat' | 'fix' | 'other', string[]>;
	url: string;
	app_downloads?: {
		win32?: string;
		darwin?: string;
		linux?: string;
	};
}

/** 官方书签信息 */
export interface BookmarkResource {
	values: {
		name: string;
		url: string;
		description?: string;
		icon?: string;
	}[];
	group: string;
}

export interface Infos {
	userjs: {
		ocsjs: string;
	};
	resourceGroups: ResourceGroup[];
	bookmark: BookmarkResource[];
	notify: NotifyResource[];
	banners: BannerResource[];
	versions: UpdateInformationResource[];
}

export class OCSApi {
	/** 默认软件信息接口（更新日志/资源/公告等），可通过 updater.infosUrl 设置覆盖以切换测试环境 */
	static DEFAULT_INFOS_URL = OCS_API.infos;

	static async getInfos(url?: string): Promise<Infos> {
		const { data } = await axios.get((url || OCSApi.DEFAULT_INFOS_URL) + '?t=' + Date.now(), {
			// 必须设置超时：否则网络异常时 Promise 永不 settle，初始化弹窗会一直卡在加载中
			timeout: 15_000
		});
		return data;
	}
}

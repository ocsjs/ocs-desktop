import { reactive, ref } from 'vue';
import { ResourceFile, ResourceGroup } from '@ocs-desktop/common/web';
import { resourceLoader } from '../utils/resources.loader';
import { getRemoteInfos } from '../utils';
import { Message } from '@arco-design/web-vue';
import { Status } from '../utils/statusBar';

type FileStateItem = { exists: boolean; downloading: boolean; unzipping: boolean; downloadRate: number };
export type FileState = Record<string, FileStateItem>;

/**
 * 全局共享的资源状态（模块级单例，所有调用者共享同一份响应式数据）。
 *
 * 设计参考 useEnvironmentDetect：state 定义在函数外，保证跨组件实时同步。
 * 例如用户在"软件设置-应用中心"中安装了脚本管理器，
 * 其他页面/检测逻辑也能实时感知到已安装。
 */

const resourceGroups = ref<ResourceGroup[]>([]);
const fileStatus = reactive<FileState>({});
const downloadingExtensionsFiles = ref<ResourceFile[]>([]);

const state = reactive({
	/** 首次加载中 */
	loading: false,
	/** 是否正在刷新已安装状态（不重新拉取远程分组，仅重检本地是否存在） */
	refreshing: false,
	/** 是否已完成过首次加载 */
	initialized: false
});

/** 上一次刷新时间，节流避免短时间内重复刷新 */
let lastRefreshAt = 0;

/**
 * 完整加载：拉取远程分组数据 + 检查本地已安装状态。
 * 仅在首次或需要完全重载时调用。
 */
async function loadResources() {
	state.loading = true;
	Status.loading('加载资源中...');
	try {
		const result = await getRemoteInfos();
		resourceGroups.value = result.resourceGroups.filter((g) => g.showInResourcePage);

		// 加载状态
		for (const group of result.resourceGroups) {
			for (const file of group.files) {
				fileStatus[file.url] = {
					exists: resourceLoader.isZipFile(file)
						? await resourceLoader.isZipFileExists(group.name, file)
						: await resourceLoader.isExists(group.name, file),
					downloading: false,
					unzipping: false,
					downloadRate: 0
				};
			}
		}
		state.initialized = true;
		Status.success('资源加载成功');
	} catch (err) {
		// @ts-ignore
		Message.error('加载资源失败 ' + err.message);
	} finally {
		state.loading = false;
		Status.clear();
	}
}

/**
 * 实时刷新各资源的本地已安装状态（不重新拉取远程分组数据）。
 * 若资源尚未加载，则退回完整加载。对正在下载/解压中的文件跳过，避免覆盖进行中的状态。
 */
async function refreshFileStatus() {
	if (!state.initialized || resourceGroups.value.length === 0) {
		return loadResources();
	}
	// 节流：1.5s 内不重复刷新
	const now = Date.now();
	if (now - lastRefreshAt < 1500) return;
	lastRefreshAt = now;

	state.refreshing = true;
	try {
		for (const group of resourceGroups.value) {
			for (const file of group.files) {
				const status = fileStatus[file.url];
				// 下载或解压进行中，跳过避免覆盖
				if (!status || status.downloading || status.unzipping || status.downloadRate > 0) continue;
				status.exists = resourceLoader.isZipFile(file)
					? await resourceLoader.isZipFileExists(group.name, file)
					: await resourceLoader.isExists(group.name, file);
			}
		}
	} finally {
		state.refreshing = false;
	}
}

export function useResources() {
	return {
		resourceGroups,
		fileStatus,
		downloadingExtensionsFiles,
		state,
		loadResources,
		refreshFileStatus
	};
}

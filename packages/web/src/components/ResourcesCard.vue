<!-- eslint-disable vue/no-v-html -->
<template>
	<a-card
		class="resources-card rounded"
		:body-style="{ padding: '12px 16px' }"
	>
		<template #title>
			<span class="card-title-icon">📦</span>
			应用设置
		</template>
		<template #extra>
			<a-space :size="6">
				<a-button
					size="mini"
					type="text"
					@click="openDownloadFolder"
				>
					<template #icon>
						<FolderIcon />
					</template>
					资源文件夹
				</a-button>
				<a-button
					size="mini"
					type="text"
					@click="() => (otherExtensionsAddVisible = !otherExtensionsAddVisible)"
				>
					<template #icon>
						<CircleHelpIcon />
					</template>
					加载其他拓展
				</a-button>
			</a-space>
		</template>

		<a-modal
			v-model:visible="otherExtensionsAddVisible"
			title="其他拓展加载方法"
			:footer="false"
			:closable="true"
		>
			<div
				class="text-secondary mb-2"
				v-html="t.html('notice_resources_page_other_extensions_add', '')"
			></div>
		</a-modal>

		<div
			ref="contentRef"
			class="resources-content"
		>
			<!-- 使用提示 -->
			<UsageAlertCollapse
				v-model:collapse="store.render.state.read_record.resources_usage"
				class="mb-2"
				banner
				title="使用提示"
				:html="
					t.html('notice_resources_page_usage', '在此安装与管理脚本管理器及各类拓展资源，安装后将自动加载到浏览器中。')
				"
			/>

			<template v-if="resState.loading && !resState.initialized">
				<a-skeleton
					animation
					class="mt-2"
				>
					<a-skeleton-line
						:rows="3"
						:line-heights="[28, 28, 28]"
					/>
				</a-skeleton>
			</template>
			<template v-else-if="resourceGroups.length === 0">
				<a-empty
					class="my-4"
					description="暂无资源，请尝试重启软件重新加载"
				/>
			</template>

			<template v-else>
				<template
					v-for="(group, index) of resourceGroups"
					:key="index"
				>
					<div
						class="resource-group-title"
						:class="{ 'mt-3': index > 0 }"
					>
						{{ group.description }}
					</div>

					<!-- ============ extensions 组：单选模式 ============ -->
					<template v-if="group.name === 'extensions'">
						<div class="extension-select-wrapper">
							<a-radio-group
								v-model="selectedExtensionUrl"
								class="extension-radio-group"
							>
								<div
									v-for="(file, i) of group.files"
									:key="i"
									class="resource-item extension-selectable"
									@click="selectedExtensionUrl = file.url"
								>
									<a-radio :value="file.url">
										<div class="resource-icon">
											<img
												v-if="file.icon"
												:src="file.icon"
											/>
											<LayoutGridIcon v-else />
										</div>
									</a-radio>
									<div class="resource-info">
										<a
											v-if="file.homepage"
											class="resource-name"
											:href="file.homepage"
											target="_blank"
										>
											{{ file.name }}
										</a>
										<span
											v-else
											class="resource-name"
										>
											{{ file.name }}
										</span>
										<div
											v-if="file.description"
											class="resource-desc"
										>
											<a-tooltip :content="file.description">
												<span>{{ file.description }}</span>
											</a-tooltip>
										</div>
									</div>
									<!-- 状态 -->
									<div
										v-if="fileStatus[file.url]"
										class="resource-action"
									>
										<template v-if="fileStatus[file.url].exists">
											<a-tag
												size="small"
												color="green"
											>
												已安装
											</a-tag>
										</template>
										<template v-else-if="fileStatus[file.url].downloadRate !== 0">
											<a-progress
												size="mini"
												status="normal"
												:percent="Math.round(fileStatus[file.url].downloadRate * 100) / 10000"
											/>
										</template>
										<template v-else-if="fileStatus[file.url].unzipping">
											<span class="text-secondary">解压中...</span>
										</template>
									</div>
								</div>
							</a-radio-group>
						</div>
					</template>

					<!-- ============ 非 extensions 组：原模式 ============ -->
					<template v-else>
						<div
							v-for="(file, i) of group.files"
							:key="i"
							class="resource-item"
						>
							<div class="resource-icon">
								<img
									v-if="file.icon"
									:src="file.icon"
								/>
								<LayoutGridIcon v-else />
							</div>
							<div class="resource-info">
								<a
									v-if="file.homepage"
									class="resource-name"
									:href="file.homepage"
									target="_blank"
								>
									{{ file.name }}
								</a>
								<span
									v-else
									class="resource-name"
								>
									{{ file.name }}
								</span>
								<div
									v-if="file.description"
									class="resource-desc"
								>
									<a-tooltip :content="file.description">
										<span>{{ file.description }}</span>
									</a-tooltip>
								</div>
							</div>
							<div
								v-if="fileStatus[file.url]"
								class="resource-action"
							>
								<template v-if="fileStatus[file.url].exists || fileStatus[file.url].downloadRate === 100">
									<a-button
										type="outline"
										status="danger"
										@click="remove(group.name, file)"
									>
										卸载
									</a-button>
								</template>
								<template v-else>
									<a-progress
										v-if="fileStatus[file.url].downloadRate !== 0"
										status="normal"
										:percent="Math.round(fileStatus[file.url].downloadRate * 100) / 10000"
									/>
									<span
										v-else-if="fileStatus[file.url].unzipping"
										class="text-secondary"
									>
										解压中...
									</span>
									<a-tooltip
										v-else
										:content="isFileSupported(file) ? '' : '该资源暂不支持当前系统'"
									>
										<a-button
											type="primary"
											:disabled="!isFileSupported(file)"
											@click="download(group.name, file)"
										>
											安装
										</a-button>
									</a-tooltip>
								</template>
							</div>
						</div>
					</template>
				</template>
			</template>

			<!-- 统一遮罩层：安装/卸载/解压进行中 或 资源状态刷新中（如首次进入触发环境检测后的状态回刷）时锁定整卡 -->
			<div
				v-if="overlayVisible"
				class="resources-overlay"
			>
				<a-spin />
				<span class="ms-2">{{ overlayText }}</span>
			</div>
		</div>
	</a-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, onBeforeUnmount, watch } from 'vue';
import { ResourceFile } from '@ocs-desktop/common/web';
import { resourceLoader } from '../utils/resources.loader';
import UsageAlertCollapse from './UsageAlertCollapse.vue';
import { store } from '../store/index';
import { t } from '../utils/langs';
import { Message } from '@arco-design/web-vue';
import { child_process, electron } from '../utils/node';
import { remote } from '../utils/remote';
import { useResources } from '../composables/useResources';
import { promptRestartAfterOcrInstall } from '../utils/ocr';
import { FolderIcon, CircleHelpIcon, LayoutGridIcon } from 'lucide-vue-next';

const { ipcRenderer } = electron;

const {
	resourceGroups,
	fileStatus,
	downloadingExtensionsFiles,
	state: resState,
	loadResources,
	refreshFileStatus
} = useResources();

// 卡片内容根节点，用作可见性监听目标
const contentRef = ref<HTMLElement | null>(null);
const otherExtensionsAddVisible = ref(false);

// ======== 脚本管理器单选 ========
const selectedExtensionUrl = ref('');

/** 脚本管理器是否正在安装中（安装期间显示蒙版禁止操作） */
const extensionInstalling = ref(false);

/** 进行中的安装/卸载操作计数（>0 时整卡遮罩，禁止任何其他操作） */
const operationCount = ref(0);

/** 是否有任何安装/卸载/解压进行中（覆盖全部资源组，含脚本管理器与 OCR 等） */
const anyBusy = computed(
	() =>
		extensionInstalling.value ||
		operationCount.value > 0 ||
		Object.values(fileStatus).some((s) => s.downloading || s.unzipping)
);

/**
 * 统一遮罩层显隐：安装/卸载/解压进行中，或资源状态刷新中
 * （原「刷新时内容置灰 0.6」的浅灰遮罩已合并至此，全卡只保留这一个遮罩实现）
 */
const overlayVisible = computed(() => anyBusy.value || resState.refreshing);

/** 统一遮罩层提示文案：按当前进行中的动作选取 */
const overlayText = computed(() => {
	if (Object.values(fileStatus).some((s) => s.unzipping)) return '正在解压...';
	if (anyBusy.value) return '正在安装/卸载...';
	return '正在刷新资源状态...';
});

/** 当前选中的脚本管理器 */
const selectedExtension = computed(() => {
	const group = resourceGroups.value.find((g) => g.name === 'extensions');
	if (!group) return undefined;
	return group.files.find((f) => f.url === selectedExtensionUrl.value);
});

/** 初始化选中状态：选中已安装的，否则选中第一个 */
function initExtensionSelection() {
	const group = resourceGroups.value.find((g) => g.name === 'extensions');
	if (!group || group.files.length === 0) return;
	const installed = group.files.find((f) => fileStatus[f.url]?.exists);
	selectedExtensionUrl.value = installed ? installed.url : group.files[0].url;
}

// 资源加载/刷新后自动更新选中状态
watch(
	() => resState.initialized,
	(val) => {
		if (val) initExtensionSelection();
	}
);

let intersectionObserver: IntersectionObserver | null = null;

/** 当前系统平台（用于平台专属资源的安装可用性判断） */
const currentPlatform = ref('');

/**
 * 资源是否支持当前系统：
 * 无 platforms 声明 → 平台无关资源，可用；
 * win32 → 默认包即 win32 版，可用；
 * 其余平台 → 需 platforms 显式提供对应包（如 OCR 的 darwin 包），否则禁用安装
 * （避免下载到 win32 二进制导致「安装后仍检测不到」的假安装）
 */
function isFileSupported(file: ResourceFile): boolean {
	if (!file.platforms) return true;
	return currentPlatform.value === 'win32' || file.platforms.some((p) => p.platform === currentPlatform.value);
}

onMounted(() => {
	remote.methods.call('getPlatform').then((p) => (currentPlatform.value = p));
	if (!resState.initialized) {
		loadResources();
	} else {
		refreshFileStatus();
		initExtensionSelection();
	}
	if (contentRef.value && typeof IntersectionObserver !== 'undefined') {
		intersectionObserver = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) {
				refreshFileStatus();
			}
		});
		intersectionObserver.observe(contentRef.value);
	}
});

onActivated(() => {
	refreshFileStatus();
});

onBeforeUnmount(() => {
	intersectionObserver?.disconnect();
	intersectionObserver = null;
});

/** 切换脚本管理器时自动安装（先卸载已有的） */
watch(selectedExtensionUrl, async (newUrl, oldUrl) => {
	if (!newUrl || newUrl === oldUrl) return;
	// 初始化选中（initExtensionSelection 从 '' 赋值为首个/已安装项）不触发自动安装，
	// 否则仅打开设置页就会自动下载脚本管理器，并与环境检测并发产生 manifest ENOENT 误报
	if (!oldUrl) return;
	const file = selectedExtension.value;
	if (!file || fileStatus[file.url]?.downloading || fileStatus[file.url]?.unzipping) return;
	// 已安装则跳过
	if (fileStatus[file.url]?.exists) return;

	extensionInstalling.value = true;
	try {
		// 先卸载已安装的其他脚本管理器
		const group = resourceGroups.value.find((g) => g.name === 'extensions');
		if (group) {
			for (const f of group.files) {
				if (f.url !== file.url && fileStatus[f.url]?.exists) {
					await remove('extensions', f);
				}
			}
		}

		downloadingExtensionsFiles.value.push(file);
		await download('extensions', file);
		downloadingExtensionsFiles.value = downloadingExtensionsFiles.value.filter((f) => f.url !== file.url);
	} finally {
		extensionInstalling.value = false;
	}
});

async function download(group_name: string, file: ResourceFile) {
	operationCount.value++;
	try {
		const files = await resourceLoader.list();

		for (const localFile of files) {
			if (localFile.filename.startsWith(file.id) && localFile.filename.replace(file.id, '').trim() !== '') {
				await remote.fs.call('rmSync', localFile.path, {
					recursive: true
				});
			}
		}

		const listener = (e: any, channel: string, rate: number) => {
			fileStatus[file.url].downloadRate = rate;
		};

		ipcRenderer.on('download', listener);
		try {
			fileStatus[file.url].downloading = true;
			await resourceLoader.download(group_name, file);
			fileStatus[file.url].downloading = false;
			fileStatus[file.url].downloadRate = 0;

			if (resourceLoader.isZipFile(file)) {
				fileStatus[file.url].unzipping = true;
				Message.info(`正在解压：${file.name}`);
				await resourceLoader.unzip(group_name, file);
				fileStatus[file.url].unzipping = false;
			}

			fileStatus[file.url].exists = true;

			// OCR 识别模块安装完成：提示重启（部分系统中 ocr 执行文件可能无法及时被访问）
			if (group_name === 'apps' && file.id === 'ocr') {
				promptRestartAfterOcrInstall();
			}
		} catch (err) {
			// @ts-ignore
			Message.error('下载错误 ' + err.message);
		}
		Message.success(`${file.name} 下载完成`);
		ipcRenderer.removeListener('download', listener);
	} catch (err) {
		// @ts-ignore
		Message.error('下载错误 ' + err.message);
	} finally {
		operationCount.value--;
	}
}

async function remove(group_name: string, file: ResourceFile) {
	operationCount.value++;
	try {
		await resourceLoader.remove(group_name, file);
		fileStatus[file.url].exists = false;
	} catch (err) {
		// @ts-ignore
		Message.error('删除错误 ' + err.message);
	} finally {
		operationCount.value--;
	}
}

function openDownloadFolder() {
	if (process.platform === 'win32') {
		child_process.exec(`explorer.exe "${store.paths.downloadFolder}"`);
	} else {
		electron.shell.openPath(store.paths.downloadFolder);
	}
}
</script>

<style scoped lang="less">
.resources-card {
	.resource-group-title {
		font-size: 12px;
		font-weight: 600;
		color: rgb(var(--gray-7));
		padding: 4px 4px 6px;
		letter-spacing: 0.3px;
	}

	.resource-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		border-radius: 8px;
		transition: background-color 0.2s ease;

		&:hover {
			background-color: var(--color-fill-1);
		}

		.resource-icon {
			flex: 0 0 auto;
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			overflow: hidden;

			img {
				width: 100%;
				height: 100%;
				object-fit: contain;
			}

			.icon {
				font-size: 24px;
				color: rgb(var(--gray-5));
			}
		}

		.resource-info {
			flex: 1 1 auto;
			min-width: 0;
		}

		.resource-name {
			font-size: 14px;
			font-weight: 500;
			color: var(--color-text-1);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.resource-desc {
			margin-top: 2px;
			font-size: 12px;
			color: var(--color-text-3);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 100%;
		}

		.resource-action {
			flex: 0 0 auto;
			min-width: 72px;
			display: flex;
			justify-content: flex-end;
			align-items: center;
		}
	}

	/* extensions 单选组样式 */
	.extension-radio-group {
		display: block;
		width: 100%;

		:deep(.arco-radio) {
			margin-right: 0;
		}
	}

	.extension-selectable {
		cursor: pointer;
	}

	.extension-select-wrapper {
		position: relative;
	}
}

.resources-content {
	position: relative;
}

/* 全局安装/卸载遮罩：任何资源操作进行中时锁定整卡 */
.resources-overlay {
	position: absolute;
	inset: 0;
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: var(--color-fill-2);
	opacity: 0.7;
	border-radius: var(--border-radius-small);
}

.card-title-icon {
	margin-right: 6px;
	font-size: 22px;
	display: inline-flex;
	align-items: center;
}

:deep(.arco-card-header-title) {
	display: flex;
	align-items: center;
}
</style>

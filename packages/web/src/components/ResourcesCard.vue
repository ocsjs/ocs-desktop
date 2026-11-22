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
					@click="() => (state.otherExtensionsAddVisible = !state.otherExtensionsAddVisible)"
				>
					<template #icon>
						<CircleHelpIcon />
					</template>
					加载其他拓展
				</a-button>
			</a-space>
		</template>

		<a-modal
			v-model:visible="state.otherExtensionsAddVisible"
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

			<!-- ============ 内置拓展（随包发版，官方源构建期钉版，不依赖远程资源） ============ -->
			<div class="resource-group-title">
				内置拓展
				<a-tooltip
					position="top"
					content="内置拓展来自官方发布渠道，随软件一同自动构建、与更新，安全可靠。"
				>
					<CircleHelpIcon class="help-icon" />
				</a-tooltip>
			</div>
			<div class="extension-select-wrapper mb-2">
				<a-radio-group
					v-model="state.selectedBundledId"
					class="extension-radio-group"
				>
					<div
						v-for="ext of state.bundledExtensions"
						:key="ext.id"
						class="resource-item extension-selectable"
						@click="state.selectedBundledId = ext.id"
					>
						<a-radio :value="ext.id">
							<div class="resource-icon">
								<img
									v-if="ext.icon"
									:src="ext.icon"
								/>
								<LayoutGridIcon v-else />
							</div>
						</a-radio>
						<div class="resource-info">
							<a
								v-if="ext.homepage"
								class="resource-name"
								:href="ext.homepage"
								target="_blank"
							>
								{{ ext.name }}
							</a>
							<span
								v-else
								class="resource-name"
							>
								{{ ext.name }}
							</span>
							<a-tag
								size="small"
								color="arcoblue"
								class="ms-1"
							>
								v{{ ext.version }}
							</a-tag>
							<a-tag
								size="small"
								color="gray"
								class="ms-1"
							>
								{{ ext.license }}
							</a-tag>
							<div
								v-if="ext.description"
								class="resource-desc"
							>
								<a-tooltip :content="ext.description">
									<span>{{ ext.description }}</span>
								</a-tooltip>
							</div>
						</div>
						<!-- 状态 -->
						<div class="resource-action">
							<template v-if="state.bundledStatus[ext.id]?.installing">
								<span class="text-secondary">安装中...</span>
							</template>
							<template v-else-if="state.bundledStatus[ext.id]?.exists">
								<a-tag
									size="small"
									color="green"
								>
									已安装
								</a-tag>
							</template>
						</div>
					</div>
				</a-radio-group>
			</div>

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
			<template v-else-if="displayGroups.length === 0">
				<a-empty
					v-if="state.bundledExtensions.length === 0"
					class="my-4"
					description="暂无资源，请尝试重启软件重新加载"
				/>
			</template>

			<template v-else>
				<template
					v-for="group of displayGroups"
					:key="group.name"
				>
					<div class="resource-group-title mt-3">
						{{ group.description }}
					</div>

					<!-- ============ 远程资源组：原模式 ============ -->
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
									:content="isFileSupported(file) ? '点击安装该应用' : '该资源暂不支持当前系统'"
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
import { ref, reactive, computed, onMounted, onActivated, onBeforeUnmount, watch, nextTick } from 'vue';
import { ResourceFile, BundledExtensionInfo } from '@ocs-desktop/common/web';
import { resourceLoader } from '../utils/resources.loader';
import UsageAlertCollapse from './UsageAlertCollapse.vue';
import { store, uiSession } from '../store/index';
import { t } from '../utils/langs';
import { Message } from '@arco-design/web-vue';
import { bridge } from '../utils/bridge';
import { onRendererEvent } from '../utils/ipc';

import { useResources } from '../composables/useResources';
import { promptRestartAfterOcrInstall } from '../utils/ocr';
import { FolderIcon, CircleHelpIcon, LayoutGridIcon } from 'lucide-vue-next';

const { resourceGroups, fileStatus, state: resState, loadResources, refreshFileStatus } = useResources();

/**
 * 组件状态（统一 reactive 管理，集中声明便于总览）。
 * 例外：contentRef 为模板引用（须顶层 ref）、intersectionObserver 为非响应式原生对象，单独声明。
 */
const state = reactive({
	/** 「其他拓展加载方法」教程弹窗显隐 */
	otherExtensionsAddVisible: false,
	/** 当前选中的内置拓展 id（单选，数据源为主进程 asar 清单，不再使用远程资源组） */
	selectedBundledId: '',
	/** 脚本管理器是否正在安装中（安装期间显示蒙版禁止操作） */
	extensionInstalling: false,
	/** 进行中的安装/卸载操作计数（>0 时整卡遮罩，禁止任何其他操作） */
	operationCount: 0,
	/** 当前系统平台（用于平台专属资源的安装可用性判断） */
	currentPlatform: '',
	/** 内置拓展清单（构建期官方源钉版，随 App 发版更新；主进程 asar 清单） */
	bundledExtensions: [] as BundledExtensionInfo[],
	/** 内置拓展安装状态（exists=已释放到本地，installing=安装中） */
	bundledStatus: {} as Record<string, { exists?: boolean; installing?: boolean }>
});

// 卡片内容根节点，用作可见性监听目标（模板 ref，须顶层独立声明）
const contentRef = ref<HTMLElement | null>(null);

/** 是否有任何安装/卸载/解压进行中（覆盖全部资源组，含脚本管理器与 OCR 等） */
const anyBusy = computed(
	() =>
		state.extensionInstalling ||
		state.operationCount > 0 ||
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

/** 远程资源组（extensions 组已废弃——内置拓展改由 asar 清单驱动，不再展示远程组） */
const displayGroups = computed(() => resourceGroups.value.filter((g) => g.name !== 'extensions'));

let intersectionObserver: IntersectionObserver | null = null;

// 会话级跳转请求（如 CRX 检测通知的「如何加载其他拓展？」按钮）：自动打开教程弹窗并复位标记。
// watch 覆盖两种场景：标记先于挂载置位（immediate）与已挂载后再次触发
watch(
	() => uiSession.appCenterGuide,
	(v) => {
		if (v) {
			uiSession.appCenterGuide = false;
			state.otherExtensionsAddVisible = true;
		}
	},
	{ immediate: true }
);

/** 刷新内置拓展安装状态 */
async function refreshBundledStatus() {
	for (const ext of state.bundledExtensions) {
		const exists = await bridge.bundledExtensions.isInstalled(ext.id).catch(() => false);
		state.bundledStatus[ext.id] = { ...state.bundledStatus[ext.id], exists: !!exists };
	}
}

/** 初始化选中状态：选中已安装的，否则选中第一个 */
function initBundledSelection() {
	if (state.bundledExtensions.length === 0) return;
	const installed = state.bundledExtensions.find((e) => state.bundledStatus[e.id]?.exists);
	state.selectedBundledId = (installed || state.bundledExtensions[0]).id;
}

/** 切换内置拓展时自动安装（先卸载其他已安装的脚本管理器，单选语义） */
watch(
	() => state.selectedBundledId,
	async (newId, oldId) => {
		if (!newId || newId === oldId || !oldId) return;
		const ext = state.bundledExtensions.find((e) => e.id === newId);
		if (!ext || state.bundledStatus[newId]?.installing || state.bundledStatus[newId]?.exists) return;

		state.bundledStatus[newId] = { ...state.bundledStatus[newId], installing: true };
		state.extensionInstalling = true;
		try {
			// 先卸载其他已安装的脚本管理器
			for (const other of state.bundledExtensions) {
				if (other.id !== newId && state.bundledStatus[other.id]?.exists) {
					await bridge.bundledExtensions.remove(other.id).catch(() => {});
					state.bundledStatus[other.id] = { ...state.bundledStatus[other.id], exists: false };
				}
			}
			// 从 asar 释放安装（官方源构建期钉版，无网络下载）
			await bridge.bundledExtensions.install(newId);
			Message.success(`${ext.name} 安装完成`);
		} catch (e: any) {
			Message.error(`${ext.name} 安装失败：${e?.message || String(e)}`);
		} finally {
			await refreshBundledStatus();
			state.bundledStatus[newId] = { ...state.bundledStatus[newId], installing: false };
			state.extensionInstalling = false;
		}
	}
);

/**
 * 资源是否支持当前系统：
 * 无 platforms 声明 → 平台无关资源，可用；
 * win32 → 默认包即 win32 版，可用；
 * 其余平台 → 需 platforms 显式提供对应包（如 OCR 的 darwin 包），否则禁用安装
 * （避免下载到 win32 二进制导致「安装后仍检测不到」的假安装）
 */
function isFileSupported(file: ResourceFile): boolean {
	if (!file.platforms) return true;
	return state.currentPlatform === 'win32' || file.platforms.some((p) => p.platform === state.currentPlatform);
}

onMounted(async () => {
	bridge.methods.getPlatform().then((p) => (state.currentPlatform = p));
	// 内置拓展清单（主进程 asar 清单）→ 状态刷新与选中初始化
	try {
		state.bundledExtensions = (await bridge.bundledExtensions.list()) || [];
		await refreshBundledStatus();
		initBundledSelection();
	} catch {}
	if (!resState.initialized) {
		loadResources();
	} else {
		refreshFileStatus();
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
	// 后台链路（启动浏览器时的环境补全）可能已自动安装内置拓展，回到应用中心时同步状态
	refreshBundledStatus();
});

onBeforeUnmount(() => {
	intersectionObserver?.disconnect();
	intersectionObserver = null;
});

watch(
	() => uiSession.appCenterGuide,
	() => {
		console.log('uiSession.appCenterGuide', uiSession.appCenterGuide);
		nextTick(() => {
			// 会话级跳转请求（如 CRX 检测通知的「如何加载其他拓展？」按钮）：自动打开教程弹窗并复位标记
			if (uiSession.appCenterGuide) {
				uiSession.appCenterGuide = false;
				state.otherExtensionsAddVisible = true;
			}
		});
	}
);

/** 旧版远程 extensions 组的切换自动安装已废弃：内置拓展的切换逻辑见上方 selectedBundledId watch */

async function download(group_name: string, file: ResourceFile) {
	console.log('download app', group_name, file);
	state.operationCount++;
	try {
		const files = await resourceLoader.list();

		for (const localFile of files) {
			if (localFile.filename.startsWith(file.id) && localFile.filename.replace(file.id, '').trim() !== '') {
				await bridge.fs.rmSync(localFile.path, {
					recursive: true
				});
			}
		}

		// 按 channel 过滤：多资源并发下载时进度互不串扰（命名规则见 resources.loader）
		const offDownload = onRendererEvent('download', (channel, rate) => {
			if (channel === 'download-file-' + file.id) {
				fileStatus[file.url].downloadRate = rate;
			}
		});
		try {
			// 注：extensions 组已废弃（内置拓展经 selectedBundledId watch 从 asar 安装），
			// 此函数仅服务远程资源组（OCR 等），不含 extensions 特判
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
			Message.success(`${file.name} 下载完成`);

			// OCR 识别模块安装完成：提示重启（部分系统中 ocr 执行文件可能无法及时被访问）
			if (group_name === 'apps' && file.id === 'ocr') {
				promptRestartAfterOcrInstall();
			}
		} catch (err) {
			// @ts-ignore
			Message.error('下载错误 ' + err.message);
		} finally {
			offDownload();
		}
	} catch (err) {
		// @ts-ignore
		Message.error('下载错误 ' + err.message);
	} finally {
		state.operationCount--;
	}
}

async function remove(group_name: string, file: ResourceFile) {
	console.log('remove app', group_name, file);
	state.operationCount++;
	try {
		await resourceLoader.remove(group_name, file);
		fileStatus[file.url].exists = false;
		fileStatus[file.url].downloading = false;
		fileStatus[file.url].downloadRate = 0;
	} catch (err) {
		Message.error('删除错误 ' + String(err));
	} finally {
		state.operationCount--;
	}
}

function openDownloadFolder() {
	// shell.openPath 跨平台打开文件夹（Windows 下等效 explorer.exe）
	bridge.shell.openPath(store.paths.downloadFolder);
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

		.help-icon {
			font-size: 13px;
			margin-left: 4px;
			vertical-align: -2px;
			color: rgb(var(--gray-5));
			cursor: pointer;
		}
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

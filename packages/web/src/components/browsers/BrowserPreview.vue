<template>
	<!-- 截图封面区域：运行中实时推流 / 浏览器关闭后保留的预览图，独占整个区域 -->
	<div class="card-screenshot">
		<img
			v-if="coverUrl"
			:src="coverUrl"
			alt="浏览器预览"
			class="screenshot-img"
		/>
		<div
			v-else
			class="screenshot-placeholder"
		>
			<template v-if="!store.render.setting.browser.screenshotPreview"> <ImageOffIcon /> 截图预览未开启 </template>
			<template v-else-if="process?.status === 'launching'"> <HourglassIcon /> 等待浏览器启动... </template>
			<template v-else> <HourglassIcon /> 等待截图... </template>
		</div>

		<!-- 中心操作按钮组：hover 显示 -->
		<div
			v-if="coverUrl"
			class="card-screenshot-view"
		>
			<div
				class="view-btn"
				@click.stop="previewVisible = true"
			>
				<EyeIcon class="view-icon" />
				<span class="view-text">点击查看</span>
			</div>
			<div
				v-if="isLive"
				class="view-btn"
				@click.stop="pageSwitchVisible = true"
			>
				<AppWindowIcon class="view-icon" />
				<span class="view-text">切换页面</span>
			</div>
		</div>

		<!-- 覆盖层（标题 + 操作），仅覆盖层模式（showOverlay）使用，如简洁模式 -->
		<div
			v-if="showOverlay"
			class="card-screenshot-overlay"
		>
			<div class="card-name-text card-name-white">
				<a-space size="mini"
					><GlobeIcon />
					{{ browser.name }}
				</a-space>
			</div>
			<div class="overlay-actions">
				<slot name="actions">
					<BrowserOperators
						:browser="browser"
						icon-class="fs-5"
					/>
				</slot>
				<!-- 关闭"关闭后的预览图"：恢复正常显示（提示或者备注和标签） -->
				<a-tooltip
					v-if="showClosedPreview"
					content="关闭预览图"
				>
					<a-button
						type="text"
						size="mini"
						@click.stop="dismissClosedPreview"
					>
						<template #icon>
							<XIcon />
						</template>
					</a-button>
				</a-tooltip>
			</div>
		</div>
	</div>

	<!-- 截图大图预览弹窗 -->
	<a-modal
		v-model:visible="previewVisible"
		:footer="false"
		width="auto"
		:mask-closable="true"
		unmount-on-close
		:fullscreen="true"
	>
		<template #title>
			<div class="preview-title">
				<span class="d-flex align-items-center gap-2">
					<GlobeIcon /> {{ browser.name }} - {{ isLive ? '预览中' : '上一次关闭前截图' }}
				</span>
				<BrowserOperators
					v-if="isLive"
					:browser="browser"
					tooltip-position="bottom"
					icon-class="fs-5"
					class="me-3"
					:actions="['front']"
				/>
			</div>
		</template>
		<img
			v-if="coverUrl"
			:src="coverUrl"
			alt="浏览器预览"
			class="screenshot-preview-img"
		/>
	</a-modal>

	<!-- 切换页面弹窗：显示当前浏览器全部可推流页面，点击切换推流目标 -->
	<a-modal
		v-model:visible="pageSwitchVisible"
		title="切换页面"
		:footer="false"
		width="520px"
		unmount-on-close
	>
		<div class="page-list">
			<div
				v-for="page of pageList"
				:key="page.url"
				class="page-item"
				:class="{ active: page.url === process?.screencastPageUrl }"
				@click="switchPage(page.url)"
			>
				<img
					v-if="page.icon && !failedIcons.has(page.url)"
					:src="iconUrl(page.icon)"
					class="page-item-icon"
					@error="failedIcons.add(page.url)"
				/>
				<LanguagesIcon
					v-else
					class="page-item-icon-default"
				/>
				<div class="page-item-text">
					<div class="page-item-title">{{ page.title || page.url }}</div>
					<div class="page-item-url">{{ page.url }}</div>
				</div>
			</div>
			<a-empty
				v-if="pageList.length === 0"
				description="暂无可切换的页面"
			/>
		</div>
	</a-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import BrowserOperators from './BrowserOperators.vue';
import { store } from '../../store';
import { Process, closedPreviews } from '../../utils/process';
import { iconUrl } from '../../utils/index';
import { BrowserOptions } from '../../fs/interface';
import { FRAMERATE_TO_NTH_FRAME, QUALITY_TO_PARAMS } from '../../composables/useScreencastVisibility';
import { ImageOffIcon, HourglassIcon, EyeIcon, AppWindowIcon, XIcon, GlobeIcon, LanguagesIcon } from 'lucide-vue-next';

const props = withDefaults(
	defineProps<{
		browser: BrowserOptions;
		/** 用户手动关闭"关闭后预览图"的记录（uid -> 被关闭时的预览图 URL） */
		dismissed: Map<string, string>;
		/** 是否显示覆盖层（标题 + 操作 + 关闭预览图按钮）。简洁模式用 true，专业模式用 false */
		showOverlay?: boolean;
	}>(),
	{ showOverlay: false }
);

const emit = defineEmits<{
	(e: 'dismiss', uid: string): void;
	/** 大图预览关闭：请求按可见性/画质档位重新同步推流参数 */
	(e: 'resync-screencast'): void;
}>();

const previewVisible = ref(false);

/**
 * 按需高清：打开大图预览时将该浏览器临时切换为 2K 高清推流（列表卡片按显示尺寸低清推流），
 * 关闭弹窗后通知父组件按可见性/画质档位回落，避免常态承担高清成本。
 */
watch(previewVisible, (visible) => {
	const p = process.value;
	if (!p) return;
	if (visible) {
		const nth =
			FRAMERATE_TO_NTH_FRAME[store.render.setting.browser.screenshotFramerate] ?? FRAMERATE_TO_NTH_FRAME.medium;
		p.setScreencastActive(true, { everyNthFrame: nth, ...QUALITY_TO_PARAMS.ultra });
	} else {
		emit('resync-screencast');
	}
});

/** 切换页面弹窗显隐 */
const pageSwitchVisible = ref(false);

/** 运行进程（仅仍在运行时返回） */
const process = computed(() => Process.fromRunning(props.browser.uid));

/** 是否为"浏览器关闭后的预览图" */
const showClosedPreview = computed(() => {
	if (!store.render.setting.browser.screenshotPreview) return false;
	if (process.value) return false;
	const url = closedPreviews.get(props.browser.uid);
	if (!url) return false;
	return props.dismissed.get(props.browser.uid) !== url;
});

/** 封面图 URL：运行中取实时帧，关闭后取保留的最后一帧 */
const coverUrl = computed(() => process.value?.frameUrl || closedPreviews.get(props.browser.uid));

/** 当前展示是否为实时推流（浏览器运行中） */
const isLive = computed(() => Process.isRunning(props.browser.uid));

/** 当前浏览器全部可推流页面（worker 实时更新） */
const pageList = computed(() => process.value?.pages || []);

/** 图标加载失败的页面（url 集合），失败后回退为默认地球图标 */
const failedIcons = reactive(new Set<string>());

/** 切换推流到指定页面并关闭弹窗 */
function switchPage(url: string) {
	process.value?.switchScreencastPage(url);
	pageSwitchVisible.value = false;
}

/** 关闭"关闭后的预览图"，恢复正常显示 */
function dismissClosedPreview() {
	emit('dismiss', props.browser.uid);
}
</script>

<style scoped lang="less">
.card-screenshot {
	position: relative;
	overflow: hidden;
	background-color: var(--theme-card-bg);
	// 固定宽高比，不会超出界面
	aspect-ratio: 16 / 9;
	display: flex;
	align-items: center;
	justify-content: center;
}

.screenshot-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.card-screenshot-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	padding: 8px 12px;
	// 底层浅白色，防止与截图颜色重合
	background: rgba(255, 255, 255, 0.591);
	color: #1d2129;
	display: flex;
	align-items: center;
	justify-content: space-between;

	.card-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 300px;
		font-size: 14px;
	}

	.card-name-white {
		color: #1d2129;
	}

	.overlay-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	:deep(.arco-btn-text) {
		color: rgba(29, 33, 41, 0.75);

		&:hover {
			color: #1d2129;
		}
	}
}

.screenshot-placeholder {
	color: var(--theme-text-color-secondary);
	font-size: 12px;
	text-align: center;
}

/* 中心操作按钮组：hover 截图区域时显示，图标文案蓝色、背景透明 */
.card-screenshot-view {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.2s ease;
	user-select: none;

	.view-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 14px 22px;
		border-radius: var(--border-radius-medium);
		background-color: transparent;
		color: var(--theme-primary-color);
		cursor: pointer;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
		transition: transform 0.2s ease;

		&:hover {
			transform: scale(1.05);
		}
	}

	.view-icon {
		font-size: 30px;
		line-height: 1;
	}

	.view-text {
		font-size: 12px;
		line-height: 1;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}
}

/* 鼠标移入截图区域时显示查看按钮 */
.card-screenshot:hover .card-screenshot-view {
	opacity: 1;
	pointer-events: auto;
}

/** 暗色主题适配：截图浮层为半透明覆盖层，需单独处理（其余由主题变量自动适配） */
body[arco-theme='dark'] & {
	.card-screenshot-overlay {
		background: rgba(40, 40, 42, 0.72);
		color: #ffffff71;

		:deep(.arco-btn-text) {
			color: rgba(255, 255, 255, 0.75);

			&:hover {
				color: #ffffffd9;
			}
		}
	}
}

/* 弹窗标题：浏览器名 + 操作按钮 */
.preview-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
}

/* 截图大图预览弹窗 */
.screenshot-preview-img {
	display: block;
	width: 100%;
	max-height: 80vh;
	object-fit: contain;
	background-color: #000;
}

/* 切换页面弹窗的页面列表 */
.page-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-height: 50vh;
	overflow-y: auto;
}

.page-item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 14px;
	border: 1px solid var(--color-border-2, #e5e6eb);
	border-radius: var(--border-radius-medium);
	cursor: pointer;
	transition: all 0.15s ease;

	&:hover {
		border-color: rgb(var(--primary-6));
		background: rgb(var(--primary-1));
	}

	&.active {
		border-color: rgb(var(--primary-6));
		background: rgb(var(--primary-1));

		.page-item-title {
			color: rgb(var(--primary-6));
		}
	}
}

.page-item-icon {
	width: 24px;
	height: 24px;
	border-radius: 4px;
	flex-shrink: 0;
	object-fit: contain;
}

.page-item-icon-default {
	width: 24px;
	height: 24px;
	font-size: 24px;
	flex-shrink: 0;
	color: var(--color-text-3, #86909c);
}

.page-item-text {
	flex: 1;
	min-width: 0;
}

.page-item-title {
	font-size: 14px;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.page-item-url {
	font-size: 12px;
	color: var(--color-text-3, #86909c);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	margin-top: 2px;
}
</style>

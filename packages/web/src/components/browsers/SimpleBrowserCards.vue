<template>
	<div class="simple-browser-cards">
		<!-- 顶部工具行：固定不滚动（与内容滚动区分离，防止滚动时操作按钮被带走） -->
		<div class="toolbar-fixed">
			<div
				:class="isTile ? 'tile-toolbar' : 'container-md'"
				:style="isTile ? undefined : { maxWidth: cardGridMaxWidth }"
			>
				<div class="layout-switch mb-2 mt-1">
					<a-select
						v-model="store.render.setting.simpleCardColumns"
						size="mini"
						style="width: 124px"
					>
						<template #prefix>布局</template>
						<a-option :value="1">1 列</a-option>
						<a-option :value="2">2 列</a-option>
						<a-option :value="3">3 列</a-option>
						<a-option :value="4">4 列</a-option>
					</a-select>
					<!-- 样式选择框：卡片 / 紧凑（去卡片样式 2px 间隔） / 平铺（全部浏览器去边距平铺铺满） -->
					<a-select
						v-model="store.render.setting.simpleCardStyle"
						size="mini"
						class="ms-2"
						style="width: 96px"
					>
						<a-option value="card">卡片</a-option>
						<a-option value="compact">紧凑</a-option>
						<a-option value="tile">
							<a-tooltip
								content="全部浏览器移除边距平铺铺满整个区域，可配合「仅显示运行中」开关只查看正在运行的浏览器"
								position="bottom"
							>
								平铺
							</a-tooltip>
						</a-option>
					</a-select>
					<!-- 仅显示运行中开关（卡片/紧凑/平铺均生效） -->
					<span class="d-flex align-items-center ms-2">
						<a-switch
							v-model="store.render.setting.simpleRunningOnly"
							size="small"
						/>
						<span
							class="ms-1 text-secondary"
							style="font-size: 12px; white-space: nowrap"
						>
							仅显示运行中
						</span>
					</span>
					<a-button
						type="outline"
						size="mini"
						class="ms-auto"
						@click="switchToProfessional"
					>
						<a-space size="mini"><PanelLeftIcon />专业模式</a-space>
					</a-button>
				</div>
			</div>
		</div>

		<!-- 内容滚动区 -->
		<div class="cards-scroll">
			<div
				:class="isTile ? 'tile-container' : 'container-md'"
				:style="isTile ? undefined : { maxWidth: cardGridMaxWidth }"
			>
				<BeginnerGuide
					v-if="!isTile"
					class="mb-2"
				/>

				<div class="cards-area entities">
					<!-- 无任何浏览器：新建引导卡片 -->
					<template v-if="allBrowsers.length === 0">
						<a-card class="h-100 d-flex justify-content-center flex-wrap align-items-center pb-5">
							<EmptyBrowserCard />
						</a-card>
					</template>
					<!-- 有浏览器但「仅显示运行中」筛选后为空 -->
					<template v-else-if="gridBrowsers.length === 0">
						<a-empty
							class="p-5"
							description="暂无正在运行的浏览器"
						/>
					</template>
					<template v-else>
						<div
							class="cards-grid"
							:class="{ compact: isCompact, tile: isTile }"
							:style="gridStyle"
						>
							<!-- 浏览器卡片 -->
							<template
								v-for="browser in gridBrowsers"
								:key="browser.uid"
							>
								<a-card
									:data-uid="browser.uid"
									class="browser-card entity"
									:class="cardClass(browser)"
									@click="selectBrowser(browser)"
								>
									<!-- 截图封面区域（运行中推流 或 浏览器关闭后保留预览图时独占整个卡片），复用组件 -->
									<BrowserPreview
										v-if="showCover(browser.uid)"
										:browser="browser"
										:dismissed="dismissedClosedPreviews"
										show-overlay
										@dismiss="dismissClosedPreview"
										@resync-screencast="syncAllScreencast"
									/>

									<template #extra>
										<div
											v-if="!showCover(browser.uid)"
											class="d-flex align-items-end"
										>
											<BrowserOperators
												:browser="browser"
												icon-class="fs-5"
											/>
										</div>
									</template>

									<template #title>
										<div
											v-if="!showCover(browser.uid)"
											class="card-name-text"
										>
											<a-space size="mini"
												><GlobeIcon />
												<!-- 重命名状态 -->
												<template v-if="getBrowserInstance(browser.uid)?.renaming">
													<a-input
														v-model="renameValue"
														size="mini"
														@click.stop
														@blur="handleRenameFinish(browser)"
														@keyup.enter="handleRenameFinish(browser)"
													/>
												</template>
												<template v-else>
													{{ browser.name }}
												</template>
											</a-space>
										</div>
									</template>

									<a-card-meta v-if="!showCover(browser.uid)">
										<template #description>
											<!-- 备注/描述：为空时回退为自动化程序信息（敏感信息掩码） -->
											<div
												v-if="getDisplayNotes(browser).text"
												class="card-notes"
												:title="getDisplayNotes(browser).text"
											>
												<span
													v-if="getDisplayNotes(browser).isAuto"
													class="card-notes-autoflag"
												>
													自动
												</span>
												{{ getDisplayNotes(browser).text }}
											</div>
											<div
												v-else
												style="font-size: 12px"
												class="text-center text-secondary"
											>
												<IconInfoCircleFill /> 点击 启动 运行浏览器。<br />
												单击 设置浏览器
											</div>
										</template>

										<template #avatar>
											<!-- 标签 -->
											<div
												v-if="browser.tags.length"
												class="card-tags"
											>
												<Tags
													:tags="browser.tags"
													:read-only="true"
													size="small"
												/>
											</div>
										</template>
									</a-card-meta>
								</a-card>
							</template>

							<!-- 新增浏览器卡片（仅显示运行中时隐藏） -->
							<div
								v-if="!store.render.setting.simpleRunningOnly"
								class="browser-card add-card"
								@click="handleAddBrowser"
							>
								<CirclePlusIcon class="add-icon" />
								<span class="mb-3">新建浏览器</span>
								<span
									class="text-secondary"
									style="font-size: 11px"
								>
									特性：
									<a-space>
										<a-tag>数据隔离</a-tag>
										<a-tag>账号多开</a-tag>
									</a-space>
								</span>
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onActivated, watch, nextTick } from 'vue';
import Tags from '../Tags.vue';
import BrowserOperators from './BrowserOperators.vue';
import { store } from '../../store';
import { root } from '../../fs/folder';
import { Browser } from '../../fs/browser';
import { Process, processes, closedPreviews, restoreClosedPreviews } from '../../utils/process';
import { useScreencastVisibility } from '../../composables/useScreencastVisibility';
import { BrowserOptions } from '../../fs/interface';
import { newBrowserOrInit } from '../../utils/browser';
import EmptyBrowserCard from '../EmptyBrowserCard.vue';
import BeginnerGuide from '../BeginnerGuide.vue';
import BrowserPreview from './BrowserPreview.vue';
import { getDisplayNotes } from '../../utils/display-notes';
import { CirclePlusIcon, PanelLeftIcon, GlobeIcon } from 'lucide-vue-next';

/** 获取所有浏览器（递归） */
const allBrowsers = computed(() => {
	return root().findAll((e) => e.type === 'browser') as BrowserOptions[];
});

/** 获取浏览器实例 */
function getBrowserInstance(uid: string): Browser | undefined {
	return Browser.from(uid);
}

/** 浏览器是否已启动（仍在运行且状态为 launched） */
function isLaunched(uid: string): boolean {
	return Process.fromRunning(uid)?.status === 'launched';
}

/** 用户手动关闭"关闭后预览图"的记录（uid -> 被关闭时的预览图 URL，新一轮启动+关闭产生新帧后重新展示） */
const dismissedClosedPreviews = reactive(new Map<string, string>());

/**
 * 是否显示"浏览器关闭后的预览图"：
 * 开启预览图显示、浏览器未在运行、存在保留帧且未被用户手动关闭。
 * 覆盖卡片上的提示信息以及备注和标签。
 */
function showClosedPreview(uid: string): boolean {
	if (!store.render.setting.browser.screenshotPreview) return false;
	if (Process.fromRunning(uid)) return false;
	const url = closedPreviews.get(uid);
	if (!url) return false;
	return dismissedClosedPreviews.get(uid) !== url;
}

/** 关闭"关闭后的预览图"，恢复正常的显示（提示或者备注和标签） */
function dismissClosedPreview(uid: string) {
	const url = closedPreviews.get(uid);
	if (url) {
		dismissedClosedPreviews.set(uid, url);
	}
}

/** 是否显示截图封面（运行中推流 或 浏览器关闭后保留的预览图） */
function showCover(uid: string): boolean {
	const live = isLaunched(uid) && store.render.setting.browser.screenshotPreview;
	return live || showClosedPreview(uid);
}

/** 计算浏览器卡片的 class */
function cardClass(browser: BrowserOptions) {
	return {
		'has-screenshot': showCover(browser.uid)
	};
}

/** 选中浏览器，显示操作面板 */
function selectBrowser(browser: BrowserOptions) {
	store.render.browser.currentBrowserUid = browser.uid;
}

/** 新增浏览器 */
function handleAddBrowser() {
	newBrowserOrInit();
}

/** 切换到专业模式 */
function switchToProfessional() {
	store.render.setting.mode = 'professional';
}

/** 卡片样式：平铺模式（全部浏览器去边距平铺铺满，可开关仅显示运行中） */
const isTile = computed(() => store.render.setting.simpleCardStyle === 'tile');

/** 卡片样式：紧凑模式（移除卡片样式，2px 间隔） */
const isCompact = computed(() => store.render.setting.simpleCardStyle === 'compact');

/** 网格中实际展示的浏览器：开启「仅显示运行中」时为运行中的子集（任何模式生效），否则为全部 */
const gridBrowsers = computed(() => {
	if (store.render.setting.simpleRunningOnly) {
		return allBrowsers.value.filter((b) => Process.fromRunning(b.uid));
	}
	return allBrowsers.value;
});

/** 网格内联样式：平铺模式移除 container/宽度约束（保留列数控制），平铺铺满整个区域 */
const gridStyle = computed(() => {
	if (isTile.value) {
		return { '--simple-card-columns': store.render.setting.simpleCardColumns };
	}
	return {
		'--simple-card-columns': store.render.setting.simpleCardColumns,
		'--card-max-width': cardGridMaxWidth.value,
		/* 最小宽度仅作用于卡片网格：顶部工具行不受限，防止右对齐按钮超出可视区域无法点击 */
		minWidth: cardGridMinWidth.value
	};
});

/** 卡片网格最大宽度：3/4 列时加宽，避免卡片被挤得太小 */
const cardGridMaxWidth = computed(() => {
	const cols = store.render.setting.simpleCardColumns;
	if (cols >= 4) return '1500px';
	if (cols === 3) return '1200px';
	return '800px';
});

/** 卡片网格最小宽度：大于 2 列时设置下限（按每列约 300px 估算），窗口过窄时横向滚动兜底而非挤压卡片 */
const cardGridMinWidth = computed(() => {
	const cols = store.render.setting.simpleCardColumns;
	if (cols >= 4) return '1280px';
	if (cols === 3) return '960px';
	return '0px';
});

/** 重命名临时值 */
const renameValue = ref('');

/** 处理重命名完成 */
function handleRenameFinish(browser: BrowserOptions) {
	const instance = Browser.from(browser.uid);
	if (instance) {
		instance.rename(renameValue.value || browser.name);
	}
}

/** 监听重命名状态，初始化值并自动聚焦输入框 */
watch(
	() => allBrowsers.value.find((b) => getBrowserInstance(b.uid)?.renaming),
	(renamingBrowser) => {
		if (renamingBrowser) {
			renameValue.value = renamingBrowser.name;
			nextTick(() => {
				const input = document.querySelector('.browser-card .arco-input') as HTMLInputElement;
				if (input) {
					input.focus();
					input.select();
				}
			});
		}
	}
);

/** 卡片可见性驱动 Page.startScreencast 启停（仅可见卡片推流，滚出视口自动停止） */
const { refresh: refreshScreencast, syncAll: syncAllScreencast } = useScreencastVisibility({
	cardSelector: '.browser-card[data-uid]',
	root: () => document.querySelector('.cards-scroll')
});

/** 进程状态快照，uid:status 变化时触发预览同步 */
const processesSnapshot = computed(() => processes.map((p) => `${p.uid}:${p.status}`).join('|'));

watch([() => allBrowsers.value.length, processesSnapshot], () => {
	nextTick(refreshScreencast);
});

onMounted(() => {
	// 确保浏览器详情面板已关闭
	store.render.browser.currentBrowserUid = '';
	// 从磁盘恢复上次软件退出前保留的"浏览器关闭后预览图"
	restoreClosedPreviews(allBrowsers.value);
	nextTick(refreshScreencast);
});

// 页面经 keep-alive 缓存，重新激活时 observer 不会对"本就可见"的卡片重复触发，需主动刷新推流
onActivated(() => {
	nextTick(refreshScreencast);
});
</script>

<style lang="less" scoped>
.simple-browser-cards {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	background-color: var(--theme-bg-color-deep);
}

/* 顶部工具行容器：固定不滚动 */
.toolbar-fixed {
	flex-shrink: 0;
}

/* 内容滚动区：卡片列表（含横向最小宽度兜底）在此滚动 */
.cards-scroll {
	flex: 1;
	min-height: 0;
	overflow: auto;
	padding: 2px 0px;
}

/* 顶部工具行：左侧卡片列数选择 + 紧凑开关，右侧布局切换按钮（与卡片网格同容器，边缘自然对齐） */
.layout-switch {
	display: flex;
	align-items: center;
	flex-shrink: 0;
	padding: 6px 0;

	/* 切换按钮对齐灰色 outline（覆盖 arco outline 的主题色边框），防止与浅灰背景重合；
	   文字颜色对齐 arco 默认按钮的次级文本色（--color-text-2），与专业模式切换按钮一致 */
	:deep(.arco-btn-outline) {
		border-color: var(--theme-border-color);
		color: var(--color-text-2);

		&:hover {
			border-color: var(--theme-primary-color);
			color: var(--theme-text-color);
		}
	}

	/* 两个选择框（布局列数/样式）对齐专业模式操作区的 outline 样式：透明底 + 浅灰边框 */
	:deep(.arco-select-view-single) {
		background-color: transparent;
		border: 1px solid var(--theme-border-color);

		&:hover {
			border-color: var(--theme-primary-color);
		}
	}
}

.cards-grid {
	display: grid;
	/* minmax(0, 1fr)：忽略各卡片内容 min-content 差异，所有列严格等宽。
	   裸 1fr 的最小值是 auto（按内容撑），文本多的卡片会挤压带预览推流的卡片 */
	grid-template-columns: repeat(var(--simple-card-columns, 2), minmax(0, 1fr));
	gap: 16px;
	max-width: var(--card-max-width, 900px);
	margin: 0 auto;
}

/* 平铺模式：移除外侧 margin/container 约束，卡片平铺铺满整个区域 */
.tile-container {
	height: 100%;
	display: flex;
	flex-direction: column;
}

/* 平铺模式顶部操作栏：平铺铺满，与下方浏览器区域左右对齐 */
.tile-toolbar {
	padding: 0 2px;
}

.tile-area {
	flex: 1;
	min-height: 0;
}

.cards-grid.tile {
	/* 与布局选项联动的列数，平铺铺满，不受最大宽度约束 */
	grid-template-columns: repeat(var(--simple-card-columns, 2), minmax(0, 1fr));
	gap: 2px;
	max-width: none;
	min-width: 0;
	margin: 0;
	padding: 0;

	.browser-card {
		border: none;
		border-radius: 0 !important;
		box-shadow: none !important;
		aspect-ratio: 16 / 9;

		&:hover {
			border-color: transparent;
			box-shadow: none !important;
			transform: none;
		}
	}

	.add-card {
		/* 平铺模式下保留虚线边框，仍可辨识为新建入口（browser-card 的 border:none 会命中，需在此恢复） */
		border: 1px dashed var(--theme-border-color-strong);
	}
}

/* 紧凑模式：移除全部卡片样式（边框/圆角/悬浮阴影位移），浏览器间仅 2px 间隔。
   注意 arco-custom.less 对 .arco-card 的圆角/阴影带 !important，此处必须同级对抗 */
.cards-grid.compact {
	gap: 2px;

	.browser-card {
		border: none;
		border-radius: 0 !important;
		box-shadow: none !important;

		&:hover {
			border-color: transparent;
			box-shadow: none !important;
			transform: none;
		}
	}

	.add-card {
		/* 紧凑模式下保留虚线边框，仍可辨识为新建入口
		   （新建卡片同时带 browser-card 类，上方 border:none 会命中它，需在此恢复） */
		border: 1px dashed var(--theme-border-color-strong);
		border-radius: 0 !important;
		min-height: 60px;

		&:hover {
			background-color: transparent;
		}
	}
}

.browser-card {
	/* 默认 16:9 标准化宽高比（内容超出时高度可自适应撑开） */
	aspect-ratio: 16 / 9;
	background: transparent;
	border: 1px solid var(--theme-border-color-light);
	border-radius: 8px;
	cursor: pointer;
	transition: all 0.2s ease;
	background-color: var(--theme-card-bg);

	&:hover {
		border-color: var(--theme-primary-color);
		box-shadow: 0 4px 12px var(--theme-shadow-color);
		transform: translateY(-2px);
	}

	&:active {
		transform: translateY(0);
	}

	// 有截图时：隐藏 header，body 零内边距，截图铺满卡片
	// 卡片自身 overflow:hidden 配合圆角统一裁剪截图，避免 body 圆角小于
	// 卡片内圆角时截图背景溢出、遮挡卡片 border 四个角（hover 激活边框）
	&.has-screenshot {
		overflow: hidden;

		:deep(.arco-card-header) {
			display: none;
		}

		:deep(.arco-card-body) {
			padding: 0;
			overflow: hidden;
		}
	}

	.card-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 300px;
		font-size: 14px;
	}

	.card-tags {
		margin-bottom: 6px;
	}

	.card-notes {
		font-size: 12px;
		color: var(--theme-text-color-secondary);
		line-height: 1.5;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		// 加高显示行数，保证自动化程序信息（账号/学校/学号等多行）可见，超出仍省略
		-webkit-line-clamp: 5;
		-webkit-box-orient: vertical;
		// 任意位置允许断行，防止长链接/长账号/长中文串不换行导致备注区域超出卡片界面
		overflow-wrap: anywhere;
		word-break: break-all;
		white-space: pre-line;
		cursor: default;
		// 约束最大宽度不超过卡片内容区，避免溢出
		max-width: 100%;

		.card-notes-autoflag {
			display: inline-block;
			padding: 0 5px;
			margin-right: 4px;
			border-radius: 4px;
			font-size: 11px;
			line-height: 16px;
			color: var(--theme-primary-color);
			background-color: var(--theme-primary-bg, rgba(var(--primary-6), 0.12));
			vertical-align: 1px;
		}
	}
}

.add-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 120px;
	border: 1px dashed var(--theme-border-color-strong);
	background-color: transparent;

	&:hover {
		border-color: var(--theme-primary-color);
		background-color: var(--theme-hover-bg);
	}

	.add-icon {
		font-size: 32px;
		margin-bottom: 8px;
	}
}

/** 响应式：小屏幕单列 */
@media (max-width: 600px) {
	.cards-grid {
		grid-template-columns: 1fr;
	}
}

::deep(.arco-card-meta-footer) {
	align-items: start !important;
}

// 备注与标签并排布局时，约束内容区不超出卡片，防止宽内容溢出
::deep(.arco-card-meta-content) {
	flex: 1;
	min-width: 0;
}
</style>

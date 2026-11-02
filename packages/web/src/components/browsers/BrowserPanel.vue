<template>
	<div class="profile">
		<!-- 用 v-show 而非 v-if：Tags 的添加弹窗挂载在组件内部，v-if 卸载会导致操作栏「添加标签」按钮失效 -->
		<a-descriptions
			v-show="instance.tags.length > 0 || displayNotes.text"
			:column="1"
			size="large"
			class="mt-2 ps-2 pe-2"
		>
			<a-descriptions-item
				v-show="instance.tags.length > 0"
				label="标签分类"
			>
				<div>
					<Tags
						ref="tagsRef"
						v-model:tags="instance.tags"
						size="small"
						hide-add
						@create="createTag"
						@remove="removeTag"
					></Tags>
				</div>
			</a-descriptions-item>
			<a-descriptions-item
				v-if="displayNotes.text"
				label="备注描述"
			>
				<div class="notes-display">{{ displayNotes.text }}</div>
			</a-descriptions-item>
		</a-descriptions>

		<!-- 缩略图推流（仅专业模式 + 开启预览 + 浏览器运行中）：打开面板开始推流，关闭面板停止。
		     简洁模式不添加：卡片网格中已有缩略图显示 -->
		<div
			v-if="showPanelPreview"
			ref="previewRef"
			class="panel-preview mb-2"
		>
			<BrowserPreview
				:browser="instance"
				:dismissed="emptyDismissed"
				@resync-screencast="syncPanelScreencast(true)"
			/>
		</div>

		<a-card
			:bordered="false"
			title="自动化程序"
			class="automation-section"
		>
			<template #extra>
				<a-tooltip position="bottom">
					<template #content>
						启动浏览器后会自动运行 <code>自动化程序</code><br />
						根据不同配置运行例如：自动登录、自动点击等。
						<a-divider class="mt-1 mb-1" />
						提示1：自动化程序拥有操控页面的所有权限，与用户脚本不同的是，用户脚本是运行在页面中，权限比较少。<br />
						提示2：通常用来辅助用户脚本一起配合运行。<br />
						提示3：输入的配置例如账号密码将由软件加密存储，以保证数据安全。
					</template>

					<a-button
						type="primary"
						@click="state.showAutomationScriptSelector = true"
					>
						<PlusIcon /> 添加自动化程序
					</a-button>
				</a-tooltip>
			</template>
			<div>
				<UsageAlertCollapse
					v-model:collapse="store.render.state.read_record.automation_script_usage"
					class="mb-2"
					banner
					title="使用提示"
					:html="
						t(
							'simple_mode_index_automation_script_usage',
							'启动浏览器后会自动运行 <code>自动化程序</code><br />根据不同配置运行例如：自动登录、自动点击等。'
						)
					"
				>
					启动浏览器后会自动运行 <code>自动化程序</code><br />
					根据不同配置运行例如：自动登录、自动点击等。
				</UsageAlertCollapse>

				<div class="mt-2">
					<AutomationScripts v-model:automation-scripts="instance.automationScripts"></AutomationScripts>
				</div>
			</div>
		</a-card>

		<a-divider> </a-divider>

		<a-collapse :default-active-key="[1]">
			<a-collapse-item
				key="1"
				header="基础信息"
			>
				<a-descriptions
					:column="1"
					class="ps-2 pe-2 mb-2"
				>
					<a-descriptions-item label="创建时间">
						<span style="font-size: 12px">{{ datetime(instance.createTime) }}</span>
					</a-descriptions-item>
					<a-descriptions-item label="文件位置">
						<span style="font-size: 12px">
							{{
								Folder.from(instance.parent)
									?.flatParents()
									.map((f) => f.name)
									.join(' / ')
							}}
						</span>
						<a-button
							type="text"
							size="mini"
							@click="instance?.location()"
						>
							跳转到该目录
						</a-button>
					</a-descriptions-item>
					<a-descriptions-item
						v-if="state.cachePathExists"
						label="缓存路径"
					>
						<span
							class="text-secondary pointer"
							style="font-size: 12px"
							@click="open(instance.cachePath)"
						>
							{{ instance.cachePath }} <FolderIcon />
						</span>
					</a-descriptions-item>

					<a-descriptions-item label="文件数据">
						<a-button
							size="mini"
							@click="state.showCode = true"
						>
							点击查看
						</a-button>
						<a-modal
							v-model:visible="state.showCode"
							:footer="false"
							:simple="true"
							:width="600"
							modal-class="p-0 m-0"
						>
							<div
								class="m-3"
								style="height: 70vh; overflow: overlay"
							>
								<a-textarea
									:auto-size="true"
									:disabled="true"
									:model-value="JSON.stringify(instance, null, 4)"
								></a-textarea>
							</div>
						</a-modal>
					</a-descriptions-item>
				</a-descriptions>
			</a-collapse-item>
			<a-collapse-item
				key="2"
				header="日志输出"
			>
				<XTerm :uid="instance.uid"></XTerm>
			</a-collapse-item>
			<a-collapse-item
				key="3"
				header="操作历史"
			>
				<div class="histories">
					<template v-if="instance.histories.length">
						<a-button
							size="mini"
							class="mb-2"
						>
							<a-space size="mini"
								><Trash2Icon @click="clearHistory" />
								清空
							</a-space>
						</a-button>

						<a-table
							size="small"
							:data="instance.histories.sort((a, b) => b.time - a.time)"
							:pagination="{
								pageSizeOptions: [10, 20, 50, 100],
								showPageSize: true,
								size: 'mini'
							}"
							:scroll="{
								x: 800
							}"
							:columns="[
								{
									dataIndex: 'time',
									title: '时间',
									slotName: 'time',
									width: 110
								},
								{
									title: '操作',
									dataIndex: 'action',
									width: 100
								},
								{
									title: '备注',
									dataIndex: 'content',
									slotName: 'content'
								}
							]"
						>
							<template #time="{ record }">
								<a-tooltip :content="datetime(record.time)">
									<span>{{ relativeTime(record.time) }}</span>
								</a-tooltip>
							</template>
							<template #content="{ record }">
								<a-tooltip :content="record.content || '无备注'">
									<div
										style="
											text-overflow: ellipsis;
											overflow: hidden;
											display: -webkit-box;
											-webkit-line-clamp: 3;
											-webkit-box-orient: vertical;
										"
									>
										{{ record.content || '-' }}
									</div>
								</a-tooltip>
							</template>
						</a-table>
					</template>

					<a-empty v-else />
				</div>
			</a-collapse-item>
		</a-collapse>

		<a-modal
			v-model:visible="state.showAutomationScriptSelector"
			:footer="false"
			unmount-on-close
		>
			<template #title> 选择自动化程序 </template>
			<AutomationScriptSelector
				:automation-scripts="instance.automationScripts"
				@confirm="
					(as) => {
						instance.automationScripts = as;
						state.showAutomationScriptSelector = false;
					}
				"
			></AutomationScriptSelector>
		</a-modal>
	</div>
</template>

<script setup lang="ts">
import { store } from '../../store';
import { t } from '../../utils/langs';
import { Browser } from '../../fs/browser';
import { datetime, relativeTime } from '../../utils';
import Tags from '../Tags.vue';
import { BrowserOptions, Tag } from '../../fs/interface';
import { Folder } from '../../fs/folder';
import { currentBrowser } from '../../fs/index';
import { reactive, onMounted, onUnmounted, nextTick, ref, computed, watch } from 'vue';
import AutomationScriptSelector from '../automation-scripts/AutomationScriptSelector.vue';
import AutomationScripts from '../automation-scripts/AutomationScriptList.vue';
import XTerm from '../XTerm.vue';
import BrowserPreview from './BrowserPreview.vue';
import { Process } from '../../utils/process';
import { FRAMERATE_TO_NTH_FRAME, QUALITY_TO_PARAMS } from '../../composables/useScreencastVisibility';
import { electron } from '../../utils/node';
import { remote } from '../../utils/remote';
import UsageAlertCollapse from '../UsageAlertCollapse.vue';
import { getDisplayNotes } from '../../utils/display-notes';
import { PlusIcon, Trash2Icon, FolderIcon } from 'lucide-vue-next';

const props = defineProps<{
	browser: BrowserOptions;
}>();

// 这里因为 BrowserPanel 使用的是侧边栏，侧边栏关闭时会自动销毁对象，所以不用做 compute 计算处理
const instance = Browser.from(props.browser.uid);

const state = reactive({
	showCode: false,
	showAutomationScriptSelector: false,
	cachePathExists: false
});

/** 展示的备注：用户备注优先，为空时由自动化程序信息构建（敏感信息已掩码） */
const displayNotes = computed(() => getDisplayNotes(instance));

/** 标签列表引用：添加入口外置到操作栏，通过 expose 转发打开添加弹窗 */
const tagsRef = ref<InstanceType<typeof Tags>>();

defineExpose({
	openAddTagModal: () => tagsRef.value?.openAddModal()
});

/** 面板缩略图推流：运行进程（仅仍在运行时返回） */
const panelProcess = computed(() => Process.from(props.browser.uid));

/** 是否展示面板缩略图推流：仅专业模式（简洁模式卡片网格已有缩略图）+ 开启截图预览 + 浏览器运行中 */
const showPanelPreview = computed(
	() =>
		store.render.setting.mode === 'professional' &&
		store.render.setting.browser.screenshotPreview &&
		!!panelProcess.value
);

/** 预览区元素引用：帧尺寸按显示宽度 × DPR 计算（16:9），封顶用户画质档位 */
const previewRef = ref<HTMLElement>();

/** BrowserPreview 的 dismissed 参数：面板仅展示运行中推流，不涉及关闭后预览图，传空集合 */
const emptyDismissed = reactive(new Map<string, string>());

/** 按面板预览区显示宽度计算推流帧参数（对齐卡片 resolveFrameParams 逻辑） */
function resolvePanelFrameParams() {
	const everyNthFrame =
		FRAMERATE_TO_NTH_FRAME[store.render.setting.browser.screenshotFramerate] ?? FRAMERATE_TO_NTH_FRAME.medium;
	const cap = QUALITY_TO_PARAMS[store.render.setting.browser.screenshotQuality] ?? QUALITY_TO_PARAMS.medium;
	let { maxWidth, maxHeight } = cap;
	const displayW = previewRef.value?.getBoundingClientRect().width;
	if (displayW && displayW > 0) {
		const dpr = window.devicePixelRatio || 1;
		const w = Math.round(displayW * dpr);
		maxWidth = Math.min(w, cap.maxWidth);
		maxHeight = Math.min(Math.round((w * 9) / 16), cap.maxHeight);
	}
	return { everyNthFrame, maxWidth, maxHeight, quality: cap.quality };
}

/** 面板推流开关：active=true 按面板参数启动，false 停止释放资源 */
function syncPanelScreencast(active: boolean) {
	const p = panelProcess.value;
	if (!p || p.status !== 'launched') return;
	if (active && showPanelPreview.value) {
		p.setScreencastActive(true, resolvePanelFrameParams());
	} else {
		p.setScreencastActive(false);
	}
}

// 打开面板时浏览器可能仍在启动中，状态变为 launched 后启动推流
watch(
	() => panelProcess.value?.status,
	(status) => {
		if (status === 'launched') {
			nextTick(() => syncPanelScreencast(true));
		}
	}
);

onUnmounted(() => {
	// 关闭浏览器菜单（面板卸载）时停止推流
	syncPanelScreencast(false);
});

function createTag(tag: Tag) {
	if (store.render.browser.tags[tag.name]) {
		store.render.browser.tags[tag.name].count += 1;
	} else {
		store.render.browser.tags[tag.name] = {
			color: tag.color,
			count: 1
		};

		currentBrowser.value?.histories.unshift({
			action: '添加标签',
			content: tag.name,
			time: Date.now()
		});
	}
}
function removeTag(tag: Tag) {
	if (store.render.browser.tags[tag.name] && store.render.browser.tags[tag.name].count > 1) {
		store.render.browser.tags[tag.name].count -= 1;
	} else {
		Reflect.deleteProperty(store.render.browser.tags, tag.name);
	}

	currentBrowser.value?.histories.unshift({ action: '删除标签', content: tag.name, time: Date.now() });
}

function clearHistory() {
	if (currentBrowser.value) {
		currentBrowser.value.histories = [];
	}
}

/** 渲染侧边toc跳转栏 */
onMounted(() => {
	nextTick(async () => {
		state.cachePathExists = await remote.fs.call('existsSync', props.browser.cachePath);
		// 打开面板即开始缩略图推流（浏览器已在运行时；启动中的由 status watch 接管）
		syncPanelScreencast(true);
	});
});

async function open(p: string) {
	if (await remote.fs.call('existsSync', p)) {
		electron.shell.openPath(p);
	}
}
</script>

<style scoped lang="less">
.profile {
	:deep(.arco-descriptions-item-label) {
		white-space: nowrap;
		vertical-align: top;
	}
}

.automation-section {
	/* 自动化程序区域卡片去阴影：arco-custom.less 对 .arco-card 的阴影带 !important，需同级对抗 */
	box-shadow: none !important;
}

.script-icon-fallback {
	width: 18px;
	height: 18px;
}

/* 备注展示文本：保留换行，自动化程序信息构建的备注为多行 */
.notes-display {
	white-space: pre-wrap;
	word-break: break-all;
	font-size: 12px;
}
</style>

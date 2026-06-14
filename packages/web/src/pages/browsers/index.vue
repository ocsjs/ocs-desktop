<template>
	<div
		id="browsers"
		class="h-100 browsers-page"
	>
		<a-spin
			class="w-100 h-100 browsers-spin"
			:loading="
				!state.isCurrentBrowserSupported ||
				state.supportedBrowser === undefined ||
				state.supportedExtension === undefined ||
				state.validUserScript === undefined
			"
		>
			<!-- ====================== 环境修复部分 ====================== -->

			<template #icon>
				<div class="shadow">
					<a-alert
						title="软件异常"
						style="width: 600px"
						class="rounded"
						type="error"
						show-icon
					>
						<div>{{ lang('browser_page_environment_error_notice', '软件环境存在问题，将会影响浏览器的正常启动') }}</div>
						<template v-if="!state.isCurrentBrowserSupported">
							<div>
								原因：{{
									lang('browser_page_environment_error_current_browser_not_supported', '当前浏览器版本不受支持')
								}}
							</div>
						</template>
						<template v-else-if="!state.supportedBrowser">
							<div>原因：{{ lang('browser_page_environment_error_no_browser_detected', '未检测到可用的浏览器') }}</div>
						</template>
						<template v-else-if="!state.supportedExtension">
							<div>原因：{{ lang('browser_page_environment_error_no_extension_detected', '未安装脚本管理器') }}</div>
						</template>

						<a-button
							class="mt-2"
							size="mini"
							type="primary"
							@click="state.setupVisible = true"
						>
							一键修复
						</a-button>
					</a-alert>
				</div>
			</template>

			<Setup
				v-if="state.setupVisible"
				v-model:visible="state.setupVisible"
				confirm-text="环境修复"
				cancel-text="稍后再说"
				title=""
				:create-new-browser="false"
				@close="
					async () => {
						state.setupVisible = false;
						await updateEnvironmentDetect();
					}
				"
			></Setup>

			<!-- ====================== 浏览器列表内容部分 ======================-->

			<a-card
				class="operations-card"
				:bordered="true"
				size="small"
			>
				<div class="operations">
					<!-- 路径栏 / 统计栏 -->
					<FileBreadcrumb
						v-if="currentSearchedEntities === undefined && currentFolder.type !== 'root'"
						:key="currentFolder.uid"
					></FileBreadcrumb>
					<div
						v-else-if="currentSearchedEntities === undefined && currentFolder.type === 'root'"
						class="stats-bar"
					>
						<span><icon-desktop /> {{ stats.browsers }}</span>
						<span><icon-code /> {{ stats.scripts }}</span>
						<span><icon-folder /> {{ stats.folders }}</span>
						<span><icon-tag /> {{ stats.tags }}</span>
					</div>
					<!-- 撑开间距，将搜索和筛选推到最右边 -->
					<div class="flex-grow-1"></div>
					<!-- 文件筛选 -->
					<FileFilters></FileFilters>

					<!-- 搜索时禁止文件操作 -->
					<template v-if="currentSearchedEntities">
						<a-button
							size="mini"
							@click="resetSearch"
						>
							<Icon type="restart_alt"> 重置 </Icon>
						</a-button>
					</template>
				</div>

				<!-- 文件操作 -->
				<FileMultipleOperators></FileMultipleOperators>
			</a-card>

			<template v-if="currentSearchedEntities !== undefined && currentSearchedEntities.length === 0">
				<a-empty
					class="p-3"
					description="暂无浏览器搜索结果"
				></a-empty>
			</template>

			<div class="entities-wrapper">
				<Transition
					name="entities-slide"
					appear
				>
					<div
						:key="currentFolder.uid"
						class="entities-container"
					>
						<!-- 显示浏览器以及文件夹列表 -->
						<div class="entities">
							<BrowserList
								:entities="currentSearchedEntities ? currentSearchedEntities : currentEntities || []"
							></BrowserList>
						</div>
						<!-- 右键菜单提示 -->
						<div class="context-hint"><icon-right-circle /> 右键浏览器/空白处可打开菜单</div>
					</div>
				</Transition>
			</div>
		</a-spin>
	</div>
</template>

<script setup lang="ts">
import Icon from '../../components/Icon.vue';
import { resetSearch } from '../../utils/entity';
import FileFilters from '../../components/browsers/FileFilters.vue';
import FileBreadcrumb from '../../components/browsers/FileBreadcrumb.vue';
import { currentEntities, currentSearchedEntities, currentFolder } from '../../fs';
import { root } from '../../fs/folder';
import FileMultipleOperators from '../../components/browsers/FileMultipleOperators.vue';
import BrowserList from '../../components/BrowserList.vue';
import { Environment } from '../../utils//environment';
import { reactive, onActivated, watch, computed } from 'vue';
import type { ValidBrowser } from '../../../../common/lib/src/interface';
import Setup from '../../components/Setup.vue';
import { IconRightCircle, IconDesktop, IconTag, IconCode, IconFolder } from '@arco-design/web-vue/es/icon';
import { lang, store } from '../../store';

const stats = computed(() => {
	const r = root();
	const allBrowsers = r.findAll((e) => e.type === 'browser');
	const allFolders = r.findAll((e) => e.type === 'folder');
	console.log(allBrowsers);

	const tagSet = new Set<string>();
	for (const b of allBrowsers) {
		if (b.type === 'browser') {
			b.tags.forEach((t) => tagSet.add(t.name));
		}
	}
	return {
		browsers: allBrowsers.length,
		folders: allFolders.length,
		tags: tagSet.size,
		scripts: store.render.scripts.length
	};
});

const state = reactive({
	isCurrentBrowserSupported: true,
	supportedBrowser: null as ValidBrowser | undefined | null,
	supportedExtension: null as any | undefined | null,
	validUserScript: null as any | undefined | null,
	setupVisible: false
});

watch(
	() => [store.render.state.setup, state.setupVisible],
	() => {
		updateEnvironmentDetect();
	}
);

onActivated(() => {
	updateEnvironmentDetect();
});

async function updateEnvironmentDetect() {
	await Environment.init();
	const [isCurrentBrowserSupported, supportedBrowser, supportedExtension, validUserScript] = await Promise.all([
		Environment.isCurrentBrowserSupported(),
		Environment.getSupportedBrowser(),
		Environment.getSupportedExtension(),
		Environment.getValidUserScript()
	]);
	state.isCurrentBrowserSupported = isCurrentBrowserSupported;
	state.supportedBrowser = supportedBrowser;
	state.supportedExtension = supportedExtension;
	state.validUserScript = validUserScript;
}
</script>

<style scoped lang="less">
.browsers-page {
	display: flex;
	flex-direction: column;
}

.browsers-spin {
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.operations-card {
	flex-shrink: 0;
	margin: 6px 8px 0;
}

.operations {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: nowrap;
	overflow-x: auto;
	overflow-y: hidden;
}

.entities-wrapper {
	flex: 1;
	min-height: 0;
	position: relative;
	overflow: hidden;
}

.entities-container {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.entities {
	flex: 1;
	min-height: 0;
	overflow: overlay;

	padding: 4px 12px 0;
}

.context-hint {
	flex-shrink: 0;
	font-size: 11px;
	color: #aaa;
	text-align: right;
	padding: 4px 4px 8px 0;
	user-select: none;
}

.stats-bar {
	display: flex;
	align-items: center;
	gap: 16px;
	font-size: 12px;
	color: #86909c;
	white-space: nowrap;
	user-select: none;

	span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
}

/* 浏览器列表过渡动画 */
.entities-slide-enter-active {
	transition: opacity 0.2s ease 0.2s, transform 0.2s ease 0.2s;
}
.entities-slide-leave-active {
	transition: opacity 0.15s ease, transform 0.15s ease;
}
.entities-slide-enter-from {
	opacity: 0;
	transform: translateY(8px);
}
.entities-slide-leave-to {
	opacity: 0;
	transform: translateY(8px);
}
</style>

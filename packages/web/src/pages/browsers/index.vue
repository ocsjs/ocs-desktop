<template>
	<div
		id="browsers"
		class="h-100"
	>
		<a-spin
			class="w-100 h-100"
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
				:create-new-browser="false"
				@close="
					async () => {
						state.setupVisible = false;
						await updateEnvironmentDetect();
					}
				"
			></Setup>

			<!-- ====================== 浏览器列表内容部分 ======================-->

			<div class="col-12 p-1 ps-2 pe-2 operations">
				<!-- 路径栏 -->
				<!-- 当处于搜索状态时隐藏 -->
				<FileBreadcrumb v-show="currentSearchedEntities === undefined"></FileBreadcrumb>
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

			<template v-if="currentEntities.length === 0">
				<div
					class="d-flex"
					style="height: 50vh"
				>
					<a-empty class="p-3 m-auto">
						<div class="mb-3">暂无浏览器</div>

						<a-space>
							<a-button
								type="outline"
								size="mini"
								@click="about"
							>
								<Icon type="book">点击查看使用教程</Icon>
							</a-button>

							<a-button
								type="outline"
								size="mini"
								@click="newBrowser()"
							>
								<Icon type="web">新建浏览器</Icon>
							</a-button>
						</a-space>
					</a-empty>
				</div>
			</template>
			<template v-else-if="currentSearchedEntities !== undefined && currentSearchedEntities.length === 0">
				<a-empty
					class="p-3"
					description="暂无浏览器搜索结果"
				></a-empty>
			</template>

			<div
				v-else
				class="col-12 p-2 pt-1 entities-container"
			>
				<!-- 显示浏览器以及文件夹列表 -->
				<div class="entities">
					<BrowserList :entities="currentSearchedEntities ? currentSearchedEntities : currentEntities"></BrowserList>
				</div>
			</div>
		</a-spin>
	</div>
</template>

<script setup lang="ts">
import Icon from '../../components/Icon.vue';
import { resetSearch } from '../../utils/entity';
import FileFilters from '../../components/browsers/FileFilters.vue';
import FileBreadcrumb from '../../components/browsers/FileBreadcrumb.vue';
import { currentEntities, currentSearchedEntities } from '../../fs';
import FileMultipleOperators from '../../components/browsers/FileMultipleOperators.vue';
import { about } from '../../utils';
import BrowserList from '../../components/BrowserList.vue';
import { newBrowser } from '../../utils/browser';
import { Environment } from '../../utils//environment';
import { reactive, onActivated, watch } from 'vue';
import type { ValidBrowser } from '../../../../common/lib/src/interface';
import Setup from '../../components/Setup.vue';
import { lang, store } from '../../store';

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
.operations {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: nowrap;
	overflow-x: auto;
	overflow-y: hidden;
}

.entities-container {
	height: calc(100% - 80px);
	padding-bottom: 0px !important;
}

.entities {
	height: 100%;
	overflow: overlay;
}
</style>

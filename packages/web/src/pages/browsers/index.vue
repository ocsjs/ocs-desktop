<template>
	<div
		id="browsers"
		class="h-100 browsers-page"
	>
		<!-- Banner 提示 -->
		<NotificationBanner class="mb-2" />

		<!-- 简洁模式：卡片平铺布局（布局切换按钮已整合进组件内，与卡片网格同容器对齐边缘） -->
		<SimpleBrowserCards v-if="isSimpleMode" />

		<template v-else>
			<!-- 专业模式：container 自适应宽度居中；操作区域脱离卡片位于浅灰背景上，仅浏览器列表为白色卡片 -->
			<div class="professional-wrapper container-md">
				<div class="operations-panel mb-2 p-1">
					<!-- 路径栏（独立一行，长路径可横向滚动，避免挤压操作行的搜索/切换按钮） -->
					<div
						v-if="currentSearchedEntities === undefined && currentFolder.type !== 'root'"
						class="breadcrumb-row"
					>
						<FileBreadcrumb :key="currentFolder.uid"></FileBreadcrumb>
					</div>

					<div class="operations mb-1">
						<!-- 文件筛选（标签搜索、名字搜索等，左对齐） -->
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

						<!-- 撑开间距，将布局切换按钮推到最右边 -->
						<div class="flex-grow-1"></div>
						<a-button
							size="mini"
							@click="toggleLayoutMode"
						>
							<Icon type="grid_view">简洁模式</Icon>
						</a-button>
					</div>

					<!-- 文件操作 -->
					<FileMultipleOperators></FileMultipleOperators>
				</div>

				<!-- 浏览器列表：白色卡片背景 -->
				<div class="list-card">
					<EnvironmentAlert class="p-2"> </EnvironmentAlert>

					<template v-if="currentSearchedEntities !== undefined && currentSearchedEntities.length === 0">
						<a-empty
							class="p-3"
							description="暂无浏览器搜索结果"
						></a-empty>
					</template>

					<div class="entities-wrapper">
						<!-- 不使用过渡动画：切换布局模式时动画会导致文档流抖动、产生滚动条闪烁 -->
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
							<div class="text-end">
								<RightClickOpenMenuTip />
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import Icon from '../../components/Icon.vue';
import { resetSearch } from '../../utils/entity';
import FileFilters from '../../components/browsers/FileFilters.vue';
import FileBreadcrumb from '../../components/browsers/FileBreadcrumb.vue';
import { currentEntities, currentSearchedEntities, currentFolder } from '../../fs';
import FileMultipleOperators from '../../components/browsers/FileMultipleOperators.vue';
import BrowserList from '../../components/BrowserList.vue';
import { computed } from 'vue';
import NotificationBanner from '../../components/NotificationBanner.vue';
import { store } from '../../store';
import RightClickOpenMenuTip from '../../components/RightClickOpenMenuTip.vue';
import EnvironmentAlert from '../../components/EnvironmentAlert.vue';
import SimpleBrowserCards from '../../components/browsers/SimpleBrowserCards.vue';

/** 简洁模式：浏览器列表页渲染卡片平铺布局（与专业模式共用同一界面和左侧菜单栏） */
const isSimpleMode = computed(() => store.render.setting.mode === 'simple');

/** 切换布局模式（简洁/专业），仅控制浏览器列表界面的布局 */
function toggleLayoutMode() {
	store.render.setting.mode = isSimpleMode.value ? 'professional' : 'simple';
}
</script>

<style scoped lang="less">
.browsers-page {
	display: flex;
	flex-direction: column;
	/* 背景对齐简洁模式的浅灰色 */
	background-color: var(--theme-bg-color-deep);
}

/* 专业模式容器：container-md 自适应宽度居中，撑满剩余高度 */
.professional-wrapper {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	padding-top: 6px;
	padding-bottom: 8px;
}

/* 浏览器列表卡片：白色背景（操作区域脱离卡片，位于浅灰页面背景上） */
.list-card {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	background-color: var(--theme-card-bg);
	border: 1px solid var(--theme-border-color-light);
	border-radius: 8px;
	overflow: hidden;
}

/* 操作面板：脱离卡片的工具行，直接位于浅灰页面背景上（padding 由 p-3 提供） */
.operations-panel {
	flex-shrink: 0;

	/* 浅灰底上的输入框/下拉框（单选+多选）/默认按钮改为 outline 样式（透明底 + 边框），防止与背景重合 */
	:deep(.arco-input-wrapper),
	:deep(.arco-select-view-single),
	:deep(.arco-select-view-multiple),
	:deep(.arco-btn-secondary) {
		background-color: transparent;
		border: 1px solid var(--theme-border-color);
	}

	/* outline 控件的悬浮/聚焦边框高亮（覆盖上方边框规则，保持 arco 交互反馈） */
	:deep(.arco-input-wrapper):hover,
	:deep(.arco-input-wrapper):focus-within,
	:deep(.arco-select-view-single):hover,
	:deep(.arco-select-view-multiple):hover,
	:deep(.arco-btn-secondary):hover {
		border-color: var(--theme-primary-color);
	}
}

/* 路径栏：独立一行，与操作行分离；长路径横向滚动而非挤压 */
.breadcrumb-row {
	margin-bottom: 6px;
	overflow-x: auto;
	white-space: nowrap;
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
}

.entities-container {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
}

.entities {
	flex: 1;
	min-height: 0;
	overflow: overlay;

	padding: 4px 12px 0;
}
</style>

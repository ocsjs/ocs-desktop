<template>
	<div
		id="browsers"
		class="h-100 browsers-page"
	>
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

		<EnvironmentAlert class="p-2"> </EnvironmentAlert>

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
					<div class="text-end">
						<RightClickOpenMenuTip />
					</div>
				</div>
			</Transition>
		</div>
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
import { computed } from 'vue';
import { IconDesktop, IconTag, IconCode, IconFolder } from '@arco-design/web-vue/es/icon';
import { store } from '../../store';
import RightClickOpenMenuTip from '../../components/RightClickOpenMenuTip.vue';
import EnvironmentAlert from '../../components/EnvironmentAlert.vue';

const stats = computed(() => {
	const r = root();
	const allBrowsers = r.findAll((e) => e.type === 'browser');
	const allFolders = r.findAll((e) => e.type === 'folder');

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
</script>

<style scoped lang="less">
.browsers-page {
	display: flex;
	flex-direction: column;
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

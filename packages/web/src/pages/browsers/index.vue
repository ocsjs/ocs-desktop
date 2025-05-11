<template>
	<div
		id="browsers"
		class="h-100"
	>
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
	height: calc(100% - 90px);
}

.entities {
	height: calc(100% - 24px);
	overflow: overlay;
}
</style>

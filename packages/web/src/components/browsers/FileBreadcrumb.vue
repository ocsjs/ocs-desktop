<template>
	<span class="breadcrumb">
		<a-breadcrumb>
			<template
				v-for="(folder, index) of parents"
				:key="folder.uid"
			>
				<a-breadcrumb-item @click="Folder.from(folder.uid)?.location()">
					<span
						class="path-item"
						:class="{ active: index === parents.length - 1 }"
					>
						{{ folder.name }}
					</span>
				</a-breadcrumb-item>
			</template>
			<!-- 表示一个斜杠 -->
			<a-breadcrumb-item> </a-breadcrumb-item>
		</a-breadcrumb>
	</span>
</template>

<script setup lang="ts">
import { currentFolder } from '../../fs';
import { Folder } from '../../fs/folder';
import { computed } from 'vue';

const parents = computed(() => (currentFolder.value ? Folder.from(currentFolder.value.uid)?.flatParents() || [] : []));
</script>

<style scoped lang="less">
.breadcrumb {
	background-color: #f2f2f2;
	white-space: nowrap;
	margin-bottom: 0px;
	width: 100%;
	padding: 0px 12px;
}

.path-item {
	cursor: pointer;
	font-size: 12px;
}

.path-item.active {
	color: #165dff;
	font-weight: 500;
}
</style>

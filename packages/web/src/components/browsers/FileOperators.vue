<template>
	<a-space>
		<a-dropdown trigger="hover">
			<a-button size="mini">
				<Icon type="more_horiz"> 更多 </Icon>
			</a-button>
			<template #content>
				<a-doption @click="newFolder"> <Icon type="folder">新建文件夹</Icon> </a-doption>
				<a-doption @click="state.showPlaywrightScriptSelector = true">
					<Icon type="add"> 批量创建-自动化脚本浏览器</Icon>
				</a-doption>
			</template>
		</a-dropdown>

		<a-button
			size="mini"
			type="outline"
			@click="newBrowser()"
		>
			<Icon type="web"> 新建浏览器 </Icon>
		</a-button>

		<a-modal
			v-model:visible="state.showPlaywrightScriptSelector"
			:footer="false"
		>
			<template #title> 选择模板进行批量创建 </template>
			<PlaywrightScriptSelector
				v-model:playwright-scripts="state.playwrightScripts"
				style="max-height: 70vh; overflow: overlay"
				:multiple="false"
				@confirm="(state.showPlaywrightScriptSelector = false), showMultipleCreateTable()"
			></PlaywrightScriptSelector>
		</a-modal>

		<a-modal
			v-model:visible="state.showPlaywrightScriptTable"
			:footer="false"
			:closable="true"
			:mask-closable="false"
			width="auto"
		>
			<template #title> 批量创建：{{ state.selectedPS?.name }} </template>
			<PlaywrightScriptTable
				v-if="state.selectedPS"
				style="max-width: 800px"
				:raw-playwright-script="state.selectedPS"
				@cancel="state.showPlaywrightScriptTable = false"
				@confirm="multipleCreate"
			></PlaywrightScriptTable>
			<a-empty
				v-else
				description="请选择模板"
			/>
		</a-modal>
	</a-space>
</template>

<script setup lang="ts">
import Icon from '../Icon.vue';
import { reactive } from 'vue';
import { RawPlaywrightScript } from '../playwright-scripts';
import PlaywrightScriptSelector from '../playwright-scripts/PlaywrightScriptSelector.vue';
import PlaywrightScriptTable from '../playwright-scripts/PlaywrightScriptTable.vue';
import { newBrowser, newFolder } from '../../utils/browser';

const state = reactive({
	showPlaywrightScriptSelector: false,
	showPlaywrightScriptTable: false,
	playwrightScripts: [] as RawPlaywrightScript[],
	selectedPS: undefined as RawPlaywrightScript | undefined
});

function showMultipleCreateTable() {
	state.showPlaywrightScriptTable = true;
	state.selectedPS = state.playwrightScripts[0];
}

async function multipleCreate(
	raw: RawPlaywrightScript,
	configsList: (RawPlaywrightScript['configs'] & { browserName: string })[]
) {
	for (const configs of configsList) {
		newBrowser({
			name: configs.browserName,
			playwrightScripts: [
				{
					name: raw.name,
					configs: configs
				}
			]
		});
	}

	state.showPlaywrightScriptTable = false;
}
</script>

<style scoped lang="less"></style>

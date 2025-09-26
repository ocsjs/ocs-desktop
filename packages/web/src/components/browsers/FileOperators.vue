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
				<a-doption @click="state.remove_tags_modal.visible = true"> <Icon type="delete">批量删除标签</Icon> </a-doption>
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

		<a-modal
			v-model:visible="state.remove_tags_modal.visible"
			title="批量删除标签"
			:mask-closable="false"
			@ok="removeTags"
		>
			<div style="max-width: 400px">
				选择标签进行删除：
				<a-select
					v-model="state.remove_tags_modal.tags"
					size="mini"
					multiple
					placeholder="选择..."
					style="width: 200px"
				>
					<template
						v-for="key in Object.keys(store.render.browser.tags)"
						:key="key"
					>
						<a-option
							v-if="store.render.browser.tags[key]"
							:value="key"
							:label="key"
						>
							<a-space>
								<a-tag :color="store.render.browser.tags[key].color"> {{ key }} </a-tag>
								<span style="float: right"> {{ store.render.browser.tags[key].count }} </span>
							</a-space>
						</a-option>
					</template>
				</a-select>
			</div>
		</a-modal>
	</a-space>
</template>

<script setup lang="ts">
import Icon from '../Icon.vue';
import { reactive, h } from 'vue';
import { RawPlaywrightScript } from '../playwright-scripts';
import PlaywrightScriptSelector from '../playwright-scripts/PlaywrightScriptSelector.vue';
import PlaywrightScriptTable from '../playwright-scripts/PlaywrightScriptTable.vue';
import { newBrowser, newFolder } from '../../utils/browser';
import { store } from '../../store';
import { root } from '../../fs/folder';
import { Browser } from '../../fs/browser';
import { Modal, Message, Tag } from '@arco-design/web-vue';

const state = reactive({
	showPlaywrightScriptSelector: false,
	showPlaywrightScriptTable: false,
	playwrightScripts: [] as RawPlaywrightScript[],
	selectedPS: undefined as RawPlaywrightScript | undefined,
	remove_tags_modal: {
		visible: false,
		tags: [] as string[]
	}
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

function removeTags() {
	Modal.confirm({
		title: '确认删除这些标签吗？',
		content: () =>
			h('div', [
				`标签：`,
				...state.remove_tags_modal.tags.map((tag) => {
					const tag_info = store.render.browser.tags[tag];
					return h(Tag, { color: tag_info.color }, tag);
				}),
				h('br'),
				`将从每个浏览器中移除，删除后将无法恢复，请谨慎操作！`
			]),
		onOk: () => {
			try {
				const tags = state.remove_tags_modal.tags;
				if (tags.length === 0) {
					return;
				}

				for (const child of root().findAll((e) => e.type === 'browser') as Browser[]) {
					child.tags = child.tags.filter((t) => !tags.includes(t.name));
				}

				for (const tag of tags) {
					Reflect.deleteProperty(store.render.browser.tags, tag);
				}

				state.remove_tags_modal.tags = [];
				Message.success('标签删除成功');
			} catch (e) {
				Message.error('标签删除失败');
				console.error(e);
			}
		}
	});
}
</script>

<style scoped lang="less"></style>

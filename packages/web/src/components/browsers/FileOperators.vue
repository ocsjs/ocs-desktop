<template>
	<a-space>
		<a-dropdown trigger="hover">
			<a-button
				size="small"
				type="outline"
			>
				<Icon type="more_horiz"> 更多 </Icon>
			</a-button>
			<template #content>
				<a-doption @click="state.showAutomationScriptSelector = true">
					<Icon type="add"> 批量创建-自动化程序浏览器</Icon>
				</a-doption>
				<a-doption @click="state.remove_tags_modal.visible = true"> <Icon type="delete">批量删除标签</Icon> </a-doption>
			</template>
		</a-dropdown>

		<!-- 新建下拉按钮：主按钮点击 = 新建浏览器（初始化弹窗），悬浮展开更多新建入口 -->
		<a-dropdown-button
			size="small"
			type="primary"
			trigger="hover"
			@click="newBrowserOrInit()"
			@select="onCreateSelect"
		>
			<Icon type="add"> 新建 </Icon>
			<template #content>
				<a-doption value="emptyBrowser">
					<a-tooltip
						content="一键创建空浏览器：使用默认名称、不包含自动化程序，无需询问创建内容"
						position="left"
					>
						<span class="d-block"><Icon type="web">新建空浏览器</Icon></span>
					</a-tooltip>
				</a-doption>
				<a-doption value="folder">
					<Icon type="folder">新建文件夹</Icon>
				</a-doption>
			</template>
		</a-dropdown-button>

		<a-modal
			v-model:visible="state.showAutomationScriptSelector"
			:footer="false"
		>
			<template #title> 选择模板进行批量创建 </template>
			<AutomationScriptSelector
				:automation-scripts="state.automationScripts"
				style="max-height: 70vh; overflow: overlay"
				:multiple="false"
				@confirm="
					(as) => {
						state.automationScripts = as;
						state.showAutomationScriptSelector = false;
						showMultipleCreateTable();
					}
				"
			></AutomationScriptSelector>
		</a-modal>

		<a-modal
			v-model:visible="state.showAutomationScriptTable"
			:footer="false"
			:closable="true"
			:mask-closable="false"
			width="auto"
		>
			<template #title> 批量创建：{{ state.selectedAS?.name }} </template>
			<AutomationScriptTable
				v-if="state.selectedAS"
				style="max-width: 800px"
				:raw-automation-script="state.selectedAS"
				@cancel="state.showAutomationScriptTable = false"
				@confirm="multipleCreate"
			></AutomationScriptTable>
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
					size="small"
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
import { RawAutomationScript } from '../automation-scripts';
import AutomationScriptSelector from '../automation-scripts/AutomationScriptSelector.vue';
import AutomationScriptTable from '../automation-scripts/AutomationScriptTable.vue';
import { newBrowser, newBrowserOrInit, newEmptyBrowser, newFolder } from '../../utils/browser';
import { store } from '../../store';
import { root } from '../../fs/folder';
import { Browser } from '../../fs/browser';
import { Modal, Message, Tag } from '@arco-design/web-vue';

const state = reactive({
	showAutomationScriptSelector: false,
	showAutomationScriptTable: false,
	automationScripts: [] as RawAutomationScript[],
	selectedAS: undefined as RawAutomationScript | undefined,
	remove_tags_modal: {
		visible: false,
		tags: [] as string[]
	}
});

/** 新建下拉按钮的选项分发 */
function onCreateSelect(value: string | number | Record<string, unknown> | undefined) {
	if (value === 'emptyBrowser') {
		newEmptyBrowser();
	} else if (value === 'folder') {
		newFolder();
	}
}

function showMultipleCreateTable() {
	state.showAutomationScriptTable = true;
	state.selectedAS = state.automationScripts[0];
}

async function multipleCreate(
	raw: RawAutomationScript,
	configsList: (RawAutomationScript['configs'] & { browserName: string })[]
) {
	for (const configs of configsList) {
		// browserName 是浏览器名而非脚本配置项：剔除后再入库，避免渲染出空 label 的配置输入框
		const { browserName, ...scriptConfigs } = configs;
		newBrowser({
			name: browserName,
			automationScripts: [
				{
					name: raw.name,
					configs: scriptConfigs
				}
			]
		});
	}

	Message.success(`成功创建 ${configsList.length} 个浏览器`);
	state.showAutomationScriptTable = false;
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

<template>
	<a-modal
		v-model:visible="visible"
		title="添加网络脚本"
		simple
		:mask-closable="false"
		:width="600"
		ok-text="确定添加"
		:ok-button-props="{
			disabled: url.trim() === ''
		}"
		@ok="handleOk"
		@cancel="handleCancel"
	>
		<a-input
			v-model="url"
			placeholder="输入脚本链接（通常以http开头，并以 .user.js 结尾的链接）"
		/>

		<div class="official-scripts">
			<div class="official-scripts-title">官方脚本列表</div>
			<div
				v-if="loading"
				class="official-scripts-loading"
			>
				<a-spin />
			</div>
			<div
				v-else-if="officialScripts.length === 0"
				class="official-scripts-empty"
			>
				<a-empty description="暂无官方脚本" />
			</div>
			<div
				v-else
				class="official-scripts-list"
			>
				<div
					v-for="script in officialScripts"
					:key="script.id"
					class="script-item"
				>
					<div class="script-info">
						<div class="script-name">{{ script.name }}</div>
						<div
							v-if="script.description"
							class="script-desc"
						>
							{{ script.description }}
						</div>
					</div>
					<div class="script-actions">
						<a-button
							size="mini"
							type="text"
							@click="handleSelectScript(script)"
						>
							+ 添加
						</a-button>

						<a-button
							v-if="script.homepage"
							size="mini"
							type="text"
							@click="goto(script.homepage)"
						>
							主页
						</a-button>
					</div>
				</div>
			</div>
		</div>
	</a-modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Environment } from '../utils/environment';
import { addScriptFromUrl } from '../utils/user-scripts';
import { Message } from '@arco-design/web-vue';
import type { ResourceFile } from '@ocs-desktop/common/src/api';
import { goto } from '../utils';

const visible = defineModel<boolean>('visible', { default: false });

const url = ref('');
const officialScripts = ref<ResourceFile[]>([]);
const loading = ref(true);

onMounted(async () => {
	try {
		const script = await Environment.getValidUserScript();
		officialScripts.value = script ? [script] : [];
	} finally {
		loading.value = false;
	}
});

async function handleSelectScript(script: ResourceFile) {
	url.value = script.url;
	if (await addScriptFromUrl(script.url)) {
		Message.success('脚本下载完成');
	}
	visible.value = false;
}

async function handleOk() {
	if (!url.value) return;
	Message.info('正在下载脚本，请稍后...');
	if (await addScriptFromUrl(url.value)) {
		Message.success('脚本下载完成');
	}
}

function handleCancel() {
	visible.value = false;
}
</script>

<style scoped lang="less">
.official-scripts {
	margin-top: 16px;
}

.official-scripts-title {
	font-weight: bold;
	margin-bottom: 8px;
	font-size: 13px;
}

.official-scripts-loading {
	text-align: center;
	padding: 12px;
}

.official-scripts-empty {
	color: #86909c;
	font-size: 12px;
	padding: 4px 0;
}

.official-scripts-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.script-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	border: 1px solid #e5e6eb;
	border-radius: 6px;
	cursor: pointer;
	transition: border-color 0.2s;

	&:hover {
		border-color: #165dff;
	}
}

.script-info {
	flex: 1;
	min-width: 0;
}

.script-name {
	font-size: 13px;
	font-weight: 500;
}

.script-desc {
	font-size: 12px;
	color: #86909c;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	margin-top: 2px;
}

.script-actions {
	flex-shrink: 0;
	margin-left: 12px;
}

body[arco-theme='dark'] & {
	.script-item {
		border-color: #3d3d3f;

		&:hover {
			border-color: #165dff;
		}
	}
}
</style>

<template>
	<div v-if="!localClosed">
		<a-tooltip
			:content="collapse ? '点击收起' : '点击展开'"
			position="bottom"
		>
			<a-alert
				class="alert-collapse"
				:class="collapse ? 'usage-alert-rounded' : 'usage-alert-top'"
				:banner="banner ?? false"
				:center="center ?? false"
				:type="type || 'info'"
				@click="
					() => {
						emits('update:collapse', !collapse);
					}
				"
			>
				<template #icon>
					<CircleAlertIcon />
				</template>

				<template #action>
					<div class="fs-6">
						<IconDown v-if="collapse" />
						<IconUp v-else />
					</div>
				</template>

				{{ title }}
			</a-alert>
			<a-alert
				v-if="!collapse"
				class="mb-3 border-top usage-alert-bottom"
				:banner="banner ?? false"
				:center="center ?? false"
				:type="type || 'info'"
				:show-icon="false"
				closable
				@close="localClosed = true"
			>
				<div
					v-if="html"
					v-html="html"
				></div>
				<div v-if="text">{{ text }}</div>
			</a-alert>
		</a-tooltip>
	</div>
</template>

<script lang="ts" setup>
import { AlertInstance } from '@arco-design/web-vue';
import { ref } from 'vue';
import { CircleAlertIcon } from 'lucide-vue-next';

defineProps<{
	title: string;
	/** 是否折叠 */
	collapse: boolean;
	html?: string;
	text?: string;
	type?: AlertInstance['type'];
	banner?: boolean;
	center?: boolean;
}>();

const emits = defineEmits<{
	(e: 'update:collapse', val: boolean): void;
}>();

/** 本次会话内是否已关闭 */
const localClosed = ref(false);
</script>

<style scoped lang="less">
.alert-collapse {
	cursor: pointer;
}

.usage-alert-top {
	border-top-left-radius: var(--border-radius-small);
	border-top-right-radius: var(--border-radius-small);
}

.usage-alert-rounded {
	border-radius: var(--border-radius-small);
}

.usage-alert-bottom {
	border-bottom-left-radius: var(--border-radius-small);
	border-bottom-right-radius: var(--border-radius-small);
}

code {
	background-color: rgb(224, 106, 106) !important;
}

/** 暗色主题适配：a-alert 已由全局 theme.less 统一处理，这里仅保留组件内 code 的暗色覆盖 */
body[arco-theme='dark'] & {
	code {
		background-color: #8a2c2c !important;
		color: #ffd6d6;
	}
}
</style>

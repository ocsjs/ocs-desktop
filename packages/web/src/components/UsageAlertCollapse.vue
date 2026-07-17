<template>
	<div v-if="!closed">
		<a-tooltip
			:content="collapse ? '点击收起' : '点击展开'"
			position="bottom"
		>
			<a-alert
				class="alert-collapse usage-alert-top"
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
					<icon-exclamation-circle-fill />
				</template>

				<template #action>
					<div class="fs-6">
						<IconUp v-if="collapse" />
						<IconDown v-else />
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
				@close="
					() => {
						closed = true;
					}
				"
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

const closed = ref(false);

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
</script>

<style scoped lang="less">
.alert-collapse {
	cursor: pointer;
}

.usage-alert-top {
	border-top-left-radius: var(--border-radius-small);
	border-top-right-radius: var(--border-radius-small);
}

.usage-alert-bottom {
	border-bottom-left-radius: var(--border-radius-small);
	border-bottom-right-radius: var(--border-radius-small);
}

code {
	background-color: rgb(224, 106, 106) !important;
}
</style>

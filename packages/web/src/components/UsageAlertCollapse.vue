<template>
	<div>
		<a-tooltip
			:content="collapse ? '点击收起' : '点击展开'"
			position="bottom"
		>
			<a-alert
				class="alert-collapse"
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
				class="mb-3 border-top"
				:banner="banner ?? false"
				:center="center ?? false"
				:type="type || 'info'"
				:show-icon="false"
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

<style scoped>
.alert-collapse {
	cursor: pointer;
}
</style>

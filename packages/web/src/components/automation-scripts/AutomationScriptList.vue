<template>
	<template
		v-for="(script, index) of automationScripts"
		:key="index"
	>
		<a-card
			:title="script.name"
			class="as"
		>
			<template #extra>
				<a-button
					size="mini"
					type="outline"
					status="danger"
					@click="remove(index)"
				>
					<template #icon>
						<icon-close />
					</template>
				</a-button>
			</template>
			<div>
				<div
					v-for="cfg of script.configs"
					:key="cfg.label"
					class="as"
				>
					<div
						v-if="!cfg.hide"
						class="d-flex gap-2"
					>
						<div style="flex: 0 0 100px">
							<span> {{ cfg.label }} </span>
						</div>
						<div style="flex: auto">
							<a-input
								v-model="cfg.value"
								:placeholder="`输入 ${cfg.label} ...`"
								size="small"
								@blur="() => (cfg.value = cfg.value.trim())"
							></a-input>
						</div>
					</div>
				</div>
			</div>
		</a-card>
	</template>
</template>

<script setup lang="ts">
import { RawAutomationScript } from './index';

const props = defineProps<{
	automationScripts: RawAutomationScript[];
}>();

const emits = defineEmits<{
	(e: 'update:automationScripts', automationScripts: RawAutomationScript[]): void;
}>();

function remove(index: number) {
	const arr = [...props.automationScripts];
	arr.splice(index, 1);
	emits('update:automationScripts', arr);
}
</script>

<style scoped lang="less">
.as + .as {
	margin-top: 8px;
}
</style>

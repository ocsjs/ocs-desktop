<template>
	<template
		v-for="(script, index) of automationScripts"
		:key="index"
	>
		<a-card :title="script.name">
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

defineProps<{
	automationScripts: RawAutomationScript[];
}>();

defineEmits<{
	(e: 'update:automationScripts', automationScripts: RawAutomationScript[]): void;
}>();
</script>

<style scoped lang="less">
.as + .as {
	margin-top: 8px;
}
</style>

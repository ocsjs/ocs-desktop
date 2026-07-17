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
							<span
								v-if="cfg.required"
								class="text-danger"
							> *</span>
						</div>
						<div style="flex: auto">
							<a-input-password
								v-if="cfg.type === 'password'"
								v-model="cfg.value"
								size="small"
								:max-length="cfg.max"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
							/>
							<a-input-number
								v-else-if="cfg.type === 'number'"
								v-model="cfg.value"
								size="small"
								:min="cfg.min"
								:max="cfg.max"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
							/>
							<a-textarea
								v-else-if="cfg.type === 'textarea'"
								v-model="cfg.value"
								size="small"
								:max-length="cfg.max"
								:auto-size="{ minRows: 1, maxRows: 3 }"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
							/>
							<a-select
								v-else-if="cfg.type === 'select'"
								v-model="cfg.value"
								size="small"
								:options="cfg.options"
								:placeholder="cfg.placeholder || `选择 ${cfg.label} ...`"
							/>
							<a-switch
								v-else-if="cfg.type === 'switch'"
								v-model="cfg.value"
								size="small"
							/>
							<a-input
								v-else
								v-model="cfg.value"
								size="small"
								:max-length="cfg.max"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
								@blur="() => (cfg.value = cfg.value.trim())"
							/>
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

<template>
	<div>
		<a-input-search
			v-model="state.search"
			size="small"
			class="mb-2"
			placeholder="输入脚本名搜索"
		/>

		<CommonSelector
			:selected="props.automationScripts.map((s) => ({ key: s.name, ...s }))"
			:multiple="props.multiple"
			:list="scripts.map((s) => ({ key: s.name, ...s }))"
			@select="onConfirm"
		>
			<template #content="{ item: script }">
				<b> {{ script.name }} </b>
				<span
					style="font-size: 12px"
					class="text-secondary float-end"
				>
					<span> 需配置 : </span>
					<span
						v-for="(cfg, key, i) of script.configs"
						:key="cfg.label"
					>
						<span v-if="!cfg.hide">
							<span v-if="i !== 0"> , </span>

							{{ cfg.label }}
						</span>
					</span>
				</span>
			</template>
		</CommonSelector>
	</div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import { RawAutomationScript } from './index';
import CommonSelector from '../CommonSelector.vue';
import { remote } from '../../utils/remote';

const state = reactive({
	search: ''
});

const props = withDefaults(
	defineProps<{
		automationScripts: RawAutomationScript[];
		multiple?: boolean;
	}>(),
	{
		automationScripts: () => [],
		multiple: true
	}
);

const emits = defineEmits<{
	(e: 'confirm', automationScripts: RawAutomationScript[]): void;
}>();

const RawScripts = remote.methods.callSync('getRawScripts');
const scripts = computed<RawAutomationScript[]>(() => RawScripts.filter((s) => s.name.includes(state.search)));

function onConfirm(val: RawAutomationScript[]) {
	console.log(JSON.parse(JSON.stringify(val)));
	emits('confirm', JSON.parse(JSON.stringify(val)));
}
</script>

<style scoped lang="less">
.ps {
	border: 1px solid #e1e1e18c;
	padding: 6px;
	margin: 8px 0px;
	border-radius: 4px;
	cursor: pointer;

	&.selected {
		border: 1px solid #0d6efd8c;
	}
}
</style>

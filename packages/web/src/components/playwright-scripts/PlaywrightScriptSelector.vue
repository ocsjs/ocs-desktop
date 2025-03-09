<template>
	<div>
		<a-input-search
			v-model="state.search"
			size="small"
			class="mb-2"
			placeholder="输入脚本名搜索"
		/>

		<CommonSelector
			:multiple="props.multiple"
			:list="scripts.filter((s) => s.name.includes(state.search)).map((s) => ({ key: s.name, ...s }))"
			:on-select="confirm"
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
import { RawPlaywrightScript } from './index';
import CommonSelector from '../CommonSelector.vue';
import { remote } from '../../utils/remote';

const state = reactive({
	search: ''
});

const props = withDefaults(
	defineProps<{
		playwrightScripts: RawPlaywrightScript[];
		multiple?: boolean;
	}>(),
	{
		playwrightScripts: () => [],
		multiple: true
	}
);

const emits = defineEmits<{
	(e: 'update:playwrightScripts', playwrightScripts: RawPlaywrightScript[]);
	(e: 'confirm');
}>();

const RawScripts = remote.methods.callSync('getRawScripts');
console.log('RawScripts', RawScripts);
const scripts = computed<RawPlaywrightScript[]>(() => RawScripts.filter((s) => s.name.includes(state.search)));

function confirm(selectedScripts: RawPlaywrightScript[]) {
	// 使用拷贝消除响应式特性
	emits('update:playwrightScripts', JSON.parse(JSON.stringify(selectedScripts)));
	emits('confirm');
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

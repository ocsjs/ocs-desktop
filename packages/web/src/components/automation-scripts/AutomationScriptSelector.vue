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
				<div class="d-flex align-items-center gap-2 justify-content-between">
					<div class="d-flex align-items-center">
						<!-- 
						这里存在三种情况，第一种有图片正常显示
						第二种图标字段空着，显示 Icon 地球图标
						第三种后台解析失败、或者为空：显示空白 SVG
						 -->
						<img
							v-if="script.icon && !failedIcons.has(script.icon)"
							:src="iconUrl(script.icon)"
							class="script-icon me-1"
							@error="script.icon && failedIcons.add(script.icon)"
						/>
						<Icon
							v-else
							type="public"
							:size="18"
							class="script-icon-fallback me-1"
						/>
						<b> {{ script.name }} </b>
					</div>
					<span
						style="font-size: 12px"
						class="text-secondary float-end"
					>
						<span> 需配置 : </span>
						<a-space>
							<a-tag
								v-for="cfg of visibleConfigs(script.configs)"
								:key="cfg.label"
								size="small"
							>
								{{ cfg.label }}
							</a-tag>
							<a-tooltip
								v-if="hiddenConfigCount(script.configs) > 0"
								:content="'还有：' + hiddenConfigLabels(script.configs)"
								position="top"
							>
								<a-tag
									size="small"
									color="arcoblue"
								>
									+{{ hiddenConfigCount(script.configs) }}
								</a-tag>
							</a-tooltip>
						</a-space>
					</span>
				</div>
			</template>
		</CommonSelector>
	</div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import { RawAutomationScript } from './index';
import CommonSelector from '../CommonSelector.vue';
import { remote } from '../../utils/remote';
import { iconUrl } from '../../utils';
import Icon from '../Icon.vue';

const state = reactive({
	search: ''
});

/** 加载失败的图标地址集合，命中后改用默认地球图标 */
const failedIcons = reactive(new Set<string>());

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

/** 最多展示的配置项数量 */
const MAX_CONFIG_VISIBLE = 2;

/** 将 configs（对象或数组）规整为数组 */
function toConfigArray(configs: any = {}) {
	return Array.isArray(configs) ? configs : Object.values(configs);
}

/** 过滤掉 hide 的配置项，最多展示 MAX_CONFIG_VISIBLE 个 */
function visibleConfigs(configs: any = {}) {
	return toConfigArray(configs)
		.filter((cfg: any) => !cfg.hide)
		.slice(0, MAX_CONFIG_VISIBLE);
}

/** 超出最大展示数量而被省略的配置项数量 */
function hiddenConfigCount(configs: any = {}) {
	return Math.max(0, toConfigArray(configs).filter((cfg: any) => !cfg.hide).length - MAX_CONFIG_VISIBLE);
}

/** 被省略的配置项标签，用于 tooltip 展示 */
function hiddenConfigLabels(configs: any = {}) {
	return toConfigArray(configs)
		.filter((cfg: any) => !cfg.hide)
		.slice(MAX_CONFIG_VISIBLE)
		.map((cfg: any) => cfg.label)
		.join('、');
}

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

.script-icon {
	width: 18px;
	height: 18px;
	object-fit: contain;
	border-radius: 3px;
}
</style>

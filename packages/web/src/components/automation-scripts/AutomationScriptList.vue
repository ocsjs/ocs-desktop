<template>
	<template
		v-for="(script, index) of automationScripts"
		:key="index"
	>
		<a-card class="as">
			<template #title>
				<div class="d-flex align-items-center gap-2">
					<img
						v-if="script.icon && !failedIcons.has(script.icon)"
						:src="iconUrl(script.icon)"
						class="script-icon"
						@error="failedIcons.add(script.icon!)"
					/>
					<Icon
						v-else
						type="public"
						:size="18"
						class="script-icon-fallback"
					/>
					<span> {{ script.name }} </span>
				</div>
			</template>
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
					v-for="(cfg, cfgKey) of script.configs"
					:key="cfgKey"
					class="as"
				>
					<div
						v-if="isVisible(script, cfg)"
						class="d-flex gap-2"
					>
						<div style="flex: 0 0 100px">
							<span> {{ cfg.label }} </span>
							<span
								v-if="cfg.required"
								class="text-danger"
							>
								*</span
							>
						</div>
						<div style="flex: auto">
							<a-input-password
								v-if="cfg.type === 'password'"
								v-model="cfg.value"
								size="small"
								:max-length="cfg.max"
								:error="!!getError(index, cfgKey)"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
								@blur="() => validate(index, cfgKey, cfg, true)"
								@input="() => validate(index, cfgKey, cfg)"
							/>
							<a-input-number
								v-else-if="cfg.type === 'number'"
								v-model="cfg.value"
								size="small"
								:min="cfg.min"
								:max="cfg.max"
								:error="!!getError(index, cfgKey)"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
								@change="() => validate(index, cfgKey, cfg, true)"
							/>
							<a-textarea
								v-else-if="cfg.type === 'textarea'"
								v-model="cfg.value"
								size="small"
								:max-length="cfg.max"
								:auto-size="{ minRows: 1, maxRows: 3 }"
								:error="!!getError(index, cfgKey)"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
								@blur="() => validate(index, cfgKey, cfg, true)"
								@input="() => validate(index, cfgKey, cfg)"
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
								v-else-if="cfg.type === 'url'"
								v-model="cfg.value"
								size="small"
								:max-length="cfg.max"
								:error="!!getError(index, cfgKey)"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
								@blur="() => onUrlBlur(index, cfgKey, cfg)"
								@press-enter="() => onUrlBlur(index, cfgKey, cfg)"
								@input="() => validate(index, cfgKey, cfg)"
							>
								<template #suffix>
									<Icon
										v-if="cfg.value && normalizeUrl(cfg.value) !== String(cfg.value).trim()"
										type="link"
										:size="14"
										class="text-secondary"
										title="失焦后将自动补全 https:// 前缀"
									/>
								</template>
							</a-input>
							<a-input
								v-else
								v-model="cfg.value"
								size="small"
								:max-length="cfg.max"
								:error="!!getError(index, cfgKey)"
								:placeholder="cfg.placeholder || `输入 ${cfg.label} ...`"
								@blur="
									() => {
										cfg.value = cfg.value.trim();
										validate(index, cfgKey, cfg, true);
									}
								"
								@input="() => validate(index, cfgKey, cfg)"
							/>
							<!-- 格式错误警告 -->
							<div
								v-if="getError(index, cfgKey)"
								class="config-error"
							>
								<Icon
									type="error_outline"
									:size="14"
								/>
								{{ getError(index, cfgKey) }}
							</div>
						</div>
					</div>
				</div>
			</div>
		</a-card>
	</template>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { RawAutomationScript } from './index';
import type { Config } from '@ocs-desktop/common/web';
import { normalizeUrl, validateConfigValue } from '@ocs-desktop/common/web';
import { iconUrl } from '../../utils';
import Icon from '../Icon.vue';

const props = defineProps<{
	automationScripts: RawAutomationScript[];
}>();

const emits = defineEmits<{
	(e: 'update:automationScripts', automationScripts: RawAutomationScript[]): void;
}>();

/** 加载失败的图标地址集合，命中后改用默认地球图标 */
const failedIcons = reactive(new Set<string>());

/** 格式错误提示：key = `${脚本索引}-${配置项key}` */
const errors = reactive<Record<string, string | undefined>>({});
/** 已失焦触碰过的输入项：触碰后开始输入实时校验，避免未输入就标红 */
const touched = reactive(new Set<string>());

function errKey(index: number, cfgKey: string) {
	return index + '-' + cfgKey;
}

/** 获取配置项当前格式错误提示 */
function getError(index: number, cfgKey: string) {
	return errors[errKey(index, cfgKey)];
}

/**
 * 输入自动检测：markTouched=true（失焦/变更）时标记已触碰并校验，
 * 之后每次输入实时重新校验，修正后警告自动消失
 */
function validate(index: number, cfgKey: string, cfg: Config, markTouched = false) {
	const key = errKey(index, cfgKey);
	if (markTouched) touched.add(key);
	if (!touched.has(key)) return;
	errors[key] = validateConfigValue(cfg);
}

/** 配置项是否可见：无依赖条件时按 hide 判断；有 visibleWhen 时按依赖配置项的当前值判断 */
function isVisible(script: RawAutomationScript, cfg: Config) {
	if (cfg.visibleWhen) {
		return script.configs[cfg.visibleWhen.key]?.value === cfg.visibleWhen.value;
	}
	return !cfg.hide;
}

/** url 类型配置失焦/回车：自动识别链接并补全 https:// 前缀，随后校验格式 */
function onUrlBlur(index: number, cfgKey: string, cfg: Config) {
	cfg.value = normalizeUrl(cfg.value);
	validate(index, cfgKey, cfg, true);
}

function remove(index: number) {
	const arr = [...props.automationScripts];
	arr.splice(index, 1);
	emits('update:automationScripts', arr);

	// 同步错误状态索引：删除脚本后，其后脚本整体前移一位
	const newErrors: Record<string, string | undefined> = {};
	const newTouched = new Set<string>();
	for (const key of Object.keys(errors)) {
		const sep = key.indexOf('-');
		const idx = Number(key.slice(0, sep));
		const cfgKey = key.slice(sep + 1);
		if (idx === index) continue;
		const target = idx > index ? idx - 1 : idx;
		newErrors[target + '-' + cfgKey] = errors[key];
		if (touched.has(key)) newTouched.add(target + '-' + cfgKey);
	}
	Object.keys(errors).forEach((k) => delete errors[k]);
	Object.assign(errors, newErrors);
	touched.clear();
	newTouched.forEach((k) => touched.add(k));
}
</script>

<style scoped lang="less">
.as + .as {
	margin-top: 8px;
}

.script-icon {
	width: 18px;
	height: 18px;
	object-fit: contain;
	border-radius: 3px;
}

/* 格式错误警告文字（黄色警示，不与必填星号的红色冲突） */
.config-error {
	display: flex;
	align-items: center;
	gap: 4px;
	margin-top: 2px;
	font-size: 12px;
	color: #e6a23c;
	line-height: 1.4;

	body[arco-theme='dark'] & {
		/* 暗色下提高亮度保证可读 */
		color: #fdd663;
	}
}
</style>

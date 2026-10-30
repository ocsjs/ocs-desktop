<template>
	<a-card
		v-if="!allDone"
		class="beginner-guide mb-2"
		:body-style="{ padding: '16px 20px' }"
	>
		<div class="d-flex align-items-center justify-content-between mb-3">
			<div class="guide-title">
				<a-space size="mini"><GraduationCapIcon /> 新手使用指引 </a-space>
			</div>
			<a-tag
				color="arcoblue"
				size="small"
			>
				{{ doneCount }}/2
			</a-tag>
		</div>
		<!-- 不用 type="dot"：圆点模式不渲染 #icon 插槽，完成态的绿色打勾无法显示 -->
		<a-steps
			:current="currentStep"
			size="small"
		>
			<a-step
				:title="t('beginner_guide_step1_title', '环境自动准备')"
				:description="t('beginner_guide_step1_desc', '启动浏览器时将自动检测并补全环境')"
				:status="step1Status"
			>
				<template #icon>
					<component
						:is="step1Done ? CheckIcon : SettingsIcon"
						:color="step1Done ? '#52c41a' : undefined"
					/>
				</template>
			</a-step>
			<a-step
				:title="t('beginner_guide_step2_title', '启动浏览器')"
				:description="t('beginner_guide_step2_desc', '成功启动浏览器后即完成')"
				:status="step2Status"
			>
				<template #icon>
					<component
						:is="step2Done ? CheckIcon : CirclePlayIcon"
						:color="step2Done ? '#52c41a' : undefined"
					/>
				</template>
			</a-step>
		</a-steps>
	</a-card>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { CheckIcon, SettingsIcon, CirclePlayIcon, GraduationCapIcon } from 'lucide-vue-next';
import { store } from '../store';
import { t } from '../utils/langs';
import { useEnvironmentDetect } from '../composables/useEnvironmentDetect';
import { processes } from '../utils/process';

const { state: envState, updateEnvironmentDetect } = useEnvironmentDetect();

/** 各步骤实时信号 */
const step1Live = computed(() => !envState.isLoading && envState.isReady);
const step2Live = computed(() => processes.some((p) => p.status === 'launched'));

/** 是否完成（持久化标记优先，避免重启回退） */
const step1Done = computed(() => store.render.state.guide.init || step1Live.value);
const step2Done = computed(() => store.render.state.guide.launch || step2Live.value);

/** 两步全部完成（按持久化标记判定，永久隐藏） */
const allDone = computed(() => store.render.state.guide.init && store.render.state.guide.launch);

const doneCount = computed(() => Number(step1Done.value) + Number(step2Done.value));

/** 当前激活步骤序号 */
const currentStep = computed(() => {
	if (!step1Done.value) return 0;
	if (!step2Done.value) return 1;
	return 2;
});

const step1Status = computed<'finish' | 'process' | 'wait'>(() => (step1Done.value ? 'finish' : 'process'));
const step2Status = computed<'finish' | 'process' | 'wait'>(() =>
	step2Done.value ? 'finish' : step1Done.value ? 'process' : 'wait'
);

// 达成一次即永久标记完成（store watch 自动持久化）
watch(
	step1Live,
	(v) => {
		if (v && !store.render.state.guide.init) store.render.state.guide.init = true;
	},
	{ immediate: true }
);
watch(step2Live, (v) => {
	if (v && !store.render.state.guide.launch) store.render.state.guide.launch = true;
});

onMounted(() => {
	if (envState.isLoading) updateEnvironmentDetect();
});
</script>

<style lang="less" scoped>
.beginner-guide {
	border: 1px solid var(--theme-border-color-light);
	border-radius: 8px;
	background-color: var(--theme-card-bg);
	transition: all 0.2s ease;

	.guide-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--theme-text-color-strong);
		display: flex;
		align-items: center;
		gap: 4px;
	}

	:deep(.arco-steps-item) {
		overflow: hidden;
	}
	:deep(.arco-steps-item-tail) {
		overflow: hidden;
	}
}
</style>

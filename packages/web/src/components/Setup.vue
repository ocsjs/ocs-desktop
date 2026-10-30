<template>
	<a-modal
		:visible="props.visible"
		:footer="false"
		:closable="false"
		:unmount-on-close="true"
		@close="
			() => {
				emits('update:visible', false);
			}
		"
	>
		<template #title> {{ props.title }} </template>
		<a-row :gutter="[24, 24]">
			<a-col v-if="!Environment.infos.value">
				<template v-if="Environment.loading.value">
					<div class="text-center">
						<a-spin />
						<div class="mt-2">正在初始化资源，请稍后...</div>
					</div>
				</template>
				<template v-else>
					<div class="text-center">
						<div class="text-danger">未能获取到远程资源信息，请检查网络后重试，或者稍后手动设置。</div>
						<a-button
							class="mt-2"
							type="primary"
							size="small"
							@click="initEnvironment"
						>
							重试
						</a-button>
					</div>
				</template>
			</a-col>
			<a-col
				v-else
				class="text-center"
			>
				<a-steps
					direction="vertical"
					:current="state.current_step"
				>
					<template
						v-for="(step, index) in state.steps"
						:key="index"
					>
						<a-step
							v-show="!step.hidden"
							:status="step.status"
						>
							<template
								v-if="step.status"
								#icon
							>
								<CircleCheckIcon
									v-if="step.status === 'finish'"
									style="color: green; font-size: 28px"
									class="finish-check-animate"
								/>
								<CircleXIcon
									v-else-if="step.status === 'error'"
									style="font-size: 28px; background-color: white"
								/>
								<LoaderCircleIcon
									v-else-if="step.status === 'process'"
									style="font-size: 28px; color: gray"
									class="icon-spin"
								/>
							</template>

							<template #description>
								<div
									v-if="step.error"
									class="text-danger"
								>
									{{ step.error }}
								</div>
								<div
									v-else-if="step.description"
									style="white-space: pre-wrap; text-align: left; font-size: 12px"
								>
									{{ step.description }}
								</div>
							</template>
							{{ step.title }}
						</a-step>
					</template>
				</a-steps>
			</a-col>
			<a-col class="text-center mt-2">
				<a-space :size="24">
					<template v-if="state.current_step === state.steps.length">
						<a-button
							type="primary"
							size="small"
							:disabled="props.autoSetup && state.finish_animate"
							@click="
								() => {
									emits('update:visible', false);
								}
							"
						>
							<template v-if="props.autoSetup && state.finish_animate">
								<CircleCheckIcon
									style="color: greenyellow"
									class="finish-check-animate me-2"
								/>
								已完成
							</template>
							<template v-else>完成！</template>
						</a-button>
					</template>
					<template v-else-if="state.current_step === -1 || state.steps.find((s) => s.status === 'error')">
						<a-button
							size="small"
							@click="() => emits('update:visible', false)"
						>
							{{ props.cancelText }}
						</a-button>
						<a-button
							type="primary"
							size="small"
							@click="setup"
						>
							{{ props.confirmText }}
						</a-button>
					</template>
					<template v-else>
						<a-button
							size="small"
							:disabled="true"
						>
							<LoaderCircleIcon class="icon-spin" />
							初始化中...
						</a-button>
					</template>
				</a-space>
			</a-col>
		</a-row>
	</a-modal>
</template>

<script setup lang="ts">
import { t } from '../utils/langs';
import { sleep } from '../utils';
import { reactive, watch, nextTick, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { Environment } from '../utils/environment';
import { getDefaultBrowserName, newBrowser } from '../utils/browser';
import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon } from 'lucide-vue-next';

type Step = {
	title: string;
	description?: string;
	error?: string;
	status?: 'wait' | 'process' | 'finish' | 'error';
	hidden?: boolean;
	action: (step: Step) => any;
};

const _preset_steps = {
	new_browser: {
		title: '新建浏览器',
		async action(step) {
			await sleep(500);
			// 不再询问命名，直接使用命名算法生成的默认名（可在浏览器列表中重命名）
			const name = getDefaultBrowserName();
			step.description = `正在创建浏览器：${name}...`;

			const browser = newBrowser({ name });
			if (browser) {
				// 自动命名的浏览器不进入重命名状态（否则卡片标题会显示为空的输入框而非名称）
				browser.renaming = false;
			}
			if (!browser) {
				step.error = '浏览器创建失败，请确保已在左侧软件设置中配置浏览器路径。';
				return;
			}
			step.description = `已创建浏览器：${browser.name}（默认不含自动化程序，可在浏览器面板中按需添加），可在浏览器列表中查看并重命名。`;
		}
	} as Step,
	init_automationScript: {
		// 已下线：新建浏览器移除自动化程序选择，默认为空程序（可在浏览器面板中按需添加）。
		// 保留空步骤仅为兼容 PresetSteps 类型推导，任何 presetSteps 均不再引用它。
		title: '添加自动化程序',
		hidden: true,
		async action() {}
	} as Step
};

export type PresetSteps = (keyof typeof _preset_steps)[];

const props = withDefaults(
	defineProps<{
		visible: boolean;
		confirmText?: string;
		cancelText?: string;
		title?: string;
		autoSetup?: boolean;
		presetSteps?: PresetSteps;
	}>(),
	{
		visible: false,
		confirmText: '一键初始化',
		cancelText: '稍后手动设置',
		title: '初始化软件设置',
		autoSetup: false,
		// 默认仅新建浏览器流程（全局一键初始化已移除，环境补全改为启动浏览器时自动执行；
		// 自动化程序选择已下线，新建浏览器默认为空程序）
		presetSteps: () => ['new_browser']
	}
);

const state = reactive({
	current_step: -1,
	finish_animate: false,
	steps: [] as Step[]
});

const emits = defineEmits<{
	(e: 'finish'): void;
	(e: 'error', err: string): void;
	(e: 'update:visible', data: any): void;
}>();

/** 初始化远程资源并（按需）自动执行初始化流程；资源加载失败时仅展示错误与重试入口 */
async function initEnvironment() {
	await Environment.init();
	prepare();
	// 远程资源未加载成功时不自动执行，避免后续步骤因缺少资源信息而报错
	if (props.autoSetup && Environment.infos.value) {
		setup();
	}
}

onMounted(() => {
	// 弹窗不可见时不执行，避免后台幽灵实例挂起并污染共享步骤状态
	if (props.visible) {
		nextTick(initEnvironment);
	}
});

watch(
	() => props.visible,
	(vis) => {
		// 仅在打开弹窗时执行，关闭时不应在后台重跑初始化流程
		if (!vis) return;
		nextTick(initEnvironment);
	}
);

function prepare() {
	state.current_step = -1;
	state.steps = [];
	state.finish_animate = false;

	for (const key in _preset_steps) {
		if (!Object.hasOwn(_preset_steps, key)) continue;
		const step: Step = Reflect.get(_preset_steps, key);
		step.status = 'wait';
	}
	for (const key of props.presetSteps) {
		state.steps.push(Reflect.get(_preset_steps, key));
	}
}

async function setup() {
	state.current_step = 0;
	try {
		for (const step of state.steps) {
			step.status = 'wait';
			step.error = '';
		}
		let error = false;
		for (const step of state.steps) {
			if (error) {
				step.hidden = true;
				continue;
			}
			step.status = 'process';
			await step.action(step);
			if (step.error) {
				step.status = 'error';
				error = true;
			} else {
				step.status = 'finish';
			}
			state.current_step += 1;
			await sleep(200);
		}
		if (state.steps.every((s) => s.status === 'finish')) {
			state.steps.push({
				title: '初始化完成',
				status: 'finish',
				async action(step) {
					step.description = t('setup_finish_notice', '');
				}
			});
			state.current_step += 1;
			state.finish_animate = true;
			await sleep(1000);
			emits('finish');
		}
	} catch (err) {
		console.error(err);
		Message.error('初始化失败 : ' + err);
		emits('error', String(err));
	}
}
</script>

<style scoped lang="less">
:deep(.arco-steps-vertical .arco-steps-item:not(:last-child)) {
	min-height: 42px;
}

/* 完成反馈：打勾图标旋转一圈后定格，时长 200ms */
.finish-check-animate {
	display: inline-block;
	animation: finish-check-rotate 500ms linear forwards;
}

@keyframes finish-check-rotate {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

// 透明化步骤图标背景，自由设置
:deep(.arco-steps-icon) {
	background-color: white !important;
}

:deep(.arco-steps-item-wait .arco-steps-icon, .arco-steps-item-process .arco-steps-icon) {
	background-color: rgb(229, 229, 229) !important;
}
</style>

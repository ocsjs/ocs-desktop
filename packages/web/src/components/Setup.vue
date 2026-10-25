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
								<icon-check-circle
									v-if="step.status === 'finish'"
									style="color: green; font-size: 28px"
									class="finish-check-animate"
								/>
								<icon-close-circle
									v-else-if="step.status === 'error'"
									style="font-size: 28px; background-color: white"
								/>
								<icon-refresh
									v-else-if="step.status === 'process'"
									style="font-size: 28px; color: gray"
									spin
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
								<icon-check-circle-fill
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
							<icon-loading /> 初始化中...
						</a-button>
					</template>
				</a-space>
			</a-col>
		</a-row>

		<!-- 自动化程序选择弹窗 -->
		<a-modal
			v-model:visible="setupState.showScriptSelector"
			:footer="false"
			unmount-on-close
			:mask-closable="false"
			:closable="false"
		>
			<template #title> 选择自动化程序 </template>
			<div class="mb-2">
				<span style="font-size: 12px">请选择需要添加到新建浏览器的自动化程序</span>
			</div>
			<AutomationScriptSelector
				:automation-scripts="[]"
				@confirm="onSelectorConfirm"
			>
				<template #actions>
					<a-button
						size="small"
						type="text"
						@click="skipScriptSelector"
					>
						跳过此步骤
					</a-button>
				</template>
			</AutomationScriptSelector>
		</a-modal>

		<!-- 自动化程序配置弹窗 -->
		<a-modal
			v-model:visible="setupState.showScriptConfig"
			:footer="false"
			unmount-on-close
			:mask-closable="false"
			:closable="false"
			:width="620"
		>
			<template #title> 填写自动化程序配置 </template>
			<div class="text-secondary mb-2">请填写所选自动化程序的配置信息</div>
			<div style="max-height: 60vh; overflow: overlay">
				<a-empty v-if="setupState.configScripts.length === 0" />
				<AutomationScriptList
					v-else
					v-model:automation-scripts="setupState.configScripts"
				></AutomationScriptList>
			</div>
			<div class="d-flex justify-content-end mt-2">
				<a-space>
					<a-button
						size="small"
						@click="skipScriptConfig"
					>
						跳过
					</a-button>
					<a-button
						type="primary"
						size="small"
						@click="onConfigConfirm"
					>
						保存配置
					</a-button>
				</a-space>
			</div>
		</a-modal>
	</a-modal>
</template>

<script setup lang="ts">
import { t, store } from '../store';
import { sleep } from '../utils';
import { remote } from '../utils/remote';
import { reactive, watch, nextTick, onMounted } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { installExtensions } from '../utils/extension';
import { addScriptFromUrl } from '../utils/user-scripts';
import { electron } from '../utils/node';
import { Environment } from '../utils/environment';
import { getDefaultBrowserName, newBrowser } from '../utils/browser';
import { Browser } from '../fs/browser';
import AutomationScriptSelector from './automation-scripts/AutomationScriptSelector.vue';
import AutomationScriptList from './automation-scripts/AutomationScriptList.vue';
import type { RawAutomationScript } from './automation-scripts';
import { useEnvironmentDetect } from '../composables/useEnvironmentDetect';
import { useResources } from '../composables/useResources';
const { updateEnvironmentDetect } = useEnvironmentDetect();
const { refreshFileStatus } = useResources();

type Step = {
	title: string;
	description?: string;
	error?: string;
	status?: 'wait' | 'process' | 'finish' | 'error';
	hidden?: boolean;
	action: (step: Step) => any;
};

const _preset_steps = {
	show_desc: {
		title: '等待初始化...',
		description: t('setup_modal_notice', ''),
		action() {}
	} as Step,
	init_env: {
		title: '初始化环境',
		async action(step) {
			step.description = '正在检测可用浏览器...';

			const valid_version_browser = await Environment.getSupportedBrowser();
			if (valid_version_browser) {
				store.render.setting.launchOptions.executablePath = valid_version_browser.path;
				step.description += `\n设置浏览器路径为： ${valid_version_browser.name} - ${valid_version_browser.path}`;
				return;
			}

			// =========================== 下载并安装内置浏览器 ===========================
			// 精简版安装包不再内置浏览器：复用环境初始化流程，从多源（镜像/官方/自建CDN）下载 chrome 二进制并解压配置
			step.description = '未检测到可用浏览器，将下载并安装内置浏览器。';
			try {
				await new Promise<void>((resolve, reject) => {
					Modal.confirm({
						title: '下载内置浏览器',
						content:
							'当前无可用的浏览器，点击确认将从多源下载并安装软件内置浏览器（约 150MB），安装完成后自动配置为默认浏览器。',
						maskClosable: false,
						closable: false,
						cancelText: '取消',
						okText: '一键下载并安装',
						onCancel() {
							reject(new Error('用户取消下载，请自行在软件设置中配置可用的浏览器路径后重试。'));
						},
						async onOk() {
							resolve();
						}
					});
				});
			} catch (error) {
				step.error = String(error);
				return;
			}

			// 监听主进程推送的安装进度，实时刷新步骤描述
			const progressHandler = (_e: any, progress: { message?: string }) => {
				if (progress?.message) {
					step.description = progress.message;
				}
			};
			electron.ipcRenderer.on('builtin-chrome-install-progress', progressHandler);
			try {
				step.description = '正在准备下载内置浏览器...';
				const executablePath: string = await remote.methods.call('installBuiltinChrome');
				// 安装完成：设置为默认浏览器路径并刷新环境检测
				store.render.setting.launchOptions.executablePath = executablePath;
				step.description = `内置浏览器安装完成，已设置为默认浏览器：\n${executablePath}`;
			} catch (error) {
				console.error(error);
				step.error =
					'内置浏览器下载/安装失败：' +
					String(error) +
					'\n\n请检查网络连接后重试；若仍无法下载，请前往官方网站找到软件交流群并加入，联系管理员。';
			} finally {
				electron.ipcRenderer.removeListener('builtin-chrome-install-progress', progressHandler);
			}
		}
	} as Step,
	init_extensions: {
		title: '初始化浏览器拓展',
		async action(step) {
			step.description = '正在获取远程资源信息...';
			// 获取最新的拓展和用户脚本信息
			const extensions = await Environment.getExtensions();

			const install_new = async () => {
				const default_extension = extensions[0];
				if (!default_extension) {
					step.error = '未检测到可用脚本管理器拓展，请尝试重启软件。';
					return;
				}
				step.description += `\n共检测到 ${extensions.length} 个脚本管理器拓展，正在安装...`;
				const default_extension_filepath = await installExtensions(extensions, default_extension, {
					force_install: true
				});
				if (!default_extension_filepath) {
					step.error = '脚本管理器安装失败，请稍后重试，或者稍后在软件设置-应用设置手动安装。';
					return;
				}
				step.description += `\n已安装脚本管理器：${default_extension.name} - ${default_extension.url}`;
			};

			// 仅当全部都没安装时才安装第一个（原误判为 every：任一未安装就把所有拓展全部重装，
			// 导致已装脚本猫的用户在初始化/修复时被额外安装篡改猴，安装中断还会留下空目录残留）
			if (!extensions.some((ext) => ext.installed)) {
				return install_new();
			}
			// 如果版本不支持
			const supported_extension = await Environment.getSupportedExtension();

			// 检查是否为 MV2 拓展，如果是则报错
			if (!supported_extension) {
				step.description = t(
					'setup_error_auto_download_new_extension_when_version_too_low',
					'当前脚本管理器版本较低，需要更新拓展到最新MV3版本'
				);
				try {
					await new Promise<void>((resolve, reject) => {
						Modal.confirm({
							title: '警告',
							content: step.description || '',
							maskClosable: false,
							closable: false,
							cancelText: '取消',
							okText: '一键更新',
							onCancel(e) {
								reject(new Error('你已取消更新，请自行在软件设置-应用设置更新拓展或者重新初始化。'));
							},
							async onOk() {
								await install_new();
								resolve();
							}
						});
					});
				} catch (err) {
					step.error = String(err);
					return;
				}
				return;
			}
			step.description = `已安装脚本管理器：${supported_extension.name} - ${supported_extension.url}`;
		}
	} as Step,
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
			setupState.newBrowserInstance = browser;
			step.description = `已创建浏览器：${browser.name}，可在浏览器列表中查看并重命名。`;
		}
	} as Step,
	init_automationScript: {
		title: '添加自动化程序',
		async action(step) {
			await sleep(500);
			step.description = '请选择需要添加的自动化程序...';
			const selected = await openScriptSelector();
			// 未选择则跳过此步骤
			if (!selected || selected.length === 0) {
				step.description = '已跳过自动化程序添加。';
				return;
			}
			// 紧接着弹出配置弹窗，提示用户填写配置信息
			setupState.configScripts = JSON.parse(JSON.stringify(selected));
			const configured = await openScriptConfig();
			if (configured && configured.length && setupState.newBrowserInstance) {
				setupState.newBrowserInstance.automationScripts = configured;
				step.description = `已为浏览器「${setupState.newBrowserInstance.name}」添加 ${configured.length} 个自动化程序。`;
			} else {
				step.description = '未保存自动化程序配置，已跳过。';
			}
		}
	} as Step,
	init_script: {
		title: '初始化脚本',
		async action(step) {
			const default_user_script = await Environment.getValidUserScript();
			if (!default_user_script) {
				step.error = '未检测到可用脚本，请稍后在左侧软件设置中设置。';
				return;
			}
			step.description = `正在安装默认脚本：` + default_user_script.name;
			await addScriptFromUrl(default_user_script.url);
			step.description = `已安装用户脚本：${default_user_script.name} - ${default_user_script.url}`;
		}
	} as Step,
	update_env: {
		title: '更新环境',
		async action() {
			await updateEnvironmentDetect();
			refreshFileStatus();
		}
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
		presetSteps: () => [
			'show_desc',
			'init_env',
			'new_browser',
			'init_extensions',
			'init_automationScript',
			'init_script'
		]
	}
);

const state = reactive({
	current_step: -1,
	finish_animate: false,
	steps: [] as Step[]
});

/** 新建浏览器与自动化程序交互状态 */
const setupState = reactive({
	showScriptSelector: false,
	showScriptConfig: false,
	/** 用户已选中的自动化程序（用于配置弹窗编辑） */
	configScripts: [] as RawAutomationScript[],
	/** 新建的浏览器实例 */
	newBrowserInstance: null as Browser | null
});

/** 弹窗的 Promise resolve 回调（非响应式，无需放入 reactive） */
let selectorResolver: ((v: RawAutomationScript[] | null) => void) | null = null;
let configResolver: ((v: RawAutomationScript[] | null) => void) | null = null;

/** 弹出自动化程序选择弹窗，返回用户选择的脚本（跳过/未选时返回 null） */
function openScriptSelector(): Promise<RawAutomationScript[] | null> {
	return new Promise((resolve) => {
		selectorResolver = resolve;
		setupState.showScriptSelector = true;
	});
}

function onSelectorConfirm(scripts: RawAutomationScript[]) {
	setupState.showScriptSelector = false;
	if (selectorResolver) {
		selectorResolver(scripts && scripts.length ? scripts : null);
		selectorResolver = null;
	}
}

function skipScriptSelector() {
	setupState.showScriptSelector = false;
	if (selectorResolver) {
		selectorResolver(null);
		selectorResolver = null;
	}
}

/** 弹出自动化程序配置弹窗，返回填写完成的脚本（跳过时返回 null） */
function openScriptConfig(): Promise<RawAutomationScript[] | null> {
	return new Promise((resolve) => {
		configResolver = resolve;
		setupState.showScriptConfig = true;
	});
}

function onConfigConfirm() {
	setupState.showScriptConfig = false;
	if (configResolver) {
		configResolver(JSON.parse(JSON.stringify(setupState.configScripts)));
		configResolver = null;
	}
}

function skipScriptConfig() {
	setupState.showScriptConfig = false;
	if (configResolver) {
		configResolver(null);
		configResolver = null;
	}
}

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
	setupState.showScriptSelector = false;
	setupState.showScriptConfig = false;
	setupState.configScripts = [] as RawAutomationScript[];
	setupState.newBrowserInstance = null as Browser | null;

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

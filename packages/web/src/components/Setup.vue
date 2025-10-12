<template>
	<a-modal
		:visible="props.visible"
		:footer="false"
		:closable="false"
		@close="
			() => {
				emits('update:visible', false);
			}
		"
	>
		<template #title> {{ props.title }} </template>
		<a-row :gutter="[24, 24]">
			<a-col v-if="!Environment.infos.value">
				<template v-if="Environment.loading">
					<div class="text-center">
						<a-spin />
						<div class="mt-2">正在初始化资源，请稍后...</div>
					</div>
				</template>
				<template v-else>
					<div class="text-center text-danger">未能获取到远程资源信息，请检查网络后重试，或者稍后手动设置。</div>
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
							:title="step[0]"
							:status="step.status"
						>
							<template
								v-if="step.status"
								#icon
							>
								<icon-check
									v-if="step.status === 'finish'"
									style="color: green"
								/>
								<icon-close v-else-if="step.status === 'error'" />
								<icon-loading v-else-if="step.status === 'process'" />
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
							@click="
								() => {
									emits('finish');
									emits('update:visible', false);
								}
							"
						>
							完成！
						</a-button>
					</template>
					<template v-else-if="state.current_step === -1 || state.steps.find((s) => s.status === 'error')">
						<a-button
							size="small"
							@click="notNow"
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
	</a-modal>
</template>

<script setup lang="ts">
import { lang, store } from '../store';
import { download, sleep } from '../utils';
import { remote } from '../utils/remote';
import { reactive, watch, nextTick, onMounted } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { installExtensions } from '../utils/extension';
import { addScriptFromUrl } from '../utils/user-scripts';
import { root } from '../fs/folder';
import { newBrowser } from '../utils/browser';
import { Browser } from '../fs/browser';
import { child_process } from '../utils/node';
import { Environment } from '../utils/environment';

type Step = {
	title: string;
	description?: string;
	error?: string;
	status?: 'wait' | 'process' | 'finish' | 'error';
	hidden?: boolean;
	action: (step: Step) => any;
};

const state = reactive({
	current_step: -1,
	steps: [] as Step[]
});

const props = withDefaults(
	defineProps<{
		visible: boolean;
		confirmText: string;
		cancelText: string;
		title: string;
		createNewBrowser?: boolean;
	}>(),
	{
		visible: false,
		confirmText: '一键初始化',
		cancelText: '稍后手动设置',
		title: '初始化软件设置',
		createNewBrowser: true
	}
);

const emits = defineEmits<{
	(e: 'finish'): void;
	(e: 'error', err: string): void;
	(e: 'update:visible', data: any): void;
}>();

onMounted(async () => {
	await Environment.init();
	prepare();
});

watch(
	() => props.visible,
	() => {
		nextTick(async () => {
			await Environment.init();
			prepare();
		});
	}
);

function notNow() {
	emits('update:visible', false);
}

function prepare() {
	try {
		state.steps = [];
		state.current_step = -1;

		state.steps.push({
			title: '等待初始化...',
			description: lang('setup_modal_notice', ''),
			async action(step) {}
		});

		state.steps.push({
			title: '初始化浏览器',
			async action(step) {
				step.description = '正在检测可用浏览器...';

				const valid_version_browser = await Environment.getSupportedBrowser();
				if (valid_version_browser) {
					store.render.setting.launchOptions.executablePath = valid_version_browser.path;
					step.description += `\n设置浏览器路径为： ${valid_version_browser.name} - ${valid_version_browser.path}`;
					return;
				}

				// =========================== 安装新版本 ===========================
				if (process.platform !== 'win32' && process.platform !== 'darwin') {
					step.error = lang(
						'setup_error_un_support_platform_when_auto_download_new_version',
						'当前系统不支持自动更新软件，请前往官网 https://docs.ocsjs.com \n手动下载最新软件并安装和启动。'
					);
					return;
				}

				const infos = await Environment.getRemoteInfos();
				console.log(infos);
				const app_download_url = infos?.versions[0].app_downloads?.[process.platform];
				if (!app_download_url) {
					step.error = lang(
						'setup_error_no_windows_download_url_when_auto_download_new_version',
						`未找到 ${process.platform} 版本的下载地址，请前往官网 https://docs.ocsjs.com \n手动下载最新软件并安装和启动。`,
						{ platform: process.platform }
					);
					return;
				}

				const dest = await remote.path.call(
					'join',
					store.paths.downloadFolder,
					app_download_url.split('/').pop() ||
						(process.platform === 'win32' ? 'ocs-desktop-installer.exe' : 'ocs-desktop-installer.dmg')
				);

				step.description = lang(
					'setup_error_auto_download_new_version_when_no_valid_browser',
					'无可用的浏览器，正在下载并更新软件至最新版本： ' + infos?.versions[0]?.tag,
					{ version: infos?.versions[0]?.tag || '' }
				);
				try {
					const result = await new Promise<string | boolean | undefined>((resolve, reject) => {
						Modal.confirm({
							title: '警告',
							content: '当前浏览器版本过高，点击确认将自动下载最新版本软件，下载后将有内置浏览器可用。',
							maskClosable: false,
							closable: false,
							cancelText: '取消',
							okText: '一键下载并安装',
							onCancel(e) {
								reject(new Error('用户取消下载，请自行更新，然后配置浏览器路径'));
							},
							async onOk() {
								const existsSync = await remote.fs.call('existsSync', dest);
								if (existsSync) {
									resolve(true);
									return;
								}

								step.description += '\n正在下载最新版本软件：' + app_download_url;
								const fp = await download({
									name: '最新软件下载',
									dest: dest,
									url: app_download_url
								});
								step.description += '\n下载完成，即将开始安装，请安装后重新初始化设置。';
								resolve(fp);
							}
						});
					});
					if (result === true) {
						step.error = '检测到最新软件版本已下载，正在打开安装程序中，请安装后重启软件并初始化设置。';
						console.log(dest);
						await new Promise<void>((resolve, reject) => {
							Modal.confirm({
								title: '警告',
								content: step.error || '',
								maskClosable: false,
								closable: false,
								cancelText: '取消',
								okText: '一键安装',
								onCancel(e) {
									reject(new Error('你已取消安装，请自行更新软件或者重新初始化。'));
								},
								async onOk() {
									// 关闭软件
									step.error = '安装程序已启动，请安装后重启软件并初始化设置。';
									child_process.execFileSync(`"${dest}"`, { shell: true, windowsHide: false });
								}
							});
						});
					} else if (typeof result === 'string') {
						step.description += '\n最新版本软件下载完成，即将启动安装程序...';
						emits('update:visible', false);
						await new Promise<void>((resolve, reject) => {
							Modal.info({
								title: '提示',
								content: '最新版本软件下载完成，点击确定启动安装程序，请安装后重新初始化设置。',
								maskClosable: false,
								closable: false,
								okText: '确认安装',
								onOk(e) {
									// 关闭软件
									step.error = '安装程序已启动，请安装后重启软件并初始化设置。';
									child_process.execFileSync(`"${result}"`, { shell: true, windowsHide: false });
								}
							});
						});
					} else {
						throw new Error('未知错误，请稍后重试，或者手动更新软件');
					}
				} catch (error) {
					console.error(error);
					step.error = error;
				}
			}
		});

		state.steps.push({
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
						step.error = '脚本管理器安装失败，请稍后重试，或者稍后在左侧应用中心手动安装。';
						return;
					}
					step.description += `\n已安装脚本管理器：${default_extension.name} - ${default_extension.url}`;
				};

				// 如果全部都没安装则安装第一个
				if (!extensions.every((ext) => ext.installed)) {
					return install_new();
				}
				// 如果版本不支持
				const supported_extension = await Environment.getSupportedExtension();

				// 检查是否为 MV2 拓展，如果是则报错
				if (!supported_extension) {
					step.description = lang(
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
									reject(new Error('你已取消更新，请自行在左侧应用中心更新拓展或者重新初始化。'));
								},
								async onOk() {
									await install_new();
									resolve();
								}
							});
						});
					} catch (err) {
						step.error = err;
						return;
					}
					return;
				}
				step.description = `已安装脚本管理器：${supported_extension.name} - ${supported_extension.url}`;
			}
		});

		state.steps.push({
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
		});

		if (props.createNewBrowser) {
			state.steps.push({
				title: '新建浏览器',
				action(step) {
					const children = root().listChildren();
					if (children.length !== 0) {
						step.description = '已存在浏览器，无需重复创建。';
						return;
					}
					const name = '未命名浏览器';
					newBrowser({
						name: name
					});

					step.description = `已创建浏览器：${name}，可稍后在左侧软件设置中修改名称`;
				}
			});

			state.steps.push({
				title: '浏览器启动测试',
				async action(step) {
					const children = root().listChildren();
					if (children.length === 0) {
						step.error = '未检测到浏览器，请稍后在左侧软件设置中创建浏览器。';
						return;
					}

					const browser = children[0];
					const instance = Browser.from(browser.uid);
					if (!instance) {
						step.error = '未检测到浏览器，请稍后在左侧软件设置中创建浏览器。';
						return;
					}

					try {
						const code = await instance.launch();
						if (typeof code === 'number') {
							step.error = '浏览器启动测试失败，请查看右侧详细错误信息。';
							return;
						} else {
							step.description = '浏览器启动测试成功，即将自动关闭';
							instance.close();
						}
					} catch (err) {
						step.error = '浏览器启动测试失败：' + err;
					}
				}
			});

			state.steps.push({
				title: '初始化完成',
				async action(step) {
					step.description = lang('setup_finish_notice', '');
				}
			});
		}
	} catch (err) {
		console.error(err);
		Message.error(String(err));
		emits('error', String(err));
	}
}

async function setup() {
	if (state.steps.length > 0) {
		prepare();
	}
	state.current_step = 0;
	try {
		for (const step of state.steps) {
			step.status = 'wait';
			step.description = '';
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
			Message.success('初始化完成！');
		}
	} catch (err) {
		console.error(err);
		Message.error('安装失败，请稍后重试，或者手动设置 : ' + err);
		emits('error', String(err));
	}
}
</script>

<style scoped lang="less">
:deep(.arco-steps-vertical .arco-steps-item:not(:last-child)) {
	min-height: 42px;
}
</style>

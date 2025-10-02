<template>
	<a-row :gutter="[24, 24]">
		<template v-if="state.error">
			<a-empty :description="`初始化错误，可能是网络请求错误请稍后重试。${state.error}`" />
		</template>
		<template v-else>
			<a-col class="text-center">
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
		</template>
		<a-col class="text-center mt-2">
			<a-space :size="24">
				<template v-if="state.current_step === state.steps.length">
					<a-button
						type="primary"
						size="small"
						@click="store.render.state.setup = false"
					>
						完成！
					</a-button>
				</template>
				<template v-else-if="state.current_step === -1">
					<a-button
						size="small"
						@click="notNow"
					>
						稍后手动设置
					</a-button>
					<a-button
						type="primary"
						size="small"
						@click="setup"
					>
						一键初始化
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
</template>

<script setup lang="ts">
import { lang, store } from '../store';
import { download, getRemoteInfos, sleep } from '../utils';
import { remote } from '../utils/remote';
import { onMounted, reactive } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { installExtensions } from '../utils/extension';
import { addScriptFromUrl } from '../utils/user-scripts';
import { ResourceLoader } from '../utils/resources.loader';
import { ResourceFile } from '@ocs-desktop/common/src/api';
import { root } from '../fs/folder';
import { newBrowser } from '../utils/browser';
import { Browser } from '../fs/browser';
import { Infos } from '../../../common/lib/src/api';
import { child_process } from '../utils/node';
import _get from 'lodash/get';

type Extension = ResourceFile & { installed?: boolean };
type Step = {
	title: string;
	description?: string;
	error?: string;
	status?: 'wait' | 'process' | 'finish' | 'error';
	hidden?: boolean;
	action: (step: Step) => any;
};

const state = reactive({
	error: '',
	current_step: -1,
	steps: [] as Step[]
});

/** 资源加载器 */
const resourceLoader = new ResourceLoader({
	resourceRootPath: store.paths.downloadFolder
});

onMounted(async () => {
	prepare();
});

function notNow() {
	store.render.state.setup = false;
}

function prepare() {
	try {
		let infos: Infos | undefined;
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

				// 检测有效的浏览器路径
				const browsers = [
					{
						name: '默认设置浏览器',
						path: store.render.setting.launchOptions.executablePath || ''
					},
					...(await remote.methods.call('getValidBrowsers'))
				].filter((b) => b.path && remote.fs.callSync('existsSync', b.path));

				const versions = await Promise.all(
					browsers.map((browser) => remote.methods.call('getBrowserMajorVersion', browser.path))
				);
				console.log(versions);
				// =========================== 可用 ===========================
				if (versions.some((v) => v && v <= 137)) {
					step.description = `共检测到 ${browsers.length} 个可用浏览器`;
					const valid_version_browser = browsers.find((_, i) => versions[i] && versions[i] <= 137);
					if (!valid_version_browser) {
						step.error = '未检测到可用浏览器，请稍后在左侧软件设置中设置。';
					} else {
						store.render.setting.launchOptions.executablePath = valid_version_browser.path;
						step.description += `\n设置浏览器路径为： ${valid_version_browser.name} - ${valid_version_browser.path}`;
					}
					return;
				}

				// =========================== 安装新版本 ===========================
				if (process.platform !== 'win32') {
					step.error = lang(
						'setup_error_un_support_platform_when_auto_download_new_version',
						'当前系统不支持自动更新软件，请手动前往官网下载最新软件并安装和启动。'
					);
					return;
				}
				infos = await getRemoteInfos();
				console.log(infos);

				const win32_download_url = infos?.versions[0].app_downloads?.win32;
				if (!win32_download_url) {
					step.error = lang(
						'setup_error_no_windows_download_url_when_auto_download_new_version',
						'未找到 Windows 版本的下载地址，请前往官网下载最新软件并安装和启动。'
					);
					return;
				}

				const dest = await remote.path.call(
					'join',
					store.paths.downloadFolder,
					win32_download_url.split('/').pop() || 'ocs-desktop-latest.exe'
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

								step.description += '\n正在下载最新版本软件：' + win32_download_url;
								const fp = await download({
									name: '最新软件下载',
									dest: dest,
									url: win32_download_url
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
									child_process.execFileSync(`"${dest}"`, { shell: true, windowsHide: false });
									resolve();
								}
							});
						});
					} else if (typeof result === 'string') {
						step.description += '\n最新版本软件下载完成，即将启动安装程序...';
						store.render.state.setup = false;
						await new Promise<void>((resolve, reject) => {
							Modal.info({
								title: '提示',
								content: '最新版本软件下载完成，点击确定启动安装程序，请安装后重新初始化设置。',
								maskClosable: false,
								closable: false,
								okText: '确认安装',
								onOk(e) {
									child_process.execFileSync(`"${result}"`, { shell: true, windowsHide: false });
									resolve();
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
				infos = await getRemoteInfos();
				// 获取最新的拓展和用户脚本信息
				const extensions = (infos.resourceGroups.find((group) => group.name === 'extensions')?.files ||
					[]) as Extension[];
				for (const extension of extensions) {
					extension.installed = await resourceLoader.isZipFileExists('extensions', extension);
				}
				const installed_extension = extensions.find((e) => e.installed);

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

				if (!installed_extension) {
					return install_new();
				}

				const manifest = JSON.parse(
					String(
						await remote.fs.call(
							'readFileSync',
							await remote.path.call(
								'join',
								await resourceLoader.getUnzippedPath('extensions', installed_extension),
								'manifest.json'
							),
							'utf-8'
						)
					)
				);
				// 检查是否为 MV2 拓展，如果是则报错
				if (_get(manifest, 'manifest_version', 2) < 3) {
					step.description = lang(
						'setup_error_auto_download_new_extension_when_version_too_low',
						'当前拓展 {{name}} 版本较低，需要更新拓展到最新MV3版本',
						{ name: installed_extension.name }
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
				step.description = `已安装脚本管理器：${installed_extension.name} - ${installed_extension.url}`;
			}
		});

		state.steps.push({
			title: '初始化脚本',
			async action(step) {
				const userScripts = infos?.resourceGroups.find((group) => group.name === 'userjs')?.files || [];
				const default_user_script = userScripts[0];
				if (!default_user_script) {
					step.error = '未检测到可用脚本，请稍后在左侧软件设置中设置。';
					return;
				}
				step.description = `共检测到 ${userScripts.length} 个用户脚本，正在安装...`;
				await addScriptFromUrl(default_user_script.url);
				step.description = `已安装用户脚本：${default_user_script.name} - ${default_user_script.url}`;
			}
		});

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
	} catch (err) {
		state.error = String(err);
		console.error(err);
		Message.error(String(err));
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
		Message.success('初始化完成');
	} catch (err) {
		state.error = String(err);
		console.error(err);
		Message.error('安装失败，请稍后重试，或者手动设置 : ' + err);
	}
}
</script>

<style scoped lang="less">
:deep(.arco-steps-vertical .arco-steps-item:not(:last-child)) {
	min-height: 42px;
}
</style>

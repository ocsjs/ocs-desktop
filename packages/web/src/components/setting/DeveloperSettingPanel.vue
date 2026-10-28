<template>
	<div class="setting container-md">
		<a-card>
			<template #title>
				<span class="card-title-icon">🛠️</span>
				<a-space>
					开发者设置
					<a-tag
						size="small"
						color="orange"
					>
						重启后自动隐藏
					</a-tag>
				</a-space>
			</template>

			<a-divider
				orientation="left"
				style="margin: 4px 0 12px"
			>
				功能开关
			</a-divider>

			<Description>
				<template #label>
					软件辅助
					<a-popover>
						<template #content>
							<div style="max-width: 320px">
								<div>
									开启后软件监听浏览器路由（ocs-environment /
									ocs-script-actions），与用户脚本联动提供自动化增强（点击、填写等页面动作）。
								</div>
								<div>关闭后脚本不再识别为软件环境，自动化增强不可用；可用于排查卡顿/性能问题。</div>
								<div>仅对之后启动的浏览器生效。</div>
							</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-switch v-model="store.render.setting.dev.scriptAssistance" />
			</Description>

			<Description>
				<template #label>
					文件下载优化
					<a-popover>
						<template #content>
							<div style="max-width: 320px">
								<div>
									开启后恢复浏览器原生下载行为：下载气泡显示真实文件名、文件原生落盘到「文件下载」目录，模拟真实下载。
								</div>
								<div>关闭后回退为 Playwright 托管下载（临时 GUID 文件名），可能无法下载文件。</div>
								<div>仅对之后启动的浏览器生效。</div>
							</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-switch v-model="store.render.setting.dev.downloadOptimization" />
			</Description>

			<a-alert
				v-if="!store.render.setting.dev.downloadOptimization"
				type="warning"
				style="margin: 4px 0 12px"
			>
				已关闭：浏览器内下载可能失败或文件名异常，建议保持开启。
			</a-alert>

			<Description>
				<template #label>
					数据加密
					<a-popover>
						<template #content>
							<div style="max-width: 320px">
								<div>开启后配置数据（脚本配置中的账号密码、浏览器备注等）经主密钥加密后落盘。</div>
								<div>关闭后全部按明文存储于 config.json，任何能读取该文件的人都能看到敏感信息。</div>
							</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-switch v-model="store.render.setting.dev.dataEncryption" />
			</Description>

			<a-alert
				v-if="!store.render.setting.dev.dataEncryption"
				type="warning"
				style="margin: 4px 0 12px"
			>
				已关闭：配置数据将以明文保存，存在泄露风险。
			</a-alert>

			<a-divider orientation="left"> 更新调试 </a-divider>

			<Description label="当前版本">
				<span>{{ store.version }}</span>
			</Description>

			<Description>
				<template #label>
					自定义更新源
					<a-popover>
						<template #content>
							<div style="max-width: 320px">
								<div>测试/调试用途：指定 latest.yml 所在的目录 URL，切换更新环境（如测试 CDN 目录）。</div>
								<div>留空则使用默认线上源。</div>
							</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-input
					v-model="store.updater.feedUrl"
					:placeholder="'默认：' + OCS_UPDATER.feedUrl"
					allow-clear
				/>
			</Description>

			<Description label="允许降级安装">
				<a-tooltip content="测试用途：允许安装低于或等于当前版本的更新包，便于重复测试更新流程">
					<a-switch v-model="store.updater.allowDowngrade" />
				</a-tooltip>
			</Description>

			<Description label="手动检查更新">
				<a-button
					type="primary"
					size="small"
					:loading="checkingUpdate"
					@click="onCheckUpdate"
				>
					检查更新
				</a-button>
			</Description>

			<a-divider orientation="left"> 接口调试 </a-divider>

			<Description>
				<template #label>
					自定义信息接口
					<a-popover>
						<template #content>
							<div style="max-width: 320px">
								<div>测试/调试用途：覆盖软件信息接口（ocs-app-infos.json），影响资源组/通知/书签等数据的来源。</div>
								<div>留空则使用默认线上接口。</div>
							</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-input
					v-model="store.updater.infosUrl"
					:placeholder="'默认：' + OCS_API.infos"
					allow-clear
				/>
			</Description>

			<a-divider orientation="left"> 脚本调试 </a-divider>

			<Description>
				<template #label>
					OCS index 脚本
					<a-popover>
						<template #content>
							<div style="max-width: 320px">
								<div>测试/调试用途：覆盖 OCS index 脚本的加载地址（如本地开发构建产物）。</div>
								<div>留空则使用默认线上地址，对之后加载的浏览器生效。</div>
							</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-input
					v-model="store.scriptResources.index"
					:placeholder="'默认：' + OCS_SCRIPT_RESOURCES.index"
					allow-clear
				/>
			</Description>

			<Description>
				<template #label>
					EasyUs 脚本
					<a-popover>
						<template #content>
							<div style="max-width: 320px">
								<div>测试/调试用途：覆盖 EasyUs 脚本的加载地址（如本地开发构建产物）。</div>
								<div>留空则使用默认线上地址，对之后加载的浏览器生效。</div>
							</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-input
					v-model="store.scriptResources.easyUs"
					:placeholder="'默认：' + OCS_SCRIPT_RESOURCES.easyUs"
					allow-clear
				/>
			</Description>

			<a-divider orientation="left"> 服务调试 </a-divider>

			<Description label="本地服务器端口">
				<a-tooltip content="本地 HTTP 服务（图标代理/浏览器通信等）的监听端口，修改后需重启软件生效">
					<a-input-number
						v-model="store.server.port"
						:min="1024"
						:max="65535"
						style="width: 200px"
					/>
				</a-tooltip>
			</Description>

			<a-divider orientation="left"> 浏览器调试 </a-divider>

			<Description label="浏览器下载源">
				<a-tooltip
					content="强制指定内置浏览器的下载源用于测试下载链路；默认按优先级自动降级（国内镜像 → 谷歌官方 → OCS 自建）"
				>
					<a-select
						v-model="store.updater.chromeSource"
						style="width: 200px"
					>
						<a-option value="">默认（按优先级）</a-option>
						<a-option value="npmmirror">国内镜像源</a-option>
						<a-option value="official">谷歌官方源</a-option>
						<a-option value="ocs-cdn">OCS 自建源</a-option>
					</a-select>
				</a-tooltip>
			</Description>
		</a-card>

		<!-- 软件路径（自通用设置迁入开发者界面底部） -->
		<a-card>
			<template #title>
				<span class="card-title-icon">📂</span>
				软件路径
			</template>
			<Path
				label="浏览器缓存"
				name="userDataDirsFolder"
				:setting="true"
				@on-path-change="onUserDataDirsFolderChange"
			/>
			<Path
				label="文件下载"
				name="downloadFolder"
			/>
			<Path
				label="软件存储"
				name="user-data-path"
			/>
			<Path
				label="可执行文件"
				name="exe-path"
			/>
		</a-card>

		<div class="mt-4 mb-5">
			<a-popconfirm
				content="确认重置您的设置，并重新启动软件吗？"
				ok-text="确认"
				cancel-text="取消"
				@ok="reset"
			>
				<a-button status="danger"> 重置设置 </a-button>
			</a-popconfirm>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Description from '../Description.vue';
import Path from '../Path.vue';
import { store, DEFAULT_RENDER } from '../../store';
import { OCS_UPDATER, OCS_API, OCS_SCRIPT_RESOURCES } from '@ocs-desktop/common/web';
import { remote } from '../../utils/remote';
import { Message } from '@arco-design/web-vue';
import { CircleHelpIcon } from 'lucide-vue-next';
import cloneDeep from 'lodash/cloneDeep';
import { forceClearBrowserCache } from '../../utils/browser';
import { Folder } from '../../fs/folder';
import { Browser } from '../../fs/browser';
import { restartAppGuarded } from '../../utils/restart';

/** 重置设置 */
async function reset() {
	// 仅重置软件设置为默认值，保留浏览器分身、脚本、路径等用户数据
	store.render.setting = cloneDeep(DEFAULT_RENDER.setting);
	store.window = { alwaysOnTop: false, autoLaunch: false, hideToTrayOnClose: false };
	// 同步保存，确保重置落盘后再重启（不依赖关闭流程的保存时序，避免强制退出时丢失）
	// 加密受开发者设置「数据加密」开关控制（重置会恢复默认开启）
	const shouldEncrypt =
		store.render.setting.dev?.dataEncryption !== false && remote.methods.callSync('isEncryptionAvailable');
	remote.methods.callSync('saveStore', JSON.stringify(store), shouldEncrypt);
	// dev 感知重启：pnpm dev 下提示手动重跑终端（见 utils/restart.ts）
	restartAppGuarded('设置已重置，需重启软件后生效。');
}

async function onUserDataDirsFolderChange(previous: string, current: string) {
	// 更改全部浏览器缓存路径
	const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === 'browser') as Browser[];
	if (browsers.length > 0) {
		for (const browser of browsers) {
			browser.cachePath = await remote.path.call('join', current, browser.uid);
		}
	}

	await forceClearBrowserCache('检测到浏览器缓存路径，正在清空之前的缓存数据...', previous);
}

/** 手动检查更新（配合自定义更新源可做更新流程测试） */
const checkingUpdate = ref(false);
async function onCheckUpdate() {
	checkingUpdate.value = true;
	try {
		// 直接携带最新配置（防抖持久化可能尚未落盘；reactive 代理无法跨 IPC 结构化克隆，需转为纯对象）
		const result = await remote.methods.call('checkUpdate', JSON.parse(JSON.stringify(store.updater)));
		if (!result) {
			Message.error('检查更新失败，请查看日志或稍后重试');
		} else if (result.hasUpdate) {
			Message.success(`检测到新版本 ${result.latest}，请按更新弹窗提示操作`);
		} else {
			Message.info(result.message || `当前已是最新版本（${result.current}）`);
		}
	} catch (e) {
		Message.error('检查更新失败：' + e);
	} finally {
		checkingUpdate.value = false;
	}
}
</script>

<style scoped lang="less">
.setting {
	min-height: 500px;
	max-width: 720px;
}

/* 去卡片化：子布局整体已是卡片，此处不再重复卡片样式（覆盖 arco 的全局 !important 规则） */
.setting > .arco-card {
	border: none !important;
	border-radius: 0 !important;
	box-shadow: none !important;
}

/* 各设置小段之间保留间距（与通用设置一致的卡片间距） */
.setting > .arco-card + .arco-card {
	margin-top: 12px;
}

::deep(.arco-card-header-title) {
	display: flex;
	align-items: center;
}

.card-title-icon {
	margin-right: 6px;
	font-size: 22px;
	display: inline-flex;
	align-items: center;
}
</style>

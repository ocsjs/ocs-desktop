<template>
	<div class="setting container-md">
		<a-card title="脚本设置">
			<Description class="pt-2 pb-2">
				<template #label>
					<img
						src="../../public/favicon.png"
						width="32px"
					/>
					<span class="fw-bold"> OCS脚本配置 </span>
				</template>
				<!-- 这里tooltip不删除、兼容旧版浏览器的提示 setting_browser_ocs_config_sync_tip -->
				<!-- <a-tooltip
					:content="
						lang('setting_browser_ocs_config_sync_tip', '开启后，修改OCS配置后会同步到全部由OCS桌面端启动的浏览器中')
					"
				>
					<a-switch v-model="store.render.setting.ocs.openSync">
						<template #checked> 同步到各浏览器 </template>
						<template #unchecked> 同步到各浏览器 </template>
					</a-switch>
				</a-tooltip> -->

				<a-button
					type="primary"
					@click="state.show = true"
				>
					点击配置网页OCS脚本设置
				</a-button>

				<div v-if="state.show">
					<a-modal
						v-model:visible="state.show"
						title="OCS配置"
						width="auto"
						:top="5"
						:align-center="false"
						modal-class="p-0 m-0"
						:mask-closable="false"
						closable
						body-style="padding: 0"
						:footer="state.configs.error === '' && state.configs.loading === false"
						ok-text="保存并同步配置到各浏览器"
						cancel-text="取消同步"
						@cancel="syncNote"
						@ok="
							() => {
								store.render.setting.ocs.openSync = true;
							}
						"
					>
						<div
							id="ocs-global-configs"
							class="m-2"
						>
							<OCSConfigs
								v-model:store="store.render.setting.ocs.store"
								@error="(err) => (state.configs.error = err)"
								@loading="() => (state.configs.loading = true)"
								@loaded="() => (state.configs.loading = false)"
							></OCSConfigs>
						</div>
					</a-modal>
				</div>
			</Description>
		</a-card>

		<a-card title="浏览器设置">
			<BrowserPath></BrowserPath>

			<Description label="原生弹窗">
				<a-tooltip content="启用后，浏览器中的原版弹窗可能会影响脚本运行">
					<a-switch v-model="store.render.setting.browser.enableDialog" />
				</a-tooltip>
			</Description>

			<Description label="强制安装脚本">
				<a-tooltip content="启用后，启动浏览器时将跳过版本检查，强制安装所有启用的脚本">
					<a-switch v-model="store.render.setting.browser.forceUpdateScript" />
				</a-tooltip>
			</Description>

			<Description label="新建浏览器自动初始化">
				<a-tooltip
					content="启用后，点击新建浏览器将自动打开初始化弹窗并执行（新建浏览器、添加自动化程序），关闭则直接创建空浏览器"
				>
					<a-switch v-model="store.render.setting.browser.autoInitNewBrowser" />
				</a-tooltip>
			</Description>
		</a-card>

		<a-card title="基本设置">
			<Description label="开机自启">
				<a-switch v-model="store.window.autoLaunch" />
			</Description>

			<Description label="窗口置顶">
				<a-switch v-model="store.window.alwaysOnTop" />
			</Description>
			<Description label="夜间模式">
				<a-switch
					v-model="store.render.setting.theme.dark"
					@click="changeTheme"
				/>
			</Description>
			<Description label="显示侧边栏文字">
				<a-switch
					v-model="store.render.setting.showSideBarText"
					@click="changeTheme"
				/>
			</Description>
		</a-card>

		<a-card title="其他设置">
			<Description label="浏览器缓存预警阈值">
				<a-input-number
					v-model="store.render.setting.browser.cachesSizeWarningPoint"
					style="width: 200px"
				>
					<template #append> GB </template>
				</a-input-number>
				<a-popover>
					<template #content>
						<div>当前浏览器缓存总大小超过此数字时则会弹出警告弹窗。</div>
						<div>也可在左上角工具中找到 "清除浏览器缓存" 功能</div>
					</template>
					<Icon
						class="ms-2"
						type="help_outline"
					/>
				</a-popover>
			</Description>
		</a-card>

		<a-card title="路径设置">
			<Path
				label="浏览器缓存路径"
				name="userDataDirsFolder"
				:setting="true"
				@on-path-change="onUserDataDirsFolderChange"
			/>
			<Path
				label="文件下载路径"
				name="downloadFolder"
			/>
			<Path
				label="软件存储"
				name="user-data-path"
			/>
			<Path
				label="软件路径"
				name="exe-path"
			/>
		</a-card>

		<div class="mt-4">
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
import Description from './Description.vue';
import Path from './Path.vue';
import { lang, store } from '../store';
import { remote } from '../utils/remote';
import BrowserPath from './setting/BrowserPath.vue';
import OCSConfigs from './OCSConfigs.vue';
import { reactive } from 'vue';
import { changeTheme } from '../utils';
import Icon from './Icon.vue';
import { forceClearBrowserCache } from '../utils/browser';
import { Message } from '@arco-design/web-vue';
import { Folder } from '../fs/folder';
import { Browser } from '../fs/browser';

interface SettingPanelProps {
	simple?: boolean;
}

withDefaults(defineProps<SettingPanelProps>(), {
	simple: false
});

const state = reactive({
	show: false,
	configs: {
		error: '',
		loading: true
	}
});

/** 重置设置 */
async function reset() {
	// @ts-ignore
	store.version = undefined;
	remote.app.call('relaunch');
	remote.app.call('exit', 0);
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

function syncNote() {
	store.render.setting.ocs.openSync = false;
	Message.info({
		content: lang('setting_browser_ocs_config_sync_tip_v2', '修改全局设置后并且同步到各浏览器才会生效哦~'),
		duration: 10 * 1000
	});
}
</script>

<style scoped lang="less">
.setting {
	min-height: 500px;
	max-width: 800px;
}

#ocs-global-configs {
	overflow: overlay;
	max-width: 600px;
	max-height: calc(100vh - 200px);
}

.arco-card + .arco-card {
	margin-top: 12px;
}
</style>

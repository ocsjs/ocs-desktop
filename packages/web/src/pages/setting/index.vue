<template>
	<div class="w-100 h-100 overflow-auto">
		<div class="setting text-center p-2 col-12 col-lg-10">
			<Card title="通用设置">
				<Description label="OCS配置">
					<a-tooltip
						:content="
							lang('setting_browser_ocs_config_sync_tip', '开启后，修改OCS配置后会同步到全部由OCS桌面端启动的浏览器中')
						"
					>
						<a-switch v-model="store.render.setting.ocs.openSync">
							<template #checked> 同步配置 </template>
							<template #unchecked> 同步配置 </template>
						</a-switch>
					</a-tooltip>

					<a-divider
						class="mt-2 mb-2"
						direction="vertical"
					/>

					<a-button
						size="small"
						type="primary"
						@click="state.show = true"
					>
						点击配置网页OCS脚本设置
					</a-button>

					<div v-if="state.show">
						<a-modal
							v-model:visible="state.show"
							title="OCS配置"
							:footer="false"
							width="auto"
							:top="5"
							:align-center="false"
							modal-class="p-0 m-0"
							:mask-closable="false"
							body-style="padding: 0"
							@close="
								() => {
									Message.info({
										content: '修改全局设置后，开启左侧的同步功能才可生效哦~',
										duration: 10 * 1000
									});
								}
							"
						>
							<div
								id="ocs-global-configs"
								class="m-2"
							>
								<OCSConfigs v-model:store="store.render.setting.ocs.store"></OCSConfigs>
							</div>
						</a-modal>
					</div>
				</Description>
			</Card>

			<Card title="浏览器设置">
				<BrowserPath></BrowserPath>

				<Description label="原生弹窗">
					<a-tooltip content="启用后，浏览器中的原版弹窗可能会影响脚本运行">
						<a-switch
							v-model="store.render.setting.browser.enableDialog"
							size="small"
						/>
					</a-tooltip>
				</Description>

				<Description label="强制安装脚本">
					<a-tooltip content="启用后，启动浏览器时将跳过版本检查，强制安装所有启用的脚本">
						<a-switch
							v-model="store.render.setting.browser.forceUpdateScript"
							size="small"
						/>
					</a-tooltip>
				</Description>
			</Card>

			<Card title="基本设置">
				<Description label="开机自启">
					<a-switch
						v-model="store.window.autoLaunch"
						size="small"
					/>
				</Description>

				<Description label="窗口置顶">
					<a-switch
						v-model="store.window.alwaysOnTop"
						size="small"
					/>
				</Description>
				<Description label="夜间模式">
					<a-switch
						v-model="store.render.setting.theme.dark"
						size="small"
						@click="changeTheme"
					/>
				</Description>
				<Description label="显示侧边栏文字">
					<a-switch
						v-model="store.render.setting.showSideBarText"
						size="small"
						@click="changeTheme"
					/>
				</Description>
			</Card>

			<Card title="其他设置">
				<Description label="浏览器缓存预警阈值">
					<a-input-number
						v-model="store.render.setting.browser.cachesSizeWarningPoint"
						style="width: 200px"
						size="small"
					>
						<template #append> GB </template>
						<template #suffix>
							<a-popover>
								<template #content>
									<div>当前浏览器缓存总大小超过此数字时则会弹出警告弹窗。</div>
									<div>也可在左上角工具中找到 "清除浏览器缓存" 功能</div>
								</template>
								<Icon type="help_outline" />
							</a-popover>
						</template>
					</a-input-number>
				</Description>
			</Card>

			<Card title="路径设置">
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
			</Card>

			<div class="mt-4">
				<a-popconfirm
					content="确认重置您的设置，并重新启动软件吗？"
					ok-text="确认"
					cancel-text="取消"
					@ok="reset"
				>
					<a-button
						size="small"
						status="danger"
					>
						重置设置
					</a-button>
				</a-popconfirm>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import Card from '../../components/Card.vue';
import Description from '../../components/Description.vue';
import Path from '../../components/Path.vue';
import { lang, store } from '../../store';
import { remote } from '../../utils/remote';
import BrowserPath from '../../components/setting/BrowserPath.vue';
import OCSConfigs from '../../components/OCSConfigs.vue';
import { reactive } from 'vue';
import { changeTheme } from '../../utils';
import Icon from '../../components/Icon.vue';
import { forceClearBrowserCache } from '../../utils/browser';
import { Message } from '@arco-design/web-vue';
import { Folder } from '../../fs/folder';
import { Browser } from '../../fs/browser';

const state = reactive({
	show: false
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
</script>

<style scoped lang="less">
.setting {
	margin: 0 auto;
	min-height: 500px;
}

#ocs-global-configs {
	overflow: overlay;
	max-width: 600px;
}
</style>

<template>
	<div class="w-100">
		<div class="setting text-center p-2 col-12 col-lg-10">
			<Card title="通用设置">
				<BrowserPath></BrowserPath>

				<Description label="OCS配置">
					<div
						v-show="state.loading === false && state.err !== ''"
						style="color: red"
						:title="state.err"
					>
						解析错误！，请尝试重启软件
					</div>
					<div v-show="state.loading === true && state.err === ''"><icon-loading /> 正在获取最新OCS配置</div>

					<a-tooltip content="同步：不需要在浏览器里面设置OCS配置， 直接在软件设置就能同步到所有浏览器中">
						<a-button
							v-if="state.loading === false && state.err === ''"
							@click="state.show = true"
						>
							点击配置
						</a-button>
						<a-divider
							class="mt-2 mb-2"
							direction="vertical"
						/>
						<a-switch v-model="store.render.setting.ocs.openSync">
							<template #checked> 同步到全部浏览器中 </template>
							<template #unchecked> 同步到全部浏览器中 </template>
						</a-switch>
					</a-tooltip>

					<a-modal
						v-model:visible="state.show"
						title="OCS配置"
						:footer="false"
						width="auto"
						modal-class="p-0 m-0"
						:mask-closable="false"
						body-style="padding: 0"
						@close="
							() => {
								if (store.render.setting.ocs.openSync === false) {
									Message.info('开启右侧的同步功能才可生效哦。');
								}
							}
						"
					>
						<div
							id="ocs-global-configs"
							class="m-2"
						>
							<OCSConfigs
								v-show="state.loading === false"
								v-model:store="store.render.setting.ocs.store"
								@error="(err) => (state.err = err)"
								@loaded="() => (state.loading = false)"
								@loading="() => (state.loading = true)"
							></OCSConfigs>
						</div>
					</a-modal>
				</Description>
			</Card>

			<Card title="浏览器设置">
				<Description label="原生弹窗">
					<a-tooltip content="启用后，浏览器中的原版弹窗可能会影响脚本运行">
						<a-switch
							v-model="store.render.setting.browser.enableDialog"
							size="small"
						/>
					</a-tooltip>
				</Description>

				<Description label="强制更新脚本">
					<a-tooltip content="启用后，安装脚本时果版本没有更新依然会强制重新安装">
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
import { store } from '../../store';
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
	/** 是否加载 */
	loading: false,
	/** 是否加载错误 */
	err: '',
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
	height: 80vh;
	overflow: overlay;
}
</style>

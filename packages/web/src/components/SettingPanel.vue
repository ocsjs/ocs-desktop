<template>
	<div class="setting container-md">
		<a-card>
			<template #title>
				<span class="card-title-icon"
					><img
						src="../../public/favicon.png"
						width="22px"
				/></span>
				<a-space>
					OCS脚本配置
					<a-tag
						v-if="store.render.setting.ocs.openSync"
						color="green"
					>
						<a-space> <IconCheckCircleFill /> 同步中 </a-space>
					</a-tag>
				</a-space>
			</template>
			<template #extra>
				<a-space>
					<a-tooltip
						v-if="store.render.setting.ocs.openSync"
						content="取消配置同步、每个浏览器可手动调整OCS脚本的设置"
					>
						<a-button
							size="small"
							@click="
								() => {
									store.render.setting.ocs.openSync = false;
								}
							"
						>
							<IconClose /> 取消配置同步
						</a-button>
					</a-tooltip>
					<a-button
						v-else
						type="primary"
						size="small"
						@click="onSyncOCSConfig"
					>
						<IconSync />同步配置到各浏览器
					</a-button>
				</a-space>
			</template>
			<div>
				<OCSConfigs v-model:store="store.render.setting.ocs.store"></OCSConfigs>
			</div>
		</a-card>

		<ResourcesCard />

		<a-card>
			<template #title>
				<span class="card-title-icon">⚙️</span>
				基本设置
			</template>

			<Description label="开机自启">
				<a-switch v-model="store.window.autoLaunch" />
			</Description>

			<Description label="后台运行">
				<a-tooltip
					content="启用后，关闭窗口将自动隐藏到系统托盘后台运行；未启用时，若有浏览器运行，将询问关闭并退出或移动至托盘。左键单击托盘图标可重新打开，右键选择「退出」完全关闭。"
				>
					<a-switch v-model="store.window.hideToTrayOnClose" />
				</a-tooltip>
			</Description>

			<Description label="窗口置顶">
				<a-switch v-model="store.window.alwaysOnTop" />
			</Description>

			<Description>
				<template #label>
					软件布局
					<a-popover>
						<template #content>
							<div style="max-width: 300px">
								<div>专业模式相比简洁模式的差异：</div>
								<div>【额外软件设置】</div>
								<div>显示侧边栏文字、浏览器路径设置、浏览器缓存预警阈值</div>
								<div>【浏览器列表页】</div>
								<div>
									文件夹层级管理与路径导航、按名称/备注/标签搜索筛选、批量启动/关闭/删除/移动等批量操作、右侧浏览器面板（运行日志/备注/自动化程序配置）
								</div>
								<div>【监控页】</div>
								<div>可同时查看多个浏览器的实时画面</div>
								<div>【简洁模式】</div>
								<div>浏览器以卡片平铺展示（可设置 1-4 列），无文件夹与批量操作，适合简单场景</div>
							</div>
						</template>
						<Icon
							class="label-help-icon"
							type="help_outline"
						/>
					</a-popover>
				</template>
				<a-select
					v-model="store.render.setting.mode"
					style="width: 160px"
					@change="changeMode"
				>
					<a-option
						v-for="item of layoutOptions"
						:key="item.value"
						:value="item.value"
					>
						<Icon
							:type="item.icon"
							:size="16"
							class="option-icon"
						/>
						{{ item.label }}
					</a-option>
					<!-- 选中框自定义渲染（默认行为会把插槽拍平成纯文本，导致图标连字文本外泄） -->
					<template #label>
						<Icon
							:type="currentLayoutOption.icon"
							:size="16"
							class="option-icon"
						/>
						{{ currentLayoutOption.label }}
					</template>
				</a-select>
			</Description>

			<Description label="主题样式">
				<a-select
					v-model="store.render.setting.theme.mode"
					style="width: 160px"
					@change="changeTheme"
				>
					<a-option
						v-for="item of themeModeOptions"
						:key="item.value"
						:value="item.value"
					>
						<Icon
							:type="item.icon"
							:size="16"
							class="option-icon"
						/>
						{{ item.label }}
					</a-option>
					<!-- 选中框自定义渲染（同软件布局） -->
					<template #label>
						<Icon
							:type="currentThemeModeOption.icon"
							:size="16"
							class="option-icon"
						/>
						{{ currentThemeModeOption.label }}
					</template>
				</a-select>
			</Description>
			<Description label="主题颜色">
				<a-select
					v-model="store.render.setting.theme.color"
					style="width: 160px"
					@change="changeTheme"
				>
					<a-option
						v-for="item of themeColors"
						:key="item.value"
						:value="item.value"
					>
						<span
							class="theme-color-dot"
							:style="{ backgroundColor: item.color }"
						></span>
						{{ item.label }}
					</a-option>
					<!-- 选中框自定义渲染（同软件布局） -->
					<template #label>
						<span
							class="theme-color-dot"
							:style="{ backgroundColor: currentThemeColorOption.color }"
						></span>
						{{ currentThemeColorOption.label }}
					</template>
				</a-select>
			</Description>
			<Description
				v-if="!simple"
				label="显示侧边栏文字"
			>
				<a-switch
					v-model="store.render.setting.showSideBarText"
					@click="changeTheme"
				/>
			</Description>

			<Description
				v-if="simple"
				label="简洁模式卡片布局"
			>
				<a-select
					v-model="store.render.setting.simpleCardColumns"
					style="width: 160px"
				>
					<a-option :value="1">1 列</a-option>
					<a-option :value="2">2 列</a-option>
					<a-option :value="3">3 列</a-option>
					<a-option :value="4">4 列</a-option>
				</a-select>
			</Description>
		</a-card>

		<a-card>
			<template #title>
				<span class="card-title-icon">🌐</span>
				浏览器设置
			</template>
			<BrowserPath v-if="!simple"></BrowserPath>

			<Description>
				<template #label>
					浏览器增强（实验性）
					<a-popover>
						<template #content>
							<div>开启后浏览器将以"防休眠/防冻结"模式运行，请注意：</div>
							<div>1. CPU / 内存 / 功耗显著上升，笔记本请注意电量；</div>
							<div>2. 最多同时运行 4 个浏览器，超出将直接拒绝启动（需先关闭其他浏览器，或关闭浏览器增强功能）；</div>
							<div>3. 会向所有页面注入一段静音音频以保持页面活跃（隐身实现，不暴露任何函数/全局变量）；</div>
							<div>4. 仅对之后新启动的浏览器生效，已运行的浏览器需重启后生效；</div>
							<div>5. ⚠️ 该功能为实验性功能，正在测试中，可能存在未知BUG，请谨慎使用。</div>
						</template>
						<Icon
							class="label-help-icon"
							type="help_outline"
						/>
					</a-popover>
				</template>
				<a-tooltip content="防休眠/防冻结：浏览器最小化或处于后台时仍可长时间运行 JS。仅对新启动的浏览器生效。">
					<a-switch v-model="store.render.setting.browser.browserEnhancement" />
				</a-tooltip>
			</Description>

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

			<Description label="显示浏览器预览">
				<a-tooltip
					content="启用后，浏览器卡片（简洁模式）与监控页面（专业模式）将实时显示浏览器运行界面预览。仅可见卡片推流，滚出视口自动停止以节省资源。开关实时生效。"
				>
					<a-switch v-model="store.render.setting.browser.screenshotPreview" />
				</a-tooltip>
			</Description>

			<!-- 「显示浏览器预览」的子设置：左侧竖线体现层级从属关系 -->
			<div
				v-if="store.render.setting.browser.screenshotPreview"
				class="sub-settings"
			>
				<Description>
					<template #label>
						预览帧率
						<a-popover>
							<template #content>
								<div>控制预览帧率，越高越流畅但占用更多资源。</div>
								<div>实际帧率随页面内容动态变化（静止画面自动停止推流），实时生效。</div>
							</template>
							<Icon
								class="label-help-icon"
								type="help_outline"
							/>
						</a-popover>
					</template>
					<a-select
						v-model="store.render.setting.browser.screenshotFramerate"
						style="width: 200px"
						:placeholder="''"
					>
						<a-option value="high">高（约 30 帧/秒）</a-option>
						<a-option value="medium">中（约 15 帧/秒）</a-option>
						<a-option value="low">低（约 6 帧/秒）</a-option>
					</a-select>
				</Description>

				<Description>
					<template #label>
						预览画质
						<a-popover>
							<template #content>
								<div>控制预览画质（分辨率与压缩率），越高越清晰但占用更多资源，实时生效。</div>
							</template>
							<Icon
								class="label-help-icon"
								type="help_outline"
							/>
						</a-popover>
					</template>
					<a-select
						v-model="store.render.setting.browser.screenshotQuality"
						style="width: 200px"
						:placeholder="''"
					>
						<a-option value="high">高（1280×720）</a-option>
						<a-option value="medium">中（640×360）</a-option>
						<a-option value="low">低（480×270）</a-option>
					</a-select>
				</Description>
			</div>

			<Description v-if="!simple">
				<template #label>
					浏览器缓存预警阈值
					<a-popover>
						<template #content>
							<div>当前浏览器缓存总大小超过此数字时则会弹出警告弹窗。</div>
							<div>也可在左上角工具中找到 "清除浏览器缓存" 功能</div>
						</template>
						<Icon
							class="label-help-icon"
							type="help_outline"
						/>
					</a-popover>
				</template>
				<a-input-number
					v-model="store.render.setting.browser.cachesSizeWarningPoint"
					style="width: 200px"
				>
					<template #append> GB </template>
				</a-input-number>
			</Description>

			<Description label="自定义导航页">
				<a-tooltip content="关闭后，浏览器的新建页面将显示默认空白导航页，不再使用自定义导航页，重启浏览器后生效">
					<a-switch v-model="store.render.setting.browser.bookmarkPage.enable" />
				</a-tooltip>
			</Description>

			<!-- 「自定义导航页」的子设置：左侧竖线体现层级从属关系 -->
			<div
				v-if="store.render.setting.browser.bookmarkPage.enable"
				class="sub-settings"
			>
				<Description label="搜索引擎">
					<a-tooltip content="关闭后，浏览器导航页将不再显示搜索引擎，重启浏览器后生效">
						<a-switch v-model="store.render.setting.browser.bookmarkPage.enableSearch" />
					</a-tooltip>
				</Description>

				<Description label="快捷平台访问">
					<a-tooltip content="关闭后，浏览器导航页将不再显示快捷访问平台列表，重启浏览器后生效">
						<a-switch v-model="store.render.setting.browser.bookmarkPage.enableQuickAccess" />
					</a-tooltip>
				</Description>

				<Description label="自定义网站">
					<a-button
						size="small"
						@click="openCustomSiteModal"
					>
						管理自定义网站
					</a-button>
				</Description>
			</div>
		</a-card>

		<!-- 自定义导航页网站管理弹窗 -->
		<a-modal
			v-model:visible="customSiteModalVisible"
			title="自定义导航页网站"
			:footer="false"
			width="560px"
			unmount-on-close
		>
			<div class="custom-site-modal">
				<div
					v-if="store.render.setting.browser.bookmarkPage.customSites.length === 0"
					class="custom-site-empty"
				>
					暂无自定义网站，请在下方添加。
				</div>
				<div
					v-for="(site, index) of store.render.setting.browser.bookmarkPage.customSites"
					:key="site.url + index"
					class="custom-site-item"
				>
					<div class="custom-site-info">
						<div class="custom-site-name">{{ site.name }}</div>
						<div class="custom-site-url">{{ site.url }}</div>
					</div>
					<a-button
						size="mini"
						@click="editCustomSite(index)"
					>
						修改
					</a-button>
					<a-button
						size="mini"
						status="danger"
						@click="removeCustomSite(index)"
					>
						删除
					</a-button>
				</div>

				<a-divider style="margin: 12px 0" />

				<div class="custom-site-form">
					<a-input
						v-model="customSiteForm.name"
						placeholder="网站名称"
						allow-clear
					/>
					<a-input
						v-model="customSiteForm.url"
						placeholder="网址，如 https://www.example.com"
						allow-clear
						@keyup.enter="saveCustomSite"
					/>
					<a-button
						type="primary"
						@click="saveCustomSite"
					>
						{{ customSiteForm.editingIndex === -1 ? '添加' : '保存修改' }}
					</a-button>
					<a-button
						v-if="customSiteForm.editingIndex !== -1"
						@click="resetCustomSiteForm"
					>
						取消修改
					</a-button>
				</div>
			</div>
		</a-modal>

		<a-card>
			<template #title>
				<span class="card-title-icon">📂</span>
				软件路径
			</template>
			<Path
				label="浏览器缓存"
				name="userDataDirsFolder"
				:setting="!simple"
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

		<!-- 开发者设置：左上角「工具 → 开发者工具」点击后显示（devSession 非持久化，重启自动隐藏） -->
		<a-card v-if="devSession.enabled">
			<template #title>
				<span class="card-title-icon">🛠️</span>
				开发者设置
				<a-tag
					size="small"
					style="margin-left: 8px"
				>
					重启后自动隐藏
				</a-tag>
			</template>

			<a-divider
				orientation="left"
				style="margin: 4px 0 12px"
			>
				更新调试
			</a-divider>

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
						<Icon
							class="label-help-icon"
							type="help_outline"
						/>
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
						<Icon
							class="label-help-icon"
							type="help_outline"
						/>
					</a-popover>
				</template>
				<a-input
					v-model="store.updater.infosUrl"
					:placeholder="'默认：' + OCS_API.infos"
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
import { computed, reactive, ref } from 'vue';
import Description from './Description.vue';
import Path from './Path.vue';
import { t, store, DEFAULT_RENDER, devSession } from '../store';
import { OCS_UPDATER, OCS_API } from '@ocs-desktop/common/web';
import { remote } from '../utils/remote';
import cloneDeep from 'lodash/cloneDeep';
import BrowserPath from './setting/BrowserPath.vue';
import OCSConfigs from './OCSConfigs.vue';
import ResourcesCard from './ResourcesCard.vue';
import { changeTheme } from '../utils';
import Icon from './Icon.vue';
import { forceClearBrowserCache } from '../utils/browser';
import { Message, Modal } from '@arco-design/web-vue';
import { Folder } from '../fs/folder';
import { Browser } from '../fs/browser';
import { IconCheckCircleFill } from '@arco-design/web-vue/es/icon';
import { router } from '../route';

interface SettingPanelProps {
	simple?: boolean;
}

withDefaults(defineProps<SettingPanelProps>(), {
	simple: false
});

/** 主题颜色选项（value 对应 theme.less 中 body[theme-color='xxx'] 预设，color 用于选择器色点展示） */
const themeColors = [
	{ value: 'blue', label: '默认蓝', color: '#165dff' },
	{ value: 'purple', label: '典雅紫', color: '#722ed1' },
	{ value: 'orange', label: '活力橙', color: '#ff7d00' },
	{ value: 'green', label: '清新绿', color: '#00b42a' },
	{ value: 'cyan', label: '静谧青', color: '#14c9c9' }
] as const;

/** 软件布局选项 */
const layoutOptions = [
	{ value: 'simple', label: '简洁模式', icon: 'grid_view' },
	{ value: 'professional', label: '专业模式', icon: 'view_sidebar' }
] as const;

/** 主题样式选项 */
const themeModeOptions = [
	{ value: 'auto', label: '自动（跟随系统）', icon: 'brightness_auto' },
	{ value: 'light', label: '白天', icon: 'light_mode' },
	{ value: 'dark', label: '夜间', icon: 'dark_mode' }
] as const;

/** 当前选中项（用于 select #label 插槽渲染图标；兜底取第一项，兼容历史遗留值） */
const currentLayoutOption = computed(
	() => layoutOptions.find((o) => o.value === store.render.setting.mode) ?? layoutOptions[0]
);
const currentThemeModeOption = computed(
	() => themeModeOptions.find((o) => o.value === store.render.setting.theme.mode) ?? themeModeOptions[0]
);
const currentThemeColorOption = computed(
	() => themeColors.find((o) => o.value === store.render.setting.theme.color) ?? themeColors[0]
);

/** 重置设置 */
async function reset() {
	// 仅重置软件设置为默认值，保留浏览器分身、脚本、路径等用户数据
	store.render.setting = cloneDeep(DEFAULT_RENDER.setting);
	store.window = { alwaysOnTop: false, autoLaunch: false, hideToTrayOnClose: false };
	// 同步保存，确保重置落盘后再重启（不依赖关闭流程的保存时序，避免强制退出时丢失）
	const shouldEncrypt = remote.methods.callSync('isEncryptionAvailable');
	remote.methods.callSync('saveStore', JSON.stringify(store), shouldEncrypt);
	remote.methods.call('resetApp');
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

/** 同步OCS配置到各浏览器 */
function onSyncOCSConfig() {
	store.render.setting.ocs.openSync = true;
	Modal.success({
		content: t('setting_browser_ocs_config_sync_tip_v3', '已同步配置，请重启浏览器即可应用~')
	});
}

/** 切换软件布局模式（简洁/专业），并跳转到对应页面 */
function changeMode() {
	router.push(store.render.setting.mode === 'professional' ? '/browsers' : '/simple');
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

/** 自定义导航页网站管理 */
const customSiteModalVisible = ref(false);
const customSiteForm = reactive({ name: '', url: '', editingIndex: -1 });

function openCustomSiteModal() {
	resetCustomSiteForm();
	customSiteModalVisible.value = true;
}

function resetCustomSiteForm() {
	customSiteForm.name = '';
	customSiteForm.url = '';
	customSiteForm.editingIndex = -1;
}

function normalizeSiteUrl(url: string): string {
	const trimmed = url.trim();
	return trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
}

function saveCustomSite() {
	const name = customSiteForm.name.trim();
	const url = normalizeSiteUrl(customSiteForm.url);
	if (!name) {
		Message.error('请输入网站名称');
		return;
	}
	if (!url || !/^https?:\/\/.+\..+/i.test(url)) {
		Message.error('请输入正确的网址');
		return;
	}
	const list = store.render.setting.browser.bookmarkPage.customSites;
	if (customSiteForm.editingIndex === -1) {
		list.push({ name, url });
		Message.success('添加成功');
	} else {
		list[customSiteForm.editingIndex] = { name, url };
		Message.success('修改成功');
	}
	resetCustomSiteForm();
}

function editCustomSite(index: number) {
	const site = store.render.setting.browser.bookmarkPage.customSites[index];
	if (!site) return;
	customSiteForm.name = site.name;
	customSiteForm.url = site.url;
	customSiteForm.editingIndex = index;
}

function removeCustomSite(index: number) {
	store.render.setting.browser.bookmarkPage.customSites.splice(index, 1);
	if (customSiteForm.editingIndex === index) {
		resetCustomSiteForm();
	}
}
</script>

<style scoped lang="less">
.setting {
	min-height: 500px;
	max-width: 800px;
}

.arco-card + .arco-card {
	margin-top: 12px;
}

:deep(.arco-card-header-title) {
	display: flex;
	align-items: center;
}

.card-title-icon {
	margin-right: 6px;
	font-size: 22px;
	display: inline-flex;
	align-items: center;
}

.theme-color-dot {
	display: inline-block;
	width: 10px;
	height: 10px;
	border-radius: 50%;
	margin-right: 6px;
	vertical-align: middle;
}

.option-icon {
	margin-right: 6px;
	vertical-align: -3px;
}

/* 设置项 label 后的帮助图标（替代原先占用右侧控件列的 help_outline 图标） */
.label-help-icon {
	margin-left: 4px;
	vertical-align: -3px;
	color: var(--color-text-3);
	cursor: pointer;
}

/* 子设置分组：左侧竖线 + 缩进，体现对父设置的从属关系 */
.sub-settings {
	border-left: 2px solid var(--theme-border-color);
	margin-left: 4px;
	padding-left: 12px;
	margin-bottom: 8px;
}

.custom-site-empty {
	padding: 16px 0;
	text-align: center;
	color: var(--color-text-3);
	font-size: 13px;
}

.custom-site-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 0;

	& + .custom-site-item {
		border-top: 1px solid var(--color-border-2);
	}
}

.custom-site-info {
	flex: 1;
	min-width: 0;
}

.custom-site-name {
	font-size: 14px;
	font-weight: 500;
}

.custom-site-url {
	font-size: 12px;
	color: var(--color-text-3);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.custom-site-form {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
</style>

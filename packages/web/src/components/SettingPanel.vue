<template>
	<div class="setting container-md">
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

			<Description label="主题样式">
				<a-select
					v-model="store.render.setting.theme.mode"
					style="width: 200px"
					@change="changeTheme"
				>
					<a-option
						v-for="item of themeModeOptions"
						:key="item.value"
						:value="item.value"
					>
						<component
							:is="item.icon"
							style="font-size: 16px"
							class="option-icon"
						/>
						{{ item.label }}
					</a-option>
					<!-- 选中框自定义渲染（同软件布局） -->
					<template #label>
						<component
							:is="currentThemeModeOption.icon"
							style="font-size: 16px"
							class="option-icon"
						/>
						{{ currentThemeModeOption.label }}
					</template>
				</a-select>
			</Description>
			<Description label="主题颜色">
				<a-select
					v-model="store.render.setting.theme.color"
					style="width: 200px"
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
		</a-card>

		<a-card>
			<template #title>
				<span class="card-title-icon">🌐</span>
				浏览器设置
			</template>
			<BrowserPath></BrowserPath>

			<Description>
				<template #label>
					{{ t('setting_browser_enhancement_label', '浏览器增强（实验性）') }}
					<a-popover>
						<template #content>
							<div v-html="t.html('setting_browser_enhancement_notice', browserEnhancementNotice)"></div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-tooltip
					:content="
						t(
							'setting_browser_enhancement_tip',
							'防休眠/防冻结：浏览器最小化或处于后台时仍可长时间运行 JS。仅对新启动的浏览器生效。'
						)
					"
				>
					<a-switch v-model="store.render.setting.browser.browserEnhancement" />
				</a-tooltip>
			</Description>

			<Description label="CPU/内存检测">
				<a-tooltip
					content="启动浏览器前检测剩余内存与 CPU 负载，不足时拦截启动（含批量启动的剩余启动）；关闭后忽略警告直接启动"
				>
					<a-switch v-model="store.render.setting.browser.memoryCheck" />
				</a-tooltip>
			</Description>

			<Description label="网络缓存加速">
				<a-button
					size="small"
					@click="openCacheManager"
				>
					缓存管理
				</a-button>
				<a-tooltip
					content="为脚本猫/GreasyFork/智慧树/超星等速度不稳定站点启用磁盘缓存（脚本下载/搜索 API/图片字体CSS资源），网络失败时回退过期缓存；关闭后恢复原始实时加载"
				>
					<a-switch
						v-model="store.render.setting.browser.networkCache"
						class="ms-2"
					/>
				</a-tooltip>
			</Description>

			<Description label="验证码手动模式">
				<a-tooltip
					content="开启后：未安装验证码识别模块时不再报错与提示安装，检测到验证码时提示人工干预（模块已安装时仍自动识别）"
				>
					<a-switch v-model="store.render.setting.browser.ocrManual" />
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
							<CircleHelpIcon class="label-help-icon" />
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
								<div>
									超清为视口原生分辨率（上限
									2K），帧尺寸按卡片显示大小自适应（窗口越大画面越清晰），配合背压自动降速，多浏览器同时运行也不会卡死。
								</div>
							</template>
							<CircleHelpIcon class="label-help-icon" />
						</a-popover>
					</template>
					<a-select
						v-model="store.render.setting.browser.screenshotQuality"
						style="width: 200px"
						:placeholder="''"
					>
						<a-option value="ultra">超清（最高 2K）</a-option>
						<a-option value="high">高（1280×720）</a-option>
						<a-option value="medium">中（640×360）</a-option>
						<a-option value="low">低（480×270）</a-option>
					</a-select>
				</Description>
			</div>

			<Description>
				<template #label>
					浏览器缓存预警阈值
					<a-popover>
						<template #content>
							<div>当前浏览器缓存总大小超过此数字时则会弹出警告弹窗。</div>
							<div>可点击右侧按钮清除浏览器缓存。</div>
						</template>
						<CircleHelpIcon class="label-help-icon" />
					</a-popover>
				</template>
				<a-input-number
					v-model="store.render.setting.browser.cachesSizeWarningPoint"
					style="width: 200px"
				>
					<template #append> GB </template>
				</a-input-number>
				<a-button
					size="small"
					class="ms-2"
					@click="checkBrowserCaches"
				>
					清除浏览器缓存
				</a-button>
			</Description>

			<Description label="自定义导航页">
				<a-tooltip
					content="开启后，浏览器启动时自动打开自定义导航页；关闭后启动时显示浏览器默认新标签页。重启浏览器后生效。（新建标签页始终为浏览器默认页）"
				>
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

		<!-- 网络缓存管理弹窗：站点级开关/统计/清空 -->
		<a-modal
			v-model:visible="cacheManagerVisible"
			title="网络缓存管理"
			:footer="false"
			:width="560"
		>
			<div class="d-flex align-items-center gap-2 mb-2">
				<span
					class="text-secondary"
					style="font-size: 13px"
					>{{ cacheTotalText }}</span
				>
				<div class="ms-auto">
					<a-button
						size="small"
						@click="detectHttpCache"
					>
						缓存检测
					</a-button>
					<a-popconfirm
						content="确定清空全部 HTTP 缓存（脚本下载/搜索缓存/静态资源）吗？"
						@ok="clearHttpCache"
					>
						<a-button
							size="small"
							status="danger"
							class="ms-2"
						>
							清空全部
						</a-button>
					</a-popconfirm>
				</div>
			</div>
			<a-divider class="mt-1 mb-2" />
			<div class="site-cache-list">
				<div
					v-for="site of cacheableSites"
					:key="site.id"
					class="site-cache-item"
				>
					<a-switch
						size="small"
						:model-value="siteCacheEnabled(site.id)"
						@change="(v) => setSiteCacheEnabled(site.id, !!v)"
					/>
					<span class="site-name">{{ site.name }}</span>
					<span class="site-stats">{{ siteStatsText(site.id) }}</span>
					<a-popconfirm
						:content="`确定清空「${site.name}」的缓存吗？`"
						@ok="clearSiteCache(site.id, site.name)"
					>
						<a-button
							size="mini"
							type="text"
							status="danger"
						>
							清空
						</a-button>
					</a-popconfirm>
				</div>
				<!-- 网站图标：本地资源缓存（不参与网络加速开关） -->
				<div class="site-cache-item">
					<span class="site-name">网站图标（本地资源缓存）</span>
					<span class="site-stats">{{ iconStatsText }}</span>
					<a-popconfirm
						content="确定清空全部网站图标缓存吗？"
						@ok="clearIcons"
					>
						<a-button
							size="mini"
							type="text"
							status="danger"
						>
							清空
						</a-button>
					</a-popconfirm>
				</div>
			</div>
		</a-modal>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import Description from './Description.vue';
import { store } from '../store';
import { t } from '../utils/langs';
import BrowserPath from './setting/BrowserPath.vue';
import { changeTheme, size } from '../utils';
import { checkBrowserCaches } from '../utils/browser';
import { remote } from '../utils/remote';
import { CACHEABLE_SITES } from '@ocs-desktop/common/web';
import { SunMoonIcon, SunIcon, MoonIcon, CircleHelpIcon } from 'lucide-vue-next';
import { Message } from '@arco-design/web-vue';

/**
 * 浏览器增强说明（「？」弹层）：单一文案段
 */
const browserEnhancementNotice = [
	'开启后浏览器将以"防休眠/防冻结"模式运行，请注意：',
	'1. CPU / 内存 / 功耗显著上升，笔记本请注意电量；',
	'2. 最多同时运行 4 个浏览器，超出将直接拒绝启动（需先关闭其他浏览器，或关闭浏览器增强功能）；',
	'3. 会向所有页面注入一段静音音频以保持页面活跃（隐身实现，不暴露任何函数/全局变量）；',
	'4. 仅对之后新启动的浏览器生效，已运行的浏览器需重启后生效；',
	'5. ⚠️ 该功能为实验性功能，正在测试中，可能存在未知BUG，请谨慎使用。'
].join('<br>');

/** 主题颜色选项（value 对应 theme.less 中 body[theme-color='xxx'] 预设，color 用于选择器色点展示） */
const themeColors = [
	{ value: 'blue', label: '默认蓝', color: '#165dff' },
	{ value: 'purple', label: '典雅紫', color: '#722ed1' },
	{ value: 'orange', label: '活力橙', color: '#ff7d00' },
	{ value: 'green', label: '清新绿', color: '#00b42a' },
	{ value: 'cyan', label: '静谧青', color: '#14c9c9' }
] as const;

/** 主题样式选项 */
const themeModeOptions = [
	{ value: 'auto', label: '自动（跟随系统）', icon: SunMoonIcon },
	{ value: 'light', label: '白天', icon: SunIcon },
	{ value: 'dark', label: '夜间', icon: MoonIcon }
] as const;

/** 当前选中项（用于 select #label 插槽渲染图标；兜底取第一项，兼容历史遗留值） */
const currentThemeModeOption = computed(
	() => themeModeOptions.find((o) => o.value === store.render.setting.theme.mode) ?? themeModeOptions[0]
);
const currentThemeColorOption = computed(
	() => themeColors.find((o) => o.value === store.render.setting.theme.color) ?? themeColors[0]
);

/** HTTP 缓存检测（网络缓存加速的磁盘缓存统计，同时刷新站点级统计展示） */
const siteCacheStats = ref<Record<string, { count: number; bytes: number }>>({});
/** 网站图标缓存统计 */
const iconStats = ref<{ count: number; bytes: number } | undefined>(undefined);
/** 缓存管理弹窗显示状态 */
const cacheManagerVisible = ref(false);

/** 打开缓存管理弹窗（同时加载站点与图标统计） */
async function openCacheManager() {
	cacheManagerVisible.value = true;
	siteCacheStats.value = await remote.methods.call('httpCacheStatsBySite');
	iconStats.value = await remote.methods.call('iconCacheStats');
}

/** 图标缓存统计展示文本（未检测时不显示） */
const iconStatsText = computed(() =>
	iconStats.value ? `${iconStats.value.count} 条 / ${size(iconStats.value.bytes)}` : ''
);

/** 清空网站图标缓存 */
async function clearIcons() {
	await remote.methods.call('clearIconCache');
	iconStats.value = { count: 0, bytes: 0 };
	Message.success('网站图标缓存已清空');
}

/** 缓存总计文本（弹窗顶部展示） */
const cacheTotalText = computed(() => {
	const total = Object.values(siteCacheStats.value).reduce(
		(sum, s) => ({ count: sum.count + s.count, bytes: sum.bytes + s.bytes }),
		{
			count: 0,
			bytes: 0
		}
	);
	return `共 ${total.count} 条缓存，占用 ${size(total.bytes)}`;
});

async function detectHttpCache() {
	siteCacheStats.value = await remote.methods.call('httpCacheStatsBySite');
	iconStats.value = await remote.methods.call('iconCacheStats');
	Message.success('缓存统计已刷新');
}

/** 清空 HTTP 磁盘缓存（脚本下载/搜索缓存） */
async function clearHttpCache() {
	await remote.methods.call('clearHttpCache');
	siteCacheStats.value = {};
	Message.success('HTTP 缓存已清空');
}

/** 站点级缓存开关（缺省视为开启） */
const cacheableSites = CACHEABLE_SITES;
function siteCacheEnabled(id: string) {
	return store.render.setting.browser.networkCacheSites[id] !== false;
}
function setSiteCacheEnabled(id: string, enabled: boolean) {
	store.render.setting.browser.networkCacheSites[id] = enabled;
}

/** 站点缓存统计展示文本（未检测时不显示） */
function siteStatsText(id: string) {
	const s = siteCacheStats.value[id];
	return s ? `${s.count} 条 / ${size(s.bytes)}` : '';
}

/** 清空指定站点的缓存 */
async function clearSiteCache(id: string, name: string) {
	await remote.methods.call('clearHttpCache', id);
	siteCacheStats.value = await remote.methods.call('httpCacheStatsBySite');
	Message.success(`已清空 ${name} 的缓存`);
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
	max-width: 720px;
}

/* 设置分组去卡片化：移除边框/圆角/阴影（覆盖 arco-custom 的全局 !important 规则），
   各小段以分割线区分（嵌套在子布局整体卡片内，无需重复卡片样式） */
.setting > .arco-card {
	border: none !important;
	border-radius: 0 !important;
	box-shadow: none !important;
}

/* 各设置小段之间保留间距（无卡片样式、无分割线） */
.setting > .arco-card + .arco-card {
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

/** 站点级缓存管理列表 */
.site-cache-list {
	margin-top: 8px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.site-cache-item {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
}

.site-cache-item .site-name {
	color: var(--theme-text-color-secondary, #4e5969);
}

.site-cache-item .site-stats {
	margin-left: auto;
	color: var(--theme-text-color-secondary, #86909c);
	font-size: 12px;
	margin-right: 4px;
}
</style>

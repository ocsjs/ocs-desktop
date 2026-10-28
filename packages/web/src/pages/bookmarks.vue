<template>
	<div class="bookmarks-container">
		<!-- 动态背景 -->
		<div class="bg-mesh"></div>
		<div class="bg-noise"></div>

		<a-spin
			class="spin-wrapper"
			:loading="state.loading"
		>
			<template #element>
				<div class="loading-state">
					<div class="loading-spinner"></div>
					<div
						v-for="(tip, index) of state.tips"
						:key="index"
						class="loading-tip"
					>
						{{ tip }}
					</div>
				</div>
			</template>

			<!-- 顶部标题栏（全宽 banner，置顶） -->
			<div class="title-bar">
				<h1 class="page-title">
					<span class="title-gradient">快捷导航页</span>
					<span class="page-subtitle">快速访问常用学习平台</span>
				</h1>
			</div>

			<!-- 浏览器信息（独占一行 banner，无 uid 时隐藏） -->
			<div
				v-if="browserUid"
				class="browser-banner"
			>
				<div class="browser-info-header">
					<div class="browser-info-content">
						<div class="browser-name">
							<span class="label">当前浏览器</span>
							<span
								id="browser-name"
								class="value"
								>...</span
							>
						</div>
						<div class="browser-meta">
							<span class="meta-item">
								<span class="meta-label">标签</span>
								<span
									id="browser-tags"
									class="meta-value"
									>...</span
								>
							</span>
							<span class="meta-divider"></span>
							<span class="meta-item">
								<span class="meta-label">备注</span>
								<span
									id="browser-notes"
									class="meta-value"
									>...</span
								>
							</span>
						</div>
					</div>
					<button
						class="action-btn"
						@click="openInApp"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
						</svg>
						<span>在软件中显示</span>
					</button>
				</div>
			</div>

			<!-- 提示信息（a-alert banner） -->
			<a-alert
				v-if="!showEmptyResult"
				class="tips-alert"
				:type="state.warn ? 'warning' : 'info'"
				banner
			>
				<p>等待初始化后，即可使用安装的浏览器脚本管理拓展，进行脚本的运行。</p>
				<p>如果您使用的是 "OCS 网课助手"，请打开以下任意一个网课平台即可，会出现脚本悬浮窗，并有对应的使用教程。</p>
			</a-alert>

			<!-- 主体内容（container 居中） -->
			<div class="container main-content">
				<div
					v-if="visibleTips.length"
					class="tips-section"
				>
					<div
						v-for="(tip, index) of visibleTips"
						:key="index"
						class="status-card"
						:class="{ warn: state.warn }"
					>
						<div class="status-indicator"></div>
						<span>当前状态：{{ tip }}</span>
					</div>
				</div>

				<!-- 两个功能都未开启时：使用提示内容作为 a-result 结果显示 -->
				<a-result
					v-if="showEmptyResult"
					class="empty-result"
					status="info"
					title="导航页搜索引擎、快捷访问等功能未开启"
				>
					<template #subtitle>
						<p>接下来： 等待初始化后，即可使用安装的浏览器脚本管理拓展，进行脚本的运行。</p>
						<p>如果您使用的是 "OCS 网课助手"，请打开以下任意一个网课平台即可，会出现脚本悬浮窗，并有对应的使用教程。</p>
					</template>
				</a-result>

				<!-- 搜索引擎 -->
				<div
					v-if="pageSettings.enableSearch"
					class="search-section"
				>
					<div class="engine-switcher">
						<button
							v-for="engine of searchEngines"
							:key="engine.key"
							class="engine-btn"
							:class="{ active: currentEngineKey === engine.key }"
							@click="switchEngine(engine.key)"
						>
							<img
								class="engine-icon"
								:src="localIcon(engine.icon)"
								:alt="engine.name"
							/>
							{{ engine.name }}
						</button>
					</div>
					<div class="search-input-wrapper">
						<svg
							class="search-icon"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle
								cx="11"
								cy="11"
								r="8"
							/>
							<path d="M21 21l-4.35-4.35" />
						</svg>
						<input
							v-model="searchKeyword"
							class="search-input"
							type="text"
							:placeholder="`使用${currentEngine.name}搜索，输入网址可直接访问`"
							@keyup.enter="doSearch"
							@focus="showHistory = true"
							@blur="onSearchBlur"
							@keydown.escape="showHistory = false"
						/>
						<button
							class="search-btn"
							@click="doSearch"
						>
							搜索
						</button>

						<!-- 搜索历史联想 -->
						<div
							v-show="showHistory && suggestions.length"
							class="search-dropdown"
						>
							<div
								v-for="item of suggestions"
								:key="item"
								class="suggestion-item"
								@mousedown.prevent="selectSuggestion(item)"
							>
								<svg
									class="suggestion-icon"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<circle
										cx="12"
										cy="12"
										r="10"
									/>
									<path d="M12 6v6l4 2" />
								</svg>
								<span class="suggestion-text">{{ item }}</span>
								<button
									class="suggestion-remove"
									title="删除此记录"
									@mousedown.prevent.stop="removeHistory(item)"
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							</div>
							<div
								class="suggestion-clear"
								@mousedown.prevent="clearHistory"
							>
								<span>清空搜索记录</span>
								<a-tooltip
									content="搜索记录仅存储在当前浏览器中，不会上传到服务器，也不会泄露。"
									position="top"
									background-color="rgba(20, 20, 30, 0.95)"
								>
									<InfoIcon
										class="suggestion-info-icon"
										:size="14"
										@mousedown.prevent.stop
									/>
								</a-tooltip>
							</div>
						</div>
					</div>
				</div>

				<!-- 自定义网站提示小字（无论是否存在自定义网站都显示） -->
				<div
					v-if="!showEmptyResult"
					class="bookmarks-caption"
				>
					自定义网站
				</div>

				<!-- 自定义网站小卡片 + 添加按钮（加载在快捷访问上方，不使用分组卡片布局） -->
				<div
					v-if="!showEmptyResult"
					class="custom-sites"
				>
					<a
						v-for="(site, idx) of pageSettings.customSites"
						:key="site.url + idx"
						:href="site.url"
						target="_blank"
						class="bookmark-item custom-site-card"
						:style="{ '--item-index': idx, '--group-index': 0 }"
					>
						<img
							class="icon"
							loading="lazy"
							:src="localIcon(site.url)"
						/>
						<span class="bookmark-name">{{ site.name }}</span>
						<a-tooltip
							background-color="rgba(20, 20, 30, 0.95)"
							:content="site.url"
							position="top"
						>
							<div class="bookmark-tooltip-trigger"></div>
						</a-tooltip>
					</a>

					<!-- 添加按钮：不执行添加，仅提示前往软件设置中添加 -->
					<button
						class="bookmark-item add-site-btn"
						title="添加自定义网站"
						@click="notifyAddSite"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
					</button>
				</div>

				<!-- 平台列表提示 -->
				<div
					v-if="pageSettings.enableQuickAccess"
					class="bookmarks-caption"
				>
					快捷访问
				</div>

				<!-- 书签分组 -->
				<div
					v-if="pageSettings.enableQuickAccess"
					class="bookmarks-grid"
				>
					<div
						v-for="(item, groupIndex) of bookmarks"
						:key="item?.group + groupIndex"
					>
						<div
							v-if="item && item.values && item.values.length > 0"
							class="bookmark-group"
							:style="{ '--group-index': groupIndex }"
						>
							<div class="group-header">
								<h2 class="group-title">{{ item.group }}</h2>
								<span class="group-count">{{ item.values.filter(Boolean).length }} 个网站</span>
							</div>
							<div class="group-items">
								<a
									v-for="(bookmark, idx) of item.values"
									v-show="bookmark && bookmark.name"
									:key="idx"
									:href="bookmark?.url"
									target="_blank"
									class="bookmark-item"
									:style="{ '--item-index': idx }"
								>
									<img
										:data-img-src="bookmark?.icon || ''"
										class="icon"
										loading="lazy"
										:src="iconUrl(bookmark?.icon)"
									/>
									<span class="bookmark-name">{{ bookmark?.name }}</span>
									<a-tooltip
										background-color="rgba(20, 20, 30, 0.95)"
										:content="bookmark?.description || '暂无描述'"
										position="top"
									>
										<div class="bookmark-tooltip-trigger"></div>
									</a-tooltip>
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</a-spin>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { BookmarkResource } from '@ocs-desktop/common/web';
import { iconUrl, getRemoteInfos } from '../utils/index';
import { InfoIcon } from 'lucide-vue-next';

type BookMark = BookmarkResource;

const bookmarks = ref<BookMark[]>([]);

/** 搜索引擎配置，默认百度（icon 为站点地址，经本地图标服务取 favicon） */
const searchEngines = [
	{
		key: 'baidu',
		name: '百度',
		icon: 'https://www.baidu.com',
		search: (q: string) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
	},
	{
		key: 'bing',
		name: '必应',
		icon: 'https://www.bing.com',
		search: (q: string) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`
	},
	{
		key: 'google',
		name: '谷歌',
		icon: 'https://www.google.com',
		search: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
	}
] as const;

type EngineKey = (typeof searchEngines)[number]['key'];

const SEARCH_ENGINE_STORAGE_KEY = 'ocs-search-engine';

const savedEngine = localStorage.getItem(SEARCH_ENGINE_STORAGE_KEY);
const currentEngineKey = ref<EngineKey>(
	searchEngines.some((e) => e.key === savedEngine) ? (savedEngine as EngineKey) : 'baidu'
);
const searchKeyword = ref('');

const currentEngine = computed(() => searchEngines.find((e) => e.key === currentEngineKey.value) || searchEngines[0]);

function switchEngine(key: EngineKey) {
	currentEngineKey.value = key;
	localStorage.setItem(SEARCH_ENGINE_STORAGE_KEY, key);
	if (key === 'google') {
		Modal.warning({
			content: '当前网络环境（国内）可能无法使用谷歌搜索，请确保已开启科学上网后再使用。'
		});
	}
}

/** 跳转链接 */
function navigateTo(url: string) {
	window.location.href = url;
}

function doSearch() {
	const keyword = searchKeyword.value.trim();
	if (!keyword) return;
	addSearchHistory(keyword);
	showHistory.value = false;
	// 完整网址直接访问
	if (/^https?:\/\//i.test(keyword)) {
		navigateTo(keyword);
		return;
	}
	// 搜索防呆：输入类似网址时，确认是打开链接还是执行搜索
	if (/^([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(keyword)) {
		Modal.confirm({
			title: '确认操作',
			content: `您输入的 "${keyword}" 看起来像网址，是要直接打开链接，还是搜索该内容？`,
			okText: '打开链接',
			cancelText: '执行搜索',
			onOk: () => {
				navigateTo(`https://${keyword}`);
			},
			onCancel: () => {
				navigateTo(currentEngine.value.search(keyword));
			}
		});
		return;
	}
	navigateTo(currentEngine.value.search(keyword));
}

/** 搜索历史（localStorage 持久化） */
const SEARCH_HISTORY_STORAGE_KEY = 'ocs-search-history';
const MAX_HISTORY_COUNT = 10;

function loadSearchHistory(): string[] {
	try {
		const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
		const list = raw ? JSON.parse(raw) : [];
		return Array.isArray(list) ? list.filter((i) => typeof i === 'string' && i.trim()) : [];
	} catch {
		return [];
	}
}

const searchHistory = ref<string[]>(loadSearchHistory());
const showHistory = ref(false);

function saveSearchHistory() {
	localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(searchHistory.value));
}

function addSearchHistory(keyword: string) {
	searchHistory.value = [keyword, ...searchHistory.value.filter((i) => i !== keyword)].slice(0, MAX_HISTORY_COUNT);
	saveSearchHistory();
}

function removeHistory(keyword: string) {
	searchHistory.value = searchHistory.value.filter((i) => i !== keyword);
	saveSearchHistory();
}

function clearHistory() {
	searchHistory.value = [];
	saveSearchHistory();
	showHistory.value = false;
}

/** 根据当前输入联想搜索记录 */
const suggestions = computed(() => {
	const kw = searchKeyword.value.trim().toLowerCase();
	const list = kw ? searchHistory.value.filter((i) => i.toLowerCase().includes(kw)) : searchHistory.value;
	return list.slice(0, 8);
});

function selectSuggestion(keyword: string) {
	searchKeyword.value = keyword;
	doSearch();
}

function onSearchBlur() {
	// 延迟关闭，等待下拉项的 mousedown 先触发
	setTimeout(() => {
		showHistory.value = false;
	}, 150);
}

/** 从当前 URL 中解析 uid 参数 */
function getCurrentUid(): string | null {
	// 从 query string 获取: ?uid=xxx
	const searchUid = new URLSearchParams(location.search).get('uid');
	if (searchUid) return searchUid;
	// 从 hash 路由参数获取: #/bookmarks?uid=xxx
	const hashQuery = location.hash.split('?')[1];
	if (hashQuery) return new URLSearchParams(hashQuery).get('uid');
	return null;
}

/** 当前浏览器 uid（无 uid 时隐藏浏览器信息条，例如直接访问导航页的场景） */
const browserUid = getCurrentUid();

const state = reactive({
	loading: false,
	warn: false,
	tips: ['']
});

/** 导航页设置（从本地服务器读取，读取失败时默认全部开启） */
const pageSettings = reactive({
	enableSearch: true,
	enableQuickAccess: true,
	customSites: [] as { name: string; url: string }[]
});

/** 两个功能都未开启且无自定义网站时，显示 a-result 结果页 */
const showEmptyResult = computed(
	() => !pageSettings.enableSearch && !pageSettings.enableQuickAccess && pageSettings.customSites.length === 0
);

/** 网站图标（走本地服务器图标服务：多源降级 + 缓存 + 兜底图标，避免跨域/网络原因加载失败） */
function localIcon(url: string): string {
	const port = location.port || '15319';
	return `http://localhost:${port}/icon?url=${encodeURIComponent(url)}`;
}

/** 添加按钮点击：提示前往软件设置中添加（导航页不执行添加操作） */
function notifyAddSite() {
	Message.info('请前往「软件设置 - 浏览器设置 - 自定义网站」中添加网站。');
}

/** 可见的状态提示：过滤空提示，初始化状态（如"浏览器初始化完成。"）直接隐藏状态条 */
const visibleTips = computed(() => state.tips.filter((t) => t && t.trim() && !t.includes('初始化')));

// @ts-ignore 暴露方法给 playwright 脚本
window.setBookmarkLoadingState = (_state) => {
	Object.assign(state, _state);
};

onMounted(async () => {
	document.title = 'OCS - 快捷导航页';
	const port = location.port || '15319';
	const uid = getCurrentUid();

	// 三个数据源并行加载：CDN 书签分组（复用会话缓存，失败不阻塞其余内容）、
	// 本地浏览器信息、本地导航页设置。原串行 await 在弱网下首屏最长被 CDN 15s 阻塞。
	await Promise.all([
		// 官方书签分组（CDN，复用 getRemoteInfos 会话级缓存）
		(async () => {
			try {
				const infos = await getRemoteInfos();
				for (let i = 0; i < infos.bookmark.length; i++) {
					const bookmark = infos.bookmark[i] as BookMark;
					bookmarks.value[i] = {
						group: bookmark.group,
						values: bookmark.values.filter(Boolean)
					};
				}
			} catch (e) {
				console.error('获取书签数据失败', e);
			}
		})(),
		// 主动通过本地 API 获取浏览器信息
		(async () => {
			if (!uid) return;
			try {
				const res = await fetch(`http://localhost:${port}/api/bookmark/browser-info?uid=${uid}`);
				const info = await res.json();
				if (info) {
					const nameEl = document.querySelector('#browser-name');
					const tagsEl = document.querySelector('#browser-tags');
					const notesEl = document.querySelector('#browser-notes');
					if (nameEl) nameEl.innerHTML = info.name || '未知名称';
					if (tagsEl) {
						tagsEl.innerHTML = (info.tags || [])
							.map(
								(t: { color: string; name: string }) =>
									`<span style="background: linear-gradient(135deg, ${t.color}, ${adjustColor(
										t.color,
										-20
									)});" class="browser-tag">${t.name}</span>`
							)
							.join('');
					}
					if (notesEl) notesEl.innerHTML = info.notes || '未知';
				}
			} catch (e) {
				console.error('获取浏览器信息失败', e);
			}
		})(),
		// 获取导航页设置（搜索引擎开关、快捷访问开关、自定义网站）
		(async () => {
			try {
				const res = await fetch(`http://localhost:${port}/api/bookmark/page-settings`);
				const settings = await res.json();
				if (settings) {
					pageSettings.enableSearch = settings.enableSearch !== false;
					pageSettings.enableQuickAccess = settings.enableQuickAccess !== false;
					pageSettings.customSites = Array.isArray(settings.customSites) ? settings.customSites : [];
				}
			} catch (e) {
				console.error('获取导航页设置失败', e);
			}
		})()
	]);
});

function adjustColor(hex: string, percent: number): string {
	const num = parseInt(hex.replace('#', ''), 16);
	const amt = Math.round(2.55 * percent);
	const R = Math.min(255, Math.max(0, (num >> 16) + amt));
	const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
	const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
	return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function openInApp() {
	const uid = getCurrentUid();
	if (uid) {
		const port = location.port || '15319';
		fetch(`http://localhost:${port}/api/bookmark/show-browser-in-app?uid=${uid}`);
	}
}
</script>

<style>
/* 已移除 Google Fonts 外链 @import：弱网/国内环境下该请求会阻塞导航页样式渲染，
   字体声明（font-family: 'Outfit', -apple-system, sans-serif）自动回退系统字体 */

.browser-tag {
	display: inline-block;
	border-radius: 6px;
	color: white;
	padding: 3px 10px;
	font-size: 12px;
	font-weight: 500;
	margin: 2px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>

<style scoped lang="less">
// 变量定义
@primary-bg: #0a0a12;
@card-bg: rgba(255, 255, 255, 0.03);
@card-border: rgba(255, 255, 255, 0.08);
@text-primary: #ffffff;
@text-secondary: rgba(255, 255, 255, 0.6);
@text-muted: rgba(255, 255, 255, 0.4);
@accent-cyan: #22d3ee;
@accent-blue: #3b82f6;
@accent-violet: #8b5cf6;
@accent-rose: #f43f5e;

.bookmarks-container {
	min-height: 100vh;
	background: @primary-bg;
	font-family: 'Outfit', -apple-system, sans-serif;
	color: @text-primary;
	position: relative;
	overflow-x: hidden;
	padding: 0 0 32px 0;
}

// 动态网格背景
.bg-mesh {
	position: fixed;
	inset: 0;
	background: radial-gradient(ellipse 80% 50% at 20% -20%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
		radial-gradient(ellipse 60% 40% at 80% 100%, rgba(59, 130, 246, 0.12) 0%, transparent 50%),
		radial-gradient(ellipse 40% 60% at 50% 50%, rgba(34, 211, 238, 0.08) 0%, transparent 50%);
	pointer-events: none;
	z-index: 0;
}

// 噪点纹理
.bg-noise {
	position: fixed;
	inset: 0;
	opacity: 0.03;
	background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
	pointer-events: none;
	z-index: 1;
}

.spin-wrapper {
	position: relative;
	z-index: 2;
	width: 100%;
	height: 100%;
}

// 类似 bootstrap 的 container，按分辨率自动响应式宽度并居中
.container {
	width: 100%;
	margin-left: auto;
	margin-right: auto;
	padding-left: 16px;
	padding-right: 16px;

	@media (min-width: 576px) {
		max-width: 540px;
	}

	@media (min-width: 768px) {
		max-width: 720px;
	}

	@media (min-width: 992px) {
		max-width: 960px;
	}

	@media (min-width: 1200px) {
		max-width: 1140px;
	}

	@media (min-width: 1400px) {
		max-width: 1320px;
	}
}

// 加载状态
.loading-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 60vh;
	gap: 16px;
}

.loading-spinner {
	width: 48px;
	height: 48px;
	border: 3px solid @card-border;
	border-top-color: @accent-cyan;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.loading-tip {
	font-size: 14px;
	color: @text-secondary;
}

// 浏览器信息（独立 banner 行内）
.browser-info-header {
	display: flex;
	align-items: center;
	gap: 16px;
	flex-wrap: wrap;
}

.browser-info-content {
	flex: 1;
	min-width: 200px;
}

.browser-name {
	display: flex;
	align-items: baseline;
	gap: 12px;
	margin-bottom: 8px;

	.label {
		font-size: 12px;
		color: @text-muted;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.value {
		font-size: 15px;
		font-weight: 600;
		color: @text-primary;
	}
}

.browser-meta {
	display: flex;
	align-items: center;
	gap: 16px;
	flex-wrap: wrap;
}

.meta-item {
	display: flex;
	align-items: center;
	gap: 8px;
}

.meta-label {
	font-size: 12px;
	color: @text-muted;
}

.meta-value {
	font-size: 13px;
	color: black;
}

.meta-divider {
	width: 1px;
	height: 16px;
	background: @card-border;
}

.action-btn {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 20px;
	background: transparent;
	border: 1px solid @card-border;
	border-radius: 10px;
	color: @text-secondary;
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s ease;
	font-family: inherit;

	svg {
		width: 16px;
		height: 16px;
	}

	&:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: @accent-cyan;
		color: @accent-cyan;
	}
}

// 主体内容区域
.main-content {
	padding-top: 24px;
}

// 提示 banner（a-alert，全宽不受 container 限制）
.tips-alert {
	width: 100%;
	margin: 0;
	border-radius: 0;

	p {
		margin: 0;
		font-size: 13px;
		line-height: 1.7;
	}
}

// 状态提示区域
.tips-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-bottom: 32px;
}

.status-card {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	background: rgba(34, 211, 238, 0.08);
	border: 1px solid rgba(34, 211, 238, 0.2);
	border-radius: 10px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.85);

	&.warn {
		background: rgba(251, 191, 36, 0.1);
		border-color: rgba(251, 191, 36, 0.3);
		color: rgba(255, 255, 255, 0.9);
	}
}

.status-indicator {
	width: 8px;
	height: 8px;
	background: @accent-cyan;
	border-radius: 50%;
	animation: pulse 2s ease-in-out infinite;

	.warn & {
		background: #fbbf24;
	}
}

@keyframes pulse {
	0%,
	100% {
		opacity: 1;
		transform: scale(1);
	}
	50% {
		opacity: 0.5;
		transform: scale(0.9);
	}
}

// 顶部标题栏（全宽 banner，置顶，不受 container 限制）
.title-bar {
	position: sticky;
	top: 0;
	z-index: 50;
	width: 100%;
	margin: 0;
	border-radius: 0;
	padding: 12px 24px;
	background: rgba(10, 10, 18, 0.85);
	backdrop-filter: blur(20px);
	border-bottom: 1px solid @card-border;
	box-sizing: border-box;
}

// 浏览器信息 banner（独占一行，全宽不受 container 限制）
.browser-banner {
	width: 100%;
	margin: 0;
	border-radius: 0;
	padding: 10px 24px;
	background: rgba(255, 255, 255, 0.02);
	border-bottom: 1px solid @card-border;
	box-sizing: border-box;
}

// 页面标题（小字描述在标题文本右侧）
.page-title {
	display: flex;
	align-items: baseline;
	gap: 12px;
	flex-wrap: wrap;
	margin: 0;
	font-size: 22px;
	font-weight: 700;
	letter-spacing: -1px;
}

.title-gradient {
	background: linear-gradient(135deg, #fff 0%, @accent-cyan 50%, @accent-blue 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

.page-subtitle {
	margin: 0;
	font-size: 13px;
	color: @text-muted;
	font-weight: 400;
}

// 搜索引擎
.search-section {
	position: relative;
	z-index: 10;
	max-width: 760px;
	margin: 0 auto 40px auto;
	animation: fadeInUp 0.6s ease backwards;
}

// 引擎 tab 左对齐搜索框
.engine-switcher {
	display: flex;
	justify-content: flex-start;
	gap: 8px;
	margin-bottom: 14px;
}

.engine-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 16px;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid @card-border;
	border-radius: 20px;
	color: @text-secondary;
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s ease;
	font-family: inherit;

	&:hover {
		border-color: @accent-cyan;
		color: @accent-cyan;
	}

	&.active {
		background: linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(59, 130, 246, 0.15));
		border-color: @accent-cyan;
		color: @accent-cyan;
		box-shadow: 0 2px 12px rgba(34, 211, 238, 0.15);
	}
}

.engine-icon {
	width: 14px;
	height: 14px;
	border-radius: 4px;
	display: block;
}

.search-input-wrapper {
	position: relative;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 6px 6px 6px 18px;
	background: @card-bg;
	border: 1px solid @card-border;
	border-radius: 14px;
	backdrop-filter: blur(20px);
	transition: all 0.3s ease;

	&:focus-within {
		border-color: @accent-cyan;
		box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1);
	}
}

.search-icon {
	width: 18px;
	height: 18px;
	color: @text-muted;
	flex-shrink: 0;
}

.search-input {
	flex: 1;
	min-width: 0;
	background: transparent;
	border: none;
	outline: none;
	color: @text-primary;
	font-size: 15px;
	font-family: inherit;
	padding: 10px 0;

	&::placeholder {
		color: @text-muted;
	}
}

.search-btn {
	flex-shrink: 0;
	padding: 10px 24px;
	background: linear-gradient(135deg, @accent-blue, @accent-violet);
	border: none;
	border-radius: 10px;
	color: white;
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s ease;
	font-family: inherit;

	&:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
	}

	&:active {
		transform: translateY(0);
	}
}

// 搜索历史联想下拉
.search-dropdown {
	position: absolute;
	top: calc(100% + 8px);
	left: 0;
	right: 0;
	background: rgba(18, 18, 28, 0.96);
	border: 1px solid @card-border;
	border-radius: 12px;
	backdrop-filter: blur(20px);
	box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
	overflow: hidden;
	z-index: 100;
	animation: fadeIn 0.15s ease;
}

.suggestion-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 16px;
	cursor: pointer;
	transition: background 0.15s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.06);

		.suggestion-remove {
			opacity: 1;
		}
	}
}

.suggestion-icon {
	width: 14px;
	height: 14px;
	color: @text-muted;
	flex-shrink: 0;
}

.suggestion-text {
	flex: 1;
	min-width: 0;
	font-size: 13px;
	color: @text-primary;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.suggestion-remove {
	flex-shrink: 0;
	width: 20px;
	height: 20px;
	padding: 3px;
	background: transparent;
	border: none;
	border-radius: 6px;
	color: @text-muted;
	cursor: pointer;
	opacity: 0;
	transition: all 0.15s ease;

	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	&:hover {
		color: @accent-rose;
		background: rgba(244, 63, 94, 0.12);
	}
}

.suggestion-clear {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 8px 16px;
	font-size: 12px;
	color: @text-muted;
	text-align: center;
	cursor: pointer;
	border-top: 1px solid @card-border;
	transition: all 0.15s ease;

	&:hover {
		color: @accent-rose;
		background: rgba(255, 255, 255, 0.04);
	}
}

.suggestion-info-icon {
	display: inline-flex;
	cursor: help;
	flex-shrink: 0;
	transition: color 0.15s ease;

	&:hover {
		color: @accent-cyan;
	}
}

// 平台列表提示小字（宽度对齐搜索区域）
.bookmarks-caption {
	width: 100%;
	max-width: 760px;
	margin: 0 auto 16px auto;
	font-size: 13px;
	color: @text-muted;
	letter-spacing: 1px;
}

// 书签网格（宽度对齐搜索区域，居中显示）
.bookmarks-grid {
	display: flex;
	flex-direction: column;
	gap: 32px;
	width: 100%;
	max-width: 760px;
	margin: 0 auto;
}

// 自定义网站小卡片（位于快捷访问上方，直接渲染不使用分组卡片布局）
.custom-sites {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	width: 100%;
	max-width: 760px;
	margin: 0 auto 32px auto;
}

// 自定义网站小卡片：加深描边，防止与背景颜色重合
.custom-site-card {
	border-color: rgba(255, 255, 255, 0.16);
}

// 添加自定义网站按钮（虚线加号）
.add-site-btn {
	justify-content: center;
	background: transparent;
	border: 1px dashed rgba(255, 255, 255, 0.2);
	color: @text-muted;
	cursor: pointer;
	font-family: inherit;

	svg {
		width: 16px;
		height: 16px;
		display: block;
	}

	&:hover {
		background: rgba(34, 211, 238, 0.06);
		border-color: @accent-cyan;
		color: @accent-cyan;
	}
}

// 空状态结果页（两个功能都未开启时显示）
.empty-result {
	padding: 48px 0;

	p {
		margin: 0;
		font-size: 13px;
		line-height: 1.7;
	}
}

// 书签分组卡片
.bookmark-group {
	background: @card-bg;
	border: 1px solid @card-border;
	border-radius: 16px;
	padding: 24px;
	backdrop-filter: blur(20px);
	transition: border-color 0.3s ease, box-shadow 0.3s ease;
	animation: fadeInUp 0.6s ease backwards;
	animation-delay: calc(var(--group-index) * 0.1s);
	max-width: 100%;

	&:hover {
		border-color: rgba(34, 211, 238, 0.25);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
	}
}

@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.group-header {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 4px;
	padding-bottom: 14px;
	border-bottom: 1px solid @card-border;
}

.group-title {
	margin: 0;
	font-size: 18px;
	font-weight: 600;
	color: @text-primary;
}

.group-count {
	margin-left: auto;
	font-size: 12px;
	color: @text-muted;
	padding: 4px 12px;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 20px;
}

// 平台小卡片列表
.group-items {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	width: 100%;
}

// 平台小卡片
.bookmark-item {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 10px;
	padding: 10px 16px;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid @card-border;
	border-radius: 12px;
	text-decoration: none;
	transition: all 0.2s ease;
	animation: fadeIn 0.4s ease backwards;
	animation-delay: calc(var(--item-index) * 0.02s + var(--group-index) * 0.05s);
	flex: 0 0 auto;

	&:hover {
		background: rgba(34, 211, 238, 0.08);
		border-color: @accent-cyan;
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(34, 211, 238, 0.12);

		.bookmark-name {
			color: @accent-cyan;
		}
	}
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.bookmark-icon-wrapper {
	display: none;
}

.bookmark-info {
	text-align: center;
}

.bookmark-name {
	font-size: 14px;
	font-weight: 500;
	color: @text-primary;
	transition: color 0.2s ease;
	white-space: nowrap;
}

.bookmark-tooltip-trigger {
	position: absolute;
	inset: 0;
	z-index: 10;
}

// 响应式设计
@media (max-width: 768px) {
	.bookmarks-container {
		padding: 0 0 16px 0;
	}

	.title-bar {
		padding: 10px 16px;
	}

	.browser-banner {
		padding: 10px 16px;
	}

	.browser-info-header {
		flex-direction: column;
		align-items: flex-start;
	}

	.browser-info-content {
		width: 100%;
	}

	.action-btn {
		width: 100%;
		justify-content: center;
	}

	.page-title {
		font-size: 20px;
	}

	.search-section {
		margin-bottom: 28px;
	}

	.engine-btn {
		padding: 5px 14px;
		font-size: 12px;
	}

	.search-input-wrapper {
		padding: 4px 4px 4px 14px;
	}

	.search-input {
		font-size: 14px;
	}

	.search-btn {
		padding: 9px 18px;
		font-size: 13px;
	}

	.bookmark-item {
		padding: 8px 12px;
	}

	.bookmark-name {
		font-size: 13px;
	}
}

// 暗色主题兼容
body[arco-theme='dark'] & {
	// 已是暗色主题，无需额外调整
}

// 亮色主题覆盖
body:not([arco-theme='dark']) & {
	@light-bg: #f8fafc;
	@light-card: rgba(255, 255, 255, 0.8);
	@light-text: #1e293b;
	@light-text-secondary: #64748b;

	.bookmarks-container {
		background: @light-bg;
		color: @light-text;
	}

	.bg-mesh {
		background: radial-gradient(ellipse 80% 50% at 20% -20%, rgba(120, 119, 198, 0.08) 0%, transparent 50%),
			radial-gradient(ellipse 60% 40% at 80% 100%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
			radial-gradient(ellipse 40% 60% at 50% 50%, rgba(34, 211, 238, 0.04) 0%, transparent 50%);
	}

	.bg-noise {
		opacity: 0.02;
	}

	.bookmark-group {
		background: @light-card;
		border-color: rgba(0, 0, 0, 0.06);
	}

	.bookmark-group:hover {
		background: white;
		border-color: rgba(0, 0, 0, 0.1);
	}

	.title-bar {
		background: rgba(248, 250, 252, 0.9);
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	.browser-banner {
		background: rgba(255, 255, 255, 0.6);
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	.browser-name .value,
	.group-title,
	.bookmark-name {
		color: @light-text;
	}

	.label,
	.meta-label,
	.page-subtitle,
	.group-count,
	.loading-tip,
	.bookmarks-caption {
		color: @light-text-secondary;
	}

	.engine-btn {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
		color: @light-text-secondary;

		&:hover {
			border-color: @accent-blue;
			color: @accent-blue;
		}

		&.active {
			background: rgba(59, 130, 246, 0.08);
			border-color: @accent-blue;
			color: @accent-blue;
			box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12);
		}
	}

	.search-input-wrapper {
		background: @light-card;
		border-color: rgba(0, 0, 0, 0.08);

		&:focus-within {
			border-color: @accent-blue;
			box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
		}
	}

	.search-icon {
		color: @light-text-secondary;
	}

	.search-input {
		color: @light-text;

		&::placeholder {
			color: @light-text-secondary;
		}
	}

	.search-dropdown {
		background: rgba(255, 255, 255, 0.98);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
	}

	.suggestion-item:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.suggestion-text {
		color: @light-text;
	}

	.suggestion-icon,
	.suggestion-remove {
		color: @light-text-secondary;
	}

	.suggestion-clear {
		color: @light-text-secondary;
		border-top-color: rgba(0, 0, 0, 0.06);

		&:hover {
			background: rgba(0, 0, 0, 0.03);
		}
	}

	.status-card {
		background: rgba(34, 211, 238, 0.1);
		border-color: rgba(34, 211, 238, 0.25);
		color: @light-text;
	}

	.bookmark-item:hover .bookmark-name {
		color: @accent-blue;
	}

	.bookmark-item {
		background: rgba(0, 0, 0, 0.02);

		&:hover {
			background: rgba(59, 130, 246, 0.06);
			border-color: @accent-blue;
			box-shadow: 0 8px 20px rgba(59, 130, 246, 0.1);
		}
	}

	.custom-site-card {
		border-color: rgba(0, 0, 0, 0.12);
	}

	.add-site-btn {
		background: transparent;
		border-color: rgba(0, 0, 0, 0.2);
		color: @light-text-secondary;

		&:hover {
			background: rgba(59, 130, 246, 0.06);
			border-color: @accent-blue;
			color: @accent-blue;
			box-shadow: none;
		}
	}

	.title-gradient {
		background: linear-gradient(135deg, @light-text 0%, @accent-blue 50%, @accent-violet 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
}

// 平台图标：无圆角、无边框
.icon {
	width: 28px;
	height: 28px;
	display: block;
	object-fit: contain;
	flex-shrink: 0;
}
</style>

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

			<div
				id="data-slot"
				style="display: none"
			></div>

			<!-- 浏览器信息卡片 -->
			<div class="browser-info-card">
				<div class="browser-info-header">
					<div class="browser-icon">
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<circle
								cx="12"
								cy="12"
								r="10"
							/>
							<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
							<path d="M2 12h20" />
						</svg>
					</div>
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

			<!-- 提示信息 -->
			<div class="tips-section">
				<div
					class="tip-card"
					:class="{ warn: state.warn }"
				>
					<div class="tip-icon">
						<svg
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
							<path d="M12 16v-4M12 8h.01" />
						</svg>
					</div>
					<div class="tip-content">
						<p>进入浏览器并等待初始化后，即可使用安装的浏览器脚本管理拓展，进行脚本的运行。</p>
						<p>如果您使用的是 "OCS 网课助手"，请打开以下任意一个网课平台即可，会出现脚本悬浮窗，并有对应的使用教程。</p>
					</div>
				</div>

				<div
					v-for="(tip, index) of state.tips"
					:key="index"
					class="status-card"
					:class="{ warn: state.warn }"
				>
					<div class="status-indicator"></div>
					<span>当前状态：{{ tip }}</span>
				</div>
			</div>

			<!-- 页面标题 -->
			<div class="page-header">
				<h1 class="page-title">
					<span class="title-gradient">OCS 导航</span>
				</h1>
				<p class="page-subtitle">快速访问常用学习平台</p>
			</div>

			<!-- 书签分组 -->
			<div class="bookmarks-grid">
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
							<div class="group-icon">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
								</svg>
							</div>
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
		</a-spin>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue';
import { OCSApi } from '@ocs-desktop/common/src/api';
import { BookmarkResource } from '../../../common/src/api';

type BookMark = BookmarkResource;

const bookmarks = ref<BookMark[]>([]);

const state = reactive({
	loading: false,
	warn: false,
	tips: ['']
});

// @ts-ignore 暴露方法给 playwright 脚本
window.setBookmarkLoadingState = (_state) => {
	Object.assign(state, _state);
};

onMounted(async () => {
	const infos = await OCSApi.getInfos();
	console.log('OCS API infos:', infos);
	console.log('bookmark data:', infos.bookmark);

	document.title = 'OCS - 导航页';

	// 直接同步填充数据
	for (let i = 0; i < infos.bookmark.length; i++) {
		const bookmark = infos.bookmark[i] as BookMark;
		console.log(`Processing bookmark[${i}]:`, bookmark);

		bookmarks.value[i] = {
			group: bookmark.group,
			values: bookmark.values.filter(Boolean)
		};
	}

	console.log('Final bookmarks:', bookmarks.value);

	setTimeout(() => {
		const nameEl = document.querySelector('#browser-name');
		const tagsEl = document.querySelector('#browser-tags');
		const notesEl = document.querySelector('#browser-notes');
		const dataTextContent = document.querySelector('#data-slot')?.textContent || '';
		if (nameEl && tagsEl && notesEl && dataTextContent) {
			const { name = '', tags = [], notes = '' } = JSON.parse(dataTextContent || '{}');
			nameEl.innerHTML = name || '未知名称';
			tagsEl.innerHTML = tags
				.map(
					(t) =>
						`<span style="background: linear-gradient(135deg, ${t.color}, ${adjustColor(
							t.color,
							-20
						)});" class="browser-tag">${t.name}</span>`
				)
				.join('');
			notesEl.innerHTML = notes || '未知';
		}
	}, 500);
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
	const { uid } = JSON.parse(document.querySelector('#data-slot')?.textContent || '{}');
	fetch('http://localhost:15319/api/bookmark/show-browser-in-app?uid=' + uid);
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500&display=swap');

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
	padding: 32px;
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
	max-width: 100%;
	margin: 0;
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

// 浏览器信息卡片
.browser-info-card {
	background: @card-bg;
	border: 1px solid @card-border;
	border-radius: 16px;
	padding: 20px 24px;
	margin-bottom: 24px;
	backdrop-filter: blur(20px);
	transition: all 0.3s ease;

	&:hover {
		border-color: rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.05);
	}
}

.browser-info-header {
	display: flex;
	align-items: center;
	gap: 20px;
	flex-wrap: wrap;
}

.browser-icon {
	width: 48px;
	height: 48px;
	padding: 10px;
	background: linear-gradient(135deg, @accent-blue, @accent-violet);
	border-radius: 12px;
	color: white;
	flex-shrink: 0;

	svg {
		width: 100%;
		height: 100%;
	}
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
		font-size: 18px;
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
	color: @text-secondary;
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

// 提示区域
.tips-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-bottom: 32px;
}

.tip-card {
	display: flex;
	gap: 16px;
	padding: 16px 20px;
	background: rgba(34, 211, 238, 0.05);
	border: 1px solid rgba(34, 211, 238, 0.15);
	border-radius: 12px;
	transition: all 0.3s ease;

	&.warn {
		background: rgba(251, 191, 36, 0.05);
		border-color: rgba(251, 191, 36, 0.2);
	}
}

.tip-icon {
	flex-shrink: 0;
	width: 24px;
	height: 24px;
	color: @accent-cyan;
	margin-top: 2px;

	.warn & {
		color: #fbbf24;
	}

	svg {
		width: 100%;
		height: 100%;
	}
}

.tip-content {
	flex: 1;
	font-size: 13px;
	color: @text-secondary;
	line-height: 1.7;

	p {
		margin: 0 0 8px 0;

		&:last-child {
			margin-bottom: 0;
		}
	}
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

// 页面标题
.page-header {
	text-align: center;
	margin-bottom: 40px;
	padding: 20px 0;
}

.page-title {
	margin: 0 0 8px 0;
	font-size: 42px;
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
	font-size: 16px;
	color: @text-muted;
	font-weight: 400;
}

// 书签网格
.bookmarks-grid {
	display: flex;
	flex-direction: column;
	gap: 32px;
}

// 书签分组
.bookmark-group {
	background: @card-bg;
	border: 1px solid @card-border;
	border-radius: 20px;
	padding: 20px 24px;
	backdrop-filter: blur(20px);
	transition: all 0.3s ease;
	animation: fadeInUp 0.6s ease backwards;
	animation-delay: calc(var(--group-index) * 0.1s);
	max-width: 100%;

	&:hover {
		border-color: rgba(255, 255, 255, 0.12);
		transform: translateY(-2px);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
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
	margin-bottom: 20px;
	padding-bottom: 16px;
	border-bottom: 1px solid @card-border;
}

.group-icon {
	width: 28px;
	height: 28px;
	padding: 5px;
	background: linear-gradient(135deg, @accent-rose, @accent-violet);
	border-radius: 8px;
	color: white;

	svg {
		width: 100%;
		height: 100%;
	}
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

// 书签项
.group-items {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	width: 100%;
}

.bookmark-item {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 8px 14px;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid @card-border;
	border-radius: 8px;
	text-decoration: none;
	transition: all 0.2s ease;
	animation: fadeIn 0.4s ease backwards;
	animation-delay: calc(var(--item-index) * 0.02s + var(--group-index) * 0.05s);
	flex: 0 0 auto;

	&:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: @accent-cyan;
		transform: translateY(-2px);

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
		padding: 16px;
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
		font-size: 32px;
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

	.browser-info-card,
	.bookmark-group {
		background: @light-card;
		border-color: rgba(0, 0, 0, 0.06);
	}

	.browser-info-card:hover,
	.bookmark-group:hover {
		background: white;
		border-color: rgba(0, 0, 0, 0.1);
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
	.tip-content {
		color: @light-text-secondary;
	}

	.tip-card {
		background: rgba(34, 211, 238, 0.08);
		border-color: rgba(34, 211, 238, 0.2);
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
			background: rgba(0, 0, 0, 0.04);
		}
	}

	.title-gradient {
		background: linear-gradient(135deg, @light-text 0%, @accent-blue 50%, @accent-violet 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
}
</style>

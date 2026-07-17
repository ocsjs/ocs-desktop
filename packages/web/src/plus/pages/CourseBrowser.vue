<template>
	<div class="course-browser-page">
		<section class="browser-command plus-panel">
			<div>
				<span class="eyebrow">OCS 浏览器能力</span>
				<h1>网课浏览器</h1>
				<p>复用原版 OCS 的独立浏览器、脚本安装、缓存隔离和自动化启动流程。</p>
			</div>
			<div class="command-actions">
				<a-button
					type="primary"
					size="large"
					:disabled="inBrowser"
					@click="createAndLaunch"
				>
					<template #icon><icon-play-arrow-fill /></template>
					{{ inBrowser ? '桌面 APP 中可启动' : '新建并启动' }}
				</a-button>
				<a-button
					size="large"
					@click="showAllBrowsers"
				>
					<template #icon><icon-apps /></template>
					管理全部浏览器
				</a-button>
				<a-button
					size="large"
					@click="openSetup"
				>
					<template #icon><icon-tool /></template>
					环境修复
				</a-button>
			</div>
		</section>

		<section class="status-grid">
			<button
				class="status-tile"
				@click="showAllBrowsers"
			>
				<PlusIcon name="desktop_windows" />
				<strong>{{ browserCount }}</strong>
				<span>浏览器配置</span>
			</button>
			<button
				class="status-tile"
				@click="showScriptNotice"
			>
				<PlusIcon name="code" />
				<strong>{{ store.render.scripts.length }}</strong>
				<span>已保存脚本</span>
			</button>
			<button
				class="status-tile"
				@click="showAllBrowsers"
			>
				<PlusIcon name="folder" />
				<strong>{{ folderCount }}</strong>
				<span>分组文件夹</span>
			</button>
			<button
				class="status-tile"
				@click="settingsVisible = !settingsVisible"
			>
				<PlusIcon name="settings" />
				<strong>{{ hasBrowserPath ? '已配置' : '未配置' }}</strong>
				<span>浏览器路径</span>
			</button>
		</section>

		<a-alert
			v-if="inBrowser"
			type="warning"
			show-icon
			:closable="false"
		>
			当前是网页预览，只能查看界面和配置入口；创建、启动、关闭桌面浏览器需要在 OCS Plus 桌面 APP 中使用。
		</a-alert>

		<section
			v-if="settingsVisible"
			class="settings-panel plus-panel"
		>
			<div>
				<span class="eyebrow">本地浏览器路径</span>
				<h2>启动前配置</h2>
				<p>这里写入的就是原 OCS 的浏览器路径配置，新建和启动都会读取它。</p>
			</div>
			<div class="settings-fields">
				<a-input
					v-model="store.render.setting.launchOptions.executablePath"
					placeholder="例如 C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
					allow-clear
				/>
				<a-alert type="info" :closable="false">
					第一阶段 MVP 仅支持选择或填写本地 Chrome / Edge 程序路径。内置浏览器下载、安装和版本管理已降级为后续专项能力，不会自动下载，也不会影响应用启动。
				</a-alert>
			</div>
			<div class="settings-actions">
				<a-button @click="chooseBrowserPath">选择浏览器程序</a-button>
				<a-button
					type="primary"
					@click="settingsVisible = false"
				>
					完成
				</a-button>
			</div>
		</section>

		<section class="browser-list plus-panel">
			<div class="section-head">
				<div>
					<h2>最近的浏览器</h2>
					<p>这里直接操作原 OCS 的浏览器实例，不是演示图。</p>
				</div>
				<a-button
					type="text"
					@click="settingsVisible = !settingsVisible"
				>
					浏览器设置
				</a-button>
				<a-button
					type="text"
					@click="showScriptNotice"
				>
					脚本管理
				</a-button>
				<a-button
					type="text"
					@click="clearCaches"
				>
					清理缓存
				</a-button>
			</div>

			<div
				v-if="browsers.length"
				class="browser-rows"
			>
				<div
					v-for="browser in browsers"
					:key="browser.uid"
					class="browser-row"
				>
					<div class="browser-avatar"><PlusIcon name="public" /></div>
					<div class="browser-meta">
						<strong>{{ browser.name }}</strong>
						<span>{{ browser.notes || '独立缓存目录：' + browser.cachePath }}</span>
					</div>
					<BrowserOperators
						:browser="browser"
						tooltip-position="br"
						:launch-handler="launchFromPlus"
					/>
					<a-button
						size="mini"
						type="text"
						@click="browser.select()"
					>
						详情
					</a-button>
				</div>
			</div>

			<a-empty
				v-else
				description="还没有浏览器配置"
			>
				<a-button
					type="primary"
					:disabled="inBrowser"
					@click="createAndLaunch"
				>
					{{ inBrowser ? '桌面 APP 中可创建' : '创建第一个浏览器' }}
				</a-button>
			</a-empty>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { IconApps, IconPlayArrowFill, IconTool } from '@arco-design/web-vue/es/icon';
import BrowserOperators from '../../components/browsers/BrowserOperators.vue';
import { Browser } from '../../fs/browser';
import { root } from '../../fs/folder';
import { store } from '../../store';
import { checkBrowserCaches, newBrowser } from '../../utils/browser';
import { inBrowser } from '../../utils/node';
import { remote } from '../../utils/remote';
import PlusIcon from '../components/PlusIcon.vue';

const browsers = computed(() =>
	root()
		.findAll((entity) => entity.type === 'browser')
		.slice(0, 6) as Browser[]
);
const browserCount = computed(() => root().findAll((entity) => entity.type === 'browser').length);
const folderCount = computed(() => root().findAll((entity) => entity.type === 'folder').length);
const hasBrowserPath = computed(() => Boolean(store.render.setting.launchOptions.executablePath));
const settingsVisible = ref(!store.render.setting.launchOptions.executablePath);


async function createAndLaunch() {
	if (!(await ensureLaunchReady())) {
		settingsVisible.value = true;
		return;
	}
	const browser = newBrowser({ name: '网课学习浏览器' });
	if (!browser) return;
	Message.success('已创建浏览器，正在启动网课自动化环境');
	await launchFromPlus(browser);
}

async function launchFromPlus(browser: Browser) {
	if (!(await ensureLaunchReady())) return;
	Message.info('正在启动网课浏览器');
	await browser.launch();
}

async function ensureLaunchReady() {
	if (inBrowser) {
		Message.warning('网页预览不能启动桌面浏览器，请在 OCS Plus 桌面 APP 中使用这个功能。');
		return false;
	}
	const executablePath = store.render.setting.launchOptions.executablePath;
	if (!executablePath) {
		Message.warning('还没有配置浏览器路径，请先在当前页面填入浏览器程序路径。');
		return false;
	}
	const major = await getBrowserMajorVersion(executablePath);
	if (major && major > 137) {
		showBrowserVersionModal(executablePath, major);
		return false;
	}
	return true;
}

async function getBrowserMajorVersion(executablePath: string) {
	try {
		return await remote.methods.call('getBrowserMajorVersion', executablePath);
	} catch (err) {
		console.warn('Browser version check failed', err);
	}
}

function showBrowserVersionModal(executablePath: string, major: number) {
	Modal.warning({
		title: '浏览器版本过高',
		okText: '我知道了',
		hideCancel: true,
		content: `当前浏览器版本是 ${major}，原自动化环境只支持 Chrome 137 及以下。请在浏览器设置中配置兼容的本地 Chrome / Edge 程序路径。\n当前路径：${executablePath}\n内置浏览器下载和安装不属于第一阶段 MVP。`
	});
}

function showAllBrowsers() {
	Message.info(browsers.value.length ? '浏览器列表已在当前页面展示，可直接启动、重启、关闭或查看详情。' : '当前还没有浏览器，请先创建一个。');
}

function showScriptNotice() {
	Message.info('脚本安装和更新仍复用原 OCS 能力，请从左下角“高级/原版”进入“原脚本列表”。');
}

async function chooseBrowserPath() {
	if (inBrowser) {
		Message.warning('网页预览不能选择本地程序，请在桌面 APP 中配置。');
		return;
	}
	const result = await remote.dialog.call('showOpenDialog', {
		title: '选择 Chrome 或 Edge 浏览器程序',
		properties: ['openFile'],
		filters: [
			{ name: '浏览器程序', extensions: ['exe'] },
			{ name: '全部文件', extensions: ['*'] }
		]
	});
	if (!result.canceled && result.filePaths?.[0]) {
		store.render.setting.launchOptions.executablePath = result.filePaths[0];
		Message.success('浏览器路径已写入 OCS 配置');
	}
}

function openSetup() {
	store.render.state.setup = true;
}

function clearCaches() {
	checkBrowserCaches().catch(console.error);
}
</script>

<style scoped lang="less">
.course-browser-page {
	display: grid;
	gap: 10px;
}

.browser-command {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;
	min-height: 142px;
	background: linear-gradient(135deg, #ffffff 0%, #f1fbf8 100%);

	h1 {
		margin: 6px 0 8px;
		color: #101827;
		font-size: 30px;
		font-weight: 900;
	}

	p {
		max-width: 620px;
		margin: 0;
		color: #607086;
		line-height: 1.7;
	}
}

.eyebrow {
	color: #168f95;
	font-size: 12px;
	font-weight: 900;
	letter-spacing: 0;
}

.command-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 10px;
}

.status-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(140px, 1fr));
	gap: 10px;
}

.settings-panel {
	display: grid;
	grid-template-columns: minmax(260px, 360px) minmax(320px, 1fr) auto;
	align-items: center;
	gap: 16px;

	h2 {
		margin: 6px 0;
		color: #111827;
		font-size: 20px;
		font-weight: 850;
	}

	p {
		margin: 0;
		color: #667085;
		line-height: 1.6;
	}
}

.settings-fields {
	display: grid;
	gap: 10px;
}


.settings-actions {
	display: flex;
	gap: 8px;
	justify-content: flex-end;
}

.status-tile {
	min-height: 112px;
	padding: 18px;
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	background: #ffffff;
	color: inherit;
	text-align: left;
	cursor: pointer;
	transition:
		transform 0.16s ease,
		border-color 0.16s ease,
		box-shadow 0.16s ease;

	.plus-icon {
		color: #168f95;
	}

	strong {
		display: block;
		margin-top: 12px;
		color: #111827;
		font-size: 23px;
	}

	span {
		color: #667085;
	}

	&:hover {
		transform: translateY(-2px);
		border-color: #b9dedc;
		box-shadow: 0 16px 32px rgba(24, 48, 74, 0.08);
	}
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	margin-bottom: 12px;

	h2 {
		margin: 0 0 4px;
		color: #111827;
		font-size: 20px;
		font-weight: 850;
	}

	p {
		margin: 0;
		color: #667085;
	}
}

.browser-rows {
	display: grid;
	gap: 8px;
}

.browser-row {
	display: grid;
	grid-template-columns: 42px minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 12px;
	min-height: 68px;
	padding: 10px 12px;
	border: 1px solid #edf1f5;
	border-radius: 8px;
	background: #fbfcfd;
}

.browser-avatar {
	width: 42px;
	height: 42px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	background: #e8f8f5;
	color: #168f95;
}

.browser-meta {
	min-width: 0;

	strong,
	span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: #111827;
	}

	span {
		margin-top: 4px;
		color: #748096;
		font-size: 12px;
	}
}

@media (max-width: 980px) {
	.browser-command {
		align-items: flex-start;
		flex-direction: column;
	}

	.command-actions {
		justify-content: flex-start;
	}

	.status-grid {
		grid-template-columns: repeat(2, minmax(140px, 1fr));
	}

	.settings-panel {
		grid-template-columns: 1fr;
	}

	.browser-row {
		grid-template-columns: 42px minmax(0, 1fr);
	}
}
</style>

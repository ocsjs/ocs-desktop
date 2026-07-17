<template>
	<a-config-provider :locale="zhCN">
		<div class="w-100 h-100">
			<!-- 全局顶部栏 -->
			<Title id="title" />

			<div class="main-container w-100">
				<!-- 内容区域 -->
				<router-view v-slot="{ Component }">
					<keep-alive>
						<component :is="Component" />
					</keep-alive>
				</router-view>
			</div>

			<!-- 全局：浏览器操作面板 -->
			<a-modal
				:closable="false"
				:visible="!!currentBrowser"
				:width="600"
				:top="8"
				:align-center="false"
				:footer="false"
				:header="false"
				@cancel="store.render.browser.currentBrowserUid = ''"
			>
				<div v-if="currentBrowser">
					<BrowserPanelOperators :browser="currentBrowser"></BrowserPanelOperators>
					<a-divider class="mt-2 mb-1" />
					<div style="max-height: 80vh; overflow: auto">
						<BrowserPanel :browser="currentBrowser"></BrowserPanel>
					</div>
				</div>
			</a-modal>

			<!-- 全局：一键安装 -->
			<Setup
				v-model:visible="store.render.state.setup"
				:preset-steps="['show_desc', 'init_env', 'init_extensions', 'init_script']"
			></Setup>

			<!-- 全局：新建浏览器自动初始化 -->
			<Setup
				v-model:visible="store.render.state.newBrowserSetup"
				auto-setup
				title="新建浏览器"
				confirm-text="开始初始化"
				:preset-steps="['new_browser', 'init_automationScript']"
				@finish="
					() => {
						store.render.state.newBrowserSetup = false;
						Message.success('新建浏览器成功');
					}
				"
			></Setup>
		</div>
	</a-config-provider>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { store } from './store';
import { remote } from './utils/remote';
import { root } from './fs/folder';
import { electron } from './utils/node';
import { closeAllBrowser, showClearBrowserCachesModal } from './utils/browser';
import { about, changeTheme, fetchRemoteNotify, fetchRemoteLangs, setAlwaysOnTop, setAutoLaunch } from './utils';
import { activeIpcRenderListener } from './utils/ipc';
import { getWindowsRelease } from './utils/os';
import { currentBrowser } from './fs';
import { Modal, Message } from '@arco-design/web-vue';
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';
import Title from './components/Title.vue';
import BrowserPanel from './components/browsers/BrowserPanel.vue';
import BrowserPanelOperators from './components/BrowserPanelOperators.vue';
import Setup from './components/Setup.vue';

const { ipcRenderer } = electron;

/** 异步保存，用于实时持久化（单次 IPC 调用，加密+写入在主进程完成） */
async function saveStoreToLocal(_store: typeof store) {
	try {
		const shouldEncrypt = remote.methods.callSync('isEncryptionAvailable');
		await remote.methods.call('saveStore', JSON.stringify(_store), shouldEncrypt);
	} catch (e) {
		console.error(e);
	}
}

/** 同步版本保存，用于关闭时确保数据写入磁盘（单次 IPC 调用） */
function saveStoreToLocalSync(_store: typeof store) {
	try {
		const shouldEncrypt = remote.methods.callSync('isEncryptionAvailable');
		remote.methods.callSync('saveStore', JSON.stringify(_store), shouldEncrypt);
	} catch (e) {
		console.error(e);
	}
}

onMounted(async () => {
	/** 开启 Ipc 通道监听 */
	activeIpcRenderListener();

	/** 设置窗口边框 */
	remote.os.call('platform').then(async (platform) => {
		if (platform === 'win32') {
			const release = await getWindowsRelease();
			if (release !== 'win11') {
				document.documentElement.classList.add('window-frame');
			}
		}
	});

	/** 初始化标题 */
	remote.win.call('setTitle', `OCS - 首页`);

	/** 初始化 store */
	remote.logger.call('info', 'render store init');
	setAutoLaunch();
	setAlwaysOnTop();
	changeTheme().catch(console.error);

	/** 打开关于软件 */
	if (store.render.state.first) {
		about().catch(console.error);
	}

	/** 监听屏幕变化 */
	onResize();
	window.addEventListener('resize', onResize);

	/** 获取最新远程通知 */
	fetchRemoteNotify(false).catch(console.error);

	/** 获取远程语言 */
	fetchRemoteLangs().catch(console.error);

	/** 检测浏览器缓存大小，超过阈值则提示 */
	remote.methods.call('statisticFolderSize', store.paths.userDataDirsFolder).then((totalSize) => {
		if (totalSize > 1024 * 1024 * 1024 * (store.render.setting.browser.cachesSizeWarningPoint ?? 10)) {
			showClearBrowserCachesModal(totalSize);
		}
	});

	/** 监听主题变化 */
	watch(
		() => cloneDeep(store.render.setting.theme),
		(cur) => {
			if (cur.dark) {
				document.body.setAttribute('arco-theme', 'dark');
			} else {
				document.body.removeAttribute('arco-theme');
			}
		}
	);

	/** 监听自动启动/置顶变化 */
	watch(() => store.window.autoLaunch, setAutoLaunch);
	watch(() => store.window.alwaysOnTop, setAlwaysOnTop);

	/** 监听窗口高度 */
	window.onresize = () => {
		store.render.state.height = document.documentElement.clientHeight;
	};

	/** 准实时持久化：极短防抖 + 保存期间跳过 + 脏标记重试 */
	let saveInFlight = false;
	let dirtyWhileSaving = false;

	async function performSave() {
		if (saveInFlight) {
			dirtyWhileSaving = true;
			return;
		}
		saveInFlight = true;
		try {
			await saveStoreToLocal(store);
		} finally {
			saveInFlight = false;
			if (dirtyWhileSaving) {
				dirtyWhileSaving = false;
				performSave();
			}
		}
	}

	watch([() => store.render], debounce(performSave, 100), { deep: true });

	/** 全局唯一关闭处理 */
	let isExiting = false;
	ipcRenderer.on('close', async () => {
		// 防重入：避免重复点击关闭按钮或 window.close 循环导致并发触发关闭流程、重复弹窗
		if (isExiting) return;
		isExiting = true;
		console.log('关闭浏览器中...');
		const res = await closeAllBrowser();
		if (res === false) {
			isExiting = false;
			console.log('有浏览器拒绝关闭，取消退出');
			return;
		}
		console.log('保存数据中...');
		const m = Modal.info({ content: '正在保存数据...', closable: false, maskClosable: false, footer: false });
		store.render.browser.root = JSON.parse(JSON.stringify(root()));
		saveStoreToLocalSync(store);
		m.close();
		console.log('数据已保存');
		remote.app.call('exit', 0);
	});
});

onUnmounted(() => {
	closeAllBrowser();
});

/** 屏幕响应式检测 */
function onResize() {
	const isInMobile = document.documentElement.clientWidth < 1200;
	store.render.state.mini = isInMobile;
	store.render.state.responsive = isInMobile ? 'mini' : 'small';

	if (document.documentElement.clientWidth < 800) {
		store.render.setting.showSideBarText = false;
		store.render.state.mini = true;
	} else {
		store.render.setting.showSideBarText = true;
		store.render.state.mini = false;
	}
}
</script>

<style lang="less">
@import '@/assets/css/bootstrap.min.css';
@import '@/assets/css/common.css';

.main-container {
	display: grid;
	grid-template-rows: calc(100vh - var(--title-height));
	grid-template-areas: 'main ';
}

.arco-notification-list {
	top: calc(20px + var(--title-height)) !important;
}

.arco-message-list {
	top: calc(40px + var(--title-height)) !important;
}

/* 新手教程遮罩层 */
.tutorial {
	position: absolute;
	width: 100%;
	height: 100%;
	background-color: #00000030;
	z-index: 100;
	top: 0;
	left: 0;
}

/** 浏览器编辑抽屉导航栏样式 */
.bp-toc {
	position: absolute;
	background: white;
	z-index: 999;
	right: 400px;

	animation-duration: 0.5s;
	animation-name: slide-in;
	animation-timing-function: ease;
	padding: 4px;
	border-radius: 8px 0px 0px 8px;
	font-size: 12px;
	top: 24px;
	color: #86909c;

	* {
		cursor: pointer;
		margin: 6px 0px 6px 6px;
		padding: 4px;
		border-radius: 4px;

		&:hover {
			background-color: #ececec;
		}
	}
}

@keyframes slide-in {
	from {
		top: -500px;
	}

	to {
		top: 24px;
	}
}
</style>

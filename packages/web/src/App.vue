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

			<!-- 全局：欢迎使用引导（首次进入时于初始化弹窗之前展示） -->
			<a-modal
				:visible="store.render.state.welcome && store.render.state.setup"
				:footer="false"
				:closable="false"
				:mask-closable="false"
				:unmount-on-close="true"
				:width="480"
				@cancel="store.render.state.welcome = false"
			>
				<template #title>
					<span class="welcome-title">🚀 {{ t('welcome_title', '欢迎使用 OCS 桌面软件') }}</span>
				</template>
				<div class="welcome-body">
					<p class="welcome-desc">
						{{
							t(
								'welcome_desc',
								'OCS 桌面软件是一款浏览器自动化工具，可以帮助你自动初始化浏览器环境、脚本管理器拓展与用户脚本，支持浏览器多开管理、自动登录、自动安装用户脚本等，让浏览器自动化变得简单高效。'
							)
						}}
					</p>
					<p class="welcome-tip">
						{{ t('welcome_init_tip', '使用软件前需要初始化一下环境，点击下方按钮开始！') }}
					</p>
					<div
						class="text-center"
						style="margin-top: 20px"
					>
						<a-button
							type="primary"
							size="large"
							@click="store.render.state.welcome = false"
						>
							{{ t('welcome_start_btn', '开始初始化') }}
						</a-button>
					</div>
				</div>
			</a-modal>

			<!-- 全局：一键安装 -->
			<template v-if="!store.render.state.welcome">
				<Setup
					v-model:visible="store.render.state.setup"
					:auto-setup="true"
					:preset-steps="[
						'show_desc',
						'init_env',
						'new_browser',
						'init_automationScript',
						'init_extensions',
						'init_script',
						'update_env'
					]"
					@finish="
						() => {
							store.render.state.setup = false;
						}
					"
				></Setup>
			</template>

			<!-- 全局：新建浏览器自动初始化（仅打开时挂载，避免启动即运行初始化流程并永久挂起） -->
			<Setup
				v-if="store.render.state.newBrowserSetup"
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
import { store, t } from './store';
import { remote } from './utils/remote';
import { root } from './fs/folder';
import { electron } from './utils/node';
import { closeAllBrowser, showClearBrowserCachesModal, askCloseOrTray } from './utils/browser';
import { processes } from './utils/process';
import {
	changeTheme,
	fetchRemoteNotify,
	fetchRemoteLangs,
	setAlwaysOnTop,
	setAutoLaunch,
	initThemeSystemListener
} from './utils';
import { activeIpcRenderListener } from './utils/ipc';
import { getWindowsRelease } from './utils/os';
import { currentBrowser } from './fs';
import { Modal, Message } from '@arco-design/web-vue';
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
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
	initThemeSystemListener();

	/** 监听屏幕变化 */
	onResize();
	window.addEventListener('resize', onResize);

	/** 获取远程语言 */
	fetchRemoteLangs().catch(console.error);

	// 首次初始化不显示通知。
	if (!store.render.state.setup) {
		/** 获取最新远程通知 */
		fetchRemoteNotify(false).catch(console.error);
	}

	/** 检测浏览器缓存大小，超过阈值则提示 */
	remote.methods.call('statisticFolderSize', store.paths.userDataDirsFolder).then((totalSize) => {
		if (totalSize > 1024 * 1024 * 1024 * (store.render.setting.browser.cachesSizeWarningPoint ?? 10)) {
			showClearBrowserCachesModal(totalSize);
		}
	});

	/** 监听主题变化（白天/夜间/自动 + 主题颜色） */
	watch(
		() => [store.render.setting.theme.mode, store.render.setting.theme.color],
		() => {
			changeTheme().catch(console.error);
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

	// 监听范围必须覆盖全部可配置段：updater/server/window/paths 的修改同样需要持久化，
	// 否则主进程 electron-store 一直是旧值（例如开发者设置里改更新源后主进程读不到）
	watch(
		[() => store.render, () => store.updater, () => store.server, () => store.window, () => store.paths],
		debounce(performSave, 100),
		{ deep: true }
	);

	/** 全局唯一关闭处理 */
	let isExiting = false;

	/** 完整退出流程：关闭浏览器 + 保存数据 + 退出应用。返回 false 表示用户取消了关闭 */
	async function performFullExit(skipBrowserConfirm = false) {
		console.log('关闭浏览器中...');
		const res = await closeAllBrowser(skipBrowserConfirm);
		if (res === false) {
			console.log('有浏览器拒绝关闭，取消退出');
			return false;
		}
		console.log('保存数据中...');
		const m = Modal.info({ content: '正在保存数据...', closable: false, maskClosable: false, footer: false });
		store.render.browser.root = JSON.parse(JSON.stringify(root()));
		saveStoreToLocalSync(store);
		m.close();
		console.log('数据已保存');
		// 即将退出：销毁托盘避免 Windows 残留图标，再通过 quitApp 程序化退出（绕过隐藏到托盘）
		remote.methods.call('destroyTray');
		remote.methods.call('quitApp', 0);
		return true;
	}

	ipcRenderer.on('close', async () => {
		// 防重入：避免重复点击关闭按钮或 window.close 循环导致并发触发关闭流程、重复弹窗
		if (isExiting) return;
		// 后台运行：关闭窗口时仅隐藏到系统托盘，浏览器与自动化任务保持运行，不退出应用
		if (store.window.hideToTrayOnClose) {
			remote.methods.call('hideToTray');
			return;
		}
		// 后台运行未开启：若仍有浏览器正在运行，询问「关闭并退出」还是「移动至托盘运行」
		if (processes.length > 0) {
			// 询问期间占位防重入，取消/移动至托盘时复位
			isExiting = true;
			const choice = await askCloseOrTray();
			if (choice === 'tray') {
				isExiting = false;
				remote.methods.call('hideToTray');
				return;
			}
			if (choice === 'cancel') {
				isExiting = false;
				return;
			}
			// choice === 'exit'：用户已确认关闭，跳过 closeAllBrowser 的二次确认弹窗
			if (!(await performFullExit(true))) {
				isExiting = false;
				remote.methods.call('cancelQuit');
			}
			return;
		}
		// 无浏览器运行：直接执行完整退出流程
		isExiting = true;
		if (!(await performFullExit())) {
			// 用户取消了关闭浏览器，复位退出标记与程序化退出标记，恢复「隐藏到托盘」能力
			isExiting = false;
			remote.methods.call('cancelQuit');
		}
	});

	/** 托盘「退出」/ 程序化退出：绕过「隐藏到托盘」逻辑，强制执行完整退出流程 */
	ipcRenderer.on('quit', async () => {
		if (isExiting) return;
		isExiting = true;
		if (!(await performFullExit())) {
			isExiting = false;
			remote.methods.call('cancelQuit');
		}
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

.welcome-title {
	font-size: 16px;
	font-weight: 600;
}

.welcome-body {
	.welcome-desc {
		color: #4e5969;
		line-height: 1.8;
		margin-bottom: 16px;
	}

	.welcome-tip {
		color: #1d2129;
		font-weight: 500;
		margin-bottom: 0;
	}
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

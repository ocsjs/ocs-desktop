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

			<!-- 全局：欢迎使用介绍（仅首次进入展示，纯介绍无初始化功能；
			     环境检测与补全在启动浏览器时自动执行，见 utils/env-bootstrap.ts） -->
			<a-modal
				:visible="store.render.state.welcome"
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
								'OCS 桌面软件是一款浏览器自动化工具，支持浏览器多开管理、自动登录、自动安装用户脚本等，让浏览器自动化变得简单高效。'
							)
						}}
					</p>
					<p class="welcome-tip">
						{{ t('welcome_init_tip', '无需任何手动设置，启动浏览器时将自动完成环境检测与补全。') }}
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
							{{ t('welcome_start_btn', '开始使用') }}
						</a-button>
					</div>
				</div>
			</a-modal>

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

			<!-- 全局状态栏：固定右下角显示，避免顶部栏跨平台渲染位置不一致
			     （mac 下状态信息在右侧，文本过长会把按钮顶到左侧） -->
			<div class="status-bar-container">
				<StatusBar />
			</div>
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
import { notify } from './utils/notify';
import { currentBrowser } from './fs';
import { Modal, Message } from '@arco-design/web-vue';
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
import debounce from 'lodash/debounce';
import Title from './components/Title.vue';
import StatusBar from './components/StatusBar.vue';
import BrowserPanel from './components/browsers/BrowserPanel.vue';
import BrowserPanelOperators from './components/BrowserPanelOperators.vue';
import Setup from './components/Setup.vue';

const { ipcRenderer } = electron;

/** 是否启用加密存储：开发者设置「数据加密」开关 + 主密钥就绪（两者同时成立才加密） */
function isEncryptionEnabled() {
	return store.render.setting.dev?.dataEncryption !== false && remote.methods.callSync('isEncryptionAvailable');
}

/** 异步保存，用于实时持久化（单次 IPC 调用，加密+写入在主进程完成） */
async function saveStoreToLocal(_store: typeof store) {
	try {
		const shouldEncrypt = isEncryptionEnabled();
		await remote.methods.call('saveStore', JSON.stringify(_store), shouldEncrypt);
	} catch (e) {
		console.error(e);
	}
}

/** 同步版本保存，用于关闭时确保数据写入磁盘（单次 IPC 调用） */
function saveStoreToLocalSync(_store: typeof store) {
	try {
		const shouldEncrypt = isEncryptionEnabled();
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

	// 首次进入（欢迎弹窗展示期间）不显示通知。
	if (!store.render.state.welcome) {
		/** 获取最新远程通知 */
		fetchRemoteNotify(false).catch(console.error);
	}

	/** 检测浏览器缓存大小，超过阈值则提示 */
	remote.methods.call('statisticFolderSize', store.paths.userDataDirsFolder).then((totalSize) => {
		if (totalSize > 1024 * 1024 * 1024 * (store.render.setting.browser.cachesSizeWarningPoint ?? 10)) {
			showClearBrowserCachesModal(totalSize);
		}
	});

	/** Linux 密钥环检测：basic_text 表示无可用密钥环（gnome-keyring/kwallet），
	 *  信封加密的密钥包裹将退化为明文存储，引导用户安装 */
	remote.os.call('platform').then(async (platform) => {
		if (platform !== 'linux') return;
		const backend = await remote.methods.call('getStorageBackend');
		if (backend === 'basic_text') {
			notify(
				'系统未检测到密钥环',
				'数据加密保护将降级为基础模式。建议安装密钥环：GNOME/Debian 系执行 sudo apt install gnome-keyring，KDE 安装 kwallet，安装后重启软件生效。',
				'keyring-missing',
				{ type: 'warning', duration: 10 * 1000, copy: false }
			);
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
		[
			() => store.render,
			() => store.updater,
			() => store.server,
			() => store.window,
			() => store.paths,
			() => store.scriptResources
		],
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
		store.render.state.mini = true;
	} else {
		store.render.state.mini = false;
	}
}
</script>

<style lang="less">
@import '@/assets/css/bootstrap.min.css';
@import '@/assets/css/common.css';

/* 全局状态栏：固定右下角，宽度自适应内容，向左扩展不遮挡右侧边缘 */
.status-bar-container {
	position: fixed;
	right: 12px;
	bottom: 12px;
	z-index: 3000;
	display: flex;
	justify-content: flex-end;
}

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

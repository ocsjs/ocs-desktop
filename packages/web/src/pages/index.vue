<template>
	<a-config-provider :locale="zhCN">
		<CommonEditActionDropdown
			trigger="contextMenu"
			align-point
			position="bl"
			:style="{ display: 'block' }"
		>
			<div class="plus-shell">
				<aside class="plus-sidebar">
					<div class="brand">
						<div class="brand-mark">OCS<sup>+</sup></div>
						<strong>OCS Plus</strong>
					</div>

					<nav class="module-nav">
						<button
							v-for="module in enabledPlusModules"
							:key="module.id"
							:class="{ active: currentRoute.name === module.id }"
							@click="clickModule(module)"
						>
							<PlusIcon :name="module.icon" />
							<span>{{ module.title }}</span>
						</button>
					</nav>

					<div class="more-menu">
						<button
							:class="{ active: currentRoute.path.startsWith('/legacy') }"
							@click="router.push('/legacy')"
						>
							<PlusIcon name="menu" />
							<span>高级/原版</span>
						</button>
						<PlusIcon name="expand_more" :size="18" />
					</div>
				</aside>

				<section class="plus-main">
					<header class="plus-topbar">
						<div class="status-pills">
							<span class="pill online"><PlusIcon name="check" :size="18" /> 在线</span>
							<span class="pill">本地服务正常</span>
						</div>

						<div class="top-actions">
							<button @click="openSyncSettings"><PlusIcon name="cloud_sync" /> 云端同步</button>
							<button
								title="通知"
								@click="showNotifications"
							>
								<PlusIcon name="notifications" />
							</button>
							<button
								title="设置"
								@click="openSettings"
							>
								<PlusIcon name="settings" />
							</button>
							<span class="user-chip">学</span>
						</div>
					</header>

					<main class="plus-content">
						<router-view v-slot="{ Component }">
							<keep-alive>
								<component :is="Component" />
							</keep-alive>
						</router-view>
					</main>

					<footer class="plus-footer">
						<span><i /> 已连接到本地服务</span>
						<span>版本 {{ version || '1.2.0' }}</span>
					</footer>
				</section>
			</div>

			<template v-if="currentBrowser">
				<template v-if="store.render.state.mini">
					<a-modal
						title="浏览器操作"
						:visible="!!currentBrowser"
						:width="600"
						:footer="false"
						fullscreen
						@cancel="store.render.browser.currentBrowserUid = ''"
					>
						<template #title>
							<BrowserPanelOperators :browser="currentBrowser"></BrowserPanelOperators>
						</template>
						<BrowserPanel :browser="currentBrowser"></BrowserPanel>
					</a-modal>
				</template>
				<template v-else>
					<a-drawer
						id="browser-panel"
						popup-container="#component"
						:closable="false"
						:visible="!!currentBrowser"
						:width="600"
						:footer="false"
						:header="false"
						@cancel="store.render.browser.currentBrowserUid = ''"
					>
						<BrowserPanelOperators :browser="currentBrowser"></BrowserPanelOperators>
						<a-divider class="mt-2 mb-1" />
						<BrowserPanel :browser="currentBrowser"></BrowserPanel>
					</a-drawer>
				</template>
			</template>

			<Setup v-model:visible="store.render.state.setup"></Setup>
		</CommonEditActionDropdown>
	</a-config-provider>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
import { Message, Modal } from '@arco-design/web-vue';
import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';
import BrowserPanel from '../components/browsers/BrowserPanel.vue';
import BrowserPanelOperators from '../components/BrowserPanelOperators.vue';
import CommonEditActionDropdown from '../components/CommonEditActionDropdown.vue';
import Setup from '../components/Setup.vue';
import { currentBrowser } from '../fs';
import { store } from '../store';
import { about, changeTheme, fetchRemoteLangs, fetchRemoteNotify, setAlwaysOnTop, setAutoLaunch } from '../utils';
import { closeAllBrowser, showClearBrowserCachesModal } from '../utils/browser';
import { activeIpcRenderListener } from '../utils/ipc';
import { electron, inBrowser } from '../utils/node';
import { getWindowsRelease } from '../utils/os';
import { remote } from '../utils/remote';
import PlusIcon from '../plus/components/PlusIcon.vue';
import { enabledPlusModules, PlusModule } from '../plus/modules/registry';

const { ipcRenderer } = electron;
const router = useRouter();
const currentRoute = router.currentRoute;
const version = ref('');

onUnmounted(() => closeAllBrowser());

onMounted(async () => {
	try {
		activeIpcRenderListener();

		remote.os.call('platform').then(async (platform) => {
			if (platform === 'win32') {
				const release = await getWindowsRelease();
				if (release !== 'win11') {
					document.documentElement.classList.add('window-frame');
				}
			}
		});

		if (inBrowser) {
			store.render.state.setup = false;
			Modal.warning({
				content: '下载桌面版软件才能体验全部功能！',
				title: '警告',
				simple: true,
				hideCancel: false,
				okText: '前往官网下载',
				onOk() {
					window.open('https://docs.ocsjs.com/docs/资源下载/app-downloads', '_blank');
				}
			});
		}

		remote.app.call('getVersion').then((v) => {
			version.value = v;
		});

		remote.win.call('setTitle', `OCS Plus - ${String(router.resolve(currentRoute.value).meta.title || '今日学习')}`);
		remote.logger.call('info', 'render store init');
		if (!inBrowser) {
			setAutoLaunch();
			setAlwaysOnTop();
		}
		changeTheme().catch(console.error);

		if (store.render.state.first) {
			about().catch(console.error);
		}

		onResize();
		window.addEventListener('resize', onResize);
		fetchRemoteNotify(false).catch(console.error);
		fetchRemoteLangs().catch(console.error);

		if (!inBrowser) {
			remote.methods.call('statisticFolderSize', store.paths.userDataDirsFolder).then((totalSize) => {
				if (totalSize > 1024 * 1024 * 1024 * (store.render.setting.browser.cachesSizeWarningPoint ?? 10)) {
					showClearBrowserCachesModal(totalSize);
				}
			});
		}

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

		watch(
			[
				() => store.render.setting.ocs.openSync,
				() => store.render.setting.launchOptions.executablePath,
				() => store.render.setting.browser.enableDialog,
				() => store.render.setting.browser.forceUpdateScript
			],
			async () => {
				saveStoreToLocal(store);
			}
		);

		watch(
			[() => store.render],
			debounce(() => {
				saveStoreToLocal(store).catch(console.error);
			}, 1000),
			{ deep: true }
		);

		if (!inBrowser) {
			watch(() => store.window.autoLaunch, setAutoLaunch);
			watch(() => store.window.alwaysOnTop, setAlwaysOnTop);
		}

		window.onresize = () => {
			store.render.state.height = document.documentElement.clientHeight;
		};
	} catch (e) {
		console.error(e);
	}
});

ipcRenderer.on('close', closeApp);

function openSyncSettings() {
	Message.info('云端同步的新面板还没接入；需要原版同步配置时，请从左下角“高级/原版”进入。');
}

function openSettings() {
	router.push('/settings');
	remote.win.call('setTitle', 'OCS Plus - 设置中心');
}

function showNotifications() {
	fetchRemoteNotify(true).catch(console.error);
}

async function closeApp() {
	console.log('关闭浏览器中...');
	const res = await closeAllBrowser();
	if (res === false) {
		console.log('有浏览器拒绝关闭，取消退出');
		return;
	}
	console.log('保存数据中...');
	const m = Modal.info({ content: '正在保存数据...', closable: false, maskClosable: false, footer: false });
	await saveStoreToLocal(store);
	m.close();
	console.log('数据已保存');
	if (inBrowser) {
		window.close();
	} else {
		remote.app.call('exit', 0);
	}
}

function clickModule(module: PlusModule) {
	router.push(module.path);
	remote.win.call('setTitle', `OCS Plus - ${module.title}`);
}

async function saveStoreToLocal(_store: typeof store) {
	try {
		if (inBrowser) {
			localStorage.setItem('ocs-app-store', JSON.stringify(_store));
		} else if (remote.methods.callSync('isEncryptionAvailable') && _store.app.data_encryption) {
			const resolvedStore: typeof store = JSON.parse(JSON.stringify(_store));
			Reflect.set(resolvedStore, 'render', await remote.methods.call('encryptString', JSON.stringify(resolvedStore.render)));
			await remote['electron-store'].set('store', JSON.parse(JSON.stringify(resolvedStore)));
		} else {
			await remote['electron-store'].set('store', JSON.parse(JSON.stringify(_store)));
		}
	} catch (e) {
		console.error(e);
	}
}

function onResize() {
	const isInMobile = document.documentElement.clientWidth < 1100;
	store.render.state.mini = isInMobile;
	store.render.state.responsive = isInMobile ? 'mini' : 'small';
	store.render.setting.showSideBarText = document.documentElement.clientWidth >= 800;
}
</script>

<style lang="less">
@import '@/assets/css/bootstrap.min.css';
@import '@/assets/css/common.css';

html,
body,
#app,
#component {
	height: 100%;
}

body {
	margin: 0;
	background: #eef3f7;
}

.plus-shell {
	height: 100vh;
	width: 100vw;
	display: grid;
	grid-template-columns: 204px minmax(0, 1fr);
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(246, 249, 252, 0.94)),
		#f6f9fc;
	color: #162033;
	overflow: hidden;
	font-family: 'Microsoft YaHei UI', 'Segoe UI', sans-serif;
}

.plus-sidebar {
	-webkit-app-region: drag;
	display: flex;
	flex-direction: column;
	border-right: 1px solid #dde5ee;
	background: rgba(255, 255, 255, 0.78);
	backdrop-filter: blur(18px);
}

.brand {
	height: 78px;
	display: flex;
	align-items: center;
	gap: 14px;
	padding: 0 24px;
	border-bottom: 1px solid #e3e9ef;

	strong {
		font-size: 21px;
		font-weight: 850;
		letter-spacing: 0;
	}
}

.brand-mark {
	width: 50px;
	height: 50px;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #ffffff;
	background: linear-gradient(145deg, #22b5ad, #20899e);
	box-shadow: 0 12px 22px rgba(31, 151, 153, 0.24);
	font-weight: 900;

	sup {
		font-size: 10px;
	}
}

.module-nav {
	-webkit-app-region: no-drag;
	display: grid;
	gap: 10px;
	padding: 16px 12px;

	button {
		height: 58px;
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 0 18px;
		border: 0;
		border-left: 4px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: #1f2937;
		font-size: 16px;
		font-weight: 650;
		text-align: left;
		transition:
			background 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;

		.plus-icon {
			flex: 0 0 22px;
			color: #162033;
		}

		span {
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		&:hover {
			background: #eef7f6;
		}

		&.active {
			background: #e9f6f5;
			border-left-color: #2aa7a3;
			color: #137f86;
			transform: translateX(2px);

			.plus-icon {
				color: #168f95;
			}
		}
	}
}

.more-menu {
	-webkit-app-region: no-drag;
	margin-top: auto;
	padding: 0 20px 22px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	color: #617086;

	button {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		border: 0;
		background: transparent;
		color: inherit;

		&.active {
			color: #168f95;
			font-weight: 800;
		}
	}
}

.plus-main {
	display: grid;
	grid-template-rows: 78px minmax(0, 1fr) 48px;
	min-width: 0;
}

.plus-topbar {
	-webkit-app-region: drag;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 126px 0 20px;
	border-bottom: 1px solid #dde5ee;
	background: rgba(255, 255, 255, 0.86);
	backdrop-filter: blur(18px);
}

.status-pills,
.top-actions {
	-webkit-app-region: no-drag;
	display: flex;
	align-items: center;
	gap: 10px;
}

.pill {
	height: 38px;
	display: inline-flex;
	align-items: center;
	gap: 7px;
	padding: 0 16px;
	border-radius: 8px;
	border: 1px solid #dce4ec;
	background: #f6f8fa;
	color: #1f2937;
	font-weight: 700;

	&.online {
		background: #e7f8f2;
		border-color: #c6eadb;
		color: #078653;
	}
}

.top-actions {
	button {
		height: 36px;
		min-width: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 0;
		background: transparent;
		color: #101827;
		font-weight: 650;
	}
}

.user-chip {
	width: 36px;
	height: 36px;
	border-radius: 999px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: #0b7190;
	background: #e8eef5;
	font-weight: 900;
}

.plus-content {
	min-width: 0;
	min-height: 0;
	padding: 8px;
	overflow: auto;
}

.plus-panel {
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.92);
	padding: 20px 18px;
	box-shadow: 0 16px 38px rgba(24, 48, 74, 0.07);
}

.plus-footer {
	display: flex;
	align-items: center;
	gap: 28px;
	padding: 0 22px;
	border-top: 1px solid #dde5ee;
	background: rgba(255, 255, 255, 0.82);
	color: #64748b;
	font-size: 13px;

	span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	i {
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: #22c17a;
	}
}

.ant-modal-confirm .ant-modal-body {
	padding: 12px !important;
}

@media (max-width: 980px) {
	.plus-shell {
		grid-template-columns: 82px minmax(0, 1fr);
	}

	.brand {
		justify-content: center;
		padding: 0;

		strong {
			display: none;
		}
	}

	.module-nav button {
		justify-content: center;
		padding: 0;

		span {
			display: none;
		}
	}

	.more-menu span {
		display: none;
	}
}

@media (max-width: 1280px) {
	.plus-shell {
		grid-template-columns: 92px minmax(0, 1fr);
	}

	.plus-sidebar {
		background: rgba(255, 255, 255, 0.84);
	}

	.brand {
		height: 70px;
		justify-content: center;
		padding: 0;

		strong {
			display: none;
		}
	}

	.brand-mark {
		width: 48px;
		height: 48px;
	}

	.module-nav {
		gap: 8px;
		padding: 14px 10px;

		button {
			height: 54px;
			justify-content: center;
			padding: 0;
			border-left: 0;

			span {
				display: none;
			}

			&.active {
				transform: none;
				box-shadow: inset 4px 0 0 #2aa7a3;
			}
		}
	}

	.more-menu {
		justify-content: center;
		padding: 0 0 16px;

		button span,
		> .plus-icon {
			display: none;
		}
	}

	.plus-main {
		grid-template-rows: 70px minmax(0, 1fr);
	}

	.plus-topbar {
		padding: 0 126px 0 18px;
	}

	.status-pills {
		gap: 8px;
	}

	.status-pills .pill:not(.online) {
		display: none;
	}

	.pill {
		height: 34px;
		padding: 0 12px;
	}

	.top-actions {
		gap: 6px;

		button {
			height: 34px;
			min-width: 34px;
			padding: 0 6px;
		}

		button:first-child {
			font-size: 0;

			.plus-icon {
				margin: 0;
			}
		}
	}

	.user-chip {
		width: 34px;
		height: 34px;
	}

	.plus-content {
		padding: 8px 10px 10px;
		overflow: auto;
	}

	.plus-footer {
		display: none;
	}
}

@media (max-width: 980px) {
	.plus-shell {
		grid-template-columns: 82px minmax(0, 1fr);
	}
}
</style>

<template>
	<a-config-provider :locale="zhCN">
		<CommonEditActionDropdown
			trigger="contextMenu"
			align-point
			position="bl"
			:style="{ display: 'block' }"
		>
			<div class="row h-100 w-100 p-0 m-0">
				<div class="col p-0 m-0">
					<div class="row main h-100 w-100 p-0 m-0">
						<div class="col-12 p-0 m-0"><Title id="title" /></div>
						<div class="col-12 p-0 m-0 overflow-auto d-flex">
							<div
								:style="{ width: state.sideBarWidth + 'px' }"
								class="h-100"
							>
								<!-- 侧边栏图标 -->
								<div class="col-auto sider h-100">
									<div
										v-if="routes.find((r) => r.name === 'index')"
										:style="{
											width: state.sideBarWidth + 'px',
											flex: `0 0 ${state.sideBarWidth}px`
										}"
										class="sider-items"
									>
										<template
											v-for="(item, index) in (routes.find((r) => r.name === 'index')?.children as CustomRouteType[])"
											:key="index"
										>
											<div
												class="sider-item"
												:class="{ active: item.name === currentRoute.name }"
												@click="clickMenu(item)"
											>
												<component
													:is="store.render.setting.showSideBarText ? 'div' : Tooltip"
													style="height: 28px"
													:content="item.meta.title"
													position="right"
												>
													<Icon
														class="icon"
														:type="item.meta.icon"
														theme="outlined"
													/>
												</component>

												<div
													v-if="store.render.setting.showSideBarText"
													class="ms-2 sider-item-title text-secondary"
												>
													{{ item.meta.title }}
												</div>
											</div>
										</template>
									</div>

									<div class="text-secondary version mb-1 ms-2">{{ version }}</div>
								</div>
							</div>
							<div :style="{ width: `calc(100% - ${state.sideBarWidth}px)` }">
								<router-view v-slot="{ Component }">
									<keep-alive>
										<component :is="Component" />
									</keep-alive>
								</router-view>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- 显示当前浏览器的操作面板 -->
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

			<!-- 显示一键安装 -->
			<a-modal
				v-if="store.render.state.setup"
				:visible="true"
				:footer="false"
				:closable="false"
			>
				<template #title> 初始化软件设置 </template>
				<Setup></Setup>
			</a-modal>
		</CommonEditActionDropdown>
	</a-config-provider>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, reactive, computed } from 'vue';
import { RouteRecordRaw, useRouter } from 'vue-router';
import Title from '../components/Title.vue';
import { router, routes, CustomRouteType } from '../route';
import { store } from '../store';
import { about, changeTheme, fetchRemoteNotify, setAlwaysOnTop, setAutoLaunch } from '../utils';
import { closeAllBrowser, showClearBrowserCachesModal } from '../utils/browser';
import { remote } from '../utils/remote';
import Icon from '../components/Icon.vue';
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
import { Modal, Tooltip } from '@arco-design/web-vue';
import BrowserPanel from '../components/browsers/BrowserPanel.vue';
import { currentBrowser } from '../fs';
import { inBrowser, electron } from '../utils/node';
import { getWindowsRelease } from '../utils/os';
import cloneDeep from 'lodash/cloneDeep';
import Setup from '../components/Setup.vue';
import { activeIpcRenderListener } from '../utils/ipc';
import CommonEditActionDropdown from '../components/CommonEditActionDropdown.vue';
import BrowserPanelOperators from '../components/BrowserPanelOperators.vue';
const { ipcRenderer } = electron;

const version = ref('');

// 当前路由
const currentRoute = useRouter().currentRoute;

const state = reactive({
	sideBarWidth: computed(() => (store.render.setting.showSideBarText ? 142 : 56))
});

// 监听软件关闭
onUnmounted(() => closeAllBrowser(false));

onMounted(async () => {
	try {
		/**
		 * 开启 Ipc 通道监听
		 */

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

		/** 检测环境 */
		// @ts-ignore
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

		/** 设置版本 */
		remote.app.call('getVersion').then((v) => {
			version.value = v;
		});

		/** 初始化标题 */
		remote.win.call('setTitle', `OCS - ${router.resolve(currentRoute.value).meta.title}`);

		/** 初始化 store */
		remote.logger.call('info', 'render store init');
		setAutoLaunch();
		setAlwaysOnTop();
		changeTheme();

		/** 打开关于软件 */
		if (store.render.state.first) {
			about();
		}

		/** 监听屏幕变化 */
		onResize();
		window.addEventListener('resize', onResize);

		/** 获取最新远程通知 */
		fetchRemoteNotify(false);

		/** 检测浏览器缓存大小，超过10GB则提示 */
		remote.methods.call('statisticFolderSize', store.paths.userDataDirsFolder).then((totalSize) => {
			if (totalSize > 1024 * 1024 * 1024 * (store.render.setting.browser.cachesSizeWarningPoint ?? 10)) {
				showClearBrowserCachesModal(totalSize);
			}
		});

		/** 监听主题变化 */
		watch(
			() => cloneDeep(store.render.setting.theme),
			(cur, prev) => {
				if (cur.dark) {
					// 设置为暗黑主题
					document.body.setAttribute('arco-theme', 'dark');
				} else {
					// 恢复亮色主题
					document.body.removeAttribute('arco-theme');
				}
			}
		);

		/**
		 * 监听 store 变化，自动存储
		 */
		watch(
			store,
			async (newStore) => {
				saveStoreToLocal(newStore);
			},
			{ deep: true }
		);

		watch(() => store.window.autoLaunch, setAutoLaunch);
		watch(() => store.window.alwaysOnTop, setAlwaysOnTop);

		window.onresize = () => {
			store.render.state.height = document.documentElement.clientHeight;
		};
	} catch (e) {
		console.error(e);
	}
});

ipcRenderer.on('close', () => {
	saveStoreToLocal(store);
});

function clickMenu(route: RouteRecordRaw & { meta: { title: string } }) {
	router.push(route.path);
	remote.win.call('setTitle', `OCS - ${route.meta.title}`);
}

async function saveStoreToLocal(_store: typeof store) {
	try {
		if (inBrowser) {
			localStorage.setItem('ocs-app-store', JSON.stringify(_store));
		} else {
			const resolved_store: typeof store = JSON.parse(JSON.stringify(_store));
			// 加密
			Reflect.set(
				resolved_store,
				'render',
				await remote.methods.call('encryptString', JSON.stringify(resolved_store.render))
			);
			await remote['electron-store'].set('store', JSON.parse(JSON.stringify(resolved_store)));
		}
	} catch (e) {
		console.error(e);
	}
}

function onResize() {
	const isInMobile = document.documentElement.clientWidth < 1200;
	store.render.state.mini = isInMobile;
	store.render.state.responsive = isInMobile ? 'mini' : 'small';

	// 如果小于 700，自动隐藏侧边文字
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
.main {
	display: grid;
	grid-template-rows: 32px calc(100vh - 32px);
	grid-template-areas:
		'header'
		'main ';
}

.sider {
	-webkit-app-region: no-drag;
	user-select: none;
	padding: 4px 24px 4px 0px;
	text-align: center;
	display: flex;
	justify-content: left;
	border-right: 1px solid #f3f3f3;

	.sider-items {
		padding-top: 12px;

		.sider-item {
			padding: 8px;
			display: flex;
			cursor: pointer;
			align-items: center;
			border-left: 6px solid white;
		}
		.sider-item.active {
			background-color: #f4f9ff;
			border-left: 6px solid #1890ff;
		}

		.sider-item-title {
			font-size: 13px;
		}

		.sider-item + .sider-item {
			margin-top: 12px;
		}

		.icon {
			width: 28px;
			height: 28px;
			font-size: 28px;
			cursor: pointer;
		}
	}

	.version {
		font-size: 12px;
		position: absolute;
		bottom: 0px;
	}
}

.ant-modal-confirm .ant-modal-body {
	padding: 12px !important;
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

.app-container {
	flex: 0 0 auto;
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

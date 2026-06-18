<template>
	<div class="title ps-2">
		<span
			class="logo"
			style="cursor: pointer; -webkit-app-region: no-drag"
			@click="shell.openExternal('https://docs.ocsjs.com')"
		>
			<img
				width="18"
				class="me-3"
				src="../../public/favicon.png"
			/>
		</span>
		<a-dropdown
			class="tittle-dropdown"
			trigger="hover"
			:popup-max-height="false"
		>
			<span class="title-item"> 工具 </span>
			<template #content>
				<a-doption style="width: 200px"> </a-doption>

				<a-doption @click="store.render.state.setup = true"> <Icon type="settings">初始化设置</Icon> </a-doption>
				<a-doption
					class="border-bottom"
					@click="checkBrowserCaches"
				>
					<Icon type="delete">清除浏览器缓存</Icon>
				</a-doption>

				<a-doption @click="exportData"> <Icon type="save">导出数据</Icon> </a-doption>
				<a-doption
					class="border-bottom"
					@click="importData"
				>
					<Icon type="upload">导入数据</Icon>
				</a-doption>
				<a-doption @click="relaunch"> <Icon type="sync">重启软件</Icon> </a-doption>
				<a-doption @click="openLog"> <Icon type="folder">日志目录</Icon> </a-doption>
				<a-doption @click="openDevTools"> <Icon type="code">开发者工具</Icon> </a-doption>
			</template>
		</a-dropdown>

		<a-dropdown
			class="tittle-dropdown"
			position="bottom"
			trigger="hover"
			:popup-max-height="false"
		>
			<span class="title-item"> 帮助 </span>
			<template #content>
				<a-doption
					style="width: 200px"
					@click="about"
				>
					<Icon type="book">使用教程</Icon>
				</a-doption>
				<a-doption @click="allNotify"> <Icon type="notes">查看通知</Icon> </a-doption>

				<a-doption @click="showVersionLogs"> <Icon type="notes">更新日志</Icon> </a-doption>

				<TitleLink url="https://docs.ocsjs.com/">
					<template #title>
						<Icon type="home">软件官网</Icon>
					</template>
				</TitleLink>
			</template>
		</a-dropdown>

		<a-divider
			v-if="statusBarState.visible"
			direction="vertical"
		/>

		<StatusBar />
	</div>
</template>

<script setup lang="ts">
import { fetchRemoteNotify, date, about, getRemoteInfos } from '../utils';
import { remote } from '../utils/remote';
import TitleLink from './TitleLink.vue';
import { Message, Modal } from '@arco-design/web-vue';
import { store } from '../store/index';
import { electron } from '../utils/node';
import { currentBrowser, currentFolder, currentEntities, currentSearchedEntities } from '../fs/index';
import { Folder, root } from '../fs/folder';
import { h } from 'vue';
import { FolderOptions, FolderType } from '../fs/interface';
import { Browser } from '../fs/browser';
import { checkBrowserCaches } from '../utils/browser';
import Icon from './Icon.vue';
import StatusBar from './StatusBar.vue';
import { statusBarState } from '../utils/statusBar';

const { shell } = electron;

// 重启
function relaunch() {
	remote.app.call('relaunch');
	remote.app.call('quit');
}

// 打开日志目录
async function openLog() {
	const path = await remote.path.call('join', await remote.app.call('getPath', 'logs'), date(Date.now()));
	shell.openPath(path);
}

// 显示全部通知
function allNotify() {
	fetchRemoteNotify(true);
}

function importData() {
	remote.dialog
		.call('showOpenDialog', {
			title: '选择导入的数据文件',
			buttonLabel: '导入',
			filters: [{ extensions: ['ocsdata'], name: 'ocsdata' }]
		})
		.then(async ({ canceled, filePaths }) => {
			if (canceled === false && filePaths.length) {
				try {
					const text = await remote.fs.call('readFileSync', filePaths[0], { encoding: 'utf8' });
					const _store: typeof store = JSON.parse(text.toString());

					// 如果 render 是加密字符串，先解密为明文再导入
					if (typeof _store.render === 'string') {
						const renderStr = _store.render as string;
						const data = JSON.parse(remote.methods.callSync('decryptRenderString' as any, renderStr) as string);
						(_store as any).render = data;
					}

					const root = _store.render.browser.root;
					// 遍历文件夹，将每个浏览器的缓存路径解析为用户数据目录下的文件夹
					const folders: FolderOptions<any, Folder<FolderType> | Browser>[] = [root];
					while (folders.length) {
						const folder = folders.shift();
						if (Object.keys(folder?.children || {}).length) {
							for (const key in folder?.children) {
								if (Object.prototype.hasOwnProperty.call(folder?.children, key)) {
									const entity = folder?.children[key];
									if (entity.type === 'folder') {
										folders.push(entity);
									} else if (entity.type === 'browser' && entity.cachePath === '$CACHE_PATH') {
										entity.cachePath = await remote.path.call('join', store.paths.userDataDirsFolder, entity.uid);
									}
								}
							}
						}
					}
					// 导入 store render 数据
					store.render = _store.render;

					Modal.success({
						title: '导入成功',
						content: () =>
							h('div', [
								'数据重启软件后生效。',
								'如果您是导入其他电脑的OCS数据，请注意导入后重新初始化设置，或者自行重新安装脚本管理器。'
							]),
						okText: '重启软件',
						cancelText: '稍后重启',
						hideCancel: false,
						simple: false,
						onOk() {
							remote.app.call('relaunch');
							remote.app.call('exit', 0);
						}
					});
				} catch (err) {
					Message.error('数据有误! : ' + err);
				}
			}
		});
}
function exportData() {
	Modal.confirm({
		title: '导出数据',
		content: '数据中包含自动化脚本的配置（例如账号密码），请小心保存防止泄露。导出后可在其他电脑中恢复数据。',
		okText: '确认',
		cancelText: '取消',
		onOk() {
			remote.dialog
				.call('showSaveDialog', {
					title: '选择导出位置',
					buttonLabel: '导出',
					defaultPath: `OCS软件数据导出_-${date(Date.now())}`
				})
				.then(async ({ canceled, filePath }) => {
					if (canceled === false && filePath) {
						const _store: typeof store = JSON.parse(JSON.stringify(store));

						const root = _store.render.browser.root;
						// 遍历文件夹，将每个浏览器的缓存路径改成相对路径
						const folders: FolderOptions<any, Folder<FolderType> | Browser>[] = [root];
						while (folders.length) {
							const folder = folders.shift();
							if (Object.keys(folder?.children || {}).length) {
								for (const key in folder?.children) {
									if (Object.prototype.hasOwnProperty.call(folder?.children, key)) {
										const entity = folder?.children[key];
										if (entity.type === 'folder') {
											folders.push(entity);
										} else if (entity.type === 'browser') {
											entity.cachePath = '$CACHE_PATH';
										}
									}
								}
							}
						}

						// 导出前加密 render 数据，防止明文泄露
						if (typeof _store.render !== 'string') {
							(_store as any).render = remote.methods.callSync(
								'encryptRenderString' as any,
								JSON.stringify(_store.render)
							) as string;
						}

						// 删除多余数据
						const filter_keys: (keyof typeof _store)[] = ['paths', 'app', 'window', 'server'];
						for (const key of filter_keys) {
							delete _store[key];
						}

						await remote.fs.call('writeFileSync', filePath + '.ocsdata', JSON.stringify(_store, null, 4));
						Message.success('导出成功！');
					}
				});
		}
	});
}

function openDevTools() {
	// @ts-ignore
	window.ocs = {
		currentBrowser,
		currentEntities,
		currentFolder,
		currentSearchedEntities,
		root,
		store
	};

	remote.webContents.call('openDevTools');
}

async function showVersionLogs() {
	const infos = await getRemoteInfos();

	Modal.confirm({
		title: () => '🎉 更新日志 🎉',
		okText: '确定',
		hideCancel: true,
		simple: true,
		width: 600,
		content: () =>
			h('div', [
				h('h', [
					'可前往官网下载最新版本：',
					h(
						'a',
						{
							href: 'https://docs.ocsjs.com/docs/app',
							target: '_blank'
						},
						'https://docs.ocsjs.com/docs/app'
					)
				]),
				h(
					'div',
					{
						style: {
							maxHeight: '320px',
							overflow: 'auto'
						}
					},
					infos.versions.map((item) =>
						h('div', [
							h(
								'div',
								{
									style: {
										marginBottom: '6px',
										fontWeight: 'bold'
									}
								},
								item.tag
							),
							h(
								'ul',
								(item.description.feat || [])
									.concat(item.description.fix || [])
									.concat(item.description.other || [])
									.map((text: string) => h('li', text))
							)
						])
					)
				)
			])
	});
}
</script>

<style scoped lang="less">
.title {
	-webkit-app-region: drag;
	width: 100%;
	display: flex;
	align-items: center;
	/** 系统自带控件高度为 32 */
	height: 32px;
	cursor: default;
	border-bottom: 1px solid #f3f3f3;

	z-index: 999999;
	position: relative;
	background-color: white;

	.title-item {
		-webkit-app-region: no-drag;
		padding: 0px 8px;
		font-size: 14px;
		cursor: pointer;

		&:hover {
			background-color: #f0f0f0;
		}
	}

	> span {
		display: flex;
	}
}
:deep(.ant-dropdown-menu-item) {
	font-size: 12px;
	padding: 2px 24px 2px 12px;
}

:deep(.arco-dropdown-option-content) {
	width: 100%;
	display: block;
}

.tutorial-tooltip {
	padding: 8px 12px 0px 12px !important;
}

body.platform-darwin {
	.title {
		justify-content: center;
	}
}
</style>

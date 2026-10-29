<template>
	<div class="title ps-2">
		<span
			class="logo"
			style="cursor: pointer; -webkit-app-region: no-drag"
			@click="shell.openExternal(OCS_WEBSITE)"
		>
			<img
				width="18"
				class="me-3"
				src="../../public/favicon.png"
			/>
		</span>
		<!--
			使用 a-trigger 替代 a-dropdown：当前 arco 版本的 Dropdown 不透传
			trigger-props（mouseEnterDelay 默认 100ms 无法配置），导致 hover 展开有延迟。
			a-trigger 可直接配置 mouse-enter-delay。
			注意：不能设为 0 —— Trigger 在 delay 为 0 时不会清除挂起的关闭定时器，
			会导致鼠标移入弹窗后仍被延迟关闭；1ms 人眼无感且行为正确。
		-->
		<a-trigger
			v-model:popup-visible="toolsMenuVisible"
			class="tittle-dropdown"
			trigger="hover"
			position="bl"
			:popup-offset="4"
			:mouse-enter-delay="1"
			animation-name="slide-dynamic-origin"
			auto-fit-transform-origin
		>
			<span class="title-item"> 工具 </span>
			<template #content>
				<div
					class="arco-dropdown"
					@click="toolsMenuVisible = false"
				>
					<ul class="arco-dropdown-list">
						<a-doption
							uninject-context
							style="width: 200px"
						>
						</a-doption>
						<a-doption
							uninject-context
							class="border-bottom"
							@click="checkBrowserCaches"
						>
							<a-space size="mini"><Trash2Icon />清除浏览器缓存</a-space>
						</a-doption>

						<a-doption
							uninject-context
							@click="exportData"
						>
							<a-space size="mini"><SaveIcon />导出数据</a-space>
						</a-doption>
						<a-doption
							uninject-context
							class="border-bottom"
							@click="importData"
						>
							<a-space size="mini"><UploadIcon />导入数据</a-space>
						</a-doption>
						<a-doption
							uninject-context
							@click="relaunch"
						>
							<a-space size="mini"><RefreshCwIcon />重启软件</a-space>
						</a-doption>
						<a-doption
							uninject-context
							@click="openLog"
						>
							<a-space size="mini"><FolderIcon />日志目录</a-space>
						</a-doption>
						<a-doption
							uninject-context
							@click="openDevTools"
						>
							<a-space size="mini"><CodeIcon />开发者工具</a-space>
						</a-doption>
					</ul>
				</div>
			</template>
		</a-trigger>

		<a-trigger
			v-model:popup-visible="helpMenuVisible"
			class="tittle-dropdown"
			trigger="hover"
			position="bl"
			:popup-offset="4"
			:mouse-enter-delay="1"
			animation-name="slide-dynamic-origin"
			auto-fit-transform-origin
		>
			<span class="title-item"> 帮助 </span>
			<template #content>
				<div
					class="arco-dropdown"
					@click="helpMenuVisible = false"
				>
					<ul class="arco-dropdown-list">
						<a-doption
							uninject-context
							style="width: 200px"
							@click="about"
						>
							<a-space size="mini"><BookIcon />使用教程</a-space>
						</a-doption>
						<a-doption
							uninject-context
							@click="allNotify"
						>
							<a-space size="mini"><NotepadTextIcon />查看通知</a-space>
						</a-doption>

						<a-doption
							uninject-context
							@click="showVersionLogs"
						>
							<a-space size="mini"><NotepadTextIcon />更新日志</a-space>
						</a-doption>

						<TitleLink :url="OCS_WEBSITE + '/'">
							<template #title>
								<a-space size="mini"><HouseIcon />软件官网</a-space>
							</template>
						</TitleLink>
					</ul>
				</div>
			</template>
		</a-trigger>

		<!-- 窗口置顶按钮：绝对定位避让系统 traffic light 控制区域（mac 在左侧，其余在右上角） -->
		<PinButton />
	</div>
</template>

<script setup lang="ts">
import { h, ref } from 'vue';
import { fetchRemoteNotify, date, about, fetchChangelogMarkdown } from '../utils';
import { ensureUpdaterChangelogStyle } from '../utils/ipc';
import { marked } from 'marked';
import { remote } from '../utils/remote';
import TitleLink from './TitleLink.vue';
import { Message, Modal, InputPassword } from '@arco-design/web-vue';
import { store, devSession } from '../store/index';
import { restartAppGuarded } from '../utils/restart';
import { OCS_WEBSITE, OCS_DOWNLOAD_PAGE } from '@ocs-desktop/common/web';
import { electron } from '../utils/node';
import { currentBrowser, currentFolder, currentEntities, currentSearchedEntities } from '../fs/index';
import { Folder, root } from '../fs/folder';
import { FolderOptions, FolderType } from '../fs/interface';
import { Browser } from '../fs/browser';
import { checkBrowserCaches } from '../utils/browser';
import PinButton from './PinButton.vue';
import {
	Trash2Icon,
	SaveIcon,
	UploadIcon,
	RefreshCwIcon,
	FolderIcon,
	CodeIcon,
	BookIcon,
	NotepadTextIcon,
	HouseIcon
} from 'lucide-vue-next';

const { shell } = electron;

/** 标题栏菜单弹窗显隐（点击选项后关闭） */
const toolsMenuVisible = ref(false);
const helpMenuVisible = ref(false);

// 重启（dev 感知：pnpm dev 下提示手动重启终端，见 utils/restart.ts）
function relaunch() {
	restartAppGuarded();
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

/** 弹出密码输入框：确定返回密码（可为空字符串），取消返回 null */
function promptPassword(options: { title: string; notice: string; placeholder: string }): Promise<string | null> {
	return new Promise((resolve) => {
		const password = ref('');
		Modal.confirm({
			title: options.title,
			content: () =>
				h('div', [
					h('div', { style: 'margin-bottom: 12px; line-height: 1.6' }, options.notice),
					h(InputPassword, {
						modelValue: password.value,
						'onUpdate:modelValue': (v: string) => {
							password.value = v;
						},
						placeholder: options.placeholder,
						allowClear: true
					})
				]),
			okText: '确定',
			cancelText: '取消',
			onOk: () => resolve(password.value),
			onCancel: () => resolve(null)
		});
	});
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
						let decrypted: string;
						if (remote.methods.callSync('isPasswordEncrypted' as any, renderStr)) {
							// 密码加密的导出文件（跨机器可移植）
							const password = await promptPassword({
								title: '导入加密数据',
								notice: '该文件已使用导出密码加密，请输入导出时设置的密码。',
								placeholder: '导出密码'
							});
							if (password === null) return;
							try {
								decrypted = remote.methods.callSync('decryptExportString' as any, renderStr, password) as string;
							} catch {
								Message.error('密码错误或文件已损坏，导入失败。');
								return;
							}
						} else {
							// 本机加密格式：仅限在导出它的那台电脑上导入
							decrypted = remote.methods.callSync('decryptRenderString' as any, renderStr) as string;
							const probe = JSON.parse(decrypted);
							if (typeof probe !== 'object' || probe === null || Object.keys(probe).length === 0) {
								Message.error('该文件由其他电脑加密导出，无法在本机解密。请在原电脑上导出时设置导出密码后重新导出。');
								return;
							}
						}
						(_store as any).render = JSON.parse(decrypted);
					}

					const root = _store.render.browser.root;
					// 遍历文件夹，将每个浏览器的缓存路径解析为用户数据目录下的文件夹
					const folders: FolderOptions<any, Folder<FolderType> | Browser>[] = [root];
					while (folders.length) {
						const folder = folders.shift();
						if (!folder) continue;
						if (Object.keys(folder.children || {}).length) {
							for (const key in folder.children) {
								if (Object.prototype.hasOwnProperty.call(folder.children, key)) {
									const entity = folder.children[key];
									if (!entity) continue;
									if (entity.type === 'folder') {
										folders.push(entity as any);
									} else if (entity.type === 'browser' && (entity as any).cachePath === '$CACHE_PATH') {
										(entity as any).cachePath = await remote.path.call(
											'join',
											store.paths.userDataDirsFolder,
											entity.uid
										);
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
							restartAppGuarded('数据已导入，需重启软件后生效。');
						}
					});
				} catch (err) {
					Message.error('数据有误! : ' + err);
				}
			}
		});
}
async function exportData() {
	const password = await promptPassword({
		title: '导出数据',
		notice:
			'数据中包含自动化程序的配置（例如账号密码），请小心保存防止泄露。设置导出密码后可在其他电脑导入恢复（跨电脑必须设置密码）；留空将以明文导出。',
		placeholder: '导出密码（留空为明文导出）'
	});
	if (password === null) return;
	if (password === '') {
		const confirmed = await new Promise<boolean>((resolve) => {
			Modal.confirm({
				title: '明文导出确认',
				content: '未设置导出密码，数据将以明文保存，任何获得该文件的人都能读取其中的敏感信息。确定继续？',
				okText: '继续导出',
				cancelText: '取消',
				onOk: () => resolve(true),
				onCancel: () => resolve(false)
			});
		});
		if (!confirmed) return;
	}

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
					if (!folder) continue;
					if (Object.keys(folder.children || {}).length) {
						for (const key in folder.children) {
							if (Object.prototype.hasOwnProperty.call(folder.children, key)) {
								const entity = folder.children[key];
								if (!entity) continue;
								if (entity.type === 'folder') {
									folders.push(entity as any);
								} else if (entity.type === 'browser') {
									(entity as any).cachePath = '$CACHE_PATH';
								}
							}
						}
					}
				}

				// 导出前加密 render 数据：设置导出密码时用密码加密（跨电脑可导入），留空则明文导出
				if (password && typeof _store.render !== 'string') {
					(_store as any).render = remote.methods.callSync(
						'encryptExportString' as any,
						JSON.stringify(_store.render),
						password
					) as string;
				}

				// 删除多余数据
				const filter_keys: (keyof typeof _store)[] = ['paths', 'window', 'server'];
				for (const key of filter_keys) {
					delete _store[key];
				}

				await remote.fs.call('writeFileSync', filePath + '.ocsdata', JSON.stringify(_store, null, 4));
				Message.success('导出成功！');
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

	// 开启开发者设置子界面（会话级，重启后自动隐藏；静默开启，不弹提示）
	devSession.enabled = true;

	remote.webContents.call('openDevTools');
}

async function showVersionLogs() {
	// 与 electron-updater 同源：直接拉取更新源目录的 CHANGELOG.md（markdown 全文展示）
	let changelog = '';
	try {
		changelog = await fetchChangelogMarkdown();
	} catch (err) {
		Message.error('更新日志获取失败：' + err);
		return;
	}

	ensureUpdaterChangelogStyle();

	Modal.open({
		title: () => '🎉更新日志',
		titleAlign: 'center',
		okText: '确定',
		hideCancel: true,
		simple: false,
		width: 600,
		content: () =>
			h('div', [
				h('div', [
					'可前往官网下载最新版本：',
					h(
						'a',
						{
							href: OCS_DOWNLOAD_PAGE,
							target: '_blank'
						},
						OCS_DOWNLOAD_PAGE
					)
				]),
				h('div', {
					class: 'update-changelog-content',
					innerHTML: marked.parse(changelog || '暂无更新日志'),
					// markdown 中的链接（commit/compare 链接）统一用系统浏览器打开
					onClick: (event: MouseEvent) => {
						const anchor = (event.target as HTMLElement).closest('a');
						if (anchor) {
							event.preventDefault();
							shell.openExternal(anchor.href);
						}
					}
				})
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
	height: var(--title-height);
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
		/* mac 红绿灯控制按钮在左侧：左侧预留其区域，全部操作按钮右对齐 */
		justify-content: flex-end;
		padding-left: 84px;
		padding-right: 8px;
	}
}
</style>

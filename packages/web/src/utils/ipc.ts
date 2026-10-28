import { UpdateInformationResource } from '@ocs-desktop/common';
import { store } from '../store';
import { electron } from '../utils/node';
import { notify } from './notify';
import { Modal, Progress } from '@arco-design/web-vue';
import { h } from 'vue';
import { marked } from 'marked';
import { remote } from './remote';
const { ipcRenderer, shell } = electron;

/** 更新弹窗/更新日志弹窗的 markdown 样式（注入一次，两处共用） */
export function ensureUpdaterChangelogStyle() {
	if (document.getElementById('updater-changelog-style')) {
		return;
	}
	const style = document.createElement('style');
	style.id = 'updater-changelog-style';
	style.textContent = `
		.update-changelog-content { max-height: 50vh; overflow-y: auto; margin-top: 8px; padding-right: 6px; }
		.update-changelog-content h2 { font-size: 15px; margin: 12px 0 4px; }
		.update-changelog-content h3 { font-size: 13px; margin: 8px 0 2px; }
		.update-changelog-content ul { padding-left: 18px; margin: 4px 0; }
		.update-changelog-content li { font-size: 13px; line-height: 1.7; }
		.update-changelog-content a { color: rgb(var(--primary-6)); cursor: pointer; }
	`;
	document.head.appendChild(style);
}

export function activeIpcRenderListener() {
	/** 如果正在更新的话，获取更新进度 */
	ipcRenderer.on('update-download', (e, rate, totalLength, chunkLength) => {
		const percent = totalLength > 0 ? chunkLength / totalLength : 0;
		notify(
			'OCS更新程序',
			`更新中: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`,
			'updater',
			{
				type: 'info',
				duration: 0,
				close: false,
				// 进度文本下方展示进度条
				content: () =>
					h('div', [
						h('div', `更新中: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`),
						h(Progress, {
							percent,
							size: 'small',
							showText: false,
							style: 'margin-top: 6px;'
						})
					])
			}
		);
	});

	// 显示浏览器
	ipcRenderer.on('show-browser-in-app', (e, uid) => {
		store.render.browser.currentBrowserUid = uid;
	});

	// 检测到新版本
	ipcRenderer.on('detect-new-app-version', (e, new_version: UpdateInformationResource) => {
		console.log('detect-new-app-version', new_version);
		if (!new_version) {
			return;
		}
		ensureUpdaterChangelogStyle();

		Modal.confirm({
			title: '🎉检测到版本更新：' + new_version.tag,
			titleAlign: 'center',
			okText: '确认更新',
			cancelText: '下次一定',
			maskClosable: false,
			width: 500,
			async onOk() {
				await remote.methods.call('updateApp', new_version);
			},
			content: () =>
				h('div', [
					h('div', {
						class: 'update-changelog-content',
						innerHTML: marked.parse(new_version.markdown || '暂无更新日志'),
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
	});
}

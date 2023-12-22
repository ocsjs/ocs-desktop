import { UpdateInformationResource } from '@ocs-desktop/common';
import { store } from '../store';
import { electron } from '../utils/node';
import { closeAllBrowser } from './browser';
import { notify } from './notify';
import { Modal } from '@arco-design/web-vue';
import { h } from 'vue';
import { remote } from './remote';
const { ipcRenderer } = electron;

export function activeIpcRenderListener() {
	ipcRenderer.on('close', () => closeAllBrowser(true));

	/** 如果正在更新的话，获取更新进度 */
	ipcRenderer.on('update-download', (e, rate, totalLength, chunkLength) => {
		notify(
			'OCS更新程序',
			`更新中: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`,
			'updater',
			{
				type: 'info',
				duration: 0,
				close: false
			}
		);
	});

	// 显示浏览器
	ipcRenderer.on('show-browser-in-app', (e, uid) => {
		store.render.browser.currentBrowserUid = uid;
	});

	// 检测到新版本
	ipcRenderer.on('detect-new-app-version', (e, newVersion: UpdateInformationResource) => {
		console.log(newVersion);
		if (!newVersion) {
			return;
		}

		Modal.confirm({
			title: '🎉检测到版本更新🎉',
			okText: '确认更新',
			cancelText: '下次一定',
			maskClosable: false,
			width: 500,
			onOk() {
				remote.methods.call('updateApp', newVersion);
			},
			content: () =>
				h('div', [
					h('div', '新版本 : ✨' + newVersion.tag),
					h('div', '版本更新内容如下: '),
					h('div', [
						...(newVersion.description.feat?.length
							? [
									h('div', '新增：'),
									h(
										'ul',
										newVersion.description.feat.map((feature) => h('li', feature))
									)
							  ]
							: []),
						...(newVersion.description.fix?.length
							? [
									h('div', '修复：'),
									h(
										'ul',
										newVersion.description.fix.map((feature) => h('li', feature))
									)
							  ]
							: []),
						...(newVersion.description.other?.length
							? [
									h('div', '其他：'),
									h(
										'ul',
										newVersion.description.other.map((feature) => h('li', feature))
									)
							  ]
							: [])
					])
				])
		});
	});
}

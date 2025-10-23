import { UpdateInformationResource } from '@ocs-desktop/common';
import { store } from '../store';
import { electron } from '../utils/node';
import { notify } from './notify';
import { Modal } from '@arco-design/web-vue';
import { h } from 'vue';
import { remote } from './remote';
const { ipcRenderer } = electron;

export function activeIpcRenderListener() {
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
	ipcRenderer.on('detect-new-app-version', (e, new_version: UpdateInformationResource) => {
		console.log('detect-new-app-version', new_version);
		if (!new_version) {
			return;
		}

		Modal.confirm({
			title: '🎉检测到版本更新🎉',
			okText: '确认更新',
			cancelText: '下次一定',
			maskClosable: false,
			width: 500,
			async onOk() {
				await remote.methods.call('updateApp', new_version);
			},
			content: () =>
				h('div', [
					h('div', '新版本 : ✨' + new_version.tag),
					h('div', '版本更新内容如下: '),
					h('div', [
						...(new_version.description.feat?.length
							? [
									h('div', '新增：'),
									h(
										'ul',
										new_version.description.feat.map((feature) => h('li', feature))
									)
							  ]
							: []),
						...(new_version.description.fix?.length
							? [
									h('div', '修复：'),
									h(
										'ul',
										new_version.description.fix.map((feature) => h('li', feature))
									)
							  ]
							: []),
						...(new_version.description.other?.length
							? [
									h('div', '其他：'),
									h(
										'ul',
										new_version.description.other.map((feature) => h('li', feature))
									)
							  ]
							: [])
					])
				])
		});
	});
}

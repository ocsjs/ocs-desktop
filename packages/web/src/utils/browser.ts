import { h } from 'vue';
import { Button, Message, Modal } from '@arco-design/web-vue';
import { IconSync } from '@arco-design/web-vue/es/icon';
import { size, sleep } from '.';
import { remote } from './remote';
import { store } from '../store';
import { electron } from '../utils/node';
import { processes } from './process';
import { Folder } from '../fs/folder';
import { Browser } from '../fs/browser';
const { shell } = electron;

export async function checkBrowserCaches() {
	const modal = Modal.info({
		simple: false,
		title: '正在计算浏览器缓存...',
		footer: false,
		maskClosable: false,
		content: () => {
			return h('div', [h(IconSync, { spin: true }), '正在计算浏览器缓存...']);
		}
	});
	const totalSize = await remote.methods.call('statisticFolderSize', store.paths.userDataDirsFolder);
	console.log('当前浏览器总缓存大小', size(totalSize));
	modal.close();

	showClearBrowserCachesModal(totalSize);
}

/**
 * 手动清理浏览器缓存
 * @param totalSize 浏览器缓存总大小
 */
export function showClearBrowserCachesModal(totalSize: number) {
	// 显示详情
	Modal.confirm({
		simple: false,
		title: '清除浏览器缓存',
		content: () => {
			return h('div', [
				h('p', { class: 'text-secondary' }, [
					'提示：浏览器缓存主要存储一些Cookie，网页数据，如果占用非常大可以清除，不会影响浏览器正常使用。'
				]),
				h('p', [
					'当前浏览器缓存路径：',
					store.paths.userDataDirsFolder,
					' ',
					h(Button, { type: 'text', size: 'small', onClick: () => shell.openPath(store.paths.userDataDirsFolder) }, [
						'进入缓存文件夹'
					])
				]),
				h('p', ['当前浏览器缓存总大小：', size(totalSize)])
			]);
		},
		okText: '清除缓存',
		onOk() {
			const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === 'browser') as Browser[];

			clearAllBrowserCaches(
				store.paths.userDataDirsFolder,
				browsers.map((b) => b.uid)
			);
		}
	});
}

export function clearAllBrowserCaches(userDataDirsFolder: string, uids: string[]) {
	return new Promise<void>((resolve, reject) => {
		remote.fs.call('readdirSync', userDataDirsFolder, {} as any).then(async (_dirs) => {
			try {
				const paths = [];
				const dirs = _dirs as unknown as string[];

				for (const dir of dirs) {
					if (dir && dir.trim() && uids.includes(dir.trim())) {
						paths.push(await remote.path.call('join', userDataDirsFolder, String(dir)));
					}
				}
				await Promise.all(
					paths.map((path) => {
						return remote.fs.call('rmSync', path, {
							recursive: true,
							force: true
						});
					})
				);
			} catch (err) {
				console.error(err);
				if (String(err).includes('CrashpadMetrics.pma') === false) {
					Message.error(String(err));
					reject(err);
				}
			}

			Message.success('清除浏览器缓存完成');
			resolve();
		});
	});
}

/**
 * 强制清除浏览器缓存
 * @param title 提示弹窗
 * @param browsers 需要清除的浏览器
 */
export async function forceClearBrowserCache(title: string, userDataDirsFolder: string) {
	const modal = Modal.warning({
		title: '提示',
		content: () => h('div', [h(IconSync, { spin: true }), title]),
		maskClosable: false,
		closable: false,
		footer: false
	});

	const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === 'browser');

	await clearAllBrowserCaches(
		userDataDirsFolder,
		browsers.map((b) => b.uid)
	);

	modal.close();
}

export async function closeAllBrowser(quit: boolean) {
	if (processes.length) {
		Modal.warning({
			content: '还有浏览器正在运行，您确定关闭软件吗？',
			title: '警告',
			maskClosable: true,
			closable: true,
			alignCenter: true,
			hideCancel: false,
			onOk: async () => {
				const m = Modal.info({ content: '正在关闭所有浏览器...', closable: false, maskClosable: false, footer: false });

				const close = () => {
					if (quit) {
						remote.app.call('exit');
					}
					m.close();
				};

				// 最久5秒后关闭
				const timeout = setTimeout(close, 5000);
				try {
					for (const process of processes) {
						await process.close();
						await sleep(100);
					}
				} catch (err) {
					Message.error(String(err));
				}
				clearTimeout(timeout);
				close();
			}
		});
	} else {
		if (quit) {
			remote.app.call('exit');
		}
	}
}

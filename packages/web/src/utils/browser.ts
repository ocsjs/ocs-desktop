import { SyncOutlined } from '@ant-design/icons-vue';
import { h } from 'vue';
import { Button, Message, Modal } from '@arco-design/web-vue';
import { size } from '.';
import { remote } from './remote';
import { store } from '../store';
import { electron } from '../utils/node';
const { shell } = electron;

export async function checkBrowserCaches() {
	const modal = Modal.info({
		simple: false,
		title: '正在计算浏览器缓存...',
		footer: false,
		maskClosable: false,
		content: () => {
			return h('div', [h(SyncOutlined, { spin: true }), '正在计算浏览器缓存...']);
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
			clearAllBrowserCaches(store.paths.userDataDirsFolder);
		}
	});
}

export function clearAllBrowserCaches(userDataDirsFolder: string) {
	return new Promise<void>((resolve, reject) => {
		remote.fs.call('readdirSync', userDataDirsFolder, {} as any).then(async (dirs) => {
			try {
				const paths = [];
				console.log('dirs', dirs);
				for (const dir of dirs) {
					paths.push(await remote.path.call('join', userDataDirsFolder, String(dir)));
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
		content: () => h('div', [h(SyncOutlined, { spin: true }), title]),
		maskClosable: false,
		closable: false,
		footer: false
	});

	await clearAllBrowserCaches(userDataDirsFolder);

	modal.close();
	Message.success('配置浏览器路径成功');
}

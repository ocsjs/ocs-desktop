import { h } from 'vue';
import { store } from '../store';
import dayjs from 'dayjs';
import { Message, Modal } from '@arco-design/web-vue';
import { remote } from './remote';
import { notify } from './notify';
import { electron } from './node';
import MarkdownText from '../components/MarkdownText.vue';
import { OCSApi } from '@ocs-desktop/common/src/api';
import axios from 'axios';
import { Infos } from '@ocs-desktop/common';

const { ipcRenderer } = electron;

export function sleep(timeout: number) {
	return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * 防抖
 * @param fn 方法
 * @param period 间隔
 */
export function debounce(fn: Function, period: number) {
	let timer: number | null = null;
	return function () {
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(fn, period);
	};
}

/**
 * 检测 json 语法
 * @param jsonString json 字符串
 */
export function jsonLint(jsonString: string) {
	try {
		JSON.parse(jsonString);
	} catch (e) {
		const msg = (e as Error).message;
		const match = msg.match(/Unexpected token(.*)in JSON at position (\d+)/);
		const position = parseInt(match?.[2] || '0');
		let count = 0;
		let line = 0;
		for (const str of jsonString.split('\n')) {
			count += str.length + 1;

			if (count >= position) {
				return {
					token: match?.[1],
					line
				};
			}

			line++;
		}
	}
}

export function date(time: number) {
	return dayjs(time).format('YYYY-MM-DD');
}

export function datetime(time: number) {
	return dayjs(time).format('YYYY-MM-DD hh:mm');
}

/**
 * 获取远程通知
 * @param readAll 是否阅读全部
 */
export async function fetchRemoteNotify(readAll: boolean) {
	try {
		const infos = await getRemoteInfos();

		let remoteNotify = infos.notify;
		const storeNotify: typeof infos.notify = store.render.notifies;
		/** 寻找未阅读的通知 */
		if (!readAll) {
			remoteNotify = remoteNotify.filter(
				(item) => storeNotify.findIndex((localeItem) => item?.id === localeItem?.id) === -1
			);
		}

		if (remoteNotify.length) {
			Modal.confirm({
				title: () => '🎉最新公告🎉',
				okText: readAll ? '确定' : '朕已阅读',
				cancelText: readAll ? '取消' : '下次一定',
				hideCancel: false,
				simple: true,
				width: 600,
				content: () =>
					h(
						'div',
						{
							style: {
								maxHeight: '320px',
								overflow: 'auto'
							}
						},
						remoteNotify.map((item) =>
							h('div', [
								h(
									'div',
									{
										style: {
											marginBottom: '6px',
											fontWeight: 'bold'
										}
									},
									item?.id || '无标题'
								),
								h(
									'ul',
									item.content.map((text: string) => h('li', text))
								)
							])
						)
					),
				onOk() {
					if (!readAll) {
						store.render.notifies = [...store.render.notifies].concat(remoteNotify);
					}
				},
				onCancel() {}
			});
		}
	} catch (e) {
		Message.error('最新通知获取失败：' + e);
	}
}

/**
 * 获取远程语言文件
 */
export async function fetchRemoteLangs() {
	try {
		const infos = await axios.get('https://cdn.ocsjs.com/api/ocs-app-langs.json?t=' + Date.now(), {
			headers: {
				'content-type': 'application/json'
			}
		});

		try {
			JSON.parse(JSON.stringify(infos.data));
			store.render.langs = infos.data;
		} catch {}
	} catch (e) {
		Message.error('获取语言文件失败：' + e);
	}
}

/**
 * 获取 infos.json
 */
let temp_infos: Infos | undefined;
export async function getRemoteInfos() {
	if (temp_infos) {
		return temp_infos;
	}
	temp_infos = await OCSApi.getInfos();
	return temp_infos;
}

/** 下载文件到指定路径 */
export async function download({
	name,
	dest,
	url
}: {
	/** 显示文件名 */
	name: string;
	/** 下载路径 */
	dest: string;
	/** url */
	url: string;
}) {
	const listener = (e: any, channel: string, rate: number, chunkLength: number, totalLength: number) => {
		installListener(name, channel, rate, chunkLength, totalLength);
	};

	// 监听下载进度
	ipcRenderer.on('download', listener);
	try {
		// 下载
		return await remote.methods.call('download', 'download-file-' + name, url, dest);
	} catch (err) {
		// @ts-ignore
		Message.error('下载错误 ' + err.message);
	}
	ipcRenderer.removeListener('download', listener);
}

function installListener(name: string, channel: string, rate: number, chunkLength: number, totalLength: number) {
	if (channel === 'download-file-' + name) {
		if (rate === 100) {
			return notify(
				'文件下载',
				`${name} 下载完成: ${(totalLength / 1024 / 1024).toFixed(2)}MB`,
				'download-file-' + name,
				{
					type: 'success',
					duration: 0
				}
			);
		} else {
			return notify(
				'文件下载',
				`${name} 下载中: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`,
				'download-file-' + name,
				{
					type: 'info',
					duration: 0
				}
			);
		}
	}
}

/** 显示关于软件说明 */
export async function about() {
	store.render.state.first = false;
	const guide = await remote.methods.call('get', 'https://cdn.ocsjs.com/articles/app/guide.md');
	Modal.info({
		title: '软件使用教程',
		closable: true,
		simple: false,
		maskClosable: false,
		footer: false,
		width: 'auto',
		bodyStyle: {
			maxWidth: '800px'
		},
		content: () =>
			h(MarkdownText, {
				content: guide,
				style: {
					maxHeight: '70vh'
				}
			})
	});
}

export async function changeTheme() {
	const platform = await remote.methods.call('getPlatform');
	document.body.classList.add('platform-' + platform);
	if (platform !== 'darwin') {
		if (store.render.setting.theme.dark) {
			// 设置为暗黑主题
			document.body.setAttribute('arco-theme', 'dark');
			remote.win.call('setTitleBarOverlay', {
				color: '#2C2C2C',
				symbolColor: 'white'
			});
		} else {
			// 恢复亮色主题
			document.body.removeAttribute('arco-theme');
			remote.win.call('setTitleBarOverlay', {
				color: '#fff',
				symbolColor: 'black'
			});
		}
	}
}

export function setAutoLaunch() {
	remote.methods.call('autoLaunch');
}

export function setAlwaysOnTop() {
	remote.win.call('setAlwaysOnTop', store.window.alwaysOnTop);
}

export function size(num: number) {
	return (
		(
			[
				['GB', Math.pow(1024, 3)],
				['MB', Math.pow(1024, 2)],
				['KB', Math.pow(1024, 1)],
				['B', 1]
			] as [string, number][]
		)
			.map((i) => [i[0], Math.floor(num / i[1])])
			.find((i) => parseFloat(i[1].toString()) > 0)
			// @ts-ignore
			?.reduce((pre, cur) => cur + pre)
	);
}

export function errorFilter(str: string) {
	// arco design 问题，暂时无需处理，复现方式，鼠标重复经过 tooltip 或者 dropdown ， 打开 modal 都会出现
	if (str.includes('ResizeObserver loop limit exceeded')) {
		return true;
	}
	//  operation not permitted, stat xxxxx CrashpadMetrics.pma ， 这个是 playwright 问题，暂时无需处理
	if (str.includes('CrashpadMetrics')) {
		return true;
	}
}

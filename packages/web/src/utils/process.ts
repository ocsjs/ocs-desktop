import { ChildProcess } from 'child_process';
import { remote } from './remote';
import { store } from '../store';
import { LaunchOptions } from 'playwright-core';
import { h, reactive } from 'vue';
import type { ScriptWorker } from '@ocs-desktop/app';
import { Browser } from '../fs/browser';
import { Message, Modal } from '@arco-design/web-vue';
import EventEmitter from 'events';
import { child_process } from './node';
import { notify } from './notify';

export type RemoteScriptWorker = <W extends keyof ScriptWorker = keyof ScriptWorker>(
	event: W,
	...args: ScriptWorker[W] extends { (...args: any[]): any } ? Parameters<ScriptWorker[W]> : any[]
) => void;

/**
 * 运行进程
 */
export class Process extends EventEmitter {
	uid: string;
	shell?: ChildProcess;
	worker?: RemoteScriptWorker;
	/** 状态 */
	status: 'closed' | 'closing' | 'launching' | 'launched' = 'closed';
	/** 浏览器实体信息 */
	browser: Browser;
	/** 浏览器启动参数 */
	launchOptions: Required<LaunchOptions>;
	/** 输出 */
	logs: string[] = [];

	video: HTMLVideoElement | undefined = undefined;
	stream: MediaStream | undefined = undefined;

	static from(uid: string) {
		return processes.find((p) => p.uid === uid);
	}

	// 从进程列表中移除
	static remove(uid: string) {
		const index = processes.findIndex((p) => p.uid === uid);
		if (index !== -1) {
			processes.splice(index, 1);
		}
	}

	constructor(browser: Browser, launchOptions: LaunchOptions) {
		super();
		this.browser = browser;
		this.uid = browser.uid;
		this.launchOptions = launchOptions as any;
	}

	/**
	 * 使用 child_process 运行 ocs 命令
	 */
	async init(onConsole?: (data: any) => void) {
		this.shell = child_process.fork(
			await remote.path.call('join', await remote.app.call('getAppPath'), './script.js'),
			{
				stdio: ['ipc'],
				env: process.env
			}
		);
		this.worker = createRemoteScriptWorker(this.shell);

		this.shell.stdout?.on('data', (data: any) => {
			this.logs.push(data.toString());
			onConsole?.(data.toString());
		});
		this.shell.stderr?.on('data', (data: any) => {
			handleError(data.toString());
			onConsole?.(data.toString());
			remote.logger.call('error', String(data));
			this.logs.push(`${this.browser.name} 错误`, data);
			notify(`${this.browser.name} 错误`, data, this.browser.uid, {
				duration: 60 * 1000,
				copy: true,
				type: 'error'
			});
		});

		/** 监听器 */
		const listeners: Record<string, (...args: any[]) => void> = {
			/** 浏览器启动 */
			launched: async () => {
				this.status = 'launched';
			},
			/**
			 * 浏览器关闭
			 * 可以由 browser.close() 关闭
			 * 或者进程主动触发
			 */
			'browser-closed': () => {
				console.log('browser-closed', this.uid);
				// 从进程列表中移除
				Process.remove(this.uid);
			}
		};

		this.shell.on('message', ({ event, args }: { event: string; args: any[] }) => {
			// 将 shell 的事件共享到当前的对象
			this.emit(event, ...args);
			if (listeners[event]) {
				listeners[event](...args);
			}
		});

		// 初始化进程数据
		this.worker('init', {
			store,
			cachePath: this.browser.cachePath,
			uid: this.uid,
			playwrightScripts: this.browser.playwrightScripts,
			browserInfo: {
				name: this.browser.name,
				notes: this.browser.notes,
				tags: this.browser.tags
			},
			config: {
				enable_dialog: store.render.setting.browser.enableDialog,
				force_update_script: store.render.setting.browser.forceUpdateScript
			}
		});
	}

	/** 启动文件 */
	launch() {
		return new Promise<void>((resolve, reject) => {
			// 检查
			if (!this.launchOptions.executablePath) {
				return Message.error('浏览器路径为空，请在软件设置中修改');
			}

			remote.fs
				.call('existsSync', this.launchOptions.executablePath)
				.then(async (result) => {
					if (result) {
						const enabledUserScripts = store.render.scripts.filter((s) => s.enable);
						for (const s of enabledUserScripts) {
							if (!s.url.startsWith('http')) {
								const res = await remote.fs.call('existsSync', s.url);
								if (!res) {
									Message.error({
										content: `本地脚本 ${s.info?.name}：(${s.url})\n不存在，请检查脚本路径`,
										duration: 10 * 1000
									});
									return;
								}
							}
						}

						this.status = 'launching';

						this.once('launched', resolve);
						this.worker?.('launch', {
							userDataDir: this.browser.cachePath,
							userscripts: enabledUserScripts.map((s) => s.url),
							...this.launchOptions
						});
					} else {
						Message.error('浏览器路径不存在，请在软件设置中修改');
					}
				})
				.catch((err) => {
					Message.error('浏览器路径读取错误 : ', err);
				});
		});
	}

	/** 关闭进程 */
	async close() {
		// 标记为 closing ，使监控页面，以及操作栏的图标可以判断状态
		this.status = 'closing';
		return new Promise<void>((resolve) => {
			this.once('browser-closed', resolve);
			// 关闭进程
			this.worker?.('close');
		});
	}

	/** 显示当前的浏览器  */
	bringToFront() {
		if (this.status === 'launched' && this.launchOptions) {
			const action = `http://localhost:${store.server.port}/ocs-action_bring-to-top`;
			child_process.exec(
				`"${this.launchOptions.executablePath}" --user-data-dir="${this.browser.cachePath}" "${action}"`
			);
			this.worker?.('bringToFront');
			Message.warning('已置顶，如未生效，电脑底部任务栏闪烁的浏览器图标即为置顶浏览器。');
		} else {
			Message.warning('必须先启动文件');
		}
	}

	toString() {
		return '[Process]';
	}
}

export const processes: Process[] = reactive([]);

/**
 * 创建  ScriptWorker Shell 调用 APi
 * @param shell
 */
function createRemoteScriptWorker(shell: ChildProcess) {
	return <W extends keyof ScriptWorker, F extends ScriptWorker[W]>(
		event: W,
		...args: F extends { (...args: any[]): any } ? Parameters<F> : any[]
	) => {
		if (shell.connected) {
			shell.send({ event, args });
		}
	};
}

function handleError(msg: string) {
	if (msg.includes('异常启动') && msg.includes('更换其他浏览器')) {
		// 2025年Edge与playwright不兼容问题
		if (
			!store.render.state.read_record?.['edge-2025-open-error-issue'] &&
			store.render.setting.launchOptions.executablePath.includes('msedge')
		) {
			const issue_link =
				'https://docs.ocsjs.com/docs/issues/2025/#%E5%85%B3%E4%BA%8E%E8%BD%AF%E4%BB%B6%E6%98%BE%E7%A4%BA%E5%BC%82%E5%B8%B8%E5%85%B3%E9%97%AD';
			Modal.warning({
				title: '提示',
				maskClosable: false,
				closable: true,
				width: 600,
				okText: '不再提示',
				content: () =>
					h('div', [
						h('div', [
							'关于浏览器异常关闭，检测到您使用的是 Edge（微软） 浏览器，可能会导致无法启动浏览器，解决方法：',
							'1. 尝试重装OCS软件',
							'2. 尝试更换谷歌浏览器进行使用！'
						]),
						h('div', ['关于Edge异常关闭问题详情：', h('a', { href: issue_link }, issue_link)])
					]),
				onOk() {
					store.render.state.read_record = store.render.state.read_record || {};
					store.render.state.read_record['edge-2025-open-error-issue'] = true;
				}
			});
		}
	}
}

import { ChildProcess } from 'child_process';
import { remote } from './remote';
import { t, store } from '../store';
import { LaunchOptions } from 'playwright-core';
import { reactive, h } from 'vue';
import type { ScriptWorker, ScreencastPageInfo, ScreencastPagesChangedPayload } from '@ocs-desktop/common/web';
import { DEFAULT_SERVER_PORT } from '@ocs-desktop/common/web';
import { Browser } from '../fs/browser';
import { Message, Button } from '@arco-design/web-vue';
import EventEmitter from 'events';
import { child_process, electron } from './node';
import { notify } from './notify';
import { Status } from './statusBar';
import { filterScriptsNeedingInstall, ScriptToInstall } from './script-version';

/** 用户脚本安装结果（由 worker 回传） */
interface InstallResult {
	url: string;
	success: boolean;
	reason?: string;
}

export type RemoteScriptWorker = <W extends keyof ScriptWorker = keyof ScriptWorker>(
	event: W,
	...args: ScriptWorker[W] extends { (...args: any[]): any } ? Parameters<ScriptWorker[W]> : any[]
) => void;

/** 浏览器关闭后保留的最后一帧预览图（uid -> Blob URL），由界面层决定是否展示 */
export const closedPreviews: Map<string, string> = reactive(new Map());

/** base64 -> Blob URL */
function base64ToBlobUrl(base64: string): string {
	const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
}

/** 预览帧持久化目录（userData/previews），首次访问时创建 */
let _previewFolderPromise: Promise<string> | undefined;
function previewFolder(): Promise<string> {
	_previewFolderPromise ??= (async () => {
		const dir = await remote.path.call('join', store.paths['user-data-path'], 'previews');
		if (!(await remote.fs.call('existsSync', dir))) {
			await remote.fs.call('mkdirSync', dir, { recursive: true });
		}
		return dir;
	})();
	return _previewFolderPromise;
}

/** 将预览帧持久化到磁盘（uid.jpg），静默容错 */
export async function persistPreviewFrame(uid: string, base64: string) {
	try {
		const file = await remote.path.call('join', await previewFolder(), `${uid}.jpg`);
		await remote.fs.call('writeFileSync', file, base64, 'base64');
	} catch (err) {
		console.warn('[preview] 预览帧持久化失败：', err);
	}
}

/** 删除磁盘上持久化的预览帧，静默容错 */
export async function deletePersistedPreviewFrame(uid: string) {
	try {
		const file = await remote.path.call('join', await previewFolder(), `${uid}.jpg`);
		if (await remote.fs.call('existsSync', file)) {
			await remote.fs.call('rmSync', file, { force: true });
		}
	} catch (err) {
		console.warn('[preview] 删除持久化预览帧失败：', err);
	}
}

/**
 * 从磁盘恢复"浏览器关闭后的预览图"（应用重启后由界面层调用一次）。
 * 跳过正在运行或已有内存帧的浏览器。
 */
let _closedPreviewsRestored = false;
export async function restoreClosedPreviews(browsers: { uid: string }[]) {
	if (_closedPreviewsRestored) return;
	_closedPreviewsRestored = true;
	try {
		const dir = await previewFolder();
		for (const b of browsers) {
			if (Process.isRunning(b.uid) || closedPreviews.has(b.uid)) continue;
			try {
				const file = await remote.path.call('join', dir, `${b.uid}.jpg`);
				if (!(await remote.fs.call('existsSync', file))) continue;
				const base64 = (await remote.fs.call('readFileSync', file, 'base64')) as string;
				if (base64) {
					closedPreviews.set(b.uid, base64ToBlobUrl(base64));
				}
			} catch {
				// 单个文件损坏不影响其他浏览器恢复
			}
		}
	} catch (err) {
		console.warn('[preview] 恢复关闭预览图失败：', err);
	}
}

/** 清理浏览器关闭后保留的预览图（重新启动/删除浏览器时调用），同步删除磁盘帧 */
export function clearClosedPreview(uid: string) {
	const url = closedPreviews.get(uid);
	if (url) {
		URL.revokeObjectURL(url);
		closedPreviews.delete(uid);
	}
	deletePersistedPreviewFrame(uid);
}

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
	/** 输出（仅保留最近 MAX_LOGS 条，避免长时运行日志无限增长造成渲染进程内存泄漏） */
	logs: string[] = [];

	/** 追加日志并截断到上限 */
	private appendLog(...items: string[]) {
		this.logs.push(...items);
		if (this.logs.length > Process.MAX_LOGS) {
			this.logs.splice(0, this.logs.length - Process.MAX_LOGS);
		}
	}

	/** 日志保留上限（超过后丢弃最早的条目） */
	private static readonly MAX_LOGS = 500;

	/** 当前预览帧的 Blob URL（由 worker screencast 推流更新） */
	frameUrl: string = '';
	/** 当前浏览器全部可推流页面（worker pages-changed 事件实时更新） */
	pages: ScreencastPageInfo[] = [];
	/** 当前推流目标页 URL（worker pages-changed 事件实时更新） */
	screencastPageUrl: string = '';
	/** 上一帧 Blob URL，用于更新前 revoke 避免内存泄漏 */
	private _blobUrl: string = '';
	/** 最近一帧的 base64（用于关闭时最终落盘） */
	private _lastFrameBase64: string = '';
	/** 帧持久化节流：上次落盘时间 / 是否正在落盘 */
	private _lastPersistAt = 0;
	private _persisting = false;

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

	/**
	 * 进程是否仍在运行（存在于响应式 processes 数组中）。
	 * Process.remove 用 splice 移除后，Process.from 仍返回失效引用（status 滞留 'launched'），
	 * 用户直接关闭浏览器窗口时会导致界面误判仍在运行（显示"置顶"而非"启动"）。
	 * 判断"是否运行中"请统一使用此方法，而非 Process.from(uid) !== undefined。
	 */
	static isRunning(uid: string): boolean {
		return processes.some((p) => p.uid === uid);
	}

	/** 仅当进程仍在运行时返回其引用，否则 undefined（替代 Process.from 用于运行状态判定） */
	static fromRunning(uid: string): Process | undefined {
		return Process.isRunning(uid) ? Process.from(uid) : undefined;
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
			await remote.path.call('join', await remote.app.call('getAppPath'), './out/main/script.js'),
			{
				stdio: ['ipc'],
				env: process.env
			}
		);
		this.worker = createRemoteScriptWorker(this.shell);

		this.shell.stdout?.on('data', (data: any) => {
			this.appendLog(data.toString());
			onConsole?.(data.toString());
		});
		this.shell.stderr?.on('data', (data: any) => {
			onConsole?.(data.toString());
			remote.logger.call('error', String(data));
			this.appendLog(`${this.browser.name} 错误`, data);
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
			/** 预览帧到达（worker screencast 推流，base64 直传） */
			'screencast-frame': (_uid: string, base64: string) => {
				this.setFrame(base64);
			},
			/** 预览清理 */
			'screencast-cleared': () => {
				this.clearFrame();
			},
			/** 页面列表变化（worker 实时广播，驱动"切换页面"弹窗） */
			'pages-changed': (_uid: string, payload: ScreencastPagesChangedPayload) => {
				this.pages = payload?.pages || [];
				this.screencastPageUrl = payload?.current || '';
			},
			/** 网页下载完成（worker 监听下载目录实时回传） */
			'file-downloaded': (_uid: string, file: { filename: string; path: string }) => {
				if (!file?.path) return;
				notify('文件下载完成', `文件 ${file.filename} 已下载到"文件下载"目录：\n${file.path}`, 'file-downloaded-' + file.path, {
					duration: 30 * 1000,
					type: 'success',
					btn: h(
						Button,
						{
							type: 'primary',
							size: 'small',
							onClick: () => electron.shell.showItemInFolder(file.path)
						},
						'打开所在文件夹'
					)
				});
			},
			/**
			 * 浏览器关闭
			 * 可以由 browser.close() 关闭
			 * 或者进程主动触发
			 */
			'browser-closed': () => {
				console.log('browser-closed', this.uid);
				// 启动失败时 worker 会统一走 close() 发回 browser-closed：
				// 若状态仍停留在 launching，回落为 closed，解除卡片一直转圈的状态
				if (this.status === 'launching') {
					this.status = 'closed';
				}
				// 开启预览图显示时，保留最后一帧作为"浏览器关闭后的预览图"，由界面层展示/关闭
				if (store.render.setting.browser.screenshotPreview && this.frameUrl) {
					closedPreviews.set(this.uid, this.frameUrl);
					this._blobUrl = ''; // 转移 Blob URL 所有权，防止下方 clearFrame 回收
					// 最终帧立即落盘（不受节流限制），软件重启后可恢复
					if (this._lastFrameBase64) {
						persistPreviewFrame(this.uid, this._lastFrameBase64);
					}
				}
				this.clearFrame();
				this.pages = [];
				this.screencastPageUrl = '';
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
			automationScripts: this.browser.automationScripts,
			browserInfo: {
				name: this.browser.name,
				notes: this.browser.notes,
				tags: this.browser.tags
			},
			config: {
				enable_dialog: store.render.setting.browser.enableDialog,
				screenshot_preview: store.render.setting.browser.screenshotPreview,
				browser_enhancement: store.render.setting.browser.browserEnhancement
			},
			langs: store.render.langs as any
		});
	}

	async launchPreCheck() {
		// 检查
		if (!this.launchOptions.executablePath) {
			Message.error('浏览器路径为空，请在软件设置中修改');
			return;
		}

		try {
			const exists = await remote.fs.call('existsSync', this.launchOptions.executablePath);
			if (!exists) {
				Message.error('浏览器路径不存在，请在软件设置中修改');
				return;
			}

			// 脚本检查
			Status.loading('正在检查本地脚本...');
			const enabledUserScripts = store.render.scripts.filter((s) => s.enable);
			for (const s of enabledUserScripts) {
				if (!s.url.startsWith('http')) {
					const res = await remote.fs.call('existsSync', s.info?.code_url || s.url);
					if (!res) {
						notify(
							'本地脚本不存在',
							t('error_when_script_not_found', `本地脚本 ${s.info?.name}：(${s.url})\n不存在，请检查脚本路径`, {
								name: s.info?.name || '',
								url: s.url
							}),
							'process_launch_error_' + s.url,
							{
								duration: 60 * 1000,
								type: 'warning',
								copy: true
							}
						);
					}
				}
			}

			Status.loading('正在检查脚本更新...');
			const scriptsToInstall = await filterScriptsNeedingInstall(enabledUserScripts);
			if (scriptsToInstall.length > 0) {
				Status.loading(`正在启动 ${this.browser.name}（需更新/安装 ${scriptsToInstall.length} 个脚本）...`);
			} else {
				Status.loading(`正在启动 ${this.browser.name}（脚本均为最新，无需更新）...`);
			}
			// 预下载远程脚本 + 构造安装 URL（远程脚本经本地服务器代理，规避网络波动）
			const port = store.server.port || DEFAULT_SERVER_PORT;
			const userscripts: string[] = [];
			const urlToItem = new Map<string, ScriptToInstall>();
			for (const item of scriptsToInstall) {
				const script = item.script;
				if (script.isLocalScript) {
					// 本地脚本：直接通过本地服务器代理（拓展只能拦截 http/https）
					const localPath = script.info?.code_url || script.url;
					const installUrl = `http://localhost:${port}/api/local-userscript?path=${encodeURIComponent(localPath)}`;
					userscripts.push(installUrl);
					urlToItem.set(installUrl, item);
				} else {
					// 远程脚本：主进程预下载到临时文件，再经本地服务器代理给拓展拦截
					const remoteUrl = script.info?.code_url || script.url;
					Status.loading(`正在下载脚本 ${script.info?.name || remoteUrl} ...`);
					const results = await remote.methods.call('downloadUserscripts', [remoteUrl]);
					const r = results?.[0];
					if (r && r.success && r.path) {
						const installUrl = `http://localhost:${port}/api/local-userscript?path=${encodeURIComponent(r.path)}`;
						userscripts.push(installUrl);
						urlToItem.set(installUrl, item);
					} else {
						// 预下载失败：剔除并通知，不更新 lastInstalledVersion（下次重试）
						notify(
							'脚本下载失败',
							`${script.info?.name || remoteUrl} 下载失败：${r?.error || '未知原因'}，本次跳过，下次启动将重试`,
							'download-fail-' + remoteUrl,
							{ duration: 60 * 1000, type: 'warning', copy: true }
						);
					}
				}
			}

			// 接收 worker 回传的安装结果，按成功情况更新 lastInstalledVersion
			this.once('userscript-install-result', (results: InstallResult[]) => {
				for (const r of results || []) {
					const item = urlToItem.get(r.url);
					if (!item) continue;
					if (r.success) {
						item.script.lastInstalledVersion = item.latestVersion;
					} else {
						notify(
							'脚本安装失败',
							`${item.script.info?.name || r.url} 安装失败：${r.reason || ''}，下次启动将重试`,
							'install-fail-' + r.url,
							{ duration: 60 * 1000, type: 'warning', copy: true }
						);
					}
				}
				Status.clear();
			});
			this.shell?.once('exit', () => {
				Status.clear();
			});
			return { userscripts, enabledScriptCount: enabledUserScripts.length };
		} catch (err) {
			Message.error('浏览器路径读取错误 : ' + String(err));
		}
	}

	/** 启动文件 */
	launch() {
		return new Promise<void | number | null>((resolve, reject) => {
			this.status = 'launching';
			// 重新启动：清理此前浏览器关闭时保留的预览图
			clearClosedPreview(this.uid);
			this.launchPreCheck()
				.then((result) => {
					if (result) {
						this.once('launched', () => {
							resolve();
						});
						// 启动失败：worker 统一走 close() 发回 browser-closed 并退出进程，
						// 此处通过 browser-closed/shell exit 使 Promise 得以 settle，不再悬挂
						this.once('browser-closed', () => {
							resolve(null);
						});
						this.shell?.once('exit', (code) => {
							resolve(code);
						});
						this.worker?.('launch', {
							userDataDir: this.browser.cachePath,
							enabledScriptCount: result.enabledScriptCount,
							userscripts: result.userscripts,
							...this.launchOptions
						});
					} else {
						// launchPreCheck 失败（路径为空/不存在/读取错误等）：状态回落，Promise 结束
						this.status = 'closed';
						resolve(null);
					}
				})
				.catch((err) => {
					this.status = 'closed';
					reject(err);
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

	/**
	 * 设置截图预览（Page.startScreencast）启停，由卡片可见性驱动调用。
	 * 仅在已启动时生效；不可见时暂停推流释放资源，但保留最后一帧，
	 * 重新可见时立即显示旧帧占位，新帧到达后无缝衔接，避免重新等待。
	 */
	setScreencastActive(
		active: boolean,
		opts?: { everyNthFrame?: number; maxWidth?: number; maxHeight?: number; quality?: number }
	) {
		if (this.status !== 'launched') return;
		if (active) {
			this.worker?.('startScreencast', opts);
		} else {
			this.worker?.('pauseScreencast');
		}
	}

	/** 切换预览推流到指定 URL 的页面（用户在"切换页面"弹窗中选择） */
	switchScreencastPage(url: string) {
		if (this.status !== 'launched') return;
		this.worker?.('switchScreencastPage', url);
	}

	/**
	 * 设置预览帧：base64 -> Blob URL，更新前 revoke 上一帧避免内存泄漏。
	 * 同时节流（2s）持久化到磁盘，保证软件整体退出后重启仍能恢复最后一帧。
	 */
	setFrame(base64: string) {
		if (this._blobUrl) URL.revokeObjectURL(this._blobUrl);
		this._blobUrl = base64ToBlobUrl(base64);
		this.frameUrl = this._blobUrl;
		this._lastFrameBase64 = base64;
		this.persistFrameThrottled();
	}

	/** 节流落盘：推流期间最多每 2s 写一次，静默容错 */
	private persistFrameThrottled() {
		const now = Date.now();
		if (this._persisting || now - this._lastPersistAt < 2000) return;
		this._persisting = true;
		this._lastPersistAt = now;
		persistPreviewFrame(this.uid, this._lastFrameBase64).finally(() => {
			this._persisting = false;
		});
	}

	/** 清理预览帧 */
	clearFrame() {
		if (this._blobUrl) {
			URL.revokeObjectURL(this._blobUrl);
			this._blobUrl = '';
		}
		this.frameUrl = '';
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

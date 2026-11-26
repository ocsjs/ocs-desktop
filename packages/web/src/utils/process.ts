import { bridge } from './bridge';
import { store, uiSession } from '../store';
import { router } from '../route';
import { t } from './langs';
import { LaunchOptions } from 'playwright-core';
import { reactive, h } from 'vue';
import type { ScriptWorker, ScreencastPageInfo, ScreencastPagesChangedPayload } from '@ocs-desktop/common/web';
import { DEFAULT_SERVER_PORT } from '@ocs-desktop/common/web';
import { Browser } from '../fs/browser';
import { Message, Button, Notification } from '@arco-design/web-vue';
import EventEmitter from 'events';
import { onRendererEvent } from './ipc';

import { notify } from './notify';
import { Status } from './statusBar';
import { filterScriptsNeedingInstall, ScriptToInstall } from './script-version';
import { notifyOcrMissingAfterLaunch, promptOcrChoiceBeforeLaunch } from './ocr';
import { detectWeakNetwork } from './index';
// NOTE: browser-repair 模块（启动失败复检/修复引导）尚未提交，此处引用暂移除以恢复 CI；
// 待 chrome-integrity 功能整体落地时恢复（import + browser-closed 内的复检调用）。
import { ensureEnvironmentReady } from './env-bootstrap';
import { checkLaunchCapacity, warnLaunchBlocked } from './launch-check';

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
		const dir = await bridge.path.join(store.paths['user-data-path'], 'previews');
		if (!(await bridge.fs.existsSync(dir))) {
			await bridge.fs.mkdirSync(dir, { recursive: true });
		}
		return dir;
	})();
	return _previewFolderPromise;
}

/** 将预览帧持久化到磁盘（uid.jpg），静默容错 */
export async function persistPreviewFrame(uid: string, base64: string) {
	try {
		const file = await bridge.path.join(await previewFolder(), `${uid}.jpg`);
		await bridge.fs.writeFileSync(file, base64, 'base64');
	} catch (err) {
		console.warn('[preview] 预览帧持久化失败：', err);
	}
}

/** 删除磁盘上持久化的预览帧，静默容错 */
export async function deletePersistedPreviewFrame(uid: string) {
	try {
		const file = await bridge.path.join(await previewFolder(), `${uid}.jpg`);
		if (await bridge.fs.existsSync(file)) {
			await bridge.fs.rmSync(file, { force: true });
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
				const file = await bridge.path.join(dir, `${b.uid}.jpg`);
				if (!(await bridge.fs.existsSync(file))) continue;
				const base64 = (await bridge.fs.readFileSync(file, 'base64')) as string;
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
	/** worker 事件订阅的取消函数（主进程转发 'script-worker' 频道） */
	private _offWorkerEvent?: () => void;
	worker?: RemoteScriptWorker;
	/** 当前 worker 的进程 pid（scriptWorkerLaunch 返回；关闭兜底代际校验用） */
	workerPid?: number;
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

	/** 追加外部来源日志（渲染端 console/全局错误转发用），并实时推送到日志面板 */
	appendExternalLog(text: string) {
		this.appendLog(text);
		this.emit('console', text);
	}

	/** 日志保留上限（超过后丢弃最早的条目） */
	private static readonly MAX_LOGS = 500;

	/** 当前预览帧的 Blob URL（由 worker screencast 推流更新） */
	frameUrl: string = '';
	/** 当前浏览器全部可推流页面（worker pages-changed 事件实时更新） */
	pages: ScreencastPageInfo[] = [];
	/** 当前推流目标页 URL（worker pages-changed 事件实时更新） */
	screencastPageUrl: string = '';
	/** 浏览器实例真实内存占用 MB（worker 定时上报 memory-usage 事件更新，0 = 暂无数据） */
	memoryUsageMB: number = 0;
	/** 浏览器实例 CPU 占用率 %（worker 同事件上报，多核并行可超 100%，0 = 暂无数据） */
	cpuPercent: number = 0;
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
	 * 启动 ScriptWorker（主进程 utilityProcess 托管 fork）并建立事件转发订阅
	 */
	async init(onConsole?: (data: any) => void) {
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
			/** 资源占用上报（worker 每 10s 推送，启动预检测/资源监控浮层使用真实值替代估算） */
			'memory-usage': (_uid: string, payload: { mb: number; cpuPercent: number }) => {
				if (payload && typeof payload.mb === 'number' && payload.mb > 0) {
					this.memoryUsageMB = payload.mb;
					this.cpuPercent = typeof payload.cpuPercent === 'number' ? payload.cpuPercent : 0;
				}
			},
			/** 检测到 CRX 拓展安装包：自动化浏览器无法直接安装，引导前往应用中心查看加载方法 */
			'crx-detected': (_uid: string, filename: string) => {
				notify(
					'检测到拓展安装包',
					`${this.browser.name}：自动化浏览器无法直接安装拓展（${filename}），需通过其他方式加载。`,
					'crx-detected-' + filename,
					{
						duration: 30 * 1000,
						type: 'warning',
						btn: h(
							Button,
							{
								type: 'primary',
								size: 'small',
								onClick: () => {
									Notification.remove('crx-detected-' + filename);
									router.push('/setting');
									setTimeout(() => {
										uiSession.appCenterGuide = true;
									}, 200);
								}
							},
							'如何加载其他拓展？'
						)
					}
				);
			},
			/** OCR 手动模式：检测到验证码时提示人工干预（worker 已节流 15s） */
			'ocr-manual-captcha': () => {
				notify(
					'检测到验证码',
					`${this.browser.name}：检测到验证码，请人工干预（手动模式已开启，不再自动识别）。`,
					'ocr-manual-' + this.uid,
					{ duration: 10 * 1000, type: 'warning' }
				);
			},
			/** 脚本管理器拓展验证失败（两轮检测均无 SW）：浏览器可用但脚本功能缺失，提示用户 */
			'extension-verify-failed': () => {
				notify(
					'脚本管理器未加载',
					`${this.browser.name}：未检测到脚本管理器拓展运行，浏览器已启动但脚本功能不可用。可尝试重启浏览器，或前往「应用中心」重新安装脚本管理器。`,
					'ext-verify-failed-' + this.uid,
					{ duration: 60 * 1000, copy: true, type: 'warning' }
				);
			},
			/** 扩展 SW 存在但未匹配脚本管理器（ID 推导不一致，降级放行并提示） */
			'extension-verify-degraded': (_uid: string, urls: string[]) => {
				notify(
					'脚本管理器状态存疑',
					`${this.browser.name}：检测到扩展运行，但未能确认脚本管理器已加载，脚本功能可能失效。${(urls || []).join(
						'、'
					)}`,
					'ext-verify-degraded-' + this.uid,
					{ duration: 60 * 1000, copy: true, type: 'warning' }
				);
			},
			/** 网页下载完成（worker 监听下载目录实时回传） */
			'file-downloaded': (_uid: string, file: { filename: string; path: string }) => {
				if (!file?.path) return;
				notify(
					'文件下载完成',
					`文件 ${file.filename} 已下载到"文件下载"目录：\n${file.path}`,
					'file-downloaded-' + file.path,
					{
						duration: 30 * 1000,
						type: 'success',
						btn: h(
							Button,
							{
								type: 'primary',
								size: 'small',
								onClick: () => bridge.shell.showItemInFolder(file.path)
							},
							'打开所在文件夹'
						)
					}
				);
			},
			/**
			 * 浏览器关闭
			 * 可以由 browser.close() 关闭
			 * 或者进程主动触发
			 */
			'browser-closed': () => {
				console.log('browser-closed', this.uid);
				// 取消 worker 事件订阅（worker 已关闭，防止残留监听泄漏）
				this._offWorkerEvent?.();
				this._offWorkerEvent = undefined;
				// 启动失败时 worker 会统一走 close() 发回 browser-closed：
				// 若状态仍停留在 launching，回落为 closed，解除卡片一直转圈的状态
				if (this.status === 'launching') {
					this.status = 'closed';
					// 启动失败复检（browser-repair，未随当前版本提供）：内置浏览器文件被杀毒软件破坏时
					// 引导修复，成功后自动重新启动。chrome-integrity 落地时恢复：
					// handleBuiltinChromeLaunchFailure(this.browser);
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

		// worker 的消息/stdio/退出由主进程经 'script-worker' 频道统一转发，按 uid 过滤。
		// 订阅必须先于 fork：注册前的推送会丢失（包括 worker 启动失败的 exit 与最早期 stdout 报错）
		// 实例复用（Browser.launch 去重）时先退订旧监听，防止重复订阅导致事件双发
		this._offWorkerEvent?.();
		this._offWorkerEvent = onRendererEvent('script-worker', (payload) => {
			if (payload.uid !== this.uid) return;
			if (payload.kind === 'stdout') {
				const text = String(payload.chunk ?? '');
				this.appendLog(text);
				onConsole?.(text);
				this.emit('console', text);
			} else if (payload.kind === 'stderr') {
				const text = String(payload.chunk ?? '');
				onConsole?.(text);
				bridge.logger.error(text);
				this.appendLog(`${this.browser.name} 错误`, text);
				this.emit('console-stderr', text);
				notify(`${this.browser.name} 错误`, text, this.browser.uid, {
					duration: 60 * 1000,
					copy: true,
					type: 'error'
				});
			} else if (payload.kind === 'exit') {
				// 异常退出（非 0 退出码）必须可见：崩溃时浏览器静默消失，无此日志无从定位
				if (payload.code !== 0) {
					console.warn('script worker 异常退出', this.uid, payload.code);
					this.appendExternalLog(`[worker] 异常退出 code=${payload.code}`);
				}
				this.emit('exit', payload.code);
				// 兜底清理：worker 崩溃/被强杀时 browser-closed 业务消息可能丢失，
				// 此处做与 browser-closed 等价的幂等清理，防止订阅泄漏、状态滞留与 processes 残留
				this._offWorkerEvent?.();
				this._offWorkerEvent = undefined;
				if (this.status !== 'closed') {
					this.status = 'closed';
				}
				Process.remove(this.uid);
			} else if (payload.kind === 'message') {
				const event = payload.event || '';
				const args = payload.args || [];
				// 将 worker 的事件共享到当前的对象
				this.emit(event, ...args);
				// hasOwnProperty：防止 event 为 'constructor'/'toString' 等时经原型链误命中
				if (Object.prototype.hasOwnProperty.call(listeners, event)) {
					listeners[event](...args);
				}
			}
		});

		// 主进程托管 fork：环境变量在主进程组装（process.env 完整），
		// 渲染进程不再需要 child_process.fork 与 globalThis.process 拆行 hack
		// 记录 worker pid 供关闭兜底做代际校验（防止过期兜底误杀重启后的新实例）
		this.workerPid = await bridge.methods.scriptWorkerLaunch(this.uid);
		this.worker = createRemoteScriptWorker(this.uid);

		// 初始化进程数据
		// authToken 为内存态（不落盘）：从主进程经 IPC 获取后注入 store 副本传给 worker，
		// 不写入持久化 store（避免再次落盘 config.json）
		const authToken = await bridge.methods.getServerToken();
		this.worker('init', {
			store: { ...store, server: { ...store.server, authToken } },
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
				browser_enhancement: store.render.setting.browser.browserEnhancement,
				// 开发者设置开关（默认开启）：软件辅助（脚本联动路由监听）与文件下载优化
				script_assistance: store.render.setting.dev?.scriptAssistance !== false,
				download_optimization: store.render.setting.dev?.downloadOptimization !== false,
				// 会话状态保持（默认开启）：快照 Cookie 到主进程内存快照存储，下次启动注入恢复（不落盘）
				session_keepalive: store.render.setting.browser.sessionKeepalive !== false
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
			const exists = await bridge.fs.existsSync(this.launchOptions.executablePath);
			if (!exists) {
				Message.error('浏览器路径不存在，请在软件设置中修改');
				return;
			}

			// OCR 三选一（同步阻塞）：needOCR 自动化程序且未安装识别模块时，等待用户选择后继续
			await promptOcrChoiceBeforeLaunch(this.browser.automationScripts);

			// 脚本检查
			Status.loading('正在检查本地脚本...');
			const enabledUserScripts = store.render.scripts.filter((s) => s.enable);
			for (const s of enabledUserScripts) {
				if (!s.url.startsWith('http')) {
					const res = await bridge.fs.existsSync(s.info?.code_url || s.url);
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

			// 弱网探测（3s）：弱网模式下跳过脚本版本远程检查，已安装脚本视为最新，加速启动
			const weakNetwork = await detectWeakNetwork();
			// 脚本按浏览器 profile 安装：新建/清缓存后的 profile 无标记文件，
			// 此时不能凭全局 lastInstalledVersion 跳过安装（拓展内实际并无脚本）
			const scriptMarkerPath = await bridge.path.join(this.browser.cachePath, '.ocs-scripts-installed.json');
			const profileInitialized = await bridge.fs.existsSync(scriptMarkerPath);
			Status.loading(weakNetwork ? '检测到弱网环境，跳过脚本更新检查...' : '正在检查脚本更新...');
			const scriptsToInstall = await filterScriptsNeedingInstall(enabledUserScripts, {
				skipRemoteCheck: weakNetwork,
				profileInitialized
			});
			if (scriptsToInstall.length > 0) {
				Status.loading(`正在启动 ${this.browser.name}（需更新/安装 ${scriptsToInstall.length} 个脚本）...`);
			} else {
				Status.loading(`正在启动 ${this.browser.name}（脚本均为最新，无需更新）...`);
			}
			// 预下载远程脚本 + 构造安装 URL（远程脚本经本地服务器代理，规避网络波动）
			const port = store.server.port || DEFAULT_SERVER_PORT;
			const userscripts: string[] = [];
			const urlToItem = new Map<string, ScriptToInstall>();

			// 本地脚本：直接通过本地服务器代理（拓展只能拦截 http/https）
			// 脚本管理器（ScriptCat 1.5+/Tampermonkey 5.5+）仅拦截「路径以 .user.js 结尾」的 URL，
			// 查询参数形态不触发安装页，因此把文件名编入路径段（真实文件仍由 ?path= 指定）
			const buildUserscriptUrl = (localPath: string) => {
				const base = (localPath.split(/[\\/]/).pop() || 'script').replace(/[?#].*$/, '');
				const name = base.toLowerCase().endsWith('.user.js') ? base : `${base}.user.js`;
				return `http://localhost:${port}/api/local-userscript/${encodeURIComponent(name)}?path=${encodeURIComponent(
					localPath
				)}`;
			};
			const remoteItems: { item: ScriptToInstall; remoteUrl: string }[] = [];
			for (const item of scriptsToInstall) {
				const script = item.script;
				if (script.isLocalScript) {
					const localPath = script.info?.code_url || script.url;
					const installUrl = buildUserscriptUrl(localPath);
					userscripts.push(installUrl);
					urlToItem.set(installUrl, item);
				} else {
					remoteItems.push({ item, remoteUrl: script.info?.code_url || script.url });
				}
			}

			// 远程脚本：一次性批量预下载（主进程内部并行），避免逐个串行等待（最坏 N×60s → 60s 封顶）
			if (remoteItems.length > 0) {
				Status.loading(`正在并行下载 ${remoteItems.length} 个脚本...`);
				const results = await bridge.methods.downloadUserscripts(remoteItems.map((r) => r.remoteUrl));
				for (let i = 0; i < remoteItems.length; i++) {
					const { item, remoteUrl } = remoteItems[i];
					const r = results?.[i];
					if (r && r.success && r.path) {
						const installUrl = buildUserscriptUrl(r.path);
						userscripts.push(installUrl);
						urlToItem.set(installUrl, item);
					} else {
						// 预下载失败：剔除并通知，不更新 lastInstalledVersion（下次重试）
						notify(
							'脚本下载失败',
							`${item.script.info?.name || remoteUrl} 下载失败：${r?.error || '未知原因'}，本次跳过，下次启动将重试`,
							'download-fail-' + remoteUrl,
							{ duration: 60 * 1000, type: 'warning', copy: true }
						);
					}
				}
			}

			// 接收 worker 回传的安装结果，按成功情况更新 lastInstalledVersion
			this.once('userscript-install-result', async (results: InstallResult[]) => {
				let allSucceeded = (results || []).length > 0;
				for (const r of results || []) {
					const item = urlToItem.get(r.url);
					if (!item) continue;
					if (r.success) {
						item.script.lastInstalledVersion = item.latestVersion;
					} else {
						allSucceeded = false;
						notify(
							'脚本安装失败',
							`${item.script.info?.name || r.url} 安装失败：${r.reason || ''}，下次启动将重试`,
							'install-fail-' + r.url,
							{ duration: 60 * 1000, type: 'warning', copy: true }
						);
					}
				}
				// 受管脚本清单：记录安装成功的真实脚本名（脚本列表同步的删除资格依据，
				// 用户手动在浏览器内安装的脚本不在清单内，永不误删）
				const succeededNames = (results || [])
					.filter((r) => r.success)
					.map((r) => urlToItem.get(r.url)?.script.info?.name as string | undefined)
					.filter((n): n is string => !!n);
				if (succeededNames.length) {
					const managedPath = await bridge.path.join(this.browser.cachePath, '.ocs-scripts-managed.json');
					try {
						let existing: string[] = [];
						if (await bridge.fs.existsSync(managedPath)) {
							const data = JSON.parse(String(await bridge.fs.readFileSync(managedPath, 'utf-8')));
							existing = Array.isArray(data.names) ? data.names : [];
						}
						await bridge.fs.writeFileSync(
							managedPath,
							JSON.stringify({ names: [...new Set([...existing, ...succeededNames])] })
						);
					} catch (e) {
						console.warn('[process] 写入受管脚本清单失败：', e);
					}
				}
				// 本次请求的脚本全部安装成功 → 写入 profile 安装标记；
				// 有失败则不写标记，下次启动该 profile 按全新处理重试全部
				if (allSucceeded) {
					bridge.fs
						.writeFileSync(scriptMarkerPath, JSON.stringify({ time: Date.now(), count: results.length }))
						.catch(() => {});
				}
				Status.clear();
			});
			this.once('exit', () => {
				Status.clear();
			});
			return { userscripts, enabledScriptCount: enabledUserScripts.length };
		} catch (err) {
			Message.error('浏览器路径读取错误 : ' + String(err));
		}
	}

	/**
	 * 启动前置流程：并发数限制（浏览器增强）→ 内存/CPU 预检 → 被动环境检测与自动补全，
	 * 全部通过后初始化 worker 并执行脚本预检（launchPreCheck）。
	 *
	 * @returns false = 预检在 worker 初始化前被拦截（实例可直接移除）；
	 *          undefined = launchPreCheck 失败（worker 已初始化，保留实例回落状态）；
	 *          对象 = 预检通过（脚本安装参数）
	 */
	private async prepareLaunch(opts?: { skipGuardCheck?: boolean }) {
		// 浏览器增强开启时限制并发数量：运行中（启动中+已启动，不含本实例）达到上限直接拒绝启动
		if (store.render.setting.browser.browserEnhancement) {
			const runningCount = processes.filter(
				(p) => p.uid !== this.uid && (p.status === 'launching' || p.status === 'launched')
			).length;
			if (runningCount >= 4) {
				Message.error('浏览器增强已开启：最多同时运行 4 个浏览器，请先关闭其他浏览器，或在设置中关闭浏览器增强功能');
				return false;
			}
		}
		// 内存/CPU 启动预检测（设置中「内存检测」关闭时内部直接放行；批量启动由调用方统一检测后跳过）
		if (!opts?.skipGuardCheck) {
			const guard = await checkLaunchCapacity();
			if (!guard.pass) {
				warnLaunchBlocked(guard.reason || '资源不足');
				return false;
			}
		}
		// 被动环境检测与自动补全：缺失浏览器/脚本管理器/官方脚本时自动安装（见 utils/env-bootstrap.ts）。
		// 浏览器二进制不可用时抛错中断启动；拓展/脚本补全失败仅告警放行（下次启动重试）
		try {
			await ensureEnvironmentReady();
		} catch (e: any) {
			Message.error('环境准备失败，已取消启动：' + (e?.message || String(e)));
			return false;
		}
		// worker 初始化（fork + 事件订阅）必须在预检通过之后：失败路径不残留 worker 进程
		await this.init(console.log);
		return this.launchPreCheck();
	}

	/**
	 * 启动文件
	 * @param opts.skipGuardCheck 跳过内存/CPU 预检测（批量启动由调用方统一检测后逐个点名，避免重复检测）
	 * @returns false = 启动被预检拦截；number = worker 退出码；null = 启动失败/预检失败
	 */
	launch(opts?: { skipGuardCheck?: boolean }) {
		return new Promise<void | number | null | false>((resolve, reject) => {
			// 同步置为 launching：点击瞬间界面即进入加载态（Browser.launch 依此状态拦截重复点击）
			this.status = 'launching';
			// 重新启动：清理此前浏览器关闭时保留的预览图
			clearClosedPreview(this.uid);
			this.prepareLaunch(opts)
				.then((prepared) => {
					// 预检在 worker 初始化前被拦截：无 worker 残留，直接移除实例并回落状态
					if (prepared === false) {
						this.status = 'closed';
						Process.remove(this.uid);
						Status.clear();
						resolve(false);
						return;
					}
					const result = prepared;
					if (result) {
						this.once('launched', () => {
							// 启动流程结束，清除「正在启动...」加载状态
							// （原仅挂在 userscript-install-result：脚本均最新时安装器跳过、事件不发，状态栏永不消失）
							Status.clear();
							// OCR 依赖提示（非阻塞）：needOCR 脚本且未安装 OCR 模块时，
							// 弹常驻通知提供安装入口，不阻止浏览器使用
							notifyOcrMissingAfterLaunch(this.browser.automationScripts);
							resolve();
						});
						// 启动失败：worker 统一走 close() 发回 browser-closed 并退出进程，
						// 此处通过 browser-closed/shell exit 使 Promise 得以 settle，不再悬挂
						this.once('browser-closed', () => {
							resolve(null);
						});
						this.once('exit', (code) => {
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
						Status.clear();
						resolve(null);
					}
				})
				.catch((err) => {
					this.status = 'closed';
					Process.remove(this.uid);
					Status.clear();
					reject(err);
				});
		});
	}

	/** 关闭进程 */
	async close() {
		// 标记为 closing ，使监控页面，以及操作栏的图标可以判断状态
		this.status = 'closing';
		return new Promise<void>((resolve) => {
			// 兜底定时器必须可取消：browser-closed 正常到达后仍让它存活满 15s，
			// 期间若发生重启，过期触发将面对全新的 worker（只能靠 pid 代际校验兜底）
			const fallback = setTimeout(() => {
				if (this.status === 'closing') {
					console.warn('[process] 关闭超时，强制回落并终止 worker', this.uid);
					this.status = 'closed';
					// 代际校验：仅杀本实例启动的 worker——过期兜底（browser-closed 丢失/陈旧实例）
					// 不得在浏览器重启后误杀同 uid 的新 worker（host 侧按 pid 比对）
					bridge.methods.scriptWorkerKill(this.uid, this.workerPid).catch(() => {});
					resolve();
				}
			}, 15 * 1000);
			this.once('browser-closed', () => {
				clearTimeout(fallback);
				resolve();
			});
			// 关闭进程
			this.worker?.('close');
		});
	}

	/** 显示当前的浏览器  */
	bringToFront() {
		if (this.status === 'launched' && this.launchOptions) {
			const action = `http://localhost:${store.server.port}/ocs-action_bring-to-top`;
			// 主进程 spawn 分离启动（数组参数，规避 shell 拼接注入/引号截断）
			bridge.methods.launchBrowserDetached(this.launchOptions.executablePath, [
				`--user-data-dir=${this.browser.cachePath}`,
				action
			]);
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

	/** 背压汇报计数：自上次向 worker 汇报以来已消费的帧数 */
	private _consumedSinceReport = 0;

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
		// 背压：渲染端每消费 3 帧向 worker 汇报一次消费量，
		// worker 在途未消费帧超限时会暂缓 ack 让 Chromium 自动降速，防止 IPC 积压卡死
		if (++this._consumedSinceReport >= 3) {
			this._consumedSinceReport = 0;
			this.worker?.('screencastConsumed', 3);
		}
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
 * 创建 ScriptWorker 调用 API（主进程托管：消息经 remote.methods.scriptWorkerSend 转发）
 * @param uid 浏览器 uid（worker 注册表键）
 */
function createRemoteScriptWorker(uid: string) {
	return <W extends keyof ScriptWorker, F extends ScriptWorker[W]>(
		event: W,
		...args: F extends { (...args: any[]): any } ? Parameters<F> : any[]
	) => {
		// JSON 拍平：payload 常含 Vue reactive 代理（store 展开后嵌套对象仍为 Proxy），
		// structured clone 不支持 Proxy（报 "An object could not be cloned"）；
		// 且迁移前 child_process.send 本身就是 JSON 序列化，语义保持一致
		const message = JSON.parse(JSON.stringify({ event, args }));
		// worker 不存在时主进程静默忽略（对齐原 shell.connected 守卫语义）；
		// 但发送失败本身必须可见——全部吞掉会让「浏览器无响应」完全无迹可查
		bridge.methods.scriptWorkerSend(uid, message).catch((e) => {
			console.error(`[script-worker] 消息发送失败 event=${String(message?.event)} uid=${uid}:`, e);
		});
	};
}

/**
 * 渲染端错误与 console 输出转发到浏览器日志面板（XTerm）。
 *
 * 背景：bridge 迁移后异步错误（facade reject / unhandledRejection）只在 DevTools 控制台可见，
 * 日志面板完全看不到，导致「浏览器异常但无任何报错」的排查假象。
 * 转发范围：console.error / console.warn / window.onerror / unhandledrejection。
 */
(function forwardRendererErrorsToProcessLog() {
	const stringify = (v: any): string => {
		if (typeof v === 'string') return v;
		if (v instanceof Error) return v.stack || v.message;
		try {
			return JSON.stringify(v);
		} catch {
			return String(v);
		}
	};
	const sink = (level: string, args: any[]) => {
		const text = `[render:${level}] ${args.map(stringify).join(' ')}`;
		for (const p of processes) {
			p.appendExternalLog(text);
		}
	};
	for (const level of ['error', 'warn'] as const) {
		const orig = console[level].bind(console);
		console[level] = (...args: any[]) => {
			orig(...args);
			try {
				sink(level, args);
			} catch {}
		};
	}
	window.addEventListener('unhandledrejection', (e) => sink('unhandledrejection', [e.reason]));
	window.addEventListener('error', (e) => sink('error', [e.message, e.error]));
})();

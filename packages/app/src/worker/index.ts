import { Instance as Chalk } from 'chalk';
import { LoggerCore } from '@ocs-desktop/common';
import path, { basename } from 'path';
import fs from 'fs';
import { chromium, BrowserContext, Page, LaunchOptions, Response, Request, CDPSession } from 'playwright-core';
import type { AppStore, Config, ScriptWorker as ScriptWorkerContract } from '@ocs-desktop/common';
import { AutomationScripts, LegacyScriptMappings } from '../scripts/index';
import _get from 'lodash/get';
import child_process from 'child_process';
import { getBrowserMajorVersion, getExtensionPaths, ensureNewTabExtension } from '../utils/browser';

const { bgRedBright, bgBlueBright, bgYellowBright, bgGray } = new Chalk({ level: 2 });

type AS = { name: string; configs: Record<string, Config> };

type BrowserInfo = { name: string; notes: string; tags: { color: string; name: string }[] };

type BrowserConfig = {
	/** 是否启用弹窗 */
	enable_dialog?: boolean;
	/** 是否启用浏览器界面预览（Page.startScreencast 推流） */
	screenshot_preview?: boolean;
	/** 浏览器增强（防休眠/防冻结）：附加防节流启动参数 + 注入静音音频豁免脚本 */
	browser_enhancement?: boolean;
};

interface Langs {
	error_when_executable_not_found?: string;
	error_when_browser_version_too_high?: string;
	error_when_browser_launch_failed_too_fast?: string;
	error_when_extension_version_too_low?: string;
	error_when_playwright_selector_timeout?: string;
	error_when_extension_not_found?: string;
}

/** 脚本工作线程（类型契约见 @ocs-desktop/common contract.ts） */
export class ScriptWorker implements ScriptWorkerContract {
	uid: string = '';
	browser?: BrowserContext;
	logger?: LoggerCore;
	/** 拓展路径 */
	extensionPaths: string[] = [];
	/** 执行的自动化程序列表 */
	automationScripts: AS[] = [];
	/** 可关闭的浏览器拓展主页 */
	store?: AppStore;
	/** 是否启用自定义导航页（关闭后：不加载导航页扩展、初始页面为空白页） */
	bookmarkPageEnabled: boolean = true;
	/** 浏览器中软件设置的名字 */
	browserInfo?: BrowserInfo;
	config?: BrowserConfig;
	/** Screencast CDP 会话 */
	screencastSession?: CDPSession;
	/** Screencast 监控的目标页面 */
	screencastPage?: Page;
	/** Screencast 参数 */
	screencastParams?: { everyNthFrame: number; maxWidth: number; maxHeight: number; quality: number };
	/** Screencast 目标页 close 监听（命名以便重选/停止时移除） */
	private screencastPageCloseListener?: () => void;
	/** Screencast 新页面监听（browser 'page' 事件） */
	private screencastNewPageListener?: (page: Page) => void;
	/** Screencast 各页 load 监听（页面加载完成后自动切换推流目标，便于 off 清理） */
	private screencastLoadListeners = new Map<Page, () => void>();
	/** Screencast 启动中标志，防止并发重入导致 session 泄漏 */
	private screencastStarting = false;
	/** 用户手动固定的推流目标页 URL（页面关闭或 URL 变化后自动清除） */
	private screencastPinnedUrl?: string;
	/** 页面列表广播防抖定时器 */
	private pageListBroadcastTimer?: ReturnType<typeof setTimeout>;
	/** 页面列表跟踪的监听清理函数集合 */
	private pageListCleanups: (() => void)[] = [];
	static langs?: Langs;
	static lang: (key: keyof Langs, def?: string, replace?: Record<string, string>) => string = (key, def, replace) => {
		const result = _get(ScriptWorker.langs, key, def);
		return (replace ? result?.replace(/\{\{(\w+)\}\}/g, (_, k) => replace[k] || '') : result) as string;
	};

	static getTransformedErrorMessage = (error: string, extra_placeholder?: Record<string, string>) => {
		if (error.match(/Timeout .+ exceeded/)) {
			return ScriptWorker.lang(
				'error_when_playwright_selector_timeout',
				'页面元素查找超时，请检查元素是否存在/可见或选择器是否正确。',
				{ error: error, ...extra_placeholder }
			);
		}
		return error;
	};

	init({
		store,
		uid,
		cachePath,
		automationScripts,
		browserInfo,
		config,
		langs
	}: {
		store: AppStore;
		uid: string;
		cachePath: string;
		automationScripts: AS[];
		browserInfo: BrowserInfo;
		config: BrowserConfig;
		langs: Langs;
	}) {
		this.debug('正在初始化进程...');

		this.store = store;
		ScriptWorker.langs = langs;

		this.uid = uid;
		// store 由渲染进程传入（render 已解密），读取自定义导航页开关，兼容旧版本缺省字段（默认开启）
		this.bookmarkPageEnabled =
			(store as AppStore & { render?: any }).render?.setting?.browser?.bookmarkPage?.enable !== false;
		// 拓展文件夹路径
		this.extensionPaths = getExtensionPaths(store.paths.extensionsFolder);
		// 导航页扩展：通过 chrome_url_overrides.newtab 将「新建标签页」重定向到本地导航页（按浏览器独立生成，携带 uid）
		// 未启用自定义导航页时不加载该扩展，浏览器保持默认空白导航页
		if (this.bookmarkPageEnabled) {
			this.extensionPaths.push(
				ensureNewTabExtension(path.join(cachePath, 'ocs-newtab'), { uid, port: store.server?.port || 15319 })
			);
		}

		// 自动化程序
		this.automationScripts = automationScripts;

		// 初始化日志
		this.logger = new LoggerCore(store.paths['logs-path'], false, 'script', path.basename(cachePath));

		// 浏览器中软件设置的名字
		this.browserInfo = browserInfo;
		this.config = config;

		this.debug('初始化成功');
	}

	async launch(
		options: Required<Pick<LaunchOptions, 'executablePath' | 'headless' | 'args'>> & {
			userDataDir: string;
			userscripts: string[];
			/** 总共启用的用户脚本数量（用于区分"无脚本"和"无需更新"） */
			enabledScriptCount: number;
		}
	) {
		if (this.extensionPaths.length) {
			this.debug(
				'加载拓展：',
				this.extensionPaths.map((p) => basename(p))
			);
		} else {
			this.debug('浏览器拓展为空');
		}

		/** 添加拓展启动参数 */
		options.args = formatExtensionArguments(this.extensionPaths);
		const start_time = Date.now();

		/** =============================== 检测谷歌浏览器是否可用 =============================== */
		if (!fs.existsSync(options.executablePath)) {
			console.error(
				ScriptWorker.lang(
					'error_when_executable_not_found',
					`浏览器可执行文件不存在，请在设置中更换浏览器路径。：${options.executablePath}`,
					{ executablePath: options.executablePath }
				)
			);
			return await this.close();
		}

		if (process.platform === 'win32') {
			const major = getBrowserMajorVersion(options.executablePath);
			console.log('major', major);
			if (major && major > 137) {
				console.error(
					ScriptWorker.lang(
						'error_when_browser_version_too_high',
						'当前浏览器版本过高，无法自动加载脚本管理器，请在设置-浏览器路径中切换“软件内置”浏览器，如果没有内置浏览器，请重新在官网下载最新OCS软件并安装'
					)
				);
				return await this.close();
			}
		}

		/** =============================== 检测拓展是否可用 =============================== */
		for (const extensionPath of this.extensionPaths) {
			if (!fs.existsSync(extensionPath)) {
				console.error(`拓展不存在：${extensionPath}`);
				return await this.close();
			}

			if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
				console.error(`拓展格式不正确，缺少manifest.json：${extensionPath}`);
				return await this.close();
			}

			const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf-8'));
			// 检查是否为 MV2 拓展，如果是则报错
			if (_get(manifest, 'manifest_version', 2) < 3) {
				const name = getExtensionName(extensionPath);
				console.error(
					ScriptWorker.lang(
						'error_when_extension_version_too_low',
						`该拓展版本较低：{{name}}，请尝试前往软件左侧-应用中心-卸载并重新安装。`,
						{ name }
					)
				);
				return await this.close();
			}
		}

		/** 启动浏览器 */
		try {
			await launchBrowser({
				onLaunch: (browser) => {
					this.browser = browser;

					// 页面列表实时跟踪（新页面/关闭/导航时广播 pages-changed 给渲染进程）
					this.setupPageListTracking(browser);

					/** URL事件解析器 */
					this.browser?.on('page', (page) => {
						const match = page.url().match(/ocs-action_(.+)/);
						if (match?.[1]) {
							const action = match[1];
							const actions: any = {
								'bring-to-top': () => {
									// 通过命令行打开此页面后会置顶浏览器，并自动关闭当前事件页面
									page.close();
								}
							};

							actions[action]();
						}
					});

					// 浏览器启动完成
					send('launched');
					// 截图预览的启停交由渲染进程按卡片可见性驱动（Page.startScreencast），
					// 此处不再自启动定时截图，避免不可见卡片浪费资源
				},

				automationScripts: this.automationScripts,
				serverPort: this.store?.server.port || 15319,
				closeableExtensionHomepages: [
					'docs.scriptcat.org',
					'docs.scriptcat.org/docs/change',
					'docs.scriptcat.org/docs/use/open-dev',
					'tampermonkey.net/index.php',
					'tampermonkey.net/changelog.php'
				],
				authToken: this.store?.server.authToken || '',
				browserInfo: this.browserInfo,
				uid: this.uid,
				config: this.config,
				...options
			});
		} catch (err) {
			// 启动失败统一处理：发出 browser-closed 并退出进程，
			// 避免渲染进程 Process.status 滞留 'launching'、卡片一直转圈只能重启软件恢复。
			if (err instanceof Error) {
				if (
					err.message.includes('browser has been closed') ||
					err.message.includes('Target closed') ||
					err.message.includes('Browser closed')
				) {
					// 5秒内异常关闭，可能是浏览器问题
					if (Date.now() - start_time < 5 * 1000) {
						console.error(
							ScriptWorker.lang(
								'error_when_browser_launch_failed_too_fast',
								'异常启动，请尝试重启浏览器，或者在设置中更换其他浏览器',
								{
									error: err.message.substring(0, 500)
								}
							)
						);
					} else {
						console.error('异常关闭，请尝试重启浏览器。', err.message.substring(0, 500));
					}
				} else {
					// 其它启动错误（如无法读取浏览器路径/权限/启动参数非法等）
					console.error('浏览器启动失败 : ', err.message.substring(0, 500));
				}
			} else {
				console.error('未知错误 : ', String(err).substring(0, 500));
			}
			// 统一走 close()：内部会 send('browser-closed') 并 process.exit()
			return await this.close();
		}

		// 浏览器初始化完成
		send('init');
	}

	async close() {
		// 仅内部停止推流（detach session），不发 screencast-cleared：
		// 渲染进程在 browser-closed 时保留最后一帧，用于"浏览器关闭后的预览图"展示
		this.stopPageListTracking();
		await this.stopScreencastInternal();
		await this.browser?.close();
		this.browser = undefined;
		send('browser-closed');
		process.exit();
	}

	/**
	 * 是否为不可推流的浏览器内部页面（chrome://、edge://、about:、extension:// 等）。
	 * 这些页面无法被 CDP screencast 正常截取，选择目标时必须排除。
	 */
	private isInternalScreencastPage(page: Page): boolean {
		const url = page.url();
		return (
			url.startsWith('chrome') ||
			url.startsWith('edge') ||
			url.startsWith('about:') ||
			url.startsWith('extension:') ||
			url.startsWith('moz-extension:')
		);
	}

	/**
	 * 选择当前 screencast 监控目标页面：按创建顺序（倒序）选择最近创建的可推流页面。
	 * 新页面创建/加载后由事件驱动（page load / browser page）自动重选，
	 * 无需也不依赖 visibilityState / 页面注入。
	 */
	private pickScreencastPage(): Page | undefined {
		const pages = this.browser?.pages();
		if (!pages || pages.length === 0) return undefined;
		// 用户手动固定的目标页优先；目标已关闭/URL 已变化则清除固定并回退自动选择
		if (this.screencastPinnedUrl) {
			const pinned = pages.find((p) => p.url() === this.screencastPinnedUrl && !p.isClosed());
			if (pinned && !this.isInternalScreencastPage(pinned)) return pinned;
			this.screencastPinnedUrl = undefined;
		}
		return [...pages].reverse().find((p) => !this.isInternalScreencastPage(p)) || pages.at(-1);
	}

	/**
	 * 页面列表实时跟踪：监听新页面创建、页面关闭、页面导航（framenavigated），
	 * 任一变化后防抖广播 pages-changed 给渲染进程，驱动"切换页面"弹窗的 URL 列表实时更新。
	 */
	private setupPageListTracking(browser: BrowserContext) {
		const trackPage = (page: Page) => {
			const onChange = () => this.scheduleBroadcastPageList();
			page.on('close', onChange);
			page.on('framenavigated', onChange);
			this.pageListCleanups.push(() => {
				page.off('close', onChange);
				page.off('framenavigated', onChange);
			});
		};

		for (const page of browser.pages()) {
			trackPage(page);
		}
		const onNewPage = (page: Page) => {
			trackPage(page);
			this.scheduleBroadcastPageList();
		};
		browser.on('page', onNewPage);
		this.pageListCleanups.push(() => browser.off('page', onNewPage));

		// 启动后广播一次初始列表
		this.scheduleBroadcastPageList();
	}

	/** 防抖广播页面列表（导航/创建/关闭可能在短时间内连续触发） */
	private scheduleBroadcastPageList() {
		if (this.pageListBroadcastTimer) clearTimeout(this.pageListBroadcastTimer);
		this.pageListBroadcastTimer = setTimeout(() => {
			this.pageListBroadcastTimer = undefined;
			this.broadcastPageList();
		}, 300);
	}

	/** 广播当前全部可推流页面及当前推流目标给渲染进程 */
	private async broadcastPageList() {
		if (!this.browser) return;
		const pages = this.browser.pages().filter((p) => !this.isInternalScreencastPage(p));
		const infos = await Promise.all(
			pages.map(async (p) => {
				// 页面未声明 favicon 时回退为 origin/favicon.ico
				let icon = await p
					.evaluate(() => {
						const link = document.querySelector<HTMLLinkElement>(
							'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
						);
						return link?.href || '';
					})
					.catch(() => '');
				if (!icon) {
					try {
						icon = new URL(p.url()).origin + '/favicon.ico';
					} catch {
						icon = '';
					}
				}
				return {
					url: p.url(),
					title: await p.title().catch(() => ''),
					icon
				};
			})
		);
		send('pages-changed', this.uid, {
			pages: infos,
			current: this.screencastPage && !this.screencastPage.isClosed() ? this.screencastPage.url() : ''
		});
	}

	/** 停止页面列表跟踪并清理监听（浏览器关闭时调用） */
	private stopPageListTracking() {
		if (this.pageListBroadcastTimer) {
			clearTimeout(this.pageListBroadcastTimer);
			this.pageListBroadcastTimer = undefined;
		}
		for (const cleanup of this.pageListCleanups) cleanup();
		this.pageListCleanups = [];
		this.screencastPinnedUrl = undefined;
	}

	/**
	 * 切换 screencast 推流目标到指定 URL 的页面（用户在预览卡片上手动选择）。
	 * 固定目标后自动重选逻辑（新页面/load 事件）不会覆盖用户选择，
	 * 直到目标页关闭或导航离开该 URL。
	 */
	async switchScreencastPage(url: string) {
		const page = this.browser?.pages().find((p) => p.url() === url && !p.isClosed());
		if (!page) return;
		this.screencastPinnedUrl = url;
		// 推流激活时立即重建流到目标页；未激活时仅记录固定目标，激活后自动生效
		if (this.screencastParams) {
			await this.startScreencast();
		}
		this.scheduleBroadcastPageList();
	}

	/**
	 * 启动页面预览推流，帧由 IPC 直传渲染进程，由渲染进程按卡片可见性驱动调用。
	 *
	 * 时序：目标页面选定后，先等待页面运行完自动化流程（正在导航/加载时等待其 load），
	 * 再直接 page.screenshot() 截取一帧作为首帧推送——Page.startScreencast 的首帧可能因
	 * 页面忙于合成/窗口被遮挡而迟迟不来，截图兜底保证卡片立即有画面；
	 * 随后建立 Page.startScreencast 实时推流，实时帧到达后自然覆盖首帧。
	 * 不再使用"首帧看门狗 + 自动重试"：首帧由截图兜底，重选由页面 load / 新页面事件驱动。
	 */
	async startScreencast(opts?: { everyNthFrame?: number; maxWidth?: number; maxHeight?: number; quality?: number }) {
		if (!this.browser || this.screencastStarting) return;
		this.screencastStarting = true;
		try {
			// 合并参数：优先用 opts，其次沿用已存参数（用于 page 切换重选），最后默认值
			const params = {
				everyNthFrame: opts?.everyNthFrame ?? this.screencastParams?.everyNthFrame ?? 4,
				maxWidth: opts?.maxWidth ?? this.screencastParams?.maxWidth ?? 640,
				maxHeight: opts?.maxHeight ?? this.screencastParams?.maxHeight ?? 360,
				quality: opts?.quality ?? this.screencastParams?.quality ?? 35
			};
			this.screencastParams = params;

			// 先清理旧的 session（page 切换重选场景）
			await this.stopScreencastInternal();

			// 推流激活期间始终开启目标跟踪（新页面创建 / load 完成后重选）
			this.setupScreencastTracking();

			const page = this.pickScreencastPage();
			if (!page || this.isInternalScreencastPage(page)) {
				// 暂无可用页面：不做定时重试，等待页面 load / 新页面出现事件自动驱动进入
				this.info('[screencast] 暂无可用推流目标页，等待页面加载完成后自动推流');
				return;
			}

			if (page.isClosed()) return;

			// 提前挂目标页关闭监听并记录目标：等待/截图期间若页面被自动化流程关闭，可兜底重选
			this.screencastPageCloseListener = () => this.handleScreencastPageGone();
			this.screencastPage = page;
			page.on('close', this.screencastPageCloseListener);

			// 等待目标页面运行完自动化流程：页面仍在加载/导航时先等其 load，
			// 避免把半加载的自动化页面截为首帧（已加载完成的页面会立即返回）
			await page
				.waitForLoadState('load', { timeout: 15 * 1000 })
				.catch(() => this.debug('[screencast] 等待目标页 load 超时，按当前画面继续'));

			// 直接截图作为首帧并推送（不依赖 Page.startScreencast 的首帧）
			await this.captureScreencastFirstFrame(page, params);
			if (!this.screencastParams || page.isClosed()) return; // 等待期间被暂停/停止或页面已关闭

			try {
				const session = await page.context().newCDPSession(page);
				const sess = session;

				session.on('Page.screencastFrame', ({ data, sessionId }) => {
					if (this.screencastSession !== sess) return; // 旧会话迟到的帧，忽略
					// 先 ack，保证浏览器持续推帧（ack 延迟会导致停推）
					session.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
					// 帧直接 IPC 直传渲染进程（base64），不再写盘
					send('screencast-frame', this.uid, data);
				});

				await session.send('Page.startScreencast', {
					format: 'jpeg',
					quality: params.quality,
					maxWidth: params.maxWidth,
					maxHeight: params.maxHeight,
					everyNthFrame: params.everyNthFrame
				});

				this.screencastSession = session;
				this.info('[screencast] 实时推流已建立：', page.url());
			} catch (err) {
				// 建会话/启流失败：首帧截图已先行展示，等待后续 load / 新页面事件驱动重建
				this.warn('[screencast] 建立实时推流失败（首帧截图仍可用）：', String(err));
			}
		} finally {
			this.screencastStarting = false;
			// 启动期间可能错过新页面 load/新页面事件：仅在实时流已建立且最近目标页已变化时补一次重选，
			// 建流失败场景不做自动重试（首帧截图已兜底，后续由 load / 新页面事件驱动）
			if (this.screencastParams && this.browser && this.screencastSession) {
				const current = this.pickScreencastPage();
				if (current && !current.isClosed() && current !== this.screencastPage) {
					setTimeout(() => {
						if (this.screencastParams && this.browser && !this.screencastStarting && this.screencastSession) {
							this.startScreencast();
						}
					}, 300);
				}
			}
		}
	}

	/**
	 * 对目标页面直接截图并作为首帧推送给渲染进程。
	 * 与 Page.startScreencast 无关：即使实时推流因页面忙于合成/窗口遮挡暂不产帧，
	 * 也能让预览卡片先有画面；失败时静默返回，后续实时帧仍可接管。
	 */
	private async captureScreencastFirstFrame(
		page: Page,
		params: { everyNthFrame: number; maxWidth: number; maxHeight: number; quality: number }
	) {
		if (page.isClosed()) return;
		try {
			const buffer = await page.screenshot({
				type: 'jpeg',
				quality: params.quality,
				timeout: 15 * 1000
			});
			send('screencast-frame', this.uid, buffer.toString('base64'));
		} catch (err) {
			this.debug('[screencast] 截图首帧失败：', String(err));
		}
	}

	/**
	 * 停止 screencast 推流、清理截图文件并通知渲染进程清理预览
	 */
	async stopScreencast() {
		await this.stopScreencastInternal();
		this.screencastParams = undefined; // 标记完全停止
		send('screencast-cleared', this.uid);
	}

	/**
	 * 暂停 screencast 推流：仅 detach session，不发 screencast-cleared。
	 * 渲染进程保留最后一帧，切回/滚回视口时立即显示旧帧占位，startScreencast 重建推流后无缝衔接，避免重新等待。
	 */
	async pauseScreencast() {
		await this.stopScreencastInternal();
		this.screencastParams = undefined; // 标记暂停，避免 handleScreencastPageGone 误重选；恢复时由 opts 重建
	}

	/**
	 * 仅停止 screencast session，不清理文件、不发事件（用于内部切换/重选）
	 */
	private async stopScreencastInternal() {
		if (this.screencastSession) {
			try {
				await this.screencastSession.detach();
			} catch {}
			this.screencastSession = undefined;
		}
		// 移除目标页 close 监听，防止旧页面重选后重复触发
		if (this.screencastPage && this.screencastPageCloseListener) {
			this.screencastPage.off('close', this.screencastPageCloseListener);
		}
		this.screencastPage = undefined;
		this.screencastPageCloseListener = undefined;
		// 停止目标跟踪（各页 load 监听 / 新页面监听），暂停或停止后不再误重选
		this.stopScreencastTracking();
	}

	/**
	 * 监控目标页面关闭后，延迟重选下一个页面继续推流
	 */
	private handleScreencastPageGone() {
		if (!this.screencastParams) return; // 已主动停止
		// session 随页面关闭已失效，无需 detach
		this.screencastSession = undefined;
		this.screencastPage = undefined;
		setTimeout(() => {
			// 仍在运行且未主动停止则沿用原参数重选
			if (this.screencastParams && this.browser) {
				this.startScreencast();
			}
		}, 500);
	}

	/**
	 * 推流激活期间启动目标跟踪：按创建顺序跟踪页面。
	 * 每个页面注册 page load 监听，页面加载完成后自动重选推流目标到最近创建的页面；
	 * 新页面出现（browser 'page'）时同样注册监听并兜底重选，无需页面注入。
	 */
	private setupScreencastTracking() {
		if (!this.browser) return;

		// 对现有页面注册 load 监听（新页面 load 完成后自动切换推流目标）
		for (const page of this.browser.pages()) {
			this.attachScreencastLoad(page);
		}

		// 新页面出现时注册 load 监听并延迟兜底重选（等待页面加载），注册前先 off 防重复
		if (this.screencastNewPageListener) {
			this.browser.off('page', this.screencastNewPageListener);
		}
		this.screencastNewPageListener = (page) => {
			this.attachScreencastLoad(page);
			setTimeout(() => {
				// 仍在推流激活期间才重选（兜底：页面 load 未触发或加载过慢）
				if (this.screencastParams && this.browser) {
					this.startScreencast();
				}
			}, 300);
		};
		this.browser.on('page', this.screencastNewPageListener);
	}

	/**
	 * 为页面注册 load 监听：页面加载完成后自动重选推流目标（按创建顺序跟踪最近页面）。
	 * 重复注册直接跳过；页面关闭时自动清理监听与记录。
	 */
	private attachScreencastLoad(page: Page) {
		if (this.screencastLoadListeners.has(page)) return;
		const handler = () => {
			// 页面加载完成，重选到最近创建的页面
			if (this.screencastParams && this.browser) {
				this.startScreencast();
			}
		};
		this.screencastLoadListeners.set(page, handler);
		page.on('load', handler);
		page.once('close', () => {
			this.screencastLoadListeners.delete(page);
			page.off('load', handler);
		});
	}

	/**
	 * 停止目标跟踪：清理各页 load 监听与新页面监听，暂停/停止后不再泄漏或误重选
	 */
	private stopScreencastTracking() {
		for (const [page, handler] of this.screencastLoadListeners) {
			page.off('load', handler);
		}
		this.screencastLoadListeners.clear();
		if (this.screencastNewPageListener && this.browser) {
			this.browser.off('page', this.screencastNewPageListener);
			this.screencastNewPageListener = undefined;
		}
	}

	// TODO
	async bringToFront() {
		this.browser?.pages().at(-1)?.bringToFront();
	}

	kill() {
		process.exit();
	}

	debug(...msg: any[]) {
		console.log(bgGray(loggerPrefix()), ...msg);
	}

	warn(...msg: any[]) {
		console.log(bgYellowBright(loggerPrefix()), ...msg);
	}

	info(...msg: any[]) {
		console.log(bgBlueBright(loggerPrefix()), ...msg);
	}

	error(...msg: any[]) {
		console.error(bgRedBright(loggerPrefix()), ...msg);
	}
}

/**
 * 浏览器增强（防休眠/防冻结）启动参数：
 * 最小化/后台窗口下仍可长时间运行 JS。开关关闭时不附加任何参数。
 *
 * 注意：Chromium CommandLine 对重复开关为"last wins"语义，且 Playwright 1.60 默认
 * 已带一个 --disable-features 列表，此处必须携带其默认禁用项的并集，
 * 升级 playwright-core 时需同步核对（lib/coreBundle.js 中 chromiumSwitches 的 disabledFeatures）。
 * 其余独立开关与 Playwright 默认参数重复但无副作用（重复传入无影响）。
 */
function formatBrowserEnhancementArgs(config?: BrowserConfig): string[] {
	if (!config?.browser_enhancement) return [];
	return [
		// 禁用后台页面定时器节流：隐藏页面的 setTimeout/setInterval 不再被对齐到 1 秒/次
		'--disable-background-timer-throttling',
		// 禁止渲染进程在后台时被降级（降低进程优先级/调度权重）
		'--disable-renderer-backgrounding',
		// 窗口被遮挡或最小化时不将页面视为后台，避免合成/调度被暂停
		'--disable-backgrounding-occluded-windows',
		// 禁用 IPC 洪泛保护，避免 worker 高频 CDP 调用（evaluate/推流 ack）被限流
		'--disable-ipc-flooding-protection',
		// 允许无用户手势自动播放（静音音频保活的前提，否则 AudioContext 会一直处于 suspended）
		'--autoplay-policy=no-user-gesture-required',
		'--disable-features=' +
			[
				// ↓ Playwright 1.60 默认禁用项（last-wins 语义下必须保留，否则丢失默认行为）
				// 禁用 beforeunload 同步检查，避免自动化时页面卸载被阻塞（playwright#14047）
				'AvoidUnnecessaryBeforeUnloadCheckSync',
				// 修正节点移除时的边界事件派发跟踪，避免误判（playwright#38568）
				'BoundaryEventDispatchTracksNodeRemoval',
				// 关闭浏览器进程时不销毁用户数据目录（持久化上下文必需）
				'DestroyProfileOnBrowserClose',
				// 禁用拨号媒体路由提供方，避免投屏相关干扰（playwright#13854）
				'DialMediaRouteProvider',
				// 禁用全局媒体控制（工具栏媒体播放控制按钮）
				'GlobalMediaControls',
				// 禁用 HTTP 自动升级为 HTTPS，避免自动化导航被意外改写（playwright#27605）
				'HttpsUpgrades',
				// 隐藏地址栏 Lens 识图入口（非官方构建中不可用）
				'LensOverlay',
				// 禁用媒体路由/投屏功能（playwright#8162）
				'MediaRouter',
				// 禁用导航期间的绘制保持，避免旧页面残影（playwright#28023）
				'PaintHolding',
				// 禁用第三方存储分区，保持第三方 cookie 传统行为（playwright#32230）
				'ThirdPartyStoragePartitioning',
				// 禁用页面翻译弹窗（playwright#16126）
				'Translate',
				// 禁用自动提权（chromium issue 435410220）
				'AutoDeElevate',
				// 禁用新版 RenderDocument 导航行为，避免跨进程导航异常（playwright#37714）
				'RenderDocument',
				// 禁止启动时下载优化提示数据（减少启动网络活动）
				'OptimizationHints',
				// 禁用 Edge 强制浏览器登录
				'msForceBrowserSignIn',
				// 禁止 macOS 上更新 LaunchServices 首选版本记录
				'msEdgeUpdateLaunchServicesPreferredVersion',
				// ↓ 增强新增
				// 禁用后台加强唤醒节流：页面隐藏 5 分钟后定时器不再被限制为 1 次/分钟（长时挂机关键）
				'IntensiveWakeUpThrottling',
				// 禁用后台标签页冻结（Chrome 对长时间不活跃标签的 freeze 机制）
				'TabFreeze',
				// 禁用省内存模式（防止不活跃标签被丢弃/杀进程，feature 名随版本可能变化，未知项会被忽略）
				'MemorySaverMode'
			].join(',')
	];
}

/** 格式化浏览器拓展启动参数 */
function formatExtensionArguments(extensionPaths: string[]) {
	const paths = extensionPaths.map((p) => p.replace(/\\/g, '/')).join(',');
	// --disable-extensions-except 防止 Chrome 在某些版本/策略下禁用通过 --load-extension 加载的扩展
	return paths.length === 0 ? [] : [`--load-extension=${paths}`, `--disable-extensions-except=${paths}`];
}

function loggerPrefix() {
	return `[OCS] ${new Date().toLocaleTimeString()}`;
}

/** 步骤提示函数：将初始化进度渲染到导航页 */
type StepTips = (tips: string | string[], opts?: { loading?: boolean; warn?: boolean }) => Promise<void>;

/**
 * 浏览器增强：注入静音音频保活脚本（防休眠/防冻结），未开启时直接跳过。
 * 隐身实现：闭包内局部状态，无全局变量、无函数/方法暴露、无原型篡改、无控制台输出，
 * 页面被 Chrome 判定为"播放音频"，豁免后台加强节流与页面冻结；
 * AudioContext 实例仅存于闭包，站点 JS 无任何 API 可枚举到。
 */
async function injectEnhancementKeepalive(browser: BrowserContext, config?: BrowserConfig) {
	if (!config?.browser_enhancement) return;
	await browser.addInitScript(() => {
		// 仅顶层 frame，避免 iframe 重复创建
		if (window.top !== window) return;
		let started = false;
		const start = () => {
			if (started) return;
			started = true;
			try {
				const Ctor: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
				if (!Ctor) return;
				const ctx = new Ctor();
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				gain.gain.value = 0; // 静音
				osc.frequency.value = 1;
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start();
				// 若上下文被挂起（autoplay 策略未生效时），首次真实手势时恢复
				if (ctx.state === 'suspended') {
					const resume = () => {
						ctx.resume().catch(() => {});
					};
					for (const e of ['click', 'keydown', 'touchstart']) {
						window.addEventListener(e, resume, { once: true, passive: true, capture: true });
					}
				}
			} catch {
				// 静默：不向页面暴露任何痕迹
			}
		};
		// --autoplay-policy=no-user-gesture-required 下可立即启动；否则首个真实手势时启动
		start();
		if (!started) {
			for (const e of ['click', 'keydown', 'touchstart']) {
				window.addEventListener(e, start, { once: true, passive: true, capture: true });
			}
		}
	});
	// 浏览器日志输出（仅测试观察用，网站无法读取进程日志，不构成探查面）
	console.log(bgGray(loggerPrefix()), '[enhancement] 静音音频保活脚本已注入（浏览器增强已开启）');
}

/**
 * 创建步骤提示函数：将初始化进度渲染到导航页。
 * 导航页可能位于新标签页扩展的 iframe 中（chrome_url_overrides），
 * 直接在顶层页执行会命中清空页面的兜底逻辑、破坏扩展页（iframe 被移除），
 * 因此需要定位到导航页所在的 frame（顶层页或扩展页 iframe）再执行；
 * 未找到导航页时静默跳过，不再使用 textContent 覆盖页面。
 */
function createStepFunction(page: Page, serverPort: number): StepTips {
	return async (tips, opts) => {
		const { loading = true, warn = false } = opts || {};
		const state = { tips: Array.isArray(tips) ? tips : [tips], loading, warn };
		const navOrigin = `http://localhost:${serverPort}`;

		try {
			// 定位导航页 frame：顶层页（直接打开导航页）或扩展新标签页内的 iframe
			const findNavFrame = () => {
				if (page.url().startsWith(navOrigin)) return page.mainFrame();
				return page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(navOrigin));
			};

			// iframe 为异步加载，轮询等待其出现（超时则跳过提示，不破坏页面）
			let frame = findNavFrame();
			const deadline = Date.now() + 15_000;
			while (!frame && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 300));
				frame = findNavFrame();
			}
			if (!frame) return;

			// 等待导航页脚本就绪（setBookmarkLoadingState 定义后再执行），未就绪则跳过
			const ready = await frame
				.waitForFunction(() => typeof (window as any).setBookmarkLoadingState === 'function', undefined, {
					timeout: 15_000
				})
				.then(() => true)
				.catch(() => false);
			if (!ready) return;

			await frame.evaluate((s) => {
				// @ts-ignore OCS官方导航页自带的方法
				window.setBookmarkLoadingState(s);
			}, state);
		} catch {
			// 导航页不可用（页面关闭/跳转中）时静默跳过
		}
	};
}

/**
 * 运行脚本
 */
export async function launchBrowser({
	executablePath,
	headless,
	args,
	userDataDir,
	userscripts,
	enabledScriptCount,
	automationScripts,
	closeableExtensionHomepages,
	serverPort,
	authToken,
	browserInfo,
	uid,
	config,
	onLaunch
}: Required<Pick<LaunchOptions, 'executablePath' | 'headless' | 'args'>> & {
	/** 用户数据目录 */
	userDataDir: string;
	/** 自定义用户脚本URL */
	userscripts: string[];
	/** 总共启用的用户脚本数量（用于区分"无脚本"和"无需更新"） */
	enabledScriptCount: number;
	/** 可关闭的浏览器拓展主页 */
	closeableExtensionHomepages: string[];
	/** 自动化程序 */
	automationScripts: AS[];
	/** OCS服务器端口 */
	serverPort: number;
	/** 软件辅助权限认证 */
	authToken: string;
	/** 浏览器信息 */
	browserInfo?: BrowserInfo;
	uid: string;
	config?: BrowserConfig;
	onLaunch?: (browser: BrowserContext) => void;
}) {
	return new Promise<void>((resolve, reject) => {
		chromium
			.launchPersistentContext(userDataDir, {
				headless,
				viewport: null,
				executablePath,
				ignoreHTTPSErrors: true,
				acceptDownloads: true,
				ignoreDefaultArgs: ['--disable-extensions', '--enable-automation', '--no-sandbox'],
				args: [
					'--window-position=0,0',
					'--no-first-run',
					'--no-default-browser-check',
					'--allow-file-access-from-files',
					// 浏览器增强（防休眠/防冻结）附加参数，开关关闭时为空数组
					...formatBrowserEnhancementArgs(config),
					...args
				]
			})
			.then(async (browser) => {
				// 处理浏览器初始
				handleBrowserInit(browser, { enable_dialog: config?.enable_dialog, userDataDir });

				// 浏览器增强：注入静音音频保活脚本（防休眠/防冻结，未开启时内部直接跳过）
				await injectEnhancementKeepalive(browser, config);

				try {
					// 加载本地导航页
					const [blankPage] = browser.pages();
					await blankPage.goto('chrome://newtab').catch(() => {});

					// 显示步骤提示（渲染到导航页，兼容新标签页扩展 iframe）
					const step = createStepFunction(blankPage, serverPort);

					// 打开开发者模式（MV3 运行脚本必需）
					await openExtensionDeveloperMode(browser, executablePath.includes('edge'));
					// 通过 service worker 验证脚本管理器拓展已加载（间接确认开发者模式开启）
					await verifyExtensionsLoaded(browser);

					// 必须先打开开发者模式，才能关闭额外拓展页，否则打开开发者模式可能会重启插件，导致出现新的额外页面
					// 关闭拓展加载时弹出的首页（并行清理，不阻塞；未出现欢迎页属正常情况）
					waitAndCloseExtensionHomepage({ browser, closeableExtensionHomepages });

					// 安装用户脚本
					const { warn, results } = await setupUserScripts({ browser, userscripts, step, enabledScriptCount });
					// 回传安装结果（供渲染进程按成功情况更新 lastInstalledVersion）
					send('userscript-install-result', results);

					// 监听网络请求
					browserNetworkRoute(authToken, browser);

					// 运行自动化程序
					await runAutomationScripts({ browser, automationScripts, serverPort, step });

					await step(['浏览器初始化完成。'].concat(warn), { loading: false, warn: !!warn.length });

					// 触发onLaunch事件
					onLaunch?.(browser);
					// 启动完成
					resolve();
				} catch (err) {
					reject(err);
				}
			})
			.catch((err) => {
				reject(err);
			});
	});
}

/**
 * 安装结果
 */
interface InstallResult {
	url: string;
	success: boolean;
	reason?: string;
}

/**
 * 安装/更新脚本（逐个安装，精确判定每个脚本的成功/失败）
 */
async function initScripts(urls: string[], browser: BrowserContext): Promise<InstallResult[]> {
	console.log('install ', urls);
	const results: InstallResult[] = [];
	for (const url of urls) {
		results.push(await installOneScript(url, browser));
	}
	return results;
}

/**
 * 安装单个脚本：触发安装页 -> 点击安装 -> 等待成功信号
 */
async function installOneScript(url: string, browser: BrowserContext): Promise<InstallResult> {
	const trigger = await browser.newPage();
	try {
		// 触发拓展拦截 .user.js 并弹出安装页（3s 内未完成则关闭触发页）
		await Promise.race([
			trigger.goto(url).catch(() => {}),
			sleep(3 * 1000).then(() => trigger.close().catch(() => {}))
		]);
	} catch {}

	// 等待 extension:// 安装页出现
	const installPage = await waitForInstallPage(browser, 10 * 1000);
	if (!installPage) {
		await trigger.close().catch(() => {});
		return { url, success: false, reason: '安装页未出现' };
	}

	try {
		await installPage.bringToFront();
		await sleep(1000);
		const clicked = await clickInstallButton(installPage);
		const success = await waitForInstallSuccess(installPage, 15 * 1000);
		return {
			url,
			success,
			reason: success ? undefined : clicked ? '安装未确认' : '未找到安装按钮'
		};
	} finally {
		if (!installPage.isClosed()) {
			await installPage.close().catch(() => {});
		}
		await trigger.close().catch(() => {});
	}
}

/**
 * 轮询等待 extension:// 安装页出现
 */
async function waitForInstallPage(browser: BrowserContext, timeout: number): Promise<Page | undefined> {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		const page = browser.pages().find((p) => /extension:\/\//.test(p.url()));
		if (page) return page;
		await sleep(500);
	}
	return undefined;
}

/**
 * 点击安装按钮，返回是否点到按钮
 * 优先按按钮文本精确匹配（安装/Install 等），兜底 class 含 primary
 */
async function clickInstallButton(installPage: Page): Promise<boolean> {
	return await installPage.evaluate(() => {
		const candidates = [
			...Array.from(document.querySelectorAll<HTMLElement>('button')),
			...Array.from(document.querySelectorAll<HTMLElement>('[type="button"]')),
			...Array.from(document.querySelectorAll<HTMLElement>('[class*="primary"]'))
		];
		const btn =
			candidates.find((el) => /安装|Install|确定|Confirm|OK/i.test((el.textContent || '').trim())) ||
			candidates.find((el) => !!el.className && /primary/i.test(el.className));
		if (btn) {
			btn.click();
			return true;
		}
		return false;
	});
}

/**
 * 等待安装成功信号（页面关闭 / 跳转离开安装页 / 成功文本 / 按钮禁用）
 */
async function waitForInstallSuccess(installPage: Page, timeout: number): Promise<boolean> {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		// 页面已关闭
		if (installPage.isClosed()) return true;
		// 页面已跳转离开安装页
		if (!/extension:\/\//.test(installPage.url())) return true;
		// 文本/按钮状态
		const matched = await installPage
			.evaluate(() => {
				const text = document.body?.innerText || '';
				if (/已安装|已存在|安装成功|重新安装|Installed|Reinstall/i.test(text)) return true;
				const btn = document.querySelector<HTMLButtonElement>('[class*="primary"]');
				if (btn && (btn.disabled || btn.getAttribute('disabled') !== null)) return true;
				return false;
			})
			.catch(() => false);
		if (matched) return true;
		await sleep(500);
	}
	return false;
}

function send(event: string, ...args: any[]) {
	process.send?.({ event, args });
}

function sleep(t: number) {
	return new Promise((resolve, reject) => setTimeout(resolve, t));
}

/**
 * 将脚本配置转换为可用的对象配置
 * @param configs
 */
function transformScriptConfigToRaw(configs: AS['configs']) {
	const raw = Object.create({});
	for (const key in configs) {
		if (Object.prototype.hasOwnProperty.call(configs, key)) {
			Reflect.set(raw, key, configs[key].value);
		}
	}
	return raw;
}

/**
 * 安装用户脚本
 */
async function setupUserScripts(opts: {
	browser: BrowserContext;
	userscripts: string[];
	step: StepTips;
	enabledScriptCount: number;
}): Promise<{ warn: string[]; results: InstallResult[] }> {
	const { userscripts, browser, step, enabledScriptCount } = opts;

	const warn: string[] = [];
	const results: InstallResult[] = [];
	// 安装用户脚本
	if (userscripts.length) {
		await step('正在安装用户脚本...（如长时间未完成请尝试重启浏览器 ）');
		// 载入本地脚本
		try {
			const res = await initScripts(userscripts, browser);
			results.push(...res);
			const failed = res.filter((r) => !r.success);
			if (failed.length) {
				warn.push(`以下用户脚本安装失败，下次启动将重试：${failed.map((f) => f.url).join('、')}`);
			}
		} catch (e) {
			// @ts-ignore
			console.error('脚本安装失败：', e.message);
			// await html('脚本载入失败，请手动更新，或者忽略。' + e.message);
		}
	} else {
		if (enabledScriptCount === 0) {
			warn.push('检测到您的软件中并未开启任何用户脚本，可能会导致预期脚本不运行。');
		}
		// enabledScriptCount > 0 且 userscripts 为空 → 所有脚本均为最新，无需更新，无需提示
	}

	return { warn, results };
}

/**
 * 运行自动化程序
 */
async function runAutomationScripts(opts: {
	browser: BrowserContext;
	serverPort: number;
	automationScripts: AS[];
	step: StepTips;
}) {
	const { automationScripts, browser, serverPort, step } = opts;

	if (automationScripts.length) {
		// 执行自动化程序
		for (const ps of automationScripts) {
			await step(`正在执行自动化程序 - ${ps.name} ...`);
			let configs = transformScriptConfigToRaw(ps.configs);

			// 优先匹配合并后的脚本名；未命中时兼容合并前的旧配置名（迁移补全登录方式）
			const legacy = LegacyScriptMappings.find((m) => m.names.includes(ps.name));
			const script = AutomationScripts.find((s) => s.name === ps.name) ?? legacy?.script;
			if (script) {
				if (legacy) configs = legacy.migrate(configs);
				script.on('script-data', (...msg) => console.log(...msg));
				script.on('script-error', (...msg) =>
					console.error('自动化程序错误：', ...msg.map((m) => ScriptWorker.getTransformedErrorMessage(m)))
				);
				try {
					await script.run(await browser.newPage(), configs, {
						ocrApiUrl: `http://localhost:${serverPort}/ocr`,
						ocrApiImageKey: 'image',
						detBackgroundKey: 'det_bg',
						detTargetKey: 'det_target'
					});
				} catch (err) {
					console.error(
						'自动化程序错误：',
						ScriptWorker.getTransformedErrorMessage(err instanceof Error ? err.message : String(err))
					);
				}
			}
		}
	}
}

/**
 * 关闭浏览器拓展主页
 */
async function waitAndCloseExtensionHomepage(opts: { browser: BrowserContext; closeableExtensionHomepages: string[] }) {
	return new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			clearInterval(interval);
			// 欢迎页未出现属正常情况（拓展已加载过），拓展加载是否成功已由 verifyExtensionsLoaded 检测
			resolve();
		}, 60 * 1000);
		const interval = setInterval(async () => {
			const includes: Page[] = [];
			for (const page of opts.browser.pages()) {
				// 当拓展主页无法访问时，会跳转到chrome-error://chromewebdata/，此时获取的url为chrome-error://chromewebdata/，而不是拓展主页的url，但是title是拓展主页的host
				const title = page.url() === 'chrome-error://chromewebdata/' ? await page.title() : '';
				if (
					opts.closeableExtensionHomepages.some((homepage) =>
						page.url() === 'chrome-error://chromewebdata/' ? homepage.includes(title) : page.url().includes(homepage)
					)
				) {
					includes.push(page);
				}
			}
			if (includes.length) {
				clearInterval(interval);
				clearTimeout(timeout);
				Promise.all(includes.map(async (page) => page.close()))
					.then(() => resolve())
					.catch(() => resolve());
			}
		}, 1000);
	});
}

function browserNetworkRoute(authToken: string, browser: BrowserContext) {
	browser.route(/ocs-environment/, async (route) => {
		await route.fulfill({
			status: 200,
			body: JSON.stringify({
				environment: 'playwright'
			})
		});
	});
	browser.route(/ocs-script-actions/, async (route) => {
		const req = route.request();
		if (req.method().toLocaleUpperCase() !== 'POST') {
			return;
		}
		const headerValue = await req.headerValue('auth-token');

		if (headerValue !== authToken) {
			return;
		}

		const { page: targetPageUrl, property, args }: { page: string; property: string; args: any[] } = req.postDataJSON();

		try {
			const page = browser?.pages().find((p) => p.url().includes(targetPageUrl));
			if (!page) {
				return;
			}

			const targetFunction: Function = _get(page, property);
			if (typeof targetFunction !== 'function') {
				return;
			}

			if (property === 'waitForResponse' || property === 'waitForRequest') {
				args[0] = new RegExp(args[0]);
			}

			const res = await targetFunction.apply(
				property.split('.').length > 1 ? _get(page, property.split('.')[0]) : page,
				args
			);
			if (typeof res === 'object') {
				if (property === 'screenshot') {
					const buffer: Buffer = res;
					await route.fulfill({
						status: 200,
						body: buffer.toString('base64')
					});
				} else if (property === 'waitForResponse') {
					const response: Response = res;

					await route.fulfill({
						status: 200,
						body: JSON.stringify({
							url: response.url(),
							status: response.status(),
							headers: response.headers(),
							body: await response.body().then((res) => res.toString('utf8'))
						})
					});
				} else if (property === 'waitForRequest') {
					const request: Request = res;
					await route.fulfill({
						status: 200,
						body: JSON.stringify({
							url: request.url(),
							method: request.method(),
							headers: request.headers(),
							postData: request.postData()
						})
					});
				} else {
					await route.fulfill({ status: 200, body: JSON.stringify(res) });
				}
			} else {
				await route.fulfill({ status: 200, body: res ?? 'OK' });
			}
		} catch (err) {
			await route.continue();
			console.error(
				'脚本软件辅助失败：',
				ScriptWorker.getTransformedErrorMessage(err instanceof Error ? err.message : String(err), {
					url: targetPageUrl,
					property:
						property === 'click' ? '点击' : property === 'fill' ? '填写' : property === 'check' ? '选中' : property,
					args: JSON.stringify(args)
				})
			);
		}
	});
}

function handleBrowserInit(browser: BrowserContext, config: { enable_dialog?: boolean; userDataDir: string }) {
	browser.addInitScript({
		content: 'Object.defineProperty(navigator, "webdriver", { get: () => false });console.log(navigator)'
	});

	// 关闭检测
	const interval = setInterval(async () => {
		if (browser.pages().length === 0) {
			clearInterval(interval);

			await browser.close({
				reason: 'no pages'
			});
		}
	}, 100);

	browser.once('close', () => {
		send('browser-closed');
		process.exit();
	});

	const pageHandle = (page: Page) => {
		// 按照文档的说法，如果不进行任何处理，则动作会和原版浏览器一致
		// 如果不进行监听 page.on('dialog') playwright 会自动处理弹窗
		page.on('dialog', async (dialog) => {
			if (config?.enable_dialog) {
				// 不进行任何处理
			} else {
				await dialog.accept(dialog.defaultValue());
			}
		});

		// 修改下载逻辑
		page.on('download', async (download) => {
			// 不处理脚本安装
			if (download.url().endsWith('.user.js')) {
				return;
			}

			download.cancel();
			// 调用电脑本地浏览器进行文件下载
			openUrl(download.url());
			await page.evaluate(() => alert('自动化浏览器无法下载文件，已使用本地浏览器进行下载任务。'));
		});
	};
	for (const page of browser.pages()) {
		pageHandle(page);
	}
	browser.on('page', pageHandle);
}

function openUrl(url: string) {
	let cmd = 'start';
	if (process.platform === 'darwin') {
		cmd = 'open';
	} else if (process.platform === 'linux') {
		cmd = 'xdg-open';
	}
	child_process.exec(`${cmd} ${url}`);
}

/**
 * 打开浏览器拓展开发者模式（由于 MV3 的限制，运行脚本需要打开开发者模式）。
 * 仅执行开启动作；是否真正开启由后续 verifyExtensionsLoaded 的 service worker 检测间接确认
 * （开发者模式关闭时侧载拓展会被禁用，service worker 不会运行），
 * 不依赖 chrome://extensions/ 的 DOM 回读，避免页面结构变化导致的不稳定。
 */
async function openExtensionDeveloperMode(browser: BrowserContext, edge: boolean = false) {
	const page = await browser.newPage();
	await page.goto('chrome://extensions/');

	try {
		await page.bringToFront();
		await page.waitForTimeout(200);
		if (edge) {
			const els = await page.$$('[aria-label="扩展 菜单"]');
			await els[1]?.click();
			const element = await page.waitForSelector('#developer-mode', {
				timeout: 5000
			});
			if (await element.evaluate<boolean, HTMLInputElement>((el) => el.checked === false)) {
				await element.click();
			}
		} else {
			const element = await page.waitForSelector('#devMode', {
				timeout: 5000
			});
			// 如果没有开启开发者模式
			if (
				await element.evaluate<boolean, HTMLDivElement>((el) => el.getAttribute('aria-pressed')?.toString() === 'false')
			) {
				await element.click();
				// 重新加载拓展，否则需要重启浏览器才能使用
				const extensions = await page.$$('[id="dev-reload-button"]');
				for (const ext of extensions) {
					await ext.click();
					await page.waitForTimeout(200);
				}
			}
		}
		console.log('开发者模式已打开');
	} catch (err) {
		await page.close().catch(() => {});
		throw err;
	}
	await page.waitForTimeout(500);
	await page.close();
}

/**
 * 验证脚本管理器拓展已加载。
 * 通过检测拓展的 service worker 是否运行来判断（MV3 拓展必有 service worker）。
 * 不读取 chrome://extensions/ 的 DOM--其页面结构随 Chrome 版本频繁变化，不稳定；
 * service worker 检测不依赖页面结构，更长久可靠。
 * 注意：开发者模式关闭时，通过 --load-extension 侧载的拓展会被 Chrome 禁用，
 * 其 service worker 不会运行，因此 service worker 存在也间接确认了开发者模式已开启。
 */
async function verifyExtensionsLoaded(browser: BrowserContext) {
	// 拓展 service worker 可能在启动后短暂延迟才注册，轮询等待
	const timeout = 15 * 1000;
	const end = Date.now() + timeout;
	let sw = browser.serviceWorkers().find((s) => /chrome-extension:\/\//.test(s.url()));
	while (!sw && Date.now() < end) {
		await sleep(500);
		sw = browser.serviceWorkers().find((s) => /chrome-extension:\/\//.test(s.url()));
	}
	if (!sw) {
		throw new Error(
			ScriptWorker.lang(
				'error_when_extension_not_found',
				'未检测到脚本管理器拓展（油猴/脚本猫）的 service worker，请前往应用中心安装或检查开发者模式是否开启。'
			)
		);
	}
	console.log('拓展加载检测通过（service worker）：', sw.url());
}
function getExtensionName(filepath: string) {
	return filepath.toLocaleLowerCase().includes('tampermonkey')
		? '油猴'
		: filepath.toLocaleLowerCase().includes('scriptcat')
		? '脚本猫'
		: path.basename(filepath);
}

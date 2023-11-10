import { Instance as Chalk } from 'chalk';
import { LoggerCore } from '../logger.core';
import path, { basename } from 'path';
import fs from 'fs';
import { chromium, BrowserContext, Page, LaunchOptions, Response } from 'playwright-core';
import { AppStore } from '../../types';
import { scripts as PlaywrightScripts } from '../scripts/index';
import { Config } from '../scripts/interface';
const { bgRedBright, bgBlueBright, bgYellowBright, bgGray } = new Chalk({ level: 2 });

type PS = { name: string; configs: Record<string, Config> };

/** 脚本工作线程 */
export class ScriptWorker {
	uid: string = '';
	browser?: BrowserContext;
	logger?: LoggerCore;
	/** 拓展路径 */
	extensionPaths: string[] = [];
	/** 执行的自动化脚本列表 */
	playwrightScripts: PS[] = [];
	/** 可关闭的浏览器拓展主页 */
	store?: AppStore;

	init({
		store,
		uid,
		cachePath,
		playwrightScripts
	}: {
		store: AppStore;
		uid: string;
		cachePath: string;
		playwrightScripts: PS[];
	}) {
		this.debug('正在初始化进程...');

		this.store = store;

		this.uid = uid;
		// 拓展文件夹路径
		this.extensionPaths = fs
			.readdirSync(store.paths.extensionsFolder)
			.filter((f) => f !== '.DS_Store')
			.map((file) => path.join(store.paths.extensionsFolder, file));

		// 自动化脚本
		this.playwrightScripts = playwrightScripts;

		// 初始化日志
		this.logger = new LoggerCore(store.paths['logs-path'], false, 'script', path.basename(cachePath));

		this.debug('初始化成功');
	}

	async launch(
		options: Required<Pick<LaunchOptions, 'executablePath' | 'headless' | 'args'>> & {
			userDataDir: string;
			userscripts: string[];
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

		/** 启动浏览器 */
		try {
			await launchBrowser({
				onLaunch: (browser) => {
					this.browser = browser;

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
				},

				playwrightScripts: this.playwrightScripts,
				bookmarksPageUrl: this.store
					? `http://localhost:${this.store?.server.port || 15319}/index.html#/bookmarks`
					: undefined,
				serverPort: this.store?.server.port || 15319,
				closeableExtensionHomepages: ['docs.scriptcat.org', 'tampermonkey.net/index.php'],
				actionsKey: this.store?.server.actions_key || '',
				...options
			});
		} catch (err) {
			// 浏览器异常关闭
			if (err instanceof Error) {
				if (
					err.message.includes('browser has been closed') ||
					err.message.includes('Target closed') ||
					err.message.includes('Browser closed')
				) {
					console.error('异常关闭，请尝试重启任务。', err.message);
					send('browser-closed');
					// 浏览器关闭跟随退出
					process.exit();
				} else {
					console.error('错误 : ', err.message);
				}
			} else {
				console.error('未知错误 : ', err);
			}
		}

		// 浏览器初始化完成
		send('init');
	}

	async close() {
		await this.browser?.close();
		this.browser = undefined;
		send('browser-closed');
		process.exit();
	}

	/** 跳转到特殊图像共享浏览器窗口 */
	async gotoWebRTCPage() {
		const page = await this.browser?.newPage();
		if (page) {
			await page
				.evaluate((uid) => {
					document.title = uid;
					document.body.innerHTML = `正在获取图像中，请勿操作。`;
				}, this.uid)
				.catch(console.error);
			setTimeout(() => {
				send('webrtc-page-loaded');
			}, 3000);
		}
	}

	/** 关闭特殊图像共享浏览器窗口 */
	async closeWebRTCPage() {
		const pages = this.browser?.pages() || [];
		for (const page of pages) {
			const title = await page.title();
			if (title === this.uid) {
				await page.close();
			}
		}
		send('webrtc-page-closed');
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
		console.log(bgRedBright(loggerPrefix()), ...msg);
	}
}

/** 格式化浏览器拓展启动参数 */
function formatExtensionArguments(extensionPaths: string[]) {
	const paths = extensionPaths.map((p) => p.replace(/\\/g, '/')).join(',');
	return paths.length === 0 ? [] : [`--load-extension=${paths}`];
}

function loggerPrefix() {
	return `[OCS] ${new Date().toLocaleTimeString()}`;
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
	playwrightScripts,
	closeableExtensionHomepages,
	bookmarksPageUrl,
	serverPort,
	actionsKey,
	onLaunch
}: Required<Pick<LaunchOptions, 'executablePath' | 'headless' | 'args'>> & {
	/** 用户数据目录 */
	userDataDir: string;
	/** 自定义用户脚本URL */
	userscripts: string[];
	/** 可关闭的浏览器拓展主页 */
	closeableExtensionHomepages: string[];
	/** 自动化脚本 */
	playwrightScripts: PS[];
	/** 初始导航页地址 */
	bookmarksPageUrl?: string;
	/** OCS服务器端口 */
	serverPort: number;
	actionsKey: string;
	onLaunch?: (browser: BrowserContext) => void;
}) {
	return new Promise<void>((resolve, reject) => {
		chromium
			.launchPersistentContext(userDataDir, {
				viewport: null,
				executablePath,
				ignoreHTTPSErrors: true,
				ignoreDefaultArgs: ['--disable-extensions'],
				args: ['--window-position=0,0', '--no-first-run', '--no-default-browser-check', ...args],
				headless
			})
			.then(async (browser) => {
				browserNetworkRoute(actionsKey, browser);

				browser.once('close', () => {
					send('browser-closed');
					// 浏览器关闭跟随退出
					process.exit();
				});

				// 防检测
				browser.addInitScript({
					content: 'Object.defineProperty(navigator, "webdriver", { get: () => false });console.log(navigator)'
				});

				try {
					/**
					 * 显示步骤提示
					 */
					const step = async (tips: string | string[], opts?: { loading?: boolean; warn?: boolean }) => {
						const { loading = true, warn = false } = opts || {};
						await blankPage.evaluate(
							(state) => {
								// @ts-ignore OCS官方导航页自带的方法
								const setState = window.setBookmarkLoadingState;
								if (setState) {
									setState(state);
								} else {
									window.document.body.textContent = state.tips.join('\n');
								}
							},
							{ tips: Array.isArray(tips) ? tips : [tips], loading, warn }
						);
					};

					const [blankPage] = browser.pages();
					// 加载本地导航页
					await blankPage.goto(bookmarksPageUrl || 'about:blank');
					// 关闭拓展加载时弹出的首页
					await waitAndCloseExtensionHomepage({ browser, closeableExtensionHomepages });
					// 安装用户脚本
					const warn = await setupUserScripts({ browser, userscripts, step });
					// 运行自动化脚本
					await runPlaywrightScripts({ browser, playwrightScripts, serverPort, step });

					await step(['初始化完成。'].concat(warn), { loading: false, warn: !!warn.length });

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
 * 安装/更新脚本
 *
 */
async function initScripts(urls: string[], browser: BrowserContext, page: Page) {
	console.log('install ', urls);
	let installCont = 0;

	for (const url of urls) {
		try {
			await page.goto(url);
		} catch {}
	}

	// 检测脚本是否安装/更新完毕
	const tryInstall = async () => {
		if (browser.pages().length !== 0) {
			const installPage = browser.pages().find((p) => /extension:\/\//.test(p.url()));
			if (installPage) {
				// 置顶页面，防止点击安装失败
				await installPage.bringToFront();
				await sleep(500);
				await installPage.evaluate(() => {
					const btn = (document.querySelector('[class*="primary"]') ||
						document.querySelector('[type*="button"]')) as HTMLElement;
					btn?.click();
				});

				await sleep(1000);

				if (installPage.isClosed()) {
					installCont++;
				}
				if (installCont !== urls.length) {
					await tryInstall();
				}
			} else if (installCont === urls.length) {
				//
			} else {
				await sleep(1000);
				await tryInstall();
			}
		}
	};

	await tryInstall();
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
function transformScriptConfigToRaw(configs: PS['configs']) {
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
	step: (tips: string | string[], opts?: { loading?: boolean; warn?: boolean }) => Promise<void>;
}) {
	const { userscripts, browser, step } = opts;

	const warn: string[] = [];
	// 安装用户脚本
	if (userscripts.length) {
		await step('【提示】正在安装用户脚本。。。');
		const [page] = browser.pages();
		// 载入本地脚本
		try {
			await initScripts(userscripts, browser, page);
		} catch (e) {
			// @ts-ignore
			console.error(e);
			// await html('脚本载入失败，请手动更新，或者忽略。' + e.message);
		}
	} else {
		warn.push('检测到您的软件中并未安装任何用户脚本，或者全部脚本处于不加载状态，可能会导致预期脚本不运行。');
	}

	return warn;
}

/**
 * 运行自动化脚本
 */
async function runPlaywrightScripts(opts: {
	browser: BrowserContext;
	serverPort: number;
	playwrightScripts: PS[];
	step: (tips: string | string[], opts?: { loading?: boolean; warn?: boolean }) => Promise<void>;
}) {
	const { playwrightScripts, browser, serverPort, step } = opts;

	if (playwrightScripts.length) {
		// 执行自动化脚本
		for (const ps of playwrightScripts) {
			await step(`【提示】正在执行自动化脚本 - ${ps.name} ...`);
			const configs = transformScriptConfigToRaw(ps.configs);

			for (const script of PlaywrightScripts) {
				if (script.name === ps.name) {
					script.on('script-data', console.log);
					script.on('script-error', console.error);
					try {
						await script.run(await browser.newPage(), configs, {
							ocrApiUrl: `http://localhost:${serverPort}/ocr`,
							ocrApiImageKey: 'image',
							detBackgroundKey: 'det_bg',
							detTargetKey: 'det_target'
						});
					} catch (err) {
						console.error(err);
					}
					break;
				}
			}
		}
	}
}

/**
 * 关闭浏览器拓展主页
 */
async function waitAndCloseExtensionHomepage(opts: { browser: BrowserContext; closeableExtensionHomepages: string[] }) {
	return new Promise<any>((resolve, reject) => {
		const timeout = setTimeout(() => {
			clearInterval(interval);
			reject(new Error('浏览器拓展加载超时，请尝试重启浏览器，或者查看网络情况。'));
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
					.then(resolve)
					.catch(reject);
			}
		}, 1000);
	});
}

function browserNetworkRoute(actions_key: string, browser: BrowserContext) {
	const responses: Map<string, string> = new Map();

	browser.route(/ocs-script-actions/, async (route) => {
		const req = route.request();

		if ((await req.headerValue('actions-key')) === actions_key) {
			const url = req.url();
			const search = new URLSearchParams(url.split('?')[1]);
			const targetPageUrl = search.get('page') || '';
			const page = browser?.pages().find((p) => p.url().includes(targetPageUrl));
			if (!page) {
				return;
			}

			try {
				const action = search.get('action') || '';
				if (action === 'mouse-move') {
					const x = search.get('x');
					const y = search.get('y');
					if (x && y) {
						await page.mouse.move(Number(x), Number(y));
						return await route.fulfill({ status: 200, body: 'OK' });
					}
				} else if (action === 'mouse-click') {
					const x = search.get('x');
					const y = search.get('y');
					const count = search.get('count');
					const selector = search.get('selector');
					if (x && y && count) {
						await page.mouse.click(Number(x), Number(y), { clickCount: Number(count) });
						return await route.fulfill({ status: 200, body: 'OK' });
					} else if (selector) {
						await page.click(selector);
						return await route.fulfill({ status: 200, body: 'OK' });
					}
				} else if (action === 'read-text') {
					const x = search.get('x');
					const y = search.get('y');
					const selector = search.get('selector');

					if (x && y) {
						const el = await page.evaluateHandle(({ x, y }) => document.elementFromPoint(Number(x), Number(y)), {
							x,
							y
						});

						return (await el.asElement()?.textContent()) || '';
					} else if (selector) {
						const text = await page.$(selector);
						return await route.fulfill({ status: 200, body: (await text?.textContent()) || '' });
					}
				} else if (action === 'listen-request') {
					const url = search.get('url');
					if (url) {
						const listener = async (res: Response) => {
							if (new RegExp(url).test(res.url()) || res.url().includes(url)) {
								console.log(url, res.url());
								responses.set(url, await res.body().then((b) => b.toString()));
								browser.off('response', listener);
							}
						};
						browser.on('response', listener);
						return await route.fulfill({ status: 200, body: 'OK' });
					}
				} else if (action === 'get-listened-request') {
					const url = search.get('url');
					if (url) {
						const res = responses.get(url) || '';
						responses.delete(url);
						return await route.fulfill({ status: 200, body: res });
					}
				} else if (action === 'set-viewport') {
					const width = search.get('width');
					const height = search.get('height');
					if (width && height) {
						if (width === 'null' && height === 'null') {
							const url = page.url();
							await page.close();
							const newPage = await browser.newPage();
							await newPage.goto(url);
						} else {
							await page.setViewportSize({
								width: Number(width),
								height: Number(height)
							});
						}
						return await route.fulfill({ status: 200, body: 'OK' });
					}
				}
			} catch (e) {
				console.log(e);
			}

			await route.fulfill({ body: 'ERROR' });
		} else {
			await route.abort();
		}
	});
}

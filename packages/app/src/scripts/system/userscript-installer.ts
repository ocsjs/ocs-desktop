import { BrowserContext, Page } from 'playwright-core';
import { waitExtensionSwStable } from './extension-verify';
import { SystemAutomationScript } from '@ocs-desktop/common';
import { sleep, stay } from './utils';
import { visualClickElement } from '../utils';

/** 安装结果 */
export interface InstallResult {
	url: string;
	success: boolean;
	reason?: string;
}

/** 安装/更新脚本（逐个安装，精确判定每个脚本的成功/失败） */
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
	// 触发前快照已有页面 URL：浏览器常驻的扩展页（如脚本管理器后台页）会命中 /extension:\/\//，
	// 快照排除后才能正确识别本次新弹出的脚本管理器安装页
	const existingUrls = new Set(browser.pages().map((p) => p.url()));
	const t0 = Date.now();
	const trigger = await browser.newPage();
	try {
		// 触发拓展拦截 .user.js 并弹出安装页（3s 内未完成则关闭触发页）。
		// ⚠️ ScriptCat 经 declarativeNetRequest 把 .user.js 导航在【同一标签页】重定向到
		// install.html?url=...（拆包 service_worker.js 实测），此时触发页本身就是安装页，
		// 竞态关闭前必须检查：已是安装页则不得关闭（否则首次启动 SW 冷启动慢时 3s 必误杀安装页）
		await Promise.race([
			trigger.goto(url).catch(() => {}),
			sleep(3 * 1000).then(() => {
				if (!trigger.isClosed() && !isInstallPageUrl(trigger.url())) {
					trigger.close().catch(() => {});
				}
			})
		]);
	} catch {}

	// 等待 extension:// 安装页出现
	const installPage = await waitForInstallPage(browser, 10 * 1000, existingUrls);
	if (!installPage) {
		await trigger.close().catch(() => {});
		return { url, success: false, reason: '安装页未出现' };
	}

	try {
		await installPage.bringToFront();
		await sleep(1000);
		// 安装页在点击前意外关闭（拓展重载等）：按 Target closed 异常上抛，由外层重试
		if (installPage.isClosed()) {
			throw new Error('Target page, context or browser has been closed');
		}
		const clicked = await clickInstallButton(installPage);
		if (clicked) {
			// 点击后稍作停留，让用户看到按钮被触发的过程，避免安装页一闪而过
			await sleep(500);
		}
		const success = await waitForInstallSuccess(installPage, 15 * 1000);
		if (success) {
			// 安装成功状态短暂展示后再关闭页面
			await sleep(800);
		}
		return {
			url,
			success,
			reason: success ? undefined : clicked ? '安装未确认' : '未找到安装按钮'
		};
	} finally {
		if (!installPage.isClosed()) {
			await installPage.close().catch(() => {});
		}
		// 触发页最短停留 1s：防止操作过快界面一闪而过
		await stay(t0);
		await trigger.close().catch(() => {});
	}
}

/**
 * 轮询等待 extension:// 安装页出现
 * @param existingUrls 触发安装前已存在的页面 URL 快照，
 * 用于排除常驻扩展页（如脚本管理器后台页），仅匹配本次新弹出的扩展页面
 */
/**
 * 脚本管理器安装页精确路径清单（拆包实测，随版本维护）：
 * - ScriptCat：/src/install.html（安装/更新共用，service_worker.js confirmUrl 实测）
 * - Tampermonkey：/ask.html（5.5+，background.js tabs.create 实测）；/install.html 为旧版兜底
 *
 * ⚠️ 勿改回关键字模糊匹配（install|user.js|userscript）：
 * TM 的脚本编辑器页为 userscript.html、各类 URL 的 query 也可能携带脚本地址，
 * 模糊匹配会把非安装页误认为安装页（误点按钮/误判关闭）。
 */
const INSTALL_PAGE_PATHS = ['/src/install.html', '/ask.html', '/install.html'];

/** 精确判定脚本管理器安装页 URL（协议 + 路径全等，忽略 query/hash） */
function isInstallPageUrl(url: string): boolean {
	if (!url.startsWith('chrome-extension://')) return false;
	try {
		const pathname = new URL(url).pathname.replace(/\/+$/, '');
		return INSTALL_PAGE_PATHS.includes(pathname);
	} catch {
		return false;
	}
}

async function waitForInstallPage(
	browser: BrowserContext,
	timeout: number,
	existingUrls: Set<string>
): Promise<Page | undefined> {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		// 精确匹配安装页路径，排除触发前已存在的页面（常驻扩展页）
		const page = browser.pages().find((p) => !existingUrls.has(p.url()) && isInstallPageUrl(p.url()));
		if (page) return page;
		await sleep(500);
	}
	return undefined;
}

/**
 * 点击安装/更新按钮，返回是否点到按钮。
 *
 * 仅使用两个脚本管理器的固定选择器（随拓展版本更迭维护），不做通用通配——
 * 防止误点未知页面的任意按钮：
 * 1. ScriptCat（install.html，React SPA）：固定 data-testid="install-primary"（安装/更新共用；
 *    skill 安装页为 skill-install）；成功标识 install-success-ribbon——拆包 install.js 实测确认；
 * 2. Tampermonkey（ask.html/install.html）：.ask_action_buttons（id 后缀 _install_buttons）容器内 input[type=button]，
 *    文案在 value 属性（textContent 为空），安装/更新恒为容器内动作按钮——拆包 extension.js 实测确认。
 *
 * ⚠️ 勿加 button 通配：ScriptCat 页面的首个 button 是脚本启用开关，误点会变成开关脚本而非安装。
 */
async function clickInstallButton(installPage: Page): Promise<boolean> {
	const scSelector = '[data-testid="install-primary"], [data-testid="skill-install"]';
	const tmSelector = '.ask_action_buttons input[type="button"], [id$="_install_buttons"] input[type="button"]';
	// 按钮为异步渲染（ScriptCat 加载脚本代码 / TM 拉取脚本信息后才出现），先等任一形态出现再操作
	await installPage
		.waitForFunction(
			([sc, tm]) => !!document.querySelector(sc as string) || document.querySelectorAll(tm as string).length > 0,
			[scSelector, tmSelector] as any,
			{ timeout: 10 * 1000 }
		)
		.catch(() => {});
	// ScriptCat 按钮在脚本代码加载期间为 disabled：存在才等待其可用，避免无此按钮时无谓耗时
	if ((await installPage.locator(scSelector).count()) > 0) {
		await installPage
			.waitForFunction(
				(selector) => {
					const b = document.querySelector<HTMLButtonElement>(selector);
					return !!b && !b.disabled;
				},
				scSelector,
				{ timeout: 10 * 1000 }
			)
			.catch(() => {});
	}

	// 查找安装/更新按钮（固定选择器），以 evaluateHandle 直接带出元素句柄，
	// 交由句柄版可视化点击（无需向 window 注入任何函数，页面无注入痕迹可检测）
	const handle = await installPage.evaluateHandle(() => {
		// 1. ScriptCat：固定 data-testid（拆包 install.js 实测）
		const sc = document.querySelector<HTMLElement>('[data-testid="install-primary"], [data-testid="skill-install"]');
		if (sc) return sc;
		// 2. Tampermonkey：.ask_action_buttons（id 后缀 _install_buttons）内 input[type=button]，文案在 value 属性（拆包 extension.js 实测）
		const tmButtons = Array.from(
			document.querySelectorAll<HTMLInputElement>(
				'.ask_action_buttons input[type="button"], [id$="_install_buttons"] input[type="button"]'
			)
		);
		return tmButtons.find((el) => /安装|更新|Install|Update|Reinstall/i.test(el.value || '')) || tmButtons[0] || null;
	});
	const btn = handle.asElement();
	if (!btn) return false;
	// 滚动到可视区域 + 涟漪提示点击位置（visualClickElement 内置涟漪与延迟）
	await btn.scrollIntoViewIfNeeded().catch(() => {});
	await visualClickElement(installPage, btn);
	return true;
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
				// ScriptCat：成功色带出现即安装/更新完成（固定 testid，随版本维护，拆包实测）
				if (document.querySelector('[data-testid="install-success-ribbon"]')) return true;
				const text = document.body?.innerText || '';
				if (/已安装|已存在|安装成功|重新安装|Installed|Reinstall/i.test(text)) return true;
				const btn = document.querySelector<HTMLButtonElement>('[class*="primary"]');
				if (btn && (btn.disabled || btn.getAttribute('disabled') !== null)) return true;
				// Tampermonkey（ask.html）：安装按钮为 input[type=button]，点击安装后被禁用视为完成信号
				const tmBtn = document.querySelector<HTMLInputElement>(
					'.ask_action_buttons input[type="button"], [id$="_install_buttons"] input[type="button"]'
				);
				if (tmBtn && tmBtn.disabled) return true;
				return false;
			})
			.catch(() => false);
		if (matched) return true;
		await sleep(500);
	}
	return false;
}

/**
 * 系统自动化：安装/更新用户脚本（单向链路：URL → 安装）。
 * 从渲染端构造好的安装 URL 逐个触发脚本管理器安装页并完成安装，
 * 结果经 userscript-install-result 事件回传渲染端（更新 lastInstalledVersion）。
 * 安装成功的脚本名记录到 profile 的受管清单（userscript-sync 的删除资格依据）。
 */
export const userscriptInstallerScript = new SystemAutomationScript({
	name: 'system:userscript-installer',
	label: '用户脚本安装',
	order: 10,
	phase: 'post',
	async run(ctx) {
		const { browser, step, send, userscripts, enabledScriptCount, extensionPaths } = ctx;

		if (userscripts.length) {
			// 时序保证：开关切换（开发者模式/用户脚本权限）引发的拓展重载由 Chrome 异步落地，
			// 重载命中安装页打开期间会销毁页面（Target closed）——安装前等待拓展 SW 稳定
			await waitExtensionSwStable(browser, extensionPaths);
			await step('正在安装用户脚本...（如长时间未完成请尝试重启浏览器 ）');
			try {
				const results = await initScripts(userscripts, browser);
				// 回传安装结果（渲染端据此更新 lastInstalledVersion 与受管脚本清单）
				send('userscript-install-result', results);
				const failed = results.filter((r) => !r.success);
				if (failed.length) {
					await step([`以下用户脚本安装失败，下次启动将重试：${failed.map((f) => f.url).join('、')}`], {
						loading: false,
						warn: true
					});
				}
			} catch (e) {
				console.error('脚本安装失败：', e instanceof Error ? e.message : e);
			}
		} else if (enabledScriptCount === 0) {
			await step(['检测到您的软件中并未开启任何用户脚本，可能会导致预期脚本不运行。'], { loading: false, warn: true });
		}
		// enabledScriptCount > 0 且 userscripts 为空 → 所有脚本均为最新，无需更新，无需提示
	}
});

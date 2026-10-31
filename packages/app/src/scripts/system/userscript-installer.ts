import { BrowserContext, Page } from 'playwright-core';
import { SystemAutomationScript } from '@ocs-desktop/common';
import { sleep } from './utils';

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
	const trigger = await browser.newPage();
	try {
		// 触发拓展拦截 .user.js 并弹出安装页（3s 内未完成则关闭触发页）
		await Promise.race([
			trigger.goto(url).catch(() => {}),
			sleep(3 * 1000).then(() => trigger.close().catch(() => {}))
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
		await trigger.close().catch(() => {});
	}
}

/**
 * 轮询等待 extension:// 安装页出现
 * @param existingUrls 触发安装前已存在的页面 URL 快照，
 * 用于排除常驻扩展页（如脚本管理器后台页），仅匹配本次新弹出的扩展页面
 */
async function waitForInstallPage(
	browser: BrowserContext,
	timeout: number,
	existingUrls: Set<string>
): Promise<Page | undefined> {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		const candidates = browser.pages().filter((p) => /extension:\/\//.test(p.url()) && !existingUrls.has(p.url()));
		// 多个候选时优先取 URL 含安装特征的页面（脚本管理器安装页路径含 install；
		// Tampermonkey 5.5+ 的安装确认页为 ask.html?aid=...；
		// 且 query 携带 .user.js / userScript 脚本地址），兜底取第一个
		const page = candidates.find((p) => /install|ask\.html|user\.js|userscript/i.test(p.url())) || candidates[0];
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
 * 2. Tampermonkey（ask.html/install.html）：.install_buttons 容器内 input[type=button]，
 *    文案在 value 属性（textContent 为空），安装/更新恒为容器内动作按钮——拆包 extension.js 实测确认。
 *
 * ⚠️ 勿加 button 通配：ScriptCat 页面的首个 button 是脚本启用开关，误点会变成开关脚本而非安装。
 */
async function clickInstallButton(installPage: Page): Promise<boolean> {
	// ScriptCat 按钮在脚本代码加载期间为 disabled：存在才等待其可用，避免无此按钮时无谓耗时
	const scSelector = '[data-testid="install-primary"], [data-testid="skill-install"]';
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

	const found = await installPage.evaluate(() => {
		const findTarget = (): HTMLElement | undefined => {
			// 1. ScriptCat：固定 data-testid（拆包 install.js 实测）
			const sc = document.querySelector<HTMLElement>('[data-testid="install-primary"], [data-testid="skill-install"]');
			if (sc) return sc;
			// 2. Tampermonkey：.install_buttons 内 input[type=button]，文案在 value 属性（拆包 extension.js 实测）
			const tmButtons = Array.from(
				document.querySelectorAll<HTMLInputElement>('.install_buttons input[type="button"]')
			);
			const tm = tmButtons.find((el) => /安装|更新|Install|Update|Reinstall/i.test(el.value || '')) || tmButtons[0];
			if (tm) return tm as unknown as HTMLElement;
			return undefined;
		};
		const btn = findTarget();
		if (btn) {
			// 滚动到可视区域再点击，点击过程对用户可见
			// eslint-disable-next-line no-undef
			btn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
			btn.click();
			return true;
		}
		return false;
	});
	return found;
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
				const tmBtn = document.querySelector<HTMLInputElement>('.install_buttons input[type="button"]');
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
	order: 10,
	phase: 'post',
	async run(ctx) {
		const { browser, step, send, userscripts, enabledScriptCount } = ctx;

		if (userscripts.length) {
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

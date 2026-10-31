import { Page } from 'playwright-core';
import { SystemAutomationScript } from '@ocs-desktop/common';

/**
 * 系统自动化：关闭拓展加载时弹出的主页/欢迎页。
 * 非阻塞：run 立即返回（内部轮询最长 20s，未出现属正常情况——拓展已加载过）。
 * 注意：必须先开启开发者模式再执行（开发者模式开启可能重启插件产生新页面），
 * 顺序由 system 注册表的 order 保证。
 */
export const extensionHomepageScript = new SystemAutomationScript({
	name: 'system:extension-homepage',
	order: 20,
	phase: 'post',
	async run({ browser, closeableExtensionHomepages }) {
		// 立即返回，内部异步轮询清理（不阻塞后续脚本）
		return new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				clearInterval(interval);
				resolve();
			}, 20 * 1000);
			const interval = setInterval(async () => {
				const includes: Page[] = [];
				for (const page of browser.pages()) {
					// 当拓展主页无法访问时，会跳转到chrome-error://chromewebdata/，此时获取的url为chrome-error://chromewebdata/，而不是拓展主页的url，但是title是拓展主页的host
					const title = page.url() === 'chrome-error://chromewebdata/' ? await page.title() : '';
					if (
						closeableExtensionHomepages.some((homepage) =>
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
});

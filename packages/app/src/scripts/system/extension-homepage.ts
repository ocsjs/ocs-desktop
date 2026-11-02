import { Page, Request } from 'playwright-core';
import { SystemAutomationScript } from '@ocs-desktop/common';

/**
 * 系统自动化：关闭拓展加载时弹出的主页/欢迎页。
 * 双通道检测：
 * 1. 请求阶段提前关闭——导航请求发出时即可判定 URL（无需等待页面加载/导航提交），
 *    官方站点（docs.scriptcat.org/tampermonkey.net）卡顿时比轮询 page.url() 快数秒；
 * 2. 轮询兜底——覆盖监听注册前已存在的页面与 chrome-error:// 失败跳转页。
 * 非阻塞：run 立即返回（最长 20s，未出现属正常情况——拓展已加载过）。
 * 注意：必须先开启开发者模式再执行（开发者模式开启可能重启插件产生新页面），
 * 顺序由 system 注册表的 order 保证。
 */
export const extensionHomepageScript = new SystemAutomationScript({
	name: 'system:extension-homepage',
	label: '拓展欢迎页清理',
	order: 20,
	phase: 'post',
	async run({ browser, closeableExtensionHomepages }) {
		// 通道 1：导航请求阶段即关闭（URL 在请求发出时已确定，不等待页面加载完毕）
		const onRequest = (req: Request) => {
			if (req.isNavigationRequest() && closeableExtensionHomepages.some((h) => req.url().includes(h))) {
				req
					.frame()
					?.page()
					?.close()
					.catch(() => {});
			}
		};
		browser.on('request', onRequest);
		setTimeout(() => browser.off('request', onRequest), 20 * 1000);

		// 通道 2：轮询兜底（异步执行，不阻塞后续脚本）
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

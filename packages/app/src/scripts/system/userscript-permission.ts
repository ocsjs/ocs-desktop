import { SystemAutomationScript } from '@ocs-desktop/common';

/**
 * 系统自动化：为全部侧载拓展开启「允许运行用户脚本」开关。
 * Chrome 的 chrome.userScripts 权限要求（与开发者模式独立的详情页开关）：
 * 未开启时脚本管理器不注册 .user.js 拦截，导航只显示脚本源码/跳官方引导页。
 * 实现：chrome://extensions 列表逐卡片取拓展 id → 打开详情页 → 深遍历 shadow DOM
 * 找语义为"用户脚本/user scripts"的 cr-toggle，未勾选则点击。
 * 无此开关的旧内核/未声明 userScripts 权限的拓展静默跳过，单个失败不影响整体。
 */
export const userscriptPermissionScript = new SystemAutomationScript({
	name: 'system:userscript-permission',
	order: 20,
	phase: 'launch',
	async run({ browser, executablePath }) {
		const scheme = executablePath.includes('edge') ? 'edge' : 'chrome';
		const page = await browser.newPage();
		try {
			await page.goto(`${scheme}://extensions/`);
			await page.waitForTimeout(300);
			// extensions-item 元素的 id 属性即拓展 id（playwright 不自动穿透 list 内的属性读取，统一深遍历）
			const ids: string[] = await page.evaluate(() => {
				const out: string[] = [];
				// eslint-disable-next-line no-undef
				const walk = (root: ParentNode) => {
					for (const el of Array.from(root.querySelectorAll('*'))) {
						const shadow = (el as HTMLElement).shadowRoot;
						if (shadow) walk(shadow);
						if (el.tagName === 'EXTENSIONS-ITEM' && (el as HTMLElement).id) {
							out.push((el as HTMLElement).id);
						}
					}
				};
				walk(document);
				return out;
			});
			for (const id of ids) {
				try {
					await page.goto(`${scheme}://extensions/?id=${id}`);
					// 详情页渲染稳定后再操作，过程对用户可见
					await page.waitForTimeout(500);
					const result: string = await page.evaluate(() => {
						const holder: { el: any } = { el: null };
						// eslint-disable-next-line no-undef
						const walk = (root: ParentNode) => {
							if (holder.el) return;
							for (const el of Array.from(root.querySelectorAll('*'))) {
								if (holder.el) return;
								const shadow = (el as HTMLElement).shadowRoot;
								if (shadow) walk(shadow);
								if (el.tagName === 'CR-TOGGLE') {
									// 向上找带文本的容器判定开关语义（开关 id 为通用 crToggle，无语义）
									let host: any = el;
									for (let i = 0; i < 6 && host; i++) {
										const text = String(host.innerText || '').trim();
										if (/用户脚本|user.?scripts?/i.test(text)) {
											holder.el = el;
											return;
										}
										host = host.parentElement || host.getRootNode?.()?.host;
									}
								}
							}
						};
						walk(document);
						if (!holder.el) return 'absent';
						const isOn = holder.el.checked === true || holder.el.getAttribute('aria-pressed') === 'true';
						if (isOn) return 'already';
						holder.el.click();
						return 'clicked';
					});
					if (result === 'clicked') {
						console.log('已开启拓展「允许用户脚本」开关:', id);
						// 开关切换会重载拓展（SW 重启）；停留片刻让开关状态变化对用户可见
						await page.waitForTimeout(900);
					}
				} catch (e) {
					console.warn('开启用户脚本开关失败（忽略，不影响其他拓展）:', id, e);
				}
			}
		} finally {
			await page.close().catch(() => {});
		}
	}
});

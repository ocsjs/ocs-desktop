import { SystemAutomationScript } from '@ocs-desktop/common';

/**
 * 系统自动化：打开浏览器拓展开发者模式（MV3 侧载运行脚本必需）。
 * 仅执行开启动作；是否真正开启由 extension-verify 脚本的 service worker 检测间接确认
 * （开发者模式关闭时侧载拓展会被禁用，service worker 不会运行），
 * 不依赖 chrome://extensions/ 的 DOM 回读，避免页面结构变化导致的不稳定。
 */
export const extensionDevModeScript = new SystemAutomationScript({
	name: 'system:extension-dev-mode',
	order: 10,
	phase: 'launch',
	async run({ browser, executablePath }) {
		const edge = executablePath.includes('edge');
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
				// 拓展列表初次渲染期间 #devMode 所在的 toolbar 可能重渲染导致句柄失效，重试 3 次；
				// justEnabled 标记"本次由关闭点击为开启"，保持仅在刚开启时才重载拓展的原语义
				let justEnabled = false;
				let operated = false;
				for (let attempt = 0; attempt < 3; attempt++) {
					try {
						const element = await page.waitForSelector('#devMode', { timeout: 5000 });
						const pressed = await element.evaluate<boolean, HTMLDivElement>(
							(el) => el.getAttribute('aria-pressed')?.toString() === 'true'
						);
						operated = true;
						if (pressed) break; // 已开启，无需操作
						await element.click({ timeout: 2000 });
						justEnabled = true;
						break;
					} catch {
						// 句柄失效（重渲染），重试
					}
				}
				if (!operated) {
					throw new Error('开发者模式开关操作失败（页面元素持续重渲染）');
				}
				// 仅当本次刚开启开发者模式时才重载拓展（原语义）
				if (justEnabled) {
					// 开关切换后等待卡片渲染稳定，重载过程对用户可见
					await page.waitForTimeout(500);
					// 仅重载「已停用」的拓展：开发者模式关闭期间侧载拓展被 Chrome 停用，需重载恢复；
					// 已启用的拓展跳过重载——重载会触发拓展初始化/欢迎页，严重干扰启动。
					// DOM 侧直接点击（evaluate 内原子完成），规避卡片重渲染导致的句柄失效问题；
					// 是否真正生效由 extension-verify 脚本的 SW 检测兜底。
					const reloaded: string[] = await page.evaluate(async () => {
						const items =
							document
								.querySelector('extensions-manager')
								?.shadowRoot?.querySelector('extensions-item-list')
								?.shadowRoot?.querySelectorAll('extensions-item') || [];
						const clicked: string[] = [];
						for (const item of items) {
							const enable = item.shadowRoot?.querySelector('#enableToggle') as any;
							const reload = item.shadowRoot?.querySelector('#dev-reload-button') as HTMLElement | null;
							if (enable?.checked === false && reload) {
								reload.click();
								clicked.push(item.id);
							}
						}
						return clicked;
					});
					if (reloaded.length > 0) {
						console.log('已重载被停用的拓展:', reloaded.join(', '));
						// 等待重载完成（拓展 SW 重启），点击过程对用户可见
						await page.waitForTimeout(800);
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
});

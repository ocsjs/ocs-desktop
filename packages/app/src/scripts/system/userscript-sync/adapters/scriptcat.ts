import type { Page, ElementHandle } from 'playwright-core';
import type { ScriptManagerAdapter } from './types';
import { waitPageAction } from '../../utils';
import { visualClickElement } from '../../../utils';

/**
 * ScriptCat 1.5.x 适配器（拆包 src/options~2.js 实测）：
 * - 列表行为 React 组件，脚本名渲染为路由链接 a[href*="/script/editor/<uuid>"]；
 * - 启用开关：行内 data-tour="row-enable" 单元格内的 Radix Switch（button[role=switch]，data-state=checked/unchecked）；
 * - 删除：行内 data-tour="row-action" 下拉 → 菜单项「删除」→ AlertDialog 确认（destructive 按钮）；
 *   删除为「移入回收站」，可恢复，安全性好。
 * 元素获取统一走 evaluateHandle 带出句柄 + visualClickElement 可视化点击，
 * 无需向 window 注入任何函数（无注入痕迹，防环境检测）。
 */

/** 按脚本名定位行内元素（名称链接向上找含指定选择器的行容器），未找到返回 null */
function findRowElementFn(args: { scriptName: string; selector: string }): HTMLElement | null {
	const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/script/editor/"]'));
	for (const link of links) {
		if ((link.textContent || '').trim() !== args.scriptName) continue;
		let row: HTMLElement | null = link;
		while (row) {
			const el = row.querySelector<HTMLElement>(args.selector);
			if (el) return el;
			row = row.parentElement;
		}
	}
	return null;
}

/** 获取行内元素句柄（evaluate 回调经序列化在页面执行，无法引用模块作用域，故查找逻辑内联传入） */
async function rowElement(page: Page, name: string, selector: string): Promise<ElementHandle | null> {
	const handle = await page.evaluateHandle(findRowElementFn, { scriptName: name, selector });
	return handle.asElement();
}

/** 行内启用开关当前状态 */
async function switchState(sw: ElementHandle): Promise<boolean> {
	return sw.evaluate(
		(el) =>
			(el as HTMLElement).getAttribute('data-state') === 'checked' ||
			(el as HTMLElement).getAttribute('aria-checked') === 'true'
	);
}

export const scriptcatAdapter: ScriptManagerAdapter = {
	id: 'scriptcat',
	pagePath: 'src/options.html',

	async preparePage(page) {
		// 首次进入会弹「欢迎使用脚本猫」导览弹窗（localStorage firstUse 未标记时，拆包实测）。
		// 先读标记：非首次启动弹窗不会出现，直接跳过轮询（否则谓词永不命中，必然耗满超时白等）
		const needDismiss = await page.evaluate(() => {
			try {
				return localStorage.getItem('firstUse') === null;
			} catch {
				return false;
			}
		});
		if (!needDismiss) return;
		// 预写标记防止后续出现；弹窗由 React 异步挂载，谓词轮询等待「稍后再说」出现后可视化点击
		await page.evaluate(() => {
			try {
				localStorage.setItem('firstUse', 'false');
			} catch {}
		});
		const appeared = await waitPageAction(
			page,
			() =>
				Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).some((el) =>
					/稍后再说|Maybe later|Not now|Skip/i.test((el.textContent || '').trim())
				),
			undefined,
			{ timeout: 1 * 1000 }
		);
		if (!appeared) return;
		const handle = await page.evaluateHandle(() =>
			Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).find((el) =>
				/稍后再说|Maybe later|Not now|Skip/i.test((el.textContent || '').trim())
			)
		);
		const btn = handle.asElement();
		if (btn) await visualClickElement(page, btn);
	},

	async waitReady(page) {
		// 零脚本时无脚本行，按导航/布局容器判定就绪（data-tour 来自拆包实测）
		await page
			.waitForSelector('a[href*="/script/editor/"], [data-tour="nav-scripts"], main', {
				timeout: 10 * 1000
			})
			.catch(() => {});
	},

	async listScripts(page) {
		return page.evaluate(() => {
			const out: { name: string; enabled: boolean }[] = [];
			const seen = new Set<string>();
			for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/script/editor/"]'))) {
				const name = (link.textContent || '').trim();
				if (!name || seen.has(name)) continue;
				let row: HTMLElement | null = link;
				let enabled = false;
				while (row) {
					const sw = row.querySelector<HTMLElement>('[data-tour="row-enable"] [role="switch"]');
					if (sw) {
						enabled = sw.getAttribute('data-state') === 'checked' || sw.getAttribute('aria-checked') === 'true';
						break;
					}
					row = row.parentElement;
				}
				seen.add(name);
				out.push({ name, enabled });
			}
			return out;
		});
	},

	async setEnabled(page, name, enabled) {
		const sw = await rowElement(page, name, '[data-tour="row-enable"] [role="switch"]');
		if (!sw) return;
		if ((await switchState(sw)) === enabled) return;
		await visualClickElement(page, sw);
		// 等待开关状态翻转生效（React 状态更新 + 存储落盘），超时静默
		await waitPageAction(page, async () => (await switchState(sw)) === enabled, undefined, { timeout: 2 * 1000 });
	},

	async remove(page, name) {
		// 打开行操作下拉
		const trigger = await rowElement(page, name, '[data-tour="row-action"]');
		if (!trigger) return;
		await visualClickElement(page, trigger);
		// 等待菜单项「删除」出现（Radix dropdown 弹出动画后可见）后可视化点击
		const menuAppeared = await waitPageAction(page, () => {
			const items = Array.from(
				document.querySelectorAll<HTMLElement>(
					'[role="menu"] [role="menuitem"], [role="menu"] button, [role="menu"] [class*="item"]'
				)
			);
			return items.some((el) => /删除|Delete/i.test((el.textContent || '').trim()));
		});
		if (!menuAppeared) return;
		const menuHandle = await page.evaluateHandle(() => {
			const items = Array.from(
				document.querySelectorAll<HTMLElement>(
					'[role="menu"] [role="menuitem"], [role="menu"] button, [role="menu"] [class*="item"]'
				)
			);
			return items.find((el) => /删除|Delete/i.test((el.textContent || '').trim())) || null;
		});
		const menuItem = menuHandle.asElement();
		if (!menuItem) return;
		await visualClickElement(page, menuItem);
		// 等待 AlertDialog 确认按钮出现后可视化点击
		const confirmAppeared = await waitPageAction(page, () => {
			const dialog = document.querySelector('[role="alertdialog"]');
			if (!dialog) return false;
			return Array.from(dialog.querySelectorAll<HTMLElement>('button')).some((b) =>
				/删除|Delete/i.test((b.textContent || '').trim())
			);
		});
		if (!confirmAppeared) return;
		const confirmHandle = await page.evaluateHandle(() => {
			const dialog = document.querySelector('[role="alertdialog"]');
			if (!dialog) return null;
			return (
				Array.from(dialog.querySelectorAll<HTMLElement>('button')).find((b) =>
					/删除|Delete/i.test((b.textContent || '').trim())
				) || null
			);
		});
		const confirmBtn = confirmHandle.asElement();
		if (!confirmBtn) return;
		await visualClickElement(page, confirmBtn);
		// 等待行从列表消失（删除生效判定；删除为移入回收站，行即移除）
		await waitPageAction(
			page,
			(scriptName: string) =>
				!Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/script/editor/"]')).some(
					(l) => (l.textContent || '').trim() === scriptName
				),
			name,
			{ timeout: 5 * 1000 }
		);
	}
};

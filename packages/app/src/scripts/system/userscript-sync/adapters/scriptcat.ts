import type { Page } from 'playwright-core';
import type { ScriptManagerAdapter } from './types';
import { sleep } from '../../utils';

/**
 * ScriptCat 1.5.x 适配器（拆包 src/options~2.js 实测）：
 * - 列表行为 React 组件，脚本名渲染为路由链接 a[href*="/script/editor/<uuid>"]；
 * - 启用开关：行内 data-tour="row-enable" 单元格内的 Radix Switch（button[role=switch]，data-state=checked/unchecked）；
 * - 删除：行内 data-tour="row-action" 下拉 → 菜单项「删除」→ AlertDialog 确认（destructive 按钮）；
 *   删除为「移入回收站」，可恢复，安全性好。
 */

/** 读取行状态并操作：switchEnabled 目标状态（undefined=仅读取） */
async function rowSetEnabled(page: Page, name: string, target: boolean): Promise<'done' | 'skip' | 'missing'> {
	const result = await page.evaluate(
		({ scriptName, targetEnabled }) => {
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/script/editor/"]'));
			for (const link of links) {
				if ((link.textContent || '').trim() !== scriptName) continue;
				let row: HTMLElement | null = link;
				while (row) {
					const sw = row.querySelector<HTMLElement>('[data-tour="row-enable"] [role="switch"]');
					if (sw) {
						const on = sw.getAttribute('data-state') === 'checked' || sw.getAttribute('aria-checked') === 'true';
						if (on === targetEnabled) return 'skip';
						sw.click();
						return 'done';
					}
					row = row.parentElement;
				}
			}
			return 'missing';
		},
		{ scriptName: name, targetEnabled: target }
	);
	return result as 'done' | 'skip' | 'missing';
}

async function clickConfirmDelete(page: Page): Promise<boolean> {
	// AlertDialog（Radix）确认按钮：文本 删除/Delete 的 destructive 按钮
	return page.evaluate(() => {
		const dialog = document.querySelector('[role="alertdialog"]');
		if (!dialog) return false;
		const btn = Array.from(dialog.querySelectorAll<HTMLElement>('button')).find((b) =>
			/删除|Delete/i.test((b.textContent || '').trim())
		);
		if (btn) {
			btn.click();
			return true;
		}
		return false;
	});
}

export const scriptcatAdapter: ScriptManagerAdapter = {
	id: 'scriptcat',
	pagePath: 'src/options.html',

	async preparePage(page) {
		// 首次进入会弹「欢迎使用脚本猫」导览弹窗（localStorage firstUse 未标记时，拆包实测）。
		// 预写标记防止后续出现；弹窗由 React 异步挂载，轮询点击「稍后再说」兜底关闭本次弹窗
		for (let i = 0; i < 6; i++) {
			const clicked = await page.evaluate(() => {
				try {
					localStorage.setItem('firstUse', 'false');
				} catch {}
				const btn = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).find((el) =>
					/稍后再说|Maybe later|Not now|Skip/i.test((el.textContent || '').trim())
				);
				if (btn) {
					btn.click();
					return true;
				}
				return false;
			});
			if (clicked) break;
			await sleep(500);
		}
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
		await rowSetEnabled(page, name, enabled);
	},

	async remove(page, name) {
		// 打开行操作下拉（名称链接向上找含操作按钮的行容器）
		const opened = await page.evaluate((scriptName) => {
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/script/editor/"]'));
			for (const link of links) {
				if ((link.textContent || '').trim() !== scriptName) continue;
				let row: HTMLElement | null = link;
				while (row) {
					const trigger = row.querySelector<HTMLElement>('[data-tour="row-action"]');
					if (trigger) {
						trigger.click();
						return true;
					}
					row = row.parentElement;
				}
			}
			return false;
		}, name);
		if (!opened) return;
		await sleep(400);
		// 菜单项「删除」（Radix dropdown：role=menu 下的 menuitem）
		const menuClicked = await page.evaluate(() => {
			const items = Array.from(
				document.querySelectorAll<HTMLElement>(
					'[role="menu"] [role="menuitem"], [role="menu"] button, [role="menu"] [class*="item"]'
				)
			);
			const item = items.find((el) => /删除|Delete/i.test((el.textContent || '').trim()));
			if (item) {
				item.click();
				return true;
			}
			return false;
		});
		if (!menuClicked) return;
		await sleep(400);
		await clickConfirmDelete(page);
	}
};

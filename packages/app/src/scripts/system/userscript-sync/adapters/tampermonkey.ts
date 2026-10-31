import type { Page } from 'playwright-core';
import type { ScriptManagerAdapter } from './types';
import { sleep } from '../../utils';

/**
 * Tampermonkey 5.5.x 适配器（拆包 extension.js 实测）：
 * - 列表行为 tr.script（id 后缀 _tw_tr1），脚本名在 div.script_name；
 * - 启用开关：行内 class 含 "enabler" 的 div，状态类 enabler_enabled / enabler_disabled；
 * - 删除：行内动作菜单触发器 div[id$="_ai"]（clickable）→ 菜单项 [id$="_delete_script"] → 可选确认弹窗。
 */

/** 按名称定位行（tr.script 内含 div.script_name 精确匹配） */
async function findRow(page: Page, name: string) {
	return page.evaluate((scriptName) => {
		const rows = Array.from(document.querySelectorAll<HTMLElement>('tr.script'));
		for (const row of rows) {
			const nameEl = row.querySelector<HTMLElement>('.script_name');
			if ((nameEl?.textContent || '').trim() === scriptName) {
				(row as any).__ocsSyncRow = true;
				return true;
			}
		}
		return false;
	}, name);
}

export const tampermonkeyAdapter: ScriptManagerAdapter = {
	id: 'tampermonkey',
	pagePath: 'options.html',

	async listScripts(page) {
		return page.evaluate(() => {
			const out: { name: string; enabled: boolean }[] = [];
			for (const row of Array.from(document.querySelectorAll<HTMLElement>('tr.script'))) {
				const nameEl = row.querySelector<HTMLElement>('.script_name');
				const name = (nameEl?.textContent || '').trim();
				if (!name) continue;
				const enabler = row.querySelector<HTMLElement>('[class*="enabler"]');
				out.push({
					name,
					enabled: !!enabler && enabler.className.includes('enabler_enabled')
				});
			}
			return out;
		});
	},

	async setEnabled(page, name, enabled) {
		await page.evaluate(
			({ scriptName, targetEnabled }) => {
				for (const row of Array.from(document.querySelectorAll<HTMLElement>('tr.script'))) {
					const nameEl = row.querySelector<HTMLElement>('.script_name');
					if ((nameEl?.textContent || '').trim() !== scriptName) continue;
					const enabler = row.querySelector<HTMLElement>('[class*="enabler"]');
					if (!enabler) return;
					const on = enabler.className.includes('enabler_enabled');
					if (on !== targetEnabled) enabler.click();
					return;
				}
			},
			{ scriptName: name, targetEnabled: enabled }
		);
	},

	async remove(page, name) {
		const found = await findRow(page, name);
		if (!found) return;
		// 打开动作菜单（触发器 div[id$="_ai"]）
		await page.evaluate((scriptName) => {
			for (const row of Array.from(document.querySelectorAll<HTMLElement>('tr.script'))) {
				const nameEl = row.querySelector<HTMLElement>('.script_name');
				if ((nameEl?.textContent || '').trim() !== scriptName) continue;
				const trigger = row.querySelector<HTMLElement>('[id$="_ai"]');
				trigger?.click();
				return;
			}
		}, name);
		await sleep(400);
		// 菜单项 [id$="_delete_script"]（可能在浮层中，全局查询）
		const clicked = await page.evaluate(() => {
			const item = Array.from(document.querySelectorAll<HTMLElement>('[id$="_delete_script"]')).find(
				(el) => el.offsetParent !== null
			);
			if (item) {
				item.click();
				return true;
			}
			return false;
		});
		if (!clicked) return;
		await sleep(400);
		// 可选确认弹窗（确定/Delete/OK）
		await page.evaluate(() => {
			const dialog = document.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"], .confirm, .modal');
			if (!dialog) return;
			const btn = Array.from(dialog.querySelectorAll<HTMLElement>('button, input[type="button"], .clickable')).find(
				(el) =>
					/确定|删除|Delete|OK|Confirm/i.test((el.textContent || '').trim() || (el as HTMLInputElement).value || '')
			);
			btn?.click();
		});
	}
};

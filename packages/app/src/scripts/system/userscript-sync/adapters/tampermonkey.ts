import type { Page, ElementHandle } from 'playwright-core';
import type { ScriptManagerAdapter } from './types';
import { waitPageAction } from '../../utils';
import { visualClickElement } from '../../../utils';

/**
 * Tampermonkey 5.5.x 适配器（拆包 extension.js 实测）：
 * - 列表行为 tr.script（id 后缀 _tw_tr1），脚本名在 div.script_name；
 * - 启用开关：行内 class 含 "enabler" 的 div，状态类 enabler_enabled / enabler_disabled；
 * - 删除：行内动作菜单触发器 div[id$="_ai"]（clickable）→ 菜单项 [id$="_delete_script"] → 可选确认弹窗。
 * 元素获取统一走 evaluateHandle 带出句柄 + visualClickElement 可视化点击，
 * 无需向 window 注入任何函数（无注入痕迹，防环境检测）。
 */

/** 按脚本名定位行（tr.script 内含 div.script_name 精确匹配），未找到返回 null */
function findRowFn(scriptName: string): HTMLElement | null {
	for (const row of Array.from(document.querySelectorAll<HTMLElement>('tr.script'))) {
		const nameEl = row.querySelector<HTMLElement>('.script_name');
		if ((nameEl?.textContent || '').trim() === scriptName) return row;
	}
	return null;
}

/** 获取脚本行句柄 */
async function rowHandle(page: Page, name: string): Promise<ElementHandle | null> {
	const handle = await page.evaluateHandle(findRowFn, name);
	return handle.asElement();
}

/** 行内启用开关当前状态 */
async function enablerState(row: ElementHandle): Promise<boolean> {
	const enabler = await row.$('[class*="enabler"]');
	if (!enabler) return false;
	return enabler.evaluate((el) => el.className.includes('enabler_enabled'));
}

export const tampermonkeyAdapter: ScriptManagerAdapter = {
	id: 'tampermonkey',
	// 必须带 #nav=dashboard：裸 options.html 默认导航到设置页，脚本列表在 dashboard 视图
	pagePath: 'options.html#nav=dashboard',

	async waitReady(page) {
		// 零脚本时无 tr.script，按表头判定就绪（thead_name 为拆包实测的固定 id 后缀）
		await page.waitForSelector('tr.script, [id*="thead_name"]', { timeout: 10 * 1000 }).catch(() => {});
	},

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
		const row = await rowHandle(page, name);
		if (!row) return;
		const enabler = await row.$('[class*="enabler"]');
		if (!enabler) return;
		if ((await enablerState(row)) === enabled) return;
		await visualClickElement(page, enabler);
		// 等待状态类翻转生效（TM 内部会同步存储），超时静默
		await waitPageAction(page, async () => (await enablerState(row)) === enabled, undefined, { timeout: 2 * 1000 });
	},

	async remove(page, name) {
		const row = await rowHandle(page, name);
		if (!row) return;
		// 打开动作菜单（触发器 div[id$="_ai"]）
		const trigger = await row.$('[id$="_ai"]');
		if (!trigger) return;
		await visualClickElement(page, trigger);
		// 等待菜单项 [id$="_delete_script"] 可见（浮层异步出现）后可视化点击
		const itemAppeared = await waitPageAction(page, () =>
			Array.from(document.querySelectorAll<HTMLElement>('[id$="_delete_script"]')).some(
				(el) => el.offsetParent !== null
			)
		);
		if (!itemAppeared) return;
		const itemHandle = await page.evaluateHandle(
			() =>
				Array.from(document.querySelectorAll<HTMLElement>('[id$="_delete_script"]')).find(
					(el) => el.offsetParent !== null
				) || null
		);
		const item = itemHandle.asElement();
		if (!item) return;
		await visualClickElement(page, item);
		// 可选确认弹窗（确定/Delete/OK）：短暂轮询，出现即可视化点击，未出现按无弹窗处理
		const confirmAppeared = await waitPageAction(
			page,
			() => {
				const dialog = document.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"], .confirm, .modal');
				if (!dialog) return false;
				return Array.from(dialog.querySelectorAll<HTMLElement>('button, input[type="button"], .clickable')).some((el) =>
					/确定|删除|Delete|OK|Confirm/i.test((el.textContent || '').trim() || (el as HTMLInputElement).value || '')
				);
			},
			undefined,
			{ timeout: 1500 }
		);
		if (confirmAppeared) {
			const confirmHandle = await page.evaluateHandle(() => {
				const dialog = document.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"], .confirm, .modal');
				if (!dialog) return null;
				return (
					Array.from(dialog.querySelectorAll<HTMLElement>('button, input[type="button"], .clickable')).find((el) =>
						/确定|删除|Delete|OK|Confirm/i.test((el.textContent || '').trim() || (el as HTMLInputElement).value || '')
					) || null
				);
			});
			const confirmBtn = confirmHandle.asElement();
			if (confirmBtn) await visualClickElement(page, confirmBtn);
		}
		// 等待行从列表消失（删除生效判定）
		await waitPageAction(
			page,
			(scriptName: string) =>
				!Array.from(document.querySelectorAll<HTMLElement>('tr.script')).some(
					(row) => (row.querySelector<HTMLElement>('.script_name')?.textContent || '').trim() === scriptName
				),
			name,
			{ timeout: 5 * 1000 }
		);
	}
};

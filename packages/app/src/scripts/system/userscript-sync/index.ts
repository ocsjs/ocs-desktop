import fs from 'fs';
import path from 'path';
import { SystemAutomationScript } from '@ocs-desktop/common';
import { resolveExtensionId } from '../extension-verify';
import type { ScriptManagerAdapter } from './adapters/types';
import { scriptcatAdapter } from './adapters/scriptcat';
import { tampermonkeyAdapter } from './adapters/tampermonkey';
import { sleep } from '../utils';

const ADAPTERS: ScriptManagerAdapter[] = [scriptcatAdapter, tampermonkeyAdapter];

/**
 * 本 profile 中由 OCS 安装的脚本名清单（删除资格依据，防止误删用户手动安装的脚本）。
 * 由渲染端在 userscript-install-result 成功时按真实脚本名写入（渲染端掌握 URL→脚本名映射）。
 */
const MANAGED_FILE = '.ocs-scripts-managed.json';

function readManagedScripts(userDataDir: string): string[] {
	try {
		const file = path.join(userDataDir, MANAGED_FILE);
		if (!fs.existsSync(file)) return [];
		const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
		return Array.isArray(data.names) ? data.names : [];
	} catch {
		return [];
	}
}

function writeManagedScripts(userDataDir: string, names: string[]) {
	try {
		fs.writeFileSync(path.join(userDataDir, MANAGED_FILE), JSON.stringify({ names: [...new Set(names)] }));
	} catch (e) {
		console.warn('[system:userscript-sync] 写入受管脚本清单失败：', e);
	}
}

/**
 * 系统自动化：脚本列表双向同步。
 * 权威数据源 = 软件脚本列表（启动时 store 快照）：
 * - 软件中被删除的脚本（受管清单内、软件列表已不存在）→ 从脚本管理器删除；
 * - 软件中停用/启用的脚本 → 对齐脚本管理器内的启用状态；
 * - 软件新增 → 由 userscript-installer 负责（本脚本不处理）。
 * 用户手动在浏览器里安装的脚本不在受管清单内，永不删除。
 * 失败仅告警，不阻断启动。
 */
export const userscriptSyncScript = new SystemAutomationScript({
	name: 'system:userscript-sync',
	order: 30,
	phase: 'post',
	async run(ctx) {
		const { browser, extensionPaths, userDataDir, store } = ctx;

		// 定位脚本管理器拓展
		const managerPath = extensionPaths.find((p) => ADAPTERS.some((a) => path.basename(p).toLowerCase().includes(a.id)));
		if (!managerPath) return; // 未安装脚本管理器，无需同步
		const adapter = ADAPTERS.find((a) => path.basename(managerPath).toLowerCase().includes(a.id))!;

		const extId = resolveExtensionId(browser, managerPath);
		if (!extId) {
			console.warn(`[system:userscript-sync] 无法解析 ${adapter.id} 的扩展 ID，跳过同步`);
			return;
		}

		const page = await browser.newPage();
		try {
			await page.goto(`chrome-extension://${extId}/${adapter.pagePath}`);
			await page.waitForTimeout(1500);
			// 页面准备（如关闭首次进入的欢迎/导览弹窗，避免阻挡后续列表操作）
			await adapter.preparePage?.(page);

			const managerScripts = await adapter.listScripts(page);
			const managerNames = new Set(managerScripts.map((s) => s.name));
			// 软件侧脚本名集合（权威源）
			const softwareScripts: { name: string; enable: boolean }[] = (store?.render?.scripts || [])
				.map((s: any) => ({ name: s.info?.name as string | undefined, enable: s.enable !== false }))
				.filter((s: any) => !!s.name);
			const softwareNames = new Set(softwareScripts.map((s) => s.name));

			// 1. 删除：受管清单 ∩ 管理器存在 − 软件列表（用户手动安装的脚本不在受管清单，永不删除）
			const managed = readManagedScripts(userDataDir);
			const toDelete = managed.filter((name) => managerNames.has(name) && !softwareNames.has(name));
			for (const name of toDelete) {
				try {
					await adapter.remove(page, name);
					await sleep(500);
					console.log(`[system:userscript-sync] 已删除脚本：${name}`);
				} catch (e) {
					console.warn(`[system:userscript-sync] 删除脚本失败（忽略）：${name}`, e);
				}
			}
			if (toDelete.length) {
				writeManagedScripts(
					userDataDir,
					managed.filter((n) => !toDelete.includes(n))
				);
			}

			// 2. 启用/停用状态对齐（仅软件列表内的脚本）
			for (const s of softwareScripts) {
				const inManager = managerScripts.find((m) => m.name === s.name);
				if (!inManager || inManager.enabled === s.enable) continue;
				try {
					await adapter.setEnabled(page, s.name!, s.enable);
					await sleep(300);
					console.log(`[system:userscript-sync] 已${s.enable ? '启用' : '停用'}脚本：${s.name}`);
				} catch (e) {
					console.warn(`[system:userscript-sync] 状态对齐失败（忽略）：${s.name}`, e);
				}
			}
		} catch (e) {
			console.warn('[system:userscript-sync] 同步失败（忽略，不影响浏览器使用）：', e);
		} finally {
			await page.close().catch(() => {});
		}
	}
});

export { readManagedScripts, writeManagedScripts, MANAGED_FILE };

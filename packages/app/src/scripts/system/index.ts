import { SystemAutomationScript, SystemScriptContext, SystemScriptPhase } from '@ocs-desktop/common';
import { extensionDevModeScript } from './extension-dev-mode';
import { userscriptPermissionScript } from './userscript-permission';
import { extensionVerifyScript } from './extension-verify';
import { userscriptInstallerScript } from './userscript-installer';
import { extensionHomepageScript } from './extension-homepage';
import { userscriptSyncScript } from './userscript-sync';
import { siteCacheScript } from './site-cache';

/**
 * 系统自动化程序注册表（软件内置的静态自动化流程）。
 * 与用户自动化程序（scripts/automation/）同基类，但由系统统一编排：
 * 不可在 UI 删除/停用，浏览器启动后按阶段 + order 自动运行。
 *
 * 阶段与顺序：
 * - launch（关键路径，失败中断启动）：开发者模式 → 用户脚本权限 → 拓展加载验证
 * - post（后台段，失败仅告警）：脚本安装/更新 → 拓展主页清理 → 脚本列表双向同步
 */
export const SystemScripts: SystemAutomationScript[] = [
	extensionDevModeScript,
	userscriptPermissionScript,
	extensionVerifyScript,
	userscriptInstallerScript,
	extensionHomepageScript,
	userscriptSyncScript,
	siteCacheScript
];

/** 按阶段依序执行系统自动化程序；launch 阶段失败向上抛出（保持原关键路径语义），post 阶段失败仅记录 */
export async function runSystemScripts(ctx: SystemScriptContext, phase: SystemScriptPhase) {
	const scripts = SystemScripts.filter((s) => s.phase === phase).sort((a, b) => a.order - b.order);
	// 开发者设置-自动化程序管理的停用开关（显式 false 才停用，缺省启用）
	const flags = (ctx.store?.render as any)?.setting?.dev?.systemScripts as Record<string, boolean> | undefined;
	for (const script of scripts) {
		if (flags?.[script.name] === false) {
			console.log(`[${script.name}] 已被开发者设置停用，跳过`);
			continue;
		}
		try {
			await script.run(ctx);
		} catch (e) {
			if (phase === 'launch') throw e;
			console.error(`[${script.name}] 执行失败（已忽略，不影响浏览器使用）：`, e);
		}
	}
}

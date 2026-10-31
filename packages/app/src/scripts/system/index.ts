import { SystemAutomationScript, SystemScriptContext, SystemScriptPhase } from '@ocs-desktop/common';
import { extensionDevModeScript } from './extension-dev-mode';
import { userscriptPermissionScript } from './userscript-permission';
import { extensionVerifyScript } from './extension-verify';
import { userscriptInstallerScript } from './userscript-installer';
import { extensionHomepageScript } from './extension-homepage';
import { userscriptSyncScript } from './userscript-sync';

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
	userscriptSyncScript
];

/** 按阶段依序执行系统自动化程序；launch 阶段失败向上抛出（保持原关键路径语义），post 阶段失败仅记录 */
export async function runSystemScripts(ctx: SystemScriptContext, phase: SystemScriptPhase) {
	const scripts = SystemScripts.filter((s) => s.phase === phase).sort((a, b) => a.order - b.order);
	for (const script of scripts) {
		try {
			await script.run(ctx);
		} catch (e) {
			if (phase === 'launch') throw e;
			console.error(`[${script.name}] 执行失败（已忽略，不影响浏览器使用）：`, e);
		}
	}
}

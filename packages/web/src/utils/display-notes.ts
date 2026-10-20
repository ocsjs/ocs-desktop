import { RawAutomationScript } from '../components/automation-scripts';
import type { Config } from '@ocs-desktop/common/web';

/** 由自动化程序信息构建的默认备注（备注为空时使用） */
export interface AutomationNotesResult {
	/** 展示文本（敏感信息已掩码） */
	text: string;
	/** 是否来自自动化程序信息（而非用户填写的备注） */
	isAuto: boolean;
}

/**
 * 将配置项值转为展示字符串，敏感信息掩码。
 * - 密码类型 → 全星号（按长度，最多 12 位）
 * - 键名/标签含 password/pass/密钥/秘钥/口令/token → 掩码（兜底，即便 type 非 password）
 * - 空值 → undefined（不展示）
 */
function formatConfigValue(key: string, cfg: Config): string | undefined {
	const value = cfg.value;
	if (value === undefined || value === null) return undefined;
	const str = typeof value === 'boolean' ? (value ? '开' : '关') : String(value);
	if (!str.trim()) return undefined;

	const sensitive =
		cfg.type === 'password' ||
		/password|pass|密钥|秘钥|口令|token/i.test(key) ||
		/密钥|秘钥|口令/i.test(cfg.label || '');
	if (sensitive) {
		const len = Math.min(Math.max(str.length, 6), 12);
		return '*'.repeat(len);
	}
	return str;
}

/** 配置项是否应展示（与 AutomationScriptList.vue 的可见性规则一致） */
function isConfigVisible(script: RawAutomationScript, key: string, cfg: Config): boolean {
	// 防御：历史数据/异常数据中配置项可能为 null 或非对象，读取字段会抛错导致整个卡片列表渲染崩溃
	if (!cfg || typeof cfg !== 'object') return false;
	if (cfg.visibleWhen) {
		return script.configs[cfg.visibleWhen.key]?.value === cfg.visibleWhen.value;
	}
	return !cfg.hide;
}

/**
 * 由自动化程序信息构建展示文本。
 * 多个脚本之间用换行分隔，单脚本时直接展示配置行。
 */
function buildAutomationText(scripts: RawAutomationScript[]): string {
	const blocks: string[] = [];
	for (const script of scripts || []) {
		// 防御：configs 必须为对象（异常数据可能为 null/数组/字符串）
		if (!script?.configs || typeof script.configs !== 'object') continue;
		const lines: string[] = [];
		for (const key of Object.keys(script.configs)) {
			const cfg = script.configs[key];
			if (!isConfigVisible(script, key, cfg)) continue;
			const val = formatConfigValue(key, cfg);
			if (val === undefined) continue;
			lines.push(`${cfg.label || key}: ${val}`);
		}
		if (lines.length === 0) continue;
		const header = script.name ? `[${script.name}]` : '';
		blocks.push(header ? `${header}\n${lines.join('\n')}` : lines.join('\n'));
	}
	return blocks.join('\n');
}

/**
 * 获取浏览器卡片应展示的备注描述：
 * - 用户填写了备注 → 原样展示（isAuto=false）
 * - 备注为空但存在自动化程序 → 用自动化程序信息构建（isAuto=true，敏感信息掩码）
 * - 都没有 → 空（isAuto=false）
 */
export function getDisplayNotes(browser: {
	notes?: string;
	automationScripts?: RawAutomationScript[];
}): AutomationNotesResult {
	const userNotes = browser.notes?.trim();
	if (userNotes) {
		return { text: browser.notes as string, isAuto: false };
	}
	if (browser.automationScripts && browser.automationScripts.length > 0) {
		const text = buildAutomationText(browser.automationScripts);
		if (text) {
			return { text, isAuto: true };
		}
	}
	return { text: '', isAuto: false };
}

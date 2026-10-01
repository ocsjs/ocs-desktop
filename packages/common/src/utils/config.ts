import type { Config } from '../scripts/interface';
import { normalizeUrl } from './url';

/**
 * 自动化程序配置项输入自动检测（渲染进程 / 主进程共用）
 *
 * 按配置类型与声明进行格式校验：
 * - 空值：仅 required 时报「请输入 xx」
 * - url：规范化后必须可解析为 http/https 链接
 * - number：必须为数字且在 min/max 范围内
 * - text/password/textarea：长度需在 min/max 范围内
 * - pattern：声明了正则时按正则校验（跨 IPC 序列化安全，故为字符串形式）
 *
 * @returns 错误提示文案；校验通过返回 undefined
 */
export function validateConfigValue(cfg: Config): string | undefined {
	const value = cfg.value;
	const isEmpty = value === undefined || value === null || String(value).trim() === '';
	if (isEmpty) {
		return cfg.required ? `请输入${cfg.label}` : undefined;
	}

	switch (cfg.type) {
		case 'url': {
			try {
				const parsed = new URL(normalizeUrl(value));
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					return `${cfg.label}格式不正确，需为 http/https 链接`;
				}
			} catch {
				return `${cfg.label}格式不正确，需为 http/https 链接`;
			}
			break;
		}
		case 'number': {
			const num = Number(value);
			if (Number.isNaN(num)) {
				return `${cfg.label}必须为数字`;
			}
			if (cfg.min !== undefined && num < cfg.min) {
				return `${cfg.label}不能小于 ${cfg.min}`;
			}
			if (cfg.max !== undefined && num > cfg.max) {
				return `${cfg.label}不能大于 ${cfg.max}`;
			}
			break;
		}
		default: {
			// text / password / textarea：长度限制
			const len = String(value).trim().length;
			if (cfg.min !== undefined && len < cfg.min) {
				return `${cfg.label}长度不能少于 ${cfg.min} 位`;
			}
			if (cfg.max !== undefined && len > cfg.max) {
				return `${cfg.label}长度不能超过 ${cfg.max} 位`;
			}
			break;
		}
	}

	if (cfg.pattern) {
		try {
			if (!new RegExp(cfg.pattern).test(String(value).trim())) {
				return cfg.patternMessage || `${cfg.label}格式不正确`;
			}
		} catch {
			// 声明的正则非法时忽略，不阻塞输入
		}
	}
	return undefined;
}

import { AutomationScript, normalizeUrl } from '@ocs-desktop/common';

export const NewPageScript = new AutomationScript(
	{
		url: {
			label: '网页链接',
			value: '',
			type: 'url',
			required: true,
			placeholder: '请输入网页链接（如 www.example.com，自动补全 https:// 前缀）'
		}
	},
	{
		name: '通用-新建页面',
		async run(page, configs) {
			// 运行时兜底规范化：识别域名链接并补全协议前缀（UI 层失焦时已做同样处理）
			const url = normalizeUrl(configs.url);
			try {
				const parsed = new URL(url);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					throw new Error('invalid protocol');
				}
				await page.goto(url);
			} catch {
				throw new Error('网页链接格式不正确，请输入正确的网页链接。');
			}
		}
	}
);

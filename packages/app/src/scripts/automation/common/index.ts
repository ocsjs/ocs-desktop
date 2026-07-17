import { AutomationScript } from '../../script';

export const NewPageScript = new AutomationScript(
	{
		url: {
			label: '网页链接',
			value: '',
			type: 'text',
			required: true,
			placeholder: '请输入 http 开头的链接'
		}
	},
	{
		name: '通用-新建页面',
		async run(page, configs) {
			if (configs.url.startsWith('http')) {
				await page.goto(configs.url);
			} else {
				throw new Error('网页链接格式不正确，请输入 http 开头的链接。');
			}
		}
	}
);

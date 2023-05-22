import { Page } from 'playwright-core';
import { PlaywrightScript } from '../../script';

export const ICVELoginScript = new PlaywrightScript(
	{
		username: {
			label: '账号',
			value: ''
		},
		password: {
			label: '密码',
			value: ''
		}
	},
	{
		name: '智慧职教-账号密码登录',
		async run(page, configs) {
			try {
				if (await isNotLogin(page)) {
					await page.fill('[name="userName"]', configs.username);
					await page.fill('[name="password"]', configs.password);
					// 同意协议
					await page.click('#isTy');
					await page.click('.dl');
				}
			} catch (err) {
				ICVELoginScript.emit('script-error', String(err));
			}
		}
	}
);

async function isNotLogin(page: Page) {
	await page.goto('https://sso.icve.com.cn/sso/auth?mode=simple&source=2&redirect=https://mooc.icve.com.cn/cms/');
	await page.waitForTimeout(2000);
	return page.url().includes('sso/auth');
}

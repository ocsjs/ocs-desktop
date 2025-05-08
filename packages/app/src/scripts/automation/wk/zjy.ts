import { Page } from 'playwright-core';
import { PlaywrightScript } from '../../script';

export const ZJYLoginScript = new PlaywrightScript(
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
		name: '新职教云-账号密码登录',
		async run(page, configs) {
			try {
				await page.goto('https://zjy2.icve.com.cn/study/index');
				if (await isNotLogin(page)) {
					await page.fill('[placeholder="请输入账号"]', configs.username);
					await page.fill('[placeholder="请输入密码"]', configs.password);
					await page.click('.agreement .el-checkbox__input');
					await page.click('.ri .login', { position: { x: 10, y: 10 } });
					await page.waitForTimeout(1000);
					if (await isNotLogin(page)) {
						const errors = await page.evaluate(() =>
							Array.from(document.querySelectorAll('.xcConfirm .txtBox'))
								.map((e) => e.textContent || '')
								.filter(Boolean)
						);

						if (errors.length) {
							throw new Error(errors.join('\n'));
						}
					}
				}
			} catch (err) {
				ZJYLoginScript.emit('script-error', String(err));
			}
		}
	}
);

/** 是否未登录 */
async function isNotLogin(page: Page) {
	return page.url().includes('/sso/auth');
}

import { Page } from 'playwright-core';
import { breakVerifyCode } from '../../utils';
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
		name: '职教云-账号密码登录',
		async run(
			page,
			configs,
			options?: {
				ocrApiUrl?: string;
				ocrApiImageKey?: string;
			}
		) {
			try {
				if (await isNotLogin(page)) {
					await page.fill('input[name="userName"]', configs.username);
					await page.fill('input[name="userPassword"]', configs.username);

					if (options?.ocrApiUrl && options?.ocrApiImageKey) {
						let count = 5;
						while (await isNotVerified(page)) {
							if (count > 0) {
								count--;
								const image = await page.$('img[alt="验证码"]');
								const codeInput = await page.$('[name="photoCode"]');
								if (image && codeInput) {
									await breakVerifyCode(page, image, codeInput, {
										ocrApiUrl: options.ocrApiUrl,
										ocrApiImageKey: options.ocrApiImageKey
									});
									await page.click('#btnLogin');
								}
							} else {
								throw new Error('验证码识别失败，请手动登录。');
							}
						}
					}
				}
			} catch (err) {
				ZJYLoginScript.emit('script-error', String(err));
			}
		}
	}
);

/** 是否未通过验证 */
async function isNotVerified(page: Page) {
	await page.waitForTimeout(2000);

	const errors = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.xcConfirm .txtBox'))
			.map((e) => e.textContent || '')
			.filter(Boolean)
	);

	if (errors.some((e) => e.includes('验证码输入错误'))) {
		// 点击确认
		await page.click('.xcConfirm .ok');
		return true;
	}

	if (errors.length) {
		throw new Error(errors.join('\n'));
	}

	return page.url().includes('login.html');
}

async function isNotLogin(page: Page) {
	await page.goto('https://zjy2.icve.com.cn/student/studio/studio.html');
	await page.waitForTimeout(2000);
	return page.url().includes('login.html');
}

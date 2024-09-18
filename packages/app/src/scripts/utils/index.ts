import type { ElementHandle, Page } from 'playwright-core';
import axios from 'axios';

/** 缓慢输入 */
export function slowType(page: Page, selector: string, text: string) {
	return page.type(selector, text, { delay: 100 });
}

/** 验证码破解 */
export async function breakVerifyCode(
	page: Page,
	imageElement: ElementHandle<any>,
	inputElement: ElementHandle<any>,
	options: { ocrApiUrl: string; ocrApiImageKey: string }
) {
	const box = await imageElement.boundingBox();
	if (box) {
		/** 请求验证码破解接口 */
		const body = Object.create([]);
		const buffer = await page.screenshot({ clip: box });
		Reflect.set(body, options.ocrApiImageKey, buffer.toString('base64'));
		const {
			data: { code, canOCR, error }
		} = await axios.post(options.ocrApiUrl, body);
		if (canOCR) {
			/** 破解验证码 */
			if (code) {
				await inputElement.fill(code);
			} else if (error) {
				throw new Error(error);
			}
		} else {
			throw new Error('未检测到图片验证码识别模块, 请手动输入验证码，或在软件左侧应用中心安装识别模块后重启浏览器。。');
		}
	}
}

/** 滑块验证码破解 */
export async function breakSliderVerify(
	page: Page,
	/**
	 * 滑块目标元素
	 */
	det_slider_el: ElementHandle<SVGElement | HTMLElement>,
	/**
	 * 拼图元素
	 */
	det_target_base64: string,
	/**
	 * 滑块背景元素
	 */
	det_bg_base64: string,
	opts: { ocrApiUrl: string; detTargetKey: string; detBackgroundKey: string; offset?: number }
) {
	const body = Object.create({});
	Reflect.set(body, opts.detTargetKey, det_target_base64);
	Reflect.set(body, opts.detBackgroundKey, det_bg_base64);

	const data = await axios.post(opts.ocrApiUrl, body);
	console.log('slider ocr', JSON.stringify(data?.data));

	if (data?.data?.error) {
		console.error(data.data.error);
	} else {
		if (data?.data?.canOCR) {
			/** 破解滑块验证码 */
			const result: { target_y: number; target: number[] } = data?.data?.det;

			if (result) {
				const bg_rect = await det_slider_el.evaluate((node) => node.getBoundingClientRect());
				const x1 = bg_rect.x;
				const y1 = bg_rect.y;
				const x2 = bg_rect.x + result.target[0] + (opts.offset ?? 0);
				const y2 = bg_rect.y;

				console.log('slider ocr', { x1, y1, x2, y2, offset: opts.offset ?? 0 });

				await page.mouse.move(x1, y1);
				await page.mouse.down();
				await page.mouse.down();
				await page.mouse.move(x2, y2, { steps: 10 });
				await page.mouse.up();

				try {
					await page.waitForNavigation({ timeout: 3000, waitUntil: 'domcontentloaded' });
				} catch {}
			} else {
				console.error(`OCR_DET: `, {
					data,
					opts,
					det_target_base64: det_target_base64.length,
					det_bg_base64: det_bg_base64.length
				});
				throw new Error('滑块验证识别失败，请尝试手动登录。');
			}
		} else {
			throw new Error('未检测到图片验证码识别模块, 请手动输入验证码，或在软件左侧应用中心安装识别模块后重启浏览器。');
		}
	}
}

export function getBase64(url: string) {
	return axios
		.get(url, {
			responseType: 'arraybuffer'
		})
		.then((response) => Buffer.from(response.data, 'binary').toString('base64'));
}

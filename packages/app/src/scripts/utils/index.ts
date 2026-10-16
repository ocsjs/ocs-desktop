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
			responseType: 'arraybuffer',
			// 10s 超时：滑块背景图等外部资源在弱网环境下避免无限挂起
			timeout: 10 * 1000
		})
		.then((response) => Buffer.from(response.data, 'binary').toString('base64'));
}

/**
 * 确保页面拥有足够宽的视口，以便登录页按「桌面布局」完整显示。
 *
 * 为什么需要：超星/智慧树/智慧职教/职教云/MOOC 等登录页均为固定宽度的桌面布局。
 * 视口过窄（小屏、系统缩放后的默认窗口等）时页面既不会收缩变形、也不提供横向滚动，
 * 表单/登录按钮等关键元素会被裁在可视区外 —— Playwright 点击前的自动滚动
 * 「找不到可滚动的空间」而失败，表现为元素未显示、点不到；手动拉宽窗口后布局
 * 恢复、元素才可见可点（已用多分辨率实测复现）。
 *
 * 本函数只放大、不缩小，失败时静默返回（尽力而为）：
 * - 带显式 viewport 的上下文（headless 等）：直接 setViewportSize；
 * - 真实浏览器窗口（persistent context + viewport:null）：通过 CDP 调大窗口 bounds。
 *
 * 建议在 run() 内导航登录页之前调用。
 */
export async function ensureWideViewport(page: Page, minCssW = 1280, minCssH = 720): Promise<void> {
	// 真实窗口的 viewportSize() 为 null（视口跟随窗口）；仅在上下文显式设置了 viewport 时才可 setViewportSize
	const cur = page.viewportSize();
	if (cur?.width) {
		if (cur.width >= minCssW) return;
		try {
			await page.setViewportSize({ width: minCssW, height: Math.max(cur.height, minCssH) });
			await page.waitForTimeout(150);
		} catch {
			// setViewportSize 不支持时（如 viewport:null 窗口）回退到下面 CDP 调整窗口
		}
		return;
	}

	// 有头真实窗口：用 CDP 调整窗口 bounds（单位为 DIP，与页面 CSS 像素一致）
	try {
		const cdp = await page.context().newCDPSession(page);
		// Browser.getWindowForTarget 不传 targetId 时作用于当前 CDP session 所在 target
		const { windowId } = await cdp.send('Browser.getWindowForTarget');
		const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
		const bw = bounds?.width || 0;
		const bh = bounds?.height || 0;
		if (bw >= minCssW) return;
		const avail = await page.evaluate(() => ({ w: screen.availWidth, h: screen.availHeight }));
		const nextW = Math.min(minCssW, avail.w);
		const nextH = Math.max(bh, Math.min(minCssH, avail.h));
		if (nextW <= bw && nextH <= bh) return;
		await cdp.send('Browser.setWindowBounds', {
			windowId,
			bounds: { ...bounds, width: nextW, height: nextH, windowState: 'normal' }
		});
		await page.waitForTimeout(200);
	} catch {
		// 无 CDP 权限时静默跳过，交由后续交互兜底
	}
}

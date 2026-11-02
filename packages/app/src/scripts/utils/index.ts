import type { ElementHandle, Frame, Page } from 'playwright-core';
import axios from 'axios';

/** 缓慢输入 */
export function slowType(page: Page, selector: string, text: string) {
	return page.type(selector, text, { delay: 100 });
}

/** OCR 手动模式选项：由 worker 按用户选择注入 */
export interface OcrManualOption {
	/** 手动模式：未安装识别模块时不报错，改为提示人工干预（模块已安装时仍走 OCR 识别） */
	ocrManual?: boolean;
	/** 检测到验证码时的人工干预提示回调（worker 节流后上报渲染端） */
	onManualCaptcha?: () => void;
}

/**
 * OCR 缺失时的手动模式门控：识别模块未安装（canOCR=false）且用户已开启手动模式时，
 * 触发人工干预提示并返回 true——调用方应跳过本次 OCR 尝试、等待用户手动完成；
 * 返回 false 时调用方走原有报错逻辑。
 */
export function handleOcrMissing(opts: OcrManualOption): boolean {
	if (opts.ocrManual) {
		opts.onManualCaptcha?.();
		return true;
	}
	return false;
}

/** 在页面坐标处绘制点击标记（红色圆圈扩散淡出，可视化点击提示；静默容错） */
export async function showClickDot(page: Page | Frame, x: number, y: number) {
	await page
		.evaluate(
			({ x, y }) => {
				// evaluate 回调被序列化到页面执行，无法引用模块作用域，样式内联
				const ripple = document.createElement('div');
				/* eslint-disable max-len */
				ripple.style.cssText = `position:fixed;left:${x - 22}px;top:${
					y - 22
				}px;width:44px;height:44px;border-radius:50%;border:3px solid #ff5722;background:rgba(255,87,34,0.28);z-index:2147483647;pointer-events:none;transform:scale(0.3);transition:transform 0.45s ease-out,opacity 0.55s ease-out;`;
				/* eslint-enable max-len */
				(document.body || document.documentElement).appendChild(ripple);
				// 强制 reflow 触发过渡动画：后台标签页 rAF 被节流（自动化页面常非活动标签），
				// 读取布局属性强制回流后改样式，transition 不依赖 rAF
				ripple.getBoundingClientRect();
				ripple.style.transform = 'scale(1.5)';
				ripple.style.opacity = '0';
				setTimeout(() => ripple.remove(), 700);
			},
			{ x, y }
		)
		.catch(() => {});
}

/**
 * 可视化点击元素句柄：滚动到可视区 + 涟漪提示 + 真实点击（句柄版 visualClick）。
 * 句柄失效/定位失败时静默回退为直接点击（不影响业务流程）。
 */
export async function visualClickElement(
	page: Page | Frame,
	el: ElementHandle,
	opts?: Parameters<ElementHandle['click']>[0]
) {
	try {
		await el.scrollIntoViewIfNeeded().catch(() => {});
		const box = await el.boundingBox();
		if (box) {
			await showClickDot(page, box.x + box.width / 2, box.y + box.height / 2);
			// 涟漪动画展示片刻再真实点击，避免一闪而过
			await page.waitForTimeout(350);
		}
	} catch {}
	await el.click(opts);
}

/**
 * 可视化点击：点击前在目标元素中心绘制红色圆圈提示（点击位置反馈，提升交互感知）。
 * 圆圈动画展示后执行真实点击；定位/绘制失败时静默回退为直接点击（不影响业务流程）。
 */
export async function visualClick(page: Page | Frame, selector: string, opts?: Parameters<Page['click']>[1]) {
	try {
		const el = await page.waitForSelector(selector, { timeout: opts?.timeout ?? 3000 });
		if (el) {
			await el.scrollIntoViewIfNeeded().catch(() => {});
			const box = await el.boundingBox();
			if (box) {
				await page
					.evaluate(
						({ x, y }) => {
							// evaluate 回调被序列化到页面执行，无法引用模块作用域，样式内联
							const ripple = document.createElement('div');
							/* eslint-disable max-len */
							ripple.style.cssText = `position:fixed;left:${x - 22}px;top:${
								y - 22
							}px;width:44px;height:44px;border-radius:50%;border:3px solid #ff5722;background:rgba(255,87,34,0.28);z-index:2147483647;pointer-events:none;transform:scale(0.3);transition:transform 0.45s ease-out,opacity 0.55s ease-out;`;
							/* eslint-enable max-len */
							(document.body || document.documentElement).appendChild(ripple);
							// 强制 reflow 触发过渡动画：后台标签页 rAF 被节流（自动化页面常非活动标签），
							// 读取布局属性强制回流后改样式，transition 不依赖 rAF
							ripple.getBoundingClientRect();
							ripple.style.transform = 'scale(1.5)';
							ripple.style.opacity = '0';
							setTimeout(() => ripple.remove(), 700);
						},
						{ x: box.x + box.width / 2, y: box.y + box.height / 2 }
					)
					.catch(() => {});
				// 圆圈动画展示片刻再真实点击，避免一闪而过
				await page.waitForTimeout(350);
			}
		}
	} catch {}
	await page.click(selector, opts);
}

/** 验证码破解 */
export async function breakVerifyCode(
	page: Page,
	imageElement: ElementHandle<any>,
	inputElement: ElementHandle<any>,
	options: { ocrApiUrl: string; ocrApiImageKey: string } & OcrManualOption
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
			// 手动模式：提示人工干预并跳过（等待用户手动完成），不再报错
			if (handleOcrMissing(options)) return;
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
	opts: { ocrApiUrl: string; detTargetKey: string; detBackgroundKey: string; offset?: number } & OcrManualOption
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
			// 手动模式：提示人工干预并跳过（等待用户手动完成），不再报错
			if (handleOcrMissing(opts)) return;
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

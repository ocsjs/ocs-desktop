import { Page } from 'playwright-core';
import axios from 'axios';
import { AutomationScript } from '@ocs-desktop/common';
import { ensureWideViewport, getBase64 } from '../../utils';

/** 智慧职教 SSO 登录地址 */
const LOGIN_URL = 'https://sso.icve.com.cn/sso/auth?mode=simple&source=2&redirect=https://mooc.icve.com.cn/cms/';

/**
 * 表单与阿里云滑块验证码（aliyunCaptcha）选择器（已通过 Playwright MCP 实测）：
 * - 表单：input[placeholder="请输入账号/密码"]、.agreement label.el-checkbox、form .login
 * - 弹窗：#aliyunCaptcha-window-popup（class=window-show / display:block 时可见）
 * - 背景图：#aliyunCaptcha-img（跨域 CDN URL，自然宽 296 显示 300）
 * - 拼图：#aliyunCaptcha-puzzle（跨域 CDN URL，初始 left:0 与背景图左缘对齐，图形在 img 内左边距恒 2px）
 * - 滑块：#aliyunCaptcha-sliding-slider（40x40，轨道 300px，初始位于轨道左端）
 */
const SEL = {
	username: 'input[placeholder="请输入账号"]',
	password: 'input[placeholder="请输入密码"]',
	agreement: '.agreement label.el-checkbox',
	submit: 'form .login',
	captchaPopup: '#aliyunCaptcha-window-popup',
	captchaBg: '#aliyunCaptcha-img',
	captchaPiece: '#aliyunCaptcha-puzzle',
	captchaSlider: '#aliyunCaptcha-sliding-slider',
	captchaRefresh: '#aliyunCaptcha-btn-refresh',
	captchaClose: '#aliyunCaptcha-btn-close'
};

/** 验证码就绪提示文本；出现其它文本（验证错误/速度过快等）视为本次失败 */
const CAPTCHA_READY_TEXT = '拖动滑块完成拼图';

/** 拼图图形在 shadow.png 内的左边距（MCP 实测恒约 2px；跨域图无法 canvas 分析，故用常量） */
const PIECE_PAD = 2;

export interface OCROptions {
	ocrApiUrl?: string;
	detTargetKey?: string;
	detBackgroundKey?: string;
}

export const ICVELoginScript = new AutomationScript(
	{
		username: {
			label: '账号',
			value: '',
			type: 'text',
			required: true,
			placeholder: '请输入账号'
		},
		password: {
			label: '密码',
			value: '',
			type: 'password',
			required: true,
			placeholder: '请输入密码'
		}
	},
	{
		name: '智慧职教-自动账号密码登录',
		icon: 'https://www.icve.com.cn/',
		// 登录流程含验证码破解（breakVerifyCode/breakSliderVerify），依赖 OCR 识别模块
		needOCR: true,
		async run(page, configs, options?: OCROptions) {
			try {
				// 登录页为固定宽度桌面布局，窄视口下关键元素会被裁出可视区，先确保窗口足够宽
				await ensureWideViewport(page);
				// 已登录则跳过
				if (!(await isNotLogin(page))) return;

				await page.fill(SEL.username, configs.username);
				await page.fill(SEL.password, configs.password);
				await checkAgreement(page);

				// 点击登录，弹出阿里云滑块验证码（或直接提交成功）
				await page.click(SEL.submit);

				if (options?.ocrApiUrl && options?.detTargetKey && options?.detBackgroundKey) {
					await loopVerify(page, {
						ocrApiUrl: options.ocrApiUrl,
						detTargetKey: options.detTargetKey,
						detBackgroundKey: options.detBackgroundKey
					});
				} else {
					const err = await waitForLoginResult(page);
					if (err) ICVELoginScript.emit('script-error', err);
				}
			} catch (err) {
				ICVELoginScript.emit('script-error', getErrorMessage(err));
			}
		}
	}
);

/**
 * 访问 SSO 登录页后若 URL 仍包含 sso/auth，视为未登录
 */
async function isNotLogin(page: Page): Promise<boolean> {
	await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 15 * 1000 }).catch(() => {});
	// 等待表单渲染完成
	await page.waitForSelector(SEL.username, { timeout: 15000 }).catch(() => {});
	return page.url().includes('sso/auth');
}

/**
 * 幂等勾选用户协议：仅在未勾选时点击，避免重复点击导致反勾
 */
async function checkAgreement(page: Page): Promise<void> {
	const checked = await page
		.locator(SEL.agreement)
		.first()
		.evaluate((el) => el.classList.contains('is-checked'))
		.catch(() => false);
	if (!checked) await page.click(SEL.agreement);
}

/**
 * 循环进行滑块验证，直至登录成功或次数耗尽。
 * 每次滑块验证完成后立即检测 el-dialog 错误弹窗（账号不存在/密码错误等），
 * 命中则直接抛错终止重试，不再进入下一轮。
 */
async function loopVerify(
	page: Page,
	opts: Required<Pick<OCROptions, 'ocrApiUrl' | 'detTargetKey' | 'detBackgroundKey'>>
) {
	let count = 5;
	let first = true;
	while (await isNotVerified(page)) {
		if (count > 0) {
			count--;
			if (first) {
				// 首次：等待验证码弹窗出现
				first = false;
				await waitForCaptcha(page);
			} else if (await isCaptchaVisible(page)) {
				// 重试：刷新换图；刷新无效则关闭弹窗重新触发
				await tryRefreshCaptcha(page);
			} else {
				// 弹窗被关闭：重新点击登录触发新验证码
				await page.click(SEL.submit).catch(() => {});
				await waitForCaptcha(page);
			}
			await verify(page, opts);
			// 滑块完成后立即检测错误弹窗，有则直接抛出终止重试
			const dialogErr = await readDialogError(page);
			if (dialogErr) throw new Error(dialogErr);
			await page.waitForTimeout(1500);
		} else {
			throw new Error('滑块识别失败，请手动登录。');
		}
	}
}

/** 阿里云验证码弹窗是否可见 */
async function isCaptchaVisible(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const el = document.getElementById('aliyunCaptcha-window-popup');
		return !!el && !!(el.offsetWidth || el.offsetHeight);
	});
}

/** 轮询等待验证码弹窗出现，最多约 8s */
async function waitForCaptcha(page: Page): Promise<boolean> {
	for (let i = 0; i < 20; i++) {
		if (await isCaptchaVisible(page)) return true;
		await page.waitForTimeout(400);
	}
	return false;
}

/**
 * 刷新验证码。阿里云 captcha 刷新按钮偶发不换图（实测 CertifyId 变化但图不变），
 * 此时关闭弹窗重新点击登录以获取全新验证码。
 */
async function tryRefreshCaptcha(page: Page): Promise<void> {
	const getBgSrc = () =>
		page.evaluate(() => (document.getElementById('aliyunCaptcha-img') as HTMLImageElement | null)?.src || '');
	const before = await getBgSrc();
	await page.click(SEL.captchaRefresh).catch(() => {});
	await page.waitForTimeout(800);
	if ((await getBgSrc()) === before) {
		await page.click(SEL.captchaClose).catch(() => {});
		await page.waitForTimeout(300);
		await page.click(SEL.submit).catch(() => {});
		await waitForCaptcha(page);
	}
}

/**
 * 滑块验证：
 * 1. 取背景图与拼图原图（toBase64：data URL 直接截取，跨域 CDN 用 Node 侧下载）
 * 2. ddddocr 返回缺口在背景图「自然像素」中的 x → 乘 scale 换算为 CSS 位移
 * 3. 扣除拼图图形左边距（固定常量 PIECE_PAD），得到拼图目标位移
 * 4. 闭环伺服拖动：以拼图实际位置为反馈逐步逼近（阿里云联动是非线性曲线，不能按固定比例换算）
 */
async function verify(page: Page, opts: Required<Pick<OCROptions, 'ocrApiUrl' | 'detTargetKey' | 'detBackgroundKey'>>) {
	const bgEl = await page.$(SEL.captchaBg);
	const pzEl = await page.$(SEL.captchaPiece);
	const sliderEl = await page.$(SEL.captchaSlider);
	if (!bgEl || !pzEl || !sliderEl) return;

	// 等待图片加载完成
	await Promise.all([bgEl.evaluate(waitImgLoaded), pzEl.evaluate(waitImgLoaded)]);

	const bgSrc = await bgEl.getAttribute('src');
	const pzSrc = await pzEl.getAttribute('src');
	if (!bgSrc || !pzSrc) return;

	// 调用本地 ddddocr 识别缺口位置（target/bg 原图 base64）。
	// 图片 src 可能是 data URL（直接截取）或跨域 CDN URL（Node 侧下载）；
	// 浏览器内 canvas 分析跨域图会触发 SecurityError，故不依赖页面像素读取
	const body = Object.create({});
	Reflect.set(body, opts.detTargetKey, await toBase64(pzSrc));
	Reflect.set(body, opts.detBackgroundKey, await toBase64(bgSrc));
	const { data } = await axios.post(opts.ocrApiUrl, body);

	if (data?.error) throw new Error(getErrorMessage(data.error));
	if (!data?.canOCR) {
		throw new Error('未检测到图片验证码识别模块，请手动输入验证码，或在软件左侧应用中心安装识别模块后重启浏览器。');
	}
	const targetX = Number(data?.det?.target?.[0]);
	if (!Number.isFinite(targetX)) {
		throw new Error('滑块验证识别失败，请尝试手动登录。');
	}

	// 几何换算：缺口位移（相对背景图左缘）= 自然像素 x * scale；再扣除拼图图形左边距（固定常量）。
	// 注意：#aliyunCaptcha-puzzle 的 style.left 即「相对背景图左缘的位移」，与此直接对齐。
	const bgGeom = await bgEl.evaluate((node) => {
		const b = node as HTMLImageElement;
		const r = b.getBoundingClientRect();
		return { naturalW: b.naturalWidth || r.width, displayW: r.width };
	});
	const bgScale = bgGeom.displayW / bgGeom.naturalW || 1;
	const pzScale = await pzEl.evaluate((node) => {
		const img = node as HTMLImageElement;
		const r = img.getBoundingClientRect();
		return r.width / (img.naturalWidth || r.width) || 1;
	});
	const targetPieceLeft = targetX * bgScale - PIECE_PAD * pzScale;

	// 滑块按钮起点（中心）
	const handleRect = await sliderEl.evaluate((node) => {
		const r = (node as HTMLElement).getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
	});

	// 闭环伺服拖动：拖一步 → 读拼图实际位移 → 算残差 → 再补正。
	// 阿里云滑块联动为非线性曲线（实测滑块走 100px 拼图仅走 43px），固定比例换算必然滞后；
	// 伺服以拼图实际位置为反馈，无论联动曲线如何都收敛到目标。
	await servoDrag(page, handleRect.x, handleRect.y, targetPieceLeft);

	try {
		await page.waitForNavigation({ timeout: 3000, waitUntil: 'domcontentloaded' });
	} catch {}
}

function waitImgLoaded(img: HTMLImageElement) {
	if (img.complete && img.naturalWidth > 0) return;
	return new Promise<void>((resolve) => {
		img.onload = () => resolve();
		img.onerror = () => resolve();
	});
}

/** 图片 src 转纯 base64：data URL 直接截取；http(s) URL 用 Node 侧下载（浏览器内读跨域图受限） */
async function toBase64(src: string): Promise<string> {
	if (src.startsWith('data:')) {
		const i = src.indexOf(',');
		return i >= 0 ? src.slice(i + 1) : src;
	}
	return getBase64(src);
}

/** 统一提取可读错误消息：兼容 Error / 字符串 / 对象（如 OCR 服务返回的原始错误对象） */
function getErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	if (err && typeof err === 'object') {
		const msg = (err as { message?: unknown }).message;
		if (typeof msg === 'string' && msg) return msg;
		try {
			return JSON.stringify(err);
		} catch {}
	}
	return String(err);
}

/**
 * 闭环伺服拖动滑块（按住不放）：
 * - 每一步把滑块移动到预估位置，读取拼图实际位移（style.left）计算残差，再增量补正；
 * - 自适应步长：残差大快拖（12px）、中等 8px、接近目标微调（2px）；
 * - 保护：到位（≤2px）/ 滑块到行程尽头（260px）/ 拼图卡住不动 / 迭代上限 60。
 * 附带轻微纵向抖动，轨迹类似真人先快后慢找位置。
 */
async function servoDrag(page: Page, sx: number, sy: number, targetPieceLeft: number) {
	const MAX_SLIDER = 260; // 轨道 300 - 滑块 40
	await page.mouse.move(sx, sy);
	await page.mouse.down();

	let sliderLeft = 0;
	let pieceLeft = 0;
	let lastResidual = NaN;
	let stuck = 0;
	for (let i = 0; i < 60; i++) {
		const residual = targetPieceLeft - pieceLeft;
		if (Math.abs(residual) <= 2) break; // 到位（阿里云判定容差）
		if (sliderLeft >= MAX_SLIDER) break; // 行程尽头，拼图走不动了
		if (Math.abs(residual - lastResidual) < 0.01) {
			if (++stuck > 4) break; // 拼图卡住（联动失效）
		} else {
			stuck = 0;
		}
		const step = Math.abs(residual) > 50 ? 12 : Math.abs(residual) > 15 ? 8 : 2;
		const next = Math.min(MAX_SLIDER, Math.max(0, sliderLeft + Math.sign(residual) * step));
		if (next === sliderLeft) break;
		sliderLeft = next;
		await page.mouse.move(sx + sliderLeft, sy + Math.sin(i * 0.8));
		await page.waitForTimeout(50); // 等联动 JS 更新拼图位置
		pieceLeft = await readPieceLeft(page);
		lastResidual = residual;
	}
	await page.mouse.up();
}

/** 读拼图当前位移（#aliyunCaptcha-puzzle 的 style.left，相对背景图左缘） */
function readPieceLeft(page: Page) {
	return page.evaluate(() => {
		const el = document.getElementById('aliyunCaptcha-puzzle');
		return el ? parseFloat((el as HTMLElement).style.left) || 0 : 0;
	});
}

/**
 * 读取可见的 el-dialog 错误弹窗文本（滑块验证通过后服务端校验账号/密码失败时弹出，
 * 如"hjgjhg不存在，请确认后登录或者注册！"）。
 * 立即首查；未命中则每 300ms 轮询直到出现或超时（弹窗有几百 ms 延迟）。
 * 返回错误文本（过滤空文本与"成功"提示）或 null。
 */
async function readDialogError(page: Page, timeoutMs = 2000): Promise<string | null> {
	const start = Date.now();
	while (true) {
		const err = await page.evaluate(() => {
			for (const dialog of Array.from(document.querySelectorAll('.el-dialog'))) {
				// 过滤隐藏实例（Element UI 隐藏时 display:none）
				const el = dialog as HTMLElement;
				if (!el.offsetWidth && !el.offsetHeight) continue;
				const body = dialog.querySelector('.el-dialog__body');
				const text = (body?.textContent || '').trim();
				if (text && !text.includes('成功')) return text;
			}
			return null;
		});
		if (err) return err;
		if (Date.now() - start >= timeoutMs) return null;
		await page.waitForTimeout(300);
	}
}

/**
 * 是否尚未通过验证（true = 继续循环重试）。
 * - URL 离开 SSO 页面 → 已通过
 * - 存在表单错误提示（账号/密码错误等）→ 直接抛错
 * - 验证码弹窗提示非默认文本（验证失败/速度过快）→ 重试
 */
async function isNotVerified(page: Page): Promise<boolean> {
	await page.waitForTimeout(2000);

	// 表单错误提示（账号密码错误等）
	const errors = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.el-message__content, .el-form-item__error'))
			.map((e) => e.textContent || '')
			.filter((text) => text && !text.includes('成功'))
	);
	if (errors.length) throw new Error(errors.join('\n'));

	const captcha = await page.evaluate(() => {
		const popup = document.getElementById('aliyunCaptcha-window-popup');
		const visible = !!popup && !!(popup.offsetWidth || popup.offsetHeight);
		const text = document.getElementById('aliyunCaptcha-sliding-text')?.textContent?.trim() || '';
		return { visible, text };
	});
	// 弹窗提示非默认文本 → 本次验证失败，返回 true 触发重试
	if (captcha.visible && captcha.text && captcha.text !== CAPTCHA_READY_TEXT) {
		return true;
	}
	return page.url().includes('sso/auth');
}

/**
 * 未安装识别模块时的兜底：等待登录结果并给出可操作的错误提示
 */
async function waitForLoginResult(page: Page): Promise<string | null> {
	const start = Date.now();
	while (Date.now() - start < 8000) {
		if (!page.url().includes('sso/auth')) return null; // 登录成功
		if (await isCaptchaVisible(page)) {
			return '触发安全验证（滑动拼图验证码），请手动完成验证后再次执行任务';
		}
		await page.waitForTimeout(300);
	}
	const dialogErr = await readDialogError(page, 1500);
	if (dialogErr) return `登录失败：${dialogErr}`;
	const errText = await page
		.locator('.el-message__content, .el-form-item__error')
		.first()
		.textContent({ timeout: 1000 })
		.catch(() => '');
	if (errText?.trim()) return `登录失败：${errText.trim()}`;
	return '登录未成功，请检查账号、密码或网络后重试';
}

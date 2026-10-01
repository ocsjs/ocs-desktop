import { Frame, Page } from 'playwright-core';
import axios from 'axios';
import { AutomationScript } from '@ocs-desktop/common';
import { ensureWideViewport, getBase64 } from '../../utils';

/** 中国大学MOOC 首页 */
const HOME_URL = 'https://www.icourse163.org/';

/**
 * 登录相关选择器（已通过本地 Playwright 实测）：
 * - 隐私弹窗：#privacy-ok（首页首访弹出，需点击同意）
 * - 登录入口：.navLoginBtn（未登录时显示「登录 | 注册」）
 * - 模态框：.ux-modal.web-login-modal，顶部 tab 为 ul.ux-tabs-underline_hd li（手机号/邮箱/爱课程）
 * - 手机/邮箱登录表单在跨域 iframe（reg.icourse163.org/webzj/.../index_dl2_new.html）中：
 *   - 手机：父容器 .ux-login-urs-phone-wrap，输入 #phoneipt + 密码框
 *   - 邮箱：父容器 .ux-urs-login-urs-tabs_ui-box 内非 tab-hide 容器，输入 .j-inputtext.dlemail.j-nameforslide + .j-inputtext.dlpwd
 * - 提交：a.u-loginbtn
 * - 网易易盾行为式滑块（提交后内嵌 .cap-box 替换表单区域）：
 *   - 背景图 img.yidun_bg-img（250x125，普通 URL）
 *   - 拼图 img.yidun_jigsaw（47x125，初始 left:0 与背景图左缘对齐）
 *   - 滑块 .yidun_slider（40x38，轨道 250px，行程约 210px）
 * - 错误提示：.m-nerror（URS 表单错误）
 */
const SEL = {
	privacyOk: '#privacy-ok',
	loginBtn: '.navLoginBtn',
	phoneTab: 'ul.ux-tabs-underline_hd li:nth-child(1)',
	mailTab: 'ul.ux-tabs-underline_hd li:nth-child(2)',
	phoneFrame: '.ux-login-urs-phone-wrap iframe',
	mailFrame: '.ux-urs-login-urs-tabs_ui-box > .ux-login-set-container:not(.tab-hide) iframe',
	phoneInput: '#phoneipt',
	phonePwd: 'input.j-inputtext.dlemail',
	mailInput: '.j-inputtext.dlemail.j-nameforslide',
	mailPwd: '.j-inputtext.dlpwd',
	submit: 'a.u-loginbtn',
	yidun: '.yidun',
	captchaBg: '.yidun_bg-img',
	captchaPiece: '.yidun_jigsaw',
	captchaSlider: '.yidun_slider',
	captchaRefresh: '.yidun_refresh',
	captchaClose: '.cap-box [class*=close]',
	errBox: '.m-nerror'
};

/** 易盾滑块就绪提示文本；出现其它文本（验证失败/操作过快等）视为本次失败 */
const CAPTCHA_READY_TEXT = '向右拖动滑块填充拼图';

/** 拼图图形在 jigsaw.png 内的左边距（ddddocr 返回缺口 box 左边缘，拼图图形基本占满 47px，实测可调） */
const PIECE_PAD = 0;

/** 易盾滑块行程：轨道 250 - 滑块 40 */
const MAX_SLIDER = 210;

export interface OCROptions {
	ocrApiUrl?: string;
	detTargetKey?: string;
	detBackgroundKey?: string;
}

export const ICourseLoginScript = new AutomationScript(
	{
		username: {
			label: '手机号/邮箱',
			value: '',
			type: 'text',
			required: true,
			placeholder: '请输入手机号或邮箱',
			pattern: '^(1[3-9]\\d{9}|[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+)$',
			patternMessage: '请输入正确的手机号或邮箱'
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
		name: '中国大学MOOC-自动账号登录',
		icon: 'https://www.icourse163.org/',
		async run(page, configs, options?: OCROptions) {
			try {
				// 登录页为固定宽度桌面布局，窄视口下关键元素会被裁出可视区，先确保窗口足够宽
				await ensureWideViewport(page);
				// 已登录则跳过
				if (!(await isNotLogin(page))) return;

				// 同意隐私协议（幂等），打开登录模态框
				await agreePrivacy(page);
				await openLoginModal(page);

				// 判断账号类型：手机号 / 邮箱
				const username = configs.username.trim();
				const isPhone = /^1\d{10}$/.test(username);
				if (!isPhone && !/@/.test(username)) {
					throw new Error('请输入正确的手机号或邮箱账号');
				}
				await switchTab(page, isPhone ? 'phone' : 'mail');

				// 定位登录表单 iframe 并填充
				const frame = await getLoginFrame(page, isPhone ? 'phone' : 'mail');
				if (!frame) throw new Error('未找到登录表单，请重试');

				const inputSel = isPhone ? SEL.phoneInput : SEL.mailInput;
				const pwdSel = isPhone ? SEL.phonePwd : SEL.mailPwd;
				await frame.fill(inputSel, username);
				await frame.fill(pwdSel, configs.password);

				// 点击登录，触发网易易盾滑块验证（或直接提交成功）
				await frame.click(SEL.submit);

				if (options?.ocrApiUrl && options?.detTargetKey && options?.detBackgroundKey) {
					await loopVerify(page, frame, {
						ocrApiUrl: options.ocrApiUrl,
						detTargetKey: options.detTargetKey,
						detBackgroundKey: options.detBackgroundKey
					});
				} else {
					const err = await waitForLoginResult(page, frame);
					if (err) ICourseLoginScript.emit('script-error', err);
				}
			} catch (err) {
				ICourseLoginScript.emit('script-error', getErrorMessage(err));
			}
		}
	}
);

/**
 * 访问首页后若「登录 | 注册」按钮仍可见，视为未登录。
 * 已登录时导航栏显示用户信息，无 .navLoginBtn。
 */
async function isNotLogin(page: Page): Promise<boolean> {
	// commit：导航提交即返回，不等待 domcontentloaded——
	// React SPA 首屏在真实环境（扩展注入/网络波动）可能十余秒，等待其完成是「自动登录开始前等 20s」的主因之一
	await page.goto(HOME_URL, { waitUntil: 'commit', timeout: 15000 }).catch(() => {});
	// 页面为 React SPA，导航栏由 JS 动态渲染：等待导航容器或登录按钮任一出现，
	// 避免 bundle 未执行时误判（已登录无按钮）/ 干等到超时
	await Promise.race([
		page.waitForSelector('.web-nav-container', { timeout: 8000 }),
		page.waitForSelector(SEL.loginBtn, { timeout: 8000 })
	]).catch(() => {});
	// 导航渲染完成后，登录按钮应在短时间内可见
	try {
		await page.waitForSelector(SEL.loginBtn, { timeout: 3000 });
		return true;
	} catch {
		return false;
	}
}

/** 登录模态框是否可见（evaluate 快速失败，避免默认 30s 等待不存在的元素） */
function isModalOpen(page: Page): Promise<boolean> {
	return page
		.locator('.ux-modal.web-login-modal')
		.first()
		.evaluate((el) => !!(el as HTMLElement).offsetWidth || !!(el as HTMLElement).offsetHeight, undefined, {
			timeout: 500
		})
		.catch(() => false);
}

/** 同意隐私协议（幂等）：首次访问弹出 #privacy-ok，已同意过则元素不存在 */
async function agreePrivacy(page: Page): Promise<void> {
	await page.evaluate(() => {
		const ok = document.getElementById('privacy-ok');
		if (ok) (ok as HTMLElement).click();
	});
	await page.waitForTimeout(500);
}

/** 打开登录模态框（幂等：已打开则跳过） */
async function openLoginModal(page: Page): Promise<void> {
	const opened = await isModalOpen(page);
	if (!opened) {
		// 先确认登录按钮存在（导航刚渲染完，最长等 5s），再点击；
		// 避免 waitForClickable 在按钮未就绪时空等 15s
		await page
			.locator(SEL.loginBtn)
			.first()
			.waitFor({ state: 'attached', timeout: 5000 })
			.catch(() => {});
		await page.click(SEL.loginBtn, { timeout: 5000, force: true }).catch(() => {});
	}
	// 轮询登录表单 iframe 出现（最多 10s）。
	// 用 page.$ + boundingBox 快速失败检查：locator.evaluate 会先等元素 attached（默认 30s），
	// iframe 未出现时会空等 30s 超时 —— 这是「登录模态框就绪 +30s」的根因。
	for (let i = 0; i < 20; i++) {
		const handle = await page.$(`${SEL.phoneFrame}, ${SEL.mailFrame}`).catch(() => null);
		if (handle) {
			const box = await handle.boundingBox().catch(() => null);
			if (box && box.width > 0) break;
		}
		await page.waitForTimeout(500);
	}
}

/**
 * 切换登录 tab（手机号/邮箱）。幂等：目标 tab 已激活（li.z-sel）则跳过。
 * tab 是父页面元素，点击后对应 iframe 显示/隐藏由页面 JS 控制。
 */
async function switchTab(page: Page, tab: 'phone' | 'mail'): Promise<void> {
	const sel = tab === 'phone' ? SEL.phoneTab : SEL.mailTab;
	const active = await page
		.locator(sel)
		.evaluate((el) => el.classList.contains('z-sel'), undefined, { timeout: 500 })
		.catch(() => false);
	if (!active) {
		await page.click(sel);
		await page.waitForTimeout(1200);
	}
}

/** 获取登录表单 iframe（按账号类型定位对应容器内的 iframe），并等待 iframe 内输入框可用 */
async function getLoginFrame(page: Page, tab: 'phone' | 'mail'): Promise<Frame | null> {
	const sel = tab === 'phone' ? SEL.phoneFrame : SEL.mailFrame;
	const handle = await page.$(sel).catch(() => null);
	if (!handle) return null;
	const frame = await handle.contentFrame().catch(() => null);
	if (!frame) return null;
	// 跨域 iframe 内部文档加载独立于父页面：以输入框可用为最终判据（最长 10s）
	try {
		const inputSel = tab === 'phone' ? SEL.phoneInput : SEL.mailInput;
		await frame.waitForSelector(inputSel, { timeout: 10000 });
	} catch {
		return null;
	}
	return frame;
}

/**
 * 循环进行易盾滑块验证，直至登录成功或次数耗尽。
 * 每次滑块完成后立即检测 URS 表单错误（账号不存在/密码错误等），
 * 命中则直接抛错终止重试，不再进入下一轮。
 */
async function loopVerify(
	page: Page,
	frame: Frame,
	opts: Required<Pick<OCROptions, 'ocrApiUrl' | 'detTargetKey' | 'detBackgroundKey'>>
) {
	let count = 5;
	let first = true;
	while (await isNotVerified(page, frame)) {
		if (count > 0) {
			count--;
			if (first) {
				// 首次：等待验证码出现
				first = false;
				await waitForCaptcha(frame);
			} else if (await isCaptchaVisible(frame)) {
				// 重试：刷新换图；刷新无效则关闭弹窗重新触发
				await tryRefreshCaptcha(page, frame);
			} else {
				// 弹窗被关闭：重新点击登录触发新验证码
				await frame.click(SEL.submit, { force: true }).catch(() => {});
				await waitForCaptcha(frame);
			}
			await verify(page, frame, opts);
			// 滑块完成后立即检测表单错误，有则直接抛出终止重试
			const formErr = await readFormError(frame);
			if (formErr) throw new Error(formErr);
			await page.waitForTimeout(1500);
		} else {
			throw new Error('滑块识别失败，请手动登录。');
		}
	}
}

/** 易盾滑块是否可见（.yidun 容器）；frame 已分离视为不可见 */
async function isCaptchaVisible(frame: Frame): Promise<boolean> {
	return frame
		.evaluate(() => {
			const el = document.querySelector('.yidun');
			return !!el && !!(el as HTMLElement).offsetWidth;
		})
		.catch(() => false);
}

/** 轮询等待易盾滑块出现，最多约 10s */
async function waitForCaptcha(frame: Frame): Promise<boolean> {
	for (let i = 0; i < 25; i++) {
		if (await isCaptchaVisible(frame)) return true;
		await frame.waitForTimeout(400).catch(() => {});
	}
	return false;
}

/**
 * 刷新验证码。易盾刷新按钮偶发不换图，此时关闭弹窗重新点击登录以获取全新验证码。
 */
async function tryRefreshCaptcha(page: Page, frame: Frame): Promise<void> {
	const getBgSrc = () =>
		frame
			.evaluate(() => (document.querySelector('.yidun_bg-img') as HTMLImageElement | null)?.src || '')
			.catch(() => '');
	const before = await getBgSrc();
	// click 默认 30s 等待：刷新/关闭按钮不存在时必须快速失败
	await frame.click(SEL.captchaRefresh, { timeout: 1500 }).catch(() => {});
	await frame.waitForTimeout(1000);
	if ((await getBgSrc()) === before) {
		await frame.click(SEL.captchaClose, { timeout: 1500 }).catch(() => {});
		await frame.waitForTimeout(400);
		await frame.click(SEL.submit, { force: true, timeout: 1500 }).catch(() => {});
		await waitForCaptcha(frame);
	}
}

/**
 * 滑块验证：
 * 1. 取背景图与拼图原图（普通 CDN URL，Node 侧下载转 base64）
 * 2. ddddocr 返回缺口在背景图「自然像素」中的 x → 乘 scale 换算为 CSS 位移
 * 3. 扣除拼图图形左边距（固定常量 PIECE_PAD），得到拼图目标位移
 * 4. 闭环伺服拖动：以拼图实际 style.left 为反馈逐步逼近（易盾联动 1:1，但伺服不依赖比例）
 */
async function verify(
	page: Page,
	frame: Frame,
	opts: Required<Pick<OCROptions, 'ocrApiUrl' | 'detTargetKey' | 'detBackgroundKey'>>
) {
	const bgEl = await frame.$(SEL.captchaBg);
	const pzEl = await frame.$(SEL.captchaPiece);
	const sliderEl = await frame.$(SEL.captchaSlider);
	if (!bgEl || !pzEl || !sliderEl) return;

	// 等待图片加载完成
	await Promise.all([bgEl.evaluate(waitImgLoaded), pzEl.evaluate(waitImgLoaded)]);

	const bgSrc = await bgEl.getAttribute('src');
	const pzSrc = await pzEl.getAttribute('src');
	if (!bgSrc || !pzSrc) return;

	// 调用本地 ddddocr 识别缺口位置（target/bg 原图 base64）
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

	// 几何换算：缺口位移（相对背景图左缘）= 自然像素 x * scale；再扣除拼图图形左边距
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

	// 滑块按钮起点（中心，页面坐标；boundingBox 已含 iframe 偏移）
	const handleRect = await sliderEl.evaluate((node) => {
		const r = (node as HTMLElement).getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
	});

	// 闭环伺服拖动：拖一步 → 读拼图实际位移 → 算残差 → 再补正
	await servoDrag(page, frame, handleRect.x, handleRect.y, targetPieceLeft);
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

/** 统一提取可读错误消息：兼容 Error / 字符串 / 对象 */
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
 * - 自适应步长：残差大快拖（10px）、中等 5px、接近目标微调（2px）；
 * - 保护：到位（≤2px）/ 滑块到行程尽头 / 拼图卡住不动 / 迭代上限 60。
 * 附带轻微纵向抖动，轨迹类似真人先快后慢找位置。
 */
async function servoDrag(page: Page, frame: Frame, sx: number, sy: number, targetPieceLeft: number) {
	await page.mouse.move(sx, sy);
	await page.mouse.down();

	let sliderLeft = 0;
	let pieceLeft = 0;
	let lastResidual = NaN;
	let stuck = 0;
	for (let i = 0; i < 60; i++) {
		const residual = targetPieceLeft - pieceLeft;
		if (Math.abs(residual) <= 2) break; // 到位
		if (sliderLeft >= MAX_SLIDER) break; // 行程尽头，拼图走不动了
		if (Math.abs(residual - lastResidual) < 0.01) {
			if (++stuck > 4) break; // 拼图卡住（联动失效）
		} else {
			stuck = 0;
		}
		const step = Math.abs(residual) > 40 ? 10 : Math.abs(residual) > 12 ? 5 : 2;
		const next = Math.min(MAX_SLIDER, Math.max(0, sliderLeft + Math.sign(residual) * step));
		if (next === sliderLeft) break;
		sliderLeft = next;
		await page.mouse.move(sx + sliderLeft, sy + Math.sin(i * 0.8));
		await frame.waitForTimeout(60); // 等联动 JS 更新拼图位置
		pieceLeft = await readPieceLeft(frame);
		lastResidual = residual;
	}
	await page.mouse.up();
}

/** 读拼图当前位移（img.yidun_jigsaw 的 style.left，相对背景图左缘）；frame 已分离返回 0 */
function readPieceLeft(frame: Frame) {
	return frame
		.evaluate(() => {
			const el = document.querySelector('.yidun_jigsaw') as HTMLElement | null;
			return el ? parseFloat(el.style.left) || 0 : 0;
		})
		.catch(() => 0);
}

/**
 * 读取 URS 表单错误提示（.m-nerror，如"该账号未及时激活，请重新注册"）。
 * 立即首查；未命中则每 300ms 轮询直到出现或超时（错误提示有几百 ms 延迟）。
 */
async function readFormError(frame: Frame, timeoutMs = 2500): Promise<string | null> {
	const start = Date.now();
	while (true) {
		const { err, detached } = await frame
			.evaluate(() => {
				for (const el of Array.from(document.querySelectorAll('.m-nerror'))) {
					const box = el as HTMLElement;
					if (!box.offsetWidth && !box.offsetHeight) continue;
					const text = (box.textContent || '').trim();
					if (text) return { err: text, detached: false };
				}
				return { err: null, detached: false };
			})
			.catch(() => ({ err: null, detached: true }));
		if (err) return err;
		// frame 已分离（登录成功后 iframe 被销毁）→ 无表单错误，立即结束轮询
		if (detached) return null;
		if (Date.now() - start >= timeoutMs) return null;
		await frame.waitForTimeout(300).catch(() => {});
	}
}

/** frame 是否已分离（登录成功后登录 iframe 会被页面销毁） */
function isFrameDetached(page: Page, frame: Frame): boolean {
	try {
		return !page.frames().includes(frame);
	} catch {
		return true;
	}
}

/**
 * 是否尚未通过验证（true = 继续循环重试）。
 * - 登录模态框已关闭（父页面）→ 已通过（false）
 * - frame 已分离（iframe 销毁）→ 已通过（false）
 * - URS 表单错误提示（账号/密码错误等）→ 直接抛错
 * - 易盾提示文本非默认（验证失败/操作过快等）→ 重试
 */
async function isNotVerified(page: Page, frame: Frame): Promise<boolean> {
	await page.waitForTimeout(2000);

	// 模态框关闭 → 登录成功（iframe 可能已销毁，优先于 frame 操作判断，避免 Frame was detached）
	if (!(await isModalOpen(page))) return false;

	// frame 已分离 → 登录流程已结束
	if (isFrameDetached(page, frame)) return false;

	// 表单错误提示（账号密码错误等）
	const formErr = await readFormError(frame, 500);
	if (formErr) throw new Error(formErr);

	// 易盾提示文本非默认 → 本次失败，重试（textContent 默认 30s 等待，快速失败）
	const tip = await frame
		.locator('.yidun_tips__text')
		.first()
		.textContent({ timeout: 500 })
		.catch(() => '');
	if (tip && tip.trim() !== CAPTCHA_READY_TEXT) return true;

	return true;
}

/**
 * 无 OCR 模块时的兜底：等待登录结果。
 * 模态框关闭 → 成功；表单错误 → 返回错误文本。
 */
async function waitForLoginResult(page: Page, frame: Frame): Promise<string | null> {
	for (let i = 0; i < 20; i++) {
		// 模态框关闭 → 成功（iframe 可能已销毁，优先判断）
		if (!(await isModalOpen(page))) return null;
		if (isFrameDetached(page, frame)) return null;
		const formErr = await readFormError(frame, 300);
		if (formErr) return formErr;
		await page.waitForTimeout(1000);
	}
	return '登录超时，请重试。';
}

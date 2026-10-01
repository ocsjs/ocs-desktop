import { Page } from 'playwright-core';
import axios from 'axios';
import { ensureWideViewport, getBase64, slowType } from '../../utils';
import { AutomationScript } from '@ocs-desktop/common';

/**
 * 拼图图形在 jigsaw img 内的左边距（自然像素）。
 * yidun 拼图 img 左缘与背景图左缘对齐，但拼图图形本身在 img 内有少量透明左边距，
 * 因此拼图 img 应落到「缺口左缘 - PIECE_PAD * pzScale」处。若滑块仍偏 1~3px，微调此值。
 */
const PIECE_PAD = 4;

export const ZHSLoginScript = new AutomationScript(
	{
		loginType: {
			label: '登录方式',
			value: 'phone',
			type: 'select',
			options: [
				{ label: '手机密码登录', value: 'phone' },
				{ label: '学校登录', value: 'unit' }
			]
		},
		phone: {
			label: '手机号',
			value: '',
			type: 'text',
			required: true,
			placeholder: '请输入手机号',
			pattern: '^1[3-9]\\d{9}$',
			patternMessage: '手机号格式不正确',
			visibleWhen: { key: 'loginType', value: 'phone' }
		},
		schoolname: {
			label: '学校',
			value: '',
			type: 'text',
			required: true,
			placeholder: '请输入学校名称',
			visibleWhen: { key: 'loginType', value: 'unit' }
		},
		id: {
			label: '学号',
			value: '',
			type: 'text',
			required: true,
			placeholder: '请输入学号',
			visibleWhen: { key: 'loginType', value: 'unit' }
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
		name: '智慧树-自动登录',
		icon: 'https://www.zhihuishu.com/',
		async run(
			page,
			configs,
			options?: {
				ocrApiUrl?: string;
				detTargetKey?: string;
				detBackgroundKey?: string;
			}
		) {
			try {
				// 登录页为固定宽度桌面布局，窄视口下元素会被裁出可视区，先确保窗口足够宽再导航
				await ensureWideViewport(page);
				if (await isNotLogin(page)) {
					if (configs.loginType === 'unit') {
						// 切换到 学号登录 标签页
						await page.click('div[role="tab"]:has-text("学号登录")');
						await page.waitForTimeout(1000);

						// 输入学校名称，过滤下拉列表
						const schoolInput = 'input.el-select__input:visible';
						await page.click(schoolInput);
						await slowType(page, schoolInput, configs.schoolname);
						// 等待远程学校列表加载完成（下拉框挂载在 body 下，需匹配可见的那个）
						await page.waitForSelector('.el-select-dropdown__item:visible', { timeout: 10_000 });
						await page.waitForTimeout(500);
						// 单击第一个匹配的学校
						await page.click('.el-select-dropdown__item:visible');

						await page.fill('input[name="unid"]', configs.id);
						await page.fill('input[type="password"]:visible', configs.password);
						// 勾选用户协议，否则无法登录
						await checkAgreement(page);

						// 点击登录按钮
						await page.waitForTimeout(1000);
						await page.click('.btn-block__grandient_login');
					} else {
						// 切换到 账号登录 标签页（默认选中，此处确保状态正确）
						await page.click('div[role="tab"]:has-text("账号登录")');
						await page.waitForTimeout(1000);

						await page.fill('input[name="mobile"]', configs.phone);
						await page.fill('input[type="password"]:visible', configs.password);
						// 勾选用户协议，否则无法登录
						await checkAgreement(page);
						await page.waitForTimeout(1000);
						await page.click('.btn-block__grandient_login');
					}

					if (options?.ocrApiUrl && options?.detTargetKey && options?.detBackgroundKey) {
						await loopVerify(page, {
							ocrApiUrl: options.ocrApiUrl,
							detTargetKey: options.detTargetKey,
							detBackgroundKey: options.detBackgroundKey
						});
					}
				}
			} catch (err) {
				ZHSLoginScript.emit('script-error', String(err));
			}
		}
	}
);

/** 勾选用户协议（点击勾选控件本身，避免命中《用户协议》链接而弹出 /protocal 页面） */
async function checkAgreement(page: Page) {
	const isChecked = () =>
		page.evaluate(() => {
			const label = document.querySelector('.privacy-checkbox');
			return (
				!!label?.classList.contains('is-checked') ||
				!!(label?.querySelector('input[type="checkbox"]') as HTMLInputElement | null)?.checked
			);
		});

	if (await isChecked()) {
		return;
	}

	// 点击 label 内的勾选控件（role=checkbox / 复选框本体），不触碰含链接的文字
	await page.evaluate(() => {
		const label = document.querySelector('.privacy-checkbox');
		if (!label) {
			return;
		}
		const control =
			(label.querySelector('[role="checkbox"]') as HTMLElement | null) ||
			(label.querySelector('.el-checkbox__inner') as HTMLElement | null) ||
			(label.querySelector('input[type="checkbox"]') as HTMLElement | null) ||
			// 退而求其次：label 中不含 <a> 的子元素（即勾选框，非协议链接文字）
			(Array.from(label.children).find((c) => !c.querySelector('a')) as HTMLElement | undefined);
		(control ?? (label as HTMLElement)).click();
	});
	await page.waitForTimeout(300);

	if (await isChecked()) {
		return;
	}

	// 仍未勾选：退回点击整个 label，并关闭随之弹出的 /protocal 标签
	const popupPromise = page.waitForEvent('popup', { timeout: 2000 }).catch(() => null);
	await page.click('label.privacy-checkbox');
	const popup = await popupPromise;
	if (popup) {
		await popup.close().catch(() => {});
	}
	// 兜底：关闭可能已打开的其它 /protocal 标签
	await Promise.all(
		page
			.context()
			.pages()
			.filter((p) => p !== page && p.url().includes('protocal'))
			.map((p) => p.close().catch(() => {}))
	);
}

/** 循环进行滑块验证，直至登录成功 */
async function loopVerify(page: Page, opts: { ocrApiUrl: string; detTargetKey: string; detBackgroundKey: string }) {
	let count = 5;
	while (await isNotVerified(page)) {
		if (count > 0) {
			count--;
			// 滑块弹窗未弹出（或已被关闭）时，重新点击登录按钮触发验证码
			if (!(await isYidunPopupVisible(page))) {
				await page.click('.btn-block__grandient_login');
				await page.waitForTimeout(1000);
			}
			await verify(page, opts);
			await page.waitForTimeout(2000);
		} else {
			throw new Error('滑块识别失败，请手动登录。');
		}
	}
}

/** 易盾验证码弹窗是否可见 */
async function isYidunPopupVisible(page: Page) {
	return page.evaluate(() => {
		const el = document.querySelector('.yidun_popup') as HTMLElement;
		return !!el && !!(el.offsetWidth || el.offsetHeight);
	});
}

/**
 * 滑块验证
 *
 * 直接调用本地 /ocr（ddddocr）获取缺口位置，自行做坐标换算与拖动：
 * ddddocr 返回的 target[0] 是背景图「自然像素」坐标，乘 bgScale 换算为渲染位移，
 * 再扣掉拼图在 img 内的左边距，最后用闭环伺服（实测拼图位移反馈）逼近目标。
 */
async function verify(page: Page, opts: { ocrApiUrl: string; detTargetKey: string; detBackgroundKey: string }) {
	// 删除yidun遮挡
	await page.evaluate(() =>
		document.querySelectorAll('.yidun_cover-frame,.yidun_popup__mask').forEach((el) => el.remove())
	);

	const det_slider_el = await page.$('.yidun_slider');
	const det_target_el = await page.$('[alt="验证码滑块"]');
	const det_bg_el = await page.$('[alt="验证码背景"]');

	if (!det_target_el || !det_slider_el || !det_bg_el) {
		return;
	}

	const det_target_src = await det_target_el.getAttribute('src');
	const det_bg_src = await det_bg_el.getAttribute('src');
	if (!det_target_src || !det_bg_src) {
		return;
	}

	// 调用本地 ddddocr 识别缺口
	const body = Object.create({});
	Reflect.set(body, opts.detTargetKey, await getBase64(det_target_src));
	Reflect.set(body, opts.detBackgroundKey, await getBase64(det_bg_src));
	const { data } = await axios.post(opts.ocrApiUrl, body);
	console.log('slider ocr', JSON.stringify(data));

	if (data?.error) {
		// error 可能来自服务端序列化后的原始对象，统一转为可读消息
		const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
		throw new Error(msg);
	}
	if (!data?.canOCR) {
		throw new Error('未检测到图片验证码识别模块, 请手动输入验证码，或在软件左侧应用中心安装识别模块后重启浏览器。。');
	}
	const targetX = Number(data?.det?.target?.[0]);
	if (!Number.isFinite(targetX)) {
		throw new Error('滑块验证识别失败，请尝试手动登录。');
	}

	// 背景图/拼图几何：计算渲染缩放，目标为「渲染像素」（相对背景图左缘）
	const bgGeom = await det_bg_el.evaluate((node) => {
		const b = node as HTMLImageElement;
		const r = b.getBoundingClientRect();
		return { naturalW: b.naturalWidth || r.width, displayW: r.width };
	});
	const pzGeom = await det_target_el.evaluate((node) => {
		const b = node as HTMLImageElement;
		const r = b.getBoundingClientRect();
		return { naturalW: b.naturalWidth || r.width, displayW: r.width };
	});
	const bgScale = bgGeom.displayW / bgGeom.naturalW || 1;
	const pzScale = pzGeom.displayW / pzGeom.naturalW || 1;
	// ddddocr 的 target[0] 是背景图自然像素坐标，乘 bgScale 得缺口渲染位置；
	// 拼图图形在 img 内有 PIECE_PAD 左边距（自然像素），需乘 pzScale 扣除
	const targetPieceLeft = targetX * bgScale - PIECE_PAD * pzScale;

	// 滑块按钮起点与行程上限（轨道宽 - 滑块宽，随分辨率动态变化）
	const handleRect = await det_slider_el.evaluate((node) => {
		const r = (node as HTMLElement).getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
	});
	const controlW = await page.evaluate(() => {
		const el = document.querySelector('.yidun_control') as HTMLElement | null;
		return el ? el.getBoundingClientRect().width : 0;
	});
	const maxSlider = Math.max(0, controlW - handleRect.w) || 200;

	// 闭环伺服拖动：以拼图实际渲染位移为反馈逐步逼近，不依赖联动比例，兼容任意分辨率/缩放
	await servoDrag(page, handleRect.x, handleRect.y, targetPieceLeft, maxSlider);

	try {
		await page.waitForNavigation({ timeout: 3000, waitUntil: 'domcontentloaded' });
	} catch {}
}

/**
 * 闭环伺服拖动：以拼图实际渲染位移为反馈，逐步逼近目标位置。
 *
 * 易盾弹窗为响应式布局，背景图被 CSS 缩放（scale 随分辨率/浏览器缩放变化），
 * 拼图位移与鼠标位移并非 1:1（实测拼图位移 = 鼠标位移 * scale）。旧算法按 1:1
 * 一次算到位 + 单次补正，分辨率一变必然偏；伺服用「实测位移」闭环收敛，
 * 与联动比例无关，天然兼容任意分辨率。残差大走大步、小走小步，先快后慢更像真人。
 */
async function servoDrag(page: Page, sx: number, sy: number, targetPieceLeft: number, maxSlider: number) {
	await page.mouse.move(sx, sy);
	await page.mouse.down();
	// 等待易盾联动生效，读取拼图初始渲染位移
	await page.waitForTimeout(70);
	let sliderLeft = 0;
	let pieceLeft = await readPieceRenderLeft(page);
	let lastResidual = Number.NaN;
	let stuck = 0;
	for (let i = 0; i < 60; i++) {
		const residual = targetPieceLeft - pieceLeft;
		if (Math.abs(residual) <= 2) {
			break;
		}
		if (sliderLeft >= maxSlider) {
			break;
		}
		// 反馈无变化（联动卡住）连续多次时放弃本次拖动
		if (Math.abs(residual - lastResidual) < 0.01) {
			if (++stuck > 4) {
				break;
			}
		} else {
			stuck = 0;
		}
		// 先粗后细：残差大走大步、逼近后走小步
		const step = Math.abs(residual) > 40 ? 10 : Math.abs(residual) > 12 ? 5 : 2;
		const next = Math.min(maxSlider, Math.max(0, sliderLeft + Math.sign(residual) * step));
		if (next === sliderLeft) {
			break;
		}
		sliderLeft = next;
		// 轻微纵向抖动，防行为检测
		await page.mouse.move(sx + sliderLeft, sy + Math.sin(i * 0.8));
		await page.waitForTimeout(70);
		pieceLeft = await readPieceRenderLeft(page);
		lastResidual = residual;
	}
	await page.mouse.up();
}

/** 拼图实际渲染位移：拼图 img 左缘相对背景图左缘（渲染像素） */
async function readPieceRenderLeft(page: Page) {
	return page.evaluate(() => {
		const jig = document.querySelector('[alt="验证码滑块"]') as HTMLElement | null;
		const bg = document.querySelector('[alt="验证码背景"]') as HTMLElement | null;
		if (!jig || !bg) {
			return 0;
		}
		return jig.getBoundingClientRect().left - bg.getBoundingClientRect().left;
	});
}

/** 是否未通过验证 */
async function isNotVerified(page: Page) {
	await page.waitForTimeout(2000);

	const errors = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.el-form-item__error, .el-message__content'))
			.map((e) => e.textContent || '')
			// 过滤登录成功等提示
			.filter((text) => text && !text.includes('成功'))
	);

	if (errors.length) {
		throw new Error(errors.join('\n'));
	}

	return page.url().includes('login.zhihuishu.com');
}

async function isNotLogin(page: Page) {
	await page.goto('https://www.zhihuishu.com/');
	await page.waitForTimeout(2000);
	// #login 为已登录用户信息区域，未登录时会隐藏
	const loginBtnNotDisplay = await page.evaluate(
		() => (document.querySelector('#login') as HTMLElement)?.style.display === 'none'
	);
	if (loginBtnNotDisplay) {
		// 点击 登录/注册 入口，跳转到登录中心
		await page.click('#notLogin a');
		try {
			await page.waitForURL(/login\.zhihuishu\.com/, { timeout: 10_000 });
		} catch {
			// 跳转超时兜底，继续后续流程
		}
		await page.waitForTimeout(1000);
	}

	return loginBtnNotDisplay;
}

/**
 * 会话状态保持（内存快照存储）worker 侧模块：Cookie 采集（快照）+ 差分（更新检测）+ 上报。
 *
 * 背景：部分平台（如智慧树）登录凭证全部为 session Cookie（无 Expires），Chrome 在浏览器
 * 会话结束时删除 session Cookie，launchPersistentContext 的 profile 持久化无法保留它们，
 * 导致每次启动都需重新登录。本模块在浏览器运行期间把 Cookie 快照同步到主进程内存快照存储
 * （session/cookie-store.ts），下次启动时注入恢复。
 *
 * 硬性安全约束（见 .codebuddy/plans/session-keepalive-cookie-store-plan.md）：
 * - 永不落盘；日志严禁打印 Cookie name/value（只允许数量）；
 * - 注入保持 session 语义（expires=-1 → 省略 expires 字段），不扩张凭证生命周期。
 *
 * 本文件运行于 worker（electron-free 纯 Node 进程），禁止 import electron。
 */
import type { BrowserContext, Cookie, Frame, Page } from 'playwright-core';

/**
 * 周期快照间隔：仅兜底无事件可感知的静默 Cookie 轮换（浏览器崩溃/PID 强杀时的最大丢失窗口）。
 * 敏捷性由事件侧保证（导航防抖 3s + 页面关闭立即快照 + close() 补刀），此值取整 60s 即可。
 */
const SNAPSHOT_INTERVAL = 60 * 1000;
/** 导航后防抖快照延迟：登录跳转风暴（如 CAS 多跳）合并为一次快照 */
const NAV_DEBOUNCE = 3 * 1000;

/** Cookie 集合签名（差分用）：含值，任何变更（登录/登出/轮换/过期剔除）都会改变签名。
 *  逐条 JSON 序列化而非裸拼接，避免字段边界碰撞（['ab','c'] vs ['a','bc']） */
export function cookieSignature(cookies: Cookie[]): string {
	return cookies
		.map((c) => JSON.stringify([c.domain, c.path, c.name, c.value, c.expires]))
		.sort()
		.join('');
}

/**
 * 注入规范化：
 * - 剔除已过期（expires>0 且小于当前时间）；
 * - expires=-1（session）→ 省略 expires 字段，注入后仍是 session Cookie，语义零扩张；
 * - SameSite=None 且非 Secure 是非法组合（CDP setCookie 拒绝）→ 省略 sameSite 降级。
 */
/**
 * 可注入 Cookie：与 Cookie 的差异仅在于 expires 可选
 * （省略 = session Cookie；BrowserContext.addCookies 的入参形态）。
 */
export type InjectableCookie = Omit<Cookie, 'expires' | 'sameSite'> & {
	expires?: number;
	sameSite?: Cookie['sameSite'];
};

export function normalizeCookiesForInjection(cookies: Cookie[]): InjectableCookie[] {
	const now = Date.now() / 1000;
	const out: InjectableCookie[] = [];
	for (const c of cookies) {
		if (!c.name || typeof c.value !== 'string' || !c.domain) continue;
		if (c.expires > 0 && c.expires <= now) continue;
		const sameSite = ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : undefined;
		out.push({
			name: c.name,
			value: c.value,
			domain: c.domain,
			path: c.path || '/',
			httpOnly: !!c.httpOnly,
			secure: !!c.secure,
			...(sameSite === 'None' && !c.secure ? {} : sameSite ? { sameSite } : {}),
			...(c.expires > 0 ? { expires: c.expires } : {})
		});
	}
	return out;
}

/**
 * Cookie 快照同步器（会话状态保持）：周期 + 事件双触发，差分后上报主进程。
 * 设计要点：
 * - 上报即全量替换语义（快照存储不做增量合并，快照就是当前完整状态）；
 * - 页面关闭立即快照：覆盖「关掉最后一个标签页 → watchNoPagesAutoClose 100ms 后 browser.close()」的竞态；
 * - 导航防抖 3s：登录跳转型平台（智慧树 CAS 多跳）在落地后 ~3s 入库，
 *   用户登录完立刻关浏览器也不依赖 60s 周期兜底。
 */
export class SessionKeepaliveSync {
	private timer?: ReturnType<typeof setInterval>;
	private navTimer?: ReturnType<typeof setTimeout>;
	private lastSignature = '';
	private stopped = false;
	private cleanups: (() => void)[] = [];
	private browser: BrowserContext;
	private report: (cookies: Cookie[]) => void;
	private log: (...msg: any[]) => void;

	constructor(browser: BrowserContext, report: (cookies: Cookie[]) => void, log: (...msg: any[]) => void) {
		this.browser = browser;
		this.report = report;
		this.log = log;
	}

	start() {
		// 基线快照：建立初始签名，避免「首次变化」被误判或无变化空报
		this.snapshot('init').catch(() => {});

		const track = (page: Page) => {
			const onNav = (frame: Frame) => {
				if (frame !== page.mainFrame()) return;
				this.scheduleNavSnapshot();
			};
			const onClose = () => this.snapshot('page-close').catch(() => {});
			page.on('framenavigated', onNav);
			page.on('close', onClose);
			this.cleanups.push(() => {
				page.off('framenavigated', onNav);
				page.off('close', onClose);
			});
		};
		for (const page of this.browser.pages()) track(page);
		const onPage = (page: Page) => track(page);
		this.browser.on('page', onPage);
		this.cleanups.push(() => this.browser.off('page', onPage));

		this.timer = setInterval(() => this.snapshot('interval').catch(() => {}), SNAPSHOT_INTERVAL);
		// 定时器不阻止 worker 退出（对齐 startMemoryReporting 的 unref 先例）
		this.timer.unref?.();
	}

	private scheduleNavSnapshot() {
		if (this.navTimer) clearTimeout(this.navTimer);
		this.navTimer = setTimeout(() => {
			this.navTimer = undefined;
			this.snapshot('navigated').catch(() => {});
		}, NAV_DEBOUNCE);
	}

	/** 快照并差分上报；浏览器已关闭时 cookies() reject，由调用方 catch 静默 */
	async snapshot(reason: string) {
		if (this.stopped) return;
		const cookies = await this.browser.cookies();
		const sig = cookieSignature(cookies);
		if (sig === this.lastSignature) return;
		this.lastSignature = sig;
		// 日志只打数量与触发原因，严禁打印 name/value
		this.log(`[session] Cookie 快照变更（${reason}），共 ${cookies.length} 条`);
		this.report(cookies);
	}

	stop() {
		this.stopped = true;
		if (this.timer) clearInterval(this.timer);
		if (this.navTimer) clearTimeout(this.navTimer);
		for (const cleanup of this.cleanups) cleanup();
		this.cleanups = [];
	}
}

import { SystemAutomationScript, CACHEABLE_SITES } from '@ocs-desktop/common';
import { readHttpCache, writeHttpCache } from '../../utils/http-cache';

/**
 * 缓存范围：无执行语义的静态资源（图片/字体）+ CSS。
 * 不缓存 js/svg/m3u8：
 * - .user.js 用户脚本会命中 .js——route.fulfill 在 CDP 层提前应答，请求到不了 Chromium 网络栈，
 *   脚本管理器基于 declarativeNetRequest 的安装拦截完全不触发（「未启用安装功能」）；
 * - svg 可内嵌 <script>/事件属性，属执行面；
 * - m3u8 流媒体清单含时效签名，缓存过期清单导致播放失效。
 * CSS 风险面已审查（无执行语义、base64 字节级回放含 SRI 保真）：软风险为
 * 平台 SW 改写 CSS 被绕过 / 同 URL 个性化 CSS 跨浏览器共享缓存 / 无版本号 URL 的陈旧窗口，
 * 故 TTL 单独调短为 6h（媒体/字体 24h），出问题可用站点级开关关闭。
 */
const STATIC_EXT = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|css)(\?|#|$)/i;
const CSS_EXT = /\.css(\?|#|$)/i;
/** 媒体/字体新鲜期（24h），过期后回源拉取并覆盖缓存；拉取失败回退旧缓存 */
const MEDIA_CACHE_TTL = 24 * 60 * 60 * 1000;
/** CSS 新鲜期（6h，样式陈旧比图片更显眼） */
const CSS_CACHE_TTL = 6 * 60 * 60 * 1000;
/** 按资源类型取新鲜期 */
const ttlOf = (url: string) => (CSS_EXT.test(url) ? CSS_CACHE_TTL : MEDIA_CACHE_TTL);
/** 单资源缓存上限（50MB），超限不写缓存 */
const MAX_CACHE_BYTES = 50 * 1024 * 1024;

/**
 * 系统自动化：站点静态资源（图片/字体/CSS）缓存加速（智慧树/超星等平台）。
 * 经 Playwright 路由拦截启用站点的静态资源请求：
 * 缓存命中（媒体/字体 24h、CSS 6h 内）直接喂给页面，跳过网络往返；未命中回源并落盘；回源失败回退旧缓存。
 * 全局「网络缓存加速」与站点级开关任一关闭时对应站点不启用。
 */
export const siteCacheScript = new SystemAutomationScript({
	name: 'system:site-cache',
	label: '站点静态资源缓存',
	order: 40,
	phase: 'launch',
	async run({ browser, store }) {
		const browserSetting = (store?.render as any)?.setting?.browser;
		if (browserSetting?.networkCache === false) return;

		// 启用站点（站点级开关缺省视为开启）
		const siteFlags = (browserSetting?.networkCacheSites as Record<string, boolean> | undefined) || {};
		const hosts = CACHEABLE_SITES.filter((s) => siteFlags[s.id] !== false).flatMap((s) => s.hosts);
		if (!hosts.length) return;
		// 域名边界锚定（//host 或 //*.host）+ 扩展名必须匹配可缓存资源：
		// 路由拦截走 CDP 暂停-放行，每个被拦请求都付出 CDP 往返开销——
		// 若 pattern 只按域名匹配，该域名的 HTML/XHR/JS 等全部请求都会被拦截再放行，
		// 首屏大量请求并发时整体显著变慢（正是「首次启动反而更慢」的根因）。
		// 把扩展名编入 pattern 后，HTML/API/JS/CSS 请求完全不经过拦截层。
		const ext = String.raw`\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|css)([?#]|$)`;
		const pattern = new RegExp(
			hosts.map((h) => `//([a-z0-9-]+\\.)*${h.replace(/\./g, '\\.')}/[^?#]*${ext}`).join('|'),
			'i'
		);

		/** 回放缓存响应（还原原始响应头，缺失 Content-Type 会导致浏览器拒绝执行 JS/CSS） */
		const fulfillFromCache = (route: any, cached: NonNullable<ReturnType<typeof readHttpCache>>) =>
			route.fulfill({
				status: 200,
				headers: cached.headers,
				body: Buffer.from(cached.body, cached.binary ? 'base64' : 'utf8')
			});

		browser.route(pattern, async (route) => {
			const req = route.request();
			const url = req.url();
			// 仅缓存 GET 静态资源，其余请求直接放行
			if (req.method() !== 'GET' || !STATIC_EXT.test(url)) {
				return route.continue();
			}
			const cached = readHttpCache(url);
			if (cached && Date.now() - cached.time < ttlOf(url)) {
				return fulfillFromCache(route, cached);
			}
			try {
				const res = await route.fetch();
				const body = await res.body();
				if (res.ok() && body.length < MAX_CACHE_BYTES) {
					// 剥离内容协商类头：body 已解码落盘，content-length/content-encoding 与缓存内容不符
					const headers = { ...res.headers() };
					delete headers['content-length'];
					delete headers['content-encoding'];
					// 缓存清单收窄后全部为二进制资源（图片/字体）
					writeHttpCache(url, body, true, headers);
				}
				await route.fulfill({ response: res, body });
			} catch (e) {
				// 回源失败：有旧缓存则回退（弱网兜底），否则放行由浏览器自身报错
				if (cached) {
					return fulfillFromCache(route, cached);
				}
				await route.continue().catch(() => {});
			}
		});
		console.log(`[system:site-cache] 站点静态资源缓存已启用：${hosts.join('、')}`);
	}
});

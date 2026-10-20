import { computed, watch, onUnmounted } from 'vue';
import { store } from '../store';
import { Process } from '../utils/process';

/**
 * 预览帧率档位 -> Page.startScreencast 的 everyNthFrame 映射。
 * 按 ~60fps 合成帧率估算：everyNthFrame = N 表示每 N 帧取 1 帧。
 * 实际帧率随页面内容动态变化（静态画面浏览器不合成，自动停止推流）。
 */
const FRAMERATE_TO_NTH_FRAME: Record<'high' | 'medium' | 'low', number> = {
	high: 2, // ~30 fps
	medium: 4, // ~15 fps（默认）
	low: 10 // ~6 fps
};

/**
 * 预览画质档位 -> Page.startScreencast 的 maxWidth/maxHeight/quality 映射。
 * 分辨率越高、jpeg 质量越高，画面越清晰但每帧数据量越大。
 * 注意 maxWidth/maxHeight 为帧尺寸上限（只降采样不放大），实际分辨率 = min(浏览器视口, 上限)。
 */
const QUALITY_TO_PARAMS: Record<
	'original' | 'ultra' | 'high' | 'medium' | 'low',
	{ maxWidth: number; maxHeight: number; quality: number }
> = {
	original: { maxWidth: 3840, maxHeight: 2160, quality: 95 }, // 原画：视口原生分辨率（上限 4K），单帧体积大
	ultra: { maxWidth: 2560, maxHeight: 1440, quality: 85 }, // 超清：上限 2K
	high: { maxWidth: 1280, maxHeight: 720, quality: 70 },
	medium: { maxWidth: 640, maxHeight: 360, quality: 50 }, // 默认
	low: { maxWidth: 480, maxHeight: 270, quality: 30 }
};

/**
 * 按卡片可见性驱动 Page.startScreencast 启停。
 *
 * - 卡片进入视口 -> 启动该浏览器的 screencast 推流
 * - 卡片离开视口 -> 停止推流，释放资源
 * - 浏览器启动/配置变化时主动同步（IntersectionObserver 不会在元素本就可见时重复触发）
 *
 * 用法：组件 setup 中调用，onMounted 及卡片/进程状态变化时调用 refresh。
 */
export function useScreencastVisibility(opts: {
	/** 卡片元素选择器（元素需带 data-uid 属性） */
	cardSelector: string;
	/** 滚动容器 getter，默认视口 */
	root?: () => Element | null;
}) {
	const previewEnabled = computed(() => store.render.setting.browser.screenshotPreview);
	const everyNthFrame = computed(
		() => FRAMERATE_TO_NTH_FRAME[store.render.setting.browser.screenshotFramerate] ?? FRAMERATE_TO_NTH_FRAME.medium
	);
	const qualityParams = computed(
		() => QUALITY_TO_PARAMS[store.render.setting.browser.screenshotQuality] ?? QUALITY_TO_PARAMS.medium
	);

	let observer: IntersectionObserver | null = null;

	function ensureObserver(): IntersectionObserver {
		if (!observer) {
			observer = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						applyVisibility(entry.target, entry.isIntersecting);
					}
				},
				{ threshold: 0.1, root: opts.root?.() ?? null }
			);
		}
		return observer;
	}

	function applyVisibility(el: Element, isIntersecting: boolean) {
		const uid = (el as HTMLElement).dataset.uid;
		if (!uid) return;
		const p = Process.from(uid);
		if (!p || p.status !== 'launched') return;
		if (!previewEnabled.value || !isIntersecting) {
			p.setScreencastActive(false);
		} else {
			p.setScreencastActive(true, { everyNthFrame: everyNthFrame.value, ...qualityParams.value });
		}
	}

	function isElementVisible(el: Element): boolean {
		const root = opts.root?.();
		const rect = el.getBoundingClientRect();
		const r = root
			? root.getBoundingClientRect()
			: { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
		return rect.bottom > r.top && rect.top < r.bottom && rect.right > r.left && rect.left < r.right;
	}

	/**
	 * 重新扫描并观察所有卡片元素，并对已启动且可见的进程主动同步预览状态。
	 * 在 onMounted、卡片增删、进程状态变化、tab 切换等时机调用。
	 */
	function refresh() {
		const ob = ensureObserver();
		const els = document.querySelectorAll(opts.cardSelector);
		els.forEach((el) => ob.observe(el));
		// IntersectionObserver 对"本就可见"的元素 observe 时会异步触发初始回调，
		// 但进程从 launching 变 launched 时光靠 observer 不会重新触发，故在此主动同步
		for (const el of Array.from(els)) {
			const uid = (el as HTMLElement).dataset.uid;
			if (!uid) continue;
			const p = Process.from(uid);
			if (p && p.status === 'launched' && isElementVisible(el)) {
				applyVisibility(el, true);
			}
		}
	}

	/** 同步所有已启动进程的预览状态（按当前可见性与配置） */
	function syncAll() {
		const els = document.querySelectorAll(opts.cardSelector);
		for (const el of Array.from(els)) {
			const uid = (el as HTMLElement).dataset.uid;
			if (!uid) continue;
			const p = Process.from(uid);
			if (p && p.status === 'launched') {
				applyVisibility(el, isElementVisible(el));
			}
		}
	}

	// 配置变化（预览开关 / 帧率 / 画质）时同步所有已启动进程
	watch([previewEnabled, everyNthFrame, qualityParams], () => syncAll());

	onUnmounted(() => {
		observer?.disconnect();
		observer = null;
	});

	return { refresh, syncAll, previewEnabled };
}

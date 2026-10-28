import { store } from '../store';

/**
 * 语言包取值：远程语言包（store.render.langs，来自接口数据）存在 key 时优先，否则用默认文案；
 * 支持 {{xxx}} 参数替换。更新文案改语言包数据即可，无需改动代码。
 */
export function t(key: string, def?: string, params?: Record<string, any>) {
	let text = store.render.langs[key];
	if (!text) {
		text = def || '';
	}
	if (params) {
		Object.keys(params).forEach((k) => {
			text = text.replace(new RegExp(`{{${k}}}`, 'g'), params[k]);
		});
	}
	return text;
}

/** v-html 输出允许的标签白名单：语言包数据来自远程接口，不可完全信任（防 XSS 注入） */
const T_HTML_ALLOWED_TAGS = new Set([
	'a',
	'b',
	'i',
	'u',
	'em',
	'strong',
	'span',
	'div',
	'p',
	'br',
	'code',
	'pre',
	'small',
	'sub',
	'sup',
	'li',
	'ul',
	'ol',
	/* img/video 豁免（无脚本执行面；src 协议仍受下方校验，javascript:/vbscript: 一律拒绝） */
	'img',
	'video'
]);
/** v-html 输出允许的属性白名单 */
const T_HTML_ALLOWED_ATTRS = new Set([
	'href',
	'target',
	'title',
	'style',
	'class',
	'src',
	'alt',
	'controls',
	'poster',
	'width',
	'height',
	'muted',
	'loop',
	'autoplay'
]);

/**
 * HTML 净化（防 XSS）：
 * 1. script/style/iframe 等危险标签连同内容整体移除（单纯解包会把脚本内容泄漏为文本）；
 * 2. 白名单外的标签解包（保留文本子节点）；
 * 3. 剥离 on* 事件属性、白名单外属性，以及危险协议链接（href 禁 javascript:/data:/vbscript:，src 禁 javascript:/vbscript:，data: 留给 img/video）；
 * 4. target="_blank" 链接补 rel="noopener noreferrer"（防 window.opener 攻击）。
 */
function sanitizeHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html, 'text/html');

	doc
		.querySelectorAll(
			'script, style, iframe, object, embed, form, input, button, select, textarea, audio, link, meta, base'
		)
		.forEach((el) => el.remove());

	// querySelectorAll 返回静态 NodeList，解包不影响遍历；被解包元素的子元素在列表中仍会被处理
	doc.body.querySelectorAll('*').forEach((el) => {
		if (!T_HTML_ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
			el.replaceWith(...Array.from(el.childNodes));
			return;
		}
		for (const attr of Array.from(el.attributes)) {
			const name = attr.name.toLowerCase();
			if (name.startsWith('on') || !T_HTML_ALLOWED_ATTRS.has(name)) {
				el.removeAttribute(attr.name);
			} else if (name === 'href' && /^\s*(javascript|data|vbscript):/i.test(attr.value)) {
				el.removeAttribute(attr.name);
			} else if (name === 'src' && /^\s*(javascript|vbscript):/i.test(attr.value)) {
				el.removeAttribute(attr.name);
			} else if (name === 'style' && /expression|javascript:/i.test(attr.value)) {
				el.removeAttribute(attr.name);
			}
		}
		if (el.tagName === 'A' && el.getAttribute('target') === '_blank') {
			el.setAttribute('rel', 'noopener noreferrer');
		}
	});

	return doc.body.innerHTML;
}

export namespace t {
	/** v-html 变体：输出前做 HTML 净化（防 XSS），远程语言包渲染 HTML 的场景必须用此变体 */
	export function html(key: string, def?: string, params?: Record<string, any>): string {
		return sanitizeHtml(t(key, def, params));
	}
}

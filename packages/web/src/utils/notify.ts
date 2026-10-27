import { Button, Notification } from '@arco-design/web-vue';
import { h, VNodeChild } from 'vue';
import { electron } from './node';
import { StringUtils } from '@ocs-desktop/common/web';
const { clipboard } = electron;

interface NotifyOptions {
	type?: 'error' | 'success' | 'info' | 'warning';
	duration?: number;
	btn?: VNodeChild | undefined;
	copy?: boolean;
	close?: boolean;
	max_length?: number;
	/** 自定义内容渲染（提供时替代默认的 innerHTML 文本渲染，用于进度条等组件） */
	content?: () => VNodeChild;
}

export function notify(title: string, msg: any, key: string, options?: NotifyOptions) {
	return Notification[options?.type || 'info']({
		id: key,
		title,
		closable: true,
		style: { width: '400px' },
		content: () =>
			options?.content
				? options.content()
				: h('div', {
						title: msg?.stack || msg?.message || msg || '',
						innerHTML: sanitizeHtml(StringUtils.max(String(msg), options?.max_length ?? 999))
				  }),
		duration: options?.duration ?? (options?.type === 'error' ? 6000 : 3000),
		footer: () =>
			options?.btn ||
			h('div', [
				options?.copy ? cerateCopyButton(title, msg, key, options) : '',
				options?.close ? createCloseButton(key) : ''
			])
	});
}

/**
 * HTML 白名单标签
 */
const HTML_TAG_WHITELIST = new Set([
	'a',
	'code',
	'pre',
	'br',
	'b',
	'img',
	'i',
	'em',
	'strong',
	'span',
	'p',
	'div',
	'ul',
	'ol',
	'li',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'blockquote',
	'hr',
	'table',
	'thead',
	'tbody',
	'tr',
	'td',
	'th',
	'kbd',
	'small',
	'sub',
	'sup',
	'u',
	's',
	'del',
	'mark',
	'font'
]);

/**
 * 各标签允许的属性白名单
 */
const HTML_ATTR_WHITELIST: Record<string, Set<string>> = {
	a: new Set(['href', 'title', 'target']),
	img: new Set(['src', 'alt', 'title', 'width', 'height']),
	'*': new Set(['class', 'style', 'title'])
};

/**
 * 安全的 URL 协议
 */
const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'data:'];

function isSafeUrl(url: string, allowData: boolean): boolean {
	const trimmed = url.trim().toLowerCase();
	try {
		const protocol = new URL(trimmed, 'https://placeholder.local').protocol;
		if (!SAFE_URL_PROTOCOLS.includes(protocol)) {
			return false;
		}
		// data: 仅允许图片，且仅在明确允许时
		if (protocol === 'data:') {
			return allowData && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/.test(trimmed);
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * 基于 DOMParser 的轻量 HTML 白名单消毒器：
 * 仅保留白名单内的标签与属性，其余标签解包为纯文本，防止错误信息中的 HTML（如 <input>）被渲染为真实元素。
 */
function sanitizeHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html, 'text/html');

	const sanitizeNode = (node: Node): string => {
		if (node.nodeType === Node.TEXT_NODE) {
			return escapeHtml(node.textContent || '');
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return '';
		}

		const el = node as Element;
		const tag = el.tagName.toLowerCase();
		const children = Array.from(el.childNodes).map(sanitizeNode).join('');

		// 危险标签：整体丢弃（含内容）
		if (['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'template'].includes(tag)) {
			return '';
		}
		// 非白名单标签：仅保留其文本内容（解包），丢弃标签本身
		if (!HTML_TAG_WHITELIST.has(tag)) {
			return children;
		}

		// 过滤属性
		const allowedAttrs = HTML_ATTR_WHITELIST[tag] || new Set();
		const commonAttrs = HTML_ATTR_WHITELIST['*'];
		const attrs: string[] = [];

		for (const attr of Array.from(el.attributes)) {
			const name = attr.name.toLowerCase();
			// 拦截 on* 事件属性
			if (name.startsWith('on')) {
				continue;
			}
			if (!allowedAttrs.has(name) && !commonAttrs.has(name)) {
				continue;
			}
			// URL 属性校验
			if (name === 'href' && !isSafeUrl(attr.value, false)) {
				continue;
			}
			if (name === 'src' && !isSafeUrl(attr.value, true)) {
				continue;
			}
			attrs.push(`${name}="${escapeHtml(attr.value)}"`);
		}

		// a 标签强制新窗口打开并防反钓
		if (tag === 'a') {
			if (!allowedAttrs.has('target') || !el.getAttribute('target')) {
				attrs.push('target="_blank"');
			}
			attrs.push('rel="noopener noreferrer"');
		}

		const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
		// 自闭合标签
		if (['br', 'hr', 'img'].includes(tag)) {
			return `<${tag}${attrStr}/>`;
		}
		return `<${tag}${attrStr}>${children}</${tag}>`;
	};

	return Array.from(doc.body.childNodes).map(sanitizeNode).join('');
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * 创建关闭按钮
 */
function createCloseButton(key: string) {
	return h(
		Button,
		{
			type: 'primary',
			size: 'small',
			onClick: () => {
				Notification.remove(key);
			}
		},
		'关闭'
	);
}

/**
 * 创建复制信息按钮
 */
function cerateCopyButton(title: string, msg: any, key: string, options?: NotifyOptions) {
	return h(
		Button,
		{
			type: 'primary',
			size: 'small',
			onClick: () => {
				clipboard.writeText(title + '\n' + String(msg));

				notify(title, msg, key, {
					...options,
					...{
						btn: h(
							Button,
							{
								type: 'primary',
								size: 'small',
								disabled: true
							},
							'复制成功√'
						)
					}
				});
			}
		},
		'复制信息'
	);
}

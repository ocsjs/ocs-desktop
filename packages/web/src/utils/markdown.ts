import MarkdownIt from 'markdown-it';
import Emoji from 'markdown-it-emoji';
import { markdownContainer } from '../utils/markdown.container';
import hljs from 'highlight.js';

// @ts-ignore full options list (defaults)
export const markdownIt: MarkdownIt = MarkdownIt({
	html: true,
	xhtmlOut: false,
	breaks: true,
	langPrefix: 'language-',
	linkify: true,
	typographer: true,
	quotes: '“”‘’',
	highlight: function (str, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return (
					'<pre class="hljs"><code>' +
					hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
					'</code></pre>'
				);
			} catch (__) {}
		}

		return '<pre class="hljs"><code>' + markdownIt.utils.escapeHtml(str) + '</code></pre>';
	}
});

markdownIt
	// emoji 表情
	.use(Emoji)
	// 自定义 container
	.use(markdownContainer);

import { remote } from './utils/remote';
import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import App from './App.vue';
import AppInBrowser from './AppInBrowser.vue';
import '@arco-design/web-vue/dist/arco.css';
import { router } from './route';
import { notify } from './utils/notify';
// 自定义圆角主题覆盖，必须在 arco.css 之后引入
import './assets/less/arco-custom.less';
// 全局主题样式（主题色板 token + 暗色模式全局覆盖），在 arco-custom 之后引入以覆盖其浅色规则
import './assets/less/theme.less';
import { inBrowser } from './utils/node';
import { shouldIgnoreRemoteError, shouldIgnoreRenderError } from './utils/errors';

window.addEventListener('error', function (e) {
	console.error(e);
	if (e instanceof ErrorEvent) {
		if (shouldIgnoreRenderError(e?.message || String(e) || '')) {
			return;
		}
		// remote 层错误（已标记，未捕获才到这里）：套用 remote 噪音过滤并用专用标题
		const err = (e as any).error;
		if (err?.__ocsRemote) {
			if (shouldIgnoreRemoteError(err?.message || String(err))) return;
			remote.logger.call('error', 'remote 模块错误', err?.stack || err?.message || String(err));
			notify('remote 模块错误', err, 'remote', { type: 'error', copy: true });
			return;
		}
	}

	remote.logger.call('error', '未知的错误', e);
	notify('未知的错误', e, 'render-error', {
		type: 'error',
		copy: true
	});
});

window.addEventListener('unhandledrejection', function (e) {
	e.promise.catch((e) => {
		console.error(e);
		try {
			if (shouldIgnoreRenderError(e?.message || String(e) || '')) {
				return;
			}
			// remote 层错误（已标记，未被调用方捕获才到这里）：套用 remote 噪音过滤并用专用标题
			if (e?.__ocsRemote) {
				if (shouldIgnoreRemoteError(e?.message || String(e))) return;
				remote.logger.call('error', 'remote 模块错误', e?.stack || e?.message || e || '');
				notify('remote 模块错误', e, 'remote', { type: 'error', copy: true });
				return;
			}
			remote.logger.call('error', '未捕获的异步错误', e?.stack || e?.message || e || '');
			notify('未捕获的异步错误', e, 'render-error', {
				type: 'error',
				copy: true
			});
		} catch (e) {
			console.error(e);
		}
	});
});

(() => {
	/**
	 * 区分浏览器环境和electron渲染进程环境
	 */
	if (inBrowser) {
		// 浏览器环境标记：common.css 中 body 禁滚规则仅作用于桌面端，
		// 导航页等在浏览器内运行的页面依赖文档流滚动，必须排除
		document.documentElement.classList.add('in-browser');
		createApp(AppInBrowser)
			.use(router)
			.use(ArcoVue)
			.directive('focus', {
				mounted(el) {
					el.focus();
				}
			})
			.mount('#app');
		// 标记 Vue 已挂载：index.html 白屏兜底监听据此停止介入
		(window as any).__ocsMounted = true;
		return;
	}

	createApp(App)
		.use(router)
		.use(ArcoVue)
		.directive('focus', {
			mounted(el) {
				el.focus();
			}
		})
		.mount('#app');
	// 标记 Vue 已挂载：index.html 白屏兜底监听据此停止介入
	(window as any).__ocsMounted = true;
})();

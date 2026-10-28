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

window.addEventListener('error', function (e) {
	console.error(e);
	if (e instanceof ErrorEvent) {
		if (errorFilter(e?.message || String(e) || '')) {
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
			if (errorFilter(e?.message || String(e) || '')) {
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

function errorFilter(str: string) {
	// arco design 问题，暂时无需处理，复现方式，鼠标重复经过 tooltip 或者 dropdown ， 打开 modal 都会出现
	if (str.includes('ResizeObserver loop')) {
		return true;
	}
	//  operation not permitted, stat xxxxx CrashpadMetrics.pma ， 这个是 playwright 问题，暂时无需处理
	if (str.includes('CrashpadMetrics')) {
		return true;
	}
}

(() => {
	/**
	 * 区分浏览器环境和electron渲染进程环境
	 */
	if (inBrowser) {
		createApp(AppInBrowser)
			.use(router)
			.use(ArcoVue)
			.directive('focus', {
				mounted(el) {
					el.focus();
				}
			})
			.mount('#app');
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
})();

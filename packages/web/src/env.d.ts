/// <reference types="vite/client" />
// 引入 arco 全局组件类型声明（GlobalComponents 增强），恢复模板中 a-xxx 组件的属性/插槽联想
/// <reference types="@arco-design/web-vue/es/components" />

declare module '*.vue' {
	import { DefineComponent } from 'vue';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
	const component: DefineComponent<{}, {}, any>;

	export default component;
}

declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.bmp';
declare module '*.tiff';

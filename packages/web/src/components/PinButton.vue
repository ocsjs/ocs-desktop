<template>
	<div
		class="pin-button"
		:class="{ active: store.window.alwaysOnTop }"
		:style="positionStyle"
		:title="store.window.alwaysOnTop ? '取消窗口置顶' : '窗口置顶'"
		@click="togglePin"
	>
		<Icon
			type="push_pin"
			:theme="store.window.alwaysOnTop ? 'filled' : 'outlined'"
			:size="16"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { store } from '../store';

/**
 * 顶部栏窗口置顶按钮
 *
 * 系统的窗口控制按钮（最小化/最大化/关闭）由 Electron titleBarOverlay 渲染在网页内容之上，
 * 并非 Vue 组件，需要避让：
 * - win/linux：控制按钮位于右上角（默认三键约 138px），本按钮绝对定位 right:135px 避让
 * - darwin：控制按钮（红绿灯）位于左上角，顶部栏整体右对齐并由 .title 的 padding-left
 *   统一预留红绿灯区域，本按钮静态定位于 flex 流末尾即可
 *
 * 注：如需精确避让（如 DPI 缩放场景），可用 navigator.windowControlsOverlay.getTitlebarAreaRect()
 * 动态测量控制按钮区域宽度。
 */
const isDarwin = process.platform === 'darwin';

const positionStyle = computed(() => {
	// darwin：静态定位，跟随顶部栏 flex 整体右对齐（左侧红绿灯区域由 .title 的 padding-left 统一预留）
	// win/linux：固定 right 135px 避让右上角三控制按钮，宽度加宽至 48px
	return isDarwin ? {} : { right: '135px', left: 'auto', width: '48px' };
});

function togglePin() {
	// 与「设置-基本设置-窗口置顶」共用同一响应式状态，
	// App.vue 中的 watch 会将其同步到主进程窗口（setAlwaysOnTop）
	store.window.alwaysOnTop = !store.window.alwaysOnTop;
}
</script>

<style scoped lang="less">
.pin-button {
	/* 绝对定位于顶部栏（.title 为 relative），避开系统 traffic light 控制区域 */
	position: absolute;
	top: 0;
	height: var(--title-height);
	width: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	border-radius: 4px;
	-webkit-app-region: no-drag;
	user-select: none;
	color: #4e5969;
	z-index: 1;

	&:hover {
		background-color: #f0f0f0;
	}

	&.active {
		color: var(--theme-primary-color);

		&:hover {
			background-color: #f0f0f0;
		}
	}

	/* mac：静态定位，跟随顶部栏 flex 右对齐，不再单独避让红绿灯 */
	body.platform-darwin & {
		position: static;
	}

	body[arco-theme='dark'] & {
		color: #c9cdd4;

		&:hover {
			background-color: #3a3a3a;
		}
	}
}
</style>

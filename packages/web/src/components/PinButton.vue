<template>
	<div
		class="pin-button"
		:class="{ active: store.window.alwaysOnTop }"
		:style="positionStyle"
		:title="store.window.alwaysOnTop ? '取消窗口置顶' : '窗口置顶'"
		@click="togglePin"
	>
		<PinIcon
			:theme="store.window.alwaysOnTop ? 'filled' : 'outlined'"
			:size="16"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { store } from '../store';
import { bridge } from '../utils/bridge';
import { PinIcon } from 'lucide-vue-next';

/**
 * 顶部栏窗口置顶按钮
 *
 * win7 分支：窗口控制按钮（最小化/最大化/关闭）为渲染层自绘（WindowControls.vue，
 * 3×46px），并非系统 titleBarOverlay，本按钮绝对定位按固定宽度 138px 避让；
 * darwin：控制按钮（红绿灯）位于左上角，顶部栏整体右对齐并由 .title 的 padding-left
 * 统一预留红绿灯区域，本按钮静态定位于 flex 流末尾即可
 */
const isDarwin = bridge.platform === 'darwin';
const isLinux = bridge.platform === 'linux';

/** 避让右上角自绘控制按钮的 right 偏移（WindowControls 3×46px） */
const rightOffset = ref(138);

const positionStyle = computed(() => {
	// darwin：静态定位；win/linux：right 动态避让；linux 采用 24px 小按钮对齐系统控制按钮风格
	return isDarwin ? {} : { right: rightOffset.value + 'px', left: 'auto', width: isLinux ? '24px' : '48px' };
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

	/* Linux：对齐 Linux 风格的窗口控制按钮（纯黑色图标，仅 hover 时显示圆形灰色背景），
	   24px 小按钮在 32px 标题栏中垂直居中 */
	body.platform-linux & {
		height: 24px;
		top: 4px;
		border-radius: 50%;
		background-color: transparent;
		color: #000000;

		&:hover {
			background-color: #f0f0f0;
		}

		&.active {
			color: var(--theme-primary-color);
		}
	}

	body.platform-linux[arco-theme='dark'] & {
		color: #e5e5e5;

		&:hover {
			background-color: #3a3a3a;
		}

		&.active {
			color: var(--theme-primary-color);
		}
	}

	body[arco-theme='dark'] & {
		color: #c9cdd4;

		&:hover {
			background-color: #3a3a3a;
		}
	}
}
</style>

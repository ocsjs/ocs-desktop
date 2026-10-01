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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import Icon from './Icon.vue';
import { store } from '../store';

/**
 * 顶部栏窗口置顶按钮
 *
 * 系统的 traffic light 控制按钮（最小化/最大化/关闭）由 Electron titleBarOverlay
 * 渲染在网页内容之上，并非 Vue 组件，因此本按钮必须计算其宽度进行避让：
 * - win/linux：三个按钮位于右上角，宽度 = 窗口宽度 - 标题栏区域右边界
 * - darwin：三个按钮位于左上角，宽度 = 标题栏区域左边界（红绿灯区域宽度）
 *
 * 通过 navigator.windowControlsOverlay.getTitlebarAreaRect() 精确获取，
 * API 不可用时回退到平台经验宽度（win/linux Electron 默认三键约 138px，
 * macOS 红绿灯约 70px）。
 */
const isDarwin = process.platform === 'darwin';
const TRAFFIC_LIGHT_FALLBACK = isDarwin ? 70 : 138;

/** traffic light 控制按钮区域宽度（px） */
const trafficLightWidth = ref(TRAFFIC_LIGHT_FALLBACK);

function updateTrafficLightWidth() {
	const overlay = (navigator as any).windowControlsOverlay;
	if (overlay?.getTitlebarAreaRect) {
		try {
			const rect = overlay.getTitlebarAreaRect() as DOMRect;
			if (rect && rect.width > 0) {
				trafficLightWidth.value = isDarwin ? rect.x : window.innerWidth - rect.right;
				return;
			}
		} catch {
			// ignore
		}
	}
	trafficLightWidth.value = TRAFFIC_LIGHT_FALLBACK;
}

const positionStyle = computed(() => {
	// darwin：放在左侧红绿灯右侧（动态计算避让宽度）
	// win/linux：固定 right 135px 避让右上角三控制按钮，宽度加宽至 48px
	return isDarwin
		? { left: trafficLightWidth.value + 8 + 'px', right: 'auto', width: '32px' }
		: { right: '135px', left: 'auto', width: '48px' };
});

function togglePin() {
	// 与「设置-基本设置-窗口置顶」共用同一响应式状态，
	// App.vue 中的 watch 会将其同步到主进程窗口（setAlwaysOnTop）
	store.window.alwaysOnTop = !store.window.alwaysOnTop;
}

let overlay: any = null;
function onGeometryChange() {
	updateTrafficLightWidth();
}
function onResize() {
	updateTrafficLightWidth();
}

onMounted(() => {
	// 窗口控制按钮区域变化（如全屏切换/DPI 缩放）时重算避让宽度（仅 darwin 动态计算需要）
	if (!isDarwin) return;
	updateTrafficLightWidth();
	overlay = (navigator as any).windowControlsOverlay;
	overlay?.addEventListener?.('geometrychange', onGeometryChange);
	window.addEventListener('resize', onResize);
});

onUnmounted(() => {
	overlay?.removeEventListener?.('geometrychange', onGeometryChange);
	window.removeEventListener('resize', onResize);
});
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

	body[arco-theme='dark'] & {
		color: #c9cdd4;

		&:hover {
			background-color: #3a3a3a;
		}
	}
}
</style>

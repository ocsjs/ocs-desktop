<template>
	<!-- win7 分支：自绘窗口控制按钮（替代 titleBarOverlay——overlay 无法垂直偏移，会遮挡自绘边框与圆角）。
	     darwin 不渲染（mac 使用系统红绿灯） -->
	<div
		v-if="!isDarwin"
		class="window-controls"
	>
		<div
			class="wc-btn"
			title="最小化"
			@click="bridge.win.minimize()"
		>
			<MinusIcon :size="16" />
		</div>
		<div
			class="wc-btn"
			:title="isMaximized ? '还原' : '最大化'"
			@click="toggleMaximize"
		>
			<CopyIcon
				v-if="isMaximized"
				:size="13"
			/>
			<SquareIcon
				v-else
				:size="13"
			/>
		</div>
		<div
			class="wc-btn wc-close"
			title="关闭"
			@click="bridge.win.close()"
		>
			<XIcon :size="16" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { bridge } from '../utils/bridge';
import { MinusIcon, SquareIcon, CopyIcon, XIcon } from 'lucide-vue-next';

const isDarwin = bridge.platform === 'darwin';
const isMaximized = ref(false);

async function refreshMaximized() {
	isMaximized.value = await bridge.win.isMaximized().catch(() => false);
}

async function toggleMaximize() {
	if (await bridge.win.isMaximized().catch(() => false)) {
		await bridge.win.unmaximize();
	} else {
		await bridge.win.maximize();
	}
	await refreshMaximized();
}

// 双击标题栏拖拽区等外部途径也会改变最大化状态，resize 时同步图标
onMounted(() => {
	refreshMaximized();
	window.addEventListener('resize', refreshMaximized);
});
onUnmounted(() => {
	window.removeEventListener('resize', refreshMaximized);
});
</script>

<style scoped lang="less">
.window-controls {
	/* 绝对定位于标题栏右上角（.title 为 relative），跟随标题栏位于边框/圆角内侧 */
	position: absolute;
	right: 0;
	top: 0;
	height: var(--title-height);
	display: flex;
	z-index: 2;
	-webkit-app-region: no-drag;
	user-select: none;

	.wc-btn {
		width: 46px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: #4e5969;

		&:hover {
			background-color: #f0f0f0;
		}

		&.wc-close:hover {
			background-color: #e81123;
			color: #fff;
		}
	}
}

body[arco-theme='dark'] .window-controls .wc-btn {
	color: #c9cdd4;

	&:hover {
		background-color: #3a3a3a;
	}

	&.wc-close:hover {
		background-color: #e81123;
		color: #fff;
	}
}
</style>

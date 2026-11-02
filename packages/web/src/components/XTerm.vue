<template>
	<div
		ref="xtermRef"
		class="xterm-container"
	/>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import 'xterm/css/xterm.css';

import { XTerm } from '../utils/xterm';
import { Process } from '../utils/process';

const props = defineProps<{
	uid: string;
}>();

const xterm = new XTerm();
const xtermRef = ref();

/**
 * 容器尺寸监听：组件挂载时可能位于收起的折叠面板内（容器不可见、尺寸为 0，fit 失败导致终端尺寸异常、无法滚动），
 * 折叠展开/抽屉动画结束后容器获得真实尺寸，此时重新 fit 恢复正常渲染与滚动
 */
let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
	openXTerm();
	resizeObserver = new ResizeObserver(() => xterm.fit());
	resizeObserver.observe(xtermRef.value);
});

onUnmounted(() => {
	resizeObserver?.disconnect();
});

function openXTerm() {
	const process = Process.from(props.uid);

	/** 绑定元素 */
	xterm.open(xtermRef.value as HTMLElement);
	xterm.clear();

	/** 显示日志输出 */
	for (const log of process?.logs || []) {
		xterm.write(log);
	}

	if (process?.shell) {
		process.shell.stdout?.on('data', (data) => xterm.write(data));
		process.shell.stderr?.on('data', (data) => xterm.write(`[错误] : ${data}`));
	}

	xterm.fit();
}
</script>

<style scoped lang="less">
.xterm-container {
	/* fix : https://github.com/xtermjs/xterm.js/issues/3564#issue-1062239799 */
	overflow: hidden;
	height: 200px;
	border-radius: 4px;
	padding: 12px;
	background-color: #32302f;
	/* 阻断滚动链：滚轮落在容器 padding 区域时也不带动外层滚动 */
	overscroll-behavior: contain;

	/* xterm.css 默认为 overflow-y: scroll，无日志时滚动条也常驻；改为 auto 按需显示 */
	:deep(.xterm-viewport) {
		overflow-y: auto !important;
		/* 阻断滚动链：日志区内滚轮到顶/到底后不带动外层抽屉内容滚动 */
		overscroll-behavior: contain;
	}
}
</style>

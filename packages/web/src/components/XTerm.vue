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
	// 移除 console 事件监听，防止组件反复挂载导致监听累积。
	// 必须使用挂载时绑定的同一实例：浏览器关闭后 Process 已从 processes 移除，
	// 重新 Process.from 查找会拿不到导致 off 静默失效
	boundProcess?.off('console', onConsole);
	boundProcess?.off('console-stderr', onConsoleStderr);
	boundProcess = undefined;
});

const onConsole = (data: string) => xterm.write(data);
const onConsoleStderr = (data: string) => xterm.write(`[错误] : ${data}`);

/** 挂载时绑定的 Process 实例（卸载解绑用） */
let boundProcess: Process | undefined;

function openXTerm() {
	boundProcess = Process.from(props.uid);

	/** 绑定元素 */
	xterm.open(xtermRef.value as HTMLElement);
	xterm.clear();

	/** 显示日志输出 */
	for (const log of boundProcess?.logs || []) {
		xterm.write(log);
	}

	// worker stdio 由主进程转发（'script-worker' 频道 → Process console/console-stderr 事件）
	if (boundProcess) {
		boundProcess.on('console', onConsole);
		boundProcess.on('console-stderr', onConsoleStderr);
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

<template>
	<!-- 资源监控浮层：右下角绝对定位、全页面可见，仅在有浏览器运行时渲染 -->
	<a-tooltip
		v-if="visible"
		position="top"
	>
		<template #content>
			<div>OCS 软件整体实测资源占用（每 10 秒更新）</div>
			<div>CPU：{{ cpuText }}（多核累计占用率，可超 100%）</div>
			<div>内存：{{ memText }}（{{ totalMemMBText }}，占系统总内存比例）</div>
		</template>
		<div class="resource-monitor">
			<span class="rm-item"><CpuIcon class="rm-icon" />{{ cpuText }}</span>
			<span class="rm-item"><MemoryStickIcon class="rm-icon" />{{ memText }}</span>
		</div>
	</a-tooltip>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { processes } from '../utils/process';
import { bridge } from '../utils/bridge';
import { onRendererEvent } from '../utils/ipc';
import { CpuIcon, MemoryStickIcon } from 'lucide-vue-next';

/** 系统总内存（MB），挂载时获取一次即可（不变量） */
const totalSystemMB = ref(0);
/** 软件整体资源占用（主进程 resource-monitor 每 10s 推送，Windows 整体口径） */
const overall = ref({ mb: 0, cpuPercent: 0 });
onMounted(async () => {
	try {
		totalSystemMB.value = Math.round((await bridge.os.totalmem()) / 1024 / 1024);
	} catch {}
	onRendererEvent('resource-usage', (payload) => {
		if (payload && typeof payload.mb === 'number') overall.value = payload;
	});
});

/** 运行中（启动中+已启动）的浏览器进程 */
const runningProcs = computed(() => processes.filter((p) => p.status === 'launching' || p.status === 'launched'));

/** 仅在有浏览器运行时渲染 */
const visible = computed(() => runningProcs.value.length > 0);

/** 软件整体 CPU 占用（多核并行可超 100%） */
const cpuText = computed(() => overall.value.cpuPercent.toFixed(1) + '%');

/** 软件整体内存占用（MB） */
const totalMemMB = computed(() => overall.value.mb);

/** 软件整体内存占用，占系统总内存百分比 */
const memText = computed(() => {
	if (!totalSystemMB.value) return '--';
	return ((totalMemMB.value / totalSystemMB.value) * 100).toFixed(1) + '%';
});

/** tooltip 中的内存具体数值：已用 / 总量（GB 显示更直观） */
const totalMemMBText = computed(() => {
	if (!totalSystemMB.value) return '获取中...';
	const toGB = (mb: number) => (mb / 1024).toFixed(1);
	return `${toGB(totalMemMB.value)} / ${toGB(totalSystemMB.value)} GB`;
});
</script>

<style scoped lang="less">
.resource-monitor {
	position: fixed;
	right: 12px;
	/* 置底显示；全局状态栏已上移至 bottom: 48px，两者不重叠 */
	bottom: 12px;
	z-index: 3000;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 4px 10px;
	border-radius: 10px;
	font-size: 12px;
	line-height: 1.5;
	color: var(--theme-text-color-secondary);
	background-color: var(--theme-card-bg);
	border: 1px solid var(--theme-border-color-light);
	opacity: 0.75;
	user-select: none;

	.rm-item {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}

	.rm-icon {
		font-size: 14px;
	}

	/* 悬停时完全不透明，提升可读性 */
	&:hover {
		opacity: 1;
	}
}
</style>

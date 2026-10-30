<template>
	<!-- 资源监控浮层：右下角绝对定位、全页面可见，仅在有浏览器运行且设置开启时渲染 -->
	<a-tooltip
		v-if="visible"
		position="top"
	>
		<template #content>
			<div>全部运行中浏览器的实测资源占用（每 10 秒更新）</div>
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
import { remote } from '../utils/remote';
import { store } from '../store';
import { CpuIcon, MemoryStickIcon } from 'lucide-vue-next';

/** 系统总内存（MB），挂载时获取一次即可（不变量） */
const totalSystemMB = ref(0);
onMounted(async () => {
	try {
		totalSystemMB.value = Math.round((await remote.os.call('totalmem')) / 1024 / 1024);
	} catch {}
});

/** 运行中（启动中+已启动）的浏览器进程 */
const runningProcs = computed(() => processes.filter((p) => p.status === 'launching' || p.status === 'launched'));

/** 仅在有浏览器运行且「资源监控」设置开启时渲染 */
const visible = computed(() => store.render.setting.browser.resourceMonitor !== false && runningProcs.value.length > 0);

/** 全部运行中浏览器的 CPU 占用合计（worker 实测上报；多核并行可超 100%） */
const cpuText = computed(() => {
	const total = runningProcs.value.reduce((sum, p) => sum + p.cpuPercent, 0);
	return total.toFixed(1) + '%';
});

/** 全部运行中浏览器的内存占用合计（MB） */
const totalMemMB = computed(() => runningProcs.value.reduce((sum, p) => sum + p.memoryUsageMB, 0));

/** 全部运行中浏览器的内存占用合计，占系统总内存百分比 */
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

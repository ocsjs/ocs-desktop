<template>
	<Transition name="status-bar">
		<span
			v-if="statusBarState.visible"
			class="status-bar"
			:style="barStyle"
		>
			<LoaderCircleIcon
				v-if="statusBarState.loading"
				class="icon-spin"
			/>
			<component
				:is="STATUS_ICONS[statusBarState.icon]"
				v-else-if="statusBarState.icon && STATUS_ICONS[statusBarState.icon]"
			/>
			<span>{{ statusBarState.message }}</span>
		</span>
	</Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
	LoaderCircleIcon,
	InfoIcon,
	CircleCheckIcon,
	TriangleAlertIcon,
	CircleAlertIcon,
	CopyIcon,
	ScissorsIcon,
	ClipboardPasteIcon,
	BanIcon,
	GripVerticalIcon
} from 'lucide-vue-next';
import { statusBarState, getTypeColors } from '../utils/statusBar';

/** 状态栏图标名 → Lucide 组件（statusBar.ts 的 icon 字段可用值即此表的 key） */
const STATUS_ICONS: Record<string, any> = {
	info: InfoIcon,
	check_circle: CircleCheckIcon,
	warning: TriangleAlertIcon,
	error: CircleAlertIcon,
	content_copy: CopyIcon,
	content_cut: ScissorsIcon,
	content_paste: ClipboardPasteIcon,
	block: BanIcon,
	drag_indicator: GripVerticalIcon
};

const barStyle = computed(() => {
	const colors = getTypeColors(statusBarState.type);
	return {
		color: colors.color,
		backgroundColor: colors.bgColor
	};
});
</script>

<style scoped lang="less">
.status-bar {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 7px 14px;
	border-radius: 6px;
	font-size: 13px;
	line-height: 1.4;
	user-select: none;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	/* 浮层卡片化：细描边取状态色的 30% 透明度（color-mix 基于 currentColor），投影提供层级感 */
	border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);

	body[arco-theme='dark'] & {
		color: v-bind('getTypeColors(statusBarState.type).darkColor');
		background-color: v-bind('getTypeColors(statusBarState.type).darkBgColor');
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
	}
}

/* 入场：宽度展开 + 淡入上浮 */
.status-bar-enter-active {
	transition: opacity 0.35s ease, max-width 0.35s ease, padding 0.35s ease, transform 0.35s ease;
}

/* 退场：只做 opacity + transform（合成器加速，无 reflow），
   不做宽度收缩——max-width/padding 过渡会持续触发重排，
   内容被逐帧裁剪是"不丝滑"的主因；快速淡出即足够干净 */
.status-bar-leave-active {
	transition: opacity 0.22s ease-in, transform 0.22s ease-in;
}

.status-bar-enter-from {
	opacity: 0;
	max-width: 0;
	/* 水平 padding 一并收起，避免残留一小段空胶囊 */
	padding-left: 0;
	padding-right: 0;
	/* 轻微上浮，贴合右下角浮层语义 */
	transform: translateY(6px);
}

.status-bar-leave-to {
	opacity: 0;
	transform: translateY(6px);
}
</style>

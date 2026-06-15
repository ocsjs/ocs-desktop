<template>
	<Transition name="status-bar">
		<span
			v-if="statusBarState.visible"
			class="status-bar"
			:style="barStyle"
		>
			<icon-loading
				v-if="statusBarState.loading"
				class="status-bar-spin"
			/>
			<Icon
				v-else-if="statusBarState.icon"
				:type="statusBarState.icon"
			/>
			<span>{{ statusBarState.message }}</span>
		</span>
	</Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { IconLoading } from '@arco-design/web-vue/es/icon';
import { statusBarState, getTypeColors } from '../utils/statusBar';

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
	gap: 4px;
	padding: 2px 10px;
	border-radius: 4px;
	font-size: 12px;
	line-height: 1.2;
	user-select: none;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	body[arco-theme='dark'] & {
		color: v-bind('getTypeColors(statusBarState.type).darkColor');
		background-color: v-bind('getTypeColors(statusBarState.type).darkBgColor');
	}
}

.status-bar-spin {
	animation: status-bar-spin 1s linear infinite;
	color: #165dff;
	body[arco-theme='dark'] & {
		color: #5ca0ff;
	}
}

.status-bar-enter-active {
	transition: opacity 0.5s ease, max-width 0.5s ease;
}

.status-bar-leave-active {
	transition: opacity 0.5s ease, max-width 0.5s ease;
}

.status-bar-enter-from {
	opacity: 0;
	max-width: 0;
}

.status-bar-leave-to {
	opacity: 0;
	max-width: 0;
}

@keyframes status-bar-spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}
</style>

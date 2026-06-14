<template>
	<Transition name="status-bar">
		<span
			v-if="statusBarState.visible"
			class="status-bar"
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
import Icon from './Icon.vue';
import { IconLoading } from '@arco-design/web-vue/es/icon';
import { statusBarState } from '../utils/statusBar';
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
	background-color: #e8f3ff;
	color: #1d2129;
	user-select: none;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	body[arco-theme='dark'] & {
		background-color: #1d2d44;
		color: #e5e6eb;
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

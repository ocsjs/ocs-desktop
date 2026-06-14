<template>
	<Transition name="status-bar">
		<div
			v-if="statusBarState.visible"
			class="status-bar"
		>
			<div class="status-bar-content">
				<icon-loading
					v-if="statusBarState.loading"
					class="status-bar-icon status-bar-spin"
				/>
				<Icon
					v-else-if="statusBarState.icon"
					:type="statusBarState.icon"
					class="status-bar-icon"
				/>
				<span class="status-bar-message">{{ statusBarState.message }}</span>
			</div>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import Icon from './Icon.vue';
import { IconLoading } from '@arco-design/web-vue/es/icon';
import { statusBarState } from '../utils/statusBar';
</script>

<style scoped lang="less">
.status-bar {
	position: fixed;
	bottom: 32px;
	right: 12px;
	z-index: 1000;
	pointer-events: none;
	user-select: none;
}

.status-bar-content {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 14px;
	border-radius: 6px;
	background-color: #e8f3ff;
	border: 1px solid #bedaff;
	box-shadow: 0 3px 14px rgba(22, 93, 255, 0.12);
	max-width: 400px;
	body[arco-theme='dark'] & {
		background-color: #1d2d44;
		border-color: #2e5a8a;
		box-shadow: 0 3px 14px rgba(22, 93, 255, 0.2);
	}
}

.status-bar-icon {
	font-size: 14px;
	color: #165dff;
	flex-shrink: 0;
	body[arco-theme='dark'] & {
		color: #5ca0ff;
	}
}

.status-bar-spin {
	animation: status-bar-spin 1s linear infinite;
	color: #165dff;
	body[arco-theme='dark'] & {
		color: #5ca0ff;
	}
}

.status-bar-message {
	font-size: 14px;
	line-height: 1.4;
	color: #1d2129;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	body[arco-theme='dark'] & {
		color: #e5e6eb;
	}
}

/* 过渡动画：从右侧滑入 */
.status-bar-enter-active {
	transition: opacity 0.25s ease, transform 0.25s ease;
}

.status-bar-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.status-bar-enter-from {
	opacity: 0;
	transform: translateX(20px);
}

.status-bar-leave-to {
	opacity: 0;
	transform: translateX(20px);
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

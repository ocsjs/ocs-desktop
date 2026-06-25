<template>
	<div class="context-hint">
		<IconInfoCircle />
		右键浏览器/空白处可打开菜单
	</div>
</template>

<script setup lang="ts"></script>

<style scoped lang="less">
.context-hint {
	flex-shrink: 0;
	font-size: 11px;
	color: #aaa;
	padding: 4px 4px 8px 0;
	user-select: none;
	align-items: center;
	gap: 4px;
}
</style>

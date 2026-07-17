<template>
	<span
		class="material-icons-outlined plus-icon notranslate"
		:style="{ fontSize: `${size}px` }"
		:title="title"
		translate="no"
		aria-hidden="true"
	>
		{{ name }}
	</span>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		name: string;
		title?: string;
		size?: number;
	}>(),
	{
		title: '',
		size: 22
	}
);
</script>

<style scoped lang="less">
.plus-icon {
	font-family: 'Material Icons Outlined' !important;
	line-height: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-weight: 400;
	font-style: normal;
	letter-spacing: normal;
	text-transform: none;
	white-space: nowrap;
	word-wrap: normal;
	direction: ltr;
	font-feature-settings: 'liga';
	-webkit-font-feature-settings: 'liga';
	-webkit-font-smoothing: antialiased;
}
</style>

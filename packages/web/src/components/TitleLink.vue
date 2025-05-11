<template>
	<a-doption @click="open(url)">
		<slot name="title">
			{{ title }}
		</slot>
	</a-doption>
</template>

<script setup lang="ts">
import { electron } from '../utils/node';

defineProps<{
	url: string;
	title?: string;
}>();

const { shell } = electron;

function open(url: string) {
	shell.openExternal(url);
}
</script>

<style scoped lang="less"></style>

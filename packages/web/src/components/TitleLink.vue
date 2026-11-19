<template>
	<a-doption
		uninject-context
		@click="open(url)"
	>
		<slot name="title">
			{{ title }}
		</slot>
	</a-doption>
</template>

<script setup lang="ts">
import { bridge } from '../utils/bridge';

defineProps<{
	url: string;
	title?: string;
}>();

const shell = bridge.shell;

function open(url: string) {
	shell.openExternal(url);
}
</script>

<style scoped lang="less"></style>

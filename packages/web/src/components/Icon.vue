<template>
	<!-- see https://fonts.google.com/icons -->
	<component
		:is="slots.default ? Space : span"
		class="d-inline-flex"
		size="mini"
	>
		<span
			:style="{ color, fontSize: size ? size + 'px' : 'inherit' }"
			:class="'material-icons' + (theme === 'filled' ? '' : '-' + theme)"
			:title="title"
		>
			{{ type }}
		</span>

		<span><slot /></span>
	</component>
</template>

<script setup lang="ts">
import { Space } from '@arco-design/web-vue';
import { h, toRefs, useSlots } from 'vue';
const span = h('span');
interface IconProps {
	type: string;
	theme?: 'outlined' | 'filled' | 'rounded' | 'sharp' | 'two-tone';
	title?: string;
	active?: boolean;
	color?: string;
	size?: number;
}
const slots = useSlots();
const props = withDefaults(defineProps<IconProps>(), {
	theme: 'outlined',
	title: '',
	size: undefined,
	color: undefined
});
const { type } = toRefs(props);
</script>

<style scoped lang="less">
.active {
	color: #1890ff;
}
</style>

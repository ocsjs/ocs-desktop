<template>
	<a-row class="row flex-nowrap mb-2">
		<a-col
			flex="200px"
			class="desc-label"
		>
			{{ label }} :
		</a-col>

		<a-col
			flex="auto"
			class="d-inline-flex align-items-center"
		>
			<span
				v-if="desc"
				class="desc"
				:class="textClass"
			>
				{{ String(desc) }}
			</span>
			<slot />
		</a-col>
	</a-row>
</template>

<script setup lang="ts">
import { toRefs } from 'vue';
interface DescriptionProps {
	label: string;
	desc?: any;
	textClass?: any;
}
const props = withDefaults(defineProps<DescriptionProps>(), {
	desc: '',
	textClass: ''
});
const { label, desc, textClass } = toRefs(props);
</script>

<style scoped lang="less">
.desc {
	word-wrap: break-word;
	word-break: break-all;
	font-size: 14px;
}

.desc-label {
	white-space: nowrap;
}
</style>

<template>
	<a-tooltip content="标签分类">
		<a-space
			v-if="readOnly === false || tags.length > 0"
			class="flex-wrap"
			:size="1"
		>
			<template
				v-for="(tag, index) in tags"
				:key="index"
			>
				<a-tooltip
					v-if="tag.name.length > 20"
					class="tag"
					:content="tag.name"
				>
					<a-tag
						:closable="!readOnly"
						:color="tag.color"
						:size="props.size"
						@close="handleClose(tag)"
					>
						{{ `${tag.name.slice(0, 20)}...` }}
					</a-tag>
				</a-tooltip>
				<a-tag
					v-else
					class="tag"
					:closable="!readOnly"
					:color="tag.color"
					:size="props.size"
					@close="handleClose(tag)"
				>
					{{ tag.name }}
				</a-tag>
			</template>

			<a-tag
				v-if="!readOnly"
				style="border: 1px gray; border-style: dashed; cursor: pointer"
				:size="props.size"
				@click="showModel"
			>
				添加 <icon-plus />
			</a-tag>
		</a-space>
	</a-tooltip>

	<a-modal
		v-model:visible="state.modalVisible"
		align-center
		ok-text="确认"
		cancel-text="取消"
		title="添加新标签"
		@ok="handleInputConfirm"
	>
		<div class="d-flex mb-3">
			<span class="col-2">标签名: </span>
			<a-auto-complete
				ref="inputRef"
				v-model="state.inputValue"
				placeholder="输入标签名"
				size="small"
				style="width: 100%"
				:data="options"
				@search="handleSearch"
			>
				<template
					#option="{
						data: {
							raw: { value, count, color }
						}
					}"
				>
					<a-tag :color="color"> {{ value }} </a-tag>
					<span style="float: right"> {{ count }} </span>
				</template>
			</a-auto-complete>
		</div>
		<div class="d-flex">
			<span class="col-2">标签颜色: </span>
			<template v-if="store.render.browser.tags[state.inputValue]">
				<div
					style="cursor: not-allowed; width: 50px"
					:style="{
						backgroundColor: store.render.browser.tags[state.inputValue].color
					}"
					@click.prevent
				></div>
			</template>
			<template v-else>
				<ColorPicker
					v-model:hex="state.color"
					:default-color="state.color"
				/>
			</template>
		</div>
	</a-modal>
</template>
<script setup lang="ts">
import { ref, reactive } from 'vue';
import { store } from '../store';
import { Tag } from '../fs/interface';
import ColorPicker from 'colorpicker-v3'; // 注册组件
import 'colorpicker-v3/style.css'; // 引入样式文件
const object = Object;

const props = withDefaults(
	defineProps<{
		tags: Tag[];
		size: 'medium' | 'large' | 'small' | undefined;
		readOnly?: boolean;
	}>(),
	{
		readOnly: false,
		size: 'small'
	}
);
const emits = defineEmits<{
	(e: 'update:tags', tags: Tag[]): void;
	(e: 'remove', tag: Tag): void;
	(e: 'create', tag: Tag): void;
}>();

const getOptions = () =>
	object
		.keys(store.render.browser.tags)
		.map((key) => ({ value: key, label: key, ...store.render.browser.tags[key] }))
		.sort((a, b) => b.count - a.count);

const options = ref(getOptions());

const inputRef = ref();
const state = reactive({
	modalVisible: false,
	inputValue: '',
	color: '#808080'
});

const handleSearch = (val: string) => {
	options.value = getOptions().filter((opt) => RegExp(val).test(opt.value));
};

const handleClose = (removeTag: Tag) => {
	const tags = props.tags.filter((tag) => tag.name !== removeTag.name);
	emits('update:tags', tags);
	emits('remove', removeTag);
};

const showModel = () => {
	state.modalVisible = true;
	// 弹窗动作完成后，自动聚焦
	setTimeout(() => {
		inputRef.value.focus();
	}, 300);
};

const handleInputConfirm = () => {
	const inputValue = state.inputValue;
	let tags = props.tags;

	if (inputValue && tags.map((t) => t.name).findIndex((n) => n === inputValue) === -1) {
		const newTag = { name: inputValue, color: state.color };
		tags = [...tags, newTag];
		emits('create', newTag);
	}
	// 重置状态
	Object.assign(state, {
		modalVisible: false,
		inputValue: '',
		color: ''
	});

	emits('update:tags', tags);
};
</script>

<style scoped lang="less">
:deep(.zs-color-picker-panel) {
	position: fixed;
}

.tag {
	margin: 2px;
}
</style>

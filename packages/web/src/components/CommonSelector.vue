<template>
	<div>
		<template v-if="props.list.length === 0">
			<a-empty description="暂无数据" />
		</template>
		<template v-else>
			<template
				v-for="(item, index) of props.list.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)"
				:key="index"
			>
				<div
					class="item"
					:class="{
						selected: isSelected(item)
					}"
					@click="select(item)"
				>
					<slot
						name="content"
						:item="item"
					>
						{{ item.key }}
					</slot>
				</div>
			</template>

			<div class="d-flex justify-content-center">
				<a-pagination
					:total="props.list.length"
					:show-size-changer="false"
					:show-quick-jumper="true"
					:show-total="true"
					:hide-on-single-page="true"
					:default-current="1"
					:default-page-size="state.pageSize"
					@change="(page) => (state.page = page)"
				>
				</a-pagination>
			</div>

			<div class="mt-3 float-end">
				<a-space>
					<span
						v-if="props.multiple"
						style="font-size: 12px"
						class="text-secondary float-end"
					>
						共选中 {{ selected.length }} 个
					</span>
					<a-button
						style="width: 100px"
						type="primary"
						@click="confirm"
					>
						确定
					</a-button>
				</a-space>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts" generic="Item extends {key: string}  ">
import { Ref, ref, reactive } from 'vue';

const props = defineProps<{
	list: Item[];
	onSelect: (items: Item[]) => void;
	multiple: boolean;
}>();

const selected = ref<Item[]>([]) as Ref<Item[]>;

const state = reactive({
	page: 1,
	pageSize: 8
});

function confirm() {
	props.onSelect(selected.value);
}

function select(item: Item) {
	if (props.multiple) {
		const index = selected.value.findIndex((i) => i.key === item.key);
		if (index === -1) {
			selected.value.push(item);
		} else {
			selected.value.splice(index, 1);
		}
	} else {
		selected.value = [item];
	}
}

function isSelected(item: Item) {
	return selected.value.find((i) => i.key === item.key) !== undefined;
}
</script>

<style scoped lang="less">
.item {
	border: 1px solid #e1e1e18c;
	padding: 6px;
	margin: 8px 0px;
	border-radius: 4px;
	cursor: pointer;

	&.selected {
		border: 1px solid #0d6efd8c;
	}
}
</style>

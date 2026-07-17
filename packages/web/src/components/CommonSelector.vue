<template>
	<div>
		<template v-if="props.list.length === 0">
			<a-empty :description="emptyText" />
		</template>
		<template v-else>
			<template
				v-for="(item, index) of props.list.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)"
				:key="index"
			>
				<div class="d-flex gap-2">
					<a-checkbox
						:model-value="isSelected(item)"
						@click.stop="select(item)"
					></a-checkbox>
					<div
						style="flex: 1 1 auto"
						class="item"
						:class="{
							selected: isSelected(item)
						}"
						@click="select(item)"
					>
						<div class="item-content">
							<slot
								name="content"
								:item="item"
							>
								{{ item.key }}
							</slot>
						</div>
					</div>
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

			<div class="mt-3">
				<a-space class="d-flex justify-content-between">
					<span v-if="props.multiple"> 共选中 {{ selected.length }} 个 </span>
					<a-space>
						<a-tooltip :content="removeAllText">
							<a-button
								v-if="selected.length"
								size="mini"
								type="outline"
								status="danger"
								@click="removeAll"
							>
								<template #icon>
									<icon-delete />
								</template>
							</a-button>
						</a-tooltip>
						<a-button
							style="width: 100px"
							type="primary"
							@click="confirm"
						>
							{{ confirmText }}
						</a-button>
					</a-space>
				</a-space>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts" generic="Item extends {key: string}  ">
import { Ref, ref, reactive } from 'vue';

const props = withDefaults(
	defineProps<{
		list: Item[];
		selected?: Item[];
		onSelect?: (items: Item[]) => void;
		multiple?: boolean;
		confirmText?: string;
		emptyText?: string;
		removeAllText?: string;
	}>(),
	{
		selected: () => [],
		onSelect: () => {},
		multiple: false,
		confirmText: '确定',
		emptyText: '暂无数据',
		removeAllText: '移除全部已选'
	}
);

const selected = ref<Item[]>([...props.selected]) as Ref<Item[]>;

const state = reactive({
	page: 1,
	pageSize: 8
});

function confirm() {
	console.log(selected.value);
	props.onSelect(selected.value);
}

function select(item: Item) {
	let next: Item[];
	if (props.multiple) {
		const index = selected.value.findIndex((i) => i.key === item.key);
		if (index === -1) {
			next = [...selected.value, item];
		} else {
			next = selected.value.filter((i) => i.key !== item.key);
		}
	} else {
		next = isSelected(item) ? [] : [item];
	}
	selected.value = next;
}

function removeAll() {
	selected.value = [];
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

.selector-box {
	display: inline-block;
	width: 14px;
	height: 14px;
	border: 1px solid #c9cdd4;
	border-radius: 2px;
	background-color: #fff;

	&.radio {
		border-radius: 50%;
	}
}
</style>

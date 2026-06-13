<template>
	<div
		v-if="instance"
		class="entity align-items-center d-flex"
		:class="{ active: store.render.browser.currentBrowserUid === instance.uid }"
		:data-uid="instance.uid"
		@click="instance?.select()"
	>
		<div style="cursor: pointer; flex: auto">
			<div
				style="cursor: pointer; flex: auto"
				class="text-secondary entity-name align-items-center d-flex"
			>
				<div
					v-if="slots.prefix"
					style="cursor: pointer; flex: 0 0 auto"
				>
					<slot name="prefix"></slot>
				</div>

				<!-- 图标 -->
				<span
					v-if="slots.icon"
					class="d-inline-flex align-items-center"
					style="cursor: pointer; padding: 0px 4px; font-size: 16px"
					@click="instance?.select()"
				>
					<slot name="icon"></slot>
				</span>

				<!-- 名字 -->
				<a-tooltip content="右键打开菜单">
					<span class="ms-2">
						<a-input
							v-show="instance.renaming"
							ref="renameInput"
							v-model="renameValue"
							size="mini"
							@click.stop
							@blur="instance?.rename(renameValue)"
						></a-input>
						<span v-show="!instance.renaming">
							{{ instance.name }}
						</span>
					</span>

					<div style="flex: 1 1 auto">
						<slot name="suffix"></slot>
					</div>
				</a-tooltip>
			</div>

			<div
				v-if="slots.extra"
				class="d-flex align-items-center"
				style="margin-left: 32px"
			>
				<slot name="extra"></slot>
			</div>
		</div>

		<!-- 操作按钮 -->
		<div
			v-if="slots.actions"
			style="flex: 0 0 auto"
			class="text-secondary text-nowrap d-flex justify-content-end ps-1 pe-2"
		>
			<a-space
				:size="0"
				class="actions justify-content-end"
			>
				<template #split>
					<a-divider
						class="ms-1 me-1"
						direction="vertical"
					/>
				</template>

				<slot name="actions"></slot>
			</a-space>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, ref, watch, useSlots } from 'vue';
import { store } from '../store';
import { FolderOptions, BrowserOptions, FolderType } from '../fs/interface';
import { Browser } from '../fs/browser';
import { Folder } from '../fs/folder';

const slots = useSlots();

const props = withDefaults(
	defineProps<{
		entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>;
	}>(),
	{}
);

const renameInput = ref<any>();
const renameValue = ref(props.entity.name);

const instance = props.entity.type === 'browser' ? Browser.from(props.entity.uid) : Folder.from(props.entity.uid);

watch(
	() => props.entity.renaming,
	() => {
		if (props.entity.renaming) {
			nextTick(active);
		}
	}
);

onMounted(() => {
	nextTick(active);
});

function active() {
	const input: HTMLInputElement = renameInput.value.$el.querySelector('input');
	input.focus();
	input.select();
}
</script>
<style scoped lang="less">
.entity-drop-menu {
	min-width: 180px;
}

.entity-name {
	text-overflow: ellipsis;
	white-space: nowrap;
	overflow: hidden;
	font-size: 14px;
	color: #474747 !important;

	// 禁止选择
	-moz-user-select: none;
	/*火狐*/
	-webkit-user-select: none;
	/*webkit浏览器*/
	-ms-user-select: none;
	/*IE10*/
	-khtml-user-select: none;
	/*早期浏览器*/
	user-select: none;
}

.entity {
	border-bottom: 1px solid #eeeeee;

	&:hover {
		border-radius: 4px;
		background-color: #f7f7f7;
	}

	&.active {
		background-color: #3577db25;
	}
}
</style>

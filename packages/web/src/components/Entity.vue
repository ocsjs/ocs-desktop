<template>
	<div
		v-if="instance"
		class="entity align-items-center d-flex"
		:class="{
			active: store.render.browser.currentBrowserUid === instance.uid,
			'is-context': contextUid === instance.uid,
			'is-dragging': isDragging,
			'drop-before': isDropTarget && dropPosition === 'before',
			'drop-after': isDropTarget && dropPosition === 'after',
			'drop-inside': isDropTarget && dropPosition === 'inside'
		}"
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

				<a-tooltip
					:content="
						dragCount > 0 ? `正在拖入${dragCount}个文件` : instance.type === 'folder' ? '返回上一级' : '右键打开菜单'
					"
				>
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
			@click.stop
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
import type { DropPosition } from '../composables/useEntityDrag';
import { Entity } from '../fs/entity';
import { contextUid } from '../fs';

const slots = useSlots();

const props = withDefaults(
	defineProps<{
		entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>;
		isDragging?: boolean;
		isDropTarget?: boolean;
		dropPosition?: DropPosition;
		dragCount?: number;
	}>(),
	{
		isDragging: false,
		isDropTarget: false,
		dropPosition: null,
		dragCount: 0
	}
);

const renameInput = ref<any>();
const renameValue = ref(props.entity.name);

const instance: Entity =
	props.entity.uid === '__parent_back__'
		? ({
				type: 'folder',
				uid: '__parent_back__',
				name: '...',
				select: () => {},
				rename: () => {},
				remove: () => {},
				location: () => {}
		  } as any)
		: props.entity.type === 'browser'
		? Browser.from(props.entity.uid)
		: Folder.from(props.entity.uid);

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
	// 右键选中样式
	&.is-context {
		background-color: #e8f3ff;
		border-radius: 4px;
	}

	// 拖拽中的项目样式
	&.is-dragging {
		opacity: 0.4;
	}

	// 放置位置指示线 - 上方
	&.drop-before {
		box-shadow: inset 0 2px 0 0 #3577db;
	}

	// 放置位置指示线 - 下方
	&.drop-after {
		box-shadow: inset 0 -2px 0 0 #3577db;
	}

	// 文件夹接收拖入样式
	&.drop-inside {
		background-color: rgba(53, 119, 219, 0.1);
		border-radius: 4px;
	}
}
</style>

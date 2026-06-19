<template>
	<div>
		<!-- 返回上一级的 ... 文件夹 -->
		<Entity
			v-if="showParentBack"
			class="entity parent-back-entity"
			:entity="parentBackEntity"
			:is-drop-target="isParentBackDropTarget"
			:drop-position="isParentBackDropTarget ? 'inside' : null"
			@click="goToParent"
			@dragover="onParentBackDragOver($event)"
			@dragleave="onParentBackDragLeave($event)"
			@drop="onParentBackDrop"
		>
			<template #icon>
				<Icon
					theme="filled"
					type="folder"
				></Icon>
			</template>
		</Entity>

		<template v-for="child of entities">
			<Entity
				v-if="child.type !== 'browser'"
				:key="child.uid"
				class="entity"
				:entity="child"
				:is-drop-target="entityDragStates[child.uid]?.isDropTarget ?? false"
				:drop-position="entityDragStates[child.uid]?.dropPosition ?? null"
				:drag-count="
					entityDragStates[child.uid]?.isDropTarget && entityDragStates[child.uid]?.dropPosition === 'inside'
						? dragCount
						: 0
				"
				@dragover="onDragOver(child, $event)"
				@dragleave="onDragLeave($event)"
				@drop="onDrop(child)"
			>
				<template #icon>
					<Icon
						theme="filled"
						type="folder"
					></Icon>
				</template>
			</Entity>
		</template>

		<template v-for="child of entities">
			<Entity
				v-if="child.type === 'browser'"
				:key="child.uid"
				class="entity"
				:entity="child"
				:is-dragging="entityDragStates[child.uid]?.isDragging ?? false"
				:is-drop-target="entityDragStates[child.uid]?.isDropTarget ?? false"
				:drop-position="entityDragStates[child.uid]?.dropPosition ?? null"
				:drag-count="0"
				draggable="true"
				@dragstart="onDragStart(child, $event)"
				@dragover="onDragOver(child, $event)"
				@dragleave="onDragLeave($event)"
				@drop="onDrop(child)"
				@dragend="onDragEnd"
			>
				<template #prefix>
					<div class="d-flex align-items-center">
						<!-- 单选框 -->
						<a-checkbox
							v-model="child.checked"
							class="ps-1 pe-1"
							style="width: 24px"
							@click.stop
							@mousedown.stop
						></a-checkbox>
					</div>
				</template>

				<template #suffix>
					<!-- 标签 -->
					<div
						v-if="child.tags.length"
						class="text-secondary tags"
						style="flex: 0 0 auto"
					>
						<a-divider
							class="m-1"
							direction="vertical"
						>
						</a-divider>
						<Tags
							:tags="child.tags"
							:read-only="true"
							size="small"
						></Tags>
					</div>
				</template>

				<template
					v-if="child.tags.length || child.notes"
					#extra
				>
					<div
						style="flex: 1 1 auto; overflow: auto; max-width: 700px"
						class="d-flex align-items-center"
					>
						<!-- 备注 -->
						<div
							v-if="child.notes?.trim()"
							class="text-secondary notes flex-wrap"
							style="flex: 1 1 auto"
						>
							<span> {{ child.notes }} </span>
						</div>
					</div>
				</template>

				<template #actions>
					<BrowserOperators
						:browser="child"
						icon-class="fs-4"
					/>
				</template>
			</Entity>
		</template>

		<template v-if="entities.length === 0">
			<div class="h-100 d-flex justify-content-center flex-wrap align-items-center">
				<EmptyBrowserCard />
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { Browser } from '../fs/browser';
import { Folder, root } from '../fs/folder';
import { BrowserOptions, FolderOptions, FolderType } from '../fs/interface';
import BrowserOperators from './browsers/BrowserOperators.vue';
import Entity from './Entity.vue';
import Icon from './Icon.vue';
import Tags from './Tags.vue';
import {
	startDrag,
	onDragOver as handleDragOver,
	onDragLeave as handleDragLeave,
	onDrop as handleDrop,
	endDrag as handleEndDrag,
	getEntityDragState,
	dragCount as dragCountRef,
	parentBackDropState
} from '../composables/useEntityDrag';
import { currentFolder } from '../fs';
import EmptyBrowserCard from './EmptyBrowserCard.vue';

const props = defineProps<{
	entities: Array<BrowserOptions | FolderOptions<FolderType, Folder<FolderType> | Browser>>;
}>();

/** 是否显示返回上一级 */
const showParentBack = computed(() => {
	return currentFolder.value.type !== 'root' && currentFolder.value.parent !== undefined;
});

/** 构造一个虚拟的 ... 文件夹实体供 Entity 渲染 */
const parentBackEntity = computed(() => ({
	type: 'folder' as FolderType,
	uid: '__parent_back__',
	name: '...',
	createTime: 0,
	renaming: false,
	parent: currentFolder.value.parent,
	children: {}
}));

/** ... 文件夹是否为放置目标 */
const isParentBackDropTarget = computed(() => {
	return parentBackDropState.isDropTarget;
});

/** 返回上一级 */
function goToParent() {
	const parent = currentFolder.value.flatParents().at(-2);
	parent?.select();
}

/** 当前所有选中（checked=true）的浏览器uid列表 */
const checkedUids = computed(() => {
	return root()
		.findAll((e) => e.type === 'browser' && e.checked)
		.map((e) => e.uid);
});

/** 每个实体的拖拽状态 */
const entityDragStates = computed(() => {
	const states: Record<string, ReturnType<typeof getEntityDragState>> = {};
	for (const entity of props.entities) {
		states[entity.uid] = getEntityDragState(entity.uid);
	}
	return states;
});

const dragCount = dragCountRef;

function onDragStart(entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>, event: DragEvent) {
	// 阻止从复选框区域发起的拖拽，避免干扰复选框点击
	const target = event.target as HTMLElement;
	if (target.closest('.arco-checkbox')) {
		event.preventDefault();
		return;
	}
	startDrag(entity, checkedUids.value, event);
}

function onDragOver(entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>, event: DragEvent) {
	handleDragOver(entity, event);
}

function onDragLeave(event: DragEvent) {
	handleDragLeave(event);
}

function onDrop(entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>) {
	handleDrop(entity);
}

function onDragEnd() {
	handleEndDrag();
}

/** ... 文件夹的拖拽事件 */
function onParentBackDragOver(event: DragEvent) {
	event.preventDefault();
	if (event.dataTransfer) {
		event.dataTransfer.dropEffect = 'move';
	}
	parentBackDropState.isDropTarget = true;
}

function onParentBackDragLeave(event: DragEvent) {
	const target = event.currentTarget as HTMLElement;
	const relatedTarget = event.relatedTarget as HTMLElement | null;
	if (relatedTarget && target.contains(relatedTarget)) {
		return;
	}
	parentBackDropState.isDropTarget = false;
}

function onParentBackDrop() {
	if (!showParentBack.value) return;
	const parentFolder = Folder.from(currentFolder.value.parent!);
	if (parentFolder) {
		const draggingUids = [...parentBackDropState.pendingUids];
		currentFolder.value.moveEntitiesToFolder(draggingUids, parentFolder);
	}
	parentBackDropState.isDropTarget = false;
	parentBackDropState.pendingUids = [];
}
</script>

<style scoped>
.notes {
	font-size: 12px;
	max-height: 24px;
	overflow: overlay;
}

.entity {
	padding: 6px 0px;
	cursor: pointer;
}

.parent-back-entity {
	opacity: 0.5;
}
</style>

import { reactive, computed } from 'vue';
import { currentFolder } from '../fs';
import { Browser } from '../fs/browser';
import { Folder } from '../fs/folder';
import { BrowserOptions, FolderOptions, FolderType } from '../fs/interface';

export type DropPosition = 'before' | 'after' | 'inside' | null;

interface DragState {
	/** 正在拖拽的实体uid列表 */
	draggingUids: string[];
	/** 当前拖拽悬停的目标uid */
	dropTargetUid: string | null;
	/** 拖拽悬停的放置位置 */
	dropPosition: DropPosition;
}

const dragState = reactive<DragState>({
	draggingUids: [],
	dropTargetUid: null,
	dropPosition: null
});

/** 拖入的文件数量 */
export const dragCount = computed(() => dragState.draggingUids.length);

/** 是否正在拖拽中 */
export const isDragging = computed(() => dragState.draggingUids.length > 0);

/** 返回上一级文件夹(...)的放置状态 */
export const parentBackDropState = reactive({
	isDropTarget: false,
	pendingUids: [] as string[]
});

/**
 * 获取某个实体的拖拽状态
 */
export function getEntityDragState(uid: string) {
	const isDraggingEntity = dragState.draggingUids.includes(uid);
	const isDropTarget = dragState.dropTargetUid === uid;
	const dropPosition = isDropTarget ? dragState.dropPosition : null;
	return {
		isDragging: isDraggingEntity,
		isDropTarget,
		dropPosition
	};
}

/**
 * 开始拖拽
 * @param entity 拖拽的实体
 * @param checkedUids 当前所有选中（checked=true）的浏览器uid列表
 * @param event dragstart事件
 */
export function startDrag(
	entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>,
	checkedUids: string[],
	event: DragEvent
) {
	// 确定拖拽的uid列表：如果拖拽的项目已选中，则拖拽所有选中项；否则只拖拽当前项
	let uids: string[];
	if (entity.type === 'browser' && checkedUids.includes(entity.uid)) {
		uids = [...checkedUids];
	} else {
		uids = [entity.uid];
	}

	dragState.draggingUids = uids;
	parentBackDropState.pendingUids = [...uids];

	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/json', JSON.stringify(uids));
	}
}

/**
 * 处理 dragover 事件，判断放置位置
 * @param entity 悬停的实体
 * @param event dragover事件
 */
export function onDragOver(
	entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>,
	event: DragEvent
) {
	event.preventDefault();

	if (event.dataTransfer) {
		event.dataTransfer.dropEffect = 'move';
	}

	// 如果拖拽列表包含目标实体，忽略
	if (dragState.draggingUids.includes(entity.uid)) {
		return;
	}

	const targetEl = event.currentTarget as HTMLElement;
	const rect = targetEl.getBoundingClientRect();
	const y = event.clientY - rect.top;
	const height = rect.height;

	// 判断放置位置
	let position: DropPosition;
	if (entity.type === 'folder') {
		// 文件夹：上部1/4为before，下部1/4为after，中间1/2为inside
		if (y < height * 0.25) {
			position = 'before';
		} else if (y > height * 0.75) {
			position = 'after';
		} else {
			position = 'inside';
		}
	} else {
		// 浏览器：上部1/2为before，下部1/2为after
		position = y < height * 0.5 ? 'before' : 'after';
	}

	dragState.dropTargetUid = entity.uid;
	dragState.dropPosition = position;
}

/**
 * 处理 dragleave 事件
 * 通过 relatedTarget 判断是否真正离开了当前元素，避免进入子元素时闪烁
 * @param event dragleave事件
 */
export function onDragLeave(event: DragEvent) {
	const target = event.currentTarget as HTMLElement;
	const relatedTarget = event.relatedTarget as HTMLElement | null;
	// 如果 relatedTarget 仍然是当前元素的子元素，不需要清除状态
	if (relatedTarget && target.contains(relatedTarget)) {
		return;
	}
	dragState.dropTargetUid = null;
	dragState.dropPosition = null;
}

/**
 * 处理 drop 事件
 * @param targetEntity 放置目标实体
 */
export function onDrop(targetEntity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>) {
	const draggingUids = [...dragState.draggingUids];
	const dropPosition = dragState.dropPosition;

	// 不能拖拽到自身
	if (draggingUids.includes(targetEntity.uid)) {
		endDrag();
		return;
	}

	const folder = currentFolder.value;

	if (dropPosition === 'inside' && targetEntity.type === 'folder') {
		// 移入文件夹
		const targetFolder = Folder.from(targetEntity.uid);
		if (targetFolder) {
			// 检查不能将文件夹移入自身或其子文件夹
			const validUids = draggingUids.filter((uid) => {
				const entity = folder.children[uid];
				if (!entity) return false;
				if (entity.type === 'folder') {
					// 不能将自己移入自己，也不能移入自己的子文件夹
					return !isDescendant(entity as Folder, targetFolder.uid);
				}
				return true;
			});
			folder.moveEntitiesToFolder(validUids, targetFolder);
		}
	} else if (dropPosition === 'before' || dropPosition === 'after') {
		// 重新排序
		const childrenList = folder.listChildren();
		const targetIndex = childrenList.findIndex((e) => e.uid === targetEntity.uid);
		if (targetIndex === -1) {
			endDrag();
			return;
		}

		// 计算插入位置
		const insertIndex = dropPosition === 'after' ? targetIndex + 1 : targetIndex;

		// 依次移动每个拖拽实体到目标位置
		let offset = 0;
		for (const uid of draggingUids) {
			// 确保实体在当前文件夹中
			if (!folder.children[uid]) continue;
			folder.moveChildToIndex(uid, insertIndex + offset);
			offset++;
		}
	}

	endDrag();
}

/**
 * 检查 targetFolder 是否是 folder 或者 folder 的子文件夹
 */
function isDescendant(folder: Folder, targetUid: string): boolean {
	if (folder.uid === targetUid) return true;
	for (const key in folder.children) {
		const child = folder.children[key];
		if (child.type === 'folder' && isDescendant(child as Folder, targetUid)) {
			return true;
		}
	}
	return false;
}

/**
 * 结束拖拽，清除所有状态
 */
export function endDrag() {
	dragState.draggingUids = [];
	dragState.dropTargetUid = null;
	dragState.dropPosition = null;
	parentBackDropState.isDropTarget = false;
	parentBackDropState.pendingUids = [];
}

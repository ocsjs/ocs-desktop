<template>
	<a-dropdown
		ref="dropdownRef"
		class="tittle-dropdown"
		v-bind="$attrs"
		:popup-max-height="false"
		@select="onSelect"
		@popup-visible-change="onPopupVisibleChange"
	>
		<slot></slot>
		<template #content>
			<!-- 实体操作菜单项：右键实体时在最上方显示 -->
			<template v-if="contextEntity">
				<div class="context-tip">
					<icon-info-circle />
					左键：编辑 / 拖动
				</div>
				<a-doption
					v-if="contextEntity.type === 'browser' && hasPermission('edit')"
					:value="'edit'"
				>
					<a-row>
						<a-col flex="20px"> <Icon type="edit"></Icon> </a-col>
						<a-col flex="auto"> 编辑 </a-col>
					</a-row>
				</a-doption>
				<a-doption
					v-if="hasPermission('rename')"
					:value="'rename'"
				>
					<a-row>
						<a-col flex="20px"> <Icon type="text_format"></Icon> </a-col>
						<a-col flex="auto"> 重命名 </a-col>
					</a-row>
				</a-doption>
				<a-doption
					v-if="hasPermission('remove')"
					:value="'remove'"
				>
					<a-row>
						<a-col flex="20px">
							<Icon
								style="color: red"
								type="delete"
							>
							</Icon>
						</a-col>
						<a-col flex="auto"> 删除 </a-col>
					</a-row>
				</a-doption>
				<a-doption
					v-if="hasPermission('location')"
					:value="'location'"
				>
					<a-row>
						<a-col flex="20px"> <Icon type="location_on"> </Icon> </a-col>
						<a-col flex="auto"> 跳转到文件所在位置 </a-col>
					</a-row>
				</a-doption>
				<a-divider style="margin: 4px 0" />
			</template>

			<!-- 空白区域右键：新建浏览器 -->
			<template v-if="isBlankArea">
				<a-doption :value="'newBrowser'">
					<a-row>
						<a-col flex="20px"> <Icon type="web"></Icon> </a-col>
						<a-col flex="auto"> 新建浏览器 </a-col>
					</a-row>
				</a-doption>
				<a-divider style="margin: 4px 0" />
			</template>

			<a-doption style="width: 200px"> </a-doption>

			<a-doption
				class="w-100"
				:value="'copy'"
				@mousedown="mousedown"
			>
				<a-row>
					<a-col flex="20px"> <icon-copy /> </a-col>
					<a-col flex="auto"> 复制 </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + C
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				:value="'cut'"
				@mousedown="mousedown"
			>
				<a-row>
					<a-col flex="20px"> <icon-scissor /> </a-col>
					<a-col flex="auto"> 剪切 </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + X
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				:value="'paste'"
				@mousedown="mousedown"
			>
				<a-row>
					<a-col flex="20px"> <icon-paste /> </a-col>
					<a-col flex="auto"> 粘贴 </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + V
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				:value="'undo'"
				@mousedown="mousedown"
			>
				<a-row>
					<a-col flex="20px"> <icon-undo /> </a-col>
					<a-col flex="auto"> 上一步（恢复） </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + Z
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				:value="'redo'"
				@mousedown="mousedown"
			>
				<a-row>
					<a-col flex="20px"> <icon-redo /> </a-col>
					<a-col flex="auto"> 下一步（还原） </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + Y
					</a-col>
				</a-row>
			</a-doption>
		</template>
	</a-dropdown>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { remote } from '../utils/remote';
import { Browser } from '../fs/browser';
import { Folder } from '../fs/folder';
import { BrowserOptions, FolderType, FolderOptions } from '../fs/interface';
import { contextUid, currentSearchedEntities } from '../fs';
import { newBrowser } from '../utils/browser';
import Icon from './Icon.vue';

type Permission = 'edit' | 'rename' | 'remove' | 'location';

const contextEntity = ref<BrowserOptions | FolderOptions<FolderType, Browser | Folder> | null>(null);
const isBlankArea = ref(false);
const dropdownRef = ref<any>(null);

function hasPermission(p: Permission): boolean {
	if (!contextEntity.value) return false;
	const isBrowser = contextEntity.value.type === 'browser';

	if (isBrowser) {
		return ['edit', 'rename', 'remove', 'location'].includes(p);
	} else {
		if (currentSearchedEntities.value !== undefined) {
			return p === 'location';
		}
		return p === 'rename' || p === 'remove';
	}
}

function handleContextMenu(e: MouseEvent) {
	const target = (e.target as HTMLElement).closest('.entity') as HTMLElement | null;
	if (target) {
		const uid = target.getAttribute('data-uid');
		if (uid) {
			const browser = Browser.from(uid);
			const folder = Folder.from(uid);
			contextEntity.value = browser || folder || null;
			contextUid.value = uid;
			isBlankArea.value = false;
			return;
		}
	}

	// 检查是否在浏览器列表空白区域右键
	const entitiesContainer = (e.target as HTMLElement).closest('.entities') as HTMLElement | null;
	if (entitiesContainer) {
		isBlankArea.value = true;
	} else {
		isBlankArea.value = false;
	}

	contextEntity.value = null;
	contextUid.value = '';
}

function onPopupVisibleChange(visible: boolean) {
	if (!visible) {
		contextUid.value = '';
	}
}

onMounted(() => {
	document.addEventListener('contextmenu', handleContextMenu, true);
});

onUnmounted(() => {
	document.removeEventListener('contextmenu', handleContextMenu, true);
});

function mousedown(e: MouseEvent) {
	e.preventDefault();
}

function exec(id: string) {
	if (typeof window === 'undefined') {
		return remote.webContents.call(id as any);
	} else {
		return document.execCommand(id);
	}
}

function onSelect(value: string | number | Record<string, unknown> | undefined) {
	// 空白区域的新建浏览器
	if (value === 'newBrowser') {
		newBrowser();
		isBlankArea.value = false;
		return;
	}

	if (!contextEntity.value) {
		exec(value as string);
		return;
	}

	const instance =
		contextEntity.value.type === 'browser'
			? Browser.from(contextEntity.value.uid)
			: Folder.from(contextEntity.value.uid);

	if (!instance) {
		exec(value as string);
		return;
	}

	switch (value) {
		case 'edit':
			instance.select();
			break;
		case 'rename':
			instance.renaming = true;
			break;
		case 'remove':
			instance.remove();
			break;
		case 'location':
			instance.location();
			break;
		default:
			exec(value as string);
			break;
	}

	contextEntity.value = null;
}
</script>

<style scoped>
.context-tip {
	font-size: 12px;
	color: #86909c;
	padding: 6px 12px 4px;
	user-select: none;
}

:deep(.arco-dropdown-option) {
	font-size: 12px;
	padding: 0;
}

:deep(.arco-dropdown-option-content) {
	width: 100%;
	display: block;
}
</style>

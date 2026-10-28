<template>
	<a-dropdown
		v-if="instance"
		:trigger="['hover']"
	>
		<a-space size="mini"
			><MenuIcon
				style="cursor: pointer"
				class="fs-6"
		/></a-space>
		<template #content>
			<slot name="dropdown"></slot>

			<a-doption
				v-if="hasPermissions('edit')"
				@click="instance?.select()"
			>
				<a-space size="mini"><PencilIcon />编辑</a-space>
			</a-doption>

			<a-doption
				v-if="hasPermissions('rename')"
				@click="instance && (instance.renaming = true)"
			>
				<a-space size="mini"><TypeIcon />重命名</a-space>
			</a-doption>

			<a-doption
				v-if="hasPermissions('remove')"
				@click="instance?.remove()"
			>
				<a-space size="mini"
					><Trash2Icon style="color: red" />
					删除
				</a-space>
			</a-doption>

			<a-doption
				v-if="hasPermissions('location')"
				@click="instance?.location()"
			>
				<a-space size="mini"><MapPinIcon /> 跳转到文件所在位置 </a-space>
			</a-doption>
		</template>
	</a-dropdown>
</template>

<script setup lang="ts">
import { Browser } from '../fs/browser';
import { Folder } from '../fs/folder';
import { FolderOptions, BrowserOptions, FolderType } from '../fs/interface';
import { MenuIcon, PencilIcon, TypeIcon, Trash2Icon, MapPinIcon } from 'lucide-vue-next';

type Permissions = 'edit' | 'rename' | 'remove' | 'location';

const props = withDefaults(
	defineProps<{
		entity: BrowserOptions | FolderOptions<FolderType, Browser | Folder>;
		permissions?: Permissions[] | undefined;
	}>(),
	{
		permissions: () => ['edit', 'remove', 'rename']
	}
);

const instance = props.entity.type === 'browser' ? Browser.from(props.entity.uid) : Folder.from(props.entity.uid);

function hasPermissions(p: Permissions) {
	return props.permissions.some((per) => per === p);
}
</script>

<style scoped lang="less"></style>

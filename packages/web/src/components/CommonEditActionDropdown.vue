<template>
	<a-dropdown
		class="tittle-dropdown"
		trigger="hover"
		:popup-max-height="false"
	>
		<slot></slot>
		<template #content>
			<a-doption style="width: 200px"> </a-doption>

			<a-doption
				class="w-100"
				@mousedown="mousedown"
				@click="exec('copy')"
			>
				<a-row>
					<a-col flex="20px"> 复制 </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + C
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				@mousedown="mousedown"
				@click="exec('cut')"
			>
				<a-row>
					<a-col flex="20px"> 剪切 </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + X
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				@mousedown="mousedown"
				@click="exec('paste')"
			>
				<a-row>
					<a-col flex="20px"> 粘贴 </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + V
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				@mousedown="mousedown"
				@click="exec('undo')"
			>
				<a-row>
					<a-col flex="20px"> 上一步（恢复） </a-col>
					<a-col
						flex="auto"
						class="text-end"
					>
						Ctrl + Z
					</a-col>
				</a-row>
			</a-doption>
			<a-doption
				@mousedown="mousedown"
				@click="exec('redo')"
			>
				<a-row>
					<a-col flex="20px"> 下一步（还原） </a-col>
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
import { remote } from '../utils/remote';

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
</script>

<style scoped>
:deep(.ant-dropdown-menu-item) {
	font-size: 12px;
	padding: 2px 24px 2px 12px;
}

:deep(.arco-dropdown-option-content) {
	width: 100%;
	display: block;
}
</style>

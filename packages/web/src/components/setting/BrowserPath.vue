<template>
	<Description label="浏览器路径">
		<div class="d-flex align-items-center gap-2">
			<div class="w-100">
				<span>内置谷歌浏览器（Chrome For Test v137）</span>
			</div>

			<a-popover position="left">
				<template #title>
					<b>为什么只能选择内置浏览器？</b>
				</template>
				<template #content>
					<div style="max-width: 320px">
						<div>本软件仅支持使用内置浏览器，不能自定义本机浏览器（Edge/系统 Chrome 等）。</div>
						<div style="margin-top: 6px">
							历史背景：早期版本允许选择本机浏览器，但本机浏览器版本随系统自动更新不可控，
							拓展与脚本兼容性无法保证；因此内置浏览器版本已固定（Chrome 137），
							随软件统一分发与更新，以确保自动化能力稳定可用。
						</div>
						<a-divider />
						<div>
							{{ store.render.setting.launchOptions.executablePath }}
						</div>
						<div class="text-end">
							<a-button
								type="text"
								size="mini"
								@click="() => electron.shell.showItemInFolder(store.render.setting.launchOptions.executablePath)"
							>
								在文件夹中显示 <FileIcon />
							</a-button>
						</div>
					</div>
				</template>
				<CircleHelpIcon style="cursor: pointer; flex-shrink: 0" />
			</a-popover>
		</div>
	</Description>
</template>

<script setup lang="ts">
import { store } from '../../store';
import { electron } from '../../utils/node';
import Description from '../Description.vue';
import { CircleHelpIcon, FileIcon } from 'lucide-vue-next';
</script>

<style scoped lang="less"></style>

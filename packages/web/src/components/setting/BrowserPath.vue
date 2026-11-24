<template>
	<Description label="浏览器路径">
		<div class="d-flex align-items-center gap-2">
			<div class="w-100">
				<span v-if="isWin7">内置浏览器（Supermium，Chromium 150）</span>
				<span v-else>内置谷歌浏览器（Chrome For Test v137）</span>
			</div>

			<a-popover position="left">
				<template #title>
					<b>为什么只能选择内置浏览器？</b>
				</template>
				<template #content>
					<div style="max-width: 320px">
						<div v-if="isWin7">
							Windows 7 无法运行 Chrome for Testing（需 Windows 10 及以上）， 本软件在 Win7 下使用 Supermium（Chromium
							150 移植版，支持 Win7 与拓展加载）， 首次启动时自动下载安装，不能自定义本机浏览器。
						</div>
						<div v-else>
							<div>本软件仅支持使用内置浏览器，不能自定义本机浏览器（Edge/系统 Chrome 等）。</div>
							<div style="margin-top: 6px">
								历史背景：早期版本允许选择本机浏览器，但本机浏览器版本随系统自动更新不可控，
								拓展与脚本兼容性无法保证；因此内置浏览器版本已固定（Chrome 137），
								随软件统一分发与更新，以确保自动化能力稳定可用。
							</div>
						</div>
						<a-divider />
						<div>
							{{ store.render.setting.launchOptions.executablePath }}
						</div>
						<div class="text-end">
							<a-button
								type="text"
								size="mini"
								@click="() => bridge.shell.showItemInFolder(store.render.setting.launchOptions.executablePath)"
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
import { onMounted, ref } from 'vue';
import { store } from '../../store';
import { bridge } from '../../utils/bridge';
import { isWin7Platform } from '../../utils/os';
import Description from '../Description.vue';
import { CircleHelpIcon, FileIcon } from 'lucide-vue-next';

const isWin7 = ref(false);

onMounted(async () => {
	isWin7.value = await isWin7Platform();
});
</script>

<style scoped lang="less"></style>

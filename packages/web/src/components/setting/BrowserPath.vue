<template>
	<Description label="浏览器路径">
		<a-dropdown trigger="hover">
			<a-input
				v-model="launchOptions.executablePath"
				size="small"
				placeholder="输入您的浏览器路径，否则无法正常启动，路径获取教程点击右侧问号查看。"
				class="w-100"
				@change="onDiy"
			>
				<template #suffix>
					<a-popover>
						<template #title>
							<b>浏览器路径获取方式</b>
						</template>
						<template #content>
							<div>
								<b>- 谷歌浏览器</b> : 打开谷歌浏览器 <br />
								在地址栏输入
								<b>chrome://version</b> 并回车， 找到 <b>可执行文件路径</b> 复制粘贴即可
							</div>
							<div>
								<b>- Edge浏览器</b> : 打开Edge浏览器<br />
								在地址栏输入
								<b>edge://version</b> 并回车， 找到 <b>可执行文件路径</b> 复制粘贴即可
							</div>
						</template>

						<Icon
							type="help_outline"
							style="cursor: pointer"
						/>
					</a-popover>
				</template>
			</a-input>
			<template #content>
				<a-doption
					v-for="item of state.validBrowsers"
					:key="item.path"
					@click="launchOptions.executablePath = item.path"
				>
					{{ item.name }}
				</a-doption>
			</template>
		</a-dropdown>
	</Description>
</template>

<script setup lang="ts">
import { store } from '../../store';
import { Message } from '@arco-design/web-vue';
import { remote } from '../../utils/remote';
import Description from '../Description.vue';
import Icon from '../Icon.vue';
import { forceClearBrowserCache } from '../../utils/browser';
import { onMounted, reactive } from 'vue';
import { ValidBrowser } from '@ocs-desktop/common/lib/src/interface';

const launchOptions = store.render.setting.launchOptions;

const state = reactive({
	validBrowsers: [] as ValidBrowser[]
});

onMounted(async () => {
	state.validBrowsers = await remote.methods.call('getValidBrowsers');
	console.log(state.validBrowsers);
});

/**
 * 监听自定义浏览器编辑
 */
async function onDiy() {
	if (launchOptions.executablePath) {
		launchOptions.executablePath = launchOptions.executablePath.trim();
		const exists = await remote.fs.call('existsSync', launchOptions.executablePath);
		if (!exists) {
			Message.error('浏览器路径不存在, 请点击右侧按钮查看教程。');
		} else {
			await forceClearBrowserCache(
				'检测到您更换浏览器路径，正在删除全部浏览器缓存，否则无法运行...',
				store.paths.userDataDirsFolder
			);
			Message.success('配置浏览器路径成功');
		}
	}
}
</script>

<style scoped lang="less"></style>

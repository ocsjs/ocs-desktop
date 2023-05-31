<template>
	<Description label="浏览器路径">
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

					<Icon type="help_outline" />
				</a-popover>
			</template>
		</a-input>
	</Description>
</template>

<script setup lang="ts">
import { store } from '../../store';
import { Message, Modal } from '@arco-design/web-vue';
import { remote } from '../../utils/remote';
import Description from '../Description.vue';
import Icon from '../Icon.vue';
import { Folder } from '../../fs/folder';
import { h } from 'vue';
import { SyncOutlined } from '@ant-design/icons-vue';
import { Browser } from '../../fs/browser';
const launchOptions = store.render.setting.launchOptions;

/**
 * 监听自定义浏览器编辑
 */
async function onDiy() {
	if (launchOptions.executablePath) {
		const exists = await remote.fs.call('existsSync', launchOptions.executablePath);
		if (!exists) {
			Message.error('浏览器路径不存在, 请点击右侧按钮查看教程。');
		} else {
			const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === 'browser') as Browser[];
			if (browsers.length > 0) {
				const modal = Modal.warning({
					title: '提示',
					content: () =>
						h('div', [
							h(SyncOutlined, { spin: true }),
							' 检测到您更换浏览器路径，正在删除全部浏览器缓存，否则无法运行...'
						]),
					maskClosable: false,
					closable: false,
					footer: false
				});

				for (const browser of browsers) {
					try {
						await remote.fs.call('rmSync', browser.cachePath, { recursive: true, force: true });
					} catch (err) {
						console.log(err);
					}
				}

				setTimeout(() => {
					modal.close();
					Message.success('配置浏览器路径成功');
				}, 3000);
			}
		}
	}
}
</script>

<style scoped lang="less"></style>

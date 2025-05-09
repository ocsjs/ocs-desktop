<template>
	<div class="d-flex w-100 align-items-center">
		<div style="flex: 0 0 84px">浏览器编辑</div>
		<div
			style="flex: 1 1 auto"
			class="d-flex justify-content-end"
		>
			<BrowserOperators
				:browser="browser"
				tooltip-position="br"
				icon-class="fs-4"
				class="ps-3 pe-5"
			>
				<template #split>
					<a-divider direction="vertical" />
				</template>

				<template #extra>
					<a-tooltip position="br">
						<template #content>
							仅打开浏览器，不执行其他操作。<br />
							此方法可以防止各种浏览器环境问题：<br />
							- 无法打开特殊的超星网页<br />
							- 弹窗自动被关闭等等问题 <br />
							如果你并没有遇到这些问题，可以不使用此方法，可以直接使用蓝色的启动按钮。
						</template>

						<a-button
							size="mini"
							@click="browser.onlyLaunch()"
						>
							<Icon type="web" />
						</a-button>
					</a-tooltip>
				</template>
			</BrowserOperators>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { Browser } from '../fs/browser';
import BrowserOperators from './browsers/BrowserOperators.vue';
import Icon from './Icon.vue';

defineProps<{
	browser: Browser;
}>();
</script>

<style scoped></style>

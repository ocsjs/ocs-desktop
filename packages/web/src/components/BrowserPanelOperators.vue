<template>
	<div class="d-flex w-100 align-items-center justify-content-end flex-wrap gap-2">
		<div style="flex: 1 1 auto">
			<template v-if="state.renaming">
				<a-input
					ref="renameRef"
					v-model="name"
					size="mini"
					@blur="onBlur"
				></a-input>
			</template>
			<template v-else>
				<span class="fw-bold">{{ browser.name }}</span>
				<a-tooltip
					content="重命名"
					position="bottom"
				>
					<a-button
						type="text"
						size="mini"
						class="ms-2"
						@click="rename"
					>
						<IconEdit />
					</a-button>
				</a-tooltip>
			</template>
		</div>
		<div
			style="flex: 0 0 auto"
			class="d-flex justify-content-end"
		>
			<BrowserOperators
				:browser="browser"
				tooltip-position="br"
				icon-class="fs-5"
				class="ps-2"
			>
				<template #split>
					<a-divider direction="vertical" />
				</template>

				<template #extra>
					<a-divider direction="vertical" />
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
import { reactive, ref } from 'vue';
import { Browser } from '../fs/browser';
import BrowserOperators from './browsers/BrowserOperators.vue';
import Icon from './Icon.vue';
import { nextTick } from 'process';

const props = defineProps<{
	browser: Browser;
}>();

const name = defineModel<string>({ default: '' });

const state = reactive({
	renaming: false
});

const renameRef = ref();

function rename() {
	state.renaming = true;
	name.value = props.browser.name;
	nextTick(() => {
		renameRef.value?.focus();
	});
}

function onBlur() {
	props.browser?.rename(name.value);
	state.renaming = false;
}
</script>

<style scoped></style>

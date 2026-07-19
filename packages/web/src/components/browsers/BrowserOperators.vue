<template>
	<a-space
		v-if="instance"
		:size="4"
		class="justify-content-end align-items-center browser-operators"
	>
		<template v-if="process === undefined || process.status === 'closed'">
			<a-tooltip
				:position="tooltipPosition"
				mini
			>
				<template #content>
					启动浏览器 <br />
					- 并自动安装脚本 <br />
					- 以及执行自动化脚本等一系列操作。
				</template>

				<a-button
					size="mini"
					type="text"
					@click="launch"
				>
					<Icon
						type="play_circle"
						color="#165dff"
						:class="iconClass"
					/>
					<span class="ms-1">启动</span>
				</a-button>
			</a-tooltip>
		</template>

		<template v-else-if="process.status === 'launched'">
			<a-tooltip
				content="置顶"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click="instance?.bringToFront()"
				>
					<Icon
						type="push_pin"
						:class="iconClass"
						color="#165dff"
					/>
				</a-button>
			</a-tooltip>

			<a-tooltip
				content="重启"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click="instance?.relaunch()"
				>
					<Icon
						type="sync"
						:class="iconClass"
						color="#165dff"
					/>
				</a-button>
			</a-tooltip>

			<a-tooltip
				content="关闭"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click="instance?.close()"
				>
					<Icon
						type="cancel"
						:class="iconClass"
						color="#ff0000db"
					/>
				</a-button>
			</a-tooltip>
		</template>

		<!-- 加载中 -->
		<template v-else-if="process.status === 'launching' || process.status === 'closing'">
			<a-button
				type="text"
				size="mini"
				style="color: gray"
			>
				<icon-loading :class="iconClass" />
			</a-button>
		</template>

		<slot name="extra"></slot>
	</a-space>
</template>

<script setup lang="ts">
import Icon from '../Icon.vue';
import { Process } from '../../utils/process';
import { computed } from 'vue';
import { Browser } from '../../fs/browser';
import { BrowserOptions } from '../../fs/interface';

const props = withDefaults(
	defineProps<{
		browser: BrowserOptions;
		tooltipPosition?: 'top' | 'br';
		iconClass?: string;
		launchHandler?: (browser: Browser) => void | Promise<void>;
	}>(),
	{
		tooltipPosition: 'top',
		iconClass: 'fs-6'
	}
);
const instance = Browser.from(props.browser.uid);
const process = computed(() => Process.from(props.browser.uid));

async function launch() {
	if (!instance) return;
	if (props.launchHandler) {
		await props.launchHandler(instance);
		return;
	}
	await instance.launch();
}
</script>

<style scoped lang="less">
.browser-operators {
	.arco-space-item {
		cursor: pointer;
	}
}
</style>

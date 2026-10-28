<template>
	<a-space
		v-if="instance"
		:size="4"
		class="justify-content-end align-items-center browser-operators"
	>
		<template v-if="(process === undefined || process.status === 'closed') && actions.includes('launch')">
			<a-tooltip
				:position="tooltipPosition"
				mini
			>
				<template #content>
					启动浏览器 <br />
					- 并自动安装脚本 <br />
					- 以及执行自动化程序等一系列操作。
				</template>

				<a-button
					size="mini"
					type="text"
					@click.stop="instance?.launch()"
				>
					<CirclePlayIcon
						color="var(--theme-primary-color)"
						:class="iconClass"
					/>
					<span class="ms-1">启动</span>
				</a-button>
			</a-tooltip>
		</template>

		<template v-else-if="process?.status === 'launched'">
			<a-tooltip
				v-if="actions.includes('front')"
				content="置顶"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click.stop="instance?.bringToFront()"
				>
					<PinIcon
						:class="iconClass"
						color="var(--theme-primary-color)"
					/>
				</a-button>
			</a-tooltip>

			<a-tooltip
				v-if="actions.includes('relaunch')"
				content="重启"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click.stop="instance?.relaunch()"
				>
					<RefreshCwIcon
						:class="iconClass"
						color="var(--theme-primary-color)"
					/>
				</a-button>
			</a-tooltip>

			<a-tooltip
				v-if="actions.includes('close')"
				content="关闭"
				:position="tooltipPosition"
			>
				<a-button
					type="text"
					size="mini"
					@click.stop="instance?.close()"
				>
					<CircleXIcon
						:class="iconClass"
						color="#ff0000db"
					/>
				</a-button>
			</a-tooltip>
		</template>

		<!-- 加载中 -->
		<template v-else-if="process?.status === 'launching' || process?.status === 'closing'">
			<a-button
				type="text"
				size="mini"
				style="color: gray"
			>
				<LoaderCircleIcon
					:class="iconClass"
					class="icon-spin"
				/>
			</a-button>
		</template>

		<slot name="extra"></slot>
	</a-space>
</template>

<script setup lang="ts">
import { Process } from '../../utils/process';
import { computed } from 'vue';
import { Browser } from '../../fs/browser';
import { BrowserOptions } from '../../fs/interface';
import { CirclePlayIcon, PinIcon, RefreshCwIcon, CircleXIcon, LoaderCircleIcon } from 'lucide-vue-next';

const props = withDefaults(
	defineProps<{
		browser: BrowserOptions;
		tooltipPosition?: 'top' | 'br' | 'bottom';
		iconClass?: string;
		actions?: ('launch' | 'front' | 'relaunch' | 'close')[];
	}>(),
	{
		tooltipPosition: 'br',
		iconClass: 'fs-6',
		actions: () => ['launch', 'front', 'relaunch', 'close']
	}
);
const instance = Browser.from(props.browser.uid);
// 进程是否运行以其是否仍在响应式 processes 数组中为准：
// Process.remove 用 splice 移除后，Process.from 仍返回失效引用（status 滞留 'launched'），
// 用户直接关闭浏览器窗口（非点卡片关闭按钮）时会导致卡片一直显示"置顶"而非"启动"。
const process = computed(() => Process.fromRunning(props.browser.uid));
</script>

<style scoped lang="less">
.browser-operators {
	.arco-space-item {
		cursor: pointer;
	}
}
</style>

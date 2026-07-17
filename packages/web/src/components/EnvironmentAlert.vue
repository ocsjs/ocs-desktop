<template>
	<div v-if="!envState.isReady">
		<div
			v-if="envState.isLoading"
			class="w-100 text-center"
		>
			<a-spin />
		</div>
		<div v-else>
			<a-alert
				title="警告"
				type="warning"
				show-icon
				banner
				class="rounded"
			>
				<div>{{ lang('browser_page_environment_error_notice', '软件环境存在问题，将会影响浏览器的正常启动') }}</div>

				<div class="text-black fw-bold">
					<template v-if="!envState.isCurrentBrowserSupported">
						<div>
							原因：{{ lang('browser_page_environment_error_current_browser_not_supported', '当前浏览器版本不受支持') }}
						</div>
					</template>
					<template v-else-if="!envState.supportedBrowser">
						<div>原因：{{ lang('browser_page_environment_error_no_browser_detected', '未检测到可用的浏览器') }}</div>
					</template>
					<template v-else-if="!envState.supportedExtension">
						<div>原因：{{ lang('browser_page_environment_error_no_extension_detected', '未安装脚本管理器') }}</div>
					</template>
				</div>

				<div class="text-center">
					<a-button
						class="mt-3 w-25"
						type="primary"
						@click="
							() => {
								openSetupModal('环境修复');
							}
						"
					>
						一键修复
					</a-button>
				</div>
			</a-alert>

			<Setup
				v-model:visible="envState.envSetupFixVisible"
				confirm-text="开始修复"
				cancel-text="稍后再说"
				:title="envState.setupTitle"
				:create-new-browser="false"
				:preset-steps="['show_desc', 'init_env']"
				@close="
					() => {
						updateEnvironmentDetect();
					}
				"
			></Setup>
		</div>
	</div>
</template>

<script setup lang="ts">
import Setup from './Setup.vue';
import { lang } from '../store';
import { useEnvironmentDetect } from '../composables/useEnvironmentDetect';
import { onMounted } from 'vue';

const { state: envState, openSetupModal, updateEnvironmentDetect } = useEnvironmentDetect();

onMounted(() => {
	updateEnvironmentDetect();
});
</script>

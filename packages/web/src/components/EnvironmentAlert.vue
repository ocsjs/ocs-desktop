<template>
	<!-- 环境正常时不渲染根节点，避免空 div 携带父级 margin 类占据空间 -->
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
					<div>{{ t('browser_page_environment_error_notice', '软件环境存在问题，将会影响浏览器的正常启动') }}</div>

					<div class="text-black fw-bold">
						<template v-if="!envState.isCurrentBrowserSupported">
							<div>
								原因：{{ t('browser_page_environment_error_current_browser_not_supported', '当前浏览器版本不受支持') }}
							</div>
						</template>
						<template v-else-if="!envState.supportedBrowser">
							<div>原因：{{ t('browser_page_environment_error_no_browser_detected', '未检测到可用的浏览器') }}</div>
						</template>
						<template v-else-if="!envState.supportedExtension">
							<div>原因：{{ t('browser_page_environment_error_no_extension_detected', '未安装脚本管理器') }}</div>
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
				</div>
				<div>
				<Setup
				v-model:visible="envState.envSetupFixVisible"
				confirm-text="开始修复"
				cancel-text="稍后再说"
				:title="envState.setupTitle"
				:create-new-browser="false"
				:preset-steps="
					(() => {
						const _steps: PresetSteps = ['show_desc' ];
						// 根据不同需求进行初始化	
						if (!envState.isCurrentBrowserSupported || !envState.supportedBrowser ) {
							_steps.push('init_env');
						}
						if (!envState.supportedExtension) {
							_steps.push('init_extensions');
						}
						_steps.push('update_env') 
						return _steps;
					})()
				"
			></Setup>
		</div>
	</div>
</template>

<script setup lang="ts">
import Setup, { PresetSteps } from './Setup.vue';
import { t } from '../store';
import { useEnvironmentDetect } from '../composables/useEnvironmentDetect';
import { useResources } from '../composables/useResources';
import { onMounted, watch } from 'vue';

const { state: envState, openSetupModal, updateEnvironmentDetect } = useEnvironmentDetect();
const { refreshFileStatus, fileStatus } = useResources();

onMounted(() => {
	updateEnvironmentDetect().finally(() => {
		watch(fileStatus, () => {
			updateEnvironmentDetect();
			// 环境检测刷新时同步刷新资源安装状态，防止安装了脚本管理器但资源卡片未更新
			refreshFileStatus();
		});
	});
});
</script>

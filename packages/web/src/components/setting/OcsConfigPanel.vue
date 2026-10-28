<template>
	<div class="setting container-md">
		<a-card>
			<template #title>
				<span class="card-title-icon"
					><img
						src="../../../public/favicon.png"
						width="22px"
				/></span>
				<a-space>
					OCS脚本配置
					<a-tag
						v-if="store.render.setting.ocs.openSync"
						color="green"
					>
						<a-space> <CircleCheckIcon /> 同步中 </a-space>
					</a-tag>
				</a-space>
			</template>
			<template #extra>
				<a-space>
					<a-tooltip
						v-if="store.render.setting.ocs.openSync"
						content="取消配置同步、每个浏览器可手动调整OCS脚本的设置"
					>
						<a-button
							size="small"
							@click="
								() => {
									store.render.setting.ocs.openSync = false;
								}
							"
						>
							<XIcon /> 取消配置同步
						</a-button>
					</a-tooltip>
					<a-button
						v-else
						type="primary"
						size="small"
						@click="onSyncOCSConfig"
					>
						<RefreshCwIcon />同步配置到各浏览器
					</a-button>
				</a-space>
			</template>
			<div>
				<OCSConfigs v-model:store="store.render.setting.ocs.store"></OCSConfigs>
			</div>
		</a-card>
	</div>
</template>

<script setup lang="ts">
import { t, store } from '../../store';
import OCSConfigs from '../OCSConfigs.vue';
import { Modal } from '@arco-design/web-vue';
import { CircleCheckIcon, XIcon, RefreshCwIcon } from 'lucide-vue-next';

/** 同步OCS配置到各浏览器 */
function onSyncOCSConfig() {
	store.render.setting.ocs.openSync = true;
	Modal.success({
		content: t('setting_browser_ocs_config_sync_tip_v3', '已同步配置，请重启浏览器即可应用~')
	});
}
</script>

<style scoped lang="less">
.setting {
	min-height: 500px;
	max-width: 720px;
}

/* 去卡片化：嵌套在子布局整体卡片内，无需重复卡片样式（覆盖 arco-custom 的全局 !important 规则） */
.setting > .arco-card {
	border: none !important;
	border-radius: 0 !important;
	box-shadow: none !important;
}

::deep(.arco-card-header-title) {
	display: flex;
	align-items: center;
}

.card-title-icon {
	margin-right: 6px;
	font-size: 22px;
	display: inline-flex;
	align-items: center;
}
</style>

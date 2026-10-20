<template>
	<div class="setting-layout">
		<!-- 子菜单栏 + 设置内容作为一个整体居中卡片，脱离左侧吸附 -->
		<div class="setting-unit">
			<!-- 左侧子菜单栏 -->
			<div class="setting-sider">
				<div
					v-for="item of settingMenus"
					:key="item.key"
					class="setting-sider-item"
					:class="{ active: activeMenu === item.key }"
					@click="activeMenu = item.key"
				>
					<Icon
						:type="item.icon"
						:size="18"
						class="me-2"
					/>
					{{ item.title }}
				</div>
			</div>

			<!-- 右侧设置内容：子界面懒加载（异步组件 + 按需渲染），避免 OCS 配置和应用中心同步加载造成卡顿 -->
			<div class="setting-content">
				<component
					:is="activePanel"
					:class="{ 'app-center-wrap': activeMenu === 'app-center' }"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import Icon from '../../components/Icon.vue';

/** 子设置界面（异步组件，切换到对应菜单时才加载与渲染） */
const panels = {
	ocs: defineAsyncComponent(() => import('../../components/setting/OcsConfigPanel.vue')),
	'app-center': defineAsyncComponent(() => import('../../components/ResourcesCard.vue')),
	general: defineAsyncComponent(() => import('../../components/SettingPanel.vue'))
};

const settingMenus = [
	{ key: 'general', title: '通用设置', icon: 'settings' },
	{ key: 'ocs', title: '脚本配置', icon: 'code' },
	{ key: 'app-center', title: '应用中心', icon: 'apps' }
] as const;

/** 当前子菜单：默认显示通用设置 */
const activeMenu = ref<(typeof settingMenus)[number]['key']>('general');

const activePanel = computed(() => panels[activeMenu.value]);
</script>

<style scoped lang="less">
/* 外围浅灰背景，整体滚动 */
.setting-layout {
	height: 100%;
	overflow: auto;
	background-color: var(--theme-bg-color-deep);
	padding: 12px;
}

/* 子菜单栏 + 内容区作为一个整体：统一背景、居中卡片 */
.setting-unit {
	display: flex;
	height: 100%;
	max-width: 880px;
	margin: 0 auto;
	background-color: var(--theme-card-bg);
	border: 1px solid var(--theme-border-color-light);
	/* 外围圆角使用面板级圆角档位（arco-custom 全局上调为 12px） */
	border-radius: var(--border-radius-medium, 12px);
	overflow: hidden;
}

/* 左侧子菜单栏（与内容区同背景，仅以分割线区分） */
.setting-sider {
	width: 128px;
	flex-shrink: 0;
	padding: 12px 6px;
	border-right: 1px solid var(--theme-border-color-light);
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.setting-sider-item {
	display: flex;
	align-items: center;
	padding: 8px 12px;
	border-radius: 6px;
	cursor: pointer;
	font-size: 13px;
	color: var(--theme-text-color-secondary);
	user-select: none;

	&:hover {
		background-color: var(--theme-hover-bg);
	}

	/* 仅使用背景色区分激活状态 */
	&.active {
		background-color: rgb(var(--primary-1));
		color: var(--theme-primary-color);
		font-weight: 500;
	}
}

/* 右侧设置内容区 */
.setting-content {
	flex: 1;
	min-width: 0;
	overflow: auto;
	padding-top: 12px;
}

/* 应用中心面板：对齐其他面板的 720px 居中宽度（其余面板内部自带 container-md），并去除卡片样式 */
.app-center-wrap {
	max-width: 720px;
	margin: 0 auto;
	border: none !important;
	border-radius: 0 !important;
	box-shadow: none !important;
}
</style>

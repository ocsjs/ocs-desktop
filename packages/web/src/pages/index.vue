<template>
	<CommonEditActionDropdown
		trigger="contextMenu"
		align-point
		position="bl"
		:style="{ display: 'block' }"
	>
		<div class="h-100 w-100 p-0 m-0 d-flex flex-wrap overflow-auto">
			<div
				:style="{ width: state.sideBarWidth + 'px' }"
				class="h-100"
			>
				<!-- 侧边栏图标 -->
				<div class="col-auto sider h-100">
					<div
						v-if="routes.find((r) => r.name === 'index')"
						:style="{
							width: state.sideBarWidth + 'px',
							flex: `0 0 ${state.sideBarWidth}px`
						}"
						class="sider-items"
					>
						<template
							v-for="(item, index) in (routes.find((r) => r.name === 'index')?.children as CustomRouteType[])"
							:key="index"
						>
							<div
								class="sider-item"
								:class="{ active: item.name === currentRoute.name }"
								@click="clickMenu(item)"
							>
								<component
									:is="store.render.setting.showSideBarText ? 'div' : Tooltip"
									style="height: 28px"
									:content="item.meta.title"
									position="right"
								>
									<Icon
										class="icon"
										:type="item.meta.icon"
										theme="outlined"
									/>
								</component>

								<div
									v-if="store.render.setting.showSideBarText"
									class="ms-2 sider-item-title text-secondary"
								>
									{{ item.meta.title }}
								</div>
							</div>
						</template>
					</div>

					<div class="text-secondary version mb-1 ms-2">{{ version }}</div>
				</div>
			</div>
			<div
				:style="{ width: `calc(100% - ${state.sideBarWidth}px)` }"
				class="h-100 overflow-auto"
			>
				<router-view v-slot="{ Component }">
					<keep-alive>
						<component :is="Component" />
					</keep-alive>
				</router-view>
			</div>
		</div>
	</CommonEditActionDropdown>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { RouteRecordRaw, useRouter } from 'vue-router';
import { routes, CustomRouteType, router } from '../route';
import { store } from '../store';
import { remote } from '../utils/remote';
import Icon from '../components/Icon.vue';
import { Tooltip } from '@arco-design/web-vue';
import CommonEditActionDropdown from '../components/CommonEditActionDropdown.vue';

// 当前路由
const currentRoute = useRouter().currentRoute;

const state = reactive({
	sideBarWidth: computed(() => (store.render.setting.showSideBarText ? 142 : 56))
});

const version = ref('');

/** 获取版本号 */
remote.app.call('getVersion').then((v) => {
	version.value = v;
});

function clickMenu(route: RouteRecordRaw & { meta: { title: string } }) {
	router.push(route.path);
	remote.win.call('setTitle', `OCS - ${route.meta.title}`);
}
</script>

<style lang="less">
.sider {
	-webkit-app-region: no-drag;
	user-select: none;
	padding: 4px 24px 4px 0px;
	text-align: center;
	display: flex;
	justify-content: left;
	border-right: 1px solid #f3f3f3;

	.sider-items {
		padding-top: 12px;

		.sider-item {
			padding: 8px;
			display: flex;
			cursor: pointer;
			align-items: center;
			border-left: 6px solid white;
		}
		.sider-item.active {
			background-color: #f4f9ff;
			border-left: 6px solid #1890ff;
		}

		.sider-item-title {
			font-size: 13px;
		}

		.sider-item + .sider-item {
			margin-top: 12px;
		}

		.icon {
			width: 28px;
			height: 28px;
			font-size: 28px;
			cursor: pointer;
		}
	}

	.version {
		font-size: 12px;
		position: absolute;
		bottom: 0px;
	}
}

.app-container {
	flex: 0 0 auto;
}
</style>

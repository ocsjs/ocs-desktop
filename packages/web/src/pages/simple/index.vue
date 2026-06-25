<template>
	<CommonEditActionDropdown
		trigger="contextMenu"
		align-point
		position="bl"
		:style="{ display: 'block' }"
	>
		<div class="simple-mode-container">
			<div class="p-2 d-flex justify-content-center tabs">
				<a-tabs
					v-model:active-key="state.activeTab"
					type="rounded"
					hide-content
					size="small"
				>
					<a-tab-pane key="browsers">
						<template #title>
							<Icon type="language"> {{ allBrowsers.length > 0 ? `浏览器 - ${allBrowsers.length}` : '浏览器' }} </Icon>
						</template>
					</a-tab-pane>
					<a-tab-pane key="scripts">
						<template #title>
							<Icon type="code">
								{{ store.render.scripts.length > 0 ? `用户脚本 - ${store.render.scripts.length}` : '脚本' }}
							</Icon>
						</template>
					</a-tab-pane>
					<a-tab-pane key="setting">
						<template #title> <Icon type="settings">软件设置 </Icon> </template>
					</a-tab-pane>
				</a-tabs>
			</div>

			<div class="container-md">
				<!-- 浏览器面板 -->
				<div
					v-if="state.activeTab === 'browsers'"
					class="overflow-auto"
				>
					<!-- 环境检测提示 -->
					<div
						v-if="!environmentState.isReady"
						class="env-warning"
					>
						<a-alert
							type="warning"
							closable
							show-icon
						>
							软件环境存在问题，可能影响浏览器正常启动
							<template #action>
								<a-button
									size="mini"
									type="primary"
									@click="state.setupVisible = true"
								>
									一键修复
								</a-button>
							</template>
						</a-alert>
					</div>

					<div class="cards-area entities">
						<!-- 右键菜单提示 -->
						<div class="text-center">
							<ContextHint> </ContextHint>
						</div>

						<template v-if="allBrowsers.length === 0">
							<div class="h-100 d-flex justify-content-center flex-wrap align-items-center">
								<EmptyBrowserCard />
							</div>
						</template>
						<template v-else>
							<div class="cards-grid">
								<!-- 浏览器卡片 -->
								<div
									v-for="browser in allBrowsers"
									:key="browser.uid"
									class="browser-card entity"
									:data-uid="browser.uid"
									@click="selectBrowser(browser)"
								>
									<div class="card-header">
										<div class="card-name">
											<Icon
												type="language"
												class="card-icon"
											/>
											<div class="card-name-text">
												<!-- 重命名状态 -->
												<template v-if="getBrowserInstance(browser.uid)?.renaming">
													<a-input
														v-model="renameValue"
														size="mini"
														@click.stop
														@blur="handleRenameFinish(browser)"
														@keyup.enter="handleRenameFinish(browser)"
													/>
												</template>
												<template v-else>
													{{ browser.name }}
												</template>
											</div>
										</div>
										<div
											class="card-operators"
											@click.stop
										>
											<BrowserOperators
												:browser="browser"
												icon-class="fs-5"
											/>
										</div>
									</div>

									<!-- 标签 -->
									<div
										v-if="browser.tags.length"
										class="card-tags"
									>
										<Tags
											:tags="browser.tags"
											:read-only="true"
											size="small"
										/>
									</div>

									<!-- 备注/描述 -->
									<div
										v-if="browser.notes?.trim()"
										class="card-notes"
									>
										{{ browser.notes }}
									</div>
								</div>

								<!-- 新增浏览器卡片 -->
								<div
									class="browser-card add-card"
									@click="handleAddBrowser"
								>
									<Icon
										type="add_circle_outline"
										class="add-icon"
									/>
									<span class="add-text">新增浏览器</span>
								</div>
							</div>
						</template>
					</div>
				</div>

				<!-- 脚本面板 -->
				<div
					v-if="state.activeTab === 'scripts'"
					class="overflow-auto p-2"
				>
					<UserScripts />
				</div>

				<!-- 软件设置面板 -->
				<div
					v-if="state.activeTab === 'setting'"
					class="overflow-auto p-2"
				>
					<SettingPanel simple />
				</div>
			</div>
		</div>
	</CommonEditActionDropdown>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import Icon from '../../components/Icon.vue';
import Tags from '../../components/Tags.vue';
import BrowserOperators from '../../components/browsers/BrowserOperators.vue';
import CommonEditActionDropdown from '../../components/CommonEditActionDropdown.vue';
import UserScripts from '../user-scripts/index.vue';
import { Environment } from '../../utils/environment';
import { store } from '../../store';
import { root } from '../../fs/folder';
import { Browser } from '../../fs/browser';
import { BrowserOptions } from '../../fs/interface';
import { newBrowser } from '../../utils/browser';
import EmptyBrowserCard from '../../components/EmptyBrowserCard.vue';
import ContextHint from '../../components/ContextHint.vue';
import SettingPanel from '../../components/SettingPanel.vue';

const state = reactive({
	setupVisible: false,
	activeTab: 'browsers'
});

const environmentState = reactive({
	isReady: true,
	supportedBrowser: null as any,
	supportedExtension: null as any,
	validUserScript: null as any
});

/** 获取所有浏览器（递归） */
const allBrowsers = computed(() => {
	return root().findAll((e) => e.type === 'browser') as BrowserOptions[];
});

/** 获取浏览器实例 */
function getBrowserInstance(uid: string): Browser | undefined {
	return Browser.from(uid);
}

/** 选中浏览器，显示操作面板 */
function selectBrowser(browser: BrowserOptions) {
	store.render.browser.currentBrowserUid = browser.uid;
}

/** 新增浏览器 */
function handleAddBrowser() {
	newBrowser();
}

/** 重命名临时值 */
const renameValue = ref('');

/** 处理重命名完成 */
function handleRenameFinish(browser: BrowserOptions) {
	const instance = Browser.from(browser.uid);
	if (instance) {
		instance.rename(renameValue.value || browser.name);
	}
}

/** 环境检测 */
async function updateEnvironmentDetect() {
	await Environment.init();
	const [isCurrentBrowserSupported, supportedBrowser, supportedExtension, validUserScript] = await Promise.all([
		Environment.isCurrentBrowserSupported(),
		Environment.getSupportedBrowser(),
		Environment.getSupportedExtension(),
		Environment.getValidUserScript()
	]);
	environmentState.isReady =
		isCurrentBrowserSupported && !!supportedBrowser && !!supportedExtension && !!validUserScript;
	environmentState.supportedBrowser = supportedBrowser;
	environmentState.supportedExtension = supportedExtension;
	environmentState.validUserScript = validUserScript;
}

/** 监听重命名状态，初始化值并自动聚焦输入框 */
watch(
	() => allBrowsers.value.find((b) => getBrowserInstance(b.uid)?.renaming),
	(renamingBrowser) => {
		if (renamingBrowser) {
			renameValue.value = renamingBrowser.name;
			nextTick(() => {
				const input = document.querySelector('.browser-card .arco-input') as HTMLInputElement;
				if (input) {
					input.focus();
					input.select();
				}
			});
		}
	}
);

watch(
	() => [store.render.state.setup, state.setupVisible],
	() => {
		updateEnvironmentDetect();
	}
);

onMounted(() => {
	// 确保专业模式的面板已关闭
	store.render.browser.currentBrowserUid = '';
	updateEnvironmentDetect();
});
</script>

<style lang="less" scoped>
.simple-mode-container {
	height: calc(100vh - var(--title-height));
	display: flex;
	flex-direction: column;
	overflow: auto;
}

.env-warning {
	padding: 8px 16px;
	flex-shrink: 0;
}
.cards-area {
	padding: 4px 20px 20px 16px;
}

.cards-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16px;
	max-width: 900px;
	margin: 0 auto;
}

.browser-card {
	background: transparent;
	border: 1px solid #e5e6eb;
	border-radius: 8px;
	padding: 16px;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		border-color: #bedaff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
		transform: translateY(-1px);
	}

	&:active {
		transform: translateY(0);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.card-name {
		font-size: 15px;
		font-weight: 600;
		color: #1d2129;
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.card-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-icon {
		font-size: 18px;
		color: #165dff;
		flex-shrink: 0;
	}

	.card-operators {
		flex-shrink: 0;
	}

	.card-tags {
		margin-bottom: 6px;
	}

	.card-notes {
		font-size: 12px;
		color: #86909c;
		line-height: 1.5;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}
}

.add-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 120px;
	border: 1px dashed #c9cdd4;
	background: transparent;

	&:hover {
		border-color: #165dff;
		background-color: #f2f3f5;
	}

	.add-icon {
		font-size: 32px;
		color: #c9cdd4;
		margin-bottom: 8px;
	}

	.add-text {
		font-size: 13px;
		color: #86909c;
	}
}

/** 暗色主题适配 */
body[arco-theme='dark'] & {
	.simple-mode-container {
		background-color: #17171a;
	}

	.browser-card {
		background: transparent;
		border-color: #3d3d3f;

		&:hover {
			border-color: #3a5a8c;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		}

		.card-name {
			color: #ffffffd9;
		}

		.card-notes {
			color: #86909c;
		}
	}

	.add-card {
		border-color: #484849;
		background: transparent;

		&:hover {
			border-color: #165dff;
			background-color: #2a2a2b;
		}

		.add-icon {
			color: #484849;
		}

		.add-text {
			color: #86909c;
		}
	}
}

/** 响应式：小屏幕单列 */
@media (max-width: 600px) {
	.cards-grid {
		grid-template-columns: 1fr;
	}
}

.tabs {
	:deep(.arco-tabs-tab) {
		border: 1px solid rgb(235, 235, 235);
	}
}
</style>

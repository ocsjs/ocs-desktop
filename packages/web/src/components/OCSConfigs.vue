<!-- eslint-disable max-len -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
	<div>
		<template v-if="state.err">
			<div class="d-inline-block p-5">
				<a-result
					title="解析错误！请尝试重启软件"
					:subtitle="'原因：' + state.err"
					status="error"
				>
				</a-result>
			</div>
		</template>
		<template v-else-if="state.loading">
			<div class="p-5 text-center">
				<a-spin tip="正在获取最新OCS配置..." />
			</div>
		</template>

		<template v-else>
			<div
				style="position: sticky; top: 0px; z-index: 99"
				class="bg-white pb-2 ocs-configs-bar"
			>
				<a-alert class="mb-2">
					<span
						v-html="
							t(
								'setting_ocs_sync_notes',
								'选择不同平台进行脚本设置，然后开启同步即可全浏览器应用相同OCS脚本设置 <br /> 如果只有单个浏览器，则无需配置，直接前往浏览器设置即可。'
							)
						"
					></span>
				</a-alert>

				<a-tabs
					v-model:active-key="Store.render.setting.ocs.currentProjectName"
					type="card-gutter"
					hide-content
				>
					<a-tab-pane
						v-for="project of state.projects
							.filter((p) => !state.hidden_projects.includes(p.name))
							.sort((a, b) => (a.name === state.pin_projects ? -1 : 1))"
						:key="project.name"
						:title="project.name"
					>
					</a-tab-pane>
				</a-tabs>
			</div>
			<div
				id="ocs-browser-configs"
				class="mt-3 ps-2 pe-2"
			></div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, onActivated, reactive, watch, ref, WatchStopHandle, onDeactivated } from 'vue';
import { remote } from '../utils/remote';
import { store as Store, t } from '../store/index';
import { themeState } from '../utils';
import { OCS_SCRIPT_RESOURCES } from '@ocs-desktop/common/web';
import type { Project } from 'easy-us';

const props = defineProps<{
	store: object;
}>();

const store = ref(props.store);

const emits = defineEmits<{
	(e: 'update:store', val: object): void;
	(e: 'update:project', val: Project[]): void;
	(e: 'loading'): void;
	(e: 'loaded'): void;
	(e: 'error', err: string): void;
}>();

const state = reactive({
	css: '',
	/** 是否加载 */
	loading: false,
	/** 是否报错 */
	err: '',
	/** 当前选中的 ocs project */
	projects: [] as Project[],
	watchStopHandle: undefined as WatchStopHandle | undefined,
	hidden_projects: ['后台'],
	pin_projects: '通用',
	hidden_scripts: ['common.online-search', 'common.work-results']
});

watch(
	() => [Store.render.setting.ocs.currentProjectName],
	() => {
		nextTick(renderOCS);
	}
);

/** 主题变化时切换 Shadow DOM 暗色类（无需重渲染列表） */
watch(
	() => themeState.dark,
	(dark) => wrapper?.classList.toggle('ocs-dark', dark)
);

state.watchStopHandle = watch(store, () => {
	emits('update:store', store.value);
});

let wrapper = null as HTMLElement | null;
let root = null as ShadowRoot | null;

function renderOCS() {
	if (!root || !wrapper) return;
	// @ts-ignore
	const EUS = global.EUS as typeof import('easy-us');
	const { definedCustomElements, h, $, $ui, $store, $modal } = EUS;

	try {
		const project = state.projects.find((p) => p.name === Store.render.setting.ocs.currentProjectName);

		// 清空元素
		root.replaceChildren();

		loadCustomElements(definedCustomElements as any[]);

		root.append(h('style', state.css));

		/** 删除阴影 */
		root.append(h('style', `script-panel-element {box-shadow: none;resize: none;color:#2e2e2e}`));

		/** 列表样式 */
		root.append(
			h(
				'style',
				[
					'.ocs-list { display: flex; flex-direction: column; gap: 6px; }',
					'.ocs-list-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; border: 1px solid #eceef1; background: #fff; cursor: pointer; user-select: none; transition: all 0.2s ease; }',
					'.ocs-list-item:hover { border-color: var(--theme-primary-color); box-shadow: 0 4px 14px rgba(var(--primary-6),0.12); transform: translateY(-1px); }',
					'.ocs-list-item:active { transform: translateY(0); }',
					'.ocs-list-item-name { flex: 1; font-weight: 600; font-size: 13px; color: #1d2129; }',
					'.ocs-list-item-arrow { width: 7px; height: 7px; border-right: 2px solid #c9cdd4; border-bottom: 2px solid #c9cdd4; transform: rotate(-45deg); transition: transform 0.2s, border-color 0.2s; flex-shrink: 0; }',
					'.ocs-list-item:hover .ocs-list-item-arrow { transform: rotate(-45deg) translate(2px, -2px); border-color: var(--theme-primary-color); }',
					// 暗色模式（通过 shadow host 上的 .ocs-dark 类触发，body[arco-theme] 无法穿透 Shadow DOM）
					':host(.ocs-dark) .ocs-list-item { background: #2c2c2c; border-color: #4b4848; }',
					':host(.ocs-dark) .ocs-list-item:hover { border-color: var(--theme-primary-color); box-shadow: 0 4px 14px rgba(0,0,0,0.3); }',
					':host(.ocs-dark) .ocs-list-item-name { color: #cccccc; }',
					':host(.ocs-dark) .ocs-list-item-arrow { border-color: #6a6a6a; }'
				].join('\n')
			)
		);

		/** 弹窗内容自适应，最大 800px；隐藏标题（脚本面板自带 header，避免重复） */
		root.append(
			h(
				'style',
				[
					'modal-element { width: fit-content !important; max-width: 800px !important; }',
					'.modal-body { max-width: 800px; }',
					'.modal-title { display: none; }'
				].join('\n')
			)
		);

		// 根据 当前主题状态切换 shadow host 的暗色类
		wrapper?.classList.toggle('ocs-dark', themeState.dark);

		const list = h('div', { className: 'ocs-list' });

		if (project) {
			console.log('[ocsjs project]', project);
			for (const key in project.scripts) {
				if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
					const script = project.scripts[key];

					if (script.namespace && state.hidden_scripts.includes(script.namespace)) {
						continue;
					}

					/** 为对象添加响应式特性，在设置值的时候同步到本地存储中 */
					script.cfg = Object.keys(script.cfg).length === 0 ? $.createConfigProxy(script) : script.cfg;
					const { notes, ...otherConfigs } = script.configs || {};

					if (
						script.namespace &&
						// 如果没有配置项，则不显示
						Object.keys(otherConfigs).filter((k) => otherConfigs[k].label !== undefined).length &&
						!script.hideInPanel
					) {
						const item = h('div', { className: 'ocs-list-item' });
						item.append(h('span', { className: 'ocs-list-item-name' }, script.name));
						item.append(h('span', { className: 'ocs-list-item-arrow' }));
						item.addEventListener('click', () => {
							const panel = $ui.scriptPanel(script, $store);
							$modal.simple({ content: panel, maskCloseable: true }, root);
						});
						list.append(item);
					}
				}
			}
		}

		root.append(list);

		/** 挂载 ocs panel */
		document.querySelector('#ocs-browser-configs')?.replaceChildren(wrapper);
	} catch (err) {
		state.err = String(err);
		console.error(err);
	}
}

async function loadOCS() {
	state.loading = true;
	emits('loading');
	try {
		// @ts-ignore
		if (global.OCS === undefined) {
			// 加载 OCS（开发者设置中可自定义脚本地址，留空用默认线上地址）
			const code = await remote.methods.call('get', Store.scriptResources.index || OCS_SCRIPT_RESOURCES.index);
			await remote.webContents.call('executeJavaScript', code);
		}

		// @ts-ignore
		if (global.EUS === undefined) {
			// 加载 EUS（开发者设置中可自定义脚本地址，留空用默认线上地址）
			const code = await remote.methods.call('get', Store.scriptResources.easyUs || OCS_SCRIPT_RESOURCES.easyUs);
			await remote.webContents.call('executeJavaScript', code);
		}

		if (state.css === '') {
			// 加载样式
			state.css = await remote.methods.call('get', OCS_SCRIPT_RESOURCES.style);
		}

		// @ts-ignore
		const OCS = global.OCS as typeof import('@ocsjs/script');
		// @ts-ignore
		const EUS = global.EUS as typeof import('easy-us');

		const { MemoryStoreProvider, $elements, h } = EUS;

		wrapper = wrapper || h('div');
		root = root || wrapper.attachShadow({ mode: 'closed' });

		OCS.$elements.root = root;
		$elements.root = root;
		console.log(OCS);
		console.log(EUS);

		/** 双向绑定数据 */
		MemoryStoreProvider._source.store = store.value;

		state.projects = OCS.definedProjects();
		emits('update:project', state.projects as Project[]);
		if (!Store.render.setting.ocs.currentProjectName) {
			// 默认打开 pin_projects（如「通用」），找不到则回退到首个项目
			const preferred = state.projects.find((p) => p.name === state.pin_projects);
			Store.render.setting.ocs.currentProjectName = (preferred || state.projects[0]).name;
		}
	} catch (err) {
		state.err = String(err);
		console.error(err);
		emits('error', String(err));
	}

	state.loading = false;
	emits('loaded');
}

onMounted(() => {
	nextTick(async () => {
		await loadOCS();
		renderOCS();
	});
});

onActivated(() => {
	nextTick(async () => {
		await loadOCS();
		renderOCS();
	});
});

onDeactivated(() => {
	state.watchStopHandle?.();
});

/** 加载自定义元素 */
function loadCustomElements(elements: { new (): HTMLElement }[]) {
	for (const element of elements) {
		const name = resolveCustomElementName(element, '-');
		// 不能重复加载
		if (customElements.get(name) === undefined) {
			customElements.define(name, element);
		}
	}
}

/**
 * 将每个驼峰前面添加目标字符串，用于自定义元素名的转换
 * @param el  自定义元素
 * @param target 目标字符串
 */
function resolveCustomElementName<T extends HTMLElement = HTMLElement>(el: { new (): T }, target: string) {
	return el.name
		.replace(/([A-Z])/g, target + '$1')
		.toLowerCase()
		.split(target)
		.slice(1)
		.join(target);
}
</script>

<style scoped lang="less">
#ocs-browser-configs {
	overflow: overlay;
	height: calc(100% - 64px);
}

.script-panels {
}

/** 暗色模式：配置栏背景与项目 Tabs 适配 */
body[arco-theme='dark'] {
	.ocs-configs-bar {
		background-color: #2c2c2c !important;
	}

	:deep(.arco-tabs-card-gutter) .arco-tabs-tab {
		background-color: #2c2c2c;
		border-color: #4b4848;
		color: #cccccc;
	}

	:deep(.arco-tabs-card-gutter) .arco-tabs-tab-active {
		background-color: #3b3b3b;
		color: #ffffffd9;
	}
}
</style>

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
			<div class="bg-white pb-2 ocs-configs-bar">
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
					size="small"
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
				class="mt-3"
			>
				<!-- easy-us 内部元素（脚本弹窗/消息/提示）的 Shadow DOM 挂载点 -->
				<div ref="shadowHostEl"></div>
				<!-- 手风琴模式展示脚本设置（替代原 $modal.simple 弹窗，交互更快且无大小限制） -->
				<a-collapse
					v-model:active-key="state.activeKey"
					accordion
					@change="onActiveScriptChange"
				>
					<a-collapse-item
						v-for="script of visibleScripts"
						:key="script.namespace"
						:header="script.name"
						@mouseenter="preRenderScriptPanel(script.namespace)"
					>
						<div
							:ref="(el) => setPanelHost(el, script.namespace)"
							class="ocs-script-panel"
						></div>
					</a-collapse-item>
				</a-collapse>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, onActivated, reactive, watch, ref, computed, WatchStopHandle, onDeactivated } from 'vue';
import { remote } from '../utils/remote';
import { store as Store } from '../store/index';
import { t } from '../utils/langs';
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
	hidden_scripts: ['common.online-search', 'common.work-results'],
	/** 手风琴当前展开的脚本 namespace（arco Collapse 即使手风琴模式也使用数组） */
	activeKey: [] as (string | number)[]
});

/** 当前项目下可配置的脚本列表 */
const visibleScripts = computed(() => {
	const project = state.projects.find((p) => p.name === Store.render.setting.ocs.currentProjectName);
	if (!project) {
		return [] as any[];
	}
	const list = [] as any[];
	for (const key in project.scripts) {
		if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
			const script = project.scripts[key];

			if (script.namespace && state.hidden_scripts.includes(script.namespace)) {
				continue;
			}

			const { notes, ...otherConfigs } = script.configs || {};

			if (
				script.namespace &&
				// 如果没有配置项，则不显示
				Object.keys(otherConfigs).filter((k) => otherConfigs[k].label !== undefined).length &&
				!script.hideInPanel
			) {
				list.push(script);
			}
		}
	}
	return list;
});

/** 切换 Tab 延迟展开的定时器 */
let expandTimer: ReturnType<typeof setTimeout> | undefined;

/** 切换项目 Tab 时延迟 200ms 自动展开第一项配置（避免频繁切换时的渲染抖动） */
watch(
	() => [Store.render.setting.ocs.currentProjectName],
	() => {
		clearTimeout(expandTimer);
		expandTimer = setTimeout(expandFirstScript, 200);
	}
);

/** 自动展开当前项目的第一项配置（先挂载面板再展开，保证展开动画测量到完整高度） */
function expandFirstScript() {
	const first = visibleScripts.value[0];
	if (!first?.namespace) {
		state.activeKey = [];
		return;
	}
	mountScriptPanel(first.namespace);
	state.activeKey = [first.namespace];
}

/** 主题变化时切换 Shadow DOM 暗色类 */
watch(
	() => themeState.dark,
	(dark) => wrapper?.classList.toggle('ocs-dark', dark)
);

state.watchStopHandle = watch(store, () => {
	emits('update:store', store.value);
});

let wrapper = null as HTMLElement | null;
let root = null as ShadowRoot | null;
/** easy-us 内部元素根节点的宿主元素 */
const shadowHostEl = ref<HTMLElement>();

/** 手风琴内容区的面板挂载点（namespace -> host div） */
const panelHosts = new Map<string, HTMLElement>();

function setPanelHost(el: any, namespace?: string) {
	if (!namespace) {
		return;
	}
	if (el) {
		panelHosts.set(namespace, el as HTMLElement);
	} else {
		panelHosts.delete(namespace);
	}
}

function onActiveScriptChange(key: string | number | (string | number)[] | undefined) {
	const namespace = Array.isArray(key) ? key[0] : key;
	if (namespace) {
		// 同步挂载：内容区是 v-show 提前渲染的，宿主已存在；
		// 必须在展开动画测量高度（onEnter scrollHeight）前就位，否则会先测到空内容高度再跳变
		mountScriptPanel(String(namespace));
	}
}

/** 面板样式（OCS 完整样式 + 覆盖样式），每次创建新节点以便在 Shadow DOM 间移动 */
function createPanelStyles() {
	// OCS 完整样式
	const style = document.createElement('style');
	style.textContent = state.css;
	// 覆盖样式：去除阴影/缩放；标题由手风琴头部展示，隐藏面板自带分隔符标题
	const overrides = document.createElement('style');
	overrides.textContent = [
		'script-panel-element { box-shadow: none; resize: none; color: #2e2e2e; }',
		// 标题由手风琴头部展示，隐藏面板自带分隔符标题
		'script-panel-element > .separator { display: none; }',
		// 禁用面板子元素 fade-in 入场动画（OCS 样式 script-panel-element > div { animation: fade-in 0.3s }），避免展开时内容延迟出现
		'script-panel-element > div, script-panel-link { animation: none !important; }'
	].join('\n');
	return [style, overrides];
}

/** 创建脚本设置面板（每次新建，保证配置项为最新状态） */
function createScriptPanel(namespace: string) {
	const script = visibleScripts.value.find((s) => s.namespace === namespace);
	if (!script) {
		return undefined;
	}
	// @ts-ignore
	const EUS = global.EUS as typeof import('easy-us');
	const { $ui, $store } = EUS;
	return $ui.scriptPanel(script, $store) as unknown as HTMLElement;
}

/** hover 时预渲染：直接挂载进真实宿主（内容区 v-show 提前渲染，宿主始终存在），点击展开时高度已就位 */
function preRenderScriptPanel(namespace?: string) {
	if (namespace) {
		mountScriptPanel(namespace);
	}
}

/**
 * 挂载脚本设置面板到独立的 Shadow DOM 中（每次新建，保证配置项为最新状态）。
 * OCS 样式表含全局选择器（ul/a/.card 等），直接注入 document 会污染软件自身样式，
 * 因此每个面板使用独立 ShadowRoot 隔离样式。
 */
function mountScriptPanel(namespace: string) {
	const host = panelHosts.get(namespace);
	if (!host) {
		return;
	}
	// hover 已渲染过则跳过，避免重复创建
	if (host.shadowRoot?.querySelector('script-panel-element')) {
		return;
	}
	const panel = createScriptPanel(namespace);
	if (!panel) {
		return;
	}
	const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
	shadow.replaceChildren(...createPanelStyles(), panel);
}

/** 挂载 easy-us 内部元素根节点（脚本弹窗/消息等会渲染到此 Shadow DOM） */
function mountShadowWrapper() {
	const host = shadowHostEl.value;
	if (!host || !wrapper) {
		return;
	}
	if (wrapper.parentElement !== host) {
		host.appendChild(wrapper);
	}
	wrapper.classList.toggle('ocs-dark', themeState.dark);
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

		const { MemoryStoreProvider, $elements, definedCustomElements, h, $ } = EUS;

		wrapper = wrapper || h('div');
		root = root || wrapper.attachShadow({ mode: 'closed' });

		OCS.$elements.root = root;
		$elements.root = root;

		/** easy-us 内部元素（弹窗/消息）的样式注入一次即可 */
		if (root.childNodes.length === 0) {
			root.append(h('style', state.css));
			/** 弹窗内容自适应，最大 800px */
			root.append(h('style', ['modal-element { !important; max-width: 800px !important; }'].join('\n')));
		}

		loadCustomElements(definedCustomElements as any[]);

		/** 双向绑定数据 */
		MemoryStoreProvider._source.store = store.value;

		state.projects = OCS.definedProjects();
		emits('update:project', state.projects as Project[]);

		/** 为对象添加响应式特性，在设置值的时候同步到本地存储中 */
		for (const project of state.projects) {
			for (const key in project.scripts) {
				if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
					const script = project.scripts[key];
					script.cfg = Object.keys(script.cfg).length === 0 ? $.createConfigProxy(script) : script.cfg;
				}
			}
		}

		if (state.projects.length) {
			// 打开界面时默认选中 pin_projects（如「通用」），找不到则回退到首个项目
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
	nextTick(() => {
		mountShadowWrapper();
		// 加载后 DOM 已重建（原面板随之销毁），自动展开第一项配置
		expandFirstScript();
	});
}

onMounted(() => {
	nextTick(loadOCS);
});

onActivated(() => {
	nextTick(loadOCS);
});

onDeactivated(() => {
	state.watchStopHandle?.();
	clearTimeout(expandTimer);
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
	padding: 0 8px;
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

	.ocs-script-collapse {
		:deep(.arco-collapse-item) {
			border-color: #4b4848;
			background-color: #2c2c2c;
		}
	}
}

.ocs-script-panel {
	border-radius: 12px;
}

:deep(.arco-collapse-item-content) {
	background-color: white;
}
</style>

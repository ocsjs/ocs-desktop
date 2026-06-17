<!-- eslint-disable max-len -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
	<div>
		<div
			style="position: sticky; top: 0px; z-index: 99"
			class="bg-white pb-2"
		>
			<a-alert class="mb-2">
				<span
					v-html="
						lang(
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
	</div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, onActivated, reactive, watch, ref, WatchStopHandle, onDeactivated } from 'vue';
import { remote } from '../utils/remote';
import { store as Store, lang } from '../store/index';
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
	(e: 'error', val: string): void;
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

state.watchStopHandle = watch(store, () => {
	emits('update:store', store.value);
});

let wrapper = null as HTMLElement | null;
let root = null as ShadowRoot | null;

/** 设置手风琴效果：同时只能打开一个 detail */
function setupAccordion(detailsList: HTMLDetailsElement[]) {
	for (const details of detailsList) {
		details.addEventListener('toggle', () => {
			if (details.open) {
				for (const other of detailsList) {
					if (other !== details && other.open) {
						other.removeAttribute('open');
					}
				}
			}
		});
	}
}

function renderOCS() {
	if (!root || !wrapper) return;
	// @ts-ignore
	const EUS = global.EUS as typeof import('easy-us');
	const { definedCustomElements, h, $, $ui, $store } = EUS;

	try {
		const project = state.projects.find((p) => p.name === Store.render.setting.ocs.currentProjectName);

		// 清空元素
		root.replaceChildren();

		loadCustomElements(definedCustomElements as any[]);

		root.append(h('style', state.css));

		/** 删除阴影 */
		root.append(h('style', `script-panel-element {box-shadow: none;resize: none;color:#2e2e2e}`));

		/** details / summary 样式 */
		root.append(
			h(
				'style',
				[
					'details { margin: 0 0 8px 0; border-radius: 8px; border: 1px solid #e5e6eb; background: #fafafa; overflow: hidden; transition: all 0.2s ease; }',
					'details:hover { border-color: #c9cdd4; }',
					'details[open] { border-color: #165dff; background: #fff; box-shadow: 0 2px 12px rgba(22,93,255,0.08); }',
					'summary { padding: 10px 14px; font-weight: 600; font-size: 13px; color: #1d2129; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; user-select: none; outline: none; background: transparent; transition: background 0.15s; border-radius: 8px; }',
					'summary::-webkit-details-marker { display: none; }',
					'summary::after { content: ""; width: 6px; height: 6px; border-right: 1.5px solid #86909c; border-bottom: 1.5px solid #86909c; transform: rotate(-45deg); transition: transform 0.25s ease, margin-top 0.25s ease; margin-top: -2px; flex-shrink: 0; margin-left: 8px; }',
					'details[open] > summary::after { transform: rotate(45deg); margin-top: 2px; border-color: #165dff; }',
					'details[open] > summary { color: #165dff; background: rgba(22,93,255,0.04); }',
					'summary:hover { background: rgba(0,0,0,0.02); }'
				].join('\n')
			)
		);

		if (project) {
			const detailsList: HTMLDetailsElement[] = [];
			let i = 0;
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
						script.hideInPanel !== false
					) {
						const details = h('details', { open: i === 0 });
						const panel = $ui.scriptPanel(script, $store);
						details.append(h('summary', panel.name || '未知脚本'));
						details.append(panel);
						/** 添加到页面中，并执行 onrender 函数 */
						root.append(details);
						detailsList.push(details);
						i++;
						try {
							script.onrender?.({ panel, header: h('header-element') })?.catch((err) => {
								console.error(err);
							});
						} catch (err) {
							console.error(err);
						}
					}
				}
			}

			/** 初始化手风琴效果 */
			setupAccordion(detailsList);

			/** 挂载 ocs panel */
			document.querySelector('#ocs-browser-configs')?.replaceChildren(wrapper);
		}
	} catch (err) {
		state.err = String(err);
		console.error(err);
		emits('error', state.err);
	}
}

async function loadOCS() {
	state.loading = true;
	emits('loading');
	try {
		// @ts-ignore
		if (global.OCS === undefined) {
			// 加载 OCS
			const code = await remote.methods.call('get', 'https://cdn.ocsjs.com/index.js');
			await remote.webContents.call('executeJavaScript', code);
		}

		// @ts-ignore
		if (global.EUS === undefined) {
			// 加载 EUS
			const code = await remote.methods.call('get', 'https://cdn.ocsjs.com/easy-us.js');
			await remote.webContents.call('executeJavaScript', code);
		}

		if (state.css === '') {
			// 加载样式
			state.css = await remote.methods.call('get', 'https://cdn.ocsjs.com/style.css');
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
			Store.render.setting.ocs.currentProjectName = state.projects[0].name;
		}
	} catch (err) {
		state.err = String(err);
		console.error(err);
		emits('error', state.err);
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
</style>

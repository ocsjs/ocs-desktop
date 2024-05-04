<template>
	<div class="h-100">
		<a-radio-group
			v-model="Store.render.setting.ocs.currentProjectName"
			type="button"
		>
			<template
				v-for="project of state.projects"
				:key="project.name"
			>
				<a-radio :value="project.name">{{ project.name }}</a-radio>
			</template>
		</a-radio-group>
		<div
			id="ocs-browser-configs"
			class="mt-3"
		></div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, onActivated, reactive, watch, ref, WatchStopHandle, onDeactivated } from 'vue';
import { remote } from '../utils/remote';
import { store as Store } from '../store/index';
import { definedCustomElements, h, $, $ui, MemoryStoreProvider, $store, $elements } from 'easy-us';

type Project = any;

const props = defineProps<{
	store: object;
}>();

const store = ref(props.store);

const emits = defineEmits<{
	(e: 'update:store', val: object);
	(e: 'update:project', val: Project[]);
	(e: 'loading');
	(e: 'loaded');
	(e: 'error', val: string);
}>();

const state = reactive({
	css: '',
	/** 是否加载 */
	loading: false,
	/** 是否报错 */
	err: '',
	/** 当前选中的 ocs project */
	projects: [] as Project[],
	watchStopHandle: undefined as WatchStopHandle | undefined
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

const wrapper = h('div');
const root = wrapper.attachShadow({ mode: 'closed' });

function renderOCS() {
	const project = state.projects.find((p) => p.name === Store.render.setting.ocs.currentProjectName);

	// 清空元素
	root.replaceChildren();

	loadCustomElements(definedCustomElements as any[]);

	root.append(h('style', state.css));

	/** 删除阴影 */
	root.append(h('style', `script-panel-element {box-shadow: none;resize: none;color:#2e2e2e}`));

	if (project) {
		for (const key in project.scripts) {
			if (Object.prototype.hasOwnProperty.call(project.scripts, key)) {
				const script = project.scripts[key];

				/** 为对象添加响应式特性，在设置值的时候同步到本地存储中 */
				script.cfg = Object.keys(script.cfg).length === 0 ? $.createConfigProxy(script) : script.cfg;
				const { notes, ...otherConfigs } = script.configs || {};

				if (
					script.namespace &&
					// 如果没有配置项，则不显示
					Object.keys(otherConfigs).filter((k) => otherConfigs[k].label !== undefined).length &&
					script.hideInPanel !== false
				) {
					const panel = $ui.scriptPanel(script, $store);

					/** 添加到页面中，并执行 onrender 函数 */
					root.append(panel);
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

		/** 挂载 ocs panel */
		document.querySelector('#ocs-browser-configs')?.replaceChildren(wrapper);
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

		if (state.css === '') {
			// 加载样式
			state.css = await remote.methods.call('get', 'https://cdn.ocsjs.com/style.css');
		}

		// @ts-ignore
		const OCS = global.OCS as typeof import('ocsjs');
		global.OCS.$elements.root = root;
		$elements.root = root;
		console.log(OCS);

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
</style>

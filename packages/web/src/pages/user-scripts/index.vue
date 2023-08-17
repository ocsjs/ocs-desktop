<template>
	<div class="col-12 p-2 m-auto h-100">
		<a-tabs
			v-model:activeKey="state.activeKey"
			class="overflow-auto h-100"
		>
			<a-tab-pane
				key="web"
				title="脚本列表"
			>
				<div class="text-secondary markdown mb-2">
					在<code>浏览器列表</code>中启动浏览器后将会 <code>自动</code>
					<code>加载/更新</code>
					以下脚本到浏览器，如果不想开启自动加载/更新，可以关闭。<br />
					如果想 <code>彻底删除</code>浏览器里面的脚本，请打开相应的浏览器，
					在右上角浏览器拓展中找到脚本管理器，然后进入管理器中删除
				</div>

				<div class="mb-2">
					<a-space>
						<a-button
							size="mini"
							type="outline"
							@click="addScriptFromFile"
						>
							+ 添加本地脚本
						</a-button>
						<a-button
							size="mini"
							type="outline"
							@click="addScriptFromURL"
						>
							+ 使用网络链接添加脚本
						</a-button>
						<a-button
							size="mini"
							type="outline"
							@click="state.activeKey = 'search'"
						>
							<Icon type="search"></Icon>
							搜索网络脚本
						</a-button>
						<a-button
							size="mini"
							@click="enableAll"
						>
							全部开启加载
						</a-button>
						<a-button
							size="mini"
							@click="closeAll"
						>
							全部关闭加载
						</a-button>
					</a-space>
				</div>

				<div v-if="store.render.scripts.length === 0">
					<a-empty description="暂无数据, 请在上方“搜索脚本”中选择喜欢的脚本进行添加哦~" />
				</div>
				<div
					v-else
					class="pb-3"
				>
					<ScriptList :scripts="store.render.scripts">
						<template #infos="{ script }">
							<a-tooltip>
								<template #content>
									<a-descriptions
										size="mini"
										:label-style="{ color: 'white', verticalAlign: 'top' }"
										:value-style="{ color: 'white' }"
										:column="1"
									>
										<a-descriptions-item label="脚本名"> {{ script.info?.name || '' }} </a-descriptions-item>
										<a-descriptions-item label="脚本简介"> {{ script.info?.description || '' }}</a-descriptions-item>
										<a-descriptions-item
											v-if="script.info?.url"
											label="脚本主页"
										>
											<template v-if="script.info.url.startsWith('http')">
												<a :href="script.info!.url "> {{ script.info!.url }} </a>
											</template>
											<template v-else>
												<div
													style="text-decoration: underline; cursor: pointer"
													@click="shell.showItemInFolder(script.info!.url)"
												>
													{{ script.info?.url }}
												</div>
											</template>
										</a-descriptions-item>
										<a-descriptions-item label="脚本地址"> {{ script.url || '' }}</a-descriptions-item>
										<a-descriptions-item label="id"> {{ script.id || '' }} </a-descriptions-item>
									</a-descriptions>
								</template>
								<a-tag>
									<Icon type="info" />
								</a-tag>
							</a-tooltip>

							<a-tooltip>
								<template #content>
									脚本来源
									<div v-if="script.isLocalScript">
										本地脚本：当前脚本处于您计算机本地，因此不能实时获取网络数据进行更新，但软件依然会尝试重复加载以保证您的文件修改后的代码仍能同步到浏览器中，不具备版本切换功能。
									</div>
									<div v-else-if="script.isInternetLinkScript">
										网络脚本：通过网络链接直接加载到软件中的脚本，不具备版本切换功能。
									</div>
								</template>
								<a-tag>
									<template v-if="script.isLocalScript">本地脚本</template>
									<template v-else-if="script.isInternetLinkScript">网络脚本</template>
									<template v-else>{{ translateSourceType(getSourceType(script)) }}</template>
								</a-tag>
							</a-tooltip>
						</template>

						<template #actions="{ script }">
							<a-button
								v-if="
									!script.isLocalScript &&
									!script.isInternetLinkScript &&
									['greasyfork', 'scriptcat'].includes(getSourceType(script))
								"
								size="small"
								type="outline"
								class="user-script-action"
								style="background: white"
								:disabled="state.versionSelector.loading"
								@click="showScriptVersionList(script)"
							>
								<template v-if="state.versionSelector.currentScriptId === script.id && state.versionSelector.loading">
									<icon-loading />
								</template>
								<template v-else> 切换版本 </template>
							</a-button>

							<a-popover
								content-class="bg-black"
								arrow-class="bg-black"
							>
								<template #title>
									<div style="color: white">{{ script.enable ? '关闭脚本自动加载' : '开启脚本自动加载' }}</div>
								</template>
								<template #content>
									<div
										v-if="!script.enable"
										style="color: white"
									>
										<div>浏览器安装后会自动加载此脚本，</div>
										<div>如果此脚本没有在浏览器中安装，则会自动安装，</div>
										<div>如果已安装则会自动更新以及重新安装</div>
									</div>
								</template>
								<a-button
									size="small"
									:type="script.enable ? 'outline' : undefined"
									class="user-script-action"
									style="background: white"
									@click="script.enable = !script.enable"
								>
									<Icon :type="script.enable ? 'pause' : 'play_circle_outline'" />
								</a-button>
							</a-popover>

							<a-tooltip content="移除脚本">
								<a-popconfirm @ok="onRemoveScript(script)">
									<template #content>
										<div>删除后将不能恢复数据！</div>
										<div>请您记住此脚本名，方便后续查找。</div>
									</template>
									<a-button
										size="small"
										status="danger"
										class="user-script-action"
									>
										<Icon type="delete" />
									</a-button>
								</a-popconfirm>
							</a-tooltip>
						</template>
					</ScriptList>
				</div>
			</a-tab-pane>
			<a-tab-pane
				key="search"
				title="脚本搜索"
			>
				<div class="user-script-page">
					<div class="col-12 actions d-flex">
						<a-input-search
							v-model:value="state.searchValue"
							placeholder="输入脚本名进行搜索"
							search-button
							@change="onSearch"
						/>
					</div>

					<div class="col-12">
						<a-tabs v-model:activeKey="state.engineKey">
							<a-tab-pane
								v-for="item of engineSearchList"
								:key="item.engine.name"
								:title="item.engine.name"
							>
								<div v-if="item.loading">
									<a-skeleton animation>
										<a-skeleton-line :rows="3" />
									</a-skeleton>
								</div>
								<div v-else-if="item.error">
									<a-empty description="请求出错，可能是服务器问题，或者网络问题，请重新尝试。" />
								</div>
								<div v-else-if="item.list.length === 0">
									<a-empty description="暂无数据" />
								</div>
								<div
									v-else
									class="user-script-list pt-0 p-2"
								>
									<div class="text-secondary markdown mb-1">搜索的脚本数据均来自互联网</div>

									<ScriptList :scripts="item.list">
										<template #actions="data">
											<a-button
												size="small"
												class="user-script-action"
												:disabled="data.alreadyInstalled"
												:type="data.alreadyInstalled ? undefined : 'outline'"
												@click="onAddScript(data.script)"
											>
												<Icon type="add" /> {{ data.alreadyInstalled ? '已添加' : '添加' }}
											</a-button>
										</template>
									</ScriptList>
								</div>
							</a-tab-pane>
						</a-tabs>
					</div>
				</div>
			</a-tab-pane>
		</a-tabs>

		<a-modal
			v-model:visible="state.versionSelector.visible"
			title="版本切换"
			:footer="false"
		>
			<CommonSelector
				:list="state.versionSelector.list.map((i) => ({ key: i.version, ...i }))"
				:on-select="(items) => {
					changeScriptVersion(state.versionSelector.currentScriptId!,items[0])
				}"
				:multiple="false"
			>
				<template #content="{ item }">
					<div class="row">
						<div class="col-6">{{ item.version }}</div>
						<div class="text-secondary col-6 text-end">
							<div>创建于：{{ new Date(item.create_time).toLocaleString() }}</div>
						</div>
					</div>
				</template>
			</CommonSelector>
		</a-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, h, reactive } from 'vue';
import { config } from '../../config';
import { store, StoreUserScript } from '../../store';
import { ScriptSearchEngine } from '../../types/search';
import Icon from '../../components/Icon.vue';
import { addScriptFromFile, addScriptFromUrl } from '../../utils/user-scripts';
import { electron } from '../../utils/node';
import { Input, Modal, Message } from '@arco-design/web-vue';
import ScriptList from '../../components/ScriptList.vue';
import { ScriptSourceType, ScriptVersion } from '../../types/user.script';
import CommonSelector from '../../components/CommonSelector.vue';

const { shell } = electron;

/** 搜索列表 */
const engineSearchList = ref<
	{
		engine: ScriptSearchEngine;
		loading?: boolean;
		error?: boolean;
		list: StoreUserScript[];
	}[]
>(config.scriptSearchEngines.map((engine) => ({ engine, list: [] })));

const state = reactive({
	/** 标签页 */
	activeKey: 'web',
	/** 搜索引擎标签 */
	engineKey: config.scriptSearchEngines[0].name,
	/** 搜索值 */
	searchValue: '',

	/**
	 * 版本切换器
	 */
	versionSelector: {
		currentScriptId: undefined as undefined | number,
		// 正在请求的脚本ID
		loading: false,
		visible: false,
		list: [] as ScriptVersion[]
	}
});

function onSearch(value: string) {
	// 清空列表

	engineSearchList.value.forEach(async (item) => {
		item.loading = true;
		item.error = false;
		try {
			const commonScripts = await item.engine.search(value, 1, 10);

			item.list = commonScripts.map((s) => ({
				id: s.id,
				url: s.code_url,
				enable: true,
				info: s,
				isLocalScript: false,
				isInternetLinkScript: false
			}));
		} catch (err) {
			console.log(err);
			item.list = [];
			item.error = true;
		}
		item.loading = false;
	});
}

function onAddScript(script: StoreUserScript) {
	store.render.scripts.push(script);
}

function onRemoveScript(script: StoreUserScript) {
	store.render.scripts.splice(store.render.scripts.indexOf(script), 1);
}

function enableAll() {
	store.render.scripts.forEach((val) => {
		val.enable = true;
	});
}
function closeAll() {
	store.render.scripts.forEach((val) => {
		val.enable = false;
	});
}

function addScriptFromURL() {
	const url = ref('');
	Modal.confirm({
		title: '加载网络脚本',
		simple: false,
		content: () =>
			h('div', [
				h(Input, {
					placeholder: '输入脚本链接（通常以http开头，并以 .user.js 结尾的链接）',
					onChange(value) {
						url.value = value;
					}
				})
			]),
		async onOk() {
			Message.info('正在下载脚本，请稍后...');
			if (await addScriptFromUrl(url.value)) {
				Message.success('脚本下载完成');
			}
		}
	});
}

function getSourceType(script: StoreUserScript): ScriptSourceType {
	const host = new URL(script.url).host;

	if (host.includes('ocsjs.com')) {
		return 'official';
	} else if (host.includes('greasyfork')) {
		return 'greasyfork';
	} else if (host.includes('scriptcat')) {
		return 'scriptcat';
	}

	return 'unknown';
}

function translateSourceType(type: ScriptSourceType) {
	switch (type) {
		case 'official':
			return '官方脚本';
		case 'unknown':
			return '未知来源';
		case 'greasyfork':
			return 'GreasyFork-油叉';
		case 'scriptcat':
			return 'ScriptCat-脚本猫';
		default:
			return '未知来源';
	}
}

/**
 * 切换脚本版本
 * @param id 脚本ID
 */
async function showScriptVersionList(script: StoreUserScript) {
	state.versionSelector.loading = true;

	function error() {
		state.versionSelector.loading = false;
		state.versionSelector.currentScriptId = undefined;
	}

	try {
		state.versionSelector.currentScriptId = script.id;

		const info = script.info;

		const source_type = getSourceType(script);

		if (!info || source_type === 'unknown') {
			error();
			return Message.error('脚本来源未知，无法切换版本');
		}

		if (script.isLocalScript || script.isInternetLinkScript || source_type === 'official') {
			error();
			return Message.error('只有通过脚本搜索并安装的网络脚本才具有切换版本的功能，（来源网站必须要有版本控制功能）');
		}

		const engine = config.scriptSearchEngines.find((engine) => engine.type === source_type);
		if (!engine || engine.versionProvider === undefined) {
			error();
			return Message.error('此脚本没有提供版本切换功能');
		}

		const versions = await engine.versionProvider(script);
		console.log(versions);

		state.versionSelector.list = versions;

		state.versionSelector.visible = true;
	} catch (err) {
		console.log(err);
		state.versionSelector.currentScriptId = undefined;
	}
	state.versionSelector.loading = false;
}

function changeScriptVersion(id: number, version: ScriptVersion) {
	for (const script of store.render.scripts) {
		if (script.id === id && script.info !== undefined) {
			if (script.info.version === version.version) {
				return Message.warning('选择的版本与当前版本相同，无需切换');
			}

			script.url = version.code_url;
			script.info.version = version.version;
			script.info.url = version.url;
			script.info.code_url = version.code_url;
			script.info.create_time = version.create_time;
		}
	}

	Message.success('切换版本成功');
	state.versionSelector.currentScriptId = undefined;
	state.versionSelector.visible = false;
	state.versionSelector.list = [];
	state.versionSelector.loading = false;
}
</script>

<style scoped lang="less">
.actions {
	div + div {
		margin-left: 4px;
	}
}

.user-script-action {
	box-shadow: 0px 2px 4px rgb(203, 203, 203);
}

.user-script-action + .user-script-action {
	margin-left: 8px;
}

.dis {
	color: white !important;
}
</style>

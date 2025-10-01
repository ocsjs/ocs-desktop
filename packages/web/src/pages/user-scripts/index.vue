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
				<div
					class="text-secondary markdown mb-2"
					v-html="lang('notice_user_scripts_page_usage', '')"
				></div>

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
						<a-dropdown trigger="hover">
							<a-button size="mini"> <icon-more /> 快捷操作 </a-button>

							<template #content>
								<a-doption
									size="mini"
									@click="updateAllInfo"
								>
									更新全部脚本信息
								</a-doption>
								<a-doption
									size="mini"
									@click="enableAll"
								>
									全部开启-自动安装
								</a-doption>
								<a-doption
									size="mini"
									@click="closeAll"
								>
									全部关闭-自动安装
								</a-doption>
							</template>
						</a-dropdown>
					</a-space>
				</div>

				<div
					v-if="store.render.scripts.length === 0"
					style="height: 50vh"
					class="d-flex"
				>
					<a-empty
						class="m-auto"
						description="暂无数据, 请在上方“搜索脚本”中选择喜欢的脚本进行添加哦~"
					/>
				</div>
				<div
					v-else
					class="pb-3 ms-1 me-1"
				>
					<ScriptList :scripts="store.render.scripts">
						<template #script-name-prefix="{ script }">
							<a-tooltip v-if="state.script_status[script.id]">
								<a-tag
									class="me-2"
									:color="
										state.script_status[script.id] === 'loading'
											? 'blue'
											: state.script_status[script.id] === 'done'
											? 'green'
											: 'red'
									"
								>
									<icon-refresh
										v-if="state.script_status[script.id] === 'loading'"
										spin
									>
										正在更新脚本信息...
									</icon-refresh>
									<icon-check v-else-if="state.script_status[script.id] === 'done'"> </icon-check>
									<icon-close v-else-if="state.script_status[script.id] === 'error'"> </icon-close>
									<icon-exclamation v-else-if="state.script_status[script.id] === 'not_found'"> </icon-exclamation>
								</a-tag>
								<template #content>
									<div v-if="state.script_status[script.id] === 'loading'">正在更新脚本信息...</div>
									<div v-else-if="state.script_status[script.id] === 'done'">脚本信息更新完成</div>
									<div v-else-if="state.script_status[script.id] === 'error'">脚本信息更新失败，可能是网络问题</div>
									<div v-else-if="state.script_status[script.id] === 'not_found'">本地脚本已不存在，请检查文件路径</div>
								</template>
							</a-tooltip>
						</template>

						<template #infos="{ script }">
							<a-popover
								position="rt"
								:content-style="{ maxWidth: '400px' }"
							>
								<a-tag>
									<Icon type="info" />
								</a-tag>
								<template #content>
									<a-descriptions
										size="mini"
										:label-style="{ verticalAlign: 'top' }"
										:value-style="{}"
										:column="1"
									>
										<a-descriptions-item label="脚本名"> {{ script.info?.name || '' }} </a-descriptions-item>
										<a-descriptions-item label="脚本简介">
											<a-tooltip :content="script.info?.description || ''">
												<div class="large-text">
													{{ script.info?.description || '' }}
												</div>
											</a-tooltip>
										</a-descriptions-item>
										<a-descriptions-item
											v-if="script.info?.url"
											label="脚本主页"
										>
											<a
												href="javascript:void(0)"
												@click="openScriptSource(script)"
											>
												{{ script.info!.url }}
											</a>
										</a-descriptions-item>
										<a-descriptions-item label="脚本链接"> {{ script.info?.code_url || '' }}</a-descriptions-item>
									</a-descriptions>
								</template>
							</a-popover>

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
							<a-tooltip>
								<template #content>
									<div style="color: white; font-weight: bold">
										<template v-if="script.enable"> 关闭脚本自动安装 </template>
										<template v-else>开启脚本自动安装 </template>
									</div>

									<a-divider class="mt-1 mb-1" />
									<div
										v-if="script.enable"
										style="color: white"
									>
										如果想禁止脚本运行，请在浏览器拓展中禁止。
									</div>
									<div
										v-else
										style="color: white"
									>
										<div>浏览器启动后会自动安装此脚本，</div>
										<div>如果此脚本没有在浏览器中安装，则会自动安装，</div>
										<div>如果已安装则会自动更新以及重新安装</div>
									</div>
								</template>

								<a-switch
									v-model="script.enable"
									style="width: 84px"
									class="user-script-action"
								>
									<template #checked> 自动安装 </template>
									<template #unchecked> 自动安装 </template>
								</a-switch>

								<!-- <a-button
									size="mini"
									:type="script.enable ? 'outline' : undefined"
									class="user-script-action"
									style="background: white"
									@click="script.enable = !script.enable"
								>
									<Icon :type="script.enable ? 'pause' : 'download'" />
								</a-button> -->
							</a-tooltip>

							<a-button
								v-if="
									!script.isLocalScript &&
									!script.isInternetLinkScript &&
									['greasyfork', 'scriptcat'].includes(getSourceType(script))
								"
								size="mini"
								type="outline"
								class="user-script-action"
								style="background: white"
								:disabled="state.versionSelector.loading"
								@click="showScriptVersionList(script)"
							>
								<template v-if="state.versionSelector.currentScriptId === script.id && state.versionSelector.loading">
									<icon-loading />
								</template>
								<template v-else>
									<a-tooltip>
										<template #content>
											切换脚本版本，启动浏览器后会强制安装此版本<br />
											如果选择最新版本，那么每次都会同步最新版本
										</template>
										<span> <icon-swap /> 版本 </span>
									</a-tooltip>
								</template>
							</a-button>

							<a-tooltip content="移除脚本">
								<a-popconfirm @ok="onRemoveScript(script)">
									<template #content>
										<div>删除后将不能恢复数据！</div>
										<div>请您记住此脚本名，方便后续查找。</div>
									</template>
									<a-button
										size="mini"
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
												size="mini"
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
						<div class="col-6 d-flex flex-wrap gap-2">
							{{ item.version }}
							<template v-if="item.version === state.versionSelector.list[0]?.version">
								<a-tag
									size="small"
									color="red"
								>
									最新版本
								</a-tag>
							</template>
							<template v-if="item.version === getVersionSelectorCurrentScriptVersion()">
								<a-tag
									size="small"
									color="blue"
								>
									当前版本
								</a-tag>
							</template>
						</div>
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
import { ref, h, reactive, onMounted } from 'vue';
import { config } from '../../config';
import { lang, store, StoreUserScript } from '../../store';
import { ScriptSearchEngine } from '../../types/search';
import Icon from '../../components/Icon.vue';
import { addScriptFromFile, addScriptFromUrl, openScriptSource } from '../../utils/user-scripts';
import { Input, Modal, Message } from '@arco-design/web-vue';
import ScriptList from '../../components/ScriptList.vue';
import { ScriptSourceType, ScriptVersion } from '../../types/user.script';
import CommonSelector from '../../components/CommonSelector.vue';
import { remote } from '../../utils/remote';

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
	},
	script_status: {} as Record<string, 'loading' | 'error' | 'done' | 'not_found'>
});

onMounted(() => {
	updateAllInfo();
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
	if (!script.url) return 'unknown';

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

function changeScriptVersion(id: number, select_version: ScriptVersion) {
	const latest_version = state.versionSelector.list[0];

	for (const script of store.render.scripts) {
		if (script.id === id && script.info !== undefined) {
			const script_version = getUrlVersion(script.info.code_url);
			if (script_version) {
				// 如果选择的是最新版本，直接把URL里面的version删除
				if (latest_version.version === select_version.version) {
					const url = new URL(latest_version.code_url);
					url.searchParams.delete('version');
					script.info.code_url = decodeURIComponent(url.toString());
					script.info.create_time = latest_version.create_time;
					Message.success('已经切换到最新版本，每次启动将自动更新。');
					break;
				}
			} else {
				if (latest_version.version === select_version.version) {
					Message.warning('当前已经是最新版本，无需切换');
					return;
				}
			}

			if (script_version === select_version.version) {
				return Message.warning('选择的版本与当前版本相同!');
			}

			script.info.code_url = decodeURIComponent(select_version.code_url);
			script.info.create_time = select_version.create_time;
		}
	}

	Message.success('切换版本成功');
	state.versionSelector.currentScriptId = undefined;
	state.versionSelector.visible = false;
	state.versionSelector.list = [];
	state.versionSelector.loading = false;
}

function getVersionSelectorCurrentScriptVersion() {
	const url = store.render.scripts.find((s) => s.id === state.versionSelector.currentScriptId)?.info?.code_url;
	if (!url) return '';
	const match = url.match(/version=([\d.]+)/);
	return match ? match[1] : '';
}

function getUrlVersion(url: string) {
	const match = url.match(/version=([\d.]+)/);
	return match ? match[1] : '';
}

async function updateAllInfo() {
	// 更新脚本列表信息

	await Promise.all(
		store.render.scripts.map(async (script) => {
			if (script.isLocalScript) {
				// 检查本地脚本是否存在
				const exists = remote.fs.callSync('existsSync', script.url);
				if (!exists) {
					Message.warning(`本地脚本 ${script.info?.name} （${script.info?.code_url}）已不存在，请检查文件路径`);
					state.script_status[script.id] = 'not_found';
				}
				return;
			}
			if (script.isInternetLinkScript) {
				return;
			}

			if (script.info) {
				const source_type = getSourceType(script);
				if (source_type === 'unknown') {
					return;
				}

				const engine = config.scriptSearchEngines.find((engine) => engine.type === source_type);
				if (!engine || engine.infoGetter === undefined) {
					return;
				}
				state.script_status[script.id] = 'loading';
				try {
					const info = await engine.infoGetter(script.info);
					console.log(info);
					if (!script.info) return;

					const current_script_version = getUrlVersion(script.info.code_url);
					script.info = engine.transformToCommonByInfo(script.info, info);
					if (current_script_version) {
						// 如果当前脚本有版本号，则把版本号加回去
						const url = new URL(script.info.code_url);
						url.searchParams.set('version', current_script_version);
						script.info.code_url = decodeURIComponent(url.toString());
					}
					state.script_status[script.id] = 'done';
					// 一秒后删除状态
					setTimeout(() => {
						delete state.script_status[script.id];
					}, 1000);
				} catch (err) {
					console.log(err);
					state.script_status[script.id] = 'error';
				}
			}
		})
	);

	Message.success('脚本信息更新完成');
}
</script>

<style scoped lang="less">
.actions {
	div + div {
		margin-left: 4px;
	}
}

.user-script-action {
}

.user-script-action + .user-script-action {
	margin-left: 8px;
}

.dis {
	color: white !important;
}

// 超出三行自动省略
.large-text {
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>

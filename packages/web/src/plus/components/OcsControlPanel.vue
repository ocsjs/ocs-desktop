<template>
	<aside class="ocs-control-panel">
		<header class="panel-header">
			<div>
				<span>OCSplus runtime</span>
				<h2>网课控制台</h2>
			</div>
			<button
				class="icon-button"
				title="原版脚本管理"
				@click="openLegacyScripts"
			>
				<PlusIcon name="settings" :size="18" />
			</button>
		</header>

		<section class="status-card">
			<div class="status-main">
				<i :class="statusIndicatorClass" />
				<div>
					<strong>{{ scriptPhaseLabel }}</strong>
					<span>{{ selectedSessionStatus.script.enabled }}/{{ selectedSessionStatus.script.total }} 个脚本启用 · {{ selectedSessionStatus.script.message }}</span>
				</div>
			</div>
			<div class="status-grid">
				<div v-if="sessionOptions.length">
					<span>选中会话</span>
					<select :value="selectedSessionId" @change="selectSession(($event.target as HTMLSelectElement).value)">
						<option v-for="session in sessionOptions" :key="session.sessionId" :value="session.sessionId">{{ session.sessionId.slice(0, 14) }} · epoch {{ session.navigationEpoch }}</option>
					</select>
				</div>
				<div>
					<span>其他会话</span>
					<b>{{ aggregateSummary.otherCount }} 个 · 严重告警 {{ aggregateSummary.seriousAlertCount }}</b>
				</div>
				<div>
					<span>状态来源</span>
					<b>{{ sourceLabel }}</b>
				</div>
				<div>
					<span>来源明细</span>
					<b>{{ sourceDetailLabel }}</b>
				</div>
				<div>
					<span>最后事件</span>
					<b>{{ lastRuntimeEventLabel }}</b>
				</div>
				<div>
					<span>更新时间</span>
					<b>{{ updatedAtLabel }}</b>
				</div>
			</div>
		</section>

		<section class="control-section">
			<div class="section-title">
				<strong>当前页面</strong>
				<span>{{ selectedSessionStatus.page.loading ? '加载中' : '基础状态' }}</span>
			</div>
			<div class="info-list">
				<div><b>标题</b><span>{{ selectedSessionStatus.page.title || '暂未接入页面事件' }}</span></div>
				<div><b>地址</b><span>{{ selectedSessionStatus.page.url || '暂未读取' }}</span></div>
				<div><b>平台</b><span>{{ selectedSessionStatus.page.platform || '暂未识别' }}</span></div>
				<div v-if="selectedSessionStatus.page.error"><b>页面错误</b><span>{{ selectedSessionStatus.page.error }}</span></div>
			</div>
		</section>

		<section class="control-section">
			<div class="section-title">
				<strong>课程与流程</strong>
				<span>只展示状态，不执行自动刷课</span>
			</div>
			<div class="info-list">
				<div><b>课程</b><span>{{ selectedSessionStatus.course.name || '暂未识别' }}</span></div>
				<div><b>章节</b><span>{{ selectedSessionStatus.course.chapter || '暂未识别' }}</span></div>
				<div><b>任务</b><span>{{ selectedSessionStatus.course.task || selectedSessionStatus.course.taskType || '暂未识别' }}</span></div>
				<div><b>进度</b><span>{{ courseProgressLabel }}</span></div>
				<div><b>流程</b><span>{{ flowPhaseLabel }} · {{ selectedSessionStatus.flow.message }}</span></div>
			</div>
			<div v-if="selectedSessionStatus.error" class="error-card">
				<b>{{ selectedSessionStatus.error.code }}</b>
				<span>{{ selectedSessionStatus.error.message }}</span>
			</div>
		</section>

		<section class="control-section injection-audit">
			<div class="section-title"><strong>受控脚本执行</strong><span>仅主进程以已批准 lease 提交</span></div>
			<div v-if="injectionUnavailable" class="error-card"><b>{{ injectionUnavailable }}</b><span>当前已安装脚本库无法由主进程可信读取本地内容和哈希；本会话保持不可执行。</span></div>
			<div v-else-if="injectionCandidates.length" class="diagnostic-list">
				<div v-for="candidate in injectionCandidates" :key="`${candidate.scriptId}:${candidate.contentHash}`" class="diagnostic-item">
					<b>{{ candidate.name }} · v{{ candidate.version }}</b><span>{{ candidate.match }} · {{ candidate.contentHash.slice(0, 19) }}…</span>
					<button class="soft" @click="requestInjectionLease(candidate)">明确提交已验证脚本</button>
				</div>
			</div>
			<p v-else class="hint">当前没有与顶层 URL 匹配的已校验脚本。网络脚本请先点击“下载并校验脚本”。</p>
			<div class="info-list audit-list"><div v-for="fact in injectionAudits" :key="`${fact.occurredAt}:${fact.action}:${fact.code || ''}`"><b>{{ fact.action }}</b><span>{{ fact.code || fact.version || '已记录' }}</span></div></div>
		</section>

		<section class="control-section">
			<div class="section-title">
				<strong>建议操作</strong>
				<span>{{ runtimeDiagnostics.length }} 条可执行建议</span>
			</div>
			<div class="diagnostic-list">
				<div v-for="item in runtimeDiagnostics" :key="item.key" class="diagnostic-item">
					<b>{{ item.title }}</b>
					<span>{{ item.detail }}</span>
					<em>{{ item.action }}</em>
				</div>
			</div>
			<div class="action-grid">
				<button
					class="primary"
					:disabled="!canRetryInject"
					@click="requestInjectScripts"
				>
					<PlusIcon name="bolt" :size="18" />
					请求重新注入
				</button>
				<button class="soft" :disabled="!hasEnabledNetworkScript" @click="cacheEnabledNetworkScripts">
					<PlusIcon name="download" :size="18" />
					下载并校验脚本
				</button>
				<button
					class="soft"
					:disabled="!canSyncProgress"
					@click="requestSyncProgress"
				>
					<PlusIcon name="sync" :size="18" />
					同步进度快照
				</button>
				<button
					class="soft"
					@click="openLegacyBrowser"
				>
					<PlusIcon name="open_in_new" :size="18" />
					原版浏览器
				</button>
				<button
					class="soft"
					@click="openLegacyScripts"
				>
					<PlusIcon name="code" :size="18" />
					脚本列表
				</button>
			</div>
			<p class="hint">
				课程查看器不会自动下载或执行脚本。只有你点击“下载并校验脚本”并明确提交候选后，主进程才会执行哈希校验后的脚本；不执行自动刷课、答题或提交。
			</p>
		</section>
	</aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { router } from '../../route';
import { store } from '../../store';
import { electron } from '../../utils/node';
import PlusIcon from './PlusIcon.vue';
import {
	createDefaultOcsRuntimeStatus,
	createScriptConfigStatusPatch,
	mergeOcsRuntimeStatus,
	OcsRuntimeSessionStore,
	type OcsFlowPhase,
	type OcsRuntimeStatus,
	type OcsRuntimeStatusPatch,
	type OcsScriptPhase
} from '../runtime/status';
import { listenAllOcsRuntimeEvents, type OcsRuntimeEvent } from '../runtime/events';

const selectedSessionStatus = reactive<OcsRuntimeStatus>(createDefaultOcsRuntimeStatus());
const manualRuntimeStatus = reactive<OcsRuntimeStatus>(createDefaultOcsRuntimeStatus());
const sessionStore = new OcsRuntimeSessionStore();
const sessionRevision = ref(0);
const selectedSessionId = ref<string>();
const lastRuntimeEventType = ref<OcsRuntimeEvent['type']>('script-config-updated');
type InjectionCandidate = { scriptId: number; version: string; contentHash: string; name: string; match: string };
type InjectionAudit = { sessionId: string; occurredAt: number; action: string; code?: string; version?: string };
const injectionCandidates = ref<InjectionCandidate[]>([]);
const injectionAudits = ref<InjectionAudit[]>([]);
const injectionUnavailable = ref<string>();

function refreshScriptSnapshot() {
	return electron.ipcRenderer.invoke('ocs-plus-scripts:snapshot').then((scripts: typeof store.render.scripts | undefined) => {
		if (Array.isArray(scripts)) store.render.scripts.splice(0, store.render.scripts.length, ...scripts);
	}).catch(() => { /* Keep the last known script list if the desktop bridge is unavailable. */ });
}

const scriptCount = computed(() => store.render.scripts.length);
const enabledScriptCount = computed(() => store.render.scripts.filter((script: { enable?: boolean }) => script.enable).length);
const hasEnabledNetworkScript = computed(() => store.render.scripts.some((script: { enable?: boolean; isLocalScript?: boolean; isInternetLinkScript?: boolean }) => script.enable && script.isLocalScript !== true && script.isInternetLinkScript === true));

const sourceLabels: Record<OcsRuntimeStatus['source'], string> = {
	'plus-webview': 'Plus 内嵌浏览器事件',
	'legacy-browser': '原 OCS 独立浏览器',
	'script-config': '脚本配置',
	manual: '用户手动操作',
	unknown: '未知 / 尚未接入'
};

const sourceDetailLabels: Record<OcsRuntimeStatus['source'], string> = {
	'plus-webview': 'EmbeddedCourseBrowser 页面 / 注入 / 进度事件',
	'legacy-browser': '原 OCS 独立浏览器进程状态',
	'script-config': 'store.render.scripts 脚本配置快照',
	manual: '用户点击控制台手动入口',
	unknown: '等待脚本配置或页面事件上报'
};

const runtimeEventLabels: Record<OcsRuntimeEvent['type'], string> = {
	'script-config-updated': '脚本配置更新',
	'page-loading': '页面开始加载',
	'page-loaded': '页面加载完成',
	'page-load-failed': '页面加载失败',
	'script-inject-start': '脚本开始注入',
	'script-inject-success': '脚本注入完成',
	'script-inject-failed': '脚本注入失败',
	'runtime-probed': '运行时探测完成',
	'study-progress-synced': '进度快照同步',
	'session-closed': '课程会话已关闭',
	'flow-status': '流程状态更新',
	'manual-action': '手动操作'
};

type RuntimeDiagnostic = {
	key: string;
	title: string;
	detail: string;
	action: string;
};

const scriptPhaseLabels: Record<OcsScriptPhase, string> = {
	no_script: '未安装脚本',
	script_disabled: '脚本未启用',
	script_ready: '脚本待命中',
	injecting: '脚本注入中',
	injected: '脚本已注入',
	running: '脚本运行中',
	paused: '脚本已暂停',
	error: '脚本异常'
};

const flowPhaseLabels: Record<OcsFlowPhase, string> = {
	idle: '空闲',
	opening_page: '打开页面中',
	detecting_platform: '识别平台中',
	detecting_task: '识别任务中',
	start_study: '开始学习状态',
	media_waiting: '等待媒体',
	media_playing: '媒体播放中',
	media_finished: '媒体已完成',
	question_detecting: '题目检测中',
	question_need_manual: '题目需人工处理',
	next_pending: '等待切换下一节',
	next_switching: '正在切换下一节',
	course_finished: '课程已完成',
	manual_required: '需要人工处理',
	error: '流程异常'
};

const sourceLabel = computed(() => sourceLabels[selectedSessionStatus.source]);
const sourceDetailLabel = computed(() => sourceDetailLabels[selectedSessionStatus.source]);
const lastRuntimeEventLabel = computed(() => runtimeEventLabels[lastRuntimeEventType.value]);
const scriptPhaseLabel = computed(() => scriptPhaseLabels[selectedSessionStatus.script.phase]);
const flowPhaseLabel = computed(() => flowPhaseLabels[selectedSessionStatus.flow.phase]);
const updatedAtLabel = computed(() => new Date(selectedSessionStatus.updatedAt).toLocaleTimeString());
const canRetryInject = computed(() => injectionCandidates.value.length > 0);
const canSyncProgress = computed(() => false);
const sessionOptions = computed(() => {
	sessionRevision.value;
	return sessionStore.getSessions();
});
const aggregateSummary = computed(() => {
	sessionRevision.value;
	return sessionStore.getAggregateSummary();
});

const statusIndicatorClass = computed(() => ({
	online: ['script_ready', 'injected', 'running'].includes(selectedSessionStatus.script.phase),
	warning: ['script_disabled', 'paused'].includes(selectedSessionStatus.script.phase),
	error: selectedSessionStatus.script.phase === 'error' || selectedSessionStatus.flow.phase === 'error'
}));

const courseProgressLabel = computed(() => {
	if (typeof selectedSessionStatus.course.progress === 'number') {
		return `${selectedSessionStatus.course.progress}%`;
	}

	if (typeof selectedSessionStatus.course.completedUnits === 'number' && typeof selectedSessionStatus.course.totalUnits === 'number') {
		return `${selectedSessionStatus.course.completedUnits}/${selectedSessionStatus.course.totalUnits}`;
	}

	return '暂无真实进度';
});

const runtimeDiagnostics = computed<RuntimeDiagnostic[]>(() => {
	const diagnostics: RuntimeDiagnostic[] = [];
	const hasPage = Boolean(selectedSessionStatus.page.url);
	const hasCourseIdentity = Boolean(selectedSessionStatus.course.name || selectedSessionStatus.course.chapter || selectedSessionStatus.course.task || selectedSessionStatus.course.taskType);
	const matchedCount = selectedSessionStatus.script.matched;

	if (selectedSessionStatus.script.phase === 'no_script') {
		diagnostics.push({
			key: 'no-script',
			title: '未安装脚本',
			detail: '当前只读取到脚本配置为空，无法确认任何课程脚本能力。',
			action: '进入“脚本列表”安装或导入 OCS 用户脚本，再回到课程页面。'
		});
	}

	if (selectedSessionStatus.script.phase === 'script_disabled') {
		diagnostics.push({
			key: 'script-disabled',
			title: '脚本未启用',
			detail: `已安装 ${selectedSessionStatus.script.total} 个脚本，但启用数为 0。`,
			action: '进入“脚本列表”启用需要的脚本，启用后重新打开或刷新课程页。'
		});
	}

	if (!hasPage) {
		diagnostics.push({
			key: 'page-not-opened',
			title: '页面未打开',
			detail: '尚未收到 Plus 内嵌浏览器的课程页面 URL / 标题事件。',
			action: '在左侧网课浏览器打开课程学习页；需要稳定环境时使用“原版浏览器”。'
		});
	}

	if (selectedSessionStatus.error || selectedSessionStatus.script.phase === 'error' || selectedSessionStatus.flow.phase === 'error') {
		diagnostics.push({
			key: 'runtime-error',
			title: selectedSessionStatus.error?.code || '运行状态异常',
			detail: selectedSessionStatus.error?.message || selectedSessionStatus.script.message || selectedSessionStatus.flow.message || '脚本或流程上报了异常状态。',
			action: selectedSessionStatus.error?.recoverable === false
				? '建议改用“原版浏览器”，并保留错误信息用于后续排查。'
				: '可先刷新页面后点击“请求重新注入”；仍失败时改用“原版浏览器”。'
		});
	}

	if (hasPage && selectedSessionStatus.script.phase === 'injected' && matchedCount === 0) {
		diagnostics.push({
			key: 'script-not-matched',
			title: '未匹配脚本',
			detail: selectedSessionStatus.script.message || '脚本已注入，但当前页面没有匹配到可运行脚本。',
			action: '确认已进入课程视频 / 作业 / 任务页；如平台不支持，请到原版脚本列表检查脚本匹配规则。'
		});
	}

	if (hasPage && !hasCourseIdentity) {
		diagnostics.push({
			key: 'course-unrecognized',
			title: '课程未识别',
			detail: '页面事件已接入，但课程名、章节或任务仍为空；进度快照可能无法识别该平台。',
			action: '点击“同步进度快照”，或切换到课程详情 / 视频任务页后重试。'
		});
	}

	if (selectedSessionStatus.flow.phase === 'question_need_manual' || selectedSessionStatus.flow.phase === 'manual_required') {
		diagnostics.push({
			key: 'manual-required',
			title: selectedSessionStatus.flow.phase === 'question_need_manual' ? '题目需要人工处理' : '需要人工确认',
			detail: selectedSessionStatus.flow.message || '当前状态不能安全自动处理，控制台只展示提示。',
			action: '请在课程页面手动查看题目 / 任务；本控制台不自动识题、答题或提交。'
		});
	}

	if (!diagnostics.length) {
		diagnostics.push({
			key: 'normal-boundary',
			title: '状态展示正常',
			detail: '当前没有失败诊断；已显示的运行状态均来自脚本配置或 runtime 事件。',
			action: '如需更新课程信息，可手动同步进度快照；不会触发自动刷课。'
		});
	}

	return diagnostics;
});

function refreshSelectedSession() {
	const selected = sessionStore.getSelected();
	selectedSessionId.value = selected?.sessionId;
	lastRuntimeEventType.value = (selected?.lastEventType as OcsRuntimeEvent['type']) ?? 'script-config-updated';
	Object.assign(selectedSessionStatus, selected?.status ?? manualRuntimeStatus);
	void refreshInjectionCandidates();
	void refreshInjectionAudit();
}

async function refreshInjectionCandidates() {
	const selected = sessionStore.getSelected();
	if (!selected) { injectionCandidates.value = []; injectionAudits.value = []; injectionUnavailable.value = undefined; return; }
	const result = await electron.ipcRenderer.invoke('ocs-plus-injection:candidates', { sessionId: selected.sessionId, navigationEpoch: selected.navigationEpoch }) as { kind?: string; candidates?: InjectionCandidate[]; code?: string } | undefined;
	if (selectedSessionId.value !== selected.sessionId) return;
	injectionCandidates.value = result?.kind === 'candidates' ? result.candidates || [] : [];
	injectionUnavailable.value = result?.kind === 'unavailable' ? result.code : undefined;
}

async function refreshInjectionAudit(sessionId = selectedSessionId.value) {
	if (!sessionId) { injectionAudits.value = []; return; }
	const facts = await electron.ipcRenderer.invoke('ocs-plus-injection:audit', sessionId) as InjectionAudit[] | undefined;
	if (selectedSessionId.value === sessionId) injectionAudits.value = Array.isArray(facts) ? facts : [];
}

async function requestInjectionLease(candidate: InjectionCandidate) {
	const selected = sessionStore.getSelected();
	if (!selected?.status.page.url) return;
	const result = await electron.ipcRenderer.invoke('ocs-plus-injection:request', { sessionId: selected.sessionId, navigationEpoch: selected.navigationEpoch, url: selected.status.page.url, scriptId: candidate.scriptId, version: candidate.version, contentHash: candidate.contentHash, match: candidate.match }) as { kind?: string; code?: string; lease?: { leaseId?: string } } | undefined;
	if (result?.kind !== 'approved' || typeof result.lease?.leaseId !== 'string') {
		Message.error(`准入被拒绝：${result?.code || 'UNKNOWN'}`);
		return;
	}
	const execution = await electron.ipcRenderer.invoke('ocs-plus-injection:execute', { leaseId: result.lease.leaseId }) as { kind?: string; code?: string } | undefined;
	Message.info(execution?.kind === 'committed' ? '主进程已提交已验证的本地脚本；这不表示脚本正在运行或学习已完成。' : `执行未提交：${execution?.code || 'UNKNOWN'}`);
}

async function cacheEnabledNetworkScripts() {
	const scripts = store.render.scripts.filter((script: { id?: number; enable?: boolean; isLocalScript?: boolean; isInternetLinkScript?: boolean }) => Number.isSafeInteger(script.id) && script.enable && script.isLocalScript !== true && script.isInternetLinkScript === true);
	const results = await Promise.all(scripts.map((script: { id: number }) => electron.ipcRenderer.invoke('ocs-plus-injection:cache', script.id)));
	const cached = results.filter((result: { kind?: string } | undefined) => result?.kind === 'cached').length;
	Message.info(cached ? `已下载并校验 ${cached} 个脚本；请点击具体候选以手动提交。` : '没有可校验的网络脚本，请检查脚本地址和网络后重试。');
	await refreshInjectionCandidates();
}

const handleInjectionAudit = (_event: unknown, facts: InjectionAudit[]) => {
	if (!Array.isArray(facts) || !facts.every((fact) => fact.sessionId === selectedSessionId.value)) return;
	injectionAudits.value = facts;
};
electron.ipcRenderer.on('ocs-plus-injection:audit', handleInjectionAudit);

onMounted(() => { void refreshScriptSnapshot(); });

function getPatchFromRuntimeEvent(event: OcsRuntimeEvent): OcsRuntimeStatusPatch | undefined {
	if ('status' in event.payload && event.payload.status) {
		return event.payload.status;
	}

	switch (event.type) {
		case 'script-config-updated':
			return createScriptConfigStatusPatch(event.payload.total, event.payload.enabled);
		case 'page-loading':
			return { source: event.payload.source ?? 'plus-webview', page: { url: event.payload.url, title: event.payload.title, platform: event.payload.platform, loading: true, error: undefined }, flow: { phase: 'opening_page', message: '课程页面加载中' }, error: undefined };
		case 'page-loaded':
			return { source: event.payload.source ?? 'plus-webview', page: { url: event.payload.url, title: event.payload.title, platform: event.payload.platform, loading: false, error: undefined }, flow: { phase: 'idle', message: '课程页面已加载；不代表脚本运行中' }, error: undefined };
		case 'page-load-failed':
			return { source: 'plus-webview', page: { url: event.payload.url, loading: false, error: event.payload.message }, flow: { phase: 'error', message: event.payload.message }, error: { code: event.payload.code ?? 'PAGE_LOAD_FAILED', message: event.payload.message, recoverable: event.payload.recoverable ?? true } };
		case 'script-inject-start':
			return { source: event.payload.source ?? 'plus-webview', script: { phase: 'injecting' } };
		case 'script-inject-success':
			return { source: event.payload.source ?? 'plus-webview', script: { phase: event.payload.detectedRuntime ? 'running' : 'injected', matched: event.payload.matched }, error: undefined };
		case 'script-inject-failed':
			return { source: 'plus-webview', script: { phase: 'error', message: event.payload.message }, flow: { phase: 'error', message: event.payload.message }, error: { code: event.payload.code ?? 'SCRIPT_INJECT_FAILED', message: event.payload.message, recoverable: event.payload.recoverable ?? true } };
		case 'runtime-probed':
			return { source: event.payload.source ?? 'plus-webview', script: { phase: event.payload.detected ? 'running' : 'injected', matched: event.payload.matched, message: event.payload.message } };
		case 'study-progress-synced':
			return { source: event.payload.source ?? 'plus-webview', course: event.payload.course, page: { platform: event.payload.platform } };
		case 'flow-status':
			return {
				source: event.payload.source ?? 'manual',
				flow: {
					phase: event.payload.phase,
					message: event.payload.message
				}
			};
		case 'manual-action':
			return {
				source: event.payload.source ?? 'manual',
				flow: {
					message: `已记录手动操作：${event.payload.action}`
				}
			};
		default:
			return undefined;
	}
}

watch(
	[scriptCount, enabledScriptCount],
	([total, enabled]) => {
		const status = createScriptConfigStatusPatch(total, enabled);
		Object.assign(manualRuntimeStatus, mergeOcsRuntimeStatus(manualRuntimeStatus, status));
		const selected = sessionStore.getSelected();
		if (!selected) { refreshSelectedSession(); return; }
		sessionStore.applyEvent({
			sessionId: selected.sessionId,
			navigationEpoch: selected.navigationEpoch,
			occurredAt: Date.now(),
			type: 'script-config-updated'
		}, status);
		sessionRevision.value += 1;
		refreshSelectedSession();
	},
	{ immediate: true }
);

const stopListeningRuntimeEvents = listenAllOcsRuntimeEvents((event) => {
	if (event.type === 'session-closed') {
		if (!sessionStore.remove(event.sessionId)) return;
		sessionRevision.value += 1;
		refreshSelectedSession();
		return;
	}

	const pagePatch = getPatchFromRuntimeEvent(event);
	if (!pagePatch) return;
	const patch = {
		...createScriptConfigStatusPatch(scriptCount.value, enabledScriptCount.value),
		...pagePatch,
		script: {
			...createScriptConfigStatusPatch(scriptCount.value, enabledScriptCount.value).script,
			...pagePatch.script
		}
	};
	if (!sessionStore.applyEvent(event, patch)) return;
	sessionRevision.value += 1;
	refreshSelectedSession();
});

function selectSession(sessionId: string) {
	if (!sessionStore.select(sessionId || undefined)) return;
	sessionRevision.value += 1;
	refreshSelectedSession();
}

onBeforeUnmount(() => {
	stopListeningRuntimeEvents();
	electron.ipcRenderer.removeListener('ocs-plus-injection:audit', handleInjectionAudit);
});

function requestInjectScripts() {
	const candidate = injectionCandidates.value[0];
	if (!candidate) { Message.info('请先下载并校验脚本，再点击下方具体候选以手动提交。不会自动注入。'); return; }
	void requestInjectionLease(candidate);
}

function requestSyncProgress() {
	Message.info('当前查看器不读取课程进度快照；请在课程页面手动确认学习状态。');
}

function openLegacyBrowser() {
	router.push('/legacy/browsers');
	Message.info('已进入原 OCS 独立浏览器入口。');
}

function openLegacyScripts() {
	router.push('/legacy/user-scripts');
}
</script>

<style scoped lang="less">
.ocs-control-panel {
	display: flex;
	flex-direction: column;
	gap: 14px;
	min-width: 300px;
	background: #ffffff;
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	padding: 18px;
	box-shadow: 0 16px 38px rgba(24, 48, 74, 0.07);
}

.panel-header,
.section-title,
.status-main {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.panel-header {
	align-items: flex-start;

	span {
		color: #17898d;
		font-size: 12px;
		font-weight: 850;
	}

	h2 {
		margin: 4px 0 0;
		color: #111827;
		font-size: 22px;
		font-weight: 900;
		letter-spacing: 0;
	}
}

.icon-button {
	width: 34px;
	height: 34px;
	border: 1px solid #dbe5ee;
	border-radius: 8px;
	background: #f8fbfc;
	color: #405065;
	cursor: pointer;
}

.status-card,
.control-section {
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	background: #ffffff;
}

.status-card {
	padding: 14px;
	background: linear-gradient(180deg, #f5fbfa 0%, #ffffff 72%);
}

.status-main {
	justify-content: flex-start;
	gap: 10px;
	margin-bottom: 14px;

	i {
		width: 12px;
		height: 12px;
		border-radius: 999px;
		background: #cbd5e1;
		box-shadow: 0 0 0 5px rgba(203, 213, 225, 0.22);

		&.online {
			background: #20bd77;
			box-shadow: 0 0 0 5px rgba(32, 189, 119, 0.16);
		}

		&.warning {
			background: #f59e0b;
			box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.16);
		}

		&.error {
			background: #ef4444;
			box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.16);
		}
	}

	strong {
		display: block;
		color: #111827;
		font-size: 17px;
	}

	span {
		color: #667085;
		font-size: 12px;
	}
}

.status-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;

	div {
		padding: 10px;
		border-radius: 8px;
		background: #f7fafb;
	}

	span {
		display: block;
		color: #667085;
		font-size: 12px;
	}

	b {
		display: block;
		margin-top: 4px;
		color: #273142;
		font-size: 13px;
	}
}

.control-section {
	display: grid;
	gap: 12px;
	padding: 14px;
}

.section-title {
	strong {
		color: #111827;
		font-size: 14px;
		font-weight: 900;
	}

	span {
		color: #778196;
		font-size: 12px;
	}
}

.info-list {
	display: grid;
	gap: 8px;

	div {
		display: grid;
		grid-template-columns: 58px 1fr;
		gap: 8px;
		align-items: start;
		color: #667085;
		font-size: 12px;
	}

	b {
		color: #273142;
	}

	span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.error-card {
	display: grid;
	gap: 4px;
	padding: 10px;
	border-radius: 8px;
	background: #fff1f2;
	color: #be123c;
	font-size: 12px;
}

.diagnostic-list {
	display: grid;
	gap: 8px;
}

.diagnostic-item {
	display: grid;
	gap: 4px;
	padding: 10px;
	border-radius: 8px;
	background: #f8fafc;
	color: #667085;
	font-size: 12px;
	line-height: 1.45;

	b {
		color: #273142;
	}

	em {
		color: #17898d;
		font-style: normal;
		font-weight: 750;
	}
}

.action-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 9px;
}

button {
	height: 38px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	border-radius: 8px;
	font-weight: 850;
	white-space: nowrap;
	cursor: pointer;

	&:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
}

.primary {
	border: 0;
	color: #ffffff;
	background: #229ea0;
	box-shadow: 0 10px 22px rgba(34, 158, 160, 0.22);
}

.soft {
	border: 1px solid #dbe5ee;
	background: #f8fbfc;
	color: #334155;
}

.hint {
	margin: 0;
	padding: 9px 10px;
	border-radius: 8px;
	background: #f8fafc;
	color: #778196;
	font-size: 12px;
	line-height: 1.55;
}
</style>

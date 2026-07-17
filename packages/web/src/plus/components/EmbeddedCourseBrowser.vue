<template>
	<section class="plus-panel embedded-course-browser">
		<div class="panel-title">网课浏览器</div>
		<div class="browser-shell">
			<div class="platform-nav">
				<span>学习平台</span>
				<button v-for="platform in learningPlatforms" :key="platform.name" :title="platform.url" @click="openLearningPlatform(platform.url)">{{ platform.name }}</button>
			</div>
			<div class="browser-tabs">
				<button v-for="session in sessions" :key="session.sessionId" :class="{ active: session.sessionId === selectedSessionId }" @click="selectSession(session.sessionId)">
					{{ session.title }} <i title="关闭会话" @click.stop="closeSession(session.sessionId)">×</i>
				</button>
				<button class="new-session" title="新建课程会话" :disabled="!canUseWebview" @click="createSession">+</button>
			</div>
			<div class="browser-bar">
				<button title="后退" :disabled="!guestVisible" @click="goBack"><PlusIcon name="arrow_back" /></button>
				<button title="前进" :disabled="!guestVisible" @click="goForward"><PlusIcon name="arrow_forward" /></button>
				<button title="刷新" :disabled="!guestVisible" @click="reload"><PlusIcon name="refresh" /></button>
				<button title="首页" :disabled="!selectedSession" @click="goHome"><PlusIcon name="home" /></button>
				<div class="address"><PlusIcon name="lock" :size="16" /><input v-model="address" placeholder="粘贴受支持平台课程地址，按 Enter 打开" @keydown.enter="loadAddress" /></div>
				<button title="打开" :disabled="!canUseWebview" @click="loadAddress"><PlusIcon name="open_in_browser" /></button>
			</div>
			<div ref="webviewHost" class="webview-wrap">
				<!-- Keep sibling nodes stable while Electron attaches the native guest. -->
				<div v-show="!canUseWebview" class="webview-placeholder"><PlusIcon name="desktop_windows" :size="34" /><strong>内嵌课程查看器仅在桌面应用中可用</strong><span>纯浏览器环境无法创建受保护的课程页面。</span></div>
				<div v-show="canUseWebview && !selectedSession" class="webview-start"><PlusIcon name="public" :size="38" /><strong>创建独立课程会话</strong><span>点击“+”新建会话，或选择平台后打开课程页面。</span></div>
				<div v-show="selectedSession?.viewerState === 'idle'" class="webview-start"><PlusIcon name="public" :size="38" /><strong>在此会话打开网课</strong><span>每个课程会话都使用主进程创建的独立 guest 和存储分区。</span></div>
				<div v-show="selectedSession && (selectedSession.viewerState === 'loading' || selectedSession.viewerState === 'validating')" class="webview-status">{{ lifecycleLabel }}</div>
				<div v-show="selectedSession?.viewerState === 'failed'" class="webview-error"><strong>页面加载失败</strong><span>{{ selectedSession?.message }}</span><button @click="retrySession">重试</button></div>
				<div v-show="selectedSession && isGuestVisible(selectedSession)" class="course-view-host" />
			</div>
			<div class="script-dock"><div><PlusIcon name="code" /><span>脚本</span><strong>{{ enabledScriptCount }}/{{ scriptCount }}</strong><em>不会自动执行内嵌脚本</em></div><button @click="openScriptAction">{{ scriptCount ? '打开原 OCS 脚本环境' : '安装脚本' }}</button></div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { router } from '../../route';
import { store } from '../../store';
import { electron, inBrowser } from '../../utils/node';
import PlusIcon from './PlusIcon.vue';
import { emitOcsRuntimeEvent } from '../runtime/events';

type ViewerLifecycle = 'idle' | 'validating' | 'loading' | 'loaded' | 'failed';
type CourseSessionFailureCode = 'COURSE_GUEST_ATTACH_REJECTED' | 'COURSE_GUEST_ATTACH_TIMEOUT' | 'COURSE_NAVIGATION_BLOCKED' | 'COURSE_MAIN_FRAME_LOAD_FAILED' | 'COURSE_LOAD_TIMEOUT';
type CourseSession = { sessionId: string; partition: string; navigationEpoch: number; state: 'created' | 'loading' | 'loaded' | 'failed' | 'blocked' | 'closed'; failureCode?: CourseSessionFailureCode };
type ViewerSession = CourseSession & { url: string; title: string; viewerState: ViewerLifecycle; message: string };

const learningPlatforms = [{ name: '超星', url: 'https://i.chaoxing.com/' }, { name: '智慧树', url: 'https://onlineweb.zhihuishu.com/onlinestuh5' }, { name: '职教云', url: 'https://zjy2.icve.com.cn/' }, { name: '智慧职教', url: 'https://www.icve.com.cn/' }, { name: '中国大学MOOC', url: 'https://www.icourse163.org/' }, { name: '雨课堂', url: 'https://www.yuketang.cn/' }, { name: '学银在线', url: 'https://www.xueyinonline.com/' }];
const address = ref('');
const sessions = ref<ViewerSession[]>([]);
const selectedSessionId = ref<string>();
const webviewHost = ref<HTMLElement>();
let viewResizeObserver: ResizeObserver | undefined;
const canUseWebview = computed(() => !inBrowser);
const selectedSession = computed(() => sessions.value.find((session) => session.sessionId === selectedSessionId.value));
const guestVisible = computed(() => Boolean(selectedSession.value && isGuestVisible(selectedSession.value)));
const lifecycleLabel = computed(() => selectedSession.value?.viewerState === 'validating' ? '正在验证地址...' : '加载中...');
const scriptCount = computed(() => store.render.scripts.length);
const enabledScriptCount = computed(() => store.render.scripts.filter((script: { enable?: boolean }) => script.enable).length);

function refreshScriptSnapshot() {
	if (inBrowser) return;
	void electron.ipcRenderer.invoke('ocs-plus-scripts:snapshot').then((scripts: typeof store.render.scripts | undefined) => {
		if (Array.isArray(scripts)) store.render.scripts.splice(0, store.render.scripts.length, ...scripts);
	}).catch(() => { /* Keep the last known script list if the desktop bridge is unavailable. */ });
}

function normalizeUrl(value: string) { const trimmed = value.trim(); return !trimmed ? '' : /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`; }
function getTitle(url: string) { try { return new URL(url).hostname || '课程页面'; } catch { return '课程页面'; } }
function validateWebUrl(value: string): { allowed: true; url: string } | { allowed: false; message: string } { try { const url = new URL(value); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? { allowed: true, url: url.toString() } : { allowed: false, message: '请输入有效的 HTTP 或 HTTPS 网页地址。' }; } catch { return { allowed: false, message: '地址格式无效，请输入 HTTP 或 HTTPS 网页地址。' }; } }
function updateSession(sessionId: string, patch: Partial<ViewerSession>) { const current = sessions.value.find((session) => session.sessionId === sessionId); if (current) Object.assign(current, patch); }
function isGuestVisible(session: ViewerSession) { return canUseWebview.value && session && Boolean(session.url); }
async function syncCourseView() { const session = selectedSession.value; const host = webviewHost.value; if (!session || !host || !session.url) return; const rect = host.getBoundingClientRect(); await electron.ipcRenderer.invoke('ocs-plus-course-session:activate', session.sessionId, { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }); }
function scheduleCourseView() { void nextTick(() => requestAnimationFrame(() => void syncCourseView())); }
function selectSession(sessionId: string) { selectedSessionId.value = sessionId; address.value = selectedSession.value?.url ?? ''; scheduleCourseView(); }

async function createSession(): Promise<ViewerSession | undefined> {
	if (!canUseWebview.value) return undefined;
	const created = await electron.ipcRenderer.invoke('ocs-plus-course-session:create') as CourseSession | undefined;
	if (!created || !created.sessionId || !created.partition) { Message.error('无法创建受保护的课程会话。'); return undefined; }
	const viewer: ViewerSession = { ...created, url: '', title: '新课程', viewerState: 'idle', message: '' };
	sessions.value.push(viewer); selectSession(viewer.sessionId); return viewer;
}
async function closeSession(sessionId: string) {
	const closed = await electron.ipcRenderer.invoke('ocs-plus-course-session:close', sessionId);
	if (!closed) Message.error('课程会话关闭被主进程拒绝。');
}
async function loadAddress() {
	const requestedUrl = normalizeUrl(address.value);
	if (!requestedUrl) { if (selectedSession.value) updateSession(selectedSession.value.sessionId, { url: '', title: '新课程', viewerState: 'idle', message: '' }); return; }
	const session = selectedSession.value ?? await createSession();
	if (!session) return;
	updateSession(session.sessionId, { viewerState: 'validating', message: '' });
	const result = validateWebUrl(requestedUrl);
	if (!result.allowed) { Message.error(result.message); return; }
	const navigationStarted = await electron.ipcRenderer.invoke('ocs-plus-course-session:navigate', session.sessionId, result.url);
	if (navigationStarted !== true) { updateSession(session.sessionId, { viewerState: 'failed', message: '课程页面无法创建，请稍后重试。' }); return; }
	address.value = result.url;
	updateSession(session.sessionId, { url: result.url, title: getTitle(result.url), viewerState: 'loading', message: '' });
	scheduleCourseView();
}
function openLearningPlatform(url: string) { address.value = url; void loadAddress(); }
function goHome() { address.value = ''; void loadAddress(); }
function commandGuest(command: 'back' | 'forward' | 'reload') { const sessionId = selectedSessionId.value; if (sessionId) void electron.ipcRenderer.invoke('ocs-plus-course-session:command', sessionId, command); }
function goBack() { commandGuest('back'); }
function goForward() { commandGuest('forward'); }
function reload() { commandGuest('reload'); }
function retrySession() { if (!selectedSession.value || selectedSession.value.viewerState !== 'failed') return; address.value = selectedSession.value.url; void loadAddress(); }
function handleCoursePage(_event: unknown, patch: { sessionId?: unknown; url?: unknown; title?: unknown }) { if (typeof patch?.sessionId !== 'string') return; const current = sessions.value.find((session) => session.sessionId === patch.sessionId); if (!current) return; if (typeof patch.url === 'string') { const result = validateWebUrl(patch.url); if (result.allowed) { updateSession(patch.sessionId, { url: result.url, title: getTitle(result.url) }); if (selectedSessionId.value === patch.sessionId) address.value = result.url; } } if (typeof patch.title === 'string' && patch.title.trim()) updateSession(patch.sessionId, { title: patch.title.trim() }); }
function removeViewerSession(sessionId: string) { const index = sessions.value.findIndex((session) => session.sessionId === sessionId); if (index < 0) return; sessions.value.splice(index, 1); if (selectedSessionId.value === sessionId) selectSession(sessions.value[index]?.sessionId ?? sessions.value[index - 1]?.sessionId ?? ''); }
function lifecycleMessage(code?: CourseSessionFailureCode) { return code === 'COURSE_GUEST_ATTACH_TIMEOUT' ? '页面未能创建，请稍后重试。' : code === 'COURSE_LOAD_TIMEOUT' ? '页面加载超时，请检查网络或稍后重试。' : '页面无法加载，请稍后重试。'; }
function handleLifecycle(_event: unknown, snapshot: CourseSession) { const current = sessions.value.find((session) => session.sessionId === snapshot?.sessionId); if (!current || current.partition !== snapshot.partition) return; if (snapshot.state === 'closed') { emitOcsRuntimeEvent('session-closed', {}, { sessionId: snapshot.sessionId, navigationEpoch: snapshot.navigationEpoch }); removeViewerSession(snapshot.sessionId); return; } const viewerState: ViewerLifecycle = snapshot.state === 'loaded' ? 'loaded' : snapshot.state === 'failed' || snapshot.state === 'blocked' ? 'failed' : 'loading'; const message = viewerState === 'failed' ? lifecycleMessage(snapshot.failureCode) : ''; updateSession(snapshot.sessionId, { navigationEpoch: snapshot.navigationEpoch, state: snapshot.state, viewerState, message }); const updated = sessions.value.find((session) => session.sessionId === snapshot.sessionId)!; emitOcsRuntimeEvent(viewerState === 'loaded' ? 'page-loaded' : viewerState === 'failed' ? 'page-load-failed' : 'page-loading', { url: updated.url, title: updated.title, source: 'plus-webview', code: snapshot.failureCode }, { sessionId: snapshot.sessionId, navigationEpoch: snapshot.navigationEpoch }); }
electron.ipcRenderer.on('ocs-plus-course-session:lifecycle', handleLifecycle);
electron.ipcRenderer.on('ocs-plus-course-session:page', handleCoursePage);
onMounted(() => { refreshScriptSnapshot(); viewResizeObserver = new ResizeObserver(scheduleCourseView); if (webviewHost.value) viewResizeObserver.observe(webviewHost.value); });
onBeforeUnmount(() => { viewResizeObserver?.disconnect(); void electron.ipcRenderer.invoke('ocs-plus-course-session:deactivate'); electron.ipcRenderer.removeListener('ocs-plus-course-session:lifecycle', handleLifecycle); electron.ipcRenderer.removeListener('ocs-plus-course-session:page', handleCoursePage); });
function openScriptAction() { router.push(scriptCount.value ? '/legacy/browsers' : '/legacy/user-scripts'); Message.info(scriptCount.value ? '这里是原 OCS 的稳定脚本环境。' : '请先安装并启用用户脚本。'); }
</script>

<style scoped lang="less">
.embedded-course-browser { min-width:0; min-height:0; height:100%; box-sizing:border-box; overflow:hidden; display:flex; flex-direction:column; }.panel-title { flex:0 0 auto; font-size:18px; font-weight:800; color:#101827; margin-bottom:14px; }.browser-shell { flex:1; min-height:0; display:grid; grid-template-rows:42px 38px 54px minmax(0, 1fr) 48px; border:1px solid #e6ebf1; border-radius:8px; overflow:hidden; background:#fff; }.platform-nav,.browser-tabs,.browser-bar,.script-dock { min-width:0; display:flex; align-items:center; gap:8px; padding:0 12px; border-bottom:1px solid #edf1f5; }.platform-nav span { flex:0 0 auto; color:#0f8f8d; font-size:12px; font-weight:800; }.platform-nav button,.browser-tabs button { flex:0 0 auto; border:1px solid #dcece9; border-radius:6px; padding:4px 9px; background:#f3fbfa; color:#137d7b; cursor:pointer; }.browser-tabs { align-items:end; background:#f7fafc; }.browser-tabs button { border-bottom:0; }.browser-tabs button.active { background:#fff; color:#111827; }.browser-tabs i { margin-left:6px; font-style:normal; }.browser-tabs .new-session { margin-left:auto; font-weight:900; }.browser-bar { height:54px; }.browser-bar button { width:30px; height:30px; border:0; border-radius:6px; background:transparent; color:#4b5667; cursor:pointer; }.browser-bar button:disabled,.new-session:disabled { cursor:not-allowed; opacity:.45; }.address { height:32px; flex:1; display:flex; align-items:center; gap:8px; padding:0 11px; border-radius:8px; background:#f6f8fa; }.address input { width:100%; min-width:0; border:0; outline:0; background:transparent; }.webview-wrap { position:relative; min-height:0; overflow:hidden; background:#eef3f7; }.course-webview { position:absolute; inset:0; z-index:1; display:block; width:100%; height:100%; border:0; pointer-events:auto; background:#fff; }.webview-placeholder,.webview-error,.webview-start { position:absolute; z-index:2; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:28px; color:#667085; text-align:center; background:#f8fafc; }.webview-placeholder strong,.webview-error strong,.webview-start strong { color:#111827; font-size:18px; }.webview-error button { border:0; border-radius:6px; padding:8px 14px; background:#1b64f2; color:#fff; cursor:pointer; }.webview-status { position:absolute; z-index:3; top:12px; right:12px; padding:6px 10px; border-radius:999px; pointer-events:none; background:rgba(17,24,39,.78); color:#fff; font-size:12px; }.script-dock { border-top:1px solid #edf1f5; border-bottom:0; justify-content:space-between; }.script-dock div { display:flex; align-items:center; gap:8px; color:#4b5667; }.script-dock button { border:0; border-radius:6px; padding:7px 10px; background:#1b64f2; color:#fff; cursor:pointer; }@media (max-width:1280px) { .platform-nav,.browser-tabs { overflow-x:auto; scrollbar-width:thin; }.browser-shell { grid-template-rows:34px 44px 54px minmax(0,1fr) 42px; }.script-dock { padding:0 8px; font-size:12px; }.script-dock div { min-width:0; overflow:hidden; white-space:nowrap; }.script-dock em { display:none; } }
.course-view-host { position:absolute; inset:0; }
</style>

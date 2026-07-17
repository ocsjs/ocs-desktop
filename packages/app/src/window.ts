// @ts-check
import { BrowserWindow, ipcMain, session, shell, WebContentsView, app, type WebContents } from 'electron';
import path from 'path';
import axios from 'axios';
import {
	CourseUrlPolicy
} from './course-guest-policy';
import { CourseGuestAttachmentRegistry } from './course-guest-attachment-registry';
import { CourseSessionRegistry, type CourseSessionFailureCode, type CourseSessionSnapshot } from './course-session-registry';
import { cacheInstalledRemoteScript, ControlledInjectionService, resolveInstalledLocalScriptCandidates, resolveInstalledLocalScriptSource, resolveInstalledRemoteScriptCandidates, resolveInstalledRemoteScriptSource } from './controlled-injection';
import { getDecryptedRenderData } from './store';
import { Logger } from './logger';

export const COURSE_GUEST_SESSION_MARKER = 'data-ocs-plus-course-session-id';
const COURSE_SESSION_CREATE_CHANNEL = 'ocs-plus-course-session:create';
const COURSE_SESSION_CLOSE_CHANNEL = 'ocs-plus-course-session:close';
const COURSE_SESSION_EXPECT_GUEST_CHANNEL = 'ocs-plus-course-session:expect-guest';
const COURSE_SESSION_NAVIGATE_CHANNEL = 'ocs-plus-course-session:navigate';
const COURSE_SESSION_ACTIVATE_CHANNEL = 'ocs-plus-course-session:activate';
const COURSE_SESSION_DEACTIVATE_CHANNEL = 'ocs-plus-course-session:deactivate';
const COURSE_SESSION_COMMAND_CHANNEL = 'ocs-plus-course-session:command';
const COURSE_SESSION_PAGE_CHANNEL = 'ocs-plus-course-session:page';
const COURSE_SESSION_LIFECYCLE_CHANNEL = 'ocs-plus-course-session:lifecycle';
const INJECTION_CANDIDATES_CHANNEL = 'ocs-plus-injection:candidates';
const INJECTION_REQUEST_CHANNEL = 'ocs-plus-injection:request';
const INJECTION_EXECUTE_CHANNEL = 'ocs-plus-injection:execute';
const INJECTION_AUDIT_CHANNEL = 'ocs-plus-injection:audit';
const INJECTION_CACHE_CHANNEL = 'ocs-plus-injection:cache';
const PLUS_SCRIPT_SNAPSHOT_CHANNEL = 'ocs-plus-scripts:snapshot';
const COURSE_LOAD_TIMEOUT_MS = 30_000;
const COURSE_GUEST_ATTACH_TIMEOUT_MS = 5_000;
const COURSE_GUEST_ZOOM_FACTOR = 0.8;
const courseLogger = Logger('course-guest');
const trustedScriptCacheDirectory = path.join(app.getPath('userData'), 'ocs-plus-script-cache');

const courseUrlPolicy = new CourseUrlPolicy();
const configuredCoursePartitions = new Set<string>();
const courseGuestAttachments = new CourseGuestAttachmentRegistry();
const guestBySessionId = new Map<string, WebContents>();
const courseViewsBySessionId = new Map<string, WebContentsView>();
let activeCourseViewSessionId: string | undefined;
const guestAttachmentTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const popupWindowsBySessionId = new Map<string, Set<BrowserWindow>>();
let injectionAuditTarget: WebContents | undefined;
const courseSessionRegistry = new CourseSessionRegistry({
	onClose: (course) => {
		clearGuestAttachmentTimeout(course.sessionId);
		closeCoursePopups(course.sessionId);
		controlledInjection.revokeSessionLeases(course.sessionId, 'SESSION_EPOCH_STALE');
		courseGuestAttachments.clearForSession(course.sessionId);
		const guest = guestBySessionId.get(course.sessionId);
		guestBySessionId.delete(course.sessionId);
		const view = courseViewsBySessionId.get(course.sessionId);
		courseViewsBySessionId.delete(course.sessionId);
		if (view) {
			activeCourseViewSessionId = activeCourseViewSessionId === course.sessionId ? undefined : activeCourseViewSessionId;
			try { view.setVisible(false); } catch { /* View may already be detached during window teardown. */ }
		}
		if (guest && !guest.isDestroyed()) guest.close();
	}
});
const controlledInjection = new ControlledInjectionService({
	resolveSession: (sessionId) => courseSessionRegistry.get(sessionId),
	getGuestUrl: (sessionId) => {
		const guest = guestBySessionId.get(sessionId);
		return guest && !guest.isDestroyed() ? guest.getURL() : undefined;
	},
	resolveCandidates: (url) => [
		...resolveInstalledLocalScriptCandidates(getDecryptedRenderData(), url) || [],
		...resolveInstalledRemoteScriptCandidates(getDecryptedRenderData(), trustedScriptCacheDirectory, url)
	],
	resolveExecutionSource: (url, scriptId) => resolveInstalledLocalScriptSource(getDecryptedRenderData(), url, scriptId) || resolveInstalledRemoteScriptSource(getDecryptedRenderData(), trustedScriptCacheDirectory, url, scriptId),
	onAudit: (fact) => {
		if (injectionAuditTarget && !injectionAuditTarget.isDestroyed()) emitInjectionAudit(injectionAuditTarget, fact.sessionId);
	}
});

function createFixedInjectionPayload(expectedUrl: string, source: string): string {
	return `(function () { const expectedUrl = ${JSON.stringify(expectedUrl)}; if (location.href !== expectedUrl) throw new Error('OCS_PLUS_URL_GUARD');\n${source}\n})();`;
}

function configureCourseGuestSession(partition: string) {
	const courseSession = session.fromPartition(partition);
	if (configuredCoursePartitions.has(partition)) return courseSession;
	configuredCoursePartitions.add(partition);

	courseSession.setPermissionCheckHandler(() => false);
	courseSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
	courseSession.on('will-download', (event, item) => {
		event.preventDefault();
		item.cancel();
	});
	courseSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
		// Allow every regular web origin in the isolated guest. Non-web protocols remain
		// blocked so remote pages cannot access local files or execute pseudo-URLs.
		const isMainFrameNavigation = details.resourceType === 'mainFrame';
		callback({ cancel: isMainFrameNavigation && shouldBlockCourseTopLevelNavigation(details.url) });
	});
	return courseSession;
}

/**
 * Electron creates a guest's initial document as about:blank before it applies
 * the requested HTTPS src.  It is a renderer-internal bootstrap document, not
 * a remote navigation, so treating it as an unapproved course address puts a
 * valid course session into the terminal "blocked" state before its first
 * page request begins.
 */
export function shouldBlockCourseTopLevelNavigation(url: string) {
	return url !== 'about:blank' && !courseUrlPolicy.evaluate(url).allowed;
}

type CoursePopupSupport = {
	open: (url: string) => Electron.WindowOpenHandlerResponse;
	created: (popup: BrowserWindow) => void;
};

function preventDisallowedCourseNavigation(webContents: WebContents, onBlocked: (url: string) => void, popupSupport?: CoursePopupSupport) {
	const preventWhenBlocked = (event: { preventDefault: () => void }, url: string) => {
		if (shouldBlockCourseTopLevelNavigation(url)) {
			event.preventDefault();
			onBlocked(url);
		}
	};

	webContents.on('will-navigate', (event, url) => preventWhenBlocked(event, url));
	webContents.on('will-redirect', (event, url) => preventWhenBlocked(event, url));
	webContents.setWindowOpenHandler((details) => popupSupport?.open(details.url) ?? { action: 'deny' });
	if (popupSupport) webContents.on('did-create-window', (popup) => popupSupport.created(popup));
}

function closeCoursePopups(sessionId: string) {
	const popups = popupWindowsBySessionId.get(sessionId);
	popupWindowsBySessionId.delete(sessionId);
	for (const popup of popups ?? []) if (!popup.isDestroyed()) popup.close();
}

function createCoursePopupSupport(course: CourseSessionSnapshot, sessionId: string): CoursePopupSupport {
	return {
		open: (url) => {
			// A page can use about:blank as a transient window.open bootstrap.
			if (url !== 'about:blank' && shouldBlockCourseTopLevelNavigation(url)) return { action: 'deny' };
			return {
				action: 'allow',
				overrideBrowserWindowOptions: {
					show: false,
					parent: undefined,
					webPreferences: {
						partition: course.partition,
						nodeIntegration: false,
						contextIsolation: true,
						sandbox: true,
						webSecurity: true,
						allowRunningInsecureContent: false,
						nodeIntegrationInSubFrames: false,
						devTools: false,
						webviewTag: false
					}
				}
			};
		},
		created: (popup) => {
			const popups = popupWindowsBySessionId.get(sessionId) ?? new Set<BrowserWindow>();
			popups.add(popup);
			popupWindowsBySessionId.set(sessionId, popups);
			popup.setMenuBarVisibility(false);
			preventDisallowedCourseNavigation(
				popup.webContents,
				(blockedUrl) => {
					recordBlockedCourseOrigin(sessionId, blockedUrl);
					if (!popup.isDestroyed()) popup.close();
				},
				createCoursePopupSupport(course, sessionId)
			);
			popup.once('ready-to-show', () => {
				if (!popup.isDestroyed()) popup.show();
			});
			popup.once('closed', () => {
				const active = popupWindowsBySessionId.get(sessionId);
				active?.delete(popup);
				if (active?.size === 0) popupWindowsBySessionId.delete(sessionId);
			});
		}
	};
}

function emitCourseLifecycle(target: WebContents, course: CourseSessionSnapshot) {
	if (!target.isDestroyed()) target.send(COURSE_SESSION_LIFECYCLE_CHANNEL, course);
}

function recordCourseDiagnostic(code: CourseSessionFailureCode, sessionId: string) {
	console.warn('[ocs-plus-course]', code, { sessionId });
}

function recordBlockedCourseOrigin(sessionId: string, value: string) {
	try {
		const url = new URL(value);
		courseLogger.warn('navigation-blocked-origin', { sessionId, protocol: url.protocol, hostname: url.hostname, port: url.port });
		console.warn('[ocs-plus-course] navigation-blocked-origin', { sessionId, protocol: url.protocol, hostname: url.hostname, port: url.port });
	} catch {
		courseLogger.warn('navigation-blocked-origin', { sessionId, protocol: 'invalid', hostname: 'invalid', port: '' });
		console.warn('[ocs-plus-course] navigation-blocked-origin', { sessionId, protocol: 'invalid', hostname: 'invalid', port: '' });
	}
}

function recordCourseAttachment(sessionId: string) {
	console.info('[ocs-plus-course] guest-attached', { sessionId });
}

function clearGuestAttachmentTimeout(sessionId: string) {
	const timeout = guestAttachmentTimeouts.get(sessionId);
	if (timeout) clearTimeout(timeout);
	guestAttachmentTimeouts.delete(sessionId);
}

function expectCourseGuest(win: BrowserWindow, sessionId: string): boolean {
	const navigation = courseSessionRegistry.beginNavigation(sessionId);
	if (!navigation) return false;
	clearGuestAttachmentTimeout(sessionId);
	guestAttachmentTimeouts.set(sessionId, setTimeout(() => markCourseTerminal(win, sessionId, navigation.navigationEpoch, 'failed', 'COURSE_GUEST_ATTACH_TIMEOUT'), COURSE_GUEST_ATTACH_TIMEOUT_MS));
	emitCourseLifecycle(win.webContents, { ...navigation, state: 'loading' });
	return true;
}

function markCourseTerminal(win: BrowserWindow, sessionId: string, navigationEpoch: number, state: 'failed' | 'blocked', code: CourseSessionFailureCode) {
	if (!courseSessionRegistry.markTerminal(sessionId, navigationEpoch, state, code)) return;
	clearGuestAttachmentTimeout(sessionId);
	recordCourseDiagnostic(code, sessionId);
	emitCourseLifecycle(win.webContents, courseSessionRegistry.get(sessionId)!);
}

type CourseViewBounds = { x: number; y: number; width: number; height: number };

function normalizeCourseViewBounds(win: BrowserWindow, value: unknown): CourseViewBounds | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const candidate = value as Partial<CourseViewBounds>;
	if (![candidate.x, candidate.y, candidate.width, candidate.height].every(Number.isFinite)) return undefined;
	const content = win.getContentBounds();
	const x = Math.max(0, Math.floor(candidate.x!));
	const y = Math.max(0, Math.floor(candidate.y!));
	const width = Math.min(Math.floor(candidate.width!), Math.max(0, content.width - x));
	const height = Math.min(Math.floor(candidate.height!), Math.max(0, content.height - y));
	return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

function sendCoursePage(win: BrowserWindow, sessionId: string, patch: { url?: string; title?: string }) {
	if (!win.webContents.isDestroyed()) win.webContents.send(COURSE_SESSION_PAGE_CHANNEL, { sessionId, ...patch });
}

function ensureCourseView(win: BrowserWindow, course: CourseSessionSnapshot): WebContentsView {
	const existing = courseViewsBySessionId.get(course.sessionId);
	if (existing) return existing;
	configureCourseGuestSession(course.partition);
	const view = new WebContentsView({
		webPreferences: {
			partition: course.partition,
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			webSecurity: true,
			allowRunningInsecureContent: false,
			nodeIntegrationInSubFrames: false,
			devTools: false,
			webviewTag: false
		}
	});
	const guest = view.webContents;
	courseViewsBySessionId.set(course.sessionId, view);
	guestBySessionId.set(course.sessionId, guest);
	guest.setZoomFactor(COURSE_GUEST_ZOOM_FACTOR);
	preventDisallowedCourseNavigation(guest, (blockedUrl) => {
		const current = courseSessionRegistry.get(course.sessionId);
		if (current) {
			recordBlockedCourseOrigin(course.sessionId, blockedUrl);
			controlledInjection.revokeSessionLeases(course.sessionId, 'SESSION_URL_MISMATCH');
			markCourseTerminal(win, course.sessionId, current.navigationEpoch, 'blocked', 'COURSE_NAVIGATION_BLOCKED');
		}
	}, createCoursePopupSupport(course, course.sessionId));
	guest.on('did-start-loading', () => {
		const navigation = courseSessionRegistry.beginNavigation(course.sessionId);
		if (navigation) emitCourseLifecycle(win.webContents, { ...navigation, state: 'loading' });
	});
	guest.on('did-stop-loading', () => {
		guest.setZoomFactor(COURSE_GUEST_ZOOM_FACTOR);
		const current = courseSessionRegistry.get(course.sessionId);
		if (current && courseSessionRegistry.markLoaded(course.sessionId, current.navigationEpoch)) emitCourseLifecycle(win.webContents, courseSessionRegistry.get(course.sessionId)!);
	});
	guest.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
		if (isMainFrame && errorCode !== -3) {
			const current = courseSessionRegistry.get(course.sessionId);
			if (current) markCourseTerminal(win, course.sessionId, current.navigationEpoch, errorCode === -20 ? 'blocked' : 'failed', errorCode === -20 ? 'COURSE_NAVIGATION_BLOCKED' : 'COURSE_MAIN_FRAME_LOAD_FAILED');
		}
	});
	guest.on('did-navigate', (_event, url) => sendCoursePage(win, course.sessionId, { url }));
	guest.on('did-navigate-in-page', (_event, url) => sendCoursePage(win, course.sessionId, { url }));
	guest.on('page-title-updated', (_event, title) => sendCoursePage(win, course.sessionId, { title }));
	guest.once('destroyed', () => {
		if (guestBySessionId.get(course.sessionId) === guest) guestBySessionId.delete(course.sessionId);
		courseViewsBySessionId.delete(course.sessionId);
		if (courseSessionRegistry.close(course.sessionId)) {
			const closed = courseSessionRegistry.get(course.sessionId);
			if (closed) emitCourseLifecycle(win.webContents, closed);
		}
	});
	return view;
}

function activateCourseView(win: BrowserWindow, sessionId: string, bounds: unknown) {
	const course = courseSessionRegistry.get(sessionId);
	const normalized = normalizeCourseViewBounds(win, bounds);
	if (!course || course.state === 'closed' || !normalized) return false;
	const view = ensureCourseView(win, course);
	for (const [id, candidate] of courseViewsBySessionId) if (id !== sessionId) candidate.setVisible(false);
	if (activeCourseViewSessionId !== sessionId) {
		try { win.contentView.addChildView(view); } catch { /* A view can be added only once; it is already attached in that case. */ }
		activeCourseViewSessionId = sessionId;
	}
	view.setBounds(normalized);
	view.setVisible(true);
	return true;
}

function emitInjectionAudit(target: WebContents, sessionId: string) {
	if (!target.isDestroyed()) target.send(INJECTION_AUDIT_CHANNEL, controlledInjection.getAuditFacts(sessionId));
}

function registerCourseSessionIpc(win: BrowserWindow) {
	ipcMain.removeHandler(COURSE_SESSION_CREATE_CHANNEL);
	ipcMain.removeHandler(COURSE_SESSION_CLOSE_CHANNEL);
	ipcMain.removeHandler(COURSE_SESSION_EXPECT_GUEST_CHANNEL);
	ipcMain.removeHandler(COURSE_SESSION_NAVIGATE_CHANNEL);
	ipcMain.removeHandler(COURSE_SESSION_ACTIVATE_CHANNEL);
	ipcMain.removeHandler(COURSE_SESSION_DEACTIVATE_CHANNEL);
	ipcMain.removeHandler(COURSE_SESSION_COMMAND_CHANNEL);
	ipcMain.removeHandler(INJECTION_CANDIDATES_CHANNEL);
	ipcMain.removeHandler(INJECTION_REQUEST_CHANNEL);
	ipcMain.removeHandler(INJECTION_EXECUTE_CHANNEL);
	ipcMain.removeHandler(INJECTION_AUDIT_CHANNEL);
	ipcMain.removeHandler(INJECTION_CACHE_CHANNEL);
	ipcMain.removeHandler(PLUS_SCRIPT_SNAPSHOT_CHANNEL);
	injectionAuditTarget = win.webContents;
	ipcMain.handle(COURSE_SESSION_CREATE_CHANNEL, (event) => {
		if (event.sender.id !== win.webContents.id) return undefined;
		return courseSessionRegistry.create();
	});
	ipcMain.handle(COURSE_SESSION_CLOSE_CHANNEL, (event, claimedSessionId: unknown) => {
		if (event.sender.id !== win.webContents.id || typeof claimedSessionId !== 'string') return false;
		const closed = courseSessionRegistry.close(claimedSessionId);
		const course = courseSessionRegistry.get(claimedSessionId);
		if (closed && course) emitCourseLifecycle(win.webContents, course);
		return closed;
	});
	ipcMain.handle(COURSE_SESSION_EXPECT_GUEST_CHANNEL, (event, claimedSessionId: unknown) => {
		if (event.sender.id !== win.webContents.id || typeof claimedSessionId !== 'string') return false;
		return expectCourseGuest(win, claimedSessionId);
	});
	ipcMain.handle(COURSE_SESSION_NAVIGATE_CHANNEL, async (event, claimedSessionId: unknown, value: unknown) => {
		if (event.sender.id !== win.webContents.id || typeof claimedSessionId !== 'string' || typeof value !== 'string') return false;
		const course = courseSessionRegistry.get(claimedSessionId);
		if (!course || course.state === 'closed' || !courseUrlPolicy.evaluate(value).allowed) return false;
		const view = ensureCourseView(win, course);
		try { await view.webContents.loadURL(value); return true; } catch { return false; }
	});
	ipcMain.handle(COURSE_SESSION_ACTIVATE_CHANNEL, (event, claimedSessionId: unknown, bounds: unknown) => {
		if (event.sender.id !== win.webContents.id || typeof claimedSessionId !== 'string') return false;
		return activateCourseView(win, claimedSessionId, bounds);
	});
	ipcMain.handle(COURSE_SESSION_DEACTIVATE_CHANNEL, (event) => {
		if (event.sender.id !== win.webContents.id) return false;
		for (const view of courseViewsBySessionId.values()) view.setVisible(false);
		activeCourseViewSessionId = undefined;
		return true;
	});
	ipcMain.handle(COURSE_SESSION_COMMAND_CHANNEL, (event, claimedSessionId: unknown, command: unknown) => {
		if (event.sender.id !== win.webContents.id || typeof claimedSessionId !== 'string' || !['back', 'forward', 'reload'].includes(String(command))) return false;
		const guest = guestBySessionId.get(claimedSessionId);
		if (!guest || guest.isDestroyed()) return false;
		if (command === 'back' && guest.canGoBack()) guest.goBack();
		else if (command === 'forward' && guest.canGoForward()) guest.goForward();
		else if (command === 'reload') guest.reload();
		return true;
	});
	ipcMain.handle(INJECTION_AUDIT_CHANNEL, (event, claimedSessionId: unknown) => {
		if (event.sender.id !== win.webContents.id || typeof claimedSessionId !== 'string') return undefined;
		return controlledInjection.getAuditFacts(claimedSessionId);
	});
	ipcMain.handle(PLUS_SCRIPT_SNAPSHOT_CHANNEL, (event) => {
		if (event.sender.id !== win.webContents.id) return undefined;
		const scripts = getDecryptedRenderData()?.scripts;
		return Array.isArray(scripts) ? scripts : [];
	});
	ipcMain.handle(INJECTION_CACHE_CHANNEL, async (event, claimedScriptId: unknown) => {
		if (event.sender.id !== win.webContents.id || !Number.isSafeInteger(claimedScriptId)) return undefined;
		const scriptId = claimedScriptId as number;
		return cacheInstalledRemoteScript(getDecryptedRenderData(), trustedScriptCacheDirectory, scriptId, async (url) => {
			const response = await axios.get<string>(url, { responseType: 'text', timeout: 15_000, maxContentLength: 2 * 1024 * 1024, transformResponse: [(data) => data] });
			return response.data;
		});
	});
	ipcMain.handle(INJECTION_CANDIDATES_CHANNEL, (event, request: { sessionId?: unknown; navigationEpoch?: unknown }) => {
		if (event.sender.id !== win.webContents.id || typeof request?.sessionId !== 'string' || !Number.isInteger(request.navigationEpoch)) return undefined;
		const result = controlledInjection.listCandidates({ sessionId: request.sessionId, navigationEpoch: request.navigationEpoch as number });

		return result;
	});
	ipcMain.handle(INJECTION_REQUEST_CHANNEL, (event, request: { sessionId?: unknown; navigationEpoch?: unknown; url?: unknown; scriptId?: unknown; version?: unknown; contentHash?: unknown; match?: unknown }) => {
		if (event.sender.id !== win.webContents.id || typeof request?.sessionId !== 'string' || !Number.isInteger(request.navigationEpoch) || typeof request.url !== 'string' || !Number.isSafeInteger(request.scriptId) || typeof request.version !== 'string' || typeof request.contentHash !== 'string' || typeof request.match !== 'string') return undefined;
		const result = controlledInjection.requestLease({
			sessionId: request.sessionId,
			navigationEpoch: request.navigationEpoch as number,
			url: request.url,
			scriptId: request.scriptId as number,
			version: request.version,
			contentHash: request.contentHash,
			match: request.match
		});

		return result;
	});
	ipcMain.handle(INJECTION_EXECUTE_CHANNEL, async (event, request: { leaseId?: unknown }) => {
		if (event.sender.id !== win.webContents.id || typeof request?.leaseId !== 'string' || Object.keys(request).length !== 1) return undefined;
		const committed = controlledInjection.consumeLeaseForExecution(request.leaseId);
		if (committed.kind === 'rejected') return { kind: 'rejected', code: committed.code };
		const guest = guestBySessionId.get(committed.lease.sessionId);
		if (!guest || guest.isDestroyed()) return { kind: 'rejected', code: 'EXECUTION_GUEST_UNAVAILABLE' };
		try {
			// The lease is already consumed: a URL guard or guest rejection is terminal and never retried.
			await guest.executeJavaScript(createFixedInjectionPayload(committed.lease.url, committed.source));
			return { kind: 'committed' };
		} catch (error) {
			return { kind: 'rejected', code: error instanceof Error && error.message === 'OCS_PLUS_URL_GUARD' ? 'EXECUTION_URL_GUARD_REJECTED' : 'EXECUTION_DISPATCH_REJECTED' };
		}
	});
}

export function createWindow() {
	const win = new BrowserWindow({
		title: 'OCS Plus',
		icon: path.resolve('./public/favicon.ico'),
		minWidth: 700,
		minHeight: 400,
		width: 900,
		height: 600,
		center: true,
		hasShadow: true,
		autoHideMenuBar: true,
		titleBarStyle: 'hidden',
		titleBarOverlay: { color: 'white', symbolColor: 'black' },
		frame: false,
		show: false,
		webPreferences: {
			zoomFactor: 1,
			spellcheck: false,
			webSecurity: true,
			// 保持原 OCS 主窗口兼容设置；guest 会在下方独立强制收紧。
			webviewTag: true,
			nodeIntegration: true,
			contextIsolation: false
		}
	});
	registerCourseSessionIpc(win);

	win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
		// Electron does not forward arbitrary data-* attributes to this event.
		// Bind the guest through the main-process-generated, per-session partition
		// and an active loading epoch instead of a renderer-only marker.
		const course = courseSessionRegistry.findExpectedGuestByPartition(params.partition);
		if (
			!course ||
			guestBySessionId.has(course.sessionId) ||
			!courseUrlPolicy.evaluate(params.src).allowed
		) {
			if (course) markCourseTerminal(win, course.sessionId, course.navigationEpoch, 'blocked', 'COURSE_GUEST_ATTACH_REJECTED');
			event.preventDefault();
			return;
		}

		const courseGuestSession = configureCourseGuestSession(course.partition);
		let attachment;
		try {
			attachment = courseGuestAttachments.reserve(course, 'true', courseGuestSession);
		} catch {
			markCourseTerminal(win, course.sessionId, course.navigationEpoch, 'blocked', 'COURSE_GUEST_ATTACH_REJECTED');
			event.preventDefault();
			return;
		}

		params.partition = course.partition;
		delete params.allowpopups;
		delete params.preload;
		webPreferences.partition = course.partition;
		webPreferences.nodeIntegration = false;
		webPreferences.contextIsolation = true;
		webPreferences.sandbox = true;
		webPreferences.webSecurity = true;
		(webPreferences as typeof webPreferences & { enableRemoteModule?: boolean }).enableRemoteModule = false;
		webPreferences.devTools = false;
		webPreferences.webviewTag = false;
		delete webPreferences.preload;
	});

	win.webContents.on('did-attach-webview', (_event, guestWebContents) => {
		const attachment = courseGuestAttachments.consume(guestWebContents.session);
		const course =
			attachment?.marker === 'true'
				? courseSessionRegistry.findActiveGuest({
						sessionId: attachment.sessionId,
						partition: attachment.partition
					})
				: undefined;
		if (!course) {
			guestWebContents.close();
			return;
		}

		const sessionId = course.sessionId;
		recordCourseAttachment(sessionId);
		clearGuestAttachmentTimeout(sessionId);
		let loadTimeout: ReturnType<typeof setTimeout> | undefined;
		const clearLoadTimeout = () => {
			if (loadTimeout) clearTimeout(loadTimeout);
			loadTimeout = undefined;
		};
		guestBySessionId.set(sessionId, guestWebContents);
		// Course providers can render QR-code login dialogs taller than the default
		// 900×600 course viewport.  Scale only the isolated guest, never the host UI.
		guestWebContents.setZoomFactor(COURSE_GUEST_ZOOM_FACTOR);
		preventDisallowedCourseNavigation(guestWebContents, (blockedUrl) => {
			const current = courseSessionRegistry.get(sessionId);
			if (current) {
				recordBlockedCourseOrigin(sessionId, blockedUrl);
				controlledInjection.revokeSessionLeases(sessionId, 'SESSION_URL_MISMATCH');
				markCourseTerminal(win, sessionId, current.navigationEpoch, 'blocked', 'COURSE_NAVIGATION_BLOCKED');
			}
		}, createCoursePopupSupport(course, sessionId));
		guestWebContents.on('did-start-loading', () => {
			const navigation = courseSessionRegistry.beginNavigation(sessionId);
			if (navigation) {
				controlledInjection.revokeSessionLeases(sessionId, 'SESSION_EPOCH_STALE');
				emitCourseLifecycle(win.webContents, { ...navigation, state: 'loading' });
				clearLoadTimeout();
				loadTimeout = setTimeout(() => markCourseTerminal(win, sessionId, navigation.navigationEpoch, 'failed', 'COURSE_LOAD_TIMEOUT'), COURSE_LOAD_TIMEOUT_MS);
			}
		});
		guestWebContents.on('did-stop-loading', () => {
			guestWebContents.setZoomFactor(COURSE_GUEST_ZOOM_FACTOR);
			clearLoadTimeout();
			const current = courseSessionRegistry.get(sessionId);
			if (current && courseSessionRegistry.markLoaded(sessionId, current.navigationEpoch)) {
				emitCourseLifecycle(win.webContents, courseSessionRegistry.get(sessionId)!);
			}
		});
		guestWebContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
			if (isMainFrame !== true || errorCode === -3) return;
			clearLoadTimeout();
			const current = courseSessionRegistry.get(sessionId);
			if (current) markCourseTerminal(win, sessionId, current.navigationEpoch, errorCode === -20 ? 'blocked' : 'failed', errorCode === -20 ? 'COURSE_NAVIGATION_BLOCKED' : 'COURSE_MAIN_FRAME_LOAD_FAILED');
		});
		guestWebContents.once('destroyed', () => {
			clearLoadTimeout();
			if (guestBySessionId.get(sessionId) !== guestWebContents) return;
			guestBySessionId.delete(sessionId);
			if (courseSessionRegistry.close(sessionId)) {
				const closed = courseSessionRegistry.get(sessionId);
				if (closed) emitCourseLifecycle(win.webContents, closed);
			}
		});
	});
	win.once('closed', () => {
		courseSessionRegistry.closeAll();
	});

	// This compatibility behavior belongs to the main OCS window only; course guests
	// always deny disallowed navigations/popups and never fall back to shell.openExternal.
	win.webContents.on('will-navigate', (event, url) => {
		if (url.startsWith('http://localhost') || url.startsWith('file://')) return;
		event.preventDefault();
		shell.openExternal(url);
	});
	win.webContents.setWindowOpenHandler((detail) => {
		shell.openExternal(detail.url);
		return { action: 'deny' };
	});
	return win;
}

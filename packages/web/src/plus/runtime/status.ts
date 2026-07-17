export type OcsRuntimeSource = 'plus-webview' | 'legacy-browser' | 'script-config' | 'manual' | 'unknown';

export type OcsScriptPhase =
	| 'no_script'
	| 'script_disabled'
	| 'script_ready'
	| 'injecting'
	| 'injected'
	| 'running'
	| 'paused'
	| 'error';

export type OcsFlowPhase =
	| 'idle'
	| 'opening_page'
	| 'detecting_platform'
	| 'detecting_task'
	| 'start_study'
	| 'media_waiting'
	| 'media_playing'
	| 'media_finished'
	| 'question_detecting'
	| 'question_need_manual'
	| 'next_pending'
	| 'next_switching'
	| 'course_finished'
	| 'manual_required'
	| 'error';

export type OcsRuntimeAction =
	| 'open_legacy_browser'
	| 'open_legacy_scripts'
	| 'retry_inject'
	| 'sync_progress'
	| 'manual_next';

export type OcsRuntimeStatus = {
	source: OcsRuntimeSource;
	updatedAt: number;
	script: {
		phase: OcsScriptPhase;
		total: number;
		enabled: number;
		matched?: number;
		message?: string;
	};
	page: {
		url?: string;
		title?: string;
		platform?: string;
		loading: boolean;
		error?: string;
	};
	course: {
		name?: string;
		chapter?: string;
		task?: string;
		taskType?: string;
		progress?: number;
		completedUnits?: number;
		totalUnits?: number;
	};
	flow: {
		phase: OcsFlowPhase;
		message?: string;
	};
	actions: OcsRuntimeAction[];
	error?: {
		code: string;
		message: string;
		recoverable: boolean;
	};
};

export type OcsRuntimeStatusPatch = {
	source?: OcsRuntimeStatus['source'];
	updatedAt?: OcsRuntimeStatus['updatedAt'];
	script?: Partial<OcsRuntimeStatus['script']>;
	page?: Partial<OcsRuntimeStatus['page']>;
	course?: Partial<OcsRuntimeStatus['course']>;
	flow?: Partial<OcsRuntimeStatus['flow']>;
	actions?: OcsRuntimeStatus['actions'];
	error?: OcsRuntimeStatus['error'];
};

export function createDefaultOcsRuntimeStatus(): OcsRuntimeStatus {
	return {
		source: 'unknown',
		updatedAt: Date.now(),
		script: {
			phase: 'no_script',
			total: 0,
			enabled: 0,
			message: '尚未读取到已安装脚本'
		},
		page: {
			loading: false
		},
		course: {},
		flow: {
			phase: 'idle',
			message: '等待打开课程页面或原版浏览器'
		},
		actions: ['open_legacy_browser', 'open_legacy_scripts']
	};
}

export function mergeOcsRuntimeStatus(status: OcsRuntimeStatus, patch: OcsRuntimeStatusPatch): OcsRuntimeStatus {
	return {
		...status,
		...patch,
		updatedAt: patch.updatedAt ?? Date.now(),
		script: {
			...status.script,
			...patch.script
		},
		page: {
			...status.page,
			...patch.page
		},
		course: {
			...status.course,
			...patch.course
		},
		flow: {
			...status.flow,
			...patch.flow
		},
		error: Object.prototype.hasOwnProperty.call(patch, 'error') ? patch.error : status.error,
		actions: patch.actions ?? status.actions
	};
}

export function createScriptConfigStatusPatch(total: number, enabled: number): OcsRuntimeStatusPatch {
	if (total <= 0) {
		return {
			source: 'script-config',
			script: {
				phase: 'no_script',
				total,
				enabled,
				message: '未安装 OCS 用户脚本'
			},
			flow: {
				phase: 'idle',
				message: '请先进入原版脚本列表安装或导入脚本'
			},
			actions: ['open_legacy_browser', 'open_legacy_scripts']
		};
	}

	if (enabled <= 0) {
		return {
			source: 'script-config',
			script: {
				phase: 'script_disabled',
				total,
				enabled,
				message: '已有脚本，但当前没有启用项'
			},
			flow: {
				phase: 'manual_required',
				message: '请到脚本列表启用需要的 OCS 脚本'
			},
			actions: ['open_legacy_browser', 'open_legacy_scripts']
		};
	}

	return {
		source: 'script-config',
		script: {
			phase: 'script_ready',
			total,
			enabled,
			message: '脚本配置已启用，等待页面事件或手动请求注入'
		},
		flow: {
			phase: 'idle',
			message: '当前只确认脚本配置可用，尚未确认课程页运行状态'
		},
		actions: ['open_legacy_browser', 'open_legacy_scripts', 'retry_inject', 'sync_progress']
	};
}

export type OcsRuntimeSessionEvent = {
	sessionId: string;
	navigationEpoch: number;
	occurredAt: number;
	type: string;
};

export type OcsRuntimeSessionSnapshot = {
	sessionId: string;
	navigationEpoch: number;
	status: OcsRuntimeStatus;
	lastEventType: string;
	occurredAt: number;
};

export type OcsRuntimeAggregateSummary = {
	total: number;
	otherCount: number;
	seriousAlertCount: number;
};

/** Renderer-memory state. There is deliberately no implicit/default session. */
export class OcsRuntimeSessionStore {
	private readonly sessions = new Map<string, OcsRuntimeSessionSnapshot>();
	private selectedSessionId?: string;

	applyEvent(event: OcsRuntimeSessionEvent, patch: OcsRuntimeStatusPatch): boolean {
		if (!event.sessionId || !Number.isInteger(event.navigationEpoch) || event.navigationEpoch < 0 || !Number.isFinite(event.occurredAt)) return false;
		const current = this.sessions.get(event.sessionId);
		if (current && (event.navigationEpoch < current.navigationEpoch || (event.navigationEpoch === current.navigationEpoch && event.occurredAt < current.occurredAt))) return false;

		const base = !current || event.navigationEpoch > current.navigationEpoch ? createDefaultOcsRuntimeStatus() : current.status;
		const snapshot: OcsRuntimeSessionSnapshot = {
			sessionId: event.sessionId,
			navigationEpoch: event.navigationEpoch,
			status: { ...mergeOcsRuntimeStatus(base, patch), updatedAt: event.occurredAt },
			lastEventType: event.type,
			occurredAt: event.occurredAt
		};
		this.sessions.set(event.sessionId, snapshot);
		if (!this.selectedSessionId) this.selectedSessionId = event.sessionId;
		return true;
	}

	select(sessionId?: string): boolean {
		if (sessionId && !this.sessions.has(sessionId)) return false;
		this.selectedSessionId = sessionId;
		return true;
	}

	/** Removes a main-process-closed session so later stale renderer events have no state to update. */
	remove(sessionId: string): boolean {
		const removed = this.sessions.delete(sessionId);
		if (this.selectedSessionId === sessionId) this.selectedSessionId = undefined;
		return removed;
	}

	getSelected(): OcsRuntimeSessionSnapshot | undefined {
		return this.selectedSessionId ? this.clone(this.sessions.get(this.selectedSessionId)) : undefined;
	}

	getSessions(): OcsRuntimeSessionSnapshot[] {
		return Array.from(this.sessions.values()).sort((left, right) => right.occurredAt - left.occurredAt).map((session) => this.clone(session)!);
	}

	getAggregateSummary(): OcsRuntimeAggregateSummary {
		const sessions = Array.from(this.sessions.values());
		return {
			total: sessions.length,
			otherCount: sessions.filter((session) => session.sessionId !== this.selectedSessionId).length,
			seriousAlertCount: sessions.filter((session) => session.sessionId !== this.selectedSessionId && (session.status.error?.recoverable === false || session.status.flow.phase === 'error')).length
		};
	}

	private clone(session?: OcsRuntimeSessionSnapshot): OcsRuntimeSessionSnapshot | undefined {
		return session && { ...session, status: mergeOcsRuntimeStatus(createDefaultOcsRuntimeStatus(), session.status) };
	}
}

import type { OcsFlowPhase, OcsRuntimeSource, OcsRuntimeStatusPatch } from './status';

export type OcsRuntimeEventType =
	| 'script-config-updated'
	| 'page-loading'
	| 'page-loaded'
	| 'page-load-failed'
	| 'script-inject-start'
	| 'script-inject-success'
	| 'script-inject-failed'
	| 'runtime-probed'
	| 'study-progress-synced'
	| 'session-closed'
	| 'flow-status'
	| 'manual-action';

export type OcsRuntimeEventPayloadMap = {
	'script-config-updated': {
		total: number;
		enabled: number;
		status?: OcsRuntimeStatusPatch;
	};
	'page-loading': {
		url?: string;
		title?: string;
		platform?: string;
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
	'page-loaded': {
		url?: string;
		title?: string;
		platform?: string;
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
	'page-load-failed': {
		url?: string;
		message: string;
		code?: string;
		recoverable?: boolean;
		status?: OcsRuntimeStatusPatch;
	};
	'script-inject-start': {
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
	'script-inject-success': {
		matched?: number;
		detectedRuntime?: boolean;
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
	'script-inject-failed': {
		message: string;
		code?: string;
		recoverable?: boolean;
		status?: OcsRuntimeStatusPatch;
	};
	'runtime-probed': {
		detected: boolean;
		matched?: number;
		message?: string;
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
	'study-progress-synced': {
		course?: {
			name?: string;
			chapter?: string;
			task?: string;
			taskType?: string;
			progress?: number;
			completedUnits?: number;
			totalUnits?: number;
		};
		platform?: string;
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
	'session-closed': Record<string, never>;
	'flow-status': {
		phase: OcsFlowPhase;
		message?: string;
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
	'manual-action': {
		action: string;
		source?: OcsRuntimeSource;
		status?: OcsRuntimeStatusPatch;
	};
};

export type OcsRuntimeEvent<T extends OcsRuntimeEventType = OcsRuntimeEventType> = {
	type: T;
	payload: OcsRuntimeEventPayloadMap[T];
	sessionId: string;
	navigationEpoch: number;
	occurredAt: number;
};

export type OcsRuntimeEventContext = Pick<OcsRuntimeEvent, 'sessionId' | 'navigationEpoch'> & {
	occurredAt?: number;
};

const eventTarget = new EventTarget();
const eventTypes: OcsRuntimeEventType[] = [
	'script-config-updated',
	'page-loading',
	'page-loaded',
	'page-load-failed',
	'script-inject-start',
	'script-inject-success',
	'script-inject-failed',
	'runtime-probed',
	'study-progress-synced',
	'session-closed',
	'flow-status',
	'manual-action'
];

export function emitOcsRuntimeEvent<T extends OcsRuntimeEventType>(
	type: T,
	payload: OcsRuntimeEventPayloadMap[T],
	context: OcsRuntimeEventContext
): OcsRuntimeEvent<T> {
	const event: OcsRuntimeEvent<T> = {
		type,
		payload,
		sessionId: context.sessionId,
		navigationEpoch: context.navigationEpoch,
		occurredAt: context.occurredAt ?? Date.now()
	};

	eventTarget.dispatchEvent(new CustomEvent(type, { detail: event }));
	return event;
}

export function listenOcsRuntimeEvent<T extends OcsRuntimeEventType>(
	type: T,
	listener: (event: OcsRuntimeEvent<T>) => void
): () => void {
	const handler = (event: Event) => {
		listener((event as CustomEvent<OcsRuntimeEvent<T>>).detail);
	};

	eventTarget.addEventListener(type, handler);
	return () => eventTarget.removeEventListener(type, handler);
}

export function listenAllOcsRuntimeEvents(listener: (event: OcsRuntimeEvent) => void): () => void {
	const unlisteners = eventTypes.map((type) => listenOcsRuntimeEvent(type, listener as (event: OcsRuntimeEvent<typeof type>) => void));
	return () => unlisteners.forEach((unlisten) => unlisten());
}

export function getOcsRuntimeEventTypes(): OcsRuntimeEventType[] {
	return [...eventTypes];
}

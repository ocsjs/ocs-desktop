import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { CourseSessionSnapshot } from './course-session-registry';

export const CONTROLLED_INJECTION_LEASE_TTL_MS = 30_000;

export type TrustedScriptCandidate = Readonly<{
	scriptId: number;
	version: string;
	contentHash: string;
	name: string;
	match: string;
}>;

export type InjectionLease = Readonly<{
	leaseId: string;
	sessionId: string;
	navigationEpoch: number;
	url: string;
	scriptId: number;
	version: string;
	contentHash: string;
	match: string;
	expiresAt: number;
}>;

export type InjectionAuditFact = Readonly<{
	occurredAt: number;
	sessionId: string;
	navigationEpoch: number;
	action: 'candidates' | 'requested' | 'approved' | 'rejected' | 'consumed';
	outcome: 'candidates' | 'requested' | 'approved' | 'rejected' | 'consumed';
	code?: ControlledInjectionRejectionCode;
	scriptId?: number;
	version?: string;
	contentHash?: string;
	match?: string;
}>;

export type ControlledInjectionRejectionCode =
	| 'SESSION_NOT_FOUND'
	| 'SESSION_NOT_LOADED'
	| 'SESSION_EPOCH_STALE'
	| 'SESSION_URL_MISMATCH'
	| 'SCRIPT_SOURCE_UNTRUSTED'
	| 'SCRIPT_NOT_CANDIDATE'
	| 'SCRIPT_SNAPSHOT_MISMATCH'
	| 'LEASE_NOT_FOUND'
	| 'LEASE_EXPIRED'
	| 'LEASE_ALREADY_USED';

export type CandidateListResult =
	| { kind: 'candidates'; candidates: TrustedScriptCandidate[] }
	| { kind: 'unavailable'; code: 'SCRIPT_SOURCE_UNTRUSTED' }
	| { kind: 'rejected'; code: ControlledInjectionRejectionCode };
export type LeaseResult =
	| { kind: 'approved'; lease: InjectionLease }
	| { kind: 'rejected'; code: ControlledInjectionRejectionCode };
export type ExecutionLeaseResult =
	| { kind: 'committed'; lease: InjectionLease; source: string }
	| { kind: 'rejected'; code: ControlledInjectionRejectionCode };

/** Main-process-only local reread result. It must never be sent over IPC. */
export type TrustedExecutionSource = Readonly<{ candidate: TrustedScriptCandidate; source: string }>;

type CandidateRequest = Pick<InjectionLease, 'sessionId' | 'navigationEpoch' | 'url' | 'scriptId' | 'version' | 'contentHash' | 'match'>;
type CandidateLookup = Pick<InjectionLease, 'sessionId' | 'navigationEpoch'>;
type StoredLease = {
	lease: InjectionLease;
	state: 'available' | 'used' | 'revoked';
	rejectionCode?: ControlledInjectionRejectionCode;
};

export interface ControlledInjectionServiceOptions {
	now?: () => number;
	createLeaseId?: () => string;
	leaseTtlMs?: number;
	resolveSession: (sessionId: string) => CourseSessionSnapshot | undefined;
	getGuestUrl: (sessionId: string) => string | undefined;
	resolveCandidates: (url: string) => TrustedScriptCandidate[] | undefined;
	/** Main-process-only reread of one exact local source. Never expose this over IPC. */
	resolveExecutionSource?: (url: string, scriptId: number) => TrustedExecutionSource | undefined;
	onAudit?: (fact: InjectionAuditFact) => void;
}

/**
 * A main-process authorization service only. It never receives, evaluates, or returns JavaScript
 * source. D017-4b may consume an approved lease through a separate, fixed execution boundary.
 */
export class ControlledInjectionService {
	private readonly audits: InjectionAuditFact[] = [];
	private readonly leases = new Map<string, StoredLease>();
	private readonly now: () => number;
	private readonly createLeaseId: () => string;
	private readonly leaseTtlMs: number;

	constructor(private readonly options: ControlledInjectionServiceOptions) {
		this.now = options.now ?? Date.now;
		this.createLeaseId = options.createLeaseId ?? (() => `inject_${randomBytes(32).toString('hex')}`);
		this.leaseTtlMs = options.leaseTtlMs ?? CONTROLLED_INJECTION_LEASE_TTL_MS;
	}

	listCandidates(lookup: CandidateLookup): CandidateListResult {
		const sessionCheck = this.validateSession(lookup.sessionId, lookup.navigationEpoch);
		if (sessionCheck) return this.reject(lookup, sessionCheck);
		const url = this.options.getGuestUrl(lookup.sessionId);
		if (!url) return this.reject(lookup, 'SESSION_URL_MISMATCH');
		const candidates = this.options.resolveCandidates(url);
		if (!candidates) {
			this.reject(lookup, 'SCRIPT_SOURCE_UNTRUSTED');
			return { kind: 'unavailable', code: 'SCRIPT_SOURCE_UNTRUSTED' };
		}
		this.audit({ ...lookup, action: 'candidates', outcome: 'candidates' });
		return { kind: 'candidates', candidates: candidates.map((candidate) => ({ ...candidate })) };
	}

	requestLease(request: CandidateRequest): LeaseResult {
		this.audit({ ...request, action: 'requested', outcome: 'requested' });
		const sessionCheck = this.validateSession(request.sessionId, request.navigationEpoch);
		if (sessionCheck) return this.reject(request, sessionCheck);
		const currentUrl = this.options.getGuestUrl(request.sessionId);
		if (!currentUrl || currentUrl !== request.url) return this.reject(request, 'SESSION_URL_MISMATCH');

		const candidates = this.options.resolveCandidates(currentUrl);
		if (!candidates) return this.reject(request, 'SCRIPT_SOURCE_UNTRUSTED');
		const candidate = candidates.find((item) => item.scriptId === request.scriptId);
		if (!candidate) return this.reject(request, 'SCRIPT_NOT_CANDIDATE');
		if (candidate.version !== request.version || candidate.contentHash !== request.contentHash || candidate.match !== request.match) {
			return this.reject(request, 'SCRIPT_SNAPSHOT_MISMATCH');
		}

		const lease: InjectionLease = Object.freeze({
			leaseId: this.createLeaseId(),
			sessionId: request.sessionId,
			navigationEpoch: request.navigationEpoch,
			url: currentUrl,
			scriptId: candidate.scriptId,
			version: candidate.version,
			contentHash: candidate.contentHash,
			match: candidate.match,
			expiresAt: this.now() + this.leaseTtlMs
		});
		this.leases.set(lease.leaseId, { lease, state: 'available' });
		this.audit({ ...lease, action: 'approved', outcome: 'approved' });
		return { kind: 'approved', lease };
	}

	/** Reserved for D017-4b. It only invalidates the authorization; it does not execute anything. */
	consumeLease(leaseId: string): { kind: 'consumed' } | { kind: 'rejected'; code: ControlledInjectionRejectionCode } {
		const stored = this.leases.get(leaseId);
		if (!stored) return { kind: 'rejected', code: 'LEASE_NOT_FOUND' };
		if (stored.state === 'used') return { kind: 'rejected', code: 'LEASE_ALREADY_USED' };
		if (stored.state === 'revoked') return { kind: 'rejected', code: stored.rejectionCode! };
		if (stored.lease.expiresAt <= this.now()) return this.revokeLease(stored, 'LEASE_EXPIRED');

		const sessionCheck = this.validateSession(stored.lease.sessionId, stored.lease.navigationEpoch);
		if (sessionCheck) return this.revokeLease(stored, sessionCheck);
		const currentUrl = this.options.getGuestUrl(stored.lease.sessionId);
		if (!currentUrl || currentUrl !== stored.lease.url) return this.revokeLease(stored, 'SESSION_URL_MISMATCH');
		const candidates = this.options.resolveCandidates(currentUrl);
		if (!candidates) return this.revokeLease(stored, 'SCRIPT_SOURCE_UNTRUSTED');
		const candidate = candidates.find((item) => item.scriptId === stored.lease.scriptId);
		if (!candidate) return this.revokeLease(stored, 'SCRIPT_NOT_CANDIDATE');
		if (candidate.version !== stored.lease.version || candidate.contentHash !== stored.lease.contentHash || candidate.match !== stored.lease.match) {
			return this.revokeLease(stored, 'SCRIPT_SNAPSHOT_MISMATCH');
		}

		stored.state = 'used';
		this.audit({ ...stored.lease, action: 'consumed', outcome: 'consumed' });
		return { kind: 'consumed' };
	}

	/**
	 * D017-4b's main-process-only consumption path. All validation, local reread, and
	 * state transition occur synchronously before the fixed executor dispatches the source.
	 */
	consumeLeaseForExecution(leaseId: string): ExecutionLeaseResult {
		const stored = this.leases.get(leaseId);
		if (!stored) return { kind: 'rejected', code: 'LEASE_NOT_FOUND' };
		if (stored.state === 'used') return { kind: 'rejected', code: 'LEASE_ALREADY_USED' };
		if (stored.state === 'revoked') return { kind: 'rejected', code: stored.rejectionCode! };
		if (stored.lease.expiresAt <= this.now()) return this.revokeLease(stored, 'LEASE_EXPIRED');

		const sessionCheck = this.validateSession(stored.lease.sessionId, stored.lease.navigationEpoch);
		if (sessionCheck) return this.revokeLease(stored, sessionCheck);
		const currentUrl = this.options.getGuestUrl(stored.lease.sessionId);
		if (!currentUrl || currentUrl !== stored.lease.url) return this.revokeLease(stored, 'SESSION_URL_MISMATCH');
		const trusted = this.options.resolveExecutionSource?.(currentUrl, stored.lease.scriptId);
		if (!trusted) return this.revokeLease(stored, 'SCRIPT_SOURCE_UNTRUSTED');
		const candidate = trusted.candidate;
		if (candidate.scriptId !== stored.lease.scriptId || candidate.version !== stored.lease.version || candidate.contentHash !== stored.lease.contentHash || candidate.match !== stored.lease.match) {
			return this.revokeLease(stored, 'SCRIPT_SNAPSHOT_MISMATCH');
		}

		stored.state = 'used';
		this.audit({ ...stored.lease, action: 'consumed', outcome: 'consumed' });
		return { kind: 'committed', lease: stored.lease, source: trusted.source };
	}

	/** Main-process lifecycle hooks revoke outstanding authorizations before a session can be reused. */
	revokeSessionLeases(sessionId: string, code: ControlledInjectionRejectionCode = 'SESSION_EPOCH_STALE') {
		for (const stored of Array.from(this.leases.values())) {
			if (stored.lease.sessionId === sessionId && stored.state === 'available') this.revokeLease(stored, code);
		}
	}

	getAuditFacts(sessionId: string): InjectionAuditFact[] {
		return this.audits.filter((fact) => fact.sessionId === sessionId).map((fact) => ({ ...fact }));
	}

	private validateSession(sessionId: string, navigationEpoch: number): ControlledInjectionRejectionCode | undefined {
		const session = this.options.resolveSession(sessionId);
		if (!session) return 'SESSION_NOT_FOUND';
		if (session.navigationEpoch !== navigationEpoch) return 'SESSION_EPOCH_STALE';
		if (session.state !== 'loaded') return 'SESSION_NOT_LOADED';
		return undefined;
	}

	private reject(context: Partial<CandidateRequest>, code: ControlledInjectionRejectionCode): { kind: 'rejected'; code: ControlledInjectionRejectionCode } {
		this.audit({
			sessionId: context.sessionId ?? '',
			navigationEpoch: context.navigationEpoch ?? -1,
			scriptId: context.scriptId,
			version: context.version,
			contentHash: context.contentHash,
			match: context.match,
			action: 'rejected',
			outcome: 'rejected',
			code
		});
		return { kind: 'rejected', code };
	}

	private revokeLease(stored: StoredLease, code: ControlledInjectionRejectionCode): { kind: 'rejected'; code: ControlledInjectionRejectionCode } {
		stored.state = 'revoked';
		stored.rejectionCode = code;
		this.audit({ ...stored.lease, action: 'rejected', outcome: 'rejected', code });
		return { kind: 'rejected', code };
	}

	private audit(fact: Omit<InjectionAuditFact, 'occurredAt'> & Partial<Pick<InjectionAuditFact, 'occurredAt'>>) {
		const auditFact = Object.freeze({ occurredAt: fact.occurredAt ?? this.now(), ...fact });
		this.audits.push(auditFact);
		this.options.onAudit?.({ ...auditFact });
	}
}

type LocalScriptRecord = { id: unknown; url: unknown; enable: unknown; isLocalScript: unknown; isInternetLinkScript: unknown };
type RemoteScriptRecord = { id: unknown; url: unknown; enable: unknown; isLocalScript: unknown; isInternetLinkScript: unknown };

export type RemoteScriptCacheResult =
	| { kind: 'cached'; scriptId: number }
	| { kind: 'rejected'; code: 'SCRIPT_SOURCE_UNTRUSTED' | 'SCRIPT_DOWNLOAD_FAILED' };

function getRemoteScriptCachePath(cacheDirectory: string, scriptId: number, url: string) {
	const key = createHash('sha256').update(`${scriptId}:${url}`, 'utf8').digest('hex');
	return path.join(cacheDirectory, `${scriptId}-${key}.user.js`);
}

function getEnabledRemoteScriptRecord(renderData: unknown, scriptId: number): { id: number; url: string } | undefined {
	const scripts = (renderData as { scripts?: unknown })?.scripts;
	if (!Array.isArray(scripts)) return undefined;
	const record = (scripts as RemoteScriptRecord[]).find((item) => item.id === scriptId && item.enable === true && item.isLocalScript !== true && item.isInternetLinkScript === true && typeof item.url === 'string');
	if (!record || typeof record.id !== 'number' || !Number.isSafeInteger(record.id) || typeof record.url !== 'string') return undefined;
	try {
		const url = new URL(record.url);
		return url.protocol === 'https:' ? { id: record.id, url: url.toString() } : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Persists a user-requested network script before it can become a candidate. The execution
 * path never downloads: it rereads this immutable snapshot and verifies its hash via the lease.
 */
export async function cacheInstalledRemoteScript(
	renderData: unknown,
	cacheDirectory: string,
	scriptId: number,
	download: (url: string) => Promise<string>
): Promise<RemoteScriptCacheResult> {
	const record = getEnabledRemoteScriptRecord(renderData, scriptId);
	if (!record) return { kind: 'rejected', code: 'SCRIPT_SOURCE_UNTRUSTED' };
	try {
		const source = await download(record.url);
		if (typeof source !== 'string' || !parseUserScriptMetadata(source).name || !parseUserScriptMetadata(source).version) {
			return { kind: 'rejected', code: 'SCRIPT_DOWNLOAD_FAILED' };
		}
		fs.mkdirSync(cacheDirectory, { recursive: true });
		const destination = getRemoteScriptCachePath(cacheDirectory, record.id, record.url);
		const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
		fs.writeFileSync(temporary, source, { encoding: 'utf8', mode: 0o600 });
		fs.renameSync(temporary, destination);
		return { kind: 'cached', scriptId: record.id };
	} catch {
		return { kind: 'rejected', code: 'SCRIPT_DOWNLOAD_FAILED' };
	}
}

export function resolveInstalledRemoteScriptCandidates(renderData: unknown, cacheDirectory: string, url: string): TrustedScriptCandidate[] {
	const scripts = (renderData as { scripts?: unknown })?.scripts;
	if (!Array.isArray(scripts)) return [];
	const candidates: TrustedScriptCandidate[] = [];
	for (const record of scripts as RemoteScriptRecord[]) {
		if (typeof record.id !== 'number' || !Number.isSafeInteger(record.id)) continue;
		const remote = getEnabledRemoteScriptRecord({ scripts: [record] }, record.id);
		if (!remote) continue;
		try {
			const source = fs.readFileSync(getRemoteScriptCachePath(cacheDirectory, remote.id, remote.url), 'utf8');
			const candidate = createTrustedScriptCandidate({ id: remote.id, path: remote.url, source }, url);
			if (candidate) candidates.push(candidate);
		} catch { /* A missing or unreadable snapshot is not eligible. */ }
	}
	return candidates;
}

export function resolveInstalledRemoteScriptSource(renderData: unknown, cacheDirectory: string, url: string, scriptId: number): TrustedExecutionSource | undefined {
	const record = getEnabledRemoteScriptRecord(renderData, scriptId);
	if (!record) return undefined;
	try {
		const source = fs.readFileSync(getRemoteScriptCachePath(cacheDirectory, record.id, record.url), 'utf8');
		const candidate = createTrustedScriptCandidate({ id: record.id, path: record.url, source }, url);
		return candidate ? Object.freeze({ candidate, source }) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Reads installed local files from the main-process store. Remote URLs are deliberately excluded:
 * D017-4a must not download source, trust renderer-provided code, or turn metadata-only records
 * into executable candidates.
 */
export function resolveInstalledLocalScriptCandidates(renderData: unknown, url: string): TrustedScriptCandidate[] | undefined {
	const scripts = (renderData as { scripts?: unknown })?.scripts;
	if (!Array.isArray(scripts)) return undefined;
	const candidates: TrustedScriptCandidate[] = [];
	for (const record of scripts as LocalScriptRecord[]) {
		if (record.enable !== true || record.isLocalScript !== true || record.isInternetLinkScript === true || typeof record.id !== 'number' || !Number.isSafeInteger(record.id) || typeof record.url !== 'string' || !path.isAbsolute(record.url)) continue;
		try {
			const source = fs.readFileSync(record.url, 'utf8');
			const candidate = createTrustedScriptCandidate({ id: record.id, path: record.url, source }, url);
			if (candidate) candidates.push(candidate);
		} catch {
			// A configured local record whose source cannot be read is not trusted or eligible.
		}
	}
	return candidates;
}

/** Main-process-only counterpart used at execution consumption; it rereads one local file. */
export function resolveInstalledLocalScriptSource(renderData: unknown, url: string, scriptId: number): TrustedExecutionSource | undefined {
	const scripts = (renderData as { scripts?: unknown })?.scripts;
	if (!Array.isArray(scripts)) return undefined;
	const record = (scripts as LocalScriptRecord[]).find((item) => item.id === scriptId && item.enable === true && item.isLocalScript === true && item.isInternetLinkScript !== true && typeof item.url === 'string' && path.isAbsolute(item.url));
	if (!record || typeof record.url !== 'string') return undefined;
	try {
		const source = fs.readFileSync(record.url, 'utf8');
		const candidate = createTrustedScriptCandidate({ id: scriptId, path: record.url, source }, url);
		return candidate ? Object.freeze({ candidate, source }) : undefined;
	} catch {
		return undefined;
	}
}

export function createTrustedScriptCandidate(input: { id: number; path: string; source: string }, url: string): TrustedScriptCandidate | undefined {
	const metadata = parseUserScriptMetadata(input.source);
	if (!metadata.name || !metadata.version) return undefined;
	const match = metadata.matches.find((pattern) => matchesExplicitUserScriptPattern(pattern, url));
	if (!match) return undefined;
	return Object.freeze({
		scriptId: input.id,
		version: metadata.version,
		contentHash: `sha256:${createHash('sha256').update(input.source, 'utf8').digest('hex')}`,
		name: metadata.name,
		match
	});
}

function parseUserScriptMetadata(source: string): { name?: string; version?: string; matches: string[] } {
	const block = source.match(/^[\s\S]*?\/\/\s*==UserScript==\s*([\s\S]*?)\/\/\s*==\/UserScript==/)?.[1];
	if (!block) return { matches: [] };
	const values = Array.from(block.matchAll(/^\s*\/\/\s*@([\w-]+)\s+(.+?)\s*$/gm));
	return {
		name: values.find((item) => item[1] === 'name')?.[2],
		version: values.find((item) => item[1] === 'version')?.[2],
		matches: values.filter((item) => item[1] === 'match').map((item) => item[2])
	};
}

/** A deliberately small @match subset: HTTPS exact hosts or leading wildcard subdomains and a path glob. */
function matchesExplicitUserScriptPattern(pattern: string, target: string): boolean {
	const match = pattern.match(/^(https):\/\/((?:\*\.)?[a-z0-9.-]+)(\/.*)$/i);
	if (!match) return false;
	try {
		const url = new URL(target);
		if (url.protocol !== `${match[1]}:`) return false;
		const host = match[2].toLowerCase();
		const hostname = url.hostname.toLowerCase();
		const hostMatches = host.startsWith('*.') ? hostname.endsWith(`.${host.slice(2)}`) : hostname === host;
		const pathPattern = match[3].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
		return hostMatches && new RegExp(`^${pathPattern}$`).test(`${url.pathname}${url.search}`);
	} catch {
		return false;
	}
}

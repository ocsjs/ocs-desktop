const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
	ControlledInjectionService,
	cacheInstalledRemoteScript,
	createTrustedScriptCandidate,
	resolveInstalledLocalScriptCandidates,
	resolveInstalledLocalScriptSource,
	resolveInstalledRemoteScriptCandidates,
	resolveInstalledRemoteScriptSource
} = require('../lib/src/controlled-injection.js');

const session = {
	sessionId: 'course_test',
	partition: 'persist:ocs-plus-course-v1-course_test',
	navigationEpoch: 3,
	state: 'loaded'
};

const source = `// ==UserScript==
// @name Safe local script
// @version 1.2.3
// @match https://i.chaoxing.com/*
// ==/UserScript==
console.log('must never execute in D017-4a');`;

function createService(now = 10_000) {
	return new ControlledInjectionService({
		now: () => now,
		createLeaseId: () => 'lease_test',
		leaseTtlMs: 30_000,
		resolveSession: (sessionId) => (sessionId === session.sessionId ? session : undefined),
		getGuestUrl: (sessionId) => (sessionId === session.sessionId ? 'https://i.chaoxing.com/course/1' : undefined),
		resolveCandidates: (url) => [createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source }, url)]
	});
}

test('trusted local candidate has an explicit @match, parsed version, and content hash without executing source', () => {
	const candidate = createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source }, 'https://i.chaoxing.com/course/1');

	assert.deepEqual(candidate, {
		scriptId: 7,
		version: '1.2.3',
		contentHash: candidate.contentHash,
		name: 'Safe local script',
		match: 'https://i.chaoxing.com/*'
	});
	assert.match(candidate.contentHash, /^sha256:[a-f0-9]{64}$/);
});

test('lease approval revalidates session, epoch, URL and immutable candidate facts, then consumes once', () => {
	const service = createService();
	const candidate = service.listCandidates({ sessionId: session.sessionId, navigationEpoch: 3 });
	assert.equal(candidate.kind, 'candidates');
	assert.equal(candidate.candidates.length, 1);

	const approved = service.requestLease({
		sessionId: session.sessionId,
		navigationEpoch: 3,
		url: 'https://i.chaoxing.com/course/1',
		...candidate.candidates[0]
	});
	assert.equal(approved.kind, 'approved');
	assert.equal(approved.lease.leaseId, 'lease_test');
	assert.equal(service.consumeLease('lease_test').kind, 'consumed');
	assert.equal(service.consumeLease('lease_test').code, 'LEASE_ALREADY_USED');
});

test('stable rejection codes cover stale session facts and untrusted/changed candidates', () => {
	const service = createService();
	const candidate = service.listCandidates({ sessionId: session.sessionId, navigationEpoch: 3 });
	assert.equal(candidate.kind, 'candidates');

	assert.equal(service.requestLease({ sessionId: session.sessionId, navigationEpoch: 2, url: 'https://i.chaoxing.com/course/1', ...candidate.candidates[0] }).code, 'SESSION_EPOCH_STALE');
	assert.equal(service.requestLease({ sessionId: session.sessionId, navigationEpoch: 3, url: 'https://i.chaoxing.com/other', ...candidate.candidates[0] }).code, 'SESSION_URL_MISMATCH');
	assert.equal(service.requestLease({ sessionId: session.sessionId, navigationEpoch: 3, url: 'https://i.chaoxing.com/course/1', ...candidate.candidates[0], contentHash: 'sha256:changed' }).code, 'SCRIPT_SNAPSHOT_MISMATCH');

	const audits = service.getAuditFacts(session.sessionId);
	assert.deepEqual(audits.map((audit) => audit.outcome), ['candidates', 'requested', 'rejected', 'requested', 'rejected', 'requested', 'rejected']);
});

function createMutableService() {
	let currentSession = { ...session };
	let currentUrl = 'https://i.chaoxing.com/course/1';
	let currentSource = source;
	const pushedAudits = [];
	const service = new ControlledInjectionService({
		now: () => 10_000,
		createLeaseId: () => 'lease_mutable',
		resolveSession: (sessionId) => (sessionId === currentSession.sessionId ? currentSession : undefined),
		getGuestUrl: (sessionId) => (sessionId === currentSession.sessionId ? currentUrl : undefined),
		resolveCandidates: (url) => [createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source: currentSource }, url)],
		onAudit: (fact) => pushedAudits.push(fact)
	});
	return {
		service,
		pushedAudits,
		navigate(url) { currentUrl = url; currentSession = { ...currentSession, navigationEpoch: currentSession.navigationEpoch + 1, state: 'loading' }; },
		close() { currentSession = { ...currentSession, navigationEpoch: currentSession.navigationEpoch + 1, state: 'closed' }; },
		changeSource(nextSource) { currentSource = nextSource; },
		getCandidate() { const result = service.listCandidates({ sessionId: currentSession.sessionId, navigationEpoch: currentSession.navigationEpoch }); assert.equal(result.kind, 'candidates'); return result.candidates[0]; },
		request(candidate) { return service.requestLease({ sessionId: currentSession.sessionId, navigationEpoch: currentSession.navigationEpoch, url: currentUrl, ...candidate }); }
	};
}

test('approved lease is proactively revoked and cannot cross a later navigation', () => {
	const fixture = createMutableService();
	const approved = fixture.request(fixture.getCandidate());
	assert.equal(approved.kind, 'approved');
	fixture.navigate('https://i.chaoxing.com/course/2');
	fixture.service.revokeSessionLeases(session.sessionId, 'SESSION_EPOCH_STALE');
	assert.deepEqual(fixture.service.consumeLease(approved.lease.leaseId), { kind: 'rejected', code: 'SESSION_EPOCH_STALE' });
	assert.deepEqual(fixture.service.consumeLease(approved.lease.leaseId), { kind: 'rejected', code: 'SESSION_EPOCH_STALE' });
});

test('approved lease is proactively revoked and cannot survive session close', () => {
	const fixture = createMutableService();
	const approved = fixture.request(fixture.getCandidate());
	assert.equal(approved.kind, 'approved');
	fixture.close();
	fixture.service.revokeSessionLeases(session.sessionId, 'SESSION_EPOCH_STALE');
	assert.deepEqual(fixture.service.consumeLease(approved.lease.leaseId), { kind: 'rejected', code: 'SESSION_EPOCH_STALE' });
});

test('consume re-reads candidate facts and rejects a changed local script snapshot', () => {
	const fixture = createMutableService();
	const approved = fixture.request(fixture.getCandidate());
	assert.equal(approved.kind, 'approved');
	fixture.changeSource(source.replace("console.log('must never execute in D017-4a');", "console.log('changed but never executed');"));
	assert.deepEqual(fixture.service.consumeLease(approved.lease.leaseId), { kind: 'rejected', code: 'SCRIPT_SNAPSHOT_MISMATCH' });
});

test('untrusted script sources are explicitly unavailable and all admission facts are pushed to audit observers', () => {
	const pushed = [];
	const untrusted = new ControlledInjectionService({
		resolveSession: (sessionId) => (sessionId === session.sessionId ? session : undefined),
		getGuestUrl: () => 'https://i.chaoxing.com/course/1',
		resolveCandidates: () => undefined,
		onAudit: (fact) => pushed.push(fact)
	});
	assert.deepEqual(untrusted.listCandidates({ sessionId: session.sessionId, navigationEpoch: 3 }), { kind: 'unavailable', code: 'SCRIPT_SOURCE_UNTRUSTED' });
	assert.deepEqual(pushed.map((fact) => [fact.action, fact.code]), [['rejected', 'SCRIPT_SOURCE_UNTRUSTED']]);

	const fixture = createMutableService();
	const candidate = fixture.getCandidate();
	const approved = fixture.request(candidate);
	assert.equal(approved.kind, 'approved');
	assert.deepEqual(fixture.pushedAudits.map((fact) => fact.action), ['candidates', 'requested', 'approved']);
});

test('execution consumption synchronously re-reads the approved local source, returns that same source once, and never exposes it through admission facts', () => {
	let currentSource = source;
	const executionService = new ControlledInjectionService({
		now: () => 10_000,
		createLeaseId: () => 'lease_execution',
		resolveSession: (sessionId) => (sessionId === session.sessionId ? session : undefined),
		getGuestUrl: () => 'https://i.chaoxing.com/course/1',
		resolveCandidates: (url) => [createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source: currentSource }, url)],
		resolveExecutionSource: (url, scriptId) => scriptId === 7 ? { source: currentSource, candidate: createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source: currentSource }, url) } : undefined
	});
	const candidates = executionService.listCandidates({ sessionId: session.sessionId, navigationEpoch: 3 });
	assert.equal(candidates.kind, 'candidates');
	const approved = executionService.requestLease({ sessionId: session.sessionId, navigationEpoch: 3, url: 'https://i.chaoxing.com/course/1', ...candidates.candidates[0] });
	assert.equal(approved.kind, 'approved');

	const committed = executionService.consumeLeaseForExecution(approved.lease.leaseId);
	assert.equal(committed.kind, 'committed');
	assert.equal(committed.source, source);
	assert.deepEqual(executionService.consumeLeaseForExecution(approved.lease.leaseId), { kind: 'rejected', code: 'LEASE_ALREADY_USED' });
	assert.doesNotMatch(JSON.stringify(executionService.getAuditFacts(session.sessionId)), /must never execute/);
	currentSource = `${source}\n// changed`;
	assert.deepEqual(executionService.consumeLeaseForExecution('lease_execution'), { kind: 'rejected', code: 'LEASE_ALREADY_USED' });
});

test('execution consumption rejects a local source changed after approval before any guest dispatch', () => {
	let currentSource = source;
	const executionService = new ControlledInjectionService({
		now: () => 10_000,
		createLeaseId: () => 'lease_changed_execution',
		resolveSession: (sessionId) => (sessionId === session.sessionId ? session : undefined),
		getGuestUrl: () => 'https://i.chaoxing.com/course/1',
		resolveCandidates: (url) => [createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source: currentSource }, url)],
		resolveExecutionSource: (url, scriptId) => scriptId === 7 ? { source: currentSource, candidate: createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source: currentSource }, url) } : undefined
	});
	const candidates = executionService.listCandidates({ sessionId: session.sessionId, navigationEpoch: 3 });
	assert.equal(candidates.kind, 'candidates');
	const approved = executionService.requestLease({ sessionId: session.sessionId, navigationEpoch: 3, url: 'https://i.chaoxing.com/course/1', ...candidates.candidates[0] });
	assert.equal(approved.kind, 'approved');
	currentSource = `${source}\n// changed before dispatch`;
	assert.deepEqual(executionService.consumeLeaseForExecution(approved.lease.leaseId), { kind: 'rejected', code: 'SCRIPT_SNAPSHOT_MISMATCH' });
});

test('disabled local scripts are never candidates or execution sources', () => {
	const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ocs-plus-disabled-'));
	const scriptPath = path.join(root, 'disabled.user.js');
	fs.writeFileSync(scriptPath, source);
	const renderData = {
		scripts: [{ id: 7, enable: false, isLocalScript: true, isInternetLinkScript: false, url: scriptPath }]
	};
	try {
		assert.deepEqual(resolveInstalledLocalScriptCandidates(renderData, 'https://i.chaoxing.com/course/1'), []);
		assert.equal(resolveInstalledLocalScriptSource(renderData, 'https://i.chaoxing.com/course/1', 7), undefined);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('a user-requested network script becomes eligible only after its verified local snapshot exists', async () => {
	const cacheDirectory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ocs-plus-script-cache-'));
	const renderData = { scripts: [{ id: 91, enable: true, isLocalScript: false, isInternetLinkScript: true, url: 'https://cdn.example.test/assistant.user.js' }] };
	try {
		assert.deepEqual(resolveInstalledRemoteScriptCandidates(renderData, cacheDirectory, 'https://i.chaoxing.com/course/1'), []);
		const result = await cacheInstalledRemoteScript(renderData, cacheDirectory, 91, async () => source);
		assert.deepEqual(result, { kind: 'cached', scriptId: 91 });
		const candidates = resolveInstalledRemoteScriptCandidates(renderData, cacheDirectory, 'https://i.chaoxing.com/course/1');
		assert.equal(candidates.length, 1);
		assert.equal(candidates[0].scriptId, 91);
		assert.equal(resolveInstalledRemoteScriptSource(renderData, cacheDirectory, 'https://i.chaoxing.com/course/1', 91)?.source, source);
	} finally {
		fs.rmSync(cacheDirectory, { recursive: true, force: true });
	}
});

test('network script cache rejects non-HTTPS, disabled, or invalid responses', async () => {
	const cacheDirectory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ocs-plus-script-cache-'));
	try {
		assert.deepEqual(await cacheInstalledRemoteScript({ scripts: [{ id: 92, enable: true, isLocalScript: false, isInternetLinkScript: true, url: 'http://example.test/script.user.js' }] }, cacheDirectory, 92, async () => source), { kind: 'rejected', code: 'SCRIPT_SOURCE_UNTRUSTED' });
		assert.deepEqual(await cacheInstalledRemoteScript({ scripts: [{ id: 93, enable: false, isLocalScript: false, isInternetLinkScript: true, url: 'https://example.test/script.user.js' }] }, cacheDirectory, 93, async () => source), { kind: 'rejected', code: 'SCRIPT_SOURCE_UNTRUSTED' });
		assert.deepEqual(await cacheInstalledRemoteScript({ scripts: [{ id: 94, enable: true, isLocalScript: false, isInternetLinkScript: true, url: 'https://example.test/script.user.js' }] }, cacheDirectory, 94, async () => 'not a userscript'), { kind: 'rejected', code: 'SCRIPT_DOWNLOAD_FAILED' });
	} finally {
		fs.rmSync(cacheDirectory, { recursive: true, force: true });
	}
});

test('disabling a script after lease approval revokes its lease before execution dispatch', () => {
	let enabled = true;
	let dispatches = 0;
	const executionService = new ControlledInjectionService({
		now: () => 10_000,
		createLeaseId: () => 'lease_disabled_execution',
		resolveSession: (sessionId) => (sessionId === session.sessionId ? session : undefined),
		getGuestUrl: () => 'https://i.chaoxing.com/course/1',
		resolveCandidates: (url) => enabled ? [createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source }, url)] : [],
		resolveExecutionSource: (url, scriptId) => {
			dispatches += 1;
			return enabled && scriptId === 7 ? { source, candidate: createTrustedScriptCandidate({ id: 7, path: 'C:/scripts/safe.user.js', source }, url) } : undefined;
		}
	});
	const candidates = executionService.listCandidates({ sessionId: session.sessionId, navigationEpoch: 3 });
	assert.equal(candidates.kind, 'candidates');
	const approved = executionService.requestLease({ sessionId: session.sessionId, navigationEpoch: 3, url: 'https://i.chaoxing.com/course/1', ...candidates.candidates[0] });
	assert.equal(approved.kind, 'approved');
	enabled = false;
	assert.deepEqual(executionService.consumeLeaseForExecution(approved.lease.leaseId), { kind: 'rejected', code: 'SCRIPT_SOURCE_UNTRUSTED' });
	assert.deepEqual(executionService.consumeLeaseForExecution(approved.lease.leaseId), { kind: 'rejected', code: 'SCRIPT_SOURCE_UNTRUSTED' });
	assert.equal(dispatches, 1);
});

test('fixed executor IPC accepts only leaseId, validates sender, consumes before dispatch, and uses the matching guest URL guard', () => {
	const source = fs.readFileSync(path.resolve(__dirname, '../src/window.ts'), 'utf8');

	assert.match(source, /const INJECTION_EXECUTE_CHANNEL = 'ocs-plus-injection:execute'/);
	assert.match(source, /ipcMain\.handle\(INJECTION_EXECUTE_CHANNEL, async \(event, request: \{ leaseId\?: unknown \}\) =>/);
	assert.match(source, /event\.sender\.id !== win\.webContents\.id \|\| typeof request\?\.leaseId !== 'string' \|\| Object\.keys\(request\)\.length !== 1/);
	assert.match(source, /controlledInjection\.consumeLeaseForExecution\(request\.leaseId\)/);
	assert.match(source, /guestBySessionId\.get\(committed\.lease\.sessionId\)/);
	assert.match(source, /guest\.executeJavaScript\(createFixedInjectionPayload\(committed\.lease\.url, committed\.source\)\)/);
	assert.match(source, /location\.href !== expectedUrl/);
	assert.match(source, /EXECUTION_GUEST_UNAVAILABLE/);
	assert.match(source, /EXECUTION_URL_GUARD_REJECTED/);
	assert.match(source, /EXECUTION_DISPATCH_REJECTED/);
	assert.doesNotMatch(source, /ipcMain\.handle\([^\n]*executeJavaScript/);
});

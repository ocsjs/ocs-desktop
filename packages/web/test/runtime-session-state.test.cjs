const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const runtimePath = path.resolve(__dirname, '../src/plus/runtime/status.ts');
const eventsPath = path.resolve(__dirname, '../src/plus/runtime/events.ts');
const panelPath = path.resolve(__dirname, '../src/plus/components/OcsControlPanel.vue');

function read(filePath) {
	return fs.readFileSync(filePath, 'utf8');
}

test('runtime state has a session-scoped store with selection, epoch rejection, and aggregate summary', () => {
	const source = read(runtimePath);

	assert.match(source, /export class OcsRuntimeSessionStore/);
	assert.match(source, /applyEvent\(/);
	assert.match(source, /navigationEpoch/);
	assert.match(source, /selectedSessionId/);
	assert.match(source, /getAggregateSummary\(/);
});

test('runtime events require session identity, navigation epoch, and occurrence time', () => {
	const source = read(eventsPath);

	assert.match(source, /sessionId: string/);
	assert.match(source, /navigationEpoch: number/);
	assert.match(source, /occurredAt: number/);
	assert.doesNotMatch(source, /createdAt:/);
});

test('runtime session closure is an explicit lifecycle event that removes only the closed session', () => {
	const events = read(eventsPath);
	const status = read(runtimePath);
	const panel = read(panelPath);

	assert.match(events, /'session-closed'/);
	assert.match(status, /remove\(sessionId: string\)/);
	assert.match(panel, /event\.type === 'session-closed'/);
	assert.match(panel, /sessionStore\.remove\(event\.sessionId\)/);
});

test('control panel renders only the selected session while summarizing other sessions', () => {
	const source = read(panelPath);

	assert.match(source, /selectedSessionStatus/);
	assert.match(source, /其他会话/);
	assert.match(source, /sessionStore/);
	assert.doesNotMatch(source, /emitOcsRuntimeEvent\(/);
});

test('control panel requests leases with the complete trusted snapshot, hydrates selected-session audit, and removes its listener', () => {
	const source = read(panelPath);

	assert.match(source, /contentHash: candidate\.contentHash,\s*match: candidate\.match/);
	assert.doesNotMatch(source, /script(?:Source|Content|Code|Text)\s*:/);
	assert.match(source, /electron\.ipcRenderer\.invoke\('ocs-plus-injection:audit', sessionId\)/);
	assert.match(source, /const handleInjectionAudit\s*=/);
	assert.match(source, /facts\.every\(\(fact\) => fact\.sessionId === selectedSessionId\.value\)/);
	assert.match(source, /electron\.ipcRenderer\.on\('ocs-plus-injection:audit', handleInjectionAudit\)/);
	assert.match(source, /onBeforeUnmount\(\(\) => \{[\s\S]*?electron\.ipcRenderer\.removeListener\('ocs-plus-injection:audit', handleInjectionAudit\);[\s\S]*?\}\)/);
});

test('control panel sends only a lease ID to the fixed execution IPC and never directly executes guest JavaScript', () => {
	const source = read(panelPath);

	assert.match(source, /ocs-plus-injection:execute/);
	assert.match(source, /invoke\('ocs-plus-injection:execute', \{ leaseId: result\.lease\.leaseId \}\)/);
	assert.doesNotMatch(source, /executeJavaScript/);
	assert.doesNotMatch(source, /script(?:Source|Content|Code|Text)\s*:/);
});

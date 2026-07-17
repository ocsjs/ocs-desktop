const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const statusPath = path.resolve(__dirname, '../src/plus/runtime/status.ts');

function loadStatusModule() {
	const source = fs.readFileSync(statusPath, 'utf8');
	const output = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
	}).outputText;
	const module = { exports: {} };
	new Function('exports', 'module', output)(module.exports, module);
	return module.exports;
}

test('session runtime store isolates sessions and rejects stale navigation epochs', () => {
	const { OcsRuntimeSessionStore } = loadStatusModule();
	const store = new OcsRuntimeSessionStore();

	assert.equal(store.applyEvent({ sessionId: 'course-a', navigationEpoch: 1, occurredAt: 100, type: 'page-loaded' }, {
		page: { url: 'https://course-a.example', title: 'A', loading: false }
	}), true);
	assert.equal(store.applyEvent({ sessionId: 'course-b', navigationEpoch: 1, occurredAt: 110, type: 'page-load-failed' }, {
		flow: { phase: 'error' }, error: { code: 'B_FAILED', message: 'B only', recoverable: false }
	}), true);
	assert.equal(store.applyEvent({ sessionId: 'course-a', navigationEpoch: 0, occurredAt: 120, type: 'page-loaded' }, {
		page: { title: 'stale' }
	}), false);

	assert.equal(store.getSelected().sessionId, 'course-a');
	assert.equal(store.getSelected().status.page.title, 'A');
	assert.equal(store.select('course-b'), true);
	assert.equal(store.getSelected().status.error.code, 'B_FAILED');
	assert.deepEqual(store.getAggregateSummary(), { total: 2, otherCount: 1, seriousAlertCount: 0 });
	assert.equal(store.select('course-a'), true);
	assert.deepEqual(store.getAggregateSummary(), { total: 2, otherCount: 1, seriousAlertCount: 1 });
});

test('closing one session removes its runtime state without changing another session', () => {
	const { OcsRuntimeSessionStore } = loadStatusModule();
	const store = new OcsRuntimeSessionStore();

	store.applyEvent({ sessionId: 'course-a', navigationEpoch: 2, occurredAt: 100, type: 'page-loaded' }, {
		page: { title: 'A', loading: false }
	});
	store.applyEvent({ sessionId: 'course-b', navigationEpoch: 3, occurredAt: 110, type: 'page-loaded' }, {
		page: { title: 'B', loading: false }
	});
	store.select('course-a');

	assert.equal(store.remove('course-a'), true);
	assert.equal(store.getSelected(), undefined);
	assert.deepEqual(store.getSessions().map((session) => session.sessionId), ['course-b']);
	assert.equal(store.getSessions()[0].status.page.title, 'B');
	assert.equal(store.remove('course-a'), false);
});

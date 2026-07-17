const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const componentPath = path.resolve(__dirname, '../src/plus/components/EmbeddedCourseBrowser.vue');
const readComponent = () => fs.readFileSync(componentPath, 'utf8');

test('browser view remains isolated and registry-backed', () => {
	const source = readComponent();
	assert.match(source, /ocs-plus-course-session:create/);
	assert.match(source, /ocs-plus-course-session:close/);
	assert.match(source, /ocs-plus-course-session:navigate/);
	assert.match(source, /ocs-plus-course-session:activate/);
	assert.doesNotMatch(source, /executeJavaScript|new Function|injectEnabledScripts/);
	assert.match(source, /ocs-plus-scripts:snapshot/);
});

test('browser accepts arbitrary HTTP(S) URLs without a hostname allowlist', () => {
	const source = readComponent();
	assert.match(source, /function validateWebUrl\(/);
	assert.match(source, /url\.protocol === 'http:' \|\| url\.protocol === 'https:'/);
	assert.doesNotMatch(source, /baselineCourseHosts|validateBaselineCourseUrl|地址已阻止/);
	assert.match(source, /Message\.error\(result\.message\)/);
});

test('main-process navigation updates the address and does not render a blocked state', () => {
	const source = readComponent();
	assert.match(source, /function handleCoursePage\(.*?const result = validateWebUrl\(patch\.url\).*?updateSession\(patch\.sessionId, \{ url: result\.url/s);
	assert.match(source, /type ViewerLifecycle = 'idle' \| 'validating' \| 'loading' \| 'loaded' \| 'failed';/);
	assert.match(source, /snapshot\.state === 'failed' \|\| snapshot\.state === 'blocked' \? 'failed' : 'loading'/);
});

test('browser sends native view controls through the main process', () => {
	const source = readComponent();
	assert.match(source, /function commandGuest\(command: 'back' \| 'forward' \| 'reload'\)/);
	assert.match(source, /ocs-plus-course-session:command/);
	assert.doesNotMatch(source, /<webview/);
});

test('browser layout keeps controls and guest viewport responsive', () => {
	const source = readComponent();
	assert.match(source, /grid-template-rows:42px 38px 54px minmax\(0, 1fr\) 48px/);
	assert.match(source, /@media \(max-width:1280px\)/);
	assert.match(source, /grid-template-rows:34px 44px 54px minmax\(0,1fr\) 42px/);
	assert.doesNotMatch(source, /\.script-dock \{ display:none; \}/);
	assert.match(source, /class="course-view-host"/);
	assert.match(source, /\.course-view-host \{ position:absolute; inset:0; \}/);
	assert.match(source, /function refreshScriptSnapshot\(\).*?ocs-plus-scripts:snapshot/s);
	assert.match(source, /ref="webviewHost"/);
	assert.match(source, /new ResizeObserver\(scheduleCourseView\)/);
	assert.match(source, /getBoundingClientRect\(\)/);
	assert.match(source, /ocs-plus-course-session:activate/);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Plus reads the installed-script count through its own main-process snapshot IPC', () => {
	const main = read('../app/src/window.ts');
	const browser = read('src/plus/components/EmbeddedCourseBrowser.vue');
	const panel = read('src/plus/components/OcsControlPanel.vue');

	assert.match(main, /const PLUS_SCRIPT_SNAPSHOT_CHANNEL = 'ocs-plus-scripts:snapshot';/);
	assert.match(main, /ipcMain\.handle\(PLUS_SCRIPT_SNAPSHOT_CHANNEL.*?getDecryptedRenderData\(\)\?\.scripts/s);
	assert.match(browser, /ipcRenderer\.invoke\('ocs-plus-scripts:snapshot'\)/);
	assert.match(panel, /ipcRenderer\.invoke\('ocs-plus-scripts:snapshot'\)/);
	assert.match(panel, /onMounted\(\(\) => \{ void refreshScriptSnapshot\(\); \}\);/);
	assert.match(panel, /const canRetryInject = computed\(\(\) => injectionCandidates\.value\.length > 0\);/);
	assert.match(panel, /ocs-plus-injection:cache/);
	assert.match(panel, /type: 'script-config-updated'/);
	assert.match(panel, /sessionStore\.applyEvent\(/);
});

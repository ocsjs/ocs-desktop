const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('desktop renderer initializes script state from the main-process render snapshot', () => {
	const storeSource = fs.readFileSync(path.resolve(__dirname, '../src/store/index.ts'), 'utf8');
	const remoteSource = fs.readFileSync(path.resolve(__dirname, '../../app/src/tasks/remote.register.ts'), 'utf8');

	assert.match(storeSource, /remote\.methods\.callSync\('getRenderStoreSnapshot'\)/);
	assert.doesNotMatch(storeSource, /remote\['electron-store'\]\.get\('store'\)/);
	assert.match(remoteSource, /getRenderStoreSnapshot: \(\) => getDecryptedRenderData\(\)/);
});

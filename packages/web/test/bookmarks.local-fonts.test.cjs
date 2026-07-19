const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('bookmarks uses local system fonts and does not request Google Fonts under the app CSP', () => {
	const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/bookmarks.vue'), 'utf8');

	assert.doesNotMatch(source, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
	assert.match(source, /font-family: system-ui, -apple-system, 'Segoe UI', sans-serif/);
});

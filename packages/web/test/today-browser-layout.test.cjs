const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const today = fs.readFileSync(path.resolve(__dirname, '../src/plus/pages/Today.vue'), 'utf8');
const browser = fs.readFileSync(path.resolve(__dirname, '../src/plus/components/EmbeddedCourseBrowser.vue'), 'utf8');

test('Today gives the browser a bounded full-height workspace row on wide screens', () => {
	assert.match(today, /\.today-page \{[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/);
	assert.match(today, /\.workspace-grid \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\);[\s\S]*?flex: 1 1 0;[\s\S]*?overflow: hidden;/);
	assert.match(today, /\.task-strip \{[\s\S]*?flex: 0 0 auto;/);
	assert.match(browser, /\.embedded-course-browser \{ min-width:0; min-height:0; height:100%; box-sizing:border-box; overflow:hidden;/);
});

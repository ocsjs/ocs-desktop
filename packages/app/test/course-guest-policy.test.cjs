const assert = require('node:assert/strict');
const test = require('node:test');

const {
	COURSE_GUEST_MARKER,
	COURSE_GUEST_PARTITION,
	CourseUrlPolicy,
	isKnownCourseGuest
} = require('../lib/src/course-guest-policy.js');

test('课程 URL policy 允许任意 HTTP(S) 网页，不保留域名白名单', () => {
	const policy = new CourseUrlPolicy();

	assert.deepEqual(policy.evaluate('https://i.chaoxing.com/mycourse'), { allowed: true });
	assert.deepEqual(policy.evaluate('https://example.com/redirect'), { allowed: true });
	assert.deepEqual(policy.evaluate('http://intranet.example.test/'), { allowed: true });
	assert.doesNotMatch(require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/course-guest-policy.ts'), 'utf8'), /const baselineCourseHosts|sessionApprovedHosts/);
});

test('课程 URL policy 拒绝凭据、危险协议和不可解析 URL', () => {
	const policy = new CourseUrlPolicy();

	assert.equal(policy.evaluate('https://user:password@i.chaoxing.com/').reason, 'embedded-credentials');
	assert.equal(policy.evaluate('javascript:alert(1)').reason, 'unsupported-protocol');
	assert.equal(policy.evaluate('not a URL').reason, 'invalid-url');
});

test('只接受带课程 guest 标识和固定 partition 的附加请求', () => {
	assert.equal(isKnownCourseGuest({ [COURSE_GUEST_MARKER]: 'true', partition: COURSE_GUEST_PARTITION }), true);
	assert.equal(isKnownCourseGuest({ [COURSE_GUEST_MARKER]: 'true', partition: 'persist:other' }), false);
	assert.equal(isKnownCourseGuest({ partition: COURSE_GUEST_PARTITION }), false);
});

test('D017-3 将 guest 授权收敛到主进程 registry 的独立 partition 和 loading epoch 校验', () => {
	const windowSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/window.ts'), 'utf8');

	assert.match(windowSource, /CourseSessionRegistry/);
	assert.match(windowSource, /CourseGuestAttachmentRegistry/);
	assert.match(windowSource, /findExpectedGuestByPartition\(params\.partition\)/);
	assert.match(require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/course-session-registry.ts'), 'utf8'), /findExpectedGuestByPartition/);
	assert.match(windowSource, /event\.sender\.id !== win\.webContents\.id/);
	assert.match(windowSource, /courseGuestAttachments\.reserve\(course, 'true', courseGuestSession\)/);
	assert.match(windowSource, /courseGuestAttachments\.consume\(guestWebContents\.session\)/);
	assert.doesNotMatch(windowSource, /pendingCourseAttachments/);
	assert.match(windowSource, /nodeIntegration = false/);
	assert.match(windowSource, /contextIsolation = true/);
	assert.match(windowSource, /sandbox = true/);
	assert.match(windowSource, /webSecurity = true/);
	assert.match(windowSource, /devTools = false/);
});

test('D017-6a records fixed lifecycle terminal facts for guest rejection, blocked navigation, main-frame failure, and timeout', () => {
	const windowSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/window.ts'), 'utf8');

	assert.match(windowSource, /const COURSE_LOAD_TIMEOUT_MS = 30_000/);
	assert.match(windowSource, /COURSE_GUEST_ATTACH_REJECTED/);
	assert.match(windowSource, /COURSE_GUEST_ATTACH_TIMEOUT/);
	assert.match(windowSource, /const COURSE_GUEST_ATTACH_TIMEOUT_MS = 5_000/);
	assert.match(windowSource, /ocs-plus-course-session:expect-guest/);
	assert.match(windowSource, /COURSE_NAVIGATION_BLOCKED/);
	assert.match(windowSource, /COURSE_MAIN_FRAME_LOAD_FAILED/);
	assert.match(windowSource, /COURSE_LOAD_TIMEOUT/);
	assert.match(windowSource, /courseGuestAttachments\.reserve\(course, 'true', courseGuestSession\);[\s\S]*?catch \{\s*markCourseTerminal\(win, course\.sessionId, course\.navigationEpoch, 'blocked', 'COURSE_GUEST_ATTACH_REJECTED'\);/);
	assert.match(windowSource, /guestWebContents\.on\('did-fail-load'/);
	assert.match(windowSource, /console\.info\('\[ocs-plus-course\] guest-attached'/);
	assert.match(windowSource, /setTimeout\(\(\) => markCourseTerminal/);
	assert.match(windowSource, /console\.warn\('\[ocs-plus-course\]'/);
	assert.match(windowSource, /nodeIntegration = false/);
	assert.match(windowSource, /devTools = false/);
});

test('Electron guest bootstrap keeps about:blank outside protocol rejection', () => {
	const windowSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/window.ts'), 'utf8');

	assert.match(windowSource, /function shouldBlockCourseTopLevelNavigation\(url: string\) \{\s*return url !== 'about:blank' && !courseUrlPolicy\.evaluate\(url\)\.allowed;/);
	assert.match(windowSource, /cancel: isMainFrameNavigation && shouldBlockCourseTopLevelNavigation\(details\.url\)/);
	assert.match(windowSource, /if \(shouldBlockCourseTopLevelNavigation\(url\)\)/);
});

test('course popups permit arbitrary web origins without a count limit while remaining sandboxed', () => {
	const windowSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/window.ts'), 'utf8');

	assert.doesNotMatch(windowSource, /COURSE_POPUP_LIMIT_PER_SESSION/);
	assert.match(windowSource, /url !== 'about:blank' && shouldBlockCourseTopLevelNavigation\(url\)/);
	assert.match(windowSource, /partition: course\.partition/);
	assert.match(windowSource, /nodeIntegration: false/);
	assert.match(windowSource, /contextIsolation: true/);
	assert.match(windowSource, /sandbox: true/);
	assert.match(windowSource, /allowRunningInsecureContent: false/);
	assert.match(windowSource, /webviewTag: false/);
	assert.match(windowSource, /popup\.webContents,[\s\S]*?if \(!popup\.isDestroyed\(\)\) popup\.close\(\);/);
	assert.match(windowSource, /closeCoursePopups\(course\.sessionId\)/);
});

test('D017-9 scales only the isolated course guest so provider login dialogs fit the viewport', () => {
	const windowSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/window.ts'), 'utf8');

	assert.match(windowSource, /const COURSE_GUEST_ZOOM_FACTOR = 0\.8/);
	assert.match(windowSource, /guestWebContents\.setZoomFactor\(COURSE_GUEST_ZOOM_FACTOR\);/);
	assert.match(windowSource, /guestWebContents\.on\('did-stop-loading', \(\) => \{\s*guestWebContents\.setZoomFactor\(COURSE_GUEST_ZOOM_FACTOR\);/);
	assert.match(windowSource, /zoomFactor: 1/);
});

const assert = require('node:assert/strict');
const test = require('node:test');

const { CourseGuestAttachmentRegistry } = require('../lib/src/course-guest-attachment-registry.js');

function course(sessionId, partition) {
	return { sessionId, partition, navigationEpoch: 0, state: 'created' };
}

test('并发 guest 可按各自浏览器拥有的 Session key 乱序精确绑定，绝不依赖 FIFO', () => {
	const bindings = new CourseGuestAttachmentRegistry();
	const first = course('course_first', 'persist:ocs-plus-course-v1-course_first');
	const second = course('course_second', 'persist:ocs-plus-course-v1-course_second');
	const firstSession = {};
	const secondSession = {};
	const firstBinding = bindings.reserve(first, 'true', firstSession);
	const secondBinding = bindings.reserve(second, 'true', secondSession);

	assert.notEqual(firstBinding.attachId, secondBinding.attachId);
	assert.equal(bindings.consume(secondSession).sessionId, second.sessionId);
	assert.equal(bindings.consume(firstSession).sessionId, first.sessionId);
});

test('attach binding 只能消费一次，并保留经审核的 marker、sessionId 和 partition', () => {
	const bindings = new CourseGuestAttachmentRegistry();
	const approved = course('course_approved', 'persist:ocs-plus-course-v1-course_approved');
	const browserOwnedSession = {};
	const binding = bindings.reserve(approved, 'true', browserOwnedSession);

	assert.deepEqual(bindings.consume(browserOwnedSession), {
		attachId: binding.attachId,
		marker: 'true',
		sessionId: approved.sessionId,
		partition: approved.partition
	});
	assert.equal(bindings.consume(browserOwnedSession), undefined);
});

test('关闭或重复 reserve 会撤销尚未附加的绑定，避免关闭会话被稍后附加', () => {
	const bindings = new CourseGuestAttachmentRegistry();
	const approved = course('course_closed', 'persist:ocs-plus-course-v1-course_closed');
	const browserOwnedSession = {};
	bindings.reserve(approved, 'true', browserOwnedSession);

	assert.throws(() => bindings.reserve(approved, 'true', {}), /already reserved/);
	bindings.clearForSession(approved.sessionId);
	assert.equal(bindings.consume(browserOwnedSession), undefined);
});

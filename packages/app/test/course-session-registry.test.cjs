const assert = require('node:assert/strict');
const test = require('node:test');

const { CourseSessionRegistry } = require('../lib/src/course-session-registry.js');
const { CourseGuestAttachmentRegistry } = require('../lib/src/course-guest-attachment-registry.js');

test('创建的课程会话使用不可预测的独立 ID 和 partition', () => {
	const registry = new CourseSessionRegistry();
	const first = registry.create();
	const second = registry.create();

	assert.match(first.sessionId, /^course_[a-f0-9]{64}$/);
	assert.match(first.partition, /^persist:ocs-plus-course-v1-course_[a-f0-9]{64}$/);
	assert.notEqual(first.sessionId, second.sessionId);
	assert.notEqual(first.partition, second.partition);
	assert.deepEqual(first, {
		sessionId: first.sessionId,
		partition: first.partition,
		navigationEpoch: 0,
		state: 'created'
	});
});

test('加载只接受当前 navigation epoch，过期完成事件不会覆盖新导航', () => {
	const registry = new CourseSessionRegistry();
	const created = registry.create();
	const firstNavigation = registry.beginNavigation(created.sessionId);
	const secondNavigation = registry.beginNavigation(created.sessionId);

	assert.equal(firstNavigation.navigationEpoch, 1);
	assert.equal(secondNavigation.navigationEpoch, 2);
	assert.equal(registry.markLoaded(created.sessionId, firstNavigation.navigationEpoch), false);
	assert.equal(registry.markLoaded(created.sessionId, secondNavigation.navigationEpoch), true);
	assert.deepEqual(registry.get(created.sessionId), {
		...created,
		navigationEpoch: secondNavigation.navigationEpoch,
		state: 'loaded'
	});
});

test('guest 附加查询只认可精确的活动 sessionId 和 partition', () => {
	const registry = new CourseSessionRegistry();
	const created = registry.create();

	assert.deepEqual(registry.findActiveGuest({ sessionId: created.sessionId, partition: created.partition }), created);
	assert.equal(registry.findActiveGuest({ sessionId: created.sessionId, partition: 'persist:attacker' }), undefined);
	assert.equal(registry.findActiveGuest({ sessionId: 'course_attacker', partition: created.partition }), undefined);

	registry.close(created.sessionId);
	assert.equal(registry.findActiveGuest({ sessionId: created.sessionId, partition: created.partition }), undefined);
	assert.equal(registry.beginNavigation(created.sessionId), undefined);
});

test('guest 附加仅接受主进程已开始加载的独立 partition，不依赖 renderer data-* 属性', () => {
	const registry = new CourseSessionRegistry();
	const first = registry.create();
	const second = registry.create();

	assert.equal(registry.findExpectedGuestByPartition(first.partition), undefined);
	const navigation = registry.beginNavigation(first.sessionId);
	assert.deepEqual(registry.findExpectedGuestByPartition(first.partition), {
		...first,
		navigationEpoch: navigation.navigationEpoch,
		state: 'loading'
	});
	assert.equal(registry.findExpectedGuestByPartition(second.partition), undefined);
	assert.equal(registry.findExpectedGuestByPartition('persist:attacker'), undefined);
});

test('关闭会立即失效并且每个会话只执行一次清理', () => {
	const cleaned = [];
	const registry = new CourseSessionRegistry({
		onClose: (session) => cleaned.push(session.sessionId)
	});
	const created = registry.create();

	assert.equal(registry.close(created.sessionId), true);
	assert.equal(registry.close(created.sessionId), false);
	assert.deepEqual(cleaned, [created.sessionId]);
	assert.deepEqual(registry.get(created.sessionId), {
		...created,
		navigationEpoch: 1,
		state: 'closed'
	});
});

test('主进程可将附加、导航、主框架失败或超时以固定终态回传，后续导航会清除旧失败', () => {
	const registry = new CourseSessionRegistry();
	const created = registry.create();

	assert.equal(registry.markTerminal(created.sessionId, created.navigationEpoch, 'blocked', 'COURSE_GUEST_ATTACH_REJECTED'), true);
	assert.deepEqual(registry.get(created.sessionId), {
		...created,
		state: 'blocked',
		failureCode: 'COURSE_GUEST_ATTACH_REJECTED'
	});
	const navigation = registry.beginNavigation(created.sessionId);
	assert.equal(navigation.navigationEpoch, 1);
	assert.deepEqual(registry.get(created.sessionId), { ...created, navigationEpoch: 1, state: 'loading' });
	assert.equal(registry.markTerminal(created.sessionId, navigation.navigationEpoch, 'failed', 'COURSE_LOAD_TIMEOUT'), true);
	assert.equal(registry.markTerminal(created.sessionId, navigation.navigationEpoch, 'failed', 'COURSE_MAIN_FRAME_LOAD_FAILED'), false);
});

test('guest reserve 冲突会转换为 renderer 可消费的 blocked 固定终态，而非保留 loading', () => {
	const registry = new CourseSessionRegistry();
	const created = registry.create();
	const attachments = new CourseGuestAttachmentRegistry();
	attachments.reserve(created, 'true', {});
	assert.throws(() => attachments.reserve(created, 'true', {}), /already reserved/);
	assert.equal(registry.markTerminal(created.sessionId, created.navigationEpoch, 'blocked', 'COURSE_GUEST_ATTACH_REJECTED'), true);
	assert.deepEqual(registry.get(created.sessionId), {
		...created,
		state: 'blocked',
		failureCode: 'COURSE_GUEST_ATTACH_REJECTED'
	});
});

test('未附加 guest 的会话可由主进程以固定 attach-timeout 终态结束', () => {
	const registry = new CourseSessionRegistry();
	const created = registry.create();
	const navigation = registry.beginNavigation(created.sessionId);
	assert.equal(registry.markTerminal(created.sessionId, navigation.navigationEpoch, 'failed', 'COURSE_GUEST_ATTACH_TIMEOUT'), true);
	assert.deepEqual(registry.get(created.sessionId), {
		...created,
		navigationEpoch: navigation.navigationEpoch,
		state: 'failed',
		failureCode: 'COURSE_GUEST_ATTACH_TIMEOUT'
	});
});

/**
 * Cookie 快照存储（主进程内存）：uid → Cookie 快照（用于会话状态保持）。
 *
 * 命名说明：本模块只是普通的内存快照存放地，安全属性完全来自「不落盘 + 不出主进程」
 * 两条边界，容器本身无任何加密/访问控制——刻意不使用"快照存储（Vault）"等暗示防护强度的词。
 *
 * 硬性安全约束（见 .codebuddy/plans/session-keepalive-cookie-store-plan.md）：
 * - 永不落盘：仅存主进程内存，进程退出即蒸发；
 * - 无读取型远程方法：对渲染层只暴露 clearCookieStore（经 methods），凭证不出主进程；
 * - 日志严禁打印 Cookie name/value，只允许 uid + 数量。
 */
import type { Cookie } from 'playwright-core';
import { Logger } from '../logger';

const logger = Logger('cookie-store');

/** uid → 最近一次 Cookie 全量快照 */
const snapshotStore = new Map<string, Cookie[]>();

/** 防御上限：单 uid Cookie 条数 / 单条 value 长度（入参来自 IPC，按不可信数据处理） */
const MAX_COOKIES_PER_UID = 500;
const MAX_VALUE_LENGTH = 8 * 1024;

/** 写入（全量替换语义：快照即当前完整状态，不做增量合并） */
export function setSessionCookies(uid: string, raw: unknown): void {
	if (!Array.isArray(raw)) return;
	const cookies = raw
		.slice(0, MAX_COOKIES_PER_UID)
		.filter(
			(c): c is Cookie =>
				!!c &&
				typeof c.name === 'string' &&
				typeof c.value === 'string' &&
				typeof c.domain === 'string' &&
				c.value.length <= MAX_VALUE_LENGTH
		);
	snapshotStore.set(uid, cookies);
	logger.info('Cookie 快照已更新', { uid, count: cookies.length });
}

/** 读取（仅限主进程内部：worker launch 下发用） */
export function getSessionCookies(uid: string): Cookie[] | undefined {
	return snapshotStore.get(uid);
}

/** 清除：清缓存/删浏览器/关开关时调用；不传 uid 清空全部 */
export function clearCookieStore(uid?: string): void {
	if (uid === undefined) snapshotStore.clear();
	else snapshotStore.delete(uid);
	logger.info('Cookie 快照存储已清除', { uid: uid ?? '(全部)' });
}

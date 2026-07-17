export const COURSE_GUEST_PARTITION = 'persist:ocs-plus-course-v1';
export const COURSE_GUEST_MARKER = 'data-ocs-plus-course';

export type CourseUrlBlockReason = 'invalid-url' | 'unsupported-protocol' | 'embedded-credentials';
export type CourseUrlPolicyResult = { allowed: true } | { allowed: false; reason: CourseUrlBlockReason };

/**
 * 课程 guest 的唯一 URL 判定点。
 *
 * 非基线登录/跳转 host 必须在 UI 获得用户当次会话确认后调用
 * approveForCurrentSession；该许可不写入磁盘，也不会扩大为通配域名。
 */
export class CourseUrlPolicy {
	evaluate(value: string): CourseUrlPolicyResult {
		const parsed = this.parseSecureUrl(value);
		if ('reason' in parsed) return parsed;
		return { allowed: true };
	}

	private parseSecureUrl(value: string): URL | { allowed: false; reason: CourseUrlBlockReason } {
		let parsed: URL;
		try {
			parsed = new URL(value);
		} catch {
			return { allowed: false, reason: 'invalid-url' };
		}

		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { allowed: false, reason: 'unsupported-protocol' };
		if (parsed.username || parsed.password) return { allowed: false, reason: 'embedded-credentials' };
		return parsed;
	}
}

/** 仅接受由 D016-2 受限查看器创建的 guest 标识和固定 session。 */
export function isKnownCourseGuest(params: Record<string, string>) {
	return params[COURSE_GUEST_MARKER] === 'true' && params.partition === COURSE_GUEST_PARTITION;
}

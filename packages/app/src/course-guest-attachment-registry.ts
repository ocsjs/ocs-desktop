import { randomBytes } from 'crypto';
import type { CourseSessionSnapshot } from './course-session-registry';

export interface CourseGuestAttachment {
	attachId: string;
	marker: 'true';
	sessionId: string;
	partition: string;
}

const ATTACH_ID_BYTES = 32;
const ATTACH_ID_PREFIX = 'attach_';

/**
 * Binds an accepted `will-attach-webview` request to its later `did-attach-webview` event.
 *
 * Electron exposes the actual Session instance on the attached guest but not the original
 * webview params. Every course has a registry-owned unique partition, so the Session object
 * is an exact, browser-owned binding key. This avoids FIFO ordering entirely: concurrent
 * attaches may complete in any order and each can only claim its own Session binding.
 */
export class CourseGuestAttachmentRegistry {
	private readonly byKey = new Map<unknown, CourseGuestAttachment>();
	private readonly keyBySessionId = new Map<string, unknown>();

	reserve(course: CourseSessionSnapshot, marker: 'true', key: unknown): CourseGuestAttachment {
		if (this.keyBySessionId.has(course.sessionId) || this.byKey.has(key)) {
			throw new Error(`course guest is already reserved: ${course.sessionId}`);
		}

		const attachment: CourseGuestAttachment = {
			attachId: this.createAttachId(),
			marker,
			sessionId: course.sessionId,
			partition: course.partition
		};
		this.byKey.set(key, attachment);
		this.keyBySessionId.set(attachment.sessionId, key);
		return { ...attachment };
	}

	consume(key: unknown): CourseGuestAttachment | undefined {
		const attachment = this.byKey.get(key);
		if (!attachment) return undefined;

		this.byKey.delete(key);
		this.keyBySessionId.delete(attachment.sessionId);
		return { ...attachment };
	}

	clearForSession(sessionId: string) {
		const key = this.keyBySessionId.get(sessionId);
		if (!key) return;
		this.keyBySessionId.delete(sessionId);
		this.byKey.delete(key);
	}

	private createAttachId(): string {
		let attachId: string;
		do {
			attachId = `${ATTACH_ID_PREFIX}${randomBytes(ATTACH_ID_BYTES).toString('hex')}`;
		} while (Array.from(this.byKey.values()).some((attachment) => attachment.attachId === attachId));
		return attachId;
	}
}

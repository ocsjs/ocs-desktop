import type { StudyCourse, StudyProgress } from '../../store';

const defaultCourseStyle = {
	color: '#2aa7a3',
	icon: 'school'
};

export type StudyPageSnapshot = {
	name: string;
	sourceUrl: string;
	progress?: number;
	completedUnits?: number;
	totalUnits?: number;
	platform?: string;
};

export function normalizeStudyProgress(study: StudyProgress): StudyProgress {
	return {
		...study,
		// 仅接受由页面同步产生的来源地址，避免历史演示课程被当作真实进度展示。
		courses: study.courses.filter(hasStudyPageSource).map(normalizeStudyCourse),
		totalStudyMinutes: Math.max(0, Math.round(study.totalStudyMinutes || 0)),
		todayStudyMinutes: Math.max(0, Math.round(study.todayStudyMinutes || 0)),
		dailyTargetMinutes: Math.max(0, Math.round(study.dailyTargetMinutes || 0)),
		lastSyncedAt: study.lastSyncedAt
	};
}

export function createStudySnapshot(study: StudyProgress) {
	const normalizedCourses = study.courses.filter(hasStudyPageSource).map(normalizeStudyCourse);
	const totalUnits = normalizedCourses.reduce((total, course) => total + course.totalUnits, 0);
	const completedUnits = normalizedCourses.reduce((total, course) => total + Math.min(course.completedUnits, course.totalUnits), 0);
	const weightedProgress = normalizedCourses.reduce((total, course) => total + course.progress * course.totalUnits, 0);
	const overallProgress = totalUnits ? Math.round(weightedProgress / totalUnits) : 0;
	const hasRealCourses = normalizedCourses.length > 0;

	return {
		courses: normalizedCourses,
		overallProgress,
		hasRealCourses,
		moduleStats: [
			{ label: '已同步进度', value: hasRealCourses ? `${completedUnits}/${totalUnits}` : '暂无真实数据' },
			{ label: '已学时长', value: '暂未接入' },
			{ label: '今日学习', value: '暂未接入' }
		]
	};
}

export function mergeStudyPageSnapshot(study: StudyProgress, page: StudyPageSnapshot): StudyProgress {
	const normalized = normalizeStudyProgress(study);
	const name = page.name?.trim();
	const sourceUrl = page.sourceUrl?.trim();

	if (!name || !sourceUrl || typeof page.progress !== 'number') {
		return normalized;
	}

	const progress = clampProgress(page.progress);
	const matchedIndex = normalized.courses.findIndex((course) => {
		if (course.sourceUrl && course.sourceUrl === sourceUrl) return true;
		return course.name === name;
	});
	const existing = matchedIndex >= 0 ? normalized.courses[matchedIndex] : undefined;
	const totalUnits = Math.max(1, Math.round(page.totalUnits || existing?.totalUnits || 1));
	const completedUnits = Math.min(
		totalUnits,
		Math.max(0, Math.round(page.completedUnits ?? existing?.completedUnits ?? Math.round((progress / 100) * totalUnits)))
	);
	const nextCourse: StudyCourse = normalizeStudyCourse({
		id: existing?.id || createCourseId(name, sourceUrl),
		name,
		progress,
		color: existing?.color || defaultCourseStyle.color,
		icon: existing?.icon || defaultCourseStyle.icon,
		completedUnits,
		totalUnits,
		sourceUrl,
		platform: page.platform || existing?.platform,
		updatedAt: Date.now()
	});

	const courses =
		matchedIndex >= 0
			? normalized.courses.map((course, index) => (index === matchedIndex ? nextCourse : course))
			: [nextCourse, ...normalized.courses];

	return {
		...normalized,
		courses,
		lastSyncedAt: Date.now()
	};
}

function normalizeStudyCourse(course: StudyCourse): StudyCourse {
	const totalUnits = Math.max(1, Math.round(course.totalUnits || 1));
	const completedUnits = Math.min(totalUnits, Math.max(0, Math.round(course.completedUnits || 0)));

	return {
		...course,
		id: course.id || course.name,
		name: course.name || '未命名课程',
		progress: clampProgress(course.progress),
		color: course.color || defaultCourseStyle.color,
		icon: course.icon || defaultCourseStyle.icon,
		completedUnits,
		totalUnits
	};
}

function hasStudyPageSource(course: StudyCourse) {
	return Boolean(course.sourceUrl?.trim());
}

function createCourseId(name: string, sourceUrl: string) {
	return `${name}-${sourceUrl}`
		.toLowerCase()
		.replace(/https?:\/\//g, '')
		.replace(/[^\w\u4e00-\u9fa5]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function clampProgress(progress: number) {
	return Math.max(0, Math.min(100, Math.round(progress || 0)));
}

/** 仅保留演示组件的空结构；不提供虚构章节或资料数据。 */
export const browserChapters: Array<{ title: string; done?: boolean; active?: boolean }> = [];
export const materials: Array<{ name: string; size: string }> = [];
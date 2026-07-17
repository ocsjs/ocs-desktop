<template>
	<section class="study-overview">
		<div class="overview-header">
			<h2>今日学习</h2>
			<button disabled title="内嵌页面进度嗅探为默认停用的实验能力">同步进度（实验停用）</button>
		</div>
		<div class="sync-strip" :class="{ active: hasSyncedCourse }">
			<PlusIcon :name="hasSyncedCourse ? 'sync' : 'travel_explore'" :size="17" />
			<span>{{ syncStatusText }}</span>
		</div>

		<div class="progress-card">
			<div class="ring" :aria-label="`总体进度 ${overallProgress}%`">
				<svg viewBox="0 0 120 120">
					<circle cx="60" cy="60" r="48" class="track" />
					<circle
						cx="60"
						cy="60"
						r="48"
						class="value"
						:style="{ strokeDashoffset: progressOffset }"
					/>
				</svg>
				<div>
					<strong>{{ overallProgress }}%</strong>
					<span>总体进度</span>
				</div>
			</div>
			<div class="stats">
				<div
					v-for="item in moduleStats"
					:key="item.label"
				>
					<span>{{ item.label }}</span>
					<strong>{{ item.value }}</strong>
				</div>
			</div>
			<a>查看全部课程 <PlusIcon name="chevron_right" :size="16" /></a>
		</div>

		<div class="section-title">
			<h3>我的课程</h3>
			<a>全部 <PlusIcon name="chevron_right" :size="16" /></a>
		</div>

		<div class="course-list">
			<div
				v-if="hasRealCourses"
				v-for="course in courses"
				:key="course.id"
				class="course-card"
				:class="{ synced: course.sourceUrl }"
			>
				<div
					class="course-thumb"
					:style="{ background: course.color }"
				>
					<PlusIcon :name="course.icon" :size="38" />
				</div>
				<div class="course-info">
					<strong>{{ course.name }}</strong>
					<span>进度 {{ course.progress }}% · {{ getCourseMeta(course) }}</span>
					<div class="mini-progress">
						<i :style="{ width: `${course.progress}%`, background: course.color }" />
					</div>
				</div>
			</div>
			<div v-else class="empty-course-state">
				<PlusIcon name="school" :size="28" />
				<div>
					<strong>暂无真实学习数据</strong>
					<span>打开网课页面并同步后，这里仅展示真实页面进度。</span>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PlusIcon from './PlusIcon.vue';
import { store } from '../../store';
import { createStudySnapshot } from '../data/dashboard';

const ringLength = 301.59;
const studySnapshot = computed(() => createStudySnapshot(store.render.study));
const courses = computed(() => studySnapshot.value.courses);
const moduleStats = computed(() => studySnapshot.value.moduleStats);
const overallProgress = computed(() => studySnapshot.value.overallProgress);
const progressOffset = computed(() => ringLength * (1 - overallProgress.value / 100));
const hasRealCourses = computed(() => studySnapshot.value.hasRealCourses);
const hasSyncedCourse = hasRealCourses;
const syncStatusText = computed(() => {
	if (hasSyncedCourse.value) {
		return `已接入 ${courses.value.filter((course) => course.sourceUrl).length} 门真实课程`;
	}
	return '暂无真实学习数据；内嵌页面进度嗅探为默认停用的实验能力';
});


function getCourseMeta(course: { platform?: string; sourceUrl?: string; updatedAt?: number }) {
	if (course.platform) return course.platform;
	return '页面已同步';
}
</script>

<style scoped lang="less">
.study-overview {
	display: flex;
	flex-direction: column;
	min-width: 260px;
	min-height: 0;
}

.overview-header,
.section-title {
	display: flex;
	align-items: center;
	justify-content: space-between;

	h2,
	h3 {
		margin: 0;
		color: #111827;
	}

	h2 {
		font-size: 20px;
		font-weight: 850;
	}

	h3 {
		font-size: 16px;
		font-weight: 800;
	}

	a,
	button {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		border: 0;
		background: transparent;
		color: #119497;
		font-weight: 700;
		font-size: 13px;
	}

	button {
		height: 32px;
		padding: 0 12px;
		border-radius: 8px;
		border: 1px solid #ccece8;
		background: #f0fbf8;
	}
}

.progress-card {
	margin-top: 10px;
	padding: 16px;
	border: 1px solid #e3e9ef;
	border-radius: 8px;
	background: #ffffff;
	box-shadow: 0 12px 28px rgba(24, 48, 74, 0.05);

	a {
		margin-top: 10px;
		display: inline-flex;
		align-items: center;
		color: #14959a;
		font-weight: 700;
		font-size: 13px;
	}
}

.sync-strip {
	min-height: 34px;
	margin-top: 10px;
	padding: 0 12px;
	display: flex;
	align-items: center;
	gap: 8px;
	border: 1px dashed #cdd8e4;
	border-radius: 8px;
	background: #f8fbfc;
	color: #617086;
	font-size: 12px;
	font-weight: 800;

	.plus-icon {
		color: #8390a3;
	}

	&.active {
		border-style: solid;
		border-color: #bfe8df;
		background: #effbf8;
		color: #137f86;

		.plus-icon {
			color: #168f95;
		}
	}
}

.ring {
	display: grid;
	grid-template-columns: 112px 1fr;
	align-items: center;
	gap: 10px;

	svg {
		width: 112px;
		height: 112px;
		transform: rotate(-90deg);
	}

	circle {
		fill: none;
		stroke-width: 10;
		stroke-linecap: round;
	}

	.track {
		stroke: #e6e8eb;
	}

	.value {
		stroke: #2aa7a3;
		stroke-dasharray: 301.59;
		stroke-dashoffset: 114.6;
	}

	div {
		position: absolute;
		width: 112px;
		text-align: center;
	}

	strong {
		display: block;
		font-size: 29px;
		color: #111827;
		line-height: 1;
	}

	span {
		color: #657084;
		font-size: 12px;
	}
}

.stats {
	display: grid;
	gap: 12px;

	div {
		display: flex;
		justify-content: space-between;
		gap: 18px;
	}

	span {
		color: #657084;
		font-size: 13px;
	}

	strong {
		font-size: 14px;
		color: #111827;
	}
}

.section-title {
	margin: 22px 0 12px;
}

.course-list {
	display: grid;
	gap: 10px;
	min-height: 0;
	overflow: hidden;
}

.empty-course-state {
	min-height: 88px;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px;
	border: 1px dashed #cdd8e4;
	border-radius: 8px;
	background: #f8fbfc;
	color: #657084;

	.plus-icon {
		color: #8390a3;
	}

	strong,
	span {
		display: block;
	}

	strong {
		color: #455064;
		font-size: 14px;
	}

	span {
		margin-top: 5px;
		font-size: 12px;
	}
}

.course-card {
	min-height: 88px;
	display: grid;
	grid-template-columns: 88px 1fr;
	gap: 12px;
	padding: 8px;
	align-items: center;
	border: 1px solid #e6ebf1;
	border-radius: 8px;
	background: #ffffff;

	&.synced {
		border-color: #bfe8df;
		background: linear-gradient(90deg, #f5fffc 0%, #ffffff 45%);
	}
}

.course-thumb {
	height: 72px;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: rgba(255, 255, 255, 0.72);
	box-shadow: inset 0 0 36px rgba(255, 255, 255, 0.18);
}

.course-info {
	min-width: 0;

	strong {
		display: block;
		font-size: 14px;
		color: #111827;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	span {
		display: block;
		margin: 10px 0 6px;
		color: #657084;
		font-size: 12px;
	}
}

.mini-progress {
	height: 6px;
	border-radius: 999px;
	background: #e8ebef;
	overflow: hidden;

	i {
		display: block;
		height: 100%;
		border-radius: inherit;
	}
}

@media (max-width: 1280px) {
	.study-overview {
		min-width: 0;
	}

	.overview-header {
		h2 {
			font-size: 18px;
		}

		button {
			height: 30px;
			padding: 0 10px;
			font-size: 12px;
		}
	}

	.progress-card {
		margin-top: 10px;
		padding: 12px;

		a {
			display: none;
		}
	}

	.ring {
		grid-template-columns: 86px 1fr;
		gap: 8px;

		svg {
			width: 86px;
			height: 86px;
		}

		div {
			width: 86px;
		}

		strong {
			font-size: 24px;
		}
	}

	.stats {
		gap: 8px;
	}

	.section-title {
		margin: 14px 0 8px;
	}

	.course-list {
		gap: 8px;
	}

	.course-card {
		min-height: 64px;
		grid-template-columns: 62px 1fr;
		gap: 10px;
	}

	.course-card:nth-child(n + 3) {
		display: none;
	}

	.course-thumb {
		height: 52px;
	}

	.course-info span {
		margin: 6px 0 5px;
	}
}
</style>

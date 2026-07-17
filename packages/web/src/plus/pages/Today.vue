<template>
	<div class="today-page">
		<div class="workspace-grid">
			<StudyOverview />
			<EmbeddedCourseBrowser />
			<OcsControlPanel />
		</div>

		<section class="task-strip">
			<div class="task-head">
				<div>
					<strong>任务提醒</strong>
					<span>暂未接入</span>
				</div>
				<span class="task-status">任务系统开发中</span>
			</div>
			<div class="task-list">
				<div class="task-card">
					<PlusIcon name="event_note" />
					<div>
						<strong>暂无真实任务数据</strong>
						<span>接入课程平台或任务数据源后将在此显示。</span>
					</div>
					<b>开发中</b>
				</div>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import StudyOverview from '../components/StudyOverview.vue';
import EmbeddedCourseBrowser from '../components/EmbeddedCourseBrowser.vue';
import OcsControlPanel from '../components/OcsControlPanel.vue';
import PlusIcon from '../components/PlusIcon.vue';
</script>

<style scoped lang="less">
.today-page {
	display: flex;
	flex-direction: column;
	gap: 8px;
	height: 100%;
	min-height: 0;
	overflow: hidden;
}

.workspace-grid {
	display: grid;
	grid-template-columns: minmax(270px, 310px) minmax(460px, 1fr) minmax(300px, 350px);
	grid-template-rows: minmax(0, 1fr);
	gap: 8px;
	flex: 1 1 0;
	min-height: 0;
	overflow: hidden;
}

.workspace-grid > * {
	min-width: 0;
	min-height: 0;
}

.task-strip {
	flex: 0 0 auto;
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	background: #ffffff;
	padding: 14px 18px 12px;
}

.task-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 14px;

	div {
		display: flex;
		align-items: baseline;
		gap: 18px;
	}

	strong {
		color: #111827;
		font-size: 18px;
		font-weight: 850;
	}

	span {
		color: #f07612;
		font-weight: 800;
	}
}

.task-status {
	color: #617086 !important;
	font-size: 13px;
}

.task-list {
	display: grid;
	grid-template-columns: minmax(180px, 1fr);
	gap: 12px;
}

.task-card {
	display: grid;
	grid-template-columns: 30px 1fr auto;
	align-items: center;
	gap: 10px;
	min-height: 76px;
	padding: 12px 14px;
	border: 1px dashed #cdd8e4;
	border-radius: 8px;
	background: #f8fbfc;

	.plus-icon {
		color: #617086;
	}

	strong {
		display: block;
		color: #455064;
		font-size: 14px;
	}

	span {
		display: block;
		margin-top: 6px;
		color: #657084;
		font-size: 12px;
	}

	b {
		color: #617086;
		background: #edf2f5;
		font-size: 12px;
		border-radius: 6px;
		padding: 4px 7px;
		white-space: nowrap;
	}
}

@media (max-width: 1280px) {
	.today-page {
		gap: 0;
	}

	.workspace-grid {
		grid-template-columns: minmax(248px, 292px) minmax(460px, 1fr);
	}

	.workspace-grid :deep(.ocs-control-panel),
	.task-strip {
		display: none;
	}
}

@media (max-width: 1080px) {
	.workspace-grid {
		grid-template-columns: minmax(0, 1fr);
	}

	.workspace-grid :deep(.study-overview) {
		display: none;
	}
}
</style>

<template>
	<section class="plus-panel course-browser">
		<div class="panel-title">网课浏览器</div>
		<p class="demo-notice">开发视觉预览：以下内容不代表真实课程、进度或资料。</p>
		<div class="browser-shell">
			<div class="browser-bar">
				<PlusIcon name="arrow_back" />
				<PlusIcon name="arrow_forward" />
				<PlusIcon name="refresh" />
				<PlusIcon name="home" />
				<div class="address"><PlusIcon name="lock" :size="16" /> https://course.example.com/learn/12345</div>
				<PlusIcon name="star" />
				<PlusIcon name="more_vert" />
			</div>
			<div class="course-topbar">
				<PlusIcon name="menu" />
				<strong>课程学习</strong>
				<span>学习进度&nbsp;&nbsp;6/12</span>
				<div class="course-progress"><i /></div>
				<span>笔记</span>
				<PlusIcon name="article" :size="18" />
			</div>
			<div class="course-body">
				<div class="video-card">
					<div class="lesson-title">2.2&nbsp; 导数的几何意义</div>
					<div class="formula">曲线 y = f(x) 在点 P(x0, f(x0)) 处的切线斜率为 f'(x0)</div>
					<div class="graph-area">
						<svg viewBox="0 0 520 270" role="img" aria-label="导数几何意义示意图">
							<line x1="80" y1="220" x2="450" y2="220" stroke="#182033" stroke-width="2" />
							<line x1="100" y1="235" x2="100" y2="46" stroke="#182033" stroke-width="2" />
							<path d="M150 170 C220 162 235 115 295 111 C348 108 360 75 410 92" fill="none" stroke="#3267f4" stroke-width="3" />
							<line x1="235" y1="200" x2="360" y2="55" stroke="#3267f4" stroke-width="2" />
							<line x1="295" y1="220" x2="295" y2="110" stroke="#8a94a8" stroke-dasharray="6 5" />
							<circle cx="295" cy="111" r="5" fill="#182033" />
							<text x="73" y="241">O</text>
							<text x="288" y="242">x0</text>
							<text x="425" y="70">y = f(x)</text>
							<text x="210" y="105">P(x0, f(x0))</text>
						</svg>
					</div>
					<div class="player">
						<PlusIcon name="play_arrow" />
						<PlusIcon name="skip_next" />
						<span>06:24 / 18:36</span>
						<b>1.0x</b>
						<PlusIcon name="volume_up" />
						<PlusIcon name="fullscreen" />
					</div>
				</div>
				<div class="chapter-card">
					<div class="chapter-header">
						<strong>目录</strong>
						<span>自动播放 <i /></span>
					</div>
					<div
						v-for="chapter in browserChapters"
						:key="chapter.title"
						class="chapter-row"
						:class="{ active: chapter.active, done: chapter.done }"
					>
						<span class="dot">{{ chapter.done ? '✓' : '' }}</span>
						{{ chapter.title }}
					</div>
				</div>
			</div>
			<div class="course-tabs">
				<span>课程介绍</span>
				<span class="active">课件</span>
				<span>课程笔记</span>
				<span>讨论区</span>
			</div>
			<div class="material-list">
				<div
					v-for="item in materials"
					:key="item.name"
					class="material-row"
				>
					<PlusIcon name="picture_as_pdf" />
					<div>
						<strong>{{ item.name }}</strong>
						<span>PDF · {{ item.size }}</span>
					</div>
					<button title="下载"><PlusIcon name="download" :size="18" /></button>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import PlusIcon from './PlusIcon.vue';
import { browserChapters, materials } from '../data/dashboard';
</script>

<style scoped lang="less">
.course-browser {
	min-width: 420px;
}

.panel-title {
	font-size: 18px;
	font-weight: 800;
	color: #101827;
	margin-bottom: 14px;
}

.browser-shell {
	border: 1px solid #e6ebf1;
	border-radius: 8px;
	overflow: hidden;
	background: #ffffff;
	box-shadow: 0 16px 38px rgba(24, 48, 74, 0.08);
}

.browser-bar {
	height: 54px;
	display: flex;
	align-items: center;
	gap: 13px;
	padding: 0 16px;
	color: #4b5667;
	border-bottom: 1px solid #edf1f5;

	.address {
		height: 32px;
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 13px;
		border-radius: 8px;
		background: #f6f8fa;
		font-size: 13px;
		color: #4b5667;
		white-space: nowrap;
		overflow: hidden;
	}
}

.course-topbar {
	height: 64px;
	background: #131e3a;
	color: #ffffff;
	display: flex;
	align-items: center;
	gap: 22px;
	padding: 0 22px;

	span {
		font-size: 14px;
		opacity: 0.92;
	}
}

.course-progress {
	width: 148px;
	height: 7px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.16);
	overflow: hidden;

	i {
		display: block;
		width: 58%;
		height: 100%;
		border-radius: inherit;
		background: #39c6a9;
	}
}

.course-body {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 190px;
	gap: 14px;
	padding: 16px;
	background: #f7f9fb;
}

.video-card,
.chapter-card {
	background: #ffffff;
	border-radius: 8px;
	border: 1px solid #eef1f5;
	overflow: hidden;
}

.lesson-title {
	padding: 16px 20px 6px;
	font-size: 19px;
	font-weight: 800;
}

.formula {
	padding: 0 20px;
	color: #1f2937;
	font-size: 13px;
}

.graph-area {
	height: 248px;
	padding: 4px 22px;
}

.graph-area svg {
	width: 100%;
	height: 100%;
}

.player {
	height: 48px;
	display: flex;
	align-items: center;
	gap: 14px;
	padding: 0 18px;
	background: #101c34;
	color: #ffffff;

	span {
		margin-right: auto;
		font-weight: 700;
	}
}

.chapter-card {
	padding: 14px 10px;
}

.chapter-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 4px 6px 12px;

	span {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: #667085;
	}

	i {
		width: 28px;
		height: 16px;
		border-radius: 999px;
		background: #2aa7a3;
		display: inline-block;
	}
}

.chapter-row {
	display: flex;
	align-items: center;
	gap: 8px;
	height: 34px;
	border-radius: 6px;
	padding: 0 8px;
	font-size: 13px;
	color: #5b6575;

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: #d9dde5;
		color: #2aa7a3;
		font-size: 10px;
		line-height: 10px;
	}

	&.active {
		color: #168a95;
		background: #eaf6f5;
		border-left: 3px solid #2aa7a3;
	}

	&.done .dot {
		background: transparent;
	}
}

.course-tabs {
	display: flex;
	gap: 28px;
	height: 48px;
	align-items: center;
	padding: 0 24px;
	border-bottom: 1px solid #edf1f5;

	span {
		height: 48px;
		display: inline-flex;
		align-items: center;
		font-size: 13px;
		color: #5d6676;
	}

	.active {
		color: #119497;
		font-weight: 800;
		border-bottom: 3px solid #23aca6;
	}
}

.material-list {
	padding: 8px 16px 14px;
}

.material-row {
	display: grid;
	grid-template-columns: 28px 1fr 32px;
	align-items: center;
	gap: 10px;
	padding: 10px 6px;
	border-bottom: 1px solid #f0f2f5;

	.plus-icon {
		color: #f0493e;
	}

	strong {
		display: block;
		font-size: 13px;
	}

	span {
		display: block;
		color: #8a94a6;
		font-size: 12px;
		margin-top: 3px;
	}

	button {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 1px solid #e2e7ee;
		background: #fff;
		color: #182235;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
}

@media (max-width: 1180px) {
	.course-body {
		grid-template-columns: 1fr;
	}
}
</style>

<template>
	<div class="legacy-page">
		<section class="legacy-hero plus-panel">
			<div>
				<span>高级 / 原版功能</span>
				<h1>保留 OCS 原能力</h1>
				<p>原来的浏览器列表、脚本列表、资源中心、监控面板和软件设置都在这里，适合细调和排障。</p>
			</div>
		</section>

		<section class="legacy-grid">
			<button
				v-for="entry in entries"
				:key="entry.path"
				class="legacy-entry"
				@click="router.push(entry.path)"
			>
				<PlusIcon :name="entry.icon" />
				<strong>{{ entry.title }}</strong>
				<span>{{ entry.description }}</span>
			</button>
		</section>
	</div>
</template>

<script setup lang="ts">
import { router } from '../../route';
import PlusIcon from '../components/PlusIcon.vue';

const entries = [
	{
		title: '原浏览器列表',
		description: '管理独立浏览器、文件夹、标签、缓存和启动状态。',
		icon: 'view_list',
		path: '/legacy/browsers'
	},
	{
		title: '原脚本列表',
		description: '搜索、安装、更新和维护 OCS 用户脚本。',
		icon: 'code',
		path: '/legacy/user-scripts'
	},
	{
		title: '原软件设置',
		description: '浏览器路径、主题、窗口行为、同步和 OCS 配置。',
		icon: 'settings',
		path: '/legacy/setting'
	},
	{
		title: '原应用中心',
		description: '继续使用 OCS 原来的资源与扩展入口。',
		icon: 'widgets',
		path: '/legacy/resources'
	},
	{
		title: '原监控列表',
		description: '查看原版运行面板、状态和调试信息。',
		icon: 'monitor_heart',
		path: '/legacy/dashboard'
	}
];
</script>

<style scoped lang="less">
.legacy-page {
	display: grid;
	gap: 10px;
}

.legacy-hero {
	min-height: 138px;
	display: flex;
	align-items: center;
	background:
		linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(240, 247, 252, 0.96)),
		#ffffff;

	span {
		color: #168f95;
		font-weight: 900;
	}

	h1 {
		margin: 8px 0;
		color: #101827;
		font-size: 30px;
		font-weight: 900;
	}

	p {
		max-width: 720px;
		margin: 0;
		color: #607086;
		line-height: 1.7;
	}
}

.legacy-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(210px, 1fr));
	gap: 10px;
}

.legacy-entry {
	min-height: 152px;
	padding: 20px;
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	background: #ffffff;
	color: inherit;
	text-align: left;
	transition:
		transform 0.16s ease,
		border-color 0.16s ease,
		box-shadow 0.16s ease;

	.plus-icon {
		color: #168f95;
	}

	strong {
		display: block;
		margin-top: 16px;
		color: #111827;
		font-size: 17px;
	}

	span {
		display: block;
		margin-top: 8px;
		color: #667085;
		line-height: 1.6;
	}

	&:hover {
		transform: translateY(-2px);
		border-color: #b9dedc;
		box-shadow: 0 16px 32px rgba(24, 48, 74, 0.08);
	}
}

@media (max-width: 980px) {
	.legacy-grid {
		grid-template-columns: 1fr;
	}
}
</style>

<template>
	<div class="placeholder-page">
		<section class="placeholder-hero">
			<div class="hero-icon"><PlusIcon :name="module?.icon || 'widgets'" :size="30" /></div>
			<div>
				<h1>{{ module?.title || '模块' }}</h1>
				<p>{{ module?.description || '这个模块仅保留架构占位，第一阶段 MVP 暂未开放。' }}</p>
			</div>
			<span>{{ module?.status || '开发中 / 暂未开放' }}</span>
		</section>

		<section class="module-grid">
			<div
				v-for="item in cards"
				:key="item.title"
				class="module-card"
			>
				<PlusIcon :name="item.icon" />
				<strong>{{ item.title }}</strong>
				<p>{{ item.text }}</p>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import PlusIcon from '../components/PlusIcon.vue';
import { plusModules } from '../modules/registry';

const route = useRoute();
const module = computed(() => plusModules.find((item) => item.id === route.name));

const cards = [
	{ icon: 'construction', title: '暂未开放', text: '该能力不属于第一阶段 MVP，当前不会提供真实业务操作。' },
	{ icon: 'verified', title: 'MVP 边界', text: '当前版本优先保证可启动、可配置、可展示基础状态和可回原版入口。' },
	{ icon: 'assignment_late', title: '后续评审', text: '涉及 AI、题库、资料、模型或任务闭环的能力将作为 P2 单独评审。' }
];
</script>

<style scoped lang="less">
.placeholder-page {
	display: grid;
	gap: 12px;
}

.placeholder-hero,
.module-card {
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	background: #ffffff;
	box-shadow: 0 14px 32px rgba(24, 48, 74, 0.06);
}

.placeholder-hero {
	display: grid;
	grid-template-columns: 56px 1fr auto;
	align-items: center;
	gap: 16px;
	min-height: 118px;
	padding: 24px;

	.hero-icon {
		width: 56px;
		height: 56px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #168f95;
		background: #e8f8f5;
	}

	h1 {
		margin: 0 0 8px;
		color: #111827;
		font-size: 24px;
	}

	p {
		margin: 0;
		color: #607086;
	}

	span {
		padding: 6px 10px;
		border-radius: 999px;
		color: #168f95;
		background: #e8f8f5;
		font-weight: 800;
	}
}

.module-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(160px, 1fr));
	gap: 12px;
}

.module-card {
	padding: 18px;

	.plus-icon {
		color: #168f95;
	}

	strong {
		display: block;
		margin-top: 14px;
		color: #111827;
		font-size: 16px;
	}

	p {
		color: #607086;
		line-height: 1.6;
	}
}
</style>

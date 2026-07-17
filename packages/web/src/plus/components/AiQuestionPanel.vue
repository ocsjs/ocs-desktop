<template>
	<aside class="ai-panel">
		<div class="ai-header">
			<h2>AI 题目助手</h2>
			<span>开发中</span>
		</div>
		<div class="empty-state">
			<PlusIcon name="psychology" :size="32" />
			<strong>暂未接入真实题目或模型服务</strong>
			<p>当前不会提取题目、生成答案、显示模型连接或额度，也不会保存错题。</p>
			<p>后续接入经确认的数据来源后，将在此展示可核验的题目和参考信息。</p>
		</div>
		<div class="ai-buttons">
			<button disabled>解析功能开发中</button>
			<button disabled>错题本暂未接入</button>
		</div>
	</aside>
</template>

<script setup lang="ts">
import PlusIcon from './PlusIcon.vue';
</script>

<style scoped lang="less">
.ai-panel {
	display: flex;
	flex-direction: column;
	gap: 18px;
	min-width: 300px;
	background: #ffffff;
	border: 1px solid #e5ebf1;
	border-radius: 8px;
	padding: 20px 18px;
	box-shadow: 0 16px 38px rgba(24, 48, 74, 0.07);
}

.ai-header {
	display: flex;
	align-items: center;
	justify-content: space-between;

	h2 {
		margin: 0;
		color: #111827;
		font-size: 20px;
		font-weight: 850;
	}

	span {
		color: #617086;
		background: #edf2f5;
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 12px;
		font-weight: 800;
	}
}

.empty-state {
	display: grid;
	justify-items: start;
	gap: 10px;
	padding: 18px;
	border: 1px dashed #cdd8e4;
	border-radius: 8px;
	background: #f8fbfc;
	color: #657084;

	.plus-icon {
		color: #8390a3;
	}

	strong {
		color: #455064;
	}

	p {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
	}
}

.ai-buttons {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 10px;

	button {
		height: 40px;
		border: 1px solid #d8e0e8;
		border-radius: 8px;
		background: #f4f6f8;
		color: #8a94a6;
		font-weight: 700;
	}
}
</style>

<template>
	<!-- 内容区域 -->
	<router-view v-slot="{ Component }">
		<keep-alive>
			<component :is="Component" />
		</keep-alive>
	</router-view>
</template>

<script setup lang="ts"></script>

<style lang="less">
@import '@/assets/css/bootstrap.min.css';
@import '@/assets/css/common.css';
</style>

<template>
	<div class="m-0 ps-5 pe-5">
		<a-empty class="p-0 mb-3 m-auto text-center"> 暂无浏览器 ~ </a-empty>

		<a-alert class="mb-3">请先 “新建浏览器” ，启动浏览器后即可自动安装拓展、运行脚本、开启脚本之旅~</a-alert>

		<div class="mb-2 d-flex align-items-center justify-content-center flex-wrap">
			<a-button
				type="primary"
				@click="newBrowserOrInit()"
			>
				<a-space size="mini"> <PlusIcon /> 新建浏览器</a-space>
			</a-button>
		</div>
		<div class="mb-2 d-flex align-items-center justify-content-center flex-wrap">
			<a-button
				type="text"
				@click="about"
			>
				<a-space size="mini"><CircleQuestionMarkIcon /> 使用教程</a-space>
			</a-button>
		</div>

		<div class="mb-2 d-flex align-items-center justify-content-center flex-wrap">
			<a-button
				type="text"
				@click="goto(OCS_WEBSITE)"
			>
				<a-space size="mini"><HouseIcon />前往官网</a-space>
			</a-button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { about, goto } from '../utils';
import { newBrowserOrInit } from '../utils/browser';
import { OCS_WEBSITE } from '@ocs-desktop/common/web';
import { CircleQuestionMarkIcon, HouseIcon, PlusIcon } from 'lucide-vue-next';
</script>

<style scoped></style>

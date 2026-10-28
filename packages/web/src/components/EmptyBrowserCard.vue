<template>
	<div class="m-3 ps-5 pe-5">
		<a-result
			class="p-3 m-auto text-center"
			status="404"
		>
			<a-alert>请先创建浏览器，然后启动即可~</a-alert>
		</a-result>

		<div>
			<a-button
				type="text"
				@click="newBrowserOrInit()"
			>
				<a-space size="mini"><GlobeIcon />新建浏览器</a-space>
			</a-button>
		</div>

		<div>
			<a-button
				type="text"
				@click="about"
			>
				<a-space size="mini"><BookIcon />使用教程</a-space>
			</a-button>
		</div>

		<div>
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
import { GlobeIcon, BookIcon, HouseIcon } from 'lucide-vue-next';
</script>

<style scoped></style>

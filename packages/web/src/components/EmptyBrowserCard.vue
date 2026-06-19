<template>
	<div class="m-3 ps-5 pe-5">
		<a-result
			class="p-3 m-auto text-center"
			status="404"
		>
			<div class="text-secondary">请先创建浏览器，然后启动即可~</div>
		</a-result>

		<div>
			<a-button
				type="text"
				@click="newBrowser()"
			>
				<Icon type="web">新建浏览器</Icon>
			</a-button>
		</div>

		<div>
			<a-button
				type="text"
				@click="about"
			>
				<Icon type="book">使用教程</Icon>
			</a-button>
		</div>

		<div>
			<a-button
				type="text"
				@click="goto('https://docs.ocsjs.com')"
			>
				<Icon type="home">前往官网</Icon>
			</a-button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { about, goto } from '../utils';
import { newBrowser } from '../utils/browser';
</script>

<style scoped></style>

<template>
	<!-- 无数据时不渲染根节点，避免空 div 携带父级 margin 类占据空间 -->
	<div v-if="visibleBanners.length">
		<template
			v-for="(banner, index) in visibleBanners"
			:key="index"
		>
			<a-alert
				:type="banner.type || 'info'"
				:title="banner.title"
				show-icon
				banner
				closable
				class="rounded"
				@close="onClose(index)"
			>
				{{ banner.content }}
			</a-alert>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getRemoteInfos } from '../utils';
import type { BannerResource } from '@ocs-desktop/common/web';

const visibleBanners = ref<BannerResource[]>([]);
const closedBanners = ref<Set<string>>(new Set());

onMounted(async () => {
	try {
		const infos = await getRemoteInfos();
		const banners = infos.banners || [];
		visibleBanners.value = banners.map((b, i) => ({
			...b,
			title: b.title || '',
			content: b.content || '',
			type: b.type || 'info'
		}));
	} catch {
		// 静默失败，不影响主界面
	}
});

function onClose(index: number) {
	const banner = visibleBanners.value[index];
	if (banner) {
		closedBanners.value.add(`${banner.title}-${index}`);
	}
	visibleBanners.value.splice(index, 1);
}
</script>

<template>
	<div>
		<template v-for="child of entities">
			<Entity
				v-if="child.type !== 'browser'"
				:key="child.uid"
				class="entity"
				:entity="child"
			>
				<template #icon>
					<Icon
						theme="filled"
						type="folder"
					></Icon>
				</template>

				<template #actions>
					<EntityOperator
						icon-class="fs-5"
						type="folder"
						:entity="child"
						:permissions="currentSearchedEntities ? ['location'] : ['rename', 'remove']"
					></EntityOperator>
				</template>
			</Entity>
		</template>

		<template v-for="child of entities">
			<Entity
				v-if="child.type === 'browser'"
				:key="child.uid"
				class="entity"
				:entity="child"
			>
				<template #prefix>
					<div class="d-flex align-items-center">
						<!-- 单选框 -->
						<a-checkbox
							v-model="child.checked"
							class="ps-1 pe-1"
							style="width: 24px"
							@click.stop
						></a-checkbox>
					</div>
				</template>

				<template #suffix>
					<!-- 标签 -->
					<div
						v-if="child.tags.length"
						class="text-secondary tags"
						style="flex: 0 0 auto"
					>
						<a-divider
							class="m-1"
							direction="vertical"
						>
						</a-divider>
						<Tags
							:tags="child.tags"
							:read-only="true"
							size="small"
						></Tags>
					</div>
				</template>

				<template
					v-if="child.tags.length || child.notes"
					#extra
				>
					<div
						style="flex: 1 1 auto; overflow: auto; max-width: 700px"
						class="d-flex align-items-center"
					>
						<!-- 备注 -->
						<div
							v-if="child.notes?.trim()"
							class="text-secondary notes flex-wrap"
							style="flex: 1 1 auto"
						>
							<span> {{ child.notes }} </span>
						</div>
					</div>
				</template>

				<template #actions>
					<BrowserOperators
						:browser="child"
						icon-class="fs-5"
					>
						<template #split>
							<a-divider direction="vertical" />
						</template>
					</BrowserOperators>
					<EntityOperator
						type="browser"
						:entity="child"
					></EntityOperator>
				</template>
			</Entity>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { currentSearchedEntities } from '../fs';
import { Browser } from '../fs/browser';
import { Folder } from '../fs/folder';
import { BrowserOptions, FolderOptions, FolderType } from '../fs/interface';
import BrowserOperators from './browsers/BrowserOperators.vue';
import Entity from './Entity.vue';
import EntityOperator from './EntityOperator.vue';
import Icon from './Icon.vue';
import Tags from './Tags.vue';

defineProps<{
	entities: Array<BrowserOptions | FolderOptions<FolderType, Folder<FolderType> | Browser>>;
}>();
</script>

<style scoped>
.notes {
	font-size: 12px;
	max-height: 24px;
	overflow: overlay;
}

.entity {
	padding: 4px 0px;
}
</style>

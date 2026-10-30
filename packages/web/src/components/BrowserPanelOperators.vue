<template>
	<div class="d-flex w-100 align-items-center justify-content-end flex-wrap gap-2">
		<div style="flex: 1 1 auto">
			<template v-if="state.renaming">
				<a-input
					ref="renameRef"
					v-model="name"
					size="mini"
					@blur="onBlur"
				></a-input>
			</template>
			<template v-else>
				<span class="fw-bold">{{ browser.name }}</span>
				<a-tooltip
					content="重命名"
					position="bottom"
				>
					<a-button
						type="text"
						size="mini"
						class="ms-2"
						@click="rename"
					>
						<PencilIcon />
					</a-button>
				</a-tooltip>
				<a-tooltip
					content="编辑备注"
					position="bottom"
				>
					<a-button
						type="text"
						size="mini"
						@click="openNotesModal"
					>
						<NotebookPenIcon />
					</a-button>
				</a-tooltip>
				<a-tooltip
					content="添加标签"
					position="bottom"
				>
					<a-button
						type="text"
						size="mini"
						@click="emits('add-tag')"
					>
						<TagIcon />
					</a-button>
				</a-tooltip>
			</template>
		</div>
		<div
			style="flex: 0 0 auto"
			class="d-flex justify-content-end"
		>
			<BrowserOperators
				:browser="browser"
				tooltip-position="br"
				icon-class="fs-5"
				class="ps-2"
			>
				<template #split>
					<a-divider direction="vertical" />
				</template>

				<template #extra>
					<a-divider direction="vertical" />
					<a-tooltip position="br">
						<template #content>
							仅打开浏览器，不执行其他操作。<br />
							此方法可以防止各种浏览器环境问题：<br />
							- 无法打开特殊的超星网页<br />
							- 弹窗自动被关闭等等问题 <br />
							如果你并没有遇到这些问题，可以不使用此方法，可以直接使用蓝色的启动按钮。
						</template>

						<a-button
							size="mini"
							@click="browser.onlyLaunch()"
						>
							<GlobeIcon />
						</a-button>
					</a-tooltip>
					<a-tooltip
						content="删除浏览器"
						position="br"
					>
						<a-popconfirm
							content="是否删除该浏览器?"
							@ok="browser.remove()"
						>
							<a-button
								size="mini"
								status="danger"
							>
								<Trash2Icon />
							</a-button>
						</a-popconfirm>
					</a-tooltip>
					<template v-if="closable">
						<a-divider direction="vertical" />
						<a-tooltip
							content="关闭面板"
							position="br"
						>
							<a-button
								size="mini"
								@click="emits('close')"
							>
								<XIcon />
							</a-button>
						</a-tooltip>
					</template>
				</template>
			</BrowserOperators>
		</div>
	</div>

	<!-- 备注编辑弹窗（编辑入口从备注展示区迁移到操作栏） -->
	<a-modal
		v-model:visible="state.showNotesModal"
		title="编辑备注"
		align-center
		ok-text="确认"
		cancel-text="取消"
		@ok="saveNotes"
	>
		<a-textarea
			v-model="state.notesDraft"
			placeholder="备注为空时，浏览器卡片将展示自动化程序信息"
			:auto-size="{ minRows: 3, maxRows: 8 }"
			allow-clear
		/>
	</a-modal>
</template>

<script lang="ts" setup>
import { nextTick, reactive, ref } from 'vue';
import { Browser } from '../fs/browser';
import BrowserOperators from './browsers/BrowserOperators.vue';
import { GlobeIcon, Trash2Icon, PencilIcon, XIcon, NotebookPenIcon, TagIcon } from 'lucide-vue-next';

const props = defineProps<{
	browser: Browser;
	/** 是否显示关闭按钮（浏览器面板全屏抽屉模式下无遮罩可点，需显式关闭入口） */
	closable?: boolean;
}>();

const emits = defineEmits<{
	(e: 'close'): void;
	/** 添加标签：弹窗复用 BrowserPanel 内 Tags 组件，由父级转发调用 */
	(e: 'add-tag'): void;
}>();

const name = defineModel<string>({ default: '' });

const state = reactive({
	renaming: false,
	showNotesModal: false,
	notesDraft: ''
});

const renameRef = ref();

function rename() {
	state.renaming = true;
	name.value = props.browser.name;
	nextTick(() => {
		renameRef.value?.focus();
	});
}

function onBlur() {
	props.browser?.rename(name.value);
	state.renaming = false;
}

function openNotesModal() {
	state.notesDraft = props.browser.notes || '';
	state.showNotesModal = true;
}

function saveNotes() {
	// browser 为响应式实体类实例（fs/browser.ts Browser），直接写 notes 是有意的数据更新而非 prop 误用
	// eslint-disable-next-line vue/no-mutating-props
	props.browser.notes = state.notesDraft;
}
</script>

<style scoped></style>

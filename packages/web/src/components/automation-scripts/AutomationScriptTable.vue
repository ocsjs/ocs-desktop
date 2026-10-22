<template>
	<!-- 底部操作区已转移至弹窗 footer 插槽（FileOperators.vue），本组件只保留表格滚动区 -->
	<div
		ref="tableRef"
		class="ps-table"
	>
		<div class="ps-3 pe-3">
			<a-table
				v-model:pagination="state.pagination"
				size="small"
				:columns="columns"
				:data="data"
				:scroll="{
					// 表格滚动区最大高度 600px（按钮已移至弹窗 footer，无需预留底部空间）
					y: Math.min(store.render.state.height - 280, 600)
				}"
				@page-change="(page) => (state.pagination.current = page)"
				@page-size-change="(size) => (state.pagination.pageSize = size)"
			>
				<template #index="{ record }">
					<span class="text-nowrap"> {{ record.index + 1 }} </span>
				</template>

				<!-- select 类型列的表头：列名 + 全列填充选择框 -->
				<template #data-header="{ column }">
					<div class="ps-header-cell">
						<div class="ps-header-title">{{ column.title }}</div>
						<a-select
							v-model="state.headerSelectValues[column.dataIndex]"
							size="mini"
							allow-clear
							placeholder="全列填充"
							:options="selectOptions[column.dataIndex]"
							@change="(value) => applyHeaderSelect(column.dataIndex, value)"
						></a-select>
					</div>
				</template>

				<template #browserName="{ record, column }">
					<a-tooltip>
						<template #content>
							如果留空，则默认使用自动规则进行填充：<br />
							{{ state.browserNameFields.join('+') }}
						</template>
						<a-input
							v-model="record[column.dataIndex]"
							size="mini"
							placeholder="自动填充"
						></a-input>
					</a-tooltip>
				</template>

				<template #data="{ record, rowIndex, column }">
					<a-select
						v-if="selectOptions[column.dataIndex]"
						v-model="record[column.dataIndex]"
						size="mini"
						:options="selectOptions[column.dataIndex]"
						@change="() => onRecordInput(rowIndex)"
					></a-select>
					<a-input
						v-else
						v-model="record[column.dataIndex]"
						size="mini"
						@input="() => onRecordInput(rowIndex)"
					/>
				</template>
			</a-table>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, toRefs, onDeactivated, computed, watch, onMounted, h } from 'vue';
import { RawAutomationScript } from '.';
import { Modal, Message, TableColumnData } from '@arco-design/web-vue';
import uniqueId from 'lodash/uniqueId';
import { store } from '../../store';
import type { Config } from '@ocs-desktop/common/web';
import { normalizeUrl } from '@ocs-desktop/common/web';
import { remote } from '../../utils/remote';
import xlsx from 'xlsx';

const props = defineProps<{
	rawAutomationScript: RawAutomationScript;
}>();

const emits = defineEmits<{
	(
		e: 'confirm',
		raw: RawAutomationScript,
		configsList: (RawAutomationScript['configs'] & { browserName: string })[]
	): void;
	(e: 'cancel'): void;
}>();

const { rawAutomationScript } = toRefs(props);

/** 将 configs 对象转换成 config 数组（批量创建模式下每行独立，保留全部可见字段） */
const arrayLikeConfigs = computed(() =>
	Object.keys(rawAutomationScript.value.configs)
		.filter((k) => !rawAutomationScript.value.configs[k].hide)
		.map((k) => ({ ...rawAutomationScript.value.configs[k], key: k }))
);

/** 按列 key 收集 select 类型配置的选项（表格内以下拉渲染） */
const selectOptions = computed<Record<string, Config['options']>>(() => {
	const map: Record<string, Config['options']> = {};
	for (const config of arrayLikeConfigs.value) {
		if (config.type === 'select') map[config.key] = config.options;
	}
	return map;
});

const state = reactive({
	/** 分页 */
	pagination: {
		total: 1000,
		current: 1,
		pageSize: 100
	},
	/** 存在数据的行索引 */
	validDataIndex: new Set<number>(),
	/** select 类型列的表头"全列填充"当前值（key -> 选中的值） */
	headerSelectValues: {} as Record<string, any>,
	/** 浏览器名字生成规则 */
	browserNameFields: arrayLikeConfigs.value.map((c) => c.key)
});

const data = ref<any[]>(createData());
const columns = ref<TableColumnData[]>();
const tableRef = ref();

watch(rawAutomationScript, () => {
	data.value = createData();
	initColumns();
	// 重置行有效标记与表头全列填充：模板切换后旧索引指向的是新空行，残留会导致创建出空数据浏览器
	state.validDataIndex = new Set<number>();
	state.headerSelectValues = {};
	state.browserNameFields = arrayLikeConfigs.value.map((c) => c.key);
});

onMounted(() => {
	initColumns();
});

onDeactivated(() => {
	state.browserNameFields = [];
	state.validDataIndex = new Set<number>();
	state.headerSelectValues = {};
	data.value = [];
	columns.value = [
		{
			title: '#',
			dataIndex: 'index',
			slotName: 'index',
			width: 70
		}
	];
});

function initColumns() {
	columns.value = [
		{
			title: '',
			dataIndex: 'index',
			slotName: 'index',
			width: 42,
			bodyCellClass: 'ps-table-index'
		},
		{
			title: '浏览器名',
			dataIndex: 'browserName',
			slotName: 'browserName',
			width: 120
		}
	];
	for (const config of arrayLikeConfigs.value) {
		columns.value.push({
			title: config.label,
			dataIndex: config.key,
			slotName: 'data',
			// select 类型列在表头额外渲染"全列填充"选择框
			titleSlotName: config.type === 'select' ? 'data-header' : undefined,
			bodyCellClass: 'ps-body-cell'
		});
	}
}

/**
 * 表头"全列填充"：将某 select 列的值应用到表格全部行（不标记行有效，行有效性仍由该行实际输入驱动）。
 * 清空时移除所有行该列的值。
 */
function applyHeaderSelect(key: string, value: any) {
	for (const row of data.value) {
		if (value === undefined || value === '') {
			Reflect.deleteProperty(row, key);
		} else {
			row[key] = value;
		}
	}
}

function createData() {
	return new Array(1000).fill(1).map((item, index) => {
		item = Object.create({});
		item.index = index;
		item.key = uniqueId();
		return item;
	});
}

function onRecordInput(index: number) {
	state.validDataIndex.add(index);
}

function getValidData() {
	const validData: any[] = [];
	// 对存在数据的行数索引进行排序，然后根据索引提取出 data 里面的数据
	for (const index of Array.from(state.validDataIndex).sort((a, b) => a - b)) {
		validData.push(data.value[index]);
	}
	return validData;
}

/**
 * 点击批量创建：先清理/校验输入
 * - 整行全部数值为空（含浏览器名）：视为无效输入，静默忽略该行
 * - 行内存在任意一个未填写的配置项：整行视为无效数据，弹警告由用户选择"重新输入"或"忽略无效行、批量创建"
 */
function onConfirm() {
	const validData = getValidData();

	/** 填写完整的行 */
	const completeRows: any[] = [];
	/** 填写不完整的行（行号 + 缺少的配置 label） */
	const incompleteRows: { index: number; missing: string[] }[] = [];

	for (const obj of validData) {
		const missing: string[] = [];
		let filledCount = 0;
		for (const config of arrayLikeConfigs.value) {
			const value = String(obj[config.key] ?? '').trim();
			if (value) {
				filledCount++;
			} else if (!config.visibleWhen || obj[config.visibleWhen.key] === config.visibleWhen.value) {
				// 条件显示（visibleWhen）且当前行不满足显示条件的配置项不参与必填校验
				missing.push(config.label);
			}
		}
		const hasBrowserName = !!String(obj.browserName ?? '').trim();

		if (filledCount === 0 && !hasBrowserName) {
			// 全部数值为空：无效输入，忽略该行
			continue;
		} else if (missing.length > 0) {
			incompleteRows.push({ index: obj.index, missing });
		} else {
			completeRows.push(obj);
		}
	}

	if (incompleteRows.length > 0) {
		const lines = incompleteRows
			.slice(0, 20)
			.map((r) => `第 ${r.index + 1} 行的数据没有填写完整：缺少 ${r.missing.join('、')} 输入`);
		if (incompleteRows.length > 20) {
			lines.push(`... 共 ${incompleteRows.length} 行未填写完整`);
		}
		Modal.warning({
			title: '存在未填写完整的数据',
			content: () =>
				h('div', { style: 'white-space: pre-line; max-height: 40vh; overflow: auto' }, [
					lines.join('\n'),
					h('br'),
					'请重新输入，或忽略无效行后继续批量创建。'
				]),
			okText: '忽略无效行、批量创建',
			cancelText: '重新输入',
			hideCancel: false,
			onOk: () => emitCreate(completeRows)
		});
		return;
	}

	emitCreate(completeRows);
}

/** 构建 configsList 并触发创建（browserName 不写入 configs，避免渲染为空 label 配置项） */
function emitCreate(rows: any[]) {
	if (rows.length === 0) {
		Message.warning('没有可创建的有效数据');
		return;
	}

	const configsList: (RawAutomationScript['configs'] & { browserName: string })[] = [];

	for (const obj of rows) {
		const configs: RawAutomationScript['configs'] & { browserName: string } = Object.create({});
		const object: Record<string, any> = JSON.parse(JSON.stringify(obj));

		Reflect.deleteProperty(object, 'index');
		Reflect.deleteProperty(object, 'key');
		// browserName 单独提取，不作为脚本配置项（否则渲染端会出现空 label、placeholder 为"输入 undefined"的配置框）
		const inputBrowserName = String(object.browserName ?? '').trim();
		Reflect.deleteProperty(object, 'browserName');

		for (const key in object) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				// url 类型列（如网页链接）自动识别并补全 https:// 前缀
				const rawConfig = rawAutomationScript.value.configs[key];
				const value = rawConfig?.type === 'url' ? normalizeUrl(object[key]) : object[key];
				Reflect.set(configs, key, {
					hide: !!rawConfig?.hide,
					label: rawConfig?.label,
					value
				} as Config);
			}
		}
		// 浏览器名：手动输入 > 自动规则 > 模板名+行号 兜底，保证不会出现空名字的浏览器
		const autoName = state.browserNameFields
			.map((f) => String(configs[f]?.value ?? '').trim())
			.filter(Boolean)
			.join(' ');
		configs.browserName = inputBrowserName || autoName || `${props.rawAutomationScript.name}-${obj.index + 1}`;
		configsList.push(configs);
	}

	emits('confirm', props.rawAutomationScript, configsList);
}

function exportTemplateExcel() {
	const template = Object.create({});
	template.浏览器名 = '';
	for (const config of arrayLikeConfigs.value) {
		template[config.label] = '';
	}

	remote.methods.call(
		'exportExcel',
		[
			{
				sheetName: 'Sheet1',
				list: [template]
			}
		],
		`${props.rawAutomationScript.name} 创建模板.xlsx`
	);
}

function importTemplateExcelConfirm() {
	if (getValidData().length > 0) {
		Modal.warning({
			content: '当前存在已经编辑的数据，导入后将覆盖数据，是否确认导入。',
			onOk: importTemplateExcel,
			simple: true,
			cancelText: '取消',
			okText: '确认导入'
		});
	} else {
		importTemplateExcel();
	}
}

// 底部操作区经弹窗 footer 插槽渲染（FileOperators.vue），相关状态与动作在此暴露
defineExpose({ state, arrayLikeConfigs, exportTemplateExcel, importTemplateExcelConfirm, onConfirm });

function importTemplateExcel() {
	remote.dialog
		.call('showOpenDialog', {
			title: '选择表格进行导入',
			buttonLabel: '导入',
			filters: [{ extensions: ['xlsx', 'csv', 'xls'], name: 'excel表格' }]
		})
		.then(async ({ canceled, filePaths }) => {
			if (canceled === false && filePaths.length) {
				const text = await remote.fs.call('readFileSync', filePaths[0]);
				const book = xlsx.read(text, { type: 'array' });

				const excel = book.SheetNames.map((name) => ({
					SheetName: name,
					data: xlsx.utils.sheet_to_json(book.Sheets[name]) as any[]
				}));

				const list = excel.map((s) => s.data).flat();
				for (let index = 0; index < list.length; index++) {
					const item = list[index];
					const row = Object.create({});

					for (const key in item) {
						if (Object.prototype.hasOwnProperty.call(item, key)) {
							const val = String(item[key] || '');
							const config = arrayLikeConfigs.value.find((c) => c.label === key);
							if (config) {
								Reflect.set(row, config.key, val);
							}
							if (key === '浏览器名') {
								Reflect.set(row, 'browserName', val);
							}
						}
					}

					state.validDataIndex.add(index);
					data.value[index] = row;
				}
			}
		});
}
</script>

<style scoped lang="less">
:deep(.arco-table-cell) {
	padding: 0px;
}

:deep(.ps-body-cell) {
	padding: 0px;
	border: 1px solid #efefef;

	.arco-input-wrapper {
		background: white;
	}
}

:deep(.arco-table-tr) {
	.ps-table-index {
		background-color: #f4f4f4;
		cursor: default;
		text-align: center;
		color: #969696;
	}
}

// 表头"全列填充"选择框
.ps-header-cell {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 2px 0;

	.ps-header-title {
		font-size: 12px;
		line-height: 1.4;
	}
}
</style>

<template>
	<div>
		<Description
			:label="label"
			:desc="realPath"
			:text-class="'pointer'"
			:text-style="{ fontSize: '12px' }"
			@click="shell.showItemInFolder(realPath)"
		>
			<Icon
				v-if="setting"
				class="ms-3"
				type="settings"
				@click.stop="change(name)"
			/>
		</Description>
	</div>
</template>

<script setup lang="ts">
import { ref, toRefs, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import Description from './Description.vue';
import { remote } from '../utils/remote';
import { store } from '../store';
import Icon from './Icon.vue';
import { electron } from '../utils/node';

interface PathProps {
	name: keyof typeof store.paths;
	label: string;
	setting?: boolean;
}

const props = withDefaults(defineProps<PathProps>(), {
	setting: false
});

const emits = defineEmits<{
	(e: 'onPathChange', oldPath: string, newPath: string): void;
}>();

const { label, name, setting } = toRefs(props);
const { shell } = electron;

const realPath = ref('');

onMounted(async () => {
	realPath.value = store.paths[name.value] ? await remote.path.call('resolve', store.paths[name.value]) : '无';
});

async function change(name: keyof typeof store.paths) {
	if (setting.value) {
		const res = await remote.dialog.call('showOpenDialogSync', {
			properties: ['openDirectory'],
			defaultPath: realPath.value
		});
		if (res) {
			const target = res[0];
			// 可写性探测：拒绝系统保护目录，避免后续缓存写入失败/启动崩溃
			if (!(await testDirWritable(target))) {
				Message.error('该目录没有写入权限，请选择当前用户有写入权限的目录（如用户主目录下的文件夹）。');
				return;
			}
			const original = store.paths[name];
			realPath.value = target;
			store.paths[name] = target;
			emits('onPathChange', original, target);
		}
	}
}

/** 目录可写性探测：尝试创建并删除一个临时文件（目录存在不代表可写） */
async function testDirWritable(dir: string): Promise<boolean> {
	try {
		const probe = await remote.path.call('join', dir, `.ocs-write-test-${Date.now()}`);
		await remote.fs.call('writeFileSync', probe, '');
		await remote.fs.call('rmSync', probe, { force: true });
		return true;
	} catch {
		return false;
	}
}
</script>

<style scoped lang="less"></style>

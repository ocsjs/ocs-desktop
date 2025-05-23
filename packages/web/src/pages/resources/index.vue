<template>
	<div class="p-3">
		<div class="text-secondary markdown mb-2">
			以下是官方提供的资源软件，你可以安装以下使你的浏览器具备更多的功能。<br />
			<code>用户脚本管理器</code> 只能安装一个，否则可能造成脚本之间的冲突。
		</div>

		<div class="mb-2">
			<a-space>
				<a-button
					size="mini"
					@click="openDownloadFolder"
				>
					<a-space> <icon-folder /> 打开资源文件夹 </a-space>
				</a-button>
				<a-button
					size="mini"
					@click="showHowToLoadOtherExtension"
				>
					<a-space> <icon-question-circle /> 如何加载其他拓展？ </a-space>
				</a-button>
			</a-space>
		</div>

		<template v-if="resourceGroups.length === 0">
			<a-empty description="暂无资源" />
		</template>

		<template
			v-for="(group, index) of resourceGroups"
			:key="index"
		>
			<a-card
				:title="group.description"
				class="rounded mb-3"
			>
				<!-- 列出所有资源 -->
				<template
					v-for="(file, i) of group.files"
					:key="i"
				>
					<div class="d-flex mb-2 align-items-center">
						<div style="flex: 0 0 48px">
							<template v-if="file.icon">
								<img
									width="32"
									height="32"
									:src="file.icon"
								/>
							</template>
							<template v-else>
								<div class="d-flex align-items-center">
									<Icon
										class="fs-1"
										type="grid_4x4"
									></Icon>
								</div>
							</template>
						</div>
						<div style="flex: 1 1 auto">
							<a-space>
								<!-- 显示名字，主页，描述 -->
								<a
									v-if="file.homepage"
									:href="file.homepage"
									target="_blank"
								>
									{{ file.name }}
								</a>
								<span v-else>
									{{ file.name }}
								</span>

								<span v-if="file.description">
									<!-- 如果超出一行，就显示省略号 -->
									<template v-if="file.description.length > 50">
										<a-tooltip :content="file.description">
											<span>{{ file.description.slice(0, 50) }}...</span>
										</a-tooltip>
									</template>
									<template v-else> {{ file.description }} </template>
								</span>
							</a-space>
						</div>
						<div
							v-if="fileStatus[file.url]"
							style="flex: 0 0 64px"
							class="d-flex justify-content-center"
						>
							<a-space>
								<template v-if="fileStatus[file.url].exists || fileStatus[file.url].downloadRate === 100">
									<a-button
										size="medium"
										type="outline"
										status="danger"
										@click="remove(group.name, file)"
									>
										卸载
									</a-button>
								</template>

								<template v-else>
									<template v-if="fileStatus[file.url].downloadRate !== 0">
										<a-progress
											size="mini"
											status="normal"
											:percent="fileStatus[file.url].downloadRate"
										/>
									</template>
									<template v-else-if="fileStatus[file.url].unzipping">
										<span> 解压中... </span>
									</template>
									<template v-else>
										<!-- 当有其他脚本管理器正在下载时，禁用其他脚本管理器软件的下载 -->
										<a-button
											:disabled="group.name === 'extensions' && downloadingExtensionsFiles.length !== 0"
											size="medium"
											type="outline"
											@click="download(group.name, file)"
										>
											安装
										</a-button>
									</template>
								</template>
							</a-space>
						</div>
					</div>
				</template>
			</a-card>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue';
import { OCSApi, ResourceFile, ResourceGroup } from '@ocs-desktop/common/src/api';
import { resourceLoader } from '../../utils/resources.loader';
import Icon from '../../components/Icon.vue';
import { store } from '../../store/index';
import { Message, Modal } from '@arco-design/web-vue';
import { child_process, electron } from '../../utils/node';
import { remote } from '../../utils/remote';

const { ipcRenderer } = electron;

type FileState = Record<string, { exists: boolean; downloading: boolean; unzipping: boolean; downloadRate: number }>;

const resourceGroups = ref<ResourceGroup[]>([]);
const fileStatus = reactive<FileState>({});

// 正在下载的脚本管理器文件
const downloadingExtensionsFiles = ref<ResourceFile[]>([]);

onMounted(() => {
	OCSApi.getInfos().then(async (result) => {
		resourceGroups.value = result.resourceGroups.filter((g) => g.showInResourcePage);

		// 加载状态
		for (const group of result.resourceGroups) {
			for (const file of group.files) {
				fileStatus[file.url] = {
					exists: resourceLoader.isZipFile(file)
						? await resourceLoader.isZipFileExists(group.name, file)
						: await resourceLoader.isExists(group.name, file),
					downloading: false,
					unzipping: false,
					downloadRate: 0
				};
			}
		}
	});
});

async function download(group_name: string, file: ResourceFile) {
	// 如果group分组是 extensions 只能安装一个
	if (group_name === 'extensions') {
		const group = resourceGroups.value.filter((g) => g.name === 'extensions');
		if (group[0].files.some((f) => fileStatus[f.url].exists)) {
			Message.warning('脚本管理器只能安装一个。如需切换请把另外的删除后再安装。');
			return;
		}

		downloadingExtensionsFiles.value.push(file);
	}

	try {
		const files = await resourceLoader.list();

		for (const localFile of files) {
			// 如果存在前缀同名的文件，但是删除后不为空，说明是不同版本的文件，需要删除（历史遗留问题，之前的文件并没有id区分）
			if (localFile.filename.startsWith(file.id) && localFile.filename.replace(file.id, '').trim() !== '') {
				await remote.fs.call('rmSync', localFile.path, {
					recursive: true
				});
			}
		}

		const listener = (e: any, channel: string, rate: number) => {
			fileStatus[file.url].downloadRate = rate;
		};

		// 监听下载进度
		ipcRenderer.on('download', listener);
		try {
			fileStatus[file.url].downloading = true;
			await resourceLoader.download(group_name, file);
			fileStatus[file.url].downloading = false;
			fileStatus[file.url].downloadRate = 0;

			if (resourceLoader.isZipFile(file)) {
				fileStatus[file.url].unzipping = true;
				Message.info(`正在解压：${file.name}`);
				await resourceLoader.unzip(group_name, file);
				fileStatus[file.url].unzipping = false;
			}

			fileStatus[file.url].exists = true;
		} catch (err) {
			// @ts-ignore
			Message.error('下载错误 ' + err.message);
		}
		Message.success(`${file.name} 下载完成`);
		ipcRenderer.removeListener('download', listener);
	} catch (err) {
		// @ts-ignore
		Message.error('下载错误 ' + err.message);
	}

	downloadingExtensionsFiles.value = downloadingExtensionsFiles.value.filter((f) => f.url !== file.url);
}

async function remove(group_name: string, file: ResourceFile) {
	try {
		await resourceLoader.remove(group_name, file);
		fileStatus[file.url].exists = false;
	} catch (err) {
		// @ts-ignore
		Message.error('删除错误 ' + err.message);
	}
}

function showHowToLoadOtherExtension() {
	Modal.info({
		content: () =>
			h('div', [
				'加载原理；浏览器启动时会默认加载资源文件夹中 extensions 下面的所有文件夹拓展。',
				h('br'),
				' 所以步骤如下：',
				h('br'),
				'1. 浏览器中打开拓展管理，查看需要安装到软件的拓展ID，找到本地对应的拓展文件夹（指的是文件夹里面有 manifest.json 文件的才算一个拓展文件夹，这里不过多阐述查找办法，请百度）',
				h('br'),
				'2. 将拓展文件复制粘贴到左侧按钮显示的文件夹里的 extensions 文件夹即可。'
			])
	});
}

function openDownloadFolder() {
	if (process.platform === 'win32') {
		// 如果使用下面那个方法的话不会出现在最前面
		child_process.exec(`explorer.exe "${store.paths.downloadFolder}"`);
	} else {
		electron.shell.openPath(store.paths.downloadFolder);
	}
}
</script>

<style scoped lang="less"></style>

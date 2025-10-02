import { Message } from '@arco-design/web-vue';
import { resourceLoader } from './resources.loader';
import { notify } from './notify';
import { ResourceFile } from '@ocs-desktop/common/src/api';

type Extension = ResourceFile & {
	installed?: boolean;
};

// 下载拓展
export async function installExtensions(
	extensions: Extension[],
	extension: Extension,
	options?: { force_install: boolean }
) {
	if (!options?.force_install && extensions.filter((e) => e.installed).length > 0) {
		Message.success({
			content: `脚本管理器 ${extension.name} 已下载`,
			duration: 10 * 1000
		});
		return;
	}

	await resourceLoader.download('extensions', extension);

	notify('文件解压', `${extension.name} 解压中...`, 'download-file-' + extension.name, {
		type: 'info',
		duration: 0
	});

	const filepath = await resourceLoader.unzip('extensions', extension);

	notify('文件下载', `${extension.name} 下载完成！`, 'download-file-' + extension.name, {
		type: 'success',
		duration: 3000
	});

	extension.installed = true;
	return filepath;
}

import { Message } from '@arco-design/web-vue';
import { notify } from './notify';
import { remote } from './remote';
import { ResourceFile } from '@ocs-desktop/common/web';

type Extension = ResourceFile & {
	installed?: boolean;
};

/**
 * 安装脚本管理器拓展（内置随包发版模式）。
 *
 * 拓展 zip 在构建期从官方渠道获取、SHA256 钉值校验后打入 asar
 * （完整性由 asar fuse + 安装包签名背书），此处仅调用主进程从 asar 释放并做
 * 逐文件完整性校验，无任何网络下载；拓展更新跟随 App 发版。
 */
export async function installExtensions(
	extensions: Extension[],
	extension: Extension,
	options?: { force_install: boolean }
) {
	if (!options?.force_install && extensions.filter((e) => e.installed).length > 0) {
		Message.success({
			content: `脚本管理器 ${extension.name} 已安装`,
			duration: 10 * 1000
		});
		return;
	}

	notify('拓展安装', `${extension.name} 安装中...`, 'download-file-' + extension.name, {
		type: 'info',
		duration: 0
	});

	const filepath: string = await remote.methods.call('installBundledExtension', extension.id);

	notify('拓展安装', `${extension.name} 安装完成！`, 'download-file-' + extension.name, {
		type: 'success',
		duration: 3000
	});

	extension.installed = true;
	return filepath;
}

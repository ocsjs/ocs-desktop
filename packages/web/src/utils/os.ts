import { bridge } from './bridge';

/** 缓存：系统版本在会话内不变，避免重复 IPC */
let cachedRelease: string | undefined;

/** 获取 windows 版本号 */
export async function getWindowsRelease() {
	const release = cachedRelease ?? (cachedRelease = await bridge.os.release());

	if (release.startsWith('6.1')) {
		return 'win7';
	} else if (parseInt(release.split('.').at(-1) || '0') > 22000) {
		return 'win11';
	} else {
		return 'win10';
	}
}

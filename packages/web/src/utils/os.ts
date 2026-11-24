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

/** 是否 Windows 7 平台（非 win32 平台恒为 false） */
export async function isWin7Platform(): Promise<boolean> {
	if ((await bridge.os.platform()) !== 'win32') return false;
	return (await getWindowsRelease()) === 'win7';
}

/**
 * 内置拓展命名空间 API（bridge.bundledExtensions.*，契约见 common types.ts BundledExtensionsApi）。
 *
 * 集中内置拓展的列举/安装/卸载/检测/完整性校验，替代 methods 域下的平铺方法。
 * 实现即真相源：键集由 common remote.whitelists.ts 的 bundledExtensionsWhitelist 收敛，
 * 运行时 guard/自省/类型三方一致。
 */
import type { BundledExtensionsApi } from '@ocs-desktop/common';
import {
	getBundledExtensions,
	installBundledExtension,
	removeBundledExtension,
	isBundledExtensionInstalled,
	ensureExtensionsIntegrity
} from './bundled';

export const bundledExtensionsApi: BundledExtensionsApi = {
	list: () => getBundledExtensions(),
	install: (extensionId: string) => installBundledExtension(extensionId),
	remove: (extensionId: string) => removeBundledExtension(extensionId),
	isInstalled: (extensionId: string) => isBundledExtensionInstalled(extensionId),
	verifyIntegrity: () => ensureExtensionsIntegrity()
};

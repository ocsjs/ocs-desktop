import { remote } from './remote';
import { store, StoreUserScript } from '../store';

/**
 * 将 .user.js 链接转换为 .meta.js 链接，并移除 version 查询参数
 * 例：https://greasyfork.org/scripts/123/foo.user.js?version=2.0
 *   → https://greasyfork.org/scripts/123/foo.meta.js
 */
export function getMetaUrl(codeUrl: string): string {
	if (!codeUrl) return codeUrl;
	// 移除 ?version=xxx 查询参数，meta 只关心最新版本
	const url = new URL(codeUrl);
	url.searchParams.delete('version');
	// 替换 .user.js 为 .meta.js
	const href = url.toString();
	if (href.endsWith('.user.js')) {
		return href.replace(/\.user\.js$/, '.meta.js');
	}
	// URL 不以 .user.js 结尾，可能不支持 meta.js 约定
	return href;
}

/**
 * 从 meta.js 文本内容中解析 @version 字段
 * 复用与 user-scripts.ts 相同的正则逻辑
 */
export function parseVersionFromMeta(metaText: string): string | undefined {
	const metadata = metaText.match(/\/\/\s+==UserScript==([\s\S]+)\/\/\s+==\/UserScript==/)?.[1] || '';
	if (metadata === '') return undefined;

	const metadataList = (metadata.match(/\/\/\s+@(.+?)\s+(.*?)(?:\n|$)/g) || []).map((line) => {
		const words = line.match(/[\S]+/g) || [];
		return {
			key: (words[1] || '').replace('@', ''),
			value: words.slice(2).join(' ')
		};
	});

	const getVersion = (key: string) => {
		return metadataList.filter((l) => l.key === key).map((l) => l.value);
	};

	return getVersion('version')[0];
}

export interface FetchVersionResult {
	/** 解析到的远程版本号 */
	version: string | undefined;
	/**
	 * meta.js 是否可用
	 * - true: 正常获取到 meta.js（无论是否解析出 version）
	 * - false: meta.js 返回 404/403，说明该脚本源当前不支持 meta 约定
	 * - undefined: 网络异常等暂时性错误，下次仍需重试
	 */
	metaSupported: boolean | undefined;
}

/**
 * 获取远程脚本的最新版本号（通过 .meta.js）
 *
 * 返回结果区分三种情况：
 * - metaSupported=true + version 有值：正常拿到版本号
 * - metaSupported=false：该脚本源当前不支持 .meta.js 约定（404/403），本次降级处理
 * - metaSupported=undefined：网络异常等暂时性错误，仍可重试
 */
export async function fetchRemoteVersion(codeUrl: string): Promise<FetchVersionResult> {
	const metaUrl = getMetaUrl(codeUrl);
	console.log('脚本更新 meta-url', metaUrl);
	try {
		const res = await remote.methods.call('getWithStatus', metaUrl);
		console.log('脚本更新 res', res);
		// 区分 HTTP 状态码
		const status: number | undefined = res?.status;
		if (status === 404 || status === 403) {
			// 脚本源当前不支持 .meta.js 约定
			return { version: undefined, metaSupported: false };
		}
		if (status && (status < 200 || status >= 300)) {
			// 其他 HTTP 错误（5xx 等），视为暂时性错误
			return { version: undefined, metaSupported: undefined };
		}
		// 正常响应（2xx）
		const metaText = res?.data;
		if (typeof metaText === 'string') {
			const version = parseVersionFromMeta(metaText);
			return { version, metaSupported: true };
		}
		return { version: undefined, metaSupported: true };
	} catch (e) {
		// 网络异常，视为暂时性错误
		return { version: undefined, metaSupported: undefined };
	}
}

/**
 * 轻量級版本比较函数，按 "." 分割逐段比较数值
 * 返回 -1 表示 v1 < v2，0 表示相等，1 表示 v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
	const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);
	const maxLen = Math.max(parts1.length, parts2.length);

	for (let i = 0; i < maxLen; i++) {
		const n1 = parts1[i] ?? 0;
		const n2 = parts2[i] ?? 0;
		if (n1 > n2) return 1;
		if (n1 < n2) return -1;
	}
	return 0;
}

/**
 * 从 code_url 中提取 ?version=xxx 参数
 * 如果存在，说明用户指定了该版本
 *
 * 版本号可能包含字母、点号、连字符、逗号等，如 1.0.0-beta、2.0a、1,0,0
 * 因此匹配到下一个 & 或字符串结尾为止，而非限定字符集
 */
export function getSpecifiedVersion(codeUrl: string): string | undefined {
	if (!codeUrl) return undefined;
	const match = codeUrl.match(/[?&]version=([^&]+)/);
	return match ? decodeURIComponent(match[1]) : undefined;
}

/** 需要安装的脚本项，携带确定的最新版本号 */
export interface ScriptToInstall {
	script: StoreUserScript;
	/** 确定的最新版本号，浏览器安装成功后用于更新 lastInstalledVersion */
	latestVersion: string;
}

/**
 * 过滤出需要安装/更新的脚本
 *
 * 判定逻辑：
 * 1. isLocalScript → 始终安装（本地脚本可能被修改了）
 * 2. 强制安装开关开启 → 始终安装
 * 3. lastInstalledVersion 未设置 → 始终安装（首次安装）
 * 4. code_url 含 ?version=xxx（用户指定了版本）→ 比较 lastInstalledVersion 与指定版本，不同则安装
 * 5. 其他网络脚本 → fetchRemoteVersion 获取远程最新版本 → 与 lastInstalledVersion 比较
 * 6. meta.js 返回 404/403 → 使用 info.version（本地缓存）与 lastInstalledVersion 比对
 * 7. 暂时性网络异常 → 降级为安装（保守策略）
 */
export async function filterScriptsNeedingInstall(scripts: StoreUserScript[]): Promise<ScriptToInstall[]> {
	const forceUpdate = store.render.setting.browser.forceUpdateScript;
	const result: ScriptToInstall[] = [];

	for (const script of scripts) {
		const codeUrl = script.info?.code_url || script.url;

		// 1. 本地脚本始终安装
		if (script.isLocalScript) {
			result.push({ script, latestVersion: script.info?.version || '' });
			continue;
		}

		// 2. 强制安装模式始终安装
		if (forceUpdate) {
			result.push({ script, latestVersion: script.info?.version || '' });
			continue;
		}

		// 3. 从未安装过 → 首次安装
		if (!script.lastInstalledVersion) {
			result.push({ script, latestVersion: script.info?.version || '' });
			continue;
		}

		// 4. 用户指定了版本 → 比较已安装版本与指定版本，不同则安装
		const specifiedVersion = getSpecifiedVersion(codeUrl);
		if (specifiedVersion) {
			if (compareVersions(script.lastInstalledVersion, specifiedVersion) !== 0) {
				result.push({ script, latestVersion: specifiedVersion });
			}
			continue;
		}

		// 5, 6, 7. 获取远程最新版本
		const fetchResult = await fetchRemoteVersion(codeUrl);

		if (fetchResult.metaSupported === false) {
			// 6. 404/403：脚本源当前不支持 meta.js，使用本地缓存的 info.version 做比对
			const cachedVersion = script.info?.version;
			if (cachedVersion && compareVersions(script.lastInstalledVersion, cachedVersion) === 0) {
				// 本地缓存的版本与已安装版本一致，无需安装
				continue;
			}
			// 版本不同或无缓存 → 安装
			result.push({ script, latestVersion: cachedVersion || '' });
			continue;
		}

		if (fetchResult.version === undefined) {
			// 7. 暂时性网络异常 → 保守策略，仍然安装
			result.push({ script, latestVersion: script.info?.version || '' });
			continue;
		}

		// 5. meta.js 成功获取到版本号，与已安装版本比较
		if (compareVersions(script.lastInstalledVersion, fetchResult.version) !== 0) {
			result.push({ script, latestVersion: fetchResult.version });
		}
	}

	return result;
}

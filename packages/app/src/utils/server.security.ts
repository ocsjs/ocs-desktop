import path from 'path';

/**
 * 本地服务安全判定工具（纯函数，可单测）
 *
 * 背景：本地服务（15319）曾存在任意文件读取漏洞（/api/local-userscript），
 * 此处收敛其白名单判定逻辑。
 * （/proxy 开放代理端点已随零消费方清理移除；其 SSRF 私网拦截函数
 *   isPrivateIp/isPrivateTarget 一并移除，若未来恢复 /proxy 可从 git 历史找回。）
 */

/**
 * /api/local-userscript 路径白名单判定
 *
 * 仅放行两类 .user.js 文件：
 * 1. 预下载目录（temp/ocs-userscripts）内的文件（远程脚本预下载后供扩展拦截安装）
 * 2. 用户通过「添加本地脚本」显式注册的路径（render.scripts 中 isLocalScript 条目）
 *
 * 防 `..` 穿越：path.resolve 规范化；防兄弟目录前缀混淆：root 比较带 path.sep；
 * Windows/macOS 文件系统大小写不敏感：比较前归一小写防误拒。
 */
export function isAllowedUserscriptPath(
	rawPath: unknown,
	predownloadDir: string,
	registeredScripts: { isLocalScript?: boolean; url?: string; info?: { code_url?: string } }[]
): boolean {
	if (typeof rawPath !== 'string' || !rawPath) return false;
	const normalize = (p: string) => {
		const resolved = path.resolve(p);
		return process.platform === 'linux' ? resolved : resolved.toLowerCase();
	};
	const filePath = normalize(rawPath);
	if (!filePath.endsWith('.user.js')) return false;
	if (filePath.startsWith(normalize(predownloadDir) + path.sep)) return true;
	return registeredScripts.some(
		(s) =>
			!!s?.isLocalScript &&
			[s.info?.code_url, s.url]
				.filter((p): p is string => typeof p === 'string' && !!p)
				.some((p) => normalize(p) === filePath)
	);
}

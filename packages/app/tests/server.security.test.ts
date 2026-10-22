import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { isAllowedUserscriptPath } from '../src/utils/server.security';

// ── 本地服务安全判定单测（P0 加固：/api/local-userscript 任意文件读取白名单） ──
// 注：/proxy 端点已移除（零消费方），其 SSRF 判定函数与测试一并移除。

describe('isAllowedUserscriptPath：local-userscript 路径白名单', () => {
	const predownloadDir = path.join(os.tmpdir(), 'ocs-userscripts');
	const registered = [
		{ isLocalScript: true, url: path.join('D:', 'scripts', 'my.user.js'), info: {} },
		{ isLocalScript: false, url: 'https://greasyfork.org/scripts/1/x.user.js', info: {} }
	];

	it('放行预下载目录内的 .user.js', () => {
		expect(isAllowedUserscriptPath(path.join(predownloadDir, 'abc.user.js'), predownloadDir, registered)).toBe(true);
	});

	it('放行用户注册的本地脚本路径', () => {
		expect(isAllowedUserscriptPath(path.join('D:', 'scripts', 'my.user.js'), predownloadDir, registered)).toBe(true);
	});

	it('拦截任意系统路径（任意文件读取漏洞回归）', () => {
		for (const p of [
			'C:/Users/x/.ssh/id_rsa.user.js',
			'/etc/passwd.user.js',
			path.join(os.tmpdir(), 'other-dir', 'evil.user.js')
		]) {
			expect(isAllowedUserscriptPath(p, predownloadDir, registered), p).toBe(false);
		}
	});

	it('拦截非 .user.js 后缀（白名单内目录也不例外）', () => {
		expect(isAllowedUserscriptPath(path.join(predownloadDir, 'evil.txt'), predownloadDir, registered)).toBe(false);
		expect(isAllowedUserscriptPath(path.join('D:', 'scripts', 'my.js'), predownloadDir, registered)).toBe(false);
	});

	it('拦截 .. 目录穿越', () => {
		const traversal = path.join(predownloadDir, '..', '..', 'secret.user.js');
		expect(isAllowedUserscriptPath(traversal, predownloadDir, registered)).toBe(false);
	});

	it('拦截兄弟目录前缀混淆（ocs-userscripts-evil ≠ ocs-userscripts）', () => {
		const sibling = path.join(os.tmpdir(), 'ocs-userscripts-evil', 'x.user.js');
		expect(isAllowedUserscriptPath(sibling, predownloadDir, registered)).toBe(false);
	});

	it('拦截空值与非字符串', () => {
		expect(isAllowedUserscriptPath('', predownloadDir, registered)).toBe(false);
		expect(isAllowedUserscriptPath(undefined, predownloadDir, registered)).toBe(false);
		expect(isAllowedUserscriptPath(null, predownloadDir, registered)).toBe(false);
	});

	it('Windows/macOS 下路径比较忽略大小写', () => {
		if (process.platform === 'linux') return; // Linux 文件系统大小写敏感，跳过
		const mixedCase = path.join('D:', 'SCRIPTS', 'MY.user.js');
		expect(isAllowedUserscriptPath(mixedCase, predownloadDir, registered)).toBe(true);
	});
});

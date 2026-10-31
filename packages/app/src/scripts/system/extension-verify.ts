import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BrowserContext } from 'playwright-core';
import { SystemAutomationScript } from '@ocs-desktop/common';
import { sleep } from './utils';

/** 将 SHA256 摘要前 16 字节按 Chromium 规则映射为扩展 ID（每 4bit nibble -> 'a'-'p'） */
export function hashToExtensionId(hash: Buffer): string {
	let id = '';
	for (let i = 0; i < 16; i++) {
		id += String.fromCharCode('a'.charCodeAt(0) + (hash[i] >> 4));
		id += String.fromCharCode('a'.charCodeAt(0) + (hash[i] & 0xf));
	}
	return id;
}

/**
 * 计算扩展的所有候选 Chrome Extension ID：
 * 1. manifest.json 含 key（脚本猫/油猴等商店分发包）：ID 由公钥推导 ——
 *    SHA256(base64 解码的 DER 公钥)，与安装路径无关（已经实测验证）。
 * 2. 无 key 的未打包扩展：按路径推导。编码规则随平台（FilePath.value() 的字节形态）：
 *    - Windows：SHA256(路径 UTF-16LE 字节)，Chrome 先把正斜杠规范化为反斜杠、大小写保留
 *      （CfT 137/152 实测验证：utf16le('C:\\...\\scriptcat') 与实际派生 ID 一致）；
 *    - macOS/Linux：SHA256(路径 UTF-8)。
 *    另保留 UTF-8 变体作为候选兜底，覆盖历史版本/特殊环境（符号链接/短路径）差异。
 */
export function computeExtensionIdCandidates(extensionPath: string): string[] {
	const ids = new Set<string>();
	try {
		const manifestPath = path.join(extensionPath, 'manifest.json');
		if (fs.existsSync(manifestPath)) {
			const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
			if (typeof manifest.key === 'string' && manifest.key) {
				ids.add(hashToExtensionId(crypto.createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest()));
			}
		}
	} catch {
		// manifest 读取/解析失败：仅使用路径推导
	}
	const fwd = extensionPath.replace(/\\/g, '/');
	// 仅驱动器号小写（新版 Chromium）与全路径小写（旧版）两种规范化，均覆盖正/反斜杠
	const driveLower = (s: string) => (s.length > 1 && s[1] === ':' ? s[0].toLowerCase() + s.slice(1) : s);
	if (process.platform === 'win32') {
		// 主规则：规范化为反斜杠后按 UTF-16LE 字节哈希（大小写保留 + 两种小写变体兜底）
		const nativePath = fwd.replace(/\//g, '\\');
		for (const variant of [nativePath, driveLower(nativePath), nativePath.toLowerCase()]) {
			ids.add(hashToExtensionId(crypto.createHash('sha256').update(Buffer.from(variant, 'utf16le')).digest()));
		}
	}
	// UTF-8 候选兜底（mac/linux 主规则；win32 历史行为/特殊环境兼容）
	const utf8Variants =
		process.platform === 'win32'
			? [driveLower(extensionPath), driveLower(fwd), extensionPath.toLowerCase(), fwd.toLowerCase()]
			: [extensionPath, fwd];
	for (const variant of utf8Variants) {
		ids.add(hashToExtensionId(crypto.createHash('sha256').update(variant, 'utf8').digest()));
	}
	return [...ids];
}

/** 从运行中的浏览器实际解析扩展 ID（候选集 ∩ 实际出现的 chrome-extension host） */
export function resolveExtensionId(browser: BrowserContext, extensionPath: string): string | undefined {
	const candidates = computeExtensionIdCandidates(extensionPath);
	const hosts = new Set<string>();
	for (const sw of browser.serviceWorkers()) {
		if (sw.url().startsWith('chrome-extension://')) hosts.add(new URL(sw.url()).host);
	}
	for (const page of browser.pages()) {
		if (page.url().startsWith('chrome-extension://')) hosts.add(new URL(page.url()).host);
	}
	return candidates.find((c) => hosts.has(c)) ?? candidates[0];
}

/**
 * 系统自动化：验证脚本管理器拓展（油猴/脚本猫等应用中心扩展）已加载。
 * 通过检测拓展的 service worker 是否运行来判断（MV3 拓展必有 service worker），
 * 且 SW 的扩展 ID 必须匹配按路径推导的本次加载扩展之一——
 * 避免任意其他带 SW 的扩展让检查"假通过"。
 * 不读取 chrome://extensions/ 的 DOM——其页面结构随 Chrome 版本频繁变化，不稳定；
 * service worker 检测不依赖页面结构，更长久可靠。
 * 注意：开发者模式关闭时，通过 --load-extension 侧载的拓展会被 Chrome 禁用，
 * 其 service worker 不会运行，因此 service worker 存在也间接确认了开发者模式已开启。
 */
export const extensionVerifyScript = new SystemAutomationScript({
	name: 'system:extension-verify',
	order: 30,
	phase: 'launch',
	async run({ browser, extensionPaths, uid, send }) {
		// 期望 ID（候选集：manifest key 公钥推导 + 路径推导各规范化变体）-> 扩展路径，用于匹配 SW 并输出可读日志
		const expectedIds = new Map<string, string>();
		for (const p of extensionPaths) {
			for (const id of computeExtensionIdCandidates(p)) {
				expectedIds.set(id, p);
			}
		}

		const findSw = () => {
			const all = browser.serviceWorkers().filter((s) => /chrome-extension:\/\//.test(s.url()));
			const matched = all.find((s) => expectedIds.has(new URL(s.url()).host));
			return { all, matched };
		};

		// 拓展 service worker 可能在启动后短暂延迟才注册，轮询等待
		const poll = async (timeoutMs: number) => {
			const end = Date.now() + timeoutMs;
			let { all, matched } = findSw();
			while (!matched && Date.now() < end) {
				await sleep(500);
				({ all, matched } = findSw());
			}
			return { all, matched };
		};

		let { all, matched } = await poll(15 * 1000);

		if (!matched) {
			// 首轮未匹配不立即判定失败：弱机/杀软扫描可能拖慢 service worker 注册，重试一轮
			console.warn('脚本管理器拓展首轮检测未通过，等待重试（service worker 注册可能被拖慢）...');
			({ all, matched } = await poll(15 * 1000));
		}

		if (matched) {
			const id = new URL(matched.url()).host;
			console.log(
				'脚本管理器拓展加载检测通过（service worker）：',
				path.basename(expectedIds.get(id) || ''),
				matched.url()
			);
			return;
		}

		if (all.length > 0) {
			// 存在其他扩展 SW 但未匹配到脚本管理器拓展：特殊环境下 ID 推导可能不一致（符号链接/短路径）。
			// 不再静默放行：通知渲染端提示用户脚本功能可能失效
			const urls = all.map((s) => s.url());
			console.warn('检测到扩展 service worker，但未能匹配脚本管理器拓展：', urls.join('、'));
			send('extension-verify-degraded', uid, urls);
			return;
		}

		// 两轮检测均未发现任何扩展 service worker：降级为告警而非中断启动——
		// 浏览器本体仍可用，仅脚本功能缺失（用户可重启浏览器或在应用中心重装脚本管理器）
		console.error('脚本管理器拓展 service worker 未检测到（两轮共 30s），浏览器将继续启动，脚本功能不可用');
		send('extension-verify-failed', uid);
	}
});

/**
 * electron-builder Windows 签名钩子（win.sign）：将待签名文件提交 SignPath 签名后原地替换。
 *
 * 设计要点（见 .codebuddy/plans/signpath-windows-signing-integration.md §4）：
 * - 签名必须在 electron-builder 构建流程内完成（win.sign 钩子），不能构建后补签：
 *   latest.yml / .blockmap 记录产物 SHA512，补签改变哈希会导致 electron-updater 更新校验失败；
 * - 无 SIGNPATH_API_TOKEN（fork 仓库 / PR / 本地构建）→ 静默降级为不签名，不阻塞构建；
 * - 有 token 但其余 3 个环境变量缺失 → 配置不完整视为错误，抛错中断；
 * - 签名失败 → 抛错中断构建，避免未签名产物流出（临时回退方式：移除 secrets）；
 * - 仅使用 Node 22 内置 fetch/FormData/Blob，不引入第三方依赖。
 *
 * electron-builder 对 win 目标会逐文件调用本钩子（主程序 exe、卸载程序、NSIS 安装包），
 * 因此 SignPath 侧只需单 PE artifact configuration（逐文件提交，嵌套签名由 builder 自己拆分组装）。
 */
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://app.signpath.io/API/v1';
/** 轮询：5s 起步指数退避，上限 30s，总超时 15 分钟（SignPath 队列高峰期可能排队数分钟） */
const POLL_INITIAL_MS = 5 * 1000;
const POLL_MAX_MS = 30 * 1000;
const TOTAL_TIMEOUT_MS = 15 * 60 * 1000;

function log(...args) {
	console.log('[win-sign]', ...args);
}

function requiredEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`SIGNPATH_API_TOKEN 已配置但缺少环境变量 ${name}，签名配置不完整`);
	}
	return value;
}

/** 提交签名请求（multipart 上传），返回 signingRequestId */
async function submitSigningRequest(ctx) {
	const form = new FormData();
	form.append('ProjectSlug', ctx.projectSlug);
	form.append('SigningPolicySlug', ctx.policySlug);
	// 项目只有一个 artifact configuration 时 SignPath 自动选定，无需显式指定
	if (ctx.artifactConfigSlug) {
		form.append('ArtifactConfigurationSlug', ctx.artifactConfigSlug);
	}
	form.append('Artifact', new Blob([fs.readFileSync(ctx.filePath)]), path.basename(ctx.filePath));

	const res = await fetch(`${API_BASE}/${ctx.orgId}/SigningRequests`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${ctx.token}` },
		body: form
	});
	if (!res.ok) {
		throw new Error(`提交签名请求失败：HTTP ${res.status} ${await res.text()}`);
	}
	const body = await res.json();
	if (!body.signingRequestId) {
		throw new Error('提交签名请求失败：响应缺少 signingRequestId');
	}
	return body.signingRequestId;
}

/** 轮询签名请求直至 Completed；Failed/Cancelled/Denied/WaitForApproval 等终态抛错 */
async function waitForCompleted(ctx, signingRequestId) {
	const deadline = Date.now() + TOTAL_TIMEOUT_MS;
	let delay = POLL_INITIAL_MS;
	for (;;) {
		if (Date.now() > deadline) {
			throw new Error(`等待签名完成超时（${TOTAL_TIMEOUT_MS / 60000} 分钟）：${signingRequestId}`);
		}
		await new Promise((resolve) => setTimeout(resolve, delay));
		delay = Math.min(delay * 2, POLL_MAX_MS);

		const res = await fetch(`${API_BASE}/${ctx.orgId}/SigningRequests/${signingRequestId}`, {
			headers: { Authorization: `Bearer ${ctx.token}` }
		});
		if (!res.ok) {
			throw new Error(`查询签名状态失败：HTTP ${res.status} ${await res.text()}`);
		}
		const body = await res.json();
		log(`签名请求 ${signingRequestId} 状态：${body.status}`);
		if (body.status === 'Completed') {
			return;
		}
		if (body.status !== 'Queued' && body.status !== 'InProgress') {
			throw new Error(`签名请求未成功：状态 ${body.status}${body.description ? `（${body.description}）` : ''}`);
		}
	}
}

/** 下载已签名 artifact 并原地替换（先写临时文件再原子换入，防下载中断留下半截文件） */
async function downloadSignedArtifact(ctx, signingRequestId) {
	const res = await fetch(`${API_BASE}/${ctx.orgId}/SigningRequests/${signingRequestId}/SignedArtifact`, {
		headers: { Authorization: `Bearer ${ctx.token}` }
	});
	if (!res.ok) {
		throw new Error(`下载已签名文件失败：HTTP ${res.status} ${await res.text()}`);
	}
	const tempPath = ctx.filePath + '.signed.tmp';
	fs.writeFileSync(tempPath, Buffer.from(await res.arrayBuffer()));
	fs.renameSync(tempPath, ctx.filePath);
}

module.exports = async function winSign(_configuration, filePath) {
	const token = process.env.SIGNPATH_API_TOKEN;
	// fork/PR/本地构建无 secrets：静默降级为不签名（沿用 check-secrets 模式，不阻塞构建）
	if (!token) {
		return;
	}

	const ctx = {
		token,
		orgId: requiredEnv('SIGNPATH_ORGANIZATION_ID'),
		projectSlug: requiredEnv('SIGNPATH_PROJECT_SLUG'),
		policySlug: requiredEnv('SIGNPATH_POLICY_SLUG'),
		/** 可选：多 artifact configuration 时显式指定 */
		artifactConfigSlug: process.env.SIGNPATH_ARTIFACT_CONFIGURATION_SLUG || undefined,
		filePath
	};

	log(`提交 SignPath 签名：${path.basename(filePath)}（policy: ${ctx.policySlug}）`);
	const signingRequestId = await submitSigningRequest(ctx);
	log(`签名请求已创建：${signingRequestId}`);
	await waitForCompleted(ctx, signingRequestId);
	await downloadSignedArtifact(ctx, signingRequestId);
	log(`签名完成并已替换：${path.basename(filePath)}`);
};

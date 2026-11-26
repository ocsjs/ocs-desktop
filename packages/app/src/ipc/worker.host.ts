import { app, utilityProcess, UtilityProcess } from 'electron';
import path from 'path';
import { Logger } from '../logger';
import { getCurrentWebContents } from '../utils';
import { sendToRenderer } from './events';
import { NetUtils } from '../utils/net';
import type { ScriptWorkerEventPayload } from '@ocs-desktop/common';
import { OCS_CDN } from '@ocs-desktop/common';
import { getSessionCookies, setSessionCookies } from '../session/cookie-store';

const logger = Logger('script-worker-host');

/** 主进程托管的 ScriptWorker 注册表（uid → utilityProcess 句柄） */
const workers = new Map<string, UtilityProcess>();
/** 已完成 spawn 的 worker（postMessage 在 spawn 前不保证送达，须延迟发送） */
const spawned = new Set<string>();

/**
 * fork ScriptWorker 子进程（幂等：同 uid 已存在则忽略）。
 *
 * 原由渲染进程 child_process.fork 实现，迁移到主进程 utilityProcess.fork 后：
 * - 环境变量在主进程组装：process.env 完整，不再需要渲染侧 globalThis.process 拆行 hack
 *   与 getDisplayEnv 兜底（Chromium 沙箱清理的是渲染进程 env，主进程不受影响）；
 * - 渲染进程可关闭 nodeIntegration（阶段 C 目标）。
 *
 * worker 的消息/stdio/退出统一经 'script-worker' 频道转发给渲染进程（按 uid 过滤）。
 * 注意：utilityProcess 子进程通信走 process.parentPort（MessagePort），
 * 与 child_process.fork 的 process.send 不兼容——worker 侧由 worker/parent-channel.ts 双兼容适配。
 */
export async function scriptWorkerLaunch(uid: string): Promise<number> {
	// 存在同 uid 残留 worker（上次关闭挂起未退出）：先终止再启动，
	// 否则直接 return 会导致重启静默失败（浏览器永远起不来）
	if (workers.has(uid)) {
		logger.warn('检测到残留 worker，先终止再启动', { uid });
		scriptWorkerKill(uid);
	}

	// worker 为纯 Node 子进程（无 Electron session 可用），
	// 系统代理由主进程解析后经 OCS_PROXY_URL 环境变量注入（worker 侧见 scripts/utils getBase64）
	let proxyEnv: Record<string, string> = {};
	try {
		const proxy = await NetUtils.resolveProxy(OCS_CDN);
		if (proxy) {
			proxyEnv = { OCS_PROXY_URL: `http://${proxy.host}:${proxy.port}` };
		}
	} catch (e) {
		logger.warn('worker 代理解析失败，按直连启动', { error: String(e) });
	}

	const child = utilityProcess.fork(path.join(app.getAppPath(), './out/main/script.js'), [], {
		// utilityProcess 的 IPC 通道默认建立（子进程 process.parentPort 可用），
		// stdio 仅需配置 stdin/stdout/stderr（stdin 仅支持 ignore）
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, ...proxyEnv }
	});
	workers.set(uid, child);

	child.once('spawn', () => {
		spawned.add(uid);
		logger.info('script worker spawned', { uid, pid: child.pid });
	});

	const push = (payload: ScriptWorkerEventPayload) => sendToRenderer(getCurrentWebContents(), 'script-worker', payload);

	child.stdout?.on('data', (data) => push({ uid, kind: 'stdout', chunk: String(data) }));
	child.stderr?.on('data', (data) => push({ uid, kind: 'stderr', chunk: String(data) }));
	child.on('message', (msg: any) => {
		// Cookie 快照同步：拦截入主进程内存快照存储，不转发渲染层（凭证不出主进程）
		if (msg?.event === 'session-cookies-sync') {
			setSessionCookies(uid, msg.args?.[1]);
			return;
		}
		push({ uid, kind: 'message', event: msg?.event, args: msg?.args });
	});
	(child as any).on('exit', (code: number | null, signal: string | null) => {
		// 竞态防护：kill→重launch 后旧进程的 exit 晚到时，不得误删新 worker 的注册项、
		// spawn 标记，也不得向渲染端推送伪造的退出事件（会导致新 worker 消息全部黑洞）
		if (workers.get(uid) !== child) return;
		workers.delete(uid);
		spawned.delete(uid);
		// 异常退出（非 0 退出码/信号终止）落盘告警；正常退出（code 0）属预期路径不打扰
		if (code !== 0 || signal) {
			logger.warn('script worker 异常退出', { uid, pid: child.pid, code, signal });
		}
		push({ uid, kind: 'exit', code });
	});

	// 返回 pid 供调用方做代际校验（见 scriptWorkerKill 的 expectedPid）
	return child.pid ?? -1;
}

/** 向指定 worker 发送消息（worker 不存在时静默忽略，对齐原 shell.connected 守卫语义） */
export function scriptWorkerSend(uid: string, message: { event: string; args: any[] }): void {
	const child = workers.get(uid);
	if (!child) {
		// 消息静默丢弃必须留痕：worker 提前退出/未注册时的消息丢失曾导致
		// 「浏览器无响应且无任何报错」的排查困境
		logger.warn('script worker 不存在，消息被丢弃', { uid, event: message?.event });
		return;
	}
	// Cookie 下发（会话状态保持）：launch 消息附加内存快照存储快照（渲染层无感知，协议向后兼容）
	if (message.event === 'launch') {
		const cookies = getSessionCookies(uid);
		const opts = message.args?.[0];
		if (cookies?.length && opts && typeof opts === 'object') {
			message = { ...message, args: [{ ...opts, sessionCookies: cookies }] };
		}
	}
	const doSend = () => {
		try {
			child.postMessage(message);
		} catch (e) {
			logger.error('script worker 消息发送失败', { uid, event: message?.event, error: String(e) });
		}
	};
	// postMessage 在子进程 spawn 前不保证送达（官方未承诺排队），延迟到 spawn 后发送
	if (spawned.has(uid)) doSend();
	else child.once('spawn', doSend);
}

/**
 * 终止指定 worker。
 * expectedPid（代际校验）：仅终止该 pid 的 worker——过期的 close 兜底定时器
 * 会在浏览器重启后误杀同 uid 的新实例（曾导致「重启后浏览器 5s 自动关闭」）。
 */
export function scriptWorkerKill(uid: string, expectedPid?: number): void {
	const child = workers.get(uid);
	if (!child) return;
	if (expectedPid !== undefined && child.pid !== expectedPid) {
		logger.warn('scriptWorkerKill 已跳过（pid 代际不匹配，保护新实例）', { uid, expectedPid, actualPid: child.pid });
		return;
	}
	// kill 必须留痕（属非正常操作）
	logger.warn('scriptWorkerKill', { uid, pid: child.pid });
	try {
		child.kill();
	} catch {}
	workers.delete(uid);
	// 同步清理 spawn 标记：kill 后立即重 launch 时，不等旧进程 exit 再清
	spawned.delete(uid);
}

/** 应用退出前回收全部 worker（防孤儿进程占用终端/资源） */
app.on('before-quit', () => {
	for (const uid of [...workers.keys()]) {
		scriptWorkerKill(uid);
	}
});

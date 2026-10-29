import { Message } from '@arco-design/web-vue';
import { remote } from './remote';
import { processes } from './process';
import { store } from '../store';

/** 单个浏览器实例预估内存占用（MB）：Chromium 主进程 + 渲染进程 + 拓展的保守估计 */
const PER_BROWSER_MEMORY_MB = 500;
/** 系统可用内存绝对下限（MB），低于即拦截 */
const MIN_FREE_MEMORY_MB = 512;
/** CPU 繁忙阈值：两次采样计算的占用率超过该值即拦截 */
const CPU_BUSY_THRESHOLD = 0.9;

export interface LaunchGuardResult {
	pass: boolean;
	/** 未通过原因（用于消息提示） */
	reason?: string;
}

/**
 * 两次 cpus() 采样差值计算 CPU 占用率。
 * os.loadavg 在 Windows 恒为 0 不可用，采样法全平台有效。
 */
async function sampleCpuUsage(intervalMs = 200): Promise<number> {
	const cpus1 = await remote.os.call('cpus');
	await new Promise((resolve) => setTimeout(resolve, intervalMs));
	const cpus2 = await remote.os.call('cpus');
	let idle = 0;
	let total = 0;
	for (let i = 0; i < Math.min(cpus1.length, cpus2.length); i++) {
		const t1 = cpus1[i].times;
		const t2 = cpus2[i].times;
		idle += t2.idle - t1.idle;
		total += t2.user + t2.nice + t2.sys + t2.idle + t2.irq - (t1.user + t1.nice + t1.sys + t1.idle + t1.irq);
	}
	return total <= 0 ? 0 : 1 - idle / total;
}

/**
 * 浏览器启动预检测：剩余内存（按运行中浏览器预留）+ CPU 负载。
 * 设置「内存检测」关闭时直接放行；检测本身异常时放行（不阻断用户操作）。
 * 批量启动逐个调用本函数：随着浏览器启动，可用内存递减，自然拦截剩余启动。
 */
export async function checkLaunchCapacity(): Promise<LaunchGuardResult> {
	if (store.render.setting.browser.memoryCheck === false) {
		return { pass: true };
	}
	try {
		const runningProcs = processes.filter((p) => p.status === 'launching' || p.status === 'launched');
		const running = runningProcs.length;
		const freeMB = Math.round((await remote.os.call('freemem')) / 1024 / 1024);

		// 单实例占用：优先用运行中浏览器的真实内存均值（worker 经 CDP 取 PID + 系统 API 汇总，定时上报），
		// 乘 1.2 预留新页面加载的增长空间；无实测数据（刚启动未上报/上报失败）时回退固定预估值。
		// freemem 已扣除运行中浏览器的当前占用，因此启动下一个只需预留单实例余量。
		const measured = runningProcs.map((p) => p.memoryUsageMB).filter((v) => v > 0);
		const measuredAvgMB = measured.length > 0 ? measured.reduce((sum, v) => sum + v, 0) / measured.length : 0;
		const perBrowserMB = measuredAvgMB > 0 ? Math.round(measuredAvgMB * 1.2) : PER_BROWSER_MEMORY_MB;

		if (freeMB < Math.max(MIN_FREE_MEMORY_MB, perBrowserMB)) {
			return {
				pass: false,
				reason:
					measuredAvgMB > 0
						? `可用内存不足：当前约 ${freeMB} MB，${running} 个浏览器运行中（实测均值约 ${Math.round(
								measuredAvgMB
						  )} MB/个）`
						: `可用内存不足：当前约 ${freeMB} MB（单个浏览器预估占用约 ${PER_BROWSER_MEMORY_MB} MB）`
			};
		}
		const cpu = await sampleCpuUsage();
		if (cpu > CPU_BUSY_THRESHOLD) {
			return {
				pass: false,
				reason: `CPU 负载过高：当前使用率约 ${Math.round(cpu * 100)}%`
			};
		}
		return { pass: true };
	} catch (e) {
		console.warn('[launch-check] 预检测异常，放行启动：', e);
		return { pass: true };
	}
}

/** 拦截提示（单个启动） */
export function warnLaunchBlocked(reason: string) {
	Message.warning(`已拦截启动：${reason}。可在 设置 → 浏览器设置 中关闭「内存检测」忽略此限制`);
}

/** 拦截提示（批量启动） */
export function warnBatchBlocked(reason: string, remaining: number) {
	Message.warning(
		`批量启动已拦截：${reason}。剩余 ${remaining} 个浏览器未启动（可在 设置 → 浏览器设置 中关闭「内存检测」忽略此限制）`
	);
}

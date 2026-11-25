import { BrowserWindow, app } from 'electron';
import child_process from 'child_process';
import { sendToRenderer } from '../ipc/events';
import { Logger } from '../logger';

const logger = Logger('resource-monitor');

/** execFile 的 Promise 包装：有 stdout 输出即采用、忽略非零退出码（PS 非终止错误会置退出码 1，输出仍有效） */
function execCmd(file: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		child_process.execFile(file, args, { timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
			if (err && !String(stdout).trim()) {
				const e = err as any;
				const tail = String(stderr || '')
					.trim()
					.slice(-200);
				e.message = `${e.message}${tail ? '\nstderr: ' + tail : ''}`;
				reject(e);
			} else {
				resolve(String(stdout));
			}
		});
	});
}

/**
 * OCS 软件整体资源占用监控（替代逐浏览器 WMI 统计）。
 *
 * 背景：worker 逐浏览器统计走 `Get-WmiObject Win32_Process` 全表扫描，低配 Win7
 * 虚拟机上单次查询可达分钟级，10s 间隔下完全不可用。改为按进程名聚合 OCS 相关
 * 进程（Electron 本体 + 全部 Chromium 内核浏览器），用 `Get-Process` 直读进程信息
 * （不经 WMI，PS 2.0 兼容，秒级返回）。
 *
 * 统计口径（与用户需求一致：软件整体占用）：
 * - 'OCS Desktop'：Electron 主进程/渲染进程/worker/GPU（同名可执行文件）
 * - 'chrome' / 'msedge'：OCS 驱动的浏览器（内置 CfT / Supermium / 系统 Chrome/Edge）
 * ⚠️ 已知口径放宽：会纳入用户自行打开的其他 Chrome/Edge 进程（无法在无父进程链的
 *    Get-Process 中区分）；Win7 场景下刷课机器通常无此干扰。
 */
export function startResourceMonitor(win: BrowserWindow) {
	if (process.platform !== 'win32') return;

	// 进程名集合：打包版为 OCS Desktop.exe；dev 模式宿主为 electron.exe
	const names = app.isPackaged ? ['OCS Desktop', 'chrome', 'msedge'] : ['OCS Desktop', 'chrome', 'msedge', 'electron'];
	const nameList = names.map((n) => `'${n}'`).join(',');
	const script = [
		`$p=@(Get-Process -ErrorAction SilentlyContinue | Where-Object { @(${nameList}) -contains $_.ProcessName })`,
		`$mem=($p|Measure-Object WorkingSet64 -Sum).Sum;if($null -eq $mem){$mem=0}`,
		`$cpu=($p|Measure-Object CPU -Sum).Sum;if($null -eq $cpu){$cpu=0}`,
		`Write-Output ($mem.ToString() + ' ' + $cpu.ToString())`
	].join(';');

	let lastSample: { time: number; cpuTime: number } | undefined;
	const sample = async () => {
		if (win.isDestroyed()) return;
		try {
			const out = await execCmd('powershell', ['-NoProfile', '-Command', script]);
			const [memBytes, cpuSeconds] = out.trim().split(/\s+/);
			const mb = Math.round((parseInt(memBytes, 10) || 0) / 1024 / 1024);
			const cpuTime = parseFloat(cpuSeconds) || 0;
			if (!mb) return;

			// CPU 占用率：两次采样的累计 CPU 时间差 / 墙钟时间（多核并行可超 100%）
			let cpuPercent = 0;
			const now = Date.now();
			if (lastSample) {
				const dt = (now - lastSample.time) / 1000;
				if (dt > 0) cpuPercent = Math.max(0, ((cpuTime - lastSample.cpuTime) / dt) * 100);
			}
			lastSample = { time: now, cpuTime };

			sendToRenderer(win.webContents, 'resource-usage', { mb, cpuPercent: Math.round(cpuPercent * 10) / 10 });
		} catch (e) {
			// 辅助指标：失败静默（仅记日志，不弹通知）
			logger.log('资源占用采样失败（已跳过）：', e instanceof Error ? e.message : String(e));
		}
	};

	sample();
	const timer = setInterval(sample, 10 * 1000);
	timer.unref?.();
	win.on('closed', () => clearInterval(timer));
}

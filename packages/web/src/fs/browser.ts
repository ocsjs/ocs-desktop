import { nextTick } from 'vue';
import { Message } from '@arco-design/web-vue';
import { store } from '../store';
import { sleep } from '../utils';
import { Process, processes, clearClosedPreview } from '../utils/process';
import { resetSearch } from '../utils/entity';
import { router } from '../route';
import { Entity } from './entity';
import { Folder, root } from './folder';
import { BrowserOptions, BrowserOperateHistory, Tag, BrowserType, EntityOptions } from './interface';
import { remote } from '../utils/remote';
import { DEFAULT_SERVER_PORT, formatExtensionArguments } from '@ocs-desktop/common/web';
import { RawAutomationScript } from '../components/automation-scripts';
import { child_process } from '../utils/node';
import { ensureEnvironmentReady } from '../utils/env-bootstrap';
import { checkLaunchCapacity, warnLaunchBlocked } from '../utils/launch-check';

export class Browser extends Entity implements BrowserOptions {
	type: BrowserType;
	tags: Tag[];
	notes: string;
	checked: boolean;
	cachePath: string;
	histories: BrowserOperateHistory[];
	parent: string;
	automationScripts: RawAutomationScript[];

	constructor(opts: BrowserOptions & EntityOptions) {
		super(opts);
		this.type = 'browser';
		this.tags = opts.tags;
		this.notes = opts.notes;
		this.checked = opts.checked;
		this.histories = opts.histories;
		this.parent = opts.parent;
		// 兼容旧字段 playwrightScripts
		this.automationScripts = opts.automationScripts ?? (opts as any).playwrightScripts ?? [];
		this.cachePath = opts.cachePath;
	}

	/**
	 *	获取浏览器文件
	 */
	static from(uid: string) {
		return root().find('browser', uid);
	}

	/**
	 * 启动浏览器
	 * @param opts.skipGuardCheck 跳过内存/CPU 预检测（批量启动由调用方统一检测后逐个点名，避免重复检测）
	 * @returns 被预检测拦截时返回 false
	 */
	async launch(opts?: { skipGuardCheck?: boolean }): Promise<number | false | undefined> {
		// 浏览器增强开启时限制并发数量：运行中（启动中+已启动）达到上限直接拒绝启动
		if (store.render.setting.browser.browserEnhancement) {
			const runningCount = processes.filter((p) => p.status === 'launching' || p.status === 'launched').length;
			if (runningCount >= 4) {
				Message.error('浏览器增强已开启：最多同时运行 4 个浏览器，请先关闭其他浏览器，或在设置中关闭浏览器增强功能');
				return;
			}
		}
		// 内存/CPU 启动预检测（设置中「内存检测」关闭时内部直接放行）
		if (!opts?.skipGuardCheck) {
			const guard = await checkLaunchCapacity();
			if (!guard.pass) {
				warnLaunchBlocked(guard.reason || '资源不足');
				return false;
			}
		}
		// 被动环境检测与自动补全：缺失浏览器/脚本管理器/官方脚本时自动安装（见 utils/env-bootstrap.ts）。
		// 浏览器二进制不可用时抛错中断启动；拓展/脚本补全失败仅告警放行（下次启动重试）
		try {
			await ensureEnvironmentReady();
		} catch (e: any) {
			Message.error('环境准备失败，已取消启动：' + (e?.message || String(e)));
			return;
		}
		const process = new Process(this, {
			executablePath: store.render.setting.launchOptions.executablePath,
			headless: false
		});
		processes.push(process);
		const reactiveProcess = Process.from(this.uid);
		if (reactiveProcess) {
			await reactiveProcess.init(console.log);
			const code = await reactiveProcess.launch();
			if (typeof code === 'number') {
				return code;
			}
		}

		this.histories.unshift({ action: '运行', time: Date.now() });
	}

	/**
	 * 仅启动浏览器，不执行其他操作
	 * 适用于模拟更真实的浏览器环境
	 */
	async onlyLaunch() {
		// 内存/CPU 启动预检测（与 launch() 一致）
		const guard = await checkLaunchCapacity();
		if (!guard.pass) {
			warnLaunchBlocked(guard.reason || '资源不足');
			return;
		}
		// 与 launch() 一致：裸启动同样需要被动环境补全（浏览器路径/脚本管理器）
		try {
			await ensureEnvironmentReady();
		} catch (e: any) {
			Message.error('环境准备失败，已取消启动：' + (e?.message || String(e)));
			return;
		}
		// 复用主进程 getExtensionPaths，确保与正常启动一致的过滤逻辑（仅含 manifest.json 的目录）
		const extensionPaths: string[] = await remote.methods.call('getExtensionPaths', store.paths.extensionsFolder);
		// 起始页：启用自定义导航页时直接以导航页 URL 启动，否则为空白页。
		const startPage =
			store.render.setting.browser.bookmarkPage.enable !== false
				? `http://localhost:${store.server.port || DEFAULT_SERVER_PORT}/index.html#/bookmarks?uid=${encodeURIComponent(
						this.uid
				  )}`
				: 'about:blank';
		const cmd = ` "${store.render.setting.launchOptions.executablePath}" ${[
			'--window-position=0,0',
			'--no-first-run',
			'--no-default-browser-check',
			`--user-data-dir="${this.cachePath}"`
		]
			.concat(formatExtensionArguments(extensionPaths))
			.join(' ')} "${startPage}"`;
		console.log(cmd);
		child_process.exec(cmd);
	}

	/** 重启浏览器 */
	async relaunch() {
		const process = Process.from(this.uid);
		await process?.close();
		/**
		 * 因为 process.close 会杀死进程，并删除 process 实例
		 * 所以重新创建 process 实例并启动
		 */
		await this.launch();
	}

	/** 关闭浏览器 */
	async close() {
		const process = Process.from(this.uid);
		await process?.close();
		this.histories.unshift({ action: '关闭', time: Date.now() });
	}

	/** 置顶浏览器 */
	bringToFront() {
		const process = Process.from(this.uid);
		process?.bringToFront();
	}

	location(): void {
		// 进入列表页
		router.push('/');
		// 关闭搜索模式
		resetSearch();
		// 设置当前文件夹
		store.render.browser.currentFolderUid = this.parent;
		nextTick(() => {
			store.render.browser.currentBrowserUid = this.uid;
			this.select();
		});
	}

	select(): void {
		store.render.browser.currentBrowserUid = this.uid;
	}

	async remove() {
		// 如果在运行（含启动中），先关闭当前浏览器
		const process = Process.fromRunning(this.uid);
		if (process) {
			await process.close();
			// 等待进程退出事件后再延迟 100ms：Windows 下浏览器进程的文件句柄
			// （缓存/Cookie 等）释放滞后于 close 事件，立即删除易触发 EPERM
			await sleep(100);
		}

		// 清理浏览器关闭后保留的预览图
		clearClosedPreview(this.uid);

		const parent = Folder.from(this.parent);
		Reflect.deleteProperty(parent?.children || {}, this.uid);

		const exists = await remote.fs.call('existsSync', this.cachePath);
		if (exists) {
			// 删除本地缓存。Chrome 子进程（crashpad/GPU/utility）退出明显滞后于主进程，
			// 目录句柄可能数秒后才释放——渐进退避重试（累计最长约 7s），
			// 仍失败则提示手动删除（浏览器已从列表移除，不影响功能）
			let lastErr: unknown;
			for (const wait of [0, 1000, 2000, 3000]) {
				if (wait) await sleep(wait);
				try {
					await remote.fs.call('rmSync', this.cachePath, { recursive: true, force: true });
					lastErr = undefined;
					break;
				} catch (e) {
					lastErr = e;
				}
			}
			if (lastErr) {
				console.error('删除浏览器缓存失败：', lastErr);
				Message.warning('浏览器缓存目录暂时被占用，删除失败，可稍后手动删除：' + this.cachePath);
			}
		}
	}

	rename(name: string): void {
		if (this.name !== name) {
			this.histories.unshift({ action: '改名', content: `${this.name} => ${name}`, time: Date.now() });
		}
		this.name = name;
		this.renaming = false;
	}

	async cleanCache() {
		try {
			await remote.fs.call('rmSync', this.cachePath, { recursive: true, force: true });
		} catch (err) {
			console.log(err);
		}
	}
}

// formatExtensionArguments 已收敛至 @ocs-desktop/common（src/utils/browser.args.ts），此处直接使用共享实现

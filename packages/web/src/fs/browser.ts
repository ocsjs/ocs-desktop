import { nextTick } from 'vue';
import { Message } from '@arco-design/web-vue';
import { store } from '../store';
import { Process, processes, clearClosedPreview } from '../utils/process';
import { resetSearch } from '../utils/entity';
import { router } from '../route';
import { Entity } from './entity';
import { Folder, root } from './folder';
import { BrowserOptions, BrowserOperateHistory, Tag, BrowserType, EntityOptions } from './interface';
import { remote } from '../utils/remote';
import { DEFAULT_SERVER_PORT } from '@ocs-desktop/common/web';
import { RawAutomationScript } from '../components/automation-scripts';
import { child_process } from '../utils/node';

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

	/** 启动浏览器 */
	async launch() {
		// 浏览器增强开启时限制并发数量：运行中（启动中+已启动）达到上限直接拒绝启动
		if (store.render.setting.browser.browserEnhancement) {
			const runningCount = processes.filter((p) => p.status === 'launching' || p.status === 'launched').length;
			if (runningCount >= 4) {
				Message.error('浏览器增强已开启：最多同时运行 4 个浏览器，请先关闭其他浏览器，或在设置中关闭浏览器增强功能');
				return;
			}
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
		// 复用主进程 getExtensionPaths，确保与正常启动一致的过滤逻辑（仅含 manifest.json 的目录）
		const extensionPaths: string[] = await remote.methods.call('getExtensionPaths', store.paths.extensionsFolder);
		// 导航页扩展：新建标签页显示导航页（chrome_url_overrides.newtab），地址栏保持空白
		// 未启用自定义导航页时跳过，浏览器保持默认空白导航页
		if (store.render.setting.browser.bookmarkPage.enable !== false) {
			const newtabExtension: string = await remote.methods.call(
				'ensureNewTabExtension',
				`${this.cachePath}/ocs-newtab`,
				{
					uid: this.uid,
					port: store.server.port || DEFAULT_SERVER_PORT
				}
			);
			extensionPaths.push(newtabExtension);
		}
		// 初始页面使用 about:blank，导航页由导航页扩展接管，避免地址栏暴露 localhost 地址
		const cmd = ` "${store.render.setting.launchOptions.executablePath}" ${[
			'--window-position=0,0',
			'--no-first-run',
			'--no-default-browser-check',
			`--user-data-dir="${this.cachePath}"`
		]
			.concat(formatExtensionArguments(extensionPaths))
			.join(' ')} about:blank`;
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
		// 如果在运行，关闭当前浏览器
		const process = Process.from(this.uid);
		if (process) {
			await process.close();
		}

		// 清理浏览器关闭后保留的预览图
		clearClosedPreview(this.uid);

		const parent = Folder.from(this.parent);
		Reflect.deleteProperty(parent?.children || {}, this.uid);

		const exists = await remote.fs.call('existsSync', this.cachePath);
		if (exists) {
			// 删除本地缓存
			await remote.fs.call('rmSync', this.cachePath, { recursive: true });
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

function formatExtensionArguments(extensionPaths: string[]) {
	const paths = extensionPaths
		.filter((f) => !f.includes('.DS_Store'))
		.map((p) => p.replace(/\\/g, '/'))
		.join(',');
	// 与主进程保持一致：--disable-extensions-except 防止 Chrome 禁用侧载扩展
	return paths.length === 0 ? [] : [`--load-extension=${paths}`, `--disable-extensions-except=${paths}`];
}

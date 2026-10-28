import { h } from 'vue';
import { Button, Message, Modal, Space } from '@arco-design/web-vue';
import { IconSync } from '@arco-design/web-vue/es/icon';
import { size, sleep } from '.';
import { remote } from './remote';
import { store } from '../store';
import { electron, inBrowser } from '../utils/node';
import { processes } from './process';
import { Folder } from '../fs/folder';
import { Browser } from '../fs/browser';
import { Entity } from '../fs/entity';
import { currentFolder } from '../fs';
import type { RawAutomationScript } from '@ocs-desktop/common/web';
import { resetSearch } from './entity';
import { ensureEnvironmentReady } from './env-bootstrap';
const { shell } = electron;

/**
 * 生成不重复的名称，如果重复则追加 (n)
 * @param baseName 基础名称，如 "未命名浏览器"
 * @param existingNames 已存在的名称列表
 * @returns 不重复的名称，如 "未命名浏览器 (2)"
 */
function generateUniqueName(baseName: string, existingNames: string[]): string {
	if (!existingNames.includes(baseName)) {
		return baseName;
	}

	// 匹配基础名称后的 (n) 后缀
	const regex = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\)$`);
	let maxN = 0;

	for (const name of existingNames) {
		const match = name.match(regex);
		if (match) {
			const n = parseInt(match[1], 10);
			if (n > maxN) {
				maxN = n;
			}
		}
	}

	return `${baseName} (${maxN + 1})`;
}

/**
 * 根据当前文件夹中已有的浏览器/文件夹名，生成不重复的浏览器默认名（如「未命名浏览器」「未命名浏览器 (2)」）。
 * 复用 newBrowser 的命名算法，供新建浏览器输入弹窗作为默认值。
 */
export function getDefaultBrowserName(baseName = '未命名浏览器'): string {
	const siblingNames = Object.values(currentFolder.value.children).map((c) => c.name);
	return generateUniqueName(baseName, siblingNames);
}

export function newFolder() {
	// 关闭搜索模式
	resetSearch();
	const id = Entity.uuid();

	const siblingNames = Object.values(currentFolder.value.children).map((c) => c.name);
	const name = generateUniqueName('未命名文件夹', siblingNames);

	const folder = new Folder({
		uid: id,
		type: 'folder',
		name,
		children: {},
		createTime: Date.now(),
		parent: currentFolder.value.uid,
		renaming: true
	});
	currentFolder.value.children[id] = folder;
}
export function newBrowser(opts?: {
	name: string;
	automationScripts?: RawAutomationScript[];
	store?: object;
}): Browser | undefined {
	if (!store?.render?.setting?.launchOptions?.executablePath) {
		Message.error('检测到浏览器路径未填写，请在左侧软件设置中设置，然后重新创建浏览器！');
		return;
	}
	// 关闭搜索模式
	resetSearch();
	const id = Entity.uuid();
	const userDataDirsFolder = store.paths.userDataDirsFolder;

	const path_sep = remote.path.get('sep');

	const siblingNames = Object.values(currentFolder.value.children).map((c) => c.name);
	const name = opts?.name
		? generateUniqueName(opts.name, siblingNames)
		: generateUniqueName('未命名浏览器', siblingNames);

	const browser = new Browser({
		type: 'browser',
		uid: id,
		name,
		checked: false,
		createTime: Date.now(),
		notes: '',
		renaming: true,
		parent: currentFolder.value.uid,
		histories: [{ action: '创建', time: Date.now() }],
		cachePath: inBrowser
			? ''
			: userDataDirsFolder.endsWith(path_sep)
			? userDataDirsFolder + id
			: userDataDirsFolder + path_sep + id,
		tags: [],
		automationScripts: opts?.automationScripts ? JSON.parse(JSON.stringify(opts?.automationScripts)) : []
	});
	currentFolder.value.children[id] = browser;
	return browser;
}

/**
 * 新建浏览器：先做被动环境检测与自动补全（复用启动链路的 ensureEnvironmentReady，
 * 避免浏览器路径未配置时流程走到「新建浏览器」步骤才报错），
 * 环境就绪后打开「新建浏览器自动初始化」弹窗并自动执行流程（新建浏览器 + 添加自动化程序）。
 * 浏览器名称由命名算法自动生成（流程内不再询问），如需自定义可在浏览器列表中重命名。
 */
export async function newBrowserOrInit(): Promise<void> {
	try {
		await ensureEnvironmentReady();
	} catch (e: any) {
		Message.error('环境准备失败，请稍后重试：' + (e?.message || String(e)));
		return;
	}
	store.render.state.newBrowserSetup = true;
}

export async function checkBrowserCaches() {
	const modal = Modal.info({
		simple: false,
		title: '正在计算浏览器缓存...',
		footer: false,
		maskClosable: false,
		content: () => {
			return h('div', [h(IconSync, { spin: true }), '正在计算浏览器缓存...']);
		}
	});
	const totalSize = await remote.methods.call('statisticFolderSize', store.paths.userDataDirsFolder);
	console.log('当前浏览器总缓存大小', size(totalSize));
	modal.close();

	showClearBrowserCachesModal(totalSize);
}

/**
 * 手动清理浏览器缓存
 * @param totalSize 浏览器缓存总大小
 */
export function showClearBrowserCachesModal(totalSize: number) {
	// 显示详情
	Modal.confirm({
		simple: false,
		title: '清除浏览器缓存',
		content: () => {
			return h('div', [
				h('p', { class: 'text-secondary' }, [
					'提示：浏览器缓存主要存储一些Cookie，网页数据，如果占用非常大可以清除，不会影响浏览器正常使用。'
				]),
				h('p', [
					'当前浏览器缓存路径：',
					store.paths.userDataDirsFolder,
					' ',
					h(Button, { type: 'text', size: 'small', onClick: () => shell.openPath(store.paths.userDataDirsFolder) }, [
						'进入缓存文件夹'
					])
				]),
				h('p', ['当前浏览器缓存总大小：', size(totalSize)])
			]);
		},
		okText: '清除缓存',
		onOk() {
			const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === 'browser') as Browser[];

			clearAllBrowserCaches(
				store.paths.userDataDirsFolder,
				browsers.map((b) => b.uid)
			);
		}
	});
}

export function clearAllBrowserCaches(userDataDirsFolder: string, uids: string[]) {
	return new Promise<void>((resolve, reject) => {
		remote.fs.call('readdirSync', userDataDirsFolder, {} as any).then(async (_dirs) => {
			try {
				const paths = [];
				const dirs = _dirs as unknown as string[];

				for (const dir of dirs) {
					if (dir && dir.trim() && uids.includes(dir.trim())) {
						paths.push(await remote.path.call('join', userDataDirsFolder, String(dir)));
					}
				}
				await Promise.all(
					paths.map((path) => {
						return remote.fs.call('rmSync', path, {
							recursive: true,
							force: true
						});
					})
				);
			} catch (err) {
				console.error(err);
				if (String(err).includes('CrashpadMetrics.pma') === false) {
					Message.error(String(err));
					reject(err);
				}
			}

			Message.success('清除浏览器缓存完成');
			resolve();
		});
	});
}

/**
 * 强制清除浏览器缓存
 * @param title 提示弹窗
 * @param browsers 需要清除的浏览器
 */
export async function forceClearBrowserCache(title: string, userDataDirsFolder: string) {
	const modal = Modal.warning({
		title: '提示',
		content: () => h('div', [h(IconSync, { spin: true }), title]),
		maskClosable: false,
		closable: false,
		footer: false
	});

	const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === 'browser');

	try {
		await clearAllBrowserCaches(
			userDataDirsFolder,
			browsers.map((b) => b.uid)
		);
	} catch (err) {
		console.error(err);
		Message.error(String(err));
	}

	await sleep(500);
	modal.close();
}

/**
 * 强制关闭所有正在运行的浏览器（不弹确认框，仅显示「关闭中」提示）。
 *
 * 最久 5 秒后强制退出软件，避免浏览器无法关闭时卡住或重复弹窗。
 */
export async function forceCloseAllBrowsers() {
	if (!processes.length) return;
	const m = Modal.info({
		content: '正在关闭所有浏览器...',
		closable: false,
		maskClosable: false,
		footer: false
	});

	// 最久5秒后强制退出软件，避免浏览器无法关闭时卡住或重复弹窗
	const timeout = setTimeout(() => remote.methods.call('quitApp', 0), 5000);
	try {
		for (const process of processes) {
			await process.close();
			await sleep(100);
		}
	} catch (err) {
		Message.error(String(err));
	}
	clearTimeout(timeout);
	m.close();
}

/**
 * 关闭所有浏览器。若有正在运行的浏览器，弹窗询问是否关闭。
 *
 * @param skipConfirm 是否跳过确认弹窗（调用方已确认过时使用，直接强制关闭）
 * @returns 是否同意关闭软件（用户取消时返回 false）
 */
export async function closeAllBrowser(skipConfirm = false) {
	if (!processes.length) return true;
	if (skipConfirm) {
		await forceCloseAllBrowsers();
		return true;
	}
	return new Promise<boolean>((resolve) => {
		Modal.warning({
			content: '还有浏览器正在运行，您确定关闭软件吗？',
			title: '警告',
			maskClosable: true,
			closable: true,
			alignCenter: true,
			hideCancel: false,
			onOk: async () => {
				await forceCloseAllBrowsers();
				resolve(true);
			},
			onCancel() {
				resolve(false);
			}
		});
	});
}

/**
 * 当「后台运行」未开启且仍有浏览器正在运行时，询问用户如何处理关闭操作。
 *
 * @returns 'exit' 关闭并退出 | 'tray' 后台运行 | 'cancel' 取消
 */
export function askCloseOrTray() {
	return new Promise<'exit' | 'tray' | 'cancel'>((resolve) => {
		let settled = false;
		let modal: { close: () => void } | null = null;
		const done = (result: 'exit' | 'tray' | 'cancel') => {
			if (settled) return;
			settled = true;
			modal?.close();
			resolve(result);
		};
		modal = Modal.warning({
			title: '提示',
			content: '检测到仍有浏览器正在运行，是否关闭并退出软件？',
			maskClosable: true,
			closable: true,
			alignCenter: true,
			escToClose: true,
			onCancel: () => done('cancel'),
			footer: () =>
				h(Space, null, [
					h(Button, { onClick: () => done('cancel') }, '取消'),
					h(Button, { type: 'primary', onClick: () => done('tray') }, '后台运行'),
					h(Button, { type: 'primary', status: 'danger', onClick: () => done('exit') }, '关闭并退出')
				])
		});
	});
}

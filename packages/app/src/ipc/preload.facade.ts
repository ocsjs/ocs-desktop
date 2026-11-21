/**
 * bridge 统一门面生成器（preload 侧，IPC 基础设施的一部分，集中维护于 src/ipc/）。
 *
 * 由 preload/index.ts 引入并注入 window.ocs；自省（ipc:introspect）取
 * 「命名空间 → 方法名清单」后循环生成，清单由主进程 ipc/register.ts 提供
 * （remoteWhitelists 唯一真相源）。
 *
 * 注意：本模块运行于 sandbox preload 环境，仅可使用 electron 等少数模块，
 * 不得引入其他运行时依赖（类型导入在编译期擦除，不受影响）。
 */
import { ipcRenderer } from 'electron';

/**
 * 将主进程序列化后的错误载荷还原为 Error 实例。
 * 主进程通过 serializeError 把 Error 拍平为 { __error, name, message, stack } 跨 IPC 传输。
 * 标记约定：err.name 置为 'OcsRemoteError'（contextBridge 跨边界仅保留 name/message/stack，
 * 自定义属性会丢失；web 侧 main.ts 全局兜底据此识别 remote 错误避免双重通知）。
 */
export function toError(payload: any): Error {
	if (payload && typeof payload === 'object' && payload.__error) {
		const err = new Error(payload.message || 'Unknown remote error');
		err.name = 'OcsRemoteError';
		if (payload.stack) err.stack = payload.stack;
		Object.assign(err, { __ocsRemote: true });
		return err;
	}
	if (payload instanceof Error) {
		payload.name = 'OcsRemoteError';
		Object.assign(payload, { __ocsRemote: true });
		return payload;
	}
	return new Error(String(payload));
}

/** invoke 包络解包（facade 各方法统一出口） */
function unwrapInvoke(payload: any): any {
	if (payload?.error) throw toError(payload.error);
	return payload?.data;
}

/** 按命名空间生成 facade（自省清单驱动，统一 -call 异步通道） */
function makeNamespace(ns: string, names: string[]) {
	return Object.fromEntries(
		names.map((name) => [
			name,
			async (...args: any[]) => unwrapInvoke(await ipcRenderer.invoke(`${ns}-call`, [name, ...args]))
		])
	);
}

/** 生成 bridge 门面对象（facade 构建期唯一一次同步 IPC，微秒级，非业务调用面） */
export function createBridge() {
	const { namespaces, methods: methodsNames } = ipcRenderer.sendSync('ipc:introspect') as {
		namespaces: Record<string, string[]>;
		methods: string[];
	};

	const bridge: Record<string, any> = {};
	for (const [ns, names] of Object.entries(namespaces)) {
		if (ns === 'electron-store') {
			// 机械转驼峰；整树读取经 methods.getStore 异步实现（写路径统一走 methods.saveStore）
			bridge.electronStore = { get: () => bridge.methods.getStore() };
			continue;
		}
		if (ns === 'logger') {
			bridge.logger = Object.fromEntries(
				names.map((level) => [
					level,
					(...msg: any[]) => {
						ipcRenderer.invoke('logger-call', [level, ...msg]).catch(() => {});
					}
				])
			);
			continue;
		}
		bridge[ns] = makeNamespace(ns, names);
	}
	bridge.methods = makeNamespace('methods', methodsNames);

	// path.sep：本地推导常量（sandbox preload 无法 require('path')，按平台推导，非 IPC）
	if (bridge.path) {
		bridge.path.sep = process.platform === 'win32' ? '\\' : '/';
	}
	return bridge;
}

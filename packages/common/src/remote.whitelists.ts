/**
 * 各命名空间允许远程访问的方法/属性白名单（唯一真相源）。
 * 由渲染端全部实际调用点收敛而来（packages/web 下 remote.<ns>.* 的完整枚举），
 * 未列出的命名空间（methods）由实现对象自有键（hasOwnProperty）判定，运行时全量放行。
 *
 * 三位一体消费（见 .codebuddy/plans/contract-codegen-plan.md）：
 * 1. 运行时分发 guard（assertRemoteAccess 的 includes 判定）
 * 2. ipc:introspect 自省输出（preload facade 生成面 = 白名单）
 * 3. tsc 声明发射的类型 Pick 键集（bridge-types.entry.ts）
 */
export const fsWhitelist = ['existsSync', 'readFileSync', 'writeFileSync', 'readdirSync', 'rmSync', 'unlinkSync', 'mkdirSync'] as const;
export const pathWhitelist = ['join', 'resolve', 'sep'] as const;
export const osWhitelist = ['platform', 'release', 'cpus', 'freemem', 'totalmem'] as const;
export const winWhitelist = ['setTitle', 'setAlwaysOnTop', 'setTitleBarOverlay'] as const;
export const webContentsWhitelist = ['copy', 'cut', 'paste', 'undo', 'redo', 'openDevTools', 'executeJavaScript'] as const;
export const appWhitelist = ['getAppPath', 'getPath', 'getVersion'] as const;
export const dialogWhitelist = ['showOpenDialog', 'showSaveDialog', 'showOpenDialogSync'] as const;
export const electronStoreWhitelist = ['store'] as const;
export const loggerWhitelist = ['error', 'info'] as const;

/** 命名空间 → 白名单数组的映射（guard 与自省通道共用） */
export const remoteWhitelists = {
	'electron-store': electronStoreWhitelist,
	fs: fsWhitelist,
	path: pathWhitelist,
	os: osWhitelist,
	win: winWhitelist,
	webContents: webContentsWhitelist,
	app: appWhitelist,
	dialog: dialogWhitelist,
	logger: loggerWhitelist
} as const;

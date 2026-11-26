/**
 * ⚠️ 本文件由 packages/app/scripts/gen-remote-contract.mjs 自动生成，请勿手工编辑。
 * 真相源：packages/app/src/ipc/methods.ts 的 methods 实现对象
 * 与 packages/common/src/remote.whitelists.ts 的白名单数组。
 * 修改实现后执行 pnpm gen:contract；CI 经 gen:contract:check 防漂移。
 */
/* eslint-disable */
/// <reference types="node" />
import type { AxiosRequestConfig } from 'axios';
import type { AppStore, RawAutomationScript } from '@ocs-desktop/common';
export declare const methods: {
    autoLaunch: () => void;
    get: (url: string, config?: AxiosRequestConfig<any> | undefined) => Promise<any>;
    /**
     * 带磁盘缓存的 GET（脚本猫/GreasyFork 等速度不稳定站点加速）：
     * TTL 内直接命中缓存；请求失败时回退过期缓存（弱网兜底）。
     * 「网络缓存加速」设置关闭时恢复原始实时加载（不读写缓存）。
     */
    cachedGet: (url: string, ttlMs: number) => Promise<any>;
    getWithStatus: (url: string, config?: AxiosRequestConfig<any> | undefined) => Promise<{
        status: number;
        data: any;
    }>;
    download: (channel: string, url: string, dest: string) => Promise<string>;
    unzip: (input: string, output: string) => Promise<void>;
    getValidBrowsers: () => import("@ocs-desktop/common").ValidBrowser[];
    getBrowserMajorVersion: (executablePath: string) => number | undefined;
    getExtensionPaths: (extensionsFolder: string) => string[];
    /** 系统自动化程序清单（开发者设置-自动化程序管理展示） */
    getSystemScripts: () => {
        name: string;
        label: string | undefined;
        phase: import("@ocs-desktop/common").SystemScriptPhase;
        order: number;
    }[];
    /**
     * 下载并安装内置浏览器（供前端「环境修复」复用多源下载，不重启应用）。
     * 进度通过 'builtin-chrome-install-progress' 事件推送。
     * @returns 安装完成后的浏览器可执行文件路径
     */
    installBuiltinChrome: () => Promise<string>;
    exportExcel: (excel: {
        sheetName: string;
        list: any[];
    }[], filename: string) => void;
    statisticFolderSize: typeof statisticFolderSize;
    getPlatform: () => NodeJS.Platform;
    /** 读取系统当前是否为深色主题（nativeTheme.themeSource 默认 system，跟随 OS） */
    getSystemDark: () => boolean;
    updateApp: () => Promise<void>;
    /** 手动检查更新（设置页「更新设置」卡片使用），返回当前/最新版本与是否有更新 */
    checkUpdate: (config?: AppStore['updater']) => Promise<{
        current: string;
        latest: string;
        hasUpdate: boolean;
        message?: undefined;
    } | {
        current: string;
        latest: string;
        hasUpdate: boolean;
        message: string;
    } | undefined>;
    /** 隐藏主窗口到系统托盘（后台运行） */
    hideToTray: () => void;
    /** 程序化退出（置位 isQuitting 后 app.exit，绕过「隐藏到托盘」） */
    quitApp: (code?: number) => void;
    /** 取消程序化退出，复位 isQuitting */
    cancelQuit: () => void;
    /** 渲染层开始处理 'close' 事件时调用，取消主进程无响应看门狗（3s 强制销毁窗口） */
    cancelCloseWatchdog: () => void;
    /** 销毁托盘图标 */
    destroyTray: () => void;
    /** 本地 OCR 识别模块是否可用（启动前环境检测：needOCR 的自动化程序依赖） */
    canOCR: () => boolean;
    /** 是否 electron-vite dev 开发模式（pnpm dev），dev 下软件无法自动重启 */
    isDevMode: () => boolean;
    /**
     * 重置设置并重启：渲染层已同步保存重置后的 store（render.setting + window 等），
     * 此处仅负责重启。通过 quitApp 程序化退出，绕过「隐藏到托盘」逻辑。
     * dev 模式（pnpm dev）下跳过 relaunch 仅退出：electron-vite 会在 quit 后杀死 dev
     * 进程，relaunch 的新实例加载已失效的 dev server 地址会变白屏僵尸窗口；
     * 渲染层负责在此之前提示用户手动重跑 pnpm dev（见 web utils/restart.ts）。
     */
    resetApp: () => void;
    /**
     * 数据加密是否可用（信封加密方案：主密钥就绪即可加密）。
     * 语义变更：历史上返回 safeStorage.isEncryptionAvailable()（Linux 无密钥环时为 false，
     * 数据明文落盘）；信封加密下 safeStorage 不可用时主密钥以 v1:plain: 明文回退存储，
     * 数据仍可 AES 加密（混淆级防护），故此处统一返回主密钥就绪状态。
     */
    isEncryptionAvailable: () => boolean;
    /** 获取本地服务访问令牌（内存态，不落盘；供渲染端注入 worker/导航页） */
    getServerToken: () => string;
    /**
     * 获取 Linux 密钥环后端（'basic_text' 表示无可用密钥环，如 gnome-keyring/kwallet）。
     * 非 Linux 平台返回 undefined（该 API 仅 Linux 有意义）。
     */
    getStorageBackend: () => "unknown" | "basic_text" | "gnome_libsecret" | "kwallet" | "kwallet5" | "kwallet6" | undefined;
    getDisplayEnv: () => Record<string, string>;
    /** HTTP 磁盘缓存统计（网络缓存加速的缓存检测） */
    httpCacheStats: () => {
        count: number;
        bytes: number;
    };
    /** HTTP 磁盘缓存统计（按站点分组） */
    httpCacheStatsBySite: () => Record<string, {
        count: number;
        bytes: number;
    }>;
    /** 清空 HTTP 磁盘缓存（siteId 为空时清空全部） */
    clearHttpCache: (siteId?: string) => void;
    /** 网站图标缓存统计（条数 + 总字节数） */
    iconCacheStats: () => {
        count: number;
        bytes: number;
    };
    /** 清空网站图标缓存（内存 + 磁盘） */
    clearIconCache: () => void;
    isDirectory: (path: string) => boolean;
    getRawScripts: () => RawAutomationScript[];
    encryptRenderString: (content: string) => string;
    decryptRenderString: (content: string) => string;
    /** 导出数据：用户密码加密（跨机器可移植，scrypt 派生密钥） */
    encryptExportString: (content: string, password: string) => string;
    /** 导入数据：用户密码解密（密码错误时 GCM 校验抛错） */
    decryptExportString: (content: string, password: string) => string;
    /** 判断导出文件中的 render 是否为密码加密格式 */
    isPasswordEncrypted: (content: string) => boolean;
    /** 读取整棵 store 树（bridge electronStore.get 的异步实现；写路径走 saveStore） */
    getStore: () => AppStore;
    /** 一次性完成加密和存储，避免二次 IPC 调用 */
    saveStore: (plainStoreJson: string, shouldEncrypt: boolean) => void;
    /**
     * 批量预下载远程用户脚本到临时目录，供本地服务器代理给拓展拦截安装。
     * 规避远程 .user.js 网络波动导致拓展拦截失败。失败项返回 success:false，调用方据此剔除并通知用户。
     */
    downloadUserscripts: (urls: string[]) => Promise<({
        url: string;
        path: string;
        success: boolean;
        error?: undefined;
    } | {
        url: string;
        path: string;
        success: boolean;
        error: any;
    })[]>;
    launchBrowserDetached: (executablePath: string, args: string[]) => void;
    scriptWorkerLaunch: (uid: string) => Promise<number>;
    scriptWorkerSend: (uid: string, message: {
        event: string;
        args: any[];
    }) => void;
    scriptWorkerKill: (uid: string, expectedPid?: number) => void;
    /** 清除内存 Cookie 快照存储（不传 uid 清空全部）。凭证仅有清除出口，无读取 API */
    clearCookieStore: (uid?: string) => void;
    shellOpenPath: (p: string) => Promise<string>;
    shellShowItemInFolder: (p: string) => void;
    shellOpenExternal: (url: string) => Promise<void>;
    clipboardWriteText: (text: string) => void;
    testMethod: () => number;
};
/** 契约类型 = 实现类型（tsc 声明发射时展平为完整结构类型，真相源唯一） */
export type RemoteMethods = typeof methods;
declare function statisticFolderSize(dir: string): Promise<number>;
export {};

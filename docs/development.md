# OCS Desktop — 项目架构与开发文档

> 项目全貌、架构机制与开发指引。编码规则（强制约束）见 `docs/code-rules.md`。

---

## 1. 项目概述

**OCS Desktop** 是一款基于 Electron + Vue 3 + Playwright 的桌面端浏览器自动化软件。核心功能：

- **浏览器多开/分身管理**：每个浏览器实例拥有独立的用户数据目录（`userDataDir`），可独立启动、关闭、重启。
- **用户脚本自动安装与更新**：通过 Playwright 控制浏览器，配合内置脚本管理器扩展（ScriptCat / Tampermonkey）自动安装 `.user.js` 脚本。
- **自动化脚本执行**：官方内置自动化脚本（超星/智慧树/ICVE/ZJY/ICourse 等登录脚本）+ 系统编排脚本（SystemScripts），沙盒化执行。
- **内置浏览器按需下载**：安装包不内置浏览器，首次启动/环境修复时从多源下载 Chrome for Testing（SHA256 校验 + 完整性自检）。
- **浏览器监控**：CDP 推流（screencast）实时预览浏览器画面。
- **双模式界面**：简洁模式（simple）与专业模式（professional）。

### 技术栈

| 层级       | 技术                                                  |
| ---------- | ----------------------------------------------------- |
| 框架       | Electron 43 + Vue 3.3                                 |
| 构建       | electron-vite 2（主/preload/renderer）+ electron-builder 26 |
| 自动化     | Playwright Core 1.52（pnpm catalog 统一管理）          |
| UI 组件库  | Arco Design Vue 2.42                                  |
| 路由       | Vue Router 4（Hash 模式）                              |
| 状态管理   | Vue reactive（无 Vuex/Pinia）                          |
| 本地存储   | electron-store 8（StoreData 封装）                     |
| 加密       | 信封加密：自管理 AES-256-GCM 主密钥 + safeStorage 包裹  |
| 自动更新   | electron-updater（generic 源 cdn.ocsjs.com）           |
| 包管理     | pnpm 10 workspace（catalog 统一依赖版本）               |
| 语言       | TypeScript（严格模式）                                 |
| 代码规范   | ESLint(standard) + Prettier + Husky + CommitLint      |
| 测试       | vitest（common + app）                                 |

### 运行环境

- Node.js >= 22.0.0，pnpm >= 10.0.0
- 支持 Windows / macOS / Linux
- 内置浏览器 Chrome for Testing 137.0.7151.55（版本严格锁定，见 §4）

## 2. 项目结构

```
ocs-desktop/
├── packages/
│   ├── app/          # Electron 主进程（@ocs-desktop/app）
│   ├── web/          # 渲染进程 Vue 应用（@ocs-desktop/web）
│   └── common/       # 共享代码（@ocs-desktop/common，三出口：. /web /node）
├── docs/             # 项目文档（本文件、code-rules.md）
├── scripts/          # 仓库级脚本（build-app.js、chrome.install.js 维护脚本等）
├── releases/         # electron-builder 产物输出目录
├── AGENTS.md         # AI 工具统一入口（引用 docs/ 下两个文档）
└── CLAUDE.md         # Claude Code 入口（引用 AGENTS.md）
```

### 2.1 packages/app — 主进程

```
packages/app/
├── index.ts                 # 入口：bootstrap 启动编排
├── electron.vite.config.ts  # electron-vite 配置（main/preload/renderer 三段）
├── electron.builder.json    # 打包配置（asar+fuses、files、nsis/dmg/AppImage）
├── tsconfig.contract.json   # 契约生成专用最小工程
├── scripts/                 # gen-remote-contract.mjs（契约生成）、fetch-extensions.js、before-pack.js
├── resources/extensions/    # 内置扩展锁定清单（extensions.lock.json 入库，zip/manifest 产物不入库）
└── src/
    ├── window.ts            # createWindow（主窗口）/createLoadingWindow（初始化闪屏）
    ├── tray.ts              # 托盘与程序化退出标记（isQuitting/quitApp/cancelQuit）
    ├── close.watchdog.ts    # 关闭流程 3s 无响应看门狗
    ├── store.ts             # StoreData（electron-store 唯一公开入口，进程内缓存）
    ├── crypto.ts            # 信封加密（主密钥 + safeStorage 包裹 + 密码导出加密）
    ├── preload/             # index.ts（window.ocs 门面注入）、loading.ts（window.ocsInit）
    ├── ipc/
    │   ├── methods.ts       # ★ 全部业务远程方法唯一实现对象（RemoteMethods 契约真相源）
    │   ├── register.ts      # ipcMain.handle 注册 + 三重防护 + ipc:introspect 自省
    │   ├── events.ts        # sendToRenderer 类型化推送（IpcEventMap 约束）
    │   ├── preload.facade.ts# preload 侧 bridge 门面生成器
    │   ├── bridge-types.entry.ts # OcsBridge 类型真相源（白名单 Pick）
    │   └── worker.host.ts   # utilityProcess 托管 ScriptWorker（uid 注册表）
    ├── tasks/
    │   ├── init.chrome.ts       # 内置浏览器安装链路 + install/repair/checkIntegrity 三件套
    │   ├── chrome.downloader.ts # 三级源降级下载 + 流式 SHA256 校验
    │   ├── chrome.integrity.ts  # 完整性基准清单 + 快检/全量校验
    │   ├── init.status.ts       # 初始化状态共享（ocs-init:* 推送）
    │   ├── startup.server.ts    # Express 本地服务器（仅 127.0.0.1:15319）
    │   ├── server.auth.ts       # 内存态 token（不落盘）
    │   ├── updater.ts           # electron-updater 自更新
    │   └── ...（init.store/auto.launch/global.listener/error.handler 等）
    ├── extensions/
    │   ├── bundled.ts       # 内置扩展释放/完整性自检/远程兜底下载
    │   └── verify.ts        # 快检 + 全量逐文件 SHA256
    ├── scripts/             # 自动化脚本（见 §6）
    │   ├── index.ts         # AutomationScripts 用户自动化程序注册表
    │   ├── automation/      # wk/（网课登录脚本）+ common/
    │   └── system/          # SystemScripts 系统编排脚本（launch/post 两阶段）
    └── worker/
        ├── entry.ts         # worker 入口（electron-vite 打包为 out/main/script.js，asarUnpack）
        ├── index.ts         # ScriptWorker 类（Playwright 驱动核心，~72KB）
        └── parent-channel.ts# utilityProcess/child_process 双兼容适配
```

### 2.2 packages/web — 渲染进程

```
packages/web/src/
├── main.ts              # 入口：inBrowser 挂 AppInBrowser；桌面端 await initStore() 后才 mount
├── App.vue              # 主外壳（关闭流程编排、全局监听）
├── store/index.ts       # store 响应式单例 + DEFAULT_RENDER + 迁移逻辑
├── fs/                  # 实体模型：browser.ts/folder.ts/entity.ts
├── config/index.ts      # 路由表：/ 下 browsers/user-scripts/setting + /bookmarks
├── composables/         # useEnvironmentDetect/useResources/useEntityDrag/useScreencastVisibility
├── utils/
│   ├── bridge.ts        # ★ bridge 门面（桌面=window.ocs，浏览器宿主=Proxy 空操作降级）
│   ├── ipc.ts           # onRendererEvent 类型化订阅 + 全局监听注册
│   ├── process.ts       # Process 类（worker 通信 + screencast 预览帧管理）
│   ├── environment.ts   # Environment（远程资源 infos + 环境检测）
│   ├── env-bootstrap.ts # ensureEnvironmentReady() 启动前被动环境补全
│   ├── browser-repair.ts# 内置浏览器损坏修复引导
│   └── ...（notify/statusBar/resources.loader/script-version/user-scripts 等）
└── components/          # Title/SettingPanel/ResourcesCard/Setup/BeginnerGuide/StatusBar/XTerm 等
```

### 2.3 packages/common — 共享代码

```
packages/common/src/
├── types.ts                 # 共享类型（AppStore、IpcEventMap、ChromeIntegrityResult、ScriptWorkerContract 等）
├── remote.whitelists.ts     # 9 个白名单数组（fs/path/os/win/webContents/app/dialog/electronStore/logger）
├── constants.ts             # SUPPORTED_BROWSER_MAX_MAJOR=137 等
├── api.ts                   # OCSApi（cdn.ocsjs.com 远程资源接口）
├── scripts/                 # 脚本基类与接口（AutomationScript 基类定义）
├── utils/
│   ├── chrome.source.ts     # 内置浏览器版本/SHA256 钉值/三级下载源 URL
│   ├── chrome.path.ts       # 内置浏览器路径解析
│   └── valid.browser.ts     # 系统浏览器探测
└── types/*.generated.ts     # ⚠️ 契约生成产物（禁手工编辑，gen:contract 重新生成）
```

## 3. IPC 架构（bridge 统一门面）

**核心原则：实现即真相源 + 契约自动生成 + 全异步 invoke。**

### 3.1 架构链路

```
渲染层 bridge.methods.xxx() / bridge.fs.xxx()
  → preload facade（ipcRenderer.invoke('<ns>-call', [name, ...args])）
  → 主进程 register.ts（ipcMain.handle，assertRemoteAccess 三重防护）
  → methods.ts 实现 / Node 模块白名单代理
```

- **methods.ts**：约 50 个业务方法的唯一实现对象；`export type RemoteMethods = typeof methods` 即契约。methods 域无白名单，实现对象自有键即放行。
- **register.ts**：9 个命名空间（fs/os/path/win/webContents/app/dialog/methods/logger）统一 `-call` 异步通道；防护：sender 必须主窗口 + 危险属性黑名单（`__proto__/constructor/prototype`）+ 白名单校验；错误经 `serializeError` 拍平为 `{__error:true}` 传输，渲染层还原为 `OcsRemoteError`。
- **契约管线**：`pnpm gen:contract` → tsc 声明发射 → `common/src/types/remote-methods.generated.ts` + `bridge.generated.ts`。`--check` CI 防漂移，`--watch` 随 dev 并行。**methods.ts 或白名单变更后必须重新生成并一并提交。**
- **渲染层**：一律经 `bridge`（`utils/bridge.ts`）调用；纯浏览器宿主（受管 Chromium 导航页）自动降级为 Proxy 空操作。禁止直接用 `ipcRenderer`。
- **历史通道 `-get`/`-set`/`-call-sync` 已全部移除**（sendSync 仅剩 preload 构建期 `ipc:introspect` 一次）。

### 3.2 事件推送（主 → 渲染）

`sendToRenderer(webContents, channel, ...args)`，频道受 `IpcEventMap`（common/src/types.ts）约束，渲染层经 `onRendererEvent` 订阅。现有事件：

`download`、`builtin-chrome-install-progress`、`system-theme-change`、`update-download`、`detect-new-app-version`、`show-browser-in-app`、`open-file`、`close`、`quit`、`script-worker`

### 3.3 窗口安全基线

主窗口 `sandbox: true + contextIsolation: true + nodeIntegration: false`，preload 注入 `window.ocs`；外部导航/`window.open` 一律 `shell.openExternal`。loading 闪屏用独立窄接口 `window.ocsInit`（`ocs-init:*` 通道），与 window.ocs 完全隔离。

## 4. 内置浏览器体系

**版本严格锁定 Chrome for Testing 137.0.7151.55**（137 后谷歌禁止命令行加载扩展；系统浏览器支持上限 `SUPPORTED_BROWSER_MAX_MAJOR = 137`）。**安装包不内置浏览器**，首次启动时按需下载。

### 4.1 下载与校验

- 三级源降级（`chrome.source.ts`）：**npmmirror 国内镜像 → Google 官方源 → cdn.ocsjs.com 自建源**；可经 store `updater.chromeSource` 强制指定。
- `chrome.downloader.ts`：下载到 `.downloading` 临时文件 → 流式 SHA256 比对四平台钉值 → 通过才 rename；全源失败抛聚合错误。底层 NetUtils.download（分块并发 + 断点续传）。
- 解压目标：`<userData>/bin/chrome/`（resources 只读），`getBuiltinChromeRuntimePath()` 返回可执行路径。

### 4.2 完整性与修复

- `chrome.integrity.ts`：安装后生成基准清单 `.ocs-integrity.json`（逐文件 SHA256）；快检（文件数+总字节）→ 可疑全量哈希；无清单旧安装降级为关键文件存在性检查。
- `init.chrome.ts` 导出三件套（methods 注册，进度推 `builtin-chrome-install-progress`）：
  - `installBuiltinChrome` — 环境修复/Setup 用，不重启应用
  - `repairBuiltinChrome` — 删除损坏目录（退避重试）→ 重走完整安装，in-flight 去重
  - `checkBuiltinChromeIntegrity` — 返回 `ChromeIntegrityResult`（ok/corrupted/missing）
- 渲染层 `browser-repair.ts`：启动前检查（corrupted 弹窗引导修复）、秒退复检并自动重启。

### 4.3 版本升级流程（手动）

1. `node scripts/chrome.install.js <新版本> all`（官方源下载 + 输出 SHA256 + 产出 CDN 目录）
2. 更新 `chrome.source.ts` 的 `BUILTIN_CHROME_VERSION` + `BUILTIN_CHROME_SHA256`
3. 上传 `.chrome-temp/cdn/` 至 cdn.ocsjs.com 对应目录

## 5. 内置扩展系统

- 内置两个脚本管理器：**ScriptCat 1.5.1**、**Tampermonkey 5.5.1**，锁版本 + 钉哈希 + 权限白名单审计（`resources/extensions/extensions.lock.json`，入库；zip/manifest 产物不入库）。
- **构建期** `fetch-extensions.js`：缓存命中跳过 → 下载（crx 剥头）→ SHA256 校验 → 权限审计（新增权限构建失败）→ 生成逐文件哈希清单。`beforePack` 自动调用；`OCS_SKIP_EXTENSIONS=1` 跳过。
- **运行时** `extensions/bundled.ts`：`extractBundledExtension`（asar 流式读 + 哈希校验 + zip-slip 防护 + 原子换入）、`installBundledExtension`（asar 失败自动远程兜底下载，同一校验管线）、`ensureExtensionsIntegrity`（启动时自检，篡改自动重释放）。
- worker 是纯 Node 无 asar 补丁，**全部 asar 操作必须留在主进程**。

## 6. 自动化脚本系统

- **AutomationScripts**（用户自动化程序）：6 个网课登录脚本（`automation/wk/`：超星/智慧树/ICVE/ZJY/ICourse）+ `NewPageScript`；`LegacyScriptMappings` 处理旧脚本配置迁移。渲染层经 `methods.getRawScripts` 获取。
- **SystemScripts**（系统编排脚本，UI 不可删）：按 phase + order 执行，可经开发者设置 `dev.systemScripts` 按名停用：
  - `launch` 阶段（关键路径，失败中断启动）：extensionDevMode → userscriptPermission → extensionVerify
  - `post` 阶段（后台段，失败仅告警）：userscriptInstaller → extensionHomepage → userscriptSync（scriptcat/tampermonkey 双向同步）→ siteCache
- 脚本基类在 `packages/common/src/scripts/`，worker 即沙箱宿主（无独立 loader/sandbox 文件）。

## 7. worker / 浏览器子进程

- 主进程 `ipc/worker.host.ts` 用 `utilityProcess.fork(out/main/script.js)` 托管（uid → 进程注册表）；`scriptWorkerLaunch` 幂等（残留先 kill）、注入系统代理 `OCS_PROXY_URL`；stdout/stderr/message 统一按 uid 转发 `script-worker` 事件。
- `worker/entry.ts`：按消息 event 名反射调用 ScriptWorker 方法；父通道断开时 5s 硬超时自我回收（防 Chromium 孤儿进程）。
- `worker/index.ts`：ScriptWorker（playwright-core 驱动 chromium）：init/launch/close/screencast（CDP 推流 + 背压 in-flight≤6）/系统脚本执行/拓展参数/辅助路由。
- 渲染层 `utils/process.ts`：Process 类经 `bridge.methods.scriptWorkerLaunch/Send/Kill` + `onRendererEvent('script-worker')` 通信。
- **worker 是 electron-free 纯 Node**：OCR 等能力经本地服务器 HTTP 调用，不 import electron。

## 8. 窗口、托盘与关闭流程

### 8.1 bootstrap 顺序（index.ts）

```
模块层防护（EPIPE/单实例锁/no-sandbox）→ initCrypto → initStore
→（并行）ensureExtensionsIntegrity + startupServer
→ app.whenReady → createWindow → initChrome（可能 relaunch，返回 true 中止启动）
→ 挂 quit/close 事件 → did-finish-load 后 updater()（仅打包）
→ storeReady 后 remoteRegister + globalListenerRegister → 托盘同步 → loadURL/loadFile → show
```

### 8.2 关闭流程（三层协作）

1. 用户点关闭 → 主进程 `close` 事件 → 发渲染层 `close` 事件 + 启动 3s 看门狗（`close.watchdog.ts`）
2. 渲染层（App.vue）先调 `bridge.methods.cancelCloseWatchdog()` 取消看门狗，再按配置分支：后台运行 → 托盘；否则有浏览器时 `askCloseOrTray()` 弹窗（「关闭并退出」按钮 10s 倒计时，归零自动退出）
3. 确认退出 → `performFullExit`：关所有浏览器（`forceCloseAllBrowsers`，最久 10s 强制 quitApp）→ 同步存盘 → quitApp
4. 渲染层真正无响应（白屏/阻塞）→ ack 不到达 → 看门狗 3s 强制销毁窗口防僵尸

## 9. 存储与加密

- **StoreData**（store.ts）是唯一公开入口：`get()`（进程内整树缓存）/`set`/`replaceAll`/`invalidateCache`/`onDidChange`；模块加载先 `backupPreV3Config()`（<3.0 配置备份）。
- **信封加密**（crypto.ts）：自管理 AES-256-GCM 主密钥，safeStorage 包裹后存 `<userData>/ocs.key`（`v1:ssa:` 前缀；safeStorage 不可用时 `v1:plain:` 明文回退 + 自动升级）；keytar 存量密钥自动升格。
- 数据格式 `iv:tag:ct`（base64）；兼容 <3.0 旧格式；**逐层解密最多 5 层**修复历史重复加密；失败兜底 `'{}'`。
- 导出/导入：`encryptWithPassword/decryptWithPassword`（scrypt 派生，`v1:scrypt:...` 格式，跨机器可移植）。
- 写路径：渲染层 `methods.saveStore(json, shouldEncrypt)` 一次性加密+落盘。

## 10. 本地服务器

Express 仅绑 `127.0.0.1:15319`（`startup.server.ts`）。主要路由：

| 路由 | 用途 |
| ---- | ---- |
| `GET /state` | 项目路径信息 |
| `GET /api/init/status` | 初始化状态（兜底轮询，主通道已改 ocs-init:* 推送） |
| `GET /browser` / `GET /is-browser-config-sync` | 浏览器数据（requireToken 宽限鉴权） |
| `GET /ocs-script-actions` / `GET /get-actions-key` | 脚本操作路由 + token 签发（阶段 B 将废弃） |
| `GET /api/bookmark/*` | 导航页相关 |
| `GET /icon` | 网站图标多级缓存（内存→磁盘 7 天→多源竞速） |
| `POST /ocr` | OCR 验证码识别（worker 经 HTTP 调用） |
| `GET /api/local-userscript[/:scriptFile]` | 本地用户脚本代理（路径白名单防任意读取） |

注意：`/proxy` 已移除（SSRF 风险）；`server.auth.ts` token 为内存态（randomUUID 惰性生成，不落盘），经 `methods.getServerToken` 分发。

## 11. 自动更新

已从自建 zip 热更新迁移到 **electron-updater**（generic 源 `https://cdn.ocsjs.com/app/electron-updater/`）。渲染层 `detect-new-app-version` 弹更新日志（markdown 渲染，外链系统浏览器打开），确认后 `methods.updateApp()`。

## 12. 开发命令

```bash
corepack enable && pnpm install   # postinstall 自动 install-electron

pnpm dev                          # electron-vite dev + gen:contract:watch 并行

pnpm build                        # typecheck → electron-vite build → electron-builder（产物在 releases/）
pnpm --filter @ocs-desktop/app pack    # 打包 --dir（不生成安装包，快速验证）
pnpm --filter @ocs-desktop/app dist    # 打包安装包

pnpm lint                         # prettier --check + eslint（pre-push 钩子同款）
pnpm typecheck                    # common build + app tsc --noEmit + web vue-tsc --noEmit
pnpm --filter @ocs-desktop/app gen:contract        # 契约重新生成
pnpm --filter @ocs-desktop/app gen:contract:check  # 契约防漂移检查

pnpm test                         # vitest（common + app）
node scripts/chrome.install.js [version] [platform]   # 内置浏览器维护脚本
```

## 13. 重要注意事项

1. **内置浏览器版本锁定 137**：超过 137 的 Chrome 禁止命令行加载扩展，系统浏览器同样受此限制（`SUPPORTED_BROWSER_MAX_MAJOR`）。
2. **扩展必须是 MV3**：MV2 扩展检测不通过。
3. **asar 操作只能在主进程**：worker 是纯 Node 无 asar 补丁。
4. **契约管线三方一致**：methods.ts 实现 = 白名单 = 生成产物，改任一必须 `pnpm gen:contract` 并提交产物。
5. **关闭窗口必须同步存盘**：`saveStoreToLocalSync()`，异步可能丢失。
6. **端口固定 15319**：被占用时本地服务启动失败。
7. **dev 模式无法自动重启**：electron-vite 会杀死 dev 进程，relaunch 会白屏（见 methods.resetApp 分支）。
8. **electron-store 不要直接 new**：一律走 StoreData 封装（conf@10 的 .store getter 每次读盘且副本不可写）。

## 14. 目录快速定位

| 需求 | 位置 |
| ---- | ---- |
| 新增远程方法 | `packages/app/src/ipc/methods.ts`（methods 对象） |
| 新增主→渲染事件 | `common/src/types.ts` IpcEventMap + `events.ts` 推送 |
| 扩展 Node 白名单能力 | `common/src/remote.whitelists.ts` + `pnpm gen:contract` |
| 内置浏览器下载源/版本 | `packages/common/src/utils/chrome.source.ts` |
| 浏览器安装/修复链路 | `packages/app/src/tasks/init.chrome.ts` |
| 内置扩展 | `packages/app/src/extensions/bundled.ts` + `resources/extensions/` |
| 新增用户自动化脚本 | `packages/app/src/scripts/automation/` |
| 新增系统编排脚本 | `packages/app/src/scripts/system/` |
| 关闭流程 | `packages/app/index.ts` + `close.watchdog.ts` + `web/src/utils/browser.ts` |
| 本地服务路由 | `packages/app/src/tasks/startup.server.ts` |
| 打包配置 | `packages/app/electron.builder.json` |
| 渲染层 bridge | `packages/web/src/utils/bridge.ts` |

# OCS Desktop — 项目技能文档

> 本文档面向 AI 助手阅读，提供项目全貌、架构规范、核心机制和开发约定，便于后续 AI 辅助开发时快速理解项目上下文。

---

## 1. 项目概述

**OCS Desktop**是一款基于 Electron + Vue 3 + Playwright 的桌面端浏览器自动化软件。核心功能包括：

- **浏览器多开/分身管理**：每个浏览器实例拥有独立的用户数据目录（`userDataDir`），可独立启动、关闭、重启。
- **用户脚本自动安装与更新**：通过 Playwright 控制浏览器，自动导航至 `.user.js` 脚本 URL，模拟点击安装按钮，支持油猴（Tampermonkey）和脚本猫（ScriptCat）两种脚本管理器。
- **自动化脚本执行**：支持官方内置脚本和第三方远程/本地脚本的安装、权限验证、沙盒化执行。
- **验证码识别**：集成 ddddocr 进行图片验证码识别和滑块验证码破解。
- **浏览器监控**：通过 WebRTC 屏幕共享实现浏览器画面实时监控。
- **双模式界面**：简洁模式（Simple）和专业模式（Professional），支持响应式自适应切换。

### 技术栈

| 层级      | 技术                                   |
| --------- | -------------------------------------- |
| 框架      | Electron 35 + Vue 3.3                  |
| 构建      | Vite 3 (Web) + TSC + Gulp (App)        |
| 自动化    | Playwright Core                        |
| UI 组件库 | Arco Design Vue 2.42                   |
| 样式      | Less + Bootstrap (混杂)                |
| 状态管理  | Vue reactive（无 Vuex/Pinia）          |
| 路由      | Vue Router 4 (Hash 模式)               |
| 本地存储  | electron-store                         |
| 包管理    | pnpm workspace (monorepo)              |
| 语言      | TypeScript 4.5                         |
| 代码规范  | ESLint + Prettier + Husky + CommitLint |

### 运行环境要求

- Node.js >= 22.0.0
- pnpm >= 10.0.0
- 支持 Windows / macOS / Linux

---

## 2. 项目结构

```
ocs-desktop/
├── packages/
│   ├── app/          # Electron 主进程（@ocs-desktop/app）
│   ├── web/          # 渲染进程 Vue 应用（@ocs-desktop/web）
│   └── common/       # 共享代码（@ocs-desktop/common）
├── bin/              # 内置 Chrome 浏览器压缩包
├── scripts/          # 构建/打包脚本 (gulp)
├── public/           # 静态资源（Vite 输出到此 → Electron 加载）
└── package.json      # 根 monorepo 配置
```

### 2.1 packages/app — 主进程

```
packages/app/src/
├── window.ts              # BrowserWindow 创建与配置
├── store.ts               # electron-store 全局配置与路径管理
├── crypto.ts              # 加解密模块（keytar AES-256-GCM + safeStorage 降级）
├── logger.ts / logger.core.ts  # 日志系统（按日期/模块分文件）
├── utils/
│   ├── index.ts           # 通用工具（下载、压缩、解压、导出Excel）
│   ├── browser.ts         # 浏览器版本检测、拓展路径获取
│   └── ocr.ts             # ddddocr 验证码识别调用
├── scripts/
│   ├── index.ts           # 脚本入口：getAllAutomationScripts()
│   ├── interface.ts       # 事件系统、Manifest 接口、权限定义
│   ├── script.ts          # AutomationScript 基类体系
│   ├── loader.ts          # 动态脚本加载器（vm沙盒 + 权限代理）
│   ├── sandbox.ts         # 权限沙盒代理（Proxy + 权限方法映射）
│   ├── utils/index.ts     # 脚本工具（slowType、breakVerifyCode、breakSliderVerify）
│   └── automation/
│       ├── bundled/       # 官方内置自动化脚本 (.js + index.ts)
│       └── collector/     # 脚本收集器（预留）
├── worker/
│   └── index.ts           # ScriptWorker 类（浏览器生命周期管理）
├── tasks/
│   ├── init.store.ts      # 配置初始化与版本迁移
│   ├── init.chrome.ts     # 内置 Chrome 解压初始化
│   ├── startup.server.ts  # Express 本地服务器启动
│   ├── remote.register.ts # IPC 远程通信注册
│   ├── global.listener.ts # 全局事件监听
│   ├── auto.launch.ts     # 开机自启
│   ├── error.handler.ts   # 全局错误处理
│   └── updater.ts         # 应用自动更新
├── workflows/presets/     # 工作流预设（预留）
└── scripts/copy-bundled.js # 构建后脚本：复制 .js bundled 文件到 lib/
```

### 2.2 packages/web — 渲染进程

```
packages/web/src/
├── main.ts                # 应用入口（区分浏览器环境/Electron环境）
├── App.vue                # 主布局（专业模式：侧边栏+路由视图+浏览器面板抽屉）
├── AppInBrowser.vue       # 浏览器环境入口（纯路由视图）
├── route/index.ts         # 路由配置（从 config 生成）
├── store/index.ts         # 全局状态（reactive + 远程 electron-store + 解密）
├── config/index.ts        # 路由定义 + 脚本搜索引擎配置
├── fs/
│   ├── index.ts           # 文件系统状态（currentBrowser/currentFolder 等计算属性）
│   ├── browser.ts         # Browser 实体类（启动/关闭/重启/清理缓存）
│   ├── folder.ts          # Folder 实体类（树形结构，递归查找/移动）
│   ├── entity.ts          # Entity 抽象基类
│   └── interface.ts       # 文件系统类型定义
├── pages/
│   ├── index.vue          # 专业模式主页（侧边栏导航）
│   ├── simple/index.vue   # 简洁模式主页（Tab切换）
│   ├── browsers/          # 浏览器列表页
│   ├── user-scripts/      # 用户脚本页
│   ├── resources/         # 应用中心页
│   ├── dashboard/         # 监控列表页
│   ├── setting/           # 软件设置页
│   └── bookmarks.vue      # 书签导航页（浏览器首页）
├── components/
│   ├── automation-scripts/ # 自动化脚本相关组件
│   │   ├── index.ts       # 类型导出 + 工具函数
│   │   ├── AutomationScriptSelector.vue   # 脚本选择器
│   │   ├── AutomationScriptList.vue       # 脚本列表
│   │   ├── AutomationScriptTable.vue      # 脚本表格
│   │   ├── AutomationScriptInstallConfirm.vue # 安装确认弹窗
│   │   └── AutomationScriptViewer.vue     # 脚本代码查看器
│   ├── browsers/          # 浏览器相关组件
│   │   ├── BrowserPanel.vue        # 浏览器操作面板
│   │   ├── BrowserOperators.vue    # 浏览器操作按钮组
│   │   ├── FileBreadcrumb.vue      # 文件路径面包屑
│   │   ├── FileFilters.vue         # 文件筛选器
│   │   ├── FileOperators.vue       # 文件操作按钮
│   │   └── FileMultipleOperators.vue # 多文件操作
│   ├── SettingPanel.vue   # 设置面板
│   ├── Setup.vue          # 一键安装向导
│   ├── NotificationBanner.vue # 全局 Banner 通知
│   ├── EnvironmentAlert.vue   # 环境检测提示
│   └── ...                # 其他通用组件
├── composables/           # Vue 组合式函数
│   ├── useEntityDrag.ts   # 实体拖拽
│   └── useEnvironmentDetect.ts # 环境检测
├── utils/
│   ├── remote.ts          # IPC 远程通信封装（核心！）
│   ├── process.ts         # Process 类（浏览器进程管理）
│   ├── browser.ts         # 浏览器工具函数
│   ├── resources.loader.ts # 资源加载器
│   ├── script-version.ts  # 脚本版本检查
│   ├── user-scripts.ts    # 用户脚本工具
│   ├── ipc.ts             # IPC 事件监听
│   ├── markdown.ts        # Markdown 渲染
│   ├── xterm.ts           # XTerm 终端封装
│   └── ...                # 其他工具
└── types/                 # 类型定义
    ├── user.script.ts     # 用户脚本类型
    └── search.ts          # 搜索引擎类型
```

### 2.3 packages/common — 共享代码

```
packages/common/src/
├── api.ts          # OCSApi 远程资源接口（CDN JSON）
├── interface.ts    # ValidBrowser 接口
└── utils/
    ├── string.ts       # StringUtils 字符串工具类
    └── valid.browser.ts # 浏览器路径检测
```

---

## 3. 核心架构与机制

### 3.1 IPC 远程通信机制（核心架构）

项目不使用 Electron 的 `contextBridge` / `preload` 模式，而是在渲染进程中直接启用了 `nodeIntegration: true` + `contextIsolation: false`，通过自定义 IPC 协议实现主进程和渲染进程的通信。

**通信模式**：`registerRemoteEvent(name, target)`

对于每个注册的远程对象（如 `fs`、`path`、`methods` 等），自动绑定四种 IPC 事件：

| 事件后缀     | 用途         | 同步/异步                        |
| ------------ | ------------ | -------------------------------- |
| `-get`       | 获取属性值   | 同步                             |
| `-set`       | 设置属性值   | 同步                             |
| `-call`      | 异步调用方法 | 异步（通过 respondChannel 回调） |
| `-call-sync` | 同步调用方法 | 同步                             |

**渲染进程侧**：`remote.ts` → `registerRemote<T>(eventName)`

```ts
// 使用示例
remote.fs.call('readdirSync', path); // 异步调用
remote.fs.callSync('existsSync', path); // 同步调用
remote.methods.call('installAutomationScript', manifest, code, sourceUrl);
remote['electron-store'].get('store'); // 获取属性
```

**已注册的远程对象**：

- `electron-store` — electron-store 实例
- `fs` — Node.js fs 模块
- `os` — Node.js os 模块
- `path` — Node.js path 模块
- `crypto` — Node.js crypto 模块
- `OCSApi` — 远程 API 客户端
- `win` — BrowserWindow 实例
- `webContents` — WebContents 实例
- `app` — Electron app 实例
- `dialog` — Electron dialog 模块
- `methods` — 自定义方法集合（见下）
- `logger` — 日志实例
- `desktopCapturer` — 桌面截图源

**methods 远程方法集**（最常用）：

- `autoLaunch()` — 开机自启
- `get/post` — HTTP 请求代理
- `download(channel, url, dest)` — 文件下载
- `zip/unzip` — 文件压缩/解压
- `getValidBrowsers()` — 获取可用浏览器列表
- `getBrowserMajorVersion()` — 获取浏览器主版本号
- `getExtensionPaths()` — 获取扩展路径
- `exportExcel()` — 导出 Excel
- `statisticFolderSize()` — 统计文件夹大小
- `updateApp()` — 应用更新
- `captureDesktopScreen()` — 桌面截图
- `encryptRenderString/decryptRenderString` — 加解密渲染进程数据
- `saveStore(plainStoreJson, shouldEncrypt)` — 保存 store（一次 IPC 完成加密+持久化）
- `getRawScripts()` — 获取所有自动化脚本
- `installAutomationScript/uninstallAutomationScript` — 安装/卸载自动化脚本
- `getInstalledAutomationScripts()` — 获取已安装脚本列表
- `parseAutomationScript(code)` — 从代码解析自动化程序信息（manifest，含 configs）
- `getAutomationScriptCode(id)` — 读取已安装脚本代码

### 3.2 自动化脚本系统

#### 脚本分类

| 类型           | 来源            | sourceUrl | 权限                   | 存储位置                                   |
| -------------- | --------------- | --------- | ---------------------- | ------------------------------------------ |
| 官方内置脚本   | `bundled/` 目录 | 无        | 不受限（额外全局变量） | 启动时安装到 `automation-scripts/`         |
| 第三方远程脚本 | URL 安装        | 有        | 受权限沙盒限制         | `automation-scripts/{id}.json` + `{id}.js` |
| 第三方本地脚本 | 用户手动安装    | 本地路径  | 受权限沙盒限制         | 同上                                       |

#### 脚本 Manifest 结构

```ts
interface AutomationScriptManifest {
	id: string; // 唯一标识
	name: string; // 名称
	version: string; // 版本
	description: string; // 描述
	author: string; // 作者
	homepage?: string; // 主页
	icon?: string; // 图标 URL
	permissions?: ScriptPermissionKey[]; // 权限声明
	configs?: Record<string, Config>; // 脚本配置项（已合并进 manifest）
}
```

#### 权限体系

| 权限键       | 标签     | 允许的 Playwright 方法                                       |
| ------------ | -------- | ------------------------------------------------------------ |
| `page:read`  | 读取页面 | `url`, `title`, `$`, `$$`, `isVisible`, `waitForSelector` 等 |
| `page:write` | 操作页面 | `click`, `fill`, `type`, `goto`, `evaluate` 等               |
| `network`    | 网络请求 | `route`, `unroute`                                           |
| `storage`    | 存储访问 | `cookies`, `storageState`（BrowserContext 方法）             |

官方脚本（`sourceUrl` 为空）绕过所有权限检查，且运行时可访问额外全局变量：`axios`、`Buffer`、`slowType`、`breakVerifyCode`、`breakSliderVerify`、`getBase64`。

#### 脚本加载流程

1. 应用启动 → `ensureBundledScriptsInstalled()` 将 bundled 脚本写入 `automation-scripts/`
2. 调用 `getAllAutomationScripts(scriptsDir)` → `loadDynamicScripts(scriptsDir)` 扫描目录
3. 遍历 `.json` 文件，读取 manifest（含 configs）+ 对应 `.js` 代码
4. `createDynamicScript()` → 使用 `vm.Script` 在沙盒中执行代码提取 `module.exports`
5. 构建 `AutomationScript` 实例，封装 `manifest`（含 configs）和 `run` 函数

#### 脚本执行流程

1. 用户在浏览器配置中选择自动化脚本
2. 启动浏览器 → `Process.init()` 创建子进程
3. 子进程运行 `ScriptWorker.launch()`
4. 按顺序执行自动化脚本：
   - 创建 `sandboxedPage`（Proxy 代理，基于权限过滤方法）
   - 在受限 `vm.Context` 中执行 `run` 函数
   - 超时时间 5 分钟

#### 脚本导出格式（第三方脚本）

```js
// 使用 module.exports 导出，configs 已合并进 manifest
module.exports.manifest = {
  id: '...', name: '...', ...,                // 必填字段
  permissions: ['page:read', 'page:write'],
  configs: { key: { label: '...', value: '...' } }   // 脚本配置项
};
module.exports.run = async function(page, configs, ...args) {
  // page 是沙盒化的 Playwright Page 代理
  // configs 是配置值的扁平对象（由 manifest.configs 的 value 字段扁平化而来）
};
```

### 3.3 浏览器进程管理

**Process 类**（渲染进程侧）：

每个浏览器实例对应一个 `Process` 对象，通过 `child_process.fork` 创建子进程执行 `ScriptWorker`。

```
Browser.launch() → Process.init() → fork(script.js) → RemoteScriptWorker
                                                      ↓
                                              ScriptWorker.launch()
                                                      ↓
                                          Playwright chromium.launchPersistentContext()
                                                      ↓
                                          安装用户脚本 → 运行自动化程序 → 完成
```

**浏览器生命周期事件**：

- `init` — 进程初始化完成
- `launched` — 浏览器启动完成
- `browser-closed` — 浏览器关闭
- `webrtc-page-loaded` / `webrtc-page-closed` — WebRTC 页面事件

**浏览器启动参数**：

- `executablePath` — 浏览器可执行路径
- `headless` — 是否无头模式
- `userDataDir` — 用户数据目录
- `--load-extension` — 加载扩展
- `--disable-extensions` 被移除（以允许扩展加载）

**浏览器版本限制**：Windows 下浏览器主版本不能超过 137（超过则提示使用内置浏览器）。

### 3.4 用户脚本安装机制

1. 浏览器启动后，导航至书签页
2. 打开开发者模式（MV3 必须）
3. 关闭扩展加载弹出的首页（Tampermonkey/ScriptCat 欢迎页）
4. 批量打开脚本安装 URL（`.user.js`）
5. 检测安装页面，模拟点击安装按钮
6. 本地脚本通过 `http://localhost:{port}/api/local-userscript?path=` 代理提供

### 3.5 数据存储与加密

**electron-store** 持久化存储，分为两部分：

- **主进程配置**（`store.store` 直接读写）：`paths`、`app`、`window`、`server`
- **渲染进程数据**（`store.store.render`）：界面配置、浏览器树、脚本列表等

**渲染进程数据加密**（两种方案自适应）：

1. **首选：keytar + AES-256-GCM** — 密钥存于 OS 密钥链（Windows Credential Manager / macOS Keychain）
2. **降级：safeStorage** — Electron 内置加密

**存储格式**：

- AES 格式：`iv:authTag:ciphertext`（base64，含冒号分隔符）
- safeStorage 格式：纯 base64（不含冒号）

**持久化策略**：渲染进程使用 `watch + debounce(100ms)` 准实时持久化，应用关闭时同步写入确保数据落盘。

### 3.6 本地服务器

主进程启动 Express 服务器（默认端口 15319），提供：

| 路由                                         | 用途                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `GET /state`                                 | 获取项目路径信息                                               |
| `GET /ocs-global-setting`                    | 获取 OCS 全局配置                                              |
| `GET /browser`                               | 获取浏览器配置数据                                             |
| `GET /is-browser-config-sync`                | 检测配置同步状态                                               |
| `GET /ocs-script-actions`                    | 脚本操作路由（导航页用）                                       |
| `GET /get-actions-key`                       | 获取认证 token                                                 |
| `GET /api/bookmark/browser-info?uid=`        | 获取浏览器信息                                                 |
| `GET /icon?url=`                             | 获取网站图标（三级降级：直接请求 →Google Favicon API→1x1 GIF） |
| `POST /proxy`                                | HTTP 请求代理                                                  |
| `POST /ocr`                                  | 验证码识别（ddddocr）                                          |
| `GET /api/local-userscript?path=`            | 提供本地用户脚本                                               |
| `GET /api/bookmark/show-browser-in-app?uid=` | 在应用中定位浏览器                                             |
| `GET /ocs-action_*`                          | 脚本执行提示页                                                 |
| 静态资源                                     | `public/` 目录                                                 |

**网络拦截**：

- `ocs-environment` 请求 → 返回 `{ environment: 'playwright' }`（供脚本检测环境）
- `ocs-script-actions` POST 请求 → 根据 `auth-token` 验证后执行 Playwright Page 操作（如 `click`、`fill`、`waitForResponse` 等），实现浏览器内脚本与 Playwright 的双向通信

### 3.7 文件树模型

渲染进程使用 `Browser` 和 `Folder` 实体类构建树形文件系统：

```
Folder (root)
├── Folder
│   ├── Browser (含 automationScripts, tags, notes, histories)
│   └── Browser
└── Browser
```

- `Entity` — 抽象基类（uid, name, createTime, renaming）
- `Browser extends Entity` — 浏览器实例（tags, notes, automationScripts, cachePath, histories）
- `Folder extends Entity` — 文件夹（children: Record<string, Browser | Folder>）

`root()` 是惰性单例，通过 `reactive(new Folder(store.render.browser.root))` 创建，并通过 `watch` 深度同步回 store。

### 3.8 脚本搜索引擎

内置两个脚本搜索引擎配置：

1. **ScriptCat（脚本猫）** — `https://scriptcat.org/api/v2/scripts`
2. **GreasyFork（油叉）** — `https://greasyfork.org/zh-CN/scripts.json`

两者均实现统一的 `ScriptSearchEngine` 接口，包含 `search`、`infoGetter`、`transformToCommonByInfo`、`versionProvider` 方法。

---

## 4. 开发命令

```bash
# 安装依赖
corepack enable
pnpm install

# 开发（同时启动 common 编译 + Web 开发服务器 + Electron 主进程）
pnpm dev

# 单独运行
pnpm dev:web    # 仅 Web 开发服务器 (http://localhost:3000)
pnpm dev:app    # 仅 Electron 主进程

# 构建
pnpm build      # 完整构建（TSC → Gulp 打包 → Electron Builder）

# 代码检查
pnpm lint       # ESLint + Prettier 格式化
pnpm format     # 仅 Prettier 格式化

# 类型检查
pnpm tsc        # lint + TSC 类型检查
```

---

## 5. 编码规范与约定

### 5.1 语言与风格

- **TypeScript 严格模式**：所有新代码必须使用 TypeScript，启用严格检查。
- **中文注释**：项目注释和 UI 文案均为中文，代码标识符使用英文。
- **Vue 3 Composition API**：使用 `<script setup lang="ts">` 语法，不使用 Options API。
- **Less 样式**：组件样式使用 `<style lang="less" scoped>`。
- **缩进**：使用 tab 缩进（由 `.editorconfig` 控制）。
- **引号**：使用双引号。
- **尾逗号**：ES5 尾逗号。

### 5.2 文件命名

- Vue 组件：PascalCase（如 `BrowserPanel.vue`）
- TypeScript 工具文件：camelCase（如 `process.ts`）
- 类型/接口文件：camelCase（如 `interface.ts`）
- 常量导出：UPPER_SNAKE_CASE（如 `BUNDLED_SCRIPTS`）

### 5.3 组件规范

- UI 组件统一使用 Arco Design Vue，不从零构建基础组件。
- 图标使用 Material Icons，通过自定义 `Icon` 组件渲染。
- 复用组合式函数放 `composables/` 目录。
- 跨组件状态通过 `store` (reactive) 共享，不使用事件总线。

### 5.4 IPC 通信规范

- 渲染进程调用主进程必须通过 `remote.ts` 的 `registerRemote` 封装，不直接使用 `ipcRenderer.send`。
- 新增主进程方法 → 在 `remote.register.ts` 的 `methods` 对象中添加。
- 新增远程对象 → 调用 `registerRemoteEvent(name, target)` 注册。
- 异步方法优先使用 `-call` 事件，同步读取用 `-call-sync` 或 `-get`。

### 5.5 数据持久化规范

- 渲染进程的可持久化数据放 `store.render` 下。
- 修改 store 后由 `watch + debounce` 自动持久化，无需手动触发。
- 关闭窗口时使用同步写入 `saveStoreToLocalSync()` 确保数据落盘。
- 不要在 `App.vue` 的 `onUnmounted` 中做异步操作。

### 5.6 自动化脚本开发规范

- 官方内置脚本放 `packages/app/src/scripts/automation/bundled/`，构建后通过 `copy-bundled.js` 复制 `.js` 文件。
- 第三方脚本使用 `module.exports` 导出 `manifest`、`configs`、`run`。
- `run` 函数签名：`(page: Page, configs: ConfigValueRecord, ...args: any[]) => void | Promise<void>`
- 必须在 `manifest.permissions` 中声明所需权限，否则运行时会被代理拦截。
- 官方脚本可使用额外全局变量（`axios`、`Buffer`、`slowType`、`breakVerifyCode`、`breakSliderVerify`、`getBase64`），第三方脚本不可用。

### 5.7 错误处理约定

- 主进程错误通过 `Logger` 记录到日志文件。
- 渲染进程错误通过 `notify()` 显示通知，附带复制按钮。
- `ResizeObserver loop` 和 `CrashpadMetrics` 错误已加入过滤器，无需处理。
- 浏览器子进程 5 秒内异常关闭提示用户更换浏览器。

---

## 6. 关键流程

### 6.1 浏览器启动完整流程

```
用户点击启动
  → Browser.launch() (渲染进程)
    → new Process(browser, launchOptions)
    → process.init() (fork 子进程)
      → ScriptWorker.init() (初始化数据和日志)
    → process.launchPreCheck() (检查浏览器路径、脚本更新)
    → process.launch() → worker('launch', options)
      → ScriptWorker.launch() (主进程子进程)
        → chromium.launchPersistentContext()
        → 打开导航页
        → 开启扩展开发者模式（MV3 必须）
        → 关闭扩展弹出页面
        → 安装/更新用户脚本
        → 注册网络路由拦截
        → 运行自动化程序（依次执行）
        → 显示完成提示
        → 触发 'launched' 事件
```

### 6.2 应用启动流程

```
app.whenReady()
  → handleError()            # 全局错误处理
  → initAesKey()              # 加密模块初始化
  → initStore()               # 配置初始化与版本迁移
  → createWindow()            # 创建 BrowserWindow
  → initChrome(win)           # 内置 Chrome 初始化
  → startupServer()           # 启动 Express 服务器
  → remoteRegister(win)       # 注册 IPC 远程通信
    → ensureBundledScriptsInstalled()  # 安装内置脚本
  → globalListenerRegister(win)        # 全局事件监听
  → updater()                 # 检查应用更新
```

### 6.3 应用关闭流程

```
用户点击关闭
  → ipcRenderer 'close' 事件
    → closeAllBrowser() (异步逐一关闭)
    → 将 root 文件树序列化回 store
    → saveStoreToLocalSync() (同步加密+写入磁盘)
    → app.exit(0)
```

---

## 7. 重要注意事项

1. **nodeIntegration: true**：渲染进程可访问 Node.js API，修改时注意安全边界。
2. **VM 沙盒不是安全边界**：`vm.Script` 仅用于隔离执行环境，不提供真正的安全沙箱。第三方脚本的权限控制通过 Proxy 代理实现。
3. **内置浏览器版本受限**：Windows 下浏览器主版本 > 137 时无法自动加载脚本管理器，需使用内置浏览器。
4. **扩展必须是 MV3**：启动时检查扩展 manifest 版本，MV2 扩展会报错。
5. **Vite 构建输出到 app/public**：Web 构建产物直接输出到 Electron 的 `public/` 目录，Electron 加载 `public/index.html`。
6. **bundled .js 文件需手动复制**：TypeScript 编译不处理 `.js` 文件，需运行 `copy-bundled.js` 脚本复制到 `lib/` 目录。
7. **端口默认 15319**：本地服务器端口，被占用时启动失败。
8. **关闭时同步写入**：应用关闭时必须使用同步方式保存数据，异步可能丢失。
9. **脚本安装超时 120 秒**：每个脚本安装页面的最大等待时间，超时后跳过。
10. **双模式兼容**：同一套代码必须在 Electron 环境和纯浏览器环境（`AppInBrowser.vue`）中均可运行，通过 `inBrowser` 变量区分。

---

## 8. 外部依赖说明

| 依赖               | 用途                                               |
| ------------------ | -------------------------------------------------- |
| playwright-core    | 浏览器自动化引擎                                   |
| electron-store     | 本地持久化存储                                     |
| express            | 本地 HTTP 服务器                                   |
| keytar             | OS 密钥链访问（加密密钥存储）                      |
| ddddocr            | 验证码识别（CLI 调用）                             |
| axios              | HTTP 请求                                          |
| adm-zip / unzipper | 文件压缩/解压                                      |
| xlsx               | Excel 导出                                         |
| xterm              | 终端模拟器                                         |
| markdown-it        | Markdown 渲染                                      |
| lodash             | 工具函数（get、defaultsDeep、cloneDeep、debounce） |
| dayjs              | 时间处理                                           |
| semver             | 版本号比较                                         |
| systeminformation  | 系统信息获取                                       |
| glob               | 文件模式匹配                                       |
| video.js           | 视频播放器                                         |

---

## 9. 目录快速定位

| 需求                   | 位置                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| 新增 IPC 方法          | [remote.register.ts: methods](packages/app/src/tasks/remote.register.ts)                                        |
| 新增内置自动化脚本     | [bundled/](packages/app/src/scripts/automation/bundled/)                                                        |
| 修改浏览器实体         | [browser.ts](packages/web/src/fs/browser.ts)                                                                    |
| 修改文件树结构         | [folder.ts](packages/web/src/fs/folder.ts)                                                                      |
| 新增页面路由           | [config/index.ts](packages/web/src/config/index.ts)                                                             |
| 修改全局状态           | [store/index.ts](packages/web/src/store/index.ts)                                                               |
| 修改 IPC 通信协议      | [remote.ts](packages/web/src/utils/remote.ts) + [remote.register.ts](packages/app/src/tasks/remote.register.ts) |
| 修改加密逻辑           | [crypto.ts](packages/app/src/crypto.ts)                                                                         |
| 修改本地服务路由       | [startup.server.ts](packages/app/src/tasks/startup.server.ts)                                                   |
| 修改脚本沙盒权限       | [sandbox.ts](packages/app/src/scripts/sandbox.ts)                                                               |
| 修改浏览器启动流程     | [worker/index.ts](packages/app/src/worker/index.ts)                                                             |
| 修改 Electron 打包配置 | [electron.builder.json](packages/app/electron.builder.json)                                                     |
| 修改 Vite 构建         | [vite.config.ts](packages/web/vite.config.ts)                                                                   |

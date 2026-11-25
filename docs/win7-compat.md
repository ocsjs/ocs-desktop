# Windows 7 兼容性适配说明（feat/win7-compat 分支）

本文档汇总本分支针对 Windows 7 的全部代码改动，按模块列出每处改动的位置与目的。

## 总体策略

| 领域 | main 分支 | 本分支（Win7） | 原因 |
|------|-----------|---------------|------|
| Electron | 43.8.0 | **22.3.27**（最后支持 Win7 的版本） | Electron 23+（Chromium 110+）要求 Win10 |
| 内置浏览器 | CfT 137 自动下载 | **Supermium 150 自动下载初始化** | CfT 自 M113 起发布，无 Win7 版本；Supermium 为 Chromium 移植版（Win7 SP1+ 可运行，保留 MV2 拓展） |
| 系统浏览器 | 不探测 | 探测 Chrome/Edge ≤109 + Supermium | Chrome/Edge 109 是最后支持 Win7 的官方版本 |
| 内置拓展 | ScriptCat 1.x（MV3） | **ScriptCat 0.16.6（MV2）** | MV3 依赖 chrome.userScripts（Chrome 120+）；Chrome 109 仅支持 MV2 |
| electron-builder | 26 + fuses | 26，**移除 fuses**，仅 win 构建（x64+ia32） | fuses 为 Electron 26+ 特性；Win7 老机器含 32 位 |
| 窗口控制按钮 | titleBarOverlay | **渲染层自绘** | overlay 无偏移参数、恒从 y=0 绘制，遮挡自绘边框 |
| 窗口边框 | 无边框 + 系统圆角 | **1px 黑边 + 2px 灰内边（方角）** | Win7 无 DWM 圆角 API；透明窗口在 DWM 禁用（Basic 主题）时失效 |

---

## 1. 运行时降级

| 位置 | 改动 | 目的 |
|------|------|------|
| `packages/app/package.json` | electron 43.8.0 → 22.3.27 | 最后支持 Win7 的 Electron |
| `pnpm-workspace.yaml` | playwright-core → **1.48.2 精确钉值** | 1.49+ 要求 Node 18（worker 运行在 Electron 22 的 Node 16）；`^` 会解析到 1.60，必须钉死 |
| `packages/app/package.json` | glob 11 → 10 | glob 11 要求 Node 20+ |
| `package.json`（根） | 移除 `install-electron` postinstall 钩子 | 该机制为 Electron 42+ 专属 |
| `packages/app/electron.vite.config.ts` | 构建 target：`node16.17`（main/preload）、`chrome108`（renderer） | 防止输出 Electron 22 不支持的语法/特性 |
| `packages/app/electron.builder.json` | 移除 `electronFuses`；移除 mac/linux/deb 配置；nsis 双架构 `["x64","ia32"]`；`npmRebuild: false` | fuses 为 Electron 26+ 特性；Win7 目标含 32 位老机器；keytar 为 N-API 预编译无需重建 |
| `.github/workflows/build.yml` | 构建矩阵裁剪为仅 windows-latest/x64；移除 mac 签名冒烟；Release 说明改为 Win7 特别版 | 本分支仅发布 Windows |

## 2. Electron API 回退

| 位置 | 改动 | 目的 |
|------|------|------|
| `packages/app/src/crypto.ts` | safeStorage 异步 API（`encryptStringAsync`/`decryptStringAsync`/`isAsyncEncryptionAvailable`，Electron 36+）→ 同步版 | Electron 22 无异步 safeStorage |
| `packages/app/src/ipc/methods.ts` `getStorageBackend` | `getSelectedStorageBackend`（Electron 23+）加 typeof 守卫 | Electron 22 下该 API 不存在 |

## 3. 浏览器策略

| 位置 | 改动 | 目的 |
|------|------|------|
| `packages/common/src/utils/chrome.source.ts` | `isWin7Platform()`（NT 6.1 判定）；`SUPERMIUM_BROWSER` 描述符（v150-r3 / 150.0.7871.289，x64/ia32 SHA256 钉值）；`getSupermiumDownloadSources()`（GitHub 官方 → OCS 自建 CDN 降级） | Supermium 下载源的唯一真相源 |
| `packages/common/src/constants.ts` | `SUPPORTED_BROWSER_MAX_MAJOR_WIN7 = 109`；`isSupermiumPath()`（按路径识别 Supermium） | Win7 系统浏览器版本阈值；Supermium 不受阈值约束 |
| `packages/common/src/utils/valid.browser.ts` | win32 恢复系统浏览器探测（Edge/Chrome 常见路径 + LocalAppData 的 Supermium）+「Supermium 浏览器（软件下载）」探测 | Win7 浏览器候选来源 |
| `packages/common/src/utils/chrome.path.ts` | `getSupermiumRuntimePath()`（userData/bin/supermium/chrome/chrome.exe） | 探测与路径写入共用 |
| `packages/app/src/tasks/chrome.downloader.ts` | 多源下载重构为通用 `downloadWithSources`；`downloadBuiltinChromeZip` 按平台选择下载源（Win7 → Supermium 双源，其余 → CfT 三源） | CfT 与 Supermium 共用降级 + SHA256 校验管线 |
| `packages/app/src/tasks/init.chrome.ts` | **统一 initChrome/installBuiltinChrome 单链路**：平台描述助手（`getBuiltinRuntimeDir`/`getBuiltinFinalPath`/`builtinBrowserLabel`）按平台取 Supermium 或 CfT 的运行目录、可执行路径与展示名，其余流程与 main 完全一致 | 最小化与 main 的 diff 面，backport 友好 |
| `packages/web/src/utils/environment.ts` | 版本阈值按平台取 137/109，Win7 下 Supermium 豁免；`getSupportedExtension` Win7 放宽 MV2 | 环境检测适配 |
| `packages/app/src/worker/index.ts` | 启动版本校验 Win7 阈值 109 + Supermium 豁免 + 专属文案；MV2 拓展放行（manifest_version ≥ 2） | worker 侧校验 |
| `packages/web/src/components/setting/BrowserPath.vue` | 与 main 风格一致：只读展示浏览器名 + 问号气泡（路径 + 文件夹定位）；Win7 显示「内置浏览器（Supermium，Chromium 150）」及说明 | 浏览器路径展示 |

## 4. 拓展体系（MV3 → MV2）

| 位置 | 改动 | 目的 |
|------|------|------|
| `packages/app/resources/extensions/extensions.lock.json` | ScriptCat 1.5.1 → **0.16.6**（最后的 MV2 稳定版），新增 `minManifestVersion: 2`；移除 Tampermonkey | MV3 依赖 Chrome 120+；TM MV2 Legacy 已从 CWS 下架无官方源 |
| `packages/app/scripts/fetch-extensions.js` | 权限审计支持 `minManifestVersion` 放宽 | 构建期校验适配 MV2 |
| `packages/app/src/scripts/system/extension-verify.ts` | 拓展存活检测兼容 MV2 background page（serviceWorkers + backgroundPages） | MV2 ScriptCat 无 service worker |
| `packages/app/src/scripts/system/userscript-installer.ts` | 安装按钮匹配新增 ScriptCat 0.x arco 按钮分支（无 testid） | MV2 版安装页结构不同 |
| `packages/app/LICENSES/extensions/NOTICE.md` | 许可证清单移除 Tampermonkey 并注明分支差异 | 合规 |
| `packages/app/tests/extensions.verify.test.ts` | 夹具 tampermonkey → scriptcat | 测试适配 |

## 5. 资源监控修复（Win7 专属缺陷）

| 位置 | 改动 | 目的 |
|------|------|------|
| `packages/app/src/tasks/resource-monitor.ts`（新增） | 主进程软件整体资源监控：`Get-Process` 按进程名聚合 OCS 整体占用（不经 WMI，PS 2.0 兼容，实测 622ms vs WMI 分钟级），每 10s 推送 `resource-usage` 事件 | 替代逐浏览器 WMI 统计（低配 Win7 上不可用） |
| `packages/app/src/worker/index.ts` | 逐浏览器资源统计下线（win32 跳过）；`findWindowsBrowserRootPid` 保留供 close 强杀兜底；`execCmd` 有输出即采用（PS 非终止错误置退出码 1 会误丢有效输出） | 资源监控链路修复 |

## 6. 窗口样式（Win7 风格）

| 位置 | 改动 | 目的 |
|------|------|------|
| `packages/web/src/assets/{less/common.less,css/common.css}` | `html.window-frame`：1px 纯黑外边框 + body 2px 浅灰内边框（方角）；`height:100%+border-box` 防内容裁切底边 | 模拟 Win7 窗口边框（圆角方案因 DWM 依赖放弃） |
| `packages/web/public/loading.html` | 初始化闪屏同步同款边框（方角、去阴影）；`.result-content` flex+overflow-y auto | 风格统一；长错误信息滚动适配 |
| `packages/web/src/components/WindowControls.vue`（新增） | 自绘最小化/最大化/关闭按钮（win 白名单新增对应方法，契约已重生成） | 替代 titleBarOverlay，避免遮挡自绘边框 |
| `packages/web/src/components/Title.vue` / `PinButton.vue` | 接入 WindowControls；PinButton 固定避让 138px | 布局整合 |
| `--title-height`（32 → 36） | `common.less/css` + `window.ts` 相关处 | 标题栏让位边框 |
| `packages/app/src/window.ts` | 移除 titleBarOverlay；frame:false 保持 | 同上 |
| `packages/web/src/components/StatusBar.vue` | `color-mix` 前补纯色边框降级声明 | Chromium 108 不支持 color-mix |

## 7. 兼容性杂项

| 位置 | 改动 | 目的 |
|------|------|------|
| `packages/web/src/utils/os.ts` | `getWindowsRelease` 结果缓存 + 新增 `isWin7Platform()` | 渲染层平台判定（避免重复 IPC） |
| `packages/app/src/extensions/bundled.ts` | `zipBuf` 显式类型标注 | typecheck 适配 |
| `packages/app/src/tasks/init.chrome.ts`（dev 模式） | 浏览器初始化完成后 dev 下 `return false` 继续启动（原 `return true` 导致启动中断、无任何窗口） | 修复 main 分支存量死胡同（本分支实测暴露） |
| `packages/common/index.ts` | 导出 Supermium/isWin7Platform 相关符号 | 跨包引用 |

## 已移除的临时内容

- `.codebuddy/patches/` 临时脚本（环境检测、角落渲染复现等）
- `OCS_FORCE_WIN7` 调试开关（chrome.source.ts env 判定 + index.ts os.release 伪装）
- `site-cache.ts` 排障计数日志（恢复原有静默行为）

## 已知限制 / 待实测项

1. userscript-sync 的 ScriptCat 适配器按 1.x 页面结构编写，对 0.16.6（MV2）大概率不生效（post 阶段，失败仅告警）。
2. ScriptCat 0.16.6 安装页按钮选择器（arco-btn + 文案匹配）为拆包推断，未经真机验证。
3. renderer 在 Chromium 108 下的 UI 回归未全面排查。
4. keytar（N-API）在 Electron 22 下未经实测（加载失败已有降级路径）。
5. OCS 自建 CDN 需手动上传 Supermium zip（`resources/chrome/supermium-150.0.7871.289/{x64,ia32}/`），未上传前国内仅 GitHub 单源。
6. Win7 真机/虚拟机端到端实测持续进行中。

详细演进过程与决策记录见 `.codebuddy/plans/win7-compat-plan.md`。

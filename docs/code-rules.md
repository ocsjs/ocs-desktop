# OCS Desktop — 编码规则

> AI 辅助编码必须遵守的强制规则。项目架构与机制见 `docs/development.md`。

---

## 1. Bridge / IPC 规范（强制）

项目使用自研 bridge 门面（`window.ocs`）做进程间通信，**实现即真相源 + 契约自动生成**：

1. **新增主进程方法只能加在 `packages/app/src/ipc/methods.ts` 的 `methods` 对象中**，按职责放入对应域。
   - methods 由 facade 自省（`Object.keys(methods)`）自动暴露，无需改 preload/白名单。
   - 禁止新增 bridge 顶层窄接口（`quitApp` 等历史遗留除外）。
2. **渲染层调用必须带命名空间前缀**：`bridge.methods.xxx` / `bridge.fs.xxx` / `bridge.path.xxx` …
   - 禁止渲染层直接 `import 'electron'` 或使用 `ipcRenderer`（`utils/bridge.ts`、`utils/ipc.ts` 封装内部除外）。
   - 纯浏览器宿主（受管 Chromium 导航页）bridge 自动降级为空操作，代码必须能容忍。
3. **变更 methods 或白名单后必须执行 `pnpm --filter @ocs-desktop/app gen:contract`**，并把生成产物（`packages/common/src/types/*.generated.ts`）一并提交。
   - `*.generated.ts` 禁止手工编辑。
4. **主 → 渲染推送**使用 `sendToRenderer` + `onRendererEvent` 事件通道（频道在 `common/src/types.ts` 的 `IpcEventMap` 登记），不新增原始 IPC 通道。
5. 扩展 Node 模块白名单能力（fs/path/os 等）→ 修改 `packages/common/src/remote.whitelists.ts` 后重新生成契约。

## 2. 禁止的写法

- **禁止 `void xxx()` fire-and-forget 调用**（eslint `no-void` 已开启）。
  浮动 Promise 必须显式 `.catch(() => {})` 或 `await`。
- 禁止 `@arco-design/web-vue/es/icon`（eslint `no-restricted-imports` 已开启）；
  图标统一 Material Symbols（`components/Icon.vue`）。
- 禁止渲染层 `sendSync` 同步 IPC（唯一保留的同步通道是 preload 构建期 `ipc:introspect`）。
- 禁止在 worker（`src/worker/`）中 import electron —— worker 是 electron-free 纯 Node 进程。
- 禁止手工编辑 `packages/common/src/types/*.generated.ts`。
- 禁止直接 `new Store()`（electron-store），一律走 `src/store.ts` 的 `StoreData` 封装。

## 3. 代码风格

- TypeScript 严格模式；中文注释；tab 缩进；单引号；ES5 尾逗号。
- Vue 组件一律 `<script setup lang="ts">`，不使用 Options API；样式 `<style lang="less" scoped>`。
- 依赖方向单向：`app → common ← web`（common 不得依赖 app/web）。
- 提交前必须通过：`pnpm lint`（prettier + eslint）与 `pnpm typecheck`（pre-push 钩子同款命令）。

## 4. 常见任务指引

| 任务 | 做法 |
| ---- | ---- |
| 新增远程方法 | 加入 `methods.ts` → `pnpm gen:contract` → 渲染层 `bridge.methods.xxx()` 调用 |
| 新增主→渲染事件 | `IpcEventMap` 登记 → `sendToRenderer` 推送 → `onRendererEvent` 订阅 |
| 升级内置浏览器版本 | `node scripts/chrome.install.js <版本> all` → 更新 `chrome.source.ts` 版本与 SHA256 → 上传 CDN |
| 修改内置扩展 | `resources/extensions/extensions.lock.json` + `pnpm --filter @ocs-desktop/app fetch:extensions` |
| 修改打包产物 | `packages/app/electron.builder.json` + `packages/app/scripts/before-pack.js` |

## 5. 安全约束

- worker 即脚本沙箱宿主，第三方脚本权限经 Proxy 代理控制，`vm.Script` 不是安全边界。
- 本地服务器仅绑 `127.0.0.1`；文件代理路由必须路径白名单（`/proxy` 已因 SSRF 风险移除）。
- asar 操作只能放主进程（worker 无 asar 补丁）。

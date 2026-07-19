# OCSplus 每日工作流

## 推荐顺序

1. PM Agent：判断今天最重要的 3 个任务。
2. Research Agent：研究任务依赖的开源项目细节。
3. Architect Agent：确认模块边界和接入方式。
4. UI Agent：确认页面结构和交互要求。
5. Developer Agent / Codex：执行一个最高优先级任务。
6. Reviewer Agent：审查是否通过。
7. PM Agent：更新 `docs/Tasks.md` 和 `docs/Progress.md`。

## 核心原则

文档是大脑，Developer 是手，其他 Agent 是参谋，用户是老板。

## 开发工具链（T012 验证通过）

> 适用目录：`C:\Users\Lenovo\Documents\OCSplus\ocs-desktop-source`。不要修复或安装系统全局 `pnpm` / `corepack`；本机已验证的项目级替代命令为 `npx --yes pnpm@10.21.0`。

### 启动

在项目根目录执行：

```bash
npx --yes pnpm@10.21.0 dev
```

该命令并发启动 common 编译、Vite 与 Electron。T012 实测成功信号：

- Vite：`http://localhost:3000/`（TCP `3000`，HTTP `200`）；
- Electron 内 OCS 服务：`http://127.0.0.1:15319/`（TCP `15319`，HTTP `200`）；
- 浏览器页面：`http://localhost:3000/#/today`，标题为 `OCS Plus`。

### 构建与类型检查

日常无副作用的 Web 构建命令：

```bash
npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build
```

App TypeScript 只读检查：

```bash
npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc --noEmit
```

不要将根目录 `npx --yes pnpm@10.21.0 build` 作为日常验证命令：当前根脚本会链式执行 `lint`，其配置含 `prettier --write` 和 `eslint --fix`，会改写工作区文件。

### 停止与端口清理

1. 优先在启动 `dev` 的终端按 `Ctrl+C`（或停止对应的受管后台进程）。
2. 立刻检查**监听**状态；仅检查 `LISTENING`，不要因普通的对外连接误杀进程：

   ```bash
   netstat -ano | grep -E ':(3000|15319)[[:space:]].*LISTENING' || true
   ```

3. 若仍有输出，先逐个确认 PID 和进程名：

   ```bash
   tasklist.exe /FI "PID eq <PID>" /FO LIST
   ```

4. 仅当 PID 已确认是本项目残留的 `node.exe`（Vite）或 `electron.exe` 后，按 PID 清理其进程树：

   ```bash
   taskkill.exe /PID <PID> /T /F
   ```

5. 重复第 2 步；没有 `LISTENING` 输出即表示端口已释放。

禁止使用按镜像名批量结束（例如 `taskkill /IM node.exe /F` 或 `taskkill /IM electron.exe /F`），以免误杀其他项目。T012 实测：停止受管 `dev` 命令后，Vite/Electron 子进程仍可能分别残留在 `3000` / `15319`；按上述“查端口 → 确认 PID → `taskkill /T` → 复查”流程可安全释放端口。

### 已知非阻断告警

- 直接执行 `pnpm`：不可用（`command not found`）。
- 直接执行 `corepack`：失败，缺少 `C:\Program Files\nodejs\node_modules\corepack\dist\corepack.js`。
- 通过 `npx --yes pnpm@10.21.0` 可正常启动和构建，但 npm 会提示 `Unknown project config "node-linker"`；本次未修改全局工具链或 npm 配置。

## 每天只维护三个核心文件

用户日常只需要重点关注：

1. `docs/PRD.md`
2. `docs/Tasks.md`
3. `docs/Progress.md`

其他文档由对应 Agent 补充。

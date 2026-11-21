# OCS Desktop — AI 辅助编码入口

> 本文件是 AI 工具（Codex / Claude Code / CodeBuddy 等）的统一入口。
> 项目文档由以下两部分组成，开始任何编码任务前请一并阅读：

1. **编码规则（强制）**：`docs/code-rules.md`
   Bridge/IPC 规范、禁止写法（void 调用/图标体系/worker 约束等）、代码风格、任务指引、安全约束。
2. **项目架构与开发文档**：`docs/development.md`
   项目概述、技术栈、目录结构、IPC/内置浏览器/扩展/脚本/worker/存储/服务器机制、开发命令、注意事项。

技术栈一句话速览：Electron 43 + Vue 3.3（Composition API）+ Playwright Core + pnpm monorepo（`packages/app` 主进程、`packages/web` 渲染层、`packages/common` 共享），electron-vite + electron-builder 构建。

@docs/code-rules.md
@docs/development.md

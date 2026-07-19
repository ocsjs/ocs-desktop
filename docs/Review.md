# OCSplus 审查记录

## 审查目标

本文件用于 Reviewer Agent 记录对方案、代码、任务结果的审查意见。

## 审查维度

1. 是否符合 `docs/PRD.md`
2. 是否符合 `docs/Architecture.md`
3. 是否破坏原 OCS 功能
4. 是否有明显 Bug
5. 是否职责混乱
6. 是否需要补测试
7. 是否擅自扩大需求

## 输出格式

每次审查请按以下格式记录：

```markdown
## Review YYYY-MM-DD

结论：通过 / 不通过

### 问题列表

1. ...

### 必须修复项

1. ...

### 可选优化项

1. ...

### 建议交给哪个 Agent

- Developer Agent：...
- PM Agent：...
- Architect Agent：...
```

## 当前待审查项

1. 当前未提交改动范围。
2. `packages/web/src/plus/` 是否符合 MVP 目标。
3. Plus 页面是否破坏原 OCS 路由和功能入口。
4. 项目是否能正常启动和构建。

## Review T001 当前未提交改动

结论：不建议直接整体提交；建议拆分、确认范围后分批保留。

### 问题列表

1. `packages/app/index.ts` 将开发环境加载方式改为 `loadFile('./public/index.html')`，可能破坏 `pnpm dev`。
2. `packages/web/src/config/index.ts` 将原 OCS 路由迁移到 `/legacy/*`，缺少旧路由兼容说明。
3. `packages/app/src/window.ts` 启用 `webviewTag`，叠加宽松 CSP、脚本注入和 `contextIsolation:false`，安全风险较高。
4. `packages/web/src/plus/components/EmbeddedCourseBrowser.vue` 包含内嵌浏览器、用户脚本注入、fetch/XHR hook、进度嗅探，明显超出 MVP。
5. `packages/web/src/store/index.ts`、`packages/web/src/plus/data/dashboard.ts`、`AiQuestionPanel.vue` 存在演示数据，可能误导用户以为功能已经真实可用。
6. `OcsControlPanel.vue` 中“独立稳定版”跳转 `/browser` 疑似不正确，应确认是否应跳 `/legacy/browsers`。
7. `packages/web/src/plus/modules/registry.ts` 将 AI、错题本、资料库、任务、模型配置等全部 enabled，存在需求扩大风险。

### 必须修复/确认项

1. Test Agent 必须验证 `pnpm dev` 是否还能启动。
2. PM Agent 必须确认 MVP 是否包含：内嵌 webview 网课浏览器、内置 Chrome 下载、AI 题目助手入口、任务提醒/资料库/错题本/模型配置入口。
3. Developer Agent 后续只能基于确认后的单个任务修改，禁止继续扩大功能。
4. 对原 OCS 路由需决定：保留旧路径重定向，或明确只支持 `/legacy/*` 并更新文档。
5. 所有假数据必须标注“示例/开发中”，或从 MVP 主界面移除。

### 建议交给哪个 Agent

- PM Agent：确认 MVP 边界，决定哪些 Plus 模块 enabled。
- Architect Agent：定义 Plus 与原 OCS 的边界，特别是 webview 和脚本注入是否允许进入 MVP。
- Test Agent：验证 `pnpm dev`、Plus 首页、原版入口、浏览器启动、配置保存。
- Developer Agent：仅在 PM/Architect 明确后，按单任务修复路由兼容、假数据展示、启动路径等问题。

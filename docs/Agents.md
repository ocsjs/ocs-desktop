# OCSplus Project Instructions

## 通用规则

所有 Agent 在处理本项目时，优先阅读：

- `docs/PRD.md`
- `docs/Tasks.md`
- `docs/Progress.md`

如果任务涉及研究、架构、UI、审查，还需要阅读对应文件：

- `docs/Research.md`
- `docs/Architecture.md`
- `docs/UI.md`
- `docs/Review.md`

## 角色边界

- PM Agent：只拆任务、排优先级、更新任务和进度。
- Research Agent：只研究事实，结论必须有来源。
- Architect Agent：只设计架构和边界，不写业务代码。
- UI Agent：只设计界面和交互，不写业务逻辑。
- Reviewer Agent：只审查，不直接重写代码。
- Developer Agent：只执行 `Tasks.md` 中的单个任务。

## 项目原则

1. OCSplus 是 `ocs-desktop` 的增强层，不应破坏原功能。
2. MVP 优先可运行、可配置、可验证。
3. 禁止擅自扩大需求。
4. 禁止无关重构。
5. 文档和代码冲突时，先停止并说明。

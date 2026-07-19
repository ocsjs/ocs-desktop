# OCSplus 进度记录

## 当前阶段

阶段：项目接管 / PM 文档初始化

## 当前状态

已确认项目路径：

```text
C:\Users\Lenovo\Documents\OCSplus\ocs-desktop-source
```

项目已绑定为 Hermes Project：`OCSplus`

当前项目基础信息：

- 原项目：`ocs-desktop`
- 技术栈：Electron + Vue 3 + Vite + TypeScript + pnpm workspace
- 当前方向：在原 OCS 桌面端基础上增加 OCSplus 工作台和学习辅助能力
- 本地已有大量未提交改动
- 已发现新增目录：`packages/web/src/plus/`

## 已完成

- [x] 初步识别项目结构
- [x] 初步识别技术栈
- [x] 确认当前缺少 PM 文档
- [x] 创建 `docs/PRD.md`
- [x] 创建 `docs/Tasks.md`
- [x] 创建 `docs/Progress.md`
- [x] 创建 `docs/Research.md`
- [x] 创建 `docs/Architecture.md`
- [x] 创建 `docs/UI.md`
- [x] 创建 `docs/Review.md`

## 当前风险

1. T001 已确认：当前本地改动较多，不建议整体提交，应拆分处理。
2. `packages/web/src/plus/` 同时包含 MVP 入口和超出 MVP 的探索功能。
3. Plus 改造存在原版 OCS 路由兼容风险。
4. `webviewTag`、宽松 CSP、脚本注入、`contextIsolation:false` 组合存在较高安全风险。
5. 当前存在演示/假数据，可能误导用户以为功能已真实可用。
6. T003 已确认项目可启动、Web 构建通过，但存在非阻断告警。

## 下一步建议

优先执行：

1. Research / Reviewer Agent 已派发：梳理当前未提交改动。
2. Test Agent 已派发：验证项目能否启动。
3. PM Agent 根据结果更新 `docs/Tasks.md` 和本文件。

## 当前进行中

- T001：梳理当前未提交改动，Research / Reviewer Agent 已完成。
- T003：验证项目能否启动，Test Agent 已完成。

## Research / Reviewer Agent 结果摘要

T001 已完成，结论：不建议直接整体提交当前所有改动，应拆分、确认边界后分批保留。

### 建议保留

- `docs/*` 项目协作文档。
- Plus 基础导航和原版入口方向。
- `packages/web/src/plus/pages/LegacyHub.vue`
- `packages/web/src/plus/components/PlusIcon.vue`
- `packages/web/src/components/Icon.vue`
- `packages/web/src/components/browsers/BrowserOperators.vue`
- `packages/web/src/utils/browser.ts`
- `packages/common/src/utils/valid.browser.ts`

### 待确认

- 内置浏览器下载方案：`remote.register.ts`、`CourseBrowser.vue`
- workspace/lockfile：`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`packages/web/package.json`
- Plus 模块是否全部启用：`registry.ts`、`ModulePlaceholder.vue`

### 风险较高

- `packages/app/index.ts`：开发环境加载方式可能破坏 `pnpm dev`。
- `packages/app/src/window.ts`：`webviewTag`、`nodeIntegration`、`contextIsolation:false` 安全风险较高。
- `packages/web/index.html`：CSP 过宽。
- `packages/web/src/config/index.ts`：原 OCS 路由迁移到 `/legacy/*`，可能破坏旧路径。
- `packages/web/src/pages/index.vue`：大幅替换原主框架，需重点验证原功能。
- `packages/web/src/store/index.ts`、`packages/web/src/plus/data/dashboard.ts`、`AiQuestionPanel.vue`：存在演示/假数据。

### PM 判断

MVP 继续按 `PRD.md` 收窄：先保证可启动、可配置、可展示状态、可回原版入口。内嵌 webview 自动注入、AI 题目助手、错题本、资料库、模型配置完整能力暂不进入第一阶段主线。

## 最近一次 PM 判断

当前已完成两项基础验证：

1. T001：已梳理当前未提交改动，结论是不建议整体提交，应拆分处理。
2. T003：项目可以启动，Web 构建通过，Plus 首页可访问。

下一阶段不应继续扩展新功能，应优先处理：

1. T011：处理高风险改动清单。D001 已完成；已继续派 Developer Agent 执行 D002：修正原 OCS 入口路由与兼容。
2. T013：验证配置保存与原版入口。
3. T012：修复或文档化开发环境工具链告警。

T010 已完成：MVP 边界已写入 `docs/Architecture.md`。

## 当前进行中补充

- T010：收窄 MVP 功能边界，Architect Agent 已完成，结果已写入 `docs/Architecture.md`。

## Test Agent 结果摘要

T003 已完成，结论：当前项目可以启动，Web 构建通过，但存在非阻断告警/运行错误。

### 真实验证结果

- 启动命令：`npx --yes pnpm@10.21.0 dev`
- `@ocs-desktop/common` TypeScript 编译通过。
- Vite dev server 启动成功：`http://localhost:3000/`
- Electron 主进程启动成功，OCS 服务端口：`15319`
- HTTP 验证：
  - `http://localhost:3000/` 返回 `200 OK`
  - `http://127.0.0.1:15319/` 返回 `200 OK`
- 浏览器验证：成功打开 `http://localhost:3000/#/today`
- 页面标题：`OCS Plus`
- 可见 Plus 首页内容：`今日学习`、`网课浏览器`、平台入口、设置/通知等导航
- Web 构建命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- Web 构建结果：成功，退出码 `0`

### 非阻断问题

1. 全局 `pnpm` 不可用，只能通过 `npx --yes pnpm@10.21.0` 运行。
2. `corepack` 异常：找不到 `corepack.js`。
3. Vite dev 出现 `electron` 依赖解析告警，未阻止页面访问。
4. 内置浏览器目录不存在：`bin/chrome`，未阻止主程序启动。
5. 停止 dev server 时需额外清理 Vite/Electron 子进程，避免端口残留。

## Developer Agent 结果摘要：D001 收窄 Plus 模块启用状态

D001 已完成，结论：Plus 导航已收窄到第一阶段 MVP 主线入口，MVP 外模块保留路由和模块注册占位，但不再作为启用模块出现在主导航中。

### 本次修改

- `packages/web/src/plus/modules/registry.ts`
  - 将 `AI 题目助手`、`错题本`、`资料库`、`任务提醒`、`模型配置` 从 `enabled: true` 降级为 `enabled: false`。
  - 为上述模块补充 `P2 / 暂未开放` 或 `P2 / 开发中` 状态。
  - 调整描述，明确完整 AI、题库/错题、资料库、任务系统、模型配置不进入第一阶段 MVP。
- `packages/web/src/plus/pages/ModulePlaceholder.vue`
  - 将占位页默认文案改为“第一阶段 MVP 暂未开放”。
  - 将占位页卡片改为“暂未开放 / MVP 边界 / 后续评审”，避免暗示已经接入 ZError、数据库、云服务或真实业务能力。

### 验证结果

- 验证命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- 验证结果：成功，退出码 `0`。
- 构建输出仍有已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. D001 仅处理模块启用状态与占位文案，没有清理首页演示/假数据；该问题继续留给 D003。
2. `/ai-question`、`/question-bank`、`/documents`、`/tasks`、`/model-config` 路由仍保留，用于未来扩展占位；直接访问时会显示暂未开放说明。
3. `/browser`、webview / 注入风险、原版入口兼容不在本次范围内，继续按 D002、D006 拆分处理。

## Developer Agent 结果摘要：D002 修正原 OCS 入口路由与兼容

D002 已完成，结论：Plus 中“进入原 OCS 稳定/高级能力”的入口已统一指向 `/legacy/*`，避免误跳到 Plus 的 `/browser` 半成品网课浏览器；原 OCS 浏览器、脚本、设置入口保留。

### 本次修改

- `packages/web/src/config/index.ts`
  - 保留原 OCS 页面承载路由：`/legacy/browsers`、`/legacy/user-scripts`、`/legacy/setting`。
  - 补充旧路径兼容重定向：`/browsers -> /legacy/browsers`、`/user-scripts -> /legacy/user-scripts`、`/setting -> /legacy/setting`。
- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 将“独立稳定版”入口从 `/browser` 修正为 `/legacy/browsers`。
- `packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
  - 将“原 OCS 稳定脚本环境”入口从 `/browser` 修正为 `/legacy/browsers`。

### 验证结果

- 验证命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- 验证结果：成功，退出码 `0`。
- 路由验证：启动 `@ocs-desktop/web` Vite dev server 后访问：
  - `http://localhost:3000/#/legacy/browsers`：可进入原浏览器列表页面。
  - `http://localhost:3000/#/legacy/user-scripts`：可进入原脚本列表页面。
  - `http://localhost:3000/#/legacy/setting`：路由可解析到原设置页；在纯浏览器 Vite 环境下原设置页仍会因缺少 Electron 顶层 `store.window` 抛出既有运行时错误，Electron 环境需继续专项复测。
  - `http://localhost:3000/#/browsers`：已重定向到 `#/legacy/browsers`。
- 构建输出仍有已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. `/browser` 仍保留为 Plus 网课浏览器入口；其中 webview / 注入风险不在 D002 范围内，继续交给 D006。
2. 原设置页在纯浏览器环境依赖 Electron 顶层 store，建议 T013 或后续测试在 Electron 运行环境复测 `/legacy/setting`。
3. 本次未处理首页演示/假数据、配置保存、内置浏览器下载能力，继续按 D003、D004、D007 拆分处理。

## 用户新增需求：右侧控制台脚本运行状态

用户要求右侧“网课控制台”需要显示脚本运行状态，例如开始刷课、切换下一章节等具体流程。可以参考原版 OCS 的状态含义和交互，但不能照搬原版代码，要做 OCSplus 原生适配。

PM 判断：该需求可以进入 P1，但必须收窄边界。第一步只做“状态展示 + 事件流 + 失败提示”，不直接扩大为完整自动刷课闭环，也不引入完整 AI 自动答题。

已在 `docs/Tasks.md` 新增并启动：

- T014：右侧控制台原生适配脚本运行状态。

Research Agent 已完成 T014 第一步：原版 OCS 状态含义、状态来源和 OCSplus 原生适配字段研究。结果已写入 `docs/Research.md`。

已派 Developer Agent 执行 T014 最小可见版：D014-1 + D014-2 + D014-4。目标是先建 runtime 状态模型和事件总线，并让右侧控制台显示真实基础状态；本轮不做 D014-3，不接入 EmbeddedCourseBrowser 真实事件，不实现自动刷课/自动下一节/自动答题。

## Developer Agent 结果摘要：T014 最小可见版（D014-1 + D014-2 + D014-4）

T014 最小可见版已完成，结论：右侧“网课控制台”已从静态自动化开关改为读取 OCSplus runtime 基础状态并展示状态来源；本轮没有改动 `EmbeddedCourseBrowser`，也没有新增自动刷课、自动下一节或自动答题能力。

### 本次修改

- `packages/web/src/plus/runtime/status.ts`
  - 新增 `OcsRuntimeStatus`、脚本阶段、页面、课程、流程、动作、错误等类型。
  - 新增默认状态 `createDefaultOcsRuntimeStatus()`、状态合并 `mergeOcsRuntimeStatus()`、脚本配置状态补丁 `createScriptConfigStatusPatch()`。
- `packages/web/src/plus/runtime/events.ts`
  - 新增 runtime 事件类型和 payload 定义。
  - 新增基于 `EventTarget` 的轻量事件总线：`emitOcsRuntimeEvent()`、`listenOcsRuntimeEvent()`、`listenAllOcsRuntimeEvents()`。
- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 改为展示脚本、页面、课程、流程、错误和建议操作状态。
  - 状态来源当前来自真实 `store.render.scripts` 脚本配置。
  - 移除误导性的静态“自动播放 / 自动下一节 / 题目接管”开关，改为提示“只展示状态，不执行自动刷课”。
  - 保留手动入口：原版浏览器、脚本列表、请求重新注入、同步进度快照；这些只发请求/事件，不直接调用 `webview.executeJavaScript`。

### 验证结果

- 验证命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- 验证结果：成功，退出码 `0`。
- 构建输出仍有已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. 本轮按要求没有做 D014-3，因此页面标题、URL、平台、课程进度、注入结果仍会显示“暂未接入 / 暂未识别”，需要后续由 `EmbeddedCourseBrowser` 发送真实 runtime 事件后才能变为完整状态。
2. “请求重新注入 / 同步进度快照”仅沿用现有自定义事件触发已有流程，不代表注入成功、运行中或刷课成功。
3. 后续建议继续执行 D014-3 和 D014-5：接入真实 webview / 注入 / 进度事件，并完善失败提示与来源展示；仍需保持不新增自动播放、自动下一节、自动答题闭环的边界。

## 当前派发：T014 D014-3

已派 Developer Agent 执行 D014-3：让 `EmbeddedCourseBrowser` 将页面加载、加载完成、加载失败、脚本注入开始/成功/失败、runtime 探测、进度同步成功转换为 OCSplus runtime 事件。边界：不改 UI 设计，不实现自动刷课 / 自动下一节 / 自动答题，不扩大 webview 安全风险。


## Developer Agent 结果摘要：D014-3 EmbeddedCourseBrowser runtime 事件接入

D014-3 已完成，结论：`EmbeddedCourseBrowser` 已将真实 webview 页面生命周期、脚本注入结果、runtime 探测结果和课程进度同步成功转换为 OCSplus runtime 事件，右侧 `OcsControlPanel` 可通过既有事件总线接收并合并状态。本轮没有改 UI 设计，没有新增自动刷课 / 自动下一节 / 自动答题行为。

### 本次修改

- `packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
  - 在 `handleStartLoading` 发出 `page-loading`。
  - 在 `handleStopLoading` / `handleTitleUpdate` 发出 `page-loaded`。
  - 在 `handleFailLoad` 发出 `page-load-failed`。
  - 在 `injectEnabledScripts` 注入前发出 `script-inject-start`，成功执行脚本后发出 `script-inject-success`，脚本缺失、脚本执行错误或 webview 执行异常时发出 `script-inject-failed`。
  - 在 OCS runtime 探测完成后发出 `runtime-probed`，仅作为状态展示，不触发页面控制。
  - 在 `syncStudyProgressFromWebview` 成功识别并合并进度快照后发出 `study-progress-synced`。
- `packages/web/src/plus/runtime/events.ts`
  - 为 `page-loading` payload 补充可选 `platform` 字段，便于页面加载事件同步平台识别结果。
- `packages/web/src/plus/runtime/status.ts`
  - 调整状态合并逻辑，允许事件补丁显式清除旧的顶层 `error`，避免页面/注入恢复后右侧控制台残留旧错误。

### 验证结果

- 验证命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- 验证结果：成功，退出码 `0`。
- 构建输出仍有已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. 本次只接入真实状态事件，不处理 D014-5 的失败提示与状态来源细化展示。
2. `start_study` 仅在探测到 OCS runtime 且匹配脚本时作为“状态展示”发出，不代表自动播放、自动下一节或自动答题已经执行。
3. 课程进度仍来自既有启发式页面快照，跨平台准确度有限；后续如要提高准确度应另开专项，不应在 D014-3 扩大为 fetch/XHR hook 或完整平台适配。

## Developer Agent 结果摘要：D014-5 失败提示与状态来源展示

D014-5 已完成，结论：右侧“网课控制台”现在会明确展示状态来源、来源明细和最后 runtime 事件，并针对常见失败 / 待人工处理状态给出可执行建议。本轮只补充状态文案与诊断建议，没有实现自动刷课、自动下一节或自动答题，也没有新增 fetch / XHR hook。

### 本次修改

- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 在顶部状态卡补充“来源明细”和“最后事件”，区分脚本配置快照、Plus 内嵌浏览器页面 / 注入 / 进度事件、用户手动入口等来源。
  - 新增状态诊断建议区，复用现有卡片样式，不改变整体 UI 风格。
  - 针对无脚本、脚本未启用、页面未打开、注入失败 / 运行异常、未匹配脚本、课程未识别、题目需人工处理 / 需要人工确认等状态输出具体下一步。

### 提示 / 来源覆盖范围

- 状态来源：`store.render.scripts` 脚本配置、`EmbeddedCourseBrowser` 页面加载 / 标题 / 注入 / runtime 探测 / 进度同步事件、用户手动操作。
- 失败提示：无脚本、脚本未启用、页面未打开、注入失败或页面失败、脚本已注入但未匹配、课程快照未识别。
- 人工处理：`question_need_manual` 与 `manual_required` 只提示用户手动查看题目 / 任务，明确不自动识题、答题或提交。

### 验证结果

- 验证命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- 验证结果：成功，退出码 `0`。
- 构建输出仍有已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. 课程识别仍依赖既有启发式进度快照，跨平台准确度有限；本次只展示“课程未识别”建议，不扩大为平台深度适配。
2. 内嵌 webview / 注入能力仍属于高风险路径；本次未新增相关能力，也未放宽安全配置。
3. 如后续要提高匹配准确度，应另开专项处理脚本匹配规则或平台适配，不应在控制台文案任务中实现自动化闭环。

## 当前派发：T013 配置保存与原版入口验收

已派 Test Agent 在 Electron 开发环境执行 T013：验证浏览器路径配置保存/重启读取、`/legacy/browsers`、`/legacy/user-scripts`、`/legacy/setting` 以及 Plus 首页主要入口的兼容性。测试只记录结果，不修改代码。

由于首轮 T013 尚未返回可收口报告，已派第二个 Test Agent 进行独立复核；若 GUI 自动化受限，必须明确列为阻塞，不得推断通过。

第二轮 T013 独立复核已完成：开发服务、Vite 首页与 Legacy 浏览器/脚本的 Web 预览通过，但 Electron 窗口无法由当前测试环境驱动或读取。因此浏览器路径“填写→保存→重启→读取”及三个 Legacy 页面在 Electron 内的真实交互均标记为 blocked，不得视为通过；D008 修复后需由用户或具备桌面自动化能力的 Test Agent 复测。

## 当前派发：T011 D003 首页假数据处理

已派 Developer Agent 执行 D003：移除或明确标注首页演示/假数据。边界：只处理未接入真实来源的学习进度、任务、AI/题目等展示，不改 webview/脚本注入、配置保存或自动化能力。

## Developer Agent 结果摘要：D003 首页演示/假数据处理

D003 已完成，结论：首页不再将静态课程进度、学习时长、任务截止时间或 AI 答案/模型状态呈现为真实用户数据；页面保留原有布局和后续接入位置。

### 本次修改

- `packages/web/src/store/index.ts`
  - 移除默认的四门演示课程、756 分钟累计时长、126 分钟今日学习和 120 分钟目标值，默认学习状态改为空数据。
- `packages/web/src/plus/data/dashboard.ts`
  - 移除静态任务卡、虚构章节和资料列表。
  - 学习概览只接受带 `sourceUrl` 的页面同步课程；历史无来源课程会被过滤，避免已存演示数据继续显示。
  - 未实现的学习时长/今日学习统计统一显示“暂未接入”；未同步课程显示“暂无真实数据”。
- `packages/web/src/plus/components/StudyOverview.vue`
  - 无真实课程时展示“暂无真实学习数据”空状态；仅页面同步课程展示进度。
- `packages/web/src/plus/pages/Today.vue`
  - 用“任务系统开发中 / 暂无真实任务数据”占位替换四张虚构截止任务卡。
- `packages/web/src/plus/components/AiQuestionPanel.vue`
  - 移除静态题目、答案、模型名称、API 正常状态、额度和置信度，明确为“暂未接入真实题目或模型服务”。
- `packages/web/src/plus/components/CourseBrowserMock.vue`
  - 保留未挂载的视觉预览组件，但明确标注其内容不代表真实课程、进度或资料。

### 验证结果

- 静态断言：确认默认课程为空、虚构任务/模型文本已移除，并确认学习、任务、AI 空状态文案存在；通过。
- Web 构建命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- Web 构建结果：成功，退出码 `0`。
- 构建仍输出已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. 真实课程进度当前仍依赖既有页面快照，跨平台识别准确性需要后续专项验证；本次不扩大为注入或抓包能力。
2. 学习时长、任务和 AI/题目尚无真实数据源，因此保持“暂未接入 / 开发中”状态；后续接入时应明确来源与可核验条件。
3. `CourseBrowserMock.vue` 不在当前页面引用链中；如未来重新挂载，仍应只作为显式开发预览或替换为真实 runtime 数据。

## 当前派发：T011 D006 高风险能力隔离

已派 Developer Agent 执行 D006：隔离 webview / 脚本注入高风险能力，确保 MVP 默认流程不依赖自动注入；保留时必须明确实验属性或默认禁用。边界：不破坏 T014 状态展示、原版入口或构建，不新增自动化/权限/CSP 放宽。

## Developer Agent 结果摘要：D006 高风险 webview / 注入能力隔离

D006 已完成，结论：第一阶段 MVP 默认不再创建 `<webview>`、加载第三方课程页、执行页面嗅探或自动注入用户脚本；原 OCS 浏览器和脚本管理入口、右侧控制台的脚本配置 / 手动操作 / 诊断展示继续保留。

### 本次修改

- `packages/app/src/window.ts`
  - 移除新增的 `webviewTag: true`，Electron 默认不允许 `<webview>`。
  - 移除仅服务于 Plus webview 新标签转发的 `did-attach-webview` 处理器。
- `packages/web/src/plus/experiments.ts`
  - 新增唯一的实验开关 `experimentalEmbeddedWebviewEnabled = false`，并明确没有 MVP 运行时启用入口；重新启用需要专项安全评审。
- `packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
  - `<webview>` 从 `v-show` 改为由实验开关控制的 `v-if`，默认不会创建 guest view。
  - 删除页面加载完成后的自动注入调用；注入函数自身也会在实验关闭时直接返回。
  - 将内嵌页面和注入按钮明确标记为“实验能力默认停用”，引导用户进入原 OCS 浏览器 / 脚本环境。
- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 继续展示 runtime 状态、诊断和原版 OCS 入口；“请求重新注入”“同步进度快照”在实验关闭时保持禁用。
  - 明确控制台不执行自动刷课，且内嵌 webview、页面嗅探、脚本注入默认停用。
- `packages/web/src/plus/components/StudyOverview.vue`
  - 禁用依赖内嵌页面嗅探的进度同步按钮，避免默认流程触发第三方页面脚本执行。
- `packages/web/index.html`
  - 收窄 Plus 新增 CSP：移除 `unsafe-eval`、宽泛 `default-src` 与第三方 `frame-src`，增加 `frame-src 'none'`、`object-src 'none'`、`base-uri 'self'`。

### 验证结果

- 静态隔离断言通过：确认 `webviewTag: true`、`unsafe-eval` 已不存在，实验开关为 `false`，并确认 webview 使用 `v-if` 而非仅隐藏。
- Web 构建命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- Web 构建结果：成功，退出码 `0`。
- 构建仍输出已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. 原 OCS 既有渲染进程仍依赖 `nodeIntegration: true` 和 `contextIsolation: false`；本任务未修改以避免破坏原版 IPC / `require` 依赖。若要收紧，应另开兼容性专项，先引入 preload 与受限 IPC。
2. `EmbeddedCourseBrowser.vue` 中实验代码仍会随包构建，但在 MVP 下没有 Electron 能力、DOM 创建路径或可点击启用入口；若未来恢复，必须同时评审 Electron 配置、CSP、允许域、脚本来源与注入边界。
3. 课程进度嗅探、fetch/XHR hook 和完整自动化仍不在 MVP；后续需要另开专项，不得通过修改实验开关直接上线。

## 当前派发：T011 D007 内置浏览器下载降级

已派 Developer Agent 执行 D007：将内置浏览器自动下载/安装能力从 MVP 主流程降级或隔离。第一版只引导用户配置本地浏览器路径；内置下载不得自动触发或影响启动、首页、原版入口与配置保存。

## 当前派发：T012 工具链流程验证与文档化

已派 Test Agent 执行 T012：在不修改系统级 Node、pnpm、corepack 的前提下，验证并文档化项目标准启动、构建、停止、端口清理流程。

## 当前派发：T011 最终只读审查

已派 Reviewer Agent 对 D001、D002、D003、D006、D007 做最终只读审查，确认是否满足 MVP 边界、是否可将 T011 收口，以及是否还存在必须随 T013 验收的风险项。

## T011 审查阻塞：开发环境加载回归

Reviewer 结论：T011 暂不可收口。`packages/app/index.ts` 开发环境错误地加载 `./public/index.html`，未加载 Vite `http://localhost:3000`，会依赖过期或缺失的 build 产物，且无法代表当前前端源码。此前 D008 委派没有保持活跃，现已重新派发 Developer Agent 执行唯一修复任务：恢复开发环境加载 Vite URL，同时保持打包环境加载静态产物。现有 T013 测试结果只能作为修复前基线；D008 后必须重新验收。

D007 已完成，结论：MVP 已移除 Plus 内置 Chrome 的远程下载/安装入口，并取消应用启动阶段的内置 Chrome 初始化；用户只会被引导配置本地 Chrome / Edge 程序路径。

### 本次修改

- `packages/app/index.ts`
  - 移除启动流程中的 `initChrome(window)` 调用，避免内置浏览器资源解压、失败弹窗或重启逻辑阻塞应用启动、Plus 首页及原 OCS 入口。
- `packages/app/src/tasks/remote.register.ts`
  - 删除 `getBundledBrowserInfo`、`installBundledBrowser` 远程方法及固定 Chrome for Testing 下载/解压实现，渲染层无法再触发该下载。
- `packages/web/src/plus/pages/CourseBrowser.vue`
  - 删除“OCS Plus 内置浏览器”的检测、下载、切换和版本过高时的安装入口。
  - 浏览器设置仅保留本地可执行文件路径填写/选择；明确提示内置浏览器下载、安装、版本管理属于后续专项，不会自动下载或影响应用启动。
  - 浏览器版本过高时仅提示用户改配兼容的本地 Chrome / Edge 路径，不再提供下载操作。

### 验证结果

- 静态隔离断言通过：`CourseBrowser.vue` 与 `remote.register.ts` 不再包含 `installBundledBrowser`、`getBundledBrowserInfo`、`下载并使用` 或 `安装内置浏览器`；`packages/app/index.ts` 不再调用 `initChrome`。
- Web 构建命令：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`
- Web 构建结果：成功，退出码 `0`。
- 构建仍输出已知 npm 配置告警：`Unknown project config "node-linker"`，未阻断构建。

### 剩余风险 / 后续建议

1. 原 OCS 保留的 `init.chrome.ts`、打包内置浏览器识别及首次设置中的软件更新提示仍在代码库中；D007 已将其从 MVP 启动和 Plus 页面路径移除。若未来恢复内置浏览器，应另开专项评审下载源、完整性校验、跨平台包体、失败恢复及用户授权。
2. 原 OCS 自动化对浏览器版本仍有兼容限制；MVP 只给出本地路径配置/兼容版本提示，用户需自行准备匹配的本地浏览器。

## Test Agent 结果摘要：T012 开发工具链流程验证与文档化

T012 已完成：未安装或修复系统全局 Node、pnpm、corepack；已将统一启动、构建、停止和端口清理流程写入 `docs/DailyWorkflow.md`。

### 真实验证结果（2026-07-10）

| 项目 | 精确命令 / 端口 | 结果 |
| --- | --- | --- |
| 工具替代 | `npx --yes pnpm@10.21.0 --version` | 通过，输出 `10.21.0`。 |
| 全局工具现状 | `pnpm --version`；`corepack --version` | 失败（预期记录）：前者 `command not found`；后者缺少 `C:\Program Files\nodejs\node_modules\corepack\dist\corepack.js`。未修复。 |
| Web 构建 | `npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build` | 通过，退出码 `0`。 |
| App 类型检查 | `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc --noEmit` | 通过，退出码 `0`。 |
| 统一启动 | `npx --yes pnpm@10.21.0 dev` | 通过：Vite 在 `3000` 启动，Electron OCS 服务在 `15319` 启动。 |
| HTTP 探测 | `curl.exe -sS -o NUL -w 'http://localhost:3000/ -> %{http_code}\n' http://localhost:3000/`；`curl.exe -sS -o NUL -w 'http://127.0.0.1:15319/ -> %{http_code}\n' http://127.0.0.1:15319/` | 均通过：`200`。 |
| 页面探测 | 浏览器访问 `http://localhost:3000/#/today` | 通过：标题 `OCS Plus`，可见“今日学习”。 |
| 停止后的残留复现 | 停止受管 `dev` 进程后执行 `netstat -ano` | 复现：`node.exe` 仍监听 `3000`，`electron.exe` 仍监听 `15319`。 |
| 精确清理与复查 | `tasklist.exe /FI "PID eq <PID>" /FO LIST` → `taskkill.exe /PID <PID> /T /F` → `netstat -ano \| grep -E ':(3000\|15319)[[:space:]].*LISTENING'` | 通过：确认本项目 PID 后清理；最终两个端口均无 `LISTENING` 项。 |

### 安全操作结论

1. 后续统一使用 `npx --yes pnpm@10.21.0`，不要调用不可用的全局 `pnpm` 或异常的 `corepack`。
2. 日常构建使用 Web filter 命令；根目录 `build` 会运行 `prettier --write`、`eslint --fix`，不适合作为不改工作区的测试命令。
3. 退出开发环境先正常停止，再按“端口检查 → PID 确认 → 单 PID `taskkill /T` → 复查”处理残留；禁止按 `node.exe` / `electron.exe` 镜像名批量结束。
4. npm 仍会输出 `Unknown project config "node-linker"` 非阻断告警；本任务按边界不改 npm 或全局工具链。

## Developer Agent 结果摘要：D008 Electron 开发环境加载 Vite 页面回归复核

D008 已完成，结论：当前 `packages/app/index.ts` 的开发/生产加载分支已经符合要求，因此无需再改动业务代码：`app.isPackaged` 为真时加载静态产物 `./public/index.html`，否则加载 Vite `http://localhost:3000`。本次以 Electron DevTools Protocol 读取实际渲染页，确认 Electron 开发环境未加载静态产物。

### 本次修改

- `docs/Progress.md`
  - 记录 D008 复核和真实验证结果。
- `packages/app/index.ts`
  - 未修改。复核时工作区及 `HEAD` 均已包含正确的 `loadURL('http://localhost:3000')` 开发分支；为遵守最小改动原则保留现状。

### 真实验证结果（2026-07-10）

- 开发环境：先启动 Vite，再以 `electron --remote-debugging-port=9333 .` 启动 App；Electron 启动、OCS 服务 `15319` 启动成功。
- Electron 实际渲染页：查询 `http://127.0.0.1:9333/json/list` 返回页面标题 `OCS Plus`，URL 为 `http://localhost:3000/#/today`。
- Web 构建：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build` 成功，退出码 `0`。
- App 类型检查：`npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc --noEmit` 成功，退出码 `0`。
- 两项命令均仍输出已知非阻断 npm 告警：`Unknown project config "node-linker"`。

### 剩余风险 / 后续建议

1. 本次运行确认的是开发分支实际加载 Vite URL；打包产物分支未执行安装包级手工验收，但代码仍保留 `app.isPackaged` 下的静态 `loadFile` 分支，且 Web 构建已生成对应静态产物。
2. 当前工作区存在其他未提交改动；D008 未接触 webview、安全设置、浏览器下载、路由、UI、控制台或其他业务逻辑。

## 用户新增优先需求：T016 Plus 内嵌浏览器

用户明确要求现在推进内嵌浏览器。PM 已在 `docs/Tasks.md` 创建 T016 并设为 P0；不恢复旧的高风险自动注入/嗅探/自动化闭环。Architect Agent 已完成第一阶段安全架构，结果已写入 `docs/Architecture.md`：受控课程查看器仅支持用户主动 URL 与基础加载状态，主进程强制 guest 隔离、集中 URL policy，并默认拒绝弹窗、下载、权限与非允许导航。D016-1 首轮 Developer Agent 超时，已在 `packages/app/src/window.ts` 留下引用不存在 `course-guest-policy` 的部分改动，当前不可验收；PM 已重新派 Developer Agent 接管、补齐 policy、运行 App 类型检查后再收口。

## Developer Agent 结果摘要：T016 D016-1 课程 guest 安全边界与集中 URL policy

D016-1 已完成：主进程已为经识别的课程 guest 建立独立安全边界和集中 URL policy；主窗口保留既有 Node / isolation 兼容配置，未改路由、下载、脚本注入、嗅探或自动化实现。

### 本次修改

- `packages/app/src/course-guest-policy.ts`
  - 新增唯一的课程 URL 判定点：仅接受无嵌入凭据的 `https:` URL，并使用精确基线 host 白名单。
  - 拒绝无效 URL、非 HTTPS 协议、带凭据 URL 和未知 host；非基线 host 只能由未来 UI 在本次会话中显式批准，不持久化且不扩大为通配域名。
  - 定义课程 guest 标识和专用 `persist:ocs-plus-course-v1` partition，未知 webview 附加请求会被拒绝。
- `packages/app/src/window.ts`
  - `will-attach-webview` 只接受带课程 guest 标识、专用 partition 且 URL policy 允许的请求；对 guest 强制 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、`webSecurity: true`、禁用 remote module / DevTools / preload / popup。
  - 为课程专用 session 默认拒绝权限请求、下载和非允许的主/子 frame 请求；直接导航和重定向复用同一 URL policy，新窗口一律拒绝。
  - 保留主窗口原有 `shell.openExternal()` 行为，仅用于主窗口；课程 guest 的 popup / 导航拒绝路径不会作为外部浏览器 fallback。
  - 修正首轮部分改动中 Electron 事件参数使用错误：`will-navigate` / `will-redirect` 现在按 `(event, url)` 形式校验。Electron 35 无 `will-frame-navigate` 类型事件，子 frame 仍由 session `webRequest.onBeforeRequest` 强制校验。
- `packages/app/test/course-guest-policy.test.cjs`
  - 保留并运行 policy 回归覆盖：精确 host、危险协议/凭据/无效 URL、会话批准和 guest 标识/partition 校验。

### 验证结果（2026-07-10）

- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc --noEmit`：通过，退出码 `0`。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc && node --test test/course-guest-policy.test.cjs`：通过，4/4 tests passed。
- `git diff --check`：通过；输出仅包含工作区既有 CRLF 警告。

### 后续边界

1. D016-2 才负责让受限查看器带上课程 guest 标识并移除旧注入/嗅探/自动化链；D016-1 不接入 UI 或渲染进程桥接。
2. 非基线 host 的用户确认 UI、受控失败状态和主动 URL 生命周期属于 D016-3，当前不会自动批准未知 host。
3. 仍需由 D016-4 在 Electron 中手动验证 guest 附加、导航拒绝、弹窗/下载/权限拒绝和原 OCS 入口回归。

D016-1 已收口：App 类型检查与 4 个 URL policy 回归测试通过。已派 Developer Agent 执行 D016-2：将 `EmbeddedCourseBrowser.vue` 收敛为无脚本注入、无嗅探、无自动化运行链的受限查看器，并与 D016-1 的 guest 标识/专用 partition 对接。

## Developer Agent 结果摘要：T016 D016-2 安全课程查看器运行链收敛

D016-2 已完成：`EmbeddedCourseBrowser` 已收敛为受限课程查看器；保留原有页面布局、平台入口、地址栏、基础后退/前进/刷新和原 OCS 脚本入口，不再向课程 guest 注入、读取或自动操作页面。

### 本次修改

- `packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
  - `<webview>` 现在携带 D016-1 要求的 `data-ocs-plus-course="true"` 标识和 `persist:ocs-plus-course-v1` 专用 partition；移除 `allowpopups`。
  - 删除所有 `webview.executeJavaScript`、用户脚本加载/运行、`new Function`、OCS runtime 探测、DOM/课程/进度采集、fetch/XHR hook、原 OCS 浮层处理，以及新窗口和 console bridge 运行链。
  - 页面加载完成只更新本地基础查看器状态和 URL；不注入、不探测、不同步进度。
  - 未实现 D016-3 的非基线 host 批准 UI 或用户主动 URL 生命周期/阻止状态 UI；保持实验开关默认关闭。
- `packages/web/test/embedded-course-browser.security.test.cjs`
  - 新增静态安全断言，覆盖 D016-1 guest 标识/partition，以及禁用注入、嗅探、自动化、fetch/XHR、浮层、新窗口和 console bridge API；并校验 load-complete handler 不触发后续页面工作。

### 验证结果（2026-07-10）

- `node --test packages/web/test/embedded-course-browser.security.test.cjs`：通过，3/3 tests passed。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`：通过，退出码 `0`。
- 构建仍输出已知非阻断 npm 告警：`Unknown project config "node-linker"`。

### 后续边界

1. D016-3 才负责用户主动 URL、生命周期和受控失败/阻止状态 UI；本次未自行实现白名单批准或会话批准。
2. D016-4 仍需在 Electron 中手动验证 guest 附加、导航拒绝、弹窗/下载/权限拒绝以及原 OCS 入口回归。

D016-2 已收口：安全查看器静态回归断言 3/3 通过，Web build 通过。已派 Developer Agent 执行 D016-3：仅启用 D016-1 基线白名单内平台的用户主动 URL、加载/失败/阻止状态和基础导航；非基线 host 会显示受控阻止提示，不在本轮实现会话批准 IPC 或任何自动化能力。

## Developer Agent 结果摘要：T016 D016-3 基线平台受限课程查看器

D016-3 已完成：课程查看器现在仅在桌面应用环境创建 D016-1 保护的 guest；用户可点击基线平台入口或主动粘贴受支持平台 URL，并获得真实 `idle`、`validating`、`loading`、`loaded`、`failed`、`blocked` 基础生命周期状态。纯浏览器环境会明确说明无法创建受保护的课程页面。

### 本次修改

- `packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
  - 移除旧 `experimentalEmbeddedWebviewEnabled` 默认关闭逻辑；查看器只在非纯浏览器（桌面应用）环境启用。
  - 仅为已验证的 `https:`、无嵌入凭据、精确基线 host URL 创建 guest；平台快捷入口和地址栏都复用此限制。
  - 未知 host、危险协议、无效地址会在渲染层显示“当前仅支持受支持平台地址”，不会尝试会话批准、IPC 或绕过主进程 policy。
  - 接入加载开始、加载完成、主框架失败和被主进程拦截的基础状态；保留刷新、后退、前进和返回空白起始页。去除多标签入口，避免扩大为多标签浏览器。
  - 未新增脚本执行、页面内容读取、Cookie/请求访问、弹窗、新窗口或下载能力。
- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 移除旧实验开关依赖；查看器相关注入/进度动作保持不可用，并明确原 OCS 入口仍负责脚本与高级功能。
- `packages/web/test/embedded-course-browser.security.test.cjs`
  - 扩展静态回归覆盖：桌面环境启用、基线 host 集、旧实验开关移除，以及生命周期和阻止状态。

### 验证结果（2026-07-10）

- `node --test packages/web/test/embedded-course-browser.security.test.cjs`：通过，5/5 tests passed。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`：通过，退出码 `0`。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc --noEmit && node --test test/course-guest-policy.test.cjs`（在 `packages/app`）：通过，4/4 policy tests passed。
- `git diff --check`：通过；仅输出工作区既有 CRLF 警告。
- Web/App 命令仍有已知非阻断 npm 配置告警（`node-linker` / `electron_mirror`）。

### 后续边界

1. D016-4 仍需在 Electron 中手动验收 guest 附加、允许 URL、未知导航阻止、弹窗/下载/权限拒绝以及原 OCS 入口回归；本环境未将其视为已通过。
2. 本轮没有实现非基线 host 的会话批准 UI/IPC，也没有改动 `course-guest-policy.ts` 或 `window.ts`。
3. 后续不得将基础页面加载状态解释为登录、课程识别、脚本运行或自动刷课成功。

D016-3 已收口：桌面端受限查看器支持基线平台 URL、真实基础生命周期与阻止状态；安全测试 5/5、Web build、App policy 测试 4/4 均通过。D016-4 Reviewer/Test 在最终 Electron 复核中超时，不能收口：已确认 Electron 可从正确 App workspace 启动并开放 DevTools 9334，但测试期间服务端口从 15319 递增为 15320，且关闭过程出现 `Object has been destroyed` 既有远程通信错误；尚未形成 guest 附加、导航拒绝和原版入口的完整审查结论。

## 用户新增优先需求：T017 多会话、控制台同步与受控注入

用户要求内嵌浏览器支持多个课程会话、右侧同步脚本运行进程、可安全替代的原 OCS 浮层迁移到右侧控制台，并开放受控注入。PM 已创建 T017（P0）：不会直接恢复旧的全部注入/浮层隐藏代码。Architect Agent 已完成 A017：多会话必须采用独立 `sessionId`、guest partition、navigation epoch 和不可变脚本快照；右侧状态必须按会话隔离；注入必须经过用户显式请求、一次性 lease、主进程二次校验与固定 bridge；原浮层仅允许先镜像、后按脚本版本/notice ID allowlist 替代，登录/授权/权限/错误/人工确认/题目提交等永不隐藏。Research Agent 已完成 R017：原 OCS 没有统一运行状态 API，状态分散在 `$message`、`$modal`、`$console`、通知与平台脚本流程；多开可借鉴 `Browser.uid + cachePath + Process + ScriptWorker + logs` 的隔离模型。已明确可镜像的普通事件（开始任务、媒体状态、下一节、普通完成），以及绝不可隐藏的登录/验证码/人脸/权限/错误/人工确认/答题提交。D017 已细化为 registry → 会话状态同步 → 多 guest → 受控注入 → 浮层事件迁移 → 回归验收。D017-1 已完成：主进程 Registry 的安全 ID、独立 partition、epoch 防旧事件、活动会话精确查询和一次性关闭清理均已实现；registry 4/4、既有 URL policy 4/4、App 类型检查均通过。D017-2 已完成并由 PM 复验：runtime session tests、既有查看器安全 tests 共 9/9 通过，Web build 退出码 0。右侧状态已按真实 sessionId / epoch / occurredAt 隔离，选中会话只展示自己的详情，其他会话仅聚合数量和严重告警；无真实 sessionId 时不伪造运行状态。D017-3b 已完成并由 PM 复验：Plus 查看器现可通过真实 IPC 创建、选择、关闭多个独立课程会话，webview 只使用主进程返回的 sessionId/partition；生命周期只接受匹配的主进程 session/epoch，关闭 A 只移除 A 而不影响 B。会话/查看器安全测试 **13/13** 通过，Web build 退出码 0。受控注入已拆为准入审计与实际执行两步；D017-4a 首轮 Developer 超时，留下未收口的准入/lease 部分实现。PM 复验发现严重回归：`packages/app/src/window.ts` 将课程 guest 的 `devTools` 误设为 `true`，导致既有课程 guest 安全断言失败；紧急修复已完成，`devTools: false` 恢复，App 类型检查与完整 course tests **15/15** 通过。Reviewer 对 D017-4a-F1 第二次只读复审仍为 **FAIL**：lease 防跨导航/关闭/脚本变化复用、不可信来源提示和 guest 边界均已通过，但渲染层申请 lease 时遗漏 `match`，与主进程 IPC schema 不一致而导致请求永远无法进入二次校验；此外右侧未主动读取既有审计、audit listener 未清理。PM 已派 Developer Agent 执行 D017-4a-F2，仅补完整候选快照、审计初始读取和 listener 清理以及测试；仍不允许实际脚本执行。

## Developer Agent 结果摘要：T017 D017-1 CourseSessionRegistry

D017-1 已完成：新增主进程 `CourseSessionRegistry`，作为未来受控多会话 guest 的最小事实层；本轮未接入 UI、webview 附加、IPC、脚本注入、控制台或浮层迁移。

### 本次修改

- `packages/app/src/course-session-registry.ts`
  - 使用 Node `crypto.randomBytes(32)` 创建不可预测的 `course_` sessionId，并为每个会话生成独立持久化 partition。
  - 维护 `created` / `loading` / `loaded` / `closed` 会话事实与单调递增 `navigationEpoch`；旧 epoch 的加载完成事件会被拒绝。
  - `findActiveGuest({ sessionId, partition })` 只在两项均精确匹配且会话仍活动时返回快照，为后续 `will-attach-webview` 主进程校验预留接口；渲染层传值本身不构成授权。
  - `close()` 会先使会话和现有 epoch 失效，再最多执行一次主进程清理回调；重复关闭为无操作。
- `packages/app/test/course-session-registry.test.cjs`
  - 覆盖独立安全 ID/partition、epoch 过期拒绝、精确 active guest 查询、关闭失效与一次性清理。

### 验证结果（2026-07-10）

- RED：新增测试在模块尚不存在时按预期失败：`Cannot find module '../lib/src/course-session-registry.js'`。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc && node --test test/course-session-registry.test.cjs && node --test test/course-guest-policy.test.cjs`（在 `packages/app`）：通过，registry 4/4、既有 URL policy 4/4 tests passed。
- App 类型检查通过；命令仍输出已知非阻断 npm 配置告警：`Unknown project config "electron_mirror"`。

### 后续边界

1. 后续多会话 UI / IPC 只能把 sessionId、partition 作为待校验输入，必须由主进程 registry 的精确活动查询决定是否允许 guest 附加。
2. 本轮没有修改现有单查看器的 `window.ts` guest 策略，因此没有启用多个 webview 或变更 popup、下载、权限、导航拒绝策略。
3. Electron session 实体清理与 `will-attach-webview` 的 registry 接线属于后续单独任务；本模块现已提供一次性关闭清理钩子和事实查询边界。

## Developer Agent 结果摘要：T017 D017-2 会话化 runtime 状态与右侧选中会话同步

D017-2 已完成：Plus runtime 现在按真实 `sessionId` 在渲染进程内存中隔离状态；每个 runtime 事件必须携带 `sessionId`、`navigationEpoch` 和 `occurredAt`。右侧控制台只显示选中会话的详情，并仅对其他会话汇总数量和严重告警；旧 epoch 或更早发生时间的事件会被丢弃，避免状态串台或回退。

### 本次修改

- `packages/web/src/plus/runtime/status.ts`
  - 新增 `OcsRuntimeSessionStore`，按会话保存状态、最后事件与 epoch；新 epoch 重置会话状态，旧 epoch / 同 epoch 的过期事件拒绝合并。
  - 支持选择会话、读取已选会话和聚合摘要；聚合只提供其他会话数量及不可恢复错误/流程异常计数。
  - 未建立隐式或伪造的默认课程会话。
- `packages/web/src/plus/runtime/events.ts`
  - runtime 事件统一带 `sessionId`、`navigationEpoch`、`occurredAt`；发射 API 需要调用方提供真实会话上下文。
- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 会话存在时可选择要查看的会话，详情面板只读取该会话状态；其他会话不泄露页面、课程或脚本详情。
  - 当前单查看器没有真实 sessionId 时继续显示已有脚本配置的空/手动状态，不把页面加载或脚本配置误标为“运行中”。
  - 移除控制台发出的旧无会话 runtime 事件；注入和进度按钮继续不可用且不会发起注入、嗅探或 DOM 操作。
- `packages/web/test/runtime-session-state.test.cjs`
  - 覆盖会话状态层、事件必需上下文和控制台选择/聚合边界的静态回归。
- `packages/web/test/runtime-session-store.test.cjs`
  - 覆盖两个会话的隔离、选择切换、旧 epoch 拒绝及其他会话严重告警汇总。

### 验证结果（2026-07-10）

- RED：新增 `runtime-session-state.test.cjs` 在实现前按预期 3/3 失败（缺少会话 store、事件上下文和选中会话控制台）。
- `node --test test/runtime-session-state.test.cjs test/runtime-session-store.test.cjs test/embedded-course-browser.security.test.cjs`（在 `packages/web`）：通过，9/9 tests passed。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`：通过，退出码 `0`。
- `git diff --check`：通过；仅输出工作区既有 CRLF 警告。
- Web build 仍输出已知非阻断 npm 配置告警：`Unknown project config "node-linker"`。

### 后续边界

1. 本轮没有创建多个 webview、没有接主进程 IPC、没有改动 `CourseSessionRegistry`、`window.ts` 或 policy。
2. 本轮没有恢复或执行脚本注入、DOM/进度嗅探、fetch/XHR hook、浮层迁移、自动播放/下一节/答题。
3. D017-3 只有在主进程 registry 和独立 guest 正式接线后，才能为各查看器提供真实会话 ID；此前 UI 不得伪造多会话运行状态。

## Developer Agent 结果摘要：T017 D017-3b 多会话查看器 IPC 接入

D017-3b 已完成：Plus 查看器现在仅通过 `ocs-plus-course-session:create` / `close` 创建和关闭课程会话；每个 webview 只使用主进程返回的 `sessionId`、独立 `partition` 及既有课程 guest marker。用户可在现有标签栏新建、选择和关闭多个独立会话；纯浏览器环境仍明确不可用。

### 本次修改

- `packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
  - 将现有最小标签 UI 接到真实 create/close IPC，并继续将主进程返回的 session/partition 绑定到 webview。
  - 仅接受 sessionId/partition 匹配的 `ocs-plus-course-session:lifecycle` 消息；页面 loading/loaded runtime 事件使用主进程实际返回的 sessionId 与 navigation epoch。
  - 收到主进程 closed 生命周期后，才移除对应查看器会话并发出 `session-closed`；不再让关闭后的 A 保留或更新右侧状态，B 保持独立。
  - 未恢复 `executeJavaScript`、脚本注入、DOM/课程/进度嗅探、fetch/XHR hook、浮层处理、popup、新窗口、下载或任何自动化行为。
- `packages/web/src/plus/runtime/events.ts`
  - 增加会话关闭的显式 runtime 生命周期事件。
- `packages/web/src/plus/runtime/status.ts`
  - 增加会话状态移除操作；关闭的会话从 renderer-memory store 删除，后续旧事件不能更新它。
- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 消费 `session-closed` 并只移除被关闭会话，已选会话/其他会话汇总同步刷新。
- `packages/web/test/embedded-course-browser.security.test.cjs`
- `packages/web/test/runtime-session-state.test.cjs`
- `packages/web/test/runtime-session-store.test.cjs`
  - 补充 registry 生命周期、匹配 session/partition、关闭隔离及 B 不受 A 关闭影响的回归覆盖。

### 验证结果（2026-07-10）

- RED：新增关闭隔离测试在 `OcsRuntimeSessionStore.remove()` 与 `session-closed` 生命周期尚不存在时按预期失败。
- `node --test test/runtime-session-state.test.cjs test/runtime-session-store.test.cjs test/embedded-course-browser.security.test.cjs`（在 `packages/web`）：通过，**13/13** tests passed。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`：通过，退出码 `0`。
- `git diff --check`：通过；仅输出工作区既有 CRLF 警告。
- Web build 仍输出已知非阻断 npm 配置告警：`Unknown project config "node-linker"`。

### 后续边界

1. 本轮未修改主进程、URL policy 或 registry；仍依赖 D017-3a 强制校验和 lifecycle 事实源。
2. 纯浏览器环境不会创建 guest；Electron guest/navigation/popup/download/permission 的最终手动回归仍属于 D017-6。
3. 受控注入、审计和浮层迁移仍分别留给 D017-4 / D017-5，不能通过查看器接线绕过。

## D017-4a 最终收口与 D017-4b 架构派发

D017-4a 已最终收口：Reviewer 最终安全验收 **PASS**。完整候选请求不携带 JS 原文；主进程只读本地已安装脚本并二次校验会话、epoch、URL、match、version 与 hash；lease 短时一次性，且在导航、关闭、脚本改变后无效；右侧审计按会话回读/推送并清理 listener。App 安全测试 **19/19**、Web 测试 **14/14**、Web build 均通过。

D017-4b 架构设计已完成：renderer 的唯一执行输入为 `{ leaseId }`，主进程在无 await 的临界区重新读本地脚本并精确复核 lease、会话、epoch、guest URL、match、version、hash，原子消费后仅向对应 guest 发送固定 URL guard + 验证后的 source；结果与审计必须脱敏且不代表脚本运行或学习完成。已派 Developer Agent 按此单任务实现；执行后必须交 Reviewer 独立安全验收。

## Developer Agent 结果摘要：D017-4a-S1 紧急课程 guest DevTools 安全回归修复

D017-4a-S1 已完成：`packages/app/src/window.ts` 中课程 guest 的 `webPreferences.devTools` 已从错误的 `true` 恢复为 `false`。主窗口兼容配置、URL policy、IPC、受控注入、渲染层、脚本逻辑和既有测试断言均未修改。

### 根因与修改

- 既有 `course-guest-policy.test.cjs` 的精确安全断言在修复前失败，指出 `window.ts` 缺少 `devTools = false`；代码实际将课程 guest 设为 `devTools = true`。
- 仅修改 `packages/app/src/window.ts` 的课程 guest 强制配置：`webPreferences.devTools = false`。

### 验证结果（2026-07-11）

- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc --noEmit`：通过，退出码 `0`。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc && node --test test/controlled-injection.test.cjs test/course-guest-policy.test.cjs test/course-guest-attachment-registry.test.cjs test/course-session-registry.test.cjs`（在 `packages/app`）：通过，15/15 tests passed。
- `git diff --check`：通过；仅输出工作区既有 CRLF 警告。
- 上述命令仍输出已知非阻断 npm 配置告警（`node-linker` / `electron_mirror`）。

### 后续边界

1. 本次仅恢复课程 guest 禁用 DevTools 的硬边界，不代表 D017-4a 的受控注入准入/lease 工作已完成。
2. 不得基于本修复推进 D017-4b 或扩大任何 guest、注入或 IPC 权限；后续仍须单独审查和验收。

## Developer Agent 结果摘要：D017-4a-F2 准入请求 / 审计可用性修复

D017-4a-F2 已完成：右侧控制台现在以完整受信候选快照申请 lease（包含 `match`），会在选中会话切换或可用时通过既有、受 sender 校验的审计 IPC 读取该会话已有审计，并在卸载时移除 audit listener。此任务仍只做准入与审计，**不会执行任何脚本**。

### 本次修改

- `packages/web/src/plus/components/OcsControlPanel.vue`
  - `requestInjectionLease(candidate)` 现在发送 `sessionId`、`navigationEpoch`、URL、`scriptId`、版本、内容哈希和 `match: candidate.match`；未发送 JavaScript 原文。
  - 选中会话刷新时调用 `ocs-plus-injection:audit` 回读已有审计；异步结果仅会填充仍处于选中状态的同一会话。
  - audit 推送只接受与当前选中会话一致的事实，避免会话间审计串台。
  - 命名 audit listener，并在 `onBeforeUnmount` 中以 `removeListener` 清理。
- `packages/web/test/runtime-session-state.test.cjs`
  - 新增静态回归断言，覆盖完整 lease 请求快照、无脚本原文、初始审计读取、选中会话审计隔离和 listener cleanup。

### 验证结果（2026-07-11）

- RED：新增控制台回归断言在修复前失败，指出请求 payload 缺少 `match`；随后还验证了缺失的审计会话隔离断言会失败。
- `node --test test/runtime-session-state.test.cjs test/runtime-session-store.test.cjs test/embedded-course-browser.security.test.cjs`（在 `packages/web`）：通过，14/14 tests passed。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/web build`：通过，退出码 0。
- `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc --noEmit` 和 `npx --yes pnpm@10.21.0 --filter @ocs-desktop/app exec tsc`：通过，退出码 0。
- `node --test test/controlled-injection.test.cjs test/course-guest-policy.test.cjs test/course-guest-attachment-registry.test.cjs test/course-session-registry.test.cjs`（在 `packages/app`）：通过，19/19 tests passed。
- `git diff --check`：通过；仅报告工作区既有 CRLF 警告。

### 后续边界

1. D017-4b 仍未开始；本次没有调用或新增 `executeJavaScript`、preload、bridge、脚本执行、页面嗅探、弹窗隐藏或自动化。
2. `controlled-injection.ts` 的主进程二次校验和课程 guest 的安全策略均未修改。

## Developer Agent 结果摘要：T017 D017-4b 固定主进程执行边界（待 Reviewer 独立安全验收）

D017-4b 已实现：渲染层在用户明确操作后，只向 `ocs-plus-injection:execute` 发送唯一 `{ leaseId }`；主进程在同步消费临界区重新读取本地脚本、复核活动且已加载的会话、epoch、guest URL 和候选的 match/version/hash，并在原子消费后只对该 lease 对应 guest 执行“固定 URL guard + 已验证本地 source”。执行结果和审计不返回 source、路径、URL、页面/课程/进度、Cookie、网络数据或原始异常。

### 本次修改

- `packages/app/src/controlled-injection.ts`
  - 新增仅供主进程使用的 `consumeLeaseForExecution()` 和本地单脚本重新读取函数；成功返回的 source 只留在主进程固定执行路径，lease 一旦消费不可复用。
  - 消费时重新验证会话 `loaded` 状态、epoch、guest URL 及本地脚本 candidate 的脚本 ID、match、version、hash；任何变化均稳定拒绝/撤销。
- `packages/app/src/window.ts`
  - 新增 sender 校验和严格唯一 `{ leaseId }` schema 的 execute IPC；拒绝 renderer 传入 JS、URL、session、script、hash、match 或 options。
  - 仅在固定执行器调用对应 guest 的 `executeJavaScript`；payload 含精确 `location.href` guard。guest 缺失、guard 拒绝和执行拒绝分别映射为固定脱敏码，且消费后不重试。
- `packages/web/src/plus/components/OcsControlPanel.vue`
  - 最小调整为“明确提交已验证脚本”；批准后只传 `leaseId`，提示“主进程已提交已验证本地脚本”，明确不代表脚本运行或学习完成。
- `packages/app/test/controlled-injection.test.cjs`、`packages/web/test/runtime-session-state.test.cjs`
  - 覆盖本地 source 再校验、一次性消费、唯一 leaseId execute schema、sender 拒绝、正确 guest、URL guard payload、固定脱敏码，以及 renderer 中无 `executeJavaScript` / source payload。

### 验证结果（2026-07-11）

- App：`tsc --noEmit`、编译及完整相关测试通过，**21/21** tests passed。
- Web：完整相关测试通过，**15/15** tests passed；`@ocs-desktop/web build` 通过。
- `git diff --check`（本任务路径）通过。
- 已知非阻断 npm 配置告警仍存在（`electron_mirror` / `node-linker`）。

### 后续边界

1. 本次不新增通用 JS 执行 IPC、preload/bridge、自动触发或自动重试、DOM/fetch/XHR hook、自动播放/下一节/答题、浮层隐藏，也不修改 Legacy。
2. 主进程“已提交”不代表 renderer/runtime 的 `running`、课程完成或学习完成。
3. 本实现**尚未获得安全验收结论**；须由 Reviewer 独立审查后再决定 D017-4b 是否收口。
## D017-4b 独立安全验收与返修收口（2026-07-13）

结论：**PASS**。

- 初次独立审查发现：禁用的本地脚本仍可被枚举、授权和执行，违反原有脚本启用状态的边界。
- 返修后，候选读取与执行前本地源重读均强制要求 `enable === true`。
- 若 lease 获批后脚本被禁用，执行前复核会撤销 lease 并稳定返回 `SCRIPT_SOURCE_UNTRUSTED`；在访问 guest 或调用 `executeJavaScript` 前直接拒绝。
- 新增回归测试覆盖“禁用脚本不可成为候选/执行源”和“授权后禁用时首次与后续消费均被拒绝”。

验证：App TypeScript 检查通过，App 编译及相关测试 24/24 通过；已知 `node-linker` npm 配置警告不阻塞验收。

下一步：在不扩大受控注入边界的前提下，评估并拆分 D017-5（白名单非关键 OCS 消息镜像/替代），随后再安排 D017-6 的 Electron 手工回归。
## D017-6a 内嵌课程查看器终态修复（2026-07-13）

状态：**代码与独立自动验收通过；待 Electron 手工确认**。

- 覆盖 guest 附加拒绝、预留冲突、URL policy 拒绝导航、主框架加载失败和 30 秒加载超时；以上路径均会以固定、脱敏的 `failed` 或 `blocked` 生命周期状态结束，不再永久显示“加载中”。
- UI 只消费主进程 lifecycle 的固定状态码，不展示底层异常或 URL；失败状态可重试。
- URL 白名单、权限、弹窗、下载、DevTools、Node 隔离和脚本执行边界均未放宽。
- 独立复验通过：App 类型检查及相关测试 27/27，Web 相关测试 16/16；`node-linker` 配置警告为已知非阻塞项。

剩余验证：重启开发环境后，在真实 Electron 中分别确认成功加载、地址/导航拒绝、主框架失败和超过 30 秒未完成时 UI 均能退出“加载中”。
### D017-6a Electron 手工复验失败（2026-07-13）

真实 Electron 中打开 `https://i.chaoxing.com/` 后，内嵌区域持续空白；等待超过 30 秒仍未收到 `loaded`、`failed` 或 `blocked` 生命周期状态。

结论：当前失败发生在 `did-start-loading` 之前，既有附加后失败、加载失败与超时处理均不会触发。D017-6a 不能收口，必须先定位并修复 webview 附加前的失败路径；不得以放宽 guest 标识、URL policy 或 webPreferences 作为替代方案。
### D017-6a 附加前失败返修与独立审查通过（2026-07-13）

- 根因：真实空白路径未创建 guest，导致 `did-start-loading` 不会触发，原有 30 秒加载超时不会启动。
- 修复：renderer 在写入课程地址前通过受 sender 校验、仅携带 `sessionId` 的 IPC 登记预期 guest；主进程立即发出 loading 状态并启动 5 秒附加计时。未发生 `did-attach-webview` 时，固定回传 `failed + COURSE_GUEST_ATTACH_TIMEOUT`；成功附加、关闭和全部终态均清理计时。
- UI 将该固定码显示为“课程页面未能创建，请稍后重试”，不泄露底层异常或地址，也不会永久 loading。
- 独立审查确认 URL policy、marker、partition、权限、下载、popup、preload、DevTools、Node 隔离和受控脚本执行边界均未放宽。
- 验证：App 类型检查、编译及相关测试 28/28；Web 相关测试 16/16；已知 `node-linker` 警告不阻塞。

仍待：真实 Electron 完整手工回归——正常附加须在 5 秒内成功并取消计时；附加失败须显示失败；关闭会话或重试不得让旧计时器影响新 epoch。
### D017-6a 真实附加回归修复收口（2026-07-13）

结论：**PASS**。

- 根因：`will-attach-webview` 使用 `data-*` 自定义属性检索会话；Electron 不保证向该事件转发这类属性，导致 guest 在附加前被拒绝，最终只出现附加超时。
- 修复：授权改为只使用主进程生成的独立 `partition` 与当前 `loading` navigation epoch；不再将 renderer `data-*` 作为授权输入。成功 `did-attach-webview` 后记录 `guest-attached` 诊断并取消超时。
- 处理截图中的派生错误：未附加/未加载的 webview 不再调用原生 `reload()`；移除项目书签页的 Google Fonts 外链，保留原 CSP，不再产生该 CSP 拒绝。
- 安全边界保持：URL policy、独立 partition、权限/下载/popup/preload 拒绝，及 guest 的 `nodeIntegration=false`、`contextIsolation=true`、`sandbox=true`、`webSecurity=true`、`devTools=false` 未变。
- 主 Agent 真实 Electron 验证：内嵌区域成功显示 `i.chaoxing.com` 的用户登录页、登录按钮和二维码。独立 Reviewer 据此复核通过。
- 自动验证：App 相关测试 17/17（Reviewer 复核集 26/26），App `tsc --noEmit`、Web `vue-tsc --noEmit` 和 `git diff --check` 通过；已知 `node-linker` 警告不阻塞。

后续改进：增加 Electron 集成测试，自动断言 `will-attach-webview → did-attach-webview` 和课程 guest 首帧可见，避免仅凭静态测试覆盖实际附加路径。

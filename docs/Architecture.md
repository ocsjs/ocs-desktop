# OCSplus 架构设计

## 当前状态

本文档为架构占位文档，后续由 Architect Agent 根据 `PRD.md`、`Research.md`、`Tasks.md` 补全。

## 初步架构原则

1. OCSplus 是原 `ocs-desktop` 的增强层，不应破坏原有功能。
2. Plus 工作台优先复用原 OCS 的浏览器、脚本、配置能力。
3. 新功能应通过清晰模块接入，不直接散落修改原核心逻辑。
4. MVP 阶段只做必要接入，不做大规模重构。
5. AI 题目助手、题库、资料库等功能应先明确数据来源和接口边界。

## 初步模块划分

### 1. Plus 工作台层

路径初步定位：

```text
packages/web/src/plus/
```

职责：

- 首页布局
- Plus 模块导航
- 学习概览
- 网课浏览器入口
- 原 OCS 功能入口
- 状态提示

### 2. 原 OCS 能力适配层

职责：

- 调用原浏览器管理能力
- 调用原脚本管理能力
- 调用原配置能力
- 避免重复造轮子

### 3. 配置管理层

职责：

- 浏览器路径配置
- 模型/API 配置
- 用户偏好
- 本地持久化

### 4. AI/题库扩展层

后续研究 ZError 后再确定。

可能职责：

- 题目识别
- 答案查询
- 错题缓存
- 模型调用配置

## T010：MVP 功能边界收窄

### 1. MVP 内/外边界

#### 1.1 MVP 内边界

第一阶段 MVP 只覆盖“可启动、可配置、可展示状态、可回原版入口”，不追求完整自动化能力。

MVP 内包含：

1. **应用可启动**：项目约定启动命令可正常启动开发环境，Web 页面和 Electron 主进程不因 Plus 改造阻塞启动。
2. **Plus 首页可访问**：默认入口可以进入 Plus 工作台首页，首页用于展示统一入口和基础状态，不承诺完整业务闭环。
3. **Plus 模块导航可用**：MVP 模块可以跳转；未进入 MVP 的模块只允许以“开发中 / 暂未开放 / 后续规划”方式出现，不得伪装成已完成能力。
4. **基础配置可保存**：MVP 仅要求支持浏览器路径等基础配置的保存和再次读取，不要求完整模型配置、云同步、账号配置、复杂偏好管理。
5. **基础状态展示**：可以展示学习、任务、脚本、配置、运行状态等概览，但必须是真实状态、未配置状态或开发中状态；不允许长期展示未标注来源的假进度、假任务、假 AI 结果。
6. **运行日志或状态提示**：关键操作需要有基础状态反馈，包括启动、配置保存、入口跳转失败、原版能力不可用等；不要求完整日志系统。
7. **保留原版 OCS 入口**：必须能进入原 OCS 的核心能力，包括原浏览器管理、原脚本管理、原设置 / 高级功能。

#### 1.2 MVP 外边界

以下能力不进入第一阶段 MVP 主线，应标记为 P2 或专项评审：

1. 全自动刷课闭环。
2. 多平台完整适配。
3. 内嵌 webview 自动注入脚本。
4. webview 中的课程进度嗅探、fetch/XHR hook。
5. 完整 AI 题目助手。
6. 自动识题、自动答题、自动提交。
7. 资料库完整能力。
8. 错题本完整能力。
9. 模型配置完整能力。
10. ZError 深度接入。
11. 内置浏览器自动下载、安装、版本管理的完整闭环。
12. 云同步。
13. 账号体系。
14. 商业化功能。
15. 大规模重构原 OCS 架构。

### 2. Plus 与原 OCS 的模块边界

#### 2.1 总体原则

OCSplus 是原 `ocs-desktop` 的增强层，不是替代层。

Plus 的职责：

1. 提供更清晰的首页和工作台。
2. 聚合原 OCS 的关键入口。
3. 展示基础状态。
4. 提供基础配置入口。
5. 为后续 AI、资料库、错题本等能力预留模块边界。

原 OCS 的职责：

1. 浏览器管理。
2. 用户脚本管理。
3. 原有资源 / 应用中心。
4. 原有监控能力。
5. 原有设置能力。
6. 已存在的 OCS 自动化能力。

MVP 阶段不得将 Plus 直接改造成新的执行核心。

#### 2.2 Plus 工作台层边界

路径定位：

```text
packages/web/src/plus/
```

MVP 允许职责：

- Plus 首页。
- Plus 模块注册与导航。
- 原版入口聚合。
- 浏览器路径配置入口。
- 基础状态提示。
- 未完成模块占位说明。

MVP 不允许职责：

- 直接实现课程页面自动控制。
- 直接注入用户脚本到第三方课程页面。
- 直接 hook 第三方页面请求。
- 直接实现 AI 自动答题闭环。
- 直接维护真实题库、错题库、资料库。
- 直接承载模型 API Key 的完整配置与调用。

#### 2.3 原 OCS 能力适配层边界

MVP 允许 Plus 通过路由或入口复用原 OCS 页面，例如：

```text
/legacy/browsers
/legacy/user-scripts
/legacy/resources
/legacy/dashboard
/legacy/setting
```

适配层职责：

1. 给 Plus 提供“进入原版能力”的入口。
2. 保持原 OCS 页面可访问。
3. 避免 Plus 重写原有浏览器、脚本、设置模块。
4. 必要时提供旧路径兼容或重定向。

适配层不得：

1. 在未验证的情况下删除原路由。
2. 修改原 OCS 核心执行逻辑。
3. 用 Plus 半成品页面替代原 OCS 已可用页面。
4. 将高风险 webview / 脚本注入能力默认接入主流程。

#### 2.4 配置管理层边界

MVP 配置只包含：

1. 浏览器路径配置。
2. 基础配置保存。
3. 重启后读取配置。
4. 配置保存成功 / 失败提示。

MVP 不包含：

1. 完整模型供应商配置。
2. API Key 管理。
3. 模型额度、模型列表、模型测试。
4. 云端配置同步。
5. 多用户配置隔离。
6. 复杂配置迁移系统。

#### 2.5 AI / 题库 / 资料扩展层边界

AI 题目助手、ZError、错题本、资料库属于后续扩展层。

MVP 阶段只允许：

1. 在架构上保留模块概念。
2. 在导航中以“开发中 / 后续规划”展示。
3. 在文档中说明未来接入方向。

MVP 阶段不允许：

1. 展示未标注的假 AI 答案。
2. 展示假错题统计。
3. 展示假资料数量。
4. 保存真实题库数据结构。
5. 调用真实模型 API。
6. 自动识题或自动答题。
7. 与 ZError 做深度耦合接入。

### 3. 关键功能是否进入 MVP 的判定

| 功能 | 是否进入 MVP | 判定 | 原因 |
|---|---:|---|---|
| Plus 首页 | 是 | MVP 主线 | PRD 要求 Plus 首页可访问，是工作台基础。 |
| Plus 模块导航 | 是 | MVP 主线 | 需要让用户理解主要入口用途。 |
| 浏览器路径配置 | 是 | MVP 主线 | PRD 明确要求可配置、可保存基础配置。 |
| 基础状态展示 | 是 | MVP 主线 | 允许展示真实状态、未配置状态、开发中状态。 |
| 运行日志 / 状态提示 | 是 | MVP 主线 | 关键操作不能静默失败。 |
| 原 OCS 入口 | 是 | MVP 主线 | 必须保留原浏览器、脚本、设置等入口。 |
| webview | 否 | 暂不进入 MVP 主线 | 当前涉及 `webviewTag`、CSP、隔离策略，安全风险高。 |
| 脚本注入 | 否 | 暂不进入 MVP 主线 | 自动注入、fetch/XHR hook、课程页面控制超出 MVP。 |
| 内置浏览器 | 部分否 | 仅允许保留“浏览器路径配置 / 原版入口” | 内置 Chrome 下载、安装、版本管理需要专项验证。 |
| AI 题目助手 | 否 | P2 / 专项规划 | 需要先研究 ZError、数据来源、模型调用、安全边界。 |
| 资料库 | 否 | P2 | 当前缺少真实数据来源和使用场景。 |
| 错题本 | 否 | P2 | 依赖题库、识题、存储和数据来源，超出 MVP。 |
| 模型配置 | 否 | P2 | API Key、供应商、模型测试、额度等不进 MVP。 |
| 任务提醒完整能力 | 否 | P2 | MVP 可展示基础状态，但不做真实任务系统。 |
| ZError 接入 | 否 | P2 / Research 后再定 | 需要先明确接口、数据格式、复用方式和耦合风险。 |

### 4. 给 Developer 的实现约束

#### 4.1 范围约束

1. 只能执行 `docs/Tasks.md` 中明确的单个任务。
2. 不得在一个任务中顺手实现 AI、资料库、错题本、模型配置等 P2 能力。
3. 不得扩大 MVP 范围。
4. 不得修改产品目标。
5. 不得大规模重构原 OCS。

#### 4.2 原 OCS 兼容约束

1. Plus 改造不得破坏原 OCS 核心入口。
2. 必须验证以下入口：`/legacy/browsers`、`/legacy/user-scripts`、`/legacy/setting`。
3. 如旧路径仍被原 OCS 或用户习惯依赖，应补充兼容重定向或明确文档说明。
4. 不得删除原 OCS 页面组件。
5. 不得用未完成的 Plus 页面替代原可用页面。

#### 4.3 高风险能力约束

以下能力未经专项任务和审查，不得进入默认主流程：

1. `webviewTag`。
2. `nodeIntegration` 放宽。
3. `contextIsolation:false`。
4. 宽松 CSP。
5. 第三方页面脚本注入。
6. fetch / XHR hook。
7. 自动答题。
8. 自动提交。
9. 自动刷课闭环。
10. API Key 明文存储。
11. 未验证来源的题库导入。

#### 4.4 假数据约束

1. 不得将演示数据伪装成真实学习数据。
2. 首页如使用示例数据，必须明确标注“示例 / 开发中 / 暂无真实数据”。
3. 对 AI、错题、资料、任务等未实现模块，不得展示可误导用户的真实数量、成功率、答案结果。
4. 能移除假数据时优先移除；必须保留时应降级为占位说明。

#### 4.5 配置约束

1. MVP 只实现基础浏览器路径配置。
2. 配置保存必须可验证。
3. 重启后必须能读取已保存配置。
4. 保存失败必须有状态提示。
5. 不得在 MVP 中引入完整模型配置系统。
6. 不得混入云同步、账号体系或多用户配置设计。

#### 4.6 路由约束

1. Plus 首页可以作为默认入口。
2. 原 OCS 功能必须保留可访问路径。
3. `/legacy/*` 路由作为原版能力承载区。
4. 对当前 `/browser` 等路径，需要明确其含义：
   - 若是 Plus 网课浏览器入口，只能作为 MVP 占位或跳转原版能力。
   - 若要进入原 OCS 浏览器管理，应跳转 `/legacy/browsers`。
5. 不得让半成品 CourseBrowser 成为唯一浏览器入口。

#### 4.7 验证约束

每个 Developer 单任务完成后，至少需要验证：

1. Web 构建是否通过。
2. Plus 首页是否可访问。
3. 原版核心入口是否仍可访问。
4. 当前任务对应功能是否满足验收标准。
5. 是否引入新的假数据误导。
6. 是否引入新的 webview / CSP / 注入风险。

### 5. 后续需要拆出的 Developer 单任务

#### D001：收窄 Plus 模块启用状态

目标：将 MVP 外模块从“启用态”降级为“开发中 / 暂未开放 / P2”，避免 AI、错题本、资料库、模型配置等看起来像已完成能力。

验收：

1. MVP 主线入口清晰。
2. P2 模块不会误导用户。
3. 不移除未来扩展的架构占位。

#### D002：修正原 OCS 入口路由与兼容

目标：确认 Plus 到原 OCS 的入口路径，修正可能错误的 `/browser` 跳转，验证 `/legacy/browsers`、`/legacy/user-scripts`、`/legacy/setting` 可访问。

验收：原浏览器管理、原脚本管理、原设置可进入，Plus 首页可以回到原版高级入口。

#### D003：移除或标注首页演示 / 假数据

目标：清理或标注学习进度、任务、AI 面板等演示数据，防止用户误认为功能已真实可用。

验收：假数据不再以真实状态呈现，未实现模块显示“开发中 / 暂无真实数据”，首页状态符合 MVP 实际能力。

#### D004：浏览器路径配置保存验证与修复

目标：验证并修复浏览器路径配置保存、读取、重启恢复能力。

验收：用户能填写浏览器路径，配置能保存，重启后配置仍存在，保存失败有提示。

#### D005：运行状态 / 日志提示 MVP

目标：为启动、配置保存、入口跳转等关键操作补充基础状态提示。

验收：关键操作有成功 / 失败反馈，错误不静默失败，不引入完整日志系统的额外复杂度。

#### D006：高风险 webview / 注入改动隔离

目标：将 webview、脚本注入、fetch/XHR hook、宽松 CSP 等高风险能力从 MVP 主流程隔离。如必须保留代码，应确保默认不可达或明确标记为实验能力。

验收：MVP 默认流程不依赖 webview 自动注入，不默认启用高风险 Electron 配置，相关能力进入 P2 或专项评审。

#### D007：内置浏览器下载能力降级或专项化

目标：明确内置 Chrome 下载 / 安装是否保留在 MVP。MVP 阶段优先使用“用户配置本地浏览器路径”。

验收：MVP 不依赖内置浏览器自动下载，下载失败不影响应用启动和 Plus 首页；若保留入口，必须标注为实验或后续能力。

#### D008：工具链启动流程文档化

目标：固化当前可用启动命令和端口清理注意事项。

验收：明确使用 `npx --yes pnpm@10.21.0`，记录 dev server / Electron / OCS 服务端口，记录停止后清理残留进程的注意事项。

## T016：Plus 内嵌浏览器第一阶段安全适配架构

### 目标与边界

T016 第一阶段是受控的课程页面查看器：用户主动输入或选择课程 URL 后，Plus 内嵌页面只展示 `idle`、`validating`、`loading`、`loaded`、`failed`、`blocked` 等真实生命周期状态。

第一阶段明确不做：脚本注入、`executeJavaScript`、用户脚本执行、DOM/课程/进度嗅探、`fetch`/XHR hook、自动播放、自动下一节、自动答题、Cookie 导出、下载接管、多标签和新窗口承载。

“页面已加载”只表示 guest 主框架已加载完成，不代表登录、课程识别、脚本运行或学习完成。

### Electron guest 安全边界

仅允许带明确 Plus 课程标识的 webview 附加；主进程在 `will-attach-webview` 中拒绝未知请求，并强制课程 guest：

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- `enableRemoteModule: false`
- 无自定义 preload
- 专用持久 partition（例如 `persist:ocs-plus-course-v1`）
- 禁止 `allowpopups` 与用户 DevTools 入口

不得改变主窗口原 OCS 的既有兼容配置；若 Electron 无法可靠强制 guest 偏好，应停止采用 webview，改做后续 `WebContentsView` 专项，不能放宽安全限制。

### URL、导航与外部行为

1. 默认仅接受 `https:`、可解析、无嵌入凭据的 URL；拒绝 `file:`、`javascript:`、`data:`、`blob:`、`chrome:`、`devtools:` 和自定义协议。
2. 采用集中维护的精确 host 白名单。非基线 host 需要用户明确确认，且仅在当前会话有效；重定向目标也必须重新校验。
3. 初始加载、跳转、重定向、后退/前进/刷新、新窗口均复用同一 URL policy。
4. 弹窗和新窗口一律拒绝；禁止自动 `shell.openExternal()`。
5. 下载、摄像头、麦克风、定位、通知、证书例外和自定义协议默认拒绝，并显示受控失败状态。

### 组件责任

- 主进程：强制 guest 偏好；执行 URL policy；拒绝 popup、下载、权限与不允许导航。
- `EmbeddedCourseBrowser`：用户主动加载、刷新、返回/前进；只接收页面加载或阻止状态；不得注入或读取页面业务内容。
- `OcsControlPanel`：仅展示来源和基础加载诊断，不宣称脚本运行或自动刷课。
- 原 OCS 路由：继续承担浏览器、脚本与高级能力，不能被 Plus 查看器替代。

### Developer 单任务顺序

1. **D016-1**：主进程建立课程 guest 强制安全边界和集中 URL policy。
2. **D016-2**：清理 `EmbeddedCourseBrowser` 旧实验代码的注入、嗅探、自动化和新窗口运行链，只保留查看器。
3. **D016-3**：将受限查看器接入用户主动 URL、加载/失败/阻止状态和安全导航。
4. **D016-4**：Reviewer/Test 审查 Electron guest、导航拒绝、状态真实性和原 OCS 入口回归。

## T014：右侧控制台脚本运行状态原生适配架构

### 1. `OcsRuntimeStatus` 状态模型边界

右侧“网课控制台”展示的是 OCSplus 原生运行状态，不复制原版 OCS 浮层 UI，也不做完整自动刷课执行器。

建议在 Plus 层定义统一状态对象 `OcsRuntimeStatus`，作为 `OcsControlPanel` 的唯一状态输入。

核心字段：

- `source`：`plus-webview` / `legacy-browser` / `script-config` / `manual` / `unknown`
- `script.phase`：`no_script` / `script_disabled` / `script_ready` / `injecting` / `injected` / `running` / `paused` / `error`
- `page`：`url` / `title` / `platform` / `loading` / `error`
- `course`：`name` / `chapter` / `task` / `taskType` / `progress` / `completedUnits` / `totalUnits`
- `flow.phase`：`idle` / `opening_page` / `detecting_platform` / `detecting_task` / `start_study` / `media_waiting` / `media_playing` / `media_finished` / `question_detecting` / `question_need_manual` / `next_pending` / `next_switching` / `course_finished` / `manual_required` / `error`
- `actions`：`open_legacy_browser` / `open_legacy_scripts` / `retry_inject` / `sync_progress` / `manual_next`
- `error`：`code` / `message` / `recoverable`

边界说明：

1. `script_ready` 只表示有启用脚本，不代表正在刷课。
2. `injected` 只表示脚本桥接或用户脚本执行完成，不代表课程已完成。
3. `running` 只能在检测到 OCS 运行对象或匹配脚本后展示。
4. `start_study`、`next_switching` 只做状态展示，不触发自动播放、自动下一节、自动答题。
5. `course` 只能保存真实页面、脚本探测或进度快照得到的信息；无法识别时显示“暂未识别”。

### 2. 状态来源与事件流

T014 MVP 优先复用当前已有真实来源，不新增完整自动刷课执行链。

状态来源：

| 来源 | 当前代码位置 | 可提供状态 | 边界 |
|---|---|---|---|
| 脚本配置 | `store.render.scripts`、`OcsControlPanel.vue` | 脚本总数、启用数量、是否待命 | 只能证明脚本配置存在 |
| webview 页面事件 | `EmbeddedCourseBrowser.vue` 的 `handleStartLoading`、`handleStopLoading`、`handleFailLoad`、`syncUrl` | 页面 URL、标题、加载中、加载失败 | 页面状态不等于脚本运行状态 |
| 内嵌注入流程 | `injectEnabledScripts`、`createUserscriptRunner`、`createOcsRuntimeProbeCode` | 注入中、注入成功、检测到 OCS、匹配脚本、注入失败 | MVP 只沉淀状态 |
| 课程进度快照 | `syncStudyProgressFromWebview`、`createStudyProgressCollectorCode` | 课程名、平台、进度、完成单元数 | 启发式识别 |
| 原 OCS 独立浏览器 | `Process.status`、`Browser.launch` 等 | 独立浏览器启动、关闭、运行中 | 进程状态不等于课程脚本状态 |

建议新增轻量状态桥接模块：

```text
packages/web/src/plus/runtime/
  status.ts
  events.ts
```

职责：

- `status.ts`：定义 `OcsRuntimeStatus`、默认状态、状态合并函数；不操作 UI、不注入脚本、不控制课程页。
- `events.ts`：定义 OCSplus 原生事件和 payload，负责组件间传递状态变化。

建议事件：

- `script-config-updated`
- `page-loading`
- `page-loaded`
- `page-load-failed`
- `script-inject-start`
- `script-inject-success`
- `script-inject-failed`
- `runtime-probed`
- `study-progress-synced`
- `flow-status`
- `manual-action`

### 3. 组件职责边界

#### `OcsControlPanel`

职责：

1. 读取 `OcsRuntimeStatus`。
2. 展示脚本、页面、课程、流程、错误状态。
3. 提供有限操作：打开原版浏览器、打开脚本列表、请求重新注入、请求同步进度、提示用户手动下一节。

禁止：

1. 不直接调用 `webview.executeJavaScript`。
2. 不直接拼接或注入用户脚本。
3. 不直接控制课程页面播放、暂停、下一节。
4. 不实现自动答题。
5. 不展示未标注来源的假状态。

#### `EmbeddedCourseBrowser`

职责：

1. 打开、切换、关闭内嵌课程页。
2. 监听 webview 生命周期。
3. 采集页面 URL、标题、加载状态、错误。
4. 执行当前已有进度同步逻辑。
5. 将注入结果、探测结果、页面状态转成 OCSplus 原生事件。

禁止：

1. 不维护右侧控制台 UI 文案。
2. 不把脚本注入成功等同于“刷课成功”。
3. 不把页面加载成功等同于“脚本运行中”。
4. 不新增完整自动播放 / 自动下一节 / 自动答题闭环。

共享状态层：

```text
EmbeddedCourseBrowser
  -> 发送 OCSplus runtime events
  -> plus/runtime/status.ts 合并为 OcsRuntimeStatus
  -> OcsControlPanel 只读展示
```

### 4. “开始刷课 / 切换下一章节”的 MVP 边界

“开始刷课”和“切换下一章节”只能作为真实事件或启发式状态展示，不能实现完整自动刷课闭环。

允许展示 `flow.phase = 'start_study'` 的条件：

1. 页面加载完成。
2. 有启用脚本。
3. 脚本注入成功或检测到 OCS 运行对象。
4. 匹配到当前页面可运行脚本，或课程快照显示进入视频 / 任务页面。

允许展示 `flow.phase = 'next_pending' | 'next_switching'` 的条件：

1. 课程快照显示当前任务完成。
2. 页面文本或进度变化显示视频 / 单元已完成。
3. 脚本探测事件或日志事件显示“准备下一节”。
4. 用户点击了“手动下一节”提示操作。

题目状态只允许展示：`question_detecting`、`question_need_manual`、`manual_required`。不得自动识题、查 AI、填答案或提交。

### 5. Developer 拆分任务

#### D014-1：新增 runtime 状态类型与默认状态

文件建议：`packages/web/src/plus/runtime/status.ts`

验收：类型覆盖 `source`、`script`、`page`、`course`、`flow`、`actions`、`error`，默认状态能表达无脚本、空页面、空流程。

#### D014-2：新增 runtime 事件定义与轻量事件总线

文件建议：`packages/web/src/plus/runtime/events.ts`

验收：能表达页面加载、页面失败、脚本注入、运行探测、进度同步、流程状态；不复制原 OCS 事件实现。

#### D014-3：让 `EmbeddedCourseBrowser` 发出真实状态事件

验收：页面生命周期、注入结果、进度同步能变成 runtime 事件；不新增自动刷课行为。

#### D014-4：改造 `OcsControlPanel` 为状态展示组件

验收：不再显示误导性静态自动化开关；能展示脚本、页面、课程、流程、错误和建议操作。

#### D014-5：补充失败提示与状态来源展示

验收：展示状态来源；无脚本、脚本未启用、页面未打开、注入失败、未匹配脚本时给出可执行建议。

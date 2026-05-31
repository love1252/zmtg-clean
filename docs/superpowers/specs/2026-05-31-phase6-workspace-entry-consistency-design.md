# Phase 6 运营页面一致性与 workspace 入口真实化设计

> 日期：2026-05-31
> 状态：Plan Mode 已确认，PR 1 只固化文档，不进入代码开发。

## 背景

Phase 5 已完成机构业务页面真实化：客户中心、预约中心、智能随访 / 随访任务均已通过 `src/modules/institution/client/tenant-business-client.ts` 接入现有真实 API。

当前剩余问题集中在入口层和一致性层：

- 机构工作台首页仍主要使用静态经营展示数据。
- 三大业务页已经具备 loading、error、empty、mutation 状态，但实现分散，后续扩展会重复。
- 机构端导航同时包含已真实接入页面和后续占位页面，边界需要更清楚。
- workspace 入口测试已覆盖三大业务页切换，但还需要补充首页真实指标、占位入口和状态一致性 smoke。
- README 和路线图需要同步 Phase 5 已完成、Phase 6 正在规划的事实。

## 目标

Phase 6 聚焦“运营页面一致性与 workspace 入口真实化”，目标如下：

1. 机构工作台首页使用现有真实 API 派生关键指标和行动摘要。
2. 统一 workspace 与三大业务页的加载态、错误态、空态和占位态。
3. 整理机构端导航和页面切换状态。
4. 明确“已真实接入页面”和“后续占位页面”的边界。
5. 补充 workspace / business 页面 smoke 测试。
6. 更新 README、roadmap 和 devlog。

## 非目标

Phase 6 不做以下事项：

- 新 API。
- 新数据库 schema。
- 新 migration。
- 权限模型改造。
- 认证改造。
- 租户隔离改造。
- AI provider。
- Agent。
- RAG / 知识库真实功能。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 套餐权益 enforcement。
- 平台租户管理真实功能。
- 治疗记录完整正文。
- 客户详情完整时间线。
- 大型 UI 框架重构。
- 引入新的数据请求库。

## 静态 demo 数据边界

Phase 6 允许保留以下内容：

- seed/demo 测试数据，用于本地开发、数据库 seed 和测试夹具。
- 随访旅程 / 安全话术说明，作为静态说明。
- 工作台经营展示中的静态视觉元素，例如背景、图形、卡片布局和非数据性的说明文案。

Phase 6 必须避免以下情况：

- 工作台静态视觉元素不能被描述成真实同步数据。
- 三大业务页面不能再用静态 demo 数组作为业务 records 数据源。
- 对旧的未使用 demo 数据，例如 `src/modules/institution/domain/customers.ts`，本阶段先在文档中标记边界；后续如确认无引用，再单独清理。

## 设计方案

### 首页真实化

机构工作台首页只复用现有 API：

- `GET /api/institution/customers`
- `GET /api/institution/appointments`
- `GET /api/institution/followups`

首页不新增后端聚合接口。前端通过轻量 view model 派生展示数据：

- 客户关键指标：客户总数、高优先级客户数、复购窗口客户数、术后关怀客户数。
- 预约关键指标：待确认、已确认、已到院、改约跟进等分组数量。
- 随访关键指标：待处理、处理中、已升级、临近到期或高风险任务数量。
- 行动摘要：从高优先级客户、待确认预约、高风险随访任务中派生人工处理建议。

这些指标应明确标记为“来自现有机构 API 的当前租户摘要”。不得使用“实时同步”“AI 已排序”“24/7 AI 在线”等会暗示未实现能力的文案，除非文案明确是静态产品说明。

### 统一状态组件

三大业务页面已经各自实现 loading、error、empty 和边界说明。Phase 6 推荐抽小型共享组件，不做大型 UI 框架：

- `BusinessPageHeader`：统一业务页标题、说明和状态徽标。
- `BusinessStateBlock`：统一 loading、error、empty 呈现。
- `BusinessBoundaryPanel`：统一数据边界和静态说明卡片。
- `PlaceholderInstitutionView` 或同类组件：统一后续占位页面说明。

组件只服务 workspace / institution 当前页面，不抽成跨产品设计系统。

### 导航边界

机构端导航需要区分：

- 已真实接入：工作台、客户中心、预约中心、智能随访。
- 后续占位：客服工作台、知识库、数据分析。

占位页必须明确“不在 Phase 6 接入真实功能”。知识库只作为导航占位，不进入 RAG / 知识库真实功能。

### 测试策略

Phase 6 以 Vitest + Testing Library 为主，不引入新的 E2E 框架。

需要补充：

- workspace 首页从三类 API mock 派生指标。
- 首页任一 API 失败时展示稳定错误态，不泄露数据库或凭证信息。
- 三类 API 都为空时展示稳定空态或零值摘要。
- 桌面导航和移动导航切换到已接入页面后展示真实 API records。
- 导航切换到占位页面时不触发高风险模块请求。
- 三大业务页共用状态组件后，原有业务行为和 payload 白名单测试仍通过。

## PR 拆分

Phase 6 必须分 PR 执行：

1. PR 1：Phase 6 spec/plan 文档与 README/roadmap/devlog 状态更新。
2. PR 2：机构工作台首页接入现有三类真实 API，派生指标、行动摘要、首页 loading/error/empty。
3. PR 3：抽小型共享页面状态组件，统一三大业务页 header/state/boundary 展示。
4. PR 4：导航与 smoke 稳定化，补测试和收尾文档。

## 风险与控制

- 风险：首页聚合逻辑误导为真实 AI 或实时数据。
  - 控制：文案只描述“当前租户 API 摘要”和“人工处理建议”，不宣称 AI 排序或外部同步。
- 风险：抽组件时影响已完成业务页。
  - 控制：PR 3 只抽显示组件，不改 API client、payload、状态机和权限边界。
- 风险：导航占位被误认为真实功能。
  - 控制：占位页面、测试和文档同时标明后续阶段。
- 风险：Phase 6 滑入平台租户、套餐、AI、知识库等高风险模块。
  - 控制：所有高风险模块作为后续阶段建议，不进入 Phase 6。

## 验收标准

Phase 6 完成时应满足：

- 工作台首页关键指标来自现有客户、预约、随访 API records 派生。
- 首页、三大业务页和占位页的加载、错误、空态呈现一致。
- 机构端导航明确区分真实接入页面和后续占位页面。
- workspace / business 页面 smoke 测试覆盖入口切换、真实数据展示、错误态和空态。
- README、roadmap、devlog 反映 Phase 5 已完成和 Phase 6 实施状态。
- 不新增 API、数据库、权限、认证、租户隔离或高风险集成能力。

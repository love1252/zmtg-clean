# V1 workspace / knowledge base dashboard 集成前置审查 01

## 元信息

- 任务编号：`ZMTG-V1-WORKSPACE-KB-DASHBOARD-INTEGRATION-PREFLIGHT-01`
- 当前日期 / 时区：`2026-06-12 / CST +0800`
- 当前基线：`f063f9d2035f035578138a69b61a5256f84ee1be`
- 任务类型：`docs-only` / `preflight-only`
- 本文目的：在进入下一段代码任务前，先确认 workspace dashboard 与 knowledge base readonly 的已具备能力、当前链路状态、集成缺口和下一步最大但安全的代码切片。

本文不是实现授权。任何后续代码、API、UI、DB、runtime 或真实数据接入，都必须另开任务并重新声明边界。

## 本次不是哪些内容

本次不修改 `src/**`，不修改 tests，不做代码实现，不做 UI 实现，不做 API 实现，不接 DB / schema / migration，不做 runtime / service / repository / adapter，不做上传 / 解析 / 分块 runtime，不做 embedding / 向量索引 / 检索 runtime。

本次不接真实 HIS，不读取 credential，不处理真实客户数据，不接真实模型，不新增 mutation，不做自动营销、触达、任务、预约、成交、支付、合同或发票。

## 当前已具备能力

### knowledge base demo readonly API route

当前已有 `GET /api/v1/knowledge-base/demo-readonly`。该 route 只使用静态 mock / seed / demo 输入，调用 knowledge base demo readonly facade 和 API contract mapper，返回低敏只读响应。

该 route 已经存在，但本次不修改、不扩展、不把它升级为真实知识库 API。它仍不得接 DB、真实 HIS、credential、真实客户数据、真实模型、上传解析、embedding、向量索引或检索 runtime。

### knowledge base demo readonly API contract / facade

当前已有 knowledge base demo readonly source contract、facade 和 API contract。它们覆盖 `disabled`、`denied`、`empty`、`source_missing`、`partial`、`stale`、`ready` 等只读状态，并输出低敏字段，例如 `summary`、`categories`、`folders`、`knowledgeItems`、`taskRecords`、`searchPreview`、`riskFlags`、`recommendedReadonlyActions`。

其中 `searchPreview` 仍是 mock / demo 检索预览，不触发真实 embedding、模型调用、向量索引或真实检索。`recommendedReadonlyActions` 只能表达只读提示，不得表达自动创建任务、预约、触达、营销、成交、支付、合同或发票行为。

### knowledge base demo readonly UI shell / API integration / summary display

当前 workspace 的机构工作台中已有 knowledge base demo readonly 入口展示。该 UI shell 只调用现有 `GET /api/v1/knowledge-base/demo-readonly`，具备 loading / error / loaded 状态处理，并展示 summary、categories、folders、knowledgeItems、taskRecords 和 searchPreview 等低敏摘要。

该入口已经接入 UI，但它只是 demo readonly 入口，不代表知识库进入真实 runtime。它不能触发客服、知识库、数据分析、上传、解析、embedding、检索或外部系统真实请求。

### workspace dashboard readonly aggregation domain + tests

当前 workspace 侧已有 dashboard readonly aggregation domain + tests。该 domain 能聚合 business loop、management config、knowledge governance 等只读摘要，并覆盖 `disabled`、`denied`、`empty`、`source_missing`、`partial`、`stale`、`ready` 等状态。

这部分目前仍是 domain-only。它没有被包装成 workspace dashboard API contract，没有新增 route，也没有直接接入 workspace dashboard UI。

## 当前链路状态

| 能力 | 当前层级 | 当前是否接 UI | 当前是否 domain-only | 当前是否 docs-only plan | 仍禁止进入 runtime | 仍禁止真实数据 |
| --- | --- | --- | --- | --- | --- | --- |
| knowledge base demo readonly API route | API route | 已被 workspace UI 只读调用 | 否 | 否 | 是，不得扩展为真实 runtime | 是 |
| knowledge base demo readonly facade / API contract | domain | 通过现有 route 间接消费 | 否 | 否 | 是，不得接外部 IO | 是 |
| knowledge base demo readonly UI shell | UI | 已接入机构工作台 | 否 | 否 | 是，不得触发真实动作 | 是 |
| workspace dashboard readonly aggregation | domain | 未直接接 UI | 是 | 否 | 是，尚未授权 route / service | 是 |
| feature flag / RBAC / tenant guard plan | docs | 否 | 否 | 是 | 是 | 是 |
| upload / parse / chunk plan | docs | 否 | 否 | 是 | 是 | 是 |
| retrieval / embedding / vector plan | docs | 否 | 否 | 是 | 是 | 是 |
| real HIS / credential / customer data preflight | docs | 否 | 否 | 是 | 是 | 是 |

当前链路可以概括为：knowledge base demo readonly 已有一条低敏 demo API 与 UI 展示链路；workspace dashboard readonly aggregation 仍停留在 domain + tests；上传、解析、分块、embedding、向量、检索和真实数据仍只存在于计划或前置审查边界中。

## 集成缺口

1. workspace dashboard aggregation domain 尚未形成后续 API / UI 可消费的稳定 response contract。
2. workspace dashboard UI 尚未消费 workspace dashboard aggregation 的聚合结果。
3. knowledge base demo readonly API contract 与 workspace dashboard aggregation 之间尚未定义统一 dashboard response 的字段边界。
4. 当前已有 knowledge base demo readonly UI 状态处理可以复用设计思路，但不能直接把 domain 输入、真实来源或未来 runtime 泄露到 UI。
5. 若后续新增 workspace dashboard route，需要先有稳定 contract，并继续限制为 mock / seed / demo / readonly 输入。

## 下一步最大但安全的代码切片建议

推荐下一步任务：

`ZMTG-V1-WORKSPACE-DASHBOARD-READONLY-API-CONTRACT-FEATURE-01`

中文名建议：

V1 workspace dashboard readonly API 契约能力

最大但安全的范围是先做 `domain + tests` 的 workspace dashboard readonly API contract mapper，而不是立即新增 route 或接 UI。这样可以先稳定后续 route / UI 会消费的响应结构，同时避免把 domain-only 能力过早推进到 runtime。

### 是否需要 workspace dashboard readonly aggregation API contract

需要。当前 workspace dashboard aggregation 已有 domain summary，但缺少面向 API / UI 的稳定契约层。下一步应先新增纯 domain mapper，将 aggregation summary 整理为低敏、camelCase、readonly、可测试的 contract response。

建议输出字段可以包含：

- `requestId`
- `tenantId`
- `institutionId`
- `workspaceId`
- `status`
- `dashboardStatus`
- `summary`
- `businessLoop`
- `managementConfig`
- `knowledgeGovernance`
- `knowledgeBaseDemo`
- `riskFlags`
- `recommendedReadonlyActions`
- `readonly`

字段名称、状态枚举和低敏白名单应与现有 readonly contract 风格保持一致。

### 是否需要新增 route

需要，但不建议放入下一步最大安全切片。route 应作为后续独立任务，在 API contract 通过测试后再做。

后续 route 如果获批，仍只能是只读 demo route，不得接 DB、schema、migration、service、repository、adapter、真实 HIS、credential、真实客户数据、真实模型、上传解析、embedding、向量索引或真实检索。

### 是否需要接 workspace dashboard UI

需要，但应晚于 API contract 和 route。UI 集成应独立成后续任务，只消费已经稳定的只读 response，不直接消费 domain builder，不绕过 feature policy、tenant guard、RBAC guard 和低敏输出白名单。

### 是否可复用已有 demo readonly UI 状态处理

可以复用状态处理模式，而不是复制业务边界。已有 knowledge base demo readonly UI shell 的 loading / error / loaded、低敏文本保护、状态标签、边界提示和 summary 分区展示方式，可以作为 workspace dashboard readonly UI 接入时的样式和交互参考。

复用时必须保持：

- 只读展示；
- 低敏字段；
- `recommendedReadonlyActions` 只作为提示；
- 不触发 mutation；
- 不触发自动营销、触达、任务、预约、成交、支付、合同或发票；
- 不展示真实客户、HIS、credential、模型调用或 runtime 细节。

## 下一步推荐任务边界

### 允许修改文件范围

建议仅允许：

- `src/modules/workspace/domain/v1-workspace-dashboard-readonly-api-contract.ts`
- `src/modules/workspace/tests/V1WorkspaceDashboardReadonlyApiContract.test.ts`

如确需增加导出，应优先通过测试文件直接路径导入；除非明确需要，不修改公共出口文件。

### 禁止修改文件范围

下一步任务不应修改：

- `src/app/**`
- `src/modules/workspace/components/**`
- `src/modules/knowledge-base/**`
- DB / schema / migration
- runtime / service / repository / adapter
- upload / parse / chunk runtime
- embedding / vector / retrieval runtime
- package / lockfile
- 任何真实 credential 或生产配置

### 最小测试范围

下一步任务至少应覆盖：

1. feature disabled
2. tenant mismatch
3. RBAC denied
4. empty
5. source missing
6. partial
7. stale
8. ready
9. aggregation summary 可转换为 API contract response
10. knowledge governance / knowledge base demo 摘要低敏输出
11. 输出不含真实客户、HIS、credential、模型、上传解析、embedding、向量、检索 runtime 字段
12. `recommendedReadonlyActions` 不含自动任务、预约、触达、营销、成交、支付、合同、发票行为

建议验证命令：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/V1WorkspaceDashboardReadonlyApiContract.test.ts
node scripts/run-vitest.mjs run src/modules/workspace/tests/V1WorkspaceDashboardReadonlyAggregation.test.ts src/modules/workspace/tests/V1ReadonlyFeaturePolicy.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoSourceContract.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyFacade.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiContract.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseGovernanceReadonly.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseAuditReadonly.test.ts
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit
```

### Draft PR 停止条件

下一步代码任务创建 Draft PR 后应停止，不转 Ready、不合并。出现以下任一情况应立即停止：

- 需要新增 route；
- 需要修改 UI；
- 需要接 DB / schema / migration；
- 需要 service / repository / adapter；
- 需要真实 HIS / credential / 客户数据 / 模型；
- 需要上传 / 解析 / 分块 runtime；
- 需要 embedding / 向量索引 / 检索 runtime；
- 需要 mutation 或自动化动作；
- 工作区出现非本任务允许文件变更；
- 定向测试或 `tsc --noEmit` 失败。

## 强制禁止事项

在进入下一步代码任务前，以下范围仍保持禁止：

- 不接真实 HIS；
- 不读取 credential；
- 不处理真实客户数据；
- 不接真实模型；
- 不做上传 / 解析 / 分块 runtime；
- 不做 embedding / 向量索引 / 检索 runtime；
- 不接 DB / schema / migration；
- 不做 service / repository / adapter；
- 不新增 mutation；
- 不做自动营销 / 触达 / 任务 / 预约 / 成交 / 支付 / 合同 / 发票；
- 不把 docs-only plan 解释为 runtime 实现许可。

## 回滚边界

本次只新增一份 docs-only 前置审查文档。若需要回滚，仅需 revert 本文档提交或关闭对应 Draft PR，不涉及代码、测试、API、UI、DB、schema、runtime 或真实数据。

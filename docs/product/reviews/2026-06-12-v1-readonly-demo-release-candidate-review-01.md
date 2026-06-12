# V1 readonly demo 内部验收候选审查 01

## 1. 文档元信息

| 项 | 内容 |
| --- | --- |
| 任务编号 | `ZMTG-V1-READONLY-DEMO-RELEASE-CANDIDATE-REVIEW-01` |
| 中文名 | V1 readonly demo 内部验收候选审查 |
| 日期 / 时区 | 2026-06-12 / CST +0800 |
| 当前基线 | `main` / `origin/main` = `1b5054c036c70ab39ed5591e355442fd9934ba3f` |
| 文档性质 | docs-only / release-candidate-review-only |
| 审查对象 | V1 受控 readonly demo：workspace dashboard readonly aggregation + knowledge base demo readonly |

本文档只做阶段收口审查，用于判断当前 V1 readonly demo 是否可以作为“内部受控 demo 候选”展示。本文档不是 runtime、DB、真实数据、真实模型、上传解析、embedding、向量索引或检索实现授权。

## 2. 本次不是哪些内容

本次不修改 `src/**`，不修改 tests，不做 UI / API / domain / DB / schema / migration / runtime / service / repository / adapter 实现。

本次不接真实 HIS，不读取 credential，不处理真实客户数据，不接真实模型，不做上传 / 解析 / 分块 runtime，不做 embedding / 向量索引 / 检索 runtime，不做自动营销、触达、创建任务、预约、成交、支付、合同或发票。

## 3. 当前已完成能力

### 3.1 workspace dashboard readonly aggregation

当前 workspace dashboard readonly aggregation 已形成以下受控链路：

- 纯 domain 聚合：聚合 business loop、management config、knowledge governance、field whitelist、readonly feature policy 等只读摘要。
- API contract：将聚合结果整理为后续 API / UI 可消费的低敏 response。
- GET-only API route：`GET /api/v1/workspace-dashboard/readonly-aggregation`，使用 mock / seed / demo 输入，不接 DB 或外部 IO。
- UI 展示：机构工作台展示 `workspace dashboard readonly aggregation`，包含状态总览、核心聚合摘要、治理提示、只读动作提示和 taskRecords。
- 展示边界：仅显示低敏摘要、readonly 标签和产品化状态，不展示 raw payload、credential、真实客户、模型、embedding、vector、retrieval 或技术错误细节。
- 动作边界：无 mutation 控件，`recommendedReadonlyActions` 只作为只读提示，不触发任务、预约、触达、营销、成交、支付、合同或发票。

覆盖状态包括：`loading`、`error`、`disabled`、`denied`、`empty`、`partial`、`stale`、`ready`。

### 3.2 knowledge base demo readonly

当前 knowledge base demo readonly 已形成以下受控链路：

- demo source / facade / API contract：覆盖平台知识库与机构知识库 demo 输入，并输出 summary、categories、folders、knowledgeItems、taskRecords、searchPreview、riskFlags、recommendedReadonlyActions 等低敏字段。
- GET-only API route：`GET /api/v1/knowledge-base/demo-readonly`，只使用 mock / seed / demo 输入，不接真实知识库 runtime。
- UI 展示：机构工作台展示 `知识库 demo readonly`，包含 summary、分类摘要、目录摘要、知识条目、只读任务和 demo searchPreview。
- demo preview 边界：`searchPreview` 仅为 mock / demo 预览，不调用真实 embedding、模型、向量索引或检索 runtime。
- 低敏边界：UI 对真实客户、HIS、credential、模型、raw、payload、embedding、vector、retrieval、支付、合同、发票等内容做隐藏或禁止展示。
- 动作边界：无 mutation 控件，不提供上传、编辑、删除、发布、下架、回滚或自动动作入口。

覆盖状态包括：`loading`、`error`、`disabled`、`denied`、`empty`、`ready`；domain / facade 层还覆盖 `source_missing`、`partial`、`stale` 等治理状态。

### 3.3 readonly demo gate acceptance

当前已新增 `V1ReadonlyDemoGateAcceptance.test.tsx`，作为两条链路的总验收门禁：

- 同页确认 workspace dashboard readonly aggregation 与 knowledge base demo readonly 同时存在。
- 锁定两条链路均为 GET-only、readonly、低敏展示、无 mutation 控件。
- workspace 链路覆盖 loading / error / disabled / denied / empty / partial / stale / ready。
- knowledge base 链路覆盖 loading / error / disabled / denied / empty / ready。
- 锁定 categories / folders / knowledgeItems / taskRecords / searchPreview 展示结构。
- 锁定 searchPreview 仅为 demo 预览，不是真实检索。
- 使用包含敏感词和 mutation 文案的 unsafe mock response 验证 UI 不泄露高风险内容。

## 4. 当前可展示范围

当前建议展示范围仅限：

- 内部受控 demo。
- mock / seed / demo 数据。
- readonly 摘要。
- 产品化低敏状态与失败文案。
- workspace dashboard readonly aggregation 的聚合摘要。
- knowledge base demo readonly 的结构化低敏摘要和 demo searchPreview。
- 面向内部评审的状态、边界、风险提示和只读动作提示。

当前展示不代表：

- 生产系统已就绪。
- 真实知识库 runtime 已实现。
- 上传、解析、分块、embedding、向量索引或检索已实现。
- 真实 HIS、credential、真实客户数据或真实模型已接入。
- 可以自动创建任务、预约、触达、营销、成交、支付、合同或发票。

## 5. 当前禁止范围

以下范围在进入单独前置审查和授权任务前继续保持 NO-GO：

| 范围 | 当前结论 | 原因 |
| --- | --- | --- |
| 真实 HIS | NO-GO | 尚未完成真实 HIS 接入前置审查、字段白名单、credential 生命周期和审计 runtime。 |
| credential | NO-GO | 不读取、不保存、不展示真实 token、secret、API key、OAuth、Webhook secret 或连接串。 |
| 真实客户数据 | NO-GO | 未进入真实数据字段 allowlist、合规确认和数据处理协议阶段。 |
| 真实模型 | NO-GO | 当前不调用模型，不处理真实 prompt / completion，不输出模型结果。 |
| DB / schema / migration | NO-GO | 当前链路只使用 mock / seed / demo 输入，不写库、不建表、不迁移。 |
| runtime / service / repository / adapter | NO-GO | 当前不创建外部 IO、后台服务、repository、adapter 或 scheduler。 |
| 上传 / 解析 / 分块 runtime | NO-GO | 仅有计划文档，尚未进入实现授权。 |
| embedding / 向量索引 / 检索 runtime | NO-GO | `searchPreview` 只是 demo preview，不是检索 runtime。 |
| 自动营销 / 触达 / 任务 / 预约 / 成交 | NO-GO | 当前 `recommendedReadonlyActions` 只能作为只读提示。 |
| 支付 / 合同 / 发票 | NO-GO | 不属于 readonly demo 候选展示范围。 |

## 6. 验收依据

本次候选判断基于以下已合并能力和验证范围：

| 验收项 | 证据 |
| --- | --- |
| 页面验收测试 | `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx` 覆盖 knowledge base demo readonly 与 workspace dashboard readonly aggregation 的 ready、loading、error、低敏、GET-only 和无按钮边界。 |
| 总验收门禁测试 | `src/modules/workspace/tests/V1ReadonlyDemoGateAcceptance.test.tsx` 同时锁定两条 readonly demo 链路、状态矩阵、低敏过滤、无 mutation 和 demo preview 边界。 |
| workspace domain / API / route 回归 | `V1WorkspaceDashboardReadonlyAggregation.test.ts`、`V1WorkspaceDashboardReadonlyApiContract.test.ts`、`V1WorkspaceDashboardReadonlyAggregationApiRoute.test.ts`。 |
| knowledge base domain / API / route 回归 | `V1KnowledgeBaseDemoReadonlyFacade.test.ts`、`V1KnowledgeBaseDemoReadonlyApiContract.test.ts`、`V1KnowledgeBaseDemoReadonlyApiRoute.test.ts`。 |
| TypeScript | `tsc --noEmit` 已作为前序合并验证项通过。 |
| 前置边界文档 | 真实 HIS / credential / 客户数据前置审查、上传 / 解析 / 分块计划、检索 / embedding / 向量计划、workspace / knowledge base dashboard 集成前置审查。 |

推荐在任何 release candidate 复核前重复执行：

```bash
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/V1ReadonlyDemoGateAcceptance.test.tsx
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/V1WorkspaceDashboardReadonlyApiContract.test.ts src/modules/workspace/tests/V1WorkspaceDashboardReadonlyAggregationApiRoute.test.ts src/modules/workspace/tests/V1WorkspaceDashboardReadonlyAggregation.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiContract.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiRoute.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyFacade.test.ts
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit
```

## 7. Go / No-Go 结论

### 7.1 初步结论

建议将当前 V1 readonly demo 标记为“内部受控 demo 候选”：GO with constraints。

### 7.2 已满足条件

- 两条核心链路已经接入机构工作台展示。
- 两条链路均为 GET-only。
- 两条链路均只消费 mock / seed / demo 输入。
- 两条链路均返回或展示 readonly 摘要。
- 已有页面级测试、API / contract / domain 回归和总验收门禁。
- UI 对高风险字段、真实客户、HIS、credential、模型、embedding、vector、retrieval 和 mutation 文案有防护。
- 当前展示不需要真实 DB、真实 HIS、真实 credential、真实客户数据或真实模型。

### 7.3 未满足条件

- 不满足生产可用条件。
- 不满足真实知识库 runtime 条件。
- 不满足真实上传、解析、分块、embedding、向量索引或检索条件。
- 不满足真实 HIS、credential、真实客户数据和真实模型接入条件。
- 不满足外部系统自动触达、自动任务、预约、成交、支付、合同或发票条件。
- 不满足客户现场真实数据演示条件。

### 7.4 进入 runtime 前必须完成的前置任务

进入任何 runtime / DB / 真实数据前，至少必须完成：

1. 真实 HIS / credential / 客户数据字段白名单和合规前置审查。
2. credential 生命周期、安全保存、轮换、吊销和低敏审计方案。
3. 上传 / 解析 / 分块的 contract / test plan，且仍使用 mock / seed / demo 文件元数据。
4. embedding / 向量索引 / 检索的输入白名单、索引生命周期、失败态和审计方案。
5. DB / schema / migration 单独审批和回滚方案。
6. runtime / service / repository / adapter 单独审批，不得夹带在 demo 或 docs-only PR 中。

## 8. 下一步最大可执行建议

以下只是建议，不是自动开发许可；每个任务都必须单独启动、单独声明边界、创建 Draft PR 后停止。

### 8.1 推荐代码任务

任务建议：

`ZMTG-V1-READONLY-DEMO-INTERNAL-REVIEW-SNAPSHOT-TEST-01`

中文名：

V1 readonly demo 内部验收快照测试

目标：

新增一个 test-only 的内部验收快照 / contract fixture 测试，把 release candidate 所需的 UI 文案、route 字段和 readonly 边界固化为可复核的测试证据。

允许范围：

- `src/modules/workspace/tests/**`
- `src/modules/knowledge-base/tests/**`

禁止范围：

- 不修改 `src/app/**` route。
- 不修改 UI component。
- 不修改 domain / API contract。
- 不接 DB / schema / migration。
- 不做 runtime / service / repository / adapter。
- 不接真实 HIS / credential / 客户数据 / 模型。
- 不做上传 / 解析 / 分块 / embedding / 向量索引 / 检索 runtime。
- 不新增 mutation 控件或自动动作。

验证命令：

```bash
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/V1ReadonlyDemoGateAcceptance.test.tsx
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit
git diff --check origin/main...HEAD
```

Draft PR 停止条件：

- 测试失败。
- 需要修改生产代码。
- 需要新增 API route。
- 需要接 DB、runtime、真实数据或模型。
- 工作区出现非允许文件变更。
- Draft PR 创建后停止，不转 Ready、不合并。

### 8.2 推荐 docs / test 任务

任务建议：

`ZMTG-V1-READONLY-DEMO-RELEASE-CANDIDATE-CHECKLIST-01`

中文名：

V1 readonly demo 内部演示检查清单

目标：

新增 docs-only 检查清单，用于内部演示前人工确认浏览器页面、文案边界、测试命令、No-Go 范围和回滚口径。

允许范围：

- `docs/product/reviews/**`
- `docs/product/test-plans/**`

禁止范围：

- 不修改 `src/**`。
- 不修改 tests。
- 不做 UI / API / domain / DB / schema / runtime 实现。
- 不接真实 HIS / credential / 客户数据 / 模型。
- 不启动 dev server。
- 不打开系统预览。

验证命令：

```bash
git diff --check origin/main...HEAD
```

Draft PR 停止条件：

- 文档出现“直接实现 runtime”“顺手接真实 HIS / credential / 客户数据 / 模型”“无需另开任务”等授权措辞。
- 文档要求修改 `src/**` 或 tests。
- 工作区出现非 docs 文件变更。
- Draft PR 创建后停止，不转 Ready、不合并。

## 9. 回滚边界

本次仅新增 docs-only review 文档。若需要回滚，仅需 revert 本文档提交或关闭对应 Draft PR，不涉及源码、测试、API、UI、DB、schema、migration、runtime、service、repository、adapter 或真实数据。

## 10. 最终判断

当前 V1 readonly demo 可以进入“内部受控 demo 候选”状态，但不能被解释为生产 readiness、真实知识库 runtime readiness 或真实数据接入 readiness。

推荐内部展示时使用以下口径：

- “当前为受控 readonly demo 候选。”
- “当前只展示 mock / seed / demo 低敏摘要。”
- “当前不接真实 HIS、credential、客户数据或模型。”
- “当前 searchPreview 是 demo preview，不是真实检索。”
- “后续进入 runtime、DB 或真实数据前必须单独任务、单独审批、单独验证。”

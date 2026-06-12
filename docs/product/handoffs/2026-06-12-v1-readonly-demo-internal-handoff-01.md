# V1 readonly demo 内部交付说明 01

## 1. 交付基线

| 项 | 内容 |
| --- | --- |
| 任务编号 | `ZMTG-V1-READONLY-DEMO-INTERNAL-HANDOFF-01` |
| 中文名 | V1 readonly demo 内部交付说明 |
| 日期 / 时区 | 2026-06-12 / CST +0800 |
| main / origin/main 基线 | `d0b92265992fc4b95034bc70007c21c3059b6872` |
| 当前阶段 | 内部受控 demo 候选交付基线 |
| 交付性质 | docs-only / handoff-only |
| 候选结论 | `GO with constraints` |

当前 V1 readonly demo 可以作为内部受控 demo 候选进行交付说明和内部演示准备。该结论不代表生产系统可用，不代表真实知识库 runtime 可用，不代表真实 HIS、credential、客户数据或模型已接入。

本 handoff 继承 `docs/product/reviews/2026-06-12-v1-readonly-demo-release-candidate-review-01.md` 的边界：当前只允许 mock / seed / demo 数据、readonly 摘要、低敏展示、GET-only 和无 mutation 展示。

## 2. 可展示范围

内部演示仅可展示以下范围：

| 范围 | 可展示内容 | 边界 |
| --- | --- | --- |
| workspace dashboard readonly aggregation | 状态总览、核心聚合摘要、治理提示、只读动作提示、taskRecords。 | 只读摘要，不触发任何写操作。 |
| knowledge base demo readonly | summary、categories、folders、knowledgeItems、taskRecords、searchPreview。 | `searchPreview` 仅为 demo 预览，不是真实检索。 |
| mock / seed / demo 数据 | 平台知识库、机构知识库、workspace 聚合 demo 数据。 | 不包含真实客户、真实 HIS 或真实 credential。 |
| readonly 摘要 | 低敏状态、低敏失败文案、只读动作提示。 | 不展示 raw payload、技术栈、路径、worker 或依赖错误。 |
| GET-only | `GET /api/v1/workspace-dashboard/readonly-aggregation` 与 `GET /api/v1/knowledge-base/demo-readonly`。 | 不新增 POST / PATCH / DELETE。 |
| 无 mutation | 页面不提供上传、编辑、删除、发布、下架、回滚或自动动作控件。 | 不创建任务、预约、触达、营销、成交、支付、合同或发票。 |

演示时可以说明：当前链路用于内部验证“受控 readonly demo”展示方式，不是生产系统交付。

## 3. 禁止展示 / 禁止声明

演示中不得展示或声明以下内容：

- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不接真实模型。
- 不接 DB / schema / migration。
- 不做 runtime / service / repository / adapter。
- 不做上传 / 解析 / 分块 runtime。
- 不做 embedding / 向量索引 / 检索 runtime。
- 不做自动营销 / 触达 / 任务 / 预约 / 成交。
- 不做支付 / 合同 / 发票。
- 不声称已经具备生产 readiness。
- 不声称已经具备真实知识库 runtime readiness。
- 不声称可以直接接客户现场真实数据。
- 不把 docs、plan、review 或 handoff 文档解释为实现授权。

如被问到“能不能直接接真实数据 / HIS / 模型 / DB”，标准回答是：当前为 `NO-GO`，必须另开前置审查和 runtime 任务，并重新声明边界、验证和回滚方案。

## 4. 验收命令

演示前建议完整执行以下命令。docs-only handoff 本身只要求 `git diff --check`；下列命令用于内部演示前复核当前候选状态。

### 4.1 readonly demo gate acceptance

```bash
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/V1ReadonlyDemoGateAcceptance.test.tsx
```

### 4.2 WorkspaceEntryPages

```bash
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

### 4.3 workspace dashboard readonly API / contract / domain 回归

```bash
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/V1WorkspaceDashboardReadonlyApiContract.test.ts src/modules/workspace/tests/V1WorkspaceDashboardReadonlyAggregationApiRoute.test.ts src/modules/workspace/tests/V1WorkspaceDashboardReadonlyAggregation.test.ts
```

### 4.4 knowledge base demo readonly API / contract / facade 回归

```bash
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiContract.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiRoute.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyFacade.test.ts
```

### 4.5 TypeScript

```bash
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit
```

### 4.6 diff 检查

```bash
git diff --check origin/main...HEAD
```

## 5. 演示前检查清单

演示前必须逐项确认：

- 当前分支为 `main`。
- 本地 `main` 与 `origin/main` 一致。
- 本地 HEAD 为交付基线或更新后的已合并交付基线。
- `git status --short` 为空。
- `git stash list` 为空。
- GitHub 当前无未处理的 open PR，或已明确说明不影响演示。
- readonly demo gate acceptance 通过。
- WorkspaceEntryPages 回归通过。
- workspace dashboard readonly API / contract / domain 回归通过。
- knowledge base demo readonly API / contract / facade 回归通过。
- `tsc --noEmit` 通过。
- `git diff --check` 通过。
- 演示数据仅使用 mock / seed / demo。
- 演示人员确认不会临场接入真实 HIS、credential、客户数据、模型、DB 或 runtime。

任一项不满足，应停止演示或改为说明当前阻断，不做临场修复。

## 6. 演示中话术边界

### 6.1 可以说

- “这是 V1 readonly demo 的内部受控候选。”
- “当前展示 workspace dashboard readonly aggregation 与 knowledge base demo readonly 两条链路。”
- “当前只使用 mock / seed / demo 数据。”
- “当前只展示低敏 readonly 摘要。”
- “当前页面只调用 GET route，不触发写入。”
- “当前没有 mutation 控件，不会自动创建任务、预约、触达、营销、成交、支付、合同或发票。”
- “`searchPreview` 是 demo 预览，不是真实检索。”
- “当前结论是 `GO with constraints`，意思是可以内部受控演示，但不能进入生产或真实数据。”

### 6.2 不能说

- 不能说“已经接入真实 HIS”。
- 不能说“已经读取 credential”。
- 不能说“已经处理真实客户数据”。
- 不能说“已经接入真实模型”。
- 不能说“已经接入 DB / schema / migration”。
- 不能说“已经实现 runtime / service / repository / adapter”。
- 不能说“已经支持上传、解析、分块 runtime”。
- 不能说“已经支持 embedding、向量索引或真实检索 runtime”。
- 不能说“可以自动营销、触达、创建任务、预约、成交、支付、合同或发票”。
- 不能说“可以直接给客户现场使用真实数据演示”。

### 6.3 如何解释 `GO with constraints`

`GO with constraints` 表示：

- 可以作为内部受控 demo 候选展示。
- 可以展示当前 readonly 摘要链路和低敏边界。
- 可以用于内部评审下一步最小任务切片。
- 不代表生产可用。
- 不代表真实知识库 runtime 可用。
- 不代表真实数据、真实 HIS、credential、真实模型或 DB 已进入系统。

### 6.4 如何解释 runtime / DB / 真实数据仍为 `NO-GO`

runtime / DB / 真实数据仍为 `NO-GO`，因为当前尚未完成：

- 真实 HIS / credential / 客户数据字段白名单和合规前置审查。
- credential 生命周期、安全保存、轮换、吊销和低敏审计方案。
- 上传 / 解析 / 分块 runtime 的安全扫描、失败态和回滚方案。
- embedding / 向量索引 / 检索 runtime 的输入白名单、索引生命周期和审计方案。
- DB / schema / migration 单独审批。
- runtime / service / repository / adapter 单独审批。

因此任何“接真实数据”“接真实模型”“接真实 HIS”“写库”“建索引”“做真实检索”的需求，都必须另开任务，不得在演示现场临时处理。

## 7. 异常处理

### 7.1 测试失败

如果任一验收命令失败：

- 立即停止演示准备。
- 记录失败命令和失败摘要。
- 不转 Ready，不合并相关 PR。
- 不做临场修复。
- 不临时缩小验收范围。
- 另开修复任务并重新声明允许范围、禁止范围和验证命令。

### 7.2 脏工作区

如果 `git status --short` 不为空：

- 立即停止。
- 确认变更是否属于当前任务。
- docs-only 任务不得夹带 `src/**`、tests、配置、schema、runtime 或 lockfile 变更。
- 不使用 `git add -A` 盲目提交。

### 7.3 发现真实数据 / credential / runtime 迹象

如果发现真实数据、credential、runtime、DB、HIS、模型或外部系统迹象：

- 立即停止演示和交付动作。
- 不继续查看或传播敏感内容。
- 不把真实内容写入文档、测试、日志或 PR 描述。
- 回到真实 HIS / credential / 客户数据前置审查流程。

### 7.4 临场请求扩展

如果演示中有人要求“顺手接真实数据”“临时接模型”“直接做检索”“先写库再说”：

- 明确拒绝临场扩展。
- 说明当前只是内部受控 readonly demo 候选。
- 将需求记录为后续候选任务，不作为当前交付许可。

## 8. 下一步建议

以下建议不是自动开发许可；每个任务必须单独启动、单独声明边界、创建 Draft PR 后停止。

### 8.1 安全代码任务

任务建议：

`ZMTG-V1-READONLY-DEMO-INTERNAL-REVIEW-SNAPSHOT-TEST-01`

中文名：

V1 readonly demo 内部验收快照测试

目标：

新增 test-only 快照 / fixture 验收测试，固化当前 handoff 需要的 UI 文案、route 字段、readonly 边界、低敏过滤和 `GO with constraints` / `NO-GO` 文案证据。

允许范围：

- `src/modules/workspace/tests/**`
- `src/modules/knowledge-base/tests/**`

禁止范围：

- 不修改 `src/app/**`。
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
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node scripts/run-vitest.mjs run src/modules/workspace/tests/V1WorkspaceDashboardReadonlyApiContract.test.ts src/modules/workspace/tests/V1WorkspaceDashboardReadonlyAggregationApiRoute.test.ts src/modules/workspace/tests/V1WorkspaceDashboardReadonlyAggregation.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiContract.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyApiRoute.test.ts src/modules/knowledge-base/tests/V1KnowledgeBaseDemoReadonlyFacade.test.ts
PATH=/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit
git diff --check origin/main...HEAD
```

Draft PR 停止条件：

- 任一验证命令失败。
- 需要修改生产代码。
- 需要新增 API route。
- 需要接 DB、runtime、真实数据或模型。
- 工作区出现非允许文件变更。
- Draft PR 创建后停止，不转 Ready、不合并。

### 8.2 安全文档 / 测试任务

任务建议：

`ZMTG-V1-READONLY-DEMO-INTERNAL-DEMO-CHECKLIST-01`

中文名：

V1 readonly demo 内部演示检查清单

目标：

新增 docs-only 检查清单，用于演示当天逐项确认环境、命令、话术边界、截图禁止范围、异常处理和回滚口径。

允许范围：

- `docs/product/handoffs/**`
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

## 9. 回滚说明

本 handoff 仅新增一份 docs-only 文档。若需要回滚，仅需 revert 本文档提交或关闭对应 Draft PR，不涉及源码、测试、UI、API、DB、schema、migration、runtime、service、repository、adapter、HIS、credential、客户数据或模型。

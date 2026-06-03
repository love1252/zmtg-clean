# Phase 21 随访路径运营分析 v1 计划

> 日期：2026-06-03
> 状态：Phase 21 Plan Mode 文档。本 PR 只做 spec / plan，不进入实现。

**目标：** 规划如何基于现有治疗摘要、路径模板建议、来源随访任务、任务状态和审计记录，形成最小可用的随访路径运营分析 v1 口径。

**架构边界：** 当前 PR 不改架构，只规划后续方向。后续如进入实现，应优先使用现有结构化治疗摘要、确定性模板建议、来源随访任务和审计记录做只读派生，避免过早新增 schema、API、图表 UI 或经营归因能力。

**技术边界：** 当前 PR 只新增 / 修改 Markdown 文档；不写代码、不改 UI、不改测试、不新增 API、不改 Drizzle schema / migration、不改 RBAC / auth / tenant isolation、不接 HIS / 企微 / AI、不做自动触达。

---

## 0. 当前 PR 范围

新增：

- `docs/superpowers/specs/2026-06-03-phase21-followup-path-analysis-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase21-followup-path-analysis-v1.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-05-31.md`

当前 PR 不做：

- 不写代码。
- 不改 UI。
- 不改测试。
- 不新增 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接 HIS。
- 不接企业微信。
- 不接 AI / RAG / Agent。
- 不做自动触达。
- 不做经营智能中心实现。
- 不做图表 UI。
- 不做报表导出。
- 不修改 demo seed 数据。

验证命令：

```bash
git diff --check
git diff --cached --check
```

本 PR 不需要跑 Vitest、typecheck 或 Next build，除非误改了代码。

## 1. 当前上下文

已经完成的相关阶段：

- Phase 12：治疗记录结构化摘要 v1。
- Phase 13：治疗摘要人工录入 v1。
- Phase 14：治疗摘要管理能力 v1。
- Phase 15：治疗后护理 / 随访联动 v1。
- Phase 16：随访任务来源治理增强 v1。
- Phase 17：HIS 标准治疗事件 domain-only 契约。
- Phase 18：治疗摘要编辑能力 v1。
- Phase 19：治疗摘要作废能力 v1。
- Phase 20：治疗项目路径模板 v1。

当前可复用事实：

- 治疗摘要只保存结构化安全字段，不保存完整治疗正文或完整病历正文。
- Phase 20 模板建议使用 `ruleKey === "template_path_followup"` 标识。
- 模板建议 key 稳定包含来源治疗摘要、模板 key 和节点 key。
- 人工确认后才创建来源随访任务。
- 来源任务使用 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey` 追踪来源。
- 来源任务已有状态和 `dueAt`。
- 已作废摘要阻断新的随访建议和新的来源任务创建。
- 重复来源任务创建已有去重 / 冲突治理。
- 审计记录可作为成功、拒绝、冲突和阻断尝试的追溯来源，但后续实现前必须重新核对现有 reason / action。

## 2. 文件职责规划

### 当前 PR 文件

- `docs/superpowers/specs/2026-06-03-phase21-followup-path-analysis-v1-design.md`
  - 说明 Phase 21 定位、目标、最小指标、与现有对象关系、非目标、安全边界、后续单独评估门槛和 PR 拆分建议。
- `docs/superpowers/plans/2026-06-03-phase21-followup-path-analysis-v1.md`
  - 说明当前 docs-only PR 范围、后续实现拆分、文件职责、验证策略和停止条件。
- `README.md`
  - 轻量同步 Phase 21 Plan Mode 文档状态，明确不是功能实现。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步随访路径运营分析 v1 已进入口径规划，后续实现仍需单独评估。
- `docs/devlog/2026-05-31.md`
  - 追加 Phase 21 Plan Mode 记录。

### 后续实现可能涉及文件

只有在用户明确进入 Phase 21 实现后，才评估以下文件：

- 可新增：`src/modules/institution/domain/followup-path-analysis.ts`
  - 承载 domain-only 指标口径、统计窗口、`analysisAt` 和只读聚合类型。
- 可新增：`src/modules/institution/tests/FollowupPathAnalysis.test.ts`
  - 覆盖模板建议数、人工确认任务数、任务完成数、任务超时数、作废摘要阻断数和重复来源任务冲突数。
- 可修改：审计相关 domain / repository / route 测试
  - 仅当现有审计无法稳定支撑阻断或冲突次数时单独评估。
- 可新增：机构端只读分析 API route
  - 仅当确认需要前端读取聚合结果时单独评估。
- 可修改：机构端页面组件
  - 仅当确认需要轻量展示指标时单独评估。

后续实现默认不涉及：

- 数据库 schema。
- migration。
- 新权限。
- 认证或租户隔离改动。
- HIS / 企微 / AI 集成。
- 自动触达。
- demo seed。

## 3. 最小指标口径

后续实现如采用 domain-only 聚合，建议至少覆盖：

| 指标 | 推荐输入 | 口径要点 |
| --- | --- | --- |
| 模板建议数 | active 治疗摘要 + 确定性建议派生 | 只统计 `template_path_followup`，不统计作废摘要和非模板建议。 |
| 人工确认任务数 | 来源随访任务 + 可选审计 | 统计治疗摘要来源、带 `sourceSuggestionKey` 的已创建任务；重复冲突不计入。 |
| 任务完成数 | 来源随访任务状态 | 统计 `status === "completed"`。 |
| 任务超时数 | 来源随访任务状态 + `dueAt` + `analysisAt` | `dueAt < analysisAt` 且状态未完成 / 未取消。 |
| 作废摘要阻断数 | 审计记录 | 统计因 voided summary 导致的建议或任务创建阻断；不能用 voided 摘要数量替代。 |
| 重复来源任务冲突数 | 审计记录 | 统计同来源建议重复确认被冲突治理拦截的次数。 |

如审计记录无法稳定提供作废阻断数或重复冲突数，后续实现必须降级指标或单独做审计补强评估。

## 4. 后续 PR 拆分

### PR 1：Phase 21 spec / plan 文档

当前 PR。

完成标准：

- 两份 Phase 21 文档已新增。
- README、roadmap、devlog 已轻量同步。
- 只改 Markdown。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

### PR 2：分析口径 domain-only 最小实现

状态：

- 已完成。
- 新增 `src/modules/institution/domain/followup-path-analysis.ts`。
- 新增 `src/modules/institution/tests/FollowUpPathAnalysis.test.ts`。
- 输出六个最小指标和安全说明，不返回客户明细、完整治疗正文、PII 或 raw audit payload。
- 未新增 API、未改数据库、未改 UI、未改权限、认证或租户隔离。

前提：

- 用户明确要求进入 Phase 21 实现。
- 确认 v1 不落库、不新增 API、不改 UI。

建议范围：

- 新增 domain-only 聚合函数。
- 输入为治疗摘要、模板建议、来源任务和审计记录的安全 DTO。
- 定义统计窗口和 `analysisAt`。
- 输出只包含聚合数字、统计窗口和安全说明。
- 不新增 API。
- 不改数据库。
- 不改 UI。

建议测试：

- active 摘要命中模板建议时计入模板建议数。
- voided 摘要不计入模板建议数。
- 人工确认创建的来源任务计入人工确认任务数。
- `completed` 来源任务计入完成数。
- `dueAt < analysisAt` 且未完成 / 未取消的来源任务计入超时数。
- 作废阻断审计计入作废摘要阻断数。
- 重复来源任务冲突审计计入重复冲突数。
- 不返回客户敏感明细、完整治疗正文、PII、SQL、stack、token、secret、`DATABASE_URL` 或连接串。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/FollowupPathAnalysis.test.ts
```

### PR 3：审计口径核对 / 补强评估

状态：

- 已进入 docs-only 审计口径核对评估。
- 新增 `docs/superpowers/plans/2026-06-03-phase21-audit-metrics-review.md`。
- 当前结论：`voidedSummaryBlockedCount` 和 `duplicateSourceTaskConflictCount` 都只能部分稳定支撑。
- 在审计口径补强前，这两个指标只能作为 warning 口径，不得作为正式统计指标对外展示。
- 当前不进入 Phase 21 分析 API / UI 实现；如需正式展示这两个指标，必须先单独做审计补强 PR。

前提：

- PR 2 发现现有审计无法稳定支撑阻断次数或冲突次数。

建议范围：

- 只读核对现有审计 resource / action / reason。
- 如需新增 reason、补 `resourceId` 约定或增加来源上下文，单独规划 parser、repository、API 写入和测试。
- 不得用 voided 摘要数量冒充作废摘要阻断次数。
- 不得用任务表重复行推断重复来源任务冲突次数。
- 不混入分析 UI。
- 不新增经营智能中心。

建议下一步：

- `PR A：补强作废摘要阻断 audit reason`。
- `PR B：补强重复来源任务冲突 audit reason`。
- 或者在后续 UI / API 阶段先将这两个指标降级为 warning，不做正式展示。

建议验证：

```bash
git diff --check
git diff --cached --check
```

### PR 4：机构端只读分析 API

前提：

- domain-only 口径已稳定。
- 审计口径补强前，`voidedSummaryBlockedCount` 和 `duplicateSourceTaskConflictCount` 不得作为正式统计指标对外展示。
- 如果 PR 4 仍需暴露这两个指标，只能降级为 warning 口径；如需正式展示，必须先完成作废摘要阻断和重复来源任务冲突的审计补强 PR。
- 用户明确需要真实 API。

建议范围：

- 新增机构端只读分析 API。
- 服务端从 access context 推导 `tenantId`。
- query parser 只接受安全统计窗口参数。
- DTO 只返回聚合指标，不返回客户明细、完整治疗正文、raw audit payload 或 PII。
- 不新增 schema / migration。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests
```

### PR 5：机构端轻量指标展示

前提：

- 只读 API 或安全客户端派生已稳定。
- 产品确认需要展示。

建议范围：

- 机构端新增或复用现有页面的轻量指标摘要。
- 展示模板建议数、人工确认任务数、完成数、超时数、作废阻断数和重复冲突数。
- 不做复杂图表。
- 不做经营智能中心。
- 不做报表导出。
- 不提供自动触达入口。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests
```

### PR 6：smoke / 文档收尾

建议范围：

- workspace smoke 覆盖最小指标展示。
- 覆盖 401 / 403 / 503 / empty 状态。
- 覆盖租户隔离和敏感字段不展示。
- 覆盖不自动触达、不接 AI、不接企微。
- 更新 README、roadmap、devlog 和 Phase 21 文档最终状态。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
```

如触及 Next 页面构建，再补：

```bash
node scripts/run-next.mjs build --webpack
```

## 5. 单独评估门槛

以下能力不能混入 Phase 21 v1 最小实现，必须单独评估：

### 5.1 落库 / API

出现以下需求时，必须新增单独评估：

- 指标需要历史快照。
- 指标需要跨时间趋势。
- 指标需要平台端查询。
- 指标需要报表 API。
- 指标需要给外部系统读取。

### 5.2 图表 UI / 导出

出现以下需求时，必须单独进入 UI 或导出规划：

- 图表组件。
- 大屏或经营智能中心。
- CSV / Excel / PDF 导出。
- 多维筛选和下钻。
- 客户或任务明细列表。

### 5.3 经营归因

出现以下需求时，必须单独进入经营归因规划：

- 路径建议和成交关联。
- 路径任务和复购关联。
- 任务完成率对收入的影响。
- 员工绩效、项目收益或转化漏斗。

### 5.4 HIS / 企微 / AI / 自动触达

出现以下需求时，必须单独 Plan Mode：

- 从 HIS 输入治疗事件。
- 企业微信 / 个人微信 / 短信 / 电话触达。
- AI 分析路径效果。
- RAG 检索 SOP。
- Agent 自动决策。
- 自动生成客户消息或自动回复客户。

## 6. 验收清单

当前 docs-only PR 验收：

- 设计文档说明 Phase 21 只是 Plan Mode。
- 设计文档说明随访路径运营分析 v1 目标。
- 设计文档说明与 Phase 20 路径模板、治疗摘要、来源随访任务、任务状态和审计记录的关系。
- 设计文档覆盖六个最小指标。
- 设计文档明确不做复杂经营智能中心。
- 设计文档明确不做 AI 分析。
- 设计文档明确不做自动触达。
- 设计文档明确不新增 API / schema。
- 计划文档给出后续 PR 拆分。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、UI、测试、schema、migration、demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 7. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须改代码才能完成当前 docs-only PR。
- 必须新增 API。
- 必须改数据库 schema 或 migration。
- 必须改权限、认证或租户隔离。
- 必须接 HIS、企微、短信、电话或其他外部系统。
- 必须接 AI / RAG / Agent。
- 必须自动触达客户。
- 必须导入真实客户数据。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须修改 demo seed 数据。
- 必须做复杂经营智能中心、图表 UI、报表导出或经营归因。

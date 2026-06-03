# Phase 21 随访路径运营分析 v1 设计

> 日期：2026-06-03
> 状态：Phase 21 Plan Mode 文档。本 PR 只做文档规划，不写代码、不改 UI、不改测试、不新增 API、不改数据库 schema / migration、不接 HIS / 企微 / AI，也不做自动触达。

## 0. 本次结论

Phase 21 建议聚焦 **随访路径运营分析 v1**。

它不是新的经营智能中心，也不是 AI 分析能力。它的最小目标是基于现有治疗摘要、Phase 20 路径模板建议、来源随访任务、任务状态和审计记录，先定义一组可解释、可复核、可逐步落地的运营分析口径。

本 PR 只做 Plan Mode：

- 不实现分析页面。
- 不新增报表 API。
- 不新增数据表或字段。
- 不新增 migration。
- 不改现有路径模板、随访建议或来源任务逻辑。
- 不接 HIS、企微、短信、电话、AI、RAG 或 Agent。
- 不做自动触达。
- 不修改 demo seed 数据。

如果后续发现必须新增 schema、API、权限、外部集成、图表 UI、导出或经营归因能力，必须单独评估并重新进入对应 Plan Mode。

## 1. 只读检查结论

本次按要求只读检查了：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-05-31.md`
- `docs/superpowers/specs/2026-06-03-phase20-treatment-path-template-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase20-treatment-path-template-v1.md`
- `src/modules/institution/domain/treatment-path-templates.ts`
- `src/modules/institution/domain/treatment-followup-suggestions.ts`
- `src/modules/institution/domain/followup-workflow.ts`
- `src/modules/institution/domain/treatment-summaries.ts`

已确认的现状：

- Phase 20 v1 已完成最小闭环：治疗摘要结构化字段 -> 路径模板 catalog 匹配 -> 模板驱动随访建议 -> 治疗摘要管理页轻量展示 -> 人工确认创建来源任务 -> 重复来源任务治理 -> 作废摘要阻断。
- 路径模板仍是 domain-only 静态 catalog，不存在模板表、模板 API、路径实例表或租户自定义 SOP。
- 模板建议通过 `ruleKey === "template_path_followup"` 标识，`suggestionKey` 包含来源治疗摘要、模板 key 和节点 key。
- 来源随访任务已有 `source: "treatment_summary"`、`sourceTreatmentSummaryId` 和 `sourceSuggestionKey`，可追踪任务来自哪条治疗摘要和哪条建议。
- 随访任务状态包括 `scheduled`、`due`、`in_progress`、`escalated`、`completed` 和 `cancelled`，并有 `dueAt` 支撑超时口径。
- 治疗摘要已有 `status: "active" | "voided"`，作废摘要会阻断新的随访建议和新的来源任务创建。
- 现有审计能力可作为人工确认、拒绝、冲突和治理事件的追溯来源，但具体 reason / action 名称后续实现前必须重新只读核对，当前文档不新增审计枚举。

因此 Phase 21 不需要从零设计路径模板或随访任务，而应先规划“如何解释现有闭环的运营表现”。

## 2. Phase 21 定位

Phase 21 是 Plan Mode，不是功能实现。

Phase 21 需要回答：

- 随访路径运营分析 v1 要解决什么问题。
- 它如何承接 Phase 20 路径模板、治疗摘要、来源随访任务、任务状态和审计记录。
- 最小分析指标有哪些。
- 哪些指标可以先用现有对象推导，哪些必须依赖审计事件。
- 当前不做哪些复杂能力。
- 后续如果进入实现，应如何拆分 PR，避免一次性进入经营智能中心、自动触达、图表、导出或归因模型。

Phase 21 当前不回答：

- 经营智能中心如何完整建设。
- 路径效果如何做收入、复购、转化归因。
- 是否需要路径实例表。
- 是否要落库历史快照。
- 是否要给平台端或机构端新增报表 API。
- 是否要做图表 UI、报表导出或经营驾驶舱。
- 是否要由 AI 分析路径效果或自动生成建议。

这些问题都必须后续单独评估。

## 3. v1 目标

随访路径运营分析 v1 的目标是提供一组最小、稳定、可解释的分析口径，让机构能回答：

- 有多少治疗摘要命中了路径模板建议。
- 有多少路径模板建议被人工确认成来源随访任务。
- 这些来源任务有多少已完成。
- 有多少来源任务已经超过建议处理时间仍未完成。
- 有多少作废摘要阻断了新的路径建议或来源任务。
- 有多少重复来源任务创建尝试被冲突治理拦住。

v1 只关注“路径建议到人工任务执行”的基础运营链路，不做完整经营归因。

## 4. 和现有能力的关系

### 4.1 和 Phase 20 路径模板的关系

Phase 20 已提供路径模板 catalog 和模板驱动建议。Phase 21 的分析口径应优先识别：

- `ruleKey === "template_path_followup"` 的模板建议。
- `suggestionKey` 中稳定携带的 `templateKey` 和 `nodeKey`。
- `tags` 中的 `路径模板`、模板 key、恢复阶段和建议处理角色。
- 所有模板建议仍必须人工确认，仍禁止自动触达。

Phase 21 不修改路径模板 catalog，不新增模板表，不新增路径实例状态。

### 4.2 和治疗摘要的关系

治疗摘要是路径建议的输入，也是分析分母的重要来源。

v1 只应读取现有安全结构化字段：

| 字段 | 分析用途 |
| --- | --- |
| `id` | 关联模板建议、来源任务和审计事件。 |
| `tenantId` | 仅服务端可信上下文使用，前端不得传入或切换。 |
| `customerId` / `appointmentId` | 只用于同租户关联，不展示客户敏感明细。 |
| `treatmentDate` | 可用于建议节点和统计窗口。 |
| `treatmentProject` / `treatmentCategory` | 解释命中的路径类型。 |
| `treatmentStage` / `recoveryStage` | 解释命中的恢复阶段。 |
| `riskLevel` | 解释优先级和超时风险。 |
| `status` / `voidedAt` | 区分 active 摘要与 voided 摘要。 |

v1 不读取完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文或外部系统 raw payload。

### 4.3 和来源随访任务的关系

来源随访任务是“建议变成行动”的承接对象。

v1 应优先识别：

- `source === "treatment_summary"`
- `sourceTreatmentSummaryId`
- `sourceSuggestionKey`
- `status`
- `dueAt`
- `updatedAt`

任务状态建议解释为：

| 状态 | v1 分析含义 |
| --- | --- |
| `scheduled` | 已创建但未到处理窗口。 |
| `due` | 已到期或待处理。 |
| `in_progress` | 人工处理中。 |
| `escalated` | 已升级处理。 |
| `completed` | 已完成。 |
| `cancelled` | 已取消，不计入完成，但保留来源追溯。 |

超时口径建议在后续实现时使用固定分析时间点计算，避免页面刷新造成数字不稳定。

### 4.4 和审计记录的关系

审计记录用于解释“尝试”和“阻断”，尤其是状态表本身无法表达的行为。

v1 建议将审计记录用于：

- 人工确认创建来源任务的成功记录。
- 重复来源任务创建冲突。
- 作废摘要导致的建议或来源任务阻断。
- 非法来源、跨租户或权限拒绝等治理事件的排除说明。

当前文档不新增审计 reason 或 action。后续实现前必须只读核对现有审计字段、资源、动作和 reason。如果现有审计不能稳定支撑某个指标，应停止并单独评估“审计口径补强”，不得在分析实现 PR 中顺手改审计模型。

## 5. 最小分析指标建议

### 5.1 模板建议数

定义：在统计窗口内，active 治疗摘要生成的 `template_path_followup` 建议数量。

推荐口径：

- 分母来源：当前租户内 active 治疗摘要。
- 分子来源：对 active 治疗摘要按现有确定性建议逻辑派生出的模板建议。
- 只统计 `ruleKey === "template_path_followup"`。
- 不统计作废摘要的新建议。
- 不把非模板规则建议混入，例如风险规则、恢复早期规则、nextCareAction 规则或轻量 fallback。

注意：当前建议不是落库对象。后续如需实现，优先做只读、确定性派生；如需落库建议快照，必须单独评估。

### 5.2 人工确认任务数

定义：模板建议经人工确认后创建出的来源随访任务数量。

推荐口径：

- 任务必须来自 `source === "treatment_summary"`。
- 任务必须有 `sourceTreatmentSummaryId`。
- 任务必须有 `sourceSuggestionKey`。
- 如需严格限定模板建议，可用 `sourceSuggestionKey` 或审计记录确认其来源为 `template_path_followup`。
- 同一来源建议重复确认被冲突治理拦截时，不计入人工确认任务数，应计入重复来源任务冲突数。

### 5.3 任务完成数

定义：来源随访任务中状态为 `completed` 的任务数量。

推荐口径：

- 只统计治疗摘要来源任务。
- 如 v1 要聚焦模板路径，只统计能关联到模板建议 key 的来源任务。
- `cancelled` 不计入完成。
- 任务完成时间如需用于周期分析，应以后续实现时可确认的 `updatedAt` 或审计完成事件为准。

### 5.4 任务超时数

定义：截至固定分析时间点，来源随访任务已过 `dueAt` 但尚未完成的任务数量。

推荐口径：

- `dueAt < analysisAt`。
- `status` 属于 `scheduled`、`due`、`in_progress` 或 `escalated`。
- `completed` 和 `cancelled` 不计入超时。
- `analysisAt` 应由服务端或分析函数传入，避免使用前端本地时间。

后续如需区分轻微超时、严重超时、升级超时，必须另做口径评估。

### 5.5 作废摘要阻断数

定义：因治疗摘要已作废而阻断新的随访建议或来源随访任务创建的次数。

推荐口径：

- 优先来自审计记录中的作废阻断 / denied / conflict 事件。
- 必须能关联到当前租户和目标治疗摘要。
- 只统计已作废摘要触发的阻断，不把普通权限拒绝、目标不存在、非法 suggestionKey 混入。

注意：如果当前审计没有稳定记录作废阻断尝试，后续不得用“voided 摘要数量”替代“阻断次数”。这种情况下应单独评估审计补强或将指标降级为“作废摘要数 / 作废摘要潜在阻断数”。

### 5.6 重复来源任务冲突数

定义：同一治疗摘要来源建议被重复人工确认时，被去重治理拦截的冲突次数。

推荐口径：

- 优先来自人工确认 API 的重复冲突审计记录。
- 必须关联 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey`。
- 不用当前任务表中是否有重复行来推断冲突次数，因为冲突本身通常不会新增任务记录。
- 如审计不能稳定支撑，应单独评估审计补强，而不是在分析实现里新增隐式计数器。

## 6. v1 不做什么

Phase 21 v1 当前不做：

- 不做复杂经营智能中心。
- 不做 AI 分析。
- 不做 AI 生成路径结论。
- 不做 RAG、Agent 或自动决策。
- 不做自动触达。
- 不接 HIS。
- 不接企业微信、个人微信、短信或电话外呼。
- 不新增 API。
- 不新增数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不做图表 UI。
- 不做报表导出。
- 不做收入、复购、转化或经营归因。
- 不修改 demo seed 数据。

## 7. 后续必须单独评估的能力

出现以下任一需求，必须单独评估：

- 指标需要落库历史快照。
- 需要新增报表 API。
- 需要平台端或机构端图表 UI。
- 需要导出 CSV、Excel 或 PDF。
- 需要把模板建议、任务完成和成交 / 复购 / 消费做经营归因。
- 需要路径实例表、路径阶段状态或路径版本治理。
- 需要审计 reason / action 补强。
- 需要接 HIS、企微、短信、电话、AI、RAG 或 Agent。
- 需要自动触达客户或自动回复客户。

## 8. 后续 PR 拆分建议

### PR 1：Phase 21 spec / plan 文档

当前 PR。

范围：

- 新增 Phase 21 设计文档。
- 新增 Phase 21 计划文档。
- 轻量同步 README、roadmap、devlog 状态。

不包含：

- 不写代码。
- 不改 UI。
- 不改测试。
- 不新增 API。
- 不改 schema / migration。
- 不接外部系统。

### PR 2：运营分析口径 domain-only 评估

仅在用户明确进入 Phase 21 实现后进行。

建议范围：

- 定义分析输入类型、统计窗口和 `analysisAt`。
- 定义模板建议数、人工确认任务数、任务完成数、任务超时数、作废摘要阻断数和重复来源任务冲突数的纯函数口径。
- 使用现有治疗摘要、建议、来源任务和审计 DTO 作为输入。
- 不新增 API。
- 不新增数据库 schema。
- 不改 UI。

### PR 3：审计口径核对或补强评估

仅当 PR 2 发现审计无法稳定支撑阻断 / 冲突次数时进行。

建议范围：

- 先只读核对现有 audit resource / action / reason。
- 如果需要新增审计 reason，必须单独规划和测试。
- 不把审计补强混入分析页面或图表实现。

### PR 4：只读分析 API 评估

仅当需要前端真实读取分析结果时进行。

建议范围：

- 单独评估是否新增机构端只读 API。
- API 必须从 access context 推导 `tenantId`。
- 前端不得传入 `tenantId`。
- DTO 只返回聚合数字和安全说明，不返回客户明细、完整治疗正文、PII 或 raw audit payload。

### PR 5：机构端轻量展示评估

仅当只读 API 或现有客户端派生能力稳定后进行。

建议范围：

- 展示最小指标摘要。
- 不做复杂图表。
- 不做经营智能中心。
- 不做导出。
- 不做自动触达入口。

### PR 6：smoke / 文档收尾

建议范围：

- 覆盖指标展示、租户隔离、安全字段边界、无自动触达和敏感字段不展示。
- 同步 README、roadmap、devlog 和 Phase 21 文档最终状态。

## 9. 验收标准

当前 docs-only PR 的验收标准：

- 新增 Phase 21 设计文档。
- 新增 Phase 21 计划文档。
- 文档明确 Phase 21 只是 Plan Mode，不是功能实现。
- 文档说明随访路径运营分析 v1 的目标。
- 文档说明它和 Phase 20 路径模板、治疗摘要、来源随访任务、任务状态和审计记录的关系。
- 文档覆盖最小指标：模板建议数、人工确认任务数、任务完成数、任务超时数、作废摘要阻断数、重复来源任务冲突数。
- 文档明确当前不做复杂经营智能中心。
- 文档明确当前不做 AI 分析。
- 文档明确当前不做自动触达。
- 文档明确当前不新增 API / schema。
- 文档明确后续落库、报表 API、图表 UI、导出或经营归因必须单独评估。
- 文档给出后续 PR 拆分建议。
- 只改 Markdown。
- `git diff --check` 和 `git diff --cached --check` 通过。

## 10. 停止条件

当前 PR 或后续执行中出现以下任一情况，应停止并回报：

- 必须写代码才能完成当前 docs-only PR。
- 必须改 UI。
- 必须改测试。
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

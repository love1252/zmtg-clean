# Phase 15 治疗后护理 / 随访联动 v1 设计

> 日期：2026-05-31
> 状态：Phase 15 已完成。PR 1-5 已完成 spec / plan、确定性建议、来源关联、人工确认 API + UI 联动、workspace smoke 和文档收尾。

## 1. Phase 15 目标

Phase 15 默认选择“治疗后护理 / 随访联动 v1”。目标是在 Phase 12 已完成治疗摘要结构化数据底座、Phase 13 已完成治疗摘要人工录入、Phase 14 已完成机构端治疗摘要只读管理之后，把结构化治疗摘要进一步转化为内部护理 / 随访任务建议。

本阶段 v1 目标：

- 基于结构化治疗摘要字段生成确定性的护理 / 随访任务建议。
- 建议生成只依赖服务端可信字段，不接 AI provider，不做 Agent，不做 RAG 问答。
- 机构人员必须先看到建议内容，再人工确认是否创建结构化随访任务。
- 确认后由服务端创建 `follow_up_tasks` 记录。
- 创建随访任务时保留来源追溯字段，能追到原始治疗摘要和建议 key。
- 创建随访任务时做租户校验、RBAC 校验、去重 / 幂等和审计。
- 不自动触达客户，不发送微信、短信、电话、企微或任何外部消息。

Phase 15 延续当前项目的底线：机构端租户编号只能来自服务端访问上下文；前端不能通过 URL、query、header、body、localStorage 或浏览器状态切换租户；治疗摘要和随访建议只能使用结构化短字段，不能扩大为完整治疗记录正文、完整病历正文、咨询对话全文、图片或文件原文。

## 2. 为什么优先做治疗后护理 / 随访联动 v1

Phase 14 已经把治疗摘要从单个客户详情抽屉推进到跨客户管理视图。下一步最自然的业务承接是让机构人员在查看治疗摘要后，能把“下一步护理建议”转为内部随访任务。

优先做治疗后护理 / 随访联动 v1 的理由：

- 业务价值直接：治疗摘要的 `riskLevel`、`recoveryStage`、`nextCareAction` 本身就是护理 / 随访动作的输入。
- 承接 Phase 14 最顺：治疗摘要管理 UI 已提供跨客户筛选和安全详情，适合承载“查看建议 -> 人工确认 -> 创建任务”。
- 技术范围可控：v1 只做确定性规则、结构化任务和内部写入，不接外部触达渠道。
- 演示闭环更完整：从客户、预约、治疗摘要到随访任务，形成机构端运营闭环。
- 隐私风险低于 RAG：不保存知识库正文、不做 embedding、不把医疗隐私正文交给 AI provider。

## 3. 为什么其他方向后置

### 3.1 治疗摘要编辑能力后置

治疗摘要编辑有明确价值，但它会修改医疗敏感结构化记录，需要额外设计：

- 字段白名单和字段级校验。
- 修改前后值的审计策略。
- 已创建随访任务与摘要修改后的关系。
- 修改后是否重新生成建议、是否影响已确认任务。
- UI 冲突提示和并发编辑策略。

Phase 15 先做治疗后护理 / 随访联动，可以在不改变原摘要内容的前提下产生业务价值。编辑能力应在随访联动边界稳定后单独进入后续阶段。

### 3.2 治疗摘要删除 / 作废能力后置

作废能力会引入数据生命周期语义。即使不做硬删除，也需要明确：

- 作废后治疗摘要是否仍可作为随访任务来源。
- 已创建随访任务是否需要提示来源已作废。
- 作废审计、恢复策略和列表筛选策略。
- 作废与客户时间线、治疗摘要管理页面的展示边界。

Phase 15 v1 不改变治疗摘要生命周期，避免把来源追溯、任务创建和摘要作废混在一个阶段。

### 3.3 知识库 / RAG 基础准备后置

知识库 / RAG 长期价值高，但它是四个方向中隐私风险最高的方向。即使只做基础准备，也容易涉及：

- 文件上传、文件解析或正文保存。
- 医疗资料、咨询记录、治疗说明等敏感正文。
- embedding、检索命中、提示词注入和跨租户隔离。
- 后续 AI provider 调用、日志、成本和安全审计。

Phase 15 明确不接 AI provider、不做 Agent、不做真实 RAG 问答、不保存医疗隐私正文。知识库 / RAG 应在后续独立 Plan Mode 中先解决内容边界和租户隔离，再进入实现。

### 3.4 平台商业化增强后置

Phase 9 到 Phase 11 已完成平台租户管理、套餐配额 enforcement 轻量版和平台商业化健康视图。继续增强平台商业化仍有价值，但它不直接承接 Phase 12 到 Phase 14 的治疗摘要链路。

如果 Phase 15 改做平台商业化，容易滑入套餐购买、套餐变更、续费、支付、合同、发票或更复杂的租户状态管理。当前更适合先完成机构端治疗摘要到随访任务的闭环，再回到平台运营面增强。

## 4. 治疗后护理 / 随访联动 v1 范围

Phase 15 v1 包含：

- 新增治疗摘要到护理 / 随访建议的确定性 domain。
- 新增建议 key、建议 DTO 和输入 parser。
- 新增只读建议 API。
- 新增人工确认创建随访任务 API。
- 为 `follow_up_tasks` 增加来源追溯字段。
- 实现同一来源建议的去重 / 幂等。
- 创建随访任务时写审计。
- 创建随访任务时做访问控制、租户隔离和来源幂等；follow-up 配额 enforcement 记录为 Phase 16 风险。
- 在治疗摘要管理 UI 中展示建议，并允许机构人员人工确认创建。
- 补充 workspace smoke 和文档收尾。

Phase 15 v1 不把建议视为医疗诊断或自动运营指令。建议只是内部任务草案，必须由机构人员确认后才写入随访任务。

## 5. 不纳入本阶段

Phase 15 不做：

- AI provider。
- AI 生成护理建议。
- Agent。
- 真实 RAG 问答。
- 企微。
- 短信。
- 电话外呼。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 自动触达客户。
- 自动发微信。
- 自动发短信。
- 自动电话外呼。
- 自动企微触达。
- 自动推送客户消息。
- 治疗摘要编辑。
- 治疗摘要删除或作废。
- 批量创建随访任务。
- 大规模 UI 重构。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode，不能在 Phase 15 顺手扩大范围。

## 6. 是否创建真实随访任务

推荐 v1 支持“人工确认后创建结构化随访任务”。

推荐流程：

1. 机构人员在治疗摘要管理页打开某条摘要。
2. UI 调用只读建议 API，展示建议内容。
3. 机构人员明确点击确认创建。
4. UI 调用人工确认创建 API。
5. 服务端重新读取治疗摘要并重新计算建议，不信任客户端传回的完整建议内容。
6. 服务端校验访问控制、租户、来源建议、去重 / 幂等后写入 `follow_up_tasks`。
7. 服务端写审计并返回安全 DTO。

不推荐只做“建议展示不创建任务”，因为那会让 Phase 15 无法真正补齐治疗摘要到智能随访的运营闭环。但创建必须是人工确认后的服务端写入，不允许自动创建。

## 7. 确定性建议生成规则

Phase 15 v1 只能基于结构化治疗摘要字段生成建议：

- `riskLevel`
- `recoveryStage`
- `treatmentStage`
- `nextCareAction`
- `treatmentCategory`
- `treatmentDate`

不得使用：

- AI provider。
- Agent。
- RAG 检索结果。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 客户手机号、身份证号、病历号等 PII。

建议 v1 先生成一个 primary suggestion，DTO 使用数组结构，为后续多建议留扩展空间。每条建议必须有稳定 `suggestionKey`。

建议 DTO 字段：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `summaryId` | route param / DB | 治疗摘要 ID |
| `suggestionKey` | 规则生成 | 稳定建议 key，用于幂等 |
| `riskLevel` | `treatment_summaries.riskLevel` | 复用 `normal` / `watch` / `urgent` |
| `journeyId` | `treatmentCategory` 规则映射 | v1 推荐 `treatment_post_care` 或确定性 category 派生值 |
| `stage` | `recoveryStage` / `treatmentStage` | 内部任务阶段文案 |
| `dueAt` | `treatmentDate` + 风险 offset | 只由治疗时间和风险等级推导 |
| `suggestedAction` | `nextCareAction` | 使用结构化下一步护理建议 |
| `sourceFields` | 固定枚举 | 返回使用过的字段名，便于审计和测试 |

推荐规则：

| 条件 | `suggestionKey` | `dueAt` | `stage` | `suggestedAction` |
| --- | --- | --- | --- | --- |
| `riskLevel = urgent` | `treatment_post_care:urgent` | `treatmentDate + 1 day` | `recoveryStage` 优先，否则 `treatmentStage` | `nextCareAction` |
| `riskLevel = watch` | `treatment_post_care:watch` | `treatmentDate + 3 days` | `recoveryStage` 优先，否则 `treatmentStage` | `nextCareAction` |
| `riskLevel = normal` | `treatment_post_care:normal` | `treatmentDate + 7 days` | `recoveryStage` 优先，否则 `treatmentStage` | `nextCareAction` |

`treatmentCategory` 的使用边界：

- v1 可将 `treatmentCategory` 规范化进 `journeyId`，例如 `treatment_post_care` 或 `treatment_post_care:<normalizedCategory>`。
- `journeyId` 必须来自白名单规范化，不能直接把任意用户输入拼入 API 路径、SQL 或外部系统标识。
- v1 不根据 `treatmentCategory` 调外部知识库、外部系统或 AI。

`suggestionKey` 的稳定性：

- v1 推荐 `treatment_post_care:${riskLevel}`。
- 如果 PR 2 决定把 `treatmentCategory` 纳入 key，必须先规范化并有测试覆盖。
- `suggestionKey` 不能包含客户姓名、手机号、身份证号、病历号、摘要正文或 SQL / token / secret 字样。

## 8. 人工确认边界

人工确认是 Phase 15 的核心边界。

必须满足：

- 创建前 UI 必须展示 `stage`、`dueAt`、`riskLevel`、`suggestedAction` 和来源治疗摘要。
- 用户必须主动点击确认按钮。
- `POST` 请求只提交 `suggestionKey`，不提交完整 `suggestedAction` 或任意可写 PII。
- 服务端必须重新生成建议并校验 `suggestionKey` 是否存在。
- 服务端不能信任客户端传回的 `dueAt`、`stage`、`riskLevel` 或 `suggestedAction`。
- 重复确认同一来源建议时返回稳定冲突提示，不创建重复任务。

v1 不提供建议内容自由编辑。若机构人员认为建议不合适，可以取消创建；治疗摘要编辑能力另行后置设计。

## 9. 来源字段设计

如果 Phase 15 v1 支持真实创建随访任务，推荐为 `follow_up_tasks` 增加来源字段：

- `source_treatment_summary_id`
- `source_suggestion_key`

对应 TypeScript 字段：

- `sourceTreatmentSummaryId`
- `sourceSuggestionKey`

设计目的：

- 明确随访任务来自哪条治疗摘要。
- 支持同一来源建议的去重 / 幂等。
- 支持审计和后续 UI 展示“来自治疗摘要”。
- 为后续治疗摘要编辑、作废或追溯提供最小引用关系。

字段边界：

- 两个字段都允许 `null`，避免影响历史随访任务。
- v1 不新增 `source_kind`，因为本阶段来源只支持治疗摘要。
- v1 不把完整治疗摘要正文、治疗记录正文、病历正文或咨询对话全文复制进随访任务。

## 10. 去重 / 幂等规则

推荐稳定规则：

- 同一 `tenantId + sourceTreatmentSummaryId + sourceSuggestionKey` 只能存在一条未完成 / 未取消的来源随访任务。
- 未完成 / 未取消状态包括 `scheduled`、`due`、`in_progress`、`escalated`。
- 终态包括 `completed`、`cancelled`。
- 当同一来源建议已有活跃任务时，重复确认返回 `409 Conflict`。
- 重复确认不能创建重复任务。
- 冲突提示使用稳定文案：`该护理随访任务已存在，请勿重复创建`。

数据库约束推荐：

- 优先使用部分唯一索引约束活跃任务：
  - `tenant_id`
  - `source_treatment_summary_id`
  - `source_suggestion_key`
  - `status not in ('completed', 'cancelled')`
- repository 层仍应先查重并返回稳定业务错误，数据库唯一约束用于兜底并发窗口。

如果实现阶段发现当前 migration 工具不适合表达部分唯一索引，应在 PR 3 中记录理由，并以 repository 事务内查重作为 v1 控制；不能静默允许重复任务。

## 11. follow-up 配额 enforcement 决策

Phase 10 当前只对客户创建和预约创建做数量 enforcement：

- `POST /api/institution/customers`
- `POST /api/institution/appointments`

当前随访任务只有读取和状态流转，没有公开创建 API，因此 Phase 10 未覆盖 follow-up 创建。

Phase 15 如果新增人工确认创建随访任务，就会产生新的 `follow_up_tasks` 记录。设计阶段曾推荐在 Phase 15 v1 的创建 API 中纳入 follow-up 配额 enforcement：

- 创建前读取当前租户 active plan / quota limit。
- 使用 `follow_up_tasks` 按当前 `tenantId` 实时 count。
- 当 `currentFollowUpCount >= maxFollowUps` 时拒绝创建。
- 无 active plan 或无 follow-up quota limit 时 fail closed。
- 拒绝时返回稳定 `409 Conflict`。
- 拒绝时写 denied 审计，reason 推荐新增 `quota_exceeded_followups`，缺少配置继续复用 `missing_active_plan` / `missing_quota_limit`。

最终实现决策：

- Phase 15 PR 3 / PR 4 没有修改 Phase 10 quota enforcement 逻辑。
- 人工确认创建随访任务暂未接入 `maxFollowUps` enforcement。
- 风险已记录：未纳入 enforcement 会让治疗摘要来源的随访任务创建不受套餐 `maxFollowUps` 阻断。
- 建议在 Phase 16 Plan Mode 单独评估 follow-up 配额 enforcement，避免在 Phase 15 收尾阶段扩展套餐逻辑。

## 12. API 路径设计

推荐拆成两个 API，保持读写分离。

### 12.1 只读建议 API

```text
GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions
```

作用：

- 根据当前租户下的治疗摘要生成确定性建议。
- 不写入数据库。
- 不触达客户。
- 不返回 `tenantId`。
- 不返回完整治疗记录正文、完整病历正文、咨询对话全文、图片或文件原文。

权限：

- 需要 `treatment_summary/read_own_tenant`。
- 服务端用 `tenantId + summaryId` 查找摘要。

### 12.2 人工确认创建 API

```text
POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks
```

请求体推荐：

```json
{
  "suggestionKey": "treatment_post_care:watch"
}
```

作用：

- 机构人员人工确认后创建结构化随访任务。
- 服务端重新生成建议并匹配 `suggestionKey`。
- 做访问控制、租户校验、去重 / 幂等。
- 写审计。
- 不触达客户。

权限：

- 需要 `treatment_summary/read_own_tenant`。
- 最终实现未新增 `follow_up/create` 权限模型，沿用现有 `follow_up/update` 访问边界和审计动作。

不推荐把两个 API 合并为一个“POST 即生成并创建”，因为 v1 必须先展示建议内容，再由机构人员人工确认。

## 13. schema / migration 决策

如果 Phase 15 v1 仅展示建议而不创建真实随访任务，可以不新增 schema / migration。

本设计推荐 Phase 15 v1 支持人工确认后创建真实随访任务，因此需要新增 schema / migration：

- 为 `follow_up_tasks` 增加 `source_treatment_summary_id`。
- 为 `follow_up_tasks` 增加 `source_suggestion_key`。
- 增加 `tenant_id + source_treatment_summary_id` 查询索引。
- 增加活跃来源任务的部分唯一索引，或在 migration 不支持时以 repository 层事务内幂等作为 v1 控制。
- 优先保持 `tenantId + sourceTreatmentSummaryId` 的租户内引用校验；如果复合外键需要新增 `treatment_summaries(tenant_id, id)` 唯一约束，应在 PR 3 中一并设计和测试。

本 PR 1 不修改 schema / migration。schema 变更只在后续 PR 3 执行。

## 14. RBAC / access resource 决策

Phase 15 不新增新的 access resource。继续复用：

- `treatment_summary`
- `follow_up`

最终使用的 action：

- 只读建议 API：`treatment_summary/read_own_tenant`
- 人工确认创建 API：`treatment_summary/read_own_tenant` + 现有 `follow_up/update` 访问边界

当前 `tenant_admin` 已具备 `treatment_summary/read_own_tenant`，`follow_up` 目前只有 `read_own_tenant` 和 `update`。最终实现未新增 `follow_up/create`，人工确认创建 API 使用现有 `follow_up/update` 访问边界与审计动作，避免在 Phase 15 PR 4 扩大权限模型主结构。

不新增平台端权限，不允许平台账号创建机构随访任务，不重构认证或租户隔离模型。

## 15. 审计事件设计

推荐审计语义：

| 场景 | resource | action | result | reason |
| --- | --- | --- | --- | --- |
| 读取建议成功 | `treatment_summary` | `read_own_tenant` | `allowed` | `allowed_by_policy` |
| 治疗摘要不存在或不属于租户 | `treatment_summary` | `read_own_tenant` | `denied` | `not_found_or_not_owned` |
| 建议 key 非法 | `follow_up` | `update` | `denied` | `invalid_follow_up_suggestion` |
| 已有活跃来源任务 | `follow_up` | `update` | `denied` | `active_source_follow_up_exists` |
| 创建随访任务成功 | `follow_up` | `update` | `allowed` | `allowed_by_policy` |

最终实现已扩展 `AuditReason` 和审计查询 reason 白名单：

- `invalid_follow_up_suggestion`
- `active_source_follow_up_exists`

未新增 `quota_exceeded_followups`，因为 Phase 15 未改 Phase 10 quota enforcement。

审计事件禁止记录：

- request body。
- 完整 `suggestedAction`。
- 完整治疗摘要正文。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 手机号、身份证号、病历号原文。
- SQL、stack、连接串、token、secret。

## 16. 租户隔离设计

租户隔离规则：

- API 不接受客户端传入的 `tenantId`。
- API 从服务端访问上下文读取 `tenantId`。
- 所有治疗摘要读取必须按 `tenantId + summaryId` 查询。
- 随访任务创建时 `customerId` 必须来自当前租户下的治疗摘要，不能来自客户端请求体。
- `sourceTreatmentSummaryId` 必须指向当前租户内治疗摘要。
- 返回 DTO 不包含 `tenantId`。
- 去重查询必须包含 `tenantId`。
- 审计事件使用服务端上下文中的 `tenantId`。

跨租户安全测试必须覆盖：

- 其他租户的 `summaryId` 不能生成建议。
- 其他租户的 `summaryId` 不能创建随访任务。
- 客户端传 `tenantId`、`customerId`、`dueAt`、`riskLevel`、`suggestedAction` 时不能覆盖服务端计算结果。

## 17. PII / 医疗隐私边界

Phase 15 涉及医疗敏感结构化字段，但不应扩大隐私面。

允许使用：

- `riskLevel`
- `recoveryStage`
- `treatmentStage`
- `nextCareAction`
- `treatmentCategory`
- `treatmentDate`
- `customerId` 作为租户内引用 ID

禁止使用或返回：

- 客户手机号。
- 身份证号。
- 病历号原文。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 外部系统原文。
- API key、OAuth token、webhook secret。

`nextCareAction` 是结构化护理建议字段，不等同于完整治疗正文。UI 展示和审计仍必须避免把它复制进审计事件或错误消息。

## 18. 推荐 PR 拆分

Phase 15 推荐拆成 5 个 PR：

| PR | 范围 | 主要风险 | 验证方式 |
| --- | --- | --- | --- |
| PR 1 | Phase 15 spec / plan 文档 | 文档边界不清导致后续 PR 混入 AI、RAG、外部触达或业务代码 | `git diff --check` |
| PR 2 | 确定性护理 / 随访建议 domain、parser、测试 | 规则不稳定、suggestion key 不幂等、误用敏感字段 | 相关 Vitest、敏感字段扫描、`tsc --noEmit` |
| PR 3 | 来源关联 schema / migration、repository create、幂等 / 去重测试 | migration 影响历史任务、并发重复创建、跨租户来源引用 | schema / repository tests、migration 检查、`tsc --noEmit` |
| PR 4 | 人工确认 API + 治疗摘要管理 UI 联动 | 未经确认创建、客户端覆盖服务端建议、权限或配额遗漏 | API routes tests、UI tests、workspace smoke、`tsc --noEmit` |
| PR 5 | workspace smoke / 文档收尾 | 完成状态与真实实现不一致、README / roadmap / devlog 漏更新 | 全量 Vitest、`tsc --noEmit`、Next build、`git diff --check` |

## 19. 每个 PR 的范围、风险和验证方式

### PR 1：Phase 15 spec / plan 文档

范围：

- 新增本设计文档。
- 新增 Phase 15 实施计划文档。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。

风险：

- 决策未写清，导致后续实现阶段混入 AI、RAG、企微、短信、电话外呼、外部系统或大规模 UI 重构。

验证：

- `git diff --check`

### PR 2：确定性建议 domain、parser、测试

范围：

- 基于治疗摘要结构化字段生成建议。
- 新增 `suggestionKey`、DTO、parser 和敏感字段拒绝测试。
- 不写入随访任务。
- 不新增 UI。
- 不接 AI。

风险：

- 规则引入当前时间导致幂等不稳定。
- `suggestionKey` 包含用户输入或敏感信息。
- parser 接受未知字段或 PII。

验证：

- 建议 domain tests。
- parser tests。
- DTO 白名单和敏感字段扫描。
- `./node_modules/.bin/tsc --noEmit`

### PR 3：来源关联 schema / migration、repository create、幂等 / 去重测试

范围：

- 为 `follow_up_tasks` 增加来源字段。
- 增加来源索引和活跃任务去重策略。
- 新增 repository create 方法。
- 新增幂等 / 去重 / 跨租户测试。
- 不做 UI。

风险：

- migration 影响历史随访任务。
- 缺少 DB 兜底导致并发重复创建。
- 来源治疗摘要跨租户引用。

验证：

- migration / schema 检查。
- repository tests。
- 幂等冲突测试。
- 跨租户引用测试。
- `./node_modules/.bin/tsc --noEmit`

### PR 4：人工确认 API + 治疗摘要管理 UI 联动

范围：

- 新增只读建议 API。
- 新增人工确认创建 API。
- 在治疗摘要管理 UI 展示建议并允许人工确认创建。
- 创建时做访问控制、租户校验、去重 / 幂等和审计。
- 不自动触达客户。

风险：

- UI 在未展示建议时创建任务。
- 客户端传入 `dueAt`、`riskLevel` 或 `suggestedAction` 并覆盖服务端计算结果。
- follow-up quota enforcement 未纳入 Phase 15，后续需要单独评估 `maxFollowUps` 风险。

验证：

- API route tests。
- client tests。
- UI tests。
- audit tests。
- access-control tests。
- workspace smoke。
- `./node_modules/.bin/tsc --noEmit`

### PR 5：workspace smoke / 文档收尾

范围：

- 补 workspace smoke。
- 更新 README、roadmap、devlog。
- 更新 Phase 15 spec / plan 完成状态。
- 标记 Phase 15 完成。

风险：

- 文档声称完成但测试未覆盖。
- smoke 未覆盖敏感字段不展示或不自动触达边界。

验证：

- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`
- `git diff --check`

## 20. 下一步建议

Phase 15 已完成，不继续在本阶段追加业务能力。

已完成范围：

- 确定性护理 / 随访建议规则，基于 `riskLevel`、`recoveryStage`、`treatmentStage`、`nextCareAction`、`treatmentCategory`、`treatmentProject`、`treatmentDate`、`tags` 等结构化字段生成稳定建议。
- `suggestionKey` 稳定生成，便于后续来源去重 / 幂等。
- `follow_up_tasks` 来源关联字段、Drizzle migration / meta、repository create 地基、同租户幂等 / 去重测试。
- `GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions` 只读建议 API。
- `POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks` 人工确认创建 API。
- 治疗摘要管理 UI 中的建议展示、人工确认创建、成功提示和重复确认冲突提示。
- API / UI / workspace smoke / 文档收尾。

最终边界：

- 不接 AI provider。
- 不做 AI 生成护理建议。
- 不做 Agent。
- 不做 RAG。
- 不接企微。
- 不发送短信。
- 不电话外呼。
- 不自动触达客户。
- 不接 HIS / CRM / OTA。
- 不进入 OAuth / Webhook / 支付。
- 不保存完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文或外部系统同步原文。

后续建议进入 Phase 16 Plan Mode，优先重新评估治疗摘要编辑能力 v1、治疗摘要作废能力 v1、follow-up 配额 enforcement、知识库 / RAG 安全基础准备、平台商业化增强、平台租户状态管理和审计高级治理。Phase 16 不应在本阶段分支中实现。

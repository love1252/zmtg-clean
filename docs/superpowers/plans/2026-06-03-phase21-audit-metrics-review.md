# Phase 21 审计口径支撑情况核对

> 日期：2026-06-03
> 状态：Phase 21 PR 3 docs-only 评估。本 PR 只做审计口径核对，不进入实现。

**目标：** 只读核对当前审计事件是否足够支撑 Phase 21 随访路径运营分析 v1 的两个审计依赖指标：`voidedSummaryBlockedCount` 和 `duplicateSourceTaskConflictCount`。

**结论摘要：** 当前已有稳定 reason 可以识别部分场景，但两个指标都只能“部分稳定支撑 / warning 口径”。作废摘要阻断已有来源任务创建阻断 reason，但缺少可关联治疗摘要的 `resourceId`，且随访建议 GET 的作废阻断不写 audit。重复来源任务冲突已有稳定 reason 和已存在 follow-up task 的 `resourceId`，但 audit 事件本身不携带 `sourceTreatmentSummaryId + sourceSuggestionKey`，不能只靠 audit 事件还原来源建议粒度。当前不进入 Phase 21 分析 API / UI 实现；在审计口径补强前，这两个指标不得作为正式统计指标对外展示。

---

## 1. 本次核对范围

本 PR 只做审计口径核对：

- 只读检查当前 Phase 21 spec / plan、Phase 21 PR 2 domain-only 分析口径、audit domain / repository / route / tests。
- 只读核对治疗摘要作废 route / tests。
- 只读核对治疗摘要随访建议 route / tests。
- 只读核对治疗摘要随访任务人工确认 route / tests。
- 新增本评估文档，并轻量同步 Phase 21 plan / devlog 状态。

本 PR 不做：

- 不写代码。
- 不改测试。
- 不改审计模型。
- 不新增 audit reason。
- 不新增 API。
- 不进入 Phase 21 分析 API 实现。
- 不进入 Phase 21 分析 UI 实现。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。
- 不接 HIS。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做自动触达。
- 不做经营智能中心实现。
- 不做图表 UI。
- 不做报表导出。
- 不修改 demo seed 数据。

## 2. Phase 21 当前依赖的审计指标

Phase 21 PR 2 已实现的两个审计依赖指标：

- `voidedSummaryBlockedCount`
  - 用于统计作废治疗摘要导致的随访建议或来源任务创建阻断次数。
  - 不能用 voided 摘要数量替代，因为一个作废摘要可以被阻断 0 次、1 次或多次。
  - 不能用任务表推断，因为被阻断的创建不会产生新任务。
- `duplicateSourceTaskConflictCount`
  - 用于统计同一来源建议重复创建来源随访任务时被冲突治理拦截的次数。
  - 不能用任务表重复行推断，因为去重治理的目标正是避免产生重复 active 来源任务。
  - 不能把普通 409、非法 suggestionKey、跨租户 not found 或权限拒绝算作重复来源任务冲突。

因此，这两个指标必须依赖可识别审计事件，或在审计不足时明确降级为“暂不可稳定计算”，并输出 warning。在审计口径补强前，`voidedSummaryBlockedCount` 和 `duplicateSourceTaskConflictCount` 都只能作为“部分支撑 / warning 口径”，不得作为正式统计指标对外展示。

## 3. 当前已有审计事件核对

### 3.1 作废摘要阻断

已核对位置：

- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts`
- `src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts`

当前已有事实：

- 治疗摘要作废动作本身会写 audit：
  - `resource: "treatment_summary"`
  - `action: "update"`
  - `result: "allowed"`
  - `reason: "treatment_summary_voided"`
  - `resourceId: <treatmentSummaryId>`
- 已作废摘要重复作废会写 audit：
  - `resource: "treatment_summary"`
  - `action: "update"`
  - `result: "allowed"`
  - `reason: "treatment_summary_already_voided"`
  - `resourceId: <treatmentSummaryId>`
- 治疗摘要作废 payload 非法会写 audit：
  - `resource: "treatment_summary"`
  - `action: "update"`
  - `result: "denied"`
  - `reason: "invalid_treatment_summary_void_payload"`
  - `resourceId: <treatmentSummaryId>`

这些事件能说明治疗摘要作废操作，但不能直接代表“作废摘要阻断随访”。

当前作废摘要阻断随访相关事实：

- 随访建议 GET 遇到 voided summary 时返回 409，错误文案为“治疗摘要已作废，不能继续生成随访建议”。
- 该 GET route 当前不写 audit；测试也明确断言不写 audit。
- 来源随访任务人工确认 POST 遇到 voided summary 时返回 409，错误文案为“治疗摘要已作废，不能继续创建来源随访任务”。
- 该 POST route 当前会写稳定 denied audit：
  - `resource: "follow_up"`
  - `action: "update"`
  - `result: "denied"`
  - `reason: "voided_treatment_summary_follow_up_blocked"`
  - `resourceId: null`

可区分性：

- 可以通过 `reason: "voided_treatment_summary_follow_up_blocked"` 区分来源任务创建的作废阻断。
- 可以通过 `reason: "role_denied"` 区分普通权限拒绝。
- 可以通过 `reason: "not_found_or_not_owned"` 区分目标不存在或跨租户。
- 可以通过 `reason: "invalid_follow_up_suggestion"` 区分非法 suggestionKey。

不足：

- 随访建议 GET 的作废阻断没有 audit，不能统计“作废摘要阻断随访建议”的发生次数。
- 来源任务 POST 的作废阻断 audit 不带 `resourceId: <treatmentSummaryId>`，也不带 `sourceTreatmentSummaryId` 或 `sourceSuggestionKey`。
- 当前 audit repository / DTO 只返回安全字段：`resource`、`resourceId`、`action`、`result`、`reason`、`actorId`、`actorRole`、`occurredAt` 等；没有 raw payload，也没有来源建议上下文字段。
- Phase 21 PR 2 domain 口径要求作废阻断事件可关联到 voided summary；当前真实 audit 事件只靠 `reason` 能识别阻断类型，但不能稳定关联具体治疗摘要。

结论：

- 当前只能部分支撑 `voidedSummaryBlockedCount`。
- 如只统计“所有来源任务创建作废阻断尝试”，可以基于 `reason` 粗略计数。
- 如按 Phase 21 PR 2 的安全口径要求关联 voided summary，则当前真实 audit 输入不足，应降级为 warning 或后续补强。

### 3.2 重复来源任务冲突

已核对位置：

- `src/modules/institution/server/tenant-business-repository.ts`
- `src/modules/institution/server/treatment-followup-confirmation.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts`

当前已有事实：

- repository 会按同一 `tenantId + sourceTreatmentSummaryId + sourceSuggestionKey` 查询已有来源任务。
- 如果存在 active 来源任务，返回：
  - `kind: "conflict"`
  - `resourceId: <existingFollowUpTaskId>`
  - `reason: "active_source_follow_up_exists"`
- route 收到 conflict 后返回 409，错误文案为“该护理随访任务已存在，请勿重复创建”。
- route 会写稳定 denied audit：
  - `resource: "follow_up"`
  - `resourceId: <existingFollowUpTaskId>`
  - `action: "update"`
  - `result: "denied"`
  - `reason: "active_source_follow_up_exists"`

可区分性：

- 可以通过 `reason: "active_source_follow_up_exists"` 区分重复来源任务冲突和普通 409。
- 可以通过 `reason: "invalid_follow_up_suggestion"` 区分非法 suggestionKey。
- 可以通过 `reason: "not_found_or_not_owned"` 区分目标不存在或跨租户。
- 可以通过 `reason: "role_denied"` 区分权限拒绝。
- 当前 audit result 没有 `conflict` 枚举；409 conflict 在 audit 中表达为 `result: "denied"` + 稳定 reason。

不足：

- audit 事件的 `resourceId` 指向已存在 follow-up task，不直接指向 treatment summary。
- audit 事件本身不携带 `sourceTreatmentSummaryId` 或 `sourceSuggestionKey`。
- 如仅消费 audit repository DTO，不能只靠 audit 事件证明是哪一个 `sourceTreatmentSummaryId + sourceSuggestionKey` 发生重复。
- 如后续需要 suggestion 粒度统计，需要额外从 `resourceId` 回查 follow-up task，或补强 audit 事件上下文；这必须单独评估，不能在本 PR 顺手实现。

结论：

- 当前可以部分支撑 `duplicateSourceTaskConflictCount`。
- 如只按 `reason: "active_source_follow_up_exists"` 统计重复来源任务冲突次数，口径可稳定区分普通 409。
- 如要求按同一 `sourceTreatmentSummaryId + sourceSuggestionKey` 精确关联，当前 audit 事件不足，应降级或后续补强。

## 4. 当前能否支撑 Phase 21 指标

| 指标 | 当前是否可稳定支撑 | 依赖字段 | 风险 | 建议 |
| --- | --- | --- | --- | --- |
| 作废摘要阻断数 | 部分 | 来源任务 POST audit 的 `resource: "follow_up"`、`result: "denied"`、`reason: "voided_treatment_summary_follow_up_blocked"` | 建议 GET 作废阻断不写 audit；来源任务 POST 阻断 audit 缺少 `resourceId: <treatmentSummaryId>`；无法只靠 audit 事件关联 voided summary。 | 审计补强前只能作为 warning 口径，不得正式对外展示；后续单独 PR 补强作废阻断 audit reason / 关联口径。 |
| 重复来源任务冲突数 | 部分 | 来源任务 POST audit 的 `resource: "follow_up"`、`resourceId: <existingFollowUpTaskId>`、`result: "denied"`、`reason: "active_source_follow_up_exists"` | audit 本身不带 `sourceTreatmentSummaryId + sourceSuggestionKey`；只能关联已存在 follow-up task，不能只靠 audit DTO 还原来源建议粒度。 | 审计补强前只能作为 warning 口径，不得正式对外展示；后续单独 PR 补强重复来源任务冲突 audit reason / 关联口径。 |

## 5. 不足时的降级口径

如果当前审计输入不足，Phase 21 analysis 必须遵守以下降级原则：

- 不得用 voided 摘要数量冒充 `voidedSummaryBlockedCount`。
- 不得用任务表重复行推断 `duplicateSourceTaskConflictCount`。
- 不得把 `treatment_summary_voided` 或 `treatment_summary_already_voided` 当作随访阻断次数。
- 不得把 `not_found_or_not_owned`、`invalid_follow_up_suggestion`、`role_denied` 或普通 409 当作重复来源任务冲突。
- 可以先输出 warning，说明审计事件不足。
- 可以把指标降级为“暂不可稳定计算”，或者在 v1 输出为 0 并配套 warning。
- 在审计口径补强前，`voidedSummaryBlockedCount` 只能作为“部分支撑 / warning 口径”，不得作为正式统计指标对外展示。
- 在审计口径补强前，`duplicateSourceTaskConflictCount` 只能作为“部分支撑 / warning 口径”，不得作为正式统计指标对外展示。
- 当前不进入 Phase 21 分析 API / UI 实现；如果后续 API / UI 阶段需要出现这两个指标，必须先单独做审计补强 PR，或者明确降级为 warning，不做正式展示。
- 如果后续需要稳定计算，必须单独进入补强 PR。

## 6. 后续 PR 建议

如果需要正式展示 `voidedSummaryBlockedCount` 或 `duplicateSourceTaskConflictCount`，不在本 PR 实现，必须先拆为小步补强 PR。Phase 21 下一步应优先选择以下路线之一：

- `PR A：补强作废摘要阻断 audit reason`。
- `PR B：补强重复来源任务冲突 audit reason`。
- 或者在后续 UI / API 阶段先将这两个指标降级为 warning，不做正式展示。

建议拆分：

- PR A：补强作废摘要阻断 audit reason。
  - 至少评估来源任务 POST 的 voided 阻断 audit 是否应写入 `resourceId: <treatmentSummaryId>`。
  - 如需要统计随访建议 GET 的作废阻断，单独评估是否新增稳定 reason，例如只用于“作废摘要阻断随访建议”的 reason。
  - 补充 route tests，确保能区分权限拒绝、not found、非法 suggestionKey 和作废阻断。
- PR B：补强重复来源任务冲突 audit reason。
  - 明确 `resourceId` 指向已存在 follow-up task 是否作为 v1 固定约定。
  - 如需要按来源建议粒度统计，评估从 follow-up task 回查 `sourceTreatmentSummaryId + sourceSuggestionKey`，或补强 audit 上下文。
  - 保持不写 raw payload、不写客户明细、不写完整治疗正文。
- PR C：补充 audit 口径测试。
  - 覆盖两个指标依赖 reason。
  - 覆盖 `resourceId` 关联约定。
  - 覆盖普通 409、权限拒绝、not found 和非法 suggestionKey 不误计。
- PR D：回到 Phase 21 analysis domain 更新口径。
  - 根据补强后的 audit 输入调整 `voidedSummaryBlockedCount` 和 `duplicateSourceTaskConflictCount`。
  - 保持 domain-only、确定性、可测试。
  - 不新增 API、schema、UI 或自动触达。

## 7. 严禁扩大范围

本次审计口径核对不做：

- 不新增 API route。
- 不改现有 API 路径。
- 不改 DTO 字段。
- 不改 UI。
- 不新增图表。
- 不做报表导出。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接 HIS。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做自动触达。
- 不做经营智能中心实现。
- 不做收入、复购、转化归因。
- 不修改 demo seed 数据。

## 8. 验证

docs-only PR 只需运行：

```bash
git diff --check
git diff --cached --check
```

本 PR 不需要跑 Vitest、typecheck 或 Next build，除非误改代码、测试、API、schema 或 UI 文件。

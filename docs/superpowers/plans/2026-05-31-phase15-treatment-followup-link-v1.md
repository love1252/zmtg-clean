# Phase 15 治疗后护理 / 随访联动 v1 实施计划

> 状态：Phase 15 已完成。PR 1-5 已完成 spec / plan、确定性建议、来源关联、人工确认 API + UI 联动、workspace smoke 和文档收尾。

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪；每个 PR 只做本 PR 范围，不顺手进入后续 PR。

**目标：** 基于结构化治疗摘要生成确定性的护理 / 随访任务建议，并在机构人员人工确认后创建结构化随访任务。

**架构方案：** Phase 15 v1 先建立纯 domain 的确定性建议生成能力，再为 `follow_up_tasks` 增加来源追溯字段和幂等创建能力，随后接入只读建议 API、人工确认创建 API 与治疗摘要管理 UI，最后补 workspace smoke 和文档收尾。整个阶段不接 AI provider、不做 Agent、不做 RAG 问答、不自动触达客户。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、PostgreSQL、现有 demo 访问上下文、现有 RBAC / audit / quota enforcement 结构、现有机构端治疗摘要管理 UI。

---

## 当前状态

Phase 14 已完成：

- 治疗摘要列表 API 已完成。
- 机构端治疗摘要管理 UI 已完成。
- 治疗摘要筛选、加载更多和安全详情已完成。
- Phase 14 smoke、README、roadmap、devlog 收尾已完成。
- 当前 main 已同步并通过全量验证。

Phase 15 已完成：

- PR 1：Phase 15 design spec / implementation plan。
- PR 2：确定性护理 / 随访建议 domain、parser / mapper、DTO、`suggestionKey` 稳定生成和测试。
- PR 3：`follow_up_tasks` 来源关联字段、Drizzle migration / meta、repository create 地基、来源幂等 / 去重测试。
- PR 4：只读建议 API、人工确认创建 API、审计封装、client helper、治疗摘要管理 UI 联动和 API / UI / smoke 测试。
- PR 5：workspace smoke 加强、README / roadmap / devlog / Phase 15 spec / plan 文档收尾。
- 当前分支不进入 Phase 16 实现。

## 总边界

Phase 15 做：

- 基于 `riskLevel`、`recoveryStage`、`treatmentStage`、`nextCareAction`、`treatmentCategory`、`treatmentDate` 的确定性建议。
- 只读建议 API。
- 人工确认创建 API。
- 来源追溯字段。
- 去重 / 幂等。
- follow-up 创建配额 enforcement 风险记录；本阶段未改 Phase 10 quota enforcement。
- 租户校验、来源校验和审计。
- 治疗摘要管理 UI 中的建议展示与人工确认创建。
- workspace smoke 和文档收尾。

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
- 批量操作。
- 大规模 UI 重构。

## 文件职责规划

### PR 1：spec / plan 文档

新增：

- `docs/superpowers/specs/2026-05-31-phase15-treatment-followup-link-v1-design.md`
  - Phase 15 目标、方向选择、范围、非目标、确定性建议规则、人工确认边界、来源字段、幂等、配额、API、schema、RBAC、审计、租户隔离、隐私边界和 PR 拆分。
- `docs/superpowers/plans/2026-05-31-phase15-treatment-followup-link-v1.md`
  - 后续 PR 执行计划、文件范围、风险和验证方式。

不修改：

- TypeScript 业务代码。
- React 页面。
- 测试文件。
- API route。
- 数据库 schema / migration。
- 权限、认证或租户隔离。

### PR 2：确定性建议 domain、parser、测试

建议新增：

- `src/modules/institution/domain/treatment-followup-suggestions.ts`
  - 定义 `TreatmentFollowUpSuggestion`、`TreatmentFollowUpSuggestionInput`、`TreatmentFollowUpSuggestionKey`。
  - 基于治疗摘要结构化字段生成 primary suggestion。
  - 输出 `suggestionKey`、`riskLevel`、`journeyId`、`stage`、`dueAt`、`suggestedAction` 和 `sourceFields`。
- `src/modules/institution/server/treatment-followup-suggestion-input.ts`
  - 解析 POST 请求中的 `suggestionKey`。
  - 拒绝未知字段、`tenantId`、`customerId`、`dueAt`、`riskLevel`、`suggestedAction` 和 PII。
- `src/modules/institution/tests/TreatmentFollowUpSuggestions.test.ts`
  - 覆盖 `urgent`、`watch`、`normal` 的 dueAt offset、stage、action 和 key。
  - 覆盖建议生成不依赖当前时间。
  - 覆盖 `suggestionKey` 稳定。
- `src/modules/institution/tests/TreatmentFollowUpSuggestionInput.test.ts`
  - 覆盖 parser 只接受 `suggestionKey`。
  - 覆盖敏感字段和未知字段拒绝。

建议修改：

- `src/modules/institution/domain/treatment-summaries.ts`
  - 如需要，导出供建议 domain 使用的结构化摘要输入类型。

不修改：

- API route。
- UI。
- repository create。
- schema / migration。
- 权限、认证或租户隔离。

### PR 3：来源关联 schema / migration、repository create、幂等 / 去重测试

建议修改：

- `src/server/db/schema.ts`
  - `follow_up_tasks` 增加 `sourceTreatmentSummaryId` / `source_treatment_summary_id`。
  - `follow_up_tasks` 增加 `sourceSuggestionKey` / `source_suggestion_key`。
  - 增加来源查询索引。
  - 增加活跃来源任务去重约束；如果部分唯一索引不适合当前工具链，则在 PR 描述中说明并以 repository 幂等兜底。
- `src/modules/institution/domain/followup-workflow.ts`
  - 扩展 `TenantFollowUpTask` 来源字段。
  - 增加创建来源任务的 domain 类型。
- `src/modules/institution/server/tenant-business-repository.ts` 或现有随访 repository 所在文件
  - 新增 `createFollowUpTaskFromTreatmentSummarySuggestion()`。
  - 创建前按 `tenantId + sourceTreatmentSummaryId + sourceSuggestionKey` 查重。
  - 创建时不从客户端接收 `customerId`、`stage`、`dueAt`、`riskLevel` 或 `suggestedAction`。
- `src/modules/audit/domain/audit-events.ts`
  - 增加 `invalid_follow_up_suggestion`、`active_source_follow_up_exists`。
- `src/modules/audit/domain/audit-event-query.ts`
  - 增加新增 reason 的查询白名单。

建议新增：

- migration SQL 文件。
- `src/modules/institution/tests/TreatmentFollowUpTaskRepository.test.ts`
  - 覆盖创建、来源字段、去重、终态后允许重新创建、跨租户拒绝。
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
  - 覆盖新增 audit reason。

不修改：

- UI。
- API route 行为，除非需要为 repository tests 暴露内部 helper。

### PR 4：人工确认 API + 治疗摘要管理 UI 联动

建议新增：

- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts`
  - `GET` 只读建议 API。
- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
  - `POST` 人工确认创建 API。
- `src/modules/institution/tests/TreatmentFollowUpSuggestionApiRoutes.test.ts`
  - 覆盖 200、400、401、403、404、503、跨租户、DTO 白名单和不写入。
- `src/modules/institution/tests/TreatmentFollowUpTaskCreateApiRoutes.test.ts`
  - 覆盖人工确认创建、重复创建 409、非法 key、跨租户拒绝、审计和敏感字段不返回。

实际边界：

- 未修改 `src/modules/security/domain/access-control.ts`。
- 未新增 `follow_up/create` 权限模型。
- 人工确认创建沿用现有 `follow_up/update` 审计动作和现有访问控制边界。
- 未接入 follow-up quota enforcement，后续进入 Phase 16 Plan Mode 单独评估。

建议修改：

- `src/modules/institution/client/tenant-business-client.ts`
  - 增加 `listTreatmentFollowUpSuggestions()`。
  - 增加 `createFollowUpTaskFromTreatmentSummary()`。
  - POST 只发送 `suggestionKey`。
- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
  - 在摘要安全详情中展示护理 / 随访建议。
  - 创建前展示建议内容。
  - 人工确认后创建任务。
  - 显示 409 重复、403 和 503 稳定状态。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖建议 API 和创建 API 请求体不含 `tenantId`、`customerId`、`dueAt`、`riskLevel`、`suggestedAction`。
- `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
  - 覆盖建议展示、人工确认、重复提示、敏感字段不展示和不自动触达。

不修改：

- 治疗摘要编辑。
- 治疗摘要作废。
- 外部触达渠道。
- AI / RAG。

### PR 5：workspace smoke / 文档收尾

建议修改：

- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 覆盖治疗摘要管理入口中的建议展示和人工确认创建。
  - 覆盖不自动触达客户、不发送外部系统请求、不展示敏感字段。
- `README.md`
  - 标记 Phase 15 完成范围。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 标记 Phase 15 完成，并后置编辑、作废、RAG 和平台商业化增强。
- `docs/devlog/2026-05-31.md`
  - 增加 Phase 15 PR 1-5 执行记录。
- `docs/superpowers/specs/2026-05-31-phase15-treatment-followup-link-v1-design.md`
  - 更新为完成状态。
- `docs/superpowers/plans/2026-05-31-phase15-treatment-followup-link-v1.md`
  - 更新完成摘要和实际边界。

不修改：

- 已完成的核心业务代码，除非 smoke 发现必须修正的缺陷；缺陷修正应保持在 Phase 15 范围内。

## 稳定规则

### 确定性建议规则

输入字段只允许：

- `riskLevel`
- `recoveryStage`
- `treatmentStage`
- `nextCareAction`
- `treatmentCategory`
- `treatmentDate`

推荐规则：

- `urgent`：`suggestionKey = treatment_post_care:urgent`，`dueAt = treatmentDate + 1 day`。
- `watch`：`suggestionKey = treatment_post_care:watch`，`dueAt = treatmentDate + 3 days`。
- `normal`：`suggestionKey = treatment_post_care:normal`，`dueAt = treatmentDate + 7 days`。
- `stage` 优先使用 `recoveryStage`，没有时使用 `treatmentStage`。
- `suggestedAction` 使用 `nextCareAction`。
- `journeyId` 使用白名单规范化后的 `treatmentCategory` 派生值，默认 `treatment_post_care`。

不得在规则中读取当前时间生成 `dueAt`，否则重复调用会导致建议不稳定。

### 人工确认规则

- GET 只展示建议，不写入。
- POST 必须由机构人员点击确认触发。
- POST 请求体只允许 `suggestionKey`。
- 服务端重新计算建议并匹配 `suggestionKey`。
- UI 不能绕过建议展示直接创建。
- 服务端不能信任客户端传入的完整建议内容。

### 去重 / 幂等规则

- 同一 `tenantId + sourceTreatmentSummaryId + sourceSuggestionKey` 只能创建一条未完成 / 未取消的来源随访任务。
- 活跃状态：`scheduled`、`due`、`in_progress`、`escalated`。
- 终态：`completed`、`cancelled`。
- 重复确认返回 `409 Conflict` 和稳定文案：`该护理随访任务已存在，请勿重复创建`。
- repository 查重和数据库约束至少保留一种；推荐两者都做。

### 配额规则

- Phase 10 当前只覆盖客户 / 预约创建。
- Phase 15 新增随访任务创建时，最终未改 Phase 10 quota enforcement。
- 本阶段记录风险：治疗摘要来源的随访任务创建暂未受 `maxFollowUps` 阻断。
- 后续建议在 Phase 16 Plan Mode 单独评估 follow-up quota enforcement，避免在 Phase 15 收尾阶段扩大套餐逻辑。

## PR 1：Phase 15 spec / plan 文档

**范围：**

- 新增 Phase 15 design spec。
- 新增 Phase 15 implementation plan。
- 固化治疗后护理 / 随访联动 v1 方向。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。

**涉及文件：**

- 新增：`docs/superpowers/specs/2026-05-31-phase15-treatment-followup-link-v1-design.md`
- 新增：`docs/superpowers/plans/2026-05-31-phase15-treatment-followup-link-v1.md`

**风险：**

- 文档范围不清，导致后续 PR 混入 AI provider、Agent、RAG、企微、短信、电话外呼、HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件原文、自动触达客户或大规模 UI 重构。

**控制：**

- 明确 Phase 15 v1 只做确定性建议和人工确认创建。
- 明确不自动创建、不自动触达客户。
- 明确 PR 1 只改 Markdown 文档。

- [ ] **步骤 1：确认分支和工作区**

运行：

```bash
git status -sb
git branch --show-current
```

预期：

```text
## docs/phase15-treatment-followup-link-plan
docs/phase15-treatment-followup-link-plan
```

- [ ] **步骤 2：新增 Phase 15 设计文档**

新增 `docs/superpowers/specs/2026-05-31-phase15-treatment-followup-link-v1-design.md`，必须包含：

- Phase 15 目标。
- 为什么优先做治疗后护理 / 随访联动 v1。
- 为什么治疗摘要编辑、作废、RAG、平台商业化增强后置。
- 治疗后护理 / 随访联动 v1 的范围。
- 不纳入本阶段的内容。
- 是否创建真实随访任务。
- 确定性建议生成规则。
- 人工确认边界。
- 来源字段设计。
- 去重 / 幂等规则。
- follow-up 配额 enforcement 是否纳入。
- API 路径设计。
- schema / migration 决策。
- RBAC / access resource 决策。
- 审计事件设计。
- 租户隔离设计。
- PII / 医疗隐私边界。
- 推荐 PR 拆分。
- 每个 PR 的范围、风险和验证方式。

- [ ] **步骤 3：新增 Phase 15 实施计划**

新增 `docs/superpowers/plans/2026-05-31-phase15-treatment-followup-link-v1.md`，必须包含：

- 计划文档标准页首。
- 当前状态。
- 总边界。
- 文件职责规划。
- 稳定规则。
- PR 1 到 PR 5 的范围、风险、控制和验证方式。
- 后续执行 agent 的检查清单。

- [ ] **步骤 4：验证 PR 1**

运行：

```bash
git diff --check
```

本 PR 只改 Markdown 文档，不需要运行完整 Vitest、typecheck 或 Next build。

## PR 2：确定性护理 / 随访建议 domain、parser、测试

**范围：**

- 基于治疗摘要结构化字段生成建议。
- 不写入随访任务。
- 不新增 UI。
- 不接 AI。

**涉及文件：**

- 新增：`src/modules/institution/domain/treatment-followup-suggestions.ts`
- 新增：`src/modules/institution/server/treatment-followup-suggestion-input.ts`
- 新增：`src/modules/institution/tests/TreatmentFollowUpSuggestions.test.ts`
- 新增：`src/modules/institution/tests/TreatmentFollowUpSuggestionInput.test.ts`
- 可能修改：`src/modules/institution/domain/treatment-summaries.ts`

**风险：**

- 建议规则使用当前时间或随机值，导致重复生成不稳定。
- `suggestionKey` 包含用户输入、PII 或敏感正文。
- parser 接受未知字段，导致客户端绕过服务端计算。

**控制：**

- `dueAt` 只由 `treatmentDate + offset` 生成。
- `suggestionKey` 使用固定前缀和白名单枚举。
- POST parser 只接受 `suggestionKey`。
- 敏感字段扫描覆盖 `phone`、`idCard`、`medicalRecord`、`tenantId`、`sql`、`token`、`secret`。

**验证：**

- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentFollowUpSuggestions.test.ts src/modules/institution/tests/TreatmentFollowUpSuggestionInput.test.ts`
- `./node_modules/.bin/tsc --noEmit`
- `git diff --check`

## PR 3：来源关联 schema / migration、repository create、幂等 / 去重测试

**范围：**

- 增加随访任务来源字段。
- 增加来源索引和幂等策略。
- 新增 repository 创建方法。
- 记录 follow-up quota enforcement 后续风险，不改 Phase 10 enforcement。
- 不做 UI。

**涉及文件：**

- 修改：`src/server/db/schema.ts`
- 新增：migration SQL 文件。
- 修改：`src/modules/institution/domain/followup-workflow.ts`
- 修改或新增：随访任务 repository 文件。
- 修改：`src/modules/audit/domain/audit-events.ts`
- 修改：`src/modules/audit/domain/audit-event-query.ts`
- 新增：`src/modules/institution/tests/TreatmentFollowUpTaskRepository.test.ts`
- 修改：`src/modules/audit/tests/AuditEventsDomain.test.ts`

**风险：**

- migration 影响历史随访任务。
- 并发请求绕过去重。
- 来源治疗摘要跨租户引用。
- follow-up quota enforcement 暂未纳入，后续需要单独评估是否接入 `maxFollowUps`。

**控制：**

- 来源字段允许 `null`，兼容历史任务。
- repository 查重必须包含 `tenantId`。
- 优先增加部分唯一索引兜底。
- 创建任务时 `customerId`、`riskLevel`、`stage`、`dueAt`、`suggestedAction` 全部来自服务端生成结果。
- PR 描述和收尾文档记录 follow-up quota enforcement 未纳入 Phase 15。

**验证：**

- `node scripts/run-vitest.mjs run src/modules/institution/tests src/server/db/tests src/modules/audit/tests`
- `./node_modules/.bin/tsc --noEmit`
- `git diff --check`

## PR 4：人工确认 API + 治疗摘要管理 UI 联动

**范围：**

- 新增只读建议 API。
- 新增人工确认创建 API。
- 治疗摘要管理 UI 展示建议。
- 人工确认后创建随访任务。
- 不自动触达客户。

**涉及文件：**

- 新增：`src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts`
- 新增：`src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
- 修改：`src/modules/institution/client/tenant-business-client.ts`
- 修改：`src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
- 新增：`src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts`
- 修改：`src/modules/institution/tests/TenantBusinessClient.test.ts`
- 修改：`src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`

**风险：**

- UI 未展示建议就允许创建。
- POST 允许客户端覆盖服务端建议字段。
- 访问控制边界被误改或扩大。
- 审计记录包含敏感正文。
- 重复确认创建重复任务。

**控制：**

- UI 只有在建议成功加载后显示确认按钮。
- POST 请求体只允许 `suggestionKey`。
- API 服务端重新计算建议。
- 创建前检查 `treatment_summary/read_own_tenant` 和现有 `follow_up/update` 访问边界。
- 审计只记录资源、动作、结果和 reason，不记录 request body。

**验证：**

- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
- `./node_modules/.bin/tsc --noEmit`
- `git diff --check`

## PR 5：workspace smoke / 文档收尾

**范围：**

- 补 workspace smoke。
- 更新 README / roadmap / devlog。
- 更新 Phase 15 spec / plan 完成状态。
- 标记 Phase 15 完成。

**涉及文件：**

- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase15-treatment-followup-link-v1-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase15-treatment-followup-link-v1.md`

**风险：**

- README / roadmap / devlog 声称完成但实际测试未覆盖。
- smoke 没覆盖不自动触达客户。
- smoke 没覆盖敏感字段不展示。

**控制：**

- smoke 覆盖机构端治疗摘要入口、建议展示、人工确认、重复提示和敏感字段不展示。
- 文档明确 Phase 15 仍不包含 AI、RAG、企微、短信、电话外呼和外部系统。

**验证：**

- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`
- `git diff --check`

## 后续执行检查清单

- [x] PR 2 不写入 `follow_up_tasks`。
- [x] PR 2 不新增 UI。
- [x] PR 2 不接 AI。
- [x] PR 3 来源字段允许历史任务为 `null`。
- [x] PR 3 去重包含 `tenantId`。
- [x] PR 3 未改 Phase 10 quota enforcement，follow-up quota enforcement 记录为后续风险。
- [x] PR 4 GET 建议 API 不写入。
- [x] PR 4 POST 创建 API 只接受 `suggestionKey`。
- [x] PR 4 UI 必须先展示建议再允许确认。
- [x] PR 4 不自动触达客户。
- [x] PR 4 审计不记录 request body 或敏感正文。
- [x] PR 5 全量验证通过后标记 Phase 15 完成。

## Phase 15 最终状态

- Phase 15 已完成。
- 已完成确定性护理 / 随访建议规则。
- 已完成 `follow_up_tasks` 来源关联和幂等 / 去重。
- 已完成人工确认 API。
- 已完成治疗摘要管理 UI 联动。
- 已完成 workspace smoke / 文档收尾。
- 未进入 AI provider、AI 生成护理建议、Agent、RAG、企微、短信、电话外呼、自动触达客户、HIS / CRM / OTA、OAuth / Webhook / 支付、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件原文或外部系统同步。

## Phase 16 建议

后续建议进入 Phase 16 Plan Mode，优先重新评估治疗摘要编辑能力 v1、治疗摘要作废能力 v1、follow-up 配额 enforcement、知识库 / RAG 安全基础准备、平台商业化增强、平台租户状态管理和审计高级治理。当前不进入 Phase 16 实现。

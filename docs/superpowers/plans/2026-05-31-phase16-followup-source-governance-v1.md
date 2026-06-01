# Phase 16 随访任务来源治理增强 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 日期：2026-05-31
> 状态：Phase 16 PR 1 规划文档。当前 PR 只新增 spec / plan，不进入业务代码开发。

**Goal:** 补齐 Phase 15 之后的随访任务来源治理能力，让机构端能按治疗摘要来源筛选随访任务、查看来源标签，并在治疗摘要管理页看到同来源活跃任务的只读重复提示。

**Architecture:** Phase 16 v1 复用 Phase 15 已落库的 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey`，优先扩展现有 `GET /api/institution/followups`，在后端加入 query 白名单和当前租户内来源筛选，再由机构端 UI 展示来源标签和 duplicate hint。整个阶段不新增 schema / migration，不接外部触达，不修改治疗摘要生命周期。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、PostgreSQL、现有 demo access context、现有 RBAC / audit、现有机构端智能随访与治疗摘要管理 UI。

---

## 当前状态

Phase 15 已完成：

- 治疗摘要随访建议 domain。
- `GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions`。
- `POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks`。
- `follow_up_tasks.source_treatment_summary_id`。
- `follow_up_tasks.source_suggestion_key`。
- 同一 `tenantId + sourceTreatmentSummaryId + sourceSuggestionKey` 的活跃任务去重 / 幂等。
- 治疗摘要管理页中的建议展示与人工确认创建。
- Phase 15 smoke 和文档收尾。

Phase 16 PR 1 只创建文档，不修改：

- 业务代码。
- React 页面。
- 测试文件。
- API route。
- 数据库 schema / migration。
- 权限、认证或租户隔离。

## 总边界

Phase 16 v1 做：

- 扩展 `GET /api/institution/followups` 查询白名单。
- 支持 `source=treatment_summary`。
- 支持 `sourceTreatmentSummaryId`。
- 随访列表展示治疗摘要来源标签。
- 治疗摘要管理页展示同来源活跃任务 duplicate hint。
- 补充 API / repository / client / UI / smoke 测试。
- 文档收尾并给出 Phase 17 建议。

Phase 16 v1 不做：

- 自动创建随访任务。
- 自动触达客户。
- 企业微信触达。
- 短信发送。
- 电话外呼。
- AI provider。
- AI 生成护理建议。
- Agent。
- RAG / 知识库真实能力。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 治疗摘要编辑。
- 治疗摘要作废。
- 删除或批量操作。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 大规模 UI 重构。

## 文件职责规划

### PR 1：spec / plan 文档

新增：

- `docs/superpowers/specs/2026-05-31-phase16-followup-source-governance-v1-design.md`
  - Phase 16 决策、目标、范围、非目标、来源筛选、source 字段白名单、来源标签、duplicate hint、DTO 边界、租户隔离、隐私边界、API / schema 策略和 PR 拆分。
- `docs/superpowers/plans/2026-05-31-phase16-followup-source-governance-v1.md`
  - 后续 PR 执行计划、文件范围、风险和验证方式。

不修改：

- `src/**`
- `README.md`
- `docs/roadmap/**`
- `docs/devlog/**`
- migration 文件。
- package 或 lock 文件。

### PR 2：后端 follow-up 来源筛选、DTO、安全查询、API 测试

建议新增：

- `src/modules/institution/server/follow-up-task-query-parser.ts`
  - 解析 `GET /api/institution/followups` 的 query。
  - 白名单只允许 `source` 和 `sourceTreatmentSummaryId`。
  - 拒绝 `tenantId`、未知参数、重复参数和格式不正确的 ID。
- `src/modules/institution/tests/FollowUpTaskQueryParser.test.ts`
  - 覆盖 query parser 的成功和拒绝路径。

建议修改：

- `src/app/api/institution/followups/route.ts`
  - 将 `request.url` 传入 query parser。
  - `GET` 继续使用 access context 中的 `tenantId`。
  - parser 失败返回 `400`。
  - read audit 保持 `follow_up/read_own_tenant`。
- `src/modules/institution/server/tenant-business-api.ts`
  - 如现有 list helper 不支持 query input，可扩展 list handler，或在 route 内完成授权后直接调用 repository。
  - 不改变 `PATCH /api/institution/followups`。
- `src/modules/institution/server/tenant-business-repository.ts`
  - 增加带筛选的 follow-up list 方法，或扩展 `listFollowUpTasksByTenant` 接收 filters。
  - 查询必须始终包含 `eq(followUpTasks.tenantId, tenantId)`。
  - `source=treatment_summary` 过滤来源字段非空。
  - `sourceTreatmentSummaryId` 过滤当前租户内来源摘要 ID。
  - 跨租户 / 不存在来源统一返回空列表。
  - mapper 返回安全来源字段。
- `src/modules/institution/domain/followup-workflow.ts`
  - 扩展 `TenantFollowUpTask` 或新增 safe DTO 类型，包含 `sourceType`、`sourceTreatmentSummaryId`、`sourceSuggestionKey`。
  - 普通任务来源字段为 `null`，治疗摘要来源任务为对应字段。
- `src/modules/institution/client/tenant-business-client.ts`
  - 扩展 `listFollowUpTasks()` 支持白名单 query。
  - client 不接受或发送 `tenantId`。
- `src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`
  - 覆盖 `source=treatment_summary`。
  - 覆盖 `sourceTreatmentSummaryId`。
  - 覆盖 `tenantId` query 返回 `400`。
  - 覆盖跨租户来源返回空列表。
  - 覆盖 DTO 不返回治疗摘要正文、病历正文、咨询全文或新增 PII。
- `src/modules/institution/tests/TenantBusinessRepository.test.ts`
  - 覆盖当前租户来源筛选。
  - 覆盖普通任务不被 `source=treatment_summary` 返回。
  - 覆盖 `sourceTreatmentSummaryId` 不跨租户。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖 client 只发送白名单 query。
  - 覆盖 client 不发送 `tenantId`。

不修改：

- React UI。
- schema / migration。
- 权限模型。
- Phase 15 人工确认创建 API。

### PR 3：机构端随访列表来源展示、治疗摘要页重复任务提示、前端测试

建议修改：

- `src/modules/institution/components/SmartFollowUpShell.tsx`
  - 增加来源筛选控件。
  - 支持选择全部 / 治疗摘要来源。
  - 列表展示“来自治疗摘要”标签。
  - 普通任务不显示治疗摘要来源标签。
  - 筛选请求只发送 `source=treatment_summary`，不发送 `tenantId`。
- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
  - 打开摘要详情并加载建议后，按当前摘要 `id` 查询同来源任务。
  - 将返回任务按 `sourceSuggestionKey` 与建议匹配。
  - 对活跃状态显示 duplicate hint。
  - duplicate hint 只读，不自动创建任务，不自动触达客户。
  - 服务端 `409 Conflict` 仍作为最终兜底。
- `src/modules/institution/client/tenant-business-client.ts`
  - 如果 PR 2 未完成 source query helper，在 PR 3 补齐治疗摘要详情页需要的读取 helper。
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - 覆盖智能随访来源筛选。
  - 覆盖来源标签展示。
  - 覆盖普通任务不展示治疗摘要来源标签。
- `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
  - 覆盖活跃任务 duplicate hint。
  - 覆盖 `completed` / `cancelled` 不算阻断重复。
  - 覆盖 hint 不触发 POST 创建。
  - 覆盖 hint 不展示完整治疗摘要正文、病历正文、咨询全文或 PII。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖 UI 依赖的 source query 请求体 / query 安全。

不修改：

- follow-up 状态机。
- 外部触达。
- 治疗摘要编辑。
- 治疗摘要作废。
- schema / migration。

### PR 4：smoke / 文档收尾

建议修改：

- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 覆盖机构工作台能进入智能随访并看到来源标签。
  - 覆盖治疗摘要管理页 duplicate hint。
  - 覆盖不自动触达客户。
  - 覆盖不展示敏感字段。
- `README.md`
  - 标记 Phase 16 完成范围。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 标记 Phase 16 完成，并后置治疗摘要编辑、作废、RAG。
- `docs/devlog/2026-05-31.md`
  - 增加 Phase 16 PR 1-4 执行记录。
- `docs/superpowers/specs/2026-05-31-phase16-followup-source-governance-v1-design.md`
  - 更新为完成状态。
- `docs/superpowers/plans/2026-05-31-phase16-followup-source-governance-v1.md`
  - 更新完成摘要、实际边界和验证结果。

不修改：

- 已完成的核心业务代码，除非 smoke 暴露 Phase 16 范围内的缺陷；缺陷修正必须保持在 Phase 16 来源治理边界内。

## 稳定规则

### source query 规则

允许：

- `GET /api/institution/followups`
- `GET /api/institution/followups?source=treatment_summary`
- `GET /api/institution/followups?sourceTreatmentSummaryId=trt_001`
- `GET /api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_001`

拒绝：

- `tenantId`
- `customerName`
- `phoneNumber`
- `medicalRecordNo`
- `include`
- `fields`
- `metadata`
- `source=ai`
- `source=wechat`
- 重复参数。
- 任意未列入白名单的参数。

### source DTO 规则

来源字段只允许：

- `sourceType`
- `sourceTreatmentSummaryId`
- `sourceSuggestionKey`

普通任务：

- `sourceType = null`
- `sourceTreatmentSummaryId = null`
- `sourceSuggestionKey = null`

治疗摘要来源任务：

- `sourceType = 'treatment_summary'`
- `sourceTreatmentSummaryId = '<summary id>'`
- `sourceSuggestionKey = '<suggestion key>'`

不得返回：

- `tenantId`
- 完整治疗摘要正文。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 客户手机号、身份证号、病历号原文。
- AI / RAG / 外部系统 payload。

### duplicate hint 规则

活跃任务状态：

- `scheduled`
- `due`
- `in_progress`
- `escalated`

终态：

- `completed`
- `cancelled`

判断：

- 同一 `tenantId + sourceTreatmentSummaryId + sourceSuggestionKey` 存在活跃任务时，显示 duplicate hint。
- 只有终态任务时，不算阻断重复；可显示历史信息，但不禁用服务端允许的重新创建。
- duplicate hint 不自动创建任务。
- duplicate hint 不自动触达客户。
- duplicate hint 不能替代服务端 `409 Conflict` 幂等兜底。

### schema / migration 规则

- Phase 16 v1 默认不新增 schema / migration。
- 复用 Phase 15 的 `source_treatment_summary_id` 和 `source_suggestion_key`。
- 如果实现阶段发现索引不足，只记录后续优化，不在 PR 1 中实现。
- 不新增 `source_type` 持久化字段。
- 不新增治疗摘要状态字段。
- 不新增知识库表。

## PR 1：Phase 16 spec / plan 文档

**范围：**

- 新增 Phase 16 design spec。
- 新增 Phase 16 implementation plan。
- 不改代码、不改 API、不改数据库、不改权限。

**步骤：**

- [x] **Step 1: 从最新 `main` 创建文档分支**

  Run:

  ```bash
  git fetch origin main
  git pull --ff-only origin main
  git switch -c docs/phase16-followup-source-governance-plan
  ```

  Expected: 分支为 `docs/phase16-followup-source-governance-plan`，工作区干净。

- [x] **Step 2: 新增 design spec**

  Create:

  ```text
  docs/superpowers/specs/2026-05-31-phase16-followup-source-governance-v1-design.md
  ```

  内容必须覆盖 Phase 16 目标、方向选择、后置能力、来源筛选、source 字段白名单、来源标签、duplicate hint、DTO 边界、租户隔离、PII 边界、API / schema 策略和 PR 拆分。

- [x] **Step 3: 新增 implementation plan**

  Create:

  ```text
  docs/superpowers/plans/2026-05-31-phase16-followup-source-governance-v1.md
  ```

  内容必须覆盖 PR 1-4 的文件范围、风险和验证方式。

- [ ] **Step 4: 验证 Markdown diff**

  Run:

  ```bash
  git diff --check
  ```

  Expected: exit 0，无 trailing whitespace 或 conflict marker。

- [ ] **Step 5: 审阅 diff 只包含两份文档**

  Run:

  ```bash
  git status -sb
  git diff --stat
  ```

  Expected: 只新增本计划列出的两份 Markdown 文件。

- [ ] **Step 6: 提交 PR 1**

  Run:

  ```bash
  git add docs/superpowers/specs/2026-05-31-phase16-followup-source-governance-v1-design.md docs/superpowers/plans/2026-05-31-phase16-followup-source-governance-v1.md
  git commit -m "docs: 固化 Phase 16 随访来源治理计划"
  ```

  Expected: 生成一个只包含两份 Markdown 的 commit。

- [ ] **Step 7: 推送并创建 Draft PR**

  Run:

  ```bash
  git push -u origin docs/phase16-followup-source-governance-plan
  gh pr create --draft --title "docs: 固化 Phase 16 随访来源治理计划" --body-file <body-file>
  ```

  Expected: Draft PR 指向 `main`，不自动合并。

**风险：**

- 低。主要风险是文档写得过宽，导致后续 PR 误进入治疗摘要编辑、作废、AI、RAG 或外部触达。

**验证：**

- `git diff --check`
- 人工确认 `git diff --stat` 只包含两份 Markdown。

## PR 2：后端 follow-up 来源筛选、DTO、安全查询、API 测试

**范围：**

- 扩展 `GET /api/institution/followups`。
- 增加 `source` / `sourceTreatmentSummaryId` 白名单筛选。
- 返回安全来源字段。
- 不做 UI。

**步骤：**

- [ ] **Step 1: 编写 query parser 测试**

  Test:

  ```text
  src/modules/institution/tests/FollowUpTaskQueryParser.test.ts
  ```

  必须覆盖：

  - 空 query。
  - `source=treatment_summary`。
  - `sourceTreatmentSummaryId=trt_001`。
  - `source=treatment_summary&sourceTreatmentSummaryId=trt_001`。
  - `tenantId` 拒绝。
  - `source=ai` 拒绝。
  - 未知参数拒绝。
  - 重复参数拒绝。

- [ ] **Step 2: 实现 query parser**

  Create:

  ```text
  src/modules/institution/server/follow-up-task-query-parser.ts
  ```

  parser 输出建议：

  ```ts
  type FollowUpTaskListQuery = {
    source: 'treatment_summary' | null;
    sourceTreatmentSummaryId: string | null;
  };
  ```

- [ ] **Step 3: 编写 repository 来源筛选测试**

  Modify:

  ```text
  src/modules/institution/tests/TenantBusinessRepository.test.ts
  ```

  必须覆盖：

  - 当前租户来源任务可被筛出。
  - 普通任务不会出现在 `source=treatment_summary` 结果中。
  - `sourceTreatmentSummaryId` 只筛当前租户。
  - 其他租户相同 ID 或其他来源不泄漏。

- [ ] **Step 4: 实现 repository 来源筛选**

  Modify:

  ```text
  src/modules/institution/server/tenant-business-repository.ts
  ```

  查询必须始终绑定 `tenantId`。不得先查全量再在 API 层按跨租户字段过滤。

- [ ] **Step 5: 编写 DTO / domain 测试**

  Modify:

  ```text
  src/modules/institution/tests/TenantBusinessDomain.test.ts
  ```

  或补充到现有更合适的 domain 测试中。覆盖普通任务 source 字段为 `null`，治疗摘要来源任务 source 字段为白名单值。

- [ ] **Step 6: 扩展 follow-up DTO 类型**

  Modify:

  ```text
  src/modules/institution/domain/followup-workflow.ts
  ```

  不新增医疗正文字段，不新增 PII 字段。

- [ ] **Step 7: 编写 API route 测试**

  Modify:

  ```text
  src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
  ```

  必须覆盖：

  - `GET /api/institution/followups?source=treatment_summary`。
  - `GET /api/institution/followups?sourceTreatmentSummaryId=...`。
  - `tenantId` 返回 `400`。
  - 未登录返回 `401`。
  - 无权限返回 `403`。
  - 跨租户来源返回空列表。
  - DTO 不包含完整治疗摘要正文、完整病历正文、咨询全文或新增 PII。

- [ ] **Step 8: 实现 API route 接入**

  Modify:

  ```text
  src/app/api/institution/followups/route.ts
  src/modules/institution/server/tenant-business-api.ts
  ```

  如不需要改 list helper，可在 route 内完成 parser 并传递 filters。不得修改 `PATCH` 语义。

- [ ] **Step 9: 编写 client 测试**

  Modify:

  ```text
  src/modules/institution/tests/TenantBusinessClient.test.ts
  ```

  覆盖 client 只发送 `source` / `sourceTreatmentSummaryId`，不发送 `tenantId`。

- [ ] **Step 10: 实现 client helper**

  Modify:

  ```text
  src/modules/institution/client/tenant-business-client.ts
  ```

  保持 query 白名单，拒绝或忽略非白名单字段。

- [ ] **Step 11: 运行 PR 2 验证**

  Run:

  ```bash
  node scripts/run-vitest.mjs run src/modules/institution/tests/FollowUpTaskQueryParser.test.ts src/modules/institution/tests/TenantBusinessRepository.test.ts src/modules/institution/tests/TenantBusinessApiRoutes.test.ts src/modules/institution/tests/TenantBusinessClient.test.ts
  ./node_modules/.bin/tsc --noEmit
  ```

  Expected: tests pass，typecheck pass。

**风险：**

- Query parser 与现有 list helper 的接口需要小心扩展。
- DTO 如果收敛历史字段，可能影响现有 UI 测试。
- 跨租户来源查询必须返回空列表，不能返回可探测错误。

## PR 3：机构端随访列表来源展示、治疗摘要页重复任务提示、前端测试

**范围：**

- 智能随访列表来源筛选。
- 随访任务来源标签。
- 治疗摘要管理页 duplicate hint。
- 不做自动触达。
- 不做复杂工作流。

**步骤：**

- [ ] **Step 1: 编写智能随访 UI 测试**

  Modify:

  ```text
  src/modules/institution/tests/InstitutionBusinessShells.test.tsx
  ```

  覆盖：

  - 默认加载全部随访任务。
  - 选择治疗摘要来源后请求 `source=treatment_summary`。
  - 治疗摘要来源任务展示“来自治疗摘要”。
  - 普通任务不展示治疗摘要来源标签。
  - UI 不展示完整治疗摘要正文、完整病历正文、咨询全文或 PII。

- [ ] **Step 2: 实现智能随访来源筛选和标签**

  Modify:

  ```text
  src/modules/institution/components/SmartFollowUpShell.tsx
  ```

  使用现有设计系统和页面状态。筛选控件保持轻量，不引入大规模 UI 重构。

- [ ] **Step 3: 编写治疗摘要 duplicate hint 测试**

  Modify:

  ```text
  src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx
  ```

  覆盖：

  - 活跃同来源任务显示提示。
  - `completed` / `cancelled` 不算活跃重复。
  - 提示不自动调用 `POST /follow-up-tasks`。
  - 提示不自动触达客户。
  - 服务端 `409 Conflict` 仍有稳定提示。

- [ ] **Step 4: 实现治疗摘要管理页 duplicate hint**

  Modify:

  ```text
  src/modules/institution/components/TreatmentSummaryManagementShell.tsx
  ```

  建议根据当前摘要 ID 调用 `GET /api/institution/followups?sourceTreatmentSummaryId=<summaryId>`，再按 `sourceSuggestionKey` 匹配当前建议。

- [ ] **Step 5: 补 client 测试和 helper 调整**

  Modify:

  ```text
  src/modules/institution/tests/TenantBusinessClient.test.ts
  src/modules/institution/client/tenant-business-client.ts
  ```

  若 PR 2 的 helper 已满足 UI 使用，则本步骤只补 UI 使用场景测试。

- [ ] **Step 6: 运行 PR 3 验证**

  Run:

  ```bash
  node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx src/modules/institution/tests/TenantBusinessClient.test.ts
  ./node_modules/.bin/tsc --noEmit
  ```

  Expected: tests pass，typecheck pass。

**风险：**

- UI 状态组合增加，加载态、空态、错误态和 duplicate hint 需要清晰分层。
- 确认按钮禁用策略不能替代服务端幂等。
- 不要把来源标签做成治疗摘要详情展开，以免泄漏正文。

## PR 4：smoke / 文档收尾

**范围：**

- workspace smoke。
- README / roadmap / devlog。
- Phase 16 spec / plan 完成状态。
- Phase 17 建议。

**步骤：**

- [ ] **Step 1: 编写 workspace smoke 测试**

  Modify:

  ```text
  src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
  ```

  覆盖：

  - 机构工作台进入智能随访。
  - 智能随访展示治疗摘要来源标签。
  - 治疗摘要管理页展示 duplicate hint。
  - 不自动触达客户。
  - 不展示完整治疗摘要正文、病历正文、咨询全文、图片 / 文件原文或新增 PII。

- [ ] **Step 2: 更新 README**

  Modify:

  ```text
  README.md
  ```

  标记 Phase 16 已完成，并明确完成范围只包含来源治理增强。

- [ ] **Step 3: 更新 roadmap**

  Modify:

  ```text
  docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md
  ```

  标记 Phase 16 完成，治疗摘要编辑、作废、RAG 继续后置。

- [ ] **Step 4: 更新 devlog**

  Modify:

  ```text
  docs/devlog/2026-05-31.md
  ```

  记录 Phase 16 PR 1-4。

- [ ] **Step 5: 更新 Phase 16 spec / plan 状态**

  Modify:

  ```text
  docs/superpowers/specs/2026-05-31-phase16-followup-source-governance-v1-design.md
  docs/superpowers/plans/2026-05-31-phase16-followup-source-governance-v1.md
  ```

  将状态从规划更新为已完成，补实际边界和验证结果。

- [ ] **Step 6: 运行 PR 4 全量验证**

  Run:

  ```bash
  node scripts/run-vitest.mjs run
  ./node_modules/.bin/tsc --noEmit
  node scripts/run-next.mjs build --webpack
  ```

  Expected: vitest pass，typecheck pass，Next build pass。

**风险：**

- 文档收尾不能声明未实现的治疗摘要编辑、作废、AI、RAG 或外部触达能力。
- smoke 不能依赖真实外部服务。

## Phase 17 建议

Phase 16 完成后，推荐 Phase 17 优先重新评估：

1. 治疗摘要编辑能力 v1。
2. 治疗摘要作废能力 v1。
3. follow-up 创建配额 enforcement 是否应覆盖治疗摘要来源任务。
4. 知识库 / RAG 继续独立 Plan Mode，不能直接进入实现。

如果 Phase 17 选择治疗摘要编辑，应先定义字段白名单、审计、并发策略和“编辑后是否影响已有来源随访任务”的边界。

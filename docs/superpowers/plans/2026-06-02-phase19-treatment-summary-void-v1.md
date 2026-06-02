# Phase 19 治疗摘要作废能力 v1 实施计划

> **给自主执行协作者：** 执行本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，并按任务逐项推进。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 为机构端提供治疗摘要软作废能力，保留历史可追溯，写审计，并阻断作废摘要继续生成新的随访建议或来源随访任务。

**架构：** Phase 19 v1 在 `treatment_summaries` 上新增最小生命周期字段，由 repository 以 `tenantId + summaryId` 执行软作废，API 使用 `POST /api/institution/treatment-summaries/[summaryId]/void` 表达业务命令。列表、详情、客户时间线和随访来源展示只读取安全 DTO；作废后的摘要继续保留历史展示，但不再作为后续运营依据。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、PostgreSQL、现有 demo access context、现有 audit repository、现有 Institution workspace。

---

## 0. 当前 PR 状态

Phase 19 已完成。本计划已通过 PR 1 到 PR 5 落地：

- PR 1：spec / plan 文档。
- PR 2：schema / migration / domain / parser / repository 作废地基。
- PR 3：作废 API，并阻断作废摘要继续生成建议或创建来源随访任务。
- PR 4：机构端列表、详情、客户 timeline、来源任务提示展示作废状态。
- PR 5：smoke / 文档收尾。

最终完成范围包括作废字段和 migration、`status: "active" | "voided"` DTO 派生、作废原因 parser、`voidTreatmentSummaryByTenant`、`POST /api/institution/treatment-summaries/[summaryId]/void`、作废 audit、作废后随访建议 / 来源任务创建阻断、机构端列表 / 详情 / 客户 timeline / 来源任务提示展示，以及 workspace smoke / 文档收尾。

最终边界保持不变：不硬删除治疗摘要，不批量作废，不做版本历史或 diff 展示，不自动取消既有随访任务，不自动触达客户，不保存或展示完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件原文，不进入 AI / RAG / Agent、企业微信、真实 HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票或外部系统同步。

## 1. 当前上下文

已经完成的相关阶段：

- Phase 12：治疗记录结构化摘要 v1，新增 `treatment_summaries` 数据底座和客户详情 timeline 展示。
- Phase 13：治疗摘要人工录入 v1，新增创建 parser、POST API、客户详情录入 UI 和审计。
- Phase 14：治疗摘要管理能力 v1，新增列表 API、筛选、分页、安全详情和机构端管理页。
- Phase 15：治疗后护理 / 随访联动 v1，新增确定性随访建议和人工确认创建来源随访任务。
- Phase 16：随访任务来源治理 v1，新增来源筛选、来源标签和重复任务提示。
- Phase 17：HIS 标准治疗事件 domain-only 契约。
- Phase 18：治疗摘要编辑能力 v1，新增编辑 parser、`treatment_summary:update`、PATCH API 和编辑 UI。

当前关键文件：

- `src/server/db/schema.ts`
  - 当前 `treatment_summaries` 没有作废生命周期字段。
  - 当前 `follow_up_tasks` 通过 `source_treatment_summary_id` 和 `source_suggestion_key` 关联治疗摘要来源。
- `src/modules/institution/domain/treatment-summaries.ts`
  - 当前 `TreatmentSummaryRecord` 没有 `status` / `voidedAt` / `voidedBy` / `voidReason`。
- `src/modules/institution/server/treatment-summary-write-input.ts`
  - 当前已有 create / update parser，可复用敏感字段拒绝口径。
- `src/modules/institution/server/treatment-summary-repository.ts`
  - 当前已有 create、list、get、update，尚无 void 方法。
- `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
  - 当前提供 PATCH 编辑能力，不提供作废命令。
- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts`
  - 当前只要摘要存在即可返回建议，尚未识别作废状态。
- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
  - 当前只要摘要存在且 suggestionKey 有效即可创建来源随访任务，尚未阻断作废摘要。
- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
  - 当前展示列表、详情、编辑入口、随访建议和来源任务提示，尚未展示作废状态。
- `src/modules/institution/components/CustomerTimelineDrawer.tsx`
  - 当前展示治疗摘要节点，尚未标记作废状态。
- `src/modules/audit/domain/audit-events.ts`
  - 当前已有治疗摘要相关 reason，但尚无作废 reason。
- `src/modules/security/domain/access-control.ts`
  - 当前已有 `treatment_summary` resource 和 `update` action。

## 2. Phase 19 总边界

Phase 19 可以做：

- 治疗摘要软作废。
- 作废生命周期字段。
- 作废原因 parser。
- 作废 repository 方法。
- 作废 API。
- 作废 audit。
- 作废状态 DTO。
- 列表、详情、客户时间线展示作废状态。
- 作废摘要阻断新随访建议。
- 作废摘要阻断新来源随访任务。
- 已存在来源随访任务提示“来源治疗摘要已作废”。
- smoke / 文档收尾。

Phase 19 不做：

- 硬删除。
- 批量作废。
- 恢复作废。
- 版本历史。
- diff 展示。
- 自动取消既有随访任务。
- 自动修改既有随访任务状态。
- 自动触达客户。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件上传。
- AI provider。
- Agent。
- RAG。
- 企业微信。
- HIS / CRM / OTA 真实接入。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 大规模 UI 重构。

## 3. 文件职责规划

### PR 1 新增文档

新增：

- `docs/superpowers/specs/2026-06-02-phase19-treatment-summary-void-v1-design.md`
  - 固化 Phase 19 的目标、优先级、范围、作废字段、API、parser、RBAC、审计、UI、随访阻断、租户隔离、PII 边界和 PR 拆分。
- `docs/superpowers/plans/2026-06-02-phase19-treatment-summary-void-v1.md`
  - 固化后续 PR 2 到 PR 5 的文件职责、执行步骤、风险和验证方式。

PR 1 禁止修改：

- `README.md`
- roadmap
- devlog
- TypeScript 代码
- React 页面
- 测试
- API route
- 数据库 schema
- migration
- 权限、认证或租户隔离

### PR 2 建议文件

预计修改：

- `src/server/db/schema.ts`
  - 为 `treatment_summaries` 增加 `voidedAt`、`voidedBy`、`voidReasonCode`、`voidReason`。
  - 增加必要索引，例如 `treatment_summaries_tenant_voided_date_idx`。
- `drizzle/0005_phase19_treatment_summary_void.sql`
  - 只新增 nullable 字段和必要索引。
  - 不 drop 表，不删除字段，不修改已有字段类型。
- `drizzle/meta/_journal.json`
  - 记录新 migration。
- `drizzle/meta/0005_snapshot.json`
  - 记录 schema snapshot。
- `src/server/db/tests/Schema.test.ts`
  - 覆盖新字段、索引和 migration SQL。
- `src/modules/institution/domain/treatment-summaries.ts`
  - 扩展 `TreatmentSummaryRecord`、list DTO 和 timeline DTO。
  - 派生 `status: "active" | "voided"`。
- `src/modules/institution/server/treatment-summary-write-input.ts`
  - 新增 `parseVoidTreatmentSummaryPayload`。
  - 复用敏感字段拒绝逻辑。
- `src/modules/institution/server/treatment-summary-repository.ts`
  - 新增 `voidTreatmentSummaryByTenant`。
  - 重复作废返回稳定结果。
- `src/modules/audit/domain/audit-events.ts`
  - 新增作废相关 `AuditReason`。
- `src/modules/audit/domain/audit-event-query.ts`
  - 将新 reason 加入 `AUDIT_REASON_VALUES`。
- `src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts`
  - 覆盖作废 parser。
- `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
  - 覆盖 tenant-scoped 作废和重复作废。
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
  - 覆盖新 reason。
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
  - 覆盖新 reason 可查询。

PR 2 禁止修改：

- API route。
- UI。
- follow-up suggestions route。
- follow-up tasks route。
- workspace smoke。

### PR 3 建议文件

预计新增：

- `src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts`
  - 新增作废 API。

预计修改：

- `src/modules/institution/server/treatment-followup-confirmation.ts`
  - 作废摘要返回稳定阻断结果。
- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts`
  - 作废摘要返回 `409`。
- `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
  - 作废摘要返回 `409` 并写 denied audit。
- `src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts`
  - 覆盖作废 API。
- `src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts`
  - 覆盖作废后建议和任务创建阻断。

PR 3 禁止修改：

- UI。
- schema / migration，除非 PR 2 漏掉必要字段；这种情况应回到 PR 2 修正。
- 权限模型主结构。
- 既有随访任务状态机。

### PR 4 建议文件

预计修改：

- `src/modules/institution/client/tenant-business-client.ts`
  - 新增 `voidTreatmentSummary(summaryId, payload)`。
  - 只发送 `reasonCode` 和 `reasonText`。
- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
  - 列表显示作废状态。
  - 详情显示作废时间、作废人和作废原因。
  - 增加单条作废入口。
  - 作废后禁用随访建议和创建任务入口。
  - 展示既有来源任务“来源治疗摘要已作废”提示。
- `src/modules/institution/components/CustomerTimelineDrawer.tsx`
  - 客户时间线治疗摘要节点标记已作废。
- `src/modules/institution/domain/customer-timeline.ts`
  - timeline event 携带作废状态展示字段。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖 void client helper 白名单请求。
- `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
  - 覆盖列表、详情、作废入口、成功刷新、阻断建议和来源任务提示。
- `src/modules/institution/tests/CustomerTimelineDomain.test.ts`
  - 覆盖 timeline 作废节点。
- `src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts`
  - 覆盖 timeline DTO 安全字段。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 覆盖机构入口作废和展示策略。

PR 4 禁止修改：

- API route 行为，除非 PR 4 发现 PR 3 返回结构缺陷；缺陷应回到 PR 3 修正。
- schema / migration。
- 权限模型。
- 自动取消随访任务。

### PR 5 建议文件

预计修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-05-31.md`
- `docs/superpowers/specs/2026-06-02-phase19-treatment-summary-void-v1-design.md`
- `docs/superpowers/plans/2026-06-02-phase19-treatment-summary-void-v1.md`

目标：

- 标记 Phase 19 完成。
- 明确作废不是删除。
- 明确作废后阻断新建议和新任务。
- 明确既有来源任务不自动取消。
- 明确未进入 AI、RAG、HIS、企微、外部系统或自动触达。

## 4. 作废字段约定

PR 2 建议在 `treatment_summaries` 中新增：

```ts
voidedAt: timestamp('voided_at', { withTimezone: true }),
voidedBy: varchar('voided_by', { length: 96 }),
voidReasonCode: varchar('void_reason_code', { length: 64 }),
voidReason: varchar('void_reason', { length: 200 }),
```

字段语义：

- `voidedAt === null` 表示 active。
- `voidedAt !== null` 表示 voided。
- `voidedBy` 必须来自服务端 access context 的 `userId`。
- `voidReasonCode` 必须来自 parser 白名单。
- `voidReason` 必须是安全短文本。

DTO 建议：

```ts
type TreatmentSummaryStatus = 'active' | 'voided';

type TreatmentSummaryVoidFields = {
  status: TreatmentSummaryStatus;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReasonCode: string | null;
  voidReason: string | null;
};
```

历史数据：

- 不回填。
- 默认 `status` 派生为 `active`。
- 不破坏既有治疗摘要和来源随访任务。

## 5. 作废 payload parser 约定

建议新增：

```ts
export type VoidTreatmentSummaryReasonCode =
  | 'duplicate_summary'
  | 'created_by_mistake'
  | 'wrong_customer_or_appointment'
  | 'entered_wrong_treatment'
  | 'manual_governance_review'
  | 'other';

export type VoidTreatmentSummaryDraft = {
  reasonCode: VoidTreatmentSummaryReasonCode;
  reasonText: string;
};
```

parser 规则：

- 只接受 JSON object。
- 只允许 `reasonCode` 和 `reasonText`。
- `reasonCode` 必填且必须在白名单内。
- `reasonText` trim 后长度 1 到 160。
- `reasonCode === "other"` 时 `reasonText` 必填。
- 其他 reason code 可允许前端传入短说明，也可由服务端使用 code 中文说明补齐。
- 拒绝未知字段和 `tenantId`。
- 拒绝完整医疗正文、PII、图片 / 文件原文、AI 内容、外部系统原文、SQL、stack、token、secret、`DATABASE_URL` 和连接串。

## 6. 作废 API 约定

新增 route：

```text
POST /api/institution/treatment-summaries/[summaryId]/void
```

实现要求：

- 未登录返回 `401`。
- 无权限返回 `403`。
- 使用 `treatment_summary:update` 权限。
- 从 access context 读取 `tenantId`。
- 不读取 query、header、body 中的 `tenantId`。
- `summaryId` trim 后为空时按 not found 处理。
- 按 `tenantId + summaryId` 查找 summary。
- 查不到返回 `404`。
- parser 失败返回 `400`。
- 已作废返回 `409`。
- 成功返回安全 DTO。
- 成功写 allowed audit。
- 拒绝路径写 denied audit。
- 数据异常返回 `503`。

稳定错误建议：

| 场景 | HTTP | 文案 |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| 无权限 | `403` | `没有访问权限` |
| 不存在或跨租户 | `404` | `记录不存在` |
| payload 非法 | `400` | parser 返回的稳定中文错误 |
| 重复作废 | `409` | `治疗摘要已作废` |
| 服务异常 | `503` | `数据服务暂时不可用` |

## 7. 审计约定

新增 reason 建议在现有 `AuditReason` union 后追加以下稳定值：

- `treatment_summary_voided`
- `treatment_summary_already_voided`
- `invalid_treatment_summary_void_payload`
- `voided_treatment_summary_follow_up_blocked`

作废成功 audit：

```ts
createAuditEvent({
  context,
  resource: 'treatment_summary',
  resourceId: summaryId,
  action: 'update',
  result: 'allowed',
  reason: 'treatment_summary_voided',
  occurredAt,
});
```

审计禁止写入：

- 请求体。
- `reasonText` 原文。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- PII。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

## 8. 随访联动约定

作废摘要不再作为后续运营依据。

`GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions`：

- 如果 summary 已作废，返回 `409`。
- 响应：`{ "error": "治疗摘要已作废，不能生成随访建议" }`。
- 不返回 suggestions。
- 不写数据库。
- 不创建随访任务。

`POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks`：

- 如果 summary 已作废，返回 `409`。
- 响应：`{ "error": "治疗摘要已作废，不能创建来源随访任务" }`。
- 不创建随访任务。
- 写 denied audit，reason 为 `voided_treatment_summary_follow_up_blocked`。

既有来源随访任务：

- 不自动取消。
- 不自动改状态。
- 不自动触达客户。
- 保留 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey`。
- UI 显示“来源治疗摘要已作废”。

## 9. PR 1：Phase 19 spec / plan 文档

### 范围

- 新增 spec 文档。
- 新增 plan 文档。
- 固化 Phase 19 目标、范围、边界和 PR 拆分。

### 步骤

- [x] 确认当前分支从最新 `main` 创建。

  命令：

  ```bash
  git status -sb
  git log -1 --oneline
  ```

  预期：

  - 当前分支为 `docs/phase19-treatment-summary-void-plan`。
  - 基底为 `051f7e1` 或更新的 `origin/main`。
  - 工作区没有无关改动。

- [x] 新增 spec 文档。

  文件：

  ```text
  docs/superpowers/specs/2026-06-02-phase19-treatment-summary-void-v1-design.md
  ```

  必须覆盖：

  - Phase 19 目标。
  - 为什么优先做治疗摘要作废。
  - 其他方向后置原因。
  - 作废字段。
  - 作废 API。
  - 作废 parser。
  - RBAC。
  - 审计。
  - UI 展示。
  - 随访阻断。
  - 已有来源任务展示策略。
  - schema / migration 判断。
  - 租户隔离。
  - PII / 医疗隐私。
  - PR 拆分。

- [x] 新增 plan 文档。

  文件：

  ```text
  docs/superpowers/plans/2026-06-02-phase19-treatment-summary-void-v1.md
  ```

  必须覆盖：

  - PR 1 当前状态。
  - PR 2 到 PR 5 的文件职责。
  - 每个 PR 的范围、风险和验证方式。
  - 作废字段、parser、API、audit 和随访联动约定。

- [x] 运行 Markdown diff 检查。

  命令：

  ```bash
  git diff --check
  ```

  预期：无输出，退出码为 0。

### 风险

- 文档遗漏“作废不是删除”。
- 文档遗漏“作废后阻断新建议和新任务”。
- 文档把既有来源任务描述成自动取消。
- 文档混入 AI、HIS、企微、自动触达或业务代码实现。

### 验证

PR 1 只运行：

```bash
git diff --check
```

不运行完整 `node scripts/run-vitest.mjs run`、`./node_modules/.bin/tsc --noEmit` 或 `node scripts/run-next.mjs build --webpack`。原因：PR 1 只新增 Markdown 文档，没有修改 TypeScript、React 页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

## 10. PR 2：schema / migration / domain / parser / repository 作废地基

### 范围

- 新增作废字段。
- 新增 migration 和 meta。
- 扩展治疗摘要 domain / DTO。
- 新增作废原因 parser。
- 新增 repository void 方法。
- 新增作废相关 audit reason。
- 补 schema、parser、repository、audit 测试。
- 不新增 API。
- 不新增 UI。

### 步骤

- [x] 写 schema 测试，断言 `treatment_summaries` 包含 `voided_at`、`voided_by`、`void_reason_code`、`void_reason`。
- [x] 写 migration SQL 测试，断言只新增 nullable 字段和必要索引。
- [x] 更新 `src/server/db/schema.ts`。
- [x] 新增 migration 和 meta snapshot。
- [x] 扩展 `TreatmentSummaryRecord` 和 DTO mapper，派生 `status`。
- [x] 写 parser 测试，覆盖合法 reason code、`other` 必填说明、未知字段、`tenantId` 注入和敏感字段拒绝。
- [x] 实现 `parseVoidTreatmentSummaryPayload`。
- [x] 写 repository 测试，覆盖 tenant-scoped void、重复作废、跨租户不更新和安全 DTO。
- [x] 实现 `voidTreatmentSummaryByTenant`。
- [x] 更新 audit reason union、query 白名单和测试。
- [x] 运行验证命令。

### 风险

- migration 破坏历史数据。
- repository 缺少 tenant 条件。
- DTO 暴露 `tenantId`。
- parser 漏掉完整正文或 PII 拦截。
- 重复作废结果不稳定。

### 验证

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts src/modules/institution/tests/TreatmentSummaryRepository.test.ts
node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventsDomain.test.ts src/modules/audit/tests/AuditEventQueryParser.test.ts
./node_modules/.bin/tsc --noEmit
```

## 11. PR 3：作废 API，并阻断作废摘要继续生成建议或创建随访任务

### 范围

- 新增作废 API。
- 作废成功和拒绝路径写 audit。
- 作废后阻断 follow-up suggestions。
- 作废后阻断 follow-up task 创建。
- 不做 UI。

### 步骤

- [x] 写作废 API route 测试，覆盖成功、未登录、无权限、缺少 tenant、not found、invalid payload、重复作废和服务异常。
- [x] 新增 `src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts`。
- [x] 写 follow-up suggestions 作废阻断测试。
- [x] 修改 suggestions route 或 confirmation helper，作废摘要返回稳定阻断结果。
- [x] 写 follow-up task 创建作废阻断测试。
- [x] 修改 follow-up tasks route 或 confirmation helper，作废摘要不创建任务并写 denied audit。
- [x] 运行验证命令。

### 风险

- 作废 API 接受前端 `tenantId`。
- API 用 PATCH 或 DELETE 表达作废，混淆语义。
- 作废摘要仍能生成建议。
- 作废摘要仍能创建来源随访任务。
- audit 泄露 payload 或 reason text。

### 验证

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts
node scripts/run-vitest.mjs run src/modules/audit/tests
./node_modules/.bin/tsc --noEmit
```

## 12. PR 4：机构端列表、详情、客户 timeline、来源任务提示展示作废状态

### 范围

- 治疗摘要列表显示作废状态。
- 治疗摘要详情显示作废信息。
- 治疗摘要详情提供单条作废入口。
- 客户时间线标记作废摘要。
- 作废摘要不能继续创建随访建议或任务。
- 已存在来源随访任务显示“来源治疗摘要已作废”。
- 不做硬删除、批量作废、恢复或版本历史。

### 步骤

- [x] 写 client helper 测试，确认 `voidTreatmentSummary` 只发送 `reasonCode` 和 `reasonText`，不发送 `tenantId`。
- [x] 实现 `voidTreatmentSummary(summaryId, payload)`。
- [x] 写治疗摘要管理 UI 测试，覆盖列表作废标签、详情作废信息、作废入口、成功刷新、重复作废提示和敏感字段不展示。
- [x] 更新 `TreatmentSummaryManagementShell`。
- [x] 写客户时间线 domain / API 测试，覆盖作废状态 DTO 和 timeline 节点。
- [x] 更新 `customer-timeline` domain 和 `CustomerTimelineDrawer`。
- [x] 写 workspace smoke，覆盖机构入口打开治疗摘要管理、作废单条摘要、列表和详情刷新、建议被阻断、来源任务提示。
- [x] 运行验证命令。

### 风险

- UI 隐藏作废摘要，破坏追溯。
- UI 把作废写成删除。
- 作废摘要仍显示可创建任务入口。
- UI 暗示既有任务已自动取消。
- 前端 payload 携带敏感字段。

### 验证

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx src/modules/institution/tests/CustomerTimelineDomain.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

## 13. PR 5：smoke / 文档收尾

### 范围

- 补 workspace smoke。
- 补敏感字段 smoke。
- 更新 README / roadmap / devlog。
- 更新 Phase 19 spec / plan 完成状态。
- 标记 Phase 19 完成。

### 步骤

- [x] 强化 workspace smoke，覆盖作废状态展示、建议阻断、任务创建阻断和来源任务提示。
- [x] 强化敏感字段 smoke，确认页面和错误文案不展示 SQL、stack、token、secret、`DATABASE_URL`、PII 或完整医疗正文。
- [x] 更新 `README.md`，标记 Phase 19 完成。
- [x] 更新 roadmap，记录 Phase 19 完成范围和未进入事项。
- [x] 更新 devlog，记录 PR 1 到 PR 5。
- [x] 更新 Phase 19 spec / plan 状态。
- [x] 运行全量验证。

### 风险

- 文档误写为硬删除。
- 文档误写为自动取消随访任务。
- smoke 漏掉作废后阻断新建议和新任务。
- README / roadmap 误导为完成 HIS、AI、企微或自动触达。

### 验证

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 14. 执行顺序

推荐顺序：

1. PR 1：Phase 19 spec / plan 文档。
2. PR 2：schema / migration / domain / parser / repository 作废地基。
3. PR 3：作废 API，并阻断作废摘要继续生成建议或创建随访任务。
4. PR 4：机构端列表、详情、客户 timeline、来源任务提示展示作废状态。
5. PR 5：smoke / 文档收尾。

每个 PR 都应独立可验证。PR 2 之后不能直接跳到 UI；必须先在 PR 3 固化后端作废命令和随访阻断语义。

## 15. Phase 19 完成标准

Phase 19 完成时应满足：

- 治疗摘要支持软作废。
- 作废不删除治疗摘要。
- 作废不删除客户时间线。
- 作废不删除来源随访任务。
- 作废信息可审计、可追溯。
- 列表、详情和客户时间线明确展示作废状态。
- 作废摘要不能继续生成新的随访建议。
- 作废摘要不能继续人工确认创建新的来源随访任务。
- 已存在来源随访任务保留，并提示来源摘要已作废。
- 不自动触达客户。
- 不自动取消任务。
- 不开放 delete。
- 不进入 AI、RAG、HIS、企微、OAuth、Webhook、支付、合同或发票。

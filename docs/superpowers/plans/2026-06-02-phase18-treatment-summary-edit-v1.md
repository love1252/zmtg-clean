# Phase 18 治疗摘要编辑能力 v1 实施计划

> **给自主执行协作者：** 执行本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，并按任务逐项推进。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 为机构端提供治疗摘要结构化字段的受控编辑能力，只允许白名单字段，写审计，不保存完整医疗正文，不做删除或作废。

**架构：** Phase 18 v1 复用现有 `treatment_summaries` schema、Phase 13 payload parser 安全口径、Phase 14 列表 DTO、Phase 15/16 随访来源治理和现有审计仓储。实现顺序为：先固化 spec / plan 文档，再做 parser / RBAC / repository update 地基，再新增 PATCH API，随后接入机构端编辑 UI，最后做 smoke 和文档收尾。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、PostgreSQL、现有 demo access context、现有 audit repository、现有 Institution workspace。

---

## 1. 当前上下文

当前已完成：

- Phase 12：治疗记录结构化摘要 v1。
- Phase 13：治疗摘要人工录入 v1。
- Phase 14：治疗摘要管理能力 v1。
- Phase 15：治疗后护理 / 随访联动 v1。
- Phase 16：随访任务来源治理增强 v1。
- Phase 17：HIS 标准治疗事件 domain-only 契约。

现有关键文件：

- `src/server/db/schema.ts`：已有 `treatment_summaries` 字段和 `updatedAt`。
- `src/modules/institution/domain/treatment-summaries.ts`：治疗摘要领域类型和安全 DTO mapper。
- `src/modules/institution/server/treatment-summary-write-input.ts`：Phase 13 创建 payload parser。
- `src/modules/institution/server/treatment-summary-repository.ts`：创建、列表、单条读取和 appointment 归属校验。
- `src/app/api/institution/treatment-summaries/route.ts`：机构端治疗摘要列表 GET。
- `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`：机构端治疗摘要创建 POST。
- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`：治疗摘要管理列表、安全详情和随访建议联动 UI。
- `src/modules/institution/client/tenant-business-client.ts`：机构端 client helper。
- `src/modules/audit/domain/audit-events.ts`：审计 reason 和 audit event 类型。
- `src/modules/security/domain/access-control.ts`：`treatment_summary` resource 权限。

当前缺口：

- `treatment_summary` 只有 `read_own_tenant` 和 `create` 权限，没有 `update`。
- 治疗摘要没有 PATCH API。
- repository 没有 update 方法。
- UI 没有受控编辑入口。
- 编辑后与既有来源随访任务关系尚未固化。

## 2. Phase 18 总边界

Phase 18 可以做：

- 结构化治疗摘要编辑。
- 白名单 PATCH payload parser。
- `treatment_summary:update` 最小权限。
- tenant-scoped repository update。
- `PATCH /api/institution/treatment-summaries/[summaryId]`。
- allowed / denied audit。
- appointmentId 同租户同客户归属校验。
- 治疗摘要管理 UI 受控编辑入口。
- 编辑后刷新列表 / 详情 / timeline。
- smoke / 文档收尾。

Phase 18 不做：

- 治疗摘要删除。
- 治疗摘要作废。
- 版本历史。
- diff 展示。
- revision 表。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件上传。
- AI provider。
- AI 生成治疗建议。
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
- 自动触达客户。
- 大规模 UI 重构。

## 3. 文件职责规划

### PR 1 新增文档

新增：

- `docs/superpowers/specs/2026-06-02-phase18-treatment-summary-edit-v1-design.md`
- `docs/superpowers/plans/2026-06-02-phase18-treatment-summary-edit-v1.md`

不修改：

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

- `src/modules/institution/domain/treatment-summaries.ts`
  - 新增 `UpdateTreatmentSummaryDraft` 类型。
  - 必要时新增 update DTO mapper，但不扩大返回字段。
- `src/modules/institution/server/treatment-summary-write-input.ts`
  - 新增 `parseUpdateTreatmentSummaryPayload`。
  - 复用或抽取敏感字段拒绝 helper。
- `src/modules/institution/server/treatment-summary-repository.ts`
  - 新增 `updateTreatmentSummaryByTenant`。
  - 继续复用 `checkAppointmentBelongsToTenantAndCustomer`。
- `src/modules/security/domain/access-control.ts`
  - 为 `tenant_admin` 的 `treatment_summary` 增加 `update`。
- `src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts`
  - 覆盖 update parser 白名单、禁止字段、PII 和长度枚举。
- `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
  - 覆盖 tenant-scoped update、跨租户不更新、安全 DTO。
- `src/modules/security/tests/AccessControlDomain.test.ts`
  - 覆盖 `treatment_summary:update` 最小权限和旧权限不回退。

禁止修改：

- API route。
- UI。
- schema / migration。

### PR 3 建议文件

预计新增：

- `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
  - 新增 PATCH route。

预计修改：

- `src/modules/audit/domain/audit-events.ts`
  - 如现有 reason 已够用，可不新增 reason；如需要新增稳定 reason，必须同步测试和 query 白名单。
- `src/modules/audit/domain/audit-event-query.ts`
  - 仅当新增 AuditReason 时更新 `AUDIT_REASON_VALUES`。
- `src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts`
  - 扩展或新增 PATCH API route 测试。

禁止修改：

- schema / migration。
- UI。
- 随访任务创建逻辑。

### PR 4 建议文件

预计修改：

- `src/modules/institution/client/tenant-business-client.ts`
  - 新增 `updateTreatmentSummary(summaryId, payload)`。
  - 只 pick update 白名单字段。
- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
  - 在安全详情中增加受控编辑入口。
  - 提交成功后刷新列表和当前详情。
  - 显示“不会自动修改既有随访任务”的稳定边界。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖 PATCH helper 只发送白名单字段且不发送 `tenantId`。
- `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
  - 覆盖编辑入口、成功刷新、失败保留输入、敏感字段不展示。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - smoke 覆盖机构入口编辑治疗摘要。

禁止修改：

- API route 行为，除非 PR 4 发现 PR 3 返回结构缺陷；这种缺陷应回到 PR 3 修正。
- schema / migration。
- 权限模型主结构。

### PR 5 建议文件

预计修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-05-31.md`
- `docs/superpowers/specs/2026-06-02-phase18-treatment-summary-edit-v1-design.md`
- `docs/superpowers/plans/2026-06-02-phase18-treatment-summary-edit-v1.md`

目标：

- 标记 Phase 18 完成。
- 保留 PR 拆分历史。
- 明确未进入删除、作废、AI、RAG、HIS、企微、外部系统或自动触达。

## 4. 可编辑字段白名单

Phase 18 v1 只允许以下字段：

- `treatmentDate`
- `treatmentProject`
- `treatmentCategory`
- `treatmentStage`
- `recoveryStage`
- `riskLevel`
- `ownerUserId`
- `summary`
- `nextCareAction`
- `tags`
- `appointmentId`

字段规则：

- `treatmentDate` 必须为有效 ISO-like 时间。
- `riskLevel` 只能是 `normal` / `watch` / `urgent`。
- `summary` 是结构化短摘要，不是完整治疗记录正文。
- `nextCareAction` 是结构化下一步动作，不是咨询对话全文。
- `tags` 必须去重、trim、限制长度和数量。
- `appointmentId` 可为空；非空时必须同租户同客户。

## 5. 禁止编辑字段

禁止字段：

- `id`
- `tenantId`
- `customerId`
- `createdAt`
- `updatedAt`
- `fullTreatmentRecord`
- `medicalRecordText`
- `medicalRecordBody`
- `diagnosisText`
- `clinicalNote`
- `consultationTranscript`
- `phoneNumber`
- `idNumber`
- `identityNumber`
- `medicalRecordNo`
- `rawMedicalRecordNo`
- `imageUrl`
- `fileUrl`
- `beforePhotoUrl`
- `afterPhotoUrl`
- `fileContent`
- `aiGeneratedContent`
- `externalSystemPayload`
- `requestBody`
- `sql`
- `stack`
- `token`
- `secret`
- `DATABASE_URL`
- 任何数据库连接串

禁止字段必须在 parser、API、repository、DTO、UI、审计和测试中保持不可见。

## 6. PR 1：Phase 18 spec / plan 文档

**范围：**

- 新增 Phase 18 design spec。
- 新增 Phase 18 implementation plan。
- 固化治疗摘要编辑 v1 的目标、范围、白名单、禁止字段、API、parser、RBAC、审计、appointment 归属、随访任务关系、schema 决策、租户隔离、隐私边界和 PR 拆分。
- 不改任何业务代码。

**本 PR 不做：**

- 不改 TypeScript 代码。
- 不改 React 页面。
- 不改测试。
- 不改 API route。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。
- 不进入 Phase 18 PR 2/3/4/5。

**风险：**

- 文档边界不清，导致后续 PR 混入删除、作废、HIS、AI、RAG、企微或外部系统。
- 可编辑字段和禁止字段没有写清，导致 parser 设计漂移。
- 编辑后与既有随访任务关系没有写清，导致任务被自动修改。

**验证：**

```bash
git diff --check
```

**步骤：**

- [x] 新增 `docs/superpowers/specs/2026-06-02-phase18-treatment-summary-edit-v1-design.md`
- [x] 新增 `docs/superpowers/plans/2026-06-02-phase18-treatment-summary-edit-v1.md`
- [ ] 运行 `git diff --check`
- [ ] 提交 PR 1 文档
- [ ] 推送 `docs/phase18-treatment-summary-edit-plan`
- [ ] 创建 Draft PR

## 7. PR 2：编辑 payload parser、RBAC、repository update、单元测试

**范围：**

- 新增 `UpdateTreatmentSummaryDraft`。
- 新增 `parseUpdateTreatmentSummaryPayload`。
- 复用或抽取 Phase 13 创建 parser 的敏感字段拒绝逻辑。
- 为 `tenant_admin` 增加 `treatment_summary:update`。
- 新增 repository update 方法。
- update 时设置 `updatedAt: new Date()`。
- 单元测试覆盖 parser、RBAC 和 repository。

**建议 parser 测试：**

- 接受完整白名单结构化字段。
- 标准化 `treatmentDate`、`tags` 和 `appointmentId`。
- 允许 `appointmentId` 为空。
- 拒绝 `tenantId`。
- 拒绝 `id`、`customerId`、`createdAt`、`updatedAt`。
- 拒绝未知字段。
- 拒绝完整治疗记录正文、完整病历正文、诊疗原文、咨询全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 内容、外部系统原文。
- 拒绝 SQL、stack、token、secret、`DATABASE_URL` 和连接串。

**建议 repository 测试：**

- 按 `tenantId + summaryId` update。
- 不用 payload 修改 `tenantId` / `customerId`。
- mock 混入跨租户数据也不会返回或更新。
- update 返回安全 record。
- `updatedAt` 更新。

**风险：**

- parser 接受未知字段。
- repository update 漏掉 tenant 条件。
- 权限扩大到平台角色。
- 误改 `customerId`。

**验证：**

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryRepository.test.ts
node scripts/run-vitest.mjs run src/modules/security/tests/AccessControlDomain.test.ts
./node_modules/.bin/tsc --noEmit
```

## 8. PR 3：PATCH API 与 API 测试

**范围：**

- 新增 `PATCH /api/institution/treatment-summaries/[summaryId]`。
- 使用 `getDemoAccessContextFromRequest` 获取 access context。
- 校验 `treatment_summary:update`。
- 读取和校验当前租户内 summary。
- 解析 payload。
- 如有 `appointmentId`，校验同租户同客户。
- 调用 repository update。
- 返回安全 DTO。
- 写 allowed / denied audit。

**建议 API 测试：**

- 200：合法 payload 编辑成功，返回安全 DTO，写 allowed audit。
- 400：非法 JSON。
- 400：未知字段。
- 400：敏感字段。
- 401：未登录。
- 403：无权限。
- 404：summary 不存在或跨租户。
- 404：appointment 不存在或跨租户。
- 409：appointment 属于同租户其他客户。
- 503：数据库异常返回稳定错误。
- 请求 query/header/body 中的 `tenantId` 不能切换租户。
- 审计不包含请求体、完整正文、PII、SQL、stack、token、secret 或连接串。

**风险：**

- API 使用前端 tenantId。
- invalid reference 没有审计。
- appointment 只校验租户但未校验 customer。
- 错误响应泄露内部错误。

**验证：**

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts
node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventsDomain.test.ts
./node_modules/.bin/tsc --noEmit
```

## 9. PR 4：机构端编辑 UI

**范围：**

- 在治疗摘要安全详情 dialog 中增加编辑入口。
- 编辑表单只显示白名单字段。
- client helper 只提交白名单字段。
- 成功后刷新列表和详情。
- 如客户详情 timeline 使用旧数据，触发相关刷新。
- 展示稳定提示：编辑不会自动修改既有随访任务。
- 失败后保留输入。
- 不做删除或作废。

**建议 UI 测试：**

- 进入治疗摘要管理页后打开安全详情。
- 点击编辑入口，看到结构化字段。
- 修改字段并提交 PATCH。
- 请求 body 不含 `tenantId`、`customerId`、未知字段、完整正文、PII、SQL、stack、token、secret。
- 成功后列表显示更新字段。
- 失败后保留输入并显示稳定中文错误。
- 页面不出现删除、作废、自动触达、自动发送微信、企微触达等文案。

**风险：**

- UI 提交字段超过 API 白名单。
- UI 误导用户编辑会重建随访任务。
- 失败后输入丢失。
- 页面展示敏感字段。

**验证：**

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

## 10. PR 5：smoke / 文档收尾

**范围：**

- workspace smoke 覆盖治疗摘要编辑主路径。
- smoke 覆盖失败保留输入。
- smoke 覆盖请求不含 `tenantId`。
- smoke 覆盖不展示 PII / 正文 / SQL / token / secret。
- README 标记 Phase 18 完成。
- roadmap 标记 Phase 18 完成。
- devlog 增加 Phase 18 PR 1-5 记录。
- Phase 18 spec / plan 更新完成状态。

**风险：**

- 文档完成状态夸大。
- smoke 没有覆盖隐私禁区。
- README 误称作废、删除、HIS、AI 或外部系统已完成。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 11. 审计设计执行要求

编辑成功：

- `resource`: `treatment_summary`
- `action`: `update`
- `result`: `allowed`
- `resourceId`: 当前 summary id
- `reason`: `allowed_by_policy`

拒绝场景：

- 无权限：`role_denied`
- 缺少租户：`missing_tenant`
- 记录不存在或不属于租户：`not_found_or_not_owned`
- payload 非法：`invalid_treatment_summary_payload`
- appointment 不属于当前客户：`invalid_treatment_summary_reference`

审计禁止记录：

- 请求体。
- 更新前值。
- 更新后值。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- PII。
- SQL / stack / token / secret。

## 12. 编辑后与随访任务关系

v1 固定策略：

- 编辑治疗摘要不自动修改已创建的随访任务。
- 编辑治疗摘要不自动重新生成随访建议。
- 再次点击“查看随访建议”时可以基于最新摘要重新计算建议。
- 已创建随访任务保留原 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey`。
- 已创建任务的 `stage`、`suggestedAction`、`dueAt` 和 `riskLevel` 不自动变化。
- 如需重建任务、取消旧任务或展示建议变化，需要后续单独 Plan Mode。

## 13. Schema / migration 决策

Phase 18 v1 默认不新增 schema / migration：

- 复用现有 `treatment_summaries` 字段。
- 复用现有 `updatedAt`。
- 不做版本历史。
- 不做 diff 展示。
- 不做 revision 表。
- 不做作废状态。

后续如果需要完整变更历史，再单独规划 revision 表。

## 14. Phase 18 完成标准

Phase 18 完成时必须满足：

- 机构端可以编辑当前租户内治疗摘要。
- 只允许白名单字段。
- 不接受前端 `tenantId`。
- 不允许完整医疗正文、咨询全文、图片 / 文件、PII 或内部敏感字段。
- `appointmentId` 同租户同客户校验完成。
- 编辑成功返回安全 DTO。
- 编辑成功写 allowed audit。
- 拒绝场景写稳定 denied audit。
- 不新增 schema / migration。
- 不做删除、作废、版本历史或 diff 展示。
- 不自动修改既有随访任务。
- README、roadmap、devlog 和 Phase 18 文档与真实实现一致。

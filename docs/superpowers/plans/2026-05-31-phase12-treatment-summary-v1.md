# Phase 12 治疗记录结构化摘要 v1 实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**状态：** Phase 12 已完成。

**目标：** 为客户详情时间线补充治疗记录结构化摘要 v1，只展示安全摘要和治疗节点，不保存或返回完整治疗记录正文、完整病历正文、咨询对话全文、AI 生成内容或外部系统原文。

**架构方案：** Phase 12 v1 已按 5 个 PR 完成。PR 2 新增 `treatment_summaries` 最小 schema / migration / seed / repository / DTO 白名单；PR 3 扩展现有 customer timeline domain 与 API；PR 4 在客户详情抽屉中展示治疗摘要；PR 5 做 smoke 和文档收尾。Phase 12 未新增独立治疗详情页，未新增治疗写入 UI，未接 AI 或外部系统。

**技术栈：** Next.js 16、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、PostgreSQL、现有 `GET /api/institution/customers/[customerId]/timeline`。

---

## 当前上下文

Phase 12 接在以下已完成能力之后：

- Phase 5：客户中心、预约中心、智能随访接入真实 API。
- Phase 6：机构工作台首页真实 API 摘要、共享页面状态组件和导航边界。
- Phase 7：客户详情时间线 v1，已聚合客户、预约、随访和审计摘要。
- Phase 8：机构端 / 平台端审计日志只读查询。
- Phase 9：平台端租户管理基础版。
- Phase 10：客户 / 预约创建套餐配额 enforcement 轻量版。
- Phase 11：平台商业化健康只读运营辅助。

Phase 12 的核心边界：

- 只做治疗结构化摘要。
- 不做完整治疗记录正文。
- 不做完整病历正文。
- 不做咨询对话全文。
- 不做 AI provider、AI 生成治疗建议或 Agent。
- 不做 HIS / CRM / OTA / 企业微信 / 外部系统同步。
- 不做治疗摘要写入 UI。
- 不修改权限、认证或租户隔离模型。

## 文件职责规划

### PR 1 只新增文档

新增：

- `docs/superpowers/specs/2026-05-31-phase12-treatment-summary-v1-design.md`
  - Phase 12 目标、方向选择、字段白名单、禁止字段、API 策略、schema / migration 策略、复合外键、timeline 扩展、DTO 边界、隐私风险和 PR 拆分。
- `docs/superpowers/plans/2026-05-31-phase12-treatment-summary-v1.md`
  - Phase 12 后续 PR 执行计划、涉及文件、步骤、风险和验证方式。

不修改：

- TypeScript 业务代码。
- React 页面。
- 测试文件。
- API route。
- 数据库 schema。
- migration。
- 权限、认证或租户隔离。

### PR 2 建议文件

建议新增：

- `src/modules/institution/domain/treatment-summaries.ts`
  - 治疗摘要领域类型、风险等级类型、DTO mapper 和字段白名单。
- `src/modules/institution/server/treatment-summary-repository.ts`
  - 按 `tenantId + customerId` 查询治疗摘要。
- `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
  - DTO 白名单、禁止字段扫描、排序和安全摘要测试。
- `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
  - repository 查询条件、租户隔离和 mapper 测试。

建议修改：

- `src/server/db/schema.ts`
  - 新增 `treatmentSummaries` 表。
  - 如需要，为 `appointments` 新增 `(tenant_id, id)` unique constraint 以支持预约复合外键。
- `src/server/db/seed-demo-data.ts`
  - 新增 demo 治疗摘要 seed。
- `src/server/db/tests/Schema.test.ts`
  - 增加 schema / migration / seed 安全测试。
- `drizzle/*.sql`
  - 新增 migration。

不修改：

- `src/app/api/institution/customers/[customerId]/timeline/route.ts`
- `src/modules/institution/components/CustomerTimelineDrawer.tsx`
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

### PR 3 建议文件

建议修改：

- `src/modules/institution/domain/customer-timeline.ts`
  - `CustomerTimelineResponse` 增加 `treatmentSummaries`。
  - `CustomerTimelineEvent.type` 增加 `'treatment_summary'`。
  - `buildCustomerTimelineResponse()` 接入治疗摘要事件。
- `src/app/api/institution/customers/[customerId]/timeline/route.ts`
  - 查询治疗摘要 repository。
  - response 增加治疗摘要。
  - 保持服务端租户上下文。
- `src/modules/institution/tests/CustomerTimelineDomain.test.ts`
  - 增加治疗摘要数组和 treatment timeline event 测试。
- `src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts`
  - 增加 API 返回治疗摘要、租户隔离和敏感字段不返回测试。

不修改：

- 客户详情 UI。
- 独立治疗 API。
- 治疗写入 UI。

### PR 4 建议文件

建议修改：

- `src/modules/institution/components/CustomerTimelineDrawer.tsx`
  - 新增治疗摘要 section。
  - 结构化时间线中显示 `treatment_summary` event。
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - 客户详情抽屉治疗摘要展示测试。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 入口 smoke 覆盖治疗摘要展示和敏感字段不展示。

不修改：

- 数据库 schema / migration。
- API route。
- 权限、认证或租户隔离。
- 治疗写入 UI。

### PR 5 建议文件

建议修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-05-31.md`
- `docs/superpowers/specs/2026-05-31-phase12-treatment-summary-v1-design.md`
- `docs/superpowers/plans/2026-05-31-phase12-treatment-summary-v1.md`
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

## 字段设计约定

PR 2 应围绕以下白名单字段建模：

- `id`
- `tenantId`
- `customerId`
- `appointmentId`
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
- `createdAt`
- `updatedAt`

推荐安全 DTO：

```ts
export type CustomerTimelineTreatmentSummary = {
  id: string;
  appointmentId: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: 'normal' | 'watch' | 'urgent';
  ownerUserId: string;
  summary: string;
  nextCareAction: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
```

内部 repository record 可以包含 `tenantId` 和 `customerId`，但 timeline response 不返回这两个字段。

## 禁止字段约定

以下字段和值不得进入 schema、migration、seed、repository 输出、DTO、API response、UI、测试快照、日志和审计：

- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 图片 / 文件原文。
- AI 生成内容。
- 外部系统同步原文。
- 请求体。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

测试中应扫描以下危险字段名和值：

```text
treatmentRecord
treatmentRecordBody
medicalRecord
medicalRecordBody
diagnosisText
clinicalNote
consultationTranscript
phoneNumber
idNumber
medicalRecordNo
imageUrl
fileUrl
fileBody
requestBody
metadata
rawPayload
aiGeneratedContent
externalSyncPayload
完整治疗记录正文
完整病历正文
诊疗原文
咨询对话全文
13800000000
110101199001010011
MR-RAW-001
select * from
DATABASE_URL
postgres://
stack
token
secret
```

## PR 1：Phase 12 spec / plan 文档

状态：已完成。

**范围：**

- 新增 Phase 12 设计文档。
- 新增 Phase 12 实施计划。
- 固化治疗记录结构化摘要 v1 为默认方向。
- 明确知识库 / RAG 和平台套餐继续增强后置。
- 明确字段白名单和禁止字段。
- 明确 API 策略为扩展现有 customer timeline API。
- 明确需要新增最小 `treatment_summaries` 类表。
- 明确 `tenant_id + customer_id` 复合外键。
- 明确可选 `appointment_id` 的同租户约束。
- 明确 PR 2 / PR 3 / PR 4 / PR 5 才进入后续实现。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。

**涉及文件：**

- 新增：`docs/superpowers/specs/2026-05-31-phase12-treatment-summary-v1-design.md`
- 新增：`docs/superpowers/plans/2026-05-31-phase12-treatment-summary-v1.md`

**步骤：**

- [x] **步骤 1：确认工作区和分支**

运行：

```bash
git status -sb
git branch --show-current
git log -1 --oneline
```

预期：

- 工作区干净。
- 当前从 `main` 创建 `docs/phase12-treatment-summary-plan`。
- 最新提交为 Phase 11 合并后的 `main`。

- [x] **步骤 2：新增 Phase 12 design spec**

创建：

```text
docs/superpowers/specs/2026-05-31-phase12-treatment-summary-v1-design.md
```

文档必须包含：

- Phase 12 目标。
- 优先选择治疗记录结构化摘要 v1 的原因。
- 知识库 / RAG 和平台套餐继续增强后置原因。
- 范围和非目标。
- 字段白名单。
- 明确禁止字段。
- API 策略。
- schema / migration 策略。
- 租户隔离设计。
- 复合外键设计。
- timeline API 扩展方式。
- DTO 脱敏边界。
- PII / 医疗隐私风险。
- PR 1-5 拆分，每个 PR 的范围、风险和验证方式。

- [x] **步骤 3：新增 Phase 12 implementation plan**

创建：

```text
docs/superpowers/plans/2026-05-31-phase12-treatment-summary-v1.md
```

计划必须包含：

- 后续执行 Agent 要求。
- 文件职责规划。
- 字段设计约定。
- 禁止字段约定。
- PR 1-5 逐项执行范围。
- 每个 PR 的涉及文件、步骤、风险、控制和验证方式。
- 明确 PR 1 只改 Markdown。

- [x] **步骤 4：运行 Markdown diff 校验**

运行：

```bash
git diff --check
```

预期：无 trailing whitespace 或 patch 格式问题。

- [x] **步骤 5：提交 PR 1 文档**

运行：

```bash
git add docs/superpowers/specs/2026-05-31-phase12-treatment-summary-v1-design.md docs/superpowers/plans/2026-05-31-phase12-treatment-summary-v1.md
git commit -m "docs: 固化 Phase 12 治疗结构化摘要计划"
```

预期：只提交两份 Markdown 文档。

**风险：**

- 文档把 Phase 12 写成完整治疗记录能力。
- 文档遗漏 `tenant_id + customer_id` 复合外键。
- 文档没有明确禁止完整病历正文、诊疗原文、咨询全文和 AI 生成内容。
- 文档暗示 PR 1 会进入代码开发。

**控制：**

- PR 1 只新增两份 Markdown。
- 文档明确不改 API、schema、migration、权限、认证或租户隔离。
- 文档明确 PR 2 才新增 schema / migration。
- 文档明确 PR 3 才扩展 timeline API。
- 文档明确 PR 4 才展示 UI。

**验证方式：**

```bash
git diff --check
```

本 PR 只修改 Markdown，不运行完整 test / typecheck / build。原因：未修改 TypeScript、React 页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

## PR 2：schema / migration / seed / repository / DTO 白名单测试

状态：已完成。

**范围：**

- 新增治疗摘要表。
- 新增 migration。
- 新增 seed demo 数据。
- 新增 treatment summary domain 类型。
- 新增 repository。
- 新增 DTO 白名单 mapper。
- 新增 schema / migration / seed / repository / DTO 测试。
- 不做 API。
- 不做 UI。

**涉及文件：**

- 修改：`src/server/db/schema.ts`
- 修改：`src/server/db/seed-demo-data.ts`
- 修改：`src/server/db/tests/Schema.test.ts`
- 新增：`src/modules/institution/domain/treatment-summaries.ts`
- 新增：`src/modules/institution/server/treatment-summary-repository.ts`
- 新增：`src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
- 新增：`src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
- 新增：`drizzle/<generated-phase12-treatment-summaries>.sql`

**步骤：**

- [x] **步骤 1：编写 schema 失败测试**

在 `src/server/db/tests/Schema.test.ts` 增加断言：

```ts
it('定义治疗结构化摘要表且不包含医疗正文或原始 PII 字段', () => {
  const schemaModule = schema as typeof schema & Record<string, unknown>;
  const treatmentSummaries = schemaModule.treatmentSummaries;

  expect(treatmentSummaries).toBeDefined();

  const columns = columnNames(getTableConfig(treatmentSummaries as never).columns);
  expect(columns).toEqual(
    expect.arrayContaining([
      'id',
      'tenant_id',
      'customer_id',
      'appointment_id',
      'treatment_date',
      'treatment_project',
      'treatment_category',
      'treatment_stage',
      'recovery_stage',
      'risk_level',
      'owner_user_id',
      'summary',
      'next_care_action',
      'tags',
      'created_at',
      'updated_at',
    ]),
  );
  expect(JSON.stringify(columns)).not.toMatch(
    /treatment_record|medical_record|diagnosis_text|clinical_note|consultation_transcript|phone_number|id_number|medical_record_no|request_body|metadata|raw_payload|ai_generated|external_sync/i,
  );
});
```

运行：

```bash
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts
```

预期：失败，因为 `treatmentSummaries` 尚不存在。

- [x] **步骤 2：实现最小 schema 和 migration**

在 `src/server/db/schema.ts` 新增 `treatmentSummaries`，字段和索引按 spec 白名单实现。

建议形态：

```ts
export const treatmentSummaries = pgTable(
  'treatment_summaries',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    appointmentId: varchar('appointment_id', { length: 64 }),
    treatmentDate: timestamp('treatment_date', { withTimezone: true }).notNull(),
    treatmentProject: varchar('treatment_project', { length: 160 }).notNull(),
    treatmentCategory: varchar('treatment_category', { length: 96 }).notNull(),
    treatmentStage: varchar('treatment_stage', { length: 120 }).notNull(),
    recoveryStage: varchar('recovery_stage', { length: 120 }).notNull(),
    riskLevel: followUpRiskLevelEnum('risk_level').notNull(),
    ownerUserId: varchar('owner_user_id', { length: 96 }).notNull(),
    summary: text('summary').notNull(),
    nextCareAction: text('next_care_action').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => ({
    customerFk: foreignKey({
      name: 'treatment_summaries_tenant_customer_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    tenantCustomerDateIdx: index('treatment_summaries_tenant_customer_date_idx').on(
      table.tenantId,
      table.customerId,
      table.treatmentDate,
    ),
    tenantRiskDateIdx: index('treatment_summaries_tenant_risk_date_idx').on(
      table.tenantId,
      table.riskLevel,
      table.treatmentDate,
    ),
    tenantAppointmentIdx: index('treatment_summaries_tenant_appointment_idx').on(
      table.tenantId,
      table.appointmentId,
    ),
  }),
);
```

如果 PR 2 选择数据库级预约复合外键，先为 `appointments` 新增 `(tenant_id, id)` unique constraint，再增加 `treatment_summaries_tenant_appointment_fk`。

- [x] **步骤 3：编写 domain DTO 白名单失败测试**

新增 `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`，验证 DTO 不返回危险字段：

```ts
it('治疗摘要 DTO 只返回白名单字段', () => {
  const dto = mapTreatmentSummaryRecordToTimelineDto({
    id: 'trt_001',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_001',
    appointmentId: 'appt_001',
    treatmentDate: '2026-05-31T08:00:00.000Z',
    treatmentProject: '光电修复',
    treatmentCategory: 'laser',
    treatmentStage: 'D7 复诊',
    recoveryStage: 'D7',
    riskLevel: 'watch',
    ownerUserId: 'doctor-lin',
    summary: '红肿减轻，安排补水护理',
    nextCareAction: 'D14 人工回访',
    tags: ['术后关怀'],
    createdAt: '2026-05-31T08:00:00.000Z',
    updatedAt: '2026-05-31T08:00:00.000Z',
    treatmentRecord: '完整治疗记录正文',
    phoneNumber: '13800000000',
    stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  } as TreatmentSummaryRecord & Record<string, unknown>);

  const serialized = JSON.stringify(dto);
  expect(dto).toEqual({
    id: 'trt_001',
    appointmentId: 'appt_001',
    treatmentDate: '2026-05-31T08:00:00.000Z',
    treatmentProject: '光电修复',
    treatmentCategory: 'laser',
    treatmentStage: 'D7 复诊',
    recoveryStage: 'D7',
    riskLevel: 'watch',
    ownerUserId: 'doctor-lin',
    summary: '红肿减轻，安排补水护理',
    nextCareAction: 'D14 人工回访',
    tags: ['术后关怀'],
    createdAt: '2026-05-31T08:00:00.000Z',
    updatedAt: '2026-05-31T08:00:00.000Z',
  });
  expect(serialized).not.toContain('tenantId');
  expect(serialized).not.toContain('customerId');
  expect(serialized).not.toContain('完整治疗记录正文');
  expect(serialized).not.toContain('13800000000');
  expect(serialized).not.toContain('DATABASE_URL');
});
```

- [x] **步骤 4：实现 domain 和 repository**

新增 domain mapper 和 repository 查询：

```ts
async listTreatmentSummariesByTenantAndCustomer(input: {
  tenantId: string;
  customerId: string;
}): Promise<TreatmentSummaryRecord[]> {
  const rows = await database
    .select()
    .from(treatmentSummaries)
    .where(
      and(
        eq(treatmentSummaries.tenantId, input.tenantId),
        eq(treatmentSummaries.customerId, input.customerId),
      ),
    )
    .orderBy(desc(treatmentSummaries.treatmentDate), asc(treatmentSummaries.id));

  return rows.map(mapTreatmentSummaryRowToRecord);
}
```

- [x] **步骤 5：运行 PR 2 验证**

运行：

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts src/modules/institution/tests/TreatmentSummaryDomain.test.ts src/modules/institution/tests/TreatmentSummaryRepository.test.ts
./node_modules/.bin/tsc --noEmit
```

预期：全部通过。

**风险：**

- schema 误加正文列或 `metadata jsonb`。
- migration 缺少复合外键。
- seed 包含真实 PII 或医疗正文。
- repository 未按 tenant 过滤。

**控制：**

- schema 和 migration 测试扫描危险字段。
- repository 测试断言 where 条件包含 `tenantId` 和 `customerId`。
- DTO 测试使用危险额外字段并确认不输出。

## PR 3：扩展 customer timeline domain 与 API

状态：已完成。

**范围：**

- 扩展 customer timeline domain。
- 扩展现有 timeline API。
- 增加 `treatmentSummaries`。
- 增加 `treatment_summary` timeline events。
- 强制 tenant scope。
- 不返回敏感正文。
- 不新增独立治疗 API。
- 不新增 UI。

**涉及文件：**

- 修改：`src/modules/institution/domain/customer-timeline.ts`
- 修改：`src/app/api/institution/customers/[customerId]/timeline/route.ts`
- 修改：`src/modules/institution/tests/CustomerTimelineDomain.test.ts`
- 修改：`src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts`

**步骤：**

- [x] **步骤 1：编写 timeline domain 失败测试**

在 `CustomerTimelineDomain.test.ts` 增加治疗摘要输入，期望 response 包含 `treatmentSummaries` 和 `treatment_summary` event。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/CustomerTimelineDomain.test.ts
```

预期：失败，因为 domain 尚未支持 treatment summaries。

- [x] **步骤 2：扩展 timeline domain**

增加类型：

```ts
export type CustomerTimelineTreatmentSummary = {
  id: string;
  appointmentId: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: FollowUpRiskLevel;
  ownerUserId: string;
  summary: string;
  nextCareAction: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
```

`CustomerTimelineEvent.type` 增加 `'treatment_summary'`，并在 `buildCustomerTimelineResponse()` 中加入 `treatment_summary` event。

- [x] **步骤 3：编写 timeline API 失败测试**

在 `CustomerTimelineApiRoutes.test.ts` 增加：

- repository 被调用时参数为 `{ tenantId: 'demo-tenant-001', customerId: 'cust_001' }`。
- response 包含 `treatmentSummaries`。
- response 不包含 `tenantId`、`customerId`、完整治疗正文、完整病历正文、咨询全文、SQL、stack、token、secret。
- URL / header / body 中伪造 `tenantId` 不影响查询。

- [x] **步骤 4：扩展 timeline API route**

在 route 中接入 treatment summary repository：

```ts
const [appointments, followups, treatmentSummaries, auditEvents] = await Promise.all([
  repository.listAppointmentsByTenantAndCustomer({ tenantId, customerId }),
  repository.listFollowUpTasksByTenantAndCustomer({ tenantId, customerId }),
  treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer({ tenantId, customerId }),
  auditRepository.listCustomerAuditEventsByResourceId({ tenantId, customerId }),
]);
```

- [x] **步骤 5：运行 PR 3 验证**

运行：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/CustomerTimelineDomain.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
```

预期：全部通过。

**风险：**

- timeline response 返回内部 `tenantId` 或 `customerId`。
- API route 在客户不存在时仍查询治疗摘要。
- `treatment_summary` event 排序破坏现有客户摘要排最后规则。
- route 错误泄露数据库细节。

**控制：**

- 保留先查客户归属，客户不存在直接 `404`。
- DTO mapper 只返回白名单。
- 测试覆盖伪造租户、跨租户客户、敏感字段和排序。

## PR 4：客户详情抽屉 UI 展示治疗摘要

状态：已完成。

**范围：**

- 在客户详情时间线中展示治疗结构化摘要。
- 展示治疗节点。
- 增加 loading / empty / error 相关测试。
- 不新增治疗写入 UI。

**涉及文件：**

- 修改：`src/modules/institution/components/CustomerTimelineDrawer.tsx`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**步骤：**

- [x] **步骤 1：编写 UI 失败测试**

在 UI 测试中 mock timeline response：

```ts
treatmentSummaries: [
  {
    id: 'trt_phase12_d7',
    appointmentId: 'appt_phase5_closeout',
    treatmentDate: '2026-05-31T08:00:00.000Z',
    treatmentProject: 'Phase12 光电修复',
    treatmentCategory: 'laser',
    treatmentStage: 'D7 复诊',
    recoveryStage: 'D7',
    riskLevel: 'watch',
    ownerUserId: 'doctor-phase12',
    summary: '红肿减轻，安排补水护理',
    nextCareAction: 'D14 人工回访',
    tags: ['术后关怀'],
    createdAt: '2026-05-31T08:00:00.000Z',
    updatedAt: '2026-05-31T08:00:00.000Z',
    treatmentRecord: '完整治疗记录正文不应展示',
    consultationTranscript: '咨询对话全文不应展示',
  },
]
```

期望 UI 展示治疗项目、阶段、风险、摘要和下一步动作，同时不展示危险字段。

- [x] **步骤 2：扩展 CustomerTimelineDrawer**

增加治疗摘要 section：

- 标题使用“治疗结构化摘要”。
- 空态使用 `InstitutionPageState kind="empty"`。
- 节点展示项目、阶段、恢复阶段、风险、负责人、摘要、下一步动作和标签。
- 文案不得出现“完整病历”“完整治疗记录”“AI 生成建议”。

- [x] **步骤 3：运行 PR 4 验证**

运行：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

预期：全部通过。

**风险：**

- UI 展示危险额外字段。
- UI 文案暗示完整病历能力。
- 空数组导致旧 timeline response 测试不稳定。
- 移动端抽屉内容过长造成布局问题。

**控制：**

- UI 只从 typed DTO 字段读取。
- 测试扫描完整治疗记录正文、咨询全文、手机号原文、身份证号、病历号原文、SQL、stack、token、secret。
- 使用现有 `InstitutionPageState` 处理空态。

## PR 5：Phase 12 smoke / 文档收尾

状态：已完成。

**范围：**

- 补 smoke 测试。
- 更新 README / roadmap / devlog。
- 更新 Phase 12 spec / plan 为完成状态。
- 标记 Phase 12 完成。

**涉及文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase12-treatment-summary-v1-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase12-treatment-summary-v1.md`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**步骤：**

- [x] **步骤 1：补 workspace smoke**

在 `WorkspaceEntryPages.test.tsx` 中覆盖：

- 机构端进入客户中心。
- 打开客户详情时间线。
- 展示治疗结构化摘要。
- 展示 `treatment_summary` timeline event。
- 请求不携带 `tenantId`。
- 不发送 mutation。
- 不展示完整治疗记录正文、完整病历正文、诊疗原文、咨询全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 生成内容、外部系统同步原文、请求体、SQL、stack、token、secret、`DATABASE_URL` 或连接串。

- [x] **步骤 2：更新 README**

在当前范围中新增 Phase 12 完成摘要，明确：

- 治疗记录结构化摘要 v1 已完成。
- 只做摘要。
- 不做完整病历正文。
- 不做 AI。
- 不接外部系统。

- [x] **步骤 3：更新 roadmap**

更新路线图已完成阶段和后续阶段，明确知识库 / RAG、AI、企微、外部系统和商业化写入能力仍后置。

- [x] **步骤 4：更新 devlog**

记录 PR 1-5 的范围、验证结果和边界。

- [x] **步骤 5：运行全量验证**

运行：

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

预期：全部通过。

**风险：**

- README 把 Phase 12 误写成完整治疗记录能力。
- roadmap 把 AI / RAG 或外部系统提前。
- smoke 遗漏敏感字段扫描。

**控制：**

- 文档统一使用“结构化治疗摘要”。
- 文档明确不包含完整正文、AI、外部系统和写入 UI。
- 全量验证必须在 Phase 12 收尾 PR 中执行。

## 不纳入 Phase 12

Phase 12 明确不做：

- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 图片 / 文件原文。
- AI provider。
- AI 生成治疗建议。
- Agent。
- 真实 RAG 问答。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 自动触达客户。
- 大规模 UI 重构。
- 治疗摘要写入 UI。
- 外部系统同步。

## 执行顺序

1. [x] 先合并 PR 1 文档。
2. [x] PR 1 合并后执行 PR 2 schema / migration / seed / repository / DTO 白名单测试。
3. [x] PR 2 合并后执行 PR 3 customer timeline domain 与 API 扩展。
4. [x] PR 3 合并后执行 PR 4 客户详情抽屉 UI 展示。
5. [x] PR 4 合并后执行 PR 5 smoke / 文档收尾。

不得跳过 PR 1 直接进入代码实现。不得在 PR 1 修改业务代码。不得在 PR 2 同时做 API 或 UI。不得在 PR 3 同时做 UI。不得在 PR 4 新增治疗写入 UI。

## Phase 12 完成标准

Phase 12 完成后应满足：

- 新增最小治疗摘要表和安全 seed。
- 治疗摘要通过 `tenant_id + customer_id` 关联当前租户客户。
- 可选 `appointment_id` 不允许跨租户。
- 客户详情 timeline API 返回 `treatmentSummaries`。
- 客户详情 `timeline` 包含 `type: "treatment_summary"` event。
- 客户详情抽屉展示治疗结构化摘要。
- 治疗摘要读取不接受前端传入 `tenantId`。
- 不新增独立治疗详情 API。
- 不新增独立治疗详情页面。
- 不新增治疗写入 UI。
- 不保存或返回完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 生成内容、外部系统同步原文、请求体、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- README、roadmap、devlog 和 Phase 12 spec / plan 与实际完成范围一致。

Phase 12 PR 5 收尾完成后，后续只进入 Phase 13 Plan Mode，不在 Phase 12 分支继续扩展 AI、RAG、企微、外部系统、商业化写入或治疗正文能力。

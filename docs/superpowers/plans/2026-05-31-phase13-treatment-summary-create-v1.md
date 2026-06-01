# Phase 13 治疗摘要人工录入 v1 实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 在客户详情上下文中新增结构化治疗摘要人工录入能力，写入成功后进入现有客户详情 timeline。

**架构方案：** Phase 13 默认不新增数据库 schema / migration，复用 Phase 12 已完成的 `treatment_summaries` 表、repository 读路径和 timeline 展示。实现顺序为：先补 parser / repository create / `treatment_summary` RBAC 与 audit 语义，再新增客户子路径 POST API，最后在客户详情抽屉接入结构化表单并做 smoke / 文档收尾。

**技术栈：** Next.js 16、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、现有 demo access context、现有 audit repository、现有 customer timeline API。

---

## 当前 PR 状态

当前是 Phase 13 PR 1，只做文档：

- 新增 `docs/superpowers/specs/2026-05-31-phase13-treatment-summary-create-v1-design.md`。
- 新增 `docs/superpowers/plans/2026-05-31-phase13-treatment-summary-create-v1.md`。
- 不改业务代码。
- 不改页面。
- 不改测试。
- 不改 API route。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。
- 不进入 Phase 13 PR 2/3/4/5 的代码执行。

## 总边界

Phase 13 做：

- 治疗摘要人工录入 v1。
- 结构化字段白名单。
- 服务端 tenant 推导。
- customer 同租户校验。
- appointment 同租户 / 同 customer 校验。
- 创建成功后进入现有 timeline。
- allowed / denied 审计。
- UI 结构化表单和 smoke。

Phase 13 不做：

- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件上传。
- 图片 / 文件原文保存。
- AI provider。
- AI 生成治疗建议。
- Agent。
- RAG。
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
- 治疗摘要编辑 / 删除。
- 治疗摘要管理列表。
- 平台端治疗摘要下钻。
- 外部系统同步。

## 文件职责规划

### PR 1 只新增文档

- `docs/superpowers/specs/2026-05-31-phase13-treatment-summary-create-v1-design.md`
  - Phase 13 目标、方向选择、字段白名单、禁止字段、API 路径、RBAC 决策、审计设计、appointment 校验、payload parser、隐私拦截、租户隔离、PR 拆分和完成标准。
- `docs/superpowers/plans/2026-05-31-phase13-treatment-summary-create-v1.md`
  - Phase 13 后续 PR 执行计划、文件范围、风险和验证方式。

### PR 2 建议文件

- `src/modules/institution/server/treatment-summary-write-input.ts`
  - 新增 `CreateTreatmentSummaryPayload` 和 `parseCreateTreatmentSummaryPayload()`。
  - 负责字段白名单、类型校验、时间校验、风险枚举校验、tags 校验、敏感字段 / 敏感值拒绝。
- `src/modules/institution/server/treatment-summary-repository.ts`
  - 新增 create 方法，写入 `treatment_summaries` 并返回安全领域记录。
  - 保持 list 方法不变。
- `src/modules/institution/domain/treatment-summaries.ts`
  - 如需要，新增 create DTO 类型或复用现有 `CustomerTimelineTreatmentSummary`。
  - 保持 mapper 不返回 `tenantId` / `customerId`。
- `src/modules/security/domain/access-control.ts`
  - 推荐新增 `treatment_summary` resource。
  - 为 `tenant_admin` 增加 `read_own_tenant` 和 `create`。
  - 将 `treatment_summary` 纳入 sensitive resources。
  - 不改 `AccessContext`、角色体系和 `canAccessResource()` 主结构。
- `src/modules/audit/domain/audit-events.ts`
  - 如采用 appointment 同租户但不同 customer 的稳定冲突审计，新增 `invalid_treatment_summary_reference` reason。
- `src/modules/audit/domain/audit-event-query.ts`
  - 新 reason 进入 `AUDIT_REASON_VALUES`。
  - `treatment_summary` resource 通过 `ProtectedResource` 自动进入 parser 资源白名单。
- `src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts`
  - 新增 payload parser 测试。
- `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
  - 扩展 create 方法测试。
- `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
  - 扩展 DTO 白名单和敏感字段扫描测试。
- `src/modules/security/tests/AccessControlDomain.test.ts`
  - 覆盖 `treatment_summary` resource 权限边界。
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
  - 覆盖 `treatment_summary` resource 和新 reason。
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
  - 覆盖 resource / reason 白名单。

### PR 3 建议文件

- `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
  - 新增 POST route。
  - 从 access context 推导 tenant。
  - 调用 parser、customer 校验、appointment 校验、repository create 和 audit record。
- `src/modules/institution/server/tenant-business-repository.ts`
  - 新增最小 appointment 归属查询方法，例如 `getAppointmentByTenantAndId()` 或 `appointmentBelongsToTenantAndCustomer()`。
- `src/modules/institution/server/tenant-business-audit-transaction.ts`
  - 如需要，扩展 transaction dependencies，或在 route 中直接用 treatment summary repository + audit repository 的 transaction。
- `src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts`
  - 新增 POST API route 测试。
- `src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts`
  - 确认新建后的治疗摘要仍由现有 timeline 安全 DTO 展示。
- `src/modules/audit/tests/AuditEventRepository.test.ts`
  - 确认治疗摘要创建审计不携带请求体或敏感字段。

### PR 4 建议文件

- `src/modules/institution/client/tenant-business-client.ts`
  - 新增 `createTreatmentSummary(customerId, payload)` client helper。
  - request body 只 pick 白名单字段。
- `src/modules/institution/components/CustomerTimelineDrawer.tsx`
  - 增加“新增治疗摘要”入口和结构化表单。
  - 成功后通知父组件刷新 timeline，或在 drawer 内触发 refresh。
- `src/modules/institution/components/CustomerCenterShell.tsx`
  - 如 drawer 外层负责重新拉取 timeline，则补 refresh handler。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖 client helper 不发送 `tenantId` / `customerId` / 禁止字段。
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - 覆盖结构化表单、成功刷新、错误态和敏感字段不展示。

### PR 5 建议文件

- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 补 workspace smoke：打开客户详情，创建治疗摘要，刷新 timeline，确认 `treatment_summary` 节点出现。
  - 确认请求 body 不含 `tenantId`、完整正文、PII、SQL、stack、token、secret。
- `README.md`
  - 标记 Phase 13 完成范围。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 更新 Phase 13 状态和后续建议。
- `docs/devlog/2026-05-31.md`
  - 记录 Phase 13 PR 1-5 范围、验证和边界。
- `docs/superpowers/specs/2026-05-31-phase13-treatment-summary-create-v1-design.md`
  - 更新为完成状态。
- `docs/superpowers/plans/2026-05-31-phase13-treatment-summary-create-v1.md`
  - 更新执行状态和完成标准。

## 字段与 payload 约定

允许 payload 字段：

```ts
type CreateTreatmentSummaryPayload = {
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
};
```

服务端生成：

- `id`
- `tenantId`
- `customerId`
- `createdAt`
- `updatedAt`

禁止 request body 字段：

- `tenantId`
- `customerId`
- `id`
- `createdAt`
- `updatedAt`
- `phoneNumber`
- `idNumber`
- `medicalRecordNo`
- `rawPhone`
- `rawIdCard`
- `rawMedicalRecordNo`
- `treatmentRecord`
- `treatmentRecordBody`
- `medicalRecord`
- `medicalRecordBody`
- `diagnosisText`
- `clinicalNote`
- `consultationTranscript`
- `imageUrl`
- `fileUrl`
- `fileContent`
- `imageContent`
- `requestBody`
- `rawPayload`
- `metadata`
- `aiGeneratedContent`
- `externalSyncPayload`
- `sql`
- `stack`
- `token`
- `secret`
- `databaseUrl`

## 审计约定

成功创建：

```ts
createAuditEvent({
  eventId,
  context,
  resource: 'treatment_summary',
  resourceId: record.id,
  action: 'create',
  result: 'allowed',
  reason: 'allowed_by_policy',
  occurredAt,
});
```

拒绝场景：

- 未登录：`401`，不初始化数据库，不写审计。
- RBAC 拒绝：`403`，写 denied 审计，reason 使用 access decision reason。
- 缺少 tenant：`403`，写 denied 审计，reason 为 `missing_tenant`。
- customer 不存在或不属于当前 tenant：`404`，可写 denied 审计，不写未确认 id 到 `resourceId`。
- appointment 不存在或不属于当前 tenant：`404`，可写 denied 审计，不写未确认 appointment id 到 `resourceId`。
- appointment 同租户但不同 customer：`409`，建议 reason 为 `invalid_treatment_summary_reference`。
- parser 拒绝：`400`，默认不写审计，避免记录未信任请求体。
- 数据服务异常：`503`，不泄露错误详情。

审计禁止包含：

- 请求体。
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

## PR 1：Phase 13 spec / plan 文档

**范围：**

- 新增 Phase 13 spec 文档。
- 新增 Phase 13 plan 文档。
- 明确本阶段选择治疗摘要人工录入 v1。
- 明确治疗摘要管理、RAG、平台商业化增强后置。
- 明确字段白名单、禁止字段、API 路径、RBAC 推荐方案、审计设计、appointment 校验、payload parser、PII / 医疗隐私拦截、租户隔离和 PR 拆分。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。
- 不进入 PR 2/3/4/5 的代码执行。

**风险：**

- 文档范围过大，误导后续实现混入完整治疗正文、AI、RAG、外部系统或平台商业化。
- 文档没有明确 RBAC 推荐，导致后续 PR 在 `customer` 和 `treatment_summary` resource 之间摇摆。
- 文档没有明确 parser 和 appointment 校验，导致 PR 3 直接依赖数据库外键报错。

**控制：**

- 文档明确推荐新增 `treatment_summary` resource。
- 文档明确不新增 schema / migration。
- 文档明确 POST route 不接受前端 `tenantId`。
- 文档明确 appointment 必须同租户且同 customer。
- 文档明确禁止完整正文、图片/文件、AI、外部系统和敏感错误细节。

**验证：**

运行：

```bash
git diff --check
```

预期：无输出，exit 0。

本 PR 只修改 Markdown，不运行完整 test / typecheck / build。原因：未修改 TypeScript、React 页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

## PR 2：payload parser、domain、repository create、RBAC / audit 决策测试

**范围：**

- 新增治疗摘要写入 payload parser。
- 新增 repository create 方法。
- 新增 `treatment_summary` access resource。
- 为 `tenant_admin` 增加 `treatment_summary` 的 `read_own_tenant` 和 `create`。
- 将 `treatment_summary` 纳入 sensitive resources。
- 新增稳定 audit reason `invalid_treatment_summary_reference`。
- 补 parser、repository、domain、RBAC、audit reason 和 query parser 测试。
- 不新增 API route。
- 不新增 UI。
- 不新增 schema / migration。

**步骤：**

- [ ] **步骤 1：编写 payload parser 失败测试**

  修改 `src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts`，覆盖：

  ```ts
  expect(parseCreateTreatmentSummaryPayload({
    treatmentDate: '2026-06-01T12:00:00+08:00',
    treatmentProject: '光电修复',
    treatmentCategory: 'laser_repair',
    treatmentStage: 'D7 复诊',
    recoveryStage: 'D7',
    riskLevel: 'watch',
    ownerUserId: 'doctor-lin',
    summary: '结构化摘要：恢复进展稳定。',
    nextCareAction: 'D14 人工回访恢复阶段。',
    tags: ['结构化摘要'],
  })).toEqual({
    ok: true,
    value: expect.objectContaining({
      appointmentId: null,
      riskLevel: 'watch',
    }),
  });
  ```

  同文件必须覆盖拒绝 `tenantId`、`customerId`、`treatmentRecordBody`、`medicalRecordBody`、手机号原文、身份证号、`DATABASE_URL`、`postgres://`、`token`、`secret`。

- [ ] **步骤 2：运行 parser 测试并确认失败**

  运行：

  ```bash
  node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts
  ```

  预期：因为 `treatment-summary-write-input.ts` 尚不存在而失败。

- [ ] **步骤 3：实现 parser**

  新增 `src/modules/institution/server/treatment-summary-write-input.ts`，实现：

  ```ts
  export type CreateTreatmentSummaryPayload = {
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
  };

  export function parseCreateTreatmentSummaryPayload(
    input: unknown,
  ): { ok: true; value: CreateTreatmentSummaryPayload } | { ok: false; error: string } {
    // 按 spec 实现 plain object、字段白名单、枚举、时间、长度、tags 和敏感内容校验。
  }
  ```

  实现时可复用 `tenant-business-write-input.ts` 中 ISO-like timestamp、PII 检测和 tags 校验思路，但不要把 parser 混进客户 / 预约 parser。

- [ ] **步骤 4：编写 repository create 失败测试**

  扩展 `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`，验证：

  - insert 写入 `treatmentSummaries`。
  - 使用调用方传入的 `tenantId` 和 route 确认的 `customerId`。
  - `appointmentId` 可为 null。
  - 返回 `mapTreatmentSummaryRowToRecord()`。
  - 不写入或返回禁止字段。

- [ ] **步骤 5：实现 repository create**

  修改 `src/modules/institution/server/treatment-summary-repository.ts`：

  ```ts
  async createTreatmentSummary(input: typeof treatmentSummaries.$inferInsert) {
    const [row] = await database.insert(treatmentSummaries).values(input).returning();
    return mapTreatmentSummaryRowToRecord(row);
  }
  ```

  如果需要更窄输入类型，定义 `CreateTreatmentSummaryInput`，不要暴露任意 `Record<string, unknown>`。

- [ ] **步骤 6：编写 RBAC / audit 失败测试**

  修改：

  - `src/modules/security/tests/AccessControlDomain.test.ts`
  - `src/modules/audit/tests/AuditEventsDomain.test.ts`
  - `src/modules/audit/tests/AuditEventQueryParser.test.ts`

  覆盖：

  - `tenant_admin` 可 `create` `treatment_summary`。
  - `platform_admin` 不可读取 sensitive treatment summary detail。
  - audit 支持 `resource=treatment_summary`。
  - audit reason 支持 `invalid_treatment_summary_reference`。

- [ ] **步骤 7：实现 RBAC / audit 最小扩展**

  修改：

  - `src/modules/security/domain/access-control.ts`
  - `src/modules/audit/domain/audit-events.ts`
  - `src/modules/audit/domain/audit-event-query.ts`

  只新增资源、最小 policy、sensitive resource 和新 reason，不改权限模型主结构。

- [ ] **步骤 8：运行 PR 2 定向验证**

  运行：

  ```bash
  node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts src/modules/institution/tests/TreatmentSummaryRepository.test.ts src/modules/institution/tests/TreatmentSummaryDomain.test.ts src/modules/security/tests/AccessControlDomain.test.ts src/modules/audit/tests/AuditEventsDomain.test.ts src/modules/audit/tests/AuditEventQueryParser.test.ts
  ./node_modules/.bin/tsc --noEmit
  ```

  预期：全部通过。

**风险：**

- parser 漏放自由字段。
- parser 只做字段名校验，不扫描敏感值。
- repository create 使用过宽输入。
- RBAC 扩展误改现有角色权限。
- 新 reason 未进入 audit query parser。

**验证方式：**

- 定向 vitest。
- `tsc --noEmit`。
- `git diff --check`。

## PR 3：新增 POST API route

**范围：**

- 新增 `POST /api/institution/customers/[customerId]/treatment-summaries`。
- 按 access context 推导 tenant。
- 校验 customer 属于当前 tenant。
- 校验 appointment 同租户 / 同 customer。
- 调用 parser 和 repository create。
- 成功写 allowed 审计。
- 安全拒绝写 denied 审计。
- 返回安全 DTO。
- 不新增 UI。

**步骤：**

- [ ] **步骤 1：编写 API route 失败测试**

  新增 `src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts`，覆盖：

  - 成功创建返回 `201` 和安全 DTO。
  - route 使用 context tenant，不接受 body/query/header `tenantId`。
  - customer 不存在或不属于当前 tenant 返回 `404`。
  - appointment 不存在或不属于当前 tenant 返回 `404`。
  - appointment 同租户但不同 customer 返回 `409`。
  - payload 含完整正文或 PII 返回 `400`。
  - 未登录 `401` 且不初始化数据库。
  - 无权限 `403` 且写 denied 审计。
  - 数据异常 `503` 且不泄露 SQL / stack / token / secret / `DATABASE_URL`。

- [ ] **步骤 2：运行 API route 测试并确认失败**

  运行：

  ```bash
  node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts
  ```

  预期：route 文件尚不存在而失败。

- [ ] **步骤 3：补 appointment 归属查询方法**

  修改 `src/modules/institution/server/tenant-business-repository.ts`，新增最小方法：

  ```ts
  async getAppointmentByTenantAndId(input: { tenantId: string; id: string }) {
    const [row] = await database
      .select()
      .from(appointments)
      .where(and(eq(appointments.tenantId, input.tenantId), eq(appointments.id, input.id)));

    return row ? mapAppointmentRowToRecord(row) : null;
  }
  ```

- [ ] **步骤 4：实现 POST route**

  新增 `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`，按以下顺序处理：

  1. 读取 access context；无 context 返回 `401`。
  2. 校验 `treatment_summary/create` 权限；拒绝返回 `403` 并写 denied 审计。
  3. 读取 JSON；非法 JSON 返回 `400`。
  4. 调用 `parseCreateTreatmentSummaryPayload()`；失败返回 `400`。
  5. 用 `tenantId + customerId` 查询 customer；不存在返回 `404`。
  6. 如有 appointmentId，用 `tenantId + appointmentId` 查询 appointment；不存在返回 `404`。
  7. 如 appointment.customerId 与 URL customerId 不一致，返回 `409` 并写 denied 审计。
  8. 在 transaction 中 create treatment summary 并写 allowed 审计。
  9. 返回 `{ record: safeDto }`，status `201`。
  10. catch 中返回稳定 `503`。

- [ ] **步骤 5：确认 existing timeline 可读新摘要**

  扩展 `src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts` 或新增集成式 route mock 测试，确认 POST 返回的 DTO 字段与 timeline DTO 一致，且不包含 `tenantId` / `customerId`。

- [ ] **步骤 6：运行 PR 3 定向验证**

  运行：

  ```bash
  node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts src/modules/audit/tests/AuditEventRepository.test.ts
  ./node_modules/.bin/tsc --noEmit
  ```

  预期：全部通过。

**风险：**

- route 在 parser 前初始化过多依赖，导致 400 场景写入审计或泄露错误。
- body 中 `tenantId` 绕过租户隔离。
- appointment 跨客户仍被写入。
- 审计记录请求体。
- transaction 外写审计导致业务写入和审计不一致。

**验证方式：**

- API route 单元测试。
- customer timeline route 回归测试。
- audit repository 测试。
- `tsc --noEmit`。
- `git diff --check`。

## PR 4：客户详情抽屉结构化录入 UI

**范围：**

- 在客户详情抽屉增加“新增治疗摘要”入口。
- 只做结构化表单。
- 新增 client helper。
- 成功后刷新 timeline。
- 不支持图片 / 文件 / AI / 完整正文。

**步骤：**

- [ ] **步骤 1：编写 client helper 失败测试**

  修改 `src/modules/institution/tests/TenantBusinessClient.test.ts`，覆盖：

  ```ts
  await createTreatmentSummary('cust_001', {
    appointmentId: 'appt_001',
    treatmentDate: '2026-06-01T12:00:00+08:00',
    treatmentProject: '光电修复',
    treatmentCategory: 'laser_repair',
    treatmentStage: 'D7 复诊',
    recoveryStage: 'D7',
    riskLevel: 'watch',
    ownerUserId: 'doctor-lin',
    summary: '结构化摘要：恢复进展稳定。',
    nextCareAction: 'D14 人工回访。',
    tags: ['术后关怀'],
  }, { fetcher });
  ```

  断言 fetch path 为 `/api/institution/customers/cust_001/treatment-summaries`，method 为 `POST`，body 不包含 `tenantId`、`customerId`、完整正文或敏感字段。

- [ ] **步骤 2：实现 client helper**

  修改 `src/modules/institution/client/tenant-business-client.ts`：

  - 新增 `CreateTreatmentSummaryClientPayload`。
  - 新增 `createTreatmentSummary(customerId, payload, options)`。
  - 使用白名单 pick，禁止发送服务端生成字段。

- [ ] **步骤 3：编写 UI 失败测试**

  修改 `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`，覆盖：

  - 打开客户详情抽屉。
  - 点击“新增治疗摘要”。
  - 填写结构化字段。
  - 提交成功后重新请求 timeline。
  - 新治疗摘要出现在“治疗结构化摘要”和 timeline 节点中。
  - 请求 body 不含 `tenantId` / `customerId`。
  - UI 不展示完整正文、图片、文件、AI 或外部系统入口。

- [ ] **步骤 4：实现 UI**

  修改 `src/modules/institution/components/CustomerTimelineDrawer.tsx`：

  - 新增折叠或内联结构化表单。
  - 字段使用 input/select/textarea，但 textarea 仅用于短摘要和下一步护理。
  - 风险等级使用 select，取值 `normal | watch | urgent`。
  - tags 用逗号分隔输入或小型 tag 输入。
  - 提交中禁用按钮。
  - 成功后清空表单并触发刷新。

  如刷新逻辑在父组件更自然，则修改 `src/modules/institution/components/CustomerCenterShell.tsx`，给 drawer 传入 `onTreatmentSummaryCreated` 或 `refreshTimeline`。

- [ ] **步骤 5：运行 PR 4 定向验证**

  运行：

  ```bash
  node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/InstitutionBusinessShells.test.tsx
  ./node_modules/.bin/tsc --noEmit
  ```

  预期：全部通过。

**风险：**

- 抽屉内表单过重，影响客户详情查看。
- 前端校验过度复杂，和服务端 parser 不一致。
- 成功后没有刷新 timeline。
- UI 文案诱导输入完整治疗正文。
- 错误提示回显敏感原文。

**验证方式：**

- client helper 测试。
- UI 交互测试。
- `tsc --noEmit`。
- `git diff --check`。

## PR 5：smoke / 文档收尾

**范围：**

- 补 workspace smoke。
- 更新 README / roadmap / devlog。
- 更新 Phase 13 spec / plan 完成状态。
- 运行全量验证。

**步骤：**

- [ ] **步骤 1：补 workspace smoke**

  修改 `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`，新增 smoke 覆盖：

  - 机构端进入客户中心。
  - 打开客户详情。
  - 新增结构化治疗摘要。
  - POST 请求 body 不含 `tenantId`、完整正文、PII、SQL、stack、token、secret。
  - 成功后刷新 timeline。
  - 显示 `treatment_summary` 节点和新摘要。

- [ ] **步骤 2：补敏感字段 smoke**

  同文件或现有 UI 测试确认页面不展示：

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
  - SQL / stack / token / secret / `DATABASE_URL` / 连接串。

- [ ] **步骤 3：更新 README**

  修改 `README.md`，加入 Phase 13 完成摘要：

  - 治疗摘要人工录入 v1。
  - POST API。
  - 结构化表单。
  - 写入后进入 timeline。
  - 不包含完整正文、文件、AI、RAG、外部系统。

- [ ] **步骤 4：更新 roadmap**

  修改 `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`：

  - 标记 Phase 13 已完成。
  - 后续建议治疗摘要管理 v1、知识库/RAG 安全 Plan Mode、平台商业化后续增强继续后置。

- [ ] **步骤 5：更新 devlog**

  修改 `docs/devlog/2026-05-31.md`：

  - 记录 PR 1-5 范围。
  - 记录验证结果。
  - 记录未进入内容。

- [ ] **步骤 6：更新 Phase 13 spec / plan 完成状态**

  修改本 spec / plan：

  - 状态改为 Phase 13 已完成。
  - 标记 PR 1-5 完成摘要。
  - 保持实际范围与代码一致。

- [ ] **步骤 7：运行全量验证**

  运行：

  ```bash
  git diff --check
  node scripts/run-vitest.mjs run
  ./node_modules/.bin/tsc --noEmit
  node scripts/run-next.mjs build --webpack
  ```

  预期：全部通过。

**风险：**

- 文档宣称编辑、管理、AI 或外部系统已完成。
- smoke 没有覆盖提交 body 安全边界。
- 全量 build 暴露 UI 类型问题。

**验证方式：**

- 全量 vitest。
- TypeScript。
- Next build。
- `git diff --check`。

## 执行顺序

1. [x] PR 1：Phase 13 spec / plan 文档。
2. [ ] PR 2：payload parser、domain、repository create、RBAC / audit 决策测试。
3. [ ] PR 3：新增 POST API route。
4. [ ] PR 4：客户详情抽屉结构化录入 UI。
5. [ ] PR 5：smoke / 文档收尾。

## Phase 13 完成标准

- 机构端可在客户详情上下文创建结构化治疗摘要。
- 创建请求不发送也不接受 `tenantId`。
- body 只允许治疗摘要字段白名单。
- 服务端校验 customer 属于当前 tenant。
- 服务端校验 appointment 同租户 / 同 customer。
- 成功创建后返回安全 DTO。
- 成功创建后现有 timeline API 可读取并展示新摘要。
- 成功写入 allowed 审计。
- 安全拒绝场景写 denied 审计。
- 审计不包含请求体、完整正文、PII、SQL、stack、token、secret 或连接串。
- UI 不提供完整病历、完整治疗正文、文件上传、AI 或外部同步入口。
- 不新增 schema / migration。
- 不改认证模型。
- 不改租户推导方式。
- 不进入 AI provider、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同或发票。
- README、roadmap、devlog 和 Phase 13 spec / plan 与实际完成范围一致。

## PR 1 验证说明

本 PR 只新增 Markdown 文档。验证命令：

```bash
git diff --check
```

不运行完整 `node scripts/run-vitest.mjs run`、`./node_modules/.bin/tsc --noEmit` 或 `node scripts/run-next.mjs build --webpack`。原因：PR 1 未修改 TypeScript、React 页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

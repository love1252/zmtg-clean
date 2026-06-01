# Phase 12 治疗记录结构化摘要 v1 设计

> 日期：2026-05-31
> 状态：Phase 12 已完成。本文固化治疗记录结构化摘要 v1 的目标、范围、字段白名单、安全边界、API / schema 决策、租户隔离、PR 拆分和完成状态。

## 1. Phase 12 目标

Phase 12 默认选择“治疗记录结构化摘要 v1”，目标是在 Phase 7 已完成的客户详情时间线基础上，为单客户详情补充结构化治疗节点。

本阶段 v1 目标：

- 新增最小治疗摘要数据底座。
- 为客户详情时间线补充治疗摘要数组。
- 在客户详情 `timeline` 中增加治疗事件节点。
- 只展示结构化摘要，不展示完整治疗记录正文。
- 只展示脱敏、安全、可解释的字段。
- 保持服务端租户上下文推导，不接受前端 `tenantId`。
- 用 `tenant_id + customer_id` 复合关系保证治疗摘要归属当前租户客户。
- 如治疗摘要关联预约，必须保证 `appointment_id` 与当前租户一致。
- 不接 AI provider，不做 AI 生成，不接外部系统。

Phase 12 v1 延续当前项目的核心安全原则：机构端租户编号只能来自服务端访问上下文；前端不能通过 URL、header、body 或浏览器缓存切换租户；任何治疗、病历、咨询、文件和外部同步原文都不能进入 schema、DTO、UI、测试快照或审计输出。

## 2. 为什么优先做治疗记录结构化摘要 v1

Phase 5 到 Phase 11 已经完成了从机构业务闭环到平台商业化健康的关键底座：

- Phase 5：客户中心、预约中心、智能随访接入真实 API。
- Phase 6：机构工作台首页真实化，页面状态和导航边界统一。
- Phase 7：客户详情时间线 v1 已聚合客户、预约、随访和安全审计摘要。
- Phase 8：机构端 / 平台端审计日志只读查询完成。
- Phase 9：平台租户管理基础版完成。
- Phase 10：客户 / 预约创建套餐配额 enforcement 轻量版完成。
- Phase 11：平台商业化健康只读运营辅助完成。

治疗摘要是 Phase 7 客户详情时间线最自然的纵深扩展。当前客户详情已经能看到客户摘要、预约摘要、随访摘要和审计摘要，但缺少医美业务中最关键的“已做过什么治疗、处于哪个恢复阶段、下一步护理动作是什么”的结构化节点。

优先做治疗摘要的价值：

- 业务价值高：支撑术后关怀、复诊复购、客户画像和客服承接。
- 产品连续性强：直接扩展现有客户详情时间线，不需要新页面和大规模 UI 重构。
- 工程边界清楚：可以先做只读摘要，不做写入 UI，不接外部系统。
- 安全治理可控：用字段白名单和 DTO mapper 控制医疗隐私面。
- SaaS 交付关键：客户详情中出现治疗节点后，机构端业务闭环更接近真实医美运营场景。

相比继续做只读商业化增强，治疗摘要能补齐机构端核心业务价值；相比知识库 / RAG，治疗摘要更贴近已有客户、预约、随访和时间线模型，阶段边界更容易验证。

## 3. 为什么知识库 / RAG 和平台套餐继续增强后置

知识库 / RAG 基础准备有长期价值，但不适合作为 Phase 12 默认实现方向。

知识库即使不接真实 AI provider、不做 Agent、不做自动问答、不做复杂文件解析，也会提前引入以下设计负担：

- 租户级知识内容隔离。
- 文件或文档元数据结构。
- 后续分块、embedding、检索命中和内容安全的扩展路径。
- 文件正文、图片、附件和外部知识来源的隐私边界。
- 未来 AI provider、成本控制、提示词注入和问答输出审计。

如果 Phase 12 做知识库，很容易只落一个数据壳，或者过早锁死后续 RAG 架构。知识库应单独进入后续 Plan Mode，先明确是否只做 metadata、是否允许文本条目、是否有上传入口、是否有文件解析和是否进入检索测试。

平台套餐商业化管理继续增强的商业化价值最高，但 Phase 11 已经完成只读商业化健康视图，当前继续增强容易滑入：

- 套餐购买。
- 套餐变更。
- 续费。
- 支付。
- 合同。
- 发票。
- 租户冻结 / 恢复。
- 租户状态写入。
- 自动触达租户。
- 严格一致计费或配额计数器。

这些能力需要新的写入 API、审计、幂等、RBAC 和运营审批边界，不适合与治疗摘要混在同一阶段。平台套餐后续增强建议在 Phase 13 或单独 Plan Mode 中继续评估。

## 4. 治疗记录结构化摘要 v1 范围

Phase 12 v1 只做治疗结构化摘要的只读能力。

可以包含：

- 最小 `treatment_summaries` 类表。
- demo seed 治疗摘要数据。
- tenant-scoped repository 查询。
- 治疗摘要安全 DTO mapper。
- 客户详情 timeline domain 扩展。
- `GET /api/institution/customers/[customerId]/timeline` response 增加 `treatmentSummaries`。
- `timeline` 数组增加 `treatment` event 节点。
- 客户详情抽屉展示治疗结构化摘要。
- workspace smoke 覆盖治疗摘要展示和敏感字段不展示。
- README、roadmap、devlog、Phase 12 spec / plan 收尾。

不包含：

- 治疗摘要写入 UI。
- 独立治疗详情页。
- 独立治疗详情 API。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 文件、图片或附件原文。
- AI 生成治疗建议。
- 外部系统同步。

## 5. 不纳入本阶段

Phase 12 不做：

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
- 套餐购买。
- 套餐变更。
- 租户冻结 / 恢复。
- 平台商业化写入后台。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode，不应在 Phase 12 顺手扩大范围。

## 6. 治疗摘要字段白名单

治疗结构化摘要建议在 domain 层使用以下字段。

| 领域字段 | 建议数据库列 | 类型建议 | 是否返回机构端 DTO | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `id` | `varchar(64)` | 是 | 治疗摘要 ID |
| `tenantId` | `tenant_id` | `varchar(64)` | 否 | 仅服务端归属和查询使用，机构端 DTO 不返回 |
| `customerId` | `customer_id` | `varchar(64)` | 否 | 仅服务端归属和查询使用，timeline 事件可用 `relatedRecordId` 指向摘要 ID |
| `appointmentId` | `appointment_id` | `varchar(64) nullable` | 是 | 可选关联预约 ID，只能是同租户预约 |
| `treatmentDate` | `treatment_date` | `timestamp with time zone` | 是 | 治疗发生或记录日期 |
| `treatmentProject` | `treatment_project` | `varchar(160)` | 是 | 项目名，例如光电修复、注射复诊 |
| `treatmentCategory` | `treatment_category` | `varchar(96)` | 是 | 结构化类别，例如 `laser`、`injection`、`skin_care` |
| `treatmentStage` | `treatment_stage` | `varchar(120)` | 是 | 治疗阶段，例如初治、复诊、术后检查 |
| `recoveryStage` | `recovery_stage` | `varchar(120)` | 是 | 恢复阶段，例如 D3、D7、D28 或稳定恢复 |
| `riskLevel` | `risk_level` | enum 或 `varchar(24)` | 是 | 建议复用 `normal`、`watch`、`urgent` |
| `ownerUserId` | `owner_user_id` | `varchar(96)` | 是 | 负责人、医生、咨询师或客服的内部用户标识 |
| `summary` | `summary` | `text` | 是 | 结构化短摘要，必须禁止正文和原文 |
| `nextCareAction` | `next_care_action` | `text` | 是 | 下一步护理或人工跟进动作 |
| `tags` | `tags` | `jsonb string[]` | 是 | 安全标签，不包含原始 PII |
| `createdAt` | `created_at` | `timestamp with time zone` | 是 | 创建时间 |
| `updatedAt` | `updated_at` | `timestamp with time zone` | 是 | 更新时间 |

建议 DTO 命名：

- `TreatmentSummaryRecord`：服务端 repository 返回的内部记录，可以包含 `tenantId` 和 `customerId`。
- `CustomerTimelineTreatmentSummary`：timeline response 中的安全 DTO，不返回 `tenantId` 和 `customerId`。
- `CustomerTimelineEvent.type` 增加 `'treatment_summary'`。

`summary` 和 `nextCareAction` 必须是短摘要字段。它们可以描述“D7 复诊后安排补水护理”这种安全摘要，但不能保存“完整诊疗记录”“问诊原文”“医生病历正文”。

## 7. 明确禁止字段

Phase 12 schema、seed、repository、domain、DTO、API response、UI、测试快照、日志和审计中均禁止保存和返回：

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

禁止字段名示例：

- `treatmentRecord`
- `treatmentRecordBody`
- `medicalRecord`
- `medicalRecordBody`
- `diagnosisText`
- `clinicalNote`
- `consultationTranscript`
- `phoneNumber`
- `idNumber`
- `medicalRecordNo`
- `imageUrl`
- `fileUrl`
- `fileBody`
- `requestBody`
- `metadata`
- `rawPayload`
- `aiGeneratedContent`
- `externalSyncPayload`

PR 2 必须在 schema / migration / seed / DTO 测试中扫描这些词。PR 3 和 PR 4 必须在 API 和 UI 测试中再次扫描这些词。

## 8. 是否新增 API

Phase 12 v1 默认不新增独立治疗详情页面路由，也不新增独立治疗详情 API。

推荐 API 策略：

- 扩展现有 `GET /api/institution/customers/[customerId]/timeline`。
- response 顶层增加 `treatmentSummaries`。
- response `timeline` 数组增加 `treatment` event 节点。
- 服务端仍从 demo session / access context 推导当前租户。
- 仍用 `tenantId + customerId` 校验客户归属。
- 跨租户或不存在客户返回稳定 `404`。
- 未登录返回 `401`。
- 无权限返回 `403`。
- 数据服务异常返回稳定 `503`，不泄露错误详情。

建议 response 形态：

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

export type CustomerTimelineResponse = {
  customer: CustomerTimelineCustomerSummary;
  appointments: CustomerTimelineAppointmentSummary[];
  followups: CustomerTimelineFollowUpSummary[];
  treatmentSummaries: CustomerTimelineTreatmentSummary[];
  auditEvents: CustomerTimelineAuditSummary[];
  timeline: CustomerTimelineEvent[];
};
```

后续如需要治疗摘要列表 API、治疗摘要写入 API、治疗详情页或平台侧治疗摘要查询，必须单独进入 Plan Mode。

## 9. 是否新增 schema / migration

Phase 12 v1 需要新增最小 `treatment_summaries` 类表和 migration。

建议表名：

- `treatment_summaries`

必须包含：

- `id`
- `tenant_id`
- `customer_id`
- `appointment_id` nullable
- `treatment_date`
- `treatment_project`
- `treatment_category`
- `treatment_stage`
- `recovery_stage`
- `risk_level`
- `owner_user_id`
- `summary`
- `next_care_action`
- `tags`
- `created_at`
- `updated_at`

必须包含索引：

- `treatment_summaries_tenant_customer_date_idx` on `(tenant_id, customer_id, treatment_date)`
- `treatment_summaries_tenant_risk_date_idx` on `(tenant_id, risk_level, treatment_date)`
- 如支持预约关联，建议 `treatment_summaries_tenant_appointment_idx` on `(tenant_id, appointment_id)`

不得新增：

- 完整病历正文列。
- 完整治疗记录正文列。
- 咨询对话全文列。
- 图片 / 文件原文列。
- 外部系统原文列。
- AI 生成内容列。
- `metadata jsonb`。
- `request_body`。
- 原始手机号、身份证号、病历号列。

## 10. 租户隔离设计

Phase 12 v1 的服务端租户隔离要求：

- 机构端 timeline API 只能从服务端 access context 读取 `tenantId`。
- `GET /api/institution/customers/[customerId]/timeline` 不接受 query、header 或 body 中的 `tenantId`。
- 如果请求包含 `tenantId`，服务端必须忽略，测试必须证明它不参与查询。
- 查询客户详情时使用 `{ tenantId: context.tenantId, id: customerId }`。
- 查询治疗摘要时使用 `{ tenantId: context.tenantId, customerId }`。
- 关联预约时使用 `{ tenantId: context.tenantId, appointmentId }` 或复合外键保证同租户。
- 机构端 DTO 不返回 `tenantId`。
- 平台端不新增治疗摘要可见能力。

PR 3 的 API route 测试必须覆盖：

- URL query `tenantId=other-tenant` 不影响查询租户。
- Header `x-tenant-id: other-tenant` 不影响查询租户。
- Body 中伪造 `tenantId` 不影响查询租户。
- 跨租户 customerId 返回 `404`，且不继续查询治疗摘要。
- 治疗摘要 repository 只按当前 `tenantId + customerId` 查询。

## 11. 复合外键设计

`treatment_summaries` 必须通过 `tenant_id + customer_id` 复合关系关联 `customers`。

当前 `customers` 已有 `customers_tenant_id_id_unique`，Phase 12 PR 2 应新增：

```ts
customerFk: foreignKey({
  name: 'treatment_summaries_tenant_customer_fk',
  columns: [table.tenantId, table.customerId],
  foreignColumns: [customers.tenantId, customers.id],
})
```

如果 `appointment_id` 存在，也必须保证同租户。推荐方案：

1. 为 `appointments` 增加 `appointments_tenant_id_id_unique` on `(tenant_id, id)`，如果当前 schema 尚无该 unique constraint。
2. `treatment_summaries` 通过 `(tenant_id, appointment_id)` 复合外键关联 `(appointments.tenant_id, appointments.id)`。
3. `appointment_id` nullable 时，允许治疗摘要不关联预约。

建议 Drizzle 形态：

```ts
appointmentFk: foreignKey({
  name: 'treatment_summaries_tenant_appointment_fk',
  columns: [table.tenantId, table.appointmentId],
  foreignColumns: [appointments.tenantId, appointments.id],
})
```

如果执行时发现 nullable 复合外键在当前 Drizzle / PostgreSQL 迁移生成中需要特殊处理，PR 2 应保持 `appointment_id` nullable，并用 repository 查询和测试确保同租户，不应改为前端信任。

## 12. timeline API 扩展方式

Phase 12 v1 应扩展现有 customer timeline，而不是新增平行页面。

现有 timeline 聚合点：

- `src/modules/institution/domain/customer-timeline.ts`
- `src/app/api/institution/customers/[customerId]/timeline/route.ts`
- `src/modules/institution/components/CustomerTimelineDrawer.tsx`
- `src/modules/institution/client/tenant-business-client.ts`

推荐扩展：

- `CustomerTimelineResponse` 增加 `treatmentSummaries`。
- `CustomerTimelineEvent.type` 增加 `'treatment_summary'`。
- `CustomerTimelineEvent.source` 使用 `'treatment_summary'`。
- `treatment_summary` event 的 `occurredAt` 使用 `treatmentDate`。
- `treatment_summary` event 的 `title` 使用 `${treatmentProject} · ${treatmentStage}`。
- `treatment_summary` event 的 `summary` 使用安全 `summary` 或 `nextCareAction` 拼接的短摘要。
- `treatment_summary` event 的 `status` 使用 `riskLevel`。
- `treatment_summary` event 的 `relatedRecordId` 使用治疗摘要 `id`。

排序规则保持现有策略：

- 有时间的事件按时间倒序。
- 同一时间用稳定 ID 排序。
- 客户摘要事件仍稳定排在最后。

## 13. DTO 脱敏边界

治疗摘要 DTO 必须是白名单 mapper 的产物。不得直接返回数据库行。

允许返回：

- `id`
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

禁止返回：

- `tenantId`
- `customerId`
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

DTO mapper 测试必须使用带有额外危险字段的输入对象，验证输出序列化结果不包含危险字段和值。

## 14. PII / 医疗隐私风险

Phase 12 是当前路线中隐私风险最高的阶段之一，因为治疗摘要属于医疗相关业务信息。

主要风险：

- `summary` 被误用为完整治疗记录正文。
- `nextCareAction` 被误用为医生诊疗原文。
- `tags` 中混入手机号、身份证号、病历号原文。
- `appointmentId` 关联了其他租户预约。
- 平台侧或审计侧暴露治疗摘要明细。
- seed、测试快照或错误信息包含真实 PII。
- 后续 UI 被误写成完整病历查看入口。

控制方式：

- schema 不提供正文列、文件列、原文列和 `metadata jsonb`。
- write input 不在 Phase 12 暴露给 UI。
- repository 查询始终包含 `tenantId`。
- API DTO mapper 白名单输出。
- UI 文案使用“结构化治疗摘要”，不使用“完整病历”“病历正文”“治疗详情全文”。
- 测试扫描禁止字段和值。
- 数据服务异常统一返回稳定 `503`，不泄露 SQL、连接串、stack、token 或 secret。
- 文档和 smoke 明确 Phase 12 不接 AI、不接外部系统、不做自动触达。

## 15. 推荐 PR 拆分

Phase 12 推荐拆成 5 个 PR。

### PR 1：Phase 12 spec / plan 文档

范围：

- 新增 Phase 12 treatment summary design spec。
- 新增 Phase 12 treatment summary implementation plan。
- 固化字段白名单、禁止字段、API 策略、schema / migration 策略、复合外键、DTO 边界、风险和 PR 拆分。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。

风险：

- 文档边界不清，导致 PR 2-5 混入完整病历正文、AI、外部系统或治疗写入 UI。
- 未明确复合外键，导致治疗摘要可能跨租户关联客户或预约。
- 未明确 DTO 白名单，导致后续直接返回数据库行。

验证方式：

```bash
git diff --check
```

本 PR 只修改 Markdown，不运行完整 test / typecheck / build。原因：未修改 TypeScript、React 页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

### PR 2：schema / migration / seed / repository / DTO 白名单测试

范围：

- 新增 `treatment_summaries` 表。
- 新增 migration。
- 新增 demo seed 治疗摘要数据。
- 新增 treatment summary domain 类型。
- 新增 repository 查询。
- 新增 DTO 白名单 mapper。
- 新增 schema、migration、seed、repository、DTO 测试。
- 不新增 API。
- 不新增 UI。

风险：

- schema 出现正文列、原文列或 `metadata jsonb`。
- treatment summary 未通过 `tenant_id + customer_id` 复合外键关联客户。
- `appointment_id` 可跨租户。
- seed 或测试数据包含真实 PII 或医疗正文。

验证方式：

```bash
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts src/modules/institution/tests/TreatmentSummaryRepository.test.ts src/modules/institution/tests/TreatmentSummaryDomain.test.ts
./node_modules/.bin/tsc --noEmit
```

### PR 3：扩展 customer timeline domain 与 API

范围：

- 扩展 `src/modules/institution/domain/customer-timeline.ts`。
- 扩展 `GET /api/institution/customers/[customerId]/timeline`。
- response 增加 `treatmentSummaries`。
- `timeline` 增加 `treatment_summary` event。
- API route 查询治疗摘要时强制使用当前 `tenantId + customerId`。
- 不新增独立治疗 API。
- 不新增 UI。

风险：

- timeline API 返回 `tenantId` 或 `customerId`。
- 治疗摘要未按当前租户过滤。
- `treatment_summary` event 排序影响现有预约、随访、审计事件。
- 错误响应泄露数据库或敏感字段。

验证方式：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/CustomerTimelineDomain.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
```

### PR 4：客户详情抽屉 UI 展示治疗摘要

范围：

- 扩展 `src/modules/institution/components/CustomerTimelineDrawer.tsx`。
- 在客户详情抽屉中展示治疗结构化摘要。
- 在结构化时间线中展示治疗节点。
- 覆盖 loading、empty、error、敏感字段不展示和请求不携带 `tenantId`。
- 不新增治疗写入 UI。

风险：

- UI 暗示可查看完整病历或完整治疗详情。
- UI 渲染 API payload 中的危险额外字段。
- 治疗摘要 section 空态与现有页面状态不一致。
- 移动端抽屉信息拥挤或遮挡。

验证方式：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

### PR 5：Phase 12 smoke / 文档收尾

范围：

- 补 workspace smoke 覆盖客户中心打开详情并展示治疗摘要。
- 更新 `README.md`。
- 更新 `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`。
- 更新 `docs/devlog/2026-05-31.md`。
- 更新 Phase 12 spec / plan 为完成状态。
- 明确 Phase 12 未进入 AI / RAG / 企微 / 外部系统 / 写入 UI。

风险：

- 收尾文档把 Phase 12 描述成完整治疗记录或完整病历能力。
- smoke 只覆盖成功态，遗漏敏感字段不展示。
- README 或 roadmap 误写为接入 HIS / CRM / OTA。

验证方式：

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 16. Phase 12 完成标准

Phase 12 已完成，并满足：

- 存在最小治疗结构化摘要数据底座。
- 治疗摘要通过 `tenant_id + customer_id` 复合关系绑定当前租户客户。
- 可选 `appointment_id` 不允许跨租户。
- 客户详情 timeline API 返回 `treatmentSummaries`。
- 客户详情 `timeline` 包含 `type: "treatment_summary"` event 节点。
- 客户详情抽屉展示治疗结构化摘要。
- 所有机构端治疗摘要读取均由服务端租户上下文限定。
- 不新增治疗写入 UI。
- 不新增独立治疗详情页面。
- 不新增独立治疗详情 API。
- 不保存或返回完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 生成内容、外部系统同步原文、请求体、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- README、roadmap、devlog 和 Phase 12 spec / plan 与实际完成范围一致。
- PR 5 smoke 已覆盖客户中心进入客户详情、治疗摘要字段展示、`treatment_summary` 节点、无治疗摘要空态和敏感字段不展示。

## 17. Phase 13 建议

Phase 12 完成后，建议重新进入 Plan Mode 评估：

1. 平台租户状态管理和状态变更审计。
2. 更多资源配额 enforcement，例如随访任务、员工数或后续 AI 调用。
3. 知识库 / RAG 基础准备。
4. 审计高级治理：导出、告警和复杂风控。
5. 平台套餐商业化管理继续增强。
6. AI provider、调用日志和 Agent。
7. 企业微信、OAuth、Webhook、API Key。
8. 支付、合同、发票和完整计费能力。

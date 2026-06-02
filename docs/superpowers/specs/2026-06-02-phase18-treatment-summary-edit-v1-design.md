# Phase 18 治疗摘要编辑能力 v1 设计

> 日期：2026-06-02
> 状态：Phase 18 PR 1 文档阶段。本文只固化治疗摘要编辑能力 v1 的目标、范围、API 设计、权限、审计、隐私边界和后续 PR 拆分；不代表编辑能力已经实现。

## 1. Phase 18 目标

Phase 18 默认选择 **治疗摘要编辑能力 v1**。

目标是在机构端已经具备治疗摘要创建、列表管理、随访建议和来源治理之后，允许机构人员对结构化治疗摘要进行受控编辑。v1 只允许编辑明确白名单内的结构化字段，不允许编辑或保存完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文、AI 生成内容或外部系统同步原文。

Phase 18 v1 只回答：

- 机构端如何安全修改已经存在的结构化治疗摘要。
- 哪些字段可以被修改。
- 哪些字段必须永远不能由前端修改。
- PATCH API 如何校验租户、权限、payload 和 `appointmentId` 归属。
- 编辑成功或失败如何写稳定审计。
- 编辑后与既有随访任务的关系如何保持可追溯。

本阶段不做删除、不做作废、不做版本历史、不做 diff 展示、不接真实 HIS、不做外部系统同步、不自动触达客户。

## 2. 为什么优先做治疗摘要编辑能力 v1

Phase 12 到 Phase 16 已经完成治疗摘要内部闭环：

- Phase 12：治疗记录结构化摘要 v1，完成 `treatment_summaries` 数据底座、客户详情 timeline 接入和安全 DTO。
- Phase 13：治疗摘要人工录入 v1，完成创建 payload parser、POST API、客户详情录入 UI 和审计。
- Phase 14：治疗摘要管理能力 v1，完成机构端治疗摘要列表、筛选、分页和安全详情。
- Phase 15：治疗后护理 / 随访联动 v1，完成确定性建议和人工确认创建随访任务。
- Phase 16：随访任务来源治理 v1，完成治疗摘要来源展示、筛选和重复任务提示。

Phase 17 又完成 HIS 标准治疗事件 domain-only 契约，明确未来外部系统事件要先标准化，再进入治疗摘要、路径引擎、随访任务和经营分析。

当前最自然的缺口是：结构化治疗摘要一旦录入错误，机构端没有受控修正能力。这个缺口会影响后续：

- 随访建议的准确性。
- 治疗摘要管理页的运营可用性。
- 客户详情 timeline 的可信度。
- 未来 HIS 标准事件落到治疗摘要后的人工复核。
- 未来路径分析和经营智能的数据质量。

因此 Phase 18 优先补齐“可修改但不可越界”的治理能力，比继续只做底层 mapper 或提前做分析页面更贴近当前产品闭环。

## 3. 为什么其他方向后置

### 3.1 HIS 标准治疗事件 mapper 增强后置

HIS mapper 增强适合承接 Phase 17，技术风险也较低，但它仍是 domain-only 底层能力。连续两个阶段都只增强 HIS 标准模型，会推迟机构端对治疗摘要的实际治理能力。

Phase 18 不进入 mapper 增强，后续可以单独做：

- 项目分类标准化增强。
- 治疗阶段标准化增强。
- 金额和币种标准化增强。
- 标签标准化增强。
- mapper 错误语义和测试覆盖增强。

这些增强仍应保持不接真实 HIS、不写 Webhook、不新增 API、不新增数据库 schema / migration。

### 3.2 业务事件埋点体系 spec 后置

业务事件埋点体系是经营智能的重要底座，但事件模型一旦进入真实采集，就会涉及 event table、payload 白名单、幂等、保留周期、查询 API 和敏感字段扫描。

Phase 18 不做业务事件采集，也不新增 event table。后续如进入业务事件 spec，应先定义：

- 路径事件。
- 任务事件。
- 触达事件。
- 转化事件。
- 策略事件。
- 禁止 raw payload、完整医疗正文和 PII 的事件 payload 边界。

### 3.3 治疗摘要作废能力后置

作废能力有治理价值，但它是生命周期能力，不是编辑能力。作废需要单独设计：

- 作废状态字段。
- 作废原因。
- 作废人。
- 作废时间。
- 作废后列表、详情、timeline 和随访建议展示策略。
- 已有来源随访任务是否提示“来源摘要已作废”。

这些内容大概率需要 schema / migration。Phase 18 v1 默认不新增 schema / migration，因此作废后置。

### 3.4 随访路径运营分析 v1 后置

随访路径运营分析长期价值很高，但当前缺少稳定的路径事件、触达事件、回复事件、复诊事件、到院事件和二次消费事件。如果现在直接做分析页面，只能基于现有任务表做弱统计，容易误导机构经营判断。

随访路径运营分析应在业务事件模型、路径进入事件和转化事件口径稳定后推进。

## 4. 治疗摘要编辑 v1 范围

Phase 18 v1 可以做：

- 新增治疗摘要更新 payload parser。
- 只允许编辑结构化白名单字段。
- 扩展 `treatment_summary` resource 的 `update` 权限。
- 新增 repository update 方法，按 `tenantId + summaryId` 更新当前租户内记录。
- 新增 `PATCH /api/institution/treatment-summaries/[summaryId]`。
- 服务端从 access context 推导 `tenantId`。
- 服务端校验 treatment summary 属于当前 tenant。
- 如传入 `appointmentId`，校验 appointment 属于当前 tenant 且属于当前摘要的 `customerId`。
- 编辑成功返回安全 DTO。
- 编辑成功写 allowed audit。
- 非法 payload、无权限、缺少租户、记录不存在、appointment 引用非法等场景写稳定 audit。
- 机构端治疗摘要安全详情中增加受控编辑入口。
- 编辑成功后刷新治疗摘要列表 / 详情 / 相关 timeline 展示。
- smoke 覆盖请求不含 `tenantId`、敏感字段不展示、失败保留输入。

Phase 18 v1 不改变：

- 现有治疗摘要创建 API。
- 现有治疗摘要列表 API 的查询语义。
- 现有客户详情 timeline API 的安全 DTO 边界。
- 现有随访建议生成规则。
- 现有人工确认创建随访任务 API。
- 现有随访来源字段和重复任务提示。
- 现有数据库 schema。

## 5. 不纳入本阶段

Phase 18 不做：

- 治疗摘要删除。
- 治疗摘要作废。
- 版本历史。
- diff 展示。
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
- 个人微信自动发送。
- HIS / CRM / OTA 真实接入。
- 外部系统同步。
- 文件导入。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 自动触达客户。
- 大规模 UI 重构。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode。

## 6. 可编辑字段白名单

Phase 18 v1 只允许编辑现有 `treatment_summaries` schema 中的结构化字段：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `treatmentDate` | 是 | 治疗发生时间，使用有效 ISO-like 时间字符串，服务端标准化为 ISO |
| `treatmentProject` | 是 | 治疗项目，结构化短字段 |
| `treatmentCategory` | 是 | 治疗类别，用于后续建议和路径规则 |
| `treatmentStage` | 是 | 治疗阶段，例如 D7 复诊、疗程第 2 次 |
| `recoveryStage` | 是 | 恢复阶段 |
| `riskLevel` | 是 | 复用 `normal` / `watch` / `urgent` |
| `ownerUserId` | 是 | 负责人或录入负责人的内部引用 |
| `summary` | 是 | 结构化短摘要，不是完整治疗记录正文 |
| `nextCareAction` | 是 | 下一步护理或人工跟进动作 |
| `tags` | 是 | 安全标签数组 |
| `appointmentId` | 可选 | 可为空；传入时必须校验同租户且属于当前摘要客户 |

字段命名以现有 `treatment_summaries` schema、Phase 13 `parseCreateTreatmentSummaryPayload` 和现有 DTO 为准。

v1 建议采用“全量白名单编辑 payload”：PATCH 请求中提交上述字段的完整结构化快照。这样可以复用 Phase 13 创建 parser 的大部分校验语义，减少部分字段更新导致状态不完整的风险。

如果 PR 2 选择支持部分字段 PATCH，也必须保证：

- 至少提供一个可编辑字段。
- 所有出现的字段都必须通过同等强度的白名单和敏感字段校验。
- 未出现字段保持原值。
- 返回 DTO 仍为更新后的完整安全记录。

## 7. 禁止编辑字段

Phase 18 v1 明确禁止前端编辑：

- `id`
- `tenantId`
- `customerId`
- `createdAt`
- `updatedAt`
- 完整治疗记录正文
- 完整病历正文
- 诊疗原文
- 咨询对话全文
- 手机号原文
- 身份证号
- 病历号原文
- 图片 / 文件原文
- AI 生成内容
- 外部系统同步原文
- 请求体
- SQL
- stack
- token
- secret
- `DATABASE_URL`
- 连接串

禁止字段不得进入：

- PATCH payload。
- repository update input。
- API response DTO。
- 审计事件。
- UI 展示。
- 测试快照。
- 错误消息。

## 8. PATCH API 路径设计

建议新增：

```text
PATCH /api/institution/treatment-summaries/[summaryId]
```

API 规则：

1. 服务端从 session / access context 推导 `tenantId`。
2. 不接受前端传入 `tenantId`，包括 query、header、body 和 localStorage 派生值。
3. 校验当前用户具备 `treatment_summary:update` 权限。
4. 先校验 treatment summary 属于当前 tenant。
5. 如传入 `appointmentId`，必须校验 appointment 属于当前 tenant。
6. 如当前摘要有关联 `customerId`，必须校验 appointment 属于同一个 customer。
7. 只允许字段白名单。
8. 禁止完整正文和敏感字段。
9. 编辑成功后返回安全 DTO。
10. 编辑成功后写 allowed audit。
11. 非法、拒绝、not_found、invalid reference 场景写稳定审计。
12. 错误响应不泄露 SQL、stack、token、secret、`DATABASE_URL` 或连接串。

建议响应：

```json
{
  "record": {
    "id": "trt_001",
    "customerId": "cust_001",
    "appointmentId": "appt_001",
    "treatmentDate": "2026-06-02T08:30:00.000Z",
    "treatmentProject": "光电修复",
    "treatmentCategory": "laser_repair",
    "treatmentStage": "D7 复诊",
    "recoveryStage": "D7",
    "riskLevel": "watch",
    "ownerUserId": "doctor-lin",
    "summary": "结构化摘要",
    "nextCareAction": "D14 人工回访",
    "tags": ["结构化摘要"],
    "createdAt": "2026-06-01T08:30:00.000Z",
    "updatedAt": "2026-06-02T08:30:00.000Z"
  }
}
```

响应 DTO 不返回 `tenantId`，不返回完整正文、PII、请求体或内部错误细节。

## 9. Payload parser 设计

建议新增 `parseUpdateTreatmentSummaryPayload`，位置可放在现有：

```text
src/modules/institution/server/treatment-summary-write-input.ts
```

设计原则：

- 复用或抽取 Phase 13 创建 parser 的敏感字段拒绝逻辑。
- 允许字段集合与可编辑字段白名单一致。
- 显式拒绝 `id`、`tenantId`、`customerId`、`createdAt`、`updatedAt`。
- 显式拒绝未知字段。
- `treatmentDate` 必须是有效 ISO-like 时间字符串。
- `riskLevel` 只能是 `normal` / `watch` / `urgent`。
- `tags` 必须是字符串数组，去重、trim、数量和长度受控。
- 字符串字段继续使用现有长度限制口径。
- `appointmentId` 允许不传、`null` 或空白值，服务端归一化为 `null`。
- `appointmentId` 传入非空时只允许安全 ID 格式。
- 所有结构化字段都必须拒绝完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、PII、文件原文、AI 内容、外部系统原文和内部敏感信息。

建议 parser 返回：

```ts
type ParseUpdateTreatmentSummaryPayloadResult =
  | { ok: true; value: UpdateTreatmentSummaryDraft }
  | { ok: false; error: string };
```

错误文案应稳定、中文、可测试，并且不回显敏感原文。

## 10. RBAC / access resource 设计

当前已有 `treatment_summary` resource，Phase 13 已为 `tenant_admin` 增加必要 `create` / `read_own_tenant` 权限。

Phase 18 建议：

- 为 `tenant_admin` 增加最小 `treatment_summary:update` 权限。
- 不开放 `delete`。
- 不重构权限模型。
- 不影响已有 `customer` / `appointment` / `follow_up` 权限。
- 不给平台账号开放机构治疗摘要编辑。
- 不让 `platform_admin` 或 `platform_operator` 通过机构端 PATCH 修改治疗摘要。
- 补测试证明旧权限不回退，包括客户、预约、随访、审计、平台租户管理等已有权限行为不被 Phase 18 扩大或收缩。

如果后续需要让 `consultant`、`customer_service` 或医助角色编辑治疗摘要，应单独评估角色边界，不在 Phase 18 v1 中扩大。

## 11. 审计事件设计

治疗摘要编辑成功应写 allowed audit：

| 字段 | 建议值 |
| --- | --- |
| `resource` | `treatment_summary` |
| `action` | `update` |
| `result` | `allowed` |
| `resourceId` | 被编辑的 treatment summary id |
| `reason` | `allowed_by_policy` |

拒绝场景也应写审计，如可安全确定上下文：

| 场景 | `result` | `reason` 建议 |
| --- | --- | --- |
| 未登录 | 不写或按现有未登录策略处理 |
| 无权限 | `denied` | `role_denied` / `sensitive_detail_denied` |
| 缺少租户 | `denied` | `missing_tenant` |
| 记录不存在或不属于当前租户 | `denied` | `not_found_or_not_owned` |
| payload 非法 | `denied` | `invalid_treatment_summary_payload` |
| appointment 不存在或跨租户 | `denied` | `not_found_or_not_owned` |
| appointment 不属于当前摘要客户 | `denied` | `invalid_treatment_summary_reference` |

审计事件不得写入：

- 请求体。
- 更新前值。
- 更新后值。
- 完整治疗正文。
- 完整病历正文。
- 诊疗原文。
- 咨询全文。
- PII。
- 图片 / 文件原文。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

Phase 18 v1 不做字段级 diff 审计。如果后续需要完整变更历史或字段级变更追踪，应单独规划 revision 表。

## 12. appointmentId 归属校验

当 PATCH payload 中包含非空 `appointmentId` 时，必须校验：

1. appointment 存在。
2. appointment 属于当前 `tenantId`。
3. appointment 属于当前治疗摘要的 `customerId`。

建议复用现有 `checkAppointmentBelongsToTenantAndCustomer` helper，或保持完全同等语义：

- appointment 不存在或跨租户：返回 404，reason 为 `not_found_or_not_owned`。
- appointment 属于同租户但不是当前摘要客户：返回 409，reason 为 `invalid_treatment_summary_reference`。

当 `appointmentId` 为 `null` 或空白值时，表示解除预约关联，不需要 appointment 查询，但仍必须保证当前摘要本身属于当前租户。

## 13. 编辑后与既有随访任务的关系

Phase 18 v1 策略：

- 编辑治疗摘要不自动修改已创建的随访任务。
- 编辑治疗摘要不自动重新生成随访建议。
- 后续用户重新点击“查看随访建议”时，可以基于最新摘要重新计算建议。
- 已创建随访任务仍保留原 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey`。
- 现有随访任务的 `stage`、`suggestedAction`、`dueAt` 和 `riskLevel` 不因摘要编辑自动变化。
- 治疗摘要管理 UI 应明确这是受控编辑，不是随访任务重建。
- 如需要重建任务、取消旧任务、复制来源或展示“建议已变化”，应在后续阶段单独规划。

这个策略优先保证可追溯和低风险，避免一次编辑引发任务内容自动漂移或自动触达误解。

## 14. 是否新增 schema / migration

Phase 18 v1 默认不新增 schema / migration。

原因：

- 现有 `treatment_summaries` 已包含 v1 需要编辑的结构化字段。
- 现有 `updatedAt` 可以承接“最后更新时间”。
- 现有 audit event 可以记录 update 动作和 resourceId。
- v1 不做版本历史。
- v1 不做字段 diff 展示。
- v1 不做作废状态。
- v1 不做 revision 表。

如果后续需要完整变更历史、字段级 diff、作废状态、恢复能力或审计可视化，应单独进入 Plan Mode，并评估 revision 表或 lifecycle 字段。

## 15. 租户隔离设计

Phase 18 必须延续当前项目规则：

- 租户编号只能来自服务端 access context。
- API 不接受客户端传入 `tenantId`。
- PATCH route 不读取 query、header、body 或 localStorage 中的租户编号。
- repository update 必须按 `tenantId + summaryId` 查询和更新。
- `summaryId` 跨租户或不存在时统一返回稳定 404，不泄露其他租户是否存在同 ID。
- `appointmentId` 必须按 `tenantId + appointmentId` 校验。
- `appointmentId` 还必须匹配当前摘要 `customerId`。
- 返回 DTO 不包含 `tenantId`。
- 审计事件使用服务端上下文中的 `tenantId`。

跨租户测试必须覆盖：

- 前端 body 传 `tenantId` 被 parser 拒绝。
- query 传 `tenantId` 不会切换租户。
- header 传 `x-tenant-id` 不会切换租户。
- 其他租户 summary 不能被读取或编辑。
- 其他租户 appointment 不能关联到当前摘要。

## 16. PII / 医疗隐私边界

Phase 18 涉及医疗敏感结构化字段，但不应扩大隐私面。

允许保存和返回：

- 结构化治疗项目。
- 结构化治疗类别。
- 结构化治疗阶段。
- 结构化恢复阶段。
- 标准风险等级。
- 结构化短摘要。
- 下一步护理动作。
- 安全标签。
- 租户内 customer / appointment 引用 ID。

禁止保存、返回、展示或写入审计：

- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 图片 / 文件原文。
- 外部系统 raw payload。
- AI 生成内容。
- 请求体。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

错误响应必须稳定，不得包含数据库错误、SQL 片段、连接串、堆栈、token 或 secret。

## 17. 推荐 PR 拆分

Phase 18 推荐拆成 5 个 PR：

| PR | 范围 | 主要风险 | 验证方式 |
| --- | --- | --- | --- |
| PR 1 | Phase 18 spec / plan 文档 | 文档边界不清，后续 PR 混入删除、作废、HIS、AI 或外部系统 | `git diff --check` |
| PR 2 | 编辑 payload parser、RBAC、repository update、单元测试 | parser 接受未知字段或 PII；权限扩大过多；repository 跨租户更新 | parser / RBAC / repository Vitest，`tsc --noEmit` |
| PR 3 | PATCH API 与 API 测试 | API 接受前端 tenantId；appointment 跨租户；审计写入敏感内容 | API route tests，敏感字段扫描，`tsc --noEmit` |
| PR 4 | 机构端编辑 UI | UI 提交 forbidden fields；误导用户以为会自动重建随访任务；失败丢输入 | UI tests，workspace smoke，client payload 测试 |
| PR 5 | smoke / 文档收尾 | README / roadmap / devlog 与真实实现不一致；漏测隐私边界 | `git diff --check`、相关 Vitest、`tsc --noEmit`、Next build |

## 18. 每个 PR 的范围、风险和验证方式

### PR 1：Phase 18 spec / plan 文档

范围：

- 新增本设计文档。
- 新增实施计划文档。
- 不改业务代码。
- 不改页面。
- 不改测试。
- 不改 API route。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。

风险：

- 文档未明确禁止完整医疗正文和 PII，导致后续实现扩大隐私面。
- 文档未明确编辑后不自动修改随访任务，导致 PR 4 UI 或 PR 3 API 引发任务漂移。
- 文档未明确 schema 决策，导致后续 PR 混入版本历史或作废。

验证：

```bash
git diff --check
```

### PR 2：编辑 payload parser、RBAC、repository update、单元测试

范围：

- 新增 update payload parser。
- 复用或扩展 Phase 13 敏感字段拒绝逻辑。
- 增加 `treatment_summary:update` 权限。
- repository 按 `tenantId + summaryId` 更新治疗摘要。
- update 时更新 `updatedAt`。
- 保持 `id`、`tenantId`、`customerId`、`createdAt` 不可由 payload 修改。
- 不新增 API route。
- 不新增 UI。
- 不新增 schema / migration。

风险：

- parser 接受未知字段或敏感字段。
- repository update 没有绑定 `tenantId`。
- 误把 `customerId` 设为可编辑。
- 权限变更影响已有 resource / action。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryRepository.test.ts
node scripts/run-vitest.mjs run src/modules/security/tests/AccessControlDomain.test.ts
./node_modules/.bin/tsc --noEmit
```

### PR 3：PATCH API 与 API 测试

范围：

- 新增 `PATCH /api/institution/treatment-summaries/[summaryId]`。
- 校验 `treatment_summary:update`。
- 服务端推导 `tenantId`。
- 查询当前租户内 summary。
- 校验 appointment 同租户同客户。
- 调用 update parser 和 repository update。
- 成功返回安全 DTO。
- 成功和拒绝路径写稳定 audit。

风险：

- API 接受 query/header/body 中的 `tenantId`。
- 跨租户 summary 被编辑。
- appointment 属于同租户其他客户仍被关联。
- 审计写入请求体、正文或 PII。
- 503 暴露 SQL、stack、token、secret 或连接串。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts
node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventsDomain.test.ts
./node_modules/.bin/tsc --noEmit
```

### PR 4：机构端编辑 UI

范围：

- 在治疗摘要安全详情中增加受控编辑入口。
- 编辑表单只包含可编辑字段白名单。
- client helper 只提交白名单字段。
- 成功后刷新治疗摘要列表 / 当前详情。
- 如客户详情 timeline 打开场景涉及刷新，应刷新相关 timeline。
- UI 明确不会自动修改既有随访任务。
- 不做删除。
- 不做作废。
- 不做大规模 UI 重构。

风险：

- client helper 提交 `tenantId`、`customerId` 或未知字段。
- UI 展示完整治疗记录正文、完整病历正文或 PII。
- 编辑失败后丢失输入。
- UI 暗示会自动重建随访任务或自动触达客户。

验证：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

### PR 5：smoke / 文档收尾

范围：

- 强化 workspace smoke。
- 覆盖编辑成功。
- 覆盖失败保留输入。
- 覆盖请求不含 `tenantId`。
- 覆盖不展示 PII / 正文 / SQL / token / secret。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 18 spec / plan 完成状态。

风险：

- 文档声明和真实实现不一致。
- smoke 未覆盖敏感字段。
- 完成状态误称删除、作废、HIS、AI 或外部系统已完成。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 19. Phase 18 完成标准

Phase 18 只有在以下条件满足时才可标记完成：

- 已有治疗摘要可以通过机构端受控编辑。
- PATCH API 只接受白名单结构化字段。
- PATCH API 不接受 `tenantId`。
- PATCH API 只更新当前租户内 summary。
- `appointmentId` 同租户同客户归属校验完成。
- 编辑成功返回安全 DTO。
- 编辑成功写 allowed audit。
- 拒绝和非法场景写稳定 denied audit。
- 审计不包含请求体、完整正文、PII、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- 不新增 schema / migration。
- 不做删除、作废、版本历史或 diff 展示。
- 不自动修改已创建随访任务。
- 不自动重新生成随访建议。
- 不进入 AI / RAG / HIS / 企微 / 外部系统开发。

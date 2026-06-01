# Phase 13 治疗摘要人工录入 v1 设计

> 状态：Phase 13 已完成。PR 1-5 已完成治疗摘要人工录入 v1 的设计、写入地基、POST API、客户详情抽屉结构化录入 UI、workspace smoke 和文档收尾。

## 1. Phase 13 目标

Phase 13 默认选择“治疗摘要人工录入 v1”。目标是在 Phase 12 已完成的 `treatment_summaries` 数据底座和客户详情 timeline 展示能力之上，让机构端用户可以在客户详情上下文中新增一条结构化治疗摘要。

本阶段 v1 目标：

- 在客户详情上下文中录入结构化治疗摘要。
- 只允许写入现有 `treatment_summaries` schema 的安全白名单字段。
- 服务端从 session / access context 推导 `tenantId`，不接受前端传入 `tenantId`。
- 写入前确认 customer 属于当前 tenant。
- 如传入 `appointmentId`，确认 appointment 属于当前 tenant，且推荐确认属于同一个 customer。
- 写入成功后返回安全 DTO。
- 写入成功后现有 customer timeline API 可读取并展示该治疗摘要。
- 成功写入 allowed 审计；安全可确认的拒绝场景写 denied 审计。
- 不保存或返回完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文、AI 生成内容或外部系统同步原文。

Phase 13 最终已完成：

- 治疗摘要写入 payload parser。
- 治疗摘要 repository create。
- `treatment_summary` access resource、`tenant_admin` 必要 create / read 权限和稳定 audit reason。
- `POST /api/institution/customers/[customerId]/treatment-summaries`。
- 客户详情抽屉“添加治疗摘要”结构化录入 UI。
- 提交成功后刷新客户详情 timeline，新摘要进入治疗摘要区域和 `treatment_summary` 时间线节点。
- workspace smoke / README / roadmap / devlog / Phase 13 spec / plan 收尾。

Phase 13 未新增数据库 schema / migration，未改认证或租户隔离模型，未进入完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票或外部系统同步。

## 2. 为什么优先做治疗摘要人工录入 v1

Phase 12 已经完成治疗结构化摘要的核心读路径：

- `treatment_summaries` 最小 schema、migration、seed、repository 和 DTO 白名单。
- `GET /api/institution/customers/[customerId]/timeline` 已返回 `treatmentSummaries`。
- 客户详情抽屉已展示治疗摘要和 `treatment_summary` timeline 节点。
- smoke 已覆盖治疗摘要展示、空态和敏感字段不展示。

当前缺口是“真实机构用户如何把结构化治疗摘要录入系统”。如果只停留在 seed 和只读展示，Phase 12 的治疗摘要能力无法形成实际业务闭环。人工录入 v1 能把治疗摘要从演示数据推进到受控写入，并继续承接客户详情时间线这一已有用户路径。

相对其他方向，治疗摘要人工录入 v1 的工程准备度最高：

- 数据表已经存在，默认不需要新增 schema / migration。
- timeline 读路径已经存在，写入成功后不需要新增展示模型。
- 结构化字段、DTO 白名单和敏感字段禁止清单已经在 Phase 12 形成基础。
- 机构端客户详情抽屉是自然入口，不需要新建大页面或重构导航。

同时它的业务价值也最直接：

- 机构运营人员可以在客户详情里补充治疗节点。
- 后续随访、复购、人工跟进可以围绕结构化治疗节点展开。
- 为后续治疗摘要管理能力 v1 提供真实数据来源。

## 3. 为什么治疗摘要管理、RAG、平台商业化增强后置

### 治疗摘要管理能力 v1 后置

治疗摘要管理能力 v1 只做只读列表、筛选和详情查看。它对运营查看有价值，但如果先做管理页，仍然只能管理 seed 或已有演示摘要，不能解决治疗摘要进入系统的问题。

治疗摘要管理会扩大治疗摘要可见面，需要单独设计分页、筛选白名单、列表 DTO、详情 DTO、入口权限、当前租户范围和敏感字段扫描。它适合在人工录入闭环后作为 Phase 14 或后续阶段承接。

### 知识库 / RAG 基础准备后置

知识库 / RAG 涉及文件来源、正文保存、分块、embedding、检索命中、内容安全和成本控制。即使当前只做基础准备，也很容易滑入文件上传、医疗隐私正文保存、自动问答或 AI provider 规划。

Phase 13 不应在治疗摘要写入同一阶段引入知识库/RAG。后续若进入知识库，也必须单独 Plan Mode，并保持以下边界：不上传或保存医疗隐私正文，不接真实 AI provider，不做 Agent，不做自动问答，不做复杂文件解析。

### 平台商业化增强后置

Phase 9-11 已完成平台租户管理基础版、套餐配额 enforcement 轻量版和商业化健康只读视图。平台商业化继续增强仍有价值，但它更贴近平台运营视图，不承接 Phase 12 的治疗摘要读路径。

Phase 13 优先补齐治疗摘要写入闭环。平台商业化增强可以后续继续围绕只读筛选、排序、风险摘要或套餐配置健康做小步迭代，但不应混入治疗摘要人工录入阶段。

## 4. 治疗摘要人工录入 v1 范围

Phase 13 v1 包含：

- 新增治疗摘要写入 payload parser。
- 新增治疗摘要 repository create 方法。
- 新增治疗摘要安全 DTO 复用或扩展。
- 推荐新增 `treatment_summary` access resource，并补最小 RBAC / audit 测试。
- 新增 `POST /api/institution/customers/[customerId]/treatment-summaries`。
- POST route 服务端校验 customer 属于当前 tenant。
- POST route 如收到 `appointmentId`，校验 appointment 属于当前 tenant 且属于同一个 customer。
- POST route 只接受字段白名单，不接受 `tenantId`。
- 写入成功返回安全 DTO。
- 写入成功后 existing timeline API 能读取新摘要并展示。
- 客户详情抽屉增加“新增治疗摘要”结构化表单入口。
- 成功创建后刷新当前客户 timeline。
- UI 和 smoke 覆盖 loading、提交中、成功、400、401、403、404、409、503、敏感字段不展示和请求不携带 `tenantId`。
- README / roadmap / devlog / Phase 13 spec / plan 收尾。

Phase 13 v1 不包含编辑、删除、批量导入、完整详情页、跨客户管理列表或平台端治疗摘要查看。

## 5. 不纳入本阶段

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
- 治疗摘要编辑。
- 治疗摘要删除。
- 治疗摘要管理列表。
- 平台端治疗摘要下钻。
- 外部系统同步。
- 套餐购买、续费、变更或复杂计费。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode，不能在 Phase 13 顺手扩大范围。

## 6. 字段白名单

治疗摘要人工录入只允许字段命名与现有 `treatment_summaries` schema 对齐。

| API payload 字段 | schema 字段 | 类型建议 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `appointmentId` | `appointment_id` | `string | null` | 否 | 可选预约关联；如果提供，必须同租户且同 customer |
| `treatmentDate` | `treatment_date` | ISO-like datetime string | 是 | 治疗或复诊摘要对应时间 |
| `treatmentProject` | `treatment_project` | string | 是 | 治疗项目结构化名称 |
| `treatmentCategory` | `treatment_category` | string | 是 | 项目类别 code 或短标签 |
| `treatmentStage` | `treatment_stage` | string | 是 | 治疗阶段，例如 D7 复诊 |
| `recoveryStage` | `recovery_stage` | string | 是 | 恢复阶段，例如 D7、D14、稳定 |
| `riskLevel` | `risk_level` | `normal | watch | urgent` | 是 | 复用现有 follow-up 风险枚举 |
| `ownerUserId` | `owner_user_id` | string | 是 | 负责人用户标识 |
| `summary` | `summary` | string | 是 | 结构化短摘要，不是完整治疗正文 |
| `nextCareAction` | `next_care_action` | string | 是 | 下一步护理或人工跟进建议 |
| `tags` | `tags` | string[] | 否 | 安全标签数组，默认空数组 |

服务端生成字段：

- `id`：服务端生成。
- `tenantId`：从 access context 推导。
- `customerId`：从 URL path `[customerId]` 读取，并经当前 tenant 校验。
- `createdAt` / `updatedAt`：数据库默认或 repository 设置。

前端不得提交服务端生成字段。

## 7. 禁止字段

Phase 13 schema、API payload、repository input、DTO、API response、UI、测试快照、日志和审计中均禁止保存和返回：

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

- `tenantId`
- `customerId` in request body
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

禁止值示例：

- `完整治疗记录正文`
- `完整病历正文`
- `诊疗原文`
- `咨询对话全文`
- `DATABASE_URL`
- `postgres://`
- `mysql://`
- `sk_test`
- `sk_live`
- `zmtg_sk_`
- `access_token`
- `refresh_token`

测试必须覆盖字段名和字段值两类扫描。UI 文案也不能鼓励用户粘贴完整病历、治疗正文、咨询全文、图片原文或文件原文。

## 8. API 路径设计

推荐新增：

```text
POST /api/institution/customers/[customerId]/treatment-summaries
```

选择客户详情子路径的原因：

- 人工录入发生在客户详情上下文中。
- `customerId` 来自 URL path，语义上明确归属单客户。
- 服务端可以先校验 customer 属于当前 tenant，再创建治疗摘要。
- 与现有 timeline API 路径保持相邻：

```text
GET /api/institution/customers/[customerId]/timeline
```

请求要求：

- 只接受 JSON object。
- 不接受 query、header 或 body 中的 `tenantId` 切换租户。
- 不接受 body 中的 `customerId`。
- 只接受字段白名单。
- `appointmentId` 可省略、为 `null` 或非空字符串。
- `treatmentDate` 必须是有效 ISO-like timestamp。
- `riskLevel` 必须是 `normal`、`watch` 或 `urgent`。
- `tags` 必须是字符串数组，空数组允许。

响应建议：

```json
{
  "record": {
    "id": "trt_...",
    "appointmentId": "appt_...",
    "treatmentDate": "2026-06-01T12:00:00.000Z",
    "treatmentProject": "光电修复",
    "treatmentCategory": "laser_repair",
    "treatmentStage": "D7 复诊",
    "recoveryStage": "D7",
    "riskLevel": "watch",
    "ownerUserId": "doctor-lin",
    "summary": "结构化摘要：恢复进展稳定，安排补水护理观察。",
    "nextCareAction": "D14 人工回访恢复阶段。",
    "tags": ["结构化摘要", "术后关怀"],
    "createdAt": "2026-06-01T12:00:00.000Z",
    "updatedAt": "2026-06-01T12:00:00.000Z"
  }
}
```

响应不得包含：

- `tenantId`
- `customerId`
- 完整正文、原文、请求体、PII、SQL、stack、token、secret 或连接串。

状态码建议：

- `201`：创建成功。
- `400`：JSON 非 object、字段非白名单、字段类型不合法、命中敏感字段或敏感值。
- `401`：未登录。
- `403`：登录上下文没有治疗摘要创建权限或缺少 tenant 上下文。
- `404`：customer 不存在或不属于当前 tenant；appointment 不存在或不属于当前 tenant。
- `409`：appointment 属于当前 tenant 但不属于当前 customer。
- `503`：数据库或服务不可用。

写入成功后，现有 timeline API 不需要改路径。新摘要应通过现有 `listTreatmentSummariesByTenantAndCustomer()` 被 `GET /api/institution/customers/[customerId]/timeline` 读取并展示。

## 9. RBAC / access resource 决策

Phase 13 评估两种方案。

### 方案 A：新增 `treatment_summary` resource

优点：

- 语义清晰，治疗摘要不再伪装成客户资源。
- 审计 `resource` 可直接写 `treatment_summary`，后续查询和筛选更准确。
- 后续治疗摘要管理能力 v1 可以独立控制 `read_own_tenant`、`read_detail`、`create`、`update`。
- 平台端敏感资源控制可以把治疗摘要纳入敏感资源列表，避免平台侧误读医疗详情。

风险：

- 需要扩展 `ACCESS_RESOURCES` TypeScript 枚举。
- 需要补 access-control 单元测试。
- 需要补 audit domain / query parser 的 resource 白名单相关测试。
- 需要确保只新增资源和最小 policy，不重构权限模型主结构。

推荐最小 policy：

- `tenant_admin` 对 `treatment_summary` 具备 `read_own_tenant` 和 `create`。
- 暂不为 `tenant_operator`、`consultant`、`customer_service`、`platform_admin` 或 `platform_operator` 增加治疗摘要权限。
- 暂不增加 `update`、`delete`、`export_report`。

测试范围：

- `tenant_admin` 可在本租户创建治疗摘要。
- `tenant_admin` 不能跨租户创建治疗摘要。
- `platform_admin` 默认不能创建或读取治疗摘要敏感详情。
- `treatment_summary` 被纳入 sensitive resources，平台 scope 如请求 sensitive detail 应被拒绝。
- audit query parser 接受 `resource=treatment_summary`。
- 审计 DTO 不返回请求体、正文、PII 或服务端错误细节。

边界：

- 不改 `AccessContext` 结构。
- 不改 role 体系。
- 不新增真实账号。
- 不改认证模型。
- 不改租户推导方式。
- 不重写 `canAccessResource()` 主逻辑。

### 方案 B：复用 `customer` 权限语义

优点：

- 改动更小。
- Phase 13 v1 能更快实现。
- 治疗摘要录入发生在客户详情上下文中，复用 customer create/update/read 语义可以解释。

风险：

- 审计 `resource=customer` 会让治疗摘要创建与客户记录创建/更新混在一起。
- 后续治疗摘要管理、编辑、导出和平台治理需要再拆权限。
- 审计筛选很难直接定位治疗摘要创建事件。
- 平台侧敏感资源边界不够明确。

### 推荐方案

推荐 **方案 A：新增 `treatment_summary` resource**。

理由：Phase 12 已经在 timeline 中使用 `source: "treatment_summary"` 和 `type: "treatment_summary"` 表达治疗摘要节点。Phase 13 如果继续用 `customer` resource 写审计，会造成读路径和审计路径语义不一致。新增 `treatment_summary` resource 是小范围 TypeScript / 测试扩展，不需要 DB migration，也不需要重构权限模型主结构。

## 10. 审计事件设计

治疗摘要创建成功必须写 allowed 审计。

成功事件建议：

| 字段 | 值 |
| --- | --- |
| `resource` | `treatment_summary` |
| `action` | `create` |
| `result` | `allowed` |
| `reason` | `allowed_by_policy` |
| `resourceId` | 新建 treatment summary id |
| `tenantId` | access context tenant id |
| `actorId` | 当前用户 id |
| `actorRole` | 当前用户 role |
| `occurredAt` | 服务端当前时间 |

拒绝事件建议：

- 未登录 `401`：沿用现有业务 API 行为，不初始化数据库，不写审计。
- RBAC 拒绝 `403`：写 denied 审计，`resource=treatment_summary`，`action=create`，`reason=role_denied` 或现有 access decision reason。
- 缺少 tenant `403`：写 denied 审计，`reason=missing_tenant`。
- customer 不存在或不属于当前 tenant `404`：如已确认 actor/tenant 上下文，可写 denied 审计；不写未确认的 `customerId` 到 `resourceId`。
- appointment 不存在或不属于当前 tenant `404`：写 denied 审计时不把不安全 appointment id 写入 `resourceId`。
- appointment 属于当前 tenant 但不属于当前 customer `409`：建议新增稳定 audit reason `invalid_treatment_summary_reference`，不需要 DB migration，因为 `audit_events.reason` 是 varchar；需要更新 TypeScript union、query parser 白名单和测试。
- payload parser 拒绝 `400`：默认不写审计，避免把未信任请求体带入审计；如后续需要安全运营统计，应单独设计 `invalid_payload` reason，不能在 PR 3 顺手扩大。
- 数据库异常 `503`：不写请求体或错误详情到审计，响应稳定 `数据服务暂时不可用`。

审计中严禁写入：

- 请求体。
- 完整治疗正文。
- 完整病历正文。
- 诊疗原文。
- 咨询全文。
- PII。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

## 11. appointmentId 归属校验

`appointmentId` 是可选字段。校验策略：

1. 如果 payload 未提供 `appointmentId`，或者提供 `null`，允许创建无预约关联的治疗摘要。
2. 如果 payload 提供非空 `appointmentId`，服务端必须按当前 `tenantId + appointmentId` 查询 appointment。
3. appointment 不存在或不属于当前 tenant，返回 `404`。
4. appointment 属于当前 tenant 但 `appointment.customerId !== customerId`，返回 `409`。
5. 只有 appointment 同租户且同 customer 时，才允许写入 `appointmentId`。

该校验必须在 repository create 前完成。不能依赖数据库外键错误作为主要业务校验；外键竞态仍需要兜底为稳定 `404` 或 `409`，不能泄露 SQL、constraint、stack 或连接串。

推荐新增 repository 方法：

- `getAppointmentByTenantAndId({ tenantId, id })`
- 或 `appointmentBelongsToTenantAndCustomer({ tenantId, appointmentId, customerId })`

为避免扩大 repository 职责，推荐在现有 `tenant-business-repository.ts` 中新增最小只读检查方法，供 treatment summary POST route 使用。

## 12. payload parser 设计

推荐新增专用 parser，而不是复用客户 / 预约 parser。

建议文件：

```text
src/modules/institution/server/treatment-summary-write-input.ts
```

解析结果类型：

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
```

parser 规则：

- 输入必须是 plain JSON object。
- 拒绝所有非白名单 key。
- 拒绝 `tenantId`、`customerId`、`id`、`createdAt`、`updatedAt`。
- 必填字符串必须 trim 后非空。
- `appointmentId` 可省略、为 `null` 或 trim 后非空字符串。
- `treatmentDate` 必须是有效 ISO-like timestamp。
- `riskLevel` 必须在 `normal | watch | urgent` 内。
- `tags` 可省略，默认 `[]`。
- `tags` 必须是非空字符串数组。
- 对所有字符串字段和 tags 进行敏感字段 / 敏感值扫描。
- `summary` 和 `nextCareAction` 是短结构化摘要字段，不允许长篇正文；建议 v1 限制最大长度，例如 `summary <= 280`、`nextCareAction <= 200`。
- 其他结构化短字段建议限制长度，例如 project/category/stage/recovery/owner <= schema 对应长度。

parser 错误响应：

- 返回稳定中文 `400`。
- 不返回原始请求体。
- 不返回命中的敏感值。
- 不返回 SQL、stack、token、secret 或连接串。

## 13. PII / 医疗隐私拦截策略

Phase 13 是医疗隐私风险较高的阶段，因为它引入人工录入。必须采用前后端双层拦截，但安全边界以服务端 parser 为准。

服务端必须拦截：

- 原始手机号：包含 11 位或更多连续/累计数字的字符串。
- 身份证号：身份证、id card、id number 等上下文附近出现长数字。
- 病历号原文：病历号、medical record、MR 等上下文附近出现非脱敏编号。
- 完整治疗记录正文关键词。
- 完整病历正文关键词。
- 诊疗原文关键词。
- 咨询对话全文关键词。
- 图片 / 文件原文相关字段和值。
- AI 生成内容相关字段和值。
- 外部系统同步原文相关字段和值。
- SQL、stack、token、secret、`DATABASE_URL`、连接串。

允许内容：

- 短结构化摘要。
- 脱敏标签。
- 项目、类别、阶段、恢复阶段、风险等级、负责人 ID。
- 不含原始 PII 的护理建议。

UI 层必须：

- 只呈现结构化表单，不提供“完整病历”“治疗正文”“上传文件”“AI 生成”入口。
- 提交前做轻量本地校验，帮助用户快速发现明显问题。
- 即使前端校验漏过，服务端 parser 仍必须拒绝。
- 错误提示只显示稳定中文，不回显敏感原文。

测试必须覆盖：

- body 中出现 `tenantId` 被拒绝。
- body 中出现完整治疗正文相关 key 被拒绝。
- body 中出现手机号原文或身份证号被拒绝。
- `summary` 中出现 `DATABASE_URL`、`postgres://`、`token`、`secret` 被拒绝。
- API response、UI 和审计不包含敏感字段和值。

## 14. 租户隔离边界

Phase 13 必须延续前几个阶段的租户隔离原则：

- `tenantId` 只来自服务端 access context。
- 前端 query、header、body、localStorage 中的 `tenantId` 全部不可信。
- URL path 只提供 `customerId`，该 id 必须通过 `tenantId + customerId` 查询确认归属。
- 未确认归属前，不把用户提交的 customerId 或 appointmentId 写入审计 `resourceId`。
- treatment summary create 必须写入当前 access context tenantId。
- appointment 校验必须使用当前 tenantId。
- appointment 与 customer 不匹配时，不写入治疗摘要。
- 成功响应 DTO 不返回 tenantId 或 customerId。
- 403、404、409 和 503 文案不能泄露其他租户是否存在目标记录。

平台端边界：

- Phase 13 不新增平台端治疗摘要 API。
- `platform_admin` 默认不能读取或创建治疗摘要敏感详情。
- 后续若平台端需要治疗摘要治理视图，必须单独 Plan Mode，并评估审批、审计、脱敏和敏感范围。

## 15. 推荐 PR 拆分

Phase 13 推荐拆成 5 个 PR。

### PR 1：Phase 13 spec / plan 文档

范围：

- 新增 Phase 13 设计文档。
- 新增 Phase 13 实施计划。
- 固化方向选择、字段白名单、禁止字段、API 路径、RBAC 决策、审计设计、appointment 校验、payload parser、PII / 医疗隐私拦截、租户隔离和 PR 拆分。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。

风险：

- 文档范围不清，导致后续 PR 混入完整治疗正文、AI、RAG、外部系统或平台商业化。
- RBAC 决策不清，导致 PR 2/3 在 `customer` 与 `treatment_summary` resource 之间摇摆。

验证：

- `git diff --check`
- 人工确认只新增 Markdown 文档。

### PR 2：payload parser、domain、repository create、RBAC / audit 决策测试

范围：

- 新增治疗摘要写入 payload parser。
- 新增 repository create 方法。
- 推荐新增 `treatment_summary` access resource。
- 更新 audit reason union / query values 以支持 `invalid_treatment_summary_reference`。
- 补字段白名单、敏感字段拒绝、DTO 白名单、repository create、RBAC 和 audit domain 测试。
- 不新增 API route。
- 不新增 UI。
- 不新增 schema / migration。

风险：

- parser 允许自由字段或长篇正文。
- repository create 接受调用方传入 tenantId 以外的不安全字段。
- RBAC 扩展变成权限模型重构。
- 新 audit reason 未进入查询 parser 白名单。

验证：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryDomain.test.ts src/modules/institution/tests/TreatmentSummaryRepository.test.ts src/modules/institution/tests/TenantBusinessWriteInput.test.ts src/modules/security/tests/AccessControlDomain.test.ts src/modules/audit/tests/AuditEventsDomain.test.ts src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `./node_modules/.bin/tsc --noEmit`

### PR 3：新增 POST API route

范围：

- 新增 `POST /api/institution/customers/[customerId]/treatment-summaries`。
- 从 access context 推导 tenant。
- 校验 customer 属于当前 tenant。
- 校验 appointment 同租户 / 同 customer。
- 调用 parser 和 repository create。
- 成功写 allowed 审计。
- 安全可确认的拒绝场景写 denied 审计。
- 成功返回安全 DTO。
- 覆盖 `401 / 403 / 400 / 404 / 409 / 503`。
- 不新增 UI。

风险：

- 接受 body/query/header 中的 `tenantId`。
- appointment 跨客户仍被写入。
- 审计误写请求体或敏感字段。
- 外键竞态泄露数据库 constraint 或 SQL。

验证：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts src/modules/audit/tests/AuditEventRepository.test.ts`
- `./node_modules/.bin/tsc --noEmit`

### PR 4：客户详情抽屉结构化录入 UI

范围：

- 在客户详情抽屉增加“新增治疗摘要”入口。
- 增加结构化治疗摘要表单。
- 新增 client helper 调用 POST API。
- 表单只发送字段白名单，不发送 `tenantId` 或 `customerId`。
- 成功后刷新当前客户 timeline。
- 覆盖 loading、提交中、成功、400、401、403、404、409、503、敏感字段不展示。
- 不支持图片、文件、AI、完整正文、编辑或删除。

风险：

- UI 文案引导用户粘贴完整病历或治疗正文。
- 表单过大导致客户详情抽屉不可用。
- 成功后未刷新 timeline，用户看不到新增摘要。
- 错误提示透出 parser 命中的敏感值。

验证：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/TenantBusinessClient.test.ts`
- `./node_modules/.bin/tsc --noEmit`

### PR 5：smoke / 文档收尾

范围：

- 补 workspace smoke。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 13 spec / plan 为完成状态。
- 明确 Phase 13 未进入完整正文、AI、RAG、企微、外部系统、支付、合同或发票。

风险：

- 文档宣称范围超过实际完成能力。
- smoke 只覆盖成功态，遗漏敏感字段、租户隔离和不发送 `tenantId`。

验证：

- `git diff --check`
- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`

## 16. Phase 13 完成标准

Phase 13 已满足：

- [x] 机构端可在客户详情上下文创建结构化治疗摘要。
- [x] 创建请求不发送也不接受 `tenantId`。
- [x] body 只允许治疗摘要字段白名单。
- [x] 服务端校验 customer 属于当前 tenant。
- [x] 服务端校验 appointment 同租户 / 同 customer。
- [x] 成功创建后返回安全 DTO。
- [x] 成功创建后现有 timeline API 可读取并展示新摘要。
- [x] 成功写入 allowed 审计，安全拒绝场景写 denied 审计。
- [x] 审计不包含请求体、完整正文、PII、SQL、stack、token、secret 或连接串。
- [x] UI 不提供完整病历、完整治疗正文、文件上传、AI 或外部同步入口。
- [x] 不新增 schema / migration。
- [x] 不改认证模型。
- [x] 不改租户推导方式。
- [x] 不进入 AI provider、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同或发票。
- [x] README、roadmap、devlog 和 Phase 13 spec / plan 与实际完成范围一致。

## 17. Phase 14 建议

Phase 13 完成后，建议先进入 Phase 14 Plan Mode，不直接实现 Phase 14。候选方向：

- 治疗摘要管理能力 v1：只读列表、筛选和详情查看，不做新增 / 编辑 / 删除，不展示完整正文。
- 知识库 / RAG 安全基础准备：只做规划或最小结构，不接真实 AI provider，不上传或保存医疗隐私正文。
- 平台套餐商业化继续增强：继续只读运营辅助，不做支付、合同、发票或复杂计费。
- 平台租户状态管理和审计高级治理：单独评估状态变更、导出、告警和风控边界。

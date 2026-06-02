# Phase 19 治疗摘要作废能力 v1 设计

> 日期：2026-06-02
> 状态：Phase 19 已完成。本文最初固化治疗摘要作废能力 v1 的目标、范围、API / schema / RBAC / 审计 / UI / 随访联动边界和 PR 拆分；PR 1-5 已按本文完成 spec / plan、数据地基、作废 API、机构端展示和 smoke / 文档收尾。

## 0. Phase 19 最终状态

Phase 19 已完成治疗摘要作废能力 v1：

- PR 1 已完成 Phase 19 spec / plan 文档。
- PR 2 已完成 `treatment_summaries` nullable 作废字段、Drizzle migration / meta、domain / DTO `status` 派生、作废原因 parser、repository `voidTreatmentSummaryByTenant` 和 audit reason 预留。
- PR 3 已完成 `POST /api/institution/treatment-summaries/[summaryId]/void`，并完成作废后阻断新的 `follow-up-suggestions` 和新的来源 `follow-up-tasks` 创建。
- PR 4 已完成机构端治疗摘要列表、详情、客户 timeline 和来源随访任务提示中的作废状态展示，并使用既有作废 API。
- PR 5 已完成 workspace smoke 强化、README / roadmap / devlog 和 Phase 19 spec / plan 收尾。

最终边界保持不变：Phase 19 不做治疗摘要硬删除、批量作废、版本历史、diff 展示、自动取消既有随访任务、自动触达客户、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企业微信、HIS / CRM / OTA 真实接入、OAuth、Webhook、支付或外部系统同步。

## 1. Phase 19 目标

Phase 19 默认选择 **治疗摘要作废能力 v1**。

目标是在 Phase 18 已完成治疗摘要编辑能力后，为机构端提供“软作废”能力。机构人员可以将某条结构化治疗摘要标记为作废，系统保留原记录和历史追溯，不做硬删除，不做批量操作，并在治疗摘要列表、治疗摘要详情、客户时间线和随访联动场景中明确展示作废状态。

Phase 19 v1 的核心原则：

- 作废不是删除。
- 不删除历史治疗摘要。
- 不删除客户时间线节点。
- 不删除来源随访任务。
- 作废只是让该治疗摘要不再作为后续运营依据。
- 作废信息必须可审计、可追溯。
- 作废后的治疗摘要不能继续生成新的随访建议。
- 作废后的治疗摘要不能继续人工确认创建新的来源随访任务。
- 已存在的来源随访任务不自动取消、不自动改状态。

本阶段继续遵守 clean 项目已有安全底线：服务端从 access context 推导 `tenantId`，前端不能传入或切换 `tenantId`；所有 payload 使用白名单 parser；API、DTO、UI、audit 和测试快照不得包含完整医疗正文、PII、SQL、stack、token、secret、`DATABASE_URL` 或连接串。

## 2. 为什么优先做治疗摘要作废能力 v1

Phase 12 到 Phase 18 已经完成治疗摘要的内部运营闭环：

- Phase 12：治疗记录结构化摘要 v1，完成 `treatment_summaries` 数据底座、客户详情 timeline 接入和安全 DTO。
- Phase 13：治疗摘要人工录入 v1，完成创建 parser、POST API、客户详情录入 UI 和审计。
- Phase 14：治疗摘要管理能力 v1，完成列表、筛选、分页和安全详情。
- Phase 15：治疗后护理 / 随访联动 v1，完成确定性建议和人工确认创建随访任务。
- Phase 16：随访任务来源治理 v1，完成治疗摘要来源展示、来源筛选和重复任务提示。
- Phase 17：HIS 标准治疗事件 domain-only 契约，明确未来外部治疗事实需要先标准化。
- Phase 18：治疗摘要编辑能力 v1，完成结构化字段编辑、PATCH API、RBAC 和审计。

当前治疗摘要已经可创建、可查看、可编辑、可生成建议、可人工确认创建来源随访任务。剩余的直接治理缺口是：某条摘要被确认不应继续使用时，系统缺少正式生命周期状态，只能继续被列表、详情、客户时间线和随访建议当作有效摘要使用。

如果不补齐作废能力，会产生几个问题：

- 误录或重复录入的治疗摘要仍可能继续触发随访建议。
- 机构人员无法在列表和客户时间线中分辨该摘要是否仍可作为运营依据。
- 既有来源随访任务与治疗摘要之间缺少“来源已作废”的治理提示。
- 未来 HIS 标准事件落到治疗摘要后，人工复核和纠错缺少生命周期出口。
- 后续随访路径分析和经营智能会把无效摘要当作有效业务事实。

因此 Phase 19 优先做治疗摘要作废能力 v1，比继续做底层 mapper 或提前做分析页面更贴近当前产品闭环。

## 3. 为什么其他方向后置

### 3.1 HIS 标准治疗事件 mapper 增强后置

HIS mapper 增强长期价值高，技术风险也低，适合继续承接 Phase 17。可增强方向包括项目分类、治疗阶段、风险等级、金额、币种和标签标准化。

但 Phase 17 已经完成 domain-only 标准治疗事件类型和 mapper 契约。连续推进 HIS mapper 会继续强化底层能力，却不能解决当前治疗摘要生命周期缺口。Phase 19 先补作废能力，可以保证后续标准治疗事件或人工录入摘要进入系统后，有清晰的失效治理能力。

HIS mapper 增强后续仍应保持：

- 不接真实 HIS。
- 不写 Webhook。
- 不做文件导入。
- 不新增 API。
- 不新增数据库 schema / migration。
- 不保存 raw payload。

### 3.2 业务事件埋点体系 spec 后置

业务事件埋点体系是后续随访路径运营分析和经营智能中心的重要底座，应覆盖路径事件、任务事件、触达事件、转化事件和策略事件。

但事件体系一旦进入真实采集，就会涉及 event table、payload 白名单、租户隔离、保留周期、查询 API、幂等和敏感字段扫描。当前 Phase 19 的直接缺口是治疗摘要生命周期治理，而不是事件采集。

后续业务事件 spec 可以单独规划，且必须明确：

- 不记录 raw payload。
- 不记录完整治疗记录正文。
- 不记录完整病历正文。
- 不记录咨询对话全文。
- 不记录手机号原文、身份证号、病历号原文。
- 不记录图片 / 文件原文。
- 所有事件必须绑定当前租户。

### 3.3 随访路径运营分析 v1 后置

随访路径运营分析长期价值高，但当前缺少稳定的路径进入、触达完成、客户回复、复诊、到院、二次消费和关联金额事件口径。现在直接做分析页面，只能基于现有任务状态和来源字段做弱统计，容易误导机构经营判断。

随访路径运营分析应在业务事件模型和路径口径稳定后推进。Phase 19 作废能力会先保证治疗摘要来源数据的有效性，为未来分析打基础。

### 3.4 经营智能中心 v1 规划后置

经营智能中心需要客户洞察、经营报表、经营策略和策略转任务能力。它依赖客户、预约、治疗、随访、触达、回复、复诊、到院、消费和业务事件。

当前系统尚未具备完整事件口径和经营分析数据底座。Phase 19 不应提前做经营智能中心页面或策略能力，避免形成空壳页面或不可靠指标。

## 4. 治疗摘要作废 v1 范围

Phase 19 v1 可以做：

- 为 `treatment_summaries` 新增最小作废生命周期字段。
- 历史治疗摘要默认视为 active。
- 新增作废原因 parser。
- 新增 tenant-scoped repository void 方法。
- 新增作废 API：`POST /api/institution/treatment-summaries/[summaryId]/void`。
- 服务端从 access context 推导 `tenantId`。
- API 不接受前端传入 `tenantId`。
- 校验 treatment summary 属于当前 tenant。
- 已作废摘要重复作废时返回稳定状态。
- 作废成功返回安全 DTO。
- 作废成功写 allowed audit。
- 拒绝、not_found、invalid payload、重复作废等场景写稳定 audit。
- 治疗摘要列表展示作废状态。
- 治疗摘要详情展示作废时间、作废人、作废原因。
- 客户时间线标记对应治疗摘要已作废。
- 作废摘要不能继续生成随访建议。
- 作废摘要不能继续人工确认创建来源随访任务。
- 已存在来源随访任务继续保留，UI 显示“来源治疗摘要已作废”提示。
- 补充 API、repository、parser、UI 和 workspace smoke 测试。
- README、roadmap、devlog 和 Phase 19 spec / plan 文档收尾。

Phase 19 v1 不改变：

- 现有治疗摘要创建 API 的结构化字段白名单。
- 现有治疗摘要编辑 PATCH 的结构化字段白名单。
- 现有客户、预约、随访主流程。
- 现有 follow-up 状态机。
- 现有来源随访任务外键关系。
- 现有租户隔离原则。

## 5. 不纳入本阶段

Phase 19 不做：

- 治疗摘要硬删除。
- 批量作废。
- 恢复作废。
- 版本历史。
- diff 展示。
- 自动取消既有随访任务。
- 自动修改既有随访任务状态。
- 自动触达客户。
- 自动发送微信。
- 自动发送短信。
- 电话外呼。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件上传。
- 图片 / 文件原文保存。
- AI provider。
- AI 生成护理建议。
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
- 业务事件埋点实现。
- 随访路径运营分析实现。
- 经营智能中心实现。
- 大规模 UI 重构。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode。

## 6. 作废状态字段设计

Phase 19 v1 建议新增最小生命周期字段，不新增 revision 表，不新增单独作废历史表。

建议在 `treatment_summaries` 增加：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `voidedAt` | nullable `timestamp with timezone` | 作废时间；为空表示 active |
| `voidedBy` | nullable `varchar(96)` | 作废操作者，来自 access context 的 `userId` |
| `voidReasonCode` | nullable `varchar(64)` | 结构化作废原因 code |
| `voidReason` | nullable `varchar(200)` | 安全短文本说明，不允许医疗正文或 PII |

DTO 建议返回：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `status` | `"active"` 或 `"voided"` | 由 `voidedAt` 派生 |
| `voidedAt` | nullable `string` | 作废时间 ISO |
| `voidedBy` | nullable `string` | 作废人内部 ID |
| `voidReasonCode` | nullable `string` | 作废原因 code |
| `voidReason` | nullable `string` | 作废原因短说明 |

不建议在 v1 使用数据库 enum 表示状态，原因：

- 历史数据只需 `voidedAt is null` 即可视为 active。
- 软作废状态由生命周期字段可稳定派生。
- 避免为 `active | voided` 引入额外 enum migration 风险。
- 后续如果需要恢复、归档、版本历史，可以再单独规划生命周期模型。

列表和 timeline 查询默认返回 active 与 voided 摘要，UI 明确显示状态。v1 不新增作废状态筛选，避免扩大 query parser 和 UI 范围。

## 7. 作废 API 路径设计

建议新增：

```text
POST /api/institution/treatment-summaries/[summaryId]/void
```

选择 `POST .../void`，而不是 `DELETE`，原因：

- 作废不是硬删除。
- 需要提交作废原因 payload。
- 需要明确这是业务命令，不是资源删除。
- 避免误导调用方认为记录会消失。

请求 payload 建议：

```json
{
  "reasonCode": "duplicate_summary",
  "reasonText": "重复录入，保留较新的治疗摘要"
}
```

API 规则：

1. 未登录返回 `401`：`请先登录`。
2. 无权限返回 `403`：`没有访问权限`。
3. 服务端从 session / access context 推导 `tenantId`。
4. 不接受前端传入 `tenantId`。
5. 校验当前用户具备 `treatment_summary:update` 权限。
6. 先按 `tenantId + summaryId` 校验 treatment summary 属于当前 tenant。
7. summary 不存在或跨租户返回 `404`：`记录不存在`。
8. payload 非法返回 `400`，错误文案必须中文、稳定、无敏感信息。
9. 已作废摘要重复作废返回 `409`：`治疗摘要已作废`。
10. 作废成功返回安全 DTO，不返回 `tenantId`。
11. 作废成功写 allowed audit。
12. 拒绝、not_found、invalid payload、重复作废等场景写稳定 audit。
13. 数据服务异常返回 `503`：`数据服务暂时不可用`。
14. 错误响应不得泄露 SQL、stack、token、secret、`DATABASE_URL` 或连接串。

作废成功响应建议：

```json
{
  "record": {
    "id": "trt_001",
    "customerId": "cust_001",
    "appointmentId": "appt_001",
    "treatmentDate": "2026-06-01T04:00:00.000Z",
    "treatmentProject": "光电修复",
    "treatmentCategory": "laser_repair",
    "treatmentStage": "D7 复诊",
    "recoveryStage": "D7",
    "riskLevel": "watch",
    "ownerUserId": "doctor-lin",
    "summary": "结构化短摘要",
    "nextCareAction": "D14 人工回访恢复阶段",
    "tags": ["结构化摘要"],
    "status": "voided",
    "voidedAt": "2026-06-02T09:00:00.000Z",
    "voidedBy": "demo-user-admin",
    "voidReasonCode": "duplicate_summary",
    "voidReason": "重复录入，保留较新的治疗摘要",
    "createdAt": "2026-06-01T04:01:00.000Z",
    "updatedAt": "2026-06-02T09:00:00.000Z"
  }
}
```

## 8. 作废原因 parser 设计

建议新增 `parseVoidTreatmentSummaryPayload`。

允许字段：

| 字段 | 是否必填 | 规则 |
| --- | --- | --- |
| `reasonCode` | 是 | 结构化 code，只允许白名单 |
| `reasonText` | 视 code 而定 | 短文本，建议 1 到 160 字；`other` 时必填 |

建议 reason code：

| code | 中文说明 |
| --- | --- |
| `duplicate_summary` | 重复录入 |
| `created_by_mistake` | 误录入 |
| `wrong_customer_or_appointment` | 客户或预约关联错误 |
| `entered_wrong_treatment` | 治疗项目或治疗事实错误 |
| `manual_governance_review` | 人工治理复核 |
| `other` | 其他原因，必须填写短说明 |

parser 必须拒绝：

- 非 JSON object。
- 未知字段。
- `tenantId`。
- `customerId`。
- `id`。
- `createdAt`。
- `updatedAt`。
- `voidedAt`。
- `voidedBy`。
- `status`。
- 空 reason code。
- 非白名单 reason code。
- 过长 reason text。
- `other` 但未提供 reason text。

作废原因禁止包含：

- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 图片 / 文件原文。
- 图片 URL。
- 文件 URL。
- AI 生成内容。
- 外部系统同步原文。
- 外部系统 raw payload。
- 请求体。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

parser 返回的 `voidReason` 应是安全短文本。审计事件不记录 payload，也不记录 `voidReason` 原文。

## 9. RBAC / access resource 设计

当前系统已有：

- resource：`treatment_summary`
- actions：`read_own_tenant`、`create`、`update`
- `tenant_admin` 已具备 `treatment_summary:update`
- 未开放 `treatment_summary:delete`

Phase 19 v1 推荐 **复用 `treatment_summary:update` 作为作废权限**。

理由：

- 作废是治疗摘要生命周期更新，不是硬删除。
- 当前 `ACCESS_ACTIONS` 没有 `void`，新增 action 会扩大权限模型变更面。
- Phase 19 不需要重构 RBAC。
- 复用 update 能保持和 Phase 18 编辑能力一致的最小权限边界。
- 后续如果需要更细粒度的“可编辑但不可作废”角色，再单独规划 `void` action 或细粒度 policy。

Phase 19 v1 不做：

- 不新增 `delete` 权限。
- 不开放 `treatment_summary:delete`。
- 不重构权限模型。
- 不影响已有 customer / appointment / followup 权限。
- 不新增平台角色对机构治疗摘要的操作权限。

如果后续实现阶段决定新增 `void` action，必须单独说明原因，并至少覆盖：

- `ACCESS_ACTIONS` 新增 `void`。
- `tenant_admin` 对 `treatment_summary:void` 的最小授权。
- 其他角色默认拒绝。
- audit query parser 对 action 白名单更新。
- access control 单元测试。
- API route 权限测试。

但 Phase 19 v1 默认不推荐这条路线。

## 10. 审计事件设计

治疗摘要作废成功应写 allowed audit。

推荐审计字段：

| 字段 | 建议值 |
| --- | --- |
| `resource` | `treatment_summary` |
| `resourceId` | 被作废的 treatment summary id |
| `action` | `update` |
| `result` | `allowed` |
| `reason` | `treatment_summary_voided` |
| `tenantId` | 当前 access context 的 `tenantId` |
| `actorId` | 当前 access context 的 `userId` |
| `occurredAt` | 服务端时间 |

建议新增稳定 audit reason：

- `treatment_summary_voided`
- `treatment_summary_already_voided`
- `invalid_treatment_summary_void_payload`
- `voided_treatment_summary_follow_up_blocked`

拒绝场景建议：

| 场景 | HTTP | audit result | audit reason |
| --- | --- | --- | --- |
| 无权限 | `403` | `denied` | access decision reason |
| 缺少 tenant | `403` | `denied` | `missing_tenant` |
| 记录不存在或跨租户 | `404` | `denied` | `not_found_or_not_owned` |
| payload 非法 | `400` | `denied` | `invalid_treatment_summary_void_payload` |
| 重复作废 | `409` | `denied` | `treatment_summary_already_voided` |
| 作废摘要生成建议被阻断 | `409` | 可不写 read audit，或写 denied | `voided_treatment_summary_follow_up_blocked` |
| 作废摘要创建随访任务被阻断 | `409` | `denied` | `voided_treatment_summary_follow_up_blocked` |

审计中不得写入：

- 请求体。
- `reasonText` 原文。
- 完整治疗正文。
- 完整病历正文。
- 诊疗原文。
- 咨询全文。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 图片 / 文件原文。
- 外部系统 payload。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

由于 `audit_events.reason` 当前不是数据库 enum，新增 audit reason 通常不需要 schema / migration，但需要同步 TypeScript union、query 白名单和测试。

## 11. 作废后列表 / 详情 / timeline 展示策略

### 11.1 治疗摘要列表

治疗摘要列表应继续展示 active 和 voided 摘要。作废摘要不从列表中消失。

列表展示建议：

- 显示状态标签：`有效` / `已作废`。
- 作废摘要行使用稳定弱化样式，但文字仍可读。
- 作废摘要仍可打开安全详情。
- 作废摘要不展示“查看随访建议”作为可执行入口，或入口点击后展示稳定阻断提示。
- 作废摘要不提供再次作废按钮。
- v1 不做批量作废。
- v1 不做恢复。

### 11.2 治疗摘要详情

详情应显示：

- `status`
- `voidedAt`
- `voidedBy`
- `voidReasonCode`
- `voidReason`

作废摘要详情应明确：

```text
该治疗摘要已作废，不再作为后续随访建议或任务创建依据。
```

### 11.3 客户时间线

客户时间线应保留治疗摘要节点，但标记为已作废。

展示建议：

- timeline 节点 title 或 status 显示“已作废”。
- 节点 summary 仍使用结构化短摘要，不展示完整医疗正文。
- 节点上显示作废状态和作废时间。
- 不删除历史节点。
- 不把作废摘要当作新的治疗事件重复插入。

## 12. 作废后随访建议和随访任务创建阻断策略

作废后的治疗摘要不允许继续作为新运营动作的依据。

### 12.1 `GET follow-up-suggestions`

路径：

```text
GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions
```

作废摘要处理：

- 按 `tenantId + summaryId` 找到摘要后，如 `status === "voided"`，返回 `409`。
- 响应建议：

```json
{
  "error": "治疗摘要已作废，不能生成随访建议"
}
```

- 不返回 suggestions。
- 不写数据库。
- 不创建随访任务。
- 错误响应不包含作废原因原文、PII 或内部错误细节。

### 12.2 `POST follow-up-tasks`

路径：

```text
POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks
```

作废摘要处理：

- 服务端重新读取当前摘要。
- 如摘要已作废，返回 `409`。
- 响应建议：

```json
{
  "error": "治疗摘要已作废，不能创建来源随访任务"
}
```

- 不创建任务。
- 写 denied audit，reason 使用 `voided_treatment_summary_follow_up_blocked`。
- 不自动触达客户。
- 不自动修改任何已有随访任务。

## 13. 已存在来源随访任务的展示策略

Phase 19 v1 不自动取消已经创建的来源随访任务。

原因：

- 已有任务可能已经进入人工执行流程。
- 自动取消可能影响机构人员正在处理的工作。
- 作废摘要不等于已创建任务一定无效，任务是否取消需要人工判断。
- 自动改任务状态属于随访状态机和任务治理增强，应单独规划。

v1 策略：

- 已存在来源随访任务继续保留。
- `sourceTreatmentSummaryId` 和 `sourceSuggestionKey` 继续保留。
- 随访列表和治疗摘要详情可提示：`来源治疗摘要已作废`。
- 治疗摘要详情中展示已有来源任务时，应明确“不会自动取消既有任务”。
- 是否需要人工取消任务，留给后续阶段规划。
- 不自动触达客户。
- 不自动修改任务状态。

## 14. 是否新增 schema / migration

Phase 19 v1 需要新增 schema / migration。

原因：

- 当前 `treatment_summaries` 没有生命周期字段。
- 作废需要可追溯的作废时间、作废人和作废原因。
- 仅用现有 `updatedAt` 或修改 `summary` 字段无法表达正式作废状态。
- 不能用硬删除满足追溯要求。

Migration 只允许：

- 新增 nullable 字段。
- 新增必要索引。

Migration 不允许：

- drop 表。
- 删除字段。
- 修改已有字段类型。
- 重命名已有字段。
- 删除已有数据。
- 破坏既有治疗摘要。
- 破坏既有 `follow_up_tasks` 来源外键。

历史数据策略：

- `voidedAt is null` 的历史治疗摘要默认视为 `active`。
- 历史数据不需要回填作废字段。
- seed 数据可保留 active，也可新增一条作废演示摘要用于 UI / smoke，但不能包含真实敏感信息。

## 15. 租户隔离设计

Phase 19 必须继续遵守以下租户隔离规则：

- `tenantId` 只能来自服务端 access context。
- 作废 API 不接受 query、header、body、localStorage 中的 `tenantId`。
- repository void 方法必须按 `tenantId + summaryId` 更新。
- 作废前必须确认 summary 属于当前 tenant。
- 跨租户或不存在 summary 统一返回 `404`，不泄露其他租户是否存在该 summary。
- follow-up suggestions 和 follow-up tasks 阻断逻辑也必须按当前 tenant 读取 summary。
- 来源随访任务查询必须继续绑定当前 tenant。
- 平台角色不能通过机构端 API 作废机构治疗摘要。
- 平台端不新增治疗摘要跨租户作废能力。
- 错误文案不能泄露其他租户的客户、预约、治疗摘要或随访任务存在性。

## 16. PII / 医疗隐私边界

Phase 19 涉及医疗结构化摘要生命周期，必须按高敏感能力处理。

不得进入 schema、API、DTO、UI、audit、测试快照或日志：

- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 图片 / 文件原文。
- 图片 URL。
- 文件 URL。
- 外部系统 raw payload。
- AI prompt。
- AI completion。
- embedding。
- API Key。
- OAuth token。
- Webhook secret。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。

作废原因只能是短文本说明和结构化 reason code。作废原因不是医疗正文、不是投诉记录、不是咨询全文，也不能成为存储外部系统原文的入口。

## 17. 推荐 PR 拆分

### PR 1：Phase 19 spec / plan 文档

范围：

- 新增 Phase 19 design spec。
- 新增 Phase 19 implementation plan。
- 明确作废目标、API、schema、parser、RBAC、审计、UI、随访阻断、租户隔离、PII 边界和 PR 拆分。

风险：

- 文档边界不清，导致后续 PR 混入硬删除、批量作废、自动取消任务、AI、HIS、企微或外部系统。
- 没有提前明确 schema / API / audit reason，导致 PR 2 和 PR 3 行为漂移。

验证：

- `git diff --check`

本 PR 只改 Markdown，不运行完整 test / typecheck / build。原因：未修改 TypeScript、React 页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

### PR 2：schema / migration / domain / parser / repository 作废地基

范围：

- 新增 `treatment_summaries` 作废字段。
- 新增 migration 和 meta。
- 更新 schema 测试。
- 更新治疗摘要 domain 类型和 DTO mapper。
- 新增 `parseVoidTreatmentSummaryPayload`。
- 新增 repository void 方法。
- 新增作废原因 parser 测试。
- 新增 repository 作废测试。
- 更新 audit reason union 和 query 白名单，如 PR 2 选择先引入 reason。

风险：

- migration 误改已有字段或破坏历史数据。
- 作废字段未 nullable，导致历史数据不兼容。
- DTO 未显式白名单，误返回 `tenantId` 或敏感字段。
- parser 允许 reason text 夹带 PII 或完整医疗正文。
- repository 未绑定 `tenantId + summaryId`。

验证：

- `git diff --check`
- `node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts`
- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryWriteInput.test.ts src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
- `node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventsDomain.test.ts src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `./node_modules/.bin/tsc --noEmit`

### PR 3：作废 API，并阻断作废摘要继续生成建议或创建随访任务

范围：

- 新增 `POST /api/institution/treatment-summaries/[summaryId]/void`。
- 使用 `treatment_summary:update` 权限。
- 服务端从 access context 推导 `tenantId`。
- 不接受前端 `tenantId`。
- 成功作废返回安全 DTO。
- 成功和拒绝路径写稳定 audit。
- 作废后 `GET follow-up-suggestions` 返回稳定 `409`。
- 作废后 `POST follow-up-tasks` 返回稳定 `409`。
- 不做 UI。

风险：

- 重复作废语义不稳定。
- 作废 API 和 PATCH API 混用，导致编辑 payload 被误用为作废。
- suggestions GET 对作废摘要仍返回建议。
- follow-up task POST 对作废摘要仍创建任务。
- audit 记录请求体或作废原因原文。

验证：

- `git diff --check`
- `node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts`
- `node scripts/run-vitest.mjs run src/modules/audit/tests`
- `./node_modules/.bin/tsc --noEmit`

### PR 4：机构端列表、详情、客户 timeline、来源任务提示展示作废状态

范围：

- 治疗摘要列表显示作废状态。
- 治疗摘要详情显示作废时间、作废人和作废原因。
- 治疗摘要详情提供单条作废入口。
- 作废成功后刷新列表和当前详情。
- 客户时间线标记治疗摘要已作废。
- 作废摘要不能继续创建随访建议或来源随访任务。
- 已存在来源随访任务显示“来源治疗摘要已作废”提示。
- 不做编辑 / 删除 / 批量作废。
- 不自动取消已有随访任务。

风险：

- UI 把作废描述成删除。
- UI 隐藏作废摘要，破坏历史追溯。
- UI 对作废摘要仍展示可创建任务入口。
- 来源任务提示误导为自动取消。
- 前端请求 body 携带 `tenantId` 或敏感字段。

验证：

- `git diff --check`
- `node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx src/modules/institution/tests/CustomerTimelineDomain.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts`
- `node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- `./node_modules/.bin/tsc --noEmit`

### PR 5：smoke / 文档收尾

范围：

- 补 workspace smoke。
- 补敏感字段 smoke。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 19 spec / plan 完成状态。
- 标记 Phase 19 完成。

风险：

- README 或 roadmap 误写成完成硬删除、真实 HIS、企微、AI 或自动触达。
- smoke 未覆盖作废后阻断建议和任务创建。
- 文档遗漏“已存在来源随访任务不自动取消”。

验证：

- `git diff --check`
- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`

## 18. Phase 19 完成标准

Phase 19 完成时应满足：

- 治疗摘要可被当前租户授权用户软作废。
- 作废不删除治疗摘要记录。
- 作废不删除客户时间线节点。
- 作废不删除来源随访任务。
- 作废状态在列表、详情和客户时间线中明确展示。
- 作废摘要不能继续生成新的随访建议。
- 作废摘要不能继续人工确认创建新的来源随访任务。
- 已存在来源随访任务保留，并显示来源摘要已作废提示。
- 作废成功和拒绝路径写稳定 audit。
- 作废原因 parser 拒绝完整医疗正文、PII、外部 raw payload 和内部敏感信息。
- API 不接受前端 `tenantId`。
- repository 始终按 `tenantId + summaryId` 操作。
- 历史治疗摘要默认 active。
- 不开放 delete。
- 不进入 AI、RAG、HIS、企微、Webhook、OAuth、支付或外部系统。

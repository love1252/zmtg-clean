# Phase 17 HIS 接入标准模型 / 治疗事件标准化 v1 设计

> 日期：2026-06-02
> 状态：Phase 17 已完成。PR 1 已固化 HIS 接入标准模型 / 治疗事件标准化 spec / plan；PR 2 已完成 domain-only 标准治疗事件类型、mapper 契约和测试；PR 3 仅做文档收尾。Phase 17 不代表真实 HIS 接入完成，仍不包含 API、schema、migration、UI 或外部系统接入实现。

## 1. Phase 17 目标

Phase 17 默认选择 **HIS 接入标准模型 / 治疗事件标准化**。

目标是在不接真实 HIS、不做外部同步、不保存 HIS raw payload 的前提下，先定义智美天工内部的标准治疗事件模型，为后续以下能力提供统一数据标准：

- 不同 HIS 系统接入。
- 治疗项目路径引擎。
- 客户身份匹配。
- 治疗摘要生成或复核。
- 随访路径自动触发。
- 业务事件埋点体系。
- 随访路径运营分析。
- 经营智能中心。

本阶段只回答“外部治疗事实进入智美天工后应该被标准化为什么结构”，不回答“如何连接某个 HIS”“如何同步数据”“如何落库”“如何生成任务”“如何触达客户”。

Phase 17 v1 的核心原则：

- 字段白名单优先。
- 数据最小化优先。
- 租户隔离优先。
- 不保存 HIS raw payload。
- 不保存完整病历正文或完整治疗记录正文。
- 不把外部系统字段直接扩散到机构端 UI、审计或经营分析。
- 外部集成、身份匹配、路径引擎、事件采集均必须单独 Plan Mode。

## 2. 为什么优先做 HIS 接入标准模型 / 治疗事件标准化

Phase 12 到 Phase 16 已经完成结构化治疗摘要到随访任务的内部闭环：

- Phase 12：治疗记录结构化摘要 v1。
- Phase 13：治疗摘要人工录入 v1。
- Phase 14：治疗摘要管理能力 v1。
- Phase 15：治疗后护理 / 随访联动 v1。
- Phase 16：随访任务来源治理 v1。

当前系统已经能把机构端人工录入的结构化治疗摘要转化为可人工确认的内部随访任务，并能在随访列表中展示来源关系。下一步如果继续只在现有 `treatment_summaries` 上做编辑或作废，可以补齐操作治理，但不能解决长期外部数据接入的问题。

HIS 是智美天工长期最关键的数据来源之一。它承载客户治疗、项目、消费、复诊和疗程进度等业务事实。不同 HIS 厂商字段差异极大，如果后续直接按某个 HIS 的字段写入业务表，会导致：

- 内部模型被外部系统字段污染。
- 不同 HIS adapter 之间难以复用路径规则。
- 治疗项目、治疗类别和阶段无法稳定匹配路径模板。
- 客户身份匹配和经营分析缺少统一事件口径。
- 后续迁移、审计和隐私边界复杂度快速上升。

因此 Phase 17 先做内部标准模型，可以把后续集成链路固定为：

```text
外部 HIS 字段
↓
适配层映射
↓
智美天工标准治疗事件模型
↓
治疗摘要 / 路径引擎 / 随访任务 / 经营分析
```

本方向比直接做真实 HIS 接入更安全，也比直接做经营智能中心更有基础价值。

优先做本方向的价值：

- 长期商业模式匹配度最高：承接产品战略文档中的 HIS / 企业微信 / 经营智能路线。
- 架构稳定性最高：先定义标准事件，再决定落库和同步。
- 隐私风险可控：不接真实系统、不保存 raw payload、不展示敏感正文。
- 后续扩展清晰：能支撑路径引擎、身份匹配、业务事件和经营分析。
- 当前实现风险低：PR 1 只做文档，PR 2 已执行且仅做 domain-only 类型、mapper 契约和测试。

## 3. 为什么其他方向后置

### 3.1 治疗摘要编辑能力后置

治疗摘要编辑能力 v1 很适合承接 Phase 16，因为它能让机构端修正结构化摘要字段。但编辑会修改医疗敏感结构化记录，需要单独设计：

- 可编辑字段白名单。
- PATCH payload parser。
- 字段级敏感内容拦截。
- 修改前后值审计边界。
- 并发编辑和 stale update。
- 编辑后是否重新生成随访建议。
- 已创建随访任务与摘要修改后的关系。

Phase 17 先定义标准治疗事件模型，可以为后续编辑能力提供更清楚的字段语义。编辑能力建议作为 Phase 18 或后续独立阶段推进。

### 3.2 治疗摘要作废能力后置

治疗摘要作废能力有治理价值，但会引入生命周期语义和 schema / migration：

- 作废状态字段。
- 作废原因字段。
- 作废人和作废时间。
- 作废后是否允许查看建议。
- 已有来源随访任务是否提示来源已作废。
- 列表、时间线、详情和审计如何展示作废状态。
- 是否允许恢复。

这些问题应在治疗摘要生命周期阶段单独规划，不应混入 HIS 标准模型定义。

### 3.3 随访路径运营分析后置

随访路径运营分析需要稳定的路径进入、任务生成、触达、回复、复诊、到院、消费等事件来源。当前系统有治疗摘要来源随访任务，但缺少完整路径事件和转化事件。

如果 Phase 17 直接做分析页面，容易变成基于现有任务表的弱统计，无法回答真实经营问题。路径分析建议在标准治疗事件和业务事件模型之后推进。

### 3.4 业务事件埋点体系后置

业务事件埋点体系是经营智能的关键底座，但它一旦进入真实采集，就需要：

- event table。
- payload 白名单。
- 事件幂等。
- 租户隔离。
- 保留周期。
- 查询 API。
- 审计与敏感字段扫描。

事件 payload 如果不受控，隐私风险会高于治疗摘要编辑。Phase 17 只在文档中说明标准治疗事件与后续 business events 的关系，不实现事件采集。

### 3.5 经营智能中心 v1 规划后置

经营智能中心依赖客户、预约、治疗、随访、消费、触达、回复和业务事件。当前还没有标准治疗事件、路径事件和转化事件模型，直接做经营智能页面容易空壳化。

Phase 17 先补数据标准，后续再规划经营智能中心更稳。

## 4. 标准治疗事件模型 v1 范围

Phase 17 v1 可以定义：

- 标准治疗事件字段。
- 标准化状态枚举。
- HIS 字段映射原则。
- 字段白名单。
- 禁止字段。
- 与现有 `treatment_summaries` 的关系。
- 与预约、客户、随访任务、客户时间线的关系。
- 与后续治疗项目路径引擎的关系。
- 与后续客户身份匹配的关系。
- 与后续业务事件埋点体系的关系。
- 后续 PR 拆分建议。

Phase 17 v1 不定义：

- 真实 HIS adapter。
- 真实外部连接器配置。
- Webhook 签名、幂等、重试。
- 文件导入或批量导入。
- 数据同步任务。
- 标准治疗事件数据库表。
- API route。
- UI。
- 自动生成治疗摘要。
- 自动生成随访任务。
- 自动触达客户。

本阶段的“标准治疗事件模型”是内部标准模型建议，不是数据库 schema。

## 5. 不纳入本阶段

Phase 17 不做：

- 真实 HIS 接入。
- HIS adapter 实现。
- Webhook。
- 文件导入。
- 外部系统同步。
- 外部系统账号配置。
- API Key。
- OAuth。
- 真实企业微信接入。
- 个人微信自动发送。
- 短信发送。
- 电话外呼。
- AI provider。
- Agent。
- RAG。
- 经营智能中心实现。
- 随访路径运营分析实现。
- 业务事件埋点实现。
- event table。
- 标准治疗事件数据库 schema。
- migration。
- API route。
- UI。
- 支付。
- 合同。
- 发票。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件原文。
- 术前术后照片原文。
- 自动触达客户。
- 大规模 UI 重构。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode。

## 6. 标准治疗事件字段设计

以下字段是标准治疗事件模型 v1 的建议字段，不是本阶段 schema。

| 字段 | 类型建议 | 是否进入普通机构端 DTO | 说明 |
| --- | --- | --- | --- |
| `eventId` | `string` | 否 | 智美天工内部标准事件 ID，未来如落库由服务端生成 |
| `tenantId` | `string` | 否 | 当前租户归属，只能来自服务端上下文或可信同步任务上下文 |
| `sourceSystem` | enum/string | 视场景 | 来源系统，例如 `his`、`manual`、`import`、`other` |
| `sourceEventId` | `string | null` | 否 | 外部事件追踪 ID，只用于 adapter 幂等和排障，不应暴露给普通机构端用户 |
| `sourceCustomerId` | `string | null` | 否 | 外部系统客户 ID，只用于身份匹配，不作为当前系统授权依据 |
| `customerMatchKey` | `string | null` | 否 | 身份匹配 key，可为 hash 或脱敏组合，不应保存原始敏感信息 |
| `customerName` | `string | null` | 需谨慎 | 可选客户姓名或脱敏姓名；真实保存策略需身份匹配阶段单独评估 |
| `maskedPhone` | `string | null` | 可展示 | 脱敏手机号，例如 `138****8888`；不保存手机号原文 |
| `treatmentDate` | ISO datetime | 是 | 治疗发生时间或 HIS 中可确认的治疗时间 |
| `treatmentProject` | `string` | 是 | 标准化后的项目名称或机构展示项目名 |
| `treatmentCategory` | enum/string | 是 | 标准项目分类，用于路径模板匹配，例如 `laser_repair`、`injection_review` |
| `treatmentStage` | `string` | 是 | 治疗阶段，例如初治、复诊、D7 复查、疗程第 N 次 |
| `treatmentStatus` | enum/string | 是 | 标准状态，例如 `planned`、`performed`、`cancelled`、`completed`、`revised` |
| `appointmentRef` | `string | null` | 可展示引用 | 内部预约引用或外部预约引用的安全映射，不直接作为授权依据 |
| `doctorRef` | `string | null` | 可展示引用 | 医生、治疗人员或负责人引用 ID，不保存医生隐私正文 |
| `operatorRef` | `string | null` | 可展示引用 | 操作员、咨询师、护理人员或录入人员引用 ID |
| `departmentRef` | `string | null` | 可展示引用 | 科室、门店、治疗室或业务部门引用 ID |
| `amount` | decimal/string | 后续评估 | 金额字段可用于经营分析，但涉及消费/支付边界，v1 仅定义，不实现 |
| `currency` | `string` | 后续评估 | 货币代码，例如 `CNY`；与支付/财务实现解耦 |
| `riskLevel` | `normal | watch | urgent` | 是 | 复用现有随访风险等级口径 |
| `summary` | `string` | 是 | 结构化短摘要，禁止完整治疗正文或病历正文 |
| `nextCareAction` | `string` | 是 | 下一步护理或人工跟进动作 |
| `tags` | `string[]` | 是 | 安全标签，不包含 PII、raw payload 或完整正文 |
| `occurredAt` | ISO datetime | 是 | 业务事实发生时间，通常来自 HIS 事件 |
| `receivedAt` | ISO datetime | 否 | 智美天工接收或标准化时间，未来用于同步排障和延迟分析 |

### 6.1 `sourceSystem` 建议枚举

Phase 17 v1 建议保留以下来源语义：

| 值 | 含义 |
| --- | --- |
| `his` | 来自 HIS adapter 标准化后的事件 |
| `manual` | 来自机构端人工录入或人工整理 |
| `import` | 来自后续受控文件导入或批量导入 |
| `other` | 其他已授权外部系统 |

本阶段不实现这些来源，只定义语义。

### 6.2 `treatmentStatus` 建议枚举

`treatmentStatus` 用于表达治疗事件本身的业务状态，不等同于随访任务状态。

建议 v1 枚举：

| 值 | 含义 |
| --- | --- |
| `planned` | 已计划或已预约治疗，但尚未确认完成 |
| `performed` | 已执行治疗 |
| `completed` | 治疗记录已完成或结案 |
| `cancelled` | 治疗取消 |
| `revised` | 外部系统对治疗事件做了修正 |

后续 HIS adapter 可把不同 HIS 的状态映射到该标准枚举。未知或无法确认的状态不应直接落入自由文本状态，建议进入 adapter 的异常映射队列或人工复核。

### 6.3 金额字段边界

`amount` 和 `currency` 对经营智能有价值，但涉及消费、支付、合同、发票和财务状态边界。

Phase 17 v1 只定义字段语义：

- 不新增消费表。
- 不新增支付表。
- 不做收入归因。
- 不展示客户消费明细。
- 不把金额用于计费或套餐 enforcement。

后续如果要接入消费事件，应单独进入 Plan Mode。

## 7. HIS 字段映射原则

不同 HIS 的字段命名、状态枚举、项目名称、时间语义、客户 ID 和治疗项目层级都可能不同。智美天工不应直接依赖某个 HIS 的字段结构。

标准映射链路：

```text
外部 HIS 字段
↓
HIS adapter 映射
↓
智美天工标准治疗事件模型
↓
治疗摘要 / 路径引擎 / 随访任务 / 经营分析
```

映射原则：

1. 每个 HIS 需要独立 adapter。
2. adapter 后续必须单独 Plan Mode。
3. adapter 输入可以读取外部 payload，但 raw payload 不直接入库。
4. adapter 输出只能是字段白名单内的标准治疗事件。
5. 不同 HIS 的项目名称需要映射到标准项目类型。
6. 同一项目在不同机构可能有不同命名，映射规则必须支持租户级配置或租户级别名。
7. 标准项目分类必须支持后续路径模板匹配。
8. 状态映射必须明确未知状态处理策略，不能把外部未知状态无边界写入内部业务状态。
9. 身份匹配字段必须最小化，不能传播手机号、身份证号、病历号原文。
10. 任何跨系统 ID 只能作为引用和匹配辅助，不能作为租户授权依据。

示例映射方向：

| HIS 概念 | 标准字段 |
| --- | --- |
| HIS 订单号 / 治疗记录号 | `sourceEventId` |
| HIS 客户编号 | `sourceCustomerId` |
| HIS 治疗时间 / 到院治疗时间 | `treatmentDate` / `occurredAt` |
| HIS 项目名称 | `treatmentProject` |
| HIS 项目类别 / 收费项目分类 | `treatmentCategory` |
| HIS 医生 / 治疗师 | `doctorRef` / `operatorRef` |
| HIS 科室 / 门店 | `departmentRef` |
| HIS 金额 | `amount` / `currency` |
| HIS 治疗状态 | `treatmentStatus` |

## 8. 与现有 `treatment_summaries` 的关系

当前 `treatment_summaries` 是机构端可查看、可运营使用的结构化治疗摘要表，已经支持：

- 人工录入。
- 当前租户列表查询。
- 客户详情 timeline 展示。
- 治疗后护理 / 随访建议。
- 人工确认创建随访任务。
- 来源随访任务治理。

标准治疗事件与 `treatment_summaries` 的关系：

- 标准治疗事件是未来 HIS 接入后的“原始业务事件标准化结果”。
- `treatment_summaries` 是机构端面向运营使用的结构化摘要。
- 标准治疗事件可以作为生成治疗摘要的来源。
- 一个标准治疗事件未来可能生成 0 条或 1 条治疗摘要。
- 多个标准治疗事件未来也可能合并为 1 条治疗摘要，例如同一疗程的多个细分项目。
- 当前阶段不自动从标准治疗事件生成治疗摘要。
- 当前阶段不修改 `treatment_summaries` schema。
- 当前阶段不修改治疗摘要创建、列表、建议、随访任务创建或来源治理逻辑。

后续如果需要建立标准治疗事件与 `treatment_summaries` 的持久化关系，应单独评估：

- 是否新增 `standard_treatment_events` 表。
- 是否在 `treatment_summaries` 增加 `sourceTreatmentEventId`。
- 是否需要事件到摘要的人工确认流程。
- 是否需要摘要生成审计。
- 是否允许摘要重新生成或覆盖。

## 9. 与预约、客户、随访任务、客户时间线的关系

### 9.1 与客户的关系

标准治疗事件必须绑定当前租户。未来如果能匹配到内部客户，应关联内部 `customerId`；如果不能匹配，应进入待匹配状态或人工确认队列。

本阶段不实现客户身份匹配，不新增待匹配表。

### 9.2 与预约的关系

`appointmentRef` 可以表示治疗事件与预约的关联。未来 adapter 可以基于 HIS 预约号、内部预约 ID 或映射表建立关联。

本阶段不修改 `appointments`，也不自动把 HIS 治疗事件关联到预约。

### 9.3 与随访任务的关系

未来路径引擎可以基于标准治疗事件生成随访建议，再由机构人员人工确认创建内部随访任务。

本阶段不创建随访任务，不修改 Phase 15 / Phase 16 已完成的治疗摘要来源随访任务逻辑。

### 9.4 与客户时间线的关系

未来客户时间线可以展示来自标准治疗事件或其生成的治疗摘要节点。v1 推荐客户时间线优先展示机构端可理解的 `treatment_summaries`，而不是直接展示标准事件。

本阶段不修改 customer timeline API，也不新增 timeline event type。

## 10. 与后续治疗项目路径引擎的关系

治疗项目路径引擎可以基于标准治疗事件判断：

- 做了什么项目。
- 什么时候做的。
- 属于什么治疗类别。
- 当前处于什么阶段。
- 是否需要术后护理。
- 是否到复诊周期。
- 是否适合复购提醒。
- 是否需要人工介入。

未来路径模板可以使用以下字段匹配：

- `treatmentCategory`
- `treatmentProject`
- `treatmentStage`
- `treatmentStatus`
- `riskLevel`
- `treatmentDate`
- `tags`

本阶段不实现路径引擎，不新增路径模板，不自动触发随访任务。

## 11. 与后续客户身份匹配的关系

未来客户身份匹配可基于：

- 姓名 + 手机号。
- `maskedPhone` / phone hash。
- HIS customer id。
- 企业微信 `external_userid`。
- 微信备注。
- 客户标签。
- 历史咨询记录。
- 历史预约和治疗记录。

标准治疗事件只为身份匹配预留最小字段：

- `sourceCustomerId`
- `customerMatchKey`
- `customerName`
- `maskedPhone`

边界：

- 当前阶段不实现身份匹配引擎。
- 当前阶段不保存手机号原文。
- `customerMatchKey` 不应保存原始敏感信息。
- 低置信度匹配必须后续人工确认。
- 跨系统映射关系必须绑定 `tenantId`。
- 匹配过程必须可审计。

## 12. 与后续业务事件埋点体系的关系

标准治疗事件可以作为后续 business events 的上游来源之一。

未来可能由标准治疗事件派生：

- `treatment_event_standardized`
- `treatment_summary_created_from_event`
- `followup_path_matched`
- `followup_path_entered`
- `followup_task_created`
- `appointment_created_after_followup`
- `treatment_completed_after_followup`
- `repurchase_detected`

本阶段只做对齐说明：

- 不实现事件采集。
- 不新增 event table。
- 不保存事件 payload。
- 不新增埋点 SDK。
- 不新增分析 API。
- 不新增经营智能页面。

后续业务事件体系必须单独 Plan Mode，定义事件类型、payload 白名单、租户隔离、保留周期、查询权限和敏感字段扫描。

## 13. 字段白名单

标准治疗事件 v1 白名单建议：

- `eventId`
- `tenantId`
- `sourceSystem`
- `sourceEventId`
- `sourceCustomerId`
- `customerMatchKey`
- `customerName`
- `maskedPhone`
- `treatmentDate`
- `treatmentProject`
- `treatmentCategory`
- `treatmentStage`
- `treatmentStatus`
- `appointmentRef`
- `doctorRef`
- `operatorRef`
- `departmentRef`
- `amount`
- `currency`
- `riskLevel`
- `summary`
- `nextCareAction`
- `tags`
- `occurredAt`
- `receivedAt`

即使后续进入 domain-only 类型，也只能定义这些字段或更小集合。任何新增字段都必须说明业务目的、隐私风险和是否进入普通机构端 DTO。

## 14. 禁止字段

Phase 17 文档、后续 domain 类型、mapper、测试、DTO、API、schema、审计和 UI 中均禁止保存或返回：

- HIS raw payload。
- HIS 原始响应体。
- 完整病历正文。
- 完整治疗记录正文。
- 诊疗原文。
- 咨询对话全文。
- 身份证号。
- 手机号原文。
- 病历号原文。
- 图片 / 文件原文。
- 术前术后照片原文。
- AI 生成内容。
- 外部系统 token。
- 外部系统 secret。
- API Key。
- OAuth token。
- Webhook secret。
- 数据库连接串。
- SQL。
- stack。
- request body 原文。
- external raw payload。
- embedding。
- AI prompt。
- AI completion。

禁止字段名示例：

- `rawPayload`
- `hisRawPayload`
- `requestBody`
- `medicalRecordBody`
- `treatmentRecordBody`
- `diagnosisText`
- `clinicalNote`
- `consultationTranscript`
- `phoneNumber`
- `idNumber`
- `medicalRecordNo`
- `imageUrl`
- `fileUrl`
- `beforePhotoUrl`
- `afterPhotoUrl`
- `token`
- `secret`
- `databaseUrl`
- `sql`
- `stack`

## 15. 是否新增 API

Phase 17 PR 1 不新增 API。

Phase 17 整体默认不新增公开 API。原因：

- 本阶段只定义标准模型。
- 真实 HIS 接入、adapter、Webhook、文件导入和同步任务都未进入实现。
- 治疗摘要现有 API 不需要为了标准模型改动。
- 客户时间线、随访任务和治疗摘要管理 API 保持不变。

后续如果需要暴露标准治疗事件查询、导入、预览或映射 API，必须单独进入 Plan Mode。

## 16. 是否新增 schema / migration

Phase 17 PR 1 不新增 schema / migration。

Phase 17 v1 默认不新增数据库结构。原因：

- 当前目标是标准模型定义，不是事件落库。
- 未来是否需要 `standard_treatment_events` 表、映射表、幂等表或异常队列表，需要结合真实 HIS adapter 设计。
- 过早建表容易锁死 raw payload、身份匹配和路径引擎边界。

后续如要落库，必须单独评估：

- `tenant_id + source_system + source_event_id` 幂等约束。
- 标准事件与内部客户的匹配状态。
- 标准事件与 `treatment_summaries` 的来源关系。
- raw payload 不入库策略。
- 保留周期。
- 查询权限。
- 审计策略。
- 索引和分页策略。

## 17. 租户隔离设计

标准治疗事件必须保持租户隔离：

- `tenantId` 只能来自服务端访问上下文、可信同步上下文或明确绑定租户的外部连接配置。
- 前端不能通过 URL、query、header、body、localStorage 或浏览器状态传入 `tenantId`。
- 外部系统账号、adapter 配置和同步任务必须绑定单一租户。
- `sourceCustomerId`、`sourceEventId` 不能作为授权依据。
- 同一个外部 ID 在不同租户下必须互相隔离。
- adapter 输出必须显式带当前可信 `tenantId`。
- 查询、生成摘要、路径匹配和事件派生必须始终带 `tenantId`。
- 平台端不得下钻机构客户治疗敏感详情。
- 任何跨租户分析只能使用聚合、安全、脱敏的运营指标。

未来真实接入时必须测试：

- 外部事件不能写入其他租户。
- 外部 `sourceCustomerId` 相同但租户不同，不会合并。
- adapter 不接受请求中任意 `tenantId`。
- DTO 不返回跨租户来源字段。
- 错误文案不泄露其他租户是否存在某个客户或治疗事件。

## 18. PII / 医疗隐私边界

标准治疗事件涉及医疗敏感业务事实，即使不保存完整正文，也必须遵守数据最小化。

隐私原则：

- 字段白名单。
- 数据最小化。
- 租户隔离。
- 客户授权。
- 审计日志。
- 外部系统接入单独 Plan Mode。
- raw payload 不直接入库。
- 敏感字段必须脱敏、哈希或不采集。
- 平台端不得下钻机构客户治疗敏感详情。

允许的低风险字段：

- 结构化项目名。
- 标准项目分类。
- 治疗阶段。
- 治疗状态。
- 风险等级。
- 结构化短摘要。
- 下一步护理动作。
- 安全标签。
- 脱敏手机号。
- hash / match key。

禁止的高风险内容：

- 手机号原文。
- 身份证号。
- 病历号原文。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- HIS raw payload。
- 外部系统 token / secret。

审计边界：

- 审计可以记录标准事件的资源 ID、来源系统、动作、结果、reason。
- 审计不得记录 HIS payload、request body、完整摘要正文、PII、SQL、stack、token、secret 或连接串。

## 19. 推荐 PR 拆分

Phase 17 推荐拆成 3 个 PR。

### PR 1：Phase 17 spec / plan 文档

范围：

- 新增本设计文档。
- 新增 Phase 17 实施计划文档。
- 固化标准治疗事件模型、HIS 映射原则、字段白名单、禁止字段、隐私边界、租户隔离和后续 PR 拆分。
- 不改业务代码。
- 不改 API。
- 不改 schema / migration。
- 不改权限、认证或租户隔离。

### PR 2：domain-only 标准治疗事件类型与测试

范围：

- 定义 TypeScript domain 类型。
- 定义标准字段枚举和基础状态枚举。
- 定义 mapper 输入输出契约。
- 补字段白名单和禁止字段测试。
- 不新增 API。
- 不新增 schema。
- 不接真实 HIS。
- 不保存 raw payload。

PR 2 已执行，且保持 domain-only 边界。它只锁定 TypeScript 类型、`sourceSystem` 稳定集合、mapper 输入 / 输出契约、字段白名单、禁止字段边界和 institution 测试，不新增 API、schema、migration、repository、UI 或真实 HIS adapter。

### PR 3：文档收尾

范围：

- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 17 spec / plan 完成状态。
- 标记 Phase 17 完成。
- 给出 Phase 18 建议。

建议 Phase 18 候选：

1. 治疗摘要编辑能力 v1：允许机构端对白名单结构化字段受控编辑，写审计，不允许完整治疗记录正文、完整病历正文或咨询全文，不做删除。
2. HIS 标准治疗事件 mapper 继续增强：继续完善 mapper 契约、错误语义和测试覆盖，仍不接真实 HIS、不写 API、不落库。
3. 业务事件埋点体系 spec：只做事件模型规划，不做真实采集，不记录 raw payload、完整医疗正文或 PII。

## 20. 每个 PR 的范围、风险和验证方式

| PR | 范围 | 主要风险 | 验证方式 |
| --- | --- | --- | --- |
| PR 1 | spec / plan 文档 | 文档范围不清导致后续误进入真实 HIS、Webhook、外部同步、AI、企微或 schema | `git diff --check` |
| PR 2 | domain-only 类型与测试 | 类型字段过早模拟 schema、mapper 接受 raw payload、测试未覆盖禁止字段 | 相关 Vitest、`tsc --noEmit`、Next build、全量 Vitest、`git diff --check` |
| PR 3 | README / roadmap / devlog 收尾 | 文档宣称已完成未实现能力，或遗漏不纳入边界 | 全量文档检查、`git diff --check`；只改 Markdown，无需完整 test/typecheck/build |

PR 1 只改 Markdown，不需要运行完整 test / typecheck / build。原因：未修改 TypeScript、React 页面、API route、数据库 schema / migration、权限、认证或租户隔离。

## 21. Phase 17 PR 1 完成标准

PR 1 完成后应满足：

- 已新增 Phase 17 design spec。
- 已新增 Phase 17 implementation plan。
- 文档明确标准治疗事件模型 v1 是模型建议，不是 schema。
- 文档明确不新增 API。
- 文档明确不新增 schema / migration。
- 文档明确不接真实 HIS、不做 Webhook、不做同步、不保存 raw payload。
- 文档明确不进入 AI / RAG / Agent / 企微 / 自动触达。
- 文档明确与现有 `treatment_summaries`、预约、客户、随访任务、客户时间线的关系。
- 文档明确与后续路径引擎、身份匹配、业务事件、经营智能的关系。
- 文档明确字段白名单、禁止字段、租户隔离和 PII / 医疗隐私边界。
- `git diff --check` 通过。

## 22. Phase 17 最终状态

Phase 17 已完成：

- HIS 接入标准模型 / 标准治疗事件 v1 spec / plan。
- domain-only 标准治疗事件类型。
- `sourceSystem` 稳定集合：`his`、`manual`、`import`、`other`。
- mapper 输入 / 输出契约。
- 字段白名单。
- 禁止字段边界。
- 外部 `tenantId` 不可信的服务端上下文边界。
- raw payload、完整医疗正文、PII、token、secret、SQL、stack 和 request body 原文拒绝边界。
- 不自动生成或修改 `treatment_summaries` 的关系边界。
- institution 测试。

Phase 17 未完成、也不宣称完成：

- 真实 HIS 接入。
- Webhook。
- 文件导入。
- 外部系统同步。
- 数据库 schema / migration。
- API route。
- UI。
- 企业微信 / 个人微信。
- AI / RAG / Agent。
- 业务事件埋点实现。
- 经营智能中心实现。

后续进入 Phase 18 前应重新 Plan Mode。优先建议评估治疗摘要编辑能力 v1；HIS 标准治疗事件 mapper 继续增强和业务事件埋点体系 spec 可作为候选方向，但当前文档不进入 Phase 18 实现。

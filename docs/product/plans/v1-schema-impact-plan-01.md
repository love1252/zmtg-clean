# V1 主链路 schema impact plan 01

## 0. 文档元信息

- 任务编号：V1-SCHEMA-IMPACT-PLAN-01。
- 任务性质：docs-only / plan-only / no schema changes / no migration / no SQL / no runtime / no API / no audit runtime。
- 日期与时区：2026-06-09 CST +0800，来自本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：Stage 3 前置计划任务，承接 implementation readiness review 的 `Schema impact：Not Ready` 结论。
- 当前分支：`docs/v1-schema-impact-plan-01`。
- 任务启动基线：创建分支前的 `HEAD` 与 `origin/main` 均为 `357ec3e8747e0ae3c3f30881dabad118ca683747`。
- 本文档只新增 schema impact plan，不修改产品事实源、契约、测试计划、copy、既有 plan、runtime、schema 或 migration。

本文档不授权 schema / migration / SQL / runtime / API / route / service / repository / DTO / dashboard aggregation / audit runtime / audit metadata / audit enum。本文档中的候选对象、候选字段、候选表和候选状态均为影响评估语言，不是实现决定。

## 1. 背景与结论摘要

V1 UI mock 主链路已经完成，当前工作台已以 mock / seed / demo 口径串起三类机会展示、统一人工确认入口、基础运营看板指标和审计追踪样例。V1 contract-to-implementation plan 已完成，并明确后续任何 runtime 候选前必须先完成 schema impact review、API boundary review、field whitelist enforcement review、audit event naming review、dashboard aggregation plan 和 test plan refinement。V1 implementation readiness review 已完成，结论是 opportunity、manual confirmation、dashboard metrics、audit、field whitelist、test readiness、API / service / repository boundary 均为 Partial，schema impact 为 Not Ready。

本计划的核心结论：

- 当前不建议直接新增 schema / migration。
- 当前不建议直接用 `follow_up_tasks` 承接全部三类机会和统一人工确认状态。
- 当前不建议直接把 `customers.lifecycle` 当成 opportunity runtime。
- 当前不建议直接做 dashboard aggregation、SQL、audit runtime、audit metadata 或 audit enum。
- 当前可以确认已有 `customers`、`appointments`、`treatment_summaries`、`follow_up_tasks`、`audit_events` 和 dashboard view model 具备可复用基础，但不足以直接替代 V1 opportunity / manual confirmation / dashboard metric source 的正式 schema 决策。

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，主线是治疗后客户运营闭环。HIS 是数据来源之一，不是 V1 主链路，不阻塞 1.0。本文档不推进真实 HIS、真实 credential、真实外部网络、scheduler、worker、queue、自动触达、自动营销、真实预约、真实成交或医疗诊断。

## 2. 当前可复用数据基础

| 对象 | 当前用途 | 与 V1 主链路关系 | 可复用点 | 不足 | 风险 |
| --- | --- | --- | --- | --- | --- |
| `customers` | 租户内客户档案，包含生命周期、优先级、项目兴趣、脱敏手机号、脱敏病历号、标签和下一步动作。 | 是客户档案 / 患者信息、复购机会、沉睡客户机会和看板分层的基础。 | `lifecycle` 已含 `repurchase_window`、`silent_reactivation`；有租户隔离和脱敏字段。 | 不记录 opportunity 状态、来源对象、处理窗口、人工确认动作或低敏确认备注。 | 如果把生命周期等同机会 runtime，会混淆客户长期状态与单次可处理机会。 |
| `appointments` | 租户内预约 / 到院基础记录，包含状态、项目、时间和备注。 | 支撑预约 / 到院、复诊提醒来源和预约意向解释。 | `appointment_status` 已含 `pending_confirmation`、`confirmed`、`arrived`、`completed`。 | 预约状态不是 opportunity 状态；没有机会来源、确认动作、转化结果或 dashboard 去重口径。 | 直接复用预约状态会把内部预约生命周期误当三类机会状态。 |
| `treatment_summaries` | 治疗后结构化摘要，包含项目、分类、阶段、恢复阶段、风险等级、摘要、下一步建议和作废字段。 | 是复诊提醒、复购机会、随访建议和内部处理的关键来源。 | 有租户 / 客户 / 预约关联，有治疗时间、风险、阶段和来源随访所需字段。 | 不保存 opportunity 类型、机会状态、人工确认结果、dashboard bucket 或独立处理窗口。 | 如果把治疗摘要当机会对象，会丢失同一摘要产生多个机会、状态独立演进和人工确认去向。 |
| `follow_up_tasks` | 内部随访任务，包含状态、到期时间、建议动作、风险、来源治疗摘要和来源建议 key。 | 可承接人工确认后形成的内部随访任务，是 V1 闭环执行对象之一。 | 有 `sourceTreatmentSummaryId`、`sourceSuggestionKey` 和活跃来源去重索引，可防止同一摘要建议重复创建活跃随访。 | 状态仅有 `scheduled`、`due`、`in_progress`、`escalated`、`completed`、`cancelled`，不能表达 `dismissed`、`expired`、预约意向、继续观察、复购意向等 opportunity 状态。 | 直接把机会都落为随访任务，会把待确认提示、人工忽略和预约意向误实现为任务状态。 |
| `audit_events` | 审计事件底座，记录 actor、tenant、resource、action、result、reason、occurredAt、source。 | 支撑登录 / 租户 / RBAC / 审计追踪和部分业务动作可追踪。 | 有 repository、query、tenant/resource/action/result/reason 过滤和低敏 query DTO 基础。 | 当前无 metadata / payload 字段；V1 opportunity / manual / dashboard 的 resource、action、reason 命名尚未进入 runtime。 | 直接扩 audit reason 或 metadata 会污染现有审计语义，且可能误带高敏摘要。 |
| dashboard view model | `buildInstitutionDashboardSummary` 聚合客户、预约、随访，形成基础指标、supporting stats、action items 和 journey lanes。 | 是基础运营看板的现有结构基础。 | 已有 `repurchase_window` supporting stat，能以客户、预约、随访为输入生成只读 view model。 | 指标 key 仍是客户总数、高优先级客户、待确认预约、待处理随访；没有三类机会指标字典中的 V1 metric keys。 | 如果只在 view model 临时拼装 V1 指标，可能绕过 schema / 状态 / 去重决策。 |
| `customer_lifecycle` | 客户生命周期枚举，含 `consulting`、`scheduled`、`post_care`、`repurchase_window`、`silent_reactivation`。 | 可作为复购 / 沉睡机会来源信号。 | 已覆盖复购窗口和沉睡激活两个重要来源状态。 | lifecycle 是客户整体状态，不是单个机会，也不表达处理窗口、来源、确认动作和最终状态。 | 生命周期被过度复用会导致一个客户只能有一个粗粒度状态，无法处理多个并行机会。 |

## 3. V1 未来候选对象

以下对象只作为 candidate / 候选 / 可能 / 待评估，不是已决定实现。

### Opportunity candidate

- 可能需要的字段类别：内部 ID、租户 ID、客户 ID、机会类型、来源类型、来源 ID、来源摘要、触发原因、优先级、处理窗口、状态、demo / seed / mock 标记、低敏备注、创建和更新时间。
- 来源：`customers.lifecycle`、`appointments`、`treatment_summaries`、`follow_up_tasks`、路径模板、人工录入或未来低敏规则。
- 状态：可能使用 `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired` 等产品状态。
- 低敏字段边界：只能展示内部客户 ID、脱敏展示名、来源摘要、处理窗口、优先级、状态和低敏备注。
- 是否可能复用现有对象：可从现有对象派生来源摘要，也可在早期只以 view model 候选方式表达。
- 是否可能需要新 schema：若需要稳定状态持久化、去重、并发处理、历史复盘和 dashboard aggregation，可能需要新 schema。
- 风险：状态模型过早固化、与 `follow_up_tasks` 重叠、与 dashboard aggregation 耦合、与 audit runtime 耦合、字段白名单泄露风险。

### Manual confirmation candidate

- 可能需要的字段类别：确认对象类型、确认对象 ID、客户 ID、来源类型、来源 ID、状态前后、确认动作、结果状态、操作者角色或内部操作者 ID、低敏备注、确认时间、创建和更新时间。
- 来源：三类机会、治疗摘要随访建议、看板待处理项、客户时间线提示或人工录入机会。
- 状态：可能关联 `pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。
- 低敏字段边界：只记录动作、状态前后、操作者角色、来源摘要和低敏备注，不记录完整病历、完整联系方式、真实预约号或 raw payload。
- 是否可能复用现有对象：治疗摘要随访建议确认已可局部创建 `follow_up_tasks`，但它不是统一人工确认对象。
- 是否可能需要新 schema：若需要统一确认历史、幂等、并发处理、确认结果复盘和审计顺序，可能需要新 schema。
- 风险：并发 / 幂等 / 重复确认、操作人隐私、审计写入顺序、与 opportunity status 一致性、真实数据泄露风险。

### Dashboard metric source candidate

- 可能需要的字段类别：metric key、metric value、机会类型、状态集合、时间窗口、去重口径、source window、生成时间、demo / seed / mock 标记。
- 来源：机会候选对象、人工确认结果、`follow_up_tasks`、`customers.lifecycle`、`treatment_summaries`、dashboard view model。
- 状态：主要关注 `pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。
- 低敏字段边界：聚合层只能展示指标 key、数量、桶、时间窗口、空态和异常态，不直接展示高敏客户明细。
- 是否可能复用现有对象：可以复用现有 view model 结构承载展示层，但不能替代指标来源与去重决策。
- 是否可能需要新 schema：若需要快照、历史趋势、可追溯口径或 BI 化，可能需要新 schema；V1 当前不建议直接进入。
- 风险：误导真实统计、过早 BI 化、SQL / aggregation 复杂化、与真实经营结果混淆。

### Audit trace input candidate

- 可能需要的字段类别：资源类型、资源 ID、动作摘要、原因摘要、状态前后、机会类型、来源类型、来源 ID、操作者角色、tenant scope、demo / seed / mock 标记。
- 来源：机会进入待确认、人工确认动作、状态变化、看板指标来源或指标下钻。
- 状态：应覆盖进入待确认、确认、忽略、继续观察、转内部随访、转预约意向、完成、过期等动作。
- 低敏字段边界：仅记录低敏摘要，不记录完整手机号、身份证号、完整病历、HIS raw payload、外部消息原文、credential、token、secret。
- 是否可能复用现有对象：`audit_events` 可作为未来审计输出底座。
- 是否可能需要新 schema：当前不建议新增 audit metadata；如果未来确需更丰富摘要，必须单独做 audit event naming plan 和 schema impact review。
- 风险：直接扩 audit reason / action / metadata 会污染审计语义并带来字段泄露风险。

### Field whitelist enforcement candidate

- 可能需要的字段类别：允许字段集、禁止字段集、低敏备注规则、demo / seed / mock 标记、来源摘要规则、异常态提示。
- 来源：V1 field whitelist contract、opportunity contract、manual confirm contract、dashboard copy、audit matrix。
- 状态：字段白名单不定义状态，但必须覆盖每个状态的展示与写入边界。
- 低敏字段边界：默认使用内部 ID、脱敏展示、摘要、短码和状态，不使用高敏原文。
- 是否可能复用现有对象：现有客户 / 预约 / 治疗摘要写入 parser 提供部分经验，但三类机会和统一确认尚无统一 enforcement。
- 是否可能需要新 schema：白名单本身不要求新增 schema；如果未来 schema 增加字段，应先完成 enforcement plan。
- 风险：先写 schema 再补字段边界，会导致高敏字段进入持久层或审计摘要。

## 4. 复用现有结构方案

### 方案 A：复用 `follow_up_tasks` 承接部分机会状态

可复用点：

- `follow_up_tasks` 已是内部执行对象，适合承接人工确认后“转内部随访任务”的结果。
- 已有 `sourceTreatmentSummaryId`、`sourceSuggestionKey` 和活跃来源去重索引，可复用治疗摘要随访建议来源链路。
- 已有租户、客户、到期时间、建议动作、风险等级和状态字段。

不足：

- 当前状态不包含 `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_appointment_intent`、`wake_observation` 或 `expired`。
- 任务状态表达的是内部任务处理，不是机会待确认、人工忽略或预约意向。
- 当前来源字段偏治疗摘要建议，不覆盖客户生命周期、预约、最后互动、看板指标或人工录入机会。

风险：

- 把所有 opportunity 都落成 follow-up task，会让待确认机会变成已创建任务，越过人工确认边界。
- 为了适配机会状态而扩 `follow_up_status`，会污染随访任务自身状态机。
- 预约意向、复购意向、继续观察、忽略和过期不适合直接作为随访任务状态。

不适合承接的状态：

- `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_appointment_intent`、`converted_to_repurchase_intent`、`wake_observation`、`expired`。

为什么不能直接落 runtime：

- 需要先确定 opportunity 与 follow-up task 的职责边界、状态映射、幂等策略和审计顺序。未完成前，直接 runtime 会把“提示”和“任务”混成一个对象。

### 方案 B：复用 `customers.lifecycle` 作为复购 / 沉睡来源

可复用点：

- `repurchase_window` 可作为复购机会来源信号。
- `silent_reactivation` 可作为沉睡客户机会来源信号。
- `customers` 已有优先级、标签、项目兴趣、脱敏联系方式和下一步动作。

不足：

- lifecycle 是客户整体分层，不是单个机会实例。
- 不包含来源 ID、处理窗口、状态流转、人工确认动作、低敏备注或 dashboard 去重口径。
- 一个客户可能同时存在复诊提醒、复购机会和沉睡风险，单一 lifecycle 无法表达并行机会。

风险：

- 把 lifecycle 当成 opportunity runtime，会让“客户处于某状态”被误读成“系统生成了可处理机会”。
- 生命周期变化可能覆盖历史机会语义，影响审计和看板复盘。

为什么 lifecycle 不等于 opportunity runtime：

- opportunity 需要可追溯来源、单次处理状态、人工确认结果和审计语义；lifecycle 只提供客户级状态信号。

### 方案 C：复用 `treatment_summaries` 作为复诊 / 复购来源

可复用点：

- 治疗摘要包含治疗项目、分类、阶段、恢复阶段、风险等级、下一步建议和治疗时间。
- 适合生成复诊提醒、复购窗口提示和治疗后随访建议。
- 已有关联客户、预约和作废字段，可作为来源有效性判断基础。

不足：

- 一个治疗摘要可能产生多个建议或机会。
- 治疗摘要不包含机会状态、确认动作、dashboard bucket、处理窗口或 demo 标记。
- 作废摘要如何阻断未来机会仍需要产品和状态口径确认。

风险：

- 把 treatment summary 当 opportunity object，会让来源记录承担状态机责任。
- 复诊、复购、沉睡三类机会的来源并不全都来自治疗摘要。

为什么 treatment summary 不等于 opportunity object：

- treatment summary 是治疗后结构化事实和摘要；opportunity 是基于事实形成的内部运营提示，两者生命周期不同。

### 方案 D：复用 `audit_events` 作为未来审计输出

可复用点：

- `audit_events` 已有 tenant、resource、resourceId、action、result、reason、occurredAt 和 source。
- repository 已支持 record、list、按资源和 tenant 查询。
- 当前业务已有部分审计写入模式，可以作为未来 V1 审计输出基础。

不足：

- 当前没有 metadata / payload 字段。
- V1 opportunity、manual confirmation、dashboard metric source 的 resource / action / reason 命名未进入 runtime。
- `AuditReason` 当前混有 HIS / credential / compensation 相关 reason，V1 主线命名需要单独收口。

风险：

- 直接新增 audit metadata 会扩大 schema 风险。
- 直接新增 audit enum 或 reason 会让 V1 主线与 HIS 风险治理线混杂。
- 审计低敏摘要若未先定义，可能写入高敏备注、raw payload 或外部错误全文。

为什么不能直接扩 audit metadata / enum：

- 审计命名、低敏摘要、资源动作和字段白名单必须先完成 audit event naming plan。本文档不授权 audit runtime。

### 方案 E：只在 view model 层做临时聚合

可复用点：

- dashboard view model 已有 metrics、supporting stats、action items、journey lanes 和 empty state。
- 可用于未来 UI-only / mock-only 验证三类机会指标展示结构。
- 对早期 demo / seed / mock 验证来说，不需要立即新增表。

不足：

- view model 层无法提供稳定持久状态、并发控制、去重索引、人工确认历史或审计顺序。
- 只在 view model 中聚合会让指标来源难以追溯。
- 不能解决 `pending_confirmation`、`dismissed`、`expired` 等状态的存储与转换问题。

风险：

- 临时聚合容易被误认为真实 dashboard aggregation。
- 如果直接把 mock 指标接到真实数据，会误导为生产经营统计。

为什么不能替代正式 schema 决策：

- view model 适合展示，不适合定义事实来源、状态持久化、审计和历史复盘。正式 runtime 前仍需 schema impact、API boundary 和 dashboard aggregation plan。

## 5. 新 schema 候选方案

本节只作为 plan，不实现任何表、字段、索引、SQL 或 migration。

### 候选 1：`opportunities` 表

可能字段类别：

- `id`
- `tenant_id`
- `customer_id`
- `opportunity_type`
- `source_type`
- `source_id`
- `source_summary`
- `status`
- `priority`
- `handling_window`
- demo / seed / mock 标记
- `low_sensitive_note`
- `created_at` / `updated_at`

可能价值：

- 为三类机会提供统一对象和状态承载。
- 支撑人工确认、看板指标、审计输入和去重。
- 避免把客户生命周期、治疗摘要或随访任务误当机会 runtime。

风险：

- 状态模型过早固化。
- 与 `follow_up_tasks` 重叠。
- 与 dashboard aggregation 耦合。
- 与 audit runtime 耦合。
- 字段白名单风险，尤其是来源摘要和低敏备注。
- 若未明确 feature flag / rollback，未来 runtime slice 难以关闭。

计划判断：

- 当前不建议直接新增。
- 若未来选择该候选，必须先完成 API boundary plan、field whitelist enforcement plan、audit event naming plan、dashboard aggregation plan、test plan refinement 和 rollback / feature flag plan。

### 候选 2：`manual_confirmations` 表

可能字段类别：

- `id`
- `tenant_id`
- `opportunity_id`
- `confirm_action`
- `result_status`
- operator id 或 mock operator
- `low_sensitive_note`
- `confirmed_at`
- `created_at` / `updated_at`

可能价值：

- 保存统一人工确认历史。
- 支撑幂等、并发处理、确认结果复盘和审计顺序。
- 避免把确认动作散落在各业务对象中。

风险：

- 并发 / 幂等 / 重复确认。
- 操作人隐私。
- 审计写入顺序。
- 与 opportunity status 一致性。
- 真实数据泄露风险。
- 如果没有 opportunity 稳定对象，`opportunity_id` 关系本身未定。

计划判断：

- 当前不建议直接新增。
- 若未来选择该候选，必须先确定 opportunity candidate 是否存在、确认动作集合、状态方向、低敏备注边界和审计命名。

### 候选 3：`dashboard_metric_snapshots` 表

可能字段类别：

- `id`
- `tenant_id`
- `metric_key`
- `metric_value`
- `source_window`
- `generated_at`
- demo / seed / mock 标记

可能价值：

- 保存指标快照，支持历史对比和试运行复盘。
- 可分离 dashboard 读取和实时聚合。

风险：

- 误导真实统计。
- 过早 BI 化。
- SQL / aggregation 复杂化。
- 与真实经营结果混淆。
- 如果 opportunity 状态未定，快照来源不稳定。

计划判断：

- 当前不建议新增 dashboard metric snapshot schema。
- V1 仍应先完成指标来源、状态纳入 / 排除、去重、时间窗口、空态和异常态计划，不写 SQL。

### 候选 4：不新增表，仅按现有表 + view model 过渡

可行条件：

- 仅用于 UI-only / mock-only / docs-only / test-plan-only 阶段。
- 明确数据是 mock / seed / demo 或试运行口径。
- 不写真实状态，不写 SQL，不产生真实 dashboard aggregation。
- 不把 view model 指标当生产经营统计。

风险：

- 无法提供稳定 opportunity ID。
- 无法保存统一人工确认状态和历史。
- 无法覆盖并发、幂等、审计顺序和状态复盘。
- 无法保证 dashboard 指标可追溯。

适用范围：

- UI mock、copy 验证、空态 / 异常态验证、测试计划拆分、API boundary 讨论前的口径演示。

不适用范围：

- 真实 runtime、真实状态写入、真实 dashboard aggregation、真实审计 runtime、真实客户数据、外部系统动作。

必须配套的测试和边界：

- 字段白名单测试计划。
- mock / seed / demo 标记测试计划。
- 状态方向测试计划。
- 看板输入和审计输入测试计划。
- 明确 no true HIS、no credential、no auto reachout、no external message send。

## 6. 状态模型影响

以下状态均为未来可能状态，不是数据库枚举，不是 migration，不是 runtime 状态机。

| 状态 | 当前可由 `follow_up_tasks` 直接表达 | 影响与边界 |
| --- | --- | --- |
| `suggested` | 否 | 表示建议形成但未进入确认，当前随访任务创建即是任务，不适合作为纯建议。 |
| `pending_confirmation` | 否 | `appointments` 有同名状态，但那是预约状态；不能直接复用为 opportunity 状态。 |
| `confirmed` | 否 | 机会确认不等于随访任务已创建，也不等于预约已确认。 |
| `converted_to_followup` | 部分 | 可通过创建 `follow_up_tasks` 表达结果，但不能表达机会自身状态和确认历史。 |
| `converted_to_internal_follow` | 部分 | 语义接近转内部随访，但需先与 `converted_to_followup` 命名收口。 |
| `converted_to_appointment_intent` | 否 | 预约意向不是真实预约，也不是 `appointments` 记录；不能直接写入预约表。 |
| `converted_to_repurchase_intent` | 否 | 复购意向不等于成交、支付或营销动作；当前无对象承载。 |
| `wake_observation` | 否 | 继续观察 / 唤醒观察只应是内部判断，不触发自动唤醒。 |
| `dismissed` | 否 | 随访任务 `cancelled` 不等于机会被人工忽略。 |
| `expired` | 否 | 当前无自动过期或机会失效状态；不得用 scheduler / worker 补足。 |

状态影响结论：

- 可由现有 `follow_up_tasks` 表达的，主要是人工确认后形成内部随访任务的结果，不是完整机会状态。
- 不能直接复用的状态包括待确认、已确认、已忽略、预约意向、复购意向、继续观察和过期。
- 所有状态变化都需要人工确认边界或明确内部业务状态来源。
- 所有状态均不得触发外部自动触达、自动营销、真实 HIS、真实预约、真实成交或医疗诊断。
- 机会进入待确认、人工确认、忽略、转内部随访、转预约意向、继续观察、完成、过期等动作都应进入后续审计命名计划。
- 状态模型未定前不得写 migration，不得扩 enum，不得在 `follow_up_status` 中硬塞 opportunity 状态。

## 7. 字段白名单影响

未来 schema / runtime 必须遵守字段白名单契约。字段白名单 enforcement plan 必须先于 runtime；不得先写 schema 再补字段边界。

允许低敏字段：

- mock customer display name。
- `customer_id`。
- `opportunity_type`。
- `source_summary`。
- `handling_window`。
- `priority`。
- `status`。
- `low_sensitive_note`。
- demo / seed / mock marker。
- 内部来源 ID、来源类型、dashboard bucket、状态前后、操作者角色、审计提示。

禁止字段：

- 完整手机号。
- 身份证号。
- 完整病历号。
- 完整病历正文。
- HIS raw payload。
- 外部消息原文。
- 真实支付 / 成交 / 销售额。
- 真实操作人隐私。
- credential。
- token / secret。
- API Key。
- OAuth secret。
- Webhook secret。
- SQL、服务端堆栈、数据库连接串。

schema 影响：

- 如果未来新增 `opportunities` 或 `manual_confirmations`，字段必须优先设计为低敏摘要、内部 ID、状态和短码，不得为了方便调试保存 raw payload。
- `low_sensitive_note` 必须有长度、内容、脱敏和禁止词边界，不能开放为高敏自由文本。
- demo / seed / mock marker 需要在 schema、view model 或测试计划中有稳定表达，否则容易把演示数据误当真实生产数据。

## 8. 审计影响

机会进入待确认、人工确认、状态变化、看板指标来源都可能需要审计。当前 `audit_events` 可能可复用，因为它已经有 tenant、resource、resourceId、action、result、reason、occurredAt 和 source，并有 repository 与查询基础。

但当前不得：

- 直接新增 audit metadata。
- 直接新增 audit enum。
- 直接实现 audit runtime。
- 直接扩 HIS compensation audit。
- 直接把 V1 opportunity / manual confirmation / dashboard metric source 写进 runtime。

必须先做 audit event naming plan：

- 明确 V1 主线 resource 命名。
- 明确 action 命名。
- 明确 reason 命名。
- 明确低敏摘要边界。
- 明确哪些动作必须审计，哪些动作建议审计。
- 明确如何避免与 HIS / credential / compensation 相关审计语义混杂。

审计 schema 影响结论：

- 当前 `audit_events` 适合先作为输出底座候选。
- 当前不建议新增 metadata / payload。
- 如果未来确需更丰富审计摘要，必须重新进入 schema impact review，单独审批。

## 9. Dashboard aggregation 影响

看板指标需要先明确以下口径：

- 状态纳入与排除。
- 时间窗口，例如今日、本周、当前待处理、试运行窗口、逾期。
- 去重口径，例如客户 + 机会类型 + 来源类型 + 来源 ID + 时间窗口。
- 空态与异常态。
- 来源缺失、`dueDate` 缺失、优先级缺失、状态异常、沉睡阈值未确认时的处理。
- demo / seed / mock 标记如何影响展示和统计。
- 指标下钻是否展示低敏摘要，以及何时需要权限和审计。

当前不能直接写 SQL，不能直接实现 dashboard aggregation，不能直接把 mock 指标变成真实统计。若 schema 未定，dashboard aggregation 不应开始。

schema 影响结论：

- 如果未来选择无新表过渡，看板只能做 view model / mock / seed / demo 口径。
- 如果未来选择 `opportunities` 表，看板可基于 opportunity 状态和来源聚合，但仍需 dashboard aggregation plan。
- 如果未来选择 `dashboard_metric_snapshots` 表，必须防止过早 BI 化和真实经营统计误读。

## 10. 推荐结论

本计划建议：

- 当前不建议直接新增 schema / migration。
- 当前不建议直接复用 `follow_up_tasks` 承接全部机会。
- 当前不建议直接复用 `customers.lifecycle` 作为 opportunity runtime。
- 当前不建议直接复用 `treatment_summaries` 作为 opportunity object。
- 当前不建议直接做 dashboard aggregation。
- 当前不建议直接做 audit runtime。
- 当前不建议直接新增 audit metadata / enum。
- 当前不建议直接进入 API / route / service / repository / DTO 实现。

本文档应作为后续 API boundary plan、field whitelist enforcement plan、audit event naming plan、dashboard aggregation plan 和 test plan refinement 的 schema impact baseline。后续仍应保持 plan-only / docs-only / review-only，不能因为本文档列出候选表或字段，就把它们解释为实现授权。

## 11. 后续建议 PR 顺序

以下顺序只作为计划，不是开发许可，仍为 plan-only / docs-only / review-only：

1. V1-API-BOUNDARY-PLAN-01。
2. V1-FIELD-WHITELIST-ENFORCEMENT-PLAN-01。
3. V1-AUDIT-EVENT-NAMING-PLAN-01。
4. V1-DASHBOARD-AGGREGATION-PLAN-01。
5. V1-TEST-PLAN-REFINEMENT-01。
6. V1-RUNTIME-MINIMAL-SLICE-PLAN-01。

上述 PR 均不得自动进入 runtime。未来任何 schema / migration / SQL / runtime / API / service / repository / DTO / dashboard aggregation / audit runtime 都必须由用户在新的当前任务中明确授权，并重新执行项目治理启动检查。

## 12. 本文档边界

本文档不修改 schema。

本文档不新增 migration。

本文档不写 SQL。

本文档不授权 runtime。

本文档不授权 API / service / repository。

本文档不授权 dashboard aggregation。

本文档不授权 audit runtime。

本文档不授权 audit metadata / enum。

本文档不授权真实 HIS / credential。

本文档不授权真实客户数据。

本文档不授权自动营销 / 自动触达。

本文档不授权外部消息发送。

本文档不授权真实任务 / 预约 / 成交。

本文档不授权医疗诊断。

本文档不修改 `src/**`、`drizzle/**`、`src/server/db/schema.ts`、既有 `docs/product` 事实源、契约、review、test plan、copy 或既有 plan。

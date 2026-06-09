# V1 主链路 dashboard aggregation plan 01

## 0. 文档元信息

- 任务编号：V1-DASHBOARD-AGGREGATION-PLAN-01。
- 日期与时区：2026-06-09 CST +0800，来自本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前阶段：docs-only / plan-only / review-only。
- 当前分支：`docs/v1-dashboard-aggregation-plan-01`。
- 启动基线：创建任务分支前 `HEAD`、`main` 与 `origin/main` 均为 `47e3b0059cb42112d6f43f90ed2441ad5e29b21f`。
- 本文档只新增 dashboard aggregation 计划，不修改产品事实源、契约、审查文档、测试计划、文案契约、既有计划、UI mock 或 runtime。

文档性质：

- docs-only：仅修改文档
- plan-only：仅新增计划
- no SQL：不写 SQL
- no aggregation runtime：不实现聚合运行时
- no API changes：不修改 API
- no schema changes：不修改 schema
- no dashboard runtime：不实现 dashboard 运行时
- no audit runtime：不实现 audit 运行时

本文档不授权 SQL、dashboard aggregation 运行时、dashboard API、schema / migration、指标快照、service、repository、DTO、audit runtime、audit metadata、audit enum、真实 HIS、真实 credential、真实客户数据、自动营销、自动触达、外部消息发送、真实预约、真实成交或医疗诊断。

## 1. 背景与结论摘要

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，V1 主链路是治疗后客户运营闭环。HIS 只是数据来源之一，不是 1.0 主线，不阻塞 1.0。

V1 主链路已通过产品事实源、机会契约、看板指标契约、人工确认契约、审计覆盖矩阵、字段白名单契约、测试计划、空态文案契约，以及 schema impact 计划、API boundary 计划、字段白名单 enforcement 计划、audit event naming 计划等 plan-only 文档逐步收口。当前仍不能进入 runtime。本任务只规划未来 dashboard aggregation 的候选指标、状态纳入 / 排除、时间窗口、去重、空态 / 异常态、低敏下钻和审计关系。

核心结论：

- dashboard aggregation 的未来来源应来自 V1 主链路机会状态与人工确认结果，而不是直接来自 UI mock、HIS runtime、真实经营数据或自动营销系统。
- 本文档中的所有指标都是候选 / 待评估，不代表已实现，不代表真实统计，不代表真实经营结果。
- 当前不新增 `dashboard_metric_snapshots`，不写聚合查询，不写 SQL，不新增 API / service / repository / DTO。
- 当前不固化状态为 schema enum，不新增 opportunity 表，不新增 confirmation queue，不新增 audit enum 或 audit metadata。
- 未来下钻只能返回低敏摘要，不返回高敏客户明细、成交金额、销售额、ROI、完整联系方式、真实 HIS credential 或外部系统信息。

## 2. 当前可复用 dashboard 基础

| 当前基础 | 已有事实 | 可作为未来参考 | 不足与边界 |
| --- | --- | --- | --- |
| `institution-dashboard-view-models.ts` | 当前聚合客户、预约、随访任务，输出 `customer_total`、`high_priority_customers`、`pending_appointments`、`due_followups`，辅助统计包含 `repurchase_window`。 | 可参考指标、辅助统计、行动项、旅程分层的展示结构。 | 不是三类机会指标来源，不承载 `pending_total_opportunities` 等 V1 候选指标。 |
| `InstitutionWorkspace.tsx` | 工作台展示受控 demo 数据、复诊提醒 mock、复购 / 沉睡机会 mock、统一人工确认 mock、dashboard 指标 mock、audit trace mock。 | 可参考低敏展示、demo 标记、空态 / 异常态和人工确认提示。 | UI mock-only；不调用真实 opportunity API，不写状态，不做聚合。 |
| `DashboardMetricsMockSection.tsx` | 已展示 `pending_total_opportunities`、`pending_revisit_reminders`、`pending_repurchase_opportunities`、`pending_dormant_opportunities`、人工确认结果与异常指标的 mock bucket。 | 可作为指标命名与低敏说明的 UI 事实依据。 | mock / seed / demo 数值不代表真实统计，不可直接转为 SQL 或 dashboard runtime。 |
| `ManualConfirmMockSection.tsx` | 展示待人工确认、已确认、转内部随访、转内部跟进、预约意向、复购意向、唤醒观察、忽略、过期等试运行状态。 | 可作为人工确认结果指标的候选状态说明。 | 不写入状态，不创建真实任务、预约、成交或审计 runtime。 |
| `AuditTraceMockSection.tsx` | 展示三类机会、人工确认动作、看板指标来源的低敏 audit mock。 | 可作为未来 audit 候选与低敏字段边界参考。 | 不是真实审计记录，不新增 audit runtime。 |
| 空态 / 异常态 copy 契约 | 已定义无机会、来源缺失、dueDate 缺失、priority 缺失、沉睡阈值未确认、状态异常等文案。 | 可作为未来 dashboard aggregation 空态 / 异常态提示依据。 | 不实现 UI，不实现数据校验，不写聚合。 |

## 3. V1 dashboard aggregation 总原则

1. 指标服务治疗后客户运营闭环，围绕复诊提醒、复购机会、沉睡客户机会、人工确认结果和内部处理方向建立。
2. 指标来源应优先来自未来 opportunity 候选对象与 manual confirmation 结果候选的低敏状态，不直接从 UI mock、HIS runtime、真实经营数据或自动营销系统抽取。
3. 指标只代表内部运营提示和人工处理状态，不代表客户已被触达、真实预约已创建、真实成交、真实支付、销售额、ROI 或医疗效果。
4. 指标不得绕过人工确认触发任何外部动作。
5. 指标必须有状态纳入 / 排除、时间窗口、去重、空态和异常态说明。
6. 指标必须保留 mock / seed / demo 或试运行窗口标记，避免演示口径被误读为生产统计。
7. 指标下钻只能使用低敏摘要和确认对象摘要，不直接返回完整客户列表或高敏字段。
8. dashboard aggregation 必须晚于 schema impact 计划、API boundary 计划、字段白名单 enforcement 计划、audit event naming 计划和测试计划细化。
9. 本文档只规划，不写 SQL，不实现聚合，不新增指标快照。

## 4. 指标候选清单

以下指标均为候选 / 待评估，不代表已实现，不代表真实统计，不代表真实经营结果，不授权 SQL，不授权 aggregation runtime，不授权 dashboard API，不授权 schema / migration / 指标快照。

| metricKey | 中文候选名称 | 未来来源候选 | 状态纳入候选 | 排除候选 | 时间窗口候选 | 去重候选 | 边界说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pending_total_opportunities` | 待处理机会总数 | 三类机会进入人工处理范围后的 opportunity 候选对象。 | `pending_confirmation`；可评估已展示为待确认入口的 `suggested`。 | `dismissed`、`completed`、`expired`。 | 当前窗口。 | 同一客户 + 机会类型 + 来源类型 + 来源 ID。 | 不代表自动营销、触达、成交或医疗效果。 |
| `pending_revisit_reminders` | 待处理复诊提醒数 | 治疗摘要、预约 / 到院、路径模板、随访结果形成的复诊提醒候选。 | 复诊提醒的 `pending_confirmation`。 | `dismissed`、转换状态、`completed`、`expired`。 | 当前窗口；日窗口 / 周窗口可后续评估。 | 同一客户 + 同一治疗摘要 / 预约 / 路径节点 + 时间窗口。 | 不代表真实预约或 HIS 同步。 |
| `pending_repurchase_opportunities` | 待确认复购机会数 | 项目周期、客户生命周期、治疗摘要、历史服务摘要或随访反馈形成的复购机会候选。 | 复购机会的 `pending_confirmation`。 | `dismissed`、转换状态、`completed`、`expired`。 | 当前窗口或试运行窗口。 | 同一客户 + 同一项目周期 / 生命周期状态 + 时间窗口。 | 不代表成交预测、成交金额或自动营销结果。 |
| `pending_dormant_opportunities` | 待处理沉睡客户机会数 | 最后预约、最后到院、最后治疗、最后随访或生命周期状态形成的沉睡机会候选。 | 沉睡客户机会的 `pending_confirmation`。 | `dismissed`、转换状态、`completed`、`expired`。 | 试运行窗口；可配置窗口可后续评估。 | 同一客户 + 沉睡阈值层级 + 时间窗口。 | 不代表客户已被唤醒或已外呼。 |
| `confirmed_opportunities` | 已确认机会数 | 人工确认结果候选。 | `confirmed`，以及人工确认后的转换状态可评估纳入。 | `suggested`、`pending_confirmation`、`dismissed`、`expired`。 | 试运行窗口或历史累计候选。 | 同一机会最终有效确认结果只计一次。 | 不代表处理完成、真实预约、真实成交或客户已触达。 |
| `converted_to_followup_tasks` | 已转内部随访任务数 | 人工确认后形成内部随访任务的结果候选。 | `converted_to_followup`。 | 其他状态。 | 试运行窗口或历史累计候选。 | 同一机会 + 内部随访任务来源只计一次。 | 内部随访任务不等于外部消息发送。 |
| `converted_to_internal_follow` | 已转内部跟进数 | 人工确认后进入内部运营跟进的结果候选。 | `converted_to_internal_follow` 或与 `converted_to_followup` 的命名收口结果。 | 未确认、已忽略、已过期、真实外部动作状态。 | 试运行窗口。 | 同一机会 + 内部跟进方向只计一次。 | 需要先与 `converted_to_followup_tasks` 语义区分；不自动营销。 |
| `converted_to_appointment_intents` | 已形成预约意向数 | 人工确认后形成内部预约方向的结果候选。 | `converted_to_appointment_intent`。 | 其他状态。 | 试运行窗口或历史累计候选。 | 同一机会 + 预约意向来源只计一次。 | 预约意向不是真实预约，不占号，不同步 HIS。 |
| `converted_to_repurchase_intents` | 已形成复购意向数 | 人工确认后形成内部复购方向的结果候选。 | `converted_to_repurchase_intent` 或未来 repurchase intent 候选。 | 其他状态。 | 试运行窗口。 | 同一复购机会 + 复购意向来源只计一次。 | 不代表真实成交、成交金额、支付或合同。 |
| `wake_observation` | 已进入唤醒观察数 | 沉睡客户机会经人工确认后进入内部观察的结果候选。 | `wake_observation` 或 `confirmed` + selectedAction=继续观察候选。 | 外部触达、自动唤醒、已忽略、已过期。 | 试运行窗口；可配置窗口可评估。 | 同一客户 + 沉睡阈值层级 + 观察窗口。 | 唤醒观察是内部判断，不自动外呼、不发送消息。 |
| `dismissed_opportunities` | 已忽略机会数 | 人工忽略结果候选。 | `dismissed`。 | 其他状态。 | 试运行窗口或历史累计候选。 | 同一机会最终有效忽略状态只计一次。 | 不代表客户拒绝或医疗结论；应可追踪低敏原因。 |
| `expired_opportunities` | 已过期机会数 | 处理窗口已过、来源失效或不再适用的结果候选。 | `expired`。 | 未过期、已完成、已忽略等状态。 | 试运行窗口；逾期 / 过期窗口可评估。 | 同一机会最终有效过期状态只计一次。 | 当前不实现自动过期，不启动 scheduler / worker。 |
| `exception_metrics` | 异常指标数 | 来源缺失、聚合未 ready、状态异常、窗口缺失、低敏下钻不可用等异常态候选。 | `metric_source_missing`、`aggregation_not_ready`、状态异常等异常候选。 | 正常完成统计的指标。 | 当前窗口或试运行窗口。 | 同一 metricKey + 异常类别 + 来源候选去重。 | 只作内部参考，不暴露 SQL、stack、raw payload 或外部错误全文。 |

补充说明：

- `pending / confirmed / dismissed / expired / exception` 等状态口径仍是计划候选。
- `converted_to_internal_follow`、`converted_to_repurchase_intents`、`wake_observation` 需要先与机会契约、人工确认契约、audit event naming 计划做命名收口。
- 本文档不新增状态，不新增 enum，不新增测试，不新增 runtime。

## 5. 状态纳入 / 排除计划

以下状态纳入 / 排除仅是未来聚合候选，不是 SQL 条件，不是 schema enum，不是 runtime 状态机。

| 状态 / 状态族 | 可纳入的指标候选 | 应排除的指标候选 | 计划边界 |
| --- | --- | --- | --- |
| `suggested` | 可作为 `pending_total_opportunities` 的辅助来源，但只有已展示为待确认入口时才考虑。 | 不单独计入已确认、转换、忽略或过期结果。 | 不自动触达，不自动确认，不生成医疗建议。 |
| `pending_confirmation` | `pending_total_opportunities`、`pending_revisit_reminders`、`pending_repurchase_opportunities`、`pending_dormant_opportunities`。 | `confirmed_opportunities`、转换结果、`dismissed_opportunities`、`expired_opportunities`。 | 待人工确认是 V1 重点入口，不能在看板层直接执行外部动作。 |
| `confirmed` | `confirmed_opportunities`；可作为 `wake_observation` 或内部跟进前置候选。 | 待处理分类型指标通常应排除。 | 已确认不代表已完成、已触达、已成交或已预约。 |
| `converted_to_followup` | `converted_to_followup_tasks`，也可作为 `confirmed_opportunities` 后续状态候选。 | 待处理指标、已忽略、已过期。 | 只表示内部随访任务结果，不代表外部消息发送。 |
| `converted_to_internal_follow` | `converted_to_internal_follow`。 | 外部触达、自动营销、真实成交相关指标。 | 需先完成命名和动作边界收口。 |
| `converted_to_appointment_intent` | `converted_to_appointment_intents`，可作为已确认后续状态候选。 | 真实预约、HIS 同步、占号。 | 预约意向不是真实预约。 |
| `converted_to_repurchase_intent` | `converted_to_repurchase_intents`。 | 成交金额、支付、合同、营销发送。 | 复购意向不是真实成交。 |
| `wake_observation` | `wake_observation`。 | 自动唤醒、外呼、外部消息发送。 | 只表示内部观察。 |
| `dismissed` | `dismissed_opportunities`。 | 待处理、已确认、转换结果。 | 忽略必须可追踪，不能无痕丢弃。 |
| `completed` | 可作为未来可选结果，不在本任务必选指标清单中固化。 | 待处理、异常、过期。 | 完成不代表成交、真实服务完成或医疗效果。 |
| `expired` | `expired_opportunities`；可作为异常 / 过期复盘口径候选。 | 待处理、已确认、转换结果。 | 当前不实现自动过期，不写 scheduler / worker。 |
| 异常 / 不可用 | `exception_metrics`。 | 正常业务结果指标。 | 只提示来源、口径或聚合不可用，不暴露高敏错误。 |

## 6. 时间窗口计划

未来 dashboard 可考虑以下时间窗口，但当前不实现时间窗口查询，不新增 `dashboard_metric_snapshots`，不写聚合查询。

| 时间窗口候选 | 适用指标候选 | 计划语义 | 当前边界 |
| --- | --- | --- | --- |
| 当前窗口 | 待处理机会总数、分类型待处理指标、异常指标。 | 表示当前仍处于待人工处理或异常提示范围。 | 不代表实时生产 BI，不写实时 SQL。 |
| 试运行窗口 | 复购、沉睡、已确认、转换、忽略、过期、唤醒观察等试运行复盘指标。 | 用于 V1 内部验收和试运行复盘。 | 不锁定最终统计周期，不代表生产规则。 |
| 日窗口 | 未来可用于今日复诊提醒或今日待处理入口。 | 按机构运营当天观察处理窗口。 | 当前不实现日期计算，不定义时区算法。 |
| 周窗口 | 未来可用于本周复诊提醒、沉睡观察或复购窗口。 | 帮助运营负责人观察本周压力。 | 周起始日、时区、节假日规则需后续确认。 |
| 可配置窗口 | 未来可用于沉睡阈值、复购窗口、历史复盘。 | 支持不同机构试运行口径。 | 当前不做配置表、查询参数或 schema。 |
| 逾期 / 过期窗口 | 未来可用于已过期机会或逾期未处理机会。 | 解释处理窗口已过或来源失效。 | 当前不实现自动过期、scheduler、worker 或 cron。 |

## 7. 去重口径计划

未来去重只作为候选口径，不实现去重逻辑，不新增 repository，不新增 service，不新增唯一索引，不写 SQL。

| 对象 | 去重候选 | 来源缺失时的计划处理 |
| --- | --- | --- |
| 通用机会 | 同一客户 + 同一机会类型 + 同一来源类型 + 同一来源 ID + 同一时间窗口。 | 标记为 `metric_source_missing` 或来源不完整，不猜测来源。 |
| 复诊提醒 | 同一客户 + 同一治疗后摘要 / 预约 / 路径节点 + 同一复诊处理窗口。 | 不计入依赖稳定来源的正式指标，进入异常态候选。 |
| 复购机会 | 同一客户 + 同一项目周期 / 生命周期状态 + 同一复购窗口。 | 提示项目周期或生命周期来源不完整。 |
| 沉睡客户机会 | 同一客户 + 同一沉睡阈值层级 + 同一观察窗口。 | 提示沉睡阈值或最后互动来源不完整。 |
| 人工确认结果 | 同一确认对象 + 同一 `selectedAction` 结果，按最终有效状态计数。 | 已被其他人处理或状态过期时进入异常态候选。 |
| 内部随访转换 | 同一机会 + 同一内部随访任务来源。 | 不重复计入 `converted_to_followup_tasks`。 |
| 预约 / 复购意向 | 同一机会 + 同一意向来源。 | 不创建真实预约或成交对象。 |
| 异常指标 | 同一 metricKey + 同一异常类别 + 同一来源候选。 | 只统计异常类别，不暴露原始来源。 |

## 8. 空态 / 异常态计划

空态和异常态应与既有空态文案契约、audit event naming 计划保持一致。当前不实现 UI、不实现数据校验、不写 runtime。

| 场景 | 推荐解释 | 指标影响候选 | 审计关系候选 | 禁止内容 |
| --- | --- | --- | --- | --- |
| 无候选机会 | “暂无待处理机会”。 | 对待处理指标显示 0 或空态。 | 通常不需要新增审计。 | 不写成历史任务全部完成。 |
| 指标来源缺失 | “部分机会来源不完整，仅作内部参考”。 | 依赖稳定来源的指标标记异常或排除。 | 可对应 `dashboard_metric_source_unavailable` / `metric_source_missing`。 | raw payload、外部错误全文、HIS raw ID。 |
| 部分来源不可用 | “部分来源暂不可用，当前仅展示低敏内部参考”。 | 进入 `exception_metrics` 候选。 | 可对应 `metric_source_missing`。 | SQL、stack、请求体、响应体。 |
| 聚合未 ready | “看板聚合口径尚未 ready”。 | 进入 `exception_metrics` 候选，不展示真实统计。 | 可对应 `dashboard_aggregation_unavailable` / `aggregation_not_ready`。 | SQL、聚合函数、DB URL。 |
| dashboard aggregation 不可用 | “dashboard aggregation 当前不可用”。 | 指标显示异常态或空态，不回退到高敏明细。 | 可对应 `dashboard_aggregation_unavailable`。 | 服务端堆栈、外部错误全文。 |
| dueDate 缺失 | “缺少处理日期，未计入时间窗口指标”。 | 不计入日窗口 / 周窗口 / 逾期指标。 | 可建议低敏异常审计。 | 客户完整行程、外部日程 payload。 |
| priority 缺失 | “缺少优先级，未计入高优先级指标”。 | 不计入优先级类指标；本任务不要求高优先级指标。 | 可建议低敏异常审计。 | 黑箱 AI 分数、高敏客户画像。 |
| 沉睡阈值未确认 | “沉睡阈值为试运行口径，待产品确认”。 | 可计入试运行窗口，但必须带试运行说明。 | 可建议口径变化审计。 | 自动唤醒结果、外呼内容。 |
| 状态异常 | “状态异常，暂不计入正式指标”。 | 进入 `exception_metrics` 候选。 | 可建议 `source_invalid` 或低敏异常候选。 | 新 enum 实现说明、SQL、stack。 |
| 低敏下钻不可用 | “当前指标暂无可展示的低敏明细”。 | 指标可显示聚合，但下钻入口禁用或空态。 | 可对应 `dashboard_drilldown_viewed` 或 `drilldown_low_sensitive` 的不可用结果候选。 | 高敏客户列表、完整联系方式、完整 BI 导出。 |

## 9. 下钻低敏边界

未来下钻只能返回低敏摘要或确认对象摘要。当前不在本任务中定义真实 DTO，不实现 API，不实现下钻 runtime。

允许的低敏下钻候选：

- `metricKey`、中文指标名、`dashboardBucket`。
- `opportunityType`、`sourceType`、内部 `sourceId`。
- 内部客户 ID 或低敏客户展示名。
- `sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、dueDate 时间窗口。
- `statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`。
- `mockSeedDemoFlag`、空态 / 异常态文案。

禁止返回：

- 真实客户高敏信息。
- 完整手机号、完整联系方式、身份证号、完整病历号、地址。
- 完整病历正文、诊断正文、治疗原文、咨询记录全文、外部消息原文。
- 成交金额、销售额、ROI、支付、合同、发票、回款数据。
- 真实 HIS credential、API Key、Token、OAuth secret、Webhook secret、数据库连接串。
- 真实 HIS raw payload、外部系统请求 / 响应正文、外部错误全文。
- 真实预约号、HIS 同步 payload、真实外部系统信息。
- SQL、stack、DB URL、完整 BI 导出。

## 10. 与 schema impact 的关系

schema impact plan 已明确当前不建议直接新增 schema / migration，不建议直接复用 `follow_up_tasks` 承接全部机会，不建议直接复用 `customers.lifecycle` 作为 opportunity runtime，不建议直接新增 `dashboard_metric_snapshots`。

本文档继承这些判断：

- 不新增 `opportunities` 表。
- 不新增 `manual_confirmations` 表。
- 不新增 `dashboard_metric_snapshots` 表。
- 不扩 `follow_up_status`、appointment status 或 audit enum 来硬塞机会状态。
- 不把 `customers.lifecycle` 的 `repurchase_window` / `silent_reactivation` 直接当成已生成机会。
- 不把 treatment summary 当 opportunity object。
- 不写 SQL，不新增 index，不新增 migration。

如果未来确需指标快照、状态持久化或历史趋势，必须重新进入 schema impact 审查并单独审批。

## 11. 与 API boundary 的关系

API boundary 计划已明确当前不建议直接新增 API / route / service / repository / DTO，不建议让 dashboard API 直接聚合三类机会，不建议把 mock 指标变成真实经营统计。

本文档继承这些边界：

- 不新增 dashboard metrics API。
- 不新增 dashboard 低敏下钻 API。
- 不新增 opportunity 查询 / 变更 API。
- 不新增 manual confirmation API。
- 不新增 service / repository / DTO。
- 不让 route handler 决定聚合口径。
- 不让 repository 承担状态机或产品指标决策。
- 不把 dashboard aggregation、audit 写入、机会状态写入混在一个 runtime PR。

未来 API 候选必须在单独任务中定义查询 DTO、变更 DTO、tenant / RBAC、错误响应、低敏下钻、字段白名单和审计输入。

## 12. 与 field whitelist enforcement 的关系

字段白名单 enforcement 计划已明确 dashboard DTO 只能输出指标、数量、桶、空态 / 异常态文案和低敏下钻；不得输出原始客户隐私、SQL、HIS payload 或成交 / 支付数据。

本文档继承以下字段边界：

- 指标层只允许 `metricKey`、中文指标名、`count`、`dashboardBucket`、空态 / 异常态文案、`mockSeedDemoFlag`、`sourceType`、`opportunityType`。
- 下钻层只允许低敏客户摘要、机会摘要、确认对象摘要和内部来源引用。
- `sourceSummary` 必须由白名单字段生成，不得从 raw payload、病历正文、外部响应或 AI 原始响应截取。
- `lowSensitiveNote` 不能包含完整联系方式、完整病历、HIS raw payload、外部消息原文、SQL、stack、credential、token、成交金额或 AI prompt / completion 全文。
- 字段白名单只约束未来 DTO / dashboard / audit 的低敏边界，不触发任何业务动作。

本文档不实现解析器、展示映射、DTO、保护器、脱敏、遮蔽或清洗器。

## 13. 与 audit event naming 的关系

audit event naming 计划已规划以下 dashboard / aggregation 相关候选：

- `dashboard_metric_viewed`
- `dashboard_drilldown_viewed`
- `dashboard_metric_source_unavailable`
- `dashboard_aggregation_unavailable`
- `metric_window_current`
- `metric_window_trial`
- `metric_source_missing`
- `aggregation_not_ready`
- `drilldown_low_sensitive`

未来 audit 候选关系：

| dashboard 场景 | 资源候选 | 动作候选 | 原因候选 | 结果候选 | 边界 |
| --- | --- | --- | --- | --- | --- |
| 查看指标卡 | `dashboard_metric` | `dashboard_metric_viewed` | `metric_window_current` / `metric_window_trial` | `success` | 不代表真实 BI 或生产聚合。 |
| 查看低敏下钻 | `dashboard_drilldown` | `dashboard_drilldown_viewed` | `drilldown_low_sensitive` | `success` | 不返回高敏明细。 |
| 指标来源缺失 | `dashboard_metric` | `dashboard_metric_source_unavailable` | `metric_source_missing` | `unavailable` | 不写原始来源。 |
| 聚合未 ready | `dashboard_metric` | `dashboard_aggregation_unavailable` | `aggregation_not_ready` | `unavailable` / `not_ready` | 不写 SQL、stack 或 DB URL。 |
| 下钻低敏摘要不可用 | `dashboard_drilldown` | `dashboard_drilldown_viewed` 或后续不可用动作候选 | `drilldown_low_sensitive` | `unavailable` | 不导出客户完整列表。 |

当前不新增 audit enum，不新增 audit metadata，不实现 audit runtime，不修改 `audit-events.ts`，不修改 audit repository，不为了审计提前写 SQL。

## 14. 不推荐的反模式

| 反模式 | 风险 |
| --- | --- |
| 直接用 UI mock 数值作为生产指标。 | 会把 mock / seed / demo 误读为真实统计和真实经营结果。 |
| 直接写 dashboard SQL 聚合三类机会。 | 状态、来源、去重、schema 和字段白名单都未 ready。 |
| 直接新增 `dashboard_metric_snapshots`。 | 容易过早 BI 化，并误导为生产报表。 |
| 把 `customers.lifecycle` 直接算成 opportunity 数量。 | 生命周期是客户状态，不是单次可处理机会。 |
| 把 `follow_up_tasks` 全部当机会对象。 | 会把待确认机会误实现成已创建任务，越过人工确认边界。 |
| 看板下钻返回完整客户明细。 | 会绕过低敏字段白名单并泄露高敏信息。 |
| 把预约意向写成真实预约指标。 | 会误导为已占号或 HIS 已同步。 |
| 把复购意向写成成交或 ROI。 | 会误导为真实交易、支付或经营结果。 |
| 把唤醒观察写成自动唤醒 / 外呼。 | 会违反不自动触达边界。 |
| 在同一个 PR 中做 schema、API、aggregation、audit runtime。 | 难以审查、难以回滚，放大隐私、权限和状态风险。 |
| 异常态展示 SQL、stack、raw payload 或外部错误全文。 | 会泄露系统和外部数据细节。 |

## 15. 推荐结论

当前推荐：

- 继续保持 docs-only / plan-only / review-only。
- 把本文档作为未来 dashboard aggregation 的口径输入，而不是实现许可。
- 未来 runtime 前必须先完成测试计划细化、runtime minimal slice 计划、feature flag / rollback 计划，并由用户另行明确授权。
- 未来 dashboard aggregation 的最小候选应从低敏 opportunity 状态和人工确认结果开始，而不是从真实 HIS、真实经营数据、自动营销系统或 UI mock 数值开始。
- 未来下钻应优先设计为低敏确认对象摘要，不应返回完整客户明细。
- 未来 audit 应只记录 metricKey、dashboardBucket、窗口、来源类型和低敏摘要，不写 metadata、SQL、stack 或 raw payload。

当前不建议：

- 不建议直接实现 aggregation runtime。
- 不建议直接新增 dashboard API。
- 不建议直接新增 schema / migration。
- 不建议直接写 SQL。
- 不建议新增 dashboard 指标快照。
- 不建议直接实现 audit runtime。
- 不建议把 mock 指标视为真实统计。

## 16. 后续建议 PR 顺序

以下仅是建议顺序，不构成开发许可：

1. V1-TEST-PLAN-REFINEMENT-01：docs-only / test-plan-only，细化 dashboard aggregation、低敏下钻、audit 输入和异常指标的未来测试断言。
2. V1-RUNTIME-MINIMAL-SLICE-PLAN-01：plan-only，描述未来最小 runtime 候选、feature flag、rollback、tenant / RBAC、不新增 metadata、不写 SQL 的过早扩张防线。
3. V1-DASHBOARD-AGGREGATION-TEST-PLAN-01：docs-only / test-only plan，拆分候选指标、状态纳入 / 排除、时间窗口、去重和空态 / 异常态的测试矩阵。
4. V1-DASHBOARD-COPY-UI-APPLY-LATER-01：仅在后续明确批准后，UI-only 应用稳定空态 / 异常态文案。
5. V1-RUNTIME-IMPLEMENT-LATER-01：仅在用户后续明确批准后，以小范围、可回滚、测试先行方式处理。

任何 schema、migration、SQL、API、route、service、repository、DTO、dashboard aggregation、audit runtime、audit enum、audit metadata、runner、scheduler、queue、worker、HIS、credential、真实外部系统、自动触达、真实预约、真实成交、支付 / 合同 / 发票、生产配置都必须单独确认。

## 17. 本文档边界

本文档只新增 V1 主链路 dashboard aggregation 计划，边界如下：

- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不修改 `src/server/db/schema.ts`。
- 不修改 `src/app/api/**`。
- 不修改 `src/server/**`。
- 不修改任何 service / repository / DTO。
- 不修改任何既有 docs/product 事实源、契约、review、test-plan、copy、已有 plan。
- 不修改 package 或 lockfile。
- 不新增测试文件。
- 不运行测试 / lint / typecheck。
- 不启动 dev server。
- 不执行 migration。
- 不写 SQL。
- 不新增 dashboard aggregation。
- 不新增 API / route。
- 不新增 service / repository / DTO。
- 不新增 schema / migration。
- 不新增解析器、清洗器、mask 或 redact。
- 不新增字段白名单 enforcement 代码。
- 不新增 audit metadata / audit enum。
- 不实现 audit runtime。
- 不连接真实 HIS。
- 不读取真实 credential。
- 不连接外部系统。
- 不处理真实客户数据。
- 不自动营销 / 自动触达。
- 不发送外部消息。
- 不创建真实任务 / 预约 / 成交。
- 不修复本任务之外的问题。

本文档中的候选项、候选指标、后续建议和 PR 顺序都不是开发许可。未来进入 runtime、schema、API、SQL、dashboard aggregation、audit 或字段白名单 enforcement 前，必须由用户在新的当前任务中明确批准，并重新执行项目治理启动检查。

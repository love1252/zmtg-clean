# V1-DASHBOARD-METRICS-CONTRACT-01：基础运营看板指标字典

## 1. 背景与目标

本契约任务编号为 V1-DASHBOARD-METRICS-CONTRACT-01，任务性质为 contract-only / docs-only。任务日期来自本地命令 `date "+%Y-%m-%d %Z %z"`，结果为 2026-06-08 CST +0800。

本契约基于以下 7 个事实源和已完成文档：

- `docs/product/zhimeitiangong-product-source-of-truth.md`
- `docs/product/zhimeitiangong-module-map.md`
- `docs/product/zhimeitiangong-v1-scope.md`
- `docs/product/zhimeitiangong-feature-addendum.md`
- `docs/product/zhimeitiangong-decision-log.md`
- `docs/product/reviews/prod-gap-review-01.md`
- `docs/product/contracts/v1-opportunity-contract-01.md`

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，1.0 主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是系统主线，不阻塞 1.0。

本契约只定义复诊提醒、复购机会、沉睡客户机会进入基础运营看板的指标字典。指标是内部运营看板输入，不是自动营销结果，不是成交结果，不是医疗效果判断，也不是外部自动触达记录。

本契约不实现 dashboard runtime、SQL、聚合函数、API、UI 或完整 BI。后续任何 runtime、schema / migration、真实 HIS、真实 credential、scheduler / worker / queue 或外部触达能力，都必须单独获得授权。

## 2. 非目标 / 明确不做

本 PR 只新增本契约文档，不修复问题，不实现功能。

本 PR 明确不做：

- 不做 runtime。
- 不做 UI。
- 不做 schema。
- 不做 migration。
- 不写 SQL。
- 不做 dashboard 聚合函数。
- 不新增 dashboard API。
- 不做数据导出。
- 不做完整 BI。
- 不接真实 HIS。
- 不读取真实 credential。
- 不发起真实外部网络调用。
- 不做外部自动触达。
- 不做自动营销。
- 不做 AI Agent 自动执行。
- 不做自动医疗决策。
- 不做真实消息发送。
- 不处理真实客户数据。
- 不新增 opportunity 表。
- 不新增 dashboard 表。
- 不新增 confirmation queue 表。
- 不新增测试。
- 不修改产品事实源原文件。
- 不修改 PROD-GAP-REVIEW-01 原报告。
- 不修改 V1-OPPORTUNITY-CONTRACT-01 原契约。

本契约不继续推进 CONFIG-PLAN-01、SCHEDULER-PLAN-01、AUDIT-PLAN-01、OBS-PLAN-01、SCHEMA-REVIEW-01，也不继续推进 Phase 23 / Phase 24 HIS 风险治理线。

## 3. 指标设计原则

1. 指标服务治疗后客户运营闭环，围绕复诊提醒、复购机会、沉睡客户机会、人工确认和内部处理建立口径。
2. 指标优先支持人工确认和内部处理，帮助运营人员判断待处理优先级。
3. 指标不代表外部自动触达结果，不得被解释为客户已收到消息。
4. 指标不代表成交结果，不得被解释为成交金额、支付结果或销售预测。
5. 指标不代表医疗效果，不得被解释为诊疗质量或恢复结果判断。
6. 指标不依赖真实 HIS 接入；1.0 可基于模拟数据、人工录入、轻量导入或既有内部数据完成闭环验证。
7. 指标不要求新增 schema，不要求新增 migration，不要求新增唯一索引。
8. 指标先以 V1 轻量口径定义，后续可由 UI-only / mock-only / test-only PR 验证。
9. 指标必须能解释来源、状态、时间窗口和去重口径，避免让运营人员误读。
10. 指标必须避免高敏个人信息外泄，指标层只展示聚合口径、低敏说明和必要的内部处理状态。

## 4. 指标术语定义

以下术语是产品契约，不是数据库 schema、不是代码类型定义、不是 SQL 设计。

| 术语 | 辅助英文名 | 定义 | 边界 |
| --- | --- | --- | --- |
| 指标 | metric | 看板上用于观察内部运营状态的统计口径。 | 只代表内部看板输入，不代表真实外部动作结果。 |
| 指标键 | metricKey | 指标的稳定辅助命名，用英文小写下划线表达。 | 不是数据库字段，不是代码枚举。 |
| 看板输入 | dashboard input | 提供给基础运营看板展示、排序或解释的产品口径。 | 不是 dashboard runtime、SQL 或聚合函数。 |
| 机会 | opportunity | 复诊提醒、复购机会、沉睡客户机会的统称。 | 只作为内部运营提示，不自动执行。 |
| 复诊提醒 | revisit reminder | 治疗后复诊 / 复查 / 状态确认相关的内部提醒。 | 不自动约诊，不发起对客联系动作。 |
| 复购机会 | repurchase opportunity | 基于项目周期、生命周期、治疗摘要或随访结果形成的轻量复购提示。 | 不代表成交，不代表自动营销。 |
| 沉睡客户机会 | dormant customer opportunity | 长时间无预约、到院、随访或互动后的内部激活判断提示。 | 不代表已唤醒客户，阈值需产品确认。 |
| 待确认 | pending confirmation | 机会已进入人工处理范围，等待内部人员判断。 | V1 重点待处理状态。 |
| 已确认 | confirmed | 内部人员确认机会需要继续处理。 | 不代表已经完成处理。 |
| 已忽略 | dismissed | 内部人员判断机会不处理或暂不处理。 | 需要保留审计口径，避免无痕丢弃。 |
| 已转内部随访任务 | converted to follow-up | 机会经人工确认后转为内部随访任务。 | 不等于外部消息发送。 |
| 预约意向 | appointment intent | 机会经人工确认后形成可能预约的内部意向。 | 不是真实预约，不是 HIS 同步。 |
| 逾期 | overdue | 机会超过建议处理日期或窗口仍未处理。 | 本 PR 不实现日期计算。 |
| 空态 | empty state | 某指标没有可统计数据时的解释口径。 | 不等于系统异常。 |
| 异常态 | exception state | 指标来源、状态、dueDate、阈值或优先级等信息不足或不一致时的解释口径。 | 本 PR 不实现数据校验或修复。 |

## 5. 指标分组

### 5.1 V1 必需指标

| metricKey | 中文名称 | 目的 |
| --- | --- | --- |
| `pending_total_opportunities` | 待处理机会总数 | 给运营人员一个总体待处理压力入口。 |
| `pending_revisit_reminders` | 待处理复诊提醒数 | 观察复诊 / 复查 / 状态确认提醒是否需要处理。 |
| `today_revisit_reminders` | 今日需处理复诊提醒数 | 突出当日复诊处理窗口。 |
| `pending_repurchase_opportunities` | 待确认复购机会数 | 观察复购机会是否进入人工判断。 |
| `high_priority_repurchase_opportunities` | 高优先级复购机会数 | 帮助内部人员优先处理高优先级复购机会。 |
| `pending_dormant_opportunities` | 待处理沉睡客户机会数 | 观察沉睡客户机会是否进入人工判断。 |
| `overdue_unhandled_opportunities` | 逾期未处理机会数 | 暴露超过处理窗口但未完成的机会。 |
| `confirmed_opportunities` | 已确认机会数 | 观察人工确认后的有效机会规模。 |
| `dismissed_opportunities` | 已忽略机会数 | 观察人工忽略结果，避免机会无痕丢弃。 |
| `converted_to_followup_tasks` | 已转内部随访任务数 | 观察机会是否进入内部执行。 |

### 5.2 V1 可选指标

| metricKey | 中文名称 | 目的 |
| --- | --- | --- |
| `week_revisit_reminders` | 本周需处理复诊提醒数 | 作为今日复诊提醒的周视角补充。 |
| `converted_to_appointment_intents` | 转预约意向数 | 观察机会是否形成内部预约意向。 |
| `completed_opportunities` | 已完成机会数 | 观察内部处理完成情况。 |
| `opportunity_source_distribution` | 机会来源分布 | 观察机会来自治疗摘要、预约、随访、生命周期或人工录入的比例。 |
| `opportunity_type_distribution` | 机会类型分布 | 观察复诊、复购、沉睡机会在总机会中的结构。 |
| `manual_confirmation_rate` | 人工确认转化率 | 观察待确认机会中被人工确认的比例。 |
| `opportunity_completion_rate` | 机会处理完成率 | 观察已进入处理的机会中完成的比例。 |

### 5.3 暂不纳入 V1 的指标

| 指标 | 暂不纳入原因 |
| --- | --- |
| 成交金额 | 依赖真实交易或销售系统，不属于当前客户运营闭环看板输入。 |
| 真实支付金额 | 依赖支付、财务或收费系统，不属于 1.0 轻量看板。 |
| 自动营销触达次数 | 依赖真实触达系统和自动营销能力，1.0 不做。 |
| 外部消息发送成功率 | 依赖微信、企微、短信或电话等真实外部渠道，当前后置。 |
| 医疗效果改善率 | 涉及医疗效果判断，不属于运营看板输入。 |
| HIS 同步成功率 | 依赖真实 HIS 接入，不阻塞 1.0。 |
| AI 自动执行成功率 | 依赖 AI Agent 自动执行，1.0 不做。 |
| 完整 BI 多维分析指标 | 依赖完整 BI、复杂报表和可能的指标中台，当前不纳入。 |

上述指标依赖真实外部系统、支付、触达、医疗效果判断或完整 BI，不属于当前 V1 指标契约。

## 6. 指标字典

以下指标字典是产品口径，不是 dashboard runtime、SQL、聚合函数或数据库字段。

| metricKey | 中文名称 | 指标目的 | 适用机会类型 | 纳入状态 | 排除状态 | 时间窗口 | 去重口径 | 空态口径 | V1 必需 | 边界说明 |
| --------- | ---- | ---- | ------ | ---- | ---- | ---- | ---- | ---- | ----- | ---- |
| `pending_total_opportunities` | 待处理机会总数 | 观察当前需要人工处理的机会总量。 | 通用 | `pending_confirmation`，可包含未分配但已展示为待确认的 `suggested`。 | `dismissed`、`completed`、`expired`。 | 当前。 | 按 `customerId + opportunityType + sourceType + sourceId` 去重；无 `sourceId` 时按产品标记来源不完整。 | 显示“暂无待处理机会”，表示当前没有进入人工处理的机会。 | 是 | 不代表客户已被触达、成交或医疗效果。 |
| `pending_revisit_reminders` | 待处理复诊提醒数 | 观察复诊 / 复查 / 状态确认提醒的待处理规模。 | 复诊提醒 | `pending_confirmation`。 | `dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 当前。 | 按客户 + 治疗摘要 / 预约 / 路径节点 + 时间窗口去重。 | 显示“暂无待处理复诊提醒”。 | 是 | 只代表内部提醒，不代表已约诊或已完成对客沟通。 |
| `today_revisit_reminders` | 今日需处理复诊提醒数 | 突出今日复诊处理窗口。 | 复诊提醒 | `pending_confirmation`，且 `dueDate` 属于今日。 | `dismissed`、`completed`、`expired`。 | 今日。 | 同一客户同一来源同一今日窗口只计一次。 | 显示“今日暂无复诊提醒”。 | 是 | 不代表真实预约或 HIS 同步。 |
| `pending_repurchase_opportunities` | 待确认复购机会数 | 观察复购机会是否进入人工判断。 | 复购机会 | `pending_confirmation`。 | `dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 当前或试运行窗口。 | 按客户 + 项目周期 / 生命周期状态 + 时间窗口去重。 | 显示“暂无待确认复购机会”。 | 是 | 不代表成交预测或自动营销结果。 |
| `high_priority_repurchase_opportunities` | 高优先级复购机会数 | 帮助内部人员优先处理高优先级复购机会。 | 复购机会 | `pending_confirmation` 或 `confirmed`，且 `priority=高`。 | `dismissed`、`completed`、`expired`。 | 当前或试运行窗口。 | 同一客户同一项目周期和时间窗口只计一次。 | 显示“暂无高优先级复购机会”。 | 是 | 高优先级必须可解释，不能由黑箱 AI 直接决定。 |
| `pending_dormant_opportunities` | 待处理沉睡客户机会数 | 观察沉睡客户机会是否进入人工判断。 | 沉睡客户机会 | `pending_confirmation`。 | `dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 当前或试运行窗口。 | 按客户 + 沉睡阈值层级 + 时间窗口去重。 | 显示“暂无待处理沉睡客户机会”。 | 是 | 不代表客户已被唤醒或已触达。 |
| `overdue_unhandled_opportunities` | 逾期未处理机会数 | 暴露超过建议处理日期但仍未处理的机会。 | 通用 | `suggested`、`pending_confirmation`、`confirmed`，且已超过 `dueDate` 或处理窗口。 | `dismissed`、`completed`、`expired`。 | 逾期。 | 同一机会只计一次；来源不完整时标记为异常态。 | 显示“暂无逾期未处理机会”。 | 是 | 只提示内部处理风险，不代表医疗风险判断。 |
| `confirmed_opportunities` | 已确认机会数 | 观察人工确认后需要继续处理的机会规模。 | 通用 | `confirmed`、`converted_to_followup`、`converted_to_appointment_intent`。 | `suggested`、`pending_confirmation`、`dismissed`、`expired`。 | 历史累计或试运行窗口。 | 按机会唯一产品口径去重。 | 显示“暂无已确认机会”。 | 是 | 不代表处理已完成、成交或真实预约。 |
| `dismissed_opportunities` | 已忽略机会数 | 观察人工忽略结果，避免机会无痕丢弃。 | 通用 | `dismissed`。 | 其他状态。 | 历史累计或试运行窗口。 | 同一机会多次忽略只按最终有效忽略状态计一次。 | 显示“暂无已忽略机会”。 | 是 | 不代表客户拒绝或医疗结论。 |
| `converted_to_followup_tasks` | 已转内部随访任务数 | 观察机会是否进入内部执行。 | 通用 | `converted_to_followup`。 | `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_appointment_intent`、`completed`、`expired`。 | 历史累计或试运行窗口。 | 按机会 + 内部随访任务来源去重。 | 显示“暂无机会转为内部随访任务”。 | 是 | 内部随访任务不等于外部消息发送。 |
| `week_revisit_reminders` | 本周需处理复诊提醒数 | 观察本周复诊处理压力。 | 复诊提醒 | `pending_confirmation`，且 `dueDate` 属于本周。 | `dismissed`、`completed`、`expired`。 | 本周。 | 同一客户同一来源同一周窗口只计一次。 | 显示“本周暂无复诊提醒”。 | 否 | 不代表真实预约、不代表 HIS 同步。 |
| `converted_to_appointment_intents` | 转预约意向数 | 观察机会是否形成内部预约意向。 | 通用 | `converted_to_appointment_intent`。 | 其他状态。 | 历史累计或试运行窗口。 | 按机会 + 预约意向来源去重。 | 显示“暂无机会转为预约意向”。 | 否 | 预约意向不是真实预约，也不是 HIS 同步。 |
| `completed_opportunities` | 已完成机会数 | 观察内部机会处理完成情况。 | 通用 | `completed`。 | 其他状态。 | 历史累计或试运行窗口。 | 同一机会最终完成状态只计一次。 | 显示“暂无已完成机会”。 | 否 | 不代表成交、复购成功或医疗效果。 |
| `opportunity_source_distribution` | 机会来源分布 | 观察机会来自治疗摘要、预约、随访任务、生命周期或人工录入的结构。 | 通用 | `suggested`、`pending_confirmation`、`confirmed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`。 | `dismissed`、`expired` 可按产品复盘视角单独纳入，不默认混入。 | 试运行窗口。 | 按机会去重后再按 `sourceType` 分组。 | 显示“暂无可展示的机会来源分布”。 | 否 | 不代表来源系统质量或 HIS 同步质量。 |
| `opportunity_type_distribution` | 机会类型分布 | 观察三类机会结构。 | 通用 | `suggested`、`pending_confirmation`、`confirmed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`。 | `dismissed`、`expired` 可按复盘视角单独纳入。 | 试运行窗口。 | 按机会去重后再按 `opportunityType` 分组。 | 显示“暂无可展示的机会类型分布”。 | 否 | 不代表经营结果优劣。 |
| `manual_confirmation_rate` | 人工确认转化率 | 观察待确认机会被人工确认的比例。 | 通用 | 分子：`confirmed`、`converted_to_followup`、`converted_to_appointment_intent`；分母：进入过 `pending_confirmation` 的机会。 | 未进入待确认的 `suggested`、`expired`。 | 试运行窗口。 | 同一机会只在分母中计一次，最终确认状态计入分子。 | 显示“暂无足够数据计算人工确认转化率”。 | 否 | 不代表成交转化率，不代表外部触达效果。 |
| `opportunity_completion_rate` | 机会处理完成率 | 观察已进入处理的机会中完成的比例。 | 通用 | 分子：`completed`；分母：`confirmed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`。 | `suggested`、`pending_confirmation`、`dismissed`、`expired`。 | 试运行窗口。 | 同一机会只按最终状态计一次。 | 显示“暂无足够数据计算机会处理完成率”。 | 否 | 不代表复购成功、医疗改善或真实服务完成。 |

## 7. 状态统计口径

以下状态来自 V1-OPPORTUNITY-CONTRACT-01。本契约不新增状态，不把状态定义为数据库枚举，不写代码，不实现状态流转。

| 状态 | 是否计入待处理 | 是否计入已确认 | 是否计入已忽略 | 是否计入转内部随访 | 是否计入逾期 | 是否需要审计覆盖 | 是否允许作为 V1 必需指标来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `suggested` | 可选；仅当已展示为待确认入口时计入待处理总数。 | 否 | 否 | 否 | 可选；仅有 `dueDate` 或处理窗口且逾期时。 | 是，建议审计机会出现。 | 可作为待处理总数的辅助来源，不单独作为必需指标核心来源。 |
| `pending_confirmation` | 是。 | 否 | 否 | 否 | 是；当超过 `dueDate` 或处理窗口。 | 是，建议审计进入待确认。 | 是。 |
| `confirmed` | 通常不计入待确认，但可计入“待继续处理”。 | 是。 | 否 | 否 | 是；当确认后仍超过处理窗口。 | 是，必须审计人工确认。 | 是。 |
| `dismissed` | 否。 | 否 | 是。 | 否 | 否。 | 是，必须审计人工忽略。 | 是，用于已忽略机会数。 |
| `converted_to_followup` | 否。 | 是，可作为已确认后续状态。 | 否 | 是。 | 可选；内部任务逾期时由后续任务口径定义。 | 是，必须审计转换动作。 | 是，用于已转内部随访任务数。 |
| `converted_to_appointment_intent` | 否。 | 是，可作为已确认后续状态。 | 否 | 否。 | 可选；预约意向逾期口径后续定义。 | 是，必须审计转换动作。 | 可选，不作为 V1 必需指标核心来源。 |
| `completed` | 否。 | 可作为确认后已完成结果。 | 否 | 否。 | 否。 | 是，必须审计完成动作。 | 可选，不作为 V1 必需指标核心来源。 |
| `expired` | 否。 | 否。 | 否，除非人工选择忽略后失效。 | 否。 | 可作为逾期后失效复盘口径，不默认计入逾期未处理。 | 是，必须审计失效动作或原因。 | 可选，不作为 V1 必需指标核心来源。 |

状态统计边界：

- 待处理指标优先使用 `pending_confirmation`。
- 已确认指标可包含 `confirmed` 以及人工确认后的转换状态。
- 已忽略指标只使用 `dismissed`。
- 转内部随访任务数只使用 `converted_to_followup`。
- 逾期指标需要结合 `dueDate` 或处理窗口，不由状态本身单独决定。
- 状态进入指标不代表系统可自动执行动作。

## 8. 时间窗口口径

本节只定义产品口径，不实现时区处理，不写日期计算代码。后续实现时如需时区，应按机构本地时间确认，本 PR 不实现。

| 时间窗口 | 产品定义 | 适用指标 | 边界 |
| --- | --- | --- | --- |
| 今日 | 机构运营当天需要关注的处理窗口。 | 今日需处理复诊提醒数。 | 不写日期计算代码；不使用真实客户数据举例。 |
| 本周 | 机构本周需要关注的处理窗口。 | 本周需处理复诊提醒数。 | 可作为可选指标，后续实现时确认周起始日和时区。 |
| 逾期 | 超过建议处理日期或产品处理窗口仍未处理。 | 逾期未处理机会数。 | 本契约不实现自动过期或 scheduler。 |
| 当前待处理 | 当前仍处于待确认或待继续处理的机会。 | 待处理机会总数、待处理复诊提醒数、待确认复购机会数、待处理沉睡客户机会数。 | 不代表实时系统计算，只定义看板输入语义。 |
| 历史累计 | 在试运行或统计周期内已经发生过的确认、忽略、转换或完成结果。 | 已确认机会数、已忽略机会数、已转内部随访任务数、转预约意向数、已完成机会数。 | 不代表永久历史报表或完整 BI。 |
| 试运行窗口 | V1 试运行期间用于复盘的产品统计窗口。 | 分布类指标、转化率、完成率、沉睡客户机会口径。 | 具体起止时间需产品确认，不在本 PR 锁死。 |

## 9. 去重口径

本节只定义产品层去重建议，不实现去重算法，不新增唯一索引，不新增 migration。

| 机会类型 | 建议去重口径 | sourceId 缺失时的产品处理 |
| --- | --- | --- |
| 复诊提醒 | 按客户 + 治疗摘要 / 预约 / 路径节点 + 时间窗口去重。例如同一客户同一治疗摘要的同一 D7 复诊提醒，在同一处理窗口只计一次。 | 标记为“来源不完整”，可进入异常态说明；不猜测来源对象。 |
| 复购机会 | 按客户 + 项目周期 / 生命周期状态 + 时间窗口去重。例如同一客户同一项目周期的复购窗口，在同一试运行窗口只计一次。 | 标记为“来源不完整”，提示需要补充项目周期或生命周期来源。 |
| 沉睡客户机会 | 按客户 + 沉睡阈值层级 + 时间窗口去重。例如同一客户同一 60 天层级在同一试运行窗口只计一次。 | 标记为“来源不完整”，并提示沉睡阈值或最后互动来源不完整。 |
| 通用机会 | 优先按 `customerId + opportunityType + sourceType + sourceId` 去重。 | 若缺少 `sourceId`，只在产品层标记异常，不新增唯一约束。 |

去重边界：

- 本 PR 不实现去重算法。
- 本 PR 不新增唯一索引。
- 本 PR 不新增 schema / migration。
- 本 PR 不新增 opportunity 表或 dashboard 表。
- 去重口径只服务看板解释和后续 UI / mock / test 设计。

## 10. 空态与异常态口径

本节只定义产品解释和 UI 文案方向，不实现 UI、不实现数据校验、不写 runtime。

| 场景 | 产品解释 | UI 文案方向 | 边界 |
| --- | --- | --- | --- |
| 无待处理机会 | 当前没有进入人工处理范围的机会。 | “暂无待处理机会”。 | 不代表客户运营已经完成所有历史任务。 |
| 无复诊提醒 | 当前没有需要处理的复诊提醒。 | “暂无待处理复诊提醒”。 | 不代表没有客户需要未来复诊。 |
| 无复购机会 | 当前没有进入人工判断的复购机会。 | “暂无待确认复购机会”。 | 不代表没有商业价值客户。 |
| 无沉睡客户机会 | 当前没有进入沉睡机会口径的客户。 | “暂无待处理沉睡客户机会”。 | 不代表客户全部活跃。 |
| 机会来源缺失 | 机会无法稳定追溯到治疗摘要、预约、随访、生命周期或人工录入来源。 | “部分机会来源不完整，统计仅作内部参考”。 | 不自动补来源，不猜测来源。 |
| `dueDate` 缺失 | 机会没有建议处理日期，不能进入今日 / 本周 / 逾期类指标。 | “部分机会缺少处理日期，未计入时间窗口指标”。 | 不写日期推断逻辑。 |
| 沉睡阈值未确认 | 沉睡客户机会仍使用试运行口径。 | “沉睡阈值为试运行口径，待产品确认”。 | 不锁死具体天数。 |
| `priority` 缺失 | 机会无法判断是否高优先级。 | “部分机会缺少优先级，未计入高优先级指标”。 | 不由 AI 自动补优先级。 |
| 机会状态异常 | 机会状态不在 V1-OPPORTUNITY-CONTRACT-01 状态集合中。 | “部分机会状态异常，未计入正式指标”。 | 不新增状态，不做 runtime 修复。 |
| 数据来自 mock / seed / demo | 数据只用于演示、试运行或验证，不等于真实生产数据。 | “当前包含演示 / mock 数据，仅用于内部验证”。 | 不得当成真实客户、真实成交或真实触达结果。 |

## 11. 与人工确认的关系

看板指标服务人工确认，不替代人工确认。

- 待处理指标用于提示人工确认优先级。
- 已确认指标用于观察人工确认结果。
- 已忽略指标用于避免无痕丢弃。
- 已转内部随访任务数用于观察机会是否进入内部执行。
- 转预约意向数不等于真实预约。
- 未确认机会不得进入外部自动触达。
- 指标不得绕过人工确认触发任何自动动作。
- AI / 规则只能辅助生成建议、草稿、标签、提醒或运营洞察，不能替代内部人员确认。

## 12. 与内部随访任务 / 预约意向的关系

- 机会经人工确认后，才可转内部随访任务。
- 机会经人工确认后，才可形成预约意向。
- 内部随访任务不等于外部消息发送。
- 预约意向不等于真实预约，不等于 HIS 同步。
- 本契约不创建随访任务 runtime。
- 本契约不创建预约 runtime。
- 本契约不新增 follow-up API、appointment API 或 dashboard API。
- 本契约不定义真实消息发送、真实预约创建或真实 HIS 同步能力。

## 13. 与审计追踪的关系

本节只定义审计输入，不实现审计。以下动作建议后续进入 V1-AUDIT-COVERAGE-MATRIX-01：

| 动作 | 与指标关系 | 审计建议 |
| --- | --- | --- |
| 机会进入待确认 | 影响待处理机会总数和分类型待处理指标。 | 建议审计机会进入待确认的来源和低敏原因摘要。 |
| 人工确认 | 影响已确认机会数和人工确认转化率。 | 必须审计确认人、时间和低敏原因摘要。 |
| 人工忽略 | 影响已忽略机会数。 | 必须审计忽略动作和低敏原因摘要。 |
| 转内部随访任务 | 影响已转内部随访任务数。 | 必须审计转换动作，不记录外部消息内容。 |
| 转预约意向 | 影响转预约意向数。 | 必须审计转换动作，并说明不等于真实预约。 |
| 标记完成 | 影响已完成机会数和机会处理完成率。 | 必须审计完成动作或内部状态来源。 |
| 标记过期 | 影响逾期 / 失效复盘口径。 | 必须审计过期原因或来源失效原因。 |
| 修改优先级 | 影响高优先级复购机会数。 | 建议审计优先级变更，不记录高敏详情。 |
| 修改备注 | 影响内部解释和复盘。 | 建议审计备注变更，但备注必须低敏。 |
| 指标口径变更 | 影响看板解释和验收。 | 建议后续在文档或审计矩阵中记录口径版本。 |

审计边界：

- 不新增 audit schema。
- 不新增 audit metadata。
- 不新增 migration。
- 不新增 audit action / reason / result 枚举。
- 不继续 HIS audit / compensation 线。
- 不记录真实 credential、真实 HIS raw payload、完整病历正文或真实外部系统错误全文。

## 14. 与现有 V1 链路的关系

| V1 链路 | 看板指标关系 | 本契约边界 |
| --- | --- | --- |
| 客户档案 / 患者信息 | 指标必须能追溯到客户档案；患者信息只在医疗语境补充。 | 不展示高敏个人信息，不处理真实客户数据。 |
| 预约 / 到院 | 预约状态可作为复诊提醒、复购机会和沉睡机会的来源。 | 预约意向不等于真实预约，不等于 HIS 同步。 |
| 项目 / 治疗记录 | 项目周期和治疗记录摘要影响复诊、复购机会来源。 | 不新增项目表，不做完整病历。 |
| 治疗后摘要 | 治疗后摘要提供复诊提醒和后续随访来源。 | 不自动生成医疗建议，不创建 opportunity runtime。 |
| 随访任务 | 人工确认后的机会可转内部随访任务，成为看板转换指标。 | 内部随访任务不等于外部消息发送。 |
| 复诊提醒 | 进入待处理复诊提醒数、今日 / 本周复诊提醒数、逾期指标。 | 只做内部提醒指标，不自动约诊。 |
| 复购机会 | 进入待确认复购机会数、高优先级复购机会数和类型分布。 | 不代表成交或自动营销。 |
| 沉睡客户机会 | 进入待处理沉睡客户机会数和类型分布。 | 不代表客户已被唤醒。 |
| 人工确认 | 决定机会是否计入已确认、已忽略、转内部随访或转预约意向。 | 人工确认是 V1 硬边界，不实现确认队列 runtime。 |
| 基础运营看板 | 本契约定义指标字典、状态、时间窗口、去重、空态和异常态。 | 不做 dashboard runtime、SQL、聚合函数、API、UI 或完整 BI。 |
| 审计追踪 | 指标相关动作应进入后续审计覆盖矩阵。 | 不新增 audit schema / metadata / migration。 |

## 15. 示例看板场景

### 示例一：复诊提醒看板输入

今日有 3 条待处理复诊提醒，其中 1 条已经超过建议处理窗口。看板可以展示“今日需处理复诊提醒 3 条”和“逾期未处理机会 1 条”，用于提示内部人员优先处理。该指标只是内部处理提示，不代表已经完成对客沟通，不代表真实预约已创建，也不代表 HIS 已同步。

### 示例二：复购机会看板输入

当前有 5 条待确认复购机会，其中 2 条被人工标记为高优先级。看板可以展示“待确认复购机会 5 条”和“高优先级复购机会 2 条”，用于帮助运营人员安排人工判断。该指标不是成交预测，不代表自动营销，也不代表真实支付或成交金额。

### 示例三：沉睡客户机会看板输入

当前有 8 条待处理沉睡客户机会，其中沉睡阈值仍为试运行口径。看板可以展示“待处理沉睡客户机会 8 条”，并提示“沉睡阈值为试运行口径，待产品确认”。该指标不是自动唤醒，不代表客户已收到外部消息，也不代表客户已经回流。

## 16. 后续 PR 拆分建议

| PR 编号建议 | 类型 | 目标 | 允许修改范围 | 禁止范围 | 是否阻塞 V1 | 依赖关系 |
| --- | --- | --- | --- | --- | --- | --- |
| V1-MANUAL-CONFIRM-CONTRACT-01 | contract-only | 定义统一人工确认对象、入口、动作和状态解释。 | `docs/product/**` | runtime、queue、worker、schema / migration、外部自动触达。 | 是 | 依赖 V1-OPPORTUNITY-CONTRACT-01 与本契约。 |
| V1-AUDIT-COVERAGE-MATRIX-01 | docs-only | 输出 V1 主线动作到审计要求的覆盖矩阵。 | `docs/product/**` | audit runtime、audit metadata schema、HIS compensation audit、migration。 | 是 | 可基于本契约并行推进。 |
| V1-REVISIT-UI-MOCK-01 | UI-only / mock-only | 用现有 mock 或 seed 展示复诊提醒看板入口、空态和人工确认提示。 | 后续明确批准后限 UI / mock / 组件测试范围。 | schema、migration、真实 HIS、真实预约同步、外部自动触达。 | 是 | 依赖本契约和人工确认契约。 |
| V1-REPURCHASE-DORMANT-UI-MOCK-01 | UI-only / mock-only | 展示复购与沉睡机会列表、指标卡和空态。 | 后续明确批准后限 UI / mock / 组件测试范围。 | 新 opportunity 表、dashboard SQL、scheduler、营销自动化、外部消息系统。 | 是 | 依赖本契约和人工确认契约。 |
| V1-DASHBOARD-EMPTY-STATE-COPY-01 | docs-only / UI-only | 收口看板空态、异常态和试运行提示文案。 | `docs/product/**`；后续批准后可限 UI 文案。 | runtime、数据校验服务、schema / migration、完整 BI。 | 否 | 依赖本契约。 |
| V1-OPPORTUNITY-TEST-PLAN-01 | test-only / docs-only | 定义未来测试应覆盖的指标、状态、时间窗口、去重和边界。 | `docs/product/**` 或后续批准的测试计划文件。 | 修改生产 runtime、真实外部系统、schema / migration。 | 否 | 依赖本契约和人工确认契约。 |

后续 PR 原则：

- 不直接进入真实 HIS runtime。
- 不直接进入真实 credential runtime。
- 不直接扩 schema / migration。
- 不直接做外部自动触达。
- 不直接实现完整 BI。
- 不直接写 dashboard SQL。
- 需要 runtime 前必须单独审批，并重新确认边界。

## 17. 验收标准

本契约完成后，应满足以下验收标准：

- 已定义指标设计原则。
- 已定义指标术语。
- 已区分 V1 必需、V1 可选、暂不纳入 V1 的指标。
- 已输出指标字典表。
- 已定义状态统计口径。
- 已定义时间窗口口径。
- 已定义去重口径。
- 已定义空态与异常态口径。
- 已定义与人工确认、内部随访任务、预约意向和审计追踪的关系。
- 已明确不做 runtime。
- 已明确不做 schema / migration。
- 已明确不做 dashboard SQL / 聚合服务。
- 已明确不做外部自动触达。
- 已明确指标不代表自动营销、真实触达、成交或医疗效果。
- 已明确本契约可作为后续 UI-only / mock-only / test-only PR 的依据。
- 未修改 `src/**`、`drizzle/**`、`package.json`、lockfile、测试文件、产品事实源原文件、PROD-GAP-REVIEW-01 或 V1-OPPORTUNITY-CONTRACT-01。

## 18. 验证记录

本次只读检查和文档新增过程中执行过以下命令：

- `date "+%Y-%m-%d %Z %z"`
- `git status --short`
- `git branch --show-current`
- `git log --oneline -n 8`
- `git rev-parse HEAD`
- `git rev-parse main`
- `git rev-parse origin/main`
- `git switch -c docs/v1-dashboard-metrics-contract-01`
- `wc -l docs/product/zhimeitiangong-product-source-of-truth.md`
- `wc -l docs/product/zhimeitiangong-module-map.md`
- `wc -l docs/product/zhimeitiangong-v1-scope.md`
- `wc -l docs/product/zhimeitiangong-feature-addendum.md`
- `wc -l docs/product/zhimeitiangong-decision-log.md`
- `wc -l docs/product/reviews/prod-gap-review-01.md`
- `wc -l docs/product/contracts/v1-opportunity-contract-01.md`
- `sed -n '1,220p' docs/product/zhimeitiangong-product-source-of-truth.md`
- `sed -n '1,120p' docs/product/zhimeitiangong-module-map.md`
- `sed -n '1,220p' docs/product/zhimeitiangong-v1-scope.md`
- `sed -n '1,100p' docs/product/zhimeitiangong-feature-addendum.md`
- `sed -n '1,120p' docs/product/zhimeitiangong-decision-log.md`
- `sed -n '1,320p' docs/product/reviews/prod-gap-review-01.md`
- `sed -n '1,520p' docs/product/contracts/v1-opportunity-contract-01.md`
- `find docs/product -maxdepth 2 -type d`
- `rg --files docs/product`
- `rg -n "看板|工作台|dashboard|metric|指标|复诊|复购|沉睡|机会|人工确认|预约意向|随访任务|审计" docs src drizzle README.md package.json`
- `rg -n "HIS|credential|adapter|scheduler|worker|queue|migration|schema|自动触达|自动营销|AI Agent|完整 BI|SQL|dashboard aggregation" docs/product src drizzle README.md package.json`
- `ls package.json pnpm-lock.yaml 2>/dev/null`
- `rg --files src | rg "dashboard|Dashboard|followup-path|FollowUpPath|workspace|Workspace|customer-records|customers|institution-dashboard"`
- `rg -n "repurchase_window|silent_reactivation|followup|follow-up|dashboard|metric|指标|复购|沉睡|复诊|逾期|overdue" src/modules/workspace src/modules/institution | head -n 200`
- `find docs/product/contracts -maxdepth 1 -type f`
- `git diff --stat`
- `git diff -- docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `git diff --name-only origin/main..HEAD`
- `git diff --no-index --stat /dev/null docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `git diff --no-index /dev/null docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `rg -n "^# |^## |^### " docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `rg -n "智美天工不是 HIS 系统|AI 客户运营中台|HIS 只是数据来源之一|基础运营看板指标字典|不是自动营销结果|不是医疗效果判断|dashboard runtime|不写 SQL|不做 schema|不做 migration|人工确认是 V1 硬边界|内部随访任务不等于外部消息发送|预约意向不等于真实预约|不是数据库 schema|不新增测试|不修改产品事实源" docs/product/contracts/v1-dashboard-metrics-contract-01.md`

本次未运行 runtime，未启动服务，未连接外部业务系统，未连接真实 HIS，未读取真实 credential，未执行 migration，未运行 scheduler / cron / queue / worker，未新增 schema，未新增测试，未修复任何发现的问题。

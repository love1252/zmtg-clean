# V1 dashboard aggregation 测试计划 01

## 1. 背景与结论摘要

- 任务编号：V1-DASHBOARD-AGGREGATION-TEST-PLAN-01。
- 日期与时区：2026-06-09 CST +0800，日期来自本地命令 `date "+%Y-%m-%d"`，时区来自本地命令 `date "+%Z %z"`。
- 当前分支：`docs/v1-dashboard-aggregation-test-plan-01`。
- 启动基线：创建任务分支前 `HEAD`、`main` 与 `origin/main` 均为 `a4ece92305f24a6dffccf5e895a0a9e2ba8c8d86`。
- 当前阶段：docs-only / test-plan-only / review-only。
- 本任务不是 runtime 实现，不是 SQL，不是 API，不是 schema，不是 service，不是 repository，不是 DTO，不是测试实现，不是 dashboard aggregation runtime，不是 audit runtime。

文档性质：

- docs-only：仅修改文档。
- test-plan-only：仅规划测试矩阵。
- no test implementation：不写测试代码。
- no runtime：不实现 runtime。
- no SQL：不写 SQL。
- no API changes：不修改 API。
- no schema changes：不修改 schema。
- no service / repository / DTO：不新增 service / repository / DTO。
- no dashboard aggregation runtime：不实现 dashboard aggregation 运行时。
- no audit runtime：不实现 audit 运行时。
- no external integration：不接外部系统。
- no real customer data：不处理真实客户数据。

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，V1 主链路是治疗后客户运营闭环。HIS 只是数据来源之一，不是 1.0 主线，不阻塞 1.0。

本计划只把 dashboard aggregation 的候选指标、状态纳入 / 排除、时间窗口、去重、来源缺失、聚合未 ready、低敏下钻、字段白名单和 audit input 拆成未来测试矩阵。当前仍不能进入 runtime；当前不写测试代码、不实现 runtime、不写 SQL。

核心结论：

- 本文档中的所有 candidate metrics 只是未来测试断言候选，不代表指标已实现。
- 本文档不代表真实经营统计，不代表真实 BI，不代表真实成交、销售额或 ROI。
- 本文档不授权 SQL、dashboard aggregation runtime、dashboard API、metric snapshot、schema / migration、service、repository、DTO 或 audit runtime。
- 未来测试断言必须先保护人工确认、feature flag、tenant / RBAC、低敏字段、空态 / 异常态和 rollback 边界。
- UI mock、seed、demo 数据只能作为事实盘点依据，不能作为真实测试样本、真实统计或 runtime 来源。

## 2. 测试计划适用范围

本计划适用于未来 test-only / UI-only / mock-only / runtime-later 评审中的测试断言拆分，不代表当前已有实现。

| 适用对象 | 未来测试目的 | 依据 |
| --- | --- | --- |
| candidate metrics | 验证指标名称、状态来源、窗口、去重、空态和异常态候选。 | dashboard metrics contract、dashboard aggregation plan、runtime minimal slice plan。 |
| 状态纳入 / 排除 | 验证 `suggested`、`pending_confirmation`、`confirmed`、转换、忽略、过期和异常状态如何影响候选指标。 | opportunity contract、manual confirm contract、test plan refinement。 |
| 时间窗口 | 验证 current、trial、daily、weekly、configurable、expired / overdue 等窗口候选。 | dashboard metrics contract、dashboard aggregation plan。 |
| 去重 | 验证同一客户、同一机会、同一来源、同一窗口下的 future dedup candidate。 | opportunity contract、dashboard aggregation plan、schema impact plan。 |
| 空态 / 异常态 | 验证无候选、来源缺失、聚合未 ready、权限不足、feature flag disabled 等低敏提示。 | dashboard empty state copy、runtime minimal slice plan。 |
| low-sensitive drilldown | 验证下钻只返回低敏摘要，不返回完整客户明细或高敏字段。 | field whitelist contract、field whitelist enforcement plan、API boundary plan。 |
| audit input / event naming | 验证 future resource / action / reason / result 和低敏 audit input。 | audit coverage matrix、audit event naming plan。 |
| tenant / RBAC / feature flag / rollback | 验证默认关闭、按 tenant 开启、权限失败、下钻禁用和回退空态。 | runtime minimal slice plan、API boundary plan。 |

## 3. 不在本测试计划范围内的内容

本测试计划不覆盖，也不授权以下内容：

- 不写测试代码。
- 不新增测试文件。
- 不新增 fixture、mock data 或 test helper。
- 不实现 opportunity runtime。
- 不实现 manual confirm runtime。
- 不实现 dashboard aggregation runtime。
- 不实现 field whitelist enforcement 代码。
- 不实现 audit runtime。
- 不新增 schema、migration、SQL、repository、service、DTO 或 API。
- 不新增 `dashboard_metric_snapshots`。
- 不实现 scheduler、worker、queue、cron 或自动过期。
- 不连接真实 HIS，不读取真实 credential，不连接外部系统。
- 不处理真实客户数据，不发送外部消息，不创建真实任务 / 预约 / 成交。
- 不把 UI mock 数值、seed 数据或 demo 数据当作真实测试样本。
- 不把本测试计划当作后续开发许可。

## 4. dashboard aggregation 测试分层总览

| 测试层级 | 未来测试目的 | 可断言内容 | 当前不做 |
| --- | --- | --- | --- |
| 产品事实层 | 确认 dashboard aggregation 仍服务治疗后客户运营闭环。 | 智美天工不是 HIS；HIS 只是来源；1.0 主线是客户运营中台。 | 不改产品事实源。 |
| 指标字典层 | 确认 candidate metrics 名称、桶和误读边界。 | `metricKey`、中文名、内部运营语义、禁止成交 / ROI / BI 误读。 | 不写 dashboard API。 |
| 状态口径层 | 确认状态纳入、排除和异常状态。 | 待确认、已确认、转换、忽略、过期、stale、already handled、invalid transition。 | 不固化 schema enum。 |
| 时间窗口层 | 确认 current / trial / daily / weekly / configurable / overdue 候选。 | 窗口缺失、timezone boundary、source missing。 | 不写日期计算代码。 |
| 去重层 | 确认未来 dedup candidate。 | 客户 + 机会类型 + 来源 + 窗口；确认对象 + selectedAction；异常类别去重。 | 不新增唯一索引。 |
| 空态 / 异常态层 | 确认异常提示低敏且不降级为高敏明细。 | 来源缺失、聚合未 ready、权限拒绝、feature flag disabled。 | 不实现异常处理代码。 |
| 下钻与字段层 | 确认只输出低敏字段。 | `metricKey`、`dashboardBucket`、`sourceSummary` 等允许字段；禁止高敏字段。 | 不定义真实 DTO。 |
| 审计输入层 | 确认 audit input 只用稳定短码和低敏摘要。 | dashboard metric viewed、source missing、aggregation not ready、drilldown low-sensitive。 | 不新增 audit enum / metadata。 |
| 未授权边界层 | 确认测试计划不膨胀为 runtime。 | no runtime、no SQL、no API、no schema、no test implementation。 | 不运行测试。 |

## 5. candidate metrics 测试矩阵

以下 candidate metrics 必须逐项规划未来测试断言。它们只是未来测试断言候选，不代表指标已实现，不代表真实经营统计，不授权 SQL，不授权 dashboard aggregation runtime，不授权 dashboard API，不授权 metric snapshot，不授权真实 BI，不授权成交金额、销售额或 ROI 统计。

| candidate metric | 正常候选场景 | 状态纳入候选 | 状态排除候选 | 时间窗口候选 | 去重候选 | 来源缺失时的期望 | 聚合未 ready 时的期望 | 低敏输出字段 | 禁止输出字段 | audit input 候选 | feature flag disabled 时的期望 | tenant / RBAC 不满足时的期望 | rollback 后的期望 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pending_total_opportunities` | 三类机会进入人工处理范围。 | `pending_confirmation`；已展示为待确认入口的 `suggested` 可候选。 | `dismissed`、`completed`、`expired`、异常不可用。 | current window。 | 同一客户 + 同一机会类型 + 同一来源类型 + 同一来源 ID + 同一时间窗口。 | 标记 `metric_source_missing`，不猜测来源。 | 展示 aggregation not ready 异常态，不展示真实统计。 | `metricKey`、`dashboardBucket`、`opportunityType`、`sourceType`、empty / exception copy、`mockSeedDemoFlag`。 | 完整客户明细、SQL、stack、成交金额、HIS raw payload。 | `dashboard_metric_viewed` / `metric_window_current` / `metric_source_missing`。 | 指标不可用，回到空态或 UI mock 文案。 | 返回 permission denied 或 tenant mismatch 低敏异常态。 | 关闭真实候选指标，只保留 UI mock / 空态说明。 |
| `pending_revisit_reminders` | 复诊 / 复查 / 状态确认提醒待人工处理。 | 复诊提醒 `pending_confirmation`。 | `dismissed`、转换状态、`completed`、`expired`。 | current / daily / weekly。 | 同一客户 + 同一治疗后摘要 / 预约 / 路径节点 + 同一复诊处理窗口。 | 不计入依赖稳定来源的正式指标，提示来源不完整。 | 显示复诊聚合未 ready，不回退高敏列表。 | 机会类型、来源摘要、处理窗口、优先级、空态文案。 | 完整病历、诊断正文、真实预约号、HIS 同步 payload。 | `dashboard_metric_viewed` / `metric_window_current` / `metric_window_trial`。 | 显示“暂无待处理复诊提醒”或能力未开启。 | 无权限下钻或跨机构读取时拒绝。 | 回退复诊 UI mock / 空态，不创建任务。 |
| `pending_repurchase_opportunities` | 复购 / 续疗机会待人工判断。 | 复购机会 `pending_confirmation`。 | `dismissed`、转换状态、`completed`、`expired`。 | current / trial / configurable。 | 同一客户 + 同一项目周期 / 生命周期状态 + 同一复购窗口。 | 提示项目周期、生命周期或来源摘要不完整。 | 展示聚合口径尚未 ready，不展示真实经营统计。 | 复购机会类型、项目周期摘要、优先级、试运行窗口。 | 成交金额、销售额、ROI、支付 / 合同 / 发票数据。 | `dashboard_metric_viewed` / `metric_window_trial`。 | 指标禁用，保留复购空态。 | 无权限时不返回复购下钻。 | 回退 UI mock / 空态，不触发营销。 |
| `pending_dormant_opportunities` | 沉睡客户机会进入人工判断。 | 沉睡客户机会 `pending_confirmation`。 | `dismissed`、转换状态、`completed`、`expired`。 | trial / configurable / current。 | 同一客户 + 同一沉睡阈值层级 + 同一观察窗口。 | 提示最后互动、沉睡阈值或观察窗口不完整。 | 展示 aggregation not ready，不自动生成唤醒对象。 | 阈值层级、观察窗口、来源类型、试运行说明。 | 完整联系方式、地址、外呼内容、自动唤醒记录。 | `dashboard_metric_viewed` / `metric_window_trial`。 | 指标禁用，显示沉睡机会空态。 | 无权限不返回沉睡客户摘要。 | 停用真实候选，保留内部可解释空态。 |
| `confirmed_opportunities` | 内部人员显式确认机会需要继续处理。 | `confirmed`，以及人工确认后的转换状态可候选纳入。 | `suggested`、`pending_confirmation`、`dismissed`、`expired`。 | trial / historical candidate。 | 同一机会最终有效确认结果只计一次。 | 确认对象来源缺失时标记异常，不计入正式确认口径。 | 提示确认结果聚合未 ready。 | `statusBefore` / `statusAfter`、`selectedAction`、`operatorRole`。 | 完整备注、客户联系方式、医疗结论、成交结果。 | `manual_confirmation_completed` candidate / `dashboard_metric_viewed`。 | 已确认指标不可用，回到只读文案。 | 无确认权限时不可查看确认明细。 | 回退为 UI mock / 空态，不删除真实数据。 |
| `converted_to_followup_tasks` | 人工确认后转内部随访任务。 | `converted_to_followup`。 | 其他未转换状态。 | trial / historical candidate。 | 同一机会 + 同一内部随访任务来源。 | 缺内部任务来源时不重复计入，提示来源缺失。 | 显示转换指标未 ready。 | 内部任务 ID 候选、来源摘要、状态前后、角色。 | 外部消息正文、电话录音、微信 / 企微原文。 | `converted_to_followup` / `internal_followup_conversion` candidate。 | 指标不可用，不创建真实任务。 | 只读看板权限不得执行转任务。 | 停用 manual confirm trial action 和 dashboard metric。 |
| `converted_to_internal_follow` | 人工确认后进入内部运营跟进。 | `converted_to_internal_follow` 或命名收口后的等价状态。 | 未确认、已忽略、过期、外部动作状态。 | trial window。 | 同一机会 + 同一内部跟进方向。 | 来源缺失时提示仅作内部参考。 | 显示内部跟进聚合未 ready。 | `selectedAction`、`operatorRole`、低敏备注摘要。 | 促销话术全文、自动营销记录、客户沟通全文。 | `converted_to_internal_follow` candidate。 | 禁用时不显示真实候选指标。 | 无权限时不返回内部跟进对象。 | 回退为空态，不触发外部系统动作。 |
| `converted_to_appointment_intents` | 人工确认后形成内部预约方向。 | `converted_to_appointment_intent`。 | 其他状态。 | trial / historical candidate。 | 同一机会 + 同一预约意向来源。 | 缺预约意向来源时不计入正式口径。 | 显示预约意向聚合未 ready。 | 意向来源、状态前后、低敏说明。 | 真实预约号、占号信息、HIS appointment payload。 | `appointment_intent_created` candidate。 | 禁用时显示暂无预约意向或能力未开启。 | 无权限不可下钻预约意向。 | 停用下钻与指标，不创建真实预约。 |
| `converted_to_repurchase_intents` | 人工确认后形成内部复购方向。 | `converted_to_repurchase_intent` 或 future repurchase intent 候选。 | 其他状态。 | trial window。 | 同一复购机会 + 同一复购意向来源。 | 来源缺失时提示不代表真实复购。 | 显示复购意向聚合未 ready。 | 机会类型、来源摘要、优先级、选中动作。 | 成交金额、支付、合同、发票、ROI。 | `repurchase_intent_created` candidate。 | 禁用时不显示真实候选。 | 无权限不可查看复购意向明细。 | 回退空态，不创建成交或营销动作。 |
| `wake_observation` | 沉睡机会经人工确认后进入内部观察。 | `wake_observation` 或 `confirmed` + selectedAction=继续观察候选。 | 外部触达、自动唤醒、已忽略、已过期。 | trial / configurable observation window。 | 同一客户 + 同一沉睡阈值层级 + 同一观察窗口。 | 阈值或最后互动缺失时进入异常态。 | 显示唤醒观察聚合未 ready。 | 阈值摘要、观察窗口、状态前后、角色。 | 外呼内容、完整联系方式、外部消息原文。 | `wake_observation_started` candidate。 | 禁用时不展示唤醒观察指标。 | 无权限不可下钻沉睡观察。 | 停用观察候选，不触发外呼或消息。 |
| `dismissed_opportunities` | 内部人员忽略或暂不处理机会。 | `dismissed`。 | 其他状态。 | trial / historical candidate。 | 同一机会最终有效忽略状态只计一次。 | 来源缺失时仍只能记录低敏忽略摘要。 | 显示已忽略指标未 ready。 | 忽略动作、状态前后、低敏原因类别。 | 完整备注、客户拒绝原话、个人隐私。 | `opportunity_dismissed` / `manual_confirmation_completed` candidate。 | 禁用时不显示真实忽略统计。 | 无权限不显示忽略原因。 | 回退空态，保留人工可解释提示。 |
| `expired_opportunities` | 处理窗口已过、来源失效或不再适用。 | `expired`。 | 未过期、已完成、已忽略等状态。 | expired / overdue / trial window。 | 同一机会最终有效过期状态只计一次。 | 来源失效时提示 `source_expired`，不自动重建。 | 显示过期聚合未 ready。 | 过期窗口、来源类型、状态前后。 | scheduler 日志、SQL、stack、外部错误全文。 | `opportunity_expired` / `source_expired` candidate。 | 禁用时不展示真实过期指标。 | 无权限不可查看过期对象。 | 回退空态，不执行 migration rollback 或脚本。 |
| `exception_metrics` | 来源缺失、聚合未 ready、状态异常、低敏下钻不可用等异常候选。 | `metric_source_missing`、`aggregation_not_ready`、`source_invalid` 等异常候选。 | 正常完成统计的指标。 | current / trial。 | 同一 metricKey + 同一异常类别 + 同一来源候选。 | 计入异常指标候选，不暴露原始来源。 | 展示 not ready，不暴露 SQL、stack 或 DB URL。 | `metricKey`、异常类别、低敏 copy、sourceType。 | raw payload、外部错误全文、SQL、stack、credential。 | `dashboard_metric_source_unavailable` / `dashboard_aggregation_unavailable`。 | 禁用时显示能力未开启或安全空态。 | tenant / RBAC 失败进入低敏异常态。 | 回退空态，不降级为真实客户列表。 |

## 6. 状态纳入 / 排除测试矩阵

以下状态或状态族只是 future candidate，不是 schema enum，不是状态机实现，不是 API 约束，不是测试代码。当前不固化 schema enum，当前不实现状态机，当前不写 API，当前不写测试代码。stale / already handled / invalid transition 必须是低敏失败，不得静默成功。

| 状态 / 状态族 | 未来纳入测试断言 | 未来排除测试断言 | 异常 / 失败期望 | 当前边界 |
| --- | --- | --- | --- | --- |
| `suggested` | 仅当已展示为待确认入口时，可作为 `pending_total_opportunities` 辅助候选。 | 不计入已确认、转换、忽略或过期结果。 | 来源缺失时进入异常态。 | 不自动触达，不自动确认。 |
| `pending_confirmation` | 纳入待处理总数、复诊、复购、沉睡待处理指标。 | 不计入已确认、转换、忽略、过期结果。 | 无权限确认时低敏拒绝。 | 待人工确认是 V1 重点入口。 |
| `confirmed` | 纳入 `confirmed_opportunities`，可作为转换状态前置。 | 通常排除分类型待处理指标。 | stale 时提示刷新，不覆盖状态。 | 不代表已触达、已成交、已预约。 |
| `converted_to_followup` | 纳入 `converted_to_followup_tasks`。 | 排除待处理、已忽略、过期。 | 重复来源应低敏冲突，不重复计数。 | 内部任务不等于外部消息。 |
| `converted_to_internal_follow` | 纳入 `converted_to_internal_follow` 候选。 | 排除自动营销、外部触达、成交类指标。 | 命名未收口时应阻断。 | 需与 followup 语义区分。 |
| `converted_to_appointment_intent` | 纳入 `converted_to_appointment_intents`。 | 排除真实预约、HIS 同步、占号统计。 | 无权限下钻时拒绝。 | 预约意向不是真实预约。 |
| `converted_to_repurchase_intent` | 纳入 `converted_to_repurchase_intents`。 | 排除成交、支付、合同、ROI。 | 成交字段出现时应阻断。 | 复购意向不是真实成交。 |
| `wake_observation` | 纳入 `wake_observation`。 | 排除自动唤醒、外呼、外部消息发送。 | 阈值缺失时低敏异常。 | 只表示内部观察。 |
| `dismissed` | 纳入 `dismissed_opportunities`。 | 排除待处理、已确认、转换、过期。 | 原因只能低敏，不写完整备注。 | 忽略必须可追踪，不能无痕丢弃。 |
| `completed` | 可作为 future 可选结果，不在本任务必选指标清单中固化。 | 排除待处理、异常、过期。 | 不得写成成交或医疗效果。 | 当前不规划完成指标实现。 |
| `expired` | 纳入 `expired_opportunities`。 | 排除待处理、已确认、转换结果。 | 不实现自动过期 scheduler。 | 只规划过期候选。 |
| `stale` | 作为低敏失败断言，提示状态已过期。 | 不计入成功确认或转换。 | 必须失败，不得静默成功。 | 不实现并发控制代码。 |
| `already handled` | 作为低敏失败断言，提示对象已被处理。 | 不重复计入确认、转换、忽略。 | 必须失败，不得重复执行。 | 不展示其他操作者隐私。 |
| `invalid transition` | 作为低敏失败断言，提示无效流转。 | 不改变任何候选状态。 | 必须失败，不得临时放行。 | 不实现状态机代码。 |
| `exception / unavailable` | 纳入 `exception_metrics` 候选。 | 排除正常业务结果指标。 | 展示低敏异常态。 | 不暴露 SQL、stack、raw payload。 |

## 7. 时间窗口测试矩阵

以下时间窗口只是 future candidate。当前不写时间窗口查询，不新增 `dashboard_metric_snapshots`，不写 aggregation query，不实现 scheduler / worker / cron，不定义最终时区算法，不实现日期计算代码。

| 时间窗口 | 未来测试断言候选 | 适用指标候选 | 缺失 / 异常期望 | 当前不做 |
| --- | --- | --- | --- | --- |
| current window | 当前仍处于待人工处理或异常提示范围的对象可进入当前窗口。 | 待处理总数、分类型待处理、异常指标。 | window source missing 时提示仅作内部参考。 | 不写实时 SQL。 |
| trial window | 试运行复盘指标必须带试运行说明和 demo 标记。 | 已确认、转换、忽略、过期、复购、沉睡。 | 未配置试运行窗口时进入异常态。 | 不锁定最终统计周期。 |
| daily window | 今日复诊提醒或今日待处理入口可候选。 | 复诊提醒、dueDate 类指标。 | `dueDate` missing 时不计入。 | 不实现日期计算。 |
| weekly window | 本周复诊、沉睡观察或复购窗口可候选。 | 复诊提醒、复购、沉睡观察。 | timezone boundary 未确认时只给低敏提示。 | 不定义周起始日。 |
| configurable window | 沉睡阈值、复购窗口、历史复盘可配置候选。 | 沉睡、复购、历史复盘。 | window not configured 时显示能力未配置。 | 不做配置表或查询参数。 |
| expired / overdue window | 过期或逾期未处理候选。 | `expired_opportunities`、未来逾期指标。 | 过期来源缺失时进入异常态。 | 不实现自动过期。 |
| dueDate missing | 不能进入日、周或逾期窗口。 | 复诊、过期、待处理窗口指标。 | “缺少处理日期，未计入时间窗口指标”。 | 不猜测日期。 |
| timezone boundary | 跨日、跨周边界需以后续产品时区算法确认。 | daily / weekly / overdue。 | 先以低敏异常或待确认提示处理。 | 不定义最终时区算法。 |
| window not configured | 可配置窗口未配置。 | configurable / trial。 | 显示“指标口径尚未配置完整”。 | 不新增配置。 |
| window source missing | 来源对象缺窗口信息。 | all windowed metrics。 | 标记 `metric_source_missing` 或 `aggregation_not_ready`。 | 不读取 raw source。 |

## 8. 去重口径测试矩阵

以下 dedup candidate 只用于未来测试规划。当前不实现 dedup logic，不新增 repository，不新增 service，不新增唯一索引，不写 SQL。

| dedup candidate | 未来测试断言 | 来源缺失时的期望 | 禁止实现误读 |
| --- | --- | --- | --- |
| 同一客户 + 同一机会类型 + 同一来源类型 + 同一来源 ID + 同一时间窗口。 | 同一窗口内只计一次通用机会。 | 标记 `metric_source_missing`，不猜测来源 ID。 | 不新增唯一索引或 SQL。 |
| 同一客户 + 同一治疗后摘要 / 预约 / 路径节点 + 同一复诊处理窗口。 | 复诊提醒同源同窗口只计一次。 | 不计入依赖稳定来源的正式指标。 | 不把治疗摘要当 opportunity object。 |
| 同一客户 + 同一项目周期 / 生命周期状态 + 同一复购窗口。 | 复购机会同周期同窗口只计一次。 | 提示项目周期或生命周期来源不完整。 | 不把 lifecycle 直接当 opportunity runtime。 |
| 同一客户 + 同一沉睡阈值层级 + 同一观察窗口。 | 沉睡机会同阈值同观察窗口只计一次。 | 提示沉睡阈值或最后互动来源不完整。 | 不锁死最终沉睡天数。 |
| 同一确认对象 + 同一 `selectedAction` 结果。 | 人工确认结果按最终有效状态计数。 | stale / already handled 低敏失败。 | 不重复执行确认动作。 |
| 同一机会 + 同一内部随访任务来源。 | `converted_to_followup_tasks` 不重复计数。 | 来源缺失时不创建真实任务。 | 不把内部任务等同外部触达。 |
| 同一机会 + 同一预约 / 复购意向来源。 | 预约意向、复购意向只计一次。 | 来源缺失时不创建真实预约或成交。 | 不写 appointment / deal runtime。 |
| 同一 metricKey + 同一异常类别 + 同一来源候选。 | `exception_metrics` 按异常类别去重。 | 只统计异常类别，不暴露原始来源。 | 不保存 SQL、stack 或 raw payload。 |

## 9. 空态 / 异常态测试矩阵

未来断言必须确认：异常态不暴露 SQL，不暴露 stack，不暴露 raw payload，不暴露外部错误全文，不展示高敏客户字段，不得自动降级为真实客户列表。当前不实现异常处理代码。

| 场景 | 未来测试断言 | 指标影响候选 | audit input 候选 | 禁止展示内容 |
| --- | --- | --- | --- | --- |
| no candidate opportunities | 显示“暂无待处理机会”或等价空态。 | 待处理指标为 0 或空态。 | 通常不写新增审计。 | 历史任务全部完成的绝对判断。 |
| metric source missing | 来源不完整，仅作内部参考。 | 标记异常或排除稳定来源指标。 | `dashboard_metric_source_unavailable` / `metric_source_missing`。 | raw payload、HIS raw ID、请求体。 |
| partial source unavailable | 部分来源暂不可用，仅展示低敏参考。 | 进入 `exception_metrics`。 | `metric_source_missing`。 | SQL、stack、外部错误全文。 |
| aggregation not ready | 看板聚合口径尚未 ready。 | 进入 `exception_metrics`，不展示真实统计。 | `dashboard_aggregation_unavailable` / `aggregation_not_ready`。 | 聚合 SQL、DB URL、服务端堆栈。 |
| dashboard aggregation unavailable | dashboard aggregation 不可用时显示异常态或空态。 | 指标不可用，不回退高敏明细。 | `dashboard_aggregation_unavailable`。 | 完整客户列表、完整 BI 导出。 |
| low-sensitive drilldown unavailable | 下钻入口禁用或显示低敏空态。 | 聚合卡可展示，明细不可用。 | `dashboard_drilldown_viewed` + unavailable candidate。 | 高敏客户明细。 |
| stale confirmation target | 确认对象已过期。 | 不改变指标成功状态。 | `manual_confirmation_stale` / `state_stale`。 | 并发内部细节、SQL。 |
| already handled | 对象已被处理。 | 不重复确认或重复计数。 | `manual_confirmation_already_handled` / `already_handled`。 | 其他操作者隐私、完整备注。 |
| invalid transition | 无效流转失败。 | 不改变任何指标。 | `manual_confirmation_rejected` / `action_invalid`。 | rejected value 原文。 |
| tenant scope mismatch | 租户范围不匹配。 | 不返回对象或指标。 | `cross_tenant_access_denied` / `tenant_mismatch`。 | 其他租户客户明细。 |
| permission denied | 权限不足。 | 指标或下钻拒绝。 | `permission_denied` / `role_not_allowed`。 | policy 内部细节、高敏对象。 |
| feature flag disabled | 能力未开启。 | 回退空态 / UI mock / 只读文案。 | 可不写入，或 future 明确为 skipped。 | 绕过 flag 返回真实数据。 |
| dueDate missing | 不计入时间窗口指标。 | 日 / 周 / 逾期指标排除。 | `metric_source_missing` 或低敏异常候选。 | 外部日程 payload、客户完整行程。 |
| priority missing | 不计入高优先级候选。 | 高优先级指标排除。 | 低敏异常候选。 | 黑箱 AI 分数。 |
| dormant threshold not confirmed | 显示试运行口径待产品确认。 | 可计入试运行指标，必须带说明。 | 口径变化候选。 | 自动唤醒结果、外呼内容。 |
| status invalid | 状态异常，暂不计入正式指标。 | 进入 `exception_metrics`。 | `source_invalid` 或状态异常候选。 | 新 enum 实现说明、stack。 |
| source invalid | 来源无效或不允许。 | 进入异常态，不猜测来源。 | `source_invalid`。 | 外部错误全文、raw source。 |

## 10. low-sensitive drilldown 测试矩阵

未来低敏下钻只能返回低敏摘要或确认对象摘要。当前不定义真实 DTO，不实现 drilldown API，不实现下钻 runtime，不新增 parser / sanitizer / mask / redact。

允许字段候选：

- `metricKey`
- `dashboardBucket`
- `opportunityType`
- `sourceType`
- `sourceSummary`
- `triggerReason`
- `suggestedAction`
- `priority`
- `dueDate window`
- `statusBefore / statusAfter`
- `selectedAction`
- `operatorRole`
- `mockSeedDemoFlag`
- `empty / exception copy`

禁止字段候选：

- 完整手机号
- 完整联系方式
- 身份证号
- 完整病历号
- 地址
- 完整病历正文
- 诊断正文
- 治疗原文
- 咨询记录全文
- 外部消息原文
- 成交金额
- 销售额
- ROI
- 支付 / 合同 / 发票 / 回款数据
- HIS credential
- API Key / Token / OAuth secret / Webhook secret
- 数据库连接串
- HIS raw payload
- 外部系统请求 / 响应正文
- SQL
- stack
- DB URL
- AI prompt / completion 全文

| 下钻场景 | 未来测试断言 | 允许输出 | 禁止输出 | 失败期望 |
| --- | --- | --- | --- | --- |
| 指标卡下钻 | 只能进入低敏机会摘要或确认对象摘要。 | `metricKey`、`dashboardBucket`、`opportunityType`、`sourceSummary`。 | 完整客户列表、SQL、BI 明细。 | 无权限或未开启时禁用入口。 |
| 复诊提醒下钻 | 展示复诊窗口和来源摘要。 | `sourceType`、`triggerReason`、`dueDate window`。 | 完整病历、诊断正文、真实预约号。 | 来源缺失时低敏异常。 |
| 复购机会下钻 | 展示项目周期或生命周期摘要。 | `priority`、`suggestedAction`、`mockSeedDemoFlag`。 | 成交金额、销售额、ROI、促销话术全文。 | 字段违规时阻断。 |
| 沉睡机会下钻 | 展示阈值层级和观察窗口。 | `triggerReason`、`dueDate window`、empty / exception copy。 | 完整联系方式、外呼内容、外部消息。 | 阈值未确认时保留试运行提示。 |
| 人工确认结果下钻 | 展示状态前后和选中动作。 | `statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`。 | 操作人隐私、完整备注。 | stale / already handled 低敏失败。 |
| 异常指标下钻 | 仅展示异常类别和低敏文案。 | `metricKey`、异常 copy、`sourceType`。 | SQL、stack、raw payload、外部错误全文。 | 不降级为客户明细。 |

## 11. field whitelist 测试矩阵

字段白名单测试应优先验证“允许字段可出现”和“禁止字段不出现”。当前不新增 parser、sanitizer、mask、redact 或 enforcement 代码。

| 对象 | 允许断言候选 | 禁止断言候选 | 异常期望 |
| --- | --- | --- | --- |
| dashboard 指标卡 | `metricKey`、中文指标名、`count` 候选、`dashboardBucket`、空态 / 异常态文案、`mockSeedDemoFlag`。 | 客户完整列表、SQL、BI 明细、销售额、ROI。 | 字段违规时阻断或显示低敏异常。 |
| low-sensitive drilldown | 指标、桶、机会摘要、确认对象摘要、低敏来源引用。 | 完整客户明细、完整联系方式、完整病历、外部系统原文。 | 下钻禁用，不导出明细。 |
| opportunity 卡片 | 机会类型、来源摘要、触发原因、建议动作、优先级、时间窗口、demo 标记。 | 完整手机号、完整病历、成交金额、HIS raw payload。 | 禁止字段存在时不渲染、不写审计原文。 |
| manual confirm 卡片 | 确认对象类型、内部对象 ID、状态前后、选中动作、操作者角色、低敏备注摘要。 | 备注全文、高敏客户信息、真实预约号、外部触达内容。 | `invalid_field_whitelist` 低敏失败。 |
| audit input | resource、action、reason、result、状态前后、低敏摘要、demo 标记。 | metadata、request body、response body、token、secret、raw payload、stack。 | audit naming 未 ready 时阻断。 |
| empty / exception copy | 稳定文案、低敏原因、不可用说明。 | 外部错误全文、SQL、DB URL、credential。 | 只显示低敏 fallback。 |

## 12. audit input / event naming 测试矩阵

以下 audit input / event naming 只作为未来候选断言。当前不新增 audit enum，不新增 audit metadata，不实现 audit runtime，不修改 audit repository，不写 audit 测试代码。

必须覆盖的候选名称：

- `dashboard_metric_viewed`
- `dashboard_drilldown_viewed`
- `dashboard_metric_source_unavailable`
- `dashboard_aggregation_unavailable`
- `metric_window_current`
- `metric_window_trial`
- `metric_source_missing`
- `aggregation_not_ready`
- `drilldown_low_sensitive`

| 候选名称 | 类型 | resource candidate | action candidate | reason candidate | result candidate | allowed low-sensitive input | forbidden metadata / raw payload / SQL / stack / credential | feature flag disabled 时是否不写入 | audit input naming 未 ready 时是否阻断 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard_metric_viewed` | action candidate | `dashboard_metric` | `dashboard_metric_viewed` | `metric_window_current` / `metric_window_trial` | `success` | `metricKey`、`dashboardBucket`、`operatorRole`、`mockSeedDemoFlag`。 | 禁止客户完整明细、SQL、metadata、token、secret。 | 候选为不写入或记录 skipped，需后续确认。 | 是，阻断临时 action。 |
| `dashboard_drilldown_viewed` | action candidate | `dashboard_drilldown` | `dashboard_drilldown_viewed` | `drilldown_low_sensitive` | `success` / `denied` | `metricKey`、`opportunityType`、`sourceType`、低敏对象摘要。 | 禁止完整客户列表、raw payload、stack。 | disabled 时不写真实下钻审计。 | 是。 |
| `dashboard_metric_source_unavailable` | action candidate | `dashboard_metric` | `dashboard_metric_source_unavailable` | `metric_source_missing` | `unavailable` | `metricKey`、异常类别、`sourceType`。 | 禁止 raw source、外部错误全文、HIS raw ID。 | disabled 时可不写入。 | 是。 |
| `dashboard_aggregation_unavailable` | action candidate | `dashboard_metric` | `dashboard_aggregation_unavailable` | `aggregation_not_ready` | `unavailable` / `not_ready` | `metricKey`、`dashboardBucket`、低敏 unavailable copy。 | 禁止 SQL、stack、DB URL、metadata。 | disabled 时不写入真实聚合审计。 | 是。 |
| `metric_window_current` | reason candidate | `dashboard_metric` | `dashboard_metric_viewed` | `metric_window_current` | `success` | 当前窗口短码、metricKey。 | 禁止自由中文长文、raw query。 | disabled 时不写入。 | 是。 |
| `metric_window_trial` | reason candidate | `dashboard_metric` | `dashboard_metric_viewed` | `metric_window_trial` | `success` | 试运行窗口短码、demo 标记。 | 禁止生产统计误导。 | disabled 时不写入。 | 是。 |
| `metric_source_missing` | reason candidate | `dashboard_metric` | `dashboard_metric_source_unavailable` | `metric_source_missing` | `unavailable` | 来源类型、缺失类别、低敏摘要。 | 禁止 raw payload、HIS raw ID。 | disabled 时不写入。 | 是。 |
| `aggregation_not_ready` | reason candidate | `dashboard_metric` | `dashboard_aggregation_unavailable` | `aggregation_not_ready` | `not_ready` | metricKey、not ready copy。 | 禁止 SQL、stack、聚合函数。 | disabled 时不写入。 | 是。 |
| `drilldown_low_sensitive` | reason candidate | `dashboard_drilldown` | `dashboard_drilldown_viewed` | `drilldown_low_sensitive` | `success` / `denied` | 下钻类型、低敏对象摘要、角色。 | 禁止高敏明细、完整 BI 导出。 | disabled 时不写入。 | 是。 |

未来 audit input 还必须断言：

- 只允许 resource candidate、action candidate、reason candidate、result candidate、内部 resource ID、`metricKey`、`dashboardBucket`、`opportunityType`、`sourceType`、`statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`、`lowSensitiveSummary`、`mockSeedDemoFlag`。
- 不得记录 metadata、request body、response body、SQL、stack、token、secret、credential、HIS raw payload、外部错误全文、完整联系方式、完整病历或 AI prompt / completion 全文。

## 13. tenant / RBAC / feature flag 测试矩阵

future feature flag candidate 必须覆盖：

- `v1OpportunityRuntimeEnabled`
- `v1ManualConfirmTrialEnabled`
- `v1DashboardMetricsReadonlyEnabled`
- `v1LowSensitiveDrilldownEnabled`
- `v1AuditInputReadonlyEnabled`

权限边界必须覆盖：

- tenant scope
- institution scope
- operator role
- internal staff role
- read-only dashboard access
- manual confirm permission
- low-sensitive drilldown permission
- audit visibility boundary

| 边界 | 未来测试断言 | 失败时行为 | 禁止行为 |
| --- | --- | --- | --- |
| `v1OpportunityRuntimeEnabled` | 默认关闭，按 tenant 开启，可回滚。 | disabled 时只显示 UI mock / 空态 / 只读文案。 | 不允许全量默认开启。 |
| `v1ManualConfirmTrialEnabled` | 只有开启后才允许试运行确认动作候选。 | disabled 时不可提交，只保留提示。 | 不允许 feature flag 触发外部系统动作。 |
| `v1DashboardMetricsReadonlyEnabled` | 只读指标按 tenant 开启。 | disabled 时停用真实候选指标。 | 不允许 mock / demo 数据混入真实 tenant。 |
| `v1LowSensitiveDrilldownEnabled` | 下钻独立开关。 | disabled 时隐藏或禁用下钻入口。 | 不允许无权限下钻。 |
| `v1AuditInputReadonlyEnabled` | audit input 候选默认关闭。 | disabled 时不写入或不展示候选 audit input。 | 不允许临时 metadata。 |
| tenant scope | 只能访问当前 tenant 的机会、指标、下钻和审计输入。 | tenant mismatch 低敏异常态。 | 不允许跨 tenant 读取。 |
| institution scope | 机构用户只能访问所属机构范围。 | 不返回跨机构数据。 | 不允许跨机构读取。 |
| operator role | 只展示操作者角色。 | 隐藏或拒绝不合规字段。 | 不展示员工个人敏感信息。 |
| internal staff role | 人工确认必须由内部人员执行。 | 低敏权限拒绝。 | 不允许无权限确认。 |
| read-only dashboard access | 只能查看指标摘要。 | 禁止确认动作和敏感下钻。 | 不允许绕过 RBAC。 |
| manual confirm permission | 具备确认权限才可执行试运行确认动作。 | permission denied。 | 不允许自动营销 / 自动触达。 |
| low-sensitive drilldown permission | 下钻需要独立权限。 | 禁用下钻入口。 | 不允许导出完整客户列表。 |
| audit visibility boundary | audit input 可见范围受 tenant / role 控制。 | 不返回 audit input 或只返回低敏摘要。 | 不允许跨机构审计明细。 |

统一断言：

- 默认关闭。
- 按 tenant 开启。
- 可回滚。
- 不允许全量默认开启。
- 不允许绕过 RBAC。
- 不允许 feature flag 触发外部系统动作。
- 不允许 feature flag 自动营销 / 自动触达。
- 不允许跨机构读取。
- 不允许无权限下钻。
- 不允许无权限确认。
- 不允许 mock / demo 数据混入真实 tenant。

## 14. rollback 测试矩阵

当前不实现 rollback，不写配置，不写 migration，不写脚本，不写测试代码。

| rollback candidate | 未来测试断言 | 预期效果 | 禁止事项 |
| --- | --- | --- | --- |
| 关闭 feature flag | 关闭所有 future slice 后停止候选 runtime 输出。 | 回到安全空态或 mock-only 说明。 | 不删除真实数据。 |
| 回退到 UI mock / 空态 / 只读文案 | dashboard、opportunity、manual confirm 回退可解释。 | 内部人员知道能力未开启或未 ready。 | 不清洗真实客户数据。 |
| 停用低敏下钻 | 下钻入口隐藏或禁用。 | 不返回客户明细。 | 不导出完整客户列表。 |
| 停用 manual confirm trial action | 人工确认试运行动作不可提交。 | 只保留文案说明。 | 不覆盖状态。 |
| 停用 dashboard metrics read-only | 停用真实候选指标。 | 显示空态 / 异常态。 | 不回退成真实 BI 导出。 |
| 停用 audit input 写入 | 不写候选审计输入。 | 避免不稳定命名进入审计。 | 不临时写 metadata。 |
| 保留人工可解释空态 | 所有展示层保留说明。 | 可解释、可审查、低敏。 | 不暴露 SQL、stack、raw payload。 |
| 不删除真实数据 | rollback 不做数据删除。 | 只关闭能力。 | 不执行数据清理。 |
| 不清洗真实客户数据 | rollback 不是数据修复。 | 不触碰客户数据。 | 不批量改数据。 |
| 不执行 migration rollback | 不做 migration rollback。 | 避免 schema 风险。 | 不执行 migration。 |
| 不执行脚本批量改数据 | 不运行批处理修复脚本。 | 避免越界修改。 | 不写脚本。 |
| 不触发外部系统补偿 | 不连接真实外部系统。 | 不做补偿任务。 | 不触发 HIS、微信、企微、短信或电话。 |

## 15. 不授权 runtime 的边界断言

未来任何测试计划、测试实现或 runtime PR 前，必须先断言以下边界未被当前文档授权：

| 边界 | 当前结论 |
| --- | --- |
| schema | 不新增 `opportunities`、`manual_confirmations`、`dashboard_metric_snapshots` 等表，不扩 enum。 |
| migration | 不执行 migration，不新增 migration 文件。 |
| SQL | 不写 aggregation query，不写报表 SQL，不写唯一索引 SQL。 |
| API | 不新增 opportunity、manual confirmation、dashboard metrics、drilldown 或 audit API。 |
| service / repository / DTO | 不新增业务 service、repository、DTO、query parser 或 mutation handler。 |
| dashboard aggregation runtime | 不实现聚合运行时、缓存、snapshot、scheduler、worker 或 cron。 |
| audit runtime | 不新增 audit enum、metadata、repository 写入或 runtime guard。 |
| field whitelist enforcement | 不新增 parser、sanitizer、mask、redact 或 runtime guard。 |
| tests | 不新增测试文件，不运行 test / lint / typecheck。 |
| external system | 不连接真实 HIS、真实 credential、外部系统或真实客户数据。 |

如果后续 PR 中出现上述任何实现，应视为超出本测试计划边界，必须停止并重新确认授权。

## 16. 反模式测试清单

以下反模式必须在后续测试计划、测试实现或 runtime 评审中主动避免：

| 反模式 | 风险 |
| --- | --- |
| 把本测试计划当成测试实现授权。 | 会绕过当前 no test implementation 边界。 |
| 把 dashboard aggregation 测试计划当成 runtime 授权。 | 会绕过用户明确批准。 |
| 把 UI mock 数值当真实测试样本。 | 会把 demo / seed / mock 误读为生产统计。 |
| 把 HIS runtime 当 1.0 主线测试前置。 | 会偏离客户运营中台主线。 |
| 把机会候选直接测试成真实任务 / 预约 / 成交。 | 会绕过人工确认，并误导业务结果。 |
| 把复购意向测试成成交金额或 ROI。 | 会混淆内部意向与真实经营结果。 |
| 把预约意向测试成真实预约或 HIS 同步。 | 会误导为已占号、已同步或已创建预约。 |
| 把唤醒观察测试成自动外呼或自动触达。 | 会违反不自动营销、不自动触达边界。 |
| 在一个 PR 里同时写 schema、API、runtime、aggregation、audit 和测试。 | 难以审查、难以回滚，放大隐私和状态风险。 |
| 在测试断言里要求完整客户明细、完整联系方式或高敏字段。 | 会突破字段白名单和低敏下钻边界。 |
| 在异常测试里断言 SQL、stack、raw payload 或外部错误全文。 | 会把调试信息变成高敏输出契约。 |
| 直接新增 dashboard_metric_snapshots 测试。 | 会默认授权未批准的指标快照和 BI 化方向。 |
| 提前写 audit metadata / audit enum 测试。 | 会放大审计 schema 与隐私风险。 |
| 不经 feature flag 直接默认开启指标。 | 无法按 tenant 试运行，无法快速回滚。 |
| 不做 tenant / RBAC 就测试下钻成功。 | 可能跨机构泄露运营数据。 |

## 17. 后续建议 PR 顺序

以下只是建议顺序，不构成开发许可：

1. V1-FIELD-WHITELIST-TEST-PLAN-01：docs-only / test-plan-only，细化低敏字段、禁止字段、审计输入和异常响应的未来测试矩阵。
2. V1-AUDIT-TEST-PLAN-01：docs-only / test-plan-only，细化 V1 opportunity、manual confirm、dashboard metrics 和权限 / tenant 的审计候选断言。
3. V1-UI-MOCK-ASSERTION-PLAN-01：docs-only / UI-mock-plan-only，梳理现有 UI mock 的可审查展示断言，不写测试代码。
4. V1-RUNTIME-SLICE-0-READINESS-CHECK-01：仅在后续明确批准后，做只读契约对齐检查候选。
5. V1-RUNTIME-SLICE-1-OPPORTUNITY-READONLY-LATER-01：仅在后续明确批准后，做低敏 opportunity candidate read-only。
6. V1-RUNTIME-SLICE-2-MANUAL-CONFIRM-TRIAL-LATER-01：仅在后续明确批准后，做人工确认试运行动作边界。
7. V1-RUNTIME-SLICE-3-DASHBOARD-METRICS-READONLY-LATER-01：仅在后续明确批准后，做低敏 dashboard metrics read-only。
8. V1-RUNTIME-SLICE-4-AUDIT-INPUT-LATER-01：仅在后续明确批准后，做低敏 audit input。

任何 schema、migration、SQL、API、route、service、repository、DTO、dashboard aggregation runtime、audit runtime、audit enum、audit metadata、runner、scheduler、queue、worker、HIS、credential、真实外部系统、自动触达、真实预约、真实成交、支付 / 合同 / 发票、生产配置都必须单独确认。

## 18. 本文档边界

本文档只新增 V1 dashboard aggregation 测试计划 01，边界如下：

- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不修改 `src/server/db/schema.ts`。
- 不修改 `src/app/api/**`。
- 不修改 `src/server/**`。
- 不修改任何 service / repository / DTO。
- 不修改任何既有 docs/product 事实源、契约、review、已有 test-plan、copy、已有 plan。
- 不修改 package.json。
- 不修改 lockfile。
- 不新增测试文件。
- 不新增 fixture。
- 不新增 mock data。
- 不新增 test helper。
- 不运行 test。
- 不运行 lint。
- 不运行 typecheck。
- 不启动 dev server。
- 不执行 migration。
- 不写 SQL。
- 不新增 dashboard aggregation。
- 不新增 API / route。
- 不新增 service。
- 不新增 repository。
- 不新增 DTO。
- 不新增 schema。
- 不新增 migration。
- 不新增 parser / sanitizer / mask / redact。
- 不新增字段白名单 enforcement 代码。
- 不新增 audit metadata。
- 不新增 audit enum。
- 不实现 audit runtime。
- 不连接真实 HIS。
- 不读取真实 credential。
- 不连接外部系统。
- 不处理真实客户数据。
- 不自动营销 / 自动触达。
- 不发送外部消息。
- 不创建真实任务 / 预约 / 成交。
- 不修复本任务之外的问题。
- 不格式化无关文件。

本文档中的 candidate metrics、候选断言、后续建议和 PR 顺序都不是开发许可。未来进入测试实现、runtime、schema、API、SQL、dashboard aggregation、audit 或字段白名单 enforcement 前，必须由用户在新的当前任务中明确批准，并重新执行项目治理启动检查。

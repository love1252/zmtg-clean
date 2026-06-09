# V1 主链路测试计划细化 01

## 0. 文档元信息

- 任务编号：V1-TEST-PLAN-REFINEMENT-01。
- 日期与时区：2026-06-09 CST +0800，来自本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前分支：`docs/v1-test-plan-refinement-01`。
- 启动基线：`HEAD`、`main` 与 `origin/main` 均为 `695111bc07a59af161a53ae07fc06cf2082193ee`。
- 当前阶段：docs-only / plan-only / test-plan-only / review-only。
- 本文档只新增测试计划细化，不修改产品事实源、契约、review、copy、已有 plan、UI mock、runtime 或测试代码。

文档性质：

- docs-only：仅修改文档
- test-plan-only：仅规划测试断言
- no test implementation：不写测试代码
- no runtime：不实现运行时
- no SQL：不写 SQL
- no API changes：不修改 API
- no schema changes：不修改 schema
- no dashboard aggregation runtime：不实现 dashboard aggregation 运行时
- no audit runtime：不实现 audit 运行时

本文档不授权测试实现、runtime、SQL、API、route、service、repository、DTO、schema、migration、dashboard aggregation runtime、dashboard API、metric snapshot、audit runtime、audit metadata、audit enum、真实 HIS、真实 credential、真实客户数据、自动营销、自动触达、外部消息发送、真实预约、真实成交或医疗诊断。

## 1. 背景与结论摘要

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是 1.0 主线，不阻塞 1.0。

V1 主链路已完成 opportunity contract、manual confirm contract、dashboard metrics contract、field whitelist contract、audit coverage matrix、schema impact plan、API boundary plan、field whitelist enforcement plan、audit event naming plan 与 dashboard aggregation plan。当前仍不能进入 runtime。本任务只把这些契约和计划整理成未来测试断言候选，供后续 test-only / UI-only / mock-only / runtime-later 小 PR 评审时使用。

核心结论：

- 本文档只规划未来测试断言，不新增测试文件，不运行测试，不定义测试框架。
- opportunity、manual confirm、dashboard metrics、dashboard aggregation、low-sensitive drilldown、field whitelist、empty / exception state、audit input / audit event naming 都只能作为候选测试主题。
- 现有 UI mock、seed、demo 数据只能作为事实盘点依据，不能被当作真实测试样本、真实经营统计或生产口径。
- 所有未来测试断言都必须保留人工确认、低敏字段、mock / seed / demo 标记和未授权 runtime 边界。
- 任何 schema、API、service、repository、DTO、SQL、dashboard aggregation runtime、audit runtime 或测试实现，都必须在后续任务中单独批准。

## 2. 测试计划适用范围

本测试计划适用于未来评审以下对象的测试断言，不代表这些对象已经实现：

| 对象 | 适用的候选断言 | 依据 |
| --- | --- | --- |
| 三类机会 | 复诊提醒、复购机会、沉睡客户机会的来源、状态、去重、人工确认和低敏展示。 | opportunity contract、opportunity test plan、dashboard aggregation plan。 |
| 人工确认 | 待确认、确认、转换、忽略、过期、已处理、状态过期、无效流转等候选断言。 | manual confirm contract、audit coverage matrix、audit event naming plan。 |
| dashboard metrics | 候选指标名称、指标不代表真实统计、异常指标和 mock / seed / demo 标记。 | dashboard metrics contract、dashboard aggregation plan、UI mock 只读事实。 |
| dashboard aggregation | 时间窗口、来源缺失、聚合未 ready、去重和异常态候选。 | dashboard aggregation plan、schema impact plan、API boundary plan。 |
| low-sensitive drilldown | 下钻只返回低敏摘要和确认对象摘要，不返回高敏明细。 | field whitelist contract、field whitelist enforcement plan、API boundary plan。 |
| empty / exception state | 空态、异常态、来源缺失、窗口缺失、字段缺失、低敏下钻不可用。 | dashboard empty state copy、dashboard aggregation plan。 |
| audit input / event naming | 候选 resource / action / reason / result 与低敏 audit input。 | audit coverage matrix、audit event naming plan。 |
| 未授权边界 | schema / API / runtime / SQL / tests 仍未授权。 | schema impact plan、API boundary plan、contract-to-implementation plan。 |

本计划只适用于未来候选测试断言，不适用于当前实现验收，不适用于生产 BI，不适用于真实 HIS、真实外部系统或真实客户数据。

## 3. 不在本测试计划覆盖范围内的内容

以下内容不在本测试计划覆盖范围内：

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
- 不把测试计划当作后续开发许可。

如果未来需要进入上述任何范围，必须由用户在新的当前任务中明确批准，并重新执行项目治理启动检查。

## 4. 测试分层总览

未来测试可以按以下层级规划，但当前不实现任何层级：

| 层级 | 候选测试目的 | 可断言内容 | 当前不做 |
| --- | --- | --- | --- |
| 产品事实层 | 确认智美天工 1.0 主线仍是治疗后客户运营闭环。 | 不是 HIS；HIS 只是来源之一；不自动触达；保留人工确认。 | 不改产品事实源。 |
| 契约语义层 | 确认 opportunity、manual confirm、dashboard metrics、field whitelist、audit 的候选语义一致。 | 字段、状态、指标、事件名和低敏边界。 | 不生成 TypeScript interface，不写 DTO。 |
| 候选对象层 | 确认三类机会和人工确认对象的测试断言可被拆分。 | 来源完整、来源缺失、状态纳入 / 排除、去重、异常态。 | 不创建表，不写状态机。 |
| 展示与下钻层 | 确认未来 UI / API 只展示低敏摘要。 | `metricKey`、`dashboardBucket`、`sourceSummary`、`selectedAction`、空态 / 异常态文案。 | 不实现 UI，不新增下钻 API。 |
| 审计输入层 | 确认未来审计只记录稳定短码和低敏摘要。 | `dashboard_metric_viewed`、`metric_source_missing`、`aggregation_not_ready` 等候选。 | 不改 audit enum，不写 audit repository。 |
| 未授权边界层 | 确认测试不会越界成 runtime 或 SQL。 | no SQL、no runtime、no API changes、no schema changes。 | 不运行测试，不写测试。 |

未来若进入测试实现，应优先从最小 docs-to-test 断言开始，避免在同一个 PR 中混入 schema、API、runtime、aggregation、audit 和测试。

## 5. V1 opportunity 候选测试断言

以下断言只描述未来应测试什么，不包含测试代码。

| 机会类型 | 来源完整时的候选断言 | 来源缺失时的候选断言 | 去重候选断言 | 必须等待人工确认 |
| --- | --- | --- | --- | --- |
| revisit reminder opportunity | 当治疗摘要、治疗阶段、恢复阶段、预约 / 到院或随访结果能解释复诊窗口时，可形成复诊提醒候选。 | 缺少来源、`dueDate` 或路径窗口时，应进入空态 / 异常态，不猜测生成机会。 | 同一客户 + 同一治疗摘要 / 预约 / 路径节点 + 同一时间窗口只保留一个候选。 | 是；不得自动约诊、自动触达或同步 HIS。 |
| repurchase opportunity | 当项目周期、生命周期、治疗摘要、历史服务摘要或随访反馈能解释复购窗口时，可形成复购机会候选。 | 缺少项目周期、生命周期或来源摘要时，应提示来源不完整，不把生命周期直接当成真实机会。 | 同一客户 + 同一项目周期 / 生命周期状态 + 同一复购窗口只保留一个候选。 | 是；不得把复购意向测试成成交、支付、合同或 ROI。 |
| dormant customer opportunity | 当最后预约、最后到院、最后治疗、最后随访或生命周期状态能解释沉睡阈值时，可形成沉睡客户机会候选。 | 沉睡阈值、最后互动来源或观察窗口缺失时，应进入试运行提示或异常态，不自动唤醒。 | 同一客户 + 同一沉睡阈值层级 + 同一观察窗口只保留一个候选。 | 是；不得自动外呼、自动发送消息或创建召回结果。 |

通用 opportunity 候选断言：

- 机会候选必须保留 `opportunityType`、`sourceType`、内部 `sourceId`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、时间窗口、`dashboardBucket` 和 `mockSeedDemoFlag` 的低敏口径。
- 机会候选不等于真实任务、真实预约、真实成交、真实触达或医疗建议。
- 机会候选不能因为 UI mock 存在就被视为 runtime 已实现。
- 来源缺失、字段缺失或状态异常时，应进入 empty / exception state 候选，而不是通过猜测补齐。
- 去重断言只能作为未来候选，不新增唯一索引，不写 SQL，不新增 repository。
- 三类机会都必须经过人工确认，不能被 AI、scheduler、worker 或 dashboard 指标自动执行。

## 6. manual confirm 候选测试断言

以下状态和动作只是未来测试断言候选，不是当前状态机实现，不新增 enum，不写 API，不写测试代码。

| 状态 / 结果候选 | 未来应测试的断言 | 不应测试成 |
| --- | --- | --- |
| `pending_confirmation` | 机会进入人工处理范围后，应可被看作待确认对象，并保留来源摘要、建议动作和低敏说明。 | 自动确认、自动触达、已完成。 |
| `confirmed` | 内部人员显式确认后，应形成确认结果候选，并记录状态前后和操作者角色候选。 | 真实预约、真实成交、客户已联系。 |
| `converted_to_followup_tasks` | 人工确认后转为内部随访任务的指标候选，应说明内部随访任务不等于外部消息发送。 | 微信 / 企微 / 短信 / 电话已发送。 |
| `converted_to_internal_follow` | 人工确认后进入内部运营跟进的结果候选，应与内部随访任务语义区分。 | 自动营销、外部触达、真实成交跟进。 |
| `converted_to_appointment_intents` | 人工确认后形成预约意向候选，应明确只是内部方向。 | 真实预约、占号、HIS 同步。 |
| `converted_to_repurchase_intents` | 人工确认后形成复购意向候选，应明确只是内部复购方向。 | 成交金额、支付、合同、ROI。 |
| `wake_observation` | 沉睡客户机会进入内部唤醒观察候选，应保留阈值和试运行说明。 | 自动唤醒、自动外呼、外部消息发送。 |
| `dismissed` | 人工忽略后，应可作为已忽略机会候选，并保留低敏原因候选。 | 客户拒绝、医疗结论、无痕删除。 |
| `expired` | 处理窗口已过、来源失效或不再适用时，可作为已过期机会候选。 | 当前自动过期 runtime、scheduler、worker。 |
| `stale` / already handled / invalid transition | 当对象已被处理、状态过期或流转无效时，应进入异常态候选。 | 临时覆盖状态、绕过人工确认、静默成功。 |

manual confirm 测试边界：

- 当前不实现状态机。
- 当前不新增 enum。
- 当前不写 API。
- 当前不写测试代码。
- 当前不新增 queue、worker、scheduler 或自动过期逻辑。
- 未来断言必须确认人工确认备注、状态前后、选中动作和审计摘要都遵守字段白名单。
- 未来断言必须确认无效流转不会产生外部动作或真实业务结果。

## 7. dashboard metrics 候选测试断言

以下 candidate metrics 只作为未来测试断言候选，不代表指标已实现，不代表真实经营统计，不授权 SQL，不授权 dashboard aggregation runtime，不授权 dashboard API，不授权 metric snapshot。

| candidate metric | 未来应测试的候选断言 | 必须避免的误读 |
| --- | --- | --- |
| `pending_total_opportunities` | 只统计进入人工处理范围的三类待处理机会候选。 | 不代表自动营销池、真实触达或成交机会。 |
| `pending_revisit_reminders` | 只统计待人工处理的复诊提醒候选。 | 不代表真实预约、HIS 同步或医疗判断。 |
| `pending_repurchase_opportunities` | 只统计待确认复购机会候选。 | 不代表成交预测、成交金额或支付结果。 |
| `pending_dormant_opportunities` | 只统计待处理沉睡客户机会候选。 | 不代表客户已被唤醒、已外呼或已触达。 |
| `confirmed_opportunities` | 只统计人工确认后的机会结果候选。 | 不代表处理完成、真实预约或真实成交。 |
| `converted_to_followup_tasks` | 只统计转内部随访任务候选。 | 不代表外部消息已发送。 |
| `converted_to_internal_follow` | 只统计转内部运营跟进候选。 | 不代表自动营销或客户已联系。 |
| `converted_to_appointment_intents` | 只统计内部预约意向候选。 | 不代表真实预约、占号或 HIS 同步。 |
| `converted_to_repurchase_intents` | 只统计内部复购意向候选。 | 不代表成交、支付、合同或 ROI。 |
| `wake_observation` | 只统计进入内部唤醒观察候选。 | 不代表自动唤醒、外呼或外部消息。 |
| `dismissed_opportunities` | 只统计人工忽略机会候选。 | 不代表客户拒绝或医疗结论。 |
| `expired_opportunities` | 只统计处理窗口已过或来源失效的机会候选。 | 不代表当前已实现自动过期。 |
| `exception_metrics` | 只统计来源缺失、聚合未 ready、状态异常或低敏下钻不可用等异常指标候选。 | 不暴露 SQL、stack、raw payload 或外部错误全文。 |

dashboard metrics 通用候选断言：

- 指标必须带中文指标名、`metricKey`、`dashboardBucket`、`count` 候选、空态 / 异常态文案和 `mockSeedDemoFlag`。
- 指标必须明确 mock / seed / demo 不代表真实生产数据。
- 指标不能直接触发外部动作。
- 指标下钻不能返回高敏客户列表。
- 指标不可把 UI mock 数值当作真实统计样本。

## 8. dashboard aggregation 候选测试断言

以下 dashboard aggregation 断言只描述未来口径，不写 aggregation query，不新增 `dashboard_metric_snapshots`，不新增 repository / service，不实现 scheduler / worker / cron。

| 聚合主题 | 未来应测试的候选断言 | 当前边界 |
| --- | --- | --- |
| current window | 当前仍处于待人工处理或异常提示范围的候选机会可进入当前窗口指标。 | 不写实时 SQL，不代表生产 BI。 |
| trial window | 试运行复盘指标必须带试运行说明和 mock / seed / demo 标记。 | 不锁定最终统计周期。 |
| daily window | 今日复诊提醒或今日待处理入口可作为未来断言候选。 | 当前不实现日期计算或时区算法。 |
| weekly window | 本周复诊提醒、沉睡观察或复购窗口可作为未来断言候选。 | 周起始日、节假日规则后续确认。 |
| configurable window | 沉睡阈值、复购窗口、历史复盘可作为未来配置窗口候选。 | 当前不做配置表、查询参数或 schema。 |
| expired / overdue window | 已过期机会或逾期未处理机会可作为未来断言候选。 | 当前不实现自动过期、scheduler、worker 或 cron。 |
| deduplication candidate | 同一客户 + 同一机会类型 + 同一来源 + 同一窗口下应有去重候选。 | 不新增唯一索引，不写 SQL。 |
| metric source missing | 来源缺失时应进入异常指标候选或空态提示。 | 不猜测来源，不读取 raw payload。 |
| aggregation not ready | 聚合口径未 ready 时应提示不可用。 | 不暴露 SQL、聚合函数、stack 或 DB URL。 |
| partial source unavailable | 部分来源不可用时应展示低敏异常说明。 | 不展示请求 / 响应正文或外部错误全文。 |
| dashboard aggregation unavailable | dashboard aggregation 不可用时应回退为空态 / 异常态。 | 不回退到高敏明细或完整客户导出。 |

未来 dashboard aggregation 测试不得把 dashboard 指标实现、SQL、metric snapshot、API、repository、service、scheduler 或 worker 混在同一个 PR 中。

## 9. low-sensitive drilldown 候选测试断言

未来低敏下钻只能返回低敏摘要或确认对象摘要。当前不定义真实 DTO，不实现 API，不实现下钻 runtime。

允许字段候选：

| 字段候选 | 未来断言 |
| --- | --- |
| `metricKey` | 可标识指标来源，但不能暴露 SQL 或查询条件。 |
| `dashboardBucket` | 可说明指标桶，不代表完整 BI 分类。 |
| `opportunityType` | 可说明复诊、复购或沉睡机会类型。 |
| `sourceType` | 可说明内部来源类型，不暴露外部系统详情。 |
| `sourceSummary` | 只能由白名单字段生成，不能截取 raw payload。 |
| `triggerReason` | 只能说明低敏触发原因。 |
| `suggestedAction` | 只能说明内部建议动作，不自动执行。 |
| `priority` | 必须可解释，不能是黑箱评分。 |
| `dueDate window` | 只展示时间窗口或低敏日期口径。 |
| `statusBefore` / `statusAfter` | 只展示状态短码或低敏说明。 |
| `selectedAction` | 只展示内部人员选择的动作候选。 |
| `operatorRole` | 只展示角色，不展示个人高敏信息。 |
| `mockSeedDemoFlag` | 必须标记 mock / seed / demo 来源。 |
| `empty / exception copy` | 可展示稳定空态 / 异常态文案。 |

禁止字段候选：

- 完整手机号。
- 完整联系方式。
- 身份证号。
- 完整病历号。
- 地址。
- 完整病历正文。
- 诊断正文。
- 治疗原文。
- 咨询记录全文。
- 外部消息原文。
- 成交金额。
- 销售额。
- ROI。
- 支付 / 合同 / 发票 / 回款数据。
- HIS credential。
- API Key / Token / OAuth secret / Webhook secret。
- 数据库连接串。
- HIS raw payload。
- 外部系统请求 / 响应正文。
- SQL。
- stack。
- DB URL。
- AI prompt / completion 全文。

未来测试应断言低敏下钻不可用时显示空态 / 异常态，不允许为了可用性退回完整客户明细、完整 BI 导出或高敏字段。

## 10. field whitelist 候选测试断言

field whitelist 相关断言必须优先验证“只输出允许字段”和“禁止字段不出现”。当前不新增 parser、sanitizer、mask、redact 或 enforcement 代码。

| 对象 | 允许断言候选 | 禁止断言候选 |
| --- | --- | --- |
| opportunity 卡片 | 低敏客户展示名、机会类型、来源摘要、触发原因、建议动作、优先级、时间窗口、mock / seed / demo 标记。 | 完整联系方式、完整病历、成交金额、HIS raw payload、外部消息原文。 |
| manual confirm 卡片 | 确认对象类型、内部对象 ID、状态前后、选中动作、操作者角色、低敏备注摘要。 | 备注全文、高敏客户信息、真实预约号、外部触达内容。 |
| dashboard 指标卡 | `metricKey`、中文指标名、`count` 候选、`dashboardBucket`、空态 / 异常态文案、`mockSeedDemoFlag`。 | 客户完整列表、SQL、BI 明细、销售额、ROI。 |
| low-sensitive drilldown | 指标、桶、机会摘要、确认对象摘要、低敏来源引用。 | 完整客户明细、完整联系方式、完整病历、外部系统原文。 |
| audit input | resource、action、reason、result、状态前后、低敏摘要、mock / seed / demo 标记。 | metadata、request body、response body、token、secret、raw payload、stack。 |
| empty / exception copy | 稳定文案、低敏原因、不可用说明。 | 外部错误全文、SQL、DB URL、credential。 |

未来 field whitelist 测试应覆盖：

- 白名单字段存在时可被低敏展示。
- 禁止字段即使存在于上游来源，也不得进入 dashboard、drilldown、audit input 或错误响应。
- `sourceSummary` 和 `lowSensitiveNote` 不能从高敏文本直接截取。
- mock / seed / demo 数据必须显式标记，不能冒充生产数据。
- 字段白名单违规如果进入审计候选，只能记录违规字段类别和边界类型，不能记录违规原文。

## 11. empty state / exception state 候选测试断言

未来空态 / 异常态断言必须与 dashboard empty state copy 和 dashboard aggregation plan 保持一致。当前不实现 UI、不实现数据校验、不写 runtime。

| 场景 | 未来应测试的候选断言 | 禁止断言 |
| --- | --- | --- |
| 无候选机会 | 显示“暂无待处理机会”或等价稳定空态。 | 不写成历史任务全部完成。 |
| 指标来源缺失 | 显示来源不完整，仅作内部参考。 | 不暴露 raw payload、外部错误全文、HIS raw ID。 |
| 部分来源不可用 | 显示部分来源暂不可用，仅展示低敏内部参考。 | 不暴露 SQL、stack、请求体、响应体。 |
| 聚合未 ready | 显示看板聚合口径尚未 ready。 | 不暴露聚合函数、DB URL、SQL。 |
| dashboard aggregation 不可用 | 指标显示异常态或空态，不回退到高敏明细。 | 不展示服务端堆栈或外部错误全文。 |
| dueDate 缺失 | 不计入日窗口 / 周窗口 / 逾期指标，并提示缺少处理日期。 | 不猜测日期，不读取外部日程 payload。 |
| priority 缺失 | 不计入高优先级指标，并提示缺少优先级。 | 不生成黑箱 AI 分数。 |
| 沉睡阈值未确认 | 显示试运行口径或待确认说明。 | 不自动唤醒，不外呼。 |
| 状态异常 | 暂不计入正式指标，进入 `exception_metrics` 候选。 | 不新增 enum，不写状态机。 |
| 低敏下钻不可用 | 下钻入口禁用或展示低敏空态。 | 不导出完整客户列表。 |

未来测试断言应确认异常态本身也遵守字段白名单，不能因为调试需要暴露 SQL、stack、raw payload、credential、token 或外部错误全文。

## 12. audit input / audit event naming 候选测试断言

以下 audit input / audit event naming 只作为未来候选断言，不新增 audit enum，不新增 audit metadata，不实现 audit runtime，不修改 audit repository，不写 audit 测试代码。

| 候选名称 | 类型 | 未来应测试的候选断言 | 禁止内容 |
| --- | --- | --- | --- |
| `dashboard_metric_viewed` | action candidate | 内部人员查看指标卡时，可形成低敏审计动作候选。 | 客户完整明细、SQL。 |
| `dashboard_drilldown_viewed` | action candidate | 内部人员查看低敏下钻时，可形成低敏审计动作候选。 | 完整客户列表、手机号、病历正文。 |
| `dashboard_metric_source_unavailable` | action candidate | 指标来源缺失或不可用时，可形成不可用审计候选。 | raw source、外部错误全文。 |
| `dashboard_aggregation_unavailable` | action candidate | 聚合未 ready 或不可用时，可形成不可用审计候选。 | SQL、stack、DB URL。 |
| `metric_window_current` | reason candidate | 当前窗口指标可记录稳定窗口短码候选。 | 中文长文、自由 metadata。 |
| `metric_window_trial` | reason candidate | 试运行窗口指标可记录稳定窗口短码候选。 | 生产统计口径误导。 |
| `metric_source_missing` | reason candidate | 来源缺失时可记录稳定原因短码候选。 | raw payload、HIS raw ID。 |
| `aggregation_not_ready` | reason candidate | 聚合口径未 ready 时可记录稳定原因短码候选。 | SQL、stack。 |
| `drilldown_low_sensitive` | reason candidate | 下钻仅低敏摘要时可记录稳定原因短码候选。 | 高敏明细或完整 BI 导出。 |

未来 audit input 应只允许：

- resource candidate。
- action candidate。
- reason candidate。
- result candidate。
- 内部 resource ID。
- `metricKey`、`dashboardBucket`、`opportunityType`、`sourceType`。
- `statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`。
- `lowSensitiveSummary`。
- `mockSeedDemoFlag`。

未来 audit input 不得记录 metadata、request body、response body、SQL、stack、token、secret、credential、HIS raw payload、外部错误全文、完整联系方式、完整病历或 AI prompt / completion 全文。

## 13. schema / API / runtime 未授权边界断言

未来测试计划或测试实现前，必须先断言以下边界仍未授权：

| 边界 | 候选断言 | 当前结论 |
| --- | --- | --- |
| schema | 不新增 `opportunities`、`manual_confirmations`、`dashboard_metric_snapshots` 等表，不扩 enum。 | 未授权。 |
| migration | 不执行 migration，不新增 migration 文件。 | 未授权。 |
| SQL | 不写 aggregation query，不写报表 SQL，不写唯一索引 SQL。 | 未授权。 |
| API | 不新增 opportunity、manual confirmation、dashboard metrics、drilldown 或 audit API。 | 未授权。 |
| service / repository / DTO | 不新增业务 service、repository、DTO、query parser 或 mutation handler。 | 未授权。 |
| dashboard aggregation runtime | 不实现聚合运行时、缓存、snapshot、scheduler、worker 或 cron。 | 未授权。 |
| audit runtime | 不新增 audit enum、metadata、repository 写入或 runtime guard。 | 未授权。 |
| field whitelist enforcement | 不新增 parser、sanitizer、mask、redact 或 runtime guard。 | 未授权。 |
| tests | 不新增测试文件，不运行 test / lint / typecheck。 | 本任务未授权。 |
| external system | 不连接真实 HIS、真实 credential、外部系统或真实客户数据。 | 未授权。 |

如果后续 PR 中出现上述任何实现，应视为超出本测试计划边界，必须停止并重新确认授权。

## 14. 反模式测试清单

以下反模式必须在后续测试计划或测试实现评审中主动避免：

| 反模式 | 风险 |
| --- | --- |
| 把 UI mock 数值当真实测试样本。 | 会把 demo / seed / mock 误读为生产数据和真实统计。 |
| 把 HIS runtime 当 1.0 主线测试前置。 | 会偏离客户运营中台主线，让真实 HIS 阻塞 1.0。 |
| 把机会候选直接测试成真实任务 / 预约 / 成交。 | 会绕过人工确认，并误导为业务动作已发生。 |
| 把复购意向测试成成交金额或 ROI。 | 会混淆内部意向与真实经营结果。 |
| 把预约意向测试成真实预约或 HIS 同步。 | 会误导为已占号、已同步或已创建预约。 |
| 把唤醒观察测试成自动外呼或自动触达。 | 会违反不自动营销、不自动触达边界。 |
| 在一个 PR 里同时写 schema、API、runtime、aggregation、audit 和测试。 | 难以审查、难以回滚，放大隐私和状态风险。 |
| 在测试断言里要求完整客户明细、完整联系方式或高敏字段。 | 会突破字段白名单和低敏下钻边界。 |
| 在异常测试里断言 SQL、stack、raw payload 或外部错误全文。 | 会把调试信息变成高敏输出契约。 |
| 直接新增 dashboard_metric_snapshots 测试。 | 会默认授权未批准的指标快照和 BI 化方向。 |

其他不推荐方向：

- 把 `customers.lifecycle` 直接测试成 opportunity runtime。
- 把 `follow_up_tasks` 全部测试成机会对象。
- 把 audit input 测试成自由 metadata。
- 把字段白名单测试写成 DTO 或 schema 实现。
- 把 no checks reported 理解为测试已通过。

## 15. 后续测试 PR 建议顺序

以下只是建议顺序，不构成开发许可：

1. V1-FIELD-WHITELIST-TEST-PLAN-01：docs-only / test-plan-only，细化低敏字段、禁止字段、审计输入和异常响应的未来测试矩阵。
2. V1-AUDIT-TEST-PLAN-01：docs-only / test-plan-only，细化 V1 opportunity、manual confirm、dashboard metrics 和权限 / tenant 的审计候选断言。
3. V1-DASHBOARD-AGGREGATION-TEST-PLAN-01：docs-only / test-plan-only，拆分指标、窗口、去重、来源缺失、聚合未 ready 和异常态的候选测试矩阵。
4. V1-UI-MOCK-ASSERTION-PLAN-01：docs-only / UI-mock-plan-only，梳理现有 UI mock 的可审查展示断言，不写测试代码。
5. V1-TEST-IMPLEMENT-LATER-01：仅在后续明确批准后，选择最小 test-only 范围实现测试，不夹带 runtime。
6. V1-RUNTIME-MINIMAL-SLICE-PLAN-01：plan-only，在进入任何 runtime 前单独定义 feature flag、rollback、tenant / RBAC、字段白名单和审计输入边界。

任何 schema、migration、SQL、API、route、service、repository、DTO、dashboard aggregation runtime、audit runtime、audit enum、audit metadata、runner、scheduler、queue、worker、HIS、credential、真实外部系统、自动触达、真实预约、真实成交、支付 / 合同 / 发票、生产配置都必须单独确认。

## 16. 本文档边界

本文档只新增 V1 主链路测试计划细化，边界如下：

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

本文档中的候选断言、后续测试 PR 建议和未来实现顺序都不是开发许可。未来进入测试实现、runtime、schema、API、SQL、dashboard aggregation、audit 或字段白名单 enforcement 前，必须由用户在新的当前任务中明确批准，并重新执行项目治理启动检查。

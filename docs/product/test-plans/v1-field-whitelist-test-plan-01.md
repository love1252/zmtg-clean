# V1 字段白名单测试计划 01

## 1. 背景与结论摘要

- 任务编号：V1-FIELD-WHITELIST-TEST-PLAN-01。
- 日期与时区：2026-06-09 CST +0800，日期来自本地命令 `date "+%Y-%m-%d"`，时区来自本地命令 `date "+%Z %z"`。
- 当前分支：`docs/v1-field-whitelist-test-plan-01`。
- 启动基线：创建任务分支前 `HEAD`、`main` 与 `origin/main` 均为 `34076b9204c929cb62e4a233e13889af03db77a0`。
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
- no field whitelist enforcement runtime：不实现字段白名单 enforcement runtime。
- no dashboard aggregation runtime：不实现 dashboard aggregation 运行时。
- no audit runtime：不实现 audit 运行时。
- no external integration：不接外部系统。
- no real customer data：不处理真实客户数据。

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，V1 主链路是治疗后客户运营闭环。HIS 只是数据来源之一，不是 1.0 主线，不阻塞 1.0。

本计划只把 dashboard metrics、low-sensitive drilldown、opportunity candidate、manual confirm、audit input、empty / exception copy、tenant / RBAC / feature flag 的字段边界拆成未来测试矩阵。当前仍不能进入 runtime；当前不写测试代码、不实现 runtime、不写 SQL、不改 API / schema。

核心结论：

- 本文档中的字段和断言只是 future allowed field candidate / future forbidden field candidate 的测试规划，不代表 DTO 已实现，不代表 API 已实现，不代表 runtime 已实现。
- 本文档不授权 parser / sanitizer / mask / redact，不授权字段白名单 enforcement 代码。
- UI mock、seed、demo 事实只用于确认低敏展示方向，不能作为真实 DTO 契约、真实测试样本或 runtime 来源。
- 未来测试必须优先断言禁止字段不会出现在 dashboard card、drilldown、opportunity、manual confirm、audit input、empty / exception copy 中。

## 2. 测试计划适用范围

| 适用对象 | 未来测试目的 | 依据 |
| --- | --- | --- |
| dashboard metrics | 验证指标卡只展示聚合 key、桶、低敏说明、空态 / 异常态文案和 demo 标记。 | dashboard metrics contract、dashboard aggregation plan、dashboard aggregation test plan。 |
| low-sensitive drilldown | 验证下钻只返回低敏摘要，不返回完整客户明细、高敏字段或完整 BI。 | field whitelist contract、field whitelist enforcement plan、API boundary plan。 |
| opportunity candidate | 验证复诊提醒、复购机会、沉睡客户机会只携带来源摘要、触发原因、建议动作、优先级和窗口。 | opportunity contract、UI mock 事实、runtime minimal slice plan。 |
| manual confirm | 验证人工确认结果只表达内部状态、选择动作、操作者角色和低敏结果码。 | manual confirm contract、audit coverage matrix。 |
| audit input | 验证未来审计输入只使用 resource / action / reason / result candidate 与低敏摘要。 | audit coverage matrix、audit event naming plan。 |
| empty / exception copy | 验证空态、异常态、权限失败、feature flag disabled 和字段违规失败只展示低敏文案。 | dashboard empty state copy、dashboard aggregation test plan。 |
| tenant / RBAC / feature flag | 验证默认关闭、按 tenant 开启、权限失败、下钻禁用和 rollback 后的字段边界。 | runtime minimal slice plan、API boundary plan。 |

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
- 不新增 parser、sanitizer、mask、redact 或 guard。
- 不新增 audit metadata 或 audit enum。
- 不连接真实 HIS，不读取真实 credential，不连接外部系统。
- 不处理真实客户数据，不发送外部消息，不创建真实任务 / 预约 / 成交。
- 不把 UI mock 字段当成真实 DTO 契约。
- 不把本测试计划当作后续开发许可。

## 4. 字段白名单测试分层总览

| 测试层级 | 未来测试目的 | 可断言内容 | 当前不做 |
| --- | --- | --- | --- |
| 产品事实层 | 确认字段边界仍服务客户运营中台主线。 | 智美天工不是 HIS；HIS 只是来源；1.0 主线是治疗后客户运营闭环。 | 不改产品事实源。 |
| 全局字段层 | 区分 future allowed field candidate 与 forbidden field candidate。 | 允许字段总表、禁止字段总表、对象级收窄。 | 不写 enforcement。 |
| dashboard 字段层 | 确认指标卡与指标桶不含高敏明细。 | `metricKey`、`dashboardBucket`、count、empty / exception copy。 | 不写 dashboard API。 |
| drilldown 字段层 | 确认低敏下钻不升级为客户完整列表。 | `sourceSummary`、`triggerReason`、`lowSensitiveSummary`。 | 不定义真实 DTO。 |
| opportunity 字段层 | 确认三类机会只表达内部候选，不表示真实任务、预约或成交。 | `opportunityType`、`sourceType`、`suggestedAction`、`priority`、`dueDate window`。 | 不实现 opportunity runtime。 |
| manual confirm 字段层 | 确认人工确认结果只表达内部状态流向。 | `statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`。 | 不实现状态机。 |
| audit input 字段层 | 确认审计输入只保留低敏动作语义。 | resource / action / reason / result candidate。 | 不新增 audit enum / metadata。 |
| 空态 / 异常态层 | 确认失败路径不泄漏 SQL、stack、raw payload 或高敏字段。 | reason code、result code、fallback copy。 | 不实现异常处理代码。 |
| 未授权边界层 | 确认测试计划不膨胀为 runtime。 | no runtime、no SQL、no API、no schema、no test implementation。 | 不运行测试。 |

## 5. 允许字段总表

以下字段只是 future allowed field candidate。它们不代表 DTO 已实现，不代表 API 已实现，不代表 runtime 已实现，不授权 parser / sanitizer / mask / redact，不授权字段白名单 enforcement 代码。

| 允许字段候选 | 未来允许位置 | 未来测试断言候选 | 当前边界 |
| --- | --- | --- | --- |
| `metricKey` | dashboard card、audit input。 | 只表达稳定指标 key，不夹带对象明细。 | 不新增 enum。 |
| `dashboardBucket` | dashboard card、opportunity candidate、audit input。 | 只表达聚合桶，不代表真实 aggregation 已实现。 | 不写 SQL。 |
| `opportunityType` | opportunity、manual confirm、drilldown、audit input。 | 限复诊提醒、复购机会、沉睡客户机会等低敏类型。 | 不实现 opportunity runtime。 |
| `sourceType` | opportunity、manual confirm、audit input。 | 只能是低敏来源类型，如治疗摘要、预约、随访、生命周期、dashboard metric。 | 不透传 raw source。 |
| `sourceSummary` | opportunity、manual confirm、drilldown、audit input。 | 必须是低敏摘要，不得包含原文、raw payload 或完整病历。 | 不实现生成器。 |
| `triggerReason` | opportunity、dashboard、audit input。 | 使用短语说明复诊窗口、复购窗口、沉睡观察等原因。 | 不写决策模型。 |
| `suggestedAction` | opportunity、manual confirm。 | 只表达内部建议，不表示自动外联或医疗决策。 | 不触发外部动作。 |
| `priority` | opportunity、manual confirm、dashboard drilldown。 | 高 / 中 / 低优先级必须有低敏解释。 | 不实现排序算法。 |
| `dueDate window` | opportunity、dashboard、empty / exception copy。 | 使用日期窗口或处理窗口，不写完整行程隐私。 | 不写日期计算。 |
| `statusBefore` | manual confirm、audit input。 | 只表达状态变化前的低敏状态。 | 不新增状态机。 |
| `statusAfter` | manual confirm、audit input。 | 只表达状态变化后的低敏状态。 | 不新增 enum。 |
| `selectedAction` | manual confirm、audit input。 | 必须来自内部人员选择，不由 AI 自动决定。 | 不执行动作。 |
| `operatorRole` | manual confirm、audit input。 | 只写角色，不暴露员工个人隐私。 | 不写权限模型。 |
| `mockSeedDemoFlag` | mock / seed / demo UI、dashboard、audit input。 | 必须显式标记演示来源，不冒充生产数据。 | 不新增 mock data。 |
| `empty / exception copy` | dashboard、drilldown、opportunity、manual confirm。 | 只展示低敏空态或异常态文案。 | 不实现 UI runtime。 |
| `lowSensitiveSummary` | drilldown、manual confirm、audit input。 | 只保留低敏摘要，不承载完整备注。 | 不实现 sanitizer。 |
| `reason code` | empty / exception copy、audit input、字段违规失败。 | 使用稳定短码或中文短语，不回显原文。 | 不新增 enum。 |
| `result code` | manual confirm、audit input、字段违规失败。 | 表达成功、skipped、blocked、unavailable 等低敏结果。 | 不新增 enum。 |
| `resource candidate` | audit input。 | 表达候选资源类型，如 dashboard metric、drilldown、opportunity、manual confirmation。 | 不新增 audit resource。 |
| `action candidate` | audit input。 | 表达候选动作，如 viewed、blocked、skipped、confirmed。 | 不新增 audit action。 |
| `reason candidate` | audit input。 | 表达低敏原因，如 source missing、permission denied、aggregation not ready。 | 不新增 audit reason。 |
| `result candidate` | audit input。 | 表达低敏结果，如 success、blocked、skipped、unavailable。 | 不新增 audit result。 |

## 6. 禁止字段总表

未来测试应断言以下字段不得出现在 dashboard card、drilldown、opportunity、manual confirm、audit input、empty / exception copy 中。当前不写测试代码，不新增 sanitizer，不新增 mask / redact，不处理真实客户数据。

| 禁止字段候选 | 禁止位置 | 未来失败期望 |
| --- | --- | --- |
| 完整手机号 | 全部展示、DTO、audit、copy。 | 阻断输出或返回低敏异常态。 |
| 完整联系方式 | 全部展示、DTO、audit、copy。 | 不回显，不降级为客户列表。 |
| 身份证号 | 全部展示、DTO、audit、copy。 | 只记录字段类别或 reason code。 |
| 完整病历号 | 全部展示、DTO、audit、copy。 | 不展示原文。 |
| 地址 | dashboard、drilldown、opportunity、manual confirm。 | 不进入低敏对象。 |
| 完整病历正文 | opportunity、manual confirm、audit input、exception copy。 | 阻断并只给低敏失败。 |
| 诊断正文 | opportunity、manual confirm、audit input。 | 不展示、不写 audit raw。 |
| 治疗原文 | opportunity、manual confirm、audit input。 | 只允许治疗阶段或摘要候选。 |
| 咨询记录全文 | opportunity、manual confirm、audit input。 | 不透传全文。 |
| 外部消息原文 | manual confirm、opportunity、audit input。 | 不记录、不触发外部动作。 |
| 成交金额 | dashboard、repurchase、manual confirm。 | 不展示销售或成交口径。 |
| 销售额 | dashboard、repurchase、manual confirm。 | 不作为指标或下钻字段。 |
| ROI | dashboard、repurchase、manual confirm。 | 不进入 V1 运营看板。 |
| 支付数据 | dashboard、opportunity、manual confirm。 | 不展示、不写 audit。 |
| 合同数据 | dashboard、opportunity、manual confirm。 | 不展示、不写 audit。 |
| 发票数据 | dashboard、opportunity、manual confirm。 | 不展示、不写 audit。 |
| 回款数据 | dashboard、opportunity、manual confirm。 | 不展示、不写 audit。 |
| HIS credential | 全部位置。 | 阻断并不记录原文。 |
| API Key | 全部位置。 | 阻断并不记录原文。 |
| Token | 全部位置。 | 阻断并不记录原文。 |
| OAuth secret | 全部位置。 | 阻断并不记录原文。 |
| Webhook secret | 全部位置。 | 阻断并不记录原文。 |
| 数据库连接串 | 全部位置。 | 不展示 DB URL。 |
| HIS raw payload | 全部位置。 | 不透传 raw source。 |
| 外部系统请求正文 | audit input、exception copy、error response。 | 不写 request body。 |
| 外部系统响应正文 | audit input、exception copy、error response。 | 不写 response body。 |
| 外部错误全文 | exception copy、audit input。 | 只写稳定错误码或低敏文案。 |
| SQL | exception copy、audit input、error response。 | 不展示查询或片段。 |
| stack | exception copy、audit input、error response。 | 不展示堆栈。 |
| DB URL | exception copy、audit input、error response。 | 不展示连接信息。 |
| AI prompt 全文 | opportunity、manual confirm、audit input。 | 不保存模型原始输入。 |
| AI completion 全文 | opportunity、manual confirm、audit input。 | 不保存模型原始输出。 |
| metadata 自由字段 | audit input、DTO、dashboard。 | 不接受任意 JSON metadata。 |
| request body | audit input、exception copy、error response。 | 不记录请求体。 |
| response body | audit input、exception copy、error response。 | 不记录响应体。 |

## 7. dashboard metrics 字段测试矩阵

以下 candidate metrics 只是未来测试断言候选，不代表 dashboard API 已实现，不代表 dashboard aggregation runtime 已实现，不授权 SQL、metric snapshot、service、repository 或 DTO。dashboard metrics 不得返回完整客户列表，不得返回成交金额、销售额、ROI，不得返回 SQL、stack、raw payload。

| candidate metric | 允许字段候选 | 禁止字段候选 | 字段缺失时的期望 | 字段违规时的期望 | feature flag disabled 时的字段期望 | tenant / RBAC 不满足时的字段期望 | rollback 后的字段期望 | audit input 字段候选 | empty / exception copy 字段候选 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pending_total_opportunities` | `metricKey`、`dashboardBucket`、`opportunityType`、`sourceType`、`mockSeedDemoFlag`。 | 完整客户列表、完整联系方式、成交金额、SQL、stack、HIS raw payload。 | 缺来源时标记 `metric_source_missing`，不猜测对象。 | 阻断指标输出或进入低敏异常态。 | 不返回真实候选字段，只保留能力未开启或 mock-only copy。 | 返回 permission denied / tenant mismatch 低敏文案，不返回对象存在性细节。 | 仅保留空态、mock-only、只读文案字段。 | resource=dashboard metric，action=viewed，reason=current window，result=success/skipped。 | “暂无待处理机会”或“指标来源不完整”。 |
| `pending_revisit_reminders` | `metricKey`、`dashboardBucket`、`opportunityType`、`sourceSummary`、`dueDate window`、`priority`。 | 完整病历、诊断正文、真实预约号、HIS raw payload、完整联系方式。 | 缺 `dueDate window` 时不计入时间窗口。 | 不展示违规字段原文。 | 显示复诊提醒能力未开启或空态。 | 无权限时不返回复诊下钻字段。 | 回退复诊空态 / mock-only 文案。 | reason=metric_window_current / metric_source_missing。 | “暂无待处理复诊提醒”。 |
| `pending_repurchase_opportunities` | `metricKey`、`dashboardBucket`、`opportunityType`、`sourceSummary`、`triggerReason`、`priority`。 | 成交金额、销售额、ROI、支付、合同、发票、回款。 | 缺项目周期或生命周期来源时提示来源不完整。 | 阻断并只记录字段类别。 | 不返回真实复购候选字段。 | 无复购权限时不返回复购对象列表。 | 不触发营销，仅保留空态。 | reason=metric_window_trial / source missing。 | “暂无待确认复购机会”。 |
| `pending_dormant_opportunities` | `metricKey`、`dashboardBucket`、`opportunityType`、`sourceSummary`、`triggerReason`、`dueDate window`。 | 完整联系方式、地址、外呼内容、外部消息原文、自动唤醒记录。 | 缺沉睡阈值或最后互动来源时进入异常态。 | 不降级为沉睡客户完整列表。 | 不返回真实沉睡候选字段。 | tenant mismatch 时不暴露其他租户对象。 | 保留沉睡空态或试运行说明。 | reason=metric_window_trial / aggregation_not_ready。 | “沉睡阈值为试运行口径”。 |
| `confirmed_opportunities` | `metricKey`、`dashboardBucket`、`statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`。 | 完整备注、客户完整联系方式、医疗结论、成交结果。 | 缺确认来源时不计入正式确认口径。 | 阻断输出，保留低敏失败。 | 指标不可用，仅显示只读文案。 | 无确认权限时不返回确认明细。 | 回退为 UI mock / 空态。 | action=manual confirmation result viewed，result=success/skipped。 | “确认结果聚合未 ready”。 |
| `converted_to_followup_tasks` | `metricKey`、`dashboardBucket`、`selectedAction`、`statusAfter`、`sourceSummary`。 | 外部消息正文、电话录音、微信 / 企微原文、完整联系方式。 | 缺内部任务来源时不重复计入。 | 不创建真实任务，不回显原文。 | 不返回真实任务候选字段。 | 只读看板权限不得返回可执行动作字段。 | 停用真实候选，只保留空态。 | reason=converted_to_followup candidate。 | “暂无机会转为内部随访任务”。 |
| `converted_to_internal_follow` | `metricKey`、`dashboardBucket`、`selectedAction`、`operatorRole`、`lowSensitiveSummary`。 | 促销话术全文、自动营销记录、客户沟通全文。 | 命名未 ready 时阻断或进入异常态。 | 不触发外部系统补偿。 | 不显示真实内部跟进候选字段。 | 无权限时不返回内部跟进对象。 | 回退为空态，不触发外部动作。 | reason=internal_follow candidate。 | “内部跟进口径尚未 ready”。 |
| `converted_to_appointment_intents` | `metricKey`、`dashboardBucket`、`selectedAction`、`statusAfter`、`sourceSummary`。 | 真实预约号、占号信息、HIS appointment payload。 | 缺预约意向来源时不计入。 | 不创建真实预约，不同步 HIS。 | 显示暂无预约意向或能力未开启。 | 无权限不可下钻预约意向。 | 停用下钻与指标。 | reason=appointment_intent candidate。 | “暂无机会转为预约意向”。 |
| `converted_to_repurchase_intents` | `metricKey`、`dashboardBucket`、`opportunityType`、`selectedAction`、`priority`。 | 成交金额、销售额、ROI、支付、合同、发票、回款。 | 来源缺失时提示不代表真实复购。 | 阻断成交类字段。 | 不显示真实复购意向候选。 | 无权限不可查看复购意向明细。 | 回退空态，不创建成交。 | reason=repurchase_intent candidate。 | “暂无机会形成复购意向”。 |
| `wake_observation` | `metricKey`、`dashboardBucket`、`opportunityType`、`triggerReason`、`dueDate window`。 | 外呼内容、完整联系方式、外部消息原文、自动唤醒记录。 | 阈值或最后互动缺失时进入异常态。 | 不自动唤醒，不回显违规字段。 | 不展示唤醒观察真实候选。 | 无权限不可下钻沉睡观察。 | 停用观察候选。 | reason=wake_observation candidate。 | “沉睡客户观察口径待确认”。 |
| `dismissed_opportunities` | `metricKey`、`dashboardBucket`、`statusBefore`、`statusAfter`、`reason code`。 | 完整备注、客户拒绝原话、个人隐私。 | 缺忽略原因时只记录低敏 result code。 | 不暴露原文，只保留原因类别。 | 不显示真实忽略统计。 | 无权限不显示忽略原因。 | 保留人工可解释空态。 | reason=opportunity_dismissed candidate。 | “暂无已忽略机会”。 |
| `expired_opportunities` | `metricKey`、`dashboardBucket`、`statusBefore`、`statusAfter`、`dueDate window`。 | scheduler 日志、SQL、stack、外部错误全文。 | 来源失效时提示 `source_expired`。 | 不执行 migration rollback 或脚本。 | 不展示真实过期指标。 | 无权限不可查看过期对象。 | 回退空态。 | reason=source_expired / expired candidate。 | “暂无已过期机会”。 |
| `exception_metrics` | `metricKey`、`dashboardBucket`、`reason code`、`result code`、`empty / exception copy`。 | raw payload、外部错误全文、SQL、stack、credential、DB URL。 | 缺异常类别时使用低敏 generic unavailable。 | 不暴露违规字段原文。 | 显示能力未开启或安全空态。 | tenant / RBAC 失败进入低敏异常态。 | 回退空态，不降级为客户列表。 | reason=dashboard_aggregation_unavailable / metric_source_missing。 | “指标口径暂不可用”。 |

## 8. low-sensitive drilldown 字段测试矩阵

未来低敏下钻只能返回低敏摘要或确认对象摘要。当前不定义真实 DTO，不实现 drilldown API，不实现下钻 runtime，不新增 parser / sanitizer / mask / redact。

| 下钻场景 | 允许返回字段 | 禁止返回字段 | 字段缺失期望 | 字段违规期望 | 权限不足期望 | tenant mismatch 期望 | feature flag disabled 期望 | audit input 期望 | fallback copy 期望 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 指标卡下钻 | `metricKey`、`dashboardBucket`、`lowSensitiveSummary`、`mockSeedDemoFlag`。 | 完整客户列表、完整联系方式、成交金额、SQL、stack。 | 缺 `metricKey` 时不可下钻。 | 阻断下钻，返回低敏异常态。 | 返回 permission denied。 | 不暴露其他租户指标存在性。 | 下钻不可用。 | `dashboard_drilldown_viewed` + result=blocked/skipped。 | “下钻暂不可用”。 |
| 复诊提醒下钻 | `opportunityType`、`sourceType`、`sourceSummary`、`dueDate window`、`priority`。 | 完整病历、诊断正文、真实预约号、HIS payload。 | 缺来源时提示来源不完整。 | 不回显高敏来源。 | 无复诊下钻权限时拒绝。 | 不返回跨租户复诊对象。 | 返回复诊下钻未开启。 | reason=drilldown_low_sensitive。 | “复诊提醒来源不完整”。 |
| 复购机会下钻 | `opportunityType`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`。 | 成交金额、销售额、ROI、支付 / 合同 / 发票。 | 缺复购窗口时提示试运行口径待确认。 | 阻断成交类字段。 | 无复购下钻权限时拒绝。 | 不返回其他租户复购对象。 | 返回复购下钻未开启。 | reason=metric_window_trial。 | “复购机会口径尚未 ready”。 |
| 沉睡客户机会下钻 | `opportunityType`、`sourceSummary`、`triggerReason`、`dueDate window`。 | 完整联系方式、地址、外呼内容、自动唤醒记录。 | 缺沉睡阈值时提示待产品确认。 | 不降级为完整客户列表。 | 无沉睡下钻权限时拒绝。 | 不返回跨租户沉睡对象。 | 返回沉睡下钻未开启。 | reason=aggregation_not_ready。 | “沉睡阈值为试运行口径”。 |
| 人工确认结果下钻 | `statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`、`result code`。 | 完整备注、客户完整联系方式、真实预约号、成交 / 支付数据。 | 缺状态前后时提示状态异常。 | 阻断并只显示低敏失败。 | 无确认权限时不返回动作字段。 | 不返回其他租户确认对象。 | manual confirm trial disabled 时不可用。 | reason=manual_confirmation_viewed candidate。 | “确认结果暂不可查看”。 |
| 异常指标下钻 | `metricKey`、`reason code`、`result code`、`empty / exception copy`。 | SQL、stack、DB URL、raw payload、外部错误全文。 | 缺 reason code 时显示 generic unavailable。 | 不写 raw audit。 | 无异常详情权限时只显示概述。 | 不暴露跨租户异常来源。 | 下钻禁用时显示异常摘要。 | reason=dashboard_aggregation_unavailable。 | “指标口径暂不可用”。 |
| audit trace 下钻候选 | `resource candidate`、`action candidate`、`reason candidate`、`result candidate`、`operatorRole`。 | metadata 自由字段、request body、response body、AI prompt / completion 全文。 | 命名未 ready 时阻断。 | 不保存违规字段原文。 | audit visibility 不足时不返回审计详情。 | 不返回其他租户 audit trace。 | audit input readonly disabled 时不写入或不展示。 | `dashboard_drilldown_viewed` / `drilldown_low_sensitive`。 | “审计下钻暂不可用”。 |
| permission denied 下钻 | `reason code`、`result code`、fallback copy。 | 对象 ID、对象存在性细节、高敏字段。 | 缺角色时按权限不足处理。 | 不透露被拒绝对象。 | 返回低敏拒绝。 | 不暴露跨租户细节。 | 可不写入或记录 skipped。 | reason=permission_denied。 | “当前账号没有访问权限”。 |
| feature flag disabled 下钻 | `reason code`、`result code`、fallback copy。 | 真实候选字段、对象列表、raw payload。 | 缺 flag 配置时按 disabled。 | 不绕过 flag。 | 不检查具体对象权限。 | 不访问 tenant 数据。 | 只返回能力未开启。 | result=skipped / disabled。 | “能力未开启”。 |
| low-sensitive drilldown unavailable | `metricKey`、`reason code`、fallback copy。 | 完整客户明细、完整 BI 导出、高敏对象。 | 缺低敏 presenter 时不可用。 | 阻断输出。 | 无权限时同样不可用。 | 不跨 tenant 查询。 | disabled 时保持 unavailable。 | result=unavailable。 | “低敏下钻暂不可用”。 |

## 9. opportunity candidate 字段测试矩阵

opportunity candidate 不等于真实任务，不等于真实预约，不等于真实成交，不等于自动触达。当前不实现 opportunity runtime。

每类 opportunity candidate 的未来测试都必须断言：禁止完整客户信息，禁止完整病历 / 诊断 / 治疗原文，禁止成交金额 / ROI，禁止 HIS raw payload / credential；来源缺失时只能进入低敏异常态，状态异常时不得自动创建任务、预约、成交或触达。

| 机会类型 | sourceType 字段候选 | sourceSummary 字段候选 | triggerReason 字段候选 | suggestedAction 字段候选 | priority 字段候选 | dueDate window 字段候选 | mockSeedDemoFlag 字段候选 | empty / exception copy 字段候选 | 禁止字段与异常期望 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| revisit reminder opportunity | treatment summary、appointment、follow-up path、manual input。 | 治疗后阶段、复诊 / 复查 / 状态确认窗口的低敏摘要。 | 复诊窗口、D7 / 本周窗口、状态确认需要人工判断。 | 转内部随访、形成预约意向、继续观察、忽略。 | 高 / 中 / 低，需低敏解释。 | 今日、D7、本周或 trial window。 | mock / seed / demo 必须显式标记。 | “暂无待处理复诊提醒”“来源信息不完整”。 | 禁止完整客户信息、完整病历 / 诊断 / 治疗原文、成交金额 / ROI、真实预约号、HIS raw payload / credential；来源缺失时只显示低敏异常，状态异常时不进入正式指标。 |
| repurchase opportunity | treatment summary、project lifecycle、customer lifecycle、follow-up summary。 | 项目周期、复购窗口、生命周期和满意度摘要的低敏组合。 | 复购窗口进入试运行口径，仅供内部判断。 | 转内部跟进、形成复购意向、继续观察、忽略。 | 高 / 中 / 低，禁止黑箱 AI 排名。 | D21、D28、trial / configurable window。 | mock / seed / demo 必须显式标记。 | “暂无待确认复购机会”“项目周期来源不完整”。 | 禁止完整客户信息、完整病历 / 诊断 / 治疗原文、成交金额 / ROI、支付 / 合同 / 发票 / 回款、HIS raw payload / credential；来源缺失时不猜测，状态异常时只给低敏失败。 |
| dormant customer opportunity | lifecycle、last appointment、last follow-up、manual observation。 | 最后互动类型、60 天 / 90 天观察层级、生命周期沉睡摘要。 | 长期未互动或未到院进入沉睡观察试运行口径。 | 进入唤醒观察、转内部跟进、转内部随访、忽略。 | 高 / 中 / 低，阈值未确认时必须说明。 | 60 天、90 天、trial / configurable observation window。 | mock / seed / demo 必须显式标记。 | “暂无待处理沉睡客户机会”“沉睡阈值为试运行口径”。 | 禁止完整客户信息、完整联系方式、完整病历 / 诊断 / 治疗原文、成交金额 / ROI、地址、外呼内容、自动唤醒记录、HIS raw payload / credential；来源缺失时进入异常态，状态异常时不自动唤醒。 |

## 10. manual confirm 字段测试矩阵

以下候选结果只是未来测试断言，不是状态机实现，不新增 enum，不写 API，不写测试代码，不触发外部系统动作。

每个 manual confirm 候选结果的未来测试都必须规划：`statusBefore`、`statusAfter`、`selectedAction`、`operatorRole`、`lowSensitiveSummary`、`reason code`、`result code`、empty / exception copy；并统一禁止完整备注、客户完整联系方式、真实预约号、外部消息正文、成交 / 支付 / 合同 / 发票 / 回款数据。stale / already handled / invalid transition 必须是低敏失败字段，不得静默成功。

| 候选结果 | statusBefore | statusAfter | selectedAction | operatorRole | lowSensitiveSummary | reason code | result code | empty / exception copy | 禁止字段与失败边界 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pending_confirmation` | suggested / candidate。 | pending_confirmation。 | enter queue candidate。 | system / internal staff role。 | 对象进入内部人工确认，不代表触达。 | entered_pending_confirmation。 | queued。 | “等待内部人员选择方向”。 | 禁止完整备注、完整联系方式、外部消息正文。 |
| `confirmed` | pending_confirmation。 | confirmed。 | confirm。 | operator role / internal staff role。 | 内部人员确认继续处理。 | manual_confirmed。 | success。 | “已由人工确认继续处理”。 | 禁止完整备注、客户完整联系方式、医疗结论。 |
| `converted_to_followup_tasks` | confirmed / pending_confirmation。 | converted_to_followup_tasks。 | convert_to_followup。 | operator role。 | 内部随访任务方向，不等于外部消息。 | converted_to_followup。 | success。 | “已转内部随访”。 | 禁止外部消息正文、电话录音、微信 / 企微原文。 |
| `converted_to_internal_follow` | confirmed / pending_confirmation。 | converted_to_internal_follow。 | convert_to_internal_follow。 | operator role。 | 内部运营承接，不自动营销。 | converted_to_internal_follow。 | success。 | “已转内部跟进”。 | 禁止促销话术全文、自动营销记录、客户沟通全文。 |
| `converted_to_appointment_intents` | confirmed / pending_confirmation。 | converted_to_appointment_intents。 | create_appointment_intent。 | operator role。 | 预约意向只是内部方向。 | appointment_intent_candidate。 | success。 | “已形成预约意向”。 | 禁止真实预约号、HIS payload、外部占号信息。 |
| `converted_to_repurchase_intents` | confirmed / pending_confirmation。 | converted_to_repurchase_intents。 | create_repurchase_intent。 | operator role。 | 复购意向只是内部判断。 | repurchase_intent_candidate。 | success。 | “已形成复购意向”。 | 禁止成交 / 支付 / 合同 / 发票 / 回款数据、销售额、ROI。 |
| `wake_observation` | pending_confirmation。 | wake_observation。 | continue_observation。 | operator role。 | 沉睡客户进入内部观察，不自动唤醒。 | wake_observation_candidate。 | success。 | “已进入唤醒观察”。 | 禁止外呼内容、完整联系方式、外部消息正文。 |
| `dismissed` | pending_confirmation / confirmed。 | dismissed。 | dismiss。 | operator role。 | 本次内部暂不处理。 | opportunity_dismissed。 | success。 | “已忽略”。 | 禁止客户拒绝原话、完整备注、个人隐私。 |
| `expired` | pending_confirmation / confirmed。 | expired。 | expire candidate。 | system / operator role。 | 处理窗口已过或来源失效。 | opportunity_expired。 | expired。 | “已过期”。 | 禁止 scheduler 日志、SQL、stack、外部错误全文。 |
| `stale` | stale source status。 | unchanged。 | attempted action。 | operator role。 | 对象状态已过期，请刷新。 | state_stale。 | blocked。 | “确认对象已过期”。 | 低敏失败字段：不展示并发内部细节、其他操作者隐私、完整备注。 |
| `already handled` | already handled。 | unchanged。 | attempted duplicate action。 | operator role。 | 对象已被处理，不重复执行。 | already_handled。 | blocked。 | “对象已被处理”。 | 低敏失败字段：不展示原处理人隐私、完整备注或对象明细。 |
| `invalid transition` | invalid source status。 | unchanged。 | invalid selectedAction。 | operator role。 | 无效流转，不改变状态。 | invalid_transition。 | blocked。 | “当前状态不支持该操作”。 | 低敏失败字段：不回显 rejected value 原文，不临时放行。 |

## 11. audit input 字段测试矩阵

以下候选事件 / 原因只是 future audit input naming candidate。当前不新增 audit enum，不新增 audit metadata，不实现 audit runtime，不修改 audit repository，不写 audit 测试代码。

每项 audit input 的未来测试都必须断言：禁止 metadata 自由字段、raw payload、SQL / stack、credential / token / secret、request body / response body、AI prompt / completion 全文。feature flag disabled 时是否不写入、audit input naming 未 ready 时是否阻断、tenant / RBAC 失败时是否低敏记录或不记录，都必须单独确认。

| 候选事件 / 原因 | resource candidate | action candidate | reason candidate | result candidate | allowed low-sensitive input | forbidden metadata / raw / secrets | feature flag disabled 时是否不写入 | audit input naming 未 ready 时是否阻断 | tenant / RBAC 失败时是否低敏记录或不记录 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard_metric_viewed` | dashboard metric。 | viewed。 | metric card viewed。 | success / skipped。 | `metricKey`、`dashboardBucket`、`operatorRole`、tenant scope candidate。 | 禁止 metadata 自由字段、raw payload、SQL / stack、credential / token / secret、request body / response body、AI prompt / completion 全文。 | 可不写入，或明确为 skipped。 | 命名未 ready 时阻断写入，只保留 UI copy。 | 权限失败可低敏记录 permission denied，或不记录详情。 |
| `dashboard_drilldown_viewed` | dashboard drilldown。 | viewed。 | drilldown_low_sensitive。 | success / blocked / unavailable。 | `metricKey`、`dashboardBucket`、`reason code`、`result code`。 | 同上，禁止客户完整列表和 request / response body。 | flag disabled 时不写真实下钻记录。 | 未 ready 时阻断，不创建新 enum。 | RBAC 失败记录低敏 denied 或不写详情。 |
| `dashboard_metric_source_unavailable` | dashboard metric source。 | unavailable。 | metric_source_missing。 | unavailable。 | `metricKey`、`sourceType`、`reason code`。 | 禁止 raw source、HIS raw payload、外部错误全文、SQL / stack。 | 可记录 skipped，也可不写。 | 未 ready 时只显示异常 copy。 | tenant mismatch 不记录跨租户 source。 |
| `dashboard_aggregation_unavailable` | dashboard aggregation。 | unavailable。 | aggregation_not_ready。 | unavailable。 | `metricKey`、`dashboardBucket`、`result code`。 | 禁止 SQL、stack、DB URL、repository row。 | dashboard flag disabled 时不写入。 | 未 ready 时阻断 audit input。 | 权限不足时只给低敏不可用。 |
| `metric_window_current` | metric window。 | evaluated candidate。 | current window。 | success / skipped。 | `metricKey`、`dueDate window`、`mockSeedDemoFlag`。 | 禁止完整行程、客户明细、raw payload。 | flag disabled 时不计算不写。 | 未 ready 时阻断。 | RBAC 失败不记录对象列表。 |
| `metric_window_trial` | metric window。 | evaluated candidate。 | trial window。 | success / skipped。 | `metricKey`、trial window、mock / seed / demo 标记。 | 禁止真实经营统计、销售额、ROI、真实客户数据。 | flag disabled 时不写真实试运行记录。 | 未 ready 时阻断。 | tenant 未开启时不跨 tenant 写入。 |
| `metric_source_missing` | metric source。 | rejected / unavailable。 | source missing。 | blocked / unavailable。 | `sourceType`、`reason code`、`result code`。 | 禁止 raw source、request body、response body。 | 可不写入。 | 未 ready 时只用 copy。 | 权限失败不说明具体缺失对象。 |
| `aggregation_not_ready` | dashboard aggregation。 | skipped。 | aggregation not ready。 | skipped / unavailable。 | `metricKey`、`reason code`。 | 禁止 SQL、stack、DB URL。 | 不写入或写 skipped，需 future 口径确认。 | 未 ready 时阻断。 | RBAC 失败优先 permission denied，不暴露聚合内部状态。 |
| `drilldown_low_sensitive` | drilldown。 | filtered / viewed。 | low-sensitive boundary。 | success / blocked。 | 低敏字段类别、`reason code`、`result code`。 | 禁止 metadata、raw payload、完整客户详情、AI prompt / completion 全文。 | flag disabled 时不写真实下钻。 | 未 ready 时阻断。 | tenant / RBAC 失败只低敏记录 denied 或不记录。 |

## 12. empty / exception copy 字段测试矩阵

未来断言必须确认：空态和异常态不暴露 SQL，不暴露 stack，不暴露 raw payload，不暴露外部错误全文，不展示高敏客户字段，不得自动降级为真实客户列表。当前不实现异常处理代码，不实现 copy runtime，不修改 UI，不新增 sanitizer / redact。

表中每个场景都必须同时规划：允许文案字段、允许 reason code、允许 result code、禁止 SQL、禁止 stack、禁止 raw payload、禁止外部错误全文、禁止高敏客户字段、禁止自动降级为真实客户列表、audit input 字段候选和 fallback 文案候选。

| 场景 | 允许文案字段 | 允许 reason code | 允许 result code | 禁止内容 | audit input 字段候选 | fallback 文案候选 |
| --- | --- | --- | --- | --- | --- | --- |
| no candidate opportunities | `empty / exception copy`、`mockSeedDemoFlag`。 | no_candidate_opportunities。 | empty。 | 禁止真实客户列表、高敏客户字段。 | 通常不写，或 resource=dashboard metric。 | “暂无待处理机会”。 |
| metric source missing | 低敏来源缺失说明。 | metric_source_missing。 | unavailable。 | 禁止 raw payload、HIS raw ID、request body。 | `dashboard_metric_source_unavailable`。 | “指标来源不完整，仅作内部参考”。 |
| partial source unavailable | 部分来源不可用说明。 | partial_source_unavailable。 | degraded。 | 禁止 SQL、stack、外部错误全文。 | `metric_source_missing`。 | “部分来源暂不可用”。 |
| aggregation not ready | 聚合口径未 ready 说明。 | aggregation_not_ready。 | unavailable。 | 禁止 SQL、stack、DB URL。 | `dashboard_aggregation_unavailable`。 | “看板聚合口径尚未 ready”。 |
| dashboard aggregation unavailable | dashboard 不可用说明。 | dashboard_aggregation_unavailable。 | unavailable。 | 禁止完整客户列表、完整 BI 导出。 | `dashboard_aggregation_unavailable`。 | “看板指标暂不可用”。 |
| low-sensitive drilldown unavailable | 下钻不可用说明。 | drilldown_unavailable。 | unavailable。 | 禁止高敏客户明细。 | `dashboard_drilldown_viewed` + result=unavailable。 | “低敏下钻暂不可用”。 |
| stale confirmation target | 状态过期说明。 | state_stale。 | blocked。 | 禁止并发内部细节、SQL。 | manual confirmation stale candidate。 | “确认对象已过期，请刷新后再处理”。 |
| already handled | 已处理说明。 | already_handled。 | blocked。 | 禁止其他操作者隐私、完整备注。 | manual confirmation already handled candidate。 | “对象已被处理”。 |
| invalid transition | 无效流转说明。 | invalid_transition。 | blocked。 | 禁止 rejected value 原文。 | manual confirmation rejected candidate。 | “当前状态不支持该操作”。 |
| tenant scope mismatch | 租户不匹配说明。 | tenant_mismatch。 | denied。 | 禁止其他租户客户明细。 | cross tenant denied candidate。 | “当前租户无法访问该对象”。 |
| permission denied | 权限不足说明。 | permission_denied。 | denied。 | 禁止 policy 内部细节、高敏对象。 | permission denied candidate。 | “当前账号没有访问权限”。 |
| feature flag disabled | 能力未开启说明。 | feature_flag_disabled。 | skipped。 | 禁止真实候选字段。 | 可不写，或 result=skipped。 | “该能力暂未开启”。 |
| dueDate missing | 缺处理窗口说明。 | due_date_missing。 | skipped。 | 禁止外部日程 payload、客户完整行程。 | `metric_source_missing`。 | “缺少处理日期，未计入时间窗口指标”。 |
| priority missing | 缺优先级说明。 | priority_missing。 | skipped。 | 禁止黑箱 AI 分数。 | source missing candidate。 | “缺少优先级，未计入高优先级指标”。 |
| dormant threshold not confirmed | 阈值待确认说明。 | dormant_threshold_not_confirmed。 | trial_only。 | 禁止自动唤醒结果、外呼内容。 | metric window trial candidate。 | “沉睡阈值为试运行口径，待产品确认”。 |
| status invalid | 状态异常说明。 | status_invalid。 | blocked。 | 禁止 stack、状态机实现细节。 | source invalid candidate。 | “状态异常，暂不计入正式指标”。 |
| source invalid | 来源无效说明。 | source_invalid。 | blocked。 | 禁止外部错误全文、raw source。 | source invalid candidate。 | “来源无效，仅作内部参考”。 |
| field whitelist violation | 字段违规说明。 | field_whitelist_violation。 | blocked。 | 禁止违规字段原文、高敏客户字段、SQL、stack、raw payload。 | invalid_field_whitelist candidate，且不写 raw payload。 | “字段不符合低敏展示边界”。 |

## 13. tenant / RBAC / feature flag 字段边界测试矩阵

| 边界类别 | 覆盖项 | 未来字段断言 | 当前不做 |
| --- | --- | --- | --- |
| feature flag | `v1OpportunityRuntimeEnabled` | 默认关闭时不得返回真实 opportunity candidate 字段；开启也不得跨 tenant。 | 不实现 flag runtime。 |
| feature flag | `v1ManualConfirmTrialEnabled` | 默认关闭时不得返回可执行 `selectedAction`；rollback 后只保留空态 / mock-only / 只读文案字段。 | 不实现 manual confirm runtime。 |
| feature flag | `v1DashboardMetricsReadonlyEnabled` | 默认关闭时不得返回真实指标候选字段；开启后只返回聚合与低敏字段。 | 不实现 dashboard API。 |
| feature flag | `v1LowSensitiveDrilldownEnabled` | 默认关闭时不得返回低敏对象列表；无权限下钻时不得返回对象列表。 | 不实现 drilldown API。 |
| feature flag | `v1AuditInputReadonlyEnabled` | 默认关闭时不写真实 audit input；audit visibility 不足时不得返回审计详情字段。 | 不实现 audit runtime。 |
| permission | tenant scope | 按 tenant 开启时不得跨 tenant 返回字段；tenant mismatch 不返回对象存在性高敏细节。 | 不写 tenant 查询。 |
| permission | institution scope | 机构范围不足时只显示低敏拒绝文案。 | 不改 access-control。 |
| permission | operator role | 只允许 `operatorRole` 这类低敏角色字段，不暴露员工隐私。 | 不新增角色模型。 |
| permission | internal staff role | 内部人员角色不足时不返回可执行动作字段。 | 不写确认 API。 |
| permission | read-only dashboard access | 只读权限可看聚合候选，不可获得高敏 drilldown 或执行字段。 | 不实现 dashboard 权限。 |
| permission | manual confirm permission | 无确认权限时不得返回可执行 `selectedAction`、真实预约 / 成交方向字段。 | 不实现状态机。 |
| permission | low-sensitive drilldown permission | 无下钻权限时不得返回低敏对象列表，更不得返回高敏字段。 | 不实现下钻 runtime。 |
| permission | audit visibility boundary | audit visibility 不足时不得返回 resource/action/reason/result 之外的审计详情字段。 | 不改 audit repository。 |
| mock / demo | mock / demo 字段不混入真实 tenant | `mockSeedDemoFlag` 必须显式，mock / demo 字段不得混入真实 tenant。 | 不新增 mock data。 |
| rollback | rollback 后字段 | rollback 后仅保留空态 / mock-only / readonly copy，不删除或清洗真实数据。 | 不执行 rollback 脚本。 |

## 14. 字段违规失败行为测试矩阵

字段违规时的未来期望如下。当前不实现 guard，不实现 sanitizer，不实现 mask，不实现 redact，不写测试代码。

| 违规场景 | 未来失败行为 | 禁止降级路径 |
| --- | --- | --- |
| 允许字段外出现高敏客户字段。 | 阻断输出，返回低敏异常态。 | 不降级为完整客户列表。 |
| `sourceSummary` 含完整病历、诊断正文或 raw payload。 | 不暴露违规字段原文，只记录字段类别或 reason code。 | 不自动修复真实客户数据。 |
| `lowSensitiveSummary` 含完整联系方式或完整备注。 | 阻断输出，不写入 audit raw payload。 | 不调用 mask / redact 作为本任务实现。 |
| dashboard metric 出现成交金额、销售额或 ROI。 | 阻断该指标候选，返回低敏异常态。 | 不降级为完整 BI 导出。 |
| drilldown 出现完整客户明细。 | 阻断下钻，保留 unavailable copy。 | 不返回分页客户列表。 |
| audit input 携带 metadata 自由字段。 | 拒绝 audit input naming candidate，不保存 metadata。 | 不把 request body / response body 存入 audit。 |
| exception copy 含 SQL、stack、DB URL、外部错误全文。 | 只返回稳定错误码或低敏文案。 | 不回显底层错误。 |
| credential / token / secret 出现在任一字段。 | 阻断输出，不写原文。 | 不执行脚本清洗，不触发外部系统补偿。 |
| AI prompt / completion 全文出现在任一字段。 | 阻断输出，只记录字段类别。 | 不保存模型原始请求或响应。 |
| 字段违规发生在 rollback 或 disabled 状态。 | 仍阻断输出，仅保留空态 / mock-only / readonly copy。 | 不绕过 feature flag，不访问真实数据。 |

## 15. 不授权 runtime 的边界断言

未来审查和测试计划评审应持续断言：

- 本文档不授权修改 `src/**`。
- 本文档不授权修改 `drizzle/**`。
- 本文档不授权修改 schema / migration。
- 本文档不授权新增 API / route。
- 本文档不授权新增 service、repository、DTO。
- 本文档不授权新增 parser、sanitizer、mask、redact、guard。
- 本文档不授权新增 field whitelist enforcement runtime。
- 本文档不授权新增 dashboard aggregation runtime。
- 本文档不授权新增 audit runtime。
- 本文档不授权新增 audit metadata 或 audit enum。
- 本文档不授权新增测试文件、fixture、mock data 或 test helper。
- 本文档不授权连接真实 HIS、读取真实 credential、连接外部系统。
- 本文档不授权处理真实客户数据、自动营销、自动触达、发送外部消息。
- 本文档不授权创建真实任务、真实预约或真实成交。
- 本文档不授权运行 test / lint / typecheck / dev server / migration。

## 16. 反模式测试清单

以下反模式必须在未来评审中被明确拒绝：

- 把字段白名单测试计划当成字段白名单 enforcement 实现授权。
- 把本测试计划当成测试代码授权。
- 在一个 PR 里同时写 schema、API、runtime、field whitelist guard、audit 和测试。
- dashboard metrics 返回完整客户列表。
- low-sensitive drilldown 返回完整客户明细。
- audit input 保存 metadata 自由字段。
- audit input 保存 request body / response body。
- 异常态展示 SQL、stack、raw payload 或外部错误全文。
- opportunity candidate 返回完整病历、诊断正文、治疗原文。
- manual confirm 返回完整备注或客户完整联系方式。
- 复购意向返回成交金额、销售额或 ROI。
- 预约意向返回真实预约号或 HIS payload。
- feature flag disabled 时仍返回真实候选字段。
- tenant / RBAC 失败时仍返回对象明细。
- rollback 时删除或清洗真实客户数据。
- 把 UI mock 字段当成真实 DTO 契约。
- 提前新增 parser / sanitizer / mask / redact。

## 17. 后续建议 PR 顺序

以下只是后续建议，不是开发许可：

1. contract-only：补齐字段白名单和 audit input naming 的命名收口，如需要只改文档。
2. test-plan-only：把本矩阵拆成更小的测试用例清单，仍不写测试代码。
3. test-only：在获得明确授权后，优先写字段禁止项的失败测试，不进入 runtime 实现。
4. runtime-later：只有在用户明确批准后，才讨论 parser / presenter / audit mapper / dashboard DTO 等实现层。
5. rollout-later：feature flag、tenant 开启、rollback、低敏下钻和 audit visibility 必须单独评审。

## 18. 本文档边界

本文档只新增：

- `docs/product/test-plans/v1-field-whitelist-test-plan-01.md`

本文档不修改：

- `src/**`
- `drizzle/**`
- schema / migration
- API / route
- service / repository / DTO
- package / lockfile
- 测试文件、fixture、mock data、test helper
- 既有产品事实源、契约、review、已有 test-plan、copy 或 plan

本文档不运行：

- test
- lint
- typecheck
- dev server
- migration

本文档不实现：

- runtime
- 字段白名单 enforcement runtime
- dashboard aggregation runtime
- audit runtime
- parser / sanitizer / mask / redact
- dashboard API
- opportunity runtime
- manual confirm runtime
- SQL
- 外部系统连接
- 真实 HIS
- 真实 credential 读取
- 真实客户数据处理
- 自动营销 / 自动触达
- 真实任务 / 预约 / 成交

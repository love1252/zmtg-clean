# V1-MANUAL-CONFIRM-CONTRACT-01：统一人工确认契约

## 1. 背景与目标

本契约任务编号为 V1-MANUAL-CONFIRM-CONTRACT-01，任务性质为 contract-only / docs-only。任务日期来自本地命令 `date "+%Y-%m-%d %Z %z"`，结果为 2026-06-08 CST +0800。

本契约基于以下产品事实源和已完成文档：

- `docs/product/zhimeitiangong-product-source-of-truth.md`
- `docs/product/zhimeitiangong-module-map.md`
- `docs/product/zhimeitiangong-v1-scope.md`
- `docs/product/zhimeitiangong-feature-addendum.md`
- `docs/product/zhimeitiangong-decision-log.md`
- `docs/product/reviews/prod-gap-review-01.md`
- `docs/product/contracts/v1-opportunity-contract-01.md`
- `docs/product/contracts/v1-dashboard-metrics-contract-01.md`

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，1.0 主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是系统主线，不阻塞 1.0。

人工确认是智美天工 1.0 的硬边界。AI / 规则 / 模板 / 看板只能提出建议、提醒、草稿、洞察或待处理项；内部人员确认前，不得进入外部自动触达，不得自动创建外部消息，不得形成自动化医疗建议，不得触发真实 HIS 或第三方业务动作。

本契约只定义统一人工确认的产品语义、对象范围、入口、动作、字段、状态解释、看板影响和审计输入。它不实现 runtime、API、UI、queue、worker、scheduler、schema、migration、状态机代码、SQL 或真实外部系统能力。

## 2. 非目标 / 明确不做

本 PR 只新增本契约文档，不修复问题，不实现功能。

本 PR 明确不做：

- 不做 runtime。
- 不做 UI。
- 不做 API。
- 不做 schema。
- 不做 migration。
- 不写 SQL。
- 不做 confirmation queue。
- 不做状态机代码。
- 不做 dashboard runtime。
- 不做 dashboard 聚合函数。
- 不新增 follow-up API、appointment API 或 dashboard API。
- 不新增 opportunity 表、manual_confirmation 表、confirmation queue 表或 dashboard 表。
- 不改 `src/**`、`app/**`、`components/**`、`lib/**`、`packages/**`。
- 不改 `drizzle/**`。
- 不改 `package.json` 或 lockfile。
- 不新增依赖。
- 不新增测试。
- 不启动 app 或 dev server。
- 不执行数据库 migration。
- 不运行 scheduler / cron / queue / worker。
- 不接真实 HIS。
- 不读取真实 credential。
- 不实现真实 credential provider runtime。
- 不实现真实 HIS adapter runtime。
- 不发起真实外部业务网络连接。
- 不做企业微信、微信、短信、电话或外呼触达。
- 不做自动营销。
- 不做 AI Agent 自动执行。
- 不做自动医疗决策。
- 不做真实消息发送。
- 不处理真实客户数据。
- 不做完整 BI。
- 不做数据导出。
- 不修改产品事实源原文件。
- 不修改 PROD-GAP-REVIEW-01 原报告。
- 不修改 V1-OPPORTUNITY-CONTRACT-01 原契约。
- 不修改 V1-DASHBOARD-METRICS-CONTRACT-01 原契约。

本契约不继续推进 CONFIG-PLAN-01、SCHEDULER-PLAN-01、AUDIT-PLAN-01、OBS-PLAN-01、SCHEMA-REVIEW-01，也不继续推进 Phase 23 / Phase 24 HIS 风险治理线。

## 3. 人工确认设计原则

1. 人工确认服务治疗后客户运营闭环，而不是服务 HIS 连接主线。
2. 人工确认是 AI / 规则 / 模板建议进入内部处理的硬边界。
3. 人工确认只允许产生内部业务动作，例如内部随访任务、预约意向、继续观察、完成、忽略或低敏备注。
4. 人工确认不代表客户已被触达。
5. 人工确认不代表真实预约已创建。
6. 人工确认不代表成交。
7. 人工确认不代表医疗判断完成。
8. 人工确认不依赖真实 HIS 接入；1.0 可基于模拟数据、人工录入或轻量导入验证闭环。
9. 人工确认不要求新增 schema、migration、queue、worker、scheduler 或状态机 runtime。
10. 人工确认必须具备可审计口径，后续审计覆盖需单独在 V1-AUDIT-COVERAGE-MATRIX-01 收口。
11. 人工确认必须避免高敏个人信息外泄，确认卡片、备注和审计提示只能保留低敏摘要。
12. 人工确认后续实现必须单独授权；本契约不能被解释为 runtime 开发许可。

## 4. 术语定义

以下术语是产品 / DTO / UI 层契约名称，不是数据库 schema、不是 TypeScript interface、不是 SQL 设计。

| 术语 | 辅助英文名 | 定义 | 边界 |
| --- | --- | --- | --- |
| 人工确认 | manual confirmation | 由机构内部人员判断建议、提醒或机会是否继续处理，以及选择内部处理方向。 | V1 硬边界；不代表自动执行。 |
| 确认对象 | confirmation subject | 进入人工确认的复诊提醒、复购机会、沉睡客户机会、随访建议、看板待处理项或未来人工录入机会。 | 不是新表或 queue。 |
| 确认入口 | confirmation entry point | 展示待确认对象并允许内部人员做选择的位置，例如治疗后摘要详情、机会列表或看板下钻入口。 | 只定义语义，不实现 UI / route / API。 |
| 确认动作 | confirmation action | 内部人员可选择的处理动作，例如转内部随访、形成预约意向、继续观察、完成、忽略、修改优先级或补充备注。 | 不触发外部业务系统。 |
| 确认结果 | confirmation result | 人工确认动作产生的内部结果或状态解释。 | 不等于真实触达、真实预约、真实成交或医疗判断。 |
| 待确认 | pending confirmation | 对象已进入人工处理范围，等待内部人员判断。 | 重点进入看板待处理口径。 |
| 已确认 | confirmed | 内部人员确认对象需要继续处理。 | 不代表已完成，也不代表已联系客户。 |
| 已忽略 | dismissed | 内部人员判断对象不处理或暂不处理。 | 必须可追踪，避免机会无痕丢弃。 |
| 转内部随访任务 | converted to follow-up | 人工确认后形成内部随访任务。 | 不等于外部消息发送。 |
| 转预约意向 | converted to appointment intent | 人工确认后形成内部预约意向。 | 不是真实预约，不是 HIS 同步。 |
| 标记完成 | completed | 内部人员或内部业务状态表明对象处理完成。 | 不代表成交或医疗结果。 |
| 标记过期 | expired | 对象超过处理窗口、来源失效或不再适用。 | 本契约不实现自动过期。 |
| 内部随访任务 | internal follow-up task | 给机构内部人员处理的随访或客户运营工作项。 | 不面向客户自动发送消息。 |
| 预约意向 | appointment intent | 内部记录“可能需要预约 / 复诊 / 复查 / 服务安排”的意向。 | 不创建真实预约，不同步 HIS。 |
| 自动触达 | auto outreach | 系统在无人确认下向客户发送微信、企微、短信、电话、外呼、营销消息或医疗建议。 | 1.0 明确不做。 |
| 审计提示 | audit hint | 为后续审计覆盖矩阵提供的动作、来源和低敏原因摘要。 | 不新增 audit schema、metadata 或枚举。 |

## 5. 人工确认对象范围

以下对象可以进入人工确认。本节只定义对象范围，不新增对象 runtime、不新增 confirmation 表、不新增 queue、不写实现逻辑。

| 确认对象 | 来源 | 为什么需要人工确认 | 确认前状态 | 确认后允许去向 | 禁止事项 |
| --- | --- | --- | --- | --- | --- |
| 复诊提醒 | 治疗摘要、预约 / 到院、随访结果、路径模板、恢复阶段或项目周期。 | 需要内部人员判断是否需要复查、复诊、状态确认或后续跟进。 | `suggested` 或 `pending_confirmation`。 | 转内部随访任务、转预约意向、继续观察、完成、忽略、过期。 | 不自动约诊，不外部自动触达，不生成医疗诊断。 |
| 复购机会 | 客户生命周期、项目周期、治疗摘要、历史服务摘要、预约完成状态或随访反馈。 | 需要内部人员判断是否适合继续运营、续疗、项目补充或服务承接。 | `suggested` 或 `pending_confirmation`。 | 转内部随访任务、转预约意向、继续观察、完成、忽略、过期。 | 不自动营销，不预测成交，不发送促销信息。 |
| 沉睡客户机会 | 最后预约、最后到院、最后治疗、最后随访、生命周期或轻量标签。 | 沉睡阈值和激活动作需要人工判断，避免误触达或过度运营。 | `suggested` 或 `pending_confirmation`。 | 继续观察、转内部随访任务、必要时转预约意向、完成、忽略、过期。 | 不自动唤醒，不自动外呼，不自动发送消息；阈值若仍为试运行口径需明确标注。 |
| 治疗后摘要中的随访建议 | 治疗后摘要详情、护理建议、路径模板节点、风险等级或下一步护理动作。 | 现有系统已经强调建议只供内部参考，需要人工确认后才可形成内部随访任务。 | `suggested` 或 `pending_confirmation`。 | 转内部随访任务、继续观察、完成、忽略、过期。 | 不自动生成客户消息，不替代医生 / 咨询师判断。 |
| 看板中的待处理机会 | 基础运营看板指标、指标下钻或待处理卡片。 | 看板只提示处理压力，不能替代人员确认。 | `pending_confirmation`。 | 跳转到内部确认入口、转内部随访、转预约意向、忽略或继续观察。 | 不在看板指标层直接执行外部动作。 |
| 未来可能的人工录入机会 | 内部人员手工记录的复诊、复购、沉睡或服务跟进机会。 | 手工录入仍需低敏、可审计、可解释的确认口径。 | `suggested` 或 `pending_confirmation`。 | 与对应机会类型一致。 | 不录入真实凭证、完整病历正文、HIS raw payload 或高敏个人信息。 |

## 6. 统一确认字段契约

以下字段是产品 / DTO / UI 口径，不是数据库 schema、不是 TypeScript interface、不是 SQL 或 migration 方案。

| 字段 | 中文含义 | V1 必需 | 适用对象 |
| --- | --- | --- | --- |
| `confirmationSubjectType` | 确认对象类型，例如复诊提醒、复购机会、沉睡客户机会、随访建议、看板待处理项或通用对象。 | 是 | 通用 |
| `confirmationSubjectId` | 确认对象在产品层的稳定标识；若来源缺失，应在异常态说明。 | 是 | 通用 |
| `customerId` | 关联客户档案的系统内标识。 | 是 | 通用 |
| `customerDisplayName` | 可展示的客户名称或脱敏展示名。 | 是 | 通用 |
| `sourceType` | 来源类型，例如治疗摘要、预约、随访任务、生命周期、看板指标、路径模板或人工录入。 | 是 | 通用 |
| `sourceId` | 来源对象标识；来源缺失时可为空并标记异常态。 | 否 | 通用 |
| `sourceSummary` | 来源摘要，用低敏语言说明对象从何而来。 | 是 | 通用 |
| `confirmationReason` | 进入确认的原因，例如复诊窗口、复购窗口、沉睡阈值、随访建议或看板待处理。 | 是 | 通用 |
| `recommendedAction` | 系统或规则建议的内部处理方向。 | 是 | 通用 |
| `availableActions` | 当前对象允许的人工确认动作集合。 | 是 | 通用 |
| `selectedAction` | 内部人员最终选择的确认动作；待确认前可为空。 | 是 | 通用 |
| `statusBefore` | 确认动作发生前的状态。 | 是 | 通用 |
| `statusAfter` | 确认动作发生后的状态。 | 是 | 通用 |
| `priority` | 内部处理优先级，例如低 / 中 / 高。 | 是 | 复诊提醒 / 复购机会 / 沉睡客户机会 / 看板待处理项 / 通用 |
| `dueDate` | 建议处理日期或窗口。 | 复诊必需，其他可选 | 复诊提醒 / 复购机会 / 沉睡客户机会 / 看板待处理项 |
| `operatorRole` | 建议或实际处理角色，例如咨询师、客服、运营负责人、医助。 | 是 | 通用 |
| `requiresAudit` | 是否建议纳入后续审计覆盖矩阵。 | 是 | 通用 |
| `auditHint` | 审计提示，记录动作、来源和低敏原因摘要。 | 否 | 通用 |
| `forbidAutoReachOut` | 是否禁止外部自动触达；V1 人工确认对象均应为是。 | 是 | 通用 |
| `notes` | 低敏内部备注。 | 否 | 通用 |

字段约束：

- `forbidAutoReachOut` 在 V1 人工确认对象中必须为是。
- `availableActions` 只能包含本契约第 8 节定义的动作或后续单独批准的动作。
- `selectedAction` 由内部人员选择，不能由黑箱 AI 自动决定。
- `sourceSummary`、`confirmationReason`、`auditHint` 和 `notes` 不得包含真实凭证、完整病历正文、HIS raw payload、外部系统错误全文、密钥、API Key、身份证号、完整手机号或其他高敏个人信息。
- 以上字段只服务后续 UI-only / mock-only / test-only / runtime-later 任务沟通，不构成新增字段、表或 migration 授权。

## 7. 确认入口契约

以下入口只定义 V1 中允许出现人工确认的位置和语义。本节不实现 UI、不新增路由、不新增 API、不新增下钻 runtime、不新增 dashboard runtime。

| 确认入口 | 展示目的 | 可确认对象 | 允许动作 | 禁止动作 | 是否 V1 必需 | 后续建议 PR 类型 |
| --- | --- | --- | --- | --- | --- | --- |
| 治疗后摘要详情 | 在治疗摘要上下文中确认随访建议、复诊相关提醒或后续护理动作。 | 治疗后摘要中的随访建议、复诊提醒。 | 转内部随访任务、继续观察、完成、忽略、过期。 | 不生成外部消息，不给出自动化诊疗建议，不创建真实预约。 | 是 | UI-only / mock-only / test-only |
| 随访建议区域 | 展示由规则、模板或摘要字段生成的内部建议。 | 随访建议、路径模板建议。 | 转内部随访任务、继续观察、忽略。 | 不绕过人工确认创建外部触达。 | 是 | UI-only / mock-only |
| 复诊提醒列表 / 卡片 | 集中展示待确认复诊提醒及处理窗口。 | 复诊提醒。 | 转内部随访任务、转预约意向、继续观察、完成、忽略、过期、修改优先级、补充低敏备注。 | 不自动约诊，不同步 HIS。 | 是 | UI-only / mock-only |
| 复购机会列表 / 卡片 | 展示待确认复购机会和优先级。 | 复购机会。 | 转内部随访任务、转预约意向、继续观察、完成、忽略、修改优先级、补充低敏备注。 | 不自动营销，不生成成交结论。 | 是 | UI-only / mock-only |
| 沉睡客户机会列表 / 卡片 | 展示待处理沉睡客户机会及阈值说明。 | 沉睡客户机会。 | 继续观察、转内部随访任务、必要时转预约意向、忽略、过期、修改优先级、补充低敏备注。 | 不自动唤醒，不自动外呼，不自动发送消息。 | 是 | UI-only / mock-only |
| 基础运营看板指标下钻入口 | 从待处理指标进入对应确认对象列表。 | 看板待处理机会、三类机会。 | 查看低敏摘要、进入确认入口、按对象执行允许动作。 | 不在指标层直接执行外部动作，不写 dashboard runtime。 | 是 | docs-only / UI-only / mock-only |
| 客户档案 / 时间线中的待处理提示 | 在客户上下文中提示该客户存在待确认对象。 | 复诊提醒、复购机会、沉睡客户机会、随访建议。 | 查看来源、进入确认入口、补充低敏备注。 | 不展示高敏详情，不把提示解释为已触达。 | 是 | UI-only / mock-only |

## 8. 确认动作契约

以下动作是产品层允许动作，不是 API runtime、不是状态机代码、不是 SQL。

| 确认动作 | 动作含义 | 适用对象 | 允许产生的内部结果 | 是否影响看板指标 | 是否建议写审计 | 禁止事项 |
| --- | --- | --- | --- | --- | --- | --- |
| 确认并转内部随访任务 | 内部人员判断需要后续随访处理，并转为机构内部工作项。 | 复诊提醒、复购机会、沉睡客户机会、随访建议、看板待处理项。 | `converted_to_followup`；进入已转内部随访任务数。 | 是 | 是 | 不等于外部消息发送，不触发对客联系动作。 |
| 确认并形成预约意向 | 内部人员判断可能需要预约、复诊、复查或面诊安排，记录内部意向。 | 复诊提醒、复购机会、沉睡客户机会、看板待处理项。 | `converted_to_appointment_intent`；进入转预约意向数。 | 是，可选指标 | 是 | 不等于真实预约，不等于 HIS 同步，不自动占号。 |
| 确认并标记继续观察 | 内部人员判断暂不转任务，但需保留观察。 | 复购机会、沉睡客户机会、部分复诊提醒。 | 可保持 `confirmed` 或进入后续观察口径。 | 可影响已确认机会数 | 是 | 不得由黑箱 AI 自动决定继续观察。 |
| 确认并标记完成 | 内部人员判断对象已完成内部处理。 | 通用。 | `completed`；进入已完成机会数。 | 是，可选指标 | 是 | 不代表成交、外部触达或医疗结果。 |
| 忽略 / 暂不处理 | 内部人员判断本次对象不处理或暂不处理。 | 通用。 | `dismissed`；进入已忽略机会数。 | 是 | 是 | 忽略必须可追踪，避免机会无痕丢弃。 |
| 修改优先级 | 内部人员调整低 / 中 / 高等处理优先级。 | 通用，尤其复购机会和沉睡客户机会。 | 影响排序和高优先级指标。 | 是 | 建议 | 不得由黑箱 AI 自动完成，不得无解释提高优先级。 |
| 补充低敏备注 | 内部人员补充内部处理说明。 | 通用。 | 增加低敏解释，供后续复盘和审计提示使用。 | 否或间接影响 | 建议 | 不得包含真实凭证、完整病历正文、HIS raw payload、高敏个人信息或外部系统错误全文。 |
| 标记过期 / 不再适用 | 内部人员或后续单独授权的内部机制标记对象不再适用。 | 通用。 | `expired`；进入失效或逾期复盘口径。 | 是，可选指标 | 是 | 本 PR 不实现自动过期、scheduler 或 worker。 |

动作边界：

- 转内部随访任务不等于外部消息发送。
- 形成预约意向不等于真实预约，也不等于 HIS 同步。
- 修改优先级必须可解释，不能由黑箱 AI 自动完成。
- 忽略必须可追踪，避免机会被无痕丢弃。
- 所有动作都只产生内部业务结果，不触发真实第三方系统动作。

## 9. 状态解释与状态方向

以下状态来自 V1-OPPORTUNITY-CONTRACT-01。本契约不新增状态，不把状态定义为数据库枚举，不写代码，不实现状态流转，不实现状态机。

| 状态 | 人工确认含义 | 允许进入来源 | 允许离开方向 | 是否影响看板指标 | 是否建议写审计 | 是否 V1 必需 |
| --- | --- | --- | --- | --- | --- | --- |
| `suggested` | 系统、规则、模板、AI 辅助或人工录入形成建议，但尚未进入正式待确认。 | 治疗摘要、随访建议、三类机会、看板提示、人工录入。 | `pending_confirmation`、`expired`。 | 可作为待处理总数辅助来源。 | 建议 | 是 |
| `pending_confirmation` | 对象已进入人工处理范围。 | `suggested`、看板待处理入口、客户档案提示、治疗摘要详情。 | `confirmed`、`dismissed`、`expired`。 | 计入待处理 / 待确认指标。 | 是 | 是 |
| `confirmed` | 内部人员确认对象需要继续处理。 | `pending_confirmation`。 | `converted_to_followup`、`converted_to_appointment_intent`、`completed`、`dismissed`、`expired`。 | 计入已确认机会数。 | 是 | 是 |
| `dismissed` | 内部人员判断不处理或暂不处理。 | `pending_confirmation`、`confirmed`。 | 通常为终态；如后续重开需单独定义。 | 计入已忽略机会数。 | 是 | 是 |
| `converted_to_followup` | 人工确认后转为内部随访任务。 | `confirmed`。 | `completed`、`expired`。 | 计入已转内部随访任务数。 | 是 | 是 |
| `converted_to_appointment_intent` | 人工确认后形成预约意向。 | `confirmed`。 | `completed`、`expired`。 | 计入转预约意向数。 | 是 | 是 |
| `completed` | 内部处理已完成或人工标记完成。 | `confirmed`、`converted_to_followup`、`converted_to_appointment_intent`。 | 通常为终态。 | 计入已完成机会数。 | 是 | 是 |
| `expired` | 处理窗口已过、来源失效或不再适用。 | `suggested`、`pending_confirmation`、`confirmed`、转换状态。 | 通常为终态；如重开需单独定义。 | 计入逾期 / 失效复盘口径。 | 是 | 是 |

状态方向边界：

- 允许方向：`suggested` -> `pending_confirmation`。
- 允许方向：`pending_confirmation` -> `confirmed` / `dismissed` / `expired`。
- 允许方向：`confirmed` -> `converted_to_followup` / `converted_to_appointment_intent` / `completed` / `dismissed` / `expired`。
- 允许方向：`converted_to_followup` -> `completed` / `expired`。
- 允许方向：`converted_to_appointment_intent` -> `completed` / `expired`。
- 本契约不定义自动流转、不实现自动过期、不实现状态机。
- 状态变化不得触发外部自动触达、自动营销、自动医疗决策、真实 HIS 或第三方业务动作。

## 10. 三类机会的确认差异

### 10.1 复诊提醒确认

复诊提醒确认重点是治疗后状态、复查 / 复诊需要、预约意向或内部随访。它通常来自治疗后摘要、恢复阶段、路径模板、复诊节点、预约状态或随访结果。

确认时应重点展示：

- 客户低敏摘要。
- 治疗项目 / 治疗阶段摘要。
- 恢复阶段或复诊窗口。
- 建议处理日期。
- 建议处理角色。
- 为什么需要人工确认。

边界：

- 不代表医疗诊断。
- 不自动约诊。
- 不进入外部自动触达。
- 不替代医生、咨询师或医助判断。

### 10.2 复购机会确认

复购机会确认重点是是否需要内部运营跟进、续疗判断、项目补充或客户服务动作。它通常来自客户生命周期、项目周期、历史服务摘要、治疗后摘要、随访结果或预约完成状态。

确认时应重点展示：

- 客户低敏摘要。
- 项目周期或复购窗口说明。
- 来源摘要。
- 优先级解释。
- 建议内部动作。

边界：

- 不代表成交预测。
- 不代表自动营销。
- 不自动发送促销信息。
- 高优先级必须可解释，不能由黑箱 AI 直接决定。

### 10.3 沉睡客户机会确认

沉睡客户机会确认重点是继续观察、内部随访、忽略或后续人工激活判断。它通常来自最后预约、最后到院、最后治疗、最后随访或生命周期状态。

确认时应重点展示：

- 客户低敏摘要。
- 最后互动或最后业务事实。
- 沉睡阈值说明。
- 是否仍为试运行口径。
- 建议动作和风险边界。

边界：

- 沉睡阈值如仍为试运行口径，必须保留待产品确认说明。
- 不自动唤醒。
- 不自动外呼。
- 不自动发送消息。

## 11. 与基础运营看板的关系

人工确认决定看板指标从“待处理”进入“已确认、已忽略、已转内部随访、转预约意向、已完成或过期”等内部结果。本节只定义指标影响，不实现看板 runtime、不写 SQL、不写聚合函数、不实现 UI。

| 指标 | 人工确认影响 |
| --- | --- |
| 待处理机会总数 | `pending_confirmation` 对象计入；确认、忽略、完成或过期后应离开待处理口径。 |
| 待处理复诊提醒数 | 复诊提醒待确认时计入；转内部随访、转预约意向、完成、忽略或过期后离开。 |
| 今日需处理复诊提醒数 | 复诊提醒 `dueDate` 属于今日且待确认 / 待处理时计入。 |
| 待确认复购机会数 | 复购机会待确认时计入；确认后进入已确认或转换口径。 |
| 高优先级复购机会数 | 复购机会优先级为高且未完成 / 未忽略 / 未过期时计入；修改优先级会影响指标。 |
| 待处理沉睡客户机会数 | 沉睡客户机会待确认时计入；继续观察、忽略、转内部随访、完成或过期后按状态解释。 |
| 逾期未处理机会数 | 超过建议处理日期或处理窗口且仍未处理的对象计入；本契约不实现自动逾期。 |
| 已确认机会数 | `confirmed` 以及人工确认后的转换状态可计入。 |
| 已忽略机会数 | `dismissed` 计入，必须可追踪。 |
| 已转内部随访任务数 | `converted_to_followup` 计入，不代表已外部触达。 |
| 转预约意向数 | `converted_to_appointment_intent` 计入，不代表真实预约。 |
| 已完成机会数 | `completed` 计入，不代表成交或医疗效果。 |

看板边界：

- 看板指标是内部运营输入，不是外部动作结果。
- 指标不得绕过人工确认触发任何自动动作。
- mock / seed / demo 数据必须标注为演示、试运行或验证数据，不等于真实生产数据。

## 12. 与内部随访任务 / 预约意向的关系

- 只有人工确认后，才允许转内部随访任务。
- 只有人工确认后，才允许形成预约意向。
- 内部随访任务不等于外部消息发送。
- 预约意向不等于真实预约，不等于 HIS 同步。
- 本契约不创建随访任务 runtime。
- 本契约不创建预约 runtime。
- 本契约不新增 follow-up API、appointment API 或 dashboard API。
- 本契约不定义真实消息发送、真实预约创建或真实 HIS 同步能力。

## 13. 与审计追踪的关系

本节只定义审计输入，不实现审计。以下人工确认相关动作建议后续进入 V1-AUDIT-COVERAGE-MATRIX-01。

| 建议审计动作 | 触发场景 | 审计提示 |
| --- | --- | --- |
| 进入待确认 | 对象从建议、看板、治疗摘要或人工录入进入待确认。 | 记录来源类型、来源摘要、对象类型和低敏原因。 |
| 人工确认 | 内部人员确认对象需要继续处理。 | 记录确认人、角色、时间、动作和低敏原因。 |
| 人工忽略 | 内部人员判断不处理或暂不处理。 | 记录忽略动作和低敏原因，避免无痕丢弃。 |
| 转内部随访任务 | 对象经人工确认后转为内部随访任务。 | 记录转换动作，不记录外部消息内容。 |
| 转预约意向 | 对象经人工确认后形成预约意向。 | 记录转换动作，并说明不等于真实预约。 |
| 标记继续观察 | 人工确认后暂不转任务但保留观察。 | 记录观察原因和后续处理窗口。 |
| 标记完成 | 对象被人工标记或内部状态标记为完成。 | 记录完成动作或内部状态来源。 |
| 标记过期 | 对象超过窗口、来源失效或不再适用。 | 记录过期原因或来源失效原因。 |
| 修改优先级 | 人工调整处理优先级。 | 记录调整前后优先级和低敏说明。 |
| 修改备注 | 人工补充或修改内部备注。 | 记录备注变更事件，但备注内容必须低敏。 |
| 变更确认入口或动作口径 | 后续文档或产品口径改变入口、动作或状态解释。 | 在契约或审计矩阵中记录版本和影响范围。 |

审计边界：

- 不新增 audit schema。
- 不新增 audit metadata。
- 不新增 migration。
- 不新增 audit action / reason / result 枚举。
- 不继续 HIS audit / compensation 线。
- 不记录真实 credential。
- 不记录真实 HIS raw payload。
- 不记录完整病历正文。
- 不记录外部系统错误全文。

## 14. 空态与异常态口径

本节只定义产品解释和 UI 文案方向，不实现 UI、不实现锁定、并发、权限、数据校验或 runtime。

| 场景 | 产品解释 | UI 文案方向 | 边界 |
| --- | --- | --- | --- |
| 无待确认项 | 当前没有进入人工处理范围的对象。 | “暂无待确认事项”。 | 不代表所有历史任务都已完成。 |
| 无可用确认动作 | 当前对象缺少可执行动作或状态不允许继续处理。 | “当前事项暂无可用确认动作”。 | 不自动补动作，不写状态机。 |
| 来源缺失 | 对象无法稳定追溯到治疗摘要、预约、随访、生命周期、看板指标或人工录入来源。 | “来源信息不完整，仅作内部参考”。 | 不猜测来源，不新增数据修复逻辑。 |
| 客户信息缺失或仅能脱敏展示 | 客户档案缺少展示字段或只能展示脱敏摘要。 | “客户信息仅展示低敏摘要”。 | 不展示完整手机号、证件号、病历全文或高敏资料。 |
| `dueDate` 缺失 | 对象缺少建议处理日期，不能进入今日 / 本周 / 逾期类指标。 | “缺少处理日期，未计入时间窗口指标”。 | 不自动推断日期。 |
| `priority` 缺失 | 对象缺少处理优先级，不能进入高优先级指标。 | “缺少优先级，未计入高优先级指标”。 | 不由 AI 自动补优先级。 |
| 沉睡阈值未确认 | 沉睡客户机会仍使用试运行口径。 | “沉睡阈值为试运行口径，待产品确认”。 | 不锁定具体天数。 |
| 状态异常 | 状态不在 V1-OPPORTUNITY-CONTRACT-01 的集合中，或状态方向不符合本契约。 | “状态异常，暂不计入正式指标”。 | 不新增状态，不修复 runtime。 |
| 已被其他人处理 | 对象在当前人员处理前已被其他内部人员确认、忽略、转换或完成。 | “该事项已被处理，请刷新后查看最新状态”。 | 本 PR 不实现锁定、并发控制或权限校验。 |
| 数据来自 mock / seed / demo | 数据只用于演示、试运行或验证。 | “当前包含演示 / mock 数据，仅用于内部验证”。 | mock / seed / demo 不等于真实生产数据。 |

## 15. 与现有 V1 链路的关系

| V1 链路 | 人工确认关系 | 本契约边界 |
| --- | --- | --- |
| 客户档案 / 患者信息 | 所有确认对象都应关联客户档案；患者信息只作为医疗语境补充。 | 使用“客户”作为主称呼，不展示高敏个人信息。 |
| 预约 / 到院 | 预约状态、到院状态和预约意向可成为确认来源或确认结果。 | 预约意向不是真实预约，不是 HIS 同步。 |
| 项目 / 治疗记录 | 项目、治疗阶段和治疗摘要影响复诊提醒、复购机会和随访建议。 | 不做完整病历，不新增项目或治疗记录 schema。 |
| 治疗后摘要 | 治疗后摘要详情是 V1 必需确认入口之一。 | 摘要建议只供内部参考，不生成自动化医疗建议。 |
| 随访任务 | 人工确认后才允许转内部随访任务。 | 内部随访任务不等于外部消息发送。 |
| 复诊提醒 | 必须经过人工确认后才能转内部随访或预约意向。 | 不自动约诊，不外部自动触达。 |
| 复购机会 | 必须经过人工确认后才能进入内部运营处理。 | 不自动营销，不代表成交预测。 |
| 沉睡客户机会 | 必须经过人工确认后才能继续观察、忽略或转内部随访。 | 不自动唤醒，阈值待产品确认。 |
| 人工确认 | 本契约定义统一对象、入口、动作、字段和状态解释。 | 不实现统一确认队列 runtime。 |
| 基础运营看板 | 看板待处理、已确认、已忽略、转换和完成指标依赖人工确认状态。 | 只定义指标影响，不做 dashboard runtime。 |
| 审计追踪 | 人工确认相关动作应进入后续审计覆盖矩阵。 | 不新增 audit schema / metadata / migration。 |

## 16. 示例场景

### 示例一：复诊提醒人工确认

客户甲完成注射类项目后，治疗后摘要显示进入 D7 状态确认窗口。系统在内部视图中展示一条复诊提醒，建议运营人员人工确认恢复反馈，并选择转内部随访任务或形成预约意向。机构人员确认后，只产生内部随访任务或预约意向；该结果不代表医疗诊断、不代表真实预约已创建，也不进入外部自动触达。

### 示例二：复购机会人工确认

客户乙进入项目复购窗口期，历史服务摘要和随访结果显示可能需要续疗或项目补充。系统展示一条复购机会，提示咨询师或运营人员判断是否建立内部随访任务、继续观察或形成预约意向。人工确认结果只作为内部运营处理依据，不代表成交预测、不自动发送促销信息，也不包含真实成交金额。

### 示例三：沉睡客户机会人工确认

客户丙较长时间未预约、未到院或未随访，且沉睡阈值仍为试运行口径。系统展示一条沉睡客户机会，提示运营人员选择继续观察、忽略或建立内部随访任务。该场景只使用虚构低敏摘要，不包含任何真实机构、外部系统、证件、病历、联系方式或生产数据，也不触发外呼或消息发送。

## 17. 后续 PR 拆分建议

| PR 编号建议 | 类型 | 目标 | 允许修改范围 | 禁止范围 | 是否阻塞 V1 | 依赖关系 |
| --- | --- | --- | --- | --- | --- | --- |
| V1-AUDIT-COVERAGE-MATRIX-01 | docs-only | 输出 V1 主线动作到审计要求的覆盖矩阵，纳入人工确认、机会状态和看板口径。 | `docs/product/**` | audit runtime、audit metadata schema、HIS compensation audit、migration。 | 是 | 依赖本契约、机会契约和看板指标契约。 |
| V1-REVISIT-UI-MOCK-01 | UI-only / mock-only | 使用现有 mock 或 seed 展示复诊提醒列表、空态、确认动作和内部去向。 | 后续明确批准后限 UI / mock / 组件测试范围。 | schema、migration、真实 HIS、真实预约同步、外部自动触达。 | 是 | 依赖本契约和看板指标契约。 |
| V1-REPURCHASE-DORMANT-UI-MOCK-01 | UI-only / mock-only | 展示复购与沉睡机会列表、确认入口、状态和空态。 | 后续明确批准后限 UI / mock / 组件测试范围。 | 新 opportunity 表、confirmation queue、scheduler、营销自动化、外部消息系统。 | 是 | 依赖本契约、机会契约和看板指标契约。 |
| V1-DASHBOARD-EMPTY-STATE-COPY-01 | docs-only / UI-only | 收口看板空态、异常态、mock / seed / demo 提示和试运行说明文案。 | `docs/product/**`；后续批准后可限 UI 文案。 | runtime、数据校验服务、schema / migration、完整 BI、dashboard SQL。 | 否 | 依赖看板指标契约和本契约。 |
| V1-OPPORTUNITY-TEST-PLAN-01 | test-only / docs-only | 定义未来测试应覆盖的机会状态、人工确认动作、看板影响和边界。 | `docs/product/**` 或后续批准的测试计划文件。 | 修改生产代码、真实外部系统、schema / migration。 | 否 | 依赖本契约。 |
| V1-FIELD-WHITELIST-CONTRACT-01 | contract-only | 明确确认卡片、备注、审计提示、看板和客户档案可展示字段白名单。 | `docs/product/**` | 真实客户数据、真实凭证、HIS raw payload、schema / migration。 | 是 | 可基于本契约并行推进。 |

后续 PR 原则：

- 不直接进入真实 HIS runtime。
- 不直接进入真实 credential runtime。
- 不直接扩 schema / migration。
- 不直接做外部自动触达。
- 不直接实现完整 BI。
- 不直接写 dashboard SQL。
- 不直接新增 confirmation queue。
- 如未来确需 schema 讨论，只能标记为 runtime-later / planning-later，并单独审批。

## 18. 验收标准

本契约完成后，应满足以下验收标准：

- 已定义人工确认设计原则。
- 已定义人工确认术语。
- 已定义人工确认对象范围。
- 已定义统一确认字段契约。
- 已定义确认入口契约。
- 已定义确认动作契约。
- 已定义状态解释。
- 已定义三类机会的确认差异。
- 已定义与看板指标、内部随访任务、预约意向和审计追踪的关系。
- 已定义空态与异常态口径。
- 已明确不做 runtime。
- 已明确不做 API / UI。
- 已明确不做 schema / migration。
- 已明确不做 queue / worker / scheduler。
- 已明确不做外部自动触达。
- 已明确不接真实 HIS、不读真实 credential、不实现真实 adapter / provider。
- 已明确本契约可作为后续 UI-only / mock-only / test-only PR 的依据。
- 未修改 `src/**`、`app/**`、`components/**`、`lib/**`、`packages/**`、`drizzle/**`、`package.json`、lockfile、测试文件或产品事实源原文件。
- 未修改 PROD-GAP-REVIEW-01、V1-OPPORTUNITY-CONTRACT-01 或 V1-DASHBOARD-METRICS-CONTRACT-01 原文件。

## 19. 验证记录

本次只读检查和文档新增过程中执行过以下命令：

- `sed -n '261,520p' /Users/dongxiaolong/.codex/attachments/e748dbc0-3721-4335-a5ec-a547a732c3c1/pasted-text.txt`
- `date "+%Y-%m-%d %Z %z"`
- `git status --short`
- `git branch --show-current`
- `git log --oneline -n 8`
- `git rev-parse HEAD`
- `git rev-parse main`
- `git rev-parse origin/main`
- `git switch -c docs/v1-manual-confirm-contract-01`
- `sed -n '521,1040p' /Users/dongxiaolong/.codex/attachments/e748dbc0-3721-4335-a5ec-a547a732c3c1/pasted-text.txt`
- `wc -l docs/product/zhimeitiangong-product-source-of-truth.md`
- `wc -l docs/product/zhimeitiangong-module-map.md`
- `wc -l docs/product/zhimeitiangong-v1-scope.md`
- `wc -l docs/product/zhimeitiangong-feature-addendum.md`
- `wc -l docs/product/zhimeitiangong-decision-log.md`
- `wc -l docs/product/reviews/prod-gap-review-01.md`
- `wc -l docs/product/contracts/v1-opportunity-contract-01.md`
- `wc -l docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `sed -n '1,220p' docs/product/zhimeitiangong-product-source-of-truth.md`
- `sed -n '1,120p' docs/product/zhimeitiangong-module-map.md`
- `sed -n '1,180p' docs/product/zhimeitiangong-v1-scope.md`
- `sed -n '1,100p' docs/product/zhimeitiangong-feature-addendum.md`
- `sed -n '1,120p' docs/product/zhimeitiangong-decision-log.md`
- `sed -n '1,320p' docs/product/reviews/prod-gap-review-01.md`
- `sed -n '1,460p' docs/product/contracts/v1-opportunity-contract-01.md`
- `sed -n '1,440p' docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `find docs/product -maxdepth 2 -type d`
- `rg --files docs/product`
- `rg -n "人工确认|确认|manual|confirm|pending_confirmation|confirmed|dismissed|converted_to_followup|converted_to_appointment_intent|completed|expired|随访任务|预约意向|复诊|复购|沉睡|看板|审计" docs/product src drizzle README.md package.json`
- `rg -n "HIS|credential|adapter|scheduler|worker|queue|migration|schema|自动触达|自动营销|AI Agent|完整 BI|SQL|dashboard runtime|confirmation queue|真实 HIS|真实 credential" docs/product src drizzle README.md package.json`
- `rg --files src | rg "treatment-followup|followup-path|treatment-path|dashboard|WorkspaceDashboard|institution-dashboard|customer-records|treatment-summary|audit-events|seed-demo|WorkspaceEntryPages|TenantBusinessWriteInput"`
- `rg -n "requiresHumanConfirmation|forbidAutoReachOut|确认创建随访任务|人工确认后创建内部随访任务|待人工确认|内部随访任务|预约意向|pending_confirmation|repurchase_window|silent_reactivation|converted_to|completedTaskCount|confirmedSourceTaskCount" src/modules/institution src/modules/workspace src/server/db/schema.ts drizzle README.md | head -n 240`
- `rg -n "audit|审计|writeAudit|audit_events|Audit|resourceId|reason" src/modules/institution src/modules/workspace src/server/db/schema.ts | head -n 220`
- `ls package.json pnpm-lock.yaml 2>/dev/null`
- `sed -n '320,430p' src/modules/institution/domain/treatment-followup-suggestions.ts`
- `sed -n '1,320p' src/modules/institution/domain/treatment-path-templates.ts`
- `sed -n '960,1170p' src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
- `sed -n '1,280p' src/modules/workspace/domain/institution-dashboard-view-models.ts`
- `sed -n '1,280p' src/modules/institution/domain/followup-path-analysis.ts`
- `sed -n '1,90p' src/server/db/schema.ts`
- `sed -n '1,150p' src/modules/institution/domain/customer-records.ts`
- `sed -n '1,130p' src/modules/institution/domain/tenant-business-view-models.ts`
- `sed -n '1,130p' src/modules/institution/domain/followup-workflow.ts`
- `sed -n '1,100p' src/modules/institution/domain/appointment-records.ts`
- `rg -n "^# |^## |^### " docs/product/contracts/v1-manual-confirm-contract-01.md`
- `rg -n "智美天工不是 HIS 系统|AI 客户运营中台|HIS 只是数据来源之一|人工确认是智美天工 1.0 的硬边界|不修复问题|不做 runtime|不做 API|不做 UI|不做 schema|不做 migration|不做 confirmation queue|不做状态机代码|真实 HIS|真实 credential|真实 HIS adapter|真实 credential provider|queue|worker|scheduler|外部自动触达|自动营销|AI Agent|完整 BI|真实消息发送" docs/product/contracts/v1-manual-confirm-contract-01.md`
- `rg -n "suggested|pending_confirmation|confirmed|dismissed|converted_to_followup|converted_to_appointment_intent|completed|expired|confirmationSubjectType|confirmationSubjectId|customerId|customerDisplayName|sourceType|sourceId|sourceSummary|confirmationReason|recommendedAction|availableActions|selectedAction|statusBefore|statusAfter|priority|dueDate|operatorRole|requiresAudit|auditHint|forbidAutoReachOut|notes" docs/product/contracts/v1-manual-confirm-contract-01.md`
- `git status --short --untracked-files=all`
- `git diff --stat`
- `git diff -- docs/product/contracts/v1-manual-confirm-contract-01.md`
- `git diff --name-only origin/main..HEAD`
- `git diff --no-index --stat /dev/null docs/product/contracts/v1-manual-confirm-contract-01.md`
- `git diff --no-index /dev/null docs/product/contracts/v1-manual-confirm-contract-01.md`

本次未运行 runtime，未启动服务，未连接外部业务系统，未连接真实 HIS，未读取真实 credential，未执行 migration，未运行 scheduler / cron / queue / worker，未新增 schema，未新增测试，未修复任何发现的问题。

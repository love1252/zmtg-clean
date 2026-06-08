# V1-OPPORTUNITY-TEST-PLAN-01：三类机会验收测试计划

## 1. 背景与目标

本测试计划任务编号为 V1-OPPORTUNITY-TEST-PLAN-01，任务性质为 docs-only / test-only plan。任务日期来自本地命令 `date "+%Y-%m-%d"`，结果为 2026-06-09；时区来自本地命令 `date "+%Z %z"`，结果为 CST +0800。

本计划基于智美天工 1.0 产品事实源和已完成 V1 契约：

- `docs/product/zhimeitiangong-product-source-of-truth.md`
- `docs/product/zhimeitiangong-module-map.md`
- `docs/product/zhimeitiangong-v1-scope.md`
- `docs/product/zhimeitiangong-feature-addendum.md`
- `docs/product/zhimeitiangong-decision-log.md`
- `docs/product/reviews/prod-gap-review-01.md`
- `docs/product/contracts/v1-opportunity-contract-01.md`
- `docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `docs/product/contracts/v1-manual-confirm-contract-01.md`
- `docs/product/contracts/v1-audit-coverage-matrix-01.md`
- `docs/product/contracts/v1-field-whitelist-contract-01.md`

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是系统主线，不阻塞 1.0。

本计划只定义未来测试覆盖范围，不实现测试，不新增测试文件，不运行测试，不实现 runtime。本计划用于后续 test-only / UI-only / mock-only PR 拆分依据，帮助后续小 PR 判断复诊提醒、复购机会、沉睡客户机会需要覆盖哪些字段、状态、人工确认、看板输入、审计输入和低敏边界。

## 2. 非目标 / 明确不做

本计划不做：

- runtime。
- UI。
- API。
- DTO。
- schema。
- migration。
- 测试实现。
- 运行测试。
- 字段校验器。
- 脱敏工具。
- audit metadata。
- audit enum。
- SQL。
- 真实 HIS。
- 真实 credential。
- 真实客户数据处理。
- 自动触达。
- 自动营销。
- AI Agent 自动执行。
- 完整 BI。
- 修复缺口。

本计划也不修改产品事实源原文件、PROD-GAP-REVIEW-01 原报告或任何已合并 V1 契约原文件。本计划中的后续建议不是 runtime 授权，后续进入测试实现、UI mock、runtime 或 schema 前必须另行批准。

## 3. 测试设计原则

1. 测试服务治疗后客户运营闭环，不服务真实 HIS 接入主线。
2. 三类机会测试必须围绕人工确认展开。
3. 测试只验证内部运营提示，不验证自动触达。
4. 测试不验证真实 HIS。
5. 测试不验证真实支付或成交。
6. 测试不验证医疗效果。
7. 测试必须覆盖低敏字段白名单。
8. 测试必须覆盖禁止字段不出现。
9. 测试必须覆盖 mock / seed / demo 数据标记。
10. 测试必须覆盖看板输入与审计输入。
11. 测试计划不等于测试实现。
12. 后续执行测试必须单独授权。

补充原则：

- 复诊提醒只作为内部提醒测试，不测试自动约诊。
- 复购机会只作为轻量运营提示测试，不测试成交预测。
- 沉睡客户机会只作为人工判断提示测试，不测试自动唤醒。
- 预约意向只作为内部意向测试，不测试真实预约或 HIS 同步。
- 内部随访任务只作为机构内部工作项测试，不测试微信、企微、短信、电话或外呼发送。
- 高优先级、低敏备注和审计提示都必须可解释、可追踪、低敏。

## 4. 测试对象范围

| 测试对象 | 测试目的 | 核心字段 | 必测状态 | 必测边界 | 不测内容 |
| --- | --- | --- | --- | --- | --- |
| 复诊提醒 | 验证治疗后复诊 / 复查 / 状态确认提醒能作为内部待确认对象被识别。 | `opportunityType`、`sourceType`、`sourceSummary`、`triggerReason`、`dueDate`、`priority`、`dashboardBucket`、`mockSeedDemoFlag`。 | `suggested`、`pending_confirmation`、`confirmed`、`converted_to_followup`、`converted_to_appointment_intent`、`dismissed`、`completed`、`expired`。 | 不自动约诊，不自动触达，不生成医疗诊断，不同步 HIS。 | 真实预约创建、真实 HIS 同步、医疗判断、外部消息发送。 |
| 复购机会 | 验证项目周期、生命周期、治疗摘要或随访反馈形成的复购提示能进入人工判断。 | `opportunityType`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、`lowSensitiveNotes`、`dashboardBucket`。 | `suggested`、`pending_confirmation`、`confirmed`、`converted_to_followup`、`converted_to_appointment_intent`、`dismissed`、`completed`、`expired`。 | 不代表成交预测，不自动营销，不发送促销信息，高优先级必须可解释。 | 成交金额、支付数据、销售预测、营销自动化。 |
| 沉睡客户机会 | 验证长期未预约、未到院、未治疗或未随访客户能以试运行口径进入人工判断。 | `opportunityType`、`sourceSummary`、`triggerReason`、`priority`、`dueDate` 或试运行窗口、`dashboardBucket`、`mockSeedDemoFlag`。 | `suggested`、`pending_confirmation`、`confirmed`、`converted_to_followup`、`dismissed`、`completed`、`expired`。 | 沉睡阈值若未确认必须提示试运行口径，不自动唤醒，不自动外呼。 | 自动唤醒、外呼、外部消息、真实客户召回结果。 |
| 人工确认对象 | 验证机会进入待确认后只能由内部人员选择动作并形成内部结果。 | `confirmationSubjectType`、`confirmationSubjectId`、`selectedAction`、`statusBefore`、`statusAfter`、`operatorRole`、`auditHint`。 | 全部 V1 机会状态。 | 选中动作不能由黑箱 AI 自动决定，备注必须低敏。 | confirmation queue、状态机代码、API 或自动执行。 |
| 基础运营看板输入 | 验证三类机会按契约进入指标口径。 | `metricKey`、中文指标名、`count`、`dashboardBucket`、`emptyStateCopy`、`exceptionStateCopy`、`mockSeedDemoFlag`。 | 以 `pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired` 为主。 | 指标不代表真实触达、成交、预约或医疗效果。 | dashboard runtime、SQL、聚合函数、完整 BI。 |
| 审计低敏摘要 | 验证机会和人工确认动作能映射到低敏审计输入。 | `resourceType`、`resourceId`、`actionSummary`、`reasonSummary`、`statusBefore`、`statusAfter`、`selectedAction`、`mockSeedDemoFlag`。 | 与人工确认动作和状态变化对应。 | 不记录高敏字段、raw payload、凭证、外部错误全文或完整病历。 | audit metadata、audit enum、审计 runtime。 |
| 机会卡片 / 提示 | 验证后续 UI-only / mock-only 可展示低敏卡片所需字段。 | `opportunityLabel`、`customerDisplayName`、`sourceSummary`、`suggestedAction`、`priority`、`dueDate`。 | 待确认、已确认、已忽略、转换、完成、过期。 | 卡片只展示低敏摘要，不展示完整联系方式或医疗正文。 | 真实 UI 实现、真实客户明细下钻。 |
| mock / seed / demo 数据 | 验证演示数据必须显式标记且不得冒充生产数据。 | `mockSeedDemoFlag`、虚构内部 ID、演示说明、低敏客户占位。 | 可覆盖全部状态，但必须标记来源。 | demo 数据不得使用真实姓名、手机号、身份证、机构、医院、HIS 名称。 | 生产数据导出、真实客户数据处理。 |

## 5. 三类机会测试矩阵

| 机会类型 | 测试目标 | 必测来源 | 必测字段 | 必测状态 | 必测人工确认动作 | 必测看板输入 | 必测审计输入 | 必测低敏边界 | 不测内容 |
| ---- | ---- | ---- | ---- | ---- | -------- | ------ | ------ | ------ | ---- |
| 复诊提醒 | 验证治疗后复诊 / 复查 / 状态确认只作为内部提醒进入人工确认。 | 治疗摘要、治疗阶段、恢复阶段、路径模板、预约状态、随访结果。 | `opportunityType`、`sourceType`、`sourceId`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、`dueDate`、`dashboardBucket`、`mockSeedDemoFlag`。 | `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 进入待确认、人工确认、人工忽略、转内部随访任务、形成预约意向、标记完成、标记过期、补充低敏备注。 | 待处理复诊提醒数、今日需处理复诊提醒数、本周需处理复诊提醒数、逾期未处理机会数、转内部随访任务数、转预约意向数。 | 进入待确认、人工确认、忽略、转内部随访、转预约意向、完成、过期、备注变化。 | 不展示完整病历、诊断结论、真实预约号、完整手机号、HIS raw payload。 | 自动约诊、自动触达、医疗诊断、真实预约 / HIS 同步。 |
| 复购机会 | 验证复购 / 续疗 / 服务延续提示能进入人工判断且不被解释为成交。 | 生命周期、项目周期、治疗摘要、历史服务摘要、随访结果、预约完成状态。 | `opportunityType`、`opportunityLabel`、`customerId`、`customerDisplayName`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、`dashboardBucket`、`lowSensitiveNotes`。 | `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 进入待确认、人工确认、人工忽略、转内部随访任务、形成预约意向、继续观察、标记完成、修改优先级、补充低敏备注。 | 待确认复购机会数、高优先级复购机会数、已确认机会数、已忽略机会数、转内部随访任务数、转预约意向数。 | 进入待确认、人工确认、忽略、转内部随访、转预约意向、继续观察、优先级变化、备注变化。 | 不展示成交金额、支付数据、促销话术全文、外部触达内容、黑箱评分。 | 自动营销、促销发送、成交预测、真实支付或合同。 |
| 沉睡客户机会 | 验证长期未互动客户只作为轻量机会进入人工判断，并保留试运行阈值提示。 | 最后预约、最后到院、最后治疗、最后随访、生命周期状态。 | `opportunityType`、`opportunityLabel`、`customerId`、`customerDisplayName`、`sourceSummary`、`triggerReason`、`priority`、`dueDate` 或试运行窗口、`dashboardBucket`、`mockSeedDemoFlag`。 | `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`completed`、`expired`。 | 进入待确认、人工确认、人工忽略、继续观察、转内部随访任务、必要时形成预约意向、标记过期、修改优先级、补充低敏备注。 | 待处理沉睡客户机会数、逾期未处理机会数、已确认机会数、已忽略机会数、已转内部随访任务数、机会类型分布。 | 进入待确认、人工确认、忽略、继续观察、转内部随访、过期、阈值口径提示变化、demo 标记变化。 | 不展示完整联系方式、外呼内容、自动唤醒内容、短信 / 微信 / 企微原文、未脱敏地址。 | 自动唤醒、自动外呼、自动发送消息、真实生产客户召回。 |

### 5.1 复诊提醒

复诊提醒测试重点：

- 来源可以来自治疗摘要、治疗阶段、恢复阶段、路径模板、预约状态、随访结果。
- 必须验证它是内部提醒。
- 必须验证不自动约诊。
- 必须验证不自动触达。
- 必须验证不生成医疗诊断。
- 必须验证可进入待确认。
- 必须验证可人工确认。
- 必须验证可转内部随访任务。
- 必须验证可形成预约意向。
- 必须验证预约意向不是真实预约 / HIS 同步。

测试样例方向：

- 治疗摘要显示 D7 状态确认窗口时，复诊提醒可进入 `pending_confirmation`，但不得产生客户消息。
- 复诊提醒经人工确认后可进入 `converted_to_followup` 或 `converted_to_appointment_intent`，但文案必须说明内部随访任务不是外部消息发送，预约意向不是真实预约。
- 来源缺失或 `dueDate` 缺失时，只出现异常态提示，不猜测来源、不自动补日期。

### 5.2 复购机会

复购机会测试重点：

- 来源可以来自生命周期、项目周期、治疗摘要、历史服务摘要、随访结果、预约完成状态。
- 必须验证它是内部轻量运营提示。
- 必须验证不代表成交预测。
- 必须验证不自动营销。
- 必须验证不发送促销信息。
- 必须验证可进入待确认。
- 必须验证可人工确认。
- 必须验证可转内部随访任务。
- 必须验证可继续观察 / 忽略 / 完成。
- 必须验证高优先级必须可解释。

测试样例方向：

- `repurchase_window` 生命周期或治疗摘要复购窗口只作为复购机会来源，不生成成交金额或支付结果。
- 高优先级复购机会必须有低敏来源说明，例如项目周期或人工判断，不允许只显示黑箱 AI 评分。
- 复购机会被忽略后应进入 `dismissed` 口径，并建议审计低敏原因。

### 5.3 沉睡客户机会

沉睡客户机会测试重点：

- 来源可以来自最后预约、最后到院、最后治疗、最后随访、生命周期状态。
- 必须验证沉睡阈值如为试运行口径，需要明确提示。
- 必须验证不自动唤醒。
- 必须验证不自动外呼。
- 必须验证不发送消息。
- 必须验证可进入待确认。
- 必须验证可人工确认。
- 必须验证可继续观察 / 忽略 / 转内部随访。
- 必须验证 demo / mock 数据不能冒充生产数据。

测试样例方向：

- `silent_reactivation` 或长期未互动来源只产生内部判断对象，不生成外呼任务或消息发送结果。
- 沉睡阈值未确认时，必须出现“试运行口径 / 待产品确认”方向的提示。
- demo 数据参与沉睡客户机会展示时，必须带 `mockSeedDemoFlag` 或等价演示标记。

## 6. 状态测试计划

以下状态来自 V1 机会契约。本计划不新增状态，不把状态写成数据库枚举，不实现状态机，不写测试代码。

| 状态 | 测试目标 | 允许进入来源 | 允许离开方向 | 看板影响 | 审计影响 | 低敏字段要求 | 不允许行为 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `suggested` | 验证机会建议形成但尚未进入正式待确认。 | 规则提示、AI 辅助建议、mock / seed、人工录入、治疗摘要、预约、随访、生命周期。 | `pending_confirmation`、`expired`。 | 可作为待处理总数辅助来源，不单独代表待处理完成。 | 建议审计机会出现或建议形成。 | 只允许 `opportunityType`、`sourceType`、`sourceSummary`、`triggerReason` 等低敏摘要。 | 不自动触达，不自动确认，不自动生成医疗建议。 |
| `pending_confirmation` | 验证机会已进入人工处理范围。 | `suggested`、看板待处理入口、客户时间线提示、治疗摘要详情。 | `confirmed`、`dismissed`、`expired`。 | 计入待处理机会、分类型待处理和逾期未处理口径。 | 建议审计进入待确认。 | 必须保留客户低敏摘要、来源摘要、优先级、处理窗口和 demo 标记。 | 不跳过人工确认，不在看板层直接执行外部动作。 |
| `confirmed` | 验证内部人员确认机会需要继续处理。 | `pending_confirmation`。 | `converted_to_followup`、`converted_to_appointment_intent`、`completed`、`dismissed`、`expired`。 | 计入已确认机会数，可作为后续转换状态的来源。 | 必须审计人工确认。 | 记录 `selectedAction`、`statusBefore`、`statusAfter`、`operatorRole`、低敏原因。 | 不代表已联系客户、不代表成交、不代表医疗判断完成。 |
| `dismissed` | 验证内部人员判断不处理或暂不处理。 | `pending_confirmation`、`confirmed`。 | 通常为终态；重开需后续单独定义。 | 计入已忽略机会数。 | 必须审计人工忽略和低敏原因。 | 原因只能是短语或低敏备注摘要。 | 不无痕丢弃，不写高敏备注全文。 |
| `converted_to_followup` | 验证机会经人工确认转为内部随访任务。 | `confirmed`。 | `completed`、`expired`。 | 计入已转内部随访任务数。 | 必须审计转换动作。 | 可记录内部任务 ID、来源摘要、状态前后和操作者角色。 | 不等于外部消息发送，不自动触达客户。 |
| `converted_to_appointment_intent` | 验证机会经人工确认形成预约意向。 | `confirmed`。 | `completed`、`expired`。 | 可计入转预约意向数。 | 必须审计转换动作。 | 可记录预约意向来源、状态前后和低敏说明。 | 不创建真实预约，不占号，不同步 HIS。 |
| `completed` | 验证内部处理被标记为完成。 | `confirmed`、`converted_to_followup`、`converted_to_appointment_intent`。 | 通常为终态。 | 可计入已完成机会数。 | 必须审计完成动作或内部状态来源。 | 只记录内部完成语义，不记录外部沟通全文。 | 不代表成交、复购成功、医疗改善或真实服务完成。 |
| `expired` | 验证机会过期、来源失效或不再适用。 | `suggested`、`pending_confirmation`、`confirmed`、`converted_to_followup`、`converted_to_appointment_intent`。 | 通常为终态；重开需后续单独定义。 | 可计入失效或逾期复盘口径，不默认计入待处理。 | 必须审计失效动作或低敏原因。 | 可记录时间窗口、来源失效摘要和试运行口径。 | 不实现自动过期 scheduler，不写状态机。 |

状态方向测试边界：

- 只验证契约允许方向，不实现状态机。
- 状态变化不得触发外部自动触达、自动营销、自动医疗决策、真实 HIS 或第三方业务动作。
- 如未来测试实现发现 runtime 状态缺失，只能回报缺口，不得在测试计划 PR 中修复。

## 7. 人工确认测试计划

| 人工确认动作 | 适用机会类型 | 必测输入 | 必测输出 | 看板影响 | 审计影响 | 禁止结果 |
| --- | --- | --- | --- | --- | --- | --- |
| 进入待确认 | 复诊提醒、复购机会、沉睡客户机会 | 机会类型、客户低敏摘要、来源类型、来源摘要、触发原因、优先级、处理窗口。 | `statusAfter=pending_confirmation` 或待确认提示。 | 进入待处理机会总数和对应分类型指标。 | 建议审计进入待确认的来源和低敏原因。 | 不自动确认，不自动触达，不创建外部消息。 |
| 人工确认 | 三类机会 | `selectedAction`、`statusBefore=pending_confirmation`、操作者角色、低敏原因。 | `statusAfter=confirmed` 或确认后转换状态。 | 进入已确认机会数。 | 必须审计确认动作。 | 不代表客户已被联系，不代表医疗判断完成。 |
| 人工忽略 | 三类机会 | 忽略动作、低敏原因、状态前后。 | `statusAfter=dismissed`。 | 进入已忽略机会数，从待处理口径离开。 | 必须审计忽略动作，避免无痕丢弃。 | 不删除来源，不写高敏备注。 |
| 确认并转内部随访任务 | 三类机会、随访建议 | 确认动作、内部任务来源、建议动作、处理角色。 | `statusAfter=converted_to_followup`，可形成内部随访任务引用。 | 进入已转内部随访任务数。 | 必须审计转换动作。 | 转内部随访任务不等于外部消息发送。 |
| 确认并形成预约意向 | 复诊提醒、复购机会、必要时沉睡客户机会 | 确认动作、预约意向来源、低敏说明。 | `statusAfter=converted_to_appointment_intent`。 | 可进入转预约意向数。 | 必须审计转换动作。 | 预约意向不等于真实预约，不等于 HIS 同步，不自动占号。 |
| 确认并继续观察 | 复购机会、沉睡客户机会、部分复诊提醒 | 继续观察动作、观察原因、后续窗口。 | 可保持 `confirmed` 或进入后续观察口径。 | 可影响已确认机会数，不应计入已完成。 | 建议审计观察原因和后续窗口。 | 不得由黑箱 AI 自动决定继续观察。 |
| 标记完成 | 三类机会 | 完成动作、内部完成说明、状态前后。 | `statusAfter=completed`。 | 可进入已完成机会数。 | 必须审计完成动作。 | 不代表成交、真实触达、医疗效果或真实服务完成。 |
| 标记过期 | 三类机会 | 过期动作或来源失效原因、处理窗口。 | `statusAfter=expired`。 | 可进入失效或逾期复盘口径。 | 必须审计过期原因。 | 本计划不实现自动过期，不启动 scheduler。 |
| 修改优先级 | 三类机会，尤其复购机会和沉睡客户机会 | 原优先级、新优先级、低敏解释。 | 优先级变化，可能影响排序和高优先级指标。 | 影响高优先级复购机会数等指标。 | 建议审计优先级前后。 | 修改优先级不得由黑箱 AI 自动完成。 |
| 补充低敏备注 | 三类机会、人工确认对象 | 低敏备注摘要、操作者角色、对象 ID。 | `lowSensitiveNotes` 或备注摘要更新。 | 通常不直接影响指标。 | 建议审计备注变化。 | 备注不得包含高敏内容、完整联系方式、完整病历、raw payload 或凭证。 |

必须明确：

- 转内部随访任务不等于外部消息发送。
- 预约意向不等于真实预约。
- 修改优先级不得由黑箱 AI 自动完成。
- 备注不得包含高敏内容。

## 8. 看板输入测试计划

| 指标 | 必测状态来源 | 排除状态 | 时间窗口 | 去重口径 | 空态口径 | 异常态口径 | 不允许解释 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 待处理机会总数 | `pending_confirmation`，可包含已展示为待确认入口的 `suggested`。 | `dismissed`、`completed`、`expired`。 | 当前。 | 按 `customerId + opportunityType + sourceType + sourceId` 去重；缺 `sourceId` 时标记来源不完整。 | “暂无待处理机会”。 | 来源缺失或状态异常时仅提示内部参考。 | 不代表自动营销、真实触达、成交或医疗效果。 |
| 待处理复诊提醒数 | 复诊提醒 `pending_confirmation`。 | `dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 当前。 | 按客户 + 治疗摘要 / 预约 / 路径节点 + 时间窗口去重。 | “暂无待处理复诊提醒”。 | 来源缺失时提示来源不完整。 | 不代表已约诊或已完成对客沟通。 |
| 今日需处理复诊提醒数 | 复诊提醒 `pending_confirmation` 且 `dueDate` 属于今日。 | `dismissed`、`completed`、`expired`。 | 今日。 | 同一客户同一来源同一今日窗口只计一次。 | “今日暂无复诊提醒”。 | `dueDate` 缺失时不计入今日指标。 | 不代表真实预约或 HIS 同步。 |
| 待确认复购机会数 | 复购机会 `pending_confirmation`。 | `dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 当前或试运行窗口。 | 按客户 + 项目周期 / 生命周期状态 + 时间窗口去重。 | “暂无待确认复购机会”。 | 项目周期或生命周期来源缺失时提示内部参考。 | 不代表成交预测或自动营销。 |
| 高优先级复购机会数 | 复购机会 `pending_confirmation` 或 `confirmed`，且 `priority=高`。 | `dismissed`、`completed`、`expired`。 | 当前或试运行窗口。 | 同一客户同一项目周期和时间窗口只计一次。 | “暂无高优先级复购机会”。 | `priority` 缺失时不计入高优先级指标。 | 不代表黑箱 AI 排名，不代表成交概率。 |
| 待处理沉睡客户机会数 | 沉睡客户机会 `pending_confirmation`。 | `dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired`。 | 当前或试运行窗口。 | 按客户 + 沉睡阈值层级 + 时间窗口去重。 | “暂无待处理沉睡客户机会”。 | 沉睡阈值未确认时提示试运行口径。 | 不代表客户已被唤醒或已触达。 |
| 逾期未处理机会数 | `suggested`、`pending_confirmation`、`confirmed` 且超过 `dueDate` 或处理窗口。 | `dismissed`、`completed`、`expired`。 | 逾期。 | 同一机会只计一次。 | “暂无逾期未处理机会”。 | `dueDate` 缺失时不猜测逾期。 | 不代表医疗风险判断。 |
| 已确认机会数 | `confirmed`、`converted_to_followup`、`converted_to_appointment_intent`。 | `suggested`、`pending_confirmation`、`dismissed`、`expired`。 | 历史累计或试运行窗口。 | 按机会唯一产品口径去重。 | “暂无已确认机会”。 | 状态异常时不计入正式指标。 | 不代表处理已完成、成交或真实预约。 |
| 已忽略机会数 | `dismissed`。 | 其他状态。 | 历史累计或试运行窗口。 | 同一机会多次忽略只按最终有效忽略状态计一次。 | “暂无已忽略机会”。 | 忽略原因缺失时提示审计信息不完整。 | 不代表客户拒绝或医疗结论。 |
| 已转内部随访任务数 | `converted_to_followup`。 | `suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_appointment_intent`、`completed`、`expired`。 | 历史累计或试运行窗口。 | 按机会 + 内部随访任务来源去重。 | “暂无机会转为内部随访任务”。 | 内部任务来源缺失时提示来源不完整。 | 内部随访任务不等于外部消息发送。 |
| 转预约意向数 | `converted_to_appointment_intent`。 | 其他状态。 | 历史累计或试运行窗口。 | 按机会 + 预约意向来源去重。 | “暂无机会转为预约意向”。 | 预约意向来源缺失时提示内部参考。 | 不代表真实预约、不代表 HIS 同步。 |
| 已完成机会数 | `completed`。 | 其他状态。 | 历史累计或试运行窗口。 | 同一机会最终完成状态只计一次。 | “暂无已完成机会”。 | 完成来源缺失时仅提示内部状态不足。 | 不代表成交、复购成功或医疗效果。 |

必须明确：

- 指标不代表自动营销。
- 指标不代表真实触达。
- 指标不代表成交。
- 指标不代表医疗效果。
- 本计划不实现 dashboard runtime。
- 本计划不写 SQL。

## 9. 审计输入测试计划

| 动作 | 是否必须审计 | 建议审计资源 | 建议动作摘要 | 建议原因摘要 | 低敏字段要求 | 禁止字段 |
| --- | --- | --- | --- | --- | --- | --- |
| 机会进入待确认 | 是 | 机会 / 人工确认对象 | 进入待确认 | 治疗阶段、复诊窗口、项目周期、生命周期、沉睡阈值或看板待处理触发。 | 机会类型、客户内部 ID、来源类型、状态前后、处理窗口、demo 标记。 | 完整手机号、完整病历、HIS raw payload、外部消息内容。 |
| 人工确认 | 是 | 人工确认对象 | 人工确认 | 内部人员确认需要继续处理。 | `selectedAction`、`statusBefore`、`statusAfter`、`operatorRole`、低敏原因。 | 高敏备注、医疗诊断、真实预约号。 |
| 人工忽略 | 是 | 人工确认对象 / 机会 | 人工忽略 | 内部人员判断不处理或暂不处理。 | 忽略动作、低敏原因、对象类型、状态前后。 | 完整沟通记录、外部错误全文。 |
| 转内部随访任务 | 是 | 机会 / 内部随访任务 | 转内部随访任务 | 人工确认后转为内部工作项。 | 内部任务 ID、来源摘要、选中动作、操作者角色。 | 外部消息正文、电话录音、完整联系方式。 |
| 转预约意向 | 是 | 机会 / 预约意向 | 转预约意向 | 人工确认后形成内部预约方向。 | 机会类型、来源摘要、状态前后、预约意向低敏说明。 | 真实预约号、HIS 同步 payload、客户完整行程。 |
| 标记继续观察 | 是 | 机会 / 人工确认对象 | 继续观察 | 人工判断暂不转任务但保留观察。 | 观察原因、后续窗口、机会类型、阈值说明。 | AI 自动决策结论、营销话术全文。 |
| 标记完成 | 是 | 机会 / 人工确认对象 | 标记完成 | 内部处理完成或人工标记完成。 | 完成动作摘要、状态前后、操作者角色。 | 成交金额、医疗效果、外部触达正文。 |
| 标记过期 | 是 | 机会 / 人工确认对象 | 标记过期 | 处理窗口过期、来源失效或不再适用。 | 过期原因、时间窗口、来源类型。 | scheduler 日志、SQL、服务端堆栈。 |
| 修改优先级 | 建议 | 人工确认对象 / 机会 | 修改优先级 | 内部人员调整处理优先级。 | 优先级前后、低敏解释、操作者角色。 | 黑箱 AI 分数、高敏客户画像。 |
| 修改低敏备注 | 建议 | 人工确认对象 / 机会 | 修改低敏备注 | 内部人员补充复盘说明。 | 低敏备注摘要、对象类型、操作者角色。 | 完整备注、高敏病情、手机号、身份证号。 |
| mock / seed / demo 提示变化 | 是 | 看板指标 / 演示数据说明 | 更新演示提示 | 演示、mock、seed 或试运行口径变化。 | `mockSeedDemoFlag`、指标 key、影响范围低敏摘要。 | 真实客户数据、真实机构名称、真实 HIS 名称。 |
| 指标口径变化 | 是 | 看板指标 | 更新指标口径 | 指标定义、状态口径、空态或异常态变化。 | 指标 key、口径版本、变更摘要。 | 客户明细、SQL、完整 BI 导出。 |

要求：

- 不新增 audit metadata。
- 不新增 audit enum。
- 不实现审计测试。
- 不写测试代码。

## 10. 字段白名单测试计划

本节基于 V1-FIELD-WHITELIST-CONTRACT-01，只定义未来测试要求，不实现字段校验器、不实现脱敏工具、不新增 DTO。

### 10.1 允许字段应出现

未来测试应覆盖以下允许字段在对应场景中可出现：

- 客户摘要：`customerId`、`customerDisplayName`、`maskedPhone`、`maskedMedicalRecordNo`、`lifecycleStatus`、`customerPriority`、`customerTags`。
- 机会卡片：`opportunityType`、`opportunityLabel`、`sourceType`、`sourceId`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、`dueDate`、`dashboardBucket`、`mockSeedDemoFlag`。
- 人工确认卡片：`confirmationSubjectType`、`confirmationSubjectId`、`selectedAction`、`statusBefore`、`statusAfter`、`operatorRole`、`auditHint`、`lowSensitiveNotes`。
- 看板提示：`metricKey`、中文指标名、`count`、`dashboardBucket`、`emptyStateCopy`、`exceptionStateCopy`、`mockSeedDemoFlag`。
- 审计低敏摘要：`resourceType`、`resourceId`、`actionSummary`、`reasonSummary`、`actorRole`、`tenantScope`、`sourceType`、`sourceId`、`opportunityType`、`statusBefore`、`statusAfter`、`selectedAction`、`priority`、`dueDate window`、`mockSeedDemoFlag`。

### 10.2 禁止字段不得出现

未来测试至少覆盖以下禁止字段不得出现在机会卡片、人工确认卡片、看板提示、审计摘要、mock / seed / demo 数据和低敏备注中：

- 完整手机号。
- 身份证号。
- 完整病历号。
- 完整病历正文。
- credential。
- API Key。
- Token。
- Cookie。
- Session。
- HIS raw payload。
- 外部错误全文。
- 真实支付信息。
- 外部消息原文。
- 电话录音。
- SQL / 服务端堆栈。
- AI prompt / completion 全文。

### 10.3 必须脱敏字段只能脱敏展示

未来测试应验证：

- `maskedPhone` 只能展示脱敏手机号，不允许完整手机号。
- `maskedMedicalRecordNo` 只能展示脱敏病历号，不允许完整病历号。
- `customerDisplayName` 不得与完整手机号 / 证件号组合形成高敏识别。
- `lowSensitiveNotes` 不得包含高敏内容、完整病历、外部消息原文或 raw payload。
- `sourceSummary` 不得包含 raw payload、完整病历正文或请求体全文。
- `auditHint` 不得包含 credential / API Key / Token / 完整病历。
- `mockSeedDemoFlag` 必须明确，避免 demo 数据冒充生产数据。

### 10.4 字段测试边界

字段白名单测试只验证产品契约要求。它不等于 DTO、schema、TypeScript interface、字段校验器、脱敏工具或 SQL 实现许可。

## 11. mock / seed / demo 测试计划

未来测试应覆盖：

1. demo 数据必须显式标记。
2. demo 客户不得使用真实姓名、手机号、身份证、医院、机构、HIS 名称。
3. demo 数据可以使用虚构内部 ID。
4. demo 数据可以使用客户甲 / 客户乙 / CUST-DEMO-001。
5. demo 看板不得被解释为生产指标。
6. demo 审计摘要不得写真实外部 payload。
7. demo 机会不得写成真实成交、真实触达或真实医疗效果。
8. demo 数据不允许被当作真实生产数据导出。

建议测试断言方向：

- 含 demo 或 mock 来源的机会、看板指标、审计摘要必须有 `mockSeedDemoFlag` 或等价标记。
- 看板中“当前演示客户”“受控 demo 数据”等提示不得被改写为生产指标。
- demo seed 中复购窗口和沉睡客户样例只能用于验证内部运营提示，不得描述为真实生产客户行为。
- demo 审计和低敏摘要只记录虚构内部 ID、动作摘要、角色和低敏原因。

本计划不修改 seed，不新增 mock，不新增测试文件。

## 12. 空态与异常态测试计划

| 场景 | 测试目的 | 期望提示 | 不允许展示内容 | 是否影响看板 | 是否影响审计 |
| --- | --- | --- | --- | --- | --- |
| 无复诊提醒 | 验证无复诊待处理项时不会误导为历史客户全部完成。 | “暂无待处理复诊提醒”。 | 客户明细高敏字段、完整病历。 | 复诊待处理指标为 0。 | 不需要新增动作审计。 |
| 无复购机会 | 验证无复购待确认项时不会误导为没有商业价值客户。 | “暂无待确认复购机会”。 | 成交预测、支付金额。 | 复购指标为 0。 | 不需要新增动作审计。 |
| 无沉睡客户机会 | 验证无沉睡待处理项时不会误导为客户全部活跃。 | “暂无待处理沉睡客户机会”。 | 客户完整联系方式。 | 沉睡客户机会指标为 0。 | 不需要新增动作审计。 |
| 无待确认项 | 验证人工确认入口空态。 | “暂无待确认事项”。 | 历史高敏明细。 | 待处理机会总数为 0。 | 不需要新增动作审计。 |
| 来源缺失 | 验证来源不完整时只提示内部参考。 | “来源信息不完整，仅作内部参考”。 | raw payload、请求体、SQL、堆栈。 | 不计入依赖稳定来源的指标或标记异常。 | 建议审计来源缺失语义，使用低敏原因。 |
| `dueDate` 缺失 | 验证时间窗口指标不猜测日期。 | “缺少处理日期，未计入时间窗口指标”。 | 客户完整行程、外部日程 payload。 | 不计入今日 / 本周 / 逾期指标。 | 可建议审计异常摘要。 |
| `priority` 缺失 | 验证高优先级指标不由 AI 自动补齐。 | “缺少优先级，未计入高优先级指标”。 | 黑箱 AI 分数、高敏客户画像。 | 不计入高优先级复购机会数。 | 可建议审计异常摘要。 |
| 沉睡阈值未确认 | 验证沉睡客户机会保留试运行口径。 | “沉睡阈值为试运行口径，待产品确认”。 | 自动唤醒文案、外呼内容。 | 可计入沉睡机会，但必须带试运行说明。 | 建议审计阈值口径变化。 |
| 状态异常 | 验证非 V1 状态不被纳入正式指标。 | “状态异常，暂不计入正式指标”。 | 新状态枚举、runtime 修复说明。 | 不计入正式指标。 | 建议审计状态异常低敏摘要。 |
| 已被其他人处理 | 验证并发或先后处理只做提示，不在本计划实现锁定。 | “该事项已被处理，请刷新后查看最新状态”。 | 操作者个人隐私、完整处理备注。 | 按最新状态影响指标。 | 建议审计处理动作和低敏原因。 |
| 数据来自 mock / seed / demo | 验证演示数据不能冒充生产数据。 | “当前包含演示 / mock 数据，仅用于内部验证”。 | 真实生产客户、真实机构、真实 HIS 名称。 | 可以进入演示指标，但必须标记。 | 建议审计 demo 提示变化。 |

## 13. 与现有仓库证据的只读盘点

本节只读说明当前仓库证据，不修改任何实现，不新增测试，不运行测试。

| 检查项 | 只读证据 | 判断 |
| --- | --- | --- |
| 是否已有 customer `maskedPhone` / `maskedMedicalRecordNo` | `src/modules/institution/domain/customer-records.ts` 定义客户摘要中的 `maskedPhone` 和 `maskedMedicalRecordNo`；`src/server/db/schema.ts` 的 `customers` 表含 `masked_phone` 与 `masked_medical_record_no`；`src/server/db/seed-demo-data.ts` 使用脱敏展示值。 | 已有局部脱敏字段。 |
| 是否已有 lifecycle / priority / tags | `customer-records.ts` 定义 `lifecycle`、`priority`、`tags`；`schema.ts` 定义 `customer_lifecycle` 与 `customer_priority`；看板 view model 使用 `repurchase_window`。 | 已有生命周期、优先级和标签。 |
| 是否已有 treatment summary write whitelist | `src/modules/institution/server/treatment-summary-write-input.ts` 定义创建 / 更新治疗摘要允许键，包括 `treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`riskLevel`、`summary`、`nextCareAction`、`tags`。 | 已有治疗摘要写入白名单和高敏内容拒绝方向。 |
| 是否已有 tenant business write input 边界 | `src/modules/institution/server/tenant-business-write-input.ts` 定义客户和预约写入允许字段，并拒绝 `phoneNumber`、`idNumber`、`medicalRecordNo`、`treatmentRecord`、`consultationTranscript` 等字段。 | 已有局部低敏写入边界。 |
| 是否已有 audit domain 无 metadata | `src/modules/audit/domain/audit-events.ts` 的审计事件只含 actor、tenant、resource、resourceId、action、result、reason、occurredAt、source；`src/server/db/schema.ts` 的 `audit_events` 表没有 metadata 列。 | 审计底座当前不携带 metadata 或请求体全文。 |
| 是否已有 demo seed | `package.json` 有 `db:seed`；`src/server/db/seed-demo-data.ts` 包含 demo tenants、customers、appointments、treatment summaries、follow-up tasks 和 audit events，并有 demo seed 生产保护提示。 | 已有 demo seed 数据和保护提示。 |
| 是否已有看板基础指标 | `src/modules/workspace/domain/institution-dashboard-view-models.ts` 聚合客户总数、高优先级客户、待确认预约、待处理随访、复购窗口期等指标。 | 有基础看板指标，但不是三类机会统一指标字典 runtime。 |
| 是否已有随访人工确认局部实现 | `src/modules/institution/server/treatment-followup-confirmation.ts` 从治疗摘要建议经人工确认创建内部随访任务；`followup-path-analysis.ts` 可统计确认来源任务、完成、超时、作废阻断和重复冲突。 | 有治疗摘要随访确认局部实现。 |
| 是否已有机会对象统一 runtime | 只读搜索显示三类机会主要散落在 lifecycle、seed、路径模板、随访建议和看板统计中；前序契约定义了统一机会口径。 | 尚未发现统一 opportunity runtime。 |
| 是否已有三类机会统一测试 | 现有测试覆盖客户、预约、治疗摘要、随访建议、路径模板、看板、审计等局部；未见统一覆盖复诊提醒、复购机会、沉睡客户机会的 test plan 或统一测试文件。 | 尚缺三类机会统一测试。 |

只读结论：

- 当前仓库已经具备客户低敏摘要、治疗摘要白名单、客户 / 预约写入边界、审计底座、demo seed、基础看板和治疗摘要随访确认局部能力。
- 三类机会统一对象、统一状态测试、统一人工确认测试、统一看板输入测试和统一低敏字段测试尚未落地。
- 本测试计划只把这些证据整理为未来测试覆盖依据，不把缺口修复为本轮任务。

## 14. 测试用例分组建议

| 分组 | 测试目的 | 建议断言方向 | 允许数据来源 | 禁止测试内容 | 后续适合 PR 类型 |
| --- | --- | --- | --- | --- | --- |
| opportunity-fields | 覆盖三类机会字段白名单和来源摘要。 | 允许字段出现；禁止字段不出现；`sourceSummary` 不含 raw payload；`mockSeedDemoFlag` 明确。 | 契约示例、受控 mock、demo seed、静态 fixtures。 | DTO 实现、字段校验器实现、真实客户数据。 | test-only / mock-only。 |
| opportunity-status | 覆盖 8 个 V1 状态和允许状态方向。 | 允许状态方向成立；异常状态不计入正式指标；不新增状态。 | 契约状态表、mock 机会对象。 | 状态机 runtime、数据库枚举、scheduler。 | test-only。 |
| manual-confirmation | 覆盖人工确认动作和内部结果。 | 进入待确认、确认、忽略、转内部随访、转预约意向、继续观察、完成、过期、改优先级、低敏备注。 | 人工确认契约、治疗摘要随访确认局部证据、mock 确认对象。 | 自动执行、confirmation queue、外部触达。 | test-only / UI-only。 |
| dashboard-metrics-input | 覆盖看板指标输入、状态来源、空态和异常态。 | 指标只来自允许状态；空态和异常态文案不误导；demo 标记明确。 | 看板指标契约、dashboard view model、mock 指标。 | dashboard SQL、聚合函数、完整 BI。 | test-only / docs-only / UI-only。 |
| audit-low-sensitive-summary | 覆盖机会和确认动作审计输入。 | 必须审计动作都有低敏摘要建议；禁止字段不出现；不新增 metadata。 | 审计覆盖矩阵、audit domain、mock audit summary。 | audit enum、audit metadata、审计 runtime。 | docs-only / test-only。 |
| field-whitelist | 覆盖字段白名单、脱敏字段和禁止字段。 | `maskedPhone`、`maskedMedicalRecordNo` 只脱敏展示；禁止字段不得出现。 | 字段白名单契约、低敏 fixtures。 | 脱敏工具实现、DTO 实现、schema。 | docs-only / test-only。 |
| mock-seed-demo | 覆盖 demo / seed / mock 标记。 | demo 数据显式标记；demo 看板不解释为生产指标；demo 审计不用真实 payload。 | demo seed、mock fixtures。 | 生产数据导出、真实客户数据。 | mock-only / test-only。 |
| empty-exception-states | 覆盖空态与异常态。 | 无机会、来源缺失、`dueDate` 缺失、`priority` 缺失、阈值未确认、状态异常、已被处理均有低敏提示。 | 契约场景、mock fixtures。 | runtime 修复、数据校验服务、锁定机制实现。 | UI-only / test-only。 |

## 15. 不纳入本测试计划的内容

本测试计划不纳入：

- 真实 HIS。
- 真实 credential。
- 真实外部网络。
- 自动触达。
- 微信 / 企微 / 短信 / 电话发送。
- 真实支付 / 成交。
- 医疗效果。
- 完整 BI。
- AI Agent 自动执行。
- 数据导出。
- 真实生产客户数据。
- schema / migration。
- DTO / 校验器 / 脱敏工具实现。
- dashboard runtime、SQL 或聚合函数。
- opportunity 表、confirmation queue 表、audit metadata schema。
- 对当前 runtime 缺口的修复。

这些内容如果未来需要推进，必须由后续任务单独授权，并重新进行边界确认。

## 16. 缺口与风险

### P1

- 三类机会尚无统一测试计划的风险：复诊提醒、复购机会、沉睡客户机会已在契约中定义，但如果没有统一测试计划，后续 UI-only / mock-only / test-only PR 可能分别解释字段、状态和动作，导致验收口径分裂。
- 字段白名单未测试导致高敏字段泄露风险：机会卡片、人工确认备注、审计摘要和看板下钻若未覆盖禁止字段，可能夹带完整手机号、完整病历、HIS raw payload、外部消息原文或凭证。
- 人工确认边界未测试导致自动触达误解风险：如果测试不明确转内部随访任务和预约意向的边界，后续容易把内部动作误解为外部消息发送、真实预约或 HIS 同步。
- 看板指标未测试导致 demo / 生产口径混淆风险：当前看板已有演示指标和复购窗口统计，若不测试 `mockSeedDemoFlag` 和空态异常态，可能把 demo 指标解释为生产经营结果。
- 审计摘要未测试导致高敏内容写入风险：审计矩阵要求低敏摘要，但未来如未测试禁止字段，备注、原因或来源摘要可能出现完整病历、外部错误全文、SQL 或服务端堆栈。

### P2

- 后续 UI-only / mock-only PR 没有测试依据的风险：复诊、复购、沉睡 UI mock 若缺测试计划，可能展示字段、动作和状态不一致。
- 沉睡阈值待确认带来的测试口径风险：沉睡客户机会可使用试运行口径，但必须测试“待产品确认”提示，否则容易锁死业务规则。
- 高优先级复购机会解释不足风险：如果测试不要求优先级可解释，后续 UI 可能展示无法审计的黑箱 AI 排序。
- 来源缺失和 `dueDate` 缺失未测试风险：后续实现可能猜测来源或日期，放大误判。

### P3

- 客户展示名与脱敏策略仍需后续实现细化：本计划只要求不得与完整手机号 / 证件号组合形成高敏识别，不实现姓名脱敏。
- 指标空态与异常态文案仍需后续 UI 文案收口：本计划定义测试方向，不写 UI 文案。
- 审计 read 动作粒度仍需后续审计测试计划细化：本计划只覆盖三类机会和人工确认的审计输入，不替代 V1-AUDIT-TEST-PLAN-01。

## 17. 后续 PR 拆分建议

| PR 编号 | 类型 | 目标 | 允许修改范围 | 禁止范围 | 是否阻塞 V1 | 依赖关系 |
| --- | --- | --- | --- | --- | --- | --- |
| V1-DASHBOARD-EMPTY-STATE-COPY-01 | docs-only / UI-only | 收口看板空态、异常态、demo / seed 标记和试运行提示文案，避免指标误读。 | docs-only；后续若单独批准可限 UI 文案。 | runtime、dashboard SQL、聚合函数、完整 BI、客户高敏明细、真实生产数据。 | 否 | 依赖看板指标契约、字段白名单契约和本计划。 |
| V1-REVISIT-UI-MOCK-01 | UI-only / mock-only | 展示复诊提醒列表、低敏机会卡片、人工确认入口、空态和内部去向。 | 后续明确批准后限 UI / mock / 组件测试范围。 | schema、migration、真实 HIS、真实预约同步、自动触达、完整病历、真实客户数据。 | 是 | 依赖机会契约、人工确认契约、看板契约、字段白名单和本计划。 |
| V1-REPURCHASE-DORMANT-UI-MOCK-01 | UI-only / mock-only | 展示复购与沉睡机会列表、状态、低敏来源摘要、看板入口和试运行提示。 | 后续明确批准后限 UI / mock / 组件测试范围。 | 新 opportunity 表、scheduler、自动营销、外部消息、schema / migration、真实生产数据。 | 是 | 依赖机会契约、人工确认契约、看板契约、字段白名单和本计划。 |
| V1-AUDIT-TEST-PLAN-01 | docs-only / test-only plan | 定义 V1 审计最小测试计划，锁定治疗摘要、随访、机会、人工确认、权限拒绝和低敏摘要边界。 | docs-only；后续若单独批准可限测试计划文档。 | 修改生产 runtime、扩 audit enum、audit metadata schema、migration、真实 HIS。 | 是 | 依赖审计覆盖矩阵、字段白名单和本计划。 |
| V1-FIELD-WHITELIST-TEST-PLAN-01 | docs-only / test-only plan | 定义字段白名单验证用例，覆盖客户摘要、机会卡片、人工确认备注、审计摘要和 demo 数据标记。 | docs-only；后续若单独批准可限测试计划文档。 | 字段校验器实现、脱敏工具实现、DTO 实现、schema / migration。 | 否 | 依赖字段白名单契约和本计划。 |
| V1-OPPORTUNITY-TEST-IMPLEMENT-LATER-01 | test-only / later | 在后续明确批准后实现三类机会最小测试。 | 仅后续批准的测试文件范围。 | runtime、UI、API、DTO、schema、migration、真实 HIS、自动触达、SQL。 | 否 | 依赖本计划和后续测试实现授权。 |

后续建议不得直接进入真实 HIS runtime、真实 credential runtime、schema / migration、自动触达、完整 BI、dashboard SQL、audit metadata schema、脱敏工具实现或真实生产数据处理。

最小优先建议是 V1-DASHBOARD-EMPTY-STATE-COPY-01：它可以先以 docs-only / UI-only 的方式收口看板空态、异常态、demo 提示和试运行说明，直接降低 demo / 生产口径混淆风险；它不是 runtime，因为不写 SQL、不实现聚合、不改 schema、不接真实数据源。

## 18. 验收标准

本计划完成后的验收标准：

- 是否定义测试设计原则。
- 是否定义测试对象范围。
- 是否输出三类机会测试矩阵。
- 是否定义状态测试计划。
- 是否定义人工确认测试计划。
- 是否定义看板输入测试计划。
- 是否定义审计输入测试计划。
- 是否定义字段白名单测试计划。
- 是否定义 mock / seed / demo 测试计划。
- 是否定义空态与异常态测试计划。
- 是否只读盘点当前实现证据。
- 是否输出未来测试用例分组。
- 是否明确不实现测试。
- 是否明确不运行测试。
- 是否明确不改 runtime。
- 是否明确不改 schema / migration。
- 是否能作为后续 test-only / UI-only / mock-only PR 的依据。

中文化与术语一致性验收：

- 是否统一使用“客户”作为主称呼，“患者信息”只作为医疗语境补充。
- 是否避免把智美天工写成 HIS 系统。
- 是否避免把测试计划写成测试实现。
- 是否避免把测试计划写成 runtime 许可。
- 是否避免把字段白名单写成 DTO / schema / TypeScript interface。
- 是否避免把审计摘要写成 audit metadata。
- 是否避免把看板指标写成自动营销、成交或医疗效果。
- 是否避免把人工确认写成自动执行。
- 是否明确内部随访任务不是外部消息发送。
- 是否明确预约意向不是真实预约，也不是 HIS 同步。
- 是否没有写入真实客户、真实医院、真实 HIS、真实凭证信息。
- 是否没有写入本地临时附件路径。
- 是否没有大段英文产品说明；技术词、字段名、状态名、命令和文件路径可以保留。

## 19. 验证记录

本次执行过的主要命令：

- `date "+%Y-%m-%d"`
- `date "+%Z %z"`
- `git status --short`
- `git branch --show-current`
- `git log --oneline -n 8`
- `git rev-parse HEAD`
- `git rev-parse main`
- `git rev-parse origin/main`
- `git switch -c docs/v1-opportunity-test-plan-01`
- `wc -l docs/product/zhimeitiangong-product-source-of-truth.md docs/product/zhimeitiangong-module-map.md docs/product/zhimeitiangong-v1-scope.md docs/product/zhimeitiangong-feature-addendum.md docs/product/zhimeitiangong-decision-log.md docs/product/reviews/prod-gap-review-01.md docs/product/contracts/v1-opportunity-contract-01.md docs/product/contracts/v1-dashboard-metrics-contract-01.md docs/product/contracts/v1-manual-confirm-contract-01.md docs/product/contracts/v1-audit-coverage-matrix-01.md docs/product/contracts/v1-field-whitelist-contract-01.md`
- `find docs/product -maxdepth 3 -type d`
- `sed` 只读检查 5 个产品事实源、PROD-GAP-REVIEW-01 和 6 个已合并 V1 契约。
- `rg --files docs src drizzle README.md package.json pnpm-lock.yaml`
- `rg` 只读检查复诊、复购、沉睡、状态、人工确认、看板、审计、字段白名单、mock / seed / demo 相关证据。
- `sed` 只读检查客户摘要、客户 / 预约写入边界、治疗摘要写入边界、审计 domain、schema、看板 view model、随访人工确认、路径分析和 demo seed 相关文件。
- `git status --short`
- `git diff --stat`
- `git diff -- docs/product/test-plans/v1-opportunity-test-plan-01.md`
- `git diff --name-only origin/main..HEAD`
- `rg -n "<本地临时附件路径或粘贴文件名匹配模式>" docs/product/test-plans/v1-opportunity-test-plan-01.md`

本次未运行测试，未运行 runtime，未启动服务，未连接外部业务系统，未连接真实 HIS，未读取真实 credential，未执行 migration，未运行 scheduler / cron / queue / worker，未新增 schema，未新增测试文件，未修复任何发现的问题。

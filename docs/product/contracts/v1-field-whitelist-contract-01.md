# V1-FIELD-WHITELIST-CONTRACT-01：V1 低敏字段白名单与禁止字段契约

## 1. 背景与目标

本契约任务编号为 V1-FIELD-WHITELIST-CONTRACT-01，任务性质为 contract-only / docs-only。任务日期来自本地命令 `date "+%Y-%m-%d"`，结果为 2026-06-09；时区来自本地命令 `date "+%Z %z"`，结果为 CST +0800。

本契约基于以下产品事实源和已完成文档：

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

当前阶段是智美天工 1.0 主线 contract-only 收口阶段。本次任务只定义 V1 低敏字段白名单与禁止字段，不进入 Phase 23 / Phase 24 HIS 风险治理线，不推进真实 HIS、真实 credential、scheduler / worker / queue、schema / migration 或 runtime。

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，1.0 主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是系统主线，不阻塞 1.0。

本契约只定义 V1 字段白名单和禁止字段口径，覆盖机会、人工确认、审计摘要、看板提示、客户档案摘要、治疗后摘要、内部随访任务摘要和 mock / seed / demo 数据标记。字段白名单用于后续 UI-only、mock-only、test-only 或 runtime-later 任务的边界依据。

本契约不实现字段校验器、不实现脱敏工具、不实现 DTO、不实现 schema / migration、不处理真实客户数据。本文中的字段名是产品 / DTO / UI / 审计摘要沟通口径，不是数据库 schema，不是 TypeScript interface，不是 SQL。

## 2. 非目标 / 明确不做

本契约不做：

- runtime。
- UI。
- API。
- DTO。
- schema。
- migration。
- 字段校验器。
- 脱敏工具。
- privacy middleware。
- audit metadata。
- audit enum。
- SQL。
- 数据导出。
- 真实 HIS。
- 真实 credential。
- 真实客户数据处理。
- 真实患者数据导入。
- 自动触达。
- 自动营销。
- AI Agent 自动执行。
- 完整隐私合规系统。
- 测试实现。
- 修复缺口。

本契约也不修改产品事实源原文件、PROD-GAP-REVIEW-01 原报告或既有 V1 契约原文件。

## 3. 字段设计原则

1. 字段服务治疗后客户运营闭环。
2. 字段白名单优先支持机会、人工确认、审计摘要和看板提示。
3. 默认不展示高敏信息。
4. 默认不写入高敏信息。
5. 能用内部 ID 不用真实身份信息。
6. 能用脱敏展示不使用完整原文。
7. 能用摘要不使用全文。
8. 能用短码不使用外部错误全文。
9. 字段不依赖真实 HIS 接入。
10. 字段白名单不要求新增 schema / migration。
11. 字段白名单不代表当前已实现校验。
12. 后续实现必须单独授权。

扩展原则：

- 字段只描述内部运营所需的最小信息，不描述完整医疗事实。
- 字段展示结果不代表真实预约、真实成交、真实支付或真实外部触达。
- AI 相关字段只能表达建议、草稿、提醒或洞察，不能表达自动决策或自动执行。
- 内部随访任务摘要只表示机构内部工作项，不等于微信、企微、短信、电话或外呼已发送。
- 预约意向只表示内部意向，不是真实预约，也不是 HIS 同步。

## 4. 字段敏感级别定义

| 级别 | 定义 | 允许出现的位置 | 示例 | 禁止事项 |
| --- | --- | --- | --- | --- |
| 可展示低敏字段 | 内部人员理解客户运营状态所需，单独出现时风险较低的字段。 | 看板提示、机会卡片、人工确认卡片、客户档案摘要、内部随访任务摘要、审计低敏摘要。 | `customerId`、`lifecycleStatus`、`opportunityType`、`dashboardBucket`。 | 不得夹带完整联系方式、证件、病历正文、支付明细或外部消息原文。 |
| 内部追踪字段 | 用于系统内关联、去重、状态解释或审计追踪的内部 ID / 状态字段。 | 审计摘要、人工确认对象、机会来源摘要、内部任务摘要。 | `sourceId`、`confirmationSubjectId`、`followUpTaskId`、`statusBefore`。 | 不得使用真实外部预约号、HIS raw ID 或真实凭证作为展示字段。 |
| 需脱敏展示字段 | 本身可能关联个人身份，但经过脱敏后可用于内部识别的字段。 | 客户档案摘要、机会卡片、人工确认卡片、客户时间线提示。 | `customerDisplayName`、`maskedPhone`、`maskedMedicalRecordNo`。 | 不得展示完整手机号、完整病历号、身份证号、完整姓名加完整联系方式组合。 |
| 仅可作为存在性提示字段 | 不展示具体内容，只提示存在、不完整、缺失、异常或需人工确认。 | 看板异常态、人工确认异常态、审计低敏原因摘要。 | “来源不完整”“沉睡阈值为试运行口径”“存在高敏备注不可展示”。 | 不得为了说明异常而写入外部错误全文、请求体、SQL、堆栈或高敏正文。 |
| 禁止记录字段 | 不得进入展示、备注、审计摘要、mock / seed / demo、日志或文档示例的高敏内容。 | 不允许出现。 | 完整手机号、身份证号、API Key、Token、HIS raw payload、完整病历正文。 | 不得以“排障”“示例”“临时记录”“备注”名义保存。 |

## 5. 适用对象范围

| 对象 | 字段使用目的 | 允许展示字段类别 | 必须脱敏字段类别 | 禁止字段类别 | 与 V1 主线关系 |
| --- | --- | --- | --- | --- | --- |
| 客户档案 / 患者信息摘要 | 识别客户运营对象和当前生命周期。 | 内部客户 ID、低敏展示名、生命周期、优先级、标签、脱敏联系方式。 | 客户姓名、手机号、病历号、备注。 | 身份证、完整地址、完整病历、完整联系方式、支付信息。 | 客户档案是主线基础对象；患者信息只作医疗语境补充。 |
| 预约 / 到院摘要 | 解释客户旅程节点和待处理状态。 | 预约内部 ID、状态、时间窗口、到院状态、项目摘要。 | 客户展示名、备注。 | HIS raw appointment payload、完整联系方式、外部系统错误全文。 | 支撑预约 / 到院节点和复诊提醒来源。 |
| 项目 / 治疗记录摘要 | 以结构化摘要说明治疗后运营来源。 | 摘要 ID、项目摘要、分类、治疗阶段、恢复阶段、风险摘要。 | 项目备注、低敏摘要。 | 完整病历正文、诊断全文、影像资料、敏感医疗记录。 | 只做摘要，不做完整病历。 |
| 治疗后摘要 | 承接随访建议、复诊提醒和后续动作来源。 | 治疗摘要 ID、阶段、恢复阶段、下一步摘要、风险等级摘要。 | 摘要和备注。 | AI prompt 全文、完整医疗记录、诊疗原文。 | 是治疗后客户运营闭环的关键输入。 |
| 内部随访任务 | 让内部人员处理随访工作项。 | 任务 ID、状态、来源摘要、到期窗口、处理角色、低敏备注。 | 备注、客户展示名。 | 外部消息正文、电话录音、完整联系方式。 | 内部工作项，不等于外部消息发送。 |
| 复诊提醒 | 提示复诊 / 复查 / 状态确认处理窗口。 | 机会类型、标题、来源摘要、处理日期、建议动作、优先级。 | 客户展示名、低敏备注。 | 医疗诊断结论、完整病历、真实预约号。 | 必须人工确认，不自动约诊。 |
| 复购机会 | 提示复购 / 续疗 / 服务延续窗口。 | 机会类型、项目周期摘要、来源摘要、优先级、建议动作。 | 客户展示名、备注。 | 成交金额、真实支付、促销话术全文、外部触达内容。 | 轻量运营提示，不代表成交。 |
| 沉睡客户机会 | 提示长期未互动客户进入人工判断。 | 机会类型、阈值层级、最后互动类型、建议动作、状态。 | 客户展示名、备注。 | 外呼内容、自动唤醒内容、完整联系方式。 | 轻量机会识别，不自动唤醒。 |
| 人工确认对象 | 让内部人员选择处理方向并形成可审计摘要。 | 确认对象类型、ID、动作、状态前后、操作者角色、审计提示。 | 备注、来源摘要、客户展示名。 | 完整病历、HIS raw payload、credential、高敏备注。 | 人工确认是 V1 硬边界。 |
| 基础运营看板提示 | 展示聚合指标、空态、异常态和待处理入口。 | 指标 key、中文名、数量、指标桶、提示文案、demo 标记。 | 下钻客户展示名。 | 客户高敏明细、真实成交金额、支付数据。 | 看板是闭环管理出口，不做完整 BI。 |
| 审计低敏摘要 | 记录动作可追踪语义。 | 资源、动作、原因、角色、状态前后、来源类型、机会类型。 | 备注摘要、客户展示名。 | 完整手机号、身份证、凭证、raw payload、外部错误全文。 | 支撑审计追踪，不新增 audit metadata。 |
| mock / seed / demo 数据说明 | 标记数据来源，避免误认为生产数据。 | `mockSeedDemoFlag`、虚构内部 ID、演示说明。 | 虚构客户名仍需避免逼真身份组合。 | 真实姓名、真实手机号、真实机构、真实 HIS 名称、真实支付。 | 服务演示和验证，不等于真实生产数据。 |

## 6. V1 低敏字段白名单总表

以下总表是产品 / DTO / UI / 审计摘要口径，不是数据库 schema。

| 字段口径 | 中文含义 | 适用对象 | 允许位置 | 敏感级别 | 是否 V1 允许 | 是否需脱敏 | 是否可写入审计摘要 | 边界说明 |
| ---- | ---- | ---- | ---- | ---- | -------- | ----- | --------- | ---- |
| `customerId` | 内部客户 ID | 客户、机会、人工确认、审计、看板下钻 | 卡片、摘要、审计 | 内部追踪字段 | 是 | 否 | 是 | 只能使用系统内 ID，不使用真实身份证明。 |
| `customerDisplayName` | 客户展示名或脱敏展示名 | 客户、机会、人工确认、随访 | UI 卡片、摘要 | 需脱敏展示字段 | 是 | 视情况 | 可写低敏形式 | 使用“客户”作为主称呼，患者信息只作医疗语境补充。 |
| `maskedPhone` | 脱敏手机号 | 客户摘要、必要卡片 | 客户摘要、人工确认卡片 | 需脱敏展示字段 | 是 | 是 | 通常否；必要时只写脱敏值 | 只能是脱敏手机号，不得允许完整手机号。 |
| `maskedMedicalRecordNo` | 脱敏病历号 | 客户摘要、治疗语境 | 客户摘要、治疗后摘要提示 | 需脱敏展示字段 | 是 | 是 | 通常否；必要时只写脱敏值 | 只能是脱敏病历号，不得允许完整病历号。 |
| `lifecycleStatus` | 客户生命周期状态 | 客户、看板、机会来源 | 客户摘要、看板、机会卡片 | 可展示低敏字段 | 是 | 否 | 是 | 可表达咨询、预约、术后、复购窗口、沉睡等状态。 |
| `customerPriority` | 客户内部优先级 | 客户、机会、看板 | 卡片、排序、审计摘要 | 可展示低敏字段 | 是 | 否 | 是 | 优先级必须可解释，不由黑箱 AI 自动决定。 |
| `customerTags` | 客户轻量标签 | 客户、机会来源 | 客户摘要、机会卡片 | 可展示低敏字段 | 是 | 视内容 | 可写低敏标签 | 标签不得包含手机号、证件、病历号原文或高敏备注。 |
| `appointmentId` | 内部预约 ID | 预约、复诊提醒、审计 | 预约摘要、来源摘要 | 内部追踪字段 | 是 | 否 | 是 | 不使用真实外部预约号或 HIS raw ID。 |
| `appointmentStatus` | 预约状态 | 预约、看板、机会来源 | 预约摘要、看板提示 | 可展示低敏字段 | 是 | 否 | 是 | 不代表 HIS 同步结果。 |
| `appointmentTimeWindow` | 预约时间窗口 | 预约、复诊提醒 | 摘要、卡片、看板 | 可展示低敏字段 | 是 | 否 | 可写时间窗口 | 使用窗口或日期，不写客户完整行程隐私。 |
| `arrivalStatus` | 到院状态 | 预约 / 到院摘要 | 摘要、看板 | 可展示低敏字段 | 是 | 否 | 是 | 到院状态不等于完整服务明细。 |
| `treatmentSummaryId` | 治疗摘要 ID | 治疗后摘要、随访、机会 | 摘要、来源、审计 | 内部追踪字段 | 是 | 否 | 是 | 内部摘要 ID，不代表完整病历号。 |
| `treatmentProjectSummary` | 项目 / 治疗项目摘要 | 治疗摘要、机会、随访 | 摘要、卡片 | 可展示低敏字段 | 是 | 视内容 | 可写低敏摘要 | 仅项目摘要，不展示完整治疗记录正文。 |
| `treatmentCategory` | 治疗分类 | 治疗摘要、看板、机会 | 摘要、来源、统计 | 可展示低敏字段 | 是 | 否 | 是 | 用于路径或机会解释，不代表诊断。 |
| `treatmentStage` | 治疗阶段 | 治疗摘要、复诊提醒 | 摘要、卡片、审计 | 可展示低敏字段 | 是 | 否 | 是 | 只表达阶段，例如 D7 复诊，不写诊疗细节全文。 |
| `recoveryStage` | 恢复阶段 | 治疗后摘要、复诊提醒 | 摘要、卡片 | 可展示低敏字段 | 是 | 否 | 是 | 只允许阶段摘要，不写敏感医疗记录。 |
| `followUpTaskId` | 内部随访任务 ID | 随访任务、人工确认、审计 | 任务摘要、审计 | 内部追踪字段 | 是 | 否 | 是 | 内部任务 ID，不等于外部消息 ID。 |
| `followUpStatus` | 随访任务状态 | 内部随访任务、看板 | 卡片、看板、审计 | 可展示低敏字段 | 是 | 否 | 是 | 状态变化只表示内部处理。 |
| `opportunityType` | 机会类型 | 三类机会、看板、审计 | 卡片、指标、审计 | 可展示低敏字段 | 是 | 否 | 是 | 限复诊提醒、复购机会、沉睡客户机会等 V1 口径。 |
| `opportunityLabel` | 机会标题 / 短标签 | 机会卡片、人工确认 | 卡片、摘要 | 可展示低敏字段 | 是 | 视内容 | 可写低敏标签 | 不写医疗结论、成交预测或营销话术全文。 |
| `sourceType` | 来源类型 | 机会、人工确认、审计 | 来源摘要、审计 | 可展示低敏字段 | 是 | 否 | 是 | 可为治疗摘要、预约、随访、生命周期、看板指标、人工录入。 |
| `sourceId` | 来源内部 ID | 机会、人工确认、审计 | 来源摘要、审计 | 内部追踪字段 | 是 | 否 | 是 | 无稳定来源时标记来源不完整，不猜测。 |
| `sourceSummary` | 来源低敏摘要 | 机会、人工确认、随访 | 卡片、审计提示 | 可展示低敏字段 | 是 | 视内容 | 是 | 不得包含 raw payload 或完整病历正文。 |
| `triggerReason` | 触发原因 | 机会、看板、审计 | 卡片、审计摘要 | 可展示低敏字段 | 是 | 否 | 是 | 用低敏短语说明，例如复诊窗口、复购窗口、长期未互动。 |
| `suggestedAction` | 建议内部动作 | 机会、随访、人工确认 | 卡片、确认入口 | 可展示低敏字段 | 是 | 视内容 | 可写动作摘要 | 只表达内部建议，不自动触达或医疗决策。 |
| `priority` | 处理优先级 | 机会、人工确认、看板 | 卡片、排序、审计 | 可展示低敏字段 | 是 | 否 | 是 | 高优先级必须有低敏解释。 |
| `dueDate` | 建议处理日期 / 窗口 | 复诊提醒、随访、看板 | 卡片、指标 | 可展示低敏字段 | 是 | 否 | 可写时间窗口 | 可用日期或窗口，不实现日期计算。 |
| `statusBefore` | 操作前状态 | 人工确认、审计 | 审计摘要、确认结果 | 内部追踪字段 | 是 | 否 | 是 | 用于状态变化说明，不新增状态机。 |
| `statusAfter` | 操作后状态 | 人工确认、审计 | 审计摘要、确认结果 | 内部追踪字段 | 是 | 否 | 是 | 不代表外部动作已发生。 |
| `selectedAction` | 人工选择动作 | 人工确认、审计 | 确认卡片、审计摘要 | 可展示低敏字段 | 是 | 否 | 是 | 必须由内部人员选择，不能由 AI 自动决定。 |
| `operatorRole` | 操作者角色 | 人工确认、审计 | 审计摘要、卡片 | 可展示低敏字段 | 是 | 否 | 是 | 写角色即可，避免写员工个人隐私。 |
| `auditHint` | 审计提示 | 机会、人工确认、看板 | 审计摘要、内部提示 | 可展示低敏字段 | 是 | 视内容 | 是 | 不新增 audit metadata；只写动作、来源和低敏原因。 |
| `dashboardBucket` | 看板指标桶 | 看板、机会 | 看板卡片、机会入口 | 可展示低敏字段 | 是 | 否 | 可写指标 key | 只定义归属，不实现聚合。 |
| `mockSeedDemoFlag` | mock / seed / demo 标记 | 演示数据、看板、审计 | 提示文案、审计摘要 | 可展示低敏字段 | 是 | 否 | 是 | 必须显式标记，避免冒充生产数据。 |
| `lowSensitiveNotes` | 低敏内部备注 | 人工确认、随访、审计 | 备注摘要、确认卡片 | 仅可作为低敏摘要字段 | 是 | 视内容 | 可写低敏摘要 | 必须限制为低敏内部备注，不写高敏全文。 |

## 7. 按对象的字段白名单

### 7.1 客户档案 / 患者信息摘要

系统主线使用“客户”作为主称呼。“患者信息”只作为医疗语境补充，用于说明客户在治疗后运营闭环中的医疗相关摘要，不把智美天工写成 HIS 或电子病历系统。

允许字段：

- `customerId`
- `customerDisplayName`
- `lifecycleStatus`
- `customerPriority`
- `customerTags`
- `maskedPhone`
- `maskedMedicalRecordNo`
- `lowSensitiveNotes`

允许低敏展示客户名 / 脱敏展示名、内部客户 ID、生命周期、优先级、标签、脱敏手机号、脱敏病历号。标签和备注只能是低敏运营摘要。

禁止字段：

- 完整手机号。
- 身份证号。
- 护照号。
- 完整病历号。
- 完整病历正文。
- 完整地址。
- 真实支付信息。
- 客户完整沟通记录。
- 真实外部系统 raw payload。

### 7.2 预约 / 到院摘要

允许字段：

- `appointmentId`
- `appointmentStatus`
- `appointmentTimeWindow`
- `arrivalStatus`
- `treatmentProjectSummary` 或 project summary。
- `customerId`
- `customerDisplayName`

边界：

- 预约摘要只服务客户旅程和到院状态解释。
- 到院状态不等于完整履约记录。
- 预约意向不是真实预约，也不是 HIS 同步。

禁止字段：

- 外部 HIS raw appointment payload。
- 完整联系方式。
- 外部系统错误全文。
- 真实外部预约号。
- 客户完整行程隐私。

### 7.3 治疗后摘要

允许字段：

- `treatmentSummaryId`
- `treatmentProjectSummary`
- `treatmentCategory`
- `treatmentStage`
- `recoveryStage`
- `sourceSummary`
- `suggestedAction`
- `priority`
- `lowSensitiveNotes`

可展示 `nextActionSummary` 和 `riskLevel summary` 这类低敏摘要，但不得把它们写成医疗诊断结论。

禁止字段：

- 完整病历正文。
- 诊断细节全文。
- 影像资料。
- 敏感医疗记录。
- AI prompt 全文。
- AI completion 全文。
- 外部系统同步原文。
- 请求体全文。

### 7.4 内部随访任务

允许字段：

- `followUpTaskId`
- `followUpStatus`
- `sourceSummary`
- `dueDate`
- `operatorRole`
- `customerId`
- `customerDisplayName`
- `suggestedAction`
- `lowSensitiveNotes`

边界：

- 内部随访任务是机构内部工作项。
- 内部随访任务不等于客户已被触达。
- 建议动作只作为内部处理建议，不自动生成外部消息。

禁止字段：

- 外部消息正文。
- 电话录音。
- 微信 / 企微聊天原文。
- 完整客户联系方式。
- 自动触达结果。
- 客户敏感反馈全文。

### 7.5 三类机会

#### 复诊提醒

允许字段：

- `opportunityType`
- `opportunityLabel`
- `customerId`
- `customerDisplayName`
- `sourceType`
- `sourceId`
- `sourceSummary`
- `triggerReason`
- `suggestedAction`
- `priority`
- `dueDate`
- `dashboardBucket`
- `auditHint`
- `mockSeedDemoFlag`

禁止字段：

- 完整病历。
- 医疗诊断结论。
- 真实预约号。
- HIS raw payload。
- 外部消息内容。

#### 复购机会

允许字段：

- `opportunityType`
- `opportunityLabel`
- `customerId`
- `customerDisplayName`
- `sourceSummary`
- `triggerReason`
- `suggestedAction`
- `priority`
- `dashboardBucket`
- `lowSensitiveNotes`

禁止字段：

- 真实成交金额。
- 支付数据。
- 成交预测结论。
- 促销话术全文。
- 自动营销记录。

#### 沉睡客户机会

允许字段：

- `opportunityType`
- `opportunityLabel`
- `customerId`
- `customerDisplayName`
- `sourceSummary`
- `triggerReason`
- `priority`
- `dueDate` 或试运行窗口。
- `dashboardBucket`
- `mockSeedDemoFlag`

禁止字段：

- 完整联系方式。
- 外呼内容。
- 自动唤醒内容。
- 微信 / 企微 / 短信原文。
- 未脱敏地址。

三类机会只作为内部运营提示。机会字段不代表自动触达，不代表成交，不代表医疗效果，也不代表真实预约。

### 7.6 人工确认对象

允许字段：

- `confirmationSubjectType`
- `confirmationSubjectId`
- `customerId`
- `customerDisplayName`
- `sourceType`
- `sourceId`
- `sourceSummary`
- `selectedAction`
- `statusBefore`
- `statusAfter`
- `operatorRole`
- `auditHint`
- `priority`
- `dueDate`
- `lowSensitiveNotes`

禁止字段：

- 完整病历。
- 外部消息内容。
- 真实预约号。
- HIS raw payload。
- credential。
- 高敏备注。
- API Key。
- Token。
- 外部系统错误全文。

### 7.7 基础运营看板提示

允许字段：

- `metricKey`
- 中文指标名。
- `count`
- `dashboardBucket`
- `emptyStateCopy`
- `exceptionStateCopy`
- `mockSeedDemoFlag`
- `sourceType`
- `opportunityType`

禁止字段：

- 客户明细高敏字段。
- 真实成交金额。
- 支付数据。
- 医疗效果判断。
- 外部触达结果。
- 完整 BI 明细导出。

### 7.8 审计低敏摘要

允许字段：

- `resourceType`
- `resourceId`
- `actionSummary`
- `reasonSummary`
- `actorRole`
- `tenantScope`
- `statusBefore`
- `statusAfter`
- `opportunityType`
- `sourceType`
- `sourceId`
- `selectedAction`
- `priority`
- `dueDate`
- `mockSeedDemoFlag`

禁止字段：

- 完整手机号。
- 身份证。
- credential。
- API Key。
- Token。
- HIS raw payload。
- 外部错误全文。
- 完整病历。
- 外部消息内容。
- 请求体全文。
- SQL 或服务端堆栈。

## 8. 必须脱敏字段

| 字段类别 | 允许展示方式 | 禁止展示方式 | 是否可写入审计摘要 | 后续实现注意事项 |
| --- | --- | --- | --- | --- |
| 手机号 | `maskedPhone`，例如中间位隐藏或 demo 脱敏占位。 | 完整手机号、手机号原文、可还原手机号。 | 原则上否；必要时只写脱敏值。 | 只定义口径，不实现脱敏函数，不写正则。 |
| 病历号 | `maskedMedicalRecordNo` 或内部脱敏病历展示值。 | 完整病历号、HIS 病历号原文。 | 原则上否；必要时只写脱敏值。 | 不把病历号当作客户主 ID。 |
| 客户姓名 / 患者姓名 | 展示名、脱敏展示名、客户甲 / 客户乙等占位。 | 姓名 + 完整手机号 / 证件 / 地址组合。 | 可写低敏展示名或内部客户 ID。 | 医疗语境可称患者信息，但主称呼仍为客户。 |
| 备注 | 低敏内部备注摘要。 | 高敏备注全文、病情细节、沟通原文。 | 可写低敏摘要。 | `lowSensitiveNotes` 必须有长度和内容边界，后续实现单独授权。 |
| 地址 | 城市级或模糊区域提示。 | 完整地址、门牌、身份证住址。 | 原则上否。 | V1 不需要地址字段。 |
| 证件相关描述 | 仅提示“证件信息不可展示 / 不可记录”。 | 身份证号、护照号、证件照片。 | 否。 | 审计和备注都不得保存。 |
| 外部系统标识 | 安全短码、内部来源类型、脱敏外部 ID。 | HIS raw ID、外部 raw payload、真实预约号。 | 可写来源类型和内部 ID。 | 真实 HIS 后置，不阻塞 V1。 |
| 医生 / 员工个人信息 | 角色或岗位，例如咨询师、客服、医助。 | 员工个人隐私、完整联系方式、身份证。 | 可写 `operatorRole`。 | 不用个人敏感信息解释动作。 |
| 机构内部敏感配置 | 仅显示配置存在性或安全状态。 | 生产环境变量、连接串、endpoint、密钥。 | 否。 | 不接 credential runtime。 |

## 9. 禁止记录字段

以下字段不得写入 V1 展示、审计摘要、备注、mock / seed / demo 数据、文档示例或日志：

- 完整手机号。
- 身份证号。
- 护照号。
- 完整病历号。
- 完整病历正文。
- 影像资料。
- 高敏医疗记录。
- 真实 credential。
- API Key。
- Token。
- Cookie。
- Session。
- OAuth secret。
- Webhook secret。
- 数据库连接串。
- HIS raw payload。
- 外部系统错误全文。
- 真实支付信息。
- 成交金额明细。
- 微信 / 企微 / 短信 / 电话内容原文。
- 电话录音。
- 未脱敏地址。
- 生产环境变量。
- SQL 或服务端堆栈。
- 医生个人敏感信息。
- 员工个人隐私信息。
- AI prompt 全文。
- AI completion 全文。
- 请求体全文。
- 响应体全文。

禁止记录字段不能以“临时排障”“内部备注”“demo 样例”“审计 metadata”“外部错误说明”等名义绕过。

## 10. 允许写入审计摘要的字段

审计摘要允许字段如下。本节不写 audit schema，不新增 audit metadata，不新增 audit enum，不写 JSON schema，不写 TypeScript interface。

| 字段 | 允许口径 | 禁止边界 |
| --- | --- | --- |
| `resourceType` | 客户档案、预约、治疗摘要、内部随访任务、机会、人工确认对象、看板指标等资源类型。 | 不新增数据库资源枚举。 |
| `resourceId` | 内部资源 ID。 | 不写真实外部预约号、HIS raw ID 或证件号。 |
| `actionSummary` | 创建、编辑、作废、进入待确认、人工确认、忽略、转内部随访、转预约意向等动作摘要。 | 不写外部动作结果。 |
| `reasonSummary` | 低敏原因摘要或 reason 短码。 | 不写外部错误全文、完整病历或备注全文。 |
| `actorRole` | 操作者角色。 | 不写员工个人隐私。 |
| `tenantScope` | 租户范围或平台 / 机构范围。 | 不泄露跨租户客户明细。 |
| `sourceType` | 治疗摘要、预约、随访任务、生命周期、看板指标、人工录入等来源类型。 | 不写 raw source payload。 |
| `sourceId` | 内部来源 ID。 | 不写外部系统原始 ID。 |
| `opportunityType` | 复诊提醒、复购机会、沉睡客户机会。 | 不扩成自动营销或医疗效果口径。 |
| `statusBefore` | 操作前状态。 | 不新增状态机实现。 |
| `statusAfter` | 操作后状态。 | 不代表外部动作已完成。 |
| `selectedAction` | 人工选择动作。 | 不允许 AI 自动决定。 |
| `priority` | 低 / 中 / 高或等价优先级。 | 不写无法解释的黑箱评分。 |
| `dueDate window` | 今日、本周、试运行窗口、逾期窗口等时间窗口。 | 不写客户完整行程隐私。 |
| `mockSeedDemoFlag` | mock / seed / demo 标记。 | 不把 demo 数据冒充生产数据。 |

## 11. 允许展示在看板 / 机会卡片 / 人工确认卡片的字段

### 11.1 看板指标卡片

允许字段：

- `metricKey`
- 中文指标名。
- `count`
- `dashboardBucket`
- `emptyStateCopy`
- `exceptionStateCopy`
- `mockSeedDemoFlag`
- `opportunityType`
- `sourceType`

禁止字段：

- 客户完整明细。
- 完整联系方式。
- 支付金额。
- 成交金额。
- 外部触达结果。
- 医疗效果判断。
- SQL、查询条件全文或服务端堆栈。

### 11.2 机会卡片

允许字段：

- `opportunityType`
- `opportunityLabel`
- `customerId`
- `customerDisplayName`
- `sourceType`
- `sourceId`
- `sourceSummary`
- `triggerReason`
- `suggestedAction`
- `priority`
- `dueDate`
- `dashboardBucket`
- `mockSeedDemoFlag`

禁止字段：

- 完整手机号。
- 完整病历。
- 诊断全文。
- 真实预约号。
- 促销话术全文。
- 外部消息原文。
- 真实支付或成交数据。

### 11.3 人工确认卡片

允许字段：

- `confirmationSubjectType`
- `confirmationSubjectId`
- `customerId`
- `customerDisplayName`
- `sourceSummary`
- `selectedAction`
- `statusBefore`
- `statusAfter`
- `operatorRole`
- `priority`
- `dueDate`
- `auditHint`
- `lowSensitiveNotes`

禁止字段：

- 完整病历。
- 外部消息内容。
- 真实预约号。
- HIS raw payload。
- credential。
- 高敏备注。
- 客户完整联系方式。

### 11.4 客户时间线提示

允许字段：

- 客户低敏摘要。
- 预约摘要。
- 治疗摘要节点。
- 内部随访任务摘要。
- 人工确认动作摘要。
- 审计低敏摘要。
- `mockSeedDemoFlag`。

禁止字段：

- 完整时间线高敏正文。
- 完整病历正文。
- 咨询对话全文。
- 电话录音。
- 微信 / 企微 / 短信原文。
- 请求体全文。
- 外部系统 raw payload。

本节只定义产品展示边界，不实现 UI，不修改 UI 文案，不处理真实数据。

## 12. mock / seed / demo 数据字段规则

mock / seed / demo 数据必须显式标记。`mockSeedDemoFlag` 可表达为 `mock`、`seed`、`demo`、`trial_demo`、`internal_validation` 或等价中文说明，但后续实现需单独统一。

规则：

- demo 数据不得冒充真实生产数据。
- demo 客户不得使用真实姓名、手机号、身份证、真实医院、真实机构、真实 HIS 名称。
- demo 数据可以使用虚构内部 ID。
- demo 数据可以使用“客户甲 / 客户乙 / CUST-DEMO-001”这类低敏占位。
- demo 数据不得包含真实支付、真实病历、真实联系方式、真实外部消息内容。
- demo 机会不得写成真实成交、真实触达或真实医疗效果。
- demo 看板必须提示演示 / mock / seed 口径，避免被误认为生产指标。
- demo 审计摘要只能记录虚构资源 ID、动作摘要、角色和低敏原因。

当前仓库已有 `src/server/db/seed-demo-data.ts` 作为 demo seed 入口，且存在 demo seed 生产保护提示。后续如需调整 seed 或 mock 数据，必须另行授权；本契约不修改 seed。

## 13. 与人工确认契约的关系

字段白名单约束以下人工确认内容：

- 确认对象：只能展示对象类型、内部 ID、客户低敏摘要和来源低敏摘要。
- 确认入口：只能从治疗后摘要、机会卡片、看板下钻或客户时间线提示进入，不展示高敏正文。
- 确认动作：只允许内部动作，例如转内部随访、形成预约意向、继续观察、完成、忽略、修改优先级和补充低敏备注。
- 确认结果：只表达内部状态变化，不代表客户已被触达。
- 低敏备注：只能记录内部运营说明，不能记录高敏备注全文。
- 优先级修改：必须有低敏解释，不能由黑箱 AI 自动完成。
- 状态变化：允许写 `statusBefore` / `statusAfter`，不新增状态机。
- 转内部随访任务：只表示内部任务，不是外部消息发送。
- 转预约意向：只表示预约方向，不是真实预约，也不是 HIS 同步。

必须明确：

- 字段白名单不触发动作。
- 字段白名单不替代人工确认。
- 字段白名单不代表客户已被触达。
- 字段白名单不代表真实预约或成交。

## 14. 与审计覆盖矩阵的关系

字段白名单约束以下审计覆盖内容：

- 审计资源：只写内部资源类型和内部资源 ID。
- 审计动作：只写动作语义摘要，不新增 audit enum。
- 审计原因：只写低敏原因摘要或稳定短码。
- 低敏摘要：只写对象类型、来源类型、状态变化、操作者角色、时间窗口和 mock / seed / demo 标记。
- 禁止记录内容：不得记录完整手机号、身份证、credential、HIS raw payload、外部错误全文、完整病历或外部消息内容。
- 三类机会审计：可写机会类型、来源摘要、状态前后、选中动作和低敏备注摘要。
- 人工确认审计：可写确认对象、状态变化、选中动作、操作者角色和低敏原因。
- 看板指标审计：可写指标 key、指标桶、口径变更摘要和 demo 标记。

必须明确：

- 不新增 audit schema。
- 不新增 audit metadata。
- 不新增 audit enum。
- 不继续 HIS compensation audit runtime。

## 15. 与看板指标契约的关系

字段白名单约束以下看板内容：

- 看板指标卡片：只展示指标 key、中文名、数量、指标桶、空态 / 异常态提示和 demo 标记。
- 指标下钻：只允许进入低敏客户摘要或确认对象摘要。
- 空态提示：只说明当前没有待处理对象，不得暗示所有历史客户都已处理完。
- 异常态提示：只提示来源缺失、时间窗口缺失、阈值待确认或数据为 demo，不展示错误全文。
- mock / seed / demo 提示：必须显式说明数据口径。
- 客户明细低敏展示：只展示内部客户 ID、脱敏展示名、生命周期、优先级和机会摘要。

必须明确：

- 不实现 dashboard runtime。
- 不写 SQL。
- 不写聚合函数。
- 不做完整 BI。
- 看板指标不代表客户已被触达、真实成交、真实预约、真实支付或医疗效果。

## 16. 与现有仓库实现的只读证据

本节只读盘点当前仓库中与字段、脱敏、审计摘要和看板字段边界相关的证据。本契约不修改任何实现，不补测试，不补 runtime。

| 检查项 | 只读证据 | 判断 |
| --- | --- | --- |
| 是否已有脱敏手机号字段 / 展示 | `src/modules/institution/domain/customer-records.ts` 定义 `maskedPhone`；`src/server/db/schema.ts` 的 `customers` 表含 `masked_phone`；`src/server/db/seed-demo-data.ts` 使用脱敏手机号。 | 已有局部脱敏手机号字段。 |
| 是否已有脱敏病历号字段 / 展示 | `customer-records.ts` 定义 `maskedMedicalRecordNo`；`schema.ts` 的 `customers` 表含 `masked_medical_record_no`；seed 使用脱敏病历号。 | 已有局部脱敏病历号字段。 |
| 是否已有客户生命周期 / 优先级 / 标签 | `customer-records.ts` 定义 `lifecycle`、`priority`、`tags`；`schema.ts` 定义 `customer_lifecycle` 和 `customer_priority`；看板 view model 使用 `repurchase_window`。 | 已有生命周期、优先级和标签。 |
| 是否已有治疗摘要字段白名单 | `src/modules/institution/server/treatment-summary-write-input.ts` 定义创建 / 更新治疗摘要允许键，包括 `treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`riskLevel`、`summary`、`nextCareAction`、`tags`。 | 已有治疗摘要 parser 白名单。 |
| 是否已有客户 / 预约写入低敏边界 | `src/modules/institution/server/tenant-business-write-input.ts` 只允许客户和预约白名单字段，并拒绝 `phoneNumber`、`idNumber`、`medicalRecordNo`、`treatmentRecord`、`consultationTranscript` 等字段。 | 已有局部写入边界。 |
| 是否已有 audit domain / repository 不携带高敏全文 | `src/modules/audit/domain/audit-events.ts` 的审计事件只包含 actor、tenant、resource、resourceId、action、result、reason、occurredAt、source；`schema.ts` 的 `audit_events` 表没有 metadata 列；`audit-event-dto.ts` 只映射标准审计字段。 | 审计底座当前不携带 metadata 或请求体全文。 |
| 是否已有 mock / seed / demo 数据 | `package.json` 有 `db:seed`；`src/server/db/seed-demo-data.ts` 包含 demo tenants、customers、appointments、treatment summaries、follow-up tasks 和 audit events；并有 demo seed 生产保护提示。 | 已有 demo seed 数据。 |
| 是否已有看板低敏指标 | `src/modules/workspace/domain/institution-dashboard-view-models.ts` 定义客户总数、高优先级客户、待确认预约、待处理随访、复购窗口期等指标。 | 有基础看板指标，但不是本契约要求的统一字段白名单。 |
| 是否已有三类机会统一对象字段 | 前序契约已定义机会字段；当前 runtime 证据主要是 lifecycle、seed、随访建议和看板统计。 | 缺统一 opportunity runtime 字段白名单落地。 |
| 是否已有人工确认备注低敏字段 | 人工确认契约定义 `notes` / 低敏备注；当前实现中治疗摘要随访确认局部存在，统一三类机会备注未 runtime 落地。 | 缺统一低敏备注白名单落地。 |
| 当前缺少哪些统一字段白名单 | 未发现单一文档同时覆盖机会、人工确认、审计摘要、看板提示、客户摘要、治疗摘要、随访任务和 mock / seed / demo 标记的字段边界。 | 本契约补齐产品口径，不实现 runtime。 |

只读判断：

- 现有实现已经有若干局部安全边界，包括脱敏手机号、脱敏病历号、客户写入白名单、治疗摘要写入白名单、审计无 metadata 和 demo seed 标记方向。
- 现有实现尚缺统一的 V1 字段白名单契约，尤其是机会卡片、人工确认备注、审计低敏摘要、看板下钻和 demo 数据标记之间的统一口径。
- 本契约不把局部 parser、schema 或测试扩展为新的 runtime 授权。

## 17. 缺口与风险

### P1

- 机会卡片字段白名单未落地风险：复诊提醒、复购机会和沉睡客户机会的产品字段已在契约中定义，但若 UI-only / mock-only 后续 PR 没有统一白名单，可能夹带完整联系方式、完整病历或外部消息内容。
- 人工确认低敏备注边界不清风险：人工确认备注若没有 `lowSensitiveNotes` 边界，容易写入手机号、病历正文、外部错误全文或高敏业务备注。
- 审计摘要字段边界不清风险：审计覆盖矩阵要求低敏摘要，但缺少统一字段白名单会导致后续审计摘要夹带高敏内容。
- 看板下钻客户明细泄露风险：指标下钻如果直接展示客户明细，可能绕过看板聚合口径和低敏摘要要求。

### P2

- mock / seed / demo 被误认为生产数据风险：当前仓库已有 demo seed 和演示指标，如果后续不显式标记，评审或演示可能把 demo 指标误读为真实生产结果。
- HIS raw payload 或外部错误全文误入摘要风险：历史 HIS 文档和 runtime 边界较多，后续如果以排障为由把 raw payload 或外部错误全文写入 `sourceSummary`、`auditHint` 或备注，会偏离 V1 低敏边界。
- 后续 UI-only / mock-only PR 不知道哪些字段可展示风险：没有本契约前，后续 UI mock 可能每个页面各自定义展示字段，导致客户摘要、机会卡片、看板提示和人工确认卡片口径不一致。

### P3

- 客户姓名展示粒度仍需后续实现收口：本契约允许客户展示名或脱敏展示名，但不实现姓名脱敏策略。
- 医生 / 员工个人信息展示边界仍需 UI 侧细化：本契约建议优先显示角色，不显示员工个人隐私；后续 UI-only PR 需按场景决定是否展示人员名称。
- 指标空态与异常态文案仍需小 PR 收口：本契约只定义字段边界，不写 UI 文案。

## 18. 后续 PR 拆分建议

| PR 编号 | 类型 | 目标 | 允许修改范围 | 禁止范围 | 是否阻塞 V1 | 依赖关系 |
| --- | --- | --- | --- | --- | --- | --- |
| V1-OPPORTUNITY-TEST-PLAN-01 | docs-only / test-only plan | 定义三类机会未来测试应覆盖的字段、状态、人工确认、看板输入和低敏边界。 | docs-only；后续若单独批准可限测试计划文档。 | runtime、schema / migration、真实 HIS、自动触达、脱敏工具实现。 | 否 | 依赖机会契约、人工确认契约、本契约。 |
| V1-DASHBOARD-EMPTY-STATE-COPY-01 | docs-only / UI-only | 收口看板空态、异常态、demo 提示和试运行说明文案。 | `docs/product/**`；后续批准后可限 UI 文案。 | dashboard runtime、SQL、聚合函数、完整 BI、客户高敏明细。 | 否 | 依赖看板指标契约、本契约。 |
| V1-REVISIT-UI-MOCK-01 | UI-only / mock-only | 展示复诊提醒列表、低敏机会卡片、人工确认入口和空态。 | 后续明确批准后限 UI / mock / 组件测试范围。 | schema、migration、真实 HIS、真实预约同步、自动触达、完整病历。 | 是 | 依赖机会契约、人工确认契约、字段白名单。 |
| V1-REPURCHASE-DORMANT-UI-MOCK-01 | UI-only / mock-only | 展示复购和沉睡机会卡片、状态、低敏来源摘要和看板入口。 | 后续明确批准后限 UI / mock / 组件测试范围。 | 新表、scheduler、自动营销、外部消息、schema / migration、真实生产数据。 | 是 | 依赖机会契约、看板契约、人工确认契约、本契约。 |
| V1-AUDIT-TEST-PLAN-01 | docs-only / test-only plan | 定义 V1 审计最小测试计划，锁定低敏摘要和禁止字段。 | docs-only；后续若单独批准可限测试计划文档或测试文件。 | 修改生产 runtime、扩 audit enum、audit metadata schema、migration。 | 是 | 依赖审计覆盖矩阵、本契约。 |
| V1-FIELD-WHITELIST-TEST-PLAN-01 | docs-only / test-only plan | 定义未来字段白名单验证用例，包括客户摘要、机会卡片、人工确认备注、审计摘要和 demo 数据标记。 | docs-only；后续若单独批准可限测试计划文档。 | 字段校验器实现、脱敏工具实现、DTO 实现、schema / migration。 | 否 | 依赖本契约。 |

后续建议不得直接进入真实 HIS runtime、真实 credential runtime、schema / migration、自动触达、完整 BI、dashboard SQL、audit metadata schema、脱敏工具实现或真实生产数据处理。

## 19. 验收标准

本契约完成后的验收标准：

- 是否定义字段敏感级别。
- 是否定义适用对象范围。
- 是否输出 V1 低敏字段白名单总表。
- 是否按对象输出字段白名单。
- 是否定义必须脱敏字段。
- 是否定义禁止记录字段。
- 是否定义允许写入审计摘要字段。
- 是否定义看板 / 机会卡片 / 人工确认卡片展示字段。
- 是否定义 mock / seed / demo 字段规则。
- 是否定义与人工确认、审计覆盖、看板指标的关系。
- 是否只读盘点当前实现证据。
- 是否输出缺口与风险。
- 是否明确不做 runtime。
- 是否明确不做 UI / API / DTO / 校验器 / 脱敏工具。
- 是否明确不做 schema / migration。
- 是否明确不处理真实客户数据。
- 是否能作为后续 UI-only / mock-only / test-only PR 的依据。
- 是否统一使用“客户”作为主称呼，“患者信息”只作为医疗语境补充。
- 是否避免把智美天工写成 HIS 系统。
- 是否避免把字段白名单写成代码实现、数据库 schema、DTO 或 TypeScript interface。
- 是否避免把低敏摘要写成完整审计 metadata。
- 是否明确内部随访任务不是外部消息发送。
- 是否明确预约意向不是真实预约，也不是 HIS 同步。
- 是否没有写入真实客户、真实医院、真实 HIS、真实凭证信息。
- 是否没有写入本地临时附件路径或粘贴文件名。

## 20. 验证记录

本次执行过的主要命令：

- `date "+%Y-%m-%d"`
- `date "+%Z %z"`
- `git status --short`
- `git branch --show-current`
- `git log --oneline -n 8`
- `git rev-parse HEAD`
- `git rev-parse main`
- `git rev-parse origin/main`
- `git switch -c docs/v1-field-whitelist-contract-01`
- `wc -l docs/product/zhimeitiangong-product-source-of-truth.md`
- `wc -l docs/product/zhimeitiangong-module-map.md`
- `wc -l docs/product/zhimeitiangong-v1-scope.md`
- `wc -l docs/product/zhimeitiangong-feature-addendum.md`
- `wc -l docs/product/zhimeitiangong-decision-log.md`
- `wc -l docs/product/reviews/prod-gap-review-01.md`
- `wc -l docs/product/contracts/v1-opportunity-contract-01.md`
- `wc -l docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `wc -l docs/product/contracts/v1-manual-confirm-contract-01.md`
- `wc -l docs/product/contracts/v1-audit-coverage-matrix-01.md`
- `sed` 只读检查 5 个产品事实源、PROD-GAP-REVIEW-01 和 4 个前序契约。
- `sed` 只读检查 `docs/ai-agent-governance.md`。
- `find docs/product -maxdepth 2 -type d`
- `find docs/product/contracts -maxdepth 1 -type f`
- `rg --files docs src drizzle README.md package.json pnpm-lock.yaml`
- `rg` 只读检查脱敏手机号、脱敏病历号、客户生命周期、优先级、标签、治疗摘要、审计摘要、看板字段和 demo seed 相关证据。
- `sed` 只读检查客户、预约、治疗摘要、随访任务、客户时间线、看板 view model、审计 domain、审计 DTO、审计 repository、schema 和 demo seed 相关文件。
- `git diff --stat`
- `git diff -- docs/product/contracts/v1-field-whitelist-contract-01.md`
- `git diff --name-only origin/main..HEAD`
- 本地临时附件路径检查命令，确认本文档未包含临时附件路径或粘贴文件名。

本次未运行 runtime，未启动服务，未连接外部业务系统，未连接真实 HIS，未读取真实 credential，未执行 migration，未运行 scheduler / cron / queue / worker，未新增 schema，未新增测试，未修复任何发现的问题。

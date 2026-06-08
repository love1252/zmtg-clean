# V1-OPPORTUNITY-CONTRACT-01：复诊 / 复购 / 沉睡机会轻量契约

## 1. 背景与目标

本契约任务编号为 V1-OPPORTUNITY-CONTRACT-01，任务性质为 contract-only / docs-only。任务日期来自本地命令 `date "+%Y-%m-%d %Z %z"`，结果为 2026-06-08 CST +0800。

本契约以以下产品事实源为准：

- `docs/product/zhimeitiangong-product-source-of-truth.md`
- `docs/product/zhimeitiangong-module-map.md`
- `docs/product/zhimeitiangong-v1-scope.md`
- `docs/product/zhimeitiangong-feature-addendum.md`
- `docs/product/zhimeitiangong-decision-log.md`
- `docs/product/reviews/prod-gap-review-01.md`

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，1.0 主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是系统主线，不阻塞 1.0。

本契约只定义 1.0 范围内的三类轻量机会：复诊提醒、复购机会、沉睡客户机会。三类机会都是给机构运营人员、咨询师、客服或复诊复购负责人看的内部运营提示，不是自动营销，不生成自动化诊疗建议，也不是 AI Agent 自动执行。

三类机会在 1.0 中必须经过人工确认，才能进入内部随访任务、预约意向或其他客户运营处理。未人工确认前，机会不得进入外部自动触达、不得自动创建外部消息、不得生成医疗建议、不得触发真实第三方系统动作。

## 2. 非目标 / 明确不做

本 PR 只新增本契约文档，不修复问题，不实现功能。

本 PR 明确不做：

- 不做 runtime。
- 不做 UI。
- 不改 `src/**`、`app/**`、`components/**`、`lib/**`、`packages/**`。
- 不改 `drizzle/**`。
- 不新增 schema。
- 不新增 migration。
- 不改 `package.json` 或 lockfile。
- 不新增依赖。
- 不新增测试。
- 不启动 app 或 dev server。
- 不运行数据库 migration。
- 不运行 scheduler / cron / queue / worker。
- 不实现真实 HIS adapter runtime。
- 不实现真实 credential provider runtime。
- 不读取真实 credential。
- 不接入真实 HIS。
- 不发起外部业务网络连接。
- 不实现真实外部系统同步。
- 不实现自动外呼、自动微信、自动企微、短信或电话触达。
- 不实现自动营销。
- 不实现 AI Agent 自动执行。
- 不实现 AI 自动化诊疗建议或医疗判断。
- 不做完整 BI。
- 不做真实消息发送。
- 不做真实客户、医院、HIS、凭证或外部机构数据处理。
- 不修改本契约依赖的 6 个产品事实源原文件。

本契约不继续推进 CONFIG-PLAN-01、SCHEDULER-PLAN-01、AUDIT-PLAN-01、OBS-PLAN-01、SCHEMA-REVIEW-01，也不继续推进 Phase 23 / Phase 24 HIS 风险治理线。

## 3. 术语定义

以下术语是产品 / DTO / UI 层契约名称，不是数据库 schema、不是 TypeScript interface、不是 SQL 设计。

| 术语 | 辅助英文名 | 契约定义 | 边界 |
| --- | --- | --- | --- |
| 机会 | Opportunity | 系统基于客户档案、预约、治疗摘要、随访结果、生命周期或人工录入信息形成的内部运营提示。 | 只提示内部人员处理，不代表自动执行，不代表外部触达。 |
| 复诊提醒 | Revisit Reminder | 围绕治疗后阶段、恢复阶段、复诊节点或复查需求形成的内部提醒。 | 不是医疗诊断，不自动约诊，不发起对客联系动作。 |
| 复购机会 | Repurchase Opportunity | 围绕项目周期、历史消费、治疗摘要、随访结果或客户生命周期形成的轻量复购 / 续疗提示。 | 不做自动营销，不做成交判断，不自动推送优惠或销售话术。 |
| 沉睡客户机会 | Dormant Customer Opportunity | 面向较长时间未预约、未到院、未随访或未互动客户的轻量激活提示。 | 不自动唤醒，不自动发送消息，沉睡阈值需产品确认。 |
| 人工确认 | Manual Confirmation | 由机构人员明确确认机会是否应继续处理，以及处理方向是什么。 | 是 1.0 的硬边界；AI / 规则只能建议，不能越过人工确认。 |
| 内部随访任务 | Internal Follow-up Task | 给机构内部人员处理的随访或客户运营任务。 | 不等于外部消息发送，不等于已联系客户。 |
| 预约意向 | Appointment Intent | 人工确认后，内部记录“可能需要复诊、复查或服务预约”的意向。 | 不等于真实预约已创建，不等于 HIS 同步。 |
| 看板输入 | Dashboard Input | 给基础运营看板使用的指标输入口径。 | 不是 dashboard runtime、SQL、聚合函数或完整 BI。 |
| 自动触达 | Auto Outreach | 系统在无人确认下向客户发送微信、企微、短信、电话、外呼、营销消息或医疗建议。 | 1.0 明确不做，机会契约必须显式禁止。 |

## 4. 三类机会定义

### 4.1 复诊提醒

复诊提醒是治疗后客户运营闭环中的内部提醒，用于提示运营人员、客服、咨询师或复诊负责人关注客户是否需要复诊、复查、状态确认或预约意向跟进。

可用来源包括：

- 客户档案 / 患者信息中的生命周期、标签或服务记录摘要。
- 预约 / 到院状态。
- 项目 / 治疗记录摘要。
- 治疗后摘要中的治疗项目、治疗阶段、恢复阶段、风险提示和下一步建议。
- 随访任务状态和随访结果。
- 复诊相关预约状态。
- 静态 SOP / 路径模板中的复诊节点。

V1 目标：

- 提醒内部人员考虑是否需要复诊、复查或状态确认。
- 帮助把治疗后摘要和随访任务串到复诊处理。
- 为基础运营看板提供待处理复诊提醒输入。

V1 边界：

- 只做内部提醒和人工确认。
- 不做自动约诊。
- 不做自动触达。
- 不做自动化诊疗判断或面向客户的医疗建议。
- 不因 HIS 未接入而阻塞。

### 4.2 复购机会

复购机会是给机构内部人员使用的轻量运营提示，用于判断客户是否进入复购、续疗、项目补充或服务延续的可处理窗口。

可用来源包括：

- 客户生命周期和轻量标签。
- 项目周期或治疗后周期。
- 历史消费、历史治疗或历史预约摘要。
- 治疗后摘要中的下一步建议。
- 随访结果中的意向、满意度、异常反馈或未完成事项。
- 预约状态、到院状态和服务完成状态。

V1 目标：

- 提示运营人员判断是否存在复购、续疗、项目补充或服务延续机会。
- 为人工确认后的内部随访或客户运营动作提供依据。
- 为基础运营看板提供待处理复购机会输入。

V1 边界：

- 不做自动营销。
- 不做自动成交判断。
- 不自动生成或发送促销消息。
- 不把 AI 建议当成销售结论。
- 不因真实 HIS、真实支付或完整消费系统未接入而阻塞。

### 4.3 沉睡客户机会

沉睡客户机会是面向较长时间未预约、未到院、未随访或未互动客户的轻量激活提示，用于提醒内部人员判断是否需要继续观察、人工跟进或建立内部随访任务。

可用来源包括：

- 客户最后一次治疗时间。
- 客户最后一次预约、到院或取消记录。
- 客户最后一次随访任务和随访结果。
- 客户生命周期状态。
- 轻量标签或运营分层。

V1 目标：

- 提示长期无互动客户进入人工判断范围。
- 帮助运营人员决定继续观察、内部随访、预约意向或忽略。
- 为基础运营看板提供待处理沉睡客户机会输入。

V1 边界：

- 不锁定具体沉睡天数为系统规则。
- 可以在试运行中使用“30 / 60 / 90 天分层”或“项目周期外 N 天”作为 V1 试运行候选阈值，但必须标记为待产品确认。
- 不做自动唤醒。
- 不做自动触达。
- 不做自动营销。
- 不因真实 HIS 或真实消息渠道未接入而阻塞。

## 5. 统一机会字段契约

以下字段是产品 / DTO / UI 契约，用于后续 UI-only、mock-only、test-only 或 runtime-later 任务沟通边界。它们不是数据库字段定义，不是 TypeScript interface，不是 SQL 或 migration。

| 字段 | 中文含义 | V1 必需 | 适用机会类型 |
| --- | --- | --- | --- |
| `opportunityType` | 机会类型，用于区分复诊提醒、复购机会、沉睡客户机会。 | 是 | common |
| `opportunityLabel` | 面向内部人员展示的机会标题或短标签。 | 是 | common |
| `customerId` | 客户在系统内的稳定标识。 | 是 | common |
| `customerDisplayName` | 可展示的客户名称或脱敏展示名。 | 是 | common |
| `sourceType` | 机会来源类型，例如治疗摘要、预约、随访任务、生命周期、人工录入或静态模板。 | 是 | common |
| `sourceId` | 来源对象的系统内标识；没有稳定来源时可为空并说明原因。 | 否 | common |
| `sourceSummary` | 来源摘要，供内部人员理解机会从何而来。 | 是 | common |
| `triggerReason` | 触发原因，例如 D7 复诊确认、项目周期进入复购窗口、较长时间无互动。 | 是 | common |
| `suggestedAction` | 建议的内部处理动作，例如人工确认恢复状态、建立内部随访、继续观察。 | 是 | common |
| `priority` | 内部处理优先级，建议使用低 / 中 / 高或等价产品文案。 | 是 | common |
| `dueDate` | 建议处理日期或时间窗口；复诊提醒通常需要，复购和沉睡可按试运行口径简化。 | 复诊必需，其他可选 | revisit / repurchase / dormant |
| `status` | 机会状态，状态集合见“状态流转契约”。 | 是 | common |
| `requiresManualConfirmation` | 是否必须人工确认；V1 三类机会均应为是。 | 是 | common |
| `forbidAutoReachOut` | 是否禁止自动触达；V1 三类机会均应为是。 | 是 | common |
| `dashboardBucket` | 进入看板时归属的指标桶，例如待处理复诊、待确认复购、沉睡机会。 | 是 | common |
| `auditHint` | 后续审计覆盖矩阵使用的动作提示，不代表本 PR 实现审计。 | 否 | common |
| `createdFrom` | 机会生成方式，例如规则提示、AI 辅助建议、人工录入、mock / seed。 | 是 | common |
| `notes` | 内部备注，只能记录产品允许的低敏信息。 | 否 | common |

字段约束：

- `requiresManualConfirmation` 在 V1 三类机会中必须为是。
- `forbidAutoReachOut` 在 V1 三类机会中必须为是。
- `createdFrom` 如果包含 AI 辅助，也只能表达“建议 / 草稿 / 提醒”，不能表达“自动决策 / 自动执行”。
- `sourceSummary` 和 `notes` 不得包含真实凭证、完整病历正文、真实 HIS raw payload、密钥、API Key、外部系统错误全文或高敏个人信息。
- `dashboardBucket` 只定义看板输入口径，不代表已实现看板聚合。

## 6. 三类机会的字段差异

| 机会类型 | 来源条件 | 展示文案重点 | 默认优先级 | 建议动作 | 可转内部随访任务 | 可转预约意向 | 可进看板统计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 复诊提醒 | 治疗摘要、恢复阶段、复诊节点、预约状态、随访结果或静态路径模板提示需要复诊 / 复查 / 状态确认。 | 强调时间窗口、治疗阶段、需要人工确认的复诊事项。 | 中；临近或逾期可为高。 | 人工确认恢复状态，必要时转内部随访或预约意向。 | 可以，必须人工确认后。 | 可以，必须人工确认后，且不等于真实预约。 | 是，V1 必需。 |
| 复购机会 | 客户生命周期、项目周期、历史治疗 / 消费摘要、随访结果或预约完成状态显示可能进入复购窗口。 | 强调客户所处周期、来源摘要和建议运营动作。 | 中；高价值或高意向可为高，但需人工判断。 | 人工判断是否建立内部随访、运营动作或预约意向。 | 可以，必须人工确认后。 | 可以，必须人工确认后，且不得自动营销。 | 是，V1 必需。 |
| 沉睡客户机会 | 最后治疗、最后预约、最后到院、最后随访或最后互动距离当前已超过试运行候选阈值。 | 强调长时间无互动、最后一次业务事实和待确认阈值。 | 低或中；长期高价值客户可人工调高。 | 人工判断继续观察、建立内部随访、忽略或稍后处理。 | 可以，必须人工确认后。 | 不默认转；如人工确认需要，可作为预约意向。 | 是，V1 必需。 |

差异说明：

- 复诊提醒更依赖治疗阶段和时间窗口。
- 复购机会更依赖项目周期、生命周期和历史服务事实。
- 沉睡客户机会更依赖最后互动时间和人工确认阈值。
- 三类机会都不能绕过人工确认。
- 三类机会都不能绕过人工确认进入外部自动触达。

## 7. 状态流转契约

以下状态是产品状态契约，不是数据库枚举，不是代码实现。

| 状态 | 含义 | 看板统计口径 | 审计必要性 |
| --- | --- | --- | --- |
| `suggested` | 系统、规则、AI 辅助或人工录入形成了机会建议，但尚未进入待确认处理。 | 可计入“新出现机会”或“待分配机会”，V1 可简化。 | 建议审计“机会出现 / 生成”。 |
| `pending_confirmation` | 机会已进入待人工确认范围。 | 计入待处理 / 待确认指标。 | 必须审计进入待确认或被展示为待确认的关键动作。 |
| `confirmed` | 内部人员已确认机会需要继续处理。 | 计入已确认机会。 | 必须审计人工确认。 |
| `dismissed` | 内部人员判断本机会不处理或暂不处理。 | 计入已忽略 / 已驳回机会。 | 必须审计人工忽略和原因摘要。 |
| `converted_to_followup` | 已由人工确认转为内部随访任务。 | 计入转内部随访任务数，不等于已触达客户。 | 必须审计转换动作。 |
| `converted_to_appointment_intent` | 已由人工确认转为预约意向。 | 可计入预约意向输入，V1 可选。 | 必须审计转换动作。 |
| `completed` | 内部处理已完成，例如随访已处理、预约意向已落地或人工标记完成。 | 计入已完成机会，V1 可选。 | 必须审计完成动作。 |
| `expired` | 机会已过处理窗口、来源已失效或人工判断不再适用。 | 计入逾期 / 失效指标，V1 可选。 | 必须审计失效动作或失效原因。 |

允许的产品状态方向：

- `suggested` -> `pending_confirmation`
- `pending_confirmation` -> `confirmed`
- `pending_confirmation` -> `dismissed`
- `pending_confirmation` -> `expired`
- `confirmed` -> `converted_to_followup`
- `confirmed` -> `converted_to_appointment_intent`
- `confirmed` -> `completed`
- `confirmed` -> `dismissed`
- `converted_to_followup` -> `completed`
- `converted_to_followup` -> `expired`
- `converted_to_appointment_intent` -> `completed`
- `converted_to_appointment_intent` -> `expired`

状态流转边界：

- 状态只能由人工动作或内部业务状态变化推动。
- 本契约不定义任何 scheduler、cron、queue、worker 或自动过期 runtime。
- 状态变化不得触发外部自动触达。
- 状态变化不得自动生成医疗建议。
- 后续实现如需状态持久化、队列或自动失效，必须单独审批，不属于本 PR。

## 8. 人工确认关系

人工确认是 V1 三类机会的硬边界。

| 机会类型 | 人工确认前 | 人工确认后允许的内部去向 | 禁止事项 |
| --- | --- | --- | --- |
| 复诊提醒 | 只作为内部提醒或待确认项展示。 | 内部随访任务；预约意向；人工标记完成；人工忽略。 | 不自动约诊，不发起对客联系动作，不生成自动化诊疗建议。 |
| 复购机会 | 只作为内部轻量机会提示。 | 内部随访任务；客户运营动作；预约意向；人工忽略。 | 不自动营销，不自动成交判断，不自动发送促销内容。 |
| 沉睡客户机会 | 只作为内部激活判断提示。 | 内部随访任务；人工忽略；继续观察；必要时转预约意向。 | 不自动唤醒，不自动外呼，不自动发送消息。 |

规则与 AI 的边界：

- AI / 规则只能给出建议、草稿、标签、提醒或运营洞察。
- 人工确认决定机会是否继续处理。
- 未确认机会不得自动创建外部消息。
- 未确认机会不得自动触发真实 HIS、企业微信、微信、短信、电话或其他外部业务系统。
- 未确认机会不得生成医疗建议或替代咨询师 / 医生判断。
- 内部随访任务只是机构内部工作项，不等同于客户已被触达。

## 9. 看板输入口径

以下指标只定义基础运营看板输入口径，不定义 dashboard runtime、SQL、聚合函数、缓存策略或完整 BI。

| 指标 | 中文口径 | 建议来源 / 状态 | V1 必需 | 说明 |
| --- | --- | --- | --- | --- |
| 待处理复诊提醒数 | 需要人工处理的复诊提醒数量。 | `opportunityType=复诊提醒` 且 `status=pending_confirmation` 或等价待处理状态。 | 是 | 服务治疗后复诊闭环。 |
| 今日需处理复诊提醒数 | 今日应处理的复诊提醒数量。 | 复诊提醒的 `dueDate` 为今日且未完成。 | 是 | 可在 V1 先展示为内部提醒输入。 |
| 本周需处理复诊提醒数 | 本周应处理的复诊提醒数量。 | 复诊提醒的 `dueDate` 在本周且未完成。 | 可选 | 可作为今日指标的补充。 |
| 待确认复购机会数 | 需要人工判断的复购机会数量。 | `opportunityType=复购机会` 且处于待确认或待处理。 | 是 | 不代表营销结果。 |
| 高优先级复购机会数 | 优先级为高的复购机会数量。 | 复购机会 `priority=高` 且未完成。 | 可选 | 高优先级必须可解释，不能由黑箱 AI 直接决定。 |
| 待处理沉睡客户机会数 | 需要人工判断的沉睡客户机会数量。 | `opportunityType=沉睡客户机会` 且处于待确认或待处理。 | 是 | 阈值需产品确认。 |
| 逾期未处理机会数 | 超过建议处理日期仍未确认或未完成的机会数量。 | 任意机会类型，`dueDate` 已过且状态未完成 / 未忽略。 | 是 | 不要求本 PR 实现自动逾期。 |
| 已确认机会数 | 人工确认需要继续处理的机会数量。 | `status=confirmed` 或已转内部动作。 | 是 | 衡量人工判断结果，不代表成交。 |
| 已忽略机会数 | 人工判断不处理或暂不处理的机会数量。 | `status=dismissed`。 | 可选 | 用于后续审计和运营复盘。 |
| 转内部随访任务数 | 人工确认后转为内部随访任务的机会数量。 | `status=converted_to_followup` 或等价转换记录。 | 是 | 不代表已外部触达。 |
| 转预约意向数 | 人工确认后转为预约意向的机会数量。 | `status=converted_to_appointment_intent`。 | 可选 | 不代表预约已创建，也不代表 HIS 同步。 |

看板边界：

- 看板指标是内部运营输入，不是自动营销结果。
- 看板指标不代表真实外部触达次数。
- 看板指标不代表医疗效果或诊断结论。
- 本契约不新增 dashboard runtime，不新增 SQL，不新增聚合服务。

## 10. 与现有 V1 链路的关系

| V1 链路 | 与三类机会的关系 | 本契约边界 |
| --- | --- | --- |
| 客户档案 / 患者信息 | 三类机会都必须指向客户档案；医疗语境中可显示患者信息摘要。 | 使用客户作为主术语，患者信息只作医疗语境补充。 |
| 预约 / 到院 | 预约状态、到院状态和预约意向可影响复诊、复购和沉睡判断。 | 不等于真实 HIS 预约同步，不自动创建真实预约。 |
| 项目 / 治疗记录 | 项目、治疗阶段和治疗摘要是复诊提醒和复购机会的重要来源。 | 不做完整病历，不新增项目表或治疗记录 schema。 |
| 治疗后摘要 | 治疗后摘要提供恢复阶段、风险提示、下一步建议和来源摘要。 | 不自动生成医疗建议，不自动创建机会 runtime。 |
| 随访任务 | 人工确认后的机会可转为内部随访任务。 | 内部随访任务不等于外部消息发送。 |
| 复诊提醒 | 本契约定义其来源、字段、状态、人工确认和看板输入。 | 只做内部提醒，不自动触达。 |
| 复购机会 | 本契约定义其轻量机会提示和人工确认去向。 | 不做自动营销，不做成交判断。 |
| 沉睡客户机会 | 本契约定义其轻量识别和试运行阈值待确认边界。 | 不做自动唤醒，阈值不在本 PR 锁死。 |
| 人工确认 | 三类机会都必须经过人工确认。 | 人工确认是硬边界，不实现统一确认队列 runtime。 |
| 基础运营看板 | 三类机会为看板提供待处理、确认、忽略和转内部随访等指标输入。 | 只定义指标口径，不做 dashboard runtime 或完整 BI。 |
| 审计追踪 | 三类机会的出现、确认、忽略、转换和完成应纳入后续审计覆盖矩阵。 | 只定义审计要求，不新增 audit schema / metadata / migration。 |

## 11. 审计追踪要求

本节只定义后续审计覆盖要求，不实现审计，不扩展 audit schema，不新增 metadata，不继续 HIS audit / compensation 线。

这些要求可作为后续 V1-AUDIT-COVERAGE-MATRIX-01 的输入。

| 建议审计动作 | 触发场景 | V1 必需 | 说明 |
| --- | --- | --- | --- |
| 机会生成 / 出现 | 机会被规则、AI 辅助、mock、seed 或人工录入形成并进入内部视图。 | 是 | 后续需区分生成来源，但本 PR 不定义 schema。 |
| 人工确认 | 内部人员确认机会需要继续处理。 | 是 | 必须记录确认人、时间和低敏原因摘要的产品口径。 |
| 人工忽略 | 内部人员判断机会不处理或暂不处理。 | 是 | 必须可追踪，避免机会被无痕丢弃。 |
| 转内部随访任务 | 机会经人工确认后转为内部随访任务。 | 是 | 不代表已触达客户。 |
| 转预约意向 | 机会经人工确认后转为预约意向。 | 是 | 不代表真实预约或 HIS 同步。 |
| 标记完成 | 内部人员或内部业务状态表明机会处理完成。 | 是 | 完成口径需后续 PR 明确。 |
| 标记失效 | 机会过期、来源失效或人工判断不再适用。 | 是 | 本 PR 不实现自动过期。 |
| 优先级变更 | 人工调整机会优先级。 | 可选 | 适合后续看板和运营复盘。 |
| 备注变更 | 人工补充或修改内部备注。 | 可选 | 备注必须保持低敏，不记录真实凭证或高敏信息。 |

审计边界：

- 不新增 audit action / reason / result 枚举。
- 不新增 audit metadata schema。
- 不新增 migration。
- 不接 HIS audit / compensation。
- 不记录真实 credential。
- 不记录真实 HIS raw payload。
- 不记录完整病历正文。

## 12. 示例场景

### 示例一：注射后 D7 状态确认 / 复诊提醒

客户 A 完成注射类项目后，治疗后摘要显示当前进入 D7 状态确认窗口，随访建议提示需要人工确认恢复状态。系统在内部视图中展示一条复诊提醒，建议动作是“人工确认恢复状态，必要时转内部随访或预约意向”。机构人员确认后，可创建内部随访任务或记录预约意向。系统不得发起对客联系动作，也不得给出自动化诊疗建议。

### 示例二：项目周期进入复购窗口 / 复购机会

客户 B 的历史项目和生命周期显示可能进入复购窗口，最近一次随访结果显示服务体验稳定，但尚未有新的预约。系统展示一条复购机会，来源摘要说明来自项目周期和随访结果。机构人员需要人工判断是否建立内部随访任务或客户运营动作。系统不得自动营销、不得自动发送促销信息，也不得把机会视为已成交。

### 示例三：较长时间无预约 / 沉睡客户机会

客户 C 长时间没有预约、到院或随访记录，且生命周期显示需要关注。系统展示一条沉睡客户机会，并标注沉睡阈值仍需产品确认。机构人员可人工选择继续观察、忽略或建立内部随访任务。系统不得自动唤醒、不得自动外呼、不得自动发送消息。

## 13. 后续 PR 拆分建议

| PR 编号建议 | 标题 | 类型 | 目标 | 允许修改范围 | 禁止范围 | 依赖关系 | 是否阻塞 V1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1-DASHBOARD-METRICS-CONTRACT-01 | 定义三类机会看板指标字典 | contract-only | 细化复诊、复购、沉睡机会的指标名称、来源、状态口径、空态和边界。 | `docs/product/**` | runtime、SQL、聚合服务、完整 BI、导出、schema / migration。 | 依赖本契约。 | 是 |
| V1-MANUAL-CONFIRM-CONTRACT-01 | 定义统一人工确认对象和入口 | contract-only | 明确哪些建议 / 机会必须人工确认，确认后允许生成哪些内部动作。 | `docs/product/**` | queue、worker、scheduler、自动执行、自动触达、schema / migration。 | 依赖本契约。 | 是 |
| V1-AUDIT-COVERAGE-MATRIX-01 | 输出 V1 主线审计覆盖矩阵 | docs-only | 将客户档案、预约、治疗摘要、随访、三类机会和人工确认映射到审计动作要求。 | `docs/product/**` | audit runtime、audit metadata schema、HIS compensation audit、migration。 | 可基于本契约并行推进。 | 是 |
| V1-REVISIT-UI-MOCK-01 | 复诊提醒 UI mock 验证 | UI-only / mock-only | 使用现有模拟数据或静态 mock 展示复诊提醒列表、空态、人工确认入口文案。 | 后续明确批准后限 UI / mock / 组件测试范围。 | schema、migration、真实 HIS、真实预约同步、自动触达。 | 依赖本契约和看板指标契约。 | 是 |
| V1-REPURCHASE-DORMANT-UI-MOCK-01 | 复购 / 沉睡机会 UI mock 验证 | UI-only / mock-only | 使用现有 lifecycle / mock 展示轻量机会列表、人工确认状态和看板入口。 | 后续明确批准后限 UI / mock / 组件测试范围。 | 新 opportunity 表、scheduler、营销自动化、外部消息系统、schema / migration。 | 依赖本契约和看板指标契约。 | 是 |
| V1-FIELD-WHITELIST-CONTRACT-01 | 收口机会相关低敏字段白名单 | contract-only | 明确机会卡片、看板、人工确认和备注可展示字段。 | `docs/product/**` | 真实客户数据、真实凭证、HIS raw payload、schema / migration。 | 可并行。 | 否 |
| V1-OPPORTUNITY-TEST-PLAN-01 | 三类机会验收用例计划 | test-only / docs-only | 先定义未来 test-only PR 需要覆盖的行为，不实现 runtime。 | `docs/product/**` 或后续批准的测试计划文档。 | 修改生产代码、新增 runtime、schema / migration。 | 依赖本契约。 | 否 |

后续 PR 原则：

- 先 contract-only，再 UI-only / mock-only / test-only。
- 不直接进入真实 HIS runtime。
- 不直接进入真实 credential runtime。
- 不直接扩 schema / migration。
- 不直接做自动触达。
- 如未来确需 schema 讨论，只能标记为 runtime-later / planning-later，并单独审批。

## 14. 验收标准

本契约满足以下条件才可视为完成：

- 已定义复诊提醒、复购机会、沉睡客户机会三类轻量机会。
- 已明确三类机会属于内部运营提示，不是自动营销、外部自动触达或自动化诊疗建议。
- 已定义统一机会字段契约，并明确这是产品 / DTO / UI 口径，不是数据库 schema。
- 已定义三类机会的字段差异。
- 已定义状态流转契约，并明确不实现 runtime、scheduler、queue、worker。
- 已明确人工确认是 V1 硬边界。
- 已定义三类机会与内部随访任务、预约意向和基础运营看板的关系。
- 已定义基础运营看板输入指标口径，并明确不做 dashboard runtime。
- 已定义审计追踪要求，并明确不新增 audit schema / metadata / migration。
- 已提供至少三个产品示例场景，且未包含真实客户、真实医院、真实 HIS、真实凭证或外部机构数据。
- 已拆分后续小 PR，且没有建议直接进入真实 HIS、真实 credential、schema / migration 或自动触达。
- 本 PR 没有修改 `src/**`、`drizzle/**`、`package.json`、lockfile、schema、migration 或产品事实源原文件。

## 15. 验证记录

本次只读检查和文档新增过程中执行过以下命令：

- `date "+%Y-%m-%d %Z %z"`
- `git status --short`
- `git branch --show-current`
- `git log --oneline -n 8`
- `git rev-parse HEAD`
- `git rev-parse main`
- `git rev-parse origin/main`
- `git switch -c docs/v1-opportunity-contract-01`
- `wc -l docs/product/zhimeitiangong-product-source-of-truth.md`
- `wc -l docs/product/zhimeitiangong-module-map.md`
- `wc -l docs/product/zhimeitiangong-v1-scope.md`
- `wc -l docs/product/zhimeitiangong-feature-addendum.md`
- `wc -l docs/product/zhimeitiangong-decision-log.md`
- `wc -l docs/product/reviews/prod-gap-review-01.md`
- `sed -n '1,220p' docs/product/zhimeitiangong-product-source-of-truth.md`
- `sed -n '1,120p' docs/product/zhimeitiangong-module-map.md`
- `sed -n '1,220p' docs/product/zhimeitiangong-v1-scope.md`
- `sed -n '1,100p' docs/product/zhimeitiangong-feature-addendum.md`
- `sed -n '1,120p' docs/product/zhimeitiangong-decision-log.md`
- `sed -n '1,320p' docs/product/reviews/prod-gap-review-01.md`
- `find docs/product -maxdepth 2 -type d`
- `rg --files docs/product`
- `rg -n "复诊|复购|沉睡|机会|人工确认|看板|审计" docs/product src drizzle README.md package.json`
- `rg -n "HIS|credential|adapter|scheduler|worker|queue|migration|schema|自动触达|自动营销|AI Agent|外部网络" docs/product src drizzle README.md package.json`
- `mkdir -p docs/product/contracts`
- `git diff --stat`
- `git diff -- docs/product/contracts/v1-opportunity-contract-01.md`
- `rg -n "^# |^## |^### " docs/product/contracts/v1-opportunity-contract-01.md`
- `rg -n "智美天工不是 HIS 系统|AI 客户运营中台|HIS 只是数据来源之一|不修复问题|不做 runtime|不新增 schema|不新增 migration|真实 HIS|真实 credential|adapter|scheduler|worker|queue|人工确认是 V1 硬边界|产品 / DTO / UI 契约|不是数据库 schema|外部自动触达|自动化诊疗建议" docs/product/contracts/v1-opportunity-contract-01.md`
- `git status --short --untracked-files=all`
- `git diff --no-index --stat /dev/null docs/product/contracts/v1-opportunity-contract-01.md`
- `git diff --no-index /dev/null docs/product/contracts/v1-opportunity-contract-01.md`

本次未运行 runtime，未启动服务，未连接外部业务系统，未连接真实 HIS，未读取真实 credential，未执行 migration，未运行 scheduler / cron / queue / worker，未新增 schema，未修复任何发现的问题。

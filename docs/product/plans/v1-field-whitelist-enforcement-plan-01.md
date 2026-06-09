# V1 主链路字段白名单 enforcement plan 01

## 1. 背景与结论摘要

- 日期与时区：2026-06-09 CST +0800。
- 任务编号：V1-FIELD-WHITELIST-ENFORCEMENT-PLAN-01。
- 当前阶段：V1 主链路从 schema impact 与 API boundary 计划进入字段白名单 enforcement 计划阶段。
- 本文档性质：docs-only、plan-only，只定义后续字段白名单 enforcement 的边界、层级、对象范围和测试保护计划。
- 本文档不是：runtime 实现、API 实现、route/service/repository 改动、DTO 改动、parser 改动、schema/migration、SQL、测试代码、HIS 对接、凭证读取、真实数据处理、自动外联、真实任务/预约/成交处理、诊断或医疗建议。

结论：

- 当前仓库已有局部字段保护基础，包括客户与预约写入字段 allowlist、治疗摘要写入字段 allowlist、治疗随访建议的低敏文本保护、审计查询参数 allowlist、低敏错误响应与不含 metadata 的审计事件模型。
- V1 主链路在进入任何 runtime/API/schema 工作前，需要先把全局字段白名单、禁止字段、`lowSensitiveNote`、`sourceSummary`、DTO 输出边界、错误响应与测试保护固定为统一 enforcement 方案。
- 后续 enforcement 应优先发生在 route/parser/presenter/view-model/audit 映射层，并通过测试证明禁止字段不会进入 DTO、错误响应、dashboard、audit 或低敏备注。
- repository 与数据库层只能作为租户隔离、持久化和查询边界，不应承担主字段白名单策略的首要责任。

## 2. 当前可复用字段保护基础

| 现有基础 | 可复用价值 | 后续边界 |
| --- | --- | --- |
| `tenant-business-write-input.ts` | 已有客户与预约写入 allowlist、`tenantId` 注入拒绝、原始手机号/证件号/病历号字段拒绝、masked 字段格式保护、自由文本敏感内容拒绝 | 可作为 V1 mutation DTO 字段 allowlist 的模式参考，不直接扩大为机会对象 runtime |
| `treatment-summary-write-input.ts` | 已有治疗摘要 create/update/void 字段 allowlist、长度限制、枚举校验、禁止 raw medical、raw payload、SQL、stack、token、secret 等内容 | 可作为 `lowSensitiveNote` 与治疗摘要相关文本字段的校验参考 |
| `treatment-followup-suggestions.ts` | 已有治疗摘要到随访建议的安全文本映射、fallback 文案、禁止原始病历/诊断/外部 payload/凭证等内容 | 可作为 `sourceSummary` 由安全字段生成而非透传原始来源的参考 |
| `audit-event-query-parser.ts` | 已有查询参数 allowlist、重复参数拒绝、枚举与 ID 格式校验 | 可作为 dashboard/audit/opportunity 查询 DTO 的模式参考 |
| `audit-events.ts` 与 `audit-event-dto.ts` | 审计事件当前不含 metadata/payload，DTO 只暴露低敏审计字段 | 后续不应为 V1 机会对象引入自由 JSON metadata |
| institution API route 错误处理 | 当前多处返回稳定中文错误，不暴露 SQL、stack、凭证或底层异常原文 | 可作为 V1 错误响应白名单的基础 |
| dashboard view model | 当前 dashboard 是低敏聚合与行动项视图，不承载真实营销、HIS 同步或成交处理 | 后续 V1 指标只能输出聚合和低敏 drilldown |
| 既有测试 | 已覆盖多类敏感字段拒绝、查询参数 allowlist、错误不泄漏、审计不携带敏感 metadata 等 | 后续需要补充 V1 主链路对象的字段白名单测试 |

## 3. V1 主链路字段类别

V1 主链路字段应按以下类别处理：

- 低敏展示字段：如 `customerDisplayName`、`lifecycleStatus`、`customerPriority`、`customerTags`、`opportunityLabel`、`appointmentStatus`、`followUpStatus`。
- masked 展示字段：如 `maskedPhone`、`maskedMedicalRecordNo`，只允许掩码形态，不允许原文回传。
- 内部跟踪字段：如 `customerId`、`appointmentId`、`treatmentSummaryId`、`followUpTaskId`、`sourceId`、`resourceId`，只能作为内部引用或低敏定位，不得替代原始外部 payload。
- 低敏摘要字段：如 `sourceSummary`、`triggerReason`、`suggestedAction`、`auditHint`、`lowSensitiveNote`，只能由白名单字段生成或由受控输入产生。
- 状态与动作字段：如 `statusBefore`、`statusAfter`、`selectedAction`、`priority`、`dueDate`、`dashboardBucket`、`operatorRole`。
- 聚合展示字段：如 dashboard `metricKey`、中文指标名、`count`、empty/exception copy、mock/demo 标记。
- 禁止记录字段：任何完整手机号、证件号、完整病历号、完整病历正文、影像、凭证、HIS raw payload、外部消息原文、SQL、stack、AI prompt/completion 全文等。

## 4. 全局允许字段清单

后续 V1 主链路 DTO、dashboard、audit、manual confirmation 和 opportunity 对象只能从下列字段中选择，并按对象级白名单进一步收窄：

| 字段 | 允许用途 |
| --- | --- |
| `customerId` | 内部客户引用、timeline/opportunity/manual confirmation/audit 低敏定位 |
| `customerDisplayName` | 低敏客户展示名，不承诺为实名原文 |
| `maskedPhone` | 掩码手机号展示 |
| `maskedMedicalRecordNo` | 掩码病历号展示 |
| `lifecycleStatus` | 客户生命周期状态展示与筛选 |
| `customerPriority` | 客户优先级展示与筛选 |
| `customerTags` | 低敏标签展示 |
| `appointmentId` | 预约内部引用 |
| `appointmentStatus` | 预约状态 |
| `appointmentTimeWindow` | 预约时间窗口 |
| `arrivalStatus` | 到院状态 |
| `treatmentSummaryId` | 治疗摘要内部引用 |
| `treatmentProjectSummary` | 项目低敏摘要 |
| `treatmentCategory` | 治疗类别 |
| `treatmentStage` | 治疗阶段 |
| `recoveryStage` | 恢复阶段 |
| `followUpTaskId` | 随访任务内部引用 |
| `followUpStatus` | 随访状态 |
| `opportunityType` | `revisit`、`repurchase`、`dormant` 等机会类型 |
| `opportunityLabel` | 机会展示名称 |
| `sourceType` | 安全来源类型 |
| `sourceId` | 内部来源引用 |
| `sourceSummary` | 来源低敏摘要 |
| `triggerReason` | 触发原因低敏摘要 |
| `suggestedAction` | 给人工运营的建议动作，不是自动外联指令 |
| `priority` | 机会、随访或确认优先级 |
| `dueDate` | 处理或提醒日期 |
| `statusBefore` | 人工确认或审计前状态 |
| `statusAfter` | 人工确认或审计后状态 |
| `selectedAction` | 人工选择的动作 |
| `operatorRole` | 操作角色，不暴露员工敏感信息 |
| `auditHint` | 审计低敏提示 |
| `dashboardBucket` | dashboard 聚合桶 |
| `mockSeedDemoFlag` | mock/seed/demo 明确标记 |
| `lowSensitiveNotes` | 低敏备注集合或摘要 |

字段名称若在单对象中需要单数形式，可使用 `lowSensitiveNote` 作为受控备注字段；展示和聚合层仍应优先保持 `lowSensitiveNotes` 的契约含义。

## 5. 全局禁止字段清单

以下字段或内容不得进入 V1 主链路 DTO、错误响应、dashboard、audit、manual confirmation、opportunity 对象、`sourceSummary` 或 `lowSensitiveNote`：

- 完整手机号、未掩码电话、通话记录或录音。
- 身份证号、护照号、其他证件号。
- 完整病历号、完整病历正文、诊断正文、检查影像、影像链接、治疗原始记录、医嘱全文、咨询记录全文。
- 真实 credential、API Key、Token、Cookie、Session、OAuth secret、Webhook secret、私钥、数据库连接串。
- HIS raw payload、外部系统 request/response body、外部系统完整错误。
- SQL、stack trace、生产环境变量、内部连接信息。
- 真实支付、计费、合同、发票、成交金额、回款金额。
- 微信、企微、短信、电话等外部消息原文或自动外联执行记录。
- 医生、员工、操作人敏感个人信息；V1 只能使用 `operatorRole` 或低敏角色名。
- AI prompt/completion 全文、模型原始请求/响应。
- 未掩码地址；V1 默认不需要地址字段。
- 自由 JSON metadata、raw source object、raw external object、未经过白名单 presenter 的对象透传。

## 6. lowSensitiveNote 规则计划

`lowSensitiveNote` 是后续候选的低敏备注字段，适用于人工确认、机会处理、随访说明、audit hint 生成或 dashboard drilldown 摘要。它不是病历、外部消息、诊断、销售记录或凭证容器。

计划规则：

- 输入来源：只能来自受控表单、内部低敏枚举、低敏摘要生成器或人工运营短备注。
- 字段形态：单条备注使用 `lowSensitiveNote`；集合或展示层可映射为 `lowSensitiveNotes`。
- 长度边界：后续 parser 可采用 160 字符作为默认候选上限，超过时拒绝或要求人工缩写。
- 内容边界：不得包含完整手机号、证件号、完整病历号、完整病历正文、诊断正文、HIS raw payload、外部消息原文、SQL、stack、credential、token、secret、DB URL、支付/成交金额、AI prompt/completion 全文。
- 格式边界：不得接受任意对象、数组中的对象、HTML、Markdown 链接、URL 列表、base64、文件路径或外部 payload 片段。
- 错误处理：拒绝时只返回稳定错误码或中文错误，不回显原始输入。
- 审计处理：审计只记录备注存在、低敏摘要或受控原因，不保存被拒绝的原始内容。

## 7. sourceSummary 规则计划

`sourceSummary` 用于解释机会、随访、人工确认或审计事件的来源，但不得成为原始来源对象的替代导出。

计划规则：

- 生成方式：由 `sourceType`、`sourceId`、状态、时间窗口、项目低敏摘要、恢复阶段、机会类型等白名单字段组合生成。
- 禁止来源：不得从 HIS raw payload、外部系统 response body、原始病历正文、咨询全文、消息原文、SQL、stack、credential 或 AI 原始响应直接截取。
- 内容形态：应是一句低敏摘要，例如“来自治疗摘要的复诊窗口提醒”或“来自客户生命周期与随访状态的复购机会提示”。
- 来源引用：`sourceId` 只能是内部 ID 或安全引用，不能是外部系统原始主键、手机号、证件号、病历号或 raw payload key。
- 缺失处理：来源不足时使用低敏 fallback，如“来源信息不完整，仅作内部参考”，不得输出底层错误。
- 长度边界：后续 parser/presenter 可采用 120 至 160 字符的候选上限。
- 审计边界：audit 中的 `sourceSummary` 或 `reasonSummary` 只能保留低敏摘要，不保存完整来源对象。

## 8. DTO enforcement 边界计划

后续 DTO enforcement 应按输入、输出、错误和审计四类边界拆分。

| DTO 边界 | 计划规则 |
| --- | --- |
| Query DTO | 只允许显式 query allowlist；拒绝未知参数、重复参数、`tenantId` 注入、任意 filter、raw SQL、外部系统 ID 透传；对 enum、ID、时间、limit、cursor 做格式校验 |
| Mutation DTO | 只允许显式 body allowlist；拒绝 `tenantId`、系统字段、时间戳覆盖、raw PII、raw medical、raw payload、credential、SQL、stack、外部消息全文 |
| Output DTO | 必须通过 presenter/view-model 白名单映射；不得直接返回 repository row、domain raw object、external object、request body 或错误对象 |
| Dashboard DTO | 只允许 metric、count、bucket、empty/exception copy、低敏 drilldown；不得输出原始客户隐私、SQL、HIS payload 或成交/支付数据 |
| Audit DTO | 只允许 resource/action/reason/result/status/source/role/demo flag 等低敏字段；不引入自由 metadata/payload |
| Error DTO | 只允许稳定错误文案、可选稳定 code 与 HTTP status；不得回显 rejected value、stack、SQL、DB URL、HIS response 或外部错误全文 |

DTO enforcement 的目标是让每个对外或跨层对象都能回答三个问题：字段是否在全局白名单内、是否在当前对象白名单内、字段值是否通过低敏内容校验。

## 9. Enforcement 层级计划

推荐层级如下：

| 层级 | 职责 |
| --- | --- |
| Route handler | 认证、权限、租户上下文、请求体读取上限、稳定错误响应 |
| Query parser | query allowlist、重复参数拒绝、枚举/ID/时间/分页校验 |
| Mutation parser | body allowlist、字段类型与长度、`lowSensitiveNote` 与 `sourceSummary` 低敏校验、禁止字段拒绝 |
| Service/domain | 状态流转、人工确认硬边界、机会生成规则、不可自动外联约束 |
| Presenter/view model | 输出 DTO 白名单、masked 字段选择、dashboard 聚合与 drilldown 收窄 |
| Audit mapper | 低敏审计摘要、动作命名、状态前后值、角色名；不保存 raw metadata |
| Repository | 租户范围查询、持久化和并发保护；不作为字段白名单策略的唯一防线 |
| Tests | 覆盖允许字段存在、禁止字段缺席、错误不泄漏、audit/dashboard 不携带敏感内容 |

字段白名单应作为横向规则覆盖 query、mutation、output、audit 与 dashboard，而不是只放在单个 API route 中。

## 10. 对各主链路对象的 enforcement 计划

| 主链路对象 | 允许字段计划 | 额外保护计划 |
| --- | --- | --- |
| 客户档案 / 患者信息 | `customerId`、`customerDisplayName`、`lifecycleStatus`、`customerPriority`、`customerTags`、`maskedPhone`、`maskedMedicalRecordNo`、`lowSensitiveNotes` | 不输出完整手机号、证件号、完整病历号、地址、病历正文或外部 ID |
| 预约 / 到院 | `appointmentId`、`appointmentStatus`、`appointmentTimeWindow`、`arrivalStatus`、`customerId`、`customerDisplayName`、`treatmentProjectSummary` | 不把预约 note 变成外部消息或病历正文；不产生真实通知 |
| 项目 / 治疗记录摘要 | `treatmentSummaryId`、`treatmentProjectSummary`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`sourceSummary`、`suggestedAction`、`priority`、`lowSensitiveNotes` | 只允许摘要与阶段信息；不输出诊断正文、影像、完整治疗记录或 AI 原始文本 |
| 治疗后随访任务 | `followUpTaskId`、`followUpStatus`、`sourceSummary`、`dueDate`、`operatorRole`、`customerId`、`customerDisplayName`、`suggestedAction`、`lowSensitiveNotes` | 随访任务不是自动外联任务；不保存外部消息原文 |
| 复诊提醒机会 | `opportunityType`、`opportunityLabel`、`customerId`、`customerDisplayName`、`sourceType`、`sourceId`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、`dueDate`、`dashboardBucket`、`auditHint`、`mockSeedDemoFlag` | 只能提示人工确认；不创建真实预约 |
| 复购机会 | `opportunityType`、`opportunityLabel`、`customerId`、`customerDisplayName`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、`dashboardBucket`、`lowSensitiveNotes` | 不输出成交金额、支付、合同或营销自动化记录 |
| 沉睡客户机会 | `opportunityType`、`opportunityLabel`、`customerId`、`customerDisplayName`、`sourceSummary`、`triggerReason`、`priority`、`dueDate` 或试算窗口、`dashboardBucket`、`mockSeedDemoFlag` | 不自动唤醒、不自动外联、不使用真实消息渠道 |
| 人工确认 | `confirmationSubjectType`、`confirmationSubjectId`、`customerId`、`customerDisplayName`、`sourceType`、`sourceId`、`sourceSummary`、`selectedAction`、`statusBefore`、`statusAfter`、`operatorRole`、`auditHint`、`priority`、`dueDate`、`lowSensitiveNotes` | 人工确认是硬边界；确认结果不等于真实外联、真实预约或真实成交 |
| 基础运营看板 | `metricKey`、中文指标名、`count`、`dashboardBucket`、`emptyStateCopy`、`exceptionStateCopy`、`mockSeedDemoFlag`、`sourceType`、`opportunityType` | 只输出聚合和低敏 drilldown；异常态不暴露 SQL、stack、raw payload 或外部错误 |
| 审计追踪 | `resourceType`、`resourceId`、`actionSummary`、`reasonSummary`、`actorRole`、`tenantScope`、`statusBefore`、`statusAfter`、`opportunityType`、`sourceType`、`sourceId`、`selectedAction`、`priority`、`dueDate`、`mockSeedDemoFlag` | 不引入自由 metadata；不记录完整隐私、凭证、HIS raw payload 或外部消息原文 |
| Mock/seed/demo 对象 | `mockSeedDemoFlag` 与对象级低敏字段 | 必须明确标记 demo；不得暗示为生产数据 |

## 11. 错误响应字段白名单

V1 后续错误响应只应允许：

- `error`：稳定中文错误文案。
- `code`：可选稳定错误码。
- `status`：HTTP 状态或低敏状态名。
- `requestId`：如后续统一引入，只能是内部低敏追踪 ID。

候选错误码：

- `not_authenticated`
- `forbidden`
- `not_found`
- `invalid_request`
- `invalid_field_whitelist`
- `invalid_state_transition`
- `manual_confirmation_required`
- `already_handled`
- `expired_opportunity`
- `stale_confirmation`
- `missing_source`
- `dashboard_aggregation_unavailable`
- `audit_naming_unavailable`
- `service_unavailable`

错误响应禁止包含：

- rejected value 原文。
- request body、response body、HIS response、外部错误全文。
- SQL、stack trace、DB URL、环境变量。
- credential、API Key、Token、secret、Cookie、Session。
- 完整手机号、证件号、完整病历号、完整病历正文、外部消息原文。
- repository row、domain raw object、third-party raw object。

## 12. 测试保护计划

后续测试应以“允许字段能出现、禁止字段不能出现、错误不泄漏、audit/dashboard 低敏”为核心。

建议测试组：

- 全局字段白名单测试：逐对象断言 DTO key 只能来自全局允许字段与对象级允许字段。
- 禁止字段测试：构造 full phone、ID、完整病历号、HIS raw payload、token、secret、SQL、stack、外部消息原文、AI 原始文本、支付/成交金额等输入，断言被拒绝且不回显。
- `lowSensitiveNote` 测试：覆盖长度、类型、HTML/URL/base64/object 拒绝、敏感数字串拒绝、凭证关键词拒绝、错误不回显。
- `sourceSummary` 测试：断言只能从白名单字段生成，来源缺失时使用 fallback，不透传 raw source。
- Query DTO 测试：未知参数、重复参数、`tenantId` 注入、任意 filter、非法 enum/ID/cursor 拒绝。
- Mutation DTO 测试：未知字段、系统字段、raw PII、raw medical、raw payload、credential、SQL、stack 拒绝。
- Output DTO 测试：repository/domain/external raw object 不得直接暴露；masked 字段必须保持掩码。
- Dashboard 测试：只输出 metric/count/bucket/copy/demo flag，不输出原始客户隐私、SQL、stack、HIS payload 或成交/支付字段。
- Audit 测试：只输出低敏审计字段，不含 metadata/payload、凭证、隐私原文、外部消息原文。
- 错误响应测试：所有 V1 route 候选错误路径都不包含 raw payload、SQL、stack、credential、HIS response 或 rejected value。
- Demo 标记测试：mock/seed/demo 数据必须可见标记，不能暗示生产数据。

本计划不新增测试代码；测试实现需要独立授权。

## 13. 不推荐的反模式

- 把三类机会对象塞进现有 `follow_up_tasks` 并复用随访状态作为机会状态。
- 在 repository 或数据库 row 直接返回后再依赖前端过滤敏感字段。
- 给 audit 增加自由 JSON metadata 保存“方便排查”的原始上下文。
- 在 dashboard aggregation 中暴露原始客户列表、SQL 片段、stack、HIS payload 或外部错误全文。
- 允许 `sourceSummary` 从 raw payload、外部 response、病历正文或 AI completion 中截取。
- 允许 `lowSensitiveNote` 保存手机号、证件号、完整病历号、诊断正文、外部消息原文、成交金额或凭证片段。
- 在 institution 侧 query/body 中接受 `tenantId` 作为普通输入。
- 用人工确认结果直接触发真实外联、真实预约、真实成交或真实 HIS 写回。
- 让字段白名单只覆盖 mutation，不覆盖 output DTO、error DTO、dashboard 和 audit。
- 使用“看起来是 demo”代替明确的 `mockSeedDemoFlag`。

## 14. 推荐结论

推荐将 V1 字段白名单 enforcement 作为后续 runtime/API/schema 工作前的必经边界：

- 先固定全局字段白名单、对象级白名单、全局禁止字段和错误响应白名单。
- 再设计 `lowSensitiveNote` 与 `sourceSummary` 的 parser/presenter 规则。
- 再补充 DTO、dashboard、audit 和 manual confirmation 的对象级测试保护。
- 最后在获得明确 runtime 授权后，才进入最小 API/runtime slice。

在未获得独立授权前，本文档不允许被解读为实现 parser、DTO、route、service、repository、schema、migration、SQL、dashboard aggregation、audit runtime 或 HIS 对接的许可。

## 15. 后续建议 PR 顺序

以下仅是建议顺序，不构成开发许可：

1. V1 字段白名单测试细化 PR：只补测试计划或测试用例设计，确认对象级字段快照与禁止字段矩阵。
2. V1 audit 事件命名计划 PR：只规划机会、人工确认、dashboard drilldown 的 audit action/reason 命名。
3. V1 dashboard aggregation 计划 PR：只规划三类机会指标如何从低敏对象聚合。
4. V1 minimal runtime slice 计划 PR：只规划最小 route/parser/service/presenter/repository 边界，不写 runtime。
5. V1 runtime 实现 PR：仅在用户明确授权后，以小范围、可回滚、测试先行方式处理。

任何 schema、migration、runner、scheduler、queue、worker、HIS、凭证、真实外联、真实预约、真实成交、支付/合同/发票、生产配置都必须单独确认。

## 16. 本文档边界

本文档只新增字段白名单 enforcement 的计划说明，边界如下：

- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不修改 schema、migration、SQL、package 或 lockfile。
- 不新增 route、service、repository、DTO、parser、runner、scheduler、worker、queue。
- 不连接 HIS，不读取真实 credential，不访问真实第三方系统。
- 不创建真实随访任务、真实预约、真实成交、真实外联消息或医疗诊断。
- 不修改现有产品文档、review、contract、copy、test plan 或 devlog。
- 不运行 lint、typecheck、单元测试、集成测试或 dev server。

后续任何实现类工作都需要用户在新任务中明确授权。

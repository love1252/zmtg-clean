# V1 主链路 API / service / repository boundary plan 01

## 0. 文档元信息

- 任务编号：V1-API-BOUNDARY-PLAN-01。
- 任务性质：docs-only / plan-only / no API changes / no route changes / no service changes / no repository changes / no DTO changes / no runtime / no schema changes / no SQL / no audit runtime。
- 日期与时区：2026-06-09 CST +0800，来自本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：Stage 4 前置计划任务，承接 V1 implementation readiness review 和 V1 schema impact plan 的 Partial / Not Ready 结论。
- 当前分支：`docs/v1-api-boundary-plan-01`。
- 任务启动基线：创建分支前的 `HEAD`、`main` 与 `origin/main` 均为 `ebcc45dc1cf3560986828aac8fe89e0feb47bbd0`。
- 本文档只新增 API / service / repository boundary plan，不修改产品事实源、契约、测试计划、copy、既有 plan、runtime、schema 或 migration。

本文档不授权 API / route / service / repository / DTO / runtime / schema / migration / SQL / dashboard aggregation / audit runtime / audit metadata / audit enum。本文档中的 API、service、repository、DTO、query、mutation、guard、input、output 均为 candidate / 候选 / 可能 / 待评估语言，不是实现决定。

## 1. 背景与结论摘要

V1 UI mock 主链路已经完成，当前工作台已以 mock / seed / demo 口径串起三类机会展示、统一人工确认入口、基础运营看板指标和审计追踪样例。V1 contract-to-implementation plan 已完成，明确从 UI mock 进入任何 runtime 前必须先完成 schema impact review、API boundary review、field whitelist enforcement review、audit event naming review、dashboard aggregation plan 和 test plan refinement。V1 implementation readiness review 已完成，结论是 opportunity、manual confirmation、dashboard metrics、audit、field whitelist、test readiness、API / service / repository boundary 均为 Partial，schema impact 为 Not Ready。V1 schema impact plan 已完成，并明确当前不建议直接新增 schema / migration，不建议直接复用 `follow_up_tasks` 承接全部机会，也不建议直接做 dashboard aggregation 或 audit runtime。

当前需要的是 API / service / repository boundary plan：把未来三类机会、统一人工确认、基础运营看板指标、审计追踪输入和字段白名单在 route handler、service、repository、DTO、tenant / RBAC、audit 与错误边界上的候选分层写清楚，避免从 UI mock 或 schema candidate 直接跳进 runtime。

核心结论：

- 当前不建议直接新增 API / route / service / repository / DTO。
- 当前不建议把三类 opportunity candidate 混入现有 follow-up route。
- 当前不建议把 unified manual confirmation candidate 直接等同于治疗摘要随访建议确认。
- 当前不建议让 dashboard API 直接聚合三类机会或把 mock 指标变成真实经营统计。
- 当前不建议直接让 `audit_events` repository 接收 V1 主链路动作。
- 当前推荐继续以 plan-only / docs-only 小 PR 收口 field whitelist enforcement、audit event naming、dashboard aggregation 和 test plan refinement。

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，主线是治疗后客户运营闭环。HIS 是数据来源之一，不是 V1 主链路，不阻塞 1.0。本文档不推进真实 HIS、真实 credential、真实外部网络、scheduler、worker、queue、自动触达、自动营销、真实预约、真实成交或医疗诊断。

## 2. 当前可复用 API / service / repository 基础

| 当前模式 | 当前用途 | 可复用点 | 不足 | 风险 | 是否适合作为 V1 主链路候选参考 |
| --- | --- | --- | --- | --- | --- |
| tenant business API pattern | `handleTenantBusinessListRequest` / `handleTenantBusinessMutationRequest` 统一处理客户、预约、随访的租户内 list / mutation。 | route 可把认证、tenant、权限、审计和错误响应收敛到 helper；mutation 可返回 `not_found`、`conflict`、`invalid_transition`、`quota_denied` 等结果。 | 当前 resource 只覆盖 `customer`、`appointment`、`follow_up`，不覆盖 opportunity、confirmation、dashboard metric 或 audit trace input。 | 如果直接扩 resource，会把尚未命名的 V1 对象提前推入 access-control 和 audit enum 语义。 | 适合作为 route helper 候选参考，但不适合直接扩成 V1 opportunity runtime。 |
| route handler pattern | `src/app/api/institution/**/route.ts` 负责读取 demo access context、parse body/query、调用 repository / service、返回 `NextResponse`。 | 路由层职责清晰：认证、tenant、DTO parse、权限判断、错误响应、事务边界入口。 | 当前 route 已混有 HIS connection 路径，V1 主链路不能被 HIS route 风格主线化。 | route 若直接承接业务状态机，会绕过 service boundary 和字段白名单。 | 适合作为 future route handler 结构参考。 |
| mutation handler pattern | 客户、预约、随访、治疗摘要更新和作废 route 使用 JSON body parse、payload parser、事务、审计写入和错误响应。 | 有 `readJsonBody`、parse result、transaction、success / denied audit、409 conflict 等成熟形态。 | 三类机会的幂等、并发、already handled、expired、stale confirmation 与 audit order 尚未定义。 | 直接做 mutation 会把确认动作、状态变化、任务创建和 audit 写入一次性耦合。 | 适合作为 mutation 风险拆分参考，但当前不能实现 V1 mutation。 |
| repository pattern | `tenant-business-repository`、`treatment-summary-repository`、`audit-event-repository` 以 tenant-scoped query / update / insert 为主，并映射 row 到低敏 DTO。 | repository 层能保证 tenant 条件、FK 检查、row mapping、部分冲突检查。 | 部分 repository 已包含活跃来源随访冲突判断，但 opportunity 状态、manual confirmation 历史、dashboard 去重不应继续塞入既有 repository。 | repository 如果承担业务状态机，会让产品决策分散到持久层。 | 适合作为数据访问候选参考，未来应限制为只读写数据。 |
| audit repository pattern | `audit_events` 支持 record、list、按 tenant / resource / action / result / reason 查询，无 metadata / payload 字段。 | 审计底座低敏、tenant scoped、可分页查询，适合未来审计输出底座。 | V1 opportunity / confirmation / dashboard 的 resource、action、reason 命名尚未进入 runtime。 | 直接新增 audit reason / metadata 会污染审计语义并可能夹带高敏摘要。 | 适合作为未来审计输出候选参考，但当前不能接收 V1 动作。 |
| treatment follow-up confirmation pattern | `treatment-followup-confirmation.ts` 基于治疗摘要生成随访建议，人工选择后创建内部随访任务。 | service 层返回 `not_found`、`voided`、`invalid_suggestion`、`conflict`，并通过 repository 做来源去重。 | 只服务治疗摘要随访建议，不是统一人工确认对象；不覆盖复购、沉睡、预约意向、继续观察、忽略、过期。 | 直接复用会把所有 opportunity 误实现为 follow-up task，越过统一确认对象和状态边界。 | 适合作为局部确认与幂等参考，不适合作为统一人工确认 runtime。 |
| workspace dashboard view model pattern | `buildInstitutionDashboardSummary` 聚合 customers、appointments、followUpTasks，形成 metrics、supporting stats、action items 和 journey lanes。 | view model 适合低敏展示结构、空态和 action item 组装。 | 当前 metric keys 仍是客户、预约、随访和 `repurchase_window` supporting stat，不是 V1 三类机会指标字典。 | 如果直接在 view model 拼真实指标，会绕过 schema / 状态 / 去重 / aggregation plan。 | 适合作为 presenter / view model 候选参考，不适合替代 dashboard aggregation plan。 |
| field parser / write input pattern | `tenant-business-write-input.ts` 和 `treatment-summary-write-input.ts` 用 allowlist、长度、枚举和敏感词检查保护写入 DTO。 | 有拒绝 `tenantId`、手机号原文、身份证、病历号原文、raw payload、token、secret、SQL、stack 等经验。 | 当前 parser 不覆盖 opportunity、manual confirmation 低敏备注、dashboard query DTO 或 audit input DTO。 | 如果先做 DTO 再补 enforcement plan，可能漏掉高敏字段和自由文本风险。 | 适合作为 field whitelist enforcement candidate 参考。 |

## 3. V1 未来边界对象

以下对象必须列出，但本文档不实现。

| Candidate | 可能属于 query 还是 mutation | 可能输入 | 可能输出 | service 职责 | repository 职责 | DTO 边界 | 权限 / tenant 边界 | 字段白名单边界 | audit 边界 | 为什么现在不能实现 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Opportunity API candidate | query 为主；进入待确认、忽略、继续观察、转内部随访、形成预约意向等可能是 mutation。 | tenant-scoped filters、opportunityType、status、sourceType、time window、低敏 customerId、分页。 | 低敏机会列表、分组、单个详情、sourceSummary、dashboardBucket、状态摘要。 | 判断机会来源、状态可见性、低敏来源摘要、候选状态方向和 action eligibility。 | 未来可能只读 opportunity source 或写 opportunity candidate 状态；不做产品决策。 | 默认低敏；不允许完整手机号、病历正文、HIS raw payload、真实支付 / 成交字段。 | 所有 query / mutation 必须 scoped 到当前 tenant；mutation 需角色权限。 | 依赖 field whitelist enforcement plan；低敏备注需长度、内容和禁止词边界。 | 进入待确认、确认、忽略、转换、完成、过期等动作需先命名。 | schema impact 为 Not Ready；状态、去重、幂等、audit naming 和测试计划未完成。 |
| Manual confirmation API candidate | query + mutation；列表/详情为 query，确认/忽略/继续观察/转内部随访/预约意向为 mutation。 | confirmationSubjectType、confirmationSubjectId、selectedAction、statusBefore、lowSensitiveNotes、idempotency key candidate。 | 确认对象低敏摘要、允许动作、结果状态、already handled / stale / expired 错误。 | 管理确认对象、动作合法性、幂等、并发、状态方向和结果解释。 | 未来可能持久化确认记录或读取确认对象来源；不把业务状态机放入 repository。 | 输入 DTO 不能允许自由高敏文本；输出 DTO 不返回高敏来源正文。 | tenant scoped；mutation 需检查角色和对象归属。 | 备注、原因和 sourceSummary 均需低敏 guard。 | 人工确认动作必须审计，但 audit input 命名尚未收口。 | 统一确认对象、确认历史、幂等和并发模型未定；不能直接复用现有治疗摘要确认。 |
| Dashboard metrics API candidate | query candidate，不应直接 mutation。 | metric keys、time window、opportunityType、status bucket、demo / seed / mock flag candidate。 | 指标 key、数量、指标桶、空态 / 异常态、低敏下钻入口。 | 组装指标结果、解释空态 / 异常态、保护低敏下钻边界。 | 未来 repository 可能只读 metric source 或快照；不直接写经营指标。 | DTO 只返回聚合和低敏摘要，不返回高敏客户明细。 | tenant scoped；dashboard 和下钻权限需分开。 | 下钻必须走字段白名单，不得绕过 opportunity / confirmation DTO。 | 指标口径变更和下钻候选动作需先进入 audit naming plan。 | dashboard aggregation plan 未完成；不允许写 SQL 或把 mock 指标变真实统计。 |
| Audit trace input candidate | mutation-like internal input candidate，不是 public API；query 为 audit log 既有能力参考。 | resource、resourceId、action、reason、statusBefore、statusAfter、sourceType、operatorRole、demo flag。 | 低敏 audit event 或 audit write result。 | 校验 V1 动作是否可审计、映射低敏原因、控制高敏字段。 | `audit_events` repository 未来可 record / list；不接收 raw metadata。 | 输入 DTO 只允许稳定短码和低敏摘要，不允许 raw payload。 | tenant scoped；跨租户拒绝必须审计。 | audit DTO 不得带完整手机号、病历、credential、token、secret。 | 需要 audit event naming plan 先定义 resource / action / reason。 | 直接接入会扩散 audit enum / reason，并可能污染 HIS 风险治理线。 |
| Field whitelist boundary candidate | query / mutation / audit input / dashboard output 的横切 guard candidate。 | allowed field set、forbidden field set、lowSensitiveNotes、sourceSummary、demo flag。 | 通过后的低敏 DTO 或拒绝原因。 | 在 service / presenter 边界执行字段策略，保证输入和输出低敏。 | repository 不应承担字段策略，只保存已通过边界的数据。 | 默认拒绝未知字段和高敏文本；query DTO、mutation DTO、audit DTO 分别校验。 | tenant scoped 不能替代字段白名单。 | 依赖 field whitelist enforcement plan 先细化长度、内容、禁止词和脱敏策略。 | audit input 必须只接收低敏摘要。 | 目前只有 contract，没有 enforcement plan 和 runtime guard；当前不能实现。 |

## 4. Opportunity 边界计划

未来 opportunity 相关能力可能需要独立边界，但本文档不实现。

### Query candidate

候选 query 可以包含：

- 读取待确认机会列表。
- 读取三类机会分组。
- 读取单个 opportunity 详情。
- 读取低敏来源摘要。
- 读取低敏 dashboard bucket 输入。

候选 query 边界：

- 只能返回低敏字段，例如内部客户 ID、脱敏展示名、机会类型、来源类型、来源摘要、触发原因、处理窗口、优先级、状态和 demo / seed / mock 标记。
- 不返回完整手机号、身份证号、完整病历号、完整病历正文、HIS raw payload、credential、token、secret、真实支付、真实成交、外部消息原文或完整错误全文。
- 不触发状态变化。
- 不触发外部动作。
- 不创建真实预约。
- 不创建真实成交。
- 不发送外部消息。
- 不把来源缺失、dueDate 缺失或沉睡阈值待确认自动补齐。
- 不把 `customers.lifecycle` 的 `repurchase_window` / `silent_reactivation` 直接解释为已生成 opportunity runtime。

### Mutation candidate

候选 mutation 可以包含：

- 机会进入待确认。
- 人工忽略。
- 继续观察。
- 转内部随访。
- 形成预约意向。
- 形成复购意向。
- 标记完成。
- 标记过期 / 不再适用。
- 修改优先级。
- 补充低敏备注。

候选 mutation 边界：

- 当前不实现。
- 必须晚于 schema impact、field whitelist enforcement、audit event naming、dashboard aggregation plan 和 test plan refinement。
- mutation 必须 tenant scoped，并检查对象归属。
- mutation 必须区分 `not_found`、`forbidden`、`stale_confirmation`、`already_handled`、`expired_opportunity`、`invalid_action`、`invalid_field_whitelist` 等错误。
- mutation 不自动触达。
- mutation 不创建真实预约。
- mutation 不创建真实成交。
- mutation 不发送外部消息。
- mutation 不写真实 HIS。
- mutation 不处理真实 credential。
- mutation 不生成医疗诊断。
- mutation 不应与 dashboard aggregation、audit runtime、schema / migration 混在同一个 runtime PR 中。

## 5. Manual confirmation 边界计划

人工确认不能只是按钮动作。它至少需要确认对象、确认动作、结果状态、幂等、并发、已处理、已过期、低敏备注、字段白名单和审计输入边界。

未来可能有三种候选分法：

| 候选方式 | 可能价值 | 不足与风险 | 当前判断 |
| --- | --- | --- | --- |
| 由 opportunity service 管理确认 | 机会状态与确认动作在同一 service 中保持一致，便于处理 `pending_confirmation` 到 `confirmed` / `dismissed` / `converted_to_followup` 等状态。 | 治疗摘要随访建议、看板待处理项和未来人工录入机会可能不是 opportunity 对象；service 容易过大。 | 可作为单机会对象实现候选，但不能覆盖全部确认来源。 |
| 单独 manual confirmation service | 统一管理确认对象、动作、幂等、并发、低敏备注和审计顺序。 | 需要明确与 opportunity、follow-up task、appointment intent 的状态同步和 repository 边界。 | 更适合作为统一人工确认 candidate，但必须晚于 schema / API / audit / whitelist 计划。 |
| 借鉴 existing treatment follow-up confirmation pattern | 已有 `not_found`、`voided`、`invalid_suggestion`、`conflict` 和来源随访去重经验。 | 该 pattern 只把治疗摘要建议转内部随访任务，不支持忽略、继续观察、预约意向、沉睡阈值、复购窗口或统一队列。 | 只可借鉴，不可直接复用承接全部三类机会。 |

未来 manual confirmation candidate 需要：

- service boundary：判断 subject 是否可确认、selectedAction 是否允许、状态方向是否合法、是否 already handled、是否 stale、是否 expired、是否需要低敏备注。
- repository boundary：只负责 tenant scoped 读取确认对象 / 写入候选确认记录 / 写入转换结果，不负责产品决策。
- audit boundary：确认、忽略、继续观察、转内部随访、转预约意向、完成、过期、修改优先级和备注变更都需要先进入 audit event naming plan。
- 字段白名单：sourceSummary、confirmationReason、auditHint、lowSensitiveNotes 必须低敏；输入 DTO 不允许自由高敏文本。
- 幂等和并发：未来可能需要 idempotency key candidate、状态版本 candidate 或 `statusBefore` guard；当前不实现。

为什么不能直接复用已有治疗摘要确认逻辑承接全部三类机会：

- 现有逻辑的确认对象是治疗摘要随访建议，不是复诊 / 复购 / 沉睡 opportunity。
- 现有结果只创建内部随访任务，不支持忽略、继续观察、预约意向、完成、过期等统一状态方向。
- 现有去重是 `sourceTreatmentSummaryId + sourceSuggestionKey` 的活跃随访任务去重，不覆盖客户生命周期、预约、最后互动、项目周期或看板来源。
- 现有 audit resource 是 `follow_up` / `treatment_summary` 相关，不是 V1 opportunity / confirmation resource naming。
- 直接复用会把“待确认提示”变成“已创建内部随访任务”，越过人工确认硬边界。

当前不实现 manual confirmation API、service、repository、DTO、queue、worker、scheduler 或状态机。

## 6. Dashboard metrics API 边界计划

基础运营看板指标应优先作为 query candidate，不应直接 mutation。指标来源必须晚于 schema / 状态 / 去重 / dashboard aggregation plan。

候选边界：

- route handler：未来可能只接收 metric filters、time window、dashboard bucket、分页或低敏下钻参数。
- service：候选职责是组装指标、解释空态 / 异常态、控制下钻边界；是否负责聚合待 dashboard aggregation plan 决定。
- repository：候选职责应偏只读，读取 opportunity candidate、manual confirmation result、follow-up task、customer lifecycle、treatment summary 或未来 metric snapshot；不做产品判断。
- aggregation layer：如果未来需要去重、时间窗口、历史趋势或快照，可能需要单独 aggregation layer candidate；不应塞进 route handler 或 repository。
- presenter / view model：负责输出低敏 metric card、supporting stat、empty state、exception state 和 demo flag。

必须保留的边界：

- 不得直接写 SQL。
- 不得把 mock 指标变真实经营统计。
- 不得暴露高敏明细。
- 不得绕过 field whitelist。
- 不得把成交金额、真实支付、自动触达次数、外部消息发送成功率、医疗效果改善率或 HIS 同步成功率纳入 V1 query。
- 看板下钻只能进入低敏 opportunity / confirmation 摘要，不直接返回完整客户明细。
- 当前不实现 dashboard API、dashboard repository、dashboard aggregation、metric snapshot、SQL 或完整 BI。

当前 `buildInstitutionDashboardSummary` 可作为展示层结构参考，但它聚合的是客户、预约和随访任务；`repurchase_window` 只是 supporting stat，不是 V1 三类机会真实聚合。

## 7. Audit trace input 边界计划

`audit_events` 可能可复用，但 V1 主链路动作必须先命名。audit input 不能携带高敏 raw payload。audit 写入必须晚于 action / resource / reason 命名。

候选需要审计的动作：

- opportunity 进入待确认。
- opportunity 人工确认。
- opportunity 人工忽略。
- opportunity 继续观察。
- opportunity 转内部随访。
- opportunity 转预约意向。
- opportunity 标记完成。
- opportunity 标记过期 / 来源失效。
- manual confirmation 低敏备注变更。
- manual confirmation 优先级变更。
- dashboard 指标口径变更。
- dashboard 低敏下钻。
- forbidden / cross tenant / missing tenant / sensitive detail denied。

必须先进入 audit event naming plan 的动作：

- V1 opportunity resource 命名。
- manual confirmation resource 命名。
- appointment intent 与真实 appointment 的区分命名。
- continuation / observation / dismiss / expire / complete 的 action / reason 短码。
- dashboard metric source / metric bucket / drilldown 的 resource / reason 命名。
- lowSensitiveNotes 变更如何记录摘要。

audit service / repository candidate：

- audit service candidate 只接收低敏事件输入，验证 resource / action / reason 是否来自命名计划。
- audit repository candidate 可复用 `createAuditEventRepository().record()` 和 `listAuditEvents()`，但不新增 metadata / payload。
- audit DTO candidate 只允许 resource、resourceId、action、result、reason、statusBefore、statusAfter、sourceType、opportunityType、operatorRole、demo flag 等低敏摘要。

当前不新增 audit metadata / enum，不扩 `AuditReason`，不实现 audit runtime，不继续 HIS compensation audit 线。

## 8. DTO 与字段白名单边界

DTO 必须以低敏字段为默认。输入 DTO 不能允许自由高敏文本。输出 DTO 不能返回完整手机号、身份证号、完整病历号、完整病历正文、HIS raw payload、外部消息原文、credential、token、secret、真实支付、真实成交或销售额。

### 允许字段类别

- 内部追踪字段：`customerId`、`sourceId`、`confirmationSubjectId`、`followUpTaskId`、`statusBefore`、`statusAfter`。
- 低敏展示字段：`opportunityType`、`opportunityLabel`、`sourceType`、`triggerReason`、`suggestedAction`、`priority`、`dueDate`、`dashboardBucket`。
- 需脱敏展示字段：`customerDisplayName`、`maskedPhone`、`maskedMedicalRecordNo`。
- 低敏摘要字段：`sourceSummary`、`auditHint`、`lowSensitiveNotes`。
- demo / seed / mock 标记：`mockSeedDemoFlag` 或同类候选字段。
- 聚合展示字段：metric key、metric value、time window、empty state、exception state。

### 禁止字段类别

- 完整手机号、身份证号、护照号、完整病历号、完整地址。
- 完整病历正文、诊断全文、临床原文、咨询对话全文、影像 / 文件原文。
- HIS raw payload、外部系统 request / response body、外部错误全文。
- credential、API Key、OAuth token、secret、private key、DATABASE_URL、connection string。
- 微信 / 企微 / 短信 / 电话 / 外呼原文。
- 真实支付、真实成交、销售额、合同、发票。
- SQL、stack、调试 payload。
- AI prompt 全文、AI completion 全文、AI 自动决策文本。

### low_sensitive_note 候选边界

- 必须有长度上限候选。
- 必须拒绝完整手机号、身份证、病历号、credential、token、raw payload、SQL、stack、外部错误全文。
- 必须避免记录高敏病历、诊疗结论、外部消息全文或真实成交信息。
- 必须在 audit input 中只写低敏摘要或短码。
- 必须晚于 field whitelist enforcement plan。

### query DTO 风险

- 列表 query 如果允许任意 filter，可能暴露跨租户资源 ID、sourceId 或 actorId。
- detail query 如果直接返回 source object，可能带出完整治疗摘要、预约备注或客户高敏字段。
- dashboard query 如果允许下钻客户明细，可能绕过低敏聚合口径。

### mutation DTO 风险

- 自由文本备注可能夹带高敏信息。
- `selectedAction` 可能伪造不允许动作。
- `statusBefore` 可能被绕过，导致 stale confirmation。
- 请求体中传入 `tenantId` 可能绕过当前租户上下文。
- 转内部随访、预约意向和完成动作如果混在一个 DTO 中，可能造成外部动作误触发。

### audit DTO 风险

- audit input 如果接收 metadata，会把 request body、raw payload 或高敏摘要带入审计。
- audit reason 如果未命名，会混入 HIS / credential / compensation 线。
- audit resourceId 如果使用外部系统 ID，可能泄露真实 HIS 或真实预约号。

### dashboard DTO 风险

- 指标 value 可能被误读为真实经营统计、真实成交或真实触达结果。
- 下钻 DTO 可能返回高敏客户明细。
- 空态和异常态如果写错，会暗示客户均已处理、均已触达或系统真实聚合完成。

field whitelist enforcement plan 必须早于任何 API 实现。

## 9. 权限 / tenant / RBAC 边界

所有候选 API 必须 tenant scoped。不得跨租户读取 opportunity / confirmation / dashboard / audit。mutation 必须检查角色权限。dashboard 指标和审计追踪需要权限边界。操作人信息必须低敏。

候选边界：

- route handler 从 access context 获取 `tenantId`，禁止由 request body 提供 `tenantId`。
- query 必须使用当前 tenant 作为 repository 条件。
- mutation 必须验证目标对象属于当前 tenant。
- dashboard query 必须区分聚合指标读取和敏感下钻读取。
- audit query 必须区分机构内 audit log 与平台 audit log；机构 audit 不接受 query string tenantId。
- platform scope 不得读取敏感客户 / 机会 / 确认明细，除非未来单独定义低敏治理视图。
- 操作人 DTO 优先使用 `operatorRole`、内部 actorId 或角色摘要，不展示员工隐私。

RBAC candidate：

- `tenant_admin` 可能是 V1 mutation 的最小候选角色。
- `tenant_operator`、`consultant`、`customer_service` 是否能处理机会，必须后续权限计划确认。
- `security_auditor` 可能只能读审计，不应执行业务 mutation。
- `platform_admin` / `platform_operator` 只能看平台治理或低敏聚合，不应跨租户处理客户运营对象。

当前不实现权限逻辑，不扩 `ACCESS_RESOURCES`、`ACCESS_ACTIONS` 或 policy；本文档只做计划。

## 10. 错误 / 空态 / 异常态边界

未来 API candidate 必须区分以下错误或异常态：

| 候选错误 / 异常态 | 可能含义 | 响应边界 |
| --- | --- | --- |
| `not_found` | 对象不存在或不属于当前 tenant。 | 不泄露对象是否属于其他租户。 |
| `forbidden` | 登录角色无权限、跨租户、缺 tenant 或敏感明细拒绝。 | 只返回低敏错误，不返回 policy 内部细节。 |
| `stale_confirmation` | 客户端的 `statusBefore` 或版本已过期。 | 提示刷新，不返回并发冲突内部 SQL。 |
| `already_handled` | 对象已经确认、忽略、完成或转换。 | 返回低敏当前状态摘要。 |
| `expired_opportunity` | 处理窗口已过、来源失效或对象不再适用。 | 不自动重新生成机会。 |
| `invalid_action` | `selectedAction` 不在当前对象允许动作集合。 | 不执行任何状态变化。 |
| `missing_source` | sourceType / sourceId 缺失或来源不完整。 | 进入异常态说明，不猜测来源。 |
| `invalid_field_whitelist` | 输入或输出包含禁止字段。 | 拒绝请求，不回显高敏内容。 |
| `dashboard_aggregation_unavailable` | 指标来源、状态、去重或聚合未 ready。 | 显示低敏异常态，不返回 SQL 或 raw error。 |
| `audit_naming_unavailable` | resource / action / reason 尚未命名。 | 阻断 audit runtime candidate，不写临时 reason。 |

当前不实现错误码。错误响应不得包含 raw payload、SQL、stack、credential、HIS response、请求体全文、完整客户隐私或外部消息原文。

空态与异常态 candidate：

- 无待处理机会：只表示当前没有进入人工处理范围的机会。
- 无复诊提醒：不代表未来没有客户需要复诊。
- 无复购机会：不代表没有商业价值客户。
- 无沉睡客户机会：不代表客户全部活跃。
- 来源不完整：只说明统计作内部参考，不自动补来源。
- dueDate 缺失：不能进入今日 / 本周 / 逾期指标。
- 沉睡阈值未确认：必须标记为试运行口径。
- demo / seed / mock 数据：必须说明不等于真实生产数据。

## 11. 推荐分层边界

以下只是候选分层，不授权创建文件。

| 层 | 候选职责 | 不应承担 |
| --- | --- | --- |
| route handler | 认证、tenant 获取、RBAC 检查、DTO parse、调用 service、返回低敏 response、映射错误状态。 | 不做 opportunity 生成规则，不做状态机，不直接写 SQL，不直接写 audit runtime。 |
| query DTO parser | 校验 query 参数、分页、filter、metric key、状态集合、字段白名单。 | 不读取数据库，不做业务判断。 |
| mutation DTO parser | 校验 selectedAction、statusBefore、lowSensitiveNotes、idempotency candidate 和禁止字段。 | 不决定动作是否合法，不写状态。 |
| service | 负责业务状态、幂等、权限后的业务判断、对象归属校验结果解释、调用 repository / audit candidate。 | 不拼 SQL，不返回高敏字段，不承担展示文案。 |
| repository | 只负责 tenant scoped 数据读写、冲突检查、row mapping 和必要索引条件。 | 不做产品决策，不创建外部动作，不承担状态机完整语义。 |
| view model / presenter | 负责低敏展示结构、空态、异常态、dashboard bucket、demo flag 和下钻摘要。 | 不聚合真实经营统计，不绕过字段白名单。 |
| audit candidate | 只接收低敏事件输入，映射已命名 resource / action / reason 后写审计底座。 | 不接收 raw metadata，不新增 audit enum，不写 HIS compensation 语义。 |
| field whitelist guard | 未来作为输入 / 输出 / audit / dashboard 边界保护。 | 不替代 tenant / RBAC，不触发业务动作。 |

推荐分层的关键原则：

- Query 和 mutation 分开。
- Opportunity、manual confirmation、dashboard aggregation、audit write 不混在一个 runtime PR。
- 转内部随访任务和形成预约意向分开表达；预约意向不是真实预约。
- repository 不承担业务状态机。
- audit 写入晚于 action / resource / reason naming。
- field whitelist guard 晚于 enforcement plan，早于任何 API 实现。

## 12. 不推荐的反模式

| 反模式 | 风险 |
| --- | --- |
| 把 opportunity 逻辑塞进 existing follow_up route。 | 会把待确认机会误实现成随访任务，越过人工确认边界。 |
| 把 manual confirmation 写成 UI onClick 后直接 mutation。 | 会缺少确认对象、动作合法性、幂等、并发、审计和字段白名单。 |
| 让 dashboard 直接 SQL 聚合 mock 指标。 | 会把演示口径误写成真实经营统计，并绕过 dashboard aggregation plan。 |
| 在 audit_events 里直接写高敏 metadata。 | 当前 audit_events 无 metadata；新增或塞 raw 摘要会放大隐私和 schema 风险。 |
| 用 HIS adapter 作为 V1 主链路入口。 | 会把 HIS 误主线化，偏离 AI 客户运营中台定位。 |
| 让 API 自动触达客户。 | 违反 V1 人工确认硬边界。 |
| 让 API 自动创建真实预约 / 成交。 | 预约意向和复购机会会被误解为真实预约、真实成交或 HIS 同步。 |
| DTO 返回完整客户隐私。 | 违反低敏字段白名单，可能泄露手机号、病历、身份证或外部消息。 |
| service 直接发送外部消息。 | 把内部运营动作误扩成自动触达和真实第三方系统动作。 |
| repository 承担业务状态机。 | 产品决策和状态方向会分散在数据访问层，难以审计和测试。 |
| 在同一个 PR 中同时做 route、schema、dashboard aggregation 和 audit runtime。 | 难以审查、难以回滚，并放大隐私、权限和状态风险。 |
| 把 `customers.lifecycle` 当成 opportunity runtime。 | 客户整体状态不等于单次可处理机会，无法表达并行机会和确认历史。 |
| 把 `treatment_summaries` 当成 opportunity object。 | 来源记录会承担状态机责任，且一个摘要可能产生多个机会。 |
| 让 audit reason 临时命名。 | V1 主线会和 HIS / credential / compensation reason 混杂。 |

## 13. 推荐结论

- 当前不建议直接新增 API / route / service / repository / DTO。
- 当前不建议直接复用 treatment follow-up confirmation 承接全部三类机会。
- 当前不建议直接让 dashboard API 聚合三类机会。
- 当前不建议直接让 audit repository 接收 V1 动作。
- 当前不建议扩 `ACCESS_RESOURCES`、`ACCESS_ACTIONS`、`AuditReason` 或 `audit_events` schema。
- 当前不建议新增 opportunity / manual confirmation / dashboard metric source runtime。
- 当前推荐下一步仍是 plan-only / docs-only。
- API boundary plan 应作为 field whitelist enforcement plan、audit event naming plan、dashboard aggregation plan 的输入。
- 任何未来 runtime minimal slice 都必须晚于 schema impact、API boundary、field whitelist enforcement、audit event naming、dashboard aggregation、test plan refinement 和 rollback / feature flag plan，并由用户单独批准。

## 14. 后续建议 PR 顺序

以下只是未来计划建议，不是开发许可。这些仍是 plan-only / docs-only / review-only，不能直接进入 runtime。

1. V1-FIELD-WHITELIST-ENFORCEMENT-PLAN-01
2. V1-AUDIT-EVENT-NAMING-PLAN-01
3. V1-DASHBOARD-AGGREGATION-PLAN-01
4. V1-TEST-PLAN-REFINEMENT-01
5. V1-RUNTIME-MINIMAL-SLICE-PLAN-01

建议说明：

- Field whitelist enforcement plan 应先定义输入 / 输出 / audit / dashboard 的执行点、低敏备注限制和禁止字段拒绝策略。
- Audit event naming plan 应先定义 V1 主链路 resource / action / reason，不新增 audit metadata / enum。
- Dashboard aggregation plan 应定义指标来源、状态纳入 / 排除、去重、时间窗口、空态和异常态，不写 SQL。
- Test plan refinement 应把机会、人工确认、看板、审计和字段白名单转成未来可执行但受控的小 PR 验收顺序。
- Runtime minimal slice plan 只能描述未来候选切片、feature flag、回滚和风险，不实现 runtime。

## 15. 本文档边界

- 本文档不新增 API。
- 本文档不修改 route。
- 本文档不新增 service。
- 本文档不新增 repository。
- 本文档不新增 DTO。
- 本文档不实现 runtime。
- 本文档不修改 schema。
- 本文档不新增 migration。
- 本文档不写 SQL。
- 本文档不授权 dashboard aggregation。
- 本文档不授权 audit runtime。
- 本文档不授权 audit metadata / enum。
- 本文档不授权真实 HIS / credential。
- 本文档不授权真实客户数据。
- 本文档不授权自动营销 / 自动触达。
- 本文档不授权外部消息发送。
- 本文档不授权真实任务 / 预约 / 成交。
- 本文档不授权医疗诊断。
- 本文档不修改 `src/**`。
- 本文档不修改 `drizzle/**`。
- 本文档不修改 `package.json` 或 lockfile。
- 本文档不新增测试文件。
- 本文档中的后续建议、candidate、候选边界和推荐顺序都不是 runtime 开发许可。

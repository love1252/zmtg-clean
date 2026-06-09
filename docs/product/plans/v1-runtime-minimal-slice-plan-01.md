# V1 主链路 runtime minimal slice plan 01

## 0. 文档元信息

- 任务编号：V1-RUNTIME-MINIMAL-SLICE-PLAN-01。
- 日期与时区：2026-06-09 CST +0800，来自本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前分支：`docs/v1-runtime-minimal-slice-plan-01`。
- 启动基线：`HEAD`、`main` 与 `origin/main` 均为 `ef2483d12a67dc507f33353b52cf5076bd327361`。
- 当前阶段：docs-only / plan-only / review-only。
- 本文档只新增未来 runtime minimal slice 计划，不修改产品事实源、契约、review、test plan、copy、已有 plan、UI mock、runtime 或测试代码。

文档性质：

- docs-only：仅修改文档
- plan-only：仅新增计划
- no runtime implementation：不实现 runtime
- no SQL：不写 SQL
- no API changes：不修改 API
- no schema changes：不修改 schema
- no service / repository / DTO：不新增 service / repository / DTO
- no test implementation：不写测试代码
- no dashboard aggregation runtime：不实现 dashboard aggregation 运行时
- no audit runtime：不实现 audit 运行时
- no external integration：不接外部系统
- no real customer data：不处理真实客户数据

本文档不授权 SQL、API、schema / migration、service、repository、DTO、dashboard aggregation runtime、audit runtime、真实 HIS 接入、credential 读取、真实客户数据处理、自动营销、自动触达、外部消息发送、真实任务、真实预约、真实成交、测试实现或生产配置变更。

## 1. 背景与结论摘要

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是 1.0 主线，不阻塞 1.0。

V1 主链路已经通过 opportunity contract、manual confirm contract、dashboard metrics contract、field whitelist contract、audit coverage matrix、empty / exception state copy、schema impact plan、API boundary plan、field whitelist enforcement plan、audit event naming plan、dashboard aggregation plan 和 V1 test plan refinement 逐步收口。当前仍不能进入 runtime。本任务只规划未来如果进入 runtime 时，最小、可回滚、低敏、可审计、受 feature flag 保护的候选切片。

核心结论：

- 本文档不是 runtime 授权。
- 本文档不是实现方案落地 PR。
- 本文档不授权 SQL、API、schema / migration、service / repository / DTO、dashboard aggregation runtime 或 audit runtime。
- 本文档不授权真实 HIS 接入、读取 credential、真实客户数据处理、自动营销 / 自动触达、创建真实任务 / 预约 / 成交。
- 未来进入 runtime 前，必须先由用户在新的当前任务中明确批准，并重新执行项目治理启动检查。
- 未来最小 runtime 也必须默认关闭、按 tenant 开启、可回滚、低敏输出、先测试后实现。

## 2. 当前不能进入 runtime 的原因

当前不能进入 runtime，原因如下：

| 原因 | 说明 | 当前结论 |
| --- | --- | --- |
| 产品边界仍是计划阶段 | 机会、人工确认、看板指标、审计输入、字段白名单都已收口为契约和计划，但尚未进入实现授权。 | 继续 docs-only / plan-only。 |
| schema 仍未授权 | schema impact plan 明确不建议直接新增 `opportunities`、`manual_confirmations`、`dashboard_metric_snapshots` 或扩 enum。 | 不改 schema / migration。 |
| API 边界仍未授权 | API boundary plan 明确不建议直接新增 opportunity、manual confirmation、dashboard metrics 或 drilldown API。 | 不改 API / route。 |
| 字段白名单需要先行 | field whitelist contract 和 enforcement plan 要求先锁定低敏输出和禁止字段。 | 不写 DTO、parser、sanitizer、mask、redact。 |
| audit naming 仍是候选 | audit event naming plan 只规划 resource / action / reason / result，不新增 enum 或 metadata。 | 不实现 audit runtime。 |
| dashboard aggregation 仍是候选 | dashboard aggregation plan 只规划指标、窗口、去重、异常态和低敏下钻。 | 不写 aggregation query，不写 SQL。 |
| 测试计划仍需拆分 | V1 test plan refinement 只规划未来断言，不写测试代码。 | 不新增测试文件。 |
| 真实 HIS 不是 1.0 主线 | HIS 是数据来源之一，不是 1.0 主线，不阻塞客户运营闭环。 | 不接真实 HIS，不读取 credential。 |

因此，本任务只能新增未来 runtime minimal slice 计划，不能顺手实现任何 runtime 能力。

## 3. 未来 runtime minimal slice 的目标

未来 runtime minimal slice 的目标只应是用最小范围验证 V1 主链路语义是否可安全进入受控试运行。

目标候选：

- 以低敏 opportunity candidate 为中心，只读展示复诊提醒、复购机会和沉睡客户机会候选摘要。
- 以人工确认作为所有动作边界，不绕过内部人员确认。
- 以 dashboard metrics read-only 作为只读指标观察，不进入真实经营 BI。
- 以 audit input candidate 规划低敏审计输入，不新增 audit metadata 或自由 payload。
- 以 feature flag、tenant scope、RBAC、字段白名单、空态 / 异常态和 rollback 作为前置保护。
- 以测试先行作为进入 runtime 的硬门槛，先断言 feature flag disabled、tenant / RBAC、字段白名单、stale / already handled / invalid transition 和 rollback。

所有目标都是 future candidate，不是本 PR 实现许可。

## 4. 未来 minimal slice 的非目标

未来 minimal slice 即使被单独批准，也不应在第一步做以下事项：

- 不接真实 HIS runtime。
- 不读取真实 credential。
- 不处理真实客户高敏数据。
- 不新增 schema / migration。
- 不新增 dashboard_metric_snapshots。
- 不写生产 BI 或聚合 SQL。
- 不做完整 dashboard aggregation runtime。
- 不做 audit metadata 或 audit enum 扩展。
- 不做自动营销、自动触达、自动外呼、自动微信 / 企微 / 短信发送。
- 不创建真实预约、真实任务、真实成交、支付、合同、发票或回款记录。
- 不把 UI mock、seed、demo 数值当作真实数据源。
- 不在一个 PR 中同时做 schema、API、runtime、dashboard aggregation、audit 和测试。

## 5. runtime 启动前置门禁

未来任何 runtime PR 前必须先通过以下门禁：

| 门禁 | 必须满足 | 未满足时处理 |
| --- | --- | --- |
| 用户授权 | 用户在新的当前任务中明确批准 runtime 范围。 | 停止，不进入 runtime。 |
| 分支与基线 | 重新执行日期、分支、HEAD、main / origin/main、working tree 检查。 | 停止并回报。 |
| 文件范围 | 明确允许修改的 runtime 文件清单和禁止范围。 | 不创建 PR。 |
| 测试先行 | 先有最小测试计划或测试实现授权。 | 不写 runtime。 |
| feature flag | 定义默认关闭、按 tenant 开启、可回滚的 flag。 | 不上线、不默认启用。 |
| tenant / RBAC | 明确 tenant scope、institution scope、operator role 和权限拒绝行为。 | 不返回指标或下钻。 |
| 字段白名单 | 明确允许字段、禁止字段、错误响应低敏边界。 | 不输出数据。 |
| audit input | 明确低敏 audit input，禁止 metadata、raw payload、SQL、stack。 | 不写审计 runtime。 |
| rollback | 明确关闭 flag、回退空态、停用下钻和停用试运行动作的路径。 | 不合并 runtime。 |

## 6. 候选切片分层

以下切片均为 future candidate，不是本 PR 实现许可。

### Slice 0：只读契约对齐检查

目标候选：

- 只检查未来 contract / DTO / field whitelist / audit input 是否一致。
- 只检查 opportunity、manual confirm、dashboard metrics、dashboard aggregation、audit naming 和 test plan refinement 是否存在冲突。
- 不写 DB。
- 不写 SQL。
- 不接真实 HIS。
- 不处理真实客户数据。

边界候选：

- 只能作为未来实现前检查候选。
- 当前不写测试代码。
- 当前不新增 DTO、parser、service、repository 或 API。
- 如果发现契约冲突，应先新增 docs-only 修正文档，而不是进入 runtime。

### Slice 1：低敏 opportunity candidate read-only

目标候选：

- 未来只读返回三类机会候选摘要：
  - revisit reminder opportunity
  - repurchase opportunity
  - dormant customer opportunity
- 只返回低敏摘要。
- 只表示内部运营提示。
- 必须受 feature flag、tenant、RBAC 控制。

边界候选：

- 不创建任务。
- 不创建预约。
- 不创建成交。
- 不自动触达。
- 不写真实客户高敏字段。
- 不直接来自 UI mock。
- 不直接来自真实 HIS runtime。
- 不读取 credential。
- 不把 `customers.lifecycle` 直接当成 opportunity runtime。
- 不把 `follow_up_tasks` 全部当成机会对象。

### Slice 2：manual confirm trial action boundary

目标候选：

- 未来允许人工确认动作进入试运行边界。
- 仅限内部确认语义。
- 所有动作必须由内部人员显式选择。
- 所有结果必须可审计、可回滚、低敏展示。

必须覆盖候选结果：

- `confirmed`
- `converted_to_followup_tasks`
- `converted_to_internal_follow`
- `converted_to_appointment_intents`
- `converted_to_repurchase_intents`
- `wake_observation`
- `dismissed`
- `expired`
- `stale / already handled / invalid transition`

边界候选：

- 不触发外部消息。
- 不同步 HIS。
- 不创建真实预约 / 成交。
- 不把预约意向写成真实预约。
- 不把复购意向写成成交金额、销售额或 ROI。
- 不把唤醒观察写成自动外呼或自动触达。
- stale / already handled / invalid transition 必须低敏失败，不得静默成功。

### Slice 3：dashboard metrics read-only

目标候选：

- 未来只读展示低敏 dashboard metrics candidate。
- 只基于 opportunity 状态与 manual confirm 结果候选。
- 不使用真实经营 BI。
- 不返回成交金额、销售额、ROI。

必须覆盖 candidate metrics：

- `pending_total_opportunities`
- `pending_revisit_reminders`
- `pending_repurchase_opportunities`
- `pending_dormant_opportunities`
- `confirmed_opportunities`
- `converted_to_followup_tasks`
- `converted_to_internal_follow`
- `converted_to_appointment_intents`
- `converted_to_repurchase_intents`
- `wake_observation`
- `dismissed_opportunities`
- `expired_opportunities`
- `exception_metrics`

边界候选：

- read-only 不等于 dashboard aggregation runtime。
- 不写 SQL。
- 不新增 `dashboard_metric_snapshots`。
- 不做完整 BI。
- 不返回完整客户明细。
- 不把 UI mock 数值当真实统计。

### Slice 4：低敏 audit input

目标候选：

- 未来只规划低敏 audit input。
- 只记录稳定短码、状态前后、来源类型、机会类型、低敏摘要和 mock / seed / demo 标记。
- 不新增 audit enum。
- 不新增 audit metadata。
- 不实现 audit runtime。

必须覆盖候选：

- `dashboard_metric_viewed`
- `dashboard_drilldown_viewed`
- `dashboard_metric_source_unavailable`
- `dashboard_aggregation_unavailable`
- `metric_window_current`
- `metric_window_trial`
- `metric_source_missing`
- `aggregation_not_ready`
- `drilldown_low_sensitive`

边界候选：

- 不记录 request body、response body、SQL、stack、token、secret、credential、HIS raw payload、外部错误全文、完整联系方式、完整病历或 AI prompt / completion 全文。
- 如果 audit input 命名未 ready，future runtime 应阻断写入，而不是临时创造 reason。

## 7. feature flag 计划

future feature flag 候选如下，当前不新增配置，不写代码：

| feature flag candidate | 控制范围 | 默认状态 | 回滚方式 |
| --- | --- | --- | --- |
| `v1OpportunityRuntimeEnabled` | 低敏 opportunity candidate read-only。 | 默认关闭。 | 关闭后回到 UI mock / 空态 / 只读文案。 |
| `v1ManualConfirmTrialEnabled` | manual confirm trial action boundary。 | 默认关闭。 | 关闭后停用试运行确认动作，只保留提示文案。 |
| `v1DashboardMetricsReadonlyEnabled` | dashboard metrics read-only。 | 默认关闭。 | 关闭后停用真实候选指标，只展示 mock / 空态说明。 |
| `v1LowSensitiveDrilldownEnabled` | 低敏下钻。 | 默认关闭。 | 关闭后隐藏或禁用下钻入口。 |
| `v1AuditInputReadonlyEnabled` | 低敏 audit input 候选。 | 默认关闭。 | 关闭后不写入或不展示候选 audit input。 |

feature flag 规则：

- 必须默认关闭。
- 必须按 tenant 开启。
- 必须可回滚。
- 不允许全量默认开启。
- 不允许绕过 RBAC。
- 不允许 feature flag 触发外部系统动作。
- 不允许 feature flag 自动营销 / 自动触达。
- 不允许 feature flag 读取真实 HIS credential。
- 不允许 feature flag 把 mock / demo 数据混入真实 tenant。
- 本任务不新增配置，不写代码。

## 8. rollback 计划

future rollback 候选如下，当前不实现 rollback，不写配置，不写 migration，不写脚本：

| rollback candidate | 适用范围 | 预期效果 |
| --- | --- | --- |
| 关闭 feature flag | 所有 future slice。 | 停止候选 runtime 输出，回到安全空态或 mock-only 说明。 |
| 回退到 UI mock / 空态 / 只读文案 | dashboard、opportunity、manual confirm。 | 保留人工可解释提示，不展示真实候选数据。 |
| 停用低敏下钻 | drilldown。 | 禁用下钻入口，不返回客户明细。 |
| 停用 manual confirm trial action | 人工确认试运行动作。 | 停止确认动作入口，只保留文案说明。 |
| 停用 dashboard metrics read-only | 看板指标。 | 不返回候选指标，显示空态 / 异常态。 |
| 停用 audit input 写入 | audit input。 | 不写候选审计输入，避免不稳定命名进入审计。 |
| 保留人工可解释空态 | 所有展示层。 | 让内部人员知道当前能力已停用或未 ready。 |

rollback 禁止项：

- 不删除真实数据。
- 不清洗真实客户数据。
- 不执行 migration rollback。
- 不执行脚本批量改数据。
- 不把 rollback 写成数据修复。
- 不用 rollback 触发外部系统补偿。

## 9. tenant / RBAC 边界计划

future runtime 必须验证以下权限边界：

| 边界 | 必须验证 | 失败时行为 |
| --- | --- | --- |
| tenant scope | 请求只能访问当前 tenant 的机会、指标、下钻和审计输入。 | `permission denied` 或 tenant mismatch 低敏异常态。 |
| institution scope | 机构用户只能访问所属机构范围。 | 不返回跨机构数据。 |
| operator role | 只展示操作者角色，不展示员工高敏信息。 | 隐藏或拒绝。 |
| internal staff role | 人工确认必须由内部人员执行。 | 拒绝确认动作。 |
| read-only dashboard access | 只读看板权限只能查看指标，不得确认或导出高敏明细。 | 禁止动作和下钻。 |
| manual confirm permission | 只有具备确认权限的角色可执行试运行确认动作。 | 返回低敏权限拒绝。 |
| low-sensitive drilldown permission | 低敏下钻需要独立权限。 | 禁用下钻入口。 |
| audit visibility boundary | 审计可见范围必须低敏且受 tenant / role 控制。 | 不返回 audit input。 |

必须禁止：

- 跨机构读取。
- 无权限下钻。
- 无权限确认。
- 操作员看到高敏字段。
- dashboard 返回完整客户明细。
- 把 demo / mock 数据混入真实 tenant。
- 平台侧无边界读取机构客户运营明细。

## 10. 数据来源与低敏字段边界

future runtime 数据来源必须优先来自 V1 主链路低敏对象和人工确认结果候选，而不是 UI mock、真实 HIS runtime、完整 BI 或自动营销系统。

允许低敏字段候选：

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

字段边界要求：

- `sourceSummary` 必须由白名单字段生成，不得从 raw payload、病历正文或外部响应截取。
- `lowSensitiveNote` 必须是内部低敏摘要，不得保存备注全文或高敏正文。
- 错误响应和异常态也必须遵守字段白名单。
- 字段白名单违规如果进入 audit candidate，只能记录字段类别和边界类型，不能记录违规原文。

## 11. opportunity 候选 runtime 边界

future opportunity runtime 只能作为 read-only candidate 逐步推进。

| 机会类型 | future candidate 来源 | 必须保留的边界 |
| --- | --- | --- |
| revisit reminder opportunity | 治疗摘要、治疗阶段、恢复阶段、预约 / 到院、路径模板、随访结果。 | 内部复诊提醒，不自动约诊，不同步 HIS，不生成医疗诊断。 |
| repurchase opportunity | 项目周期、生命周期、治疗摘要、历史服务摘要、随访反馈。 | 内部复购提示，不代表成交预测、成交金额或自动营销。 |
| dormant customer opportunity | 最后预约、最后到院、最后治疗、最后随访、生命周期状态。 | 内部沉睡观察，不自动唤醒、不外呼、不发送消息。 |

future opportunity runtime 必须：

- 只返回低敏摘要。
- 等待人工确认。
- 按 tenant / RBAC 控制。
- 支持 feature flag disabled 空态。
- 支持来源缺失、阈值未确认和状态异常的低敏异常态。
- 不创建真实任务 / 预约 / 成交。
- 不直接复用 UI mock 数据。
- 不直接接真实 HIS runtime。

## 12. manual confirm 候选 runtime 边界

future manual confirm runtime 只能在明确授权后进入 trial action boundary。

| 候选结果 | future runtime 边界 | 禁止误读 |
| --- | --- | --- |
| `confirmed` | 内部人员确认机会仍值得处理。 | 不代表客户已联系或业务已完成。 |
| `converted_to_followup_tasks` | 转内部随访任务候选。 | 不代表外部消息已发送。 |
| `converted_to_internal_follow` | 转内部运营跟进候选。 | 不代表自动营销或外呼。 |
| `converted_to_appointment_intents` | 形成内部预约意向候选。 | 不是真实预约，不占号，不同步 HIS。 |
| `converted_to_repurchase_intents` | 形成内部复购意向候选。 | 不是真实成交、金额、支付或 ROI。 |
| `wake_observation` | 沉睡客户进入内部观察候选。 | 不是自动唤醒或自动触达。 |
| `dismissed` | 内部人员本次忽略候选。 | 不代表客户拒绝或医疗结论。 |
| `expired` | 处理窗口已过或来源失效候选。 | 当前不代表 scheduler / worker 已实现。 |
| `stale / already handled / invalid transition` | 对象过期、已处理或流转非法时失败。 | 不得静默成功，不得覆盖状态。 |

manual confirm future runtime 必须支持：

- feature flag disabled 时不可提交。
- tenant / RBAC 不满足时不可提交。
- stale / already handled / invalid transition 时返回低敏异常态。
- 所有状态前后、selectedAction、operatorRole 进入低敏审计候选。
- 不触发外部系统动作。

## 13. dashboard metrics / aggregation 候选 runtime 边界

future dashboard metrics read-only 可以作为候选，但 dashboard aggregation runtime 仍必须单独授权。

candidate metrics：

- `pending_total_opportunities`
- `pending_revisit_reminders`
- `pending_repurchase_opportunities`
- `pending_dormant_opportunities`
- `confirmed_opportunities`
- `converted_to_followup_tasks`
- `converted_to_internal_follow`
- `converted_to_appointment_intents`
- `converted_to_repurchase_intents`
- `wake_observation`
- `dismissed_opportunities`
- `expired_opportunities`
- `exception_metrics`

future dashboard metrics 边界：

- 只基于 opportunity 状态与 manual confirm 结果候选。
- 只读返回低敏指标。
- 不写 SQL。
- 不新增 `dashboard_metric_snapshots`。
- 不做完整 BI。
- 不返回成交金额、销售额、ROI。
- 不返回完整客户列表。
- 不把 mock / seed / demo 数值当真实统计。

aggregation 仍需单独授权的内容：

- current window、trial window、daily window、weekly window、configurable window、expired / overdue window 的真实计算。
- 去重逻辑。
- metric source missing、aggregation not ready、partial source unavailable、dashboard aggregation unavailable 的 runtime 处理。
- dashboard drilldown API。
- metric snapshot 或历史趋势。

## 14. audit input 候选边界

future audit input 只能使用稳定短码和低敏摘要。

| audit candidate | future 边界 |
| --- | --- |
| `dashboard_metric_viewed` | 查看指标卡，只记录 metricKey、bucket、窗口和低敏来源。 |
| `dashboard_drilldown_viewed` | 查看低敏下钻，只记录下钻类型和低敏对象摘要。 |
| `dashboard_metric_source_unavailable` | 指标来源不可用，只记录低敏原因短码。 |
| `dashboard_aggregation_unavailable` | 聚合不可用，只记录 `aggregation_not_ready` 等短码。 |
| `metric_window_current` | 当前窗口 reason candidate。 |
| `metric_window_trial` | 试运行窗口 reason candidate。 |
| `metric_source_missing` | 来源缺失 reason candidate。 |
| `aggregation_not_ready` | 聚合未 ready reason candidate。 |
| `drilldown_low_sensitive` | 下钻仅低敏 reason candidate。 |

audit input 禁止：

- 不新增 audit enum。
- 不新增 audit metadata。
- 不实现 audit runtime。
- 不修改 audit repository。
- 不保存 request body、response body、SQL、stack、token、secret、credential、HIS raw payload、外部错误全文。
- 不保存完整联系方式、完整病历、支付 / 合同 / 发票 / 回款数据或 AI prompt / completion 全文。

## 15. empty / exception state runtime 边界

future runtime 候选异常态必须低敏、可解释、可回滚。

| 异常态候选 | future 行为 | 禁止内容 |
| --- | --- | --- |
| no candidate opportunities | 展示无候选机会空态。 | 不写成历史任务已完成。 |
| metric source missing | 展示指标来源缺失低敏说明。 | 不暴露 raw payload 或 HIS raw ID。 |
| partial source unavailable | 展示部分来源不可用。 | 不暴露请求 / 响应正文或外部错误全文。 |
| aggregation not ready | 展示聚合口径未 ready。 | 不暴露 SQL、stack、DB URL。 |
| dashboard aggregation unavailable | 展示 dashboard aggregation 不可用。 | 不回退到完整客户列表。 |
| low-sensitive drilldown unavailable | 禁用下钻或展示低敏空态。 | 不导出完整客户明细。 |
| stale confirmation target | 提示确认对象已过期。 | 不覆盖状态，不静默成功。 |
| already handled | 提示对象已被处理。 | 不重复确认，不重复计数。 |
| invalid transition | 提示无效流转。 | 不临时放行。 |
| tenant scope mismatch | 提示租户范围不匹配。 | 不返回跨租户数据。 |
| permission denied | 提示权限不足。 | 不暴露对象是否存在的高敏细节。 |
| feature flag disabled | 提示能力未开启。 | 不绕过 flag 返回真实候选数据。 |

异常态要求：

- 不暴露 SQL、stack、raw payload、外部错误全文。
- 不展示高敏客户字段。
- 不自动降级为真实客户列表。
- 当前不实现异常处理代码。

## 16. 测试先行要求

未来任何 runtime PR 之前，至少应先完成或单独确认以下测试条件：

- test-plan refinement 已完成。
- runtime minimal slice plan 已完成。
- dashboard aggregation test plan 或最小 runtime test plan 另行确认。
- 字段白名单断言先行。
- tenant / RBAC 断言先行。
- stale / already handled / invalid transition 断言先行。
- feature flag disabled 断言先行。
- rollback 路径断言先行。
- audit input 断言先行。
- empty / exception state 断言先行。

本任务不新增测试代码。

本任务不运行测试。

本任务不新增 fixture / mock data / test helper。

未来 test implementation 也必须单独授权，且不得夹带 schema、API、runtime、dashboard aggregation 或 audit runtime 实现。

## 17. 不推荐的反模式

| 反模式 | 风险 |
| --- | --- |
| 把本计划当成 runtime 授权。 | 会绕过用户明确批准和项目治理启动检查。 |
| 在一个 PR 中同时做 schema、API、runtime、dashboard aggregation、audit 和测试。 | 难以审查、难以回滚，放大隐私、权限和状态风险。 |
| 不经 feature flag 直接全量开启。 | 无法按 tenant 试运行，无法快速回滚。 |
| 不做 tenant / RBAC 就返回 dashboard 指标。 | 可能跨机构泄露运营数据。 |
| 下钻返回完整客户明细。 | 突破低敏字段白名单。 |
| 把 opportunity candidate 直接创建成真实任务 / 预约 / 成交。 | 绕过人工确认，误导业务结果。 |
| 把 appointment intent 写成真实预约。 | 误导为已占号或 HIS 已同步。 |
| 把 repurchase intent 写成成交金额、销售额或 ROI。 | 混淆内部意向与真实经营结果。 |
| 把 wake observation 写成自动外呼或自动触达。 | 违反不自动营销 / 自动触达边界。 |
| 把 HIS runtime 当作 V1 主线前置。 | 让真实 HIS 接入阻塞客户运营闭环。 |
| 把 UI mock 数值当真实数据源。 | 把演示数据误读为生产统计。 |
| 异常态暴露 SQL、stack、raw payload、外部错误全文。 | 把调试信息变成高敏输出。 |
| 提前新增 dashboard_metric_snapshots。 | 过早 BI 化并默认授权指标快照。 |
| 提前写 audit metadata / audit enum。 | 放大审计 schema 与隐私风险。 |

## 18. 后续建议 PR 顺序

以下只是建议顺序，不构成开发许可：

1. V1-DASHBOARD-AGGREGATION-TEST-PLAN-01：docs-only / test-plan-only，细化指标窗口、去重、来源缺失、聚合未 ready 和异常态测试矩阵。
2. V1-FIELD-WHITELIST-RUNTIME-GUARD-PLAN-01：plan-only，规划未来字段白名单 guard、错误响应和 audit input 的最小边界，不写代码。
3. V1-RUNTIME-SLICE-0-READINESS-CHECK-01：仅在后续明确批准后，做只读契约对齐检查候选。
4. V1-RUNTIME-SLICE-1-OPPORTUNITY-READONLY-LATER-01：仅在后续明确批准后，做低敏 opportunity candidate read-only。
5. V1-RUNTIME-SLICE-2-MANUAL-CONFIRM-TRIAL-LATER-01：仅在后续明确批准后，做人工确认试运行动作边界。
6. V1-RUNTIME-SLICE-3-DASHBOARD-METRICS-READONLY-LATER-01：仅在后续明确批准后，做低敏 dashboard metrics read-only。
7. V1-RUNTIME-SLICE-4-AUDIT-INPUT-LATER-01：仅在后续明确批准后，做低敏 audit input。

任何 schema、migration、SQL、API、route、service、repository、DTO、dashboard aggregation runtime、audit runtime、audit enum、audit metadata、runner、scheduler、queue、worker、HIS、credential、真实外部系统、自动触达、真实预约、真实成交、支付 / 合同 / 发票、生产配置都必须单独确认。

## 19. 本文档边界

本文档只新增 V1 主链路 runtime minimal slice 计划，边界如下：

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

本文档中的 future candidate、后续建议和 PR 顺序都不是开发许可。未来进入 runtime、schema、API、SQL、dashboard aggregation、audit、字段白名单 enforcement 或测试实现前，必须由用户在新的当前任务中明确批准，并重新执行项目治理启动检查。

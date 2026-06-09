# V1 主链路 audit event naming plan 01

## 1. 背景与结论摘要

- 日期与时区：2026-06-09 CST +0800。
- 任务编号：V1-AUDIT-EVENT-NAMING-PLAN-01。
- 文档性质：docs-only / plan-only / no audit runtime / no audit metadata / no audit enum / no API changes / no DTO changes / no schema changes / no SQL / no runtime。
- 当前阶段：V1 UI mock 主链路、contract-to-implementation plan、implementation readiness review、schema impact plan、API boundary plan、field whitelist enforcement plan 已完成，当前进入 audit event naming plan。
- 本文档只规划 future opportunity、manual confirmation、dashboard metrics / drilldown、field whitelist violation、tenant / permission denial 等动作的 audit resource / action / reason / result 命名边界。

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，V1 主链路是治疗后客户运营闭环。HIS 是数据来源之一，不是 V1 主链路，不阻塞 1.0。

结论：

- 当前已有 `audit_events` 表、audit domain、audit repository、audit query parser、audit event DTO、机构 / 平台 audit API 与局部业务审计调用模式。
- 当前审计底座没有 metadata / payload 字段，这是 V1 低敏审计命名的重要基础。
- 当前 `AuditReason` 已混有权限、治疗摘要、HIS connection、credential provider、compensation 等语义；V1 主链路命名应单独成组，避免与 HIS / credential / compensation 命名混杂。
- 当前不建议直接实现 audit runtime。
- 当前不建议直接新增 audit enum。
- 当前不建议直接新增 audit metadata。
- 当前不建议修改 `audit_events` schema。
- 当前不建议让 audit repository 直接接收 V1 主链路动作。
- 本文档应作为后续 dashboard aggregation plan、test plan refinement、runtime minimal slice plan 的输入，而不是任何 runtime 开发许可。

## 2. 当前可复用审计基础

| 当前基础 | 当前用途 | 可复用点 | 不足 | 风险 | 是否适合作为 V1 audit naming 候选参考 |
| --- | --- | --- | --- | --- | --- |
| `audit_events` 表 | 保存 actor、tenant、resource、resourceId、action、result、reason、occurredAt、source。 | 字段短码化、tenant scoped、无 metadata / payload。 | resource/action/reason 仍来自当前安全与业务枚举，未覆盖 V1 opportunity / manual confirmation / dashboard metric。 | 直接扩 schema 或塞入自由摘要会破坏低敏边界。 | 适合做未来输出底座候选，不适合在本任务改动。 |
| `audit-events.ts` domain | 定义 `TenantAuditEvent`、`AuditResult`、`AuditReason`、创建 allowed / denied event 的 helper。 | 当前 result 稳定为 `allowed`、`denied`、`transitioned`；事件对象不携带原始 payload。 | reason 已包含 HIS / credential / compensation 相关短码。 | V1 reason 若直接混入现有集合，容易稀释主链路语义。 | 适合作为短码结构参考，不适合直接扩 enum。 |
| `audit-event-repository.ts` | record / list audit events，按 tenant、resource、action、result、reason、actor 查询。 | repository 只映射固定列，不接收 metadata。 | 没有 V1 动作级 input guard；不区分 opportunity / confirmation / dashboard 候选。 | 让 repository 决定 audit action 会把产品命名放到数据层。 | 适合作为 record / query 形态参考，不承担 naming 决策。 |
| `audit-event-query-parser.ts` | audit query 参数 allowlist、重复参数拒绝、enum / ID / cursor 校验。 | 可参考 query allowlist、ID pattern、稳定错误文案。 | query reason 受现有 reason 集合限制。 | 直接接收未命名 V1 reason 会导致查询口径不稳。 | 适合作为 future query DTO 风格参考。 |
| `audit-event-dto.ts` | 把审计 row 映射为低敏 list item。 | DTO 不含 metadata、stack、SQL、token、secret。 | DTO 当前只输出基础审计列。 | 若未来下钻需要摘要，必须先过字段白名单。 | 适合作为低敏输出 DTO 参考。 |
| existing resource / action / result / reason 模式 | `ProtectedResource`、`ProtectedAction`、`AuditResult`、`AuditReason` 形成当前审计短码。 | resource / action / reason 分层清晰，reason 是短码。 | resource 目前无 `opportunity`、`manual_confirmation`、`dashboard_metric` 等 V1 候选；result 候选也需要未来单独评估。 | 把 V1 语义直接塞入当前访问控制枚举会提前扩大权限面。 | 适合命名风格参考，不适合本任务落代码。 |
| tenant business API 审计调用模式 | 客户、预约、随访 list / mutation 的 allowed / denied 审计。 | 可参考权限拒绝、缺 tenant、not found、quota denied、conflict 的低敏审计。 | 当前 resource 只覆盖 customer / appointment / follow_up。 | 直接复用会把 opportunity 误实现成 follow_up。 | 适合作为权限和 tenant 保护参考。 |
| treatment follow-up confirmation 审计模式 | 治疗摘要随访建议经人工确认后创建内部随访任务，并处理 voided / invalid suggestion / conflict。 | 可参考人工确认后产生内部任务、来源失效、重复来源冲突。 | 只覆盖治疗摘要随访建议，不是统一人工确认。 | 直接复用会把所有机会都变成内部随访任务。 | 适合作为局部确认参考，不适合作为统一命名本身。 |
| institution / open-platform audit API | 机构侧隐藏 `tenantId`，平台侧可按安全 tenantId filter 查询。 | 权限边界、tenant filter、低敏错误响应成熟。 | V1 主链路下钻权限还未定义。 | 平台侧不可读取高敏客户运营细节。 | 适合作为 tenant / permission naming 参考。 |
| 当前无 metadata / payload 约束 | schema、repository、DTO、测试均强调不携带 metadata / requestBody / stack / token / secret。 | 是 V1 audit input 白名单的硬边界。 | V1 若需要更丰富摘要，必须用固定低敏字段或短码。 | 自由 metadata 是最大隐私和 schema 风险。 | 必须继承，不在本任务突破。 |

## 3. V1 audit naming 总原则

- 命名必须低敏：只允许内部 ID、资源类型、动作短码、原因短码、结果分类、状态前后、来源类型、机会类型、metric key、操作者角色和 demo 标记。
- 命名必须稳定：resource / action / reason / result 使用英文小写下划线短码，不使用会随 UI 文案变化的中文长句。
- 命名必须短码化：reason 是短码，不是 raw message，不是 rejected value，不是外部错误全文，不是完整备注。
- resource / action / reason / result 要分层：resource 表示对象，action 表示发生了什么，reason 表示为什么，result 表示结果分类。
- audit input 不允许 metadata / payload / raw body / raw response / raw source object。
- 不得把 HIS / credential / compensation audit 命名复用为 V1 主链路命名。
- 不得把 appointment intent 命名为真实 appointment created。
- 不得把 repurchase intent 命名为真实 deal created。
- 不得把 wake observation 命名为 external outreach sent。
- dashboard metric viewed / drilldown viewed 只能表示内部运营查看，不代表真实 BI、真实经营报表或生产聚合。
- field whitelist violation 可以成为 audit candidate，但不能记录违规原文。
- audit event naming 不是 audit runtime 授权。

## 4. Resource candidate 命名计划

以下 resource candidates 只作为 future naming plan，不新增 enum、不修改 access-control、不修改 audit domain。

| Resource candidate | 语义 | 适用动作 | 不适用动作 | 低敏字段边界 | 与现有 audit resource 的关系 | 是否需要后续单独审批 |
| --- | --- | --- | --- | --- | --- | --- |
| `opportunity` | 三类机会的通用内部运营提示对象。 | 进入待确认、确认、忽略、继续观察、过期、优先级变化、低敏备注变化。 | 真实预约创建、真实成交、真实外联发送、医疗诊断。 | opportunityType、sourceType、sourceId、statusBefore/After、priority、dueDate、mockSeedDemoFlag。 | 不等于现有 `follow_up`；不可用随访任务 resource 替代。 | 是 |
| `manual_confirmation` | 内部人员对机会、建议或看板项的确认对象。 | opened、submitted、completed、rejected、stale、already handled。 | 自动执行、外部消息发送、真实预约占号。 | confirmationSubjectType/Id、selectedAction、operatorRole、statusBefore/After、lowSensitiveSummary。 | 可借鉴治疗摘要随访确认，但不是现有独立 resource。 | 是 |
| `dashboard_metric` | 看板指标卡或指标口径。 | metric viewed、metric source unavailable、aggregation unavailable。 | SQL 聚合、完整 BI 导出、真实经营统计写入。 | metricKey、dashboardBucket、opportunityType、mockSeedDemoFlag。 | 不等于现有 `platform_health` 或 `audit_log`。 | 是 |
| `dashboard_drilldown` | 从指标进入低敏明细或确认对象列表。 | drilldown viewed、low-sensitive drilldown。 | 导出高敏客户明细、完整 BI 下钻。 | metricKey、dashboardBucket、sourceType、opportunityType、lowSensitiveSummary。 | 当前无等价 resource。 | 是 |
| `field_whitelist_violation` | 字段白名单违规检测或阻断事件。 | violation detected、blocked、sensitive output blocked。 | 保存违规原文、保存 request body、保存 rejected value。 | forbidden field category、boundary kind、result、operatorRole、mockSeedDemoFlag。 | 当前审计测试已有禁止 metadata 思路，但无该 resource。 | 是 |
| `appointment_intent` | 人工确认后形成的内部预约方向。 | appointment intent created、completed、expired。 | appointment created、HIS sync、真实预约占号。 | sourceType、sourceId、statusBefore/After、selectedAction、lowSensitiveSummary。 | 不等于现有 `appointment` resource。 | 是 |
| `repurchase_intent` | 人工确认后形成的内部复购方向。 | repurchase intent created、continued、completed。 | deal created、payment recorded、marketing sent。 | opportunityType、sourceSummary 短摘要、selectedAction、priority。 | 不等于任何支付、合同或成交 resource。 | 是 |
| `wake_observation` | 沉睡客户机会进入内部观察。 | wake observation started、continued、expired。 | outreach sent、auto wake sent、call made。 | dormant threshold summary、statusBefore/After、mockSeedDemoFlag。 | 不等于外部触达或消息 resource。 | 是 |
| `internal_followup_conversion` | 人工确认后转为内部随访任务的转换语义。 | converted_to_followup、converted_to_internal_follow。 | external message sent、customer contacted。 | followUpTaskId、sourceType、sourceId、statusBefore/After。 | 结果可关联现有 `follow_up`，但转换 resource 语义需单独命名。 | 是 |
| `source_summary` | 来源摘要生成、缺失或失效的低敏命名对象。 | source missing、invalid、expired。 | raw source persisted、HIS raw payload saved。 | sourceType、sourceId、sourceSummary 短摘要或缺失类别。 | 不等于外部系统 resource。 | 是 |
| `low_sensitive_note` | 低敏备注更新或阻断对象。 | note updated、note blocked、note summary recorded。 | full note saved、medical note saved。 | note length bucket、statusBefore/After、operatorRole；不记录备注全文。 | 不等于 audit metadata。 | 是 |
| `permission_guard` | 角色权限、敏感详情、审计范围拒绝。 | permission denied、role not allowed、audit scope denied。 | 业务状态变化。 | role、resource candidate、action candidate、result。 | 可参考现有 `role_denied`、`sensitive_detail_denied`。 | 是 |
| `tenant_boundary` | 缺 tenant、租户不匹配、跨租户资源拒绝。 | tenant boundary denied、cross tenant access denied。 | 业务处理、数据修复。 | tenant scoped id、resource candidate、result；不暴露其他租户客户明细。 | 可参考现有 `missing_tenant`、`cross_tenant_denied`。 | 是 |

## 5. Action candidate 命名计划

以下 action candidates 只作为命名计划，不新增 action enum，不修改 runtime。

### Opportunity actions

| Action candidate | 触发语义 | 是否必须审计 | 不得触发的外部动作 | 禁止携带高敏字段 |
| --- | --- | --- | --- | --- |
| `opportunity_suggested` | 机会建议形成但未进入正式待确认。 | 候选审计 | 自动触达、自动确认、医疗建议生成。 | raw source、完整病历、AI prompt/completion 全文。 |
| `opportunity_pending_confirmation` | 复诊、复购、沉睡机会进入人工处理范围。 | 必须审计 | 自动外联、真实预约、真实成交。 | 完整手机号、HIS raw payload、外部消息原文。 |
| `opportunity_confirmed` | 内部人员确认机会需要继续处理。 | 必须审计 | 自动联系客户、自动创建预约、自动成交。 | 完整备注、诊断正文、支付金额。 |
| `opportunity_dismissed` | 内部人员忽略或暂不处理机会。 | 必须审计 | 删除来源、隐藏历史、自动通知客户。 | rejected value、完整备注、个人隐私。 |
| `opportunity_observation_continued` | 机会被标记继续观察。 | 必须审计 | 自动唤醒、外呼、外部消息发送。 | 外呼内容、客户完整联系方式。 |
| `opportunity_expired` | 机会过期、来源失效或不再适用。 | 必须审计 | scheduler 自动处理、自动重建机会。 | SQL、stack、raw source。 |
| `opportunity_priority_changed` | 内部人员调整机会优先级。 | 候选审计 | 黑箱 AI 自动调级。 | 黑箱评分、高敏客户画像。 |
| `opportunity_note_updated` | 低敏备注发生变化。 | 候选审计 | 保存完整备注原文。 | 完整备注、病历、手机号、credential。 |

### Manual confirmation actions

| Action candidate | 触发语义 | 是否必须审计 | 不得触发的外部动作 | 禁止携带高敏字段 |
| --- | --- | --- | --- | --- |
| `manual_confirmation_opened` | 内部人员打开确认对象或确认入口。 | 候选审计 | 状态写入、外部动作。 | 客户高敏明细、完整 source object。 |
| `manual_confirmation_submitted` | 内部人员提交确认动作。 | 必须审计 | 自动消息、真实预约、真实成交。 | request body、完整备注、raw payload。 |
| `manual_confirmation_completed` | 确认动作完成并形成内部结果。 | 必须审计 | 对客触达、HIS 写回。 | 外部系统 response、SQL、stack。 |
| `manual_confirmation_rejected` | 确认动作被拒绝或不可执行。 | 必须审计 | 强制状态改变。 | rejected value、错误全文。 |
| `manual_confirmation_stale` | `statusBefore` 或状态版本过期。 | 必须审计 | 覆盖新状态、重放 mutation。 | 并发内部细节、SQL。 |
| `manual_confirmation_already_handled` | 对象已被处理。 | 必须审计 | 重复转换、重复任务创建。 | 其他操作者隐私、完整备注。 |

### Conversion / intent actions

| Action candidate | 触发语义 | 是否必须审计 | 不得触发的外部动作 | 禁止携带高敏字段 |
| --- | --- | --- | --- | --- |
| `converted_to_followup` | 机会经人工确认转为内部随访任务。 | 必须审计 | 外部消息发送、客户已联系。 | 消息原文、电话录音。 |
| `converted_to_internal_follow` | 机会经人工确认进入内部运营跟进。 | 必须审计 | 自动营销、外部触达。 | 促销话术全文、成交预测。 |
| `appointment_intent_created` | 形成内部预约意向。 | 必须审计 | 真实预约创建、HIS 同步、占号。 | 真实预约号、HIS appointment payload。 |
| `repurchase_intent_created` | 形成内部复购意向。 | 必须审计 | deal created、payment recorded、营销发送。 | 成交金额、支付、合同、发票。 |
| `wake_observation_started` | 沉睡客户进入内部唤醒观察。 | 必须审计 | outreach sent、auto wake sent、外呼。 | 外呼内容、完整联系方式。 |

### Dashboard actions

| Action candidate | 触发语义 | 是否必须审计 | 不得触发的外部动作 | 禁止携带高敏字段 |
| --- | --- | --- | --- | --- |
| `dashboard_metric_viewed` | 内部人员查看指标卡。 | 候选审计 | 聚合写入、外部动作。 | 客户完整明细、SQL。 |
| `dashboard_drilldown_viewed` | 从指标下钻查看低敏摘要。 | 候选审计 | 导出明细、跨租户读取。 | 完整手机号、病历正文、外部消息。 |
| `dashboard_metric_source_unavailable` | 指标来源缺失或不可用。 | 候选审计 | 自动修复来源。 | raw payload、外部错误全文。 |
| `dashboard_aggregation_unavailable` | 聚合未 ready 或不可用。 | 候选审计 | 写 SQL、暴露 stack。 | SQL、stack、DB URL。 |

### Field whitelist actions

| Action candidate | 触发语义 | 是否必须审计 | 不得触发的外部动作 | 禁止携带高敏字段 |
| --- | --- | --- | --- | --- |
| `field_whitelist_violation_detected` | 输入、输出、audit input 或 dashboard drilldown 检测到违规字段类别。 | 候选审计 | 保存违规原文。 | rejected value、request body。 |
| `field_whitelist_violation_blocked` | 违规字段被阻断。 | 必须审计 | 继续写入、回显原文。 | raw PII、credential、完整病历。 |
| `sensitive_output_blocked` | 输出 DTO / dashboard / audit 摘要阻断高敏内容。 | 必须审计 | 返回高敏数据。 | raw response、stack、external error。 |

### Permission / tenant actions

| Action candidate | 触发语义 | 是否必须审计 | 不得触发的外部动作 | 禁止携带高敏字段 |
| --- | --- | --- | --- | --- |
| `tenant_boundary_denied` | 缺 tenant、tenant mismatch 或 tenant scope 不合法。 | 必须审计 | 继续查询其他租户。 | 其他租户客户明细。 |
| `permission_denied` | 当前角色不允许执行动作。 | 必须审计 | 绕过 RBAC。 | 权限内部实现细节、敏感对象内容。 |
| `cross_tenant_access_denied` | 跨租户资源访问被拒绝。 | 必须审计 | 暴露目标是否存在。 | 其他租户 resourceId 之外的细节。 |

## 6. Reason candidate 命名计划

Reason 是稳定短码，不是中文长文，不保存 raw payload，不保存 rejected value，不保存外部错误全文，不替代 `lowSensitiveNote`。

### Opportunity reasons

| Reason candidate | 语义 | 边界 |
| --- | --- | --- |
| `from_treatment_summary` | 来源为治疗摘要。 | 不记录完整治疗摘要正文。 |
| `from_followup_task` | 来源为内部随访任务。 | 不记录随访沟通全文。 |
| `from_customer_lifecycle` | 来源为客户生命周期。 | 不把 lifecycle 当作 opportunity runtime。 |
| `from_repurchase_window` | 来源为复购窗口。 | 不代表成交预测。 |
| `from_silent_reactivation` | 来源为沉睡 / 静默激活试运行口径。 | 不代表自动唤醒。 |
| `from_revisit_window` | 来源为复诊 / 复查处理窗口。 | 不代表真实预约。 |
| `from_manual_review` | 来源为内部人工复核。 | 不记录完整备注。 |
| `source_missing` | 来源缺失。 | 不猜测来源，不写 raw payload。 |
| `source_invalid` | 来源无效或不允许。 | 不写外部错误全文。 |
| `source_expired` | 来源过期或不再适用。 | 不实现自动过期。 |

### Manual confirmation reasons

| Reason candidate | 语义 | 边界 |
| --- | --- | --- |
| `action_selected_by_operator` | 内部人员选择动作。 | 不写操作人隐私。 |
| `action_invalid` | 选中动作不允许。 | 不回显 rejected value。 |
| `state_stale` | 状态过期或客户端状态不新。 | 不写并发内部细节。 |
| `already_handled` | 对象已被处理。 | 不展示其他人完整备注。 |
| `expired_before_confirmation` | 确认前对象已过期。 | 不自动重建机会。 |
| `low_sensitive_note_updated` | 低敏备注发生变化。 | 不保存备注全文。 |

### Dashboard reasons

| Reason candidate | 语义 | 边界 |
| --- | --- | --- |
| `metric_window_current` | 当前待处理窗口。 | 不代表实时生产 BI。 |
| `metric_window_trial` | 试运行统计窗口。 | 不锁定最终口径。 |
| `metric_source_missing` | 指标来源缺失。 | 不写 raw source。 |
| `aggregation_not_ready` | 聚合逻辑未 ready。 | 不写 SQL 或 stack。 |
| `drilldown_low_sensitive` | 下钻仅低敏摘要。 | 不返回高敏明细。 |

### Field whitelist reasons

| Reason candidate | 语义 | 边界 |
| --- | --- | --- |
| `forbidden_field_in_request` | request DTO 含禁止字段。 | 不保存 request body。 |
| `forbidden_field_in_response` | response DTO 含禁止字段。 | 不返回高敏内容。 |
| `forbidden_field_in_audit_input` | audit input 含禁止字段。 | 不写 audit metadata。 |
| `forbidden_field_in_dashboard_drilldown` | dashboard drilldown 含禁止字段。 | 不导出客户明细。 |
| `forbidden_field_in_low_sensitive_note` | 低敏备注含禁止字段。 | 不保存备注原文。 |
| `forbidden_field_in_source_summary` | 来源摘要含禁止字段。 | 不保存 raw source。 |
| `raw_payload_detected` | 检测到 raw payload。 | 不保存 payload。 |
| `credential_detected` | 检测到 credential / token / secret。 | 不保存 credential。 |
| `pii_detected` | 检测到 PII。 | 不保存完整 PII。 |
| `medical_raw_detected` | 检测到完整医疗原文。 | 不保存病历正文。 |

### Permission / tenant reasons

| Reason candidate | 语义 | 与现有 reason 的关系 |
| --- | --- | --- |
| `tenant_missing` | 当前上下文缺少 tenant。 | 可映射或参考现有 `missing_tenant`。 |
| `tenant_mismatch` | 目标对象 tenant 与当前 tenant 不一致。 | 比现有 `cross_tenant_denied` 更偏 V1 命名候选。 |
| `role_not_allowed` | 当前角色不允许动作。 | 可映射或参考现有 `role_denied`。 |
| `cross_tenant_resource` | 跨租户资源访问。 | 可参考现有 `cross_tenant_denied`。 |
| `audit_scope_denied` | 审计范围或平台 / 机构范围不允许。 | 可参考 `audit_log` 权限边界。 |

## 7. Result candidate 命名计划

以下 result candidates 是未来 V1 主链路结果分类计划，不修改当前 `AuditResult`。

| Result candidate | 语义 | 使用边界 |
| --- | --- | --- |
| `success` | 动作成功完成。 | 只表达结果，不保存详情。 |
| `denied` | 权限、租户或策略拒绝。 | 适用于 permission / tenant boundary。 |
| `blocked` | 字段白名单或敏感输出被阻断。 | 适用于 whitelist / sensitive output。 |
| `skipped` | 动作被有意跳过。 | 可用于不满足来源或无需审计场景。 |
| `failed` | 动作失败。 | 不等于暴露 stack、SQL 或底层错误。 |
| `stale` | 状态过期。 | 适用于 manual confirmation stale。 |
| `conflict` | 并发、重复或活跃来源冲突。 | 不写数据库约束详情。 |
| `unavailable` | 依赖不可用。 | 适用于 dashboard source / aggregation unavailable。 |
| `not_ready` | 命名、聚合、guard 或 runtime 未 ready。 | 用于 plan / runtime-later 防误启。 |
| `invalid` | 输入、动作、状态或来源无效。 | 不回显原始输入。 |

说明：

- result 只表达结果分类。
- result 不存储错误详情。
- `failed` 不等于暴露 stack。
- `blocked` / `denied` 应用于字段白名单、权限、租户边界。
- `skipped` / `not_ready` 可用于 dashboard aggregation 或 audit naming 未就绪。
- 当前代码仍使用 `allowed`、`denied`、`transitioned`，未来如需调整 result 必须单独 PR、单独授权。

## 8. 主链路动作审计矩阵

| 主链路动作 | Resource candidate | Action candidate | Reason candidate | Result candidate | 是否必须审计 | 低敏字段边界 | 禁止字段 |
| ----- | ------------------ | ---------------- | ---------------- | ---------------- | ------ | ------ | ---- |
| 复诊提醒进入待确认 | `opportunity` | `opportunity_pending_confirmation` | `from_revisit_window` / `from_treatment_summary` | `success` | 是 | opportunityType、sourceType、sourceId、dueDate、statusBefore/After、mockSeedDemoFlag | 完整病历、诊断正文、真实预约号、HIS raw payload |
| 复购机会进入待确认 | `opportunity` | `opportunity_pending_confirmation` | `from_repurchase_window` / `from_customer_lifecycle` | `success` | 是 | opportunityType、sourceSummary 短摘要、priority、dashboardBucket | 成交金额、支付、促销话术、营销消息 |
| 沉睡客户机会进入待确认 | `opportunity` | `opportunity_pending_confirmation` | `from_silent_reactivation` | `success` | 是 | opportunityType、试运行窗口、sourceType、mockSeedDemoFlag | 完整联系方式、外呼内容、自动唤醒消息 |
| 人工确认提交 | `manual_confirmation` | `manual_confirmation_submitted` | `action_selected_by_operator` | `success` | 是 | selectedAction、operatorRole、statusBefore/After、confirmationSubjectId | request body、完整备注、操作人隐私 |
| 人工确认忽略 | `manual_confirmation` | `manual_confirmation_completed` / `opportunity_dismissed` | `action_selected_by_operator` | `success` | 是 | selectedAction、statusAfter=`dismissed`、lowSensitiveSummary | 完整备注、客户拒绝原话、外部消息原文 |
| 继续观察 | `opportunity` | `opportunity_observation_continued` | `from_manual_review` | `success` | 是 | statusBefore/After、operatorRole、dueDate window | 自动唤醒内容、外呼内容 |
| 转内部随访 | `internal_followup_conversion` | `converted_to_followup` | `action_selected_by_operator` | `success` | 是 | followUpTaskId、sourceType、sourceId、statusBefore/After | 外部消息发送结果、电话录音 |
| 形成预约意向 | `appointment_intent` | `appointment_intent_created` | `action_selected_by_operator` | `success` | 是 | sourceType、sourceId、statusBefore/After、selectedAction | 真实预约号、HIS sync payload |
| 形成复购意向 | `repurchase_intent` | `repurchase_intent_created` | `action_selected_by_operator` | `success` | 是 | opportunityType、priority、sourceSummary 短摘要 | deal created、成交金额、支付记录 |
| 进入唤醒观察 | `wake_observation` | `wake_observation_started` | `from_silent_reactivation` | `success` | 是 | dormant threshold summary、statusBefore/After | outreach sent、外呼内容、完整联系方式 |
| 机会过期 | `opportunity` | `opportunity_expired` | `source_expired` / `expired_before_confirmation` | `success` | 是 | dueDate window、sourceType、statusBefore/After | scheduler 日志、SQL、stack |
| 低敏备注更新 | `low_sensitive_note` | `opportunity_note_updated` | `low_sensitive_note_updated` | `success` | 候选 | note category、operatorRole、statusBefore/After | 完整备注原文、病历、手机号、credential |
| 看板指标查看 | `dashboard_metric` | `dashboard_metric_viewed` | `metric_window_current` / `metric_window_trial` | `success` | 候选 | metricKey、dashboardBucket、mockSeedDemoFlag | 客户高敏明细、完整 BI 数据 |
| 看板下钻查看 | `dashboard_drilldown` | `dashboard_drilldown_viewed` | `drilldown_low_sensitive` | `success` | 候选 | metricKey、低敏对象摘要、opportunityType | 完整客户列表、手机号、病历正文 |
| 看板聚合不可用 | `dashboard_metric` | `dashboard_aggregation_unavailable` | `aggregation_not_ready` | `unavailable` / `not_ready` | 候选 | metricKey、dashboardBucket、lowSensitiveSummary | SQL、stack、DB URL、外部错误全文 |
| 字段白名单违规阻断 | `field_whitelist_violation` | `field_whitelist_violation_blocked` | `forbidden_field_in_request` / `forbidden_field_in_response` / `raw_payload_detected` | `blocked` | 是 | boundary kind、field category、resource candidate | rejected value、request body、raw payload |
| 权限拒绝 | `permission_guard` | `permission_denied` | `role_not_allowed` / `audit_scope_denied` | `denied` | 是 | role、resource candidate、action candidate | policy 内部细节、高敏对象内容 |
| 跨租户拒绝 | `tenant_boundary` | `cross_tenant_access_denied` | `tenant_mismatch` / `cross_tenant_resource` | `denied` | 是 | tenant scoped id、resource candidate、result | 其他租户客户明细、完整 resource 内容 |

## 9. Audit input 字段白名单

Future audit input 只允许以下低敏字段类别：

- tenant scoped id。
- resource candidate。
- resourceId。
- action candidate。
- reason candidate。
- result candidate。
- statusBefore。
- statusAfter。
- opportunityType。
- sourceType。
- sourceId。
- dashboardBucket。
- metricKey。
- selectedAction。
- operatorRole。
- mockSeedDemoFlag。
- lowSensitiveSummary。

Audit input 禁止字段：

- metadata。
- payload。
- raw request。
- raw response。
- raw HIS payload。
- external message original text。
- full phone。
- ID card。
- full medical record number。
- full medical note。
- credential。
- token。
- secret。
- SQL。
- stack。
- rejected value。
- AI prompt / completion full text。
- true operator privacy。
- real payment / deal / amount。

补充规则：

- `lowSensitiveSummary` 只能是短摘要或受控说明，不是备注全文。
- `resourceId` 只能是内部 ID，不是真实外部预约号、HIS raw ID、证件号或手机号。
- `sourceId` 只能是内部来源引用；来源缺失时用 reason 短码表达，不猜测来源。
- `operatorRole` 优先于操作人隐私信息。
- audit input guard 必须晚于 field whitelist enforcement plan；当前不实现 guard。

## 10. 与现有审计体系关系

- 当前 `audit_events` 可作为未来 V1 审计输出底座候选。
- 当前不新增 metadata / payload。
- 当前不新增 enum。
- 当前不修改 `AuditReason` / `AuditAction` / resource。
- 当前不修改 audit repository。
- 当前不修改 `audit-events.ts`。
- V1 主链路命名应避免与 HIS connection / credential / compensation / recovery 线混杂。
- V1 主链路命名应单独成组、可读、低敏、可扩展。
- 当前 `AuditResult` 为 `allowed`、`denied`、`transitioned`；本文档中的 result candidates 是 future plan，不是当前 runtime 决定。
- 如果未来要把候选命名写入 enum、access-control、schema 或 repository，必须单独 PR、单独授权，并重新确认字段白名单、schema impact、API boundary 和测试计划。

## 11. 与 field whitelist enforcement 的关系

- audit naming 必须使用 field whitelist enforcement plan 的低敏字段边界。
- 字段白名单违规本身可以成为 audit candidate，但不能记录违规原文。
- `lowSensitiveNote` 更新可以审计，但不能写入完整备注原文。
- `sourceSummary` 可以审计来源类型和短摘要，但不能写入 raw source。
- audit input 只允许固定短码、状态、来源类型、内部 ID、metric key 和低敏摘要。
- audit input guard 必须晚于 field whitelist enforcement plan。
- 当前不实现 guard。

## 12. 与 dashboard aggregation 的关系

- `dashboard_metric_viewed` / `dashboard_drilldown_viewed` 可以是候选 audit action。
- `dashboard_aggregation_unavailable` 可以是候选 audit action / result。
- 看板下钻只能低敏，只能使用 metricKey、dashboardBucket、opportunityType、sourceType 和低敏对象摘要。
- 当前不实现 dashboard aggregation。
- 不得为了审计而提前写 SQL。
- 不得把 mock 指标查看写成真实经营指标审计。
- 不得把 dashboard metric viewed 写成真实 BI 导出。
- 不得在 dashboard audit 中记录客户完整明细、真实成交、支付、医疗效果或外部触达结果。

## 13. 与 API boundary 的关系

- route handler 不直接决定 audit 命名。
- service candidate 可在动作完成后提交低敏 audit input。
- repository 不承担 audit naming。
- DTO 不传 raw audit metadata。
- error response 不泄露 audit raw input。
- permission / tenant guard 可以产生低敏 audit candidate，但不能把跨租户对象详情写入审计。
- audit naming unavailable 时，未来 runtime candidate 应阻断临时审计写入，而不是随手创造 reason。
- 当前不改 API / route / service / repository / DTO。

## 14. 不推荐的反模式

| 反模式 | 风险 |
| --- | --- |
| 直接把中文业务文案作为 reason 存入审计。 | 文案会变，无法稳定查询，也容易夹带高敏信息。 |
| 把 rejected value 写进 reason。 | 会泄露完整手机号、病历、credential 或外部 payload。 |
| 把 request body 存进 metadata。 | 破坏当前无 metadata / payload 的低敏底座。 |
| 把 HIS raw payload 存进 audit。 | 把 HIS 风险治理线混入 V1 主链路，并泄露外部原文。 |
| 把外部消息原文存进 audit。 | 误导为真实触达，同时泄露客户沟通内容。 |
| 用 `appointment_created` 表示预约意向。 | 会把内部意向误写成真实预约。 |
| 用 `deal_created` 表示复购意向。 | 会把内部判断误写成真实成交。 |
| 用 `outreach_sent` 表示唤醒观察。 | 会把内部观察误写成自动触达。 |
| 在同一个 PR 中新增 audit enum、schema、service 和 runtime。 | 难以审查、难以回滚，会放大隐私和 schema 风险。 |
| 把 field whitelist violation 的原文保存下来。 | 违规阻断反而变成违规持久化。 |
| 让 repository 决定 audit action。 | 产品命名和状态语义会沉入数据层，难以测试。 |
| 把 dashboard mock 指标审计成真实经营指标。 | demo / seed / mock 口径会被误读为生产统计。 |

## 15. 推荐结论

- 当前不建议直接实现 audit runtime。
- 当前不建议直接新增 audit enum。
- 当前不建议直接新增 audit metadata。
- 当前不建议直接修改 `audit_events` schema。
- 当前不建议直接让 audit repository 接收 V1 动作。
- 当前不建议直接扩 `ACCESS_RESOURCES`、`ACCESS_ACTIONS`、`AuditReason` 或 `AuditResult`。
- 当前只建议把 V1 主链路 audit naming 作为后续 dashboard aggregation plan、test plan refinement、runtime minimal slice plan 的输入。
- 下一步仍应 docs-only / plan-only。

推荐的 future gate：

- 先完成 dashboard aggregation plan，确保 metric / drilldown 不误读为真实 BI 或真实经营统计。
- 再完成 test plan refinement，覆盖低敏 audit input、禁止字段、权限拒绝和跨租户拒绝。
- 再完成 runtime minimal slice plan，明确 feature flag、rollback、audit input guard 和 no metadata 策略。
- 任何 runtime 前必须由用户另行授权。

## 16. 后续建议 PR 顺序

以下仅是计划建议，不构成开发许可，仍应保持 plan-only / docs-only / review-only：

1. V1-DASHBOARD-AGGREGATION-PLAN-01。
2. V1-TEST-PLAN-REFINEMENT-01。
3. V1-RUNTIME-MINIMAL-SLICE-PLAN-01。

这些 PR 不能直接进入 runtime。未来若要实现 audit enum、audit metadata、audit runtime、schema、API、route、service、repository、DTO、dashboard aggregation、SQL 或 field whitelist guard，必须单独任务、单独审批。

## 17. 本文档边界

本文档只新增 audit event naming plan，边界如下：

- 本文档不新增 audit runtime。
- 不新增 audit metadata。
- 不新增 audit enum。
- 不修改 `audit-events.ts`。
- 不修改 audit repository。
- 不新增 API。
- 不修改 route。
- 不新增 service。
- 不新增 repository。
- 不新增 DTO。
- 不实现 runtime。
- 不修改 schema。
- 不新增 migration。
- 不写 SQL。
- 不授权 dashboard aggregation。
- 不授权真实 HIS / credential。
- 不授权真实客户数据。
- 不授权自动营销 / 自动触达。
- 不授权外部消息发送。
- 不授权真实预约 / 真实成交。
- 不授权医疗诊断。
- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不修改 package 或 lockfile。
- 不新增测试文件。

后续任何实现类工作都需要用户在新任务中明确授权。

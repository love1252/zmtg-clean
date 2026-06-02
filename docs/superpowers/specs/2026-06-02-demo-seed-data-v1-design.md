# Demo Seed Data V1 设计文档

> 状态：demo seed 实现设计文档。本文把 `docs/product/zhimei-demo-seed-data-plan.md` 转成后续可实现的 seed 代码方案；本阶段只做文档，不写 seed 代码，不进入 Phase 20。

## 0. 只读检查结论

本次只读核对了当前 schema、seed、Drizzle 配置、db 测试、产品演示脚本和 demo seed 数据方案，结论如下：

- 当前已有 seed 入口：`src/server/db/seed-demo-data.ts`。
- 当前已有 npm script：`db:seed`，命令为 `tsx src/server/db/seed-demo-data.ts`。
- 当前 Drizzle 配置为 `drizzle.config.ts`，schema 指向 `src/server/db/schema.ts`，migration 输出到 `drizzle/`。
- 当前已有 demo tenant：`demo-tenant-001` 和 `demo-tenant-002`。
- 当前 `customers` 表只保存 `maskedPhone`、`maskedMedicalRecordNo` 等脱敏字段，不包含真实手机号、身份证号、完整病历或咨询全文。
- 当前 `treatment_summaries` 表已支持 `voidedAt`、`voidedBy`、`voidReasonCode`、`voidReason`，无需为作废演示新增 schema。
- 当前 `follow_up_tasks` 表已支持 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey`，无需为来源任务演示新增 schema。
- 当前随访建议由 `buildTreatmentFollowUpSuggestions` 根据治疗摘要确定性生成，不是单独落表数据。
- 当前平台租户、套餐、套餐分配和配额快照已有 `tenants`、`tenant_plans`、`tenant_plan_assignments`、`tenant_quota_snapshots`。
- 当前 `audit_events` 表已有最小审计字段，但现有 seed 脚本尚未插入审计事件。
- 当前 seed 使用 `onConflictDoNothing`，适合初始插入，但不适合后续 demo 数据变更后自动刷新。
- 当前 seed 的治疗摘要转换函数未写入作废字段；后续若要 seed 已作废摘要，需要补充 `voidedAt`、`voidedBy`、`voidReasonCode`、`voidReason` 的插入映射。

因此 demo seed v1 不需要新增 schema / migration，也不需要新增 API。后续实现应优先复用现有 `db:seed` 入口，增强 demo 数据内容、幂等策略和测试覆盖。

## 1. 目标

Demo seed v1 的目标是支撑智美天工产品演示，让演示者可以用一套稳定的虚构数据串起机构端和平台端核心路径。

必须支撑：

- 机构老板版演示。
- 运营负责人版演示。
- 客户中心。
- 预约中心。
- 客户详情时间线。
- 治疗摘要录入后的管理、编辑、作废展示。
- 基于治疗摘要的确定性随访建议。
- 人工确认创建的来源随访任务。
- 智能随访中的来源治理。
- 机构审计日志。
- 平台租户、套餐、配额和商业化健康。
- 平台审计日志。

数据链路应覆盖：

```text
客户
↓
预约
↓
治疗摘要
↓
治疗摘要编辑 / 作废状态
↓
随访建议
↓
来源随访任务
↓
客户详情时间线
↓
审计记录
↓
平台租户、套餐、配额、商业化健康
```

所有演示数据必须是虚构数据，不引入真实客户信息，不进入 Phase 20 新功能开发。

## 2. 非目标

Demo seed v1 明确不做：

- 不接真实 HIS。
- 不接企业微信。
- 不接 AI。
- 不接 RAG。
- 不接 CRM、SCRM、OTA 或其他外部系统。
- 不导入真实客户。
- 不保存真实手机号。
- 不保存真实身份证号。
- 不保存真实病历号。
- 不保存完整治疗记录正文。
- 不保存完整病历正文。
- 不保存咨询对话全文。
- 不保存图片 / 文件原文。
- 不保存外部系统同步原文。
- 不保存 AI 生成医疗建议原文。
- 不修改业务逻辑。
- 不新增 API。
- 不新增数据库 schema / migration。
- 不修改权限、认证、租户隔离。
- 不自动触达客户。

如果后续实现时发现当前 schema 无法支撑演示，应先单独提出 schema 评估文档；但当前只读检查结论是：现有 schema 足够支撑 demo seed v1。

## 3. 演示租户设计

主演示租户为 `星澜医美中心`，建议复用当前演示机构 tenant id，避免修改演示登录用户绑定关系：

| 数据 | 建议值 | 映射表 / 字段 | 说明 |
| --- | --- | --- | --- |
| tenantId | `demo-tenant-001` | `tenants.id` | 复用机构演示账号绑定的租户。 |
| 租户名称 | `星澜医美中心` | `tenants.name` | 替换当前偏工程化演示名称。 |
| 租户状态 | `active` | `tenants.status` | 当前 enum 只有 `active` / `suspended`。 |
| 套餐版本 | `Growth Plan` / `growth-care` | `tenant_plans.name` / `tenant_plans.code` | 支撑平台租户管理与商业化健康。 |
| 客户配额 | `500` | `tenant_quota_snapshots.maxCustomers` | 与产品演示方案一致。 |
| 当前客户数 | `386` | `tenant_quota_snapshots.currentCustomers` | 作为商业化健康展示值，不要求等于 seed 实际客户行数。 |
| 预约配额 | `800` | `tenant_quota_snapshots.maxAppointments` | 展示预约配额。 |
| 当前预约数 | `612` | `tenant_quota_snapshots.currentAppointments` | 展示接近升级窗口。 |
| 随访任务配额 | `1200` | `tenant_quota_snapshots.maxFollowUps` | 展示后续运营空间。 |
| 当前随访任务数 | `930` | `tenant_quota_snapshots.currentFollowUps` | 展示使用率但不阻断演示。 |
| AI 调用配额 | `0` | `tenant_quota_snapshots.maxAiCalls` | 当前不进入 AI。 |
| 当前 AI 调用 | `0` | `tenant_quota_snapshots.currentAiCalls` | 避免误导 AI 已接入。 |

平台端展示方式：

- `平台租户管理` 显示 `星澜医美中心`、套餐、状态、配额。
- `商业化健康视图` 显示客户和预约使用率接近升级窗口。
- `平台审计日志` 显示平台管理员查看租户列表、查看商业化健康、被拒绝访问示例。

辅助租户建议：

| tenantId | 名称 | 状态 | 用途 |
| --- | --- | --- | --- |
| `demo-tenant-002` | 青禾皮肤管理 | `active` | 租户隔离和轻量机构展示。 |
| `demo-tenant-003` | 澄镜医疗美容 | `active` | 通过 Trial Plan 表达试用租户，不新增 `trial` status。 |
| `demo-tenant-004` | 远山医美连锁 | `suspended` | 展示平台状态治理，不实现冻结 / 恢复流程。 |

## 4. 演示角色设计

角色应落到 `tenant_members` 和 demo auth 上下文可以理解的用户 id。当前登录演示用户仍为 `demo-user-admin` 和 `demo-user-platform`，其他角色用于数据归属和审计展示。

| 角色 | userId | role | tenantId | 演示动作 |
| --- | --- | --- | --- | --- |
| 老板 / 院长 | `demo-user-admin` | `tenant_admin` | `demo-tenant-001` | 登录机构端，查看工作台、客户、摘要、随访和审计。 |
| 运营负责人 | `demo-user-ops` | `tenant_operator` | `demo-tenant-001` | 作为任务与审计中的运营负责人。 |
| 咨询师 | `demo-user-consultant` | `consultant` | `demo-tenant-001` | 负责预约、复诊和高价值客户跟进。 |
| 客服 | `demo-user-service` | `customer_service` | `demo-tenant-001` | 负责智能随访任务。 |
| 医助 | `demo-user-assistant` | `tenant_operator` | `demo-tenant-001` | 录入治疗摘要和护理建议。 |
| 平台管理员 | `demo-user-platform` | `platform_admin` | `null` | 登录平台端查看租户、配额、商业化健康和平台审计。 |

后续实现时可以只保留当前两个可登录用户，其他角色作为 `tenant_members`、`ownerUserId`、`consultantUserId`、`updatedBy`、`actorId` 出现在数据和审计中。

## 5. 客户数据设计

客户落到 `customers` 表。需要字段：

- `id`
- `tenantId`
- `displayName`
- `lifecycle`
- `priority`
- `ownerUserId`
- `projectInterest`
- `maskedPhone`
- `maskedMedicalRecordNo`
- `lastTouchSummary`
- `nextAction`
- `tags`

客户设计：

| 客户 ID | 展示名 | lifecycle | priority | ownerUserId | projectInterest | maskedPhone | maskedMedicalRecordNo | 演示用途 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `demo-cust-shen-zhixia` | 沈知夏 | `post_care` | `high` | `demo-user-service` | 光子嫩肤 | `138****1201` | `MR****1201` | 光子术后客户，主线 A。 |
| `demo-cust-xu-ruoning` | 许若宁 | `repurchase_window` | `medium` | `demo-user-consultant` | 水光补水复诊 | `139****2302` | `MR****2302` | 水光复诊客户。 |
| `demo-cust-gu-anran` | 顾安然 | `post_care` | `high` | `demo-user-assistant` | 眼周修复 | `137****3403` | `MR****3403` | 手术术后重点关怀客户。 |
| `demo-cust-liang-siyu` | 梁思语 | `scheduled` | `medium` | `demo-user-consultant` | 皮肤检测 | `136****4504` | `MR****4504` | 已预约未到院客户。 |
| `demo-cust-lu-qinghe` | 陆清禾 | `silent_reactivation` | `observe` | `demo-user-service` | 皮肤管理 | `135****5605` | `MR****5605` | 三个月未消费沉睡客户。 |
| `demo-cust-cheng-wanqing` | 程晚晴 | `repurchase_window` | `high` | `demo-user-consultant` | 抗衰疗程 | `134****6706` | `MR****6706` | 高价值复购客户。 |
| `demo-cust-ye-shuyan` | 叶舒颜 | `post_care` | `medium` | `demo-user-assistant` | 水光补水 | `133****7807` | `MR****7807` | 治疗摘要已作废客户，主线 B。 |
| `demo-cust-tang-yimo` | 唐以沫 | `post_care` | `medium` | `demo-user-service` | 注射后护理 | `132****8908` | `MR****8908` | 已创建来源任务客户。 |

要求：

- 只使用虚构姓名。
- `maskedPhone` 必须是脱敏字符串或安全假数据。
- 不使用真实身份证。
- 不使用真实病历号原文。
- 不使用真实图片或文件。

## 6. 预约数据设计

预约落到 `appointments` 表。需要字段：

- `id`
- `tenantId`
- `customerId`
- `customerDisplayName`
- `project`
- `scheduledAt`
- `consultantUserId`
- `status`
- `note`

预约设计：

| 预约 ID | 客户 | 类型 | status | project | scheduledAt | consultantUserId | 演示步骤 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `demo-appt-shen-treatment` | 沈知夏 | 治疗预约 | `completed` | 光子嫩肤 | `2026-06-02T10:30:00+08:00` | `demo-user-assistant` | 主线 A 治疗前置事件。 |
| `demo-appt-xu-revisit` | 许若宁 | 复诊预约 | `confirmed` | 水光补水复诊 | `2026-06-03T14:00:00+08:00` | `demo-user-consultant` | 展示复诊客户。 |
| `demo-appt-liang-consult` | 梁思语 | 面诊预约 | `pending_confirmation` | 皮肤检测 | `2026-06-02T16:00:00+08:00` | `demo-user-consultant` | 已预约未到院。 |
| `demo-appt-gu-review` | 顾安然 | 术后复查 | `completed` | 眼周修复复查 | `2026-06-01T11:00:00+08:00` | `demo-user-assistant` | 术后重点关怀。 |
| `demo-appt-lu-cancelled` | 陆清禾 | 活动咨询 | `cancelled` | 皮肤管理咨询 | `2026-05-29T15:30:00+08:00` | `demo-user-service` | 取消或沉睡客户，不讲自动营销。 |

## 7. 治疗摘要数据设计

治疗摘要落到 `treatment_summaries` 表。需要字段：

- `id`
- `tenantId`
- `customerId`
- `appointmentId`
- `treatmentDate`
- `treatmentProject`
- `treatmentCategory`
- `treatmentStage`
- `recoveryStage`
- `riskLevel`
- `ownerUserId`
- `summary`
- `nextCareAction`
- `tags`
- `voidedAt`
- `voidedBy`
- `voidReasonCode`
- `voidReason`

治疗摘要设计：

| 摘要 ID | 客户 | 项目 | category | stage | recovery | risk | nextCareAction | tags | 作废 | 演示用途 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `demo-trt-shen-photon-d1` | 沈知夏 | 光子嫩肤 | `laser_repair` | 首次治疗 | D1 | `normal` | D1 确认补水、防晒和泛红反馈。 | 光子、术后随访 | 否 | active 摘要，生成建议并创建任务。 |
| `demo-trt-xu-water-revisit` | 许若宁 | 水光补水 | `injection_review` | 疗程中 | 复诊前 | `watch` | 确认皮肤状态、复诊时间和续疗意向。 | 水光、复诊 | 否 | 有 `nextCareAction` 的复诊摘要。 |
| `demo-trt-gu-surgery-d3` | 顾安然 | 眼周修复 | `skin_repair` | 术后复查 | D3 | `urgent` | 今日完成重点关怀，确认肿胀和复查安排。 | 手术、重点关怀、高风险 | 否 | 高风险摘要和超时任务来源。 |
| `demo-trt-cheng-antiaging` | 程晚晴 | 抗衰疗程 | `skin_repair` | 疗程中 | 稳定期 | `normal` | 跟进疗程体验和下次预约。 | 高价值、抗衰、复购 | 否 | 已完成任务客户。 |
| `demo-trt-ye-water-voided` | 叶舒颜 | 水光补水 | `injection_review` | 首次治疗 | D1 | `watch` | 暂不作为后续运营依据。 | 水光、已编辑、已作废 | 是 | 编辑后作废，展示阻断。 |
| `demo-trt-tang-injection-care` | 唐以沫 | 注射后护理 | `injection_review` | 术后护理 | D2 | `watch` | 今日由客服确认局部恢复状态。 | 注射、来源任务 | 否 | 已创建来源任务，展示来源治理。 |
| `demo-trt-lu-silent-history` | 陆清禾 | 皮肤管理 | `skin_check` | 历史项目 | 稳定期 | `normal` | 后续可作为沉睡客户机会识别样例。 | 沉睡、皮肤管理 | 否 | 展示当前不讲自动营销。 |

作废摘要 `demo-trt-ye-water-voided`：

- `voidedAt`: `2026-06-02T18:00:00+08:00`
- `voidedBy`: `demo-user-admin`
- `voidReasonCode`: `manual_governance_review`
- `voidReason`: `摘要录入依据不完整，仅保留历史追溯`

注意：

- `treatmentCategory` 应使用当前确定性建议规则支持的 key，例如 `laser_repair`、`skin_repair`、`injection_review`、`skin_check`。
- 作废摘要仍写入表，并通过 `voidedAt` 派生为 `voided`。
- 作废摘要不删除，不自动取消既有来源任务。

## 8. 随访建议和随访任务设计

随访建议不落表，由治疗摘要 API 根据摘要字段确定性生成。Demo seed 需要准备能触发建议的治疗摘要字段。

建议场景：

| 建议场景 | 来源摘要 | 触发字段 | 期望建议 |
| --- | --- | --- | --- |
| 光子术后护理 | `demo-trt-shen-photon-d1` | `treatmentCategory=laser_repair`、`nextCareAction` | 光电治疗护理提醒 / 下一步护理动作确认。 |
| 水光复诊提醒 | `demo-trt-xu-water-revisit` | `riskLevel=watch`、`treatmentCategory=injection_review` | 关注风险治疗后随访 / 注射类治疗复诊提醒。 |
| 高风险术后关怀 | `demo-trt-gu-surgery-d3` | `riskLevel=urgent`、`recoveryStage=D3` | 高风险治疗后随访 / 恢复早期护理确认。 |
| 作废摘要阻断 | `demo-trt-ye-water-voided` | `voidedAt` 非空 | API 返回稳定阻断，不返回新建议。 |

随访任务落到 `follow_up_tasks` 表。需要字段：

- `id`
- `tenantId`
- `customerId`
- `customerDisplayName`
- `journeyId`
- `stage`
- `status`
- `dueAt`
- `suggestedAction`
- `riskLevel`
- `sourceTreatmentSummaryId`
- `sourceSuggestionKey`
- `updatedBy`
- `updatedAt`

任务设计：

| 任务 ID | 来源摘要 | 客户 | status | dueAt | sourceSuggestionKey | 演示用途 |
| --- | --- | --- | --- | --- | --- | --- |
| `demo-fu-shen-photon-d1` | `demo-trt-shen-photon-d1` | 沈知夏 | `due` | `2026-06-03T10:30:00+08:00` | `demo-trt-shen-photon-d1:category_laser_repair_care:3d:laser_repair` | 来源为治疗摘要的待处理任务。 |
| `demo-fu-gu-surgery-urgent` | `demo-trt-gu-surgery-d3` | 顾安然 | `due` | `2026-06-01T18:00:00+08:00` | `demo-trt-gu-surgery-d3:urgent_risk_followup:1d` | 超时 / 高风险任务。 |
| `demo-fu-cheng-done` | `demo-trt-cheng-antiaging` | 程晚晴 | `completed` | `2026-06-01T12:00:00+08:00` | `demo-trt-cheng-antiaging:next_care_action_followup:7d` | 已完成任务。 |
| `demo-fu-tang-source-active` | `demo-trt-tang-injection-care` | 唐以沫 | `scheduled` | `2026-06-03T15:00:00+08:00` | `demo-trt-tang-injection-care:watch_risk_followup:3d` | 已有来源任务，展示重复创建提示。 |
| 阻断场景 | `demo-trt-ye-water-voided` | 叶舒颜 | 不落表 | 无 | 无 | 作废摘要阻断建议和任务创建。 |

## 9. 客户详情时间线故事

### 客户 A：沈知夏，正常治疗后随访闭环

```text
预约 demo-appt-shen-treatment
↓
治疗摘要 demo-trt-shen-photon-d1
↓
随访建议由 API 确定性生成
↓
人工确认创建任务 demo-fu-shen-photon-d1
↓
任务进入智能随访
↓
审计记录：创建客户、创建预约、创建治疗摘要、创建随访任务
```

演示页面：

- 机构工作台。
- 客户中心。
- 客户详情时间线。
- 治疗摘要管理。
- 智能随访。
- 机构审计日志。

### 客户 B：叶舒颜，编辑和作废治理闭环

```text
预约记录
↓
治疗摘要 demo-trt-ye-water-voided
↓
治疗摘要编辑审计
↓
治疗摘要作废审计
↓
作废节点保留在时间线
↓
随访建议被阻断
↓
来源任务创建被阻断
```

演示页面：

- 治疗摘要管理。
- 客户详情时间线。
- 随访建议阻断提示。
- 机构审计日志。

## 10. 审计数据设计

审计事件落到 `audit_events` 表。需要字段：

- `eventId`
- `actorId`
- `actorRole`
- `tenantId`
- `scope`
- `resource`
- `resourceId`
- `action`
- `result`
- `reason`
- `occurredAt`
- `source`

演示审计事件：

| eventId | resource | action | result | reason | tenantId | resourceId | 演示用途 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `demo-audit-customer-shen-created` | `customer` | `create` | `allowed` | `allowed_by_policy` | `demo-tenant-001` | `demo-cust-shen-zhixia` | 创建客户。 |
| `demo-audit-appt-shen-created` | `appointment` | `create` | `allowed` | `allowed_by_policy` | `demo-tenant-001` | `demo-appt-shen-treatment` | 创建预约。 |
| `demo-audit-trt-shen-created` | `treatment_summary` | `create` | `allowed` | `allowed_by_policy` | `demo-tenant-001` | `demo-trt-shen-photon-d1` | 创建治疗摘要。 |
| `demo-audit-trt-ye-updated` | `treatment_summary` | `update` | `allowed` | `allowed_by_policy` | `demo-tenant-001` | `demo-trt-ye-water-voided` | 编辑治疗摘要。 |
| `demo-audit-trt-ye-voided` | `treatment_summary` | `update` | `allowed` | `treatment_summary_voided` | `demo-tenant-001` | `demo-trt-ye-water-voided` | 作废治疗摘要。 |
| `demo-audit-fu-shen-created` | `follow_up` | `create` | `allowed` | `allowed_by_policy` | `demo-tenant-001` | `demo-fu-shen-photon-d1` | 创建随访任务。 |
| `demo-audit-denied-role` | `treatment_summary` | `update` | `denied` | `role_denied` | `demo-tenant-001` | `demo-trt-ye-water-voided` | 权限拒绝示例。 |
| `demo-audit-quota-denied` | `appointment` | `create` | `denied` | `quota_exceeded_appointments` | `demo-tenant-001` | `demo-appt-quota-demo` | 配额拒绝示例。 |
| `demo-audit-platform-tenant-list` | `tenant` | `read_aggregate` | `allowed` | `allowed_by_policy` | `null` | `demo-tenant-001` | 平台查看租户列表。 |

审计事件禁止包含：

- 请求体。
- PII。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- SQL、stack、token、secret、`DATABASE_URL`、连接串。

注意：当前 `ACCESS_ACTIONS` 没有 `void`，作废审计应继续使用 `action=update`，`reason=treatment_summary_voided`。

## 11. 平台端数据设计

平台端需要覆盖：

- 租户列表。
- 套餐。
- 配额。
- 配额使用。
- 商业化健康提示。
- 平台审计日志。

租户数据：

| tenantId | tenantName | status | planCode | quota 展示 | 用途 |
| --- | --- | --- | --- | --- | --- |
| `demo-tenant-001` | 星澜医美中心 | `active` | `growth-care` | 386 / 500 客户，612 / 800 预约 | 主演示租户。 |
| `demo-tenant-002` | 青禾皮肤管理 | `active` | `starter-care` | 92 / 120 客户，144 / 200 预约 | 展示轻量机构和租户隔离。 |
| `demo-tenant-003` | 澄镜医疗美容 | `active` | `trial-care` | 38 / 50 客户，51 / 80 预约 | 用套餐表达试用，不新增 trial status。 |
| `demo-tenant-004` | 远山医美连锁 | `suspended` | `enterprise-care` | 1800 / 5000 客户，3200 / 6000 预约 | 展示状态治理，不实现真实冻结流程。 |

商业化健康提示通过现有页面根据套餐、配额和 denied audit 事件展示：

- 客户配额使用率较高。
- 预约配额使用率较高。
- 最近有 quota denied 审计事件。
- Trial 计划租户存在转化跟进机会。

## 12. 数据与页面映射

| 页面 | 需要 seed 的数据 | 说明 |
| --- | --- | --- |
| 机构工作台 | 星澜租户客户、预约、随访任务 | 工作台 API 聚合当前租户数据。 |
| 客户中心 | 8 个虚构客户 | 展示客户状态、优先级、下一步动作。 |
| 预约中心 | 5 条预约 | 展示面诊、治疗、复诊、取消、待确认。 |
| 客户详情时间线 | 客户 A / B 的预约、摘要、随访、审计 | 展示完整过程沉淀。 |
| 治疗摘要管理 | 7 条摘要 | 展示 active、edited、voided、高风险、nextCareAction、来源任务。 |
| 智能随访 | 4 条任务 | 展示待处理、超时、已完成、来源治理。 |
| 机构审计 | 机构范围 audit_events | 展示创建、编辑、作废、拒绝、配额拒绝。 |
| 平台租户管理 | tenants、tenant_plans、assignments、quota snapshots | 展示租户、套餐、配额。 |
| 商业化健康视图 | quota snapshots、denied audit | 展示配额风险和商业化健康。 |
| 平台审计 | 平台范围 audit_events | 展示平台管理员操作和拒绝事件。 |

## 13. Seed 实现策略

建议策略：

- 不新增单独命令，复用当前 `db:seed`。
- 可以新增 `src/server/db/demo-seed-records.ts` 承载完整星澜演示数据，让 `src/server/db/seed-demo-data.ts` 保持执行入口。
- 继续使用固定 demo IDs，所有 ID 使用 `demo-` 前缀。
- 通过 `tenantId=demo-tenant-001` 区分主演示租户。
- 通过 `demo-tenant-*` 区分 demo tenant 和普通 seed。
- 默认采用 upsert，而不是 `onConflictDoNothing`，确保重复执行后文案和状态可以刷新。
- 不做全表 reset。
- 如需要 reset，只允许受环境变量控制，并且只删除 `demo-tenant-*`、`demo-cust-*`、`demo-appt-*`、`demo-trt-*`、`demo-fu-*`、`demo-audit-*` 等确定性 demo id，按依赖反向顺序删除。
- 建议增加环境变量控制，例如 `ZMTG_ENABLE_DEMO_SEED=true`。
- 在生产环境中默认禁止执行 demo seed，除非后续明确设计安全流程。
- Seed 不接受外部 payload，不读取真实 HIS / 企微 / CRM / OTA 数据。

幂等策略：

- `tenants`：按 `id` upsert。
- `tenant_plans`：按 `id` 或 `code` upsert。
- `tenant_plan_assignments`：按 `id` upsert。
- `tenant_quota_snapshots`：按 `id` upsert。
- `tenant_members`：按 `id` 或 `tenantId + userId` upsert。
- `customers`：按 `id` upsert，保留 `tenantId` 不变。
- `appointments`：按 `id` upsert。
- `treatment_summaries`：按 `id` upsert，包含作废字段。
- `follow_up_tasks`：按 `id` upsert，并避免违反 active source unique index。
- `audit_events`：按 `eventId` upsert 或 conflict do nothing；审计 seed 是演示事实，不应在重复 seed 时生成随机新 event。

## 14. 验证策略

后续实现时至少验证：

- seed 可运行。
- 数据可重复生成。
- 重复运行不会创建重复行。
- 客户中心有 5-8 个演示客户。
- 预约中心有 3-5 条演示预约。
- 治疗摘要管理有 active / edited / voided 数据。
- 已作废摘要写入 `voidedAt`、`voidedBy`、`voidReasonCode`、`voidReason`。
- 客户详情时间线可打开。
- 客户 A 时间线包含预约、治疗摘要、来源随访任务、审计。
- 客户 B 时间线包含已作废治疗摘要节点。
- 智能随访有来源任务。
- 作废摘要会阻断建议和来源任务创建。
- 审计日志有演示事件。
- 平台端租户 / 套餐 / 配额 / 商业化健康可展示。
- 平台审计日志有平台演示事件。
- UI 和 DTO 不展示敏感字段。
- Seed 数据字符串不包含真实手机号、身份证号、病历号、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、SQL、stack、token、secret、`DATABASE_URL`。

建议验证命令：

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests src/modules/institution/tests src/modules/workspace/tests src/modules/audit/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

如果只实现 seed 数据且影响有限，可先跑上述定向测试；若 seed 影响 workspace smoke，再补跑：

```bash
node scripts/run-vitest.mjs run
```

## 15. 风险与边界

隐私边界：

- 所有数据必须虚构。
- 不得使用真实客户。
- 不得使用真实手机号。
- 不得使用真实身份证。
- 不得使用真实病历号。
- 不得使用真实图片 / 文件。
- 不得使用完整治疗正文。
- 不得使用完整病历正文。
- 不得使用咨询全文。
- 不得使用外部系统原文。
- 不得使用 AI 生成医疗建议原文。

技术风险：

- 当前 seed 使用 `onConflictDoNothing`，会导致文案变化后重复 seed 不刷新，需要后续改为 upsert。
- `follow_up_tasks_active_source_unique_idx` 会阻止同一租户、同一摘要、同一 suggestionKey 的活跃重复任务，seed 需要使用唯一且稳定的 suggestionKey。
- 当前随访建议由规则派生，不是表数据；seed 只能准备触发建议的摘要字段，不能 seed 建议表。
- 当前 `tenant_status` 不支持 `trial`，试用租户只能通过 plan 表达。
- 当前作废审计 action 应使用 `update`，因为 `ACCESS_ACTIONS` 尚无 `void`。

产品边界：

- Demo seed 不等于真实试点数据。
- Demo seed 不接真实外部系统。
- Demo seed 不证明 HIS / 企微 / AI 已完成。
- Demo seed 不自动触达客户。
- Demo seed 不进入完整经营智能中心。

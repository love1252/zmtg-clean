# 人工随访受控写完整闭环发布

- 日期：2026-08-17
- 基线：`578f57ab9024bde39925063f1f4ce5efddc7496d`
- Migration commit：`c86da39091bd0afd79ea3c503a4bef535f5c64c9`
- 任务：`CARE_MANUAL_FOLLOWUP_CONTROLLED_WRITE_CLOSED_LOOP_RELEASE`

## 完整业务目标

本任务是 Phase 1 只读阶段之后的第一个完整 Controlled Write 业务目标。正式机构范围内一次完成：

- 人工随访创建；
- 指定员工 / 固定角色池分配；
- 角色池原子认领；
- 管理员 / 运营改派与撤销认领；
- revision / CAS 状态流转；
- 结构化完成；
- 高风险升级；
- Care event 与 institution-attributed audit 同事务；
- `CareActionSourceV1`；
- Workbench 正式 Care action 消费；
- 正式 API / 页面；
- Capability Authority 发布。

本任务不拆成后续 CARE-01A/01B/01C 小任务；同一业务目标内的 corrective 均在本任务闭环。

## 0050 正式持久化

`0050_care_formal_follow_up_controlled_write` 已在 local candidate 受控执行。

新增正式对象：

```text
care_formal_follow_up_tasks
care_formal_follow_up_events
```

关键约束：

- exact `tenantId + institutionId`；
- 客户 exact-scope FK；
- task revision 严格 `+1`；
- task delete 禁止；
- task anchor 不可改写；
- event append-only；
- task + event 使用同一 transaction；
- stable idempotency key + request digest；
- 无 legacy business backfill。

历史 `follow_up_tasks` 的 4 条记录保持原样，不复制、不猜测 assignment、不转换成正式任务。

## 首个受控创建词汇

为避免把自由文本当作可执行动作，本次只发布：

```text
stageCode=manual_followup
actionCode=manual_contact
```

客户、计划时间、指定员工或固定角色池属于受控输入；`stageCode` / `actionCode` 不接受自由业务文本。

## 正式权限

正式 write authorization 仍遵循：

```text
formal session
→ identity
→ membership
→ scope/binding
→ Care section audience
→ care_task/update policy
→ one-shot actor + tenant/institution handle
→ exact-scoped repository
```

任务数据范围：

- `tenant_admin` / `tenant_operator`：当前机构正式人工随访任务；
- `consultant` / `customer_service`：本人具体任务 + 本人角色池尚未认领任务；
- 指定员工必须由正式 Membership/Binding 证明属于当前机构；
- 固定角色池只允许 `tenant_admin | tenant_operator | consultant | customer_service`。

创建：

- 仅 `tenant_admin` / `tenant_operator`；
- Capability Authority 只声明 capability release，不充当角色权限来源；
- 实际目标 API / 页面重新执行正式 write authorization 与 management role 判断。

## 状态、完成与风险

当前人工随访状态遵循已冻结 Care domain：

```text
pending
→ in_progress
↔ waiting_customer
→ completed
```

高风险走：

```text
pending/in_progress/waiting_customer
→ escalated
```

要求：

- 完成必须携带结构化 completion result；
- `escalated` 不允许伪装普通完成；
- `his_appointment_linked` 在本次 release 中明确拒绝新写入；
- 风险升级只记录受控风险事实，不发送消息、不调用 HIS；
- 本任务不宣称高风险治理关闭能力已经发布。

## CareActionSourceV1 与 Workbench

正式 Care provider 只从 `care_formal_follow_up_tasks` 生成：

- `overdue_followups`
- `today_due_followups`

预约两个 partition 继续：

```text
readiness=disabled
failureCode=not_released
```

Workbench：

- 消费正式 `CareActionSourceV1`；
- Conversation action source 在本任务仍 `disabled/not_released`；
- 展示当前角色可见的正式随访 action/card；
- Capability projection 会识别 `action_care_followup_create`，但 Workbench 通过独立 target write authorization 仅向管理员/运营暴露该 quick-create；
- 创建入口只在 `/hospital/care/followups` 由目标页面重新授权后提供，避免 Workbench 把 Capability Authority 误当成角色权限来源。

## 页面与 API

```text
GET  /api/v1/institution/followups
POST /api/v1/institution/followups
GET  /api/v1/institution/followups/:taskId
PATCH /api/v1/institution/followups/:taskId

/hospital/care/followups
/hospital/care/followups/:taskId
```

API 不接受 caller-supplied tenant/institution scope；请求体限制 8 KiB。

`/hospital/care` 根页面仍未发布。本任务只发布人工随访子页面，不用假预约补齐 Care 根页。

## Capability 状态

```text
PAGE_CARE_FOLLOWUPS=operational/pilot_released
ACTION_CARE_FOLLOWUP_CREATE=operational/pilot_released

GOVERNED_READONLY_PAGE_COUNT=8
CONTROLLED_WRITE_PAGE_COUNT=1
CONTROLLED_CREATE_RELEASE_COUNT=1
```

这里的 `pilot_released` 仍是仓库/本地 pilot release，不代表 Staging 或 Production。

## local candidate 验证

0050 migration 后：

```text
FORMAL_TASK_ROWS=0
FORMAL_EVENT_ROWS=0
LEGACY_FOLLOW_UP_ROWS=4
BUSINESS_BACKFILL=false
```

本任务还执行一次仅用于验证的事务内业务 DML：

```text
create
→ claim
→ in_progress
→ structured complete
→ four append-only events
→ ROLLBACK
```

Rollback 后 formal task/event 必须重新为 0；验证数据不得留存。

## 保持关闭

```text
REAL_SEND=false
REAL_INBOUND=false
HIS_MUTATION=false
EXTERNAL_NETWORK_MUTATION=false
CREDENTIAL_OPERATION=false
AI_AUTOMATION=false
STAGING=false
PRODUCTION=false
```

下一业务目标不从本任务自动开始。

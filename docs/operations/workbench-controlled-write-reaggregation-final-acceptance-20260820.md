# 工作台受控写重聚合最终验收

- 日期：`2026-08-20`
- 基线：`e318c09735909978b83190e036132294d840f276`
- 任务：`WORKBENCH_CONTROLLED_WRITE_REAGGREGATION_FINAL_ACCEPTANCE`

## 完整目标

在客户、预约、人工随访与会话四条 Controlled Write 业务线已经独立闭环的基础上，
一次完成 `/hospital` 的 Phase 2 受控写重聚合最终验收。工作台继续只消费正式
`CapabilityStatusV1`、既有 `CareActionSourceV1` 与各目标页独立授权后的入口，不读取
业务表，不替代目标 runtime 的角色、对象、scope、revision、quota 或状态机校验。

## 最终发布矩阵

```text
PAGE_WORKBENCH=operational/pilot_released
CARE_ACTION_SOURCE=ready
CONVERSATION_ACTION_SOURCE=disabled_not_released

OPERATIONAL_PAGE_COUNT=5
OPERATIONAL_PAGES=
  page_workbench
  page_customer_list
  page_conversation_queue
  page_care_appointments
  page_care_followups

READONLY_PAGE_COUNT=4
READONLY_PAGES=
  page_knowledge_library
  page_analytics_overview
  page_system_ai_usage
  page_system_audit

CONTROLLED_CREATE_RELEASE_COUNT=3
CONTROLLED_CREATE_ACTIONS=
  action_customer_create
  action_care_appointment_create
  action_care_followup_create
```

## 最终消费边界

- `page_workbench` 进入 `operational / pilot_released`，安全摘要为“工作台可用”。
- `/hospital` 仍接受合法的 `read_only / 工作台仅供查看` 快照作为安全降级，不把降级状态伪装为可操作。
- 新建客户、新建预约、新建随访继续由各目标 availability/runtime 重新校验当前角色与业务前置。
- Care 行动继续复用既有正式 `CareActionSourceV1`。
- Conversation action source 继续 `disabled / not_released`；本任务不伪造或发布新的 Conversation action aggregation。
- 会话处置只通过已发布的会话队列与详情页进入，不在工作台重造第二套 command surface。

## 硬边界

```text
SCHEMA_CHANGE=false
MIGRATION_REQUIRED=false
MIGRATION_EXECUTION=false
DATABASE_CONNECTION=false
DATABASE_WRITE=false
REAL_INBOUND=false
REAL_SEND=false
AI_AUTO_REPLY=false
AUTO_REACHOUT=false
WECOM_REAL_MUTATION=false
HIS_MUTATION=false
STAGING=false
PRODUCTION=false
```

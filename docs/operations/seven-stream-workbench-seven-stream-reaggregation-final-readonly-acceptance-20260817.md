# Workbench Seven-Stream Reaggregation Final Readonly Acceptance

- 日期：2026-08-17
- 基线：`81d9726d5ae287928c6cf4bcac37704e4f7b696a`
- 任务：`WORKBENCH_SEVEN_STREAM_REAGGREGATION_FINAL_READONLY_ACCEPTANCE`

## 结论目标

`/hospital` 只消费正式 `CapabilityStatusV1`，重聚合 Phase 1 已独立发布的八个 governed readonly pages：

```text
page_workbench
page_customer_list
page_conversation_queue
page_care_appointments
page_knowledge_library
page_analytics_overview
page_system_ai_usage
page_system_audit
```

工作台不读取各业务线 repository/table，不重算角色、scope、成熟度或 release decision；
未纳入上述冻结集合的后续页面不会被本任务自动带入。

## 边界

- Care action、Conversation action、Customer lifecycle 仍不因本任务自动发布。
- `quickCreateMenu=null`，Controlled Create 继续为 0。
- 仅修复两个既有正式 Authority 安全摘要与 registry 展示 label 的消费兼容：
  `知识库资料仅供查看`、`AI 使用统计仅供查看`；不放宽其他敏感摘要规则。
- 无 DB 连接/写入，无 schema/migration，无真实入站/发送，无 AI reception/automation，
  无 Staging/Production。

```text
WORKBENCH_SEVEN_STREAM_REAGGREGATION=ready
PHASE1_FINAL_READONLY_ACCEPTANCE=passed
PAGE_WORKBENCH=read_only/pilot_released
GOVERNED_READONLY_PAGE_COUNT=8
CONTROLLED_CREATE_RELEASE_COUNT=0
NEXT_PHASE=CONTROLLED_WRITE
NEXT_PHASE_AUTHORIZED=false
NEXT_TASK=UNASSIGNED_PENDING_EXPLICIT_SELECTION
```

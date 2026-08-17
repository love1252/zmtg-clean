# Conversations Queue Formal Runtime Release

- 日期：2026-08-17
- 基线：`d574d5e3994636bd07a569e04db2becd31af4ecf`
- 任务：`CONVERSATIONS_QUEUE_FORMAL_RUNTIME_RELEASE`
- 首切片：`CONVERSATION_QUEUE_LIST_BY_CURRENT_INSTITUTION`
- canonical API：`/api/v1/institution/conversations`
- canonical page：`/hospital/conversations`

## 发布结论

```text
CONVERSATION_FORMAL_READ_AUTHORIZATION=ready
CONVERSATION_FORMAL_REPOSITORY=ready
CONVERSATION_FORMAL_READER=ready
CONVERSATION_V1_API=ready
CONVERSATION_CANONICAL_PAGE=ready
PAGE_CONVERSATION_QUEUE=read_only/pilot_released
CONVERSATION_DATA_READINESS=ready_empty
GOVERNED_READONLY_PAGE_COUNT=8
CONTROLLED_CREATE_RELEASE_COUNT=0
```

正式会话队列使用 0049 建立的 `conversation_formal_sources`、`conversations` 与
`conversation_segments`。Repository 必须同时约束 exact `tenant_id + institution_id`；
Reader 只输出 conversation id、channel type、identity state、active segment state、
最近客户消息时间和更新时间，不输出 tenant/institution、source id、channel
conversation ref、消息正文或 provider raw 数据。

## Formal authorization

会话栏目 product audience 为四个机构角色；`conversation/read` Action Policy 同样允许：

- `tenant_admin`
- `tenant_operator`
- `consultant`
- `customer_service`

授权来源只接受 formal server session + authoritative identity/membership/scope，
并签发 exactly-once opaque pair handle。客户端不得提交 tenant/institution 作为授权事实。

## Empty cohort

当前 local candidate 的正式 source / conversation / segment / message / assignment /
risk / message-result 均为 0，因此页面发布可信 `empty`。不得使用 AiConversation、
fixture、mock、dry-run、`mock_sent`、企业微信 proof 或其他平台记录补数。

## Release boundary

```text
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false
REAL_INBOUND=false
REAL_SEND=false
AI_RECEPTION=false
AUTOMATION=false
CONTROLLED_CREATE=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本次只发布正式只读会话队列。会话详情、消息正文、人工接管/改派/结束、真实入站、
真实发送、AI 接待、自动触达仍保持关闭。

## 下一任务

```text
NEXT_TASK=WORKBENCH_SEVEN_STREAM_REAGGREGATION_FINAL_READONLY_ACCEPTANCE
NEXT_TASK_AUTHORIZED=false
```

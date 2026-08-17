# Conversations CONV-02 Formal Fact Persistence Schema/Migration Closure

- 日期：2026-08-17
- 基线：`c818441a7cbf9b94ef9bcb34e324a48be63109d0`
- Schema commit：`128d885f09a88d1fdf839f45f92088c8a1f96d60`
- Migration：`0049_conversations_formal_fact_persistence`
- candidate：`127.0.0.1:55434/zmtg_clean_local_dev_candidate`

## 闭环结论

```text
CONVERSATION_FORMAL_FACT_MODEL=ready
CONVERSATION_FORMAL_SOURCE_PROVENANCE=ready
CONVERSATION_CURRENT_STATE_REVISION_GUARD=ready
CONVERSATION_APPEND_ONLY_EVENT_FACTS=ready
CONVERSATION_DATA_READINESS=ready_empty

MIGRATION_0049=applied_local_candidate
BUSINESS_DML_EXECUTION=false
REAL_INBOUND=false
REAL_SEND=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
```

0049 建立 7 张正式会话持久化表：
`conversation_formal_sources`、`conversations`、`conversation_segments`、
`conversation_messages`、`conversation_assignments`、`conversation_risks`、
`conversation_message_results`。

正式 source 仅允许 `approved_channel_connection` 与
`approved_internal_operation`，不允许 mock/seed/demo。所有关系均从 exact
`tenant_id + institution_id` 作用域进入；消息只保存授权内容引用与低敏摘要 code，
不保存消息正文。

`conversations` 与 `conversation_segments` 允许未来受控 CAS 更新，但由 DB trigger
强制 revision 单调 +1，并禁止 scope/identity 主键漂移与 DELETE。source、message、
assignment、risk、message result 均为 immutable append-only facts。

## Local candidate migration

```text
PRE_MIGRATION_LATEST_WHEN=1786900800000
POST_MIGRATION_LATEST_WHEN=1786938000000

CONVERSATION_FORMAL_TABLE_COUNT=7
CONVERSATION_FORMAL_ENUM_COUNT=14
CONVERSATION_FORMAL_TRIGGER_COUNT=7
CONVERSATION_FORMAL_FK_COUNT=10

CONVERSATION_FORMAL_SOURCE_COUNT=0
CONVERSATION_ROOT_COUNT=0
CONVERSATION_SEGMENT_COUNT=0
CONVERSATION_MESSAGE_COUNT=0
CONVERSATION_ASSIGNMENT_COUNT=0
CONVERSATION_RISK_COUNT=0
CONVERSATION_MESSAGE_RESULT_COUNT=0
```

Migration 只执行 DDL 与 Drizzle journal 写入；没有 Conversation 业务事实 DML，
没有 seed/backfill，也没有把既有 AiConversation fixture、dry-run、企业微信 proof
或其他平台记录复制为正式会话事实。

## 下一任务

```text
NEXT_TASK=CONVERSATIONS_QUEUE_FORMAL_RUNTIME_RELEASE
NEXT_TASK_AUTHORIZED=false
```

下一任务在 0049 后 fresh 状态上实现 formal read authorization、exact-scoped
Repository/Reader、V1 API 与 `/hospital/conversations` 第一只读队列页面。
仍不得扩大到真实发送、自动触达、AI 接待、controlled create、staging/production。

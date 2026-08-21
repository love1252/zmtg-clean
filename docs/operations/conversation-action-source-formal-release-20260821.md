# Conversation Action Source Formal Release

- 日期：2026-08-21
- Base：`abfb85b036f2a193b9110746ad8bd8f789594ce3`
- Task：`CONVERSATION_ACTION_SOURCE_FORMAL_RELEASE`
- 分支：`feat/conversation-action-source-formal-release-20260821`

## 闭环目标

将 Workbench 中上一阶段冻结的 `disabledConversationActionSource` 替换为正式
`ConversationActionSourceV1`，发布 `waiting_human` 与 `unresolved_risk` 两个
Conversation action partition，并继续保持真实入站、真实发送与自动触达关闭。

## 正式读取链

```text
formal session
→ authoritative current Membership
→ exact tenant + institution scope
→ Conversation read authorization
→ page_conversation_queue operational / pilot_released
→ 0049 canonical Conversation persistence
→ current root + active segment
→ current assignment + current risk history + last customer message
→ ConversationActionSourceV1
→ WorkbenchActionAggregation
```

## 关键约束

- Workbench 不直接读取 Conversation table。
- 只消费 active segment；closed / historical segment 不进入当前 action。
- 同一 segment 同时满足 `waiting_human` 与 `unresolved_risk` 时只输出一条 action。
- `safeSummary` 仅使用正式低敏摘要码对应的固定文本。
- `CustomerReferenceV1.maskedReference=null` 合法。
- bounded queue 超限不静默截断，source fail-closed。
- Care action source 与 Controlled Create release 保持不变。

## 验证证据

```text
TARGETED_TESTS=54/54 PASS
HISTORICAL_GATE_TESTS=PASS
TYPECHECK=PASS
ARCHITECTURE_UNIT=148/148 PASS
ARCHITECTURE_QUALITY=PASS
LINT=PASS (0 errors; existing warnings only)
FULL_TESTS=7450/7450 PASS
BUILD=PASS
DIFF_CHECK=PASS
```

本正式闭环提交前会在包含 handoff/architecture/operations 文档的 exact final scope
上再次执行完整质量门禁。

## 硬边界

```text
SCHEMA_CHANGE=false
MIGRATION_REQUIRED=false
MIGRATION_EXECUTION=false
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

## 下一任务

```text
NEXT_TASK=UNASSIGNED_PENDING_EXPLICIT_SELECTION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

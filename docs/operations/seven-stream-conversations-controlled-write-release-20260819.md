# Conversations Controlled Write Closed Loop Release

```text
TASK=CONVERSATIONS_CONTROLLED_WRITE_CLOSED_LOOP_RELEASE
BASE=c1f59778a6a44424897adaa229200db5b6a17cbe
MIGRATION_REQUIRED=false
PAGE_CONVERSATION_QUEUE=operational/pilot_released
GOVERNED_READONLY_PAGE_COUNT=5
CONTROLLED_WRITE_PAGE_COUNT=4
CONTROLLED_CREATE_RELEASE_COUNT=3
```

## Canonical write chain

```text
formal session
→ authoritative identity
→ current Membership + active binding + formal Scope
→ conversation/update policy
→ one-shot exact tenant + institution actor
→ existing 0049 Conversation canonical persistence
→ root/segment revision CAS + assignment revision
→ institution-attributed audit
→ low-sensitive V1 DTO
```

## Released controlled mutations

- request human handling
- assign / reassign an awaiting-human segment
- assigned operator accepts human takeover
- current human handler releases takeover back to awaiting-human
- current handler marks waiting-customer
- current handler closes a clear/no-risk segment with structured close result

## Hard boundaries

```text
REAL_INBOUND=false
REAL_SEND=false
AI_AUTO_REPLY=false
AUTO_REACHOUT=false
WECOM_REAL_MUTATION=false
HIS_MUTATION=false
MIGRATION_EXECUTION=false
STAGING=false
PRODUCTION=false
```

No new Conversation table, alternate writer, free-text disposition, real provider mutation, or automatic AI transition is introduced by this release.

## Independent Review corrective

- `close` 对无风险分段只接受 canonical `conversation_risks` exact-scope 查询确认的
  `authoritative_empty` 完整性证明；普通 `histories=[]` 继续 fail-closed，不冒充权威无风险。
- `requestId` 的内部幂等引用同时绑定 `conversationId + segmentId + operation`，避免同一会话后续
  segment 复用 requestId 时碰撞历史 assignment event。
- `/hospital/conversations/automations` 与其 `:journeyId` 详情保留为物理静态 namespace，
  继续复用既有 capability-off 渲染；不得被 `:conversationId` 动态详情吞并。
- `AUTO_REACHOUT=false`、`REAL_SEND=false`、`REAL_INBOUND=false`；本修正不发布自动触达、
  真实收发、AI 自动回复或任何外部 mutation。

## Post-Ready Codex Review corrective

- P1：Conversation mutation 在进入单连接 DB transaction 前完成 institution audit attribution
  解析；transaction 内只使用预先 mint 的 verified attribution handle 写 audit，避免
  `max: 1` 连接池下 transaction 等待全局 reader、全局 reader 又等待 transaction 的自锁。
- P2：`assign/reassign` 的持久化 idempotency replay 在 root / segment / assignment stale
  revision 判定之前执行；相同 requestId + 相同操作载荷返回 `replayed` 且不重复 mutation /
  audit，载荷变化返回 `idempotency_conflict`。
- `.vscode/launch.json` 继续作为 intentional untracked 本地文件保留；tracked cleanliness
  仍使用 `git status --porcelain --untracked-files=no`，不得删除、提交或把它作为代码阻断项。
- REAL_INBOUND / REAL_SEND / AI_AUTO_REPLY / AUTO_REACHOUT / WeCom/HIS mutation /
  Staging / Production 继续保持关闭。

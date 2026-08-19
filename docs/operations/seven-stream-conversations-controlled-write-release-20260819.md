# 会话受控写完整闭环发布说明

```text
TASK=CONVERSATIONS_CONTROLLED_WRITE_CLOSED_LOOP_RELEASE
BASE=c1f59778a6a44424897adaa229200db5b6a17cbe
MIGRATION_REQUIRED=false
PAGE_CONVERSATION_QUEUE=operational/pilot_released
GOVERNED_READONLY_PAGE_COUNT=5
CONTROLLED_WRITE_PAGE_COUNT=4
CONTROLLED_CREATE_RELEASE_COUNT=3
```

## 正式写入链路

```text
正式 session
→ 权威 identity
→ 当前 Membership + active binding + 正式 Scope
→ conversation/update policy
→ 一次性精确 tenant + institution actor
→ 既有 0049 Conversation canonical persistence
→ root/segment revision CAS + assignment revision
→ institution-attributed audit
→ 低敏 V1 DTO
```

## 已发布的受控操作

- 请求人工处理（`request_human`）
- 对等待人工的 segment 执行 `assign / reassign`
- 已分配操作员接受人工接管（`takeover`）
- 当前人工处理人解除接管并回到等待人工（`release_takeover`）
- 当前处理人标记等待客户（`waiting_customer`）
- 当前处理人在 blocker 清空且无持久化风险事实时，以结构化结果正常结束会话（`close`）

## 硬边界

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

本次发布不新增 Conversation 表、不新增替代 writer、不引入自由文本处置、不执行真实 provider mutation，也不引入自动 AI 状态切换。

## 独立审查修正

- `close` 对无风险分段只接受 canonical `conversation_risks` exact-scope 查询确认的 `authoritative_empty` 完整性证明；普通 `histories=[]` 继续 fail-closed，不冒充权威无风险。
- `requestId` 的内部幂等引用同时绑定 `conversationId + segmentId + operation`，避免同一会话后续 segment 复用 requestId 时碰撞历史 assignment event。
- `/hospital/conversations/automations` 与其 `:journeyId` 详情保留为物理静态 namespace，继续复用既有 capability-off 渲染；不得被 `:conversationId` 动态详情吞并。
- `AUTO_REACHOUT=false`、`REAL_SEND=false`、`REAL_INBOUND=false`；本修正不发布自动触达、真实收发、AI 自动回复或任何外部 mutation。

## Ready 后 Codex 审查修正

- P1：Conversation mutation 在进入单连接 DB transaction 前完成 institution audit attribution 解析；transaction 内只使用预先 mint 的 verified attribution handle 写 audit，避免 `max: 1` 连接池下 transaction 与全局 reader 相互等待。
- P2：`assign/reassign` 的持久化 idempotency replay 在 root / segment / assignment stale revision 判定之前执行；相同 requestId + 相同操作载荷返回 `replayed` 且不重复 mutation / audit，载荷变化返回 `idempotency_conflict`。
- `.vscode/launch.json` 继续作为 intentional untracked 本地文件保留；tracked cleanliness 仍使用 `git status --porcelain --untracked-files=no`，不得删除、提交或把它作为代码阻断项。
- `REAL_INBOUND / REAL_SEND / AI_AUTO_REPLY / AUTO_REACHOUT / WeCom/HIS mutation / STAGING / PRODUCTION` 继续保持关闭。

## 最新 Codex 审查修正

- P2：`assign/reassign` 在重新解析目标 assignee 当前 Membership 之前，先通过 canonical Conversation repository 检查已持久化的同 requestId replay。已完成操作可依据持久化 assignment facts 返回 `replayed`；只有新写入才要求目标 assignee 当前 Membership 有效。
- P2：Conversation 详情读取同时检查当前 segment 的 canonical `conversation_risks`；`canClose=true` 只在当前 actor/assignment/handler 条件成立、local blocker 为空且持久化 risk fact 不存在时返回，避免展示必然失败的“结束会话”入口。

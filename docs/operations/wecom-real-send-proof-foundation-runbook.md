# 企业微信单条真实发送 proof 数据基础运行手册

## 范围

本任务仅建立 05B-A 数据基础、状态机和服务端门禁，不实现真实发送。

明确不包含：

- provider client、企业微信 API fetch 或任何真实出网；
- 真实发送 API、按钮、worker、queue、scheduler、webhook、自动重试；
- secret 配置、读取或输出；
- migration/seed 执行；
- 05B-B 正式发送执行、05C、05D。

在 05B-B 获得独立授权并完成复核前，不得获取 provider token，不得调用企业微信，不得发送消息。

## Migration

新增 forward-only migration：

- `drizzle/0036_v08_05b_a_single_real_send_proof_foundation.sql`

本任务只生成 migration 文件，不执行 migration。不得修改 `0034`、`0035`，不得放宽 `institution_channel_dry_run_snapshots_safety_check`。

## 三张权威表

### `wecom_real_send_proof_operations`

单条 proof operation ledger。唯一约束绑定：

- `operation_ref`；
- `confirmation_token_digest`；
- `tenant_id + institution_id + draft_id + source_ready_no_send_ref`。

表内只保存内部低敏引用、SHA-256 digest、固定枚举与时间戳；不保存 token 明文、recipient 原文、`external_userid`、`UserID`、provider raw response、URL、secret 或 access token。

### `wecom_real_send_proof_controls`

六层控制：

1. `global`
2. `tenant`
3. `institution`
4. `channel`
5. `customer`
6. `operator_role`

所有层必须恰好存在一条有效且 scope 匹配的记录。空表、缺层、重复层、未生效、过期、scope 不匹配、`proof_enabled=false` 或任一 `kill_switch_engaged=true` 均阻断，deny wins。

`global`、`tenant`、`channel` 的批准者不得是执行 operator；operator 也不得批准自己的 `operator_role` control。数据库 control 永远不能绕过最外层环境 hard stop。

`operator_role` 自审批同时由数据库 CHECK 拒绝；其余需要与当前执行 operator 比较的分权规则由服务端逐次评估。

新表没有 seed，部署后默认 fail-closed。

### `wecom_real_send_production_attestations`

保存 production migration/postcheck 的低敏证明：environment reference、database identity reference、migration target/hash、journal latest、固定 postcheck status、批准和复核引用。

不保存 `DATABASE_URL`、密码或 secret。缺失、身份/hash/journal 不匹配、非 `ready` 或已过期均阻断。新表为空时 fail-closed。

## `ready_no_send` 来源绑定

operation 不信任客户端提交绑定值，也不只信任 `controlledReachOutId`。服务端重新读取并验证：

- approved draft 与唯一 delivery；
- `ready_no_send` metadata 的完整固定边界；
- mapping、consent、frequency、dry-run snapshot 的当前行和版本；
- approved content 与 delivery content snapshot 一致；
- frequency `lastPreparedRef` 与准备 operation 关联；
- recipient binding 的低敏引用。

生成：

- `sourceReadyNoSendRef`
- `sourceReadyNoSendDigest`
- `contentHash`
- `recipientBindingDigest`
- `readinessFingerprint`

`readinessFingerprint` 绑定 tenant、institution、customer、draft、delivery、mapping id/version、consent id/version、frequency id/version、dry-run snapshot id/version、ready metadata digest、approved content hash、recipient binding digest。任一来源变化都会产生不同 fingerprint，旧 proof 不可继续使用。

issue 和 consume 都在事务内按 `mapping → consent → frequency → dry-run snapshot → draft` 的固定顺序锁定并重读当前安全事实；consume 必须重新计算 fingerprint，并重新检查环境 hard stop、六层 controls 与 production attestation，不能只依赖签发时的快照。

recipient binding 只能包含内部低敏 mapping proof reference 和 digest，不得保存真实 recipient identifier 原文。05B-A 不解析实际 provider recipient；05B-B 在任何 provider 调用前仍须接入受保护的 recipient identity digest/version 并完成独立复核，否则必须 fail-closed。

## Confirmation token

- 使用 Node.js CSPRNG `randomBytes(32)`，即 256-bit opaque token；
- token 明文仅由内部 issue service 返回一次；
- 数据库只保存 SHA-256 digest；
- 默认 TTL 为 4 分钟；
- consume 使用单条条件更新，必须同时满足 operation ref、digest、operator、`status=requested`、未消费、未过期；
- consume 前重新锁定 operation 与当前安全事实，任何 opt-out、kill switch、attestation 过期、内容或 recipient binding 变化都阻断；
- consume 成功时写 `confirmation_consumed_at`、`attempted_at`、`attempt_count=1` 并进入 `attempted`；
- token 明文禁止进入 audit、timeline、日志、错误信息和测试快照。

重复签发同一 draft/source 不返回旧 token 明文，也不创建第二条 operation。

## 状态机

允许转换：

- `requested → aborted`
- `requested → attempted`（必须已消费 token）
- `attempted → succeeded`
- `attempted → failed`
- `attempted → unknown_outcome`

所有 terminal 状态不可再次转换。`attempted` 不可再次 attempted；`failed`、`unknown_outcome` 不自动重试；`aborted` 不可发送。`ready_no_send` 只是来源准备状态，绝不等于 `succeeded`。

### `unknown_outcome`

表示 provider 结果无法确定。必须：

- 不增加 `completedCount`；
- 不签发新 token；
- 不创建第二个 operation；
- 不自动调用 provider；
- 转人工复核；
- 不保存 provider raw response。

timeout、connection reset、响应截断、transport error 和 `indeterminate` 均归入 `unknown_outcome`；只有 provider 明确拒绝才可进入 `failed`。

## `completedCount` 幂等回写基础

只有 operation 已为 `attempted` 且上层明确传入白名单 outcome `accepted`，才能进入 success finalize。

同一数据库事务内：

1. `SELECT FOR UPDATE` 锁 operation；
2. 已是 `succeeded` 时直接幂等返回，不重复计数；
3. `SELECT FOR UPDATE` 锁 frequency；
4. 验证 `lastPreparedRef === operationRef`；
5. 验证 `completedCount < maxCompletedCount`；
6. 验证 `completedCount < preparedCount`；
7. 写 `completedCount + 1`、`lastCompletedRef=operationRef`；
8. operation 写 `succeeded`、`provider_result_category=accepted`、`completed_frequency_ref=operationRef`；
9. 写固定低敏 audit。

任一步骤或 audit 失败，事务应回滚计数和状态。`attempted`、`failed`、`unknown_outcome`、`aborted` 均不增加 completed count。

若未来 provider 已明确成功但本地 finalize 失败，禁止再次 provider 调用；必须以原 operation 做人工 reconciliation。05B-A 只记录该状态基础，不实现 provider。

## Permission 与 session

新增专用 action：`real_channel / execute_once`。`approve`、`enable`、`test_connection` 均不能替代它。

当前 domain/service 硬门禁：

- `demo_session` 拒绝；
- 只接受 `server_session`（未来可扩展显式 `formal_session`）；
- 必须 tenant + institution context；
- 只允许具有专用 `execute_once` policy 的 `tenant_admin`；
- `tenant_operator`、consultant、customer service、platform/read-only 角色默认拒绝。

现有正式登录 session provenance 尚未传播到业务 `AccessContext`，因此在后续 auth/session 专项完成前，真实执行链仍会 fail-closed；本任务不扩大为完整 auth 重构，也不新增 route。

## 审计

使用固定 `AuditReason` 白名单，只记录低敏 operation reference、actor、scope、result、reason 和时间。禁止记录：

- token 明文；
- recipient 原文；
- provider raw response；
- message content；
- secret、access token、external identifiers；
- URL。

## 部署前门禁

即使 0036 已经由独立生产流程执行，以下任一项不满足也不得进入后续 provider 阶段：

- 环境 hard stop 未明确开启；
- 六层 controls 不完整或任一 deny；
- production attestation 不匹配或过期；
- ready source fingerprint 无法重新验证；
- 正式 session provenance 或 `execute_once` 权限缺失；
- operation 已 terminal 或 token 已消费/过期；
- provider 调用幂等与 unknown-outcome 人工流程尚未完成复核。

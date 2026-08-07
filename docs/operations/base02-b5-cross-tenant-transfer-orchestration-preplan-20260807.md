# BASE-B5 Cross-Tenant Transfer Orchestration 代码前置规划

> 日期：`2026-08-07`
>
> Base：`d9ca7610f51af1b4aa18638930bac14fe5e91e11`
>
> 状态：`preplanning_only`
>
> 本文只把已确认的 XT01–XT08 方向翻译为未来实现约束。XT09/XT10 仍阻断，因此本文不能作为 implementation authorization。

## 1. 目标

在未来新的实现授权下，为 Access Control 增加一个跨 tenant transfer orchestration，使同一全局 Auth Account 能在一个原子事务中：

```text
target Membership create
→ target Binding create
→ source Membership revoke
→ source Binding revoke
```

实际内部写顺序可为满足固定锁序而调整，但 commit 后必须表现为同一原子状态转换，不得出现可观察的长期双 tenant active access。

## 2. Owner 与边界

- Access Control 继续是 Membership／Binding lifecycle 唯一 Owner；
- Identity 继续只拥有全局 Auth Account／Session；
- Tenancy 继续拥有 Scope／Context；
- transfer orchestration 只是 application coordination，不成为第二套 Membership／Binding current；
- 禁止 direct SQL／Repository bypass；
- 禁止修改 existing same-tenant `rebind` command 的业务含义。

## 3. 候选实现结构

仅作为下一任务候选，尚未授权创建：

```text
src/modules/access-control/application/cross-tenant-transfer-service.ts
src/modules/access-control/server/cross-tenant-transfer-transaction.ts
src/modules/access-control/tests/CrossTenantTransferService.test.ts
src/modules/access-control/tests/CrossTenantTransferTransaction.test.ts
```

如独立实现预检证明还需要 composition root 或 port 文件，必须在 implementation admission 中重新冻结 allowlist。

## 4. transaction contract

未来实现最低要求：

```text
isolation=SERIALIZABLE
access_mode=READ_WRITE
statement_timeout=5s
lock_timeout=1s
idle_in_transaction_session_timeout=5s
automatic_retry=0
nested_transaction=0
```

在调用 tenant-scoped Owner lock 前先获取不可由客户端覆盖的 transfer/account advisory transaction lock，防止同一 account 的两个 cross-tenant transfer 并发。

随后必须以确定性顺序冻结：

1. source Membership current；
2. source active Binding；
3. target Membership create identity；
4. target active Binding absence；
5. target Scope active/revision；
6. command replay/evidence constraints；
7. 再进入 mutation。

任何锁、Scope、Membership revision、Binding version、active uniqueness、command replay 或 affected row 不满足即整批回滚。

## 5. Owner command 复用

优先复用：

- `executeMembershipCommandWithUnitOfWork`；
- Membership create 时内建的 optional Binding create；
- Membership revoke 时内建的 active Binding revoke；
- transaction-bound `MembershipCommandUnitOfWork`；
- transaction-bound active Scope assertion；
- append-only Membership/Binding evidence；
- CAS 和 command replay unique constraints。

禁止直接复用 `membership-command-external-transaction.ts` 作为 cross-tenant transfer，因为该适配器是 formal onboarding 专用，且强制一次 create Membership、role=`tenant_admin`、binding=`null`。

## 6. correlation

第一优先不新增 Schema。

未来 transfer 生成一个低敏、不含 PII 的 transfer command identity；source/target 两侧使用相同 command identity，但分别受各自 `(tenant_id, command_id)` 唯一键约束。

必须证明：

```text
same_transfer_id
source membership evidence = 1
source binding evidence = 1
target membership evidence = 1
target binding evidence = 1
```

如果静态/事务测试证明现有 evidence 无法形成充分、不可歧义的跨 tenant correlation，必须停止并进入 Schema 决策；不得以日志字段代替。

## 7. future prestate

未来 execution admission 至少要求重新只读冻结：

```text
source_membership=1 active complete
source_active_binding=1
source_binding_historical_orphan=1

target_scope=1 active
target_membership=0
target_active_binding=0

same_global_account=true
concurrent_writer=0
prepared_transaction=0
journal/shape=current_exact
```

role 必须从 source Membership 权威行只读取得，并在 transaction 内重新验证。

## 8. outcome unknown

禁止自动 retry。

若数据库在 COMMIT 确认阶段断连或返回 outcome unknown：

1. 立即停止；
2. 不再次执行 transfer；
3. 独立只读核验两侧 current/evidence；
4. 由审查决定接受已提交事实还是启动独立 forward-fix；
5. 不自动 restore。

## 9. XT09 blocker

上述 orchestration 即使完全成功：

```text
source Binding = revoked but retained
target Binding = active
active historical orphan = 0
relation orphan = 1
```

原因是 old Binding tuple immutable 且 revoked row 持久保留。因此这套代码前置规划**不能进入 implementation**，直到 relation-orphan 成功标准冲突被新的 ADR/branch decision 解决。

## 10. 本轮结论

```text
design_preplanning_complete=true
candidate_code_allowlist_frozen=false
implementation_admission_required=true
implementation_authorized=false
database_connection=false
dml_execution=false
ddl_execution=false
migration_execution=false
```

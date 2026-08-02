# BASE-02 Binding Runtime Writer／same-transaction evidence 前置预检

> 状态：`current static preflight`
>
> 日期：`2026-08-03`
>
> 审计 Base：`77ae18320388f1d54935ee2c3a93b18389032bf8`
>
> 当前任务：`BASE-B2 Binding Runtime Writer／same-transaction transition evidence 前置预检`

## 1. 预检结论

```text
base02_binding_runtime_writer_preflight=passed
accepted_path=B2_W1_extend_existing_access_control_transaction_kernel
binding_current_production_writer_files=1
binding_transition_runtime_writer_files=0
raw_binding_mutation_files=0
standalone_binding_command_files=0
transaction_bound_scope_port_files=0
implementation_allowlist_files=13
eligible_for_binding_runtime_writer_implementation=true
binding_runtime_writer_started=false
legacy_calibration_started=false
schema_migration_change_allowed=false
database_connection_allowed=false
base_b2_complete=false
eligible_for_base_b3=false
```

当前缺口是预期实施内容，不是新的架构阻断。下一切片可以按本文冻结边界实施，但不得扩大到 Schema／Migration、数据库执行或 BASE-B3。

## 2. 当前事实

### 2.1 已存在的 Access Control 事务内核

当前 Membership Owner Writer 已具备：

- 唯一外层 `SERIALIZABLE／READ WRITE` 事务；
- transaction-bound UoW 与回调结束后失效；
- create identity／Membership current／active Binding 固定锁；
- Membership revision CAS；
- Binding version CAS；
- current Membership、current Binding 与 Membership transition 同事务写入；
- callback 失败整批回滚；
- 无自动 retry、无 nested transaction、无 UPSERT。

当前 Binding current 的唯一生产 TypeScript mutation 文件：

- `src/modules/access-control/server/membership-command-repository.ts`

raw SQL Binding mutation 文件为 `0`。

### 2.2 已存在的物理基础

`0044_base02_binding_transition_expand` 已消费，Schema 已提供 transition enum、append-only evidence 表、command replay／version／Shape／provenance 约束、原／replacement Binding FK、current immutability 与 destructive mutation trigger。

### 2.3 当前缺口

1. Runtime 尚未导入或写入 Binding transition evidence；
2. `MembershipCommandUnitOfWork` 尚无 `appendBindingTransition`；
3. Membership create／revoke／delete 的 Binding side effect 尚未产生 Binding evidence；
4. standalone Binding `create／rebind／revoke／expire` command/domain/service 尚不存在；
5. command replay 目前只查询 Membership transition；
6. Access Control 尚无 transaction-bound active Scope assertion；
7. 当前写序为 Membership current → Binding current → Membership transition，需要在最后一步前插入 Binding evidence；
8. API／UI、项目级 Writer与业务 Reader不在本切片。

## 3. 接受实施路径 `B2-W1`

本切片继续复用现有 Membership command transaction kernel，不创建第二套事务器或数据库 client。

1. 扩展现有 transaction-bound UoW，加入 Binding lock、CAS、replay 与 evidence append；
2. 新增 Binding domain 与 application service；
3. Tenancy 提供 transaction-bound Scope assertion Port／Adapter；
4. Access Control 只依赖 Tenancy Port 类型，不依赖 Tenancy server／repository 实现；
5. Membership parent command 与 standalone Binding command 共用锁序、超时、错误映射和零重试策略；
6. 只建立内部 Owner Writer，不连接 API／UI。

## 4. command 与事务契约

### 4.1 identity

- standalone command：`bcmd1_` + 32-byte base64url；
- Binding transition：`btr1_` + 32-byte base64url；
- command identity 在任何 mutation 前查询；
- 已存在即 `command_replay_rejected`，不比较 payload、不返回历史成功。

### 4.2 create

锁 active Membership并验证 expected revision → 锁 persisted active Binding且必须不存在 → transaction-bound Scope assertion并读取 Scope revision → 插入 `active/version 1` Binding → 插入 `create` evidence → 任一步失败整批回滚。

### 4.3 rebind

锁 Membership → 锁 explicit old Binding并验证 expected version、未撤销、未过期 → 新 institution 不同 → 验证新 active Scope → old CAS `active/n → revoked/n+1` → 插入 replacement `active/version 1` → 插入单条 old→replacement `rebind` evidence。Membership revision 不推进。

### 4.4 revoke

explicit Binding identity／expected version；CAS `active/n → revoked/n+1`；`revokedAt=occurredAt`；同事务 append `revoke` evidence。

### 4.5 expire

service 内生成可信 `serverObservedAt`；仅 `expiresAt <= serverObservedAt` 可执行；`revokedAt／occurredAt=expiresAt`；recordedAt 不早于 occurredAt 与 serverObservedAt；同事务 append `expire` evidence。

## 5. Membership parent command 联动

Membership create／revoke／delete 发生 Binding side effect 时复用父 `mcmd1_` command identity，并在同一事务形成 Membership current、Binding current、Binding evidence、Membership evidence。

固定 mutation 顺序：

```text
Membership current
→ Binding current
→ Binding transition evidence
→ Membership transition evidence
```

固定锁序：

```text
Membership current／create identity
→ persisted active Binding
→ transaction-bound active Scope assertion
→ Binding current mutation
→ Binding transition evidence
→ Membership transition evidence（仅 parent command）
```

## 6. 失败矩阵

必须低敏 fail-closed：invalid identity/time、Membership missing/inactive/revision drift、Binding missing/duplicate/version drift/exhausted、rebind same institution/old expired、Scope missing/inactive/revision invalid/tenant mismatch、expire too early/no expiry、command replay、约束冲突、affected rows 非 `1`、timeout/serialization/deadlock/connection、scope adapter unavailable、evidence append failure与 transaction rollback。

禁止自动 retry、catch 后提交、UPSERT、duplicate-as-success。

## 7. 精确实施 allowlist

本轮只允许以下 `13` 个文件：

1. `src/modules/access-control/domain/binding-lifecycle.ts`
2. `src/modules/access-control/application/binding-command-service.ts`
3. `src/modules/access-control/application/membership-command-service.ts`
4. `src/modules/access-control/ports/membership-command-unit-of-work.ts`
5. `src/modules/access-control/server/membership-command-repository.ts`
6. `src/modules/access-control/tests/BindingLifecycle.test.ts`
7. `src/modules/access-control/tests/BindingCommandService.test.ts`
8. `src/modules/access-control/tests/MembershipCommandService.test.ts`
9. `src/modules/access-control/tests/MembershipCommandRepository.test.ts`
10. `src/modules/access-control/tests/MembershipCommandExternalTransaction.test.ts`
11. `src/modules/tenancy/ports/transaction-bound-institution-scope.ts`
12. `src/modules/tenancy/server/transaction-bound-institution-scope.ts`
13. `src/modules/tenancy/tests/TransactionBoundInstitutionScope.test.ts`

若实施证明需要增加文件，必须停止并重新预检，不得自行扩大范围。

## 8. 测试冻结

至少覆盖四命令 happy path／阻断、锁序、mutation 顺序、replay 前置、trusted expire time、parent Membership Binding evidence、CAS／constraint mapping、Scope 同事务读取、多行／不可用、single outer transaction、无 nested／retry、并发竞争、evidence 失败整批回滚，以及零 API／UI／Schema／Migration／数据库连接。

## 9. 禁止范围

- 不修改 `src/server/db/schema.ts`；
- 不修改 `drizzle/**`；
- 不连接数据库，不执行 Migration／Seed／DDL／DML；
- 不执行 legacy calibration；
- 不处理 historical orphan；
- 不执行 Scope FK `VALIDATE`；
- 不启动 BASE-B3～B6；
- 不放行项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

## 10. 后续准入

```text
eligible_for_binding_runtime_writer_implementation=true
implementation_requires_exact_allowlist=true
implementation_requires_independent_review=true
implementation_requires_full_quality_gate=true
implementation_requires_no_database_connection=true
base_b2_complete=false
eligible_for_base_b3=false
```

# W1C-P2 Safety + Real-send Atomicity / Owner Decision

> 日期：`2026-08-08`
>
> 状态：`admission_passed`
>
> Runtime implementation：`not_authorized`

## 1. 已确认的当前冲突

当前静态事实：

```text
trusted-reachout-safety-repository
  writes customerChannelContactConsents
  writes customerChannelFrequencyStates
  writes institutionChannelDryRunSnapshots

wecom-real-send-proof-repository
  writes weComRealSendProofOperations
  writes customerChannelFrequencyStates
  directly writes auditEvents
```

因此当前存在：

```text
shared_frequency_writer_collision=true
real_send_direct_audit_write=true
cross_owner_atomicity_required=true
```

## 2. Owner 冻结

### Messaging Owner

Messaging 是 W1C reach-out 业务事实的 canonical Writer Owner：

```text
customerChannelContactConsents
customerChannelFrequencyStates
institutionChannelDryRunSnapshots
weComRealSendProofOperations
```

Runtime implementation 后，上述事实的直接业务写入只允许位于：

```text
src/modules/messaging/server/wecom-reachout-command-repository.ts
```

尤其：

```text
customerChannelFrequencyStates direct_writer_count=1
```

Safety reserve 与 Real-send completedCount 必须调用同一个 canonical repository，不允许各自保留第二 Writer。

### Audit Owner

`auditEvents` 继续由 Audit 模块独占：

```text
src/modules/audit/server/audit-event-repository.ts
```

Messaging repository、legacy institution repository、Real-send repository 不得直接 `insert(auditEvents)`。

## 3. Transaction atomicity 冻结

跨 Owner 原子事务的 composition root 固定为：

```text
src/server/orchestration/wecom-reachout-transaction.ts
```

原因：

- `src/server/` 是 composition root，不是业务模块 Owner；
- 它可以在同一个 `TenantDatabase.transaction(...)` 中创建 Messaging canonical repository 与 Audit canonical repository；
- Messaging 不需要依赖 `audit/server`；
- Audit 不需要依赖 `messaging/server`；
- 避免新增 AQ007 `CROSS_MODULE_SERVER_REPOSITORY` 违规。

Real-send 的原子边界固定为：

```text
operation transition
+
frequency completion
+
audit evidence
=
same transaction database / same commit-or-rollback boundary
```

任何一个步骤失败，整个事务必须回滚；不允许先提交 operation 再补 frequency/audit。

## 4. Legacy compatibility 决策

### Safety repository

`trusted-reachout-safety-repository.ts`：

- 保留 read / lock read compatibility；
- legacy direct write methods 在 canonical Writer 建立后 fail-closed；
- 不再直接写 consent / frequency / snapshot。

### Safety transaction

`trusted-reachout-safety-transaction.ts`：

- 保留兼容函数名；
- transaction composition 改为委托 `src/server/orchestration/wecom-reachout-transaction.ts`；
- 不再自行实例化 legacy safety Writer。

### Controlled reach-out transaction

`wecom-controlled-reachout-transaction.ts`：

- 保留 legacy read compatibility；
- safety Writer 与 Audit Writer 通过 top-level composition root 获取；
- 不再自行组合 legacy safety Writer。

### Real-send repository

`wecom-real-send-proof-repository.ts`：

- 保留 compatibility API / type surface；
- direct `weComRealSendProofOperations` Writer 移入 Messaging canonical repository；
- direct `customerChannelFrequencyStates` Writer 删除；
- direct `auditEvents` Writer 删除；
- `runInTransaction` compatibility 路径委托 top-level composition root；
- 不允许 legacy second Writer。

## 5. Route / provider 边界

本 P2 Runtime 仍不允许修改或放行：

```text
wecom-reachout-safety route
wecom-controlled-reachout route
wecom-official-dry-run-snapshot route
wecom-customer-broadcast-task route
```

全部继续 `capability_disabled`。

同时：

```text
real_wecom_provider_call=false
reader_release=false
capability_release=false
production_change=false
```

## 6. Exact Runtime allowlist

唯一 Runtime allowlist：

`docs/operations/base02-w1c-p2-exact-runtime-allowlist-20260808.csv`

共 12 个文件。

如实现证明需要第 13 个文件，必须停止并重新准入。

## 7. Test matrix

`docs/operations/base02-w1c-p2-test-matrix-20260808.csv`

必须覆盖：

- single frequency Writer；
- tenant/institution/customer/operation scope；
- optimistic version/CAS；
- stale/cross-scope fail-closed；
- same-transaction atomicity；
- rollback-on-any-failure；
- Audit Owner；
- legacy Writer blockade；
- legacy transaction delegation；
- all related routes remain capability-off。

## 8. Schema / Migration

当前静态证据不要求：

```text
schema_change=false
migration_required=false
database_execution_required=false
```

如 Runtime 实现证明需要 Schema / Migration，必须立即停止并单独重新准入。

## 9. 当前授权状态

```text
w1c_p2_owner_decision=frozen
w1c_p2_atomicity_decision=frozen
w1c_p2_frequency_single_writer_decision=frozen
w1c_p2_audit_owner_decision=frozen
w1c_p2_legacy_rewire_decision=frozen
w1c_p2_exact_runtime_allowlist=frozen
w1c_p2_exact_runtime_allowlist_file_count=12
w1c_p2_runtime_authorized=false
w1c_complete=false
business_writer_phase_complete=false
```

## 10. 下一任务

```text
W1C-P2 Safety + Real-send exact 12-file Runtime implementation explicit authorization
```

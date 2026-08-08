# W1C Trusted Reach-out / Broadcast / Real-send evidence Writer Admission

> 日期：`2026-08-08`
>
> Base：`71e4900ba938538874e6e1084cdeaf9e8b49e3a3`
>
> 状态：`admission_passed_with_runtime_decomposition`

## 1. 总结

W1C 原始三个 Writer 候选复核为：

```text
src/modules/institution/server/trusted-reachout-safety-repository.ts
src/modules/institution/server/wecom-customer-broadcast-task-outcome-repository.ts
src/modules/institution/server/wecom-real-send-proof-repository.ts
```

静态 mutation：

```text
candidate_writer_files=3
insert_calls=6
update_calls=8
```

三条公开相关 Route 当前全部 capability-off：

```text
src/app/api/institution/customers/[customerId]/wecom-reachout-safety/route.ts
src/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route.ts
src/app/api/institution/followup-message-drafts/[draftId]/wecom-customer-broadcast-task/route.ts
```

因此本任务只做 Writer 治理准入，不放行任何 Route / Reader / Capability。

## 2. 关键审计结论

### Trusted Reach-out Safety

当前写入：

```text
customerChannelContactConsents
customerChannelFrequencyStates
institutionChannelDryRunSnapshots
```

### Broadcast Outcome

当前独立写入：

```text
weComCustomerBroadcastTaskProviderAttempts
```

并且当前 external production factory caller：

```text
0
```

因此可以作为 W1C 首个独立 Runtime vertical slice。

### Real-send evidence

当前 transaction repository 同时涉及：

```text
weComRealSendProofOperations
customerChannelFrequencyStates
auditEvents
```

其中：

```text
shared_frequency_writer_collision=true
direct_audit_write=true
```

这意味着 Safety 与 Real-send 不能被简单拆成两个各自独立 Writer migration。

## 3. W1C Runtime 分解决策

W1C 不执行“一次性把三个 repository 都搬走”。

冻结为：

```text
W1C-P1 = Broadcast Outcome independent Writer migration
W1C-P2 = Safety + Real-send atomicity / Owner decision
```

### W1C-P1

`docs/operations/base02-w1c-p1-broadcast-outcome-exact-allowlist-20260808.csv`

exact 6 files：

```text
1. src/modules/messaging/application/wecom-customer-broadcast-task-outcome-command-service.ts
2. src/modules/messaging/server/wecom-customer-broadcast-task-outcome-command-repository.ts
3. src/modules/messaging/tests/WeComCustomerBroadcastTaskOutcomeCommandService.test.ts
4. src/modules/messaging/tests/WeComCustomerBroadcastTaskOutcomeCommandRepository.test.ts
5. src/modules/institution/server/wecom-customer-broadcast-task-outcome-repository.ts
6. src/modules/institution/tests/WeComCustomerBroadcastTaskOutcome.test.ts
```

目标：

- Messaging canonical Broadcast Outcome command Owner；
- 继续使用同一 `weComCustomerBroadcastTaskProviderAttempts` 事实源；
- create 强制 tenant + institution + customer + operationId + operationRef attribution；
- update 强制完整 scope + expectedVersion CAS + not_finalized guard；
- legacy read / draft scope lookup compatibility 保留；
- legacy createNotStarted / updateWhenVersionMatches 并行 Writer future implementation 中 fail-closed；
- Broadcast Route 继续 capability-off；
- 不接真实 WeCom provider。

当前仍：

```text
w1c_p1_broadcast_runtime_authorized=false
```

## 4. W1C-P2 blocker

`docs/operations/base02-w1c-p2-safety-real-send-atomicity-blockers-20260808.csv`

固定 4 个 blocker：

1. Safety 与 Real-send 同时写 `customerChannelFrequencyStates`；
2. Real-send repository 直接写 `auditEvents`，跨越 Audit Owner；
3. operation + frequency + audit evidence 必须保持 transaction atomicity；
4. legacy safety / controlled-reachout transaction composition 在关闭旧 Writer 前必须明确 rewire 或 fail-closed retirement。

因此：

```text
w1c_p2_safety_real_send_runtime_authorized=false
w1c_p2_exact_runtime_allowlist_not_frozen=true
```

P2 必须单独完成 atomicity / Owner decision，不能在 P1 中顺手修改。

## 5. Schema / Migration

当前审计未证明需要新增 Schema 或 Migration。

```text
schema_change_required=false
migration_required=false
database_execution_required=false
```

任何实现若证明这一判断不成立，必须立即停止并重新准入。

## 6. Evidence

- `docs/operations/base02-w1c-writer-symbol-audit-20260808.csv`
- `docs/operations/base02-w1c-production-callgraph-20260808.csv`
- `docs/operations/base02-w1c-p1-broadcast-outcome-exact-allowlist-20260808.csv`
- `docs/operations/base02-w1c-p2-safety-real-send-atomicity-blockers-20260808.csv`

## 7. 当前授权状态

```text
w1c_symbol_audit=passed
w1c_callgraph_audit=passed
w1c_atomicity_audit=passed
w1c_runtime_decomposition=frozen

w1c_p1_broadcast_exact_allowlist=frozen
w1c_p1_broadcast_exact_allowlist_file_count=6
w1c_p1_broadcast_runtime_authorized=false

w1c_p2_safety_real_send_blocked_pending_decision=true
w1c_p2_safety_real_send_runtime_authorized=false

database_connection=false
runtime_change=false
schema_change=false
route_change=false
reader_release=false
capability_release=false
real_wecom_provider_call=false
audit_runtime_change=false
production_change=false
```

## 8. 下一任务

```text
W1C-P1 Broadcast Outcome exact 6-file Runtime implementation explicit authorization
```

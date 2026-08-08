# 智美天工唯一下一任务

## 唯一下一任务

```text
W1C-P1 Broadcast Outcome exact 6-file Runtime implementation explicit authorization
```

## W1C Admission 已完成

- W1C 三个候选 Writer 已逐符号复核；
- production callgraph 已复核；
- 相关 formal Route 均保持 capability-off；
- W1C 已拆成 P1 与 P2；
- P1 Broadcast Outcome 可独立迁移；
- P2 Safety + Real-send 存在 shared frequency Writer 与 Audit atomicity blocker。

## W1C-P1 exact 6-file Runtime allowlist

`docs/operations/base02-w1c-p1-broadcast-outcome-exact-allowlist-20260808.csv`

```text
1. src/modules/messaging/application/wecom-customer-broadcast-task-outcome-command-service.ts
2. src/modules/messaging/server/wecom-customer-broadcast-task-outcome-command-repository.ts
3. src/modules/messaging/tests/WeComCustomerBroadcastTaskOutcomeCommandService.test.ts
4. src/modules/messaging/tests/WeComCustomerBroadcastTaskOutcomeCommandRepository.test.ts
5. src/modules/institution/server/wecom-customer-broadcast-task-outcome-repository.ts
6. src/modules/institution/tests/WeComCustomerBroadcastTaskOutcome.test.ts
```

## P1 Runtime 目标

- Messaging canonical Broadcast Outcome command Owner；
- 同一 `weComCustomerBroadcastTaskProviderAttempts` 事实源；
- create 强制 tenant + institution + customer + operationId + operationRef；
- update 强制完整 scope + expectedVersion CAS + `not_finalized`；
- stale / cross-scope / finalized mutation fail-closed；
- legacy read / draft scope lookup compatibility retained；
- legacy createNotStarted / updateWhenVersionMatches parallel Writer blocked；
- Broadcast Route 继续 capability-off；
- 不接真实 WeCom provider。

## W1C-P2 明确不进入 P1

P2 blocker：

```text
Safety + Real-send both write customerChannelFrequencyStates
Real-send directly writes auditEvents
operation + frequency + audit evidence require atomic transaction ownership
legacy transaction composition needs explicit rewire/retirement decision
```

P2 必须后续单独做 atomicity / Owner decision，当前没有 exact Runtime allowlist。

## 当前仍禁止

```text
w1c_p1_broadcast_runtime_authorized=false
w1c_p2_runtime_authorized=false
database_connection=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
schema_change=false
route_change=false
reader_release=false
capability_release=false
real_wecom_provider_call=false
audit_runtime_change=false
care_expansion=false
production_change=false
```

如 P1 实现需要第 7 个文件，必须立即停止并重新准入。

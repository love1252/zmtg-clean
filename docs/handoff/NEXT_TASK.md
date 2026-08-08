# 智美天工唯一下一任务

## 唯一下一任务

```text
W1C-P2 Safety + Real-send exact 12-file Runtime implementation explicit authorization
```

## W1C-P2 Admission 已完成

已冻结：

```text
reachout_fact_owner=messaging
audit_event_owner=audit
customerChannelFrequencyStates_single_writer=true
transaction_composition_root=src/server/orchestration/wecom-reachout-transaction.ts
operation_frequency_audit_same_transaction=true
legacy_safety_writer_blockade_required=true
legacy_real_send_direct_writer_removal_required=true
legacy_transaction_delegation_required=true
exact_runtime_allowlist_file_count=12
```

## Exact Runtime allowlist

`docs/operations/base02-w1c-p2-exact-runtime-allowlist-20260808.csv`

```text
1. src/modules/messaging/application/wecom-reachout-command-port.ts
2. src/modules/messaging/server/wecom-reachout-command-repository.ts
3. src/modules/messaging/tests/WeComReachOutCommandRepository.test.ts
4. src/server/orchestration/wecom-reachout-transaction.ts
5. src/server/orchestration/wecom-reachout-transaction.test.ts
6. src/modules/institution/server/trusted-reachout-safety-repository.ts
7. src/modules/institution/tests/TrustedReachOutSafetyRepository.test.ts
8. src/modules/institution/server/trusted-reachout-safety-transaction.ts
9. src/modules/institution/tests/TrustedReachOutSafetyTransaction.test.ts
10. src/modules/institution/server/wecom-controlled-reachout-transaction.ts
11. src/modules/institution/server/wecom-real-send-proof-repository.ts
12. src/modules/institution/tests/WeComRealSendProofRepository.test.ts
```

## Runtime 必须满足

- `customerChannelFrequencyStates` 只保留一个 direct Writer；
- consent / frequency / snapshot / real-send operation Writer 归 Messaging；
- `auditEvents` 只能由 Audit repository 直接写；
- Real-send operation + frequency completion + audit evidence 同事务提交或回滚；
- legacy safety direct Writer fail-closed；
- legacy real-send direct frequency/audit Writer 删除；
- legacy safety / controlled transaction 委托 top-level composition root；
- 所有 W1C Route 继续 capability-off；
- 不接真实 WeCom provider；
- 不连接数据库执行写入；
- 不做 Schema/Migration。

## 当前授权状态

```text
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
production_change=false
```

如实现需要第 13 个文件，立即停止并重新准入。

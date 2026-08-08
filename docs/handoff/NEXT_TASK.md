# 智美天工唯一下一任务

## 唯一下一任务

```text
W1C-P2 Safety + Real-send atomicity / Owner decision admission
```

## W1C-P1 已完成

- Broadcast Outcome exact 6-file Runtime implementation merged；
- Independent Review passed；
- W1C-P1 complete=true；
- canonical Owner=messaging；
- same fact source=`weComCustomerBroadcastTaskProviderAttempts`；
- full scope attribution enforced；
- expectedVersion CAS enforced；
- `not_finalized` guard enforced；
- legacy read / draft-scope compatibility retained；
- legacy parallel Writer blocked；
- Broadcast Route 继续 capability-off。

## W1C-P2 已知 blocker

```text
1. Safety + Real-send both write customerChannelFrequencyStates
2. Real-send directly writes auditEvents
3. operation + frequency + audit evidence require atomic transaction ownership
4. legacy transaction composition needs explicit rewire/retirement decision
```

## 本任务只允许做 P2 admission

必须先冻结：

1. `customerChannelFrequencyStates` 单一 canonical Writer Owner；
2. consent / frequency / dry-run snapshot / real-send operation / audit evidence Owner 边界；
3. Real-send transaction atomicity；
4. Audit evidence 接入 port / orchestration 边界；
5. legacy safety / controlled-reachout transaction rewire 或 fail-closed retirement；
6. production callers / routes / services；
7. P2 exact Runtime allowlist；
8. concurrency / atomicity / negative tests。

当前仍禁止：

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
frequency_writer_change=false
audit_runtime_change=false
care_expansion=false
production_change=false
```

不得把 P2 admission 解释为 P2 Runtime 授权。

# 智美天工唯一下一任务

## 唯一下一任务

```text
W1C Trusted Reach-out / Broadcast / Real-send evidence Writer symbol audit + exact implementation allowlist admission
```

## 已完成

- BASE-02 complete=true；
- W1A Customers Core complete=true；
- W1B WeCom Mapping admission passed；
- W1B exact 6-file Runtime implementation merged；
- W1B Independent Review passed；
- W1B complete=true；
- Messaging canonical Mapping command service/repository 已建立；
- `weComCustomerMappingStates` 仍为唯一事实源；
- tenantId + institutionId + proofContactId scope 已强制；
- expectedCustomerId + expectedStatus guard 已强制；
- legacy Mapping read compatibility 保留；
- legacy Mapping parallel Writer 已关闭；
- Mapping Route 继续 capability-off。

## W1C 首批既定 Writer 候选

```text
src/modules/institution/server/trusted-reachout-safety-repository.ts
src/modules/institution/server/wecom-customer-broadcast-task-outcome-repository.ts
src/modules/institution/server/wecom-real-send-proof-repository.ts
```

## W1C 下一任务必须先完成

1. 逐符号核验三类 repository 的真实 insert/update；
2. 枚举 production callers / services / transactions / routes；
3. 区分 Trusted Reach-out、Broadcast outcome、Real-send evidence 的事实所有权；
4. 确认 Messaging canonical Owner 与必要的 application/transaction boundary；
5. 核对 tenantId + institutionId attribution；
6. 核对频控、安全快照、provider attempt、real-send proof、audit evidence 之间的原子性边界；
7. 冻结 legacy/bypass blockade 方案；
8. 冻结 exact implementation file allowlist；
9. 冻结 targeted / negative tests；
10. 如需要 Schema/Migration 或范围扩张，必须单独重新准入；
11. 获得明确 W1C Runtime implementation 授权后才能修改 Runtime。

## 当前仍禁止

```text
w1c_runtime_implementation_authorized=false
database_connection=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
schema_change=false
mapping_route_change=false
reader_release=false
capability_release=false
real_wecom_provider_call=false
care_expansion=false
audit_expansion=false
production_change=false
```

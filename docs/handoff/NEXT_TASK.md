# 智美天工唯一下一任务

## 唯一下一任务

```text
W1B WeCom Mapping exact 6-file Runtime implementation explicit authorization
```

## Runtime implementation 只能修改

`docs/operations/base02-w1b-wecom-mapping-implementation-exact-allowlist-20260808.csv`

中的 exact 6 files：

```text
1. src/modules/messaging/application/wecom-customer-mapping-command-service.ts
2. src/modules/messaging/server/wecom-customer-mapping-command-repository.ts
3. src/modules/messaging/tests/WeComCustomerMappingCommandService.test.ts
4. src/modules/messaging/tests/WeComCustomerMappingCommandRepository.test.ts
5. src/modules/institution/server/wecom-customer-mapping-repository.ts
6. src/modules/institution/tests/WeComCustomerMappingRepository.test.ts
```

## Runtime 目标

- Messaging canonical WeCom Mapping command Owner；
- 同一 `weComCustomerMappingStates`，不创建第二事实源；
- create/update 强制 tenant + institution + proofContact scope；
- stale/cross-scope mutation fail-closed；
- legacy mapping read compatibility 保留；
- legacy mapping write methods fail-closed；
- W1C controlled-reachout consumer 不修改；
- Mapping Route 继续 capability-off。

## 当前仍禁止

```text
w1b_runtime_implementation_authorized=false
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
w1c_runtime_change=false
production_change=false
```

如实现证明需要第 7 个文件，必须立即停止并重新准入。

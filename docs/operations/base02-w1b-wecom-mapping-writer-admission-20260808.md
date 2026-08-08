# W1B Customer Channel / WeCom Mapping Writer Admission

> 日期：`2026-08-08`
>
> Base：`3c73077d94c1c47e51656112d0aea10a2f8f2dac`
>
> 状态：`admission_passed`

## 结论

```text
w1a_customers_core_complete=true

w1b_legacy_db_writer_file_count=1
w1b_mapping_insert_count=1
w1b_mapping_update_count=1
w1b_external_write_service_caller_count=0
w1b_external_transaction_caller_count=0
w1b_w1c_mapping_read_consumer_count=2

w1b_route_capability_off=true
w1b_canonical_owner=messaging
w1b_exact_allowlist_file_count=6
schema_change_required=false
migration_required=false
w1b_runtime_implementation_authorized=false
```

## Writer 与调用边界

当前真实 DB Writer：

```text
src/modules/institution/server/wecom-customer-mapping-repository.ts
```

目标表：

```text
weComCustomerMappingStates
```

现有 create/update 已同时包含 tenantId、institutionId、proofContactId scope。

Mapping Route 继续 `capability_disabled`，当前没有 production caller 直接调用 `writeWeComCustomerMapping` 或 `runWeComCustomerMappingTransaction`。

W1C controlled-reachout 仍消费 legacy mapping repository 的 read 能力，因此 W1B 不允许整体删除 legacy repository。

## Canonical Owner

Architecture V2 的正式链路为：

```text
business module
→ application port
→ messaging / integration boundary
→ integrations/wecom
```

因此 W1B command Writer Owner 冻结为 `messaging`。

## Exact 6-file Runtime allowlist

```text
1. src/modules/messaging/application/wecom-customer-mapping-command-service.ts
2. src/modules/messaging/server/wecom-customer-mapping-command-repository.ts
3. src/modules/messaging/tests/WeComCustomerMappingCommandService.test.ts
4. src/modules/messaging/tests/WeComCustomerMappingCommandRepository.test.ts
5. src/modules/institution/server/wecom-customer-mapping-repository.ts
6. src/modules/institution/tests/WeComCustomerMappingRepository.test.ts
```

完整清单：`docs/operations/base02-w1b-wecom-mapping-implementation-exact-allowlist-20260808.csv`

第 7 个文件必须重新准入。

## Future implementation hard gates

- 新 Messaging application command service 不依赖 DB；
- 同一 canonical table，不建立第二事实源；
- create 强制 tenant + institution + proofContact attribution；
- update WHERE 强制 tenant + institution + proofContact + expectedCustomerId + expectedStatus；
- stale/cross-scope mutation fail-closed；
- legacy read methods 保留给 W1C；
- legacy createIfAbsent/updateWhenCurrentStatus 必须 fail-closed；
- W1C controlled-reachout 不修改；
- Mapping Route 不开放；
- 不接真实 WeCom provider；
- 不修改 Schema/Migration。

## Test matrix

- create 双键 + proofContact；
- missing tenant/institution/proofContact fail-closed；
- cross-tenant/cross-institution fail-closed；
- stale expected customer/status no mutation；
- client attribution override blocked；
- legacy writes fail-closed；
- legacy reads compatible；
- Route capability-off；
- W1C consumer unchanged。

## 证据文件

- `docs/operations/base02-w1b-wecom-mapping-writer-symbol-audit-20260808.csv`
- `docs/operations/base02-w1b-wecom-mapping-callgraph-20260808.csv`
- `docs/operations/base02-w1b-wecom-mapping-implementation-exact-allowlist-20260808.csv`

## 下一任务

```text
W1B WeCom Mapping exact 6-file Runtime implementation explicit authorization
```

# W1B WeCom Mapping Runtime implementation Independent Review

> 日期：`2026-08-08`
>
> Implementation PR：#1087
>
> Implementation Head：`da30edab16fbb70b0c835967eff2799671f7c83e`
>
> Implementation Merge：`7caab67f111737607d918cb6f8b4e0e27de10d34`
>
> 状态：`passed`

## 1. Exact Runtime scope

Implementation 从 admission base 到 merge 的变更精确为 6 个文件：

```text
src/modules/messaging/application/wecom-customer-mapping-command-service.ts
src/modules/messaging/server/wecom-customer-mapping-command-repository.ts
src/modules/messaging/tests/WeComCustomerMappingCommandService.test.ts
src/modules/messaging/tests/WeComCustomerMappingCommandRepository.test.ts
src/modules/institution/server/wecom-customer-mapping-repository.ts
src/modules/institution/tests/WeComCustomerMappingRepository.test.ts
```

```text
exact_file_count=6
seventh_file_change=false
```

## 2. Canonical Messaging Owner

独立复核确认：

```text
canonical_mapping_command_service=true
canonical_mapping_writer_repository=true
canonical_owner=messaging
same_fact_source=weComCustomerMappingStates
```

Application command service 未直接依赖 DB、server repository implementation 或真实 WeCom provider。

## 3. Scope / optimistic concurrency

Create scope：

```text
tenantId
+
institutionId
+
proofContactId
```

Update WHERE：

```text
tenantId
+
institutionId
+
proofContactId
+
expectedCustomerId
+
expectedStatus
```

因此 stale / cross-scope update 只能得到 zero-row / null 结果，不允许跨 scope 覆盖。

## 4. Legacy Writer blockade

Legacy repository 保留：

```text
findByScope
findByScopeForUpdate
```

Legacy write methods：

```text
createIfAbsent
updateWhenCurrentStatus
```

均已 fail-closed：

```text
legacy_wecom_mapping_writer_disabled
```

因此 W1C 仍可保持既有 mapping read compatibility，同时 W1B 不再保留 legacy 并行 Writer。

## 5. Route / W1C boundary

Mapping Route 继续：

```text
capability_disabled
```

Implementation 未修改：

```text
src/modules/institution/server/trusted-reachout-safety-repository.ts
src/modules/institution/server/wecom-customer-broadcast-task-outcome-repository.ts
src/modules/institution/server/wecom-real-send-proof-repository.ts
src/modules/institution/server/wecom-controlled-reachout-transaction.ts
```

真实 WeCom provider 调用未开放。

## 6. Verification

Implementation Required Check：

```text
run=31253591410
conclusion=success
```

Implementation 执行证据：

```text
targeted_tests=68/68
full_test_files=459/459
full_tests=6506/6506
architecture=passed
lint=0_errors_4_existing_warnings
typecheck=passed
build=passed
```

Independent Review 重新执行：

```text
targeted_tests=passed
full_tests=passed
architecture=passed
lint=passed_with_existing_warnings_only
typecheck=passed
build=passed
```

## 7. W1B completion eligibility

```text
w1b_runtime_implementation=passed
w1b_runtime_independent_review=passed
w1b_complete_eligible=true
```

W1B complete 只代表 WeCom Mapping Writer Owner / scope / stale guard / legacy Writer blockade 完成。

仍未开放 Mapping Route、Reader、Capability，也未执行 W1C Runtime。

## 8. 下一 vertical slice

既有 W1 audit 明确保留三个 W1C Writer 候选：

```text
src/modules/institution/server/trusted-reachout-safety-repository.ts
src/modules/institution/server/wecom-customer-broadcast-task-outcome-repository.ts
src/modules/institution/server/wecom-real-send-proof-repository.ts
```

下一任务仅进入：

```text
W1C Trusted Reach-out / Broadcast / Real-send evidence Writer symbol audit + exact implementation allowlist admission
```

必须先逐符号、callgraph、Owner、exact allowlist 冻结，未经后续明确 Runtime 授权不得改代码。

## 9. 禁止项继续有效

```text
database_connection=false
runtime_change_in_review=false
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
w1c_runtime_change=false
care_expansion=false
audit_expansion=false
production_change=false
```

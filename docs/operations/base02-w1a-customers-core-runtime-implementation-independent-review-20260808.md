# W1A Customers Core Runtime implementation Independent Review

> 日期：`2026-08-08`
>
> Implementation PR：#1081
>
> Implementation Head：`1ff84b45dd69c916f21622372898e1952fac18d1`
>
> Implementation Merge：`44c10fd548ae1881033ed0dc5f8947178be2edcc`
>
> 状态：`passed`

## 1. Exact scope

Implementation 从 admission base 到 merge 的 Runtime 变更精确为 6 个文件：

```text
src/modules/customers/application/customer-command-service.ts
src/modules/customers/server/customer-command-repository.ts
src/modules/customers/tests/CustomerCommandService.test.ts
src/modules/customers/tests/CustomerCommandRepository.test.ts
src/modules/institution/server/tenant-business-repository.ts
src/modules/institution/tests/TenantBusinessRepository.test.ts
```

```text
exact_file_count=6
seventh_file_change=false
```

未修改 Schema、Route、Care、Messaging、Audit 或其他 Runtime 文件。

## 2. Customers canonical Owner

```text
customers_canonical_application_service=true
customers_canonical_writer_repository=true
application_server_dependency_violation=false
```

## 3. Attribution / fail-closed

Create 由 server-side command attribution 注入 tenantId + institutionId。

Update WHERE 同时绑定 tenant + institution + customer identity。

```text
tenant_institution_attribution_enforced=true
cross_institution_mutation_fail_closed=true
nullable_institution_row_fail_closed=true
client_attribution_override_blocked=true
default_institution_fallback=false
```

## 4. Legacy Writer blockade

Legacy tenant-business createCustomer / updateCustomer 均 fail-closed 为：

`legacy_customer_writer_disabled`

Legacy institution server 未直接依赖 Customers server implementation。

## 5. Route / Reader / Capability

`/api/institution/customers` 继续 `capability_disabled`。

```text
customers_route_change=false
reader_release=false
capability_release=false
```

## 6. Verification

```text
implementation_required_check_run=31226869455
implementation_required_check=success
fresh_targeted_tests=passed
fresh_full_tests=passed
fresh_architecture_tests=passed
fresh_lint=passed_with_existing_warnings_only
fresh_typecheck=passed
```

Implementation 原执行证据：targeted 40/40、full 457 files / 6500 tests、build passed。

## 7. W1A completion

```text
w1a_customers_core_runtime_implementation=passed
w1a_runtime_independent_review=passed
w1a_customers_core_complete=true
business_writer_phase_complete=false
```

## 8. 下一 vertical slice

W1 既有 symbol audit 把后续 Messaging Writer 分为：

```text
W1B Customer Channel / WeCom Mapping
W1C Trusted Reach-out / Broadcast / Real-send evidence
```

下一任务仅进入：

`W1B Customer Channel / WeCom Mapping Writer symbol audit + exact implementation allowlist admission`

W1C 的 trusted reach-out、broadcast outcome、real-send evidence 不得混入 W1B。

## 9. 禁止项

```text
database_connection=false
runtime_change_in_review=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
schema_change=false
customers_route_change=false
reader_release=false
capability_release=false
production_change=false
```

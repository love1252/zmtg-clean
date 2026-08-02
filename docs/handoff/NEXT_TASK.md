# 智美天工唯一下一任务

## 当前交接状态

Binding transition evidence `0044` 已实施并唯一消费；Binding Runtime Writer 前置预检与独立审查已通过。

```text
accepted_path=B2_W1_extend_existing_access_control_transaction_kernel
implementation_allowlist_files=13
eligible_for_binding_runtime_writer_implementation=true
binding_runtime_writer_started=false
schema_migration_change_allowed=false
database_connection_allowed=false
base_b2_complete=false
eligible_for_base_b3=false
```

## 唯一下一任务

```text
BASE-B2 Binding Runtime Writer／same-transaction transition evidence 实施
```

## 精确 allowlist

1. `src/modules/access-control/domain/binding-lifecycle.ts`
2. `src/modules/access-control/application/binding-command-service.ts`
3. `src/modules/access-control/application/membership-command-service.ts`
4. `src/modules/access-control/ports/membership-command-unit-of-work.ts`
5. `src/modules/access-control/server/membership-command-repository.ts`
6. `src/modules/access-control/tests/BindingLifecycle.test.ts`
7. `src/modules/access-control/tests/BindingCommandService.test.ts`
8. `src/modules/access-control/tests/MembershipCommandService.test.ts`
9. `src/modules/access-control/tests/MembershipCommandRepository.test.ts`
10. `src/modules/access-control/tests/MembershipCommandExternalTransaction.test.ts`
11. `src/modules/tenancy/ports/transaction-bound-institution-scope.ts`
12. `src/modules/tenancy/server/transaction-bound-institution-scope.ts`
13. `src/modules/tenancy/tests/TransactionBoundInstitutionScope.test.ts`

## 禁止范围

- 不修改 Schema／Migration／journal／snapshot；
- 不连接数据库、不运行 Migration／Seed；
- 不新增 API／UI；
- 不执行 legacy calibration；
- 不处理 historical orphan；
- 不执行 Scope FK `VALIDATE`；
- 不启动 BASE-B3～B6；
- 不放行项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

# BASE-B5 Cross-Tenant Transfer 4-file 最小实现独立审查

> 日期：`2026-08-08`
>
> Implementation PR：#1061
>
> Implementation Head：`b14d9b1c8b91ad02bb23742aa4373a1c531811f0`
>
> Implementation Merge：`633f77415ea74e3456f528e650de28198cd30da9`
>
> 状态：`passed`

## 1. 审查范围

本次只审查已冻结并合并的 4-file minimal foundation：

```text
src/modules/access-control/application/cross-tenant-transfer-service.ts
src/modules/access-control/server/cross-tenant-transfer-transaction.ts
src/modules/access-control/tests/CrossTenantTransferService.test.ts
src/modules/access-control/tests/CrossTenantTransferTransaction.test.ts
```

Implementation merge 相对 admission handoff base 的 runtime diff 必须精确等于上述 4 文件。

## 2. Application 审查

`cross-tenant-transfer-service.ts`：

- 复用 `executeMembershipCommandWithUnitOfWork`，没有复制 canonical Membership/Binding Writer；
- transfer intent 对 source/target tenant、Membership/Binding identity/version、actor/reason/time 做 fail-closed 校验；
- source role 与 displayName 来自事务内锁定的 source Membership current，不信任 caller role；
- target Membership create 使用 `access_control_command`；
- target Binding assignment source 固定 `manual_admin`；
- source/target 使用同一低敏 Membership command identity；
- 在 mutation 前检查 source/target command replay；
- target Owner apply 后 source Owner 非 applied 时抛出 transfer abort，使 outer transaction 回滚；
- `outcome_unknown` 单独返回，不自动 retry。

## 3. Transaction 审查

`cross-tenant-transfer-transaction.ts`：

- transaction options 继续复用 accepted `SERIALIZABLE READ WRITE`；
- exact timeout：statement 5s / lock 1s / idle transaction 5s；
- tenant-scoped UoW 前要求 account advisory xact lock；
- 同一 transaction 只允许一个 account identity；
- UoW 在 account lock 前 fail-closed；
- transaction-bound Scope assertion 通过既有 factory dependency injection；
- 不再直接依赖 `tenancy/server`；
- 不创建 nested transaction；
- 不自动 retry；
- callback 已完成后 COMMIT 失败被分类为 `transfer_outcome_unknown`。

## 4. 架构边界审查

通过：

```text
exact_file_count=4
fifth_file_change=false
cross_module_tenancy_server_dependency=false
aq007_passed=true
aq008_writer_bypass=false
schema_change=false
migration_change=false
existing_writer_change=false
existing_port_change=false
composition_root_change=false
api_runner_wiring=false
```

本实现仍是未接业务入口的 foundation，不可因为代码已合并就推断为可执行 remediation。

## 5. 测试与质量证据

Implementation 执行证据：

```text
targeted_transfer_tests=17/17 passed
architecture_diff_check=passed
architecture_tests=148/148 passed
full_test_files=454/454 passed
full_tests=6458/6458 passed
lint=0 errors / existing warnings only
typecheck=passed
build=passed
required_check=success
```

Independent Review 再次执行 targeted transfer tests 与 architecture diff check；任一失败不得通过本审查。

## 6. 未授权边界

本审查不授权：

- 数据库连接；
- DDL/DML/Migration/Seed/FK VALIDATE；
- Membership/Binding 实际数据库写入；
- historical orphan remediation；
- composition root/API/runner 接线；
- Reader/Capability release；
- production change/deployment。

## 7. 审查结论

```text
cross_tenant_transfer_minimal_implementation=passed
cross_tenant_transfer_independent_review=passed
implementation_foundation_complete=true

controlled_execution_entry_present=false
database_execution_authorized=false
historical_orphan_remediation_authorized=false

base_b5_execution_ready=false
base_b5_complete=false
base02_complete=false

eligible_for_handoff=true
```

## 8. 下一治理动作

4-file foundation 已经完成，下一步不能直接执行数据库 remediation。

必须先单独冻结 controlled execution runner／composition wiring 的最小边界：

```text
BASE-B5 跨 tenant transfer controlled execution runner 准入与 exact allowlist 冻结
```

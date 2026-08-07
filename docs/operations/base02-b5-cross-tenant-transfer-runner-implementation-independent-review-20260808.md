# BASE-B5 Controlled Transfer Runner 2-file 实现独立审查

> 日期：`2026-08-08`
>
> Implementation PR：#1067
>
> Implementation Head：`160d7e107794ab8283bad6966a7aea174ad1d0e4`
>
> Implementation Merge：`10bcaf1a7609512d32e71a212809060d91afec03`
>
> 状态：`passed`

## 1. Exact diff

Implementation base `c432632d586a27278b42a2e562d588d586627644` 到 merge 必须严格只有：

```text
scripts/db/base02-b5-cross-tenant-transfer-runner.mjs
scripts/db/base02-b5-cross-tenant-transfer-runner.test.mjs
```

```text
exact_file_count=2
third_file_change=false
package_json_change=false
schema_change=false
migration_change=false
existing_transfer_foundation_change=false
```

## 2. Runner composition 审查

通过：

- one-shot CLI，不提供 HTTP/API；
- 固定 `127.0.0.1:55432/zmtg_clean_local_acceptance`；
- 不信任 `.env.local`；
- shell 中非 localhost `DATABASE_URL` fail-closed；
- secure private manifest / lease 使用 owner、mode、nlink、size、`O_NOFOLLOW`、UTF-8 fatal、duplicate-key guard；
- manifest 绑定已签发 `BASE-B5-AUTH-20260806-001`；
- execute 额外要求 secure lease；
- code SHA 与 clean worktree HEAD 绑定；
- dry-run 使用 read-only transaction；
- execute 复用既有 `createCrossTenantTransferService`；
- Scope assertion 显式注入 transaction-bound implementation；
- runner 不直接写 Membership/Binding current/evidence；
- outcome unknown 不自动 retry，只允许 fresh readonly reconcile；
- retained historical relation orphan 使用 Option 1 terminal semantics；
- FK VALIDATE 不属于 runner 成功条件。

## 3. SQL / Schema 静态复核

Runner 只读 SQL 所依赖的 canonical 字段与当前 schema/migration 命名一致，至少包括：

```text
tenant_members.current_provenance_source
tenant_members.current_provenance_reason_code
tenant_members.current_provenance_command_id
tenant_members.current_provenance_recorded_at
auth_account_institution_bindings.status
auth_account_institution_bindings.version
tenant_membership_transitions.command_id
auth_account_institution_binding_transitions.command_id
institution_scopes.status
```

本审查只做静态核对与纯代码测试，不以此冒充数据库 dry-run。

## 4. 质量证据

Implementation 证据：

```text
runner_targeted_tests=36/36 passed
architecture_tests=148/148 passed
full_test_files=455/455 passed
full_tests=6494/6494 passed
lint=0 errors / existing warnings only
typecheck=passed
build=passed
architecture_diff=passed
required_check=success
```

Independent Review 再次执行：

```text
runner targeted tests
implementation architecture diff
static canonical-write bypass scan
schema-column marker audit
```

## 5. Code SHA 冻结说明

未来 private manifest **不得预填 Implementation Merge `10bcaf1a...`**。

因为本 Independent Review 与 Handoff 会继续产生 docs-only merge commit，实际 dry-run 时 runner 的 `expectedCodeSha` 必须绑定：

```text
当次数据库授权执行前，已独立审查且 worktree clean 的最终 main HEAD
```

即：未来 manifest 签发必须在本 Handoff 完成后，以最终 reviewed main SHA 为准。

## 6. 当前仍未授权

```text
database_connection=false
local_acceptance_dry_run=false
execute=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
membership_database_write=false
binding_database_write=false
historical_orphan_remediation=false
```

## 7. 结论

```text
controlled_runner_implementation=passed
controlled_runner_independent_review=passed
controlled_execution_entry_present=true
runner_code_ready_for_readonly_preflight=true

database_execution_authorized=false
historical_orphan_remediation_authorized=false
base_b5_execution_ready=false
base_b5_complete=false
base02_complete=false
eligible_for_handoff=true
```

## 8. 下一治理任务

```text
BASE-B5 controlled runner local_acceptance readonly preflight、private manifest 签发与 dry-run 授权执行
```

下一任务需要新的、明确的数据库只读授权；本审查不消费该授权。

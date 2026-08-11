# 下一任务

## 唯一下一任务

```text
Trial Provisioning exact 2-file fail-closed Runtime implementation explicit authorization
```

## Trial Provisioning Formal Admission

```text
w6_institution_system_complete=true

trial_provisioning_fresh_audit=passed
trial_provisioning_classification=dormant_legacy_cross_owner_writer
trial_provisioning_direct_mutation_calls=4
trial_provisioning_direct_writer_files=1
trial_provisioning_fact_tables=4
trial_provisioning_production_callers=0
trial_provisioning_route_callers=0

trial_provisioning_closure_decision=fail_closed_blockade_required
trial_provisioning_canonical_migration_required=false

trial_provisioning_exact_runtime_file_count=2
trial_provisioning_runtime_allowlist_frozen=true
trial_provisioning_runtime_authorized=false

business_writer_phase_complete=false
```

冻结清单：

`docs/operations/base02-trial-provisioning-exact-runtime-allowlist-20260811.csv`

Exact 2：

```text
src/modules/institution/server/trial-provisioning-service.ts
src/modules/institution/tests/TrialProvisioningService.test.ts
```

Runtime 只允许把 dormant legacy Trial Provisioning Writer fail-closed：

```text
preserve exported function signature
direct business mutation 4 -> 0
DB access -> 0
production callers remain 0
```

不得修改 Customers / Care canonical Runtime，不得修改 Tenancy provisioning，不得新建 production activation。

第 3 个 Runtime 文件必须 `STOP / re-admit`。

必须收到新的明确 Runtime 授权后才能实施。

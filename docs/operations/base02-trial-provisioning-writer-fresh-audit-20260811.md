# Trial Provisioning Writer Fresh Residual Audit / Formal Admission

> 日期：2026-08-11
>
> Baseline：`7b087a6387b0ed309d0aa61b7364fed219d85444`
>
> Runtime authorization：`false`

## Fresh residual

```text
direct_mutation_calls=4
direct_writer_files=1
fact_tables=4
production_callers=0
route_callers=0
transaction_boundary=single_db_transaction
```

唯一 residual Writer：

`src/modules/institution/server/trial-provisioning-service.ts`

四张表：

```text
customers
appointments
treatmentSummaries
followUpTasks
```

## Provisioning 边界

`src/modules/tenancy/provisioning/**` 是既有 Tenancy foundation Owner，本任务明确排除。

本任务只处理 legacy Institution Trial Provisioning business-fact seed surface。

## Ownership finding

四张业务事实表已经分别归属：

```text
customers -> Customers
appointments -> Care
treatmentSummaries -> Care
followUpTasks -> Care
```

Trial Provisioning service 仍跨 Owner 直接写入四张表，因此不能作为最终 Business Writer residual 留存。

同时 current-main：

```text
provisionDemoDataForTenant production callers=0
Route callers=0
```

所以它是 dormant legacy Writer。

## Closure decision

```text
classification=dormant_legacy_cross_owner_writer
closure_decision=fail_closed_blockade_required
canonical_trial_provisioning_migration_required=false
```

不为 0 production caller 的 demo Writer 新建跨 Customers/Care production orchestration。

最小闭环是 fail-closed：保留 exported compatibility symbol，但在任何 DB access 前失败。

如果未来重新启用 Trial Provisioning，必须另做独立 Admission，并通过 canonical Customers/Care command/orchestration 重新设计。

## Exact Runtime allowlist

```text
exact_runtime_file_count=2
new_files=1
existing_files=1
third_runtime_file_requires_stop_and_readmission=true
runtime_authorized=false
```

Exact 2：

```text
src/modules/institution/server/trial-provisioning-service.ts
src/modules/institution/tests/TrialProvisioningService.test.ts
```

Runtime 目标：

```text
direct mutation 4 -> 0
DB access -> 0
production callers remain 0
Customers/Care canonical Runtime unchanged
Tenancy provisioning unchanged
production activation=false
```

## Decision

```text
trial_provisioning_fresh_audit=passed
trial_provisioning_formal_admission=passed
trial_provisioning_runtime_allowlist_frozen=true
trial_provisioning_runtime_authorized=false
business_writer_phase_complete=false
```

唯一下一任务：

`Trial Provisioning exact 2-file fail-closed Runtime implementation explicit authorization`

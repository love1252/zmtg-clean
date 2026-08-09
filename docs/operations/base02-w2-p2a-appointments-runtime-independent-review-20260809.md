# W2-P2A Appointments Runtime Independent Review

> 日期：`2026-08-09`
>
> Implementation PR：#1113
>
> Implementation Head：`3b32f624c254610ecddcf0b662af2420f31a5df5`
>
> Implementation Merge：`25ae7a47f466255590cbe20f35d4243f9145442e`
>
> 状态：`passed`

## 1. Exact Runtime scope

```text
implementation_exact_file_count=6
seventh_file_change=false
```

恰好六个文件：

```text
src/modules/care/application/appointment-command-service.ts
src/modules/care/server/appointment-command-repository.ts
src/modules/care/tests/AppointmentCommandService.test.ts
src/modules/care/tests/AppointmentCommandRepository.test.ts
src/modules/institution/server/tenant-business-repository.ts
src/modules/institution/tests/TenantBusinessRepository.test.ts
```

## 2. Independent Runtime findings

```text
care_appointment_application_owner=true
care_appointment_canonical_writer=true
server_side_tenant_institution_scope=true
create_customer_ownership_guard=true
update_appointment_customer_ownership_guard=true
expected_updated_at_cas=true
stale_update_fail_closed=true
cross_tenant_fail_closed=true
cross_institution_fail_closed=true
missing_institution_fail_closed=true
not_owned_fail_closed=true
legacy_create_appointment_blocked=true
legacy_update_appointment_blocked=true
legacy_read_list_compatibility_retained=true
appointments_route_capability_off=true
```

## 3. Writer classification

普通业务 appointment Writer：

```text
src/modules/care/server/appointment-command-repository.ts
```

Trial Provisioning 仍保留独立 insert：

```text
src/modules/institution/server/trial-provisioning-service.ts
classification=separate_provisioning_review
ordinary_business_dual_write=false
```

没有将 Provisioning 误算成普通业务 dual-write。

## 4. P2B / P2C boundary

Implementation PR 的 exact 6-file diff 证明 P2B / P2C Runtime、Route、Schema、Trial Provisioning、Audit Owner 均未修改。

P2A 后 residual：

```text
residual_mutation_calls=13
residual_writer_methods=13
residual_fact_tables=5

p2b_exact_runtime_allowlist_file_count=12
p2c_exact_runtime_allowlist_file_count=17

p2b_runtime_authorized=false
p2c_runtime_authorized=false
```

## 5. Validation

```text
targeted_tests=passed
architecture_quality_tests=passed
full_tests=passed
lint=0_errors
typecheck=passed
build=passed
```

## 6. Forbidden changes

```text
database_connection=false
runtime_change_during_review=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
schema_change=false
route_change=false
reader_release=false
capability_release=false
audit_owner_change=false
trial_provisioning_change=false
p2b_runtime_change=false
p2c_runtime_change=false
production_change=false
```

## 7. Review decision

```text
w2_p2a_runtime_implementation=passed
w2_p2a_runtime_independent_review=passed
w2_p2a_complete_eligible=true
w2_p2a_complete=false_before_handoff
w2_care_complete=false
business_writer_phase_complete=false
```

Handoff 合并后才允许正式写入：

`W2_P2A_COMPLETE=true`

下一任务候选：

`W2-P2B Follow-up Task / Path / Timeline exact 12-file Runtime implementation explicit authorization`

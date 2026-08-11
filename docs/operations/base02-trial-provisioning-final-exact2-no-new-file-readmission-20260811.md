# Trial Provisioning Final exact-2 No-New-File Re-admission

> 日期：2026-08-11
>
> Base：`fa281cef681998cd31f9a4d9fb4f676d4812e9d2`
>
> 前一 exact-3 Runtime attempt：stopped at architecture incremental
>
> Runtime authorization：`false`

## 1. exact-3 implementation result

前一 exact-3 Runtime 已完成业务实现和主要验证：

```text
targeted_test_files=5
targeted_tests=30
targeted_tests=passed

typecheck=passed
architecture_unit_tests=148_passed
full_test_files=490
full_tests=6589
lint=passed
build=passed

trial_provisioning_direct_mutation_calls=0
trial_provisioning_direct_writer_files=0
trial_provisioning_db_access=0
trial_provisioning_legacy_service_blocked=true
appointment_governance_lock_updated=true
```

提交：

`a53b335bec70726d7393c7f7222f281f718e319f`

## 2. Stop reason

提交后的 architecture incremental 唯一失败：

```text
AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE
src/modules/institution/tests/TrialProvisioningService.test.ts
```

业务 Runtime 本身没有新增架构违规；问题是新增测试文件位于被冻结的 `src/modules/institution/**`。

## 3. Why not add an AQ004 exception

不为一个测试文件新增 `architecture-quality-rules.json` exception。

原因：

1. Institution 模块冻结规则应继续保持严格；
2. blockade 验证可以放入已经必须修改的既有 Care governance test；
3. 这样无需新增 frozen Institution 文件；
4. 不新增 architecture exception；
5. 不新增任何 Runtime 文件。

因此最终 scope 采用更小的 no-new-file 方案。

## 4. Final exact-2 Runtime

```text
exact_runtime_file_count=2
existing_runtime_file_count=2
new_runtime_file_count=0
third_runtime_file_requires_stop_and_readmission=true
runtime_authorized=false
```

Final exact 2：

```text
src/modules/institution/server/trial-provisioning-service.ts
src/modules/care/tests/AppointmentCommandRepository.test.ts
```

### Service

保留：

```text
provisionDemoDataForTenant export
input type compatibility
```

关闭：

```text
direct mutation 4 -> 0
DB access -> 0
production activation -> 0
```

固定 fail-closed marker：

```text
legacy_institution_trial_provisioning_disabled
```

### Care governance test

同一个既有文件完成两类验证：

1. Care 继续是普通业务 appointment canonical Writer；
2. Trial Provisioning historical `.insert(appointments)` exception 已关闭；
3. 动态调用 `provisionDemoDataForTenant(...)`，证明在任何 fake DB `select / transaction / insert / update / delete` 被访问前就 fail-closed。

预计 targeted：

```text
test_files=4
tests=30
```

其中：

```text
AppointmentCommandRepository.test.ts = 10
CustomerCommandRepository.test.ts = 4
TreatmentSummaryCommandRepository.test.ts = 10
FollowUpCommandRepository.test.ts = 6
```

## 5. Explicit exclusions

```text
src/modules/institution/tests/TrialProvisioningService.test.ts
scripts/verify/architecture-quality-rules.json
src/modules/care/server/**
src/modules/customers/**
src/modules/tenancy/provisioning/**
API Route
Schema
Migration
DB execution
production activation
```

## 6. Authorization state

exact-3 授权已经进入 Runtime 实施并产生本地 commit，随后在 architecture incremental 停止。

因此：

```text
exact3_runtime_authorization_exhausted=true
final_exact2_runtime_authorized=false
new_explicit_authorization_required=true
```

## 7. Next task

`Trial Provisioning final exact 2-file no-new-file fail-closed Runtime implementation explicit authorization`

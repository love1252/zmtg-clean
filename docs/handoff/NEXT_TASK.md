# 下一任务

## 唯一下一任务

```text
Trial Provisioning final exact 2-file no-new-file fail-closed Runtime implementation explicit authorization
```

## Final Re-admission state

```text
trial_provisioning_exact3_runtime_attempt=stopped_at_architecture_incremental
trial_provisioning_exact3_runtime_head=a53b335bec70726d7393c7f7222f281f718e319f

trial_provisioning_exact3_targeted_tests=30_passed
trial_provisioning_exact3_typecheck=passed
trial_provisioning_exact3_architecture_unit_tests=148_passed
trial_provisioning_exact3_full_tests=6589_passed
trial_provisioning_exact3_lint=passed
trial_provisioning_exact3_build=passed

trial_provisioning_exact3_architecture_incremental=failed_aq004_new_institution_test
trial_provisioning_exact3_authorization_exhausted=true

trial_provisioning_final_scope_reason=no_new_frozen_institution_test_file

trial_provisioning_exact_runtime_file_count=2
trial_provisioning_existing_runtime_file_count=2
trial_provisioning_new_runtime_file_count=0
trial_provisioning_runtime_allowlist_frozen=true
trial_provisioning_runtime_authorized=false
trial_provisioning_architecture_exception_required=false

business_writer_phase_complete=false
```

Final exact 2：

```text
src/modules/institution/server/trial-provisioning-service.ts
src/modules/care/tests/AppointmentCommandRepository.test.ts
```

最终方案：

```text
service direct mutation 4 -> 0
service DB access -> 0
legacy export preserved and fail-closed

AppointmentCommandRepository.test.ts:
- close historical Trial Provisioning insert exception
- add dynamic no-DB-access blockade proof
```

明确不新增：

```text
src/modules/institution/tests/TrialProvisioningService.test.ts
```

明确不修改：

```text
scripts/verify/architecture-quality-rules.json
Care Runtime
Customers Runtime
Tenancy provisioning Runtime
```

第 3 个 Runtime 文件必须 `STOP / re-admit`。

需要新的明确 Runtime 授权。

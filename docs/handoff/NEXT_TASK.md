# 下一任务

## 唯一下一任务

```text
Trial Provisioning exact 3-file fail-closed Runtime implementation explicit authorization
```

## Re-admission state

```text
trial_provisioning_exact2_runtime_attempt=stopped_at_targeted_tests
trial_provisioning_exact2_targeted_tests=29_passed_1_failed
trial_provisioning_exact2_authorization_scope_exhausted=true

trial_provisioning_readmission_reason=appointment_governance_lock

trial_provisioning_exact_runtime_file_count=3
trial_provisioning_runtime_allowlist_frozen=true
trial_provisioning_runtime_authorized=false

business_writer_phase_complete=false
```

Exact 3：

```text
src/modules/institution/server/trial-provisioning-service.ts
src/modules/institution/tests/TrialProvisioningService.test.ts
src/modules/care/tests/AppointmentCommandRepository.test.ts
```

第 3 个文件仅允许修正历史治理断言：

```text
Trial Provisioning direct appointment insert exception -> closed
```

不得修改任何 Care Runtime、Customers Runtime 或 Tenancy provisioning Runtime。

第 4 个 Runtime 文件必须 `STOP / re-admit`。

需要新的明确 Runtime 授权。

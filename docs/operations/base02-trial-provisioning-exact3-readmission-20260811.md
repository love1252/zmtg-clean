# Trial Provisioning exact-3 Re-admission

> 日期：2026-08-11
>
> Base：`f5523262b2d0e7defbe84bbcdb3c5d91155c4ec2`
>
> 原 exact-2 Runtime attempt：stopped
>
> Runtime authorization：`false`

## 1. Why exact-2 stopped

原 exact-2 Runtime 已成功实现预期 blockade：

```text
trial_provisioning_direct_mutation_calls=0
trial_provisioning_direct_writer_files=0
trial_provisioning_db_access=0
trial_provisioning_legacy_service_blocked=true
customers_canonical_runtime_change=false
care_canonical_runtime_change=false
tenancy_provisioning_change=false
```

新增 blockade test 通过。

Targeted suite 结果：

```text
test_files=5
tests=30
passed=29
failed=1
```

唯一失败：

`src/modules/care/tests/AppointmentCommandRepository.test.ts`

该既有治理测试仍锁定历史策略：

```text
Trial Provisioning 保持独立 exception
expect(provisioning).toContain('.insert(appointments)')
```

该断言与 Formal Admission 已批准的最终目标：

```text
Trial Provisioning direct mutation 4 -> 0
```

直接冲突。

## 2. Decision

禁止使用以下方式绕过：

```text
在注释/死代码中伪造 .insert(appointments) 字符串
保留不可达 direct insert
削弱 blockade test
跳过 Appointment canonical regression
```

因此 exact-2 scope 不足，必须 re-admit 第 3 个文件。

## 3. Exact-3 Runtime scope

```text
exact_runtime_file_count=3
existing_files=2
new_files=1
fourth_runtime_file_requires_stop_and_readmission=true
runtime_authorized=false
```

Exact 3：

```text
src/modules/institution/server/trial-provisioning-service.ts
src/modules/institution/tests/TrialProvisioningService.test.ts
src/modules/care/tests/AppointmentCommandRepository.test.ts
```

第 3 个文件只允许 test/governance correction：

```text
旧断言:
Trial Provisioning 保持独立 exception
expect(provisioning).toContain('.insert(appointments)')

新断言:
Trial Provisioning legacy exception 已关闭
expect(provisioning).not.toContain('.insert(appointments)')
expect(provisioning).toContain('legacy_institution_trial_provisioning_disabled')
```

禁止修改：

```text
src/modules/care/server/**
src/modules/customers/**
src/modules/tenancy/provisioning/**
API Route
Schema
Migration
DB execution
production activation
```

## 4. Authorization state

原 exact-2 authorization 已实际进入 Runtime 执行并在 targeted tests 停止，因此：

```text
exact2_authorization_scope_exhausted=true
exact3_runtime_authorized=false
new_explicit_authorization_required=true
```

## 5. Next task

`Trial Provisioning exact 3-file fail-closed Runtime implementation explicit authorization`

# 下一任务

## 唯一下一任务

```text
POST-V2-R1B page_workbench readonly release exact 5-file Runtime implementation explicit authorization
```

## Admission state

```text
post_v2_r1b_page_workbench_reaudit=passed
post_v2_r1b_exact_runtime_admission=passed

target_capability=page_workbench
route=/hospital

exact_runtime_file_count=5
existing_runtime_file_count=5
new_runtime_file_count=0

planned_decision=read_only
planned_production_release=pilot_released
planned_page_release_count=1

runtime_authorized=false
reader_release=false
capability_release=false
```

## Frozen Runtime allowlist

1. `src/server/orchestration/institution-capability-authority.ts`
2. `src/server/orchestration/institution-capability-authority.test.ts`
3. `src/app/hospital/page.tsx`
4. `src/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff.tsx`
5. `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx`

第 6 个 Runtime 文件、第二个 page capability 或任何 controlled-create action 均需重新准入。

## Explicit authorization required

只有用户明确授权：

```text
授权执行 POST-V2-R1B page_workbench readonly release exact 5-file Runtime implementation。
```

之后才能实施。

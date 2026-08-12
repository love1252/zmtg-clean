# 下一任务

## 唯一下一任务

```text
POST-V2-R1C exact-4 Runtime rollback explicit authorization
```

## 当前 Review 状态

```text
post_v2_r1c_runtime_implementation=passed
post_v2_r1c_runtime_independent_review=blocked
post_v2_r1c_runtime_review_blocker_count=2
post_v2_r1c_complete=false

workbench_regression_risk=true
audit_reader_prerequisite_missing=true
```

## Review 接受的当前 release

```text
page_workbench=read_only/pilot_released
review_accepted_governed_page_release_count=1
review_accepted_remaining_unreleased_page_count=25

reader_release=true
capability_release=true
```

## Frozen rollback allowlist

1. `src/server/orchestration/institution-capability-authority.ts`
2. `src/server/orchestration/institution-capability-authority.test.ts`
3. `src/app/hospital/system/audit/page.tsx`（delete）
4. `src/modules/institution/tests/InstitutionRouteShell.test.tsx`

回滚不修改 shared catch-all、Audit Shell、Audit Client、Audit API、Contract、Registry、DB、Schema 或 Migration。

## 显式授权要求

```text
rollback_runtime_authorized=false
```

只有用户明确授权：

```text
授权执行 POST-V2-R1C exact-4 Runtime rollback。
```

之后才能执行回滚。

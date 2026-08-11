# 下一任务

## 唯一下一任务

```text
POST-V2-R1A revised exact 3-file orchestration Capability Authority Foundation Runtime explicit authorization
```

## Why the old exact-6 authorization ended

```text
old_exact6_targeted_tests=102_passed
old_exact6_full_tests=6599_passed
old_exact6_build=passed

old_exact6_architecture_incremental=blocked
AQ007_CROSS_MODULE_SERVER_REPOSITORY=4
```

旧实现被保留为 local-only WIP，不会 push。

## Revised Runtime scope

```text
exact_runtime_file_count=3
existing_runtime_file_count=1
new_runtime_file_count=2
architecture_exception_required=false
```

1. `src/modules/institution/server/institution-server-runtime.ts`
2. `src/server/orchestration/institution-capability-authority.ts`
3. `src/server/orchestration/institution-capability-authority.test.ts`

Cross-owner composition 只允许位于 `src/server/orchestration/**`。

原 Institution capability evaluator / reader 继续保持 candidate-only，不进入新 Runtime scope。

## Release boundary

```text
productionRelease=not_released
decision=hidden
page_release_count=0
reader_release=false
capability_release=false
route_change=false
```

只有用户重新明确授权：

```text
授权执行 POST-V2-R1A revised exact 3-file orchestration Capability Authority Foundation Runtime。
```

之后才能进入新的 Runtime implementation。

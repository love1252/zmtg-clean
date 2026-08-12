# POST-V2-R1C exact-4 Runtime 回滚独立验证

> 日期：2026-08-13
>
> 回滚 PR：#1165
>
> 回滚合并：`bf5537e1287dc5930a7a4895bd67829fdd17fa3c`
>
> 类型：独立验证 / 仅文档

## 1. 结论

```text
post_v2_r1c_exact4_runtime_rollback=passed
post_v2_r1c_rollback_independent_verification=passed

r1b_workbench_stable_runtime_restored=true
page_system_audit_state=hidden_not_released

review_accepted_governed_page_release_count=1
review_accepted_remaining_unreleased_page_count=25

post_v2_r1c_complete=false_after_rollback
```

R1C 错误放行已从 Runtime 撤回；当前重新回到 R1B 的稳定“仅工作台只读放行”状态。

## 2. 回滚 PR 独立核验

```text
rollback_pr=1165
rollback_exact_runtime_file_count=4
rollback_review_thread_count=0
rollback_required_check=passed
```

4 文件严格为：

1. `src/server/orchestration/institution-capability-authority.ts`
2. `src/server/orchestration/institution-capability-authority.test.ts`
3. `src/app/hospital/system/audit/page.tsx`（已删除）
4. `src/modules/institution/tests/InstitutionRouteShell.test.tsx`

## 3. Blob 级恢复核验

以下 3 个恢复文件当前 blob 与 R1C Runtime 之前的稳定提交
`17b1d7a4344a58a45f22e5a76099bef82f79dfa4`
完全一致：

```text
authority_blob_equal=true
authority_test_blob_equal=true
route_test_blob_equal=true
```

并确认：

```text
authority_revision=r1b-page-workbench-readonly-pilot-v1
page_system_audit_release_policy_present=false
audit_dedicated_route_exists=false
authority_production_caller_file_count=1
```

唯一生产环境 Authority 调用方重新回到 `/hospital` 工作台。

## 4. 新鲜验证

```text
targeted_test_files=6
targeted_tests=177
targeted_tests=passed
typecheck=passed
```

## 5. PR #1163 P1 threads

两个 P1 仍保持未解决状态：

- `PRRT_kwDOSrGMn86Ymqcm`：工作台投影回归；
- `PRRT_kwDOSrGMn86Ymqcw`：审计读取器前置条件缺失。

这两个问题在当前 `main` 上已经通过 PR #1165 的精确回滚实现“代码层处置”：

- 工作台恢复到 R1B 稳定状态；
- `page_system_audit` 回到 hidden/not_released；
- 专用审计 Route 已删除；
- 审计读取器尚未实现，但已经不再错误放行该能力。

因此：

```text
pr1163_thread_admin_closure_eligible=true
pr1163_thread_write_authorized=false
```

本 PR 不回复、也不解决 review thread。

## 6. 当前放行状态

```text
page_workbench=read_only/pilot_released
page_system_audit=hidden/not_released

reader_release=true
capability_release=true

review_accepted_governed_page_release_count=1
review_accepted_remaining_unreleased_page_count=25
controlled_create_release_count=0

production_ready_inferred=false
production_deployment=false
```

Reader / Capability 的 `true` 仍仅代表 R1B 首个受治理只读页面切片已经完成。

## 7. 审计读取器后续边界

审计读取器前置条件仍为真实缺口，但不得在本闭环中顺手开发。

在回滚 review thread 行政闭环后，下一技术阶段应重新从：

```text
POST-V2-R1C-AUDIT-READER institution-scoped audit readonly reader prerequisite audit + admission
```

开始。

## 8. 当前唯一下一任务

需要显式 GitHub review 写入授权：

```text
授权处理 PR #1163 两个 P1 review thread：
1. 分别回复“已由 PR #1165 完成精确回滚并恢复 R1B 稳定状态；page_system_audit 已恢复 hidden/not_released。”
2. resolve thread PRRT_kwDOSrGMn86Ymqcm
3. resolve thread PRRT_kwDOSrGMn86Ymqcw
```

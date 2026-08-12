# 下一任务

## 唯一下一任务

```text
PR #1163 两个 P1 review thread 回复 + resolve 的显式 GitHub 写授权
```

## 当前回滚验证状态

```text
post_v2_r1c_exact4_runtime_rollback=passed
post_v2_r1c_rollback_independent_verification=passed

r1b_workbench_stable_runtime_restored=true

page_workbench=read_only/pilot_released
page_system_audit=hidden/not_released

review_accepted_governed_page_release_count=1
review_accepted_remaining_unreleased_page_count=25

pr1163_thread_admin_closure_eligible=true
pr1163_thread_write_authorized=false

post_v2_r1c_complete=false_after_rollback
```

## 待处理 Review threads

1. `PRRT_kwDOSrGMn86Ymqcm` — Workbench projection regression
2. `PRRT_kwDOSrGMn86Ymqcw` — Audit Reader prerequisite missing

代码层均已由 PR #1165 的 exact-4 rollback 处置：

- Workbench 恢复 R1B stable；
- `page_system_audit` 恢复 hidden/not_released；
- dedicated Audit Route 已删除。

## 显式授权要求

只有用户明确授权：

```text
授权处理 PR #1163 两个 P1 review thread：
1. 分别回复“已由 PR #1165 完成精确回滚并恢复 R1B 稳定状态；page_system_audit 已恢复 hidden/not_released。”
2. resolve thread PRRT_kwDOSrGMn86Ymqcm
3. resolve thread PRRT_kwDOSrGMn86Ymqcw
```

之后才能写入 GitHub review state。

## 后续技术任务

Review thread 行政闭环后，不直接重做 R1C release。

下一技术候选必须先：

`POST-V2-R1C-AUDIT-READER institution-scoped audit readonly reader prerequisite audit + admission`

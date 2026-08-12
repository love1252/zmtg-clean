# POST-V2-R1C `page_system_audit` Runtime 独立审查阻断与回滚重新准入

> 日期：2026-08-12
>
> Runtime PR：#1163
>
> Runtime merge：`2ba154c8503f45149a0ce8402152fb0643a94c43`
>
> 类型：独立审查阻断记录 + 仅文档（docs-only）回滚准入

## 1. 结论

```text
post_v2_r1c_runtime_implementation=passed
post_v2_r1c_runtime_independent_review=blocked
post_v2_r1c_runtime_review_blocker_count=2

post_v2_r1c_complete=false
```

CI / tests / build 全部通过不改变上述结论。独立 Review 发现两项 P1 行为缺陷，因此 R1C 不能进入 Handoff。

## 2. P1-01：破坏既有 Workbench 只读投影

R1C Authority 对具备 `system` 访问权的管理角色同时返回：

- `page_workbench`
- `page_system_audit`

两条 `read_only` capability。

但 `/hospital` 当前的 Workbench 投影仍要求：

```text
projection.summaries.length === 1
```

因此管理角色会丢弃整个 Workbench projection，回退到占位态。

结论：

```text
r1b_workbench_regression_risk=true
```

R1B 历史治理闭环仍保留，但当前 R1C Runtime 对其产生了行为回归，必须修复或回滚。

## 3. P1-02：Audit Reader prerequisite 不存在

`page_system_audit` 成功挂载的 `InstitutionAuditEventsShell` 会请求：

`/api/institution/audit-events`

该 API 当前仍固定返回：

```text
503
institution_audit_events_capability_disabled
```

源码还明确说明：在 institution-scoped audit reader 存在前不读取请求。

因此：

```text
page_system_audit_successful_read_path=false
audit_reader_prerequisite_missing=true
```

当前不能把 `page_system_audit` 解释为有效 readonly release。

## 4. 为什么不继续扩 Runtime 修 Reader

要真正接通 Audit Reader，预计会触及：

- API Route；
- institution-scoped reader；
- repository / query / source ownership；
- 可能的 DB / persistence 边界；
- 额外测试与架构依赖。

这明显超出 R1C 原 exact-4 Admission。

为了避免过度开发，本次不扩 scope，不顺手实现 Reader。

## 5. 最小安全动作：exact-4 回滚

回滚范围严格等于 PR #1163 的反向 4 文件：

1. `src/server/orchestration/institution-capability-authority.ts`
2. `src/server/orchestration/institution-capability-authority.test.ts`
3. `src/app/hospital/system/audit/page.tsx`（delete）
4. `src/modules/institution/tests/InstitutionRouteShell.test.tsx`

回滚目标：

```text
page_workbench=read_only/pilot_released
page_system_audit=hidden/not_released
governed_page_release_count=1
remaining_unreleased_page_count=25

shared_catch_all_change=false
audit_shell_change=false
audit_client_change=false
audit_api_change=false
db_schema_migration_change=false
```

## 6. Review thread 状态

PR #1163 两个 P1 thread 保持 unresolved。

在回滚 Runtime 合并并验证之前，不回复、不 resolve。

## 7. 后续 Audit 路线

回滚完成后，`page_system_audit` 不直接再次 Runtime release。

必须先单独执行：

```text
POST-V2-R1C-AUDIT-READER institution-scoped audit readonly reader prerequisite audit + admission
```

只有 Reader/API 成功路径被证明后，才重新申请 `page_system_audit` release。

## 8. 当前授权

```text
rollback_runtime_authorized=false
audit_reader_runtime_authorized=false
```

## 9. 唯一下一任务

```text
POST-V2-R1C exact-4 Runtime rollback explicit authorization
```

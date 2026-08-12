# POST-V2-R1C `page_system_audit` 只读放行重新审计与精确 Runtime 准入

> 日期：2026-08-12
>
> 基线：R1B Handoff merge `06d88f53a63d0e33ae8ef0c8da8900676cc3ce68`
>
> 类型：仅文档（docs-only）re-audit + Runtime admission
>
> Runtime change：false

## 1. 准入结论

```text
post_v2_r1c_page_system_audit_reaudit=passed
post_v2_r1c_exact_runtime_admission=passed

target_capability=page_system_audit
target_section=system
target_route=/hospital/system/audit

runtime_authorized=false
```

R1C 本轮只完成 fresh re-audit 与 exact Runtime allowlist 冻结，不实施 Runtime。

## 2. R1B 当前已放行事实

```text
post_v2_r1b_complete=true
released_page=page_workbench
current_page_release_count=1
current_remaining_unreleased_page_count=25

reader_release=true
capability_release=true

production_ready_inferred=false
production_deployment=false
```

Reader / Capability `true` 仅代表已经存在至少一个完成治理闭环的 readonly page slice，不代表 R1C 已放行。

## 3. R1C 当前事实

```text
capability=page_system_audit
section=system
route=/hospital/system/audit

current_route_state=catch_all_capability_off
current_authority_decision=hidden
current_production_release=not_released

existing_readonly_shell=InstitutionAuditEventsShell
existing_client_mutation_method_count=0
```

## 4. 为什么选择专用静态 Route

R1C 不修改共享：

`src/app/hospital/[...slug]/page.tsx`

原因是该 catch-all 当前承接剩余大量未放行 canonical 页面。若为了 `page_system_audit` 修改共享 Route，会扩大行为影响面。

本轮 Runtime 候选改为新增：

`src/app/hospital/system/audit/page.tsx`

专用静态 Route 只负责一个 capability：

`page_system_audit`

因此：

```text
shared_catch_all_change=false
other_unreleased_page_route_behavior_change=false
```

## 5. Exact Runtime allowlist

```text
exact_runtime_file_count=4
existing_runtime_file_count=3
new_runtime_file_count=1
architecture_exception_required=false
```

精确文件：

1. `src/server/orchestration/institution-capability-authority.ts`
2. `src/server/orchestration/institution-capability-authority.test.ts`
3. `src/app/hospital/system/audit/page.tsx`（new）
4. `src/modules/institution/tests/InstitutionRouteShell.test.tsx`

冻结不动：

- public Capability contract；
- public Capability registry；
- shared catch-all Route；
- `InstitutionAuditEventsShell`；
- audit client；
- DB / Schema / Migration；
- Security/Auth/Tenancy authority owners；
- 3 个 controlled-create actions。

## 6. 计划放行策略

仅新增 `page_system_audit`：

```text
decision=read_only
codeMaturity=verified
connectionAvailability=not_required
dataReadiness=not_required
productionRelease=pilot_released
safeSummary=审计与安全仅供查看
```

R1B 的 `page_workbench` 保持现状。

如果 R1C 最终完成 Runtime + Independent Review + Handoff，则总 page release 计划为：

```text
planned_total_page_release_count=2
planned_remaining_unreleased_page_count=24
planned_controlled_create_release_count=0
```

## 7. Route 计划行为

专用 `/hospital/system/audit` Route 必须：

1. 先通过现有 server-only Institution Request Authorization；
2. 调用 genuine `authorizeCurrentInstitutionNavigationV1({ targetSectionId: 'system' })`；
3. 只有 `targetAccess=allowed` 才读取 Capability Authority；
4. 只接受 exact `page_system_audit / read_only / pilot_released / safeSummary=审计与安全仅供查看`；
5. exact authority 成立时渲染既有 `InstitutionAuditEventsShell`；
6. Authority 缺失/异常时回退现有 capability-off；
7. Navigation blocked / unavailable 时保持既有 fail-closed 状态；
8. 不触发任何 create/update/import/write surface。

## 8. 测试准入

当前基线：

```text
baseline_targeted_test_files=6
baseline_targeted_tests=177
baseline_targeted_tests=passed
baseline_typecheck=passed
```

Runtime 计划在既有 `InstitutionRouteShell.test.tsx` 增加专用 Route 集成断言，不新建 `src/modules/institution/**` test file。

最低计划新增 Route 断言：

1. genuine system navigation + exact audit authority -> readonly Audit shell；
2. navigation allowed + authority unavailable -> capability-off；
3. navigation blocked -> fail-closed 且 Capability Authority 不被调用。

因此 Runtime 预期 targeted：

```text
expected_runtime_targeted_test_files=6
expected_runtime_targeted_tests=180
```

最终以 Runtime 实际、全套测试与 Architecture Gate 为准。

## 9. 当前授权状态

```text
post_v2_r1c_runtime_authorized=false
post_v2_r1c_reader_release_authorized=false
post_v2_r1c_capability_release_authorized=false
```

本 Admission merge 不是 Runtime 许可。

## 10. 唯一下一任务

```text
POST-V2-R1C page_system_audit readonly release exact 4-file Runtime implementation explicit authorization
```

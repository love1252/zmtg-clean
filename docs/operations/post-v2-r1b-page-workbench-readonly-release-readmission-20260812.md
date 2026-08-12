# POST-V2-R1B page_workbench Readonly Release Re-audit + Exact Runtime Admission

> 日期：2026-08-12
>
> Base：`39c0ad1472afc20f3f506f04eaf180194f882176`
>
> R1A Handoff：PR #1156
>
> 性质：docs-only re-audit + Runtime admission
>
> Runtime authorization：false

## 1. Re-audit verdict

```text
post_v2_r1b_page_workbench_reaudit=passed
post_v2_r1b_exact_runtime_admission=passed

target_capability=page_workbench
target_section=workbench
target_route=/hospital

exact_runtime_file_count=5
existing_runtime_file_count=5
new_runtime_file_count=0

architecture_exception_required=false
R1B_runtime_authorized=false
```

## 2. Fresh current state

Registry：

```text
capability_registry_count=36
section_capability_count=7
page_capability_count=26
controlled_create_action_count=3
```

目标：

```text
page_workbench
section=workbench
route=/hospital
current_route_state=capability_off_workbench
```

当前 Authority：

```text
decision=hidden
productionRelease=not_released
authority_production_caller_count=0
page_release_count=0

reader_release=false
capability_release=false
```

R1A Authority Foundation 已存在，因此旧 R1 的
`authority_bearing_capability_status_missing` blocker 已经解决；
R1B 剩余 blocker 收窄为：

```text
page_workbench_release_policy_missing
+
hospital_route_authority_status_not_wired
```

## 3. Existing Workbench assets are sufficient

现有 Workbench projection 已原生支持：

- `read_only`；
- current freshness；
- stale `read_only` 的保守投影；
- scope mismatch fail-closed；
- safe summary 白名单；
- hidden item 不显示；
- 只有 `operational` action 才能进入 quick-create。

因此 R1B 不修改：

```text
src/modules/institution-workbench/domain/workbench-capability-projection.ts
src/modules/institution-workbench/components/InstitutionWorkbenchShell.tsx
src/modules/institution/server/institution-server-runtime.ts
```

本 slice 不接业务 Action / Lifecycle Provider。

## 4. Frozen release policy

R1B Runtime 成功后，仅 `page_workbench` 使用 code-owned exact policy：

```text
capabilityKey=page_workbench
codeMaturity=verified
productionRelease=pilot_released
connectionAvailability=not_required
dataReadiness=not_required
safeSummary=工作台仅供查看
```

Decision：

```text
institutionAuthorization=authorized
=> decision=read_only

institutionAuthorization=not_authorized
=> decision=hidden
```

`pilot_released` 是 Capability Status 的代码级 pilot release 状态，
不等于 Production deployment，也不推导 production ready。

其余 35 个 capability：

```text
decision=hidden
productionRelease=not_released
```

三个 controlled-create action 必须继续：

```text
decision=hidden
productionRelease=not_released
```

## 5. Route behavior

`/hospital` 继续保留既有 genuine Navigation Authorization。

只有同时满足：

1. current workbench navigation genuinely allowed；
2. authority resolver 返回 valid `CapabilityStatusV1`；
3. `page_workbench` 为 `read_only`；
4. Workbench capability projection 成功；

才渲染 readonly Workbench shell。

否则 fail-closed 到现有：

```text
InstitutionWorkbenchCapabilityOff
```

Action projection 与 Lifecycle projection 在 R1B 继续 `blocked`。

## 6. Exact Runtime allowlist

冻结为 **5 existing files / 0 new files**：

1. `src/server/orchestration/institution-capability-authority.ts`
2. `src/server/orchestration/institution-capability-authority.test.ts`
3. `src/app/hospital/page.tsx`
4. `src/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff.tsx`
5. `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx`

任何第 6 个 Runtime 文件都必须 STOP / re-admit。

## 7. Explicitly frozen files

R1B 不修改：

```text
public CapabilityStatusV1 contract
public capability registry
Institution server authority runtime
candidate evaluator
candidate reader
Workbench capability projection
Workbench shell
Security
Auth
Access Control
Tenancy
Schema
Migration
DB Writer
catch-all Route
```

## 8. Expected post-Runtime state

只有 future Runtime + independent review + Handoff 全部成功后，才允许：

```text
page_release_count=1
released_page=page_workbench
decision=read_only
productionRelease=pilot_released

authority_production_caller_count=1
planned_reader_release_after_runtime_review_handoff=true
planned_capability_release_after_runtime_review_handoff=true
```

同时：

```text
remaining_page_release_count=0_for_other_25_pages
controlled_create_release_count=0
production_ready_inferred=false
production_deployment=false
```

以上是成功后的验收目标，不是当前事实。

## 9. Baseline evidence

```text
targeted_test_files=5
targeted_tests=49
targeted_tests=passed
typecheck=passed
```

## 10. Stop / re-admit conditions

出现任一情况立即 STOP：

- 第 6 个 Runtime 文件；
- 新 Runtime 文件；
- 第二个 page capability；
- 任一 controlled-create action；
- public contract / registry change；
- Workbench projection change；
- Institution server runtime change；
- Security/Auth/Access Control/Tenancy change；
- architecture exception；
- DB / Schema / Migration；
- catch-all Route；
- real HIS / WeCom；
- Production deployment；
- release policy 扩大到 `released`；
- 未经新的显式 Runtime 授权直接实施。

## 11. Unique next task

```text
POST-V2-R1B page_workbench readonly release exact 5-file Runtime implementation explicit authorization
```

授权语句：

```text
授权执行 POST-V2-R1B page_workbench readonly release exact 5-file Runtime implementation。
```

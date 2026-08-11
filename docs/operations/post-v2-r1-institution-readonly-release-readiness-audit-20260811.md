# POST-V2-R1 Institution Readonly Reader / Capability Release Readiness Audit

> 日期：2026-08-11
>
> Base：`56df3fb0a465281ae6dff7e7b32a311f381aa46e`
>
> 性质：docs-only readiness audit
>
> Runtime authorization：false
>
> Reader release authorization：false
>
> Capability release authorization：false

## 1. Audit conclusion

```text
post_v2_r1_readiness_audit=passed

capability_registry_count=36
section_capability_count=7
page_capability_count=26
controlled_create_action_count=3

eligible_for_future_readonly_release_slice=0
blocked=26
outside_initial_readonly_release=0

reader_release=false
capability_release=false
```

R1 Audit 本身通过，但当前没有 page capability 可以进入未来 release slice。

这不是测试失败，而是 fresh audit 发现 26 个 page capability 共享同一公共阻断：

```text
current_route_capability_off
+
authority_bearing_capability_status_missing
```

## 2. Current route state

当前 26 个 page capability：

```text
workbench capability-off=1
catch-all capability-off=25
```

`/hospital` 根页只渲染 Workbench capability-off。

其余 canonical page route 统一由 `/hospital/[...slug]` 解析到 `InstitutionCapabilityOffPage`。

当前 capability-off 页面固定：

```text
data-capability-state=blocked
尚未获得该能力的生产放行
```

因此当前 Route 层没有发布任何 institution page business reader。

## 3. Authority boundary

Public capability registry：

```text
total=36
sections=7
pages=26
controlled-create actions=3
diagnostic page keys=6
```

当前 Evaluator / Reader 都只输出：

```text
non_authorizing_candidate
```

不存在正式 authority-bearing：

```text
evaluateInstitutionCapabilityStatusV1
readInstitutionCapabilityStatusV1
```

Owner authority requirements 仍冻结为 7 项：

```text
formal_provenance
fresh_active_membership
active_institution_anchor
owner_capability_facts
trusted_server_clock
diagnostic_route_guard
capability_revision
```

这些前置当前只能作为 candidate / requirement 参与静态边界，尚没有形成可授权 release 的 owner seal。

## 4. Per-capability matrix

逐 capability 证据：

`docs/operations/post-v2-r1-institution-readonly-release-readiness-matrix-20260811.csv`

矩阵共 26 行，对应全部 `kind=page` capability。

每行均包含 Admission 要求的：

```text
capability_key
section_id
target_route
current_route_state
formal_provenance
fresh_active_membership
active_institution_anchor
owner_capability_facts
trusted_server_clock
diagnostic_route_guard
capability_revision
scope_shape
read_only_semantics
low_sensitive_output
external_dependency
schema_or_migration_dependency
test_evidence
readiness_classification
blocker_reason
```

## 5. Why no page is eligible yet

当前不能把已有导航授权理解成 capability release authority。

导航边界只证明：

- 当前请求可以得到机构导航 authorization；
- blocked / unavailable 时不读取业务数据；
- 导航可见不代表能力已开放。

Capability status 仍缺少共同的 authority-bearing seam：

1. authoritative owner facts；
2. trusted owner seal；
3. capability revision；
4. trusted server clock decision；
5. release authority output contract；
6. Route 对 authority result 的严格消费。

因此逐页实现 Reader 不是下一步。

## 6. Controlled-create actions

以下 3 个 action 仍明确排除：

```text
action_customer_create
action_care_appointment_create
action_care_followup_create
```

R1 不审计其写能力 release，也不允许因页面未来 readonly release 而自动放行 create action。

## 7. Test evidence

```text
targeted_test_files=5
targeted_tests=126
result=passed

typecheck=passed
```

覆盖：

- capability registry contract；
- non-authorizing evaluator；
- non-authorizing reader；
- full stable route shell / capability-off routing；
- Workbench capability-off entry。

## 8. Decision

```text
post_v2_r1_readiness_audit=passed
post_v2_r1_complete=true

eligible_page_count=0
blocked_page_count=26

common_authority_foundation_required=true

runtime_change=false
reader_release=false
capability_release=false
production_ready_inferred=false
```

## 9. Unique next task

```text
POST-V2-R1A Institution Capability Authority Foundation Preflight + exact Runtime admission decision
```

R1A 只负责冻结 authority foundation 的最小目标、Owner、contract、exact Runtime allowlist 与停止条件。

R1A 仍不能自动实施 Runtime；只有完成独立 preflight/admission 并取得新的显式 Runtime 授权后，才能进入实现。

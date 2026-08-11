# POST-V2-R1 Institution Readonly Reader / Capability Release Readiness Audit Admission

> 日期：2026-08-11
>
> Base：`c9da9cd799268d0fc1439e2cbb60b91068cd5630`
>
> 状态：admitted_docs_only
>
> Runtime authorization：false
>
> Reader release authorization：false
>
> Capability release authorization：false

## 1. Goal

对当前 26 个 institution `page` capability 做 fresh readiness audit，形成最小未来 readonly release slice 候选。

本任务只判定 readiness，不实施 release。

## 2. Read-only source scope

未来 Audit 允许只读核验以下核心契约与 authority-boundary：

```text
src/modules/institution-contracts/v1/institution-capability-registry.ts
src/modules/institution-contracts/v1/institution-routes.ts
src/modules/institution-contracts/v1/institution-navigation.ts
src/modules/institution/server/institution-capability-status-evaluator.ts
src/modules/institution/server/institution-capability-status-reader.ts
src/modules/institution-contracts/v1/tests/InstitutionCapabilityRegistryContract.test.ts
src/modules/institution/tests/InstitutionCapabilityStatusEvaluator.test.ts
src/modules/institution/tests/InstitutionCapabilityStatusReader.test.ts
```

Audit 可按 capability key 继续读取其直接 Route / Reader / UI / test 证据，但不得修改任何 Runtime 文件。

## 3. Frozen contract facts

```text
capability_registry_count=36
section_capability_count=7
page_capability_count=26
controlled_create_action_count=3
owner_requirement_count=7

capability_evaluator_authorizing=false
capability_reader_authorizing=false
```

Targeted contract verification：

```text
test_files=3
tests=49
result=passed
typecheck=passed
```

## 4. Audit output

未来 Audit 必须为 26 个 page capability 生成逐项矩阵，至少包含：

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

## 5. Classification

只允许：

```text
eligible_for_future_readonly_release_slice
blocked
outside_initial_readonly_release
```

禁止输出：

```text
released
operational
production_ready
```

除非未来独立 release task 取得相应授权并形成新的权威证据。

## 6. Explicit exclusions

```text
controlled-create actions
write capability release
Runtime change
Route change
Schema
Migration
DB execution
real HIS
real WeCom
real AI provider
real Storage / Jobs
production deployment
AQ004 compatibility retirement
Platform / Audit / Workspace post-V2 review
```

## 7. Stop conditions

发现以下任何情况立即停止并单独 re-admit：

- 需要修改 Runtime 才能完成 readiness 判断；
- 需要 DB / Migration / environment connection；
- capability key / route registry 漂移；
- authority-bearing Reader/Evaluator 已存在且未准入；
- 需要打开 write action；
- 需要真实外部系统；
- 需要 production release 决策。

## 8. Unique next task

```text
POST-V2-R1 Institution Readonly Reader/Capability Release Readiness Audit
```

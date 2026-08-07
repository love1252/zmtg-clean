# BASE-B6 BASE-02 completion audit 与 Option 1 supersession reconciliation

> 日期：`2026-08-08`
>
> Audit Base：`057dbb31d4dd36039b9f442333b0753065f4ccd1`
>
> 状态：`passed`
>
> 模式：`static_completion_audit`

## 1. 审计目标

本轮只做 BASE-B6 最终完成审计、Option 1 supersession reconciliation 与 physical FK terminal strategy preplanning。

本轮不连接数据库，不执行 DDL/DML/Migration/Seed，不执行 FK VALIDATE，不重新执行 BASE-B5 transfer，不开放 Reader/Capability。

## 2. BASE-B1～B5 证据链

### BASE-B1：Owner / Port / revision

当前关闭证据确认：

```text
base_b1_owner_port_revision_contract=all_exact
access_control_membership_binding_owner=single
identity_account_session_owner=single
tenancy_scope_revision_owner=single
membership_binding_scope_revision_domains=independent
owner_outside_direct_membership_writer_files=0
owner_outside_direct_membership_writer_symbols=0
second_authorization_fact_source_count=0
multiple_membership_selection=explicit_or_fail_closed
base_b1_closure_evidence=passed
```

Operating Context 未进入正式授权组合。

### BASE-B2：Membership / Binding lifecycle

当前 canonical runtime 已具备：

```text
Membership lifecycle Owner
Binding lifecycle Owner
command replay
CAS / revision / version
single canonical repository writer boundary
immutable transition evidence
AQ008 canonical writer gate
```

BASE-B4 完成审计进一步确认：

```text
owner_outside_direct_writer_count=0
lifecycle_unresolved_count=0
```

因此 B2 当前不存在未关闭的 canonical lifecycle 绕过门。

### BASE-B3：Formal Session / context refresh

当前正式授权链保持：

```text
Identity I1
→ Membership/Binding M1
→ Scope S1
→ Membership/Binding M2
→ Scope S2
→ Identity I2
```

Membership revision、Binding version 与 Scope revision 独立比较；缺失、歧义、撤销、过期或漂移均 fail-closed。

### BASE-B4：Guard / bypass closure

最终完成审计：

```text
completion_criteria_count=12
completion_criteria_passed=12
api_route_count=81
formal_guarded_route_count=18
governed_fail_closed_route_count=63
ungoverned_route_count=0
customer_section_guard_wiring_count=3
customer_object_guard_wiring_count=3
owner_outside_direct_writer_count=0
lifecycle_unresolved_count=0
base_b4_complete=true
```

### BASE-B5：Historical orphan disposition

one-time controlled execution 已完成并独立收口：

```text
execute_attempt_count=1
execute_status=applied_verified
outcome_classification=committed
independent_postcheck=passed
automatic_retry=false
second_execute=false

source_membership_revoked_count=1
source_membership_active_count=0
source_active_binding_count=0

target_membership_active_count=1
target_active_binding_count=1
target_scope_active_count=1

active_authorization_orphan_count=0
active_scope_relation_orphan_count=0
retained_revoked_historical_relation_orphan_count=1

base_b5_complete=true
```

## 3. 旧 BASE-B6 hard gate

2026-08-01 readiness plan 的 BASE-B6 旧门是：

```text
active historical orphan = 0
全部 Scope 关系 orphan = 0
BASE-B1～B5 独立证据通过
全部 current Membership/Binding lifecycle 入口委托唯一 Owner 或禁用
direct cross-domain Writer/Deleter = 0
business Reader closed
FK 不得在 BASE-02 擅自 VALIDATE
```

其中“全部 Scope 关系 orphan=0”形成于 cross-tenant retained history 设计之前。

## 4. Option 1 supersession reconciliation

后续 accepted ADR：

```text
B5_RELATION_ORPHAN_SUCCESS_OPTION_1_ACTIVE_AUTHORIZATION_ZERO_RETAIN_HISTORY
```

明确将授权完整性与 immutable historical relation fact 分离。

新终态：

```text
active_authorization_orphan_count=0
active_scope_relation_orphan_count=0
retained_revoked_historical_relation_orphan_count=1
```

同时保留：

```text
M09-A immutable=true
Binding no-delete=true
historical Binding tuple rewrite=false
archive old Binding=false
```

因此，本 BASE-B6 从当前 accepted authority 顺序解释旧 hard gate：

```text
old:
all-row physical Scope relation orphan = 0

superseded_for_BASE02_completion:
active Scope relation orphan = 0
+
exactly one revoked/evidence-complete historical relation orphan retained
```

该 supersession **只关闭 BASE-02 当前授权完整性门**。

它不自动放行：

```text
Reader
Capability
MIG-01C
FK VALIDATE
```

Reader 的后续发布门仍必须在 Writer、Audit、MIG-01B/C、对象归属与独立发布审查阶段重新核验。

## 5. BASE-B6 completion gates

当前审计结论：

| Gate | Result |
|---|---|
| B1 Owner / Port / revision | passed |
| B2 canonical lifecycle | passed |
| B3 Formal Session / refresh | passed |
| B4 Guard / bypass | passed 12/12 |
| B5 disposition | passed |
| active authorization orphan | 0 |
| active Scope relation orphan | 0 |
| retained historical relation orphan | 1 expected |
| Owner outside direct Writer/Deleter | 0 |
| lifecycle unresolved | 0 |
| Reader | closed |
| Capability | closed |
| FK VALIDATE in BASE-02 | not executed |
| production change | 0 |

因此：

```text
base_b6_completion_audit=passed
base02_authorization_integrity_complete=true
base02_complete=true
```

BASE-02 完成只代表 Access Control / Session / Membership / Binding / Scope / Guard 基础闭环完成。

不代表业务 Reader 已经发布。

## 6. Physical FK terminal strategy preplanning

当前物理事实：

```text
retained_revoked_historical_relation_orphan_count=1
simple_all_row_fk_validation_ready=false
fk_validate=false
```

PostgreSQL 普通 FK 不能表达“只对 active/current Binding 生效”的 partial FK。

本轮冻结以下候选，但**不选择、不实施**：

### PFK-0：保持现有 FK NOT VALID

```text
schema_change=0
history_preserved=true
enforce_terminal=false
```

优点：零变更、完全保留当前历史。

缺点：不能成为 MIG-01C 最终 enforce 方案。

定位：仅可作为过渡态。

### PFK-1：active-only constraint trigger

```text
history_preserved=true
same_binding_table=true
second_fact_source=false
schema_migration_required=true
```

由 constraint trigger / equivalent database enforcement 只对 active/current Binding 校验 active Scope。

优点：保持现有 immutable historical row，不引入第二 current fact store。

风险：数据库机制更定制，需要专门并发、事务、restore、Migration 与运维测试。

当前推荐级别：`preferred_candidate_for_future_ADR`，不是本轮决策。

### PFK-2：derived active relation projection + standard FK

建立只承载 current active relation 的派生关系，并对该关系使用标准 FK。

优点：标准 FK 语义强，current relation 可精确 enforce。

风险：

```text
derived_projection_consistency
owner_dual_write
second_fact_source_confusion
additional_schema_and_migration
```

必须证明它只是 Owner 管理的派生约束投影，不成为第二授权事实源。

当前推荐级别：`alternative_candidate`。

### PFK-3：current / history physical split

把 current active Binding 与 immutable history 物理拆表。

优点：关系模型最清晰。

风险：现有 M09-A/no-delete/history identity 决策冲突最大；迁移历史数据会要求新的 ADR supersession。

当前推荐级别：`high_governance_cost_not_preferred`。

## 7. Physical FK 决策边界

本轮不授权：

```text
schema_change
migration
trigger/function creation
FK drop/recreate
FK VALIDATE
history row move
Binding delete/archive
historical tuple rewrite
```

未来必须另立 ADR + Schema/Migration admission。

该 physical FK 决策是 MIG-01C enforce 前置，不阻断 BASE-02 当前业务授权完整性收口。

## 8. BASE-02 completion decision

```text
base_b1_complete=true
base_b2_complete=true
base_b3_complete=true
base_b4_complete=true
base_b5_complete=true
base_b6_completion_audit=passed

base02_complete=true

reader_release=false
capability_release=false

physical_fk_strategy_resolved=false
fk_validate=false
```

## 9. 下一任务

按照既有项目顺序：

```text
BASE-02 post-closure business Writer dual-write / old Writer blockade admission
```

physical FK terminal ADR 保持为 MIG-01C 前的独立决策，不与下一 Writer admission 混做。

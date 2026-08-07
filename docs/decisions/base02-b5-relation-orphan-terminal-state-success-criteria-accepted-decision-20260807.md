# BASE-B5 跨 tenant relation-orphan 终态与成功标准 ADR

> 日期：`2026-08-07`
>
> 冻结 Base：`207804f4a4a962d10dc5c872bc952e0bb3390eac`
>
> 状态：`accepted`
>
> 选择：`B5_RELATION_ORPHAN_SUCCESS_OPTION_1_ACTIVE_AUTHORIZATION_ZERO_RETAIN_HISTORY`
>
> 本 ADR 只接受 BASE-B5 成功标准与历史保留语义，不授权数据库连接、DDL、DML、Migration、Membership／Binding 实际写入或 historical orphan remediation。

## 1. 决策背景

既有 `B5_DETERMINISTIC_REBIND` 成功条件冻结为：

```text
active_orphan=1->0
relation_orphan=1->0
```

后续只读审计证明 historical orphan 与目标 Scope 位于不同 tenant。XT01–XT08 已完成业务／架构方向准入，未来访问迁移方向固定为：

```text
target Membership create + target Binding create
+
source Membership revoke + source Binding revoke
```

但既有 M09-A Binding 决策同时要求：

- revoked Binding identity 永久保留；
- `tenant_id／institution_id` 等 identity tuple 创建后不可原地修改；
- Binding current 不提供 DELETE；
- transition evidence append-only；
- active 授权只能由 active Binding + Fresh Membership + active Scope 的实时组合产生。

因此 cross-tenant transfer 正确完成后：

```text
source Binding = revoked and retained
target Binding = active
active authorization orphan = 0
physical all-row relation orphan = 1
```

原有“全量物理 relation orphan 必须 0”的成功标准与 M09-A 历史保留语义冲突。

## 2. 用户确认

用户明确确认采用方案 1：

```text
keep_m09a_immutable=true
keep_no_delete=true
archive_old_binding=false
rewrite_historical_binding_tuple=false

base_b5_success_semantics=active_authorization_orphan_zero
revoked_evidenced_historical_relation_orphan_allowed=true

adr_design_preplanning_authorized=true
database_connection_authorized=false
ddl_authorized=false
dml_authorized=false
migration_authorized=false
membership_binding_write_authorized=false
historical_orphan_remediation_authorized=false
```

## 3. Accepted 终态语义

BASE-B5 从本 ADR 起把“授权完整性错误”和“被保留的历史关系事实”分成两个域。

### 3.1 Active authorization integrity

必须严格清零：

```text
active_authorization_orphan_count=0
active_scope_relation_orphan_count=0
active_same_account_duplicate_binding_count=0
```

这里的 active authorization orphan 只统计**当前仍可能参与授权判断**的 Binding。

任何 `status=active` 且无法解析到合法 active Membership／active Scope 的 Binding 仍是硬阻断。

### 3.2 Retained historical relation fact

允许保留，但必须严格满足完整条件：

```text
retained_revoked_historical_relation_orphan_count=1
```

该行只有同时满足以下条件时才属于允许保留的 historical relation fact：

1. Binding `status=revoked`；
2. `revoked_at` 非空且规范；
3. Binding identity／tenant／institution tuple 未被改写；
4. 不存在 persisted active duplicate；
5. source Membership 已进入 accepted terminal lifecycle；
6. 对应 legacy baseline／runtime revoke transition evidence 完整且不可变；
7. 该 Binding 不再被任何 Reader／Guard 当作当前授权来源；
8. 后续只读审计可以把它唯一分类为 retained history，而不是 active authorization fault。

只要其中任一条件不满足，就不得通过 BASE-B5。

## 4. Supersession

本 ADR **不修改历史文档**，而是从当前 Base 起 supersede 以下旧判断：

```text
B5_DETERMINISTIC_REBIND.required_result
old = active_orphan_1_to_0_relation_orphan_1_to_0
```

新定义：

```text
active_authorization_orphan_1_to_0
active_scope_relation_orphan_1_to_0
retained_revoked_historical_relation_orphan=1_expected
historical_evidence_complete=true
```

旧 `base02-b5-historical-orphan-decision-branch-matrix-20260806.csv` 继续作为当时决策历史保留，不原地重写。

## 5. Future cross-tenant transfer 成功标准

未来执行任务必须重新现场冻结 exact pre-state；在已知基线成立的前提下，目标 post-state 至少必须满足：

```text
source_membership_lifecycle=revoked
source_active_binding_count=0
source_retained_revoked_binding_count=1

target_membership_active_count=1
target_active_binding_count=1
target_scope_active_count=1

active_authorization_orphan_count=0
active_scope_relation_orphan_count=0

retained_revoked_historical_relation_orphan_count=1
historical_relation_orphan_classification=expected_retained_history
historical_transition_evidence_complete=true

conflict_count=0
unexpected_count=0
```

具体 transition/evidence 行数必须在 execution admission 的 live readonly preflight 中按当前真实 pre-state 冻结，本文不在没有数据库连接的情况下猜测行数。

## 6. 不重开的既有边界

本 ADR 不重开：

- M09-A current + append-only transition evidence；
- Binding identity 不可复用；
- Binding tuple immutability；
- Binding DELETE/TRUNCATE 禁止；
- standalone same-tenant `rebind` 语义；
- Access Control Owner 边界；
- transaction-bound Scope assertion；
- command replay／CAS／固定锁序；
- A2-P2 Scope FK `NOT VALID` 状态；
- Reader／Capability release 门。

## 7. 明确禁止的替代方案

本轮拒绝：

- UPDATE 旧 Binding 的 tenant/institution；
- DELETE／archive 旧 Binding；
- 创建 source fake Scope 让全量 relation orphan 归零；
- 把 revoked 行从数据库历史中隐藏或清理；
- 用日志代替 transition evidence；
- 将 same-tenant rebind 偷偷扩大为跨 tenant；
- 在没有独立实施授权时创建 target Membership／Binding 或 revoke source current。

## 8. 当前阶段结论

```text
relation_orphan_terminal_state_option=1
relation_orphan_success_criteria_adr=accepted

m09a_immutable_preserved=true
binding_no_delete_preserved=true
historical_binding_tuple_rewrite=false

active_authorization_orphan_must_zero=true
active_scope_relation_orphan_must_zero=true
retained_revoked_historical_relation_orphan_allowed=true
retained_revoked_historical_relation_orphan_expected_count=1

xt09_technical_admission=resolved_by_adr
xt10_release_boundary_decision=execution_still_required

cross_tenant_transfer_design_ready=true
cross_tenant_transfer_implementation_authorized=false
cross_tenant_transfer_execution_authorized=false

base_b5_success_criteria_conflict=false
base_b5_execution_ready=false
base_b5_complete=false
base02_complete=false

database_connection=false
ddl_execution=false
dml_execution=false
migration_execution=false
membership_write_execution=false
binding_write_execution=false
historical_orphan_remediation_authorized=false
```

## 9. 唯一下一任务

```text
BASE-B5 跨 tenant transfer orchestration 实现准入与 exact allowlist 冻结
```

下一任务仍应是 docs/code-preplanning admission，不得直接执行数据库写入。

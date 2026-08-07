# BASE-B5 one-time execute 独立收口审查

> 日期：`2026-08-08`
>
> Execution Base：`93dfeba3972fb25c74fecf6a6159935d73bcd1a7`
>
> 状态：`passed`

## 1. 审查对象

BASE-B5 controlled runner 已在授权边界内执行一次且仅一次。

本独立收口审查只读取：

- 低敏 execution result log；
- 仓库外 one-time attempt consumed marker；
- 当前 repository code / accepted ADR / tests。

本审查不再次连接数据库，不再次运行 dry-run，不生成新 lease，不调用 execute。

## 2. Execution 证据

已独立确认：

```text
execute_attempt_count=1
execute_exit_code=0
execute_status=applied_verified

automatic_retry=false
second_execute=false

outcome_classification=committed
independent_postcheck=passed
```

## 3. Option 1 terminal state

执行后的 fresh independent read-only postcheck 已证明：

```text
source_membership_revoked_count=1
source_membership_active_count=0
source_active_binding_count=0

target_membership_active_count=1
target_active_binding_count=1
target_scope_active_count=1

active_authorization_orphan_count=0
active_scope_relation_orphan_count=0

retained_revoked_historical_relation_orphan_count=1

membership_evidence_count=2
binding_evidence_count=2

journal_match=true
```

这符合 accepted ADR：

```text
B5_RELATION_ORPHAN_SUCCESS_OPTION_1_ACTIVE_AUTHORIZATION_ZERO_RETAIN_HISTORY
```

即：

- 当前有效授权 orphan 必须清零；
- source historical Binding 被 revoked 且 retained；
- historical relation orphan 允许以历史事实保留 1 条；
- 不改写旧 Binding tenant/institution tuple；
- 不 DELETE / archive historical Binding。

## 4. Execution boundary

确认本次：

```text
controlled_membership_binding_write_execution=true
historical_orphan_remediation_execution=true
direct_sql_dml_execution=false

migration_execution=false
ddl_execution=false
seed_execution=false
fk_validate=false

historical_binding_tuple_rewrite=false
historical_binding_delete=false
historical_binding_archive=false

production_connection=false
production_change=false
```

实际 Membership / Binding 写入只经已审查的 canonical Owner + controlled runner 执行。

## 5. One-time consumption

仓库外 private marker 已确认：

```text
attempt_authorized=true
attempt_consumed=true
execute_attempt_count=1
automatic_retry=false
second_execute=false
terminal_classification=committed
independent_postcheck=passed
```

因此该一次性执行任务已经消费。

后续不得把同一 execution package 当作“尚未执行”重新使用。

## 6. BASE-B5 completion decision

BASE-B5 historical orphan 独立处置完成条件已满足：

```text
base_b5_execution_succeeded=true
base_b5_independent_closure_review=passed
base_b5_complete=true
```

BASE-B5 完成不等于 BASE-02 完成。

## 7. Physical FK remains separate

当前 accepted Option 1 明确保留 revoked historical relation orphan。

因此：

```text
retained_historical_relation_orphan_count=1
auth_account_institution_bindings_scope_fk_validation_ready=false
fk_validate=false
```

简单 PostgreSQL FK 无法仅约束 active/current rows。

本审查不选择新的 schema / constraint strategy，也不授权 Schema、Migration 或 FK VALIDATE。

## 8. BASE-02 state

```text
base_b5_complete=true
base02_complete=false
reader_release=false
capability_release=false
```

旧 BASE-B6 文档中“全部物理 relation orphan 必须 0”的表述必须在 BASE-B6 completion audit 中与后续 accepted Option 1 ADR 做 supersession reconciliation，不能继续机械沿用旧门槛。

## 9. 唯一下一任务

```text
BASE-B6 BASE-02 completion audit、Option 1 supersession reconciliation 与 physical FK terminal strategy preplanning
```

该任务先做审计/决策，不自动执行数据库写入或 FK VALIDATE。

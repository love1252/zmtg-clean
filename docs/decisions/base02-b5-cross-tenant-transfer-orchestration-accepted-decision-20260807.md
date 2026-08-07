# BASE-B5 跨 tenant Membership 与 Transfer Orchestration 决策准入

> 日期：`2026-08-07`
>
> 冻结 Base：`d9ca7610f51af1b4aa18638930bac14fe5e91e11`
>
> 状态：`accepted_for_preplanning_with_xt09_blocker`
>
> 本文记录用户对 XT01–XT10 推荐方向的明确确认，并执行技术一致性准入。本文不是数据库、DML、Migration、Membership／Binding 写入或 historical orphan remediation 授权。

## 1. 用户决策确认

```text
user_decision_confirmation_received=true
selected_policy=XT01-XT10_recommended_direction
cross_tenant_transfer_orchestration_design_allowed=true
cross_tenant_transfer_code_preplanning_allowed=true

database_connection_authorized=false
ddl_authorized=false
dml_authorized=false
migration_authorized=false
seed_authorized=false
fk_validate_authorized=false
membership_binding_write_authorized=false
historical_orphan_remediation_authorized=false
```

## 2. 准入方法

用户选择与技术准入分开记录：

- “用户选择”表示业务／治理方向已确认；
- “技术准入”必须同时满足现有 accepted Membership／Binding 生命周期规则和 BASE-B5 冻结成功标准；
- 任一现有 invariant 与用户选择冲突时，不得伪造 `execution_ready=true`，必须 fail-closed 并把冲突送入下一决策任务。

## 3. XT01–XT10 决策结果

### XT01｜目标 tenant Membership 权威

**接受。**

允许当前既有账号进入已经确认的目标 tenant，但该允许只形成 Membership 设计权威，不等于当前阶段允许落库。

```text
xt01_decision=accepted
target_tenant_membership_authority=approved_for_future_execution
```

### XT02｜目标 Membership Shape

**接受。**

未来目标 Membership 固定：

- `revision=1`；
- `lifecycleStatus=active`；
- role 在真实执行前只读冻结为“沿用当前 source Membership role”；
- provenance 使用 `access_control_command`；
- actor／reason／occurredAt 必须使用低敏、规范化、受控值；
- 同一 Membership create 可携带目标 Binding create；
- Binding 目标为已经确认的 A2-P1 active Scope；
- assignment source 固定为 `manual_admin`；
- 真实 membershipId／bindingId 由未来受控执行入口生成，不进入本文。

```text
xt02_decision=accepted
target_membership_revision=1
target_membership_role_policy=inherit_source_membership_role_at_frozen_preflight
target_membership_provenance=access_control_command
target_binding_assignment_source=manual_admin
```

### XT03｜源 Membership 生命周期

**接受。**

如果未来 transfer 被单独授权执行，源 tenant Membership 使用 `revoke`，不得 delete；其 persisted active Binding 同事务 revoke。全部历史 current/evidence 保留。

```text
xt03_decision=accepted
source_membership_terminal_action=revoke
source_binding_terminal_action=revoke
source_membership_delete=false
source_binding_delete=false
```

### XT04｜Identity portability

**接受。**

继续使用同一个全局 Auth Account；不创建第二个用户身份。tenant 边界由各 tenant Membership／Binding 独立表达。

```text
xt04_decision=accepted
global_identity_reused=true
duplicate_identity_created=false
```

### XT05｜跨 tenant Binding 语义

**接受为 orchestration 设计方向，但不把它写成 BASE-B5 已可完成。**

现有 standalone `rebind` 继续只处理同 tenant old→replacement；跨 tenant 不扩展其语义。

跨 tenant transfer 设计固定为：

```text
target Membership create + target Binding create
+
source Membership revoke + source Binding revoke
```

四项业务 current/evidence 必须处于同一个唯一外层 `SERIALIZABLE READ WRITE` 事务。任何一步失败整批回滚。

```text
xt05_decision=accepted_for_preplanning
reuse_existing_same_tenant_rebind=false
cross_tenant_transfer_kind=orchestrated_target_create_plus_source_revoke
single_outer_transaction_required=true
```

### XT06｜跨 tenant correlation

**接受为无新 Schema 的第一优先设计。**

两个 tenant 的 Owner command 使用同一低敏 transfer command identity；由于 command replay 唯一性是 tenant-scoped，同一 transfer identity 可分别形成 source／target evidence。

本阶段不新增 correlation 表或列。如果未来独立实现审查证明现有 evidence 无法充分证明一次 transfer 的两侧原子关联，必须停止并重新进入 Schema 决策，不得通过日志或自由文本补洞。

```text
xt06_decision=accepted_for_preplanning
correlation_strategy=shared_low_sensitive_transfer_command_identity
new_schema_authorized=false
schema_fallback_requires_new_decision=true
```

### XT07｜Writer 与事务边界

**接受为代码前置规划。**

未来 candidate orchestration：

- Owner：Access Control；
- 新增专用 cross-tenant transfer application orchestration；
- 不修改 Membership／Binding 既有 Owner 归属；
- 复用 transaction-bound Membership/Binding UoW；
- 最外层只允许一个 `SERIALIZABLE READ WRITE` transaction；
- 在 tenant-scoped Owner lock 前增加 transfer/account 级 transaction advisory lock；
- 禁止 nested transaction、UPSERT、自动 retry、direct Repository bypass；
- COMMIT outcome unknown 必须停止并进入只读核验。

```text
xt07_decision=accepted_for_preplanning
owner=access_control
single_outer_serializable_transaction=true
automatic_retry=false
nested_transaction=false
```

### XT08｜恢复与独立验证

**接受。**

任何未来写任务都必须重新建立：

- localhost-only `local_acceptance` 冻结；
- 当前 main／journal／shape；
- 私有恢复点；
- 无并发 Writer／Prepared Transaction；
- source／target Membership、Binding、Scope exact pre-state；
- pre/post 低敏 fingerprints；
- outcome-unknown 只读重算；
- 禁止自动 restore；
- 独立只读 post-review。

```text
xt08_decision=accepted
recovery_point_required=true
independent_readonly_postcheck_required=true
automatic_restore=false
```

### XT09｜BASE-B5 成功标准

**用户方向已确认，但技术准入阻断。**

用户选择的未来访问迁移结果希望同时满足：

```text
active_orphan=1->0
relation_orphan=1->0
target_membership=0->1_active
target_binding=0->1_active
source_membership=active->revoked
source_binding=active->revoked
conflict=0
unexpected=0
```

但当前 accepted Binding 规则同时规定：

1. revoked Binding row 永久保留；
2. `tenant_id／institution_id` 等 identity/tuple 字段创建后不可原地改写；
3. BASE-B2 不提供 DELETE；
4. 跨 tenant transfer 的源 Binding 只做 revoke 时，其原 orphan tuple 仍存在。

因此：

```text
active_orphan_after_transfer=0
relation_orphan_after_transfer=1
```

在不新增 source Scope、不修改旧 Binding tuple、不删除／归档旧 Binding 的前提下，现有冻结 `relation_orphan=1->0` 不可满足。

```text
xt09_user_direction=confirmed
xt09_technical_admission=blocked_invariant_conflict
base_b5_success_criteria_conflict=true
```

### XT10｜Release 边界

**继续阻断。**

XT09 未解决前：

- BASE-B5 不得标记 complete；
- BASE-02 不得标记 complete；
- Reader／Capability 继续关闭；
- cross-tenant transfer implementation 不得启动；
- historical orphan remediation 继续未授权。

```text
xt10_user_direction=confirmed
xt10_technical_admission=blocked_by_xt09
base_b5_execution_ready=false
```

## 4. 代码前置规划允许范围

本决策只允许建立后续实现候选，不授权实际代码修改。

建议 future implementation candidate：

```text
src/modules/access-control/application/cross-tenant-transfer-service.ts
src/modules/access-control/server/cross-tenant-transfer-transaction.ts
src/modules/access-control/tests/CrossTenantTransferService.test.ts
src/modules/access-control/tests/CrossTenantTransferTransaction.test.ts
```

以上仅是 candidate allowlist；下一实现任务必须基于新的 final Base 再独立冻结 exact allowlist。不得以本文直接创建这些文件。

现有可复用构件：

- `executeMembershipCommandWithUnitOfWork`
- `executeBindingCommandWithUnitOfWork`
- transaction-bound `MembershipCommandUnitOfWork`
- transaction-bound Scope assertion
- Membership／Binding append-only evidence
- canonical CAS／command replay／timeout/error mapping

现有 `membership-command-external-transaction.ts` 是 formal onboarding 单次 create Membership 适配器，不得直接扩展成跨 tenant transfer 旁路。

## 5. 当前不可接受的“快速修复”

以下路径本轮全部禁止：

- 将旧 Binding 的 `tenant_id` 或 `institution_id` 原地 UPDATE 到目标；
- 删除旧 Binding；
- 为源 tenant 伪造一个 Scope 以让 orphan count 归零；
- 把 revoked historical orphan 从 relation-orphan 统计中偷偷排除；
- 把日志 correlation 当成数据库 evidence；
- 修改 existing same-tenant `rebind` 语义使其跨 tenant；
- 直接执行 target Membership create；
- 直接执行 source Membership revoke。

## 6. 当前结论

```text
xt01_accepted=true
xt02_accepted=true
xt03_accepted=true
xt04_accepted=true
xt05_preplanning_accepted=true
xt06_preplanning_accepted=true
xt07_preplanning_accepted=true
xt08_accepted=true

xt09_technical_admission=blocked_invariant_conflict
xt10_technical_admission=blocked_by_xt09

cross_tenant_transfer_orchestration_preplanning_admitted=true
cross_tenant_transfer_implementation_authorized=false
cross_tenant_transfer_execution_authorized=false

base_b5_success_criteria_conflict=true
base_b5_execution_ready=false
base_b5_complete=false
base02_complete=false
business_reader_release=false
business_capability_release=false

database_connection=false
ddl_execution=false
dml_execution=false
migration_execution=false
historical_orphan_remediation_authorized=false
```

## 7. 唯一后续决策

下一任务只能进入：

```text
BASE-B5 跨 tenant relation-orphan 终态处置分支与成功标准 ADR 决策
```

该任务必须在以下冲突中作出显式选择，不能由实现者自行决定：

1. 保持 M09-A immutable/no-delete，并修改 BASE-B5 relation-orphan 成功定义；
2. 重新开启受控 archive/delete 路径（需要独立数据保留权威，且会重开既有 no-delete 决策）；
3. 通过独立 ADR 重开 Binding identity/tuple immutability；
4. 继续保持 BASE-B5 blocked。

在新的明确决策完成前，本文不允许任何数据库或 Runtime 实施。

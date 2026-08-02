# BASE-02 Binding 生命周期 provenance 与 transition evidence 已接受决策

> 状态：`accepted`
>
> 接受方向：`M09-A_current_plus_append_only_transition_evidence`
>
> 接受日期：2026-08-02
>
> 记录基线：`3194bc53fa5e0291d4a74f838b33e658c139d9b7`
>
> 授权来源：用户对 BASE-02 ULTRA 当前目标的持续明确授权
>
> 本文只接受 Binding 生命周期、provenance 与 evidence 的架构语义。它不分配 Migration 编号，
> 不创建 Migration Lease，不决定最终 SQL，不授权数据库执行，也不表示 BASE-B2 已完成。

## 1. 决策定位

BASE-B2 必须完成 standalone Binding `create／rebind／revoke／expire`，并保持 Membership、Binding、
Scope 三个版本域独立。当前仓库已经具备 canonical Binding 表、active 唯一索引、独立 `version`、
assignment provenance、Scope FK、Membership 联动事务和权威 Reader，但尚未具备 standalone 命令及
Binding transition evidence。

[`base02-membership-revision-lifecycle-decision-pack-20260801.md`](./base02-membership-revision-lifecycle-decision-pack-20260801.md)
的 M09 提供两条 target-compatible 路径：

- M09-A：canonical Binding current 与 Access Control 同事务 append-only transition evidence；
- M09-B：在 M09-A 基础上，再向 Binding current 冗余 `revokedBy／reason／reboundFrom` 等查询字段。

本决策正式接受 **M09-A**。现有授权 Reader 只需要 Binding identity、状态、assignment source、版本、
有效期与撤销时间；撤销 actor、reason 和 rebind lineage 不参与 current 授权判断。因此，这些历史事实
由 immutable transition evidence 保存即可。M09-B 只可在未来出现已证明的 current 查询需求时，
通过独立决策重新评估，不能成为当前 BASE-B2 的隐含硬门。

以下既有边界不得重开：

- Identity 拥有用户、账号和正式 Session；
- Access Control 唯一拥有 Membership 与 Binding 生命周期；
- Tenancy 唯一拥有 Scope、Context 与 Scope revision 原始事实；
- Security 只消费 Owner Port，不拥有 Membership、Binding 或 Scope；
- `tenant_members` 与 `auth_account_institution_bindings` 分别是唯一 canonical current；
- Membership revision、Binding version 与 Scope revision 是三个互不替代的版本域；
- A2-P2 Scope FK 继续保持 `NOT VALID`，historical orphan 不在本决策处理；
- 项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 均不因本决策启动。

## 2. canonical Binding current 与历史边界

`auth_account_institution_bindings` 继续作为唯一 canonical Binding current 与每个 Binding identity 的
权威状态行：

1. `id` 是不可复用的 Binding identity；
2. `account_id／tenant_id／institution_id／source／assigned_by／assigned_at` 创建后不可原地改写；
3. `status` 继续只有 `active／revoked`；不得新增持久化 `expired` 状态；
4. `expires_at` 继续表达派生过期；Reader 在显式 expire 命令物化前仍按它 fail-closed；
5. `version` 是 Binding 独立 CAS 域，初值 `1`，每次原 Binding 状态变化严格 `+1`，上限
   `2147483647`；
6. 每个 `account_id + tenant_id` 最多一个 persisted active Binding；
7. revoked 行永久保留为该 Binding identity 的 canonical lifecycle history；BASE-B2 不提供 DELETE；
8. transition evidence 只保存不可变历史，不能回答 current，也不能形成第二套 Binding current。

active 授权只能从 canonical Binding current、Fresh Membership 与 active Scope 的实时组合得出。
任何调用方不得从 transition evidence、日志、Session claim 或缓存重建 current 授权。

## 3. accepted Binding transition evidence

后续物理模型必须新增 Access Control 所有的 append-only Binding transition evidence。最终表名、字段
SQL 类型、约束名、索引名、trigger 名与 Migration 切片由独立 Schema／Migration 前置预检冻结；
但下列语义已经接受，不得在实现阶段弱化。

### 3.1 必须承载的事实

每条 evidence 至少能够唯一证明：

- immutable evidence identity；
- command identity；
- transition 类型；
- 原 Binding identity；
- rebind 时的 replacement Binding identity；
- from／to status；
- from／to Binding version；
- 当次观察到的 Membership revision；
- create／rebind 时观察到的 Scope revision；
- 规范化低敏 `provenanceSource`、canonical current 的 `assignmentSource`、actor 与 reason code；
- occurred time 与 recorded time；
- legacy calibration 时“不知道历史发生时间与 actor”的明确 null 语义。

account、tenant 与 institution 可由不可删除且 identity 字段不可变的 canonical Binding row 可靠导出；
若物理预检选择在 evidence 中重复这些字段，必须以 FK／CHECK 保证一致，不能形成可独立改写的副本。

### 3.2 accepted transition 类型

| 类型 | accepted 语义 |
|---|---|
| `create` | 无旧 Binding → 新 identity `active/version 1` |
| `rebind` | 旧 identity `active/n → revoked/n+1`，同时创建 replacement identity `active/version 1` |
| `revoke` | 当前 identity `active/n → revoked/n+1` |
| `expire` | 已到 `expiresAt` 的 current identity `active/n → revoked/n+1` |
| `legacy_calibration` | 只记录 cutover 时观察到的既有 Binding baseline；不伪造 actor、reason 或历史发生时间 |

不得把 standalone Binding transition 塞入 `tenant_membership_transitions`。后者的 FK、revision、状态机与
role Shape 全部属于 Membership，复用会混用两个版本域。

### 3.3 物理保护下限

后续物理模型至少必须提供：

- evidence identity 主键；
- 与 Membership command 一致的租户域 command replay 唯一性：UNIQUE
  `(tenant_id,command_id)`；standalone `bcmd1_` 与父 `mcmd1_` 均受同一规则约束；
- 同一 Binding／目标 version 的唯一性；
- 原 Binding 与 replacement Binding 的 FK 或等价数据库级一致性保护；
- 正 version、严格 `+1`、transition Shape、时间与 provenance Shape CHECK；
- rebind replacement identity 不得等于原 identity；
- Runtime 角色只具 evidence `SELECT／INSERT` 权限；
- 数据库 trigger 拒绝 evidence `UPDATE／DELETE／TRUNCATE`；
- `ON UPDATE NO ACTION／ON DELETE NO ACTION`，禁止 cascade 清理历史。

M09-A 依赖 canonical Binding row 稳定导出 account／tenant／institution 与 assignment provenance，
因此 current 表也必须获得数据库级不可变保护：

- Runtime 角色只能更新 lifecycle 所需的 `status／revoked_at／version／updated_at`，不能原地更新
  `id／account_id／tenant_id／institution_id／source／assigned_by／assigned_at／created_at`；
- column immutability trigger 或等价数据库约束必须拒绝上述 identity／tuple／assignment 字段变化；
- row／statement trigger 与权限必须拒绝 Binding `DELETE／TRUNCATE`；
- rebind 只能撤销旧 row 并插入新 identity，不能借 UPDATE 绕过 lineage evidence。

Repository 约定、TypeScript 类型、测试或 Audit 记录不能替代上述物理保护。

## 4. accepted standalone 生命周期

### 4.1 create

create 必须显式携带 tenant、account、Membership identity／revision、institution、Binding identity、
assignment provenance、command identity 与有效期。它必须在同一 Access Control 外层事务中：

1. 锁定并验证 active Membership 与 expected Membership revision；
2. 锁定并确认不存在 persisted active Binding；
3. 经 transaction-bound Tenancy Port 确认目标 Scope active，并读取 Scope revision；
4. 插入新 Binding identity，固定 `active/version 1`；
5. 插入 `create` evidence；
6. 任一步失败时整批回滚。

Binding 不得据此反向创建 Scope。缺 Membership、缺 Scope、跨 tenant、重复 active、placeholder source、
陈旧 revision 或 affected rows 不为 `1` 均必须 fail-closed。

### 4.2 rebind

rebind 固定采用 **revoke-old + create-new**，不得原地改写 institution：

1. 调用方显式提供旧 Binding identity 与 expected Binding version；
2. old 必须是未撤销、未过期的 persisted active Binding；
3. 新目标 institution 必须不同，并经 Tenancy Port 确认为同 tenant 的 active Scope；
4. 旧行 CAS `active/n → revoked/n+1`；
5. 插入不可复用的新 Binding identity，固定 `active/version 1`；
6. 插入一条明确 old→replacement lineage 的 `rebind` evidence；
7. Membership revision 不推进；
8. 任一步失败时，旧行撤销、新行创建与 evidence 全部回滚。

已过期但 persisted active 的旧行不得被 rebind 静默折叠处理。它必须先经过独立 `expire`，之后再由
新的 create 命令建立 Binding。

### 4.3 revoke

revoke 必须携带 explicit Binding identity／expected version、actor、稳定 reason code、command identity
与 occurred time。它只允许 `active/n → revoked/n+1`，设置 `revokedAt=occurredAt`，并在同一事务插入
`revoke` evidence。

Membership revoke／delete 引发的 Binding 撤销复用父 Membership command identity 与 actor／reason，
并与 Membership current、Membership evidence、Binding current 和 Binding evidence 在同一事务原子
形成。

### 4.4 expire

expire 不新增第三种 persisted status。资格判断必须使用调用方不可注入的可信服务端
`serverObservedAt`；只有 `expiresAt <= serverObservedAt` 时，才允许将 persisted active Binding CAS 为
revoked，并写入 `expire` evidence：

- `revokedAt=expiresAt`，表达授权实际失效边界；
- `occurredAt=expiresAt`；
- `recordedAt` 是实际持久化时间，且不得早于 `serverObservedAt` 或 occurredAt；
- source／actor／reason 使用固定低敏系统契约；
- 到期前、无 expiresAt、已撤销或 version 漂移均 fail-closed。

Reader 在物化 expire 之前仍须直接检查 `expiresAt`，因此不存在“等待 expire 才失效”的授权窗口。

### 4.5 Membership reactivate

Membership reactivate 绝不恢复或隐式撤销旧 Binding。若发现任何 persisted active Binding，包括已经
过期但尚未显式 expire 的行，必须在 Membership CAS 前返回固定冲突并保持所有写入为 `0`。该安全
边界已由 PR #913 的 Runtime／测试修复建立，但 BASE-B2 仍须完成其余生命周期与 evidence。

## 5. command replay 与并发

- standalone Binding command 使用独立、规范化、不可猜测的 command identity 命名域；
- Membership create／revoke／delete 产生 Binding side effect 时复用父 Membership command identity；
- 命令 identity 必须在任何 mutation 前查询；已存在即 fail-closed，不比较 payload、不返回历史成功；
- rebind 虽同时改变两个 Binding identity，仍只属于一个 command 与一条原子 evidence；
- UNIQUE 必须兜住并发漏检；冲突导致整个事务回滚；
- transaction isolation、lock timeout、statement timeout 与固定锁序沿用 Access Control 唯一 UoW；
- 不允许 nested transaction、自动 retry、UPSERT、duplicate catch 或绕过 Owner 的直接 Repository 写入。

固定锁序为：

```text
Membership current／create identity
→ persisted active Binding
→ create／rebind 所需的 transaction-bound active Scope assertion
→ Binding current mutation
→ Binding transition evidence
→ Membership transition evidence（仅父 Membership command 涉及时）
```

若实现证明 Membership evidence 必须先于 Binding evidence 才能满足已有唯一键，物理预检可以交换最后
两项的 insert 顺序，但二者仍必须处于同一事务，且任何失败必须整批回滚。

## 6. provenance 与 legacy baseline

### 6.1 Runtime provenance

Binding current 与 transition evidence 使用两个不同且不得混淆的 source 命名域：

- evidence `provenanceSource` 只能是
  `formal_onboarding／access_control_command／legacy_calibration`；
- canonical current 的 `assignmentSource` 沿用
  `manual_admin／migration_placeholder／system`；新 create／rebind 只允许 `manual_admin／system`，
  `migration_placeholder` 只可作为既有 baseline 被观察，不得由新 Runtime 写入；
- actor 必须是规范化低敏 Owner 识别，不得使用自由文本、PII 或客户端自报 display name；
- reason 必须是稳定低敏 code；
- create／rebind replacement current 的 `source／assignedBy／assignedAt` 必须分别与 evidence 的
  `assignmentSource／actorId／occurredAt` 一致；不得要求两个不同枚举域的 source 字面值相等；
- revoke／expire／rebind 的 actor、reason 与 lineage 必须存在于 transition evidence；
- 跨域 Audit 只能消费未来低敏投影，不能替代 Access Control canonical provenance／evidence。

### 6.2 existing Binding calibration

既有 Binding 不得伪造 create actor、业务 reason 或历史发生时间。Schema／Migration 前置预检必须冻结
确定性 `legacy_calibration` 规则，至少满足：

- 不修改 Binding identity、account、tenant、institution、status、source、assignedBy、assignedAt、
  expiresAt、revokedAt 或 version；
- evidence source 固定为 `legacy_calibration`；
- `fromStatus／fromVersion` 固定为 NULL；
- `toStatus／toVersion` 精确记录当次未修改的 observed current status 与正 version；
- replacement Binding identity 固定为 NULL；
- Membership revision 只记录当次通过 canonical Membership 可验证的 current revision；
- Scope revision 固定为 NULL，尤其不得因 historical Scope relation orphan 伪造 Scope observation；
- evidence `assignmentSource` 精确记录既有 current source，允许观察到
  `migration_placeholder`，但不得把它提升为新 Runtime 可写 source；
- actor 与 occurred time 固定为 NULL；
- reason 固定为 `legacy_unknown`；
- recorded time 只表达实际 baseline 记录时刻；
- command／evidence identity 从稳定低敏键按独立命名域确定性派生；
- historical orphan 仍为原值，不创建 Scope、不重绑、不撤销、不删除；
- calibration 只证明 cutover baseline，不声称恢复了 pre-cutover 完整历史。

## 7. 三个版本域与 B3 边界

Binding evidence 中记录的 Membership revision 与 Scope revision 只是当次命令的历史 observation：

- 它们不得推进、替代或重建 Membership／Scope current；
- Access Control 只能经 transaction-bound Tenancy Port 核验 Scope，不得直接写 Tenancy；
- rebind 只推进旧 Binding version，新 Binding 从 version `1` 开始；Membership revision 不变；
- B3 登录、Session 恢复／刷新和每请求 Guard 仍须实时重读 canonical Membership、Binding 与 Scope；
- transition evidence 不进入授权决策，不进入 cookie、客户端 payload 或公开响应。

## 8. 实施顺序与门禁

M09-A 接受后，BASE-B2 必须按下列独立回退域继续：

```text
Schema／Migration 前置预检
→ physical model accepted decision（如预检发现仍有物理选项）
→ Expand DDL Migration 与 local_acceptance 受控执行
→ Access Control Binding lifecycle／evidence Runtime
→ 旧入口委托或禁用与 AQ008 扩展
→ deterministic legacy calibration DML Migration
→ 高水位／冲突／Owner Writer 清零复核
→ 独立审查
→ BASE-B2 handoff
```

每个 DDL／DML 回退域必须使用实时 Migration 编号、唯一 Migration Lease、执行前恢复点、隔离恢复验证、
单次 guarded Migration、执行证据与独立审查。禁止 `db:generate`、snapshot-diff Migration、自动重试、
直接执行 SQL 或改写已消费 Migration。

下列清单不是对既有 BASE-B2 门禁的替代，而是合并后的完整关闭清单。BASE-B2 handoff 前必须同时
满足：

```text
binding_provenance_decision=M09-A_accepted
binding_canonical_current=auth_account_institution_bindings
binding_transition_evidence_required=true
binding_transition_is_second_current=false
binding_current_extra_revocation_columns_required=false
base_b2_membership_lifecycle=all_exact
standalone_binding_lifecycle=implemented
binding_command_replay=fail_closed
binding_current_and_evidence_atomic=true
membership_binding_side_effect_evidence_atomic=true
legacy_binding_calibration_complete=true
membership_revoke_revokes_active_binding_same_transaction=true
membership_reactivate_restores_binding=false
binding_rebind_advances_membership_revision=false
binding_rebind_advances_binding_version=true
binding_persisted_statuses=active_or_revoked
binding_expiry_derived_from_expires_at=true
active_binding_per_account_tenant=max_one
binding_rebind_preserves_history_and_provenance=true
binding_may_create_scope=false
binding_missing_or_inactive_scope=fail_closed
multiple_membership_selection=explicit_or_fail_closed
legacy_auth_binding_writers=delegated_or_disabled
owner_outside_binding_writer_count=0
binding_transition_update_delete_truncate_count=0
second_membership_binding_fact_source_count=0
aq008_binding_writer_gate_extended=true
aq008_binding_writer_gate_verified=true
historical_orphan_changed_by_base_b2=false
eligible_for_base_b2_independent_review=true
eligible_for_base_b3=true
```

上述任一条件未完成时，必须保持：

```text
base_b2_complete=false
eligible_for_base_b3=false
```

## 9. 明确未接受与禁止范围

本决策不接受、也不授权：

- M09-B current 冗余列；
- 第二套 Binding current、永久 sidecar 或用 transition 回答 current；
- 复用 Membership transition 表保存 Binding 事件；
- 新增 persisted `expired` 状态；
- 原地修改 institution、复活 revoked Binding、删除 Binding 历史；
- historical orphan 处置、Scope 自动创建或 A2-P2 FK `VALIDATE`；
- BASE-B3～B6、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader；
- 具体 Schema 名称、SQL、Migration 编号、Lease、恢复点或数据库执行。

## 10. 接受结果

```text
binding_provenance_decision=M09-A_accepted
binding_canonical_current=auth_account_institution_bindings
binding_transition_evidence_required=true
binding_transition_evidence_schema_migration_required=true
binding_current_extra_revocation_columns_required=false
binding_transition_is_second_current=false
binding_rebind_strategy=revoke_old_create_new
binding_persisted_statuses=active_or_revoked
binding_expiry_derived_from_expires_at=true
historical_orphan_touched=false
base_b2_complete=false
eligible_for_schema_migration_preflight=true
eligible_for_schema_migration_implementation=false
eligible_for_base_b3=false
```

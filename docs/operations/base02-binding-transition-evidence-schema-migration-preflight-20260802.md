# BASE-02 Binding transition evidence Schema／Migration 前置预检

> 状态：`current evidence + proposed physical model preflight`
>
> 基线：`2f1551137d1f10b6cc6fc9b9f63e7eedb9c374c6`
>
> 日期：`2026-08-02`
>
> 授权边界：docs-only 前置预检；不授权 Schema、Migration、Lease、DDL、DML、Runtime 或数据库写入

## 1. 预检结论

```text
binding_transition_evidence_preflight=passed
binding_transition_evidence_current_owner=Access_Control
binding_transition_evidence_is_second_current=false
binding_current_extra_revocation_columns_required=false
binding_physical_model_decision_required=false
binding_schema_migration_number_allocated=false
binding_migration_lease_created=false
eligible_for_binding_schema_migration_implementation=false
binding_database_write_started=false
base_b2_complete=false
eligible_for_base_b3=false
```

M09-A 已被接受：`auth_account_institution_bindings` 继续作为唯一 canonical Binding current；未来新增的 Binding transition evidence 仅保存同 Owner、同事务、append-only 的不可变历史，不回答 current，不参与授权判断，也不成为第二事实源。

## 2. 证据来源与只读边界

本轮证据由当前仓库静态审计，以及固定 localhost-only `local_acceptance` 的显式 `REPEATABLE READ + READ ONLY` 聚合／Catalog 探针组成。

| 项目 | 结果 |
|---|---:|
| transaction_read_only | `on` |
| transaction_isolation | `repeatable read` |
| txid before／after | `0／0` |
| other active client | `0` |
| prepared transaction | `0` |
| environment journal count | `44` |
| Membership current rows | `1` |
| Membership transition rows | `1` |
| Binding current rows | `1` |
| Binding active／revoked | `1／0` |

## 3. 当前 Binding canonical current

唯一 canonical current：`public.auth_account_institution_bindings`

当前低敏 Shape：

| 项目 | 数量 |
|---|---:|
| invalid version | `0` |
| invalid lifecycle shape | `0` |
| active placeholder | `0` |
| Membership orphan | `0` |
| Scope relation orphan | `1` |
| Scope FK | `1` |
| Scope FK validated | `0` |
| user trigger on Binding current | `0` |
| equivalent UNIQUE(tenant_id,id) | `0` |

historical orphan 保持原值，不属于本预检的修复范围；A2-P2 FK 继续 `NOT VALID／convalidated=false`。

## 4. 当前静态写入面

Binding 直接写入仅命中：

`src/modules/access-control/server/membership-command-repository.ts`

当前命中 insert Binding current 与 CAS update Binding current。未发现 Owner 之外的直接 Binding Writer。

后续 AQ008 必须扩展为 Membership＋Binding current＋Binding transition evidence 的精确 Owner allowlist。

## 5. 冻结的 Binding transition evidence 物理模型

推荐唯一表名：

`auth_account_institution_binding_transitions`

Owner：Access Control。

建议列：

- id
- tenant_id
- binding_id
- replacement_binding_id
- command_id
- transition_type
- provenance_source
- assignment_source
- actor_id
- reason_code
- from_status
- to_status
- from_version
- to_version
- membership_revision
- scope_revision
- occurred_at
- recorded_at

## 6. 键、关系和不可变保护

后续 Expand DDL 至少必须提供：

- evidence PK；
- `UNIQUE (tenant_id, command_id)`；
- `UNIQUE (binding_id, to_version)`；
- index `(tenant_id, binding_id, to_version)`；
- Binding 复合唯一键 `UNIQUE (tenant_id, id)`；
- 原／replacement Binding 复合 FK；
- `ON UPDATE NO ACTION／ON DELETE NO ACTION`；
- replacement identity 不得等于原 identity；
- positive version、严格 `+1`、transition、time、provenance Shape CHECK；
- evidence UPDATE／DELETE／TRUNCATE 拒绝 trigger；
- Binding current identity／tuple／assignment provenance 不可变 trigger；
- Binding current DELETE／TRUNCATE 拒绝 trigger；
- Runtime role 对 evidence 仅 `SELECT／INSERT`。

## 7. Transition Shape

| transition | Shape |
|---|---|
| create | 无旧 current → 新 Binding active/version 1 |
| rebind | 旧 active/n → revoked/n+1，同时创建 replacement active/version 1 |
| revoke | active/n → revoked/n+1 |
| expire | 到期 active/n → revoked/n+1 |
| legacy_calibration | 不改 current，只记录 observed baseline |

standalone Binding transition 不得复用 `tenant_membership_transitions`。

## 8. 同事务、锁序与失败边界

```text
Membership current／create identity
→ persisted active Binding
→ transaction-bound active Scope assertion
→ Binding current mutation
→ Binding transition evidence
→ Membership transition evidence（仅父 Membership command涉及时）
```

要求 command replay 在 mutation 前 fail-closed，使用 expected version CAS，affected rows 精确为 1，任一步失败整批回滚，不自动重试。

## 9. Legacy calibration 与高水位

legacy calibration 不得修改 Binding current；source=`legacy_calibration`，actor／occurredAt／scopeRevision=NULL，reason=`legacy_unknown`，to status/version 记录 observed current，且不处理 historical orphan。

## 10. 未来串行切片

```text
本前置预检
→ Expand DDL Schema／Migration
→ local_acceptance 受控执行与独立审查
→ Access Control standalone Binding lifecycle／evidence Runtime
→ Membership side-effect evidence 原子接线
→ 旧入口委托或禁用＋AQ008 扩展
→ deterministic legacy calibration DML Migration
→ high-water catch-up／Owner Writer／冲突清零
→ BASE-B2 独立审查
→ BASE-B2 handoff
```

## 11. 当前禁止范围

本预检未执行或授权：

- Schema／Migration／journal／snapshot 修改；
- Migration Lease 或编号；
- DDL／DML／Migration／Seed；
- Binding Runtime／calibration；
- historical orphan 处置；
- FK VALIDATE；
- BASE-B3～B6；
- 项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

```text
base_b2_complete=false
eligible_for_base_b3=false
eligible_for_binding_schema_migration_implementation=false
```

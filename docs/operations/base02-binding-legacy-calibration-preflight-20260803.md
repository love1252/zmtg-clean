# BASE-02 deterministic legacy Binding calibration DML Migration 前置预检

> 状态：`current static preflight`
>
> 日期：`2026-08-03`
>
> 审计 Base：`1cf3c715b735fe7e82c1c731bdf6798da7a743fd`

## 1. 结论

```text
base02_binding_legacy_calibration_preflight=passed
current_journal_entries=45
current_latest_migration=0044_base02_binding_transition_expand
candidate_next_idx_if_no_drift=0045
migration_number_reserved=false
binding_current_mutation_allowed=false
binding_transition_insert_only=true
scope_revision_for_legacy_calibration=NULL
historical_orphan_modification_allowed=false
scope_fk_validation_allowed=false
implementation_allowlist_files=3
database_connection=false
dml_execution=false
eligible_for_binding_legacy_calibration_implementation=true
eligible_for_binding_legacy_calibration_execution=false
legacy_binding_calibration_complete=false
base_b2_complete=false
eligible_for_base_b3=false
```

## 2. 静态基线

- journal：45 项，latest idx／tag 为 `44／0044_base02_binding_transition_expand`；
- 当前无 `0045_*`；`0045` 只是无漂移候选编号，不构成预留；
- 0044 SQL SHA-256：`ff472b70d8cd238782682f8ba30c78d703b2a844bc149c2496e5b47bbb1d2085`；
- transition evidence 表、唯一约束、Shape 约束与 immutable trigger 已存在；
- Runtime Writer 与 AQ008 Binding Owner gate 已完成；
- 本预检未连接数据库，不猜测实时候选数、journal hash 或 orphan 数。

## 3. 唯一业务 DML

```text
INSERT INTO public.auth_account_institution_binding_transitions
```

禁止修改 Binding current、Membership、Scope、Context、historical orphan；禁止 FK `VALIDATE`。

## 4. Candidate eligibility

候选必须满足：

1. Binding current Shape 合法，status 为 active／revoked，version 为正整数；
2. canonical Membership 通过 tenantId＋accountId 唯一匹配，envelope 完整且 revision 为正整数；
3. 该 Binding 尚无任何 transition evidence；
4. 派生 id／commandId、`(bindingId,toVersion)` 均无冲突；
5. 锁定后 candidate set 与高水位稳定；
6. candidate count 必须大于 0。

任何 missing、duplicate、partial、Shape drift、identity collision、Catalog drift 均硬停止。

## 5. Evidence 映射

```text
transitionType=legacy_calibration
tenantId=current.tenantId
bindingId=current.id
replacementBindingId=NULL
provenanceSource=legacy_calibration
assignmentSource=current.source
actorId=NULL
reasonCode=legacy_unknown
fromStatus=NULL
toStatus=current.status
fromVersion=NULL
toVersion=current.version
membershipRevision=canonicalMembership.revision
scopeRevision=NULL
occurredAt=NULL
recordedAt=single calibration_recorded_at
```

Scope orphan 不影响 eligibility；不得创建 Scope，不得伪造 scope revision。

## 6. 稳定 identity

```text
command_domain=zmtg:binding-calibration-command:v1
transition_domain=zmtg:binding-calibration-transition:v1

commandId =
  bcal1_ + sha256(command_domain || NUL || tenantId || NUL || bindingId).hex

evidenceId =
  btcl1_ + sha256(transition_domain || NUL || tenantId || NUL || bindingId).hex
```

固定 synthetic vector：

```text
tenant=tenant_synthetic_binding_calibration
binding=binding_synthetic_calibration
command=bcal1_605c8338a671fb4661977e19693bca6a52e497116bdedffd53073036f0967300
evidence=btcl1_9a70c0740aa1cbe5bf6caa5e5b9416aff688d0392177af5fe98a6659261c884c
```

实现必须在 SQL 内重算 vector，并在锁和 DML 前 fail-closed。

## 7. 锁、高水位与计数

锁序：

```text
tenant_members SHARE
→ auth_account_institution_bindings SHARE
→ auth_account_institution_binding_transitions SHARE ROW EXCLUSIVE
→ institution_scopes SHARE
```

候选按 `created_at ASC, id COLLATE "C" ASC` 排序并冻结高水位。

必须满足：

```text
planned=inserted=created
reused=conflict=unexpected=0
postEvidence=preEvidence+created
Binding current fingerprint unchanged
Membership fingerprint unchanged
Scope／Context counts unchanged
historical orphan counts unchanged
business UPDATE／DELETE／TRUNCATE=0
```

任一失败整批回滚。

## 8. 实施范围

实时分配 Migration idx；当前无漂移时才可使用 0045。只允许：

1. `drizzle/<live_idx>_base02_binding_legacy_calibration.sql`
2. `drizzle/meta/_journal.json`
3. `src/server/db/tests/Schema.test.ts`

不修改 schema.ts、Runtime、snapshot、package、lock 或 guard CLI；不运行 db:generate。

## 9. 执行分层

实施 PR 不连接数据库、不签发 Lease、不执行 Migration。实施合并后仍需独立审查和 handoff。

真实执行另行要求：localhost-only local_acceptance、全新恢复点、隔离恢复、全新短期 Lease、单次 guarded Migration、automatic retry 0、执行证据、独立审查和用户明确授权。

```text
eligible_for_binding_legacy_calibration_implementation=true
eligible_for_binding_legacy_calibration_execution=false
base_b2_complete=false
eligible_for_base_b3=false
```

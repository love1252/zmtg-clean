# BASE-B5 目标 Scope 业务关联确认与跨 tenant 技术阻断审计

> 日期：`2026-08-07`
>
> 前置基线：`ece876044dad0e64af8125e2f657a353423de147`
>
> 低敏只读审计来源 SHA-256：`077f62d6231c7999afdf4b40b5f53e77a6ca9b0977fcc67ce0126da5b2153d5f`
>
> 说明：原始日志、私有路径、tenant／institution 双键、Manifest digest 原值和数据库原始行不进入仓库。

## 1. 业务关联确认

业务负责人已经明确确认：

> 当前 A2-P1 唯一已批准并落库的 Scope，就是此前 BASE-B5 权威依据所指向的目标机构 Scope。

本仓库只记录低敏结论，不记录目标机构与数据库双键的原始映射。

```text
business_scope_linkage_confirmation_received=true
business_scope_linkage_confirmed=true
business_scope_linkage_source=responsible_business_owner_confirmation
target_scope_mapping_source=db_reconstructed_a2_p1_triplet
raw_target_scope_mapping_stored_outside_repository=true
```

## 2. 已验证的 A2-P1 Triplet

前序只读审计确认：

```text
private_approved_manifest_currently_available=false
db_approved_triplet_row_count=1
db_triplet_canonical_digest_match=true
db_triplet_scope_active=true
db_triplet_scope_revision_exact=true
db_triplet_context_version_exact=true
db_triplet_head_revision_exact=true
db_triplet_latest_version_exact=true
db_triplet_migration_provenance_null=true
db_triplet_created_by_matches_approval=true
db_triplet_updated_by_matches_approval=true
```

因此，A2-P1 唯一已落库 Scope／Context Version／Context Head 在技术上自洽；结合本次业务负责人确认，可以把该 Triplet 视为已确认目标 Scope 的低敏技术映射来源。

## 3. live readonly reprobe 阻断事实

同一只读审计同时得到：

```text
active_orphan_target_tenant_match_count=0
target_membership_parent_count=0
active_binding_same_account_target_tenant_count=0
```

这三项事实表示：

1. 当前 historical orphan 的 tenant 与目标 Scope 所在 tenant 不一致；
2. 当前账号在目标 tenant 中没有 Membership 父事实；
3. 当前账号在目标 tenant 中没有 active Binding。

因此，业务目标虽然已经唯一确认，但当前任务不是普通的同 tenant institution rebind，而是涉及跨 tenant Membership 与 Binding 生命周期的处置。

## 4. 当前 Schema／transition 约束

当前 `0044_base02_binding_transition_expand` 对原 Binding 和 replacement Binding 均使用同一个 `tenant_id` 组成外键：

```text
(tenant_id, binding_id)
(tenant_id, replacement_binding_id)
```

两者均引用：

```text
auth_account_institution_bindings(tenant_id, id)
```

所以当前 `rebind` transition 不能直接把一个 tenant 下的 Binding 指向另一 tenant 下的 replacement Binding。

```text
current_rebind_transition_same_tenant_scoped=true
current_rebind_transition_cross_tenant_supported=false
```

## 5. 准入结论

```text
authority_evidence_submitted_count=1
authority_evidence_admitted_count=1
authority_evidence_admitted_branch=B5_DETERMINISTIC_REBIND
base_b5_selected_branch=B5_DETERMINISTIC_REBIND

business_scope_linkage_confirmed=true
live_readonly_reprobe_executed=true
live_readonly_reprobe_result=blocked_cross_tenant_membership_prerequisite

cross_tenant_target=true
target_membership_prerequisite_satisfied=false
same_account_target_tenant_binding_present=false
current_rebind_cross_tenant_supported=false

cross_tenant_prerequisite_preplanning_ready=true
cross_tenant_membership_authority_decision_received=false
cross_tenant_rebind_semantics_admitted=false
base_b5_execution_ready=false

historical_orphan_remediation_authorized=false
database_write_authorized=false
dml_authorized=false
base_b5_complete=false
base02_complete=false
business_reader_release=false
business_capability_release=false
```

`B5_DETERMINISTIC_REBIND` 继续表示业务处置目标，不等于当前技术执行已经可行。正式执行前必须先完成跨 tenant Membership 权威决策和重绑语义准入。

## 6. 下一阶段边界

下一阶段只允许完成决策与设计准入，至少冻结：

1. 是否授权当前账号进入目标 tenant；
2. 目标 tenant Membership 的角色、revision、provenance 和生效时间；
3. 当前 tenant Membership 保留、撤销或迁移策略；
4. 跨 tenant 操作采用两条 transition、独立 transfer correlation，还是新 Schema／Writer 契约；
5. old Binding revoke 与 target Binding create 的事务和结果不确定处理；
6. Writer Owner、Execution Lease、恢复点、审计证据和独立复核；
7. 成功计数与 fail-closed 停止条件。

本轮不连接数据库，不执行 Membership 创建、Binding 创建／撤销、Schema、Migration、DML、Seed、FK VALIDATE、Reader 或业务 Capability 放行。

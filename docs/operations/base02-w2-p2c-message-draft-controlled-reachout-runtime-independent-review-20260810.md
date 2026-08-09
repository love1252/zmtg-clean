# W2-P2C Message Draft / Controlled Reach-out Runtime Independent Review

> 日期：`2026-08-10`
>
> Implementation PR：#1119
>
> Implementation Head：`94b86756b5e1db2515aec2de22082678422ed1d9`
>
> Implementation Merge：`9ee6413b0b302d89cb1eaec9a9209373afb7697f`
>
> 状态：`passed`

## 1. Exact scope

```text
runtime_file_count=17
eighteenth_runtime_file_change=false
governance_exception_change=false
route_change=false
trial_provisioning_change=false
```

Implementation PR 的 17 个文件与 Admission 冻结 P2C exact Runtime allowlist 完全一致。

## 2. Canonical Owner / Legacy blockade

```text
follow_up_message_drafts_canonical_owner=care
tenant_business_direct_insert=0
tenant_business_direct_update=0
legacy_p2c_writer_methods_blocked=6
read_compatibility_retained=true
```

6 个 Institution legacy draft / controlled-reachout direct Writer 全部 fail-closed：

- `createFollowUpMessageDraft`
- `updateFollowUpMessageDraftContent`
- `approveFollowUpMessageDraft`
- `rejectFollowUpMessageDraft`
- `markFollowUpMessageDraftAsSent`
- `updateFollowUpMessageDraftControlledReachOut`

## 3. C1 Draft create

```text
server_side_tenant_institution_attribution=true
task_customer_scope=true
enrollment_stage_scope=true
scoped_task_for_update_before_active_draft_check=true
active_draft_no_schema_concurrency_strategy=true
required_timeline_same_transaction=true
```

Create 先锁定 scoped follow-up task `FOR UPDATE`，再验证 customer / enrollment / stage 并检查 active draft，符合 no-schema Admission 冻结策略。

## 4. C2-C5 lifecycle CAS / timeline

```text
draft_edit_status_cas=true
draft_edit_expected_updated_at_cas=true
approve_expected_updated_at_and_status_cas=true
reject_expected_updated_at_and_status_cas=true
mark_sent_expected_updated_at_and_status_cas=true
required_care_timeline_same_transaction=true
mark_sent_means_manual_record_only=true
```

Timeline source/event idempotency继续沿用现有 source-event unique 语义。

## 5. C3 Approval bundle / Audit

```text
approval_care_writer_transaction_bound=true
delivery_timeline_evidence_transaction_bound=true
audit_repository_transaction_bound=true
audit_owner_changed=false
audit_failure_propagates=true
same_commit_or_rollback=true
```

Audit 仍由 Audit canonical repository 持有；Care orchestration 仅在同一 transaction 中组装 transaction-bound Audit repository。Audit failure 不被吞掉，因此 approval bundle 可整体回滚。

## 6. C6 Controlled Reach-out

```text
messaging_frequency_owner=messaging
care_draft_cas_owner=care
audit_owner=audit
same_existing_wecom_transaction=true
approved_status_guard=true
expected_updated_at_cas=true
expected_metadata_json_cas=true
lock_order_preserved=true
real_send_enabled=false
```

Controlled Reach-out 的 draft CAS 已改接 Care application port，同时仍位于既有 `runWeComReachOutTransaction(...)`，与 Messaging frequency reservation 和 Audit evidence 同 transaction。

## 7. Production caller / architecture boundary

```text
followup_message_draft_service=care_transaction_runner
followup_customer_timeline_service=care_evidence_port
wecom_controlled_reachout_service=care_draft_port_inside_wecom_transaction
institution_direct_import_care_server=false
cross_owner_composition=src/server/orchestration
architecture_incremental_check=passed
```

P2B AQ004 exact exception 未修改。

## 8. Validation

Runtime implementation 已通过：

```text
targeted_tests=76_passed
full_tests=6553_passed
lint=0_errors_4_existing_warnings
typecheck=passed
build=passed
architecture_quality_unit_tests=148_passed
architecture_incremental_check=passed
required_check=passed
```

Independent Review 重新执行：

```text
p2c_targeted_review_tests=passed
architecture_incremental_check=passed
typecheck=passed
static_owner_writer_recompute=passed
exact_17_file_recompute=passed
```

## 9. Boundary

```text
database_connection=false
runtime_change_during_review=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
schema_change=false
route_change=false
reader_release=false
capability_release=false
audit_owner_change=false
trial_provisioning_change=false
real_wecom_send=false
production_change=false
```

## 10. Decision

```text
w2_p2c_runtime_implementation=passed
w2_p2c_runtime_independent_review=passed
w2_p2c_complete_eligible=true
w2_p2c_complete=false_before_handoff
w2_care_complete=false_before_handoff
business_writer_phase_complete=false_before_handoff
```

下一步：`W2-P2C docs-only Handoff`。

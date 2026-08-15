# System SYS-01 local-development phased schema recovery 准入

- 日期：2026-08-15
- 阶段：S23
- 业务线：`system`
- 切片：`SYS_01_AI_USAGE_READONLY`
- 基线：`786acda0d87ddbdbe801ef9fefee0d7ff68218dc`
- 性质：docs-only Admission；local-development PostgreSQL transaction-read-only aggregate audit
- 结论：原地 phased recovery 不安全；唯一推荐方向为受控、数据保留的 side-by-side local-development DB rebuild，并须另行 Admission

## 一、正式结论

```text
STAGE=S23
STREAM=system
SLICE=SYS_01_AI_USAGE_READONLY
TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_PHASED_SCHEMA_RECOVERY_ENTRYPOINT_AND_DATA_PRECONDITION_ADMISSION
COMPLETION_MODE=PHASED_RECOVERY_ADMISSION_COMPLETE_BLOCKED_IN_PLACE
BASELINE=786acda0d87ddbdbe801ef9fefee0d7ff68218dc

SELECTED_SCHEMA_RECOVERY_STRATEGY=controlled_local_dev_rebuild
SELECTED_STRATEGY_REASON=current_11_membership_data_cannot_replay_consumed_single_membership_0041_0043_guards_and_repository_has_no_supported_forward_recovery_mechanism

IN_PLACE_PHASED_RECOVERY_FEASIBLE=false
CONTROLLED_LOCAL_DEV_REBUILD_FEASIBLE=true_as_separately_admitted_data_preserving_direction
FORWARD_RECOVERY_MECHANISM_EXISTS=false

PHASED_RECOVERY_ENTRYPOINT_IMPLEMENTATION_REQUIRED=false
PHASED_ENTRYPOINT_EXACT_ALLOWLIST_FROZEN=false
PHASED_ENTRYPOINT_EXACT_FILE_COUNT=0
PHASED_ENTRYPOINT_EXACT_PRODUCTION_FILE_COUNT=0
PHASED_ENTRYPOINT_EXACT_TEST_FILE_COUNT=0
PHASED_ENTRYPOINT_EXACT_ALLOWLIST=none

SCHEMA_RECOVERY_EXECUTION_READY=false
SYS01_RUNTIME_ADMISSION_READY=false
SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_RUNTIME_IMPLEMENTED=false

PRIMARY_BLOCKING_PREREQUISITE=current_11_membership_local_dev_cannot_replay_consumed_single_membership_0041_0043_chain_and_no_repository_supported_data_preserving_rebuild_mechanism_exists
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_DATABASE_REBUILD_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

S23 的成功标准是恢复策略、数据 checkpoint 和下一授权边界已唯一确定，不是数据库已经可写。当前没有 Migration、Provisioning write、Schema、DDL/DML、Seed、reset/recreate、backup/restore 或 Runtime 授权。

## 二、正式 migrator 与 Drizzle targeted 能力

### 2.1 当前项目入口

`package.json` 的正式入口是 `ZMTG_DB_MIGRATION_TARGET=local pnpm db:migrate`，实际调用 `scripts/db/guarded-migrate.mjs`。local 模式会验证 loopback endpoint、repository journal/SQL 集合与基础运行环境，随后调用 Drizzle 的 `migrate` 命令；它没有 target tag、stop-after 或 exact allowlist 参数。

```text
CURRENT_LOCAL_MIGRATOR_TARGET_SUPPORT=false
CURRENT_LOCAL_MIGRATOR_STOP_AFTER_TAG_SUPPORT=false
CURRENT_LOCAL_MIGRATOR_EXACT_ALLOWLIST_SUPPORT=false
CURRENT_LOCAL_MIGRATOR_ALL_PENDING_ONLY=true
```

### 2.2 当前安装版本源码结论

当前 `drizzle-kit` CLI 的 `migrate` 只接收 config；`drizzle-orm` 的 `MigrationConfig` 只包含 migrations folder 及可选 migrations table/schema。migration reader 会读取指定 folder 中 journal 暴露的全部 migration、原 SQL bytes 与 journal `when`，计算 SQL SHA-256；PostgreSQL dialect 在单个 transaction 内依次执行全部 pending，并由 dialect 写入 `drizzle.__drizzle_migrations`。

```text
DRIZZLE_NATIVE_TARGET_SUPPORTED=false
DRIZZLE_PREFIX_FOLDER_SUPPORTED=true
DRIZZLE_PREFIX_FOLDER_JOURNAL_SAFE=true_with_exact_derived_repository_prefix
DRIZZLE_PREFIX_FOLDER_HASH_SAFE=true_with_exact_original_sql_bytes
DRIZZLE_PREFIX_FOLDER_TRANSACTION_SAFE=true
```

alternate migrations folder 可以作为未来受控实现的底层原语，但不是现成的正式 targeted entrypoint。只有 exact repository prefix journal、原 SQL bytes、原 `created_at`、current-head/target/allowlist precheck 和 postcheck 全部被正式 runner 固定时，才可能保持官方 journal semantics。本 S23 不实现、不生成 prefix folder，也不运行 migrate。

```text
MANUAL_JOURNAL_MUTATION_ALLOWED=false
ADHOC_PSQL_MIGRATION_ALLOWED=false
CONSUMED_MIGRATION_REWRITE_ALLOWED=false
```

## 三、历史 local-acceptance 先例

历史 local-acceptance Stage A 运行 `0038` 时，repository 当时只有 `0000..0038`，`0038` 是唯一 pending migration；`scripts/dev/local-acceptance-db.sh` 使用 `55432` 与普通 all-pending Drizzle migrate。它不是 target/stop-after 技术，也不是当前 `55433` local-development 的可复用恢复机制。

```text
HISTORICAL_TARGETED_MIGRATION_PRECEDENT_EXISTS=false
HISTORICAL_TARGETED_MECHANISM=all_pending_when_0038_was_the_only_pending
HISTORICAL_MECHANISM_REUSABLE_FOR_LOCAL_DEV=false
HISTORICAL_MECHANISM_REASON=55432_local_acceptance_had_one_pending_migration_but_55433_local_development_has_eight_pending_and_different_data_preconditions
```

`docs/dev/local-acceptance-env.md` 与该 shell 只证明历史 acceptance 环境能运行当时全部 pending；它们不能替代当前 target guard、backup/restore proof 或 data checkpoint。

## 四、正式 A2 Provisioning surface

正式 `scripts/db/mig01-a2-provisioning-runner.mjs`、Manifest contract、Context Policy、Execution Lease 与 PostgreSQL adapters 均存在。write adapter 在一个 `SERIALIZABLE` transaction 中只写 Scope、Context Version、Context Head；readonly adapter 使用 read-only transaction。直接 CLI 没有 current local-development 的 approved Manifest、Context Policy、transaction port 与 execution lease，因而 fail-closed。

```text
FORMAL_PROVISIONING_RUNNER_EXISTS=true
FORMAL_PROVISIONING_RUNNER_REUSABLE=true_as_three_table_component_only
FORMAL_PROVISIONING_WRITE_ADAPTER_EXISTS=true
FORMAL_PROVISIONING_READONLY_ADAPTER_EXISTS=true
FORMAL_PROVISIONING_CAN_TARGET_LOCAL_DEV=false
FORMAL_PROVISIONING_REQUIRES_APPROVED_MANIFEST=true
FORMAL_PROVISIONING_REQUIRES_EXECUTION_LEASE=true
FORMAL_PROVISIONING_EXPECTED_OUTPUT_SHAPE=scope_1_context_version_1_context_head_1_binding_unchanged
```

0039 的 exact precondition 是 Scope/Context Version/Context Head/Binding=`1/1/1/1`。现有 Provisioning runner 只能把前三者建立为 `1/1/1`，不会创建 Binding；当前 Binding 为 0，因此 runner 本身不能形成 0039 checkpoint。

```text
PROVISIONING_CHECKPOINT_REQUIRED=true
PROVISIONING_CHECKPOINT_RUNNER=scripts/db/mig01-a2-provisioning-runner.mjs
PROVISIONING_CHECKPOINT_MANIFEST_REQUIREMENT=current_local_development_specific_approved_mig01_a2_v1_manifest
PROVISIONING_CHECKPOINT_LEASE_REQUIREMENT=current_local_development_specific_signed_execution_lease
PROVISIONING_EXPECTED_SCOPE_COUNT=1
PROVISIONING_EXPECTED_CONTEXT_VERSION_COUNT=1
PROVISIONING_EXPECTED_CONTEXT_HEAD_COUNT=1
PROVISIONING_EXPECTED_BINDING_COUNT=0_from_runner_and_1_required_from_separately_admitted_data_fact
PROVISIONING_WRITE_EXECUTION_AUTHORIZED=false
```

本结论只允许未来 rebuild Admission 复用既有三表 component；不得新建第二套 Provisioning，也不得把缺失 Binding 伪造成已满足。

## 五、Approved Manifest availability

Repository 证据只表明历史 `local_acceptance` Manifest 曾在 2026-07-31 使用并保留；没有证据表明当前存在可用于 `local_development`、尚未失效且具有当前 approval provenance 的 Manifest。S23 未读取或输出任何 Manifest body、路径、ID、digest、PII 或 secret。

```text
CURRENT_APPROVED_MANIFEST_AVAILABLE=false
CURRENT_APPROVED_MANIFEST_VALID=false
CURRENT_APPROVED_MANIFEST_LOCAL_DEV_COMPATIBLE=false
MANIFEST_METADATA_REVIEW_INSUFFICIENT=true
```

这里的 `AVAILABLE=false` 精确表示“没有 repository evidence 证明存在 current-applicable local-development Manifest”，不否认历史文件可能仍在 repo 外保留。未来若要执行 Provisioning，必须重新完成 metadata/approval 与 local-development mapping 审查。

## 六、local-development aggregate data audit

连接只使用 `.env.local` 指向的 loopback PostgreSQL `127.0.0.1:55433`。client startup 固定 `default_transaction_read_only=on`，进入 `BEGIN TRANSACTION READ ONLY` 后第一条 SQL 确认 `transaction_read_only=on`；其余均为 aggregate/metadata SELECT，最后显式 ROLLBACK。未输出任何 tenant/user/account/institution ID、email、phone、姓名或 Manifest 内容。

```text
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false

TENANT_COUNT=6
AUTH_USER_COUNT=11
TENANT_MEMBER_COUNT=11
BINDING_COUNT=0
MEMBERSHIP_ACTIVE_COUNT=not_representable_before_0040
MEMBERSHIP_INACTIVE_COUNT=not_representable_before_0040
DISTINCT_MEMBERSHIP_TENANT_COUNT=6
MEMBERSHIP_PARENT_ORPHAN_COUNT=0
MEMBERSHIP_AUTH_USER_ORPHAN_COUNT=0
MEMBERSHIP_DUPLICATE_GROUP_COUNT=0
BINDING_NULL_PAIR_COUNT=0
BINDING_DUPLICATE_PAIR_GROUP_COUNT=0
```

actual `tenant_members` 在 0040 前没有 `lifecycle_status`，因此 active/inactive 不能安全计算为数字；`not_representable_before_0040` 是 schema fact，不是缺失审计。

## 七、逐 migration 适用性

| Migration | 当前 local-development 结论 | 证据 |
|---|---|---|
| `0038_mig_01a1_institution_isolation_expand` | 适用，但未获执行授权 | DDL-only objects 全缺失；journal/object state 一致；不要求新 schema 设计 |
| `0039_mig_01a2_anchor_bridge` | Provisioning 后仍不适用 | exact precondition 要求 `1/1/1/1`；正式 runner 只产生前三表，Binding 仍为 0 |
| `0040_base02_membership_revision_expand` | 仅在 0039 成功终态后适用 | DDL expand 可保留 11 Membership，但 strict predecessor 是 0039 |
| `0041_base02_membership_revision_legacy_calibration` | 不适用 | consumed SQL 冻结要求 Membership=1；current=11；无 multi-row/already-calibrated branch |
| `0042_base02_membership_revision_high_water_catch_up` | 不适用 | strict 要求 0041 journal/data terminal state；不能越过 0041 bootstrap |
| `0043_base02_membership_revision_enforce` | 不适用 | strict 消费 0042，且再次冻结 Membership=1/transition=1/complete=1 |
| `0044_base02_binding_transition_expand` | 不适用 | strict 要求 0043 terminal state |
| `0045_base02_binding_legacy_calibration` | 不适用 | strict 要求 0044 且 Binding candidate >0；current Binding=0 |

```text
M0038_APPLICABLE_TO_CURRENT_LOCAL_DEV=true
M0038_REASON=ddl_only_objects_are_all_missing_and_journal_object_state_is_consistent
M0039_APPLICABLE_AFTER_PROVISIONING=false
M0039_REASON=formal_runner_creates_scope_context_version_context_head_but_not_required_binding
M0040_APPLICABLE_AFTER_0039=true
M0040_REASON=conditional_on_exact_0039_terminal_state_and_preserves_current_membership_rows
M0041_APPLICABLE_TO_CURRENT_LOCAL_DEV=false
M0041_REASON=consumed_historical_guard_requires_exactly_one_membership_but_current_local_dev_has_eleven
M0042_APPLICABLE_TO_CURRENT_LOCAL_DEV=false
M0042_REASON=strictly_depends_on_unreachable_0041_terminal_state
M0043_APPLICABLE_TO_CURRENT_LOCAL_DEV=false
M0043_REASON=strictly_depends_on_0042_and_reasserts_single_membership_calibration
M0044_APPLICABLE_TO_CURRENT_LOCAL_DEV=false
M0044_REASON=strictly_depends_on_unreachable_0043_terminal_state
M0045_APPLICABLE_TO_CURRENT_LOCAL_DEV=false
M0045_REASON=strictly_depends_on_0044_and_requires_positive_binding_candidate_while_current_is_zero
```

### 7.1 0041 核心冲突

```text
M0041_EXPECTED_MEMBERSHIP_COUNT=1
M0041_CURRENT_MEMBERSHIP_COUNT=11
M0041_IS_HISTORICAL_ENVIRONMENT_SPECIFIC=true
M0041_IS_GENERAL_MIGRATION=false
M0041_HAS_SAFE_ALREADY_CALIBRATED_BRANCH=false
M0041_HAS_SAFE_MULTI_ROW_BRANCH=false
M0041_CAN_RUN_WITH_11_MEMBERSHIPS=false
```

不得删除或修改 10 个 Membership、伪造 fixture、reset/seed 数据库或改写 consumed SQL 来通过 0041。

### 7.2 0042–0045 dependency chain

```text
M0042_DEPENDS_ON_M0041_TERMINAL_STATE=true
M0043_DEPENDS_ON_M0042_TERMINAL_STATE=true
M0044_DEPENDS_ON_M0043_TERMINAL_STATE=true
M0045_DEPENDS_ON_M0044_TERMINAL_STATE=true
LEGACY_CALIBRATION_CHAIN_CURRENT_LOCAL_DEV_COMPATIBLE=false
```

## 八、恢复策略比较

### Strategy A：in-place phased recovery

```text
IN_PLACE_PHASED_RECOVERY_FEASIBLE=false
IN_PLACE_PHASED_RECOVERY_BLOCKERS=no_current_target_runner;binding_zero_blocks_0039;0041_and_0043_require_single_membership_but_current_has_eleven
MAX_SAFE_IN_PLACE_PHASE=0038_schema_only_after_future_target_entrypoint_backup_and_restore_proof_but_no_end_to_end_in_place_path
```

即使未来实现了 exact-prefix targeted entrypoint，最多也只能让 0038 成为技术上可执行的独立 schema phase；它不能修复 0039 Binding 缺口，更不能让 11 Membership 合法穿过 0041/0043。只为 0038 冻结 runner 会制造无法继续的半迁移状态，因此本阶段不准入该实现。

### Strategy B：controlled local-development rebuild

```text
CONTROLLED_LOCAL_DEV_REBUILD_FEASIBLE=true_as_separately_admitted_data_preserving_direction
CONTROLLED_LOCAL_DEV_REBUILD_EXISTING_TOOLING=false
CONTROLLED_LOCAL_DEV_REBUILD_DATA_LOSS_RISK=high_until_exact_data_preservation_mapping_and_restore_drill_are_frozen
CONTROLLED_LOCAL_DEV_REBUILD_SEED_REQUIRED=false
CONTROLLED_LOCAL_DEV_REBUILD_RESTORE_REQUIRED=true
```

该方向不是清空、reset 或 fixture seed。它要求保留 original DB，以 repo 外 backup 为 recovery source，在独立 loopback candidate DB 上构建 current schema，再通过 separately admitted data mapping 保留并校验现有 6 Tenant、11 Auth User、11 Membership 与 0 orphan/duplicate facts。当前 repository 没有完成该 workflow 的 tooling，因此方向可行但 execution 未 ready。

### Strategy C：repository-supported forward recovery

```text
FORWARD_RECOVERY_MECHANISM_EXISTS=false
FORWARD_RECOVERY_MECHANISM=none
```

Repository 没有 forward recovery runner、reconciliation workflow、migration resume runner 或 current-state baseline mechanism。现有 guarded migrator、A2 Provisioning runner、BASE-02 transfer 与 Audit historical backfill 都不承担这一职责。

### 唯一选择与排除理由

```text
SELECTED_SCHEMA_RECOVERY_STRATEGY=controlled_local_dev_rebuild
SELECTED_STRATEGY_REASON=only_direction_that_can_preserve_current_multi_membership_data_without_replaying_incompatible_consumed_single_membership_guards
REJECTED_STRATEGY_A_REASON=in_place_chain_is_blocked_by_binding_zero_and_consumed_0041_0043_single_membership_guards
REJECTED_STRATEGY_B_REASON=not_rejected_selected_with_separate_admission_required
REJECTED_STRATEGY_C_REASON=no_repository_supported_forward_recovery_mechanism_exists
```

## 九、未来 checkpoint graph

本图只冻结下一 Admission 必须证明的顺序，不授权执行：

```text
PHASE_1=read_only_original_precheck
CHECKPOINT_1=0037_exact_repository_prefix_plus_6_tenants_11_auth_users_11_memberships_0_bindings_and_zero_orphan_duplicate_facts

PHASE_2=repository_external_backup
CHECKPOINT_2=0600_custom_format_archive_plus_hash_catalog_journal_and_aggregate_count_verification

PHASE_3=isolated_restore_proof
CHECKPOINT_3=separate_loopback_restore_drill_matches_original_journal_catalog_and_aggregate_counts

PHASE_4=side_by_side_candidate_schema_build
CHECKPOINT_4=current_repository_schema_and_official_journal_semantics_by_separately_admitted_mechanism

PHASE_5=data_preserving_import_and_reconciliation
CHECKPOINT_5=preserve_authoritative_6_11_11_facts_without_fixture_seed_and_define_binding_scope_context_mapping_explicitly

PHASE_6=candidate_postcheck
CHECKPOINT_6=journal_schema_data_integrity_tenant_isolation_institution_isolation_and_no_orphan_duplicate_drift

PHASE_7=SYS01_readiness_continuation
CHECKPOINT_7=cohort_audit_data_readiness_and_exact_runtime_allowlist_freeze

PHASE_8=explicit_cutover_or_discard
CHECKPOINT_8=only_after_separate_acceptance_preserve_original_and_require_explicit_decision
```

这条链不会在 migration 后重新开始 S20/S21/S22；通过 candidate postcheck 后直接继续 SYS-01 cohort、tenant/institution isolation、data readiness 与 exact Runtime allowlist。

```text
PHASED_RECOVERY_ENTRYPOINT_IMPLEMENTATION_REQUIRED=false
PHASED_ENTRYPOINT_EXACT_ALLOWLIST_FROZEN=false
PHASED_ENTRYPOINT_EXACT_FILE_COUNT=0
PHASED_ENTRYPOINT_EXACT_PRODUCTION_FILE_COUNT=0
PHASED_ENTRYPOINT_EXACT_TEST_FILE_COUNT=0
PHASED_ENTRYPOINT_EXACT_ALLOWLIST=none
```

未来 rebuild Admission 必须先审计现有工具与 owner，再决定 exact allowlist；S23 不虚构 runner 或 generic migration framework。

## 十、backup、restore 与 unknown outcome

```text
BACKUP_REQUIRED_BEFORE_ANY_SCHEMA_WRITE=true
RESTORE_DRILL_REQUIRED_BEFORE_ANY_SCHEMA_WRITE=true
BACKUP_TARGET=repository_external_0600_custom_format_snapshot_of_exact_127_0_0_1_55433_database
RESTORE_DRILL_TARGET=separate_isolated_loopback_database_never_the_original
BACKUP_VERIFICATION_REQUIREMENTS=archive_readability_sha256_database_identity_journal_catalog_and_low_sensitive_aggregate_counts
OUTCOME_UNKNOWN_RECOVERY_STRATEGY=stop_without_retry_preserve_original_and_candidate_verify_journal_catalog_and_counts_read_only_then_require_explicit_cutover_discard_or_forward_decision
NO_AUTO_RETRY=true
```

S23 不执行 `pg_dump`、restore、create/drop DB 或任何 write。未来 unknown outcome 不得直接 retry，也不得自动 restore 覆盖 original。

## 十一、授权边界与发布状态

```text
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false

MIGRATION_EXECUTION=false
PROVISIONING_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
DDL_EXECUTION=false
DML_EXECUTION=false
SEED_EXECUTION=false
DATABASE_RESET=false
DATABASE_RECREATE=false
BACKUP_EXECUTION=false
RESTORE_EXECUTION=false
RUNTIME_IMPLEMENTATION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
RELEASED_GOVERNED_PAGES=page_workbench,page_system_audit
PAGE_SYSTEM_AI_USAGE=hidden/not_released
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
SYS01_RUNTIME_IMPLEMENTED=false
```

## 十二、验证与正式收口

S23 docs-only 验证结果：

```text
TARGETED_TEST_FILES=11
TARGETED_TESTS=287/287 passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
```

PR number、final Head、merge commit、Required Check 与 post-merge Review debt 属于本文件无法自引用的 GitHub 完成事实，由 S23 最终执行回报在 merge 后记录。

## 十三、下一原子任务

```text
PRIMARY_BLOCKING_PREREQUISITE=current_11_membership_local_dev_cannot_replay_consumed_single_membership_0041_0043_chain_and_no_repository_supported_data_preserving_rebuild_mechanism_exists
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_DATABASE_REBUILD_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

下一任务只允许 fresh Admission：冻结 side-by-side candidate 的 official schema-build mechanism、data-preservation mapping、backup/restore proof、unknown-outcome handling 与 exact implementation/execution boundaries。它不是本 S23 的自动续作，也不构成数据库写入授权。

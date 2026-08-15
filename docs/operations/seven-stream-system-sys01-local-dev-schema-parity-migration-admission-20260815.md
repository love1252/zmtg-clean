# SYS-01 local-development schema parity Migration 准入

> 日期：2026-08-15
> 基线：`68d87b0d32c96966fe0fcf0ba2dc8091689f2bfe`
> 阶段：S22
> 业务线：`system`
> 切片：`SYS_01_AI_USAGE_READONLY`
> 性质：docs-only Migration Admission；不是 Migration execution、数据库写入、Schema、DDL、DML、Seed、Runtime、Staging 或 Production 授权

## 1. 结论

```text
STAGE=S22
TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_SCHEMA_PARITY_MIGRATION_ADMISSION
COMPLETION_MODE=MIGRATION_ADMISSION_COMPLETE_BLOCKED
BASELINE=68d87b0d32c96966fe0fcf0ba2dc8091689f2bfe

LOCAL_DB_JOURNAL_IS_REPOSITORY_PREFIX=true
LOCAL_DB_JOURNAL_INTERNAL_GAP_COUNT=0
LOCAL_DB_JOURNAL_UNKNOWN_ENTRY_COUNT=0
SCHEMA_JOURNAL_CONSISTENT=true
NORMAL_SCHEMA_LAG=true

PENDING_MIGRATION_CHAIN=0038,0039,0040,0041,0042,0043,0044,0045
PENDING_CHAIN_DATA_PRECONDITIONS_SAFE=false
MIGRATION_EXECUTION_ADMISSION_READY=false
EXACT_MIGRATION_CHAIN_FROZEN=false
EXACT_MIGRATION_COUNT=0
EXACT_MIGRATION_CHAIN=not_frozen

PRIMARY_BLOCKING_PREREQUISITE=formal_migrator_all_pending_only_cannot_pause_after_0038_for_required_provisioning_and_current_0039_0045_data_preconditions_mismatch
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_PHASED_SCHEMA_RECOVERY_ENTRYPOINT_AND_DATA_PRECONDITION_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

DB journal 是 repository journal `0000..0037` 的逐项 timestamp + SQL SHA-256 严格前缀；`0038` 的 enum、table 与五个新增列全部缺失，属于正常 schema lag，不是 journal 声称已应用但对象缺失的漂移。

阻断来自 pending chain 的执行形状：正式 local migrator 只支持一次运行全部 pending migration，不能在 `0038` 后暂停；但 `0039` 必须在其执行前已经完成 A2-P1 Provisioning，并要求 Scope／Context Version／Context Head／Binding 精确为 `1/1/1/1`。当前这些表尚不存在、Binding 为 0；后续 `0041` 又要求冻结的 local-acceptance 数据基线 `tenant_members=1`，实际为 11。直接运行正式 migrator 将在同一 transaction 内失败并回滚，不能恢复 schema parity，因此不得准入。

## 2. 只读数据库边界

```text
DATABASE_HOST=127.0.0.1
DATABASE_HOST_LOOPBACK=true
DATABASE_PORT=55433
DATABASE_NAME=zmtg_clean_local_dev
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false
DATABASE_TRANSACTION_END=ROLLBACK
```

所有数据库会话均在 client startup 设置 `default_transaction_read_only=on`、`statement_timeout=15000`、`lock_timeout=2000`；SQL 序列固定为 `BEGIN TRANSACTION READ ONLY`，第一条 SELECT 验证 `transaction_read_only=on`，随后只读取 `pg_catalog`、`information_schema`、migration journal 和 aggregate counts，最后显式 ROLLBACK。未输出业务 ID、用户正文、凭证、连接串或 secret。

一次 catalog 脚本首次传入 array 参数时因 PostgreSQL array literal 编码错误，在只读事务内失败并 ROLLBACK；修正仓库外临时只读脚本后重跑成功。该诊断没有 DDL、DML 或数据库状态变化。

## 3. Repository 与 actual journal

```text
LOCAL_DB_MIGRATION_TABLE=drizzle.__drizzle_migrations
LOCAL_DB_APPLIED_MIGRATION_COUNT=38
LOCAL_DB_APPLIED_MIGRATION_HEAD_INDEX=37
LOCAL_DB_APPLIED_MIGRATION_HEAD_TAG=0037_v08_05b_b3a_real_task_readiness_foundation
LOCAL_DB_APPLIED_MIGRATION_HEAD_TIMESTAMP=1783846800000

REPOSITORY_MIGRATION_COUNT=46
REPOSITORY_MIGRATION_HEAD_INDEX=45
REPOSITORY_MIGRATION_HEAD_TAG=0045_base02_binding_legacy_calibration

LOCAL_DB_JOURNAL_IS_REPOSITORY_PREFIX=true
LOCAL_DB_JOURNAL_INTERNAL_GAP_COUNT=0
LOCAL_DB_JOURNAL_UNKNOWN_ENTRY_COUNT=0
LOCAL_DB_FIRST_MISSING_MIGRATION=0038_mig_01a1_institution_isolation_expand
LOCAL_DB_LAST_PENDING_MIGRATION=0045_base02_binding_legacy_calibration
```

Drizzle `readMigrationFiles()` 对 journal 每项读取同名 SQL，并以完整 SQL bytes 计算 SHA-256；PostgreSQL migrator 以 `folderMillis=entry.when` 判定 pending。actual journal 的 38 行按 `created_at,id` 排序后，每一行的 `created_at` 与 repository `when`、`hash` 与对应 SQL SHA-256 均逐项一致，不能只靠 row count 得出 prefix 结论。

Actual journal table 只有 `id/hash/created_at`，migrator 运行时只读取最新 `created_at`，不会主动验证全部历史 hash 或 internal gap；S22 的逐项 prefix 取证因此必须作为未来 pre-execution gate 重新执行。

## 4. `0038` object shape

```text
M0038_JOURNAL_STATE=pending
M0038_OBJECT_STATE=all_missing
SCHEMA_JOURNAL_CONSISTENT=true
NORMAL_SCHEMA_LAG=true
```

下列四个 enum 全部缺失：

- `institution_scope_status`
- `institution_provisioning_source`
- `institution_operating_context_source`
- `audit_institution_attribution`

下列三个 relation 全部缺失：

- `institution_scopes`
- `institution_operating_context_versions`
- `institution_operating_contexts`

下列五个 nullable expand column 全部缺失：

- `appointments.institution_id`
- `treatment_summaries.institution_id`
- `follow_up_tasks.institution_id`
- `audit_events.institution_id`
- `audit_events.institution_attribution`

其依赖 base table 均存在；aggregate row counts 为 appointments 5、treatment summaries 7、follow-up tasks 4、audit events 252。`0038` 是 DDL-only expand，不做 Provisioning、历史回填、NOT NULL enforce 或数据分类。`NEW_SCHEMA_DESIGN_REQUIRED=false`，`NEW_MIGRATION_FILE_REQUIRED=false`；repository 已有的 `0038` 本身没有发现静态缺陷。

## 5. `0039–0045` actual 状态

```text
M0039_JOURNAL_STATE=pending
M0039_OBJECT_DATA_STATE=objects_missing_and_required_scope_context_binding_1_1_1_1_actual_0_0_0_0

M0040_JOURNAL_STATE=pending
M0040_OBJECT_DATA_STATE=membership_objects_all_missing_and_upstream_a2_p2_terminal_state_absent

M0041_JOURNAL_STATE=pending
M0041_OBJECT_DATA_STATE=predecessor_absent_membership_expected_1_actual_11_binding_scope_context_expected_1_actual_0

M0042_JOURNAL_STATE=pending
M0042_OBJECT_DATA_STATE=predecessor_and_m4_exact_baseline_absent

M0043_JOURNAL_STATE=pending
M0043_OBJECT_DATA_STATE=membership_envelope_and_transition_evidence_absent

M0044_JOURNAL_STATE=pending
M0044_OBJECT_DATA_STATE=binding_transition_objects_all_missing_and_predecessor_catalog_absent

M0045_JOURNAL_STATE=pending
M0045_OBJECT_DATA_STATE=predecessor_absent_and_binding_candidate_count_expected_positive_actual_0
```

Actual aggregate baseline：

| Evidence | Count |
|---|---:|
| tenants | 6 |
| auth_users | 11 |
| tenant_members | 11 |
| auth_account_institution_bindings | 0 |
| tenant member tenant-parent orphan | 0 |
| tenant member auth-user-parent orphan | 0 |
| duplicate tenant/user membership groups | 0 |
| Binding null pair / duplicate pair groups | 0 / 0 |
| post-0040 all-null membership candidates（由当前 11 行推导） | 11 |

`0039` 的 SQL 明确要求执行前已经存在精确一条 active approved Scope、一条 Context Version 1、一条 Context Head 1 与一条 active historical-orphan Binding；`0038` 不写这些数据。当前 Binding 为 0，`0038` 新建的三表也会从 0 行开始，故 `0039` 在普通 all-pending 执行中必然以 `A2_P2_P1_DATA_SHAPE_DRIFT` fail closed。

`0040` 继续要求同一 A2-P2 terminal state，且只做 Membership revision catalog expand；`0041` 是为精确单行 local-acceptance fixture 冻结的 deterministic calibration，当前 11 个 Membership 不符合其 `pre_membership_count=1` gate。`0042` 是 M4 后高水位追赶，`0043` 是最终 NOT NULL/CHECK enforce；两者只能消费已满足 M4 exact baseline 的环境。`0044` 新建 Binding transition evidence catalog，`0045` 只向 evidence table 插入 legacy calibration，且要求候选数大于 0；当前 Binding 为 0。

## 6. Migration 行为分类

| Migration | Type | 关键依赖与 precondition | Data guard | Transaction / rollback | Forward-fix 特征 |
|---|---|---|---|---|---|
| `0038` | DDL | journal head `0037`；base tables 存在；全部目标对象缺失 | 无业务 DML | Drizzle 外层 transaction；失败整批回滚 | 只允许新 forward-fix，不改已消费 SQL；当前不需要 |
| `0039` | DDL | `0038` + A2-P1 精确 provisioned triplet + 1 historical Binding | exact counts、parent/orphan、catalog fingerprint | 同一外层 transaction；新增 index + NOT VALID FK | 不得以重跑替代数据/对象漂移处置 |
| `0040` | DDL | `0039` + A2-P2 terminal state | exact Scope/Context/Binding 与 current catalog | 同一外层 transaction；只 expand，不校准数据 | 已消费后只 forward-fix |
| `0041` | DML | `0040` + exact one-row legacy Membership fixture | deterministic identity、parents、count/fingerprint conservation | UPDATE Membership + INSERT transition；失败回滚 | outcome unknown 时只读核验，不重试 |
| `0042` | DML | `0041` exact state | zero residual 或稳定 high-water residual；identity/collision guard | UPDATE Membership + INSERT transition；失败回滚 | 只允许后续 forward-fix |
| `0043` | DDL | `0042` + all Membership envelopes complete | residual/partial/transition evidence 必须 exact | 收紧 6 列 NOT NULL + current CHECK | 无 down migration；需 restore/forward-fix |
| `0044` | DDL | `0043` + Binding/Membership/Scope catalog exact | duplicate/shape/orphan/trigger dependency guard | 新增 enum/table/constraints/triggers；失败回滚 | 已消费对象漂移只 forward-fix |
| `0045` | DML | `0044` + 至少 1 个合法 Binding candidate | deterministic identity、high-water、membership linkage | 只 INSERT Binding transition evidence；失败回滚 | outcome unknown 时只读核验，不重试 |

`0038–0045` 不是一段同质 DDL：其中 `0041`、`0042`、`0045` 是 DML，`0043` 是 enforce。不得把当前 continuous pending list 等同于 executable exact chain。

## 7. 正式 migration entrypoint

```text
FORMAL_LOCAL_DEV_MIGRATION_ENTRYPOINT=ZMTG_DB_MIGRATION_TARGET=local pnpm db:migrate
FORMAL_MIGRATION_RUNNER=scripts/db/guarded-migrate.mjs
FORMAL_MIGRATOR=drizzle-kit migrate

MIGRATOR_APPLIES_ALL_PENDING=true
MIGRATOR_TARGETED_EXECUTION_SUPPORTED=false
MIGRATOR_AUTO_SEED=false
MIGRATOR_LOCALHOST_GUARD_SAFE=true
MIGRATOR_REPOSITORY_JOURNAL_GUARD=true
MIGRATOR_ACTUAL_DB_PREFIX_PRECHECK=false
MIGRATOR_DATA_PRECHECK=false
MIGRATOR_AUTOMATIC_RETRY=false
MIGRATOR_TRANSACTION_OWNER=drizzle_pg_single_transaction_all_pending
```

Guard 的 local 模式严格只接受 `localhost/127.0.0.1/::1`，核验 repository journal 顺序、tag 唯一性及 SQL 文件集合，并只 spawn 一次 current Node 下的 Drizzle CLI；不会 Seed、启动其他 service 或自动重试。它不支持 target migration，也不要求 local caller 声明 expected current/target/allowlist；actual DB prefix 与 data guards 只能由未来独立 precheck 提供。

`scripts/dev/local-acceptance-db.sh` 不是本目标入口：它面向另一个 `127.0.0.1:55432` acceptance container，并可创建 container。S22 没有调用它，也不能把 `psql -f 0038.sql`、临时 journal、裸 Drizzle 或第二执行器当成默认恢复方案。

## 8. 为什么不能冻结 exact execution

```text
REPOSITORY_PENDING_MIGRATION_CHAIN_CONTINUOUS=true
PENDING_MIGRATION_CHAIN=0038,0039,0040,0041,0042,0043,0044,0045
PENDING_CHAIN_DATA_PRECONDITIONS_SAFE=false

MIGRATION_EXECUTION_ADMISSION_READY=false
EXACT_MIGRATION_CHAIN_FROZEN=false
EXACT_MIGRATION_COUNT=0
EXACT_MIGRATION_CHAIN=not_frozen

EXPECTED_PRE_MIGRATION_HEAD=0037_v08_05b_b3a_real_task_readiness_foundation
EXPECTED_POST_MIGRATION_HEAD=not_frozen
```

`0038` 单独具有清晰的 all-missing entry state，但正式 migrator 不支持只执行 `0038`；一次执行全部 pending 会在 `0039` 前没有 Provisioning checkpoint。即使未来提供 checkpoint，当前 11/0 的 Membership/Binding 数据也不满足为历史单行 acceptance fixture 冻结的 `0041–0045` preconditions。S22 不通过 ad-hoc SQL、伪造 journal、Seed、重建数据库或更换目标来规避这些事实。

## 9. Backup、recovery 与未来验证

```text
PRE_MIGRATION_BACKUP_REQUIRED=true
PRE_MIGRATION_BACKUP_EXISTS=false
PRE_MIGRATION_RESTORE_POINT_VERIFIED=false
PRE_MIGRATION_RESTORE_DRILL_REQUIRED=true

PRE_EXECUTION_REQUIRED_CHECKS=not_frozen_due_to_blocked_admission
POST_EXECUTION_REQUIRED_CHECKS=not_frozen_due_to_blocked_admission
ROLLBACK_STRATEGY=transaction_failure_rolls_back;committed_or_outcome_unknown_requires_verified_restore_or_separate_forward_fix
FORWARD_FIX_STRATEGY=never_modify_consumed_migration;fresh_separate_admission_required
```

既有 Docker volume 是 live database storage，不是 backup。S22 没有当前目标适用的 backup/restore-point 验证证据，也没有运行 `pg_dump` 或 restore。任何未来包含 DML/enforce 的执行都必须先建立新恢复点并完成隔离 restore drill；失败或 outcome unknown 时禁止自动重试。

一旦 phased recovery entrypoint 与各 checkpoint 数据 prerequisite 被独立准入，未来同一 execution stage 应连续完成：precheck → exact existing migration execution → journal/schema postcheck → SYS-01 aggregate cohort audit → tenant/institution pair verification → data-readiness verdict → exact Runtime allowlist freeze。当前不得预写 S23 或执行上述动作。

## 10. Validation

```text
TARGETED_TEST_FILES=4
TARGETED_TESTS=122/122 passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
```

Targeted 只运行 static/unit tests：`MigrationGuard.test.ts`、`Schema.test.ts`、`mig01-a2-provisioning-runner.test.mjs` 与 `ProductionReadinessDocs.test.ts`。没有运行任何会连接数据库、执行 Migration、reset、seed、truncate 或写数据库的 test/command。

## 11. 边界与下一任务

```text
S22_ADMISSION_AUDIT=passed
S22_COMPLETE=true

SYS01_RUNTIME_ADMISSION_READY=false
SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_RUNTIME_IMPLEMENTED=false

DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false
SEED_EXECUTION=false
RUNTIME_IMPLEMENTATION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0

PRIMARY_BLOCKING_PREREQUISITE=formal_migrator_all_pending_only_cannot_pause_after_0038_for_required_provisioning_and_current_0039_0045_data_preconditions_mismatch
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_PHASED_SCHEMA_RECOVERY_ENTRYPOINT_AND_DATA_PRECONDITION_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

本报告不授权 phased recovery、Migration execution、Provisioning write、backup/restore、Schema、forward-fix 或 Runtime。

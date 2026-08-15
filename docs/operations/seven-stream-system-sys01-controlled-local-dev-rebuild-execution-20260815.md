# System SYS-01 controlled local-development rebuild execution 闭环

- 日期：2026-08-15
- 阶段：S34
- 流：`system`
- 切片：`SYS_01_AI_USAGE_READONLY`
- 初始基线：`2c9c6fdf209c9e5598d8ddea35922ad8ed6e01e1`
- 最终 execution Head：`cf0be4480020dcc4e22e086cb1ba11e924cc78c9`
- 性质：local-development controlled rebuild execution + docs-only formal closure
- 结论：十个 phase 全部成功，活动本地数据库已显式切换到 candidate；original、restore drill、candidate 与加密备份均保留

## 一、执行结论

```text
STAGE=S34
TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION
COMPLETION_MODE=CONTROLLED_REBUILD_EXECUTION_COMPLETE
INITIAL_MAIN=2c9c6fdf209c9e5598d8ddea35922ad8ed6e01e1
S34_EXECUTION_HEAD=cf0be4480020dcc4e22e086cb1ba11e924cc78c9

S34_CORRECTIVE_RUNTIME_PR=1240
S34_CORRECTIVE_RUNTIME_HEAD=5a6621c9a0b8c3597c8018c96e53469a4e4fa078
S34_CORRECTIVE_RUNTIME_MERGE=cf0be4480020dcc4e22e086cb1ba11e924cc78c9
S34_CORRECTIVE_REQUIRED_CHECK=passed
S34_CORRECTIVE_ACTIONABLE_P0_P1_P2_P3=0
S34_CORRECTIVE_POST_MERGE_REVIEW_DEBT=0
S34_DOCS_PR=1241
S34_DOCS_INITIAL_HEAD=ec91fea2d83ea637b88171656ea261c75a5624f5
S34_DOCS_REQUIRED_CHECK=passed
S34_ACTIONABLE_P0_P1_P2_P3=0
S34_POST_MERGE_REVIEW_DEBT=0

PREFLIGHT_STATUS=succeeded
BACKUP_STATUS=succeeded
RESTORE_DRILL_STATUS=succeeded
CANDIDATE_CREATE_STATUS=succeeded
BASELINE_BOOTSTRAP_STATUS=succeeded
TRANSFER_STATUS=succeeded
VALIDATE_STATUS=succeeded
ROLLBACK_READINESS_STATUS=succeeded
CUTOVER_READINESS_STATUS=succeeded
POST_CUTOVER_VERIFY_STATUS=succeeded

EXECUTION_MANIFEST_STATE=POST_CUTOVER_VERIFIED
EXECUTION_OUTCOME_UNKNOWN=false
ACTIVE_LOCAL_DATABASE=candidate
LOCAL_ENV_CUTOVER=true
POST_CUTOVER_VERIFIED=true

ORIGINAL_MUTATION_COUNT=0
ORIGINAL_RETAINED=true
RESTORE_DRILL_RETAINED=true
CANDIDATE_RETAINED=true
ENCRYPTED_BACKUP_RETAINED=true
ORIGINAL_DATABASE_DISPOSAL=false

S34_COMPLETE=true
S34_FORMAL_CLOSURE=true
```

S34 只操作用户授权的 local-development resources。original `127.0.0.1:55433` 始终由 read-only transaction、before/after fingerprint 与 runner invariant 保护且没有写入；业务数据写入仅发生在隔离的 restore drill 与 candidate。没有执行 repository migration、`drizzle-kit migrate`、`db:generate`、snapshot generation、seed、Staging 或 Production 变更。

## 二、首次停止与 corrective closure

初始 Head `2c9c6fdf...` 的首次运行在 `restore-drill` 发现 PostgreSQL catalog deparse 的双重等价 cast：`character varying::text` 被旧 canonicalizer 错判为 schema drift。runner 按 contract 写入 `OUTCOME_UNKNOWN_RESTORE_DRILL` 并停止；没有自动 retry，旧 manifest 与 encrypted backup 保留。

用户重新准入 exact 3-file Runtime。PR #1240 仅修复 cast-chain canonicalization：只有每一层都与已知列类型等价时才消除；`integer::text` 等异质链继续保持差异并 fail-closed。PR 的 Required Check、review 与 post-merge sweep 全部通过；baseline SQL、schema fingerprint、numbered migration 与业务 Runtime 均未改变。

```text
FIRST_ATTEMPT_HEAD=2c9c6fdf209c9e5598d8ddea35922ad8ed6e01e1
FIRST_ATTEMPT_PREFLIGHT_STATUS=succeeded
FIRST_ATTEMPT_BACKUP_STATUS=succeeded
FIRST_ATTEMPT_RESTORE_DRILL_STATUS=OUTCOME_UNKNOWN_RESTORE_DRILL
FIRST_ATTEMPT_NO_AUTO_RETRY=true
FIRST_ATTEMPT_MANIFEST_RETAINED=true
FIRST_ATTEMPT_ENCRYPTED_BACKUP_RETAINED=true
FIRST_ATTEMPT_RESTORE_CONTAINER_DELETED_AFTER_CORRECTIVE_MERGE=true
FIRST_ATTEMPT_RESTORE_VOLUME_DELETED_AFTER_CORRECTIVE_MERGE=true

CORRECTIVE_EXACT_RUNTIME_FILE_COUNT=3
CORRECTIVE_BASELINE_SQL_CHANGED=false
CORRECTIVE_SCHEMA_FINGERPRINT_CHANGED=false
CORRECTIVE_NEW_MIGRATION=false
```

corrective merge 后，旧 restore-drill container/volume 先经 exact identity 核验再按用户授权删除；旧 manifest/backup 未删除。随后在新冻结 Head 与新的 repo-external private manifest 下从 `preflight` fresh restart，没有复用旧 manifest 或跳过 phase。

## 三、phase receipt chain

| Phase | 状态转换 | Status | Receipt digest |
|---|---|---|---|
| `preflight` | `INITIAL → PREFLIGHT_PASSED` | `succeeded` | `9c71c667c5320ad555e6d482655b51fc7754bfaaddf817515f7382cff9f2fd14` |
| `backup` | `PREFLIGHT_PASSED → BACKUP_VERIFIED` | `succeeded` | `85ea1d147bbddf43bc3b3a0a3b9666d343acb864a2bf61ffd535633fe9a002be` |
| `restore-drill` | `BACKUP_VERIFIED → RESTORE_DRILL_VERIFIED` | `succeeded` | `729cb805def9f6c39eb1cb6dded67f268880f804439254a7bee7a123e1e8d2a6` |
| `candidate-create` | `RESTORE_DRILL_VERIFIED → CANDIDATE_EMPTY_VERIFIED` | `succeeded` | `3e05bfde1d72b8abbfc939be4330367b6d867733f40845b3047fda2b411a6eda` |
| `baseline-bootstrap` | `CANDIDATE_EMPTY_VERIFIED → BASELINE_VERIFIED` | `succeeded` | `b7139cd0fb0e68c0a79344c2da5e5ea5622cc69fcf4295f5b3f169cf32b50396` |
| `transfer` | `BASELINE_VERIFIED → TRANSFER_COMPLETED` | `succeeded` | `2242988c883d6fc0bef1014675723d2fbcf936817c7c06d6f95e80b99ba62493` |
| `validate` | `TRANSFER_COMPLETED → VALIDATED` | `succeeded` | `b9ebb65ac4d0c82fbeb18f438bdb56d440695af34072163486e52171f1770691` |
| `rollback-readiness` | `VALIDATED → ROLLBACK_READY` | `succeeded` | `f00dd5754e3ad082b890e04fc55938c8a3de5f1ef122ad614e2df88c288dd337` |
| `cutover-readiness` | `ROLLBACK_READY → CUTOVER_READY` | `succeeded` | `022a9ada2370d6c5c51f4f74b4868390dd0d830146185c421f7f0ef170686a40` |
| `post-cutover-verify` | `CUTOVER_READY → POST_CUTOVER_VERIFIED` | `succeeded` | `1c554ccecdb03960cfa5eca1381d75a244d75286f85e2107d05e9254e3d62b3d` |

receipt chain 绑定 exact implementation Head、baseline manifest、previous receipt 与 phase state；没有 `--phase all`，没有旁路 destructive adapter，也没有在失败后复跑首次 manifest。

## 四、backup、catalog 与 aggregate evidence

```text
POSTGRES_VERSION=16.14
BACKUP_CIPHERTEXT_SHA256=f80bed9b87d4e8a99b0ef6955fae93e29d646dfb6012c17ba45b09e86c0e5ef0
BACKUP_CIPHERTEXT_BYTES=290035
BACKUP_PLAINTEXT_RESIDUAL=false
BACKUP_ARCHIVE_TABLE_SET_VERIFIED=true
BACKUP_SECRET_OPAQUE_EQUALITY_VERIFIED=true

SOURCE_SCHEMA_FINGERPRINT=3e58d6d2e3e59af776fc81983cd9edd20b26ae9c3e0c59d50545c64594bc2379
CANDIDATE_SCHEMA_FINGERPRINT=4b93f1ce180ee48c12ded517a087fb3f6d73e7e28ff3be85f883de1d321dfb8c
SOURCE_AGGREGATE_FINGERPRINT=ee875486fe9d0c21127dcd4fe16ac9c7c9867a1df4fd178b4b257953e10edcce
CANDIDATE_AGGREGATE_FINGERPRINT=e9945f739627caf69d484b50899534b55058a3dd1b43b6b2b13c0c3d17f3370c
NULL_SHAPE_FINGERPRINT=b20506efa076efd2c17aced2b9f20a2fdf38c0ea7657193e892856ce57395630

BASELINE_MARKER_ROW_COUNT=1
BASELINE_MARKER_CREATED_AT=1785738060856
FAKE_HISTORY_ROW_COUNT=0
PRIMARY_KEYS_VERIFIED=true
FOREIGN_KEYS_VERIFIED=true
CONSTRAINTS_VERIFIED=true
ROW_COUNTS_VERIFIED=true
BUSINESS_AGGREGATES_VERIFIED=true
MAPPED_ROWS_VERIFIED=true
NULL_SHAPE_VERIFIED=true
SPECIAL_MAPPINGS_VERIFIED=true
EXCLUDED_TARGETS_EMPTY=true
ORIGINAL_UNCHANGED=true
```

Fresh source inventory 共 56 个受管表条目、逐表合计 371 rows。关键 low-sensitive counts：`tenants=6`、`auth_users=11`、`tenant_members=11`、`customers=9`、`appointments=5`、`treatment_summaries=7`、`follow_up_tasks=4`、`audit_events=252`、`tenant_authorization_snapshots=6`、`tenant_commercial_records=4`、`tenant_plan_assignments=6`、`tenant_plan_versions=3`、`tenant_plans=3`、`tenant_quota_snapshots=6`、`drizzle.__drizzle_migrations=38`；其余 41 个 source inventory tables 均为 0。文档没有记录 row ID、业务正文、PII、数据库凭证、完整 URL、key path/value/hash。

## 五、cutover 与 rollback evidence

source quiescence 在 `cutover-readiness` 前由 listener、local writer process 与 original connection aggregate fresh 验证；确认变量只在实际证据成立后设置。candidate-bound readiness 与 `/api/version` build smoke 均绑定 `cf0be448...`。runner 不自动 cutover；`.env.local` 的唯一 `DATABASE_URL` assignment 由外部显式动作从 original 切至 candidate，其他 secret 未改。

```text
SOURCE_QUIESCENCE_VERIFIED=true
ACTIVE_TARGET_BEFORE_CUTOVER=original
PRE_CUTOVER_READINESS_EVIDENCE_VERIFIED=true
PRE_CUTOVER_APPLICATION_SMOKE_VERIFIED=true
ROLLBACK_PRECHECK_VERIFIED=true
AUTOMATIC_CUTOVER_PERFORMED=false
EXTERNAL_CUTOVER_RECEIPT_SHA256=624d479ed1ec22561fc094b333793e4e1cb6e261d1e09cd935115ed079e299ae

ACTIVE_TARGET_AFTER_CUTOVER=candidate
POST_CUTOVER_READINESS_EVIDENCE_VERIFIED=true
POST_CUTOVER_APPLICATION_SMOKE_VERIFIED=true
POST_CUTOVER_SCHEMA_FINGERPRINT_VERIFIED=true
ORIGINAL_RETAINED=true
REVERSIBLE=true
```

`env.local.before-cutover`、execution manifest 与 encrypted backup 均在 owner-only repo-external private storage；本报告不披露其路径或内容。original、candidate 与本次成功 restore drill 暂不 cleanup。

## 六、回归与边界

```text
S34_RUNNER_TESTS=1_file_31_tests_passed
S34_DB_GOVERNANCE_TARGETED_TESTS=4_files_138_tests_passed
S34_TYPECHECK=passed
S34_ARCHITECTURE_QUALITY_TESTS=148_tests_passed
S34_FULL_TESTS=502_files_6976_tests_passed
S34_DIFF_CHECK=passed

ORIGINAL_55433_DATABASE_WRITE=false
REPOSITORY_MIGRATION_EXECUTION=false
NEW_NUMBERED_MIGRATION=false
DB_GENERATE_EXECUTION=false
SNAPSHOT_GENERATION=false
SEED_EXECUTION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
PAGE_RELEASE=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

S34 只证明本地 controlled rebuild 与 cutover 闭合，不自动证明 SYS-01 formal Scope/Context/Binding 或任何业务 Runtime ready。下一阶段必须在 active candidate 上重新做 transaction-read-only aggregate/catalog audit；不得从 membership/customer/default institution 推造 formal facts。

```text
NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_POST_REBUILD_DATA_AND_RUNTIME_READMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S34_merge
NEXT_CARE_TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_SYSTEM_REBUILD
NEXT_CARE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S35_merge
NEXT_STAGE=S35
NEXT_STAGE_AUTO_EXECUTION=false
```

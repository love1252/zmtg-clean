# System SYS-01 controlled local-development rebuild execution 重新准入

- 日期：2026-08-15
- 阶段：S32
- 流：`system`
- 切片：`SYS_01_AI_USAGE_READONLY`
- 基线：`fc3353d34e77d3704fccc70546735db84a671a24`
- 性质：docs-only + fresh repository verification + original `55433` transaction-read-only audit + repo-external key metadata verification
- 结论：execution Admission ready；本阶段没有执行 rebuild

## 一、重新准入结论

```text
STAGE=S32
TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION_READMISSION
COMPLETION_MODE=REBUILD_EXECUTION_ADMISSION_READY
BASELINE=fc3353d34e77d3704fccc70546735db84a671a24

S30_DOCS_PR=1228
S30_DOCS_HEAD=d4d441fc6af3037b4254791c04811c70c1fb7f34
S30_DOCS_MERGE=90de22e81769c313810d27cb7ad96f7260e3a805
S31_RUNTIME_PR=1229
S31_RUNTIME_HEAD=ea3639fc8ac55c900a6bbdd2d041f1280ea29870
S31_RUNTIME_MERGE=fc3353d34e77d3704fccc70546735db84a671a24
S31_REQUIRED_CHECKS=passed
S31_ACTIONABLE_P0_P1_P2_P3=0
S31_POST_MERGE_REVIEW_DEBT=0
S31_COMPLETE=true
S31_FORMAL_CLOSURE=true

SYSTEM_PREREQUISITE_IMPLEMENTED=true
SYSTEM_PREREQUISITE_EXACT_FILE_COUNT=3
SYSTEM_PREREQUISITE_EXACT_ALLOWLIST=scripts/db/sys01-controlled-local-dev-rebuild.mjs,scripts/db/sys01-controlled-local-dev-rebuild.test.mjs,drizzle/baselines/sys01-local-dev-current-schema-0045-v1.json
DETERMINISTIC_READINESS_ISSUER_IMPLEMENTED=true
DETERMINISTIC_APPLICATION_SMOKE_ISSUER_IMPLEMENTED=true
BACKUP_KEY_PREFLIGHT_IMPLEMENTED=true
LOW_LEVEL_ADAPTER_TEST_COVERAGE_SUFFICIENT=true

SEMANTIC_SOURCE_DRIFT_COUNT=0
REBUILD_EXECUTION_ADMISSION_READY=true
FORMAL_REBUILD_EXECUTION=false
```

S30 最初冻结的 exact 2-file scope 未覆盖 manifest 绑定的 runner Git blob。S31 按后续 corrective authorization 使用 exact 3-file scope，只更新 baseline manifest 中 runner tooling identity；baseline SQL、artifact SHA、schema fingerprint 与 catalog contract 均未改变。

## 二、S31 prerequisite formal closure

S31 在现有 runner 内闭合四类 deterministic evidence：pre/post-cutover readiness 与 pre/post-cutover application smoke。证据由 repository-owned issuer fresh 生成，绑定 candidate/active-candidate identity、exact implementation Head、baseline manifest、phase state 与 previous receipt；调用方不能传入任意 SHA 代替 probe。

六类 low-level adapter 均通过 concrete fake dependency seam 行为测试：backup、restore、candidate-create、baseline-bootstrap、transfer 与 validate。覆盖 encrypted-only、`pg_restore --list`、exact container identity、transaction failure、single-snapshot transfer、required-column/count/catalog mismatch、secret redaction、no-original-write、timeout、unknown outcome 与 no-auto-retry。

```text
PRE_CUTOVER_READINESS_EVIDENCE_ISSUER_READY=true
PRE_CUTOVER_APPLICATION_SMOKE_EVIDENCE_ISSUER_READY=true
POST_CUTOVER_READINESS_EVIDENCE_ISSUER_READY=true
POST_CUTOVER_APPLICATION_SMOKE_EVIDENCE_ISSUER_READY=true

ARBITRARY_RECEIPT_SHA_INPUT_ACCEPTED=false
LOW_LEVEL_ADAPTER_IMPLEMENTATION_COUNT=6
LOW_LEVEL_ADAPTER_TEST_GAP_COUNT=0
LOW_LEVEL_ADAPTER_TEST_COVERAGE_SUFFICIENT=true
RUNNER_BLOB_MATCHES_BASELINE_MANIFEST=true
MIGRATION_GUARD_BLOB_MATCHES_BASELINE_MANIFEST=true

S31_RUNNER_TESTS=1_file_31_tests_passed
S31_RUNNER_AND_MIGRATION_GUARD_TESTS=2_files_85_tests_passed
S31_ARCHITECTURE_QUALITY_TESTS=148_tests_passed
S31_PRODUCTION_READINESS_DOCS_TESTS=8_tests_passed
S31_FULL_TESTS=502_files_6974_tests_passed
S31_TYPECHECK=passed
S31_LINT=passed_with_0_errors_4_pre_existing_img_warnings
S31_BUILD=passed
S31_ARCHITECTURE_INCREMENTAL=passed
S31_DIFF_CHECK=passed
```

## 三、original `55433` fresh read-only audit

连接 URL 只从本地 secret source 取得；先拒绝非 exact loopback/port，再由 client startup 强制 `default_transaction_read_only=on`。事务第一条 SELECT 确认 `transaction_read_only=on`，随后只运行 catalog 与逐表 aggregate count SELECT，最后以 sentinel 显式触发 ROLLBACK。未输出 username、password、完整 URL、业务 ID、PII 或正文。

```text
ORIGINAL_DATABASE_IDENTITY=127.0.0.1:55433
CLIENT_STARTUP_DEFAULT_TRANSACTION_READ_ONLY=on
TRANSACTION=BEGIN_TRANSACTION_READ_ONLY_REPEATABLE_READ
FIRST_SELECT_TRANSACTION_READ_ONLY=on
QUERY_CLASS=aggregate_and_catalog_select_only
TRANSACTION_END=ROLLBACK

SOURCE_PUBLIC_TABLE_COUNT=55
SOURCE_INVENTORY_TABLE_COUNT=56
SOURCE_TENANT_COUNT=6
SOURCE_AUTH_USER_COUNT=11
SOURCE_TENANT_MEMBER_COUNT=11
SOURCE_CUSTOMER_COUNT=9
SOURCE_BINDING_COUNT=0
SOURCE_AUDIT_COUNT=252
SOURCE_AI_USAGE_COUNT=0

TABLE_SET_MATCHES_S24_MAPPING=true
MISSING_TABLE_COUNT=0
UNEXPECTED_TABLE_COUNT=0
SEMANTIC_SOURCE_DRIFT_COUNT=0
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_ON_ORIGINAL_55433=false
```

比较覆盖全部 56-table inventory 与 S24 冻结的逐表 row-count contract。source 仍为 legacy origin；本结论只证明 execution source contract 未漂移，不授权 original migration replay 或任何 write。

## 四、repo-external backup key metadata

只通过 `lstat`、`realpath`、mode、owner、link count 与 byte-count metadata 复核；没有打开 key 内容，没有计算、输出或记录 key hash/path value。

```text
BACKUP_ENCRYPTION_KEY_SOURCE_AVAILABLE=true
BACKUP_ENCRYPTION_KEY_SOURCE_SAFE=true
BACKUP_KEY_SOURCE_REPO_EXTERNAL=true
BACKUP_KEY_PARENT_IS_REAL_DIRECTORY=true
BACKUP_KEY_PARENT_PERMISSION_VALID=true
BACKUP_KEY_SOURCE_IS_REGULAR_FILE=true
BACKUP_KEY_SOURCE_NOT_SYMLINK=true
BACKUP_KEY_SOURCE_SINGLE_LINK=true
BACKUP_KEY_SOURCE_OWNER_MATCHES_PROCESS=true
BACKUP_KEY_SOURCE_PERMISSION_VALID=true
BACKUP_KEY_SOURCE_SIZE_VALID=true
BACKUP_KEY_VALUE_READ_OR_LOGGED=false
```

## 五、边界与下一任务

本阶段仅重新准入。正式 execution 仍须独立显式授权，并须沿 runner phase/state/receipt contract 串行执行；preflight 到 destructive child 的时间窗口、unknown outcome 与人工恢复边界保持 fail-closed，不得自动 retry。

```text
BACKUP_EXECUTION=false
RESTORE_EXECUTION=false
CANDIDATE_CREATE=false
BASELINE_BOOTSTRAP=false
DATA_TRANSFER=false
CUTOVER=false
ORIGINAL_DB_WRITE=false
MIGRATION_EXECUTION=false
SCHEMA_CHANGE=false
DDL_EXECUTION=false
DML_EXECUTION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S32_merge
NEXT_STAGE_AUTO_EXECUTION=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

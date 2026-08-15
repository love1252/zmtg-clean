# System SYS-01 controlled local-development rebuild execution 准入

- 日期：2026-08-15
- 阶段：S27
- 流：`system`
- 切片：`SYS_01_AI_USAGE_READONLY`
- 基线：`afea901fad078ae45bd9815d5d6513d833f3449d`
- 性质：docs-only + repository static audit + original `127.0.0.1:55433` transaction-read-only audit
- 结论：审计完成；execution 未准入；未执行 rebuild

## 一、结论

```text
STAGE=S27
TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION_ADMISSION
COMPLETION_MODE=EXECUTION_ADMISSION_COMPLETE_BLOCKED
BASELINE=afea901fad078ae45bd9815d5d6513d833f3449d

S26_IMPLEMENTATION_WORK_COMPLETE=true
S26_RUNTIME_PR=1224
S26_RUNTIME_HEAD=b6cbc6ccf6e4c0429d955cec674f6cf42bbc2acf
S26_RUNTIME_MERGE=afea901fad078ae45bd9815d5d6513d833f3449d
S26_BASELINE_SQL_ISOLATED_POSTGRES_APPLY_VERIFIED=true
S26_CATALOG_FINGERPRINT_EQUAL=true
S26_REQUIRED_CHECKS=passed
S26_ACTIONABLE_P0_P1_P2_P3=0
S26_POST_MERGE_REVIEW_DEBT=0
S26_COMPLETE=true
S26_FORMAL_CLOSURE=true

REBUILD_EXECUTION_ADMISSION_READY=false
PRIMARY_BLOCKING_PREREQUISITE=deterministic_readiness_and_application_smoke_evidence_issuers_plus_private_backup_key_source_and_low_level_adapter_behavior_tests
NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
```

S26 已将 baseline SQL、immutable manifest、origin-aware migration guard 与 controlled rebuild runner 实现并合并。隔离 `postgres:16.14-alpine` 实际 apply、marker 写入和 actual/expected catalog fingerprint 等值均已证明。S27 不重复 S26 实现，也不把“代码已存在”改写为“允许执行”。

原始数据库与 S24 contract 没有 drift；当前 blocker 是 execution control plane 尚未闭合：四类 evidence issuer 不存在、backup key source 不可用、low-level destructive adapter 只有高层依赖注入与源码 wiring 证据，未形成可执行行为测试闭包。因此不得进入 backup、restore、candidate create、baseline bootstrap、transfer、cutover。

## 二、S26 formal handoff

```text
BASELINE_SQL_ISOLATED_POSTGRES_APPLY_VERIFIED=true
CATALOG_FINGERPRINT_EQUAL=true
EXPECTED_SCHEMA_FINGERPRINT=4b93f1ce180ee48c12ded517a087fb3f6d73e7e28ff3be85f883de1d321dfb8c
ACTUAL_SCHEMA_FINGERPRINT=4b93f1ce180ee48c12ded517a087fb3f6d73e7e28ff3be85f883de1d321dfb8c
BASELINE_ARTIFACT_SHA256=170bf25538acead9a8db16330df8fc2e4354c84bb30032652a0caf19cd88584c
BASELINE_MANIFEST_SHA256=7baa09a9ff671237044fad3c747ef4a309cf371a7059003924f3a671b4fc182a

VERIFY_TABLE_COUNT=60
VERIFY_ENUM_COUNT=59
VERIFY_COLUMN_COUNT=853
VERIFY_PK_COUNT=60
VERIFY_FK_COUNT=110
VERIFY_UNIQUE_COUNT=51
VERIFY_CHECK_COUNT=63
VERIFY_INDEX_COUNT=136
VERIFY_FUNCTION_COUNT=4
VERIFY_TRIGGER_COUNT=7
VERIFY_SEQUENCE_COUNT=0
VERIFY_NOT_VALID_FK_COUNT=2
MARKER_TEST_ROW_COUNT=1
FAKE_HISTORY_ROW_COUNT=0
VERIFY_CONTAINER_REMAINS=false
VERIFY_VOLUME_REMAINS=false
```

隔离验证只使用专用 container、volume 与 `127.0.0.1:55436`；验证后资源全部清理。original `55433` 未参与 S26 write verification。

## 三、original `55433` fresh read-only recheck

连接只从本地 secret source 取得 URL，先验证 exact host/port；未输出 username、password、database URL、业务 ID 或业务正文。

```text
ORIGINAL_DATABASE_IDENTITY=127.0.0.1:55433
CLIENT_STARTUP_DEFAULT_TRANSACTION_READ_ONLY=on
TRANSACTION=BEGIN_TRANSACTION_READ_ONLY
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
SEMANTIC_SOURCE_DRIFT_COUNT=0
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_ON_ORIGINAL_55433=false
```

fresh 比较覆盖 S24 的 56-table inventory 与逐表 row-count contract；missing table、unexpected table 与 row-count drift 均为 0。当前 source 仍是 legacy `0037` database，结论只证明 source contract 未漂移，不授权在 original 上 replay migration。

## 四、residual A—N

| 项 | Fresh 结论 | Execution 影响 |
|---|---|---|
| A preflight → child spawn TOCTOU | `guarded-migrate` 的 DB preflight transaction 在 migration child spawn 前结束，存在 future migration hardening residual；controlled rebuild phase 不调用 migration child | 当前 rebuild 非 blocker；future common-tail migration 前必须 harden |
| B backup adapter | concrete `docker exec ... pg_dump --format=custom --no-owner --no-privileges`，stdout 直接 AES-256-GCM 流式加密，artifact `O_EXCL` / `O_NOFOLLOW` / `0600` | implemented；仍缺 low-level fake-executor behavior test 与合法 key source |
| C restore adapter | 冻结 ciphertext SHA，`O_NOFOLLOW` 读取，GCM 验证，exact image `pg_restore --list` table-set 校验，再进入隔离 restore drill | implemented；仍缺 low-level behavior test |
| D candidate-create | exact container/image/volume/host/port/database，`--pull never`，创建后验证 empty | implemented；仍缺 low-level behavior test |
| E baseline-bootstrap | candidate transaction 内 apply exact manifest-bound SQL，创建 exact marker table 与 marker-only row，随后校验 catalog fingerprint 与 marker shape | implemented；S26 isolated actual apply 已验证 |
| F transfer | original 单一 repeatable-read snapshot；table-by-table mapping；required-column guard；target count、mapped-row digest、secret opaque equality 与 original unchanged 验证 | implemented；仍缺 concrete adapter behavior test |
| G validation | catalog、2 个 NOT VALID FK、PK/FK、count、mapped rows、null shape、marker 与 original unchanged 全部 fail closed | implemented；仍缺 concrete adapter behavior test |
| H readiness issuer | runner 只能验证 bound receipt，没有 repository-owned deterministic issuer | blocker |
| I application smoke issuer | runner 只能验证 bound receipt，没有 repository-owned deterministic issuer | blocker |
| J manifest permissions | repo 外 private parent；file `0400/0600`；`O_NOFOLLOW`；single-link；atomic replace | sufficient |
| K phase intent lock | phase 前 `O_CREAT|O_EXCL|O_NOFOLLOW` lock + fsync；未落 manifest 的异常保留 lock | sufficient；人工调查后才可处理 |
| L unknown outcome | mutation-started 后失败写 `unknown` receipt/state；no-auto-retry；异常且未能持久化时 lock 保留 | sufficient |
| M cutover explicitness | runner 不执行 endpoint switch；只验证外部 deterministic receipt 与 active endpoint | design sufficient；issuer 缺失仍阻断 |
| N rollback reversibility | original 保留；candidate validation 与 rollback-readiness phase 必须先通过；可显式切回 original | design sufficient；未执行 |

```text
MIGRATION_CHILD_SPAWN_TOCTOU_PRESENT=true
MIGRATION_CHILD_SPAWN_TOCTOU_BLOCKS_REBUILD_EXECUTION=false
FUTURE_MIGRATION_HARDENING_REQUIRED=true

BACKUP_ADAPTER_IMPLEMENTED=true
RESTORE_ADAPTER_IMPLEMENTED=true
CANDIDATE_CREATE_ADAPTER_IMPLEMENTED=true
BASELINE_BOOTSTRAP_ADAPTER_IMPLEMENTED=true
TRANSFER_ADAPTER_IMPLEMENTED=true
VALIDATION_ADAPTER_IMPLEMENTED=true
LOW_LEVEL_ADAPTER_TEST_COVERAGE_SUFFICIENT=false
LOW_LEVEL_ADAPTER_TEST_GAP_BLOCKS_REBUILD_EXECUTION=true
```

S26 tests 能证明状态机、receipt chain、fail-closed contract 与 destructive dependency 可整体注入替换；实际 `pg_dump` / encryption / `pg_restore` / Docker / transfer / validation adapter 仅由源码 token/wiring 检查覆盖，尚未由 fake low-level executor 驱动其 success/failure/secret-redaction 行为。因此本 Admission 不把覆盖率写成 sufficient。

## 五、readiness / smoke evidence issuer

```text
PRE_CUTOVER_READINESS_EVIDENCE_ISSUER=missing_repository_owned_deterministic_candidate_readiness_issuer
PRE_CUTOVER_APPLICATION_SMOKE_EVIDENCE_ISSUER=missing_repository_owned_deterministic_candidate_application_smoke_issuer
POST_CUTOVER_READINESS_EVIDENCE_ISSUER=missing_repository_owned_deterministic_active_candidate_readiness_issuer
POST_CUTOVER_APPLICATION_SMOKE_EVIDENCE_ISSUER=missing_repository_owned_deterministic_active_candidate_application_smoke_issuer

READINESS_ISSUERS_DETERMINISTIC=false
READINESS_ISSUERS_LOW_SENSITIVE=false
READINESS_ISSUERS_CANDIDATE_BOUND=false
READINESS_ISSUERS_HEAD_BOUND=false
READINESS_ISSUERS_MANIFEST_BOUND=false
READINESS_ISSUERS_RECEIPT_CHAIN_BOUND=false
ARBITRARY_SHA_ACCEPTED=false
```

`buildBoundCutoverEvidenceReceipt()` 只负责把外部 evidence digest 绑定到 evidence kind、candidate endpoint、implementation Head、baseline manifest 与 previous phase receipt；它不是 evidence issuer。当前没有受审查命令生成四类 evidence digest，也无法证明输入不是人工任意 SHA。prerequisite 必须实现 deterministic、aggregate-only issuer，并由 runner 直接调用或验证结构化 receipt；不得只增加更多环境变量。

## 六、backup key 与 repo-external artifacts

```text
BACKUP_ENCRYPTION_KEY_SOURCE_AVAILABLE=false
BACKUP_ENCRYPTION_KEY_SOURCE_SAFE=false
BACKUP_KEY_VALUE_READ_OR_LOGGED=false

BACKUP_DIRECTORY_LOCATION_CLASS=user_owned_repo_external_private_directory
EXECUTION_MANIFEST_DIRECTORY_LOCATION_CLASS=user_owned_repo_external_private_directory
RECEIPTS_DIRECTORY_LOCATION_CLASS=user_owned_repo_external_private_directory
EXECUTION_ARTIFACT_DIRECTORIES_CREATED=false
EXECUTION_ARTIFACT_LOCATION_OUTSIDE_REPOSITORY_REQUIRED=true
EXECUTION_ARTIFACT_PARENT_MODE_REQUIRED=0700
EXECUTION_ARTIFACT_FILE_MODE_REQUIRED=0400_or_0600
EXECUTION_ARTIFACT_SYMLINK_ALLOWED=false
EXECUTION_ARTIFACT_WORLD_READABLE_ALLOWED=false
```

当前 environment 与 `.env.local` 只提供 `DATABASE_URL`；没有 `ZMTG_SYS01_BACKUP_KEY_PATH`。本次未创建 key、backup、manifest 或 receipt directory，未读取或记录 key value。后续 prerequisite 必须由用户在 repo 外提供 owner-only regular file，并只记录 availability、mode 与 identity，不记录内容。

## 七、停止线与下一任务

```text
DATABASE_REBUILD_EXECUTION=false
BACKUP_EXECUTION=false
RESTORE_EXECUTION=false
CANDIDATE_DATABASE_CREATE=false
BASELINE_SQL_EXECUTION=false
DATA_TRANSFER_EXECUTION=false
CUTOVER=false

MIGRATION_EXECUTION=false
DB_GENERATE_EXECUTION=false
SNAPSHOT_GENERATION=false
SCHEMA_CHANGE=false
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
```

下一原子任务不是 rebuild execution，而是对以下 prerequisite 做 fresh exact Runtime Admission：四类 deterministic issuer、backup key source/外部目录 preflight，以及 concrete low-level adapter behavior tests。只有该 prerequisite 实施并验证后，才能重新决定 `REBUILD_EXECUTION_ADMISSION_READY`；本阶段不授权自动执行下一任务。

# System SYS-01 rebuild execution prerequisite exact implementation 准入

- 日期：2026-08-15
- 阶段：S30
- 流：`system`
- 切片：`SYS_01_AI_USAGE_READONLY`
- 基线：`707c378afffb3e3b96790a26a0de8a17a8364f3c`
- 性质：docs-only Admission + repository static audit + repo-external secret/path preflight
- 结论：原始 prerequisite exact 2-file Runtime scope ready；review 后按用户明确授权完成 exact 3-file corrective re-admission；未执行 rebuild

## 一、结论

```text
STAGE=S30
TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
COMPLETION_MODE=PREREQUISITE_IMPLEMENTATION_ADMISSION_READY
BASELINE=707c378afffb3e3b96790a26a0de8a17a8364f3c

S29_PR=1227
S29_HEAD=d22ee7264d400d65905521a3718dc6be7efc55c4
S29_MERGE=707c378afffb3e3b96790a26a0de8a17a8364f3c
S29_REQUIRED_CHECKS=passed
S29_ACTIONABLE_P0_P1_P2_P3=0
S29_POST_MERGE_REVIEW_DEBT=0
S29_COMPLETE=true
S29_FORMAL_CLOSURE=true

SYSTEM_PREREQUISITE_IMPLEMENTATION_ADMISSION_READY=true
SYSTEM_PREREQUISITE_EXACT_ALLOWLIST_FROZEN=true
SYSTEM_PREREQUISITE_ORIGINAL_EXACT_FILE_COUNT=2
SYSTEM_PREREQUISITE_CORRECTIVE_EXACT_FILE_COUNT=3
SYSTEM_PREREQUISITE_CORRECTIVE_EXACT_PRODUCTION_FILE_COUNT=2
SYSTEM_PREREQUISITE_CORRECTIVE_EXACT_TEST_FILE_COUNT=1

S31_CORRECTIVE_RUNTIME_PR=1233
S31_CORRECTIVE_RUNTIME_HEAD=dc1524cc4b3d7656bf60b3aaf10be5ab7cf85ca5
S31_CORRECTIVE_RUNTIME_MERGE=f7eefd101d05b8c07468de677d5013658816972a
S31_CORRECTIVE_REQUIRED_CHECK=passed
S31_CORRECTIVE_RUNNER_TESTS=31_tests_passed
S31_CORRECTIVE_MIGRATION_GUARD_TESTS=54_tests_passed
S31_CORRECTIVE_FULL_TESTS=502_files_6976_tests_passed

BACKUP_KEY_CONTRACT_FROZEN=true
BACKUP_KEY_SOURCE_CREATED=true
BACKUP_KEY_SOURCE_AVAILABLE=true
BACKUP_KEY_SOURCE_FORMAT_VALID=true
BACKUP_KEY_SOURCE_PERMISSION_VALID=true
BACKUP_KEY_VALUE_READ_OR_LOGGED=false

LOW_LEVEL_ADAPTER_TEST_GAP_COUNT=6
LOW_LEVEL_ADAPTER_TEST_COVERAGE_SUFFICIENT=false
```

S30 只重新审计 S27 冻结的三个 blocker 类别：deterministic readiness/application smoke issuer、private backup key source 与 low-level concrete adapter behavior tests。原始 Admission 未改变 baseline design、`0038..0045`、S24 mapping 或 S26 catalog fingerprint。PR #1229 review 指出 runner tooling blob 与 exact-2 scope 不一致后，用户另行明确 re-admit exact 3 files；PR #1233 只更新 runner、同名 test 与 baseline manifest 的 runner blob，baseline SQL、artifact SHA、schema fingerprint 与 catalog contract 均保持不变。

## 二、S29 formal closure

S29 以 exact 11-file scope 实现 Customers CUS-01 formal Reader 与 `GET /api/v1/institution/customers`。PR #1227 合并后的两条 P2 已由同 scope corrective PR #1232 修复并解决：完整 Cookie header 交由 formal provenance owner，且 displayName 字符长度与 PostgreSQL 对齐。legacy `/api/institution/customers` 与 `page_customer_list` release 状态未改变，七线正式发布计数仍为 0。

```text
CUS01_EXACT_SCOPE_MATCH=true
CUS01_RUNTIME_IMPLEMENTED=true
CUS01_FORMAL_READER_IMPLEMENTED=true
CUS01_VERSIONED_API_IMPLEMENTED=true
CUS01_PAGE_RELEASE=false
CUS01_LEGACY_API_UNCHANGED=true
CUS01_TARGETED_TESTS=24_files_431_tests_passed
CUS01_CORRECTIVE_PR=1232
CUS01_CORRECTIVE_HEAD=1d1719f82afb9959c22e5ba6d5f8df0d65fae3c4
CUS01_CORRECTIVE_MERGE=00e9b91382538f29764853d9fdd67ae42a9872af
CUS01_CORRECTIVE_TARGETED_TESTS=5_files_58_tests_passed
CUS01_CORRECTIVE_FULL_TESTS=502_files_6976_tests_passed
```

## 三、现有 tooling 与复用决策

Fresh inventory 覆盖 `readiness`、health、smoke、local acceptance、5010、application probe、DB readiness 与 server startup surface：

| Surface | 当前事实 | S31 决策 |
|---|---|---|
| `scripts/db/sys01-controlled-local-dev-rebuild.mjs` | 已拥有 exact identity、candidate inventory/catalog validation、state machine、receipt chain 与四类 evidence binding | 在原 runner 内实现 deterministic issuer，不新建第二个控制框架 |
| `/api/version` | 返回 runtime env 或 build-time metadata；runtime env 可覆盖 commit | application smoke 只接受未注入期望 commit 时返回的 `source=build` exact Head；不能单独替代 DB readiness |
| `node_modules/next/dist/bin/next` | 可由 runner 直接启动实际 Next 进程 | 不再经过 `scripts/run-next.mjs` 同步包装；probe 在 `SIGTERM` 后等待实际 child close，超时 `SIGKILL` 并 fail-closed |
| `scripts/dev/local-acceptance-db.sh` | 55432 legacy acceptance helper，会 create/migrate，identity 不等于 SYS-01 candidate | 不复用为 S31 execution issuer，不调用 |
| `scripts/deploy/test-server.mjs` | 面向远端测试服务器并包含外网/SSH deployment 行为 | 不复用；S31 禁止外网、Staging 与 Production |

```text
REUSE_EXISTING_TOOLING=true
SECOND_SMOKE_FRAMEWORK_REQUIRED=false
PACKAGE_JSON_CHANGE_REQUIRED=false
NEW_RUNTIME_FILE_REQUIRED=false
```

## 四、四类 deterministic evidence issuer

S31 在现有 runner 内实现两个 repository-owned issuer，由 phase kind 参数形成四类证据；issuer 自己执行 fresh probe、canonicalize structured evidence、计算 evidence digest，再生成 bound receipt。调用方不得传入任意 evidence SHA 代替 probe。

| Evidence kind | 冻结 issuer | Probe 与绑定 |
|---|---|---|
| `pre_cutover_readiness` | `issueSys01DeterministicReadinessEvidenceV1` | candidate exact endpoint；实际 identity、schema fingerprint、marker/origin、required tables/catalog、phase state；绑定 implementation Head、baseline manifest 与 previous receipt |
| `pre_cutover_application_smoke` | `issueSys01DeterministicApplicationSmokeEvidenceV1` | candidate-bound loopback app；不注入 expected commit，只接受 `/api/version` build-time exact Head，并绑定 candidate endpoint、manifest 与 receipt chain |
| `post_cutover_readiness` | `issueSys01DeterministicReadinessEvidenceV1` | active endpoint 必须为 candidate；重新执行同一低敏 readiness probe并绑定 post-cutover phase chain |
| `post_cutover_application_smoke` | `issueSys01DeterministicApplicationSmokeEvidenceV1` | active candidate loopback app；fresh build-time `/api/version` probe 与 exact Head/endpoint/manifest/receipt chain 绑定，随后等待实际 Next 进程退出 |

Readiness evidence 至少包含 expected database identity、actual schema fingerprint、marker/origin state、required catalog/table readiness 与 current rebuild state prerequisite；不得包含业务正文、ID、PII、credential 或 secret。Application smoke 只接受 loopback，HTTP body 只解析 build-time version contract；failure、timeout、wrong Head、runtime-env source、wrong endpoint 与 non-loopback 均 fail closed。

```text
APPLICATION_SMOKE_EXPECTED_COMMIT_ENV_INJECTED=false
APPLICATION_SMOKE_VERSION_SOURCE_REQUIRED=build
APPLICATION_SMOKE_DIRECT_NEXT_CHILD=true
APPLICATION_SMOKE_CHILD_EXIT_AWAITED=true
```

```text
PRE_CUTOVER_READINESS_EVIDENCE_ISSUER=issueSys01DeterministicReadinessEvidenceV1_candidate
PRE_CUTOVER_APPLICATION_SMOKE_EVIDENCE_ISSUER=issueSys01DeterministicApplicationSmokeEvidenceV1_candidate
POST_CUTOVER_READINESS_EVIDENCE_ISSUER=issueSys01DeterministicReadinessEvidenceV1_active_candidate
POST_CUTOVER_APPLICATION_SMOKE_EVIDENCE_ISSUER=issueSys01DeterministicApplicationSmokeEvidenceV1_active_candidate

ISSUER_IMPLEMENTATION_HEAD_BOUND=true
ISSUER_BASELINE_MANIFEST_BOUND=true
ISSUER_ACTIVE_TARGET_BOUND=true
ISSUER_RECEIPT_CHAIN_BOUND=true
ARBITRARY_SHA_ACCEPTED=false
```

## 五、backup key 与 repo-external path contract

Runner fresh contract：`ZMTG_SYS01_BACKUP_KEY_PATH` 必须在 repository 外；direct parent 必须为当前 owner 的真实目录且 mode `0700`；key 必须为普通文件、非 symlink、link count=1、mode `0400` 或 `0600`。内容只允许 raw 32 bytes 或 64 个 hexadecimal characters，供 AES-256-GCM 使用。

S30 已在 user-owned repo-external private config directory 创建新的 raw 32-byte key source，并只验证 directory/file metadata 与 byte count；未输出、读取到聊天、记录或提交 key bytes/hash/path value。S31 runner 只允许读取 required bytes，读入后及时清零 buffer，错误与日志不得包含 secret。

```text
BACKUP_KEY_FORMAT=raw_32_bytes_or_64_hex_characters
BACKUP_KEY_ALLOWED_FILE_MODES=0400_or_0600
BACKUP_KEY_PARENT_MODE=0700
BACKUP_KEY_REGULAR_FILE_REQUIRED=true
BACKUP_KEY_SINGLE_LINK_REQUIRED=true
BACKUP_KEY_SYMLINK_ALLOWED=false
BACKUP_KEY_REPOSITORY_EXTERNAL_REQUIRED=true

BACKUP_DIRECTORY_LOCATION_CLASS=user_owned_repo_external_private_directory
EXECUTION_MANIFEST_DIRECTORY_LOCATION_CLASS=user_owned_repo_external_private_directory
RECEIPTS_DIRECTORY_LOCATION_CLASS=user_owned_repo_external_private_directory
REPO_EXTERNAL_EXECUTION_DIRECTORY_PREFLIGHT_READY=true
FORMAL_BACKUP_ARTIFACT_CREATED=false
FORMAL_EXECUTION_MANIFEST_CREATED=false
FORMAL_RECEIPT_CREATED=false
```

## 六、low-level adapter behavior test gap

当前 runner test 已覆盖状态机、top-level dependency replacement、receipt chain 与源码 wiring，但 concrete adapters 仍未通过 low-level fake executor 直接运行。gap 逐 adapter 计为 6：

| Adapter | 当前缺口 | S31 exact tests |
|---|---|---|
| backup | 没有 fake `pg_dump`/cipher stream success、failure、timeout、argv 与 secret-redaction 行为测试 | 注入 fake child/fs/crypto boundary，验证 encrypted-only、no original mutation、unknown/no retry |
| restore | 没有 fake `pg_restore --list`/restore argv、archive mismatch、decrypt failure 行为测试 | fake spawn/fs，锁定 list-before-restore、ciphertext binding 与 no secret output |
| candidate-create | 没有 fake Docker create/collision/readiness timeout 行为测试 | fake exec/timer，锁定 exact image/container/volume/loopback argv 与 collision fail closed |
| baseline-bootstrap | 没有 fake baseline apply failure/postcondition mismatch 行为测试 | fake DB adapter，锁定 marker-only、manifest-bound artifact、transaction failure 与 unknown outcome |
| transfer | 没有 fake single-snapshot partial failure、required-column/count mismatch 行为测试 | fake DB adapter，锁定 no original DML、no retry 与 target exact identity |
| validate | 没有 fake catalog/count/mapped-row/null/secret mismatch 行为测试 | fake DB adapter，逐项 fail closed且不产生 cleanup/write |

所有 tests 只能使用 synthetic key、fake exec/spawn/fs/DB/HTTP/timer；不得调用真实 Docker、`pg_dump`、`pg_restore` 或连接数据库。

## 七、exact Runtime allowlist

| PATH | ROLE | EXISTING_OR_NEW | PRODUCTION_OR_TEST | WHY_REQUIRED |
|---|---|---|---|---|
| `scripts/db/sys01-controlled-local-dev-rebuild.mjs` | 四类 deterministic evidence issuer、key metadata preflight、concrete adapter low-level dependency seam | existing | production tooling | runner 已拥有 exact identities、state machine、catalog validation、receipt chain 与所有 concrete adapters；在同 owner 内补闭包最小且不形成第二框架 |
| `scripts/db/sys01-controlled-local-dev-rebuild.test.mjs` | issuer、key preflight 与六 adapter fake-executor behavior closure | existing | test | 直接调用 concrete logic，证明 success/failure/timeout/unknown/argv/redaction/no-original-write/no-auto-retry |
| `drizzle/baselines/sys01-local-dev-current-schema-0045-v1.json` | runner tooling Git blob binding | existing | production baseline manifest | 用户后续明确 re-admit；只更新 runner blob，baseline SQL/artifact/schema/catalog contract 不变 |

```text
SYSTEM_PREREQUISITE_ORIGINAL_EXACT_ALLOWLIST=
scripts/db/sys01-controlled-local-dev-rebuild.mjs,
scripts/db/sys01-controlled-local-dev-rebuild.test.mjs

SYSTEM_PREREQUISITE_CORRECTIVE_EXACT_ALLOWLIST=
scripts/db/sys01-controlled-local-dev-rebuild.mjs,
scripts/db/sys01-controlled-local-dev-rebuild.test.mjs,
drizzle/baselines/sys01-local-dev-current-schema-0045-v1.json

EXTRA_RUNTIME_FILE_ALLOWED=false
GUARDED_MIGRATE_CHANGE_ALLOWED=false
BASELINE_ARTIFACT_CHANGE_ALLOWED=false
BASELINE_MANIFEST_CHANGE_ALLOWED=runner_tooling_blob_only_by_explicit_corrective_re_admission
PACKAGE_OR_LOCKFILE_CHANGE_ALLOWED=false
SCHEMA_OR_MIGRATION_CHANGE_ALLOWED=false
```

## 八、验证与停止线

S31 必须运行 exact prerequisite/runner tests、MigrationGuard regression、full test、typecheck、AQ、Architecture incremental、lint、build、ProductionReadinessDocs 与 diff-check。原始 exact-2 scope 之外的 baseline manifest 变更只有用户后续明确 exact-3 re-admission 才允许，且仅限 runner tooling blob；任何其他第 4 个文件、真实 Docker/DB adapter execution、original write、backup/restore/candidate/bootstrap/transfer/cutover、Schema/Migration 或外部网络需求均立即停止。

```text
DATABASE_CONNECTION=false
DATABASE_WRITE_ON_ORIGINAL_55433=false
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
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION
NEXT_SYSTEM_TASK_AUTHORIZED=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

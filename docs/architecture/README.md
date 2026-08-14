# 智美天工架构文档索引

<!-- POST_V2_R1C_PAGE_SYSTEM_AUDIT_EXACT_RUNTIME_RELEASE_START -->

## POST-V2-R1C `page_system_audit` exact 5-file Runtime release 安全回滚（2026-08-14）

```text
STAGE=S14
COMPLETION_MODE=BLOCKED_ROLLED_BACK
S14_COMPLETE=false
S14_RELEASE_ROLLBACK_COMPLETE=true
S14_FORMAL_CLOSURE=false
S14_BLOCKED_STATE_HANDOFF_CLOSED=true
S14_BLOCKER_FORMALLY_CLOSED=false
S14_SECURITY_BLOCKER_OPEN=true

INITIAL_RUNTIME_PR=1202
INITIAL_RUNTIME_HEAD=8a95401d8d2668062059f239db20a33e689173b8
INITIAL_RUNTIME_MERGE=c1eabd4051f7fafb75abd44bd6636503c89f43a4
INITIAL_HANDOFF_PR=1203
SECURITY_ROLLBACK_PR=1204
SECURITY_ROLLBACK_HEAD=fef19d3591c0849f84d0618dd45272e707d31bc9
SECURITY_ROLLBACK_MERGE=a1a2baf13c5674e2795b65b37fad2ff89ddac104
FINAL_CORRECTIVE_HANDOFF_PR=1205
BLOCKED_HANDOFF_CORRECTIVE_PR=1206
BLOCKED_HANDOFF_CORRECTIVE_HEAD=36b547be022bdfd09785d73a14c3c9bd1b2f3b46
BLOCKED_HANDOFF_CORRECTIVE_MERGE=953bc6c1d4b6431c02690d51a8dade52119fbf42
FINAL_BLOCKED_STATE_RECORDING_PR=TBD
S14_PRS=1202,1203,1204,1205,1206,TBD
S14_PR_COUNT=6
S14_REQUIRED_CHECKS=passed

S14_POST_MERGE_P1_DETECTED=2
PR1202_OPERATOR_SCOPE_P1_THREAD=PRRT_kwDOSrGMn86ZMXMW
PR1202_OPERATOR_SCOPE_P1_THREAD_RESOLVED=true
PR1204_DOCUMENTATION_P2_THREAD=PRRT_kwDOSrGMn86ZM8Cc
PR1204_DOCUMENTATION_P2_THREAD_RESOLVED=true
PR1205_API_SCOPE_P1_THREAD=PRRT_kwDOSrGMn86ZNNed
PR1205_API_SCOPE_P1_VALID=true
PR1205_API_SCOPE_P1_THREAD_RESOLVED=true
PR1206_PREMERGE_DOCUMENTATION_P2_THREAD=PRRT_kwDOSrGMn86ZOp0H
PR1206_PREMERGE_DOCUMENTATION_P2_THREAD_RESOLVED=true
PR1206_OPEN_BLOCKER_TITLE_P2_THREAD=PRRT_kwDOSrGMn86ZO45-
PR1206_OPEN_BLOCKER_TITLE_P2_THREAD_RESOLVED=true
S14_ACTIONABLE_P0_P1=0
S14_ACTIONABLE_P0_P1_P2_P3=0
POST_MERGE_REVIEW_DEBT=0

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_ACCESS_MODE=hidden
PAGE_SYSTEM_AUDIT_DATA_READINESS=not_required
PAGE_SYSTEM_AUDIT_PRODUCTION_RELEASE=not_released
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
RELEASED_GOVERNED_PAGES=page_workbench
CONTROLLED_CREATE_RELEASE_COUNT=0
CANONICAL_ROUTE_PRESENT=false

ROLLBACK_RUNTIME_TEST_CHANGED_FILE_COUNT=5
ROLLBACK_EXACT_SCOPE_MATCH=true
ROLLBACK_TARGETED_TEST_FILES=3
ROLLBACK_TARGETED_TESTS=93
ROLLBACK_FULL_TEST_FILES=495
ROLLBACK_FULL_TESTS=6789
ROLLBACK_POST_MERGE_INDEPENDENT_TEST_FILES=3
ROLLBACK_POST_MERGE_INDEPENDENT_TESTS=93

AUDIT_WRITER_ATTRIBUTION_CLOSED=true
HISTORICAL_BACKFILL_CLOSED=true
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
AUDIT_READER_ROLE_AWARE_AUTHORIZATION_SAFE=false
WORKBENCH_MULTI_CAPABILITY_SAFE=true

PRIMARY_BLOCKING_PREREQUISITE=trusted_role_aware_audit_read_authorization
BLOCKED_READ_SURFACE=GET /api/institution/audit-events
BLOCKER_SCOPE=tenant_operator_can_reach_system_guard_but_reader_lacks_trusted_role_aware_scope
REQUIRED_NEW_AUTHORIZATION=fresh_admission_beyond_S14_exact_5_runtime_allowlist
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=false
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false
S13_EXACT_5_RELEASE_ADMISSION_REUSABLE_WITHOUT_FRESH_READMISSION=false

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

NEXT_TASK=POST-V2-R1C Trusted Role-Aware Audit Read Authorization fresh audit + exact Runtime admission
NEXT_STAGE=S15
NEXT_TASK_AUTHORIZED=false
NEXT_TASK_SELECTION_REQUIRED=false
S15_RUNTIME_AUTHORIZED=false
DATABASE_CONNECTION_AUTHORIZED=false
DATABASE_WRITE_EXECUTION_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RELEASE_AUTHORIZED=false
```

架构结论：

- PR #1202 曾按 S13 canonical Admission 实施 exact 5-file release；post-merge P1 证明 `tenant_operator` 会在 Reader 缺少角色、本人及授权模块过滤时读取本机构全部可信审计记录；
- 当前 Capability Authority runtime context 不暴露角色，且 `tenant_admin` 与 `tenant_operator` 的 system navigation shape 相同；canonical 5 files 内无法可信地区分两者；
- 正确修复需要角色感知 Reader/Repository、可信角色信号或 public policy/contract 变更，均超出 S14 frozen exact-5 或触发 Reader/public contract 硬停止条件；
- PR #1204 因此按 S14 rollback 恢复仅 `page_workbench` released，`page_system_audit` 回到 `hidden/not_released`，并删除 dedicated `/hospital/system/audit` Route；
- 页面 Route rollback 只消除了新发布页面造成的 exposure expansion；`GET /api/institution/audit-events` 仍由允许 admin/operator 的 `system` Section Guard 保护，而 Reader 缺少可信 role-aware scope，安全 blocker 继续开放；
- rollback exact 5-file scope、full 495/6789、AQ 148/148、build、Required Check 与 merged-main independent 3/93 均通过；#1206 合并后，PR #1205 API scope P1 已回复并解决；
- S10-S13 Reader/Writer/Data Readiness foundation 继续有效，但不构成页面 release；S14 release 未完成，S13 exact-5 Admission 不可无 fresh re-admission 重放。

证据：

- `docs/operations/post-v2-r1c-page-system-audit-exact-runtime-release-closure-20260814.md`
- Initial Runtime PR #1202 / Merge `c1eabd4051f7fafb75abd44bd6636503c89f43a4`
- Initial Handoff PR #1203
- Security rollback PR #1204 / Merge `a1a2baf13c5674e2795b65b37fad2ff89ddac104`
- Final corrective Handoff PR #1205
- Blocked Handoff corrective PR #1206 / Merge `953bc6c1d4b6431c02690d51a8dade52119fbf42`
- Final blocked-state recording PR #TBD

唯一下一任务冻结为 S15 `Trusted Role-Aware Audit Read Authorization fresh audit + exact Runtime admission`；`NEXT_TASK_AUTHORIZED=false`、`S15_RUNTIME_AUTHORIZED=false`。

<!-- POST_V2_R1C_PAGE_SYSTEM_AUDIT_EXACT_RUNTIME_RELEASE_END -->

<!-- POST_V2_R1C_PAGE_SYSTEM_AUDIT_FRESH_RELEASE_READMISSION_START -->

## POST-V2-R1C `page_system_audit` fresh release re-audit 与精确 Runtime 重新准入（2026-08-14）

```text
STAGE=S13
COMPLETION_MODE=COMPLETE
FRESH_RELEASE_REAUDIT=passed
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=true
EXACT_RUNTIME_ALLOWLIST_FROZEN=true
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=true
HANDOFF_PR=1200
FORMAL_CLOSURE_PR=1201
S13_PRS=1197,1198,1199,1200,1201
S13_PR_COUNT=5
EXACT_HANDOFF_DOC_FILE_COUNT=5
FORMAL_CORRECTIVE_MARKDOWN_FILE_COUNT=5
FORMAL_CORRECTIVE_DELETED_FILE_COUNT=1
S13_REQUIRED_CHECKS=passed
S13_ACTIONABLE_P0_P1=0
POST_MERGE_REVIEW_DEBT=0
S13_FORMAL_CLOSURE=true
CSV_FILE_DELETED=true
CSV_RESIDUAL_REFERENCE_COUNT=0
CANONICAL_ALLOWLIST_LOCATION=docs/operations/post-v2-r1c-page-system-audit-fresh-release-reaudit-exact-runtime-readmission-20260814.md

EXACT_RUNTIME_FILE_COUNT=5
EXACT_RUNTIME_EXISTING_FILE_COUNT=4
EXACT_RUNTIME_NEW_FILE_COUNT=1
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=3

AUDIT_READER_SAFE_DATA_AVAILABLE=true
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
AUDIT_READER_COVERAGE_DISCLOSURE_SAFE=true
WORKBENCH_MULTI_CAPABILITY_REVALIDATED=true
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=true
PAGE_SYSTEM_AUDIT_CANONICAL_ROUTE_SAFE=true
SHELL_READONLY_SAFE=true
LOW_SENSITIVE_OUTPUT_SAFE=true
CAPABILITY_AUTHORITY_RELEASE_PATH_SAFE=true
NAVIGATION_RELEASE_PATH_SAFE=true
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RELEASE_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_RELEASE_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_PRODUCTION_AUTHORITY_GRANT_AUTHORIZED=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
```

架构结论：

- local-development readonly recheck、Reader verified-only chain、coverage honesty、system Section Guard、formal authorization、canonical Route path、readonly Shell/client 与 Workbench multi-capability 均通过 fresh 审计；
- 当前数据是 275 total / 7 verified / 1 not-applicable / 267 unclassifiable，页面只能披露安全 verified subset，不能声称完整历史覆盖；
- PR #1197 先闭合客户端 exact low-sensitive DTO boundary；其 post-merge reason completeness P1 已由 corrective PR #1199 在不扩大 query filter 的前提下修复并解决；
- PR #1198 docs-only scope 中的独立 CSV 已由 S13 formal corrective closure 删除；Admission Markdown 第 12 节是唯一 canonical exact Runtime allowlist 来源；
- merged corrective 基线上的独立定向复验 14 files / 303 tests 与 Handoff typecheck、ProductionReadinessDocs 均通过；
- 下一 Runtime 只允许 2 个 production + 3 个 tests 的 exact 5-file allowlist：existing Authority policy、new dedicated Route 与 3 个精确 regression files；
- 目标 Authority shape 为 `read_only / dataReadiness=partial / productionRelease=pilot_released`；shared catch-all、Reader、client、Repository、Schema 与历史数据均不修改；
- S13 只重新准入，不实施页面发布，不改变 governed page count。

证据：

- `docs/operations/post-v2-r1c-page-system-audit-fresh-release-reaudit-exact-runtime-readmission-20260814.md`（唯一 canonical exact Runtime allowlist）
- 前置校正 PR #1197 / Merge `638b69a2c66597d7a7ae0bd87e0c4f88dd8f8ec2`
- Admission PR #1198 / Merge `f0bec7503932e8ad08272f3981935d6fbaa31bfc`
- corrective PR #1199 / Merge `b0165a27958ca2d8093a15fe3ea3f040bb83af2a`

唯一下一任务：

`POST-V2-R1C page_system_audit exact 5-file Runtime release implementation explicit authorization`

<!-- POST_V2_R1C_PAGE_SYSTEM_AUDIT_FRESH_RELEASE_READMISSION_END -->

<!-- POST_V2_R1C_AUDIT_READER_DATA_READINESS_WORKBENCH_MULTI_CAPABILITY_START -->

## POST-V2-R1C Reader coverage / Workbench multi-capability 前置条件闭环（2026-08-14）

```text
STAGE=S12
COMPLETION_MODE=COMPLETE
S12_PRS=1195,1196
S12_PR_COUNT=2
S12_REQUIRED_CHECKS=passed
S12_ACTIONABLE_P0_P1=0
POST_MERGE_REVIEW_DEBT=0
AUDIT_READER_SAFE_DATA_AVAILABLE=true
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
AUDIT_READER_DATA_READINESS=partial_safe

WORKBENCH_MULTI_CAPABILITY_SAFE=true
WORKBENCH_PAGE_WORKBENCH_PROJECTION_STABLE=true

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
```

架构结论：

- Institution Audit Reader 以精确四字段 coverage contract 区分 `complete` 与 `partial_verified_only`；scope、facts、query 或 contract 不可信时继续使用既有 503 unavailable 边界；
- 267 条不可分类历史记录不被猜测归因，也不被 API/UI 当作不存在；当前 7 条可信记录可读，但完整历史覆盖仍为 false；
- `authoritative_empty` 只由 `complete + safeDataAvailable=false + records=[]` 派生，partial 的 0 rows 不得表达为从未发生；
- `/hospital` 按 `capabilityKey='page_workbench'` 精确选择并缩小自身投影；第二条合法 summary 与数组顺序不再影响 Workbench，duplicate/missing 仍 fail-closed；
- production Capability Authority、导航、`page_system_audit` 与受治理页面计数未修改。

证据：

- `docs/operations/post-v2-r1c-audit-reader-data-readiness-workbench-multi-capability-prerequisite-closure-20260814.md`
- Runtime PR #1195 / Merge `9cf3ac78bbd0bafdcbf4c56afd4af8f2badf84df`
- Handoff PR #1196

唯一下一任务：

`POST-V2-R1C page_system_audit fresh release re-audit + exact Runtime re-admission explicit authorization`

<!-- POST_V2_R1C_AUDIT_READER_DATA_READINESS_WORKBENCH_MULTI_CAPABILITY_END -->

<!-- POST_V2_R1C_AUDIT_WRITER_CLASSIFIED_CALLER_MIGRATION_ADMISSION_START -->

## POST-V2-R1C Audit Writer 分类 caller migration 精确 Runtime 准入（2026-08-13）

```text
CALLER_MIGRATION_FRESH_AUDIT=passed
COMPLETION_MODE=ADMISSION_READY_SPLIT
MIGRATION_STRATEGY=SPLIT
EXACT_RUNTIME_SCOPE_FROZEN=true
FIRST_SLICE_EXACT_RUNTIME_ADMISSION=passed

PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_LEGACY_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_ATTRIBUTED_WRITER_CALLER_FILE_COUNT=0
HELPER_CONSTRUCTION_CALLER_FILE_COUNT=16
DIRECT_OBJECT_CONSTRUCTION_CALLER_FILE_COUNT=3
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10

TARGET_VERIFIED_CALLER_FILE_COUNT=5
TARGET_NOT_APPLICABLE_CALLER_FILE_COUNT=12
BLOCKED_UNCLASSIFIED_CALLER_FILE_COUNT=2

ADMITTED_SLICE_ID=AUTH_LOGIN_NOT_APPLICABLE_V1
ADMITTED_CALLER_FILE_COUNT=1
REMAINING_LEGACY_CALLER_FILE_COUNT_AFTER_SLICE=18
EXACT_RUNTIME_FILE_COUNT=2
EXISTING_RUNTIME_FILE_COUNT=2
NEW_RUNTIME_FILE_COUNT=0
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=1
EXACT_TEST_FILE_COUNT=1
EXACT_DOC_FILE_COUNT=5
EXISTING_DOC_FILE_COUNT=4
NEW_DOC_FILE_COUNT=1

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false

CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

架构结论：

- fresh union search 重新确认 16 个 helper + 3 个直接对象构造 caller、0 个 attributed production caller 与 10 个事务持久化／组合文件；
- 目标分类为 5 个 `VERIFIED`、12 个 `NOT_APPLICABLE`、2 个 `BLOCKED_UNCLASSIFIED`，不允许新生产写入使用 `legacy_unattributed`；
- `VERIFIED` operation 必须由 orchestration 每次 top-level operation 只 resolve/consume 一次 S6 scope，并复用冻结 pair 对照 transaction-bound business pair；不得重复 ownership query；
- 两个 mixed pre-scope caller 当前无法由 S8 contract 安全表达 attempted institution denial，必须独立准入，不能伪标为 `verified` 或 `not_applicable`；
- 迁移采用 composition-family split；首切片只处理 active Auth formal login 的明确 `not_applicable`，exact allowlist 为 1 个既有 Route + 1 个既有测试文件；
- 首切片不需要 Schema、Migration、数据库、transaction、new file 或 Architecture exception；S6 scope port 与 S8 contract 均不修改。

证据：

- `docs/operations/post-v2-r1c-audit-writer-classified-caller-migration-admission-20260813.md`

唯一下一任务：

`POST-V2-R1C Audit Writer caller migration AUTH_LOGIN_NOT_APPLICABLE_V1 exact 2-file Runtime implementation explicit authorization`

<!-- POST_V2_R1C_AUDIT_WRITER_CLASSIFIED_CALLER_MIGRATION_ADMISSION_END -->

<!-- POST_V2_R1C_AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_START -->

## POST-V2-R1C Audit Owner 机构归因契约 Runtime 闭环（2026-08-13）

```text
POST_V2_R1C_AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_IMPLEMENTED=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_VERIFIED=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_INDEPENDENT_VERIFICATION=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_HANDOFF_COMPLETE=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=true

RUNTIME_EXACT_FILE_COUNT=4
RUNTIME_PR=1179
RUNTIME_HEAD=509140180aa95e56cccba17db4d5e65db20d6cd5
RUNTIME_MERGE=cba79e6bad83be4eafebc6b4359e381d98eb804a
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0

LEGACY_CALLER_CAN_WRITE_VERIFIED=false
LEGACY_UNATTRIBUTED_NEW_WRITE_ALLOWED=false
AUDIT_CONTRACT_PROVES_FORMAL_SCOPE=false
AUDIT_OWNER_IMPORTS_SCOPE_PORT=false

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

架构结论：

- legacy `TenantAuditEvent + record()` 暂时保留且只映射 `NULL/NULL`；新 attributed contract 只允许 `verified | not_applicable`，并提供严格 factory、validator、mapper 与 `recordAttributed()`；
- factory 输出冻结的字段白名单对象；mapper 与 Repository 二次验证，非法 cast / fake object 固定低敏失败且零 insert；
- Audit contract 不证明 formal scope，Audit module 不导入 S6 scope port；Repository 不查询业务 Owner、不获取全局数据库、不自行开启 transaction；
- exact-4 Runtime、Required Check、合并后独立验证均通过；targeted 16 files / 288 tests、full 492 files / 6678 tests、Architecture unit 148/148、typecheck、Architecture incremental、lint 与 build 全部通过；
- 19 个 callers、caller migration、historical backfill、Workbench、`page_system_audit`、Schema/Migration、Staging 与 Production 均未实施。

证据：

- `docs/operations/post-v2-r1c-audit-owner-institution-attribution-contract-runtime-independent-verification-20260813.md`
- Runtime PR #1179 / Merge `cba79e6bad83be4eafebc6b4359e381d98eb804a`

唯一下一任务：

`POST-V2-R1C Audit Writer classified caller migration fresh audit + exact Runtime admission`

```text
CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
```

<!-- POST_V2_R1C_AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_END -->

<!-- POST_V2_R1C_AUDIT_OWNER_ATTRIBUTION_CONTRACT_ADMISSION_START -->

## POST-V2-R1C Audit Owner 机构归因契约精确 Runtime 准入（2026-08-13）

```text
AUDIT_OWNER_ATTRIBUTION_CONTRACT_FRESH_AUDIT=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_ELIGIBLE=true
ADMISSION_MODE=ADMISSION_READY
EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXACT_RUNTIME_ADMISSION=passed

RECOMMENDED_RUNTIME_DESIGN=方案 B：保留 legacy TenantAuditEvent + record 路径，新增 Audit-owned discriminated attributed contract + recordAttributed 路径
CANONICAL_ATTRIBUTION_CONTRACT_OWNER=src/modules/audit

LEGACY_CALLER_CAN_WRITE_VERIFIED=false
LEGACY_UNATTRIBUTED_NEW_WRITE_ALLOWED=false
AUDIT_CONTRACT_PROVES_FORMAL_SCOPE=false
AUDIT_OWNER_IMPORTS_SCOPE_PORT=false
PLATFORM_NOT_APPLICABLE_CONTRACT_SAFE=true
AUTH_NOT_APPLICABLE_CONTRACT_SAFE=true

EXACT_RUNTIME_FILE_COUNT=4
EXISTING_RUNTIME_FILE_COUNT=4
NEW_RUNTIME_FILE_COUNT=0
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=2

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false

AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_AUTHORIZED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

架构结论：

- 现有 19 个 caller 不能因 contract 切片被强制同步迁移；保留 legacy `TenantAuditEvent + record()` 暂时映射 `NULL/NULL`，新增独立 attributed contract 与 `recordAttributed()` 是唯一可独立实施的方案；
- 新 contract 只允许 `verified` 的非空 tenant / institution pair，或 `not_applicable` 的 null institution；unknown、非法组合与所有新 `legacy_unattributed` 写入 fail-closed；
- Audit contract 只证明 shape 和 pair self-consistency，不证明 formal provenance；future orchestration 消费 S6 scope handle 后负责 provenance 与 transaction-bound pair 比较；
- Audit module 不反向导入 orchestration，Repository 不解析 session、不查询业务 Owner、不猜 attribution，也不新开 transaction；
- Platform 7 与 Auth 1 个 caller 后续可显式迁入 `not_applicable`，但 S7 不修改 caller；
- exact Runtime 只允许修改 Audit Owner 的 2 个既有生产文件和 2 个既有测试文件；不新增文件，不改 Schema、Migration、scope port、Workbench 或页面；
- targeted 15 files / 240 tests、typecheck、Architecture Quality 148/148、增量架构与 ProductionReadinessDocs 均通过；未连接数据库。

证据：

- `docs/operations/post-v2-r1c-audit-owner-institution-attribution-contract-admission-20260813.md`
- `docs/operations/post-v2-r1c-audit-owner-institution-attribution-contract-exact-runtime-allowlist-20260813.csv`

唯一下一任务：

`POST-V2-R1C Audit Owner institution attribution contract exact 4-file Runtime implementation explicit authorization`

<!-- POST_V2_R1C_AUDIT_OWNER_ATTRIBUTION_CONTRACT_ADMISSION_END -->

<!-- POST_V2_R1C_AUDIT_WRITER_FORMAL_SCOPE_PORT_RUNTIME_START -->

## POST-V2-R1C Audit Writer 正式机构范围端口 Runtime 闭环（2026-08-13）

```text
POST_V2_R1C_AUDIT_WRITER_SCOPE_PORT_RUNTIME=passed
AUDIT_WRITER_SCOPE_PORT_RUNTIME_IMPLEMENTED=true
AUDIT_WRITER_SCOPE_PORT_RUNTIME_VERIFIED=true
AUDIT_WRITER_SCOPE_PORT_INDEPENDENT_VERIFICATION=passed
AUDIT_WRITER_SCOPE_PORT_HANDOFF_COMPLETE=true

FORMAL_SCOPE_SOURCE=formal server-session verified claims corroborated by authoritative Identity + active Membership/Binding + active Tenancy Institution Scope
PORT_OWNER=src/server/orchestration
HANDLE_OWNER=src/server/orchestration/institution-audit-writer-scope.ts
HANDLE_CREATOR=resolveInstitutionAuditWriterFormalScopeV1
HANDLE_CONSUMER=consumeInstitutionAuditWriterFormalScopeV1
CONSUMPTION_COUNT=1

RUNTIME_EXACT_FILE_COUNT=2
RUNTIME_PR=1176
RUNTIME_HEAD=77f792ae29dfaf983f77d3a246ec925943e4f016
RUNTIME_MERGE=1aea18be710f32d8589a48ae7ca23aaba0c5ecb6
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0

CAPABILITY_COUPLING=false
WRITER_SCOPE_PORT_IS_AUTHORIZATION_REPLACEMENT=false
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

当前架构结论：

- PR #1176 已按 Admission 完成 exact 2-file Runtime，并以 Merge `1aea18be...` 进入 `main`；没有第 3 个文件或既有 Runtime 漂移；
- 无输入 resolver 复用正式 server-session verified claims，并通过 authoritative Identity、active Membership / Binding 与 active Tenancy Institution Scope 交叉确认 exact pair；
- handle genuine、opaque、冻结、one-shot、不可 clone 或重放，consumption 只含 `tenantId + institutionId + observedAt`；
- 端口与 Capability Authority、navigation、Workbench、`page_system_audit` release 彻底解耦，且不替代业务授权；
- Runtime targeted 10 files / 253 tests、full 492 files / 6668 tests、typecheck、Architecture unit 148/148、Architecture incremental、lint 与 build 全部通过；
- 合并后重新执行 targeted、typecheck、Architecture incremental 与静态边界检查，确认 exact-2 和禁止范围无漂移；
- 未连接数据库；Audit Owner contract、caller migration、historical backfill、Workbench、页面、Staging 与 Production 均未实施。

证据：

- `docs/operations/post-v2-r1c-audit-writer-formal-institution-scope-port-runtime-independent-verification-20260813.md`
- `docs/operations/post-v2-r1c-audit-writer-formal-institution-scope-port-admission-20260813.md`
- `docs/operations/post-v2-r1c-audit-writer-formal-institution-scope-port-exact-runtime-allowlist-20260813.csv`

唯一下一任务：

`POST-V2-R1C Audit Owner institution attribution contract fresh audit + exact Runtime admission`

```text
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_AUTHORIZED=false
```

<!-- POST_V2_R1C_AUDIT_WRITER_FORMAL_SCOPE_PORT_RUNTIME_END -->

<!-- POST_V2_R1C_AUDIT_WRITER_FORMAL_SCOPE_PORT_ADMISSION_START -->

## POST-V2-R1C Audit Writer 正式机构范围端口精确 Runtime 准入（2026-08-13）

```text
AUDIT_WRITER_SCOPE_PORT_FRESH_AUDIT=passed
AUDIT_WRITER_SCOPE_PORT_RUNTIME_ELIGIBLE=true
ADMISSION_MODE=ADMISSION_READY
EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_WRITER_SCOPE_PORT_EXACT_RUNTIME_ADMISSION=passed

RECOMMENDED_RUNTIME_DESIGN=方案 B：src/server/orchestration 持有的无输入 one-shot formal scope port
FORMAL_SCOPE_SOURCE=formal server-session verified claims corroborated by current authoritative Identity + active Membership/Binding + active Tenancy Institution Scope
PORT_OWNER=src/server/orchestration
HANDLE_OWNER=src/server/orchestration/institution-audit-writer-scope.ts
HANDLE_CREATOR=resolveInstitutionAuditWriterFormalScopeV1
HANDLE_CONSUMER=consumeInstitutionAuditWriterFormalScopeV1
CONSUMPTION_COUNT=1

WRITER_SCOPE_PORT_IS_AUTHORIZATION_REPLACEMENT=false
CAPABILITY_COUPLING=false
PAIR_REVALIDATION_REQUIRED=false

EXACT_RUNTIME_FILE_COUNT=2
EXISTING_RUNTIME_FILE_COUNT=0
NEW_RUNTIME_FILE_COUNT=2
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=1
EXACT_TEST_FILE_COUNT=1

DATABASE_ENVIRONMENT=not_connected
DATABASE_READONLY_CONNECTION=not_used
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_SCOPE_PORT_RUNTIME_AUTHORIZED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_AUTHORIZED=false
CALLER_MIGRATION_AUTHORIZED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

架构结论：

- 复用 `verifyFormalServerSessionCookieClaimsV1()` 的 one-shot verified claims，并通过既有 authoritative Identity、active Membership / Binding 与 active Tenancy Institution Scope 对同一 `accountId + tenantId + institutionId` 进行交叉确认；不建立第二套 authorization framework；
- 不复用 `InstitutionCapabilityAuthorityRuntimeContextV1`，因为它要求 `workbench` navigation 并输出 `availableSectionIds`；Writer attribution 与 UI capability release 必须解耦；
- 新端口由 `src/server/orchestration` 持有，resolver 无输入，消费结果只含 `tenantId + institutionId + observedAt`；opaque handle genuine、冻结、不可 clone、精确消费一次且不可重放；
- 端口只提供 attribution provenance，不替代 Route／section／object／action authorization；future transaction caller 只比较 formal pair 与 transaction-bound object pair，不重复查询 ownership；
- exact Runtime 只允许新增 `src/server/orchestration/institution-audit-writer-scope.ts` 与对应 `.test.ts`，不修改任何既有 Runtime 文件；
- 静态链路与定向测试已足以决定准入，本阶段未连接数据库；Schema、Migration、Architecture exception 与 AQ004～AQ008 均无变更；
- S5 只完成 Admission，Runtime、Audit Owner contract、caller migration、backfill、页面、Workbench、Staging 与 Production 均未授权或实施。

证据：

- `docs/operations/post-v2-r1c-audit-writer-formal-institution-scope-port-admission-20260813.md`
- `docs/operations/post-v2-r1c-audit-writer-formal-institution-scope-port-exact-runtime-allowlist-20260813.csv`

唯一下一任务：

`POST-V2-R1C Audit Writer formal institution scope port exact 2-file Runtime implementation explicit authorization`

<!-- POST_V2_R1C_AUDIT_WRITER_FORMAL_SCOPE_PORT_ADMISSION_END -->

<!-- POST_V2_R1C_AUDIT_WRITER_ATTRIBUTION_SPLIT_START -->

## POST-V2-R1C Audit Writer 机构归因 fresh audit 与拆分（2026-08-13）

```text
AUDIT_WRITER_ATTRIBUTION_FRESH_AUDIT=passed
AUDIT_WRITER_ATTRIBUTION_RUNTIME_ELIGIBLE=false
ADMISSION_MODE=SPLIT_REQUIRED

CALLER_INVENTORY_REAUDIT=passed
PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=11
PRODUCTION_PLATFORM_AUDIT_WRITER_CALLER_FILE_COUNT=7
PRODUCTION_NON_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=1
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10

BLOCKING_PREREQUISITE_COUNT=3
PRIMARY_BLOCKING_PREREQUISITE=formal institution Audit Writer scope port
HISTORICAL_BACKFILL_REQUIRED_FOR_PAGE_RELEASE=true

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_ATTRIBUTION_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
```

架构结论：

- canonical persistence Owner 继续是 Audit domain event contract 与 `AuditEventRepository` mapper；
- Institution attribution 的 cross-owner composition 必须位于 `src/server/orchestration`，只消费复用既有正式 Identity / Membership / Scope 链得到的 one-shot opaque pair；
- mapper 无法安全推断 institution，普通 caller 也不得自行声明 `verified`；
- S5 Phase 0 重新执行 helper 与直接 object construction 的 union search，确认 19 个生产事件构造文件跨 Institution、Platform 与 Auth，另有 10 个 transaction-bound persistence / composition 文件；遗漏的 3 个 Platform service 及其 Repository / tests 已纳入后续 caller migration，三段原子拆分结论不变；
- 当前 275 条历史记录 attribution 全为 `NULL`，没有 enforcement epoch 或 coverage metadata，因此当前页面发布契约下仍需要独立历史分类/backfill prerequisite；
- 现有列足够，且推荐边界不需要 Architecture exception。

证据：

- `docs/operations/post-v2-r1c-audit-writer-institution-attribution-split-plan-20260813.md`

唯一下一任务：

`POST-V2-R1C Audit Writer formal institution scope port fresh audit + exact Runtime admission`

<!-- POST_V2_R1C_AUDIT_WRITER_ATTRIBUTION_SPLIT_END -->

<!-- POST_V2_R1C_PAGE_SYSTEM_AUDIT_RELEASE_BLOCKER_START -->

## POST-V2-R1C `page_system_audit` 只读放行重新审计阻断（2026-08-13）

```text
POST_V2_R1C_PAGE_SYSTEM_AUDIT_RELEASE_REAUDIT=passed
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false

AUDIT_READER_SUCCESS_PATH_EXISTS=true
AUDIT_READER_READINESS=ready
AUDIT_DATA_READINESS=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false

WORKBENCH_MULTI_CAPABILITY_SAFE=false
CANONICAL_ROUTE=/hospital/system/audit
ROUTE_STRATEGY=dedicated_static_route_after_data_prerequisite
SHELL_READONLY_SAFE=true
AUDIT_READER_API_AUTHORIZATION_SAFE=true
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=false
LOW_SENSITIVE_OUTPUT_SAFE=true

BLOCKING_PREREQUISITE_COUNT=1
PRIMARY_BLOCKING_PREREQUISITE=Audit Writer institution attribution closure
BLOCKING_OWNER=src/modules/audit

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

当前架构结论：

- Institution Audit Reader 的正式成功路径已经存在，并继续强制 formal tenant + institution + `verified`；
- 本地只读证据为 275 条审计记录、0 条 `institutionId`、0 条 `verified`、275 条 attribution 为 `NULL`；
- canonical Audit Writer 仍不写入 `institutionId` / `institutionAttribution`，因此 Reader 的空结果不能构成权威空集合；
- 当前 `/hospital` 仍要求 Workbench 投影只有一条摘要，第二个可见 capability 会重现历史投影回归；
- canonical route 仍为 `/hospital/system/audit`，未来应使用 dedicated static Route，shared catch-all 继续承接 capability-off；
- Shell / client 为 GET-only 只读边界，Reader/API 授权与低敏输出已经验证，但页面的正式 system navigation authorization 与 exact capability authority 尚未验证，且两者都不能替代 data readiness；
- 当前不生成页面 Runtime Admission，不修改 Runtime、Schema、Migration、Architecture exception 或 Platform Audit。

证据：

- `docs/operations/post-v2-r1c-page-system-audit-release-reaudit-blocker-20260813.md`
- `docs/operations/post-v2-r1c-audit-reader-runtime-independent-verification-20260813.md`

唯一下一任务：

`POST-V2-R1C Audit Writer institution attribution prerequisite fresh audit + exact Runtime admission`

<!-- POST_V2_R1C_PAGE_SYSTEM_AUDIT_RELEASE_BLOCKER_END -->

<!-- POST_V2_R1C_AUDIT_READER_RUNTIME_START -->

## POST-V2-R1C 机构范围 Audit Reader Runtime 闭环（2026-08-13）

```text
POST_V2_R1C_AUDIT_READER_RUNTIME=passed
AUDIT_READER_RUNTIME_IMPLEMENTED=true
AUDIT_READER_RUNTIME_VERIFIED=true
AUDIT_READER_RUNTIME_INDEPENDENT_VERIFICATION=passed
AUDIT_READER_RUNTIME_HANDOFF_COMPLETE=true

RUNTIME_EXACT_FILE_COUNT=8
RUNTIME_PR=1169
RUNTIME_MERGE=2a45b74999784bdcf1a4777c9017ba15d2cef546

ARCHITECTURE_EXCEPTION_REQUIRED=false
DATABASE_CONNECTION_SCOPE=local_development_only
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
AUDIT_READER_DATA_READINESS=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25

PRODUCTION_READY_INFERRED=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

当前架构结论：

- PR #1169 已按正式 Admission 完成 exact 8-file Runtime，并以 Merge `2a45b749...` 进入 `main`；
- `/api/institution/audit-events` 继续位于既有 `system` Section Guard 后，由 query parser 连接 current-institution orchestration Reader；
- 可信 scope 只来自既有 one-shot opaque formal institution context，Repository 强制 tenant + institution + `verified`；
- 机构响应省略 `tenantId`，不暴露 `institutionId`、attribution 或内部错误；
- Platform Audit Route、Schema、Migration 与 Architecture exception 均未修改，AQ004 仍存在；
- 本地 PostgreSQL 只读验证通过，但 `verified` 归属数据为 0，因此 data readiness 仍为 false；
- Audit Writer attribution 与历史 backfill 均未闭环；
- Reader Foundation 完成不等于 `page_system_audit` 放行，页面仍为 `hidden/not_released`。

证据：

- `docs/operations/post-v2-r1c-audit-reader-runtime-independent-verification-20260813.md`
- `docs/operations/post-v2-r1c-audit-reader-prerequisite-admission-20260813.md`
- `docs/operations/post-v2-r1c-audit-reader-exact-runtime-allowlist-20260813.csv`

唯一下一任务：

`POST-V2-R1C page_system_audit readonly release fresh re-audit + exact Runtime admission`

<!-- POST_V2_R1C_AUDIT_READER_RUNTIME_END -->

<!-- POST_V2_R1C_ROLLBACK_VERIFY_START -->

## POST-V2-R1C 审查线程治理收尾交接同步（2026-08-13）

```text
POST_V2_R1C_EXACT4_RUNTIME_ROLLBACK=passed
POST_V2_R1C_ROLLBACK_INDEPENDENT_VERIFICATION=passed

PR1163_WORKBENCH_P1_THREAD_RESOLVED=true
PR1163_AUDIT_READER_P1_THREAD_RESOLVED=true
PR1163_TARGET_P1_UNRESOLVED_COUNT=0

POST_V2_R1C_FAILED_RELEASE_ATTEMPT_GOVERNANCE_CLOSED=true
R1B_WORKBENCH_STABLE_RUNTIME_RESTORED=true

PAGE_WORKBENCH_STATE=read_only/pilot_released
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25
CONTROLLED_CREATE_RELEASE_COUNT=0

AUDIT_READER_PREREQUISITE_MISSING=true
AUDIT_READER_RUNTIME_AUTHORIZED=false

PRODUCTION_READY_INFERRED=false
PRODUCTION_DEPLOYMENT=false
PRODUCTION_CHANGE=false

POST_V2_R1C_RELEASE_COMPLETE=false
```

当前结论：

- PR #1165 已撤回 `page_system_audit` 的错误 Runtime 放行，PR #1166 已完成回滚独立验证文档收口；
- PR #1163 两个指定 P1 审查线程均已回复并解决，目标未解决线程数为 0；
- R1C 错误放行尝试的治理收尾已经完成，但 `page_system_audit` 能力放行尚未完成，仍保持 `hidden/not_released`；
- 当前仅 `page_workbench` 为经审查接受的受治理只读页面切片，受控创建能力放行仍为 0；
- 审计读取器前置条件仍缺失，且其 Runtime 未获授权；本次不推导生产就绪，也未执行生产部署或生产变更。

证据：

- `docs/operations/post-v2-r1c-exact4-runtime-rollback-independent-verification-20260813.md`
- `docs/operations/post-v2-r1c-pr1163-thread-closure-handoff-sync-20260813.md`

唯一下一任务：

`POST-V2-R1C-AUDIT-READER institution-scoped audit readonly reader prerequisite fresh audit + exact Runtime admission`

<!-- POST_V2_R1C_ROLLBACK_VERIFY_END -->


<!-- POST_V2_R1C_REVIEW_BLOCKER_START -->

## POST-V2-R1C Runtime 独立审查阻断与回滚重新准入（2026-08-12）

```text
post_v2_r1c_runtime_implementation=passed
post_v2_r1c_runtime_independent_review=blocked
post_v2_r1c_runtime_review_blocker_count=2
post_v2_r1c_complete=false

workbench_regression_risk=true
audit_reader_prerequisite_missing=true

rollback_exact_runtime_file_count=4
rollback_runtime_authorized=false
```

证据：

- `docs/operations/post-v2-r1c-page-system-audit-runtime-independent-review-blocker-20260812.md`
- `docs/operations/post-v2-r1c-page-system-audit-rollback-exact-runtime-allowlist-20260812.csv`

唯一下一任务：

`POST-V2-R1C exact-4 Runtime rollback explicit authorization`

<!-- POST_V2_R1C_REVIEW_BLOCKER_END -->


<!-- POST_V2_R1C_READMISSION_START -->

## POST-V2-R1C `page_system_audit` 只读放行重新审计与准入（2026-08-12）

```text
post_v2_r1c_page_system_audit_reaudit=passed
post_v2_r1c_exact_runtime_admission=passed

target_capability=page_system_audit
target_route=/hospital/system/audit

exact_runtime_file_count=4
existing_runtime_file_count=3
new_runtime_file_count=1

shared_catch_all_change=false
architecture_exception_required=false

planned_decision=read_only
planned_production_release=pilot_released
planned_total_page_release_count=2

runtime_authorized=false

reader_release=true
capability_release=true
production_ready_inferred=false
production_deployment=false
```

证据：

- `docs/operations/post-v2-r1c-page-system-audit-readonly-release-readmission-20260812.md`
- `docs/operations/post-v2-r1c-page-system-audit-exact-runtime-allowlist-20260812.csv`

唯一下一任务：

`POST-V2-R1C page_system_audit readonly release exact 4-file Runtime implementation explicit authorization`

<!-- POST_V2_R1C_READMISSION_END -->


<!-- POST_V2_R1B_HANDOFF_START -->

## POST-V2-R1B `page_workbench` 只读放行交接与闭环（2026-08-12）

```text
post_v2_r1b_runtime_implementation=passed
post_v2_r1b_runtime_independent_review=passed
post_v2_r1b_independent_review_cn_fix=passed
post_v2_r1b_review_thread_closed=true

post_v2_r1b_complete=true

released_page=page_workbench
page_release_count=1
remaining_unreleased_page_count=25

reader_release=true
capability_release=true

production_ready_inferred=false
production_deployment=false

post_v2_r1c_selected_capability=page_system_audit
post_v2_r1c_selected_route=/hospital/system/audit
post_v2_r1c_runtime_authorized=false
```

证据：

- `docs/operations/post-v2-r1b-page-workbench-readonly-release-handoff-20260812.md`
- `docs/operations/post-v2-r1b-page-workbench-readonly-runtime-independent-review-20260812.md`

唯一下一任务：

`POST-V2-R1C page_system_audit readonly release re-audit + exact Runtime admission`

<!-- POST_V2_R1B_HANDOFF_END -->


<!-- POST_V2_R1B_READMISSION_START -->

## POST-V2-R1B page_workbench Readonly Release Admission（2026-08-12）

```text
post_v2_r1b_page_workbench_reaudit=passed
post_v2_r1b_exact_runtime_admission=passed

target_capability=page_workbench
target_route=/hospital

exact_runtime_file_count=5
existing_runtime_file_count=5
new_runtime_file_count=0

planned_decision=read_only
planned_production_release=pilot_released
planned_page_release_count=1

runtime_authorized=false
reader_release=false
capability_release=false
```

证据：

- `docs/operations/post-v2-r1b-page-workbench-readonly-release-readmission-20260812.md`
- `docs/operations/post-v2-r1b-page-workbench-exact-runtime-allowlist-20260812.csv`

唯一下一任务：

`POST-V2-R1B page_workbench readonly release exact 5-file Runtime implementation explicit authorization`

<!-- POST_V2_R1B_READMISSION_END -->

<!-- POST_V2_R1A_HANDOFF_START -->

## POST-V2-R1A Capability Authority Foundation Handoff（2026-08-12）

```text
post_v2_r1a_complete=true
runtime_pr=1154
independent_review_pr=1155
exact_runtime_file_count=3
cross_owner_composition=orchestration_only
page_release_count=0
reader_release=false
capability_release=false

r1b_selected_capability=page_workbench
r1b_selected_route=/hospital
r1b_runtime_authorized=false
```

唯一下一任务：

`POST-V2-R1B page_workbench readonly release re-audit + exact Runtime admission`

<!-- POST_V2_R1A_HANDOFF_END -->

<!-- POST_V2_R1A_AQ007_READMISSION_START -->

## POST-V2-R1A AQ007 Orchestration Re-admission（2026-08-11）

```text
post_v2_r1a_aq007_readmission=passed

failed_exact6_aq007_count=4

revised_exact_runtime_file_count=3
revised_existing_runtime_file_count=1
revised_new_runtime_file_count=2

cross_owner_composition=src/server/orchestration/**
architecture_exception_required=false

runtime_authorized=false
reader_release=false
capability_release=false
```

证据：

- `docs/operations/post-v2-r1a-aq007-orchestration-readmission-20260811.md`
- `docs/operations/post-v2-r1a-aq007-orchestration-exact-runtime-allowlist-20260811.csv`

唯一下一任务：

`POST-V2-R1A revised exact 3-file orchestration Capability Authority Foundation Runtime explicit authorization`

<!-- POST_V2_R1A_AQ007_READMISSION_END -->

<!-- POST_V2_R1A_PREFLIGHT_START -->

## POST-V2-R1A Capability Authority Foundation Preflight（2026-08-11）

```text
post_v2_r1a_preflight=passed

scope_authority=existing_security_request_authorization
capability_contract_change_required=false

exact_runtime_file_count=6
existing_runtime_file_count=6
new_runtime_file_count=0
architecture_exception_required=false

r1a_release_policy=hidden_only
reader_release=false
capability_release=false

runtime_authorized=false
```

证据：

- `docs/operations/post-v2-r1a-capability-authority-foundation-preflight-20260811.md`
- `docs/operations/post-v2-r1a-capability-authority-foundation-runtime-allowlist-20260811.csv`

唯一下一任务：

`POST-V2-R1A exact 6-file Capability Authority Foundation Runtime implementation explicit authorization`

<!-- POST_V2_R1A_PREFLIGHT_END -->

<!-- POST_V2_R1_READINESS_AUDIT_START -->

## POST-V2-R1 Readonly Release Readiness Audit（2026-08-11）

```text
post_v2_r1_readiness_audit=passed
post_v2_r1_page_candidate_count=26

post_v2_r1_eligible_page_count=0
post_v2_r1_blocked_page_count=26
post_v2_r1_outside_initial_readonly_release_count=0

post_v2_r1_common_authority_foundation_required=true

reader_release=false
capability_release=false
production_ready_inferred=false
```

证据：

- `docs/operations/post-v2-r1-institution-readonly-release-readiness-audit-20260811.md`
- `docs/operations/post-v2-r1-institution-readonly-release-readiness-matrix-20260811.csv`

唯一下一任务：

`POST-V2-R1A Institution Capability Authority Foundation Preflight + exact Runtime admission decision`

<!-- POST_V2_R1_READINESS_AUDIT_END -->

<!-- POST_V2_ROADMAP_REBASELINE_START -->

## Post-V2 Roadmap Re-baseline（2026-08-11）

```text
architecture_v2_refactor_complete=true
architecture_v2_target_fully_realized=false

post_v2_roadmap_rebaseline=passed
post_v2_priority_1=POST-V2-R1

post_v2_r1_name=Institution Readonly Reader/Capability Release Readiness Audit
post_v2_r1_runtime_authorized=false
post_v2_r1_reader_release_authorized=false
post_v2_r1_capability_release_authorized=false

reader_release=false
capability_release=false
production_ready_inferred=false
```

Re-baseline：

- `docs/architecture/post-v2-roadmap-rebaseline-20260811.md`
- `docs/operations/post-v2-r1-institution-readonly-release-readiness-admission-20260811.md`

唯一下一任务：

`POST-V2-R1 Institution Readonly Reader/Capability Release Readiness Audit`

<!-- POST_V2_ROADMAP_REBASELINE_END -->

<!-- ARCHITECTURE_V2_FINAL_CLOSURE_START -->

## Architecture V2 重构阶段最终闭环（2026-08-11）

```text
architecture_v2_final_closure_audit=passed
directory_refactor_complete=true
architecture_v2_document_views=6/6
business_writer_phase_complete=true

architecture_quality_unit_tests=148_passed
full_tests=6589_passed

architecture_quality_exception_count=1
active_governed_exception_count=1
stale_exception_count=0

architecture_v2_refactor_complete=true
architecture_v2_target_fully_realized=false

reader_release=false
capability_release=false
production_ready_inferred=false
production_change=false
```

最终审计：

`docs/architecture/architecture-v2-final-closure-audit-20260811.md`

六类详细架构视图继续保留其 2026-07-28 dated current/target/proposed 语义；2026-08-11 当前实现状态以代码、测试、Schema、Migration、配置和本最终审计为准。

唯一下一任务：

`Post-V2 roadmap re-baseline + next phase admission`

<!-- ARCHITECTURE_V2_FINAL_CLOSURE_END -->

<!-- BASE02_BUSINESS_WRITER_PHASE_COMPLETE_START -->

## Business Writer phase 完成（2026-08-11）

```text
business_writer_final_recompute=passed
business_writer_final_recompute_base=ca10b46c1938f29d192023e664a6f7933c5e4156

fresh_mutation_candidate_file_count=63
fresh_direct_writer_file_count=30
fresh_direct_mutation_call_count=130

unclassified_business_writer_residual=0
legacy_cross_owner_direct_writer_residual=0
unexpected_production_writer_residual=0

w2_care_complete=true
w3_knowledge_complete=true
w5_complete=true
w6_institution_system_complete=true
trial_provisioning_complete=true

business_writer_phase_complete=true
```

最终证据：

- `docs/operations/base02-business-writer-final-fresh-residual-recompute-20260811.md`
- `docs/operations/base02-business-writer-final-fresh-residual-inventory-20260811.csv`

唯一下一任务：

`Architecture V2 final closure audit + handoff`

<!-- BASE02_BUSINESS_WRITER_PHASE_COMPLETE_END -->

<!-- BASE02_TRIAL_PROVISIONING_COMPLETE_START -->

## Trial Provisioning Writer 完成（2026-08-11）

```text
w6_institution_system_complete=true

trial_provisioning_runtime_pr=1144
trial_provisioning_runtime_head=22a1b625cf04083c672920bd18f1bf556dca5870
trial_provisioning_runtime_merge=d1e56026be4f5fc7cea210a3b36860a4535ecd6c

trial_provisioning_independent_review_pr=1145
trial_provisioning_independent_review_head=eba692028df69eb553b4a600762fd31e49721b3c
trial_provisioning_independent_review_merge=9af2568bbae5fa3569a300bd5f69f7984c2cd57f

trial_provisioning_review_evidence_repair_pr=1146
trial_provisioning_review_evidence_repair_head=31ebdecce33e061e2ddb56157749988336d7137b
trial_provisioning_review_evidence_repair_merge=c0f2ca0685898931cee7e0f32a9c772ff89e2c9a

trial_provisioning_runtime_implementation=passed
trial_provisioning_runtime_independent_review=passed
trial_provisioning_review_evidence_repaired=true

trial_provisioning_runtime_file_count=2
trial_provisioning_runtime_existing_file_count=2
trial_provisioning_runtime_new_file_count=0

trial_provisioning_direct_mutation_calls=0
trial_provisioning_direct_writer_files=0
trial_provisioning_db_access=0
trial_provisioning_production_callers=0
trial_provisioning_route_callers=0

trial_provisioning_legacy_service_blocked=true
trial_provisioning_dynamic_blockade_test_embedded=true
trial_provisioning_canonical_migration_required=false
trial_provisioning_production_activation=false

customers_canonical_runtime_change=false
care_canonical_runtime_change=false
tenancy_provisioning_change=false
architecture_rules_change=false
architecture_exception_added=false

trial_provisioning_targeted_test_files=4
trial_provisioning_targeted_tests=30
trial_provisioning_full_test_files=489
trial_provisioning_full_tests=6589
trial_provisioning_typecheck=passed
trial_provisioning_lint=passed
trial_provisioning_build=passed
trial_provisioning_architecture_unit_tests=148
trial_provisioning_architecture_incremental=passed
trial_provisioning_required_check=passed

trial_provisioning_complete=true
business_writer_phase_complete=false
```

唯一下一任务：

`Full-repo Business Writer fresh residual recompute + phase completion decision`

<!-- BASE02_TRIAL_PROVISIONING_COMPLETE_END -->

<!-- BASE02_W6B_CREDENTIAL_COMPENSATION_COMPLETE_START -->

## W6B Credential Compensation / W6 Institution System 完成（2026-08-11）

```text
w6a_complete=true

w6b_domain_ownership_audit=passed
w6b_port_ownership_audit=passed
w6b_state_machine_cas_audit=passed
w6b_coordination_boundary_audit=passed

w6b_implementation_pr=1138
w6b_implementation_head=d9d8df2056d8c843fe66f47d6964e9b36eb261d4
w6b_implementation_merge=89f20a63b18f120c8bd430d3a4a6e8ac7d88e12c
w6b_independent_review_pr=1139
w6b_independent_review_head=8f46279745b08bbff3b682dad9cf116e22cc445d
w6b_independent_review_merge=038e7665f21f4f78e868769d42371c3e09d61ca8

w6b_runtime_implementation=passed
w6b_runtime_independent_review=passed
w6b_complete=true

w6b_runtime_file_count=18
w6b_nineteenth_runtime_file_change=false
w6b_canonical_owner=institution-system
w6b_production_writer_files=2
w6b_canonical_direct_mutation_calls=4
w6b_legacy_direct_mutation_calls=0
w6b_operation_state_cas=true
w6b_job_state_and_claim_version_cas=true
w6b_legacy_operation_factory_blocked=true
w6b_legacy_job_factory_blocked=true
w6b_legacy_worker_blocked=true
w6b_canonical_worker_uses_ports=true
w6b_canonical_worker_database_transaction=false
w6b_canonical_production_activation=false

w6_institution_system_complete=true

trial_provisioning_classification=separate_provisioning_review
trial_provisioning_review=pending
business_writer_phase_complete=false
```

唯一下一任务：

`Trial Provisioning Writer fresh residual audit + ownership classification / closure decision`

<!-- BASE02_W6B_CREDENTIAL_COMPENSATION_COMPLETE_END -->

<!-- BASE02_W6A_HIS_CONNECTION_CORE_COMPLETE_START -->

## W6A HIS Connection Core Writer 完成（2026-08-11）

```text
w5_complete=true

w6_symbol_callgraph_audit=passed
w6_transaction_audit=passed
w6_decomposition_frozen=true
w6_canonical_owner=institution-system

w6a_his_connection_core_admission=passed
w6a_implementation_pr=1134
w6a_implementation_head=58ccffcd156f1f980a964558dc39f987c31f954a
w6a_implementation_merge=f7a90c35c8b51c71d2978b0f844380e5b6b15103
w6a_independent_review_pr=1135
w6a_independent_review_head=9e6cbeb2b211b299b2169edc8c017990c8e1377c
w6a_independent_review_merge=10ac1cb90187f46567db3473025c4428b371c7ff

w6a_runtime_implementation=passed
w6a_runtime_independent_review=passed
w6a_complete=true

w6a_runtime_file_count=16
w6a_production_his_connection_writer_files=1
w6a_canonical_his_connection_mutation_calls=6
w6a_legacy_his_connection_direct_mutations=0
w6a_legacy_writer_blocked=true
w6a_legacy_readers_preserved=3
w6a_production_services_rewired=4
w6a_test_connection_fake_provider_retained=true

w6b_compensation_audit=passed
w6b_direct_mutation_calls=4
w6b_direct_writer_files=2
w6b_active_production_factory_constructors=0
w6b_worker_uses_injected_ports=true
w6b_runtime_allowlist_frozen=false
w6b_runtime_authorized=false
w6b_blocked_pending_domain_port_ownership_admission=true

w6_institution_system_complete=false
trial_provisioning_classification=separate_provisioning_review
business_writer_phase_complete=false
```

唯一下一任务：

`W6B Credential Compensation domain/port ownership audit + exact Runtime allowlist admission`

<!-- BASE02_W6A_HIS_CONNECTION_CORE_COMPLETE_END -->

<!-- BASE02_W5_ANALYTICS_COMPLETE_START -->

## W5 Analytics Writer 完成（2026-08-11）

```text
w3_knowledge_complete=true

w5_analytics_admission=passed
w5_implementation_pr=1130
w5_implementation_head=82e4cba5bfe81814dc9cef7a38eed8ebe4fb4c05
w5_implementation_merge=182b9fb6e2fbd730153b5ce536e826141ab03bce
w5_independent_review_pr=1131
w5_independent_review_head=13b54011598ce9bf2ac4de2c52ede1a69bea6e12
w5_independent_review_merge=0f4f62197ad2929653f4341d783e00f4a954505a

w5_runtime_implementation=passed
w5_runtime_independent_review=passed
w5_complete=true

w5_canonical_owner=analytics
w5_runtime_file_count=6
w5_canonical_direct_insert_calls=1
w5_canonical_append_only=true
w5_legacy_writer_blocked=true
w5_legacy_direct_insert_calls=0
w5_legacy_read_compatibility=true
w5_active_production_writer_callers=0
w5_caller_rewire_files=0
w5_institution_ai_write_route_capability_off=true

w6_institution_system_state=pending_symbol_callgraph_admission
w6_baseline_candidate_count=5
w6_baseline_writer_candidate_count=4
w6_runtime_authorized=false

trial_provisioning_classification=separate_provisioning_review
business_writer_phase_complete=false
```

唯一下一任务：

`W6 Institution System Writer symbol/callgraph audit + exact implementation allowlist admission`

<!-- BASE02_W5_ANALYTICS_COMPLETE_END -->

<!-- BASE02_W3_KNOWLEDGE_COMPLETE_START -->

## W3 Knowledge Writer 完成（2026-08-10）

```text
w3_knowledge_admission=passed
w3_decomposition_frozen=true
w3a_complete=true

w3b_implementation_pr=1126
w3b_implementation_head=1e02824c969c81ce69208f68fb036ce0f5660951
w3b_implementation_merge=1e078da73e5b215c58751d7913b0856def1bd620
w3b_independent_review_pr=1127
w3b_independent_review_head=c6f6d192f584ddaac388d295379de88d44792493
w3b_independent_review_merge=8fb1abaffc43e7ccadbefc7f026cce938bd15b67
w3b_complete=true

knowledge_canonical_owner=knowledge
w3b_runtime_file_count=13
w3b_fourteenth_runtime_file_change=false
w3b_explicit_tenant_institution_scope=true
w3b_tenant_scope_persists_institution_id_null=true
w3b_canonical_quota_append_only=true
w3b_legacy_quota_writer_blocked=true
w3b_legacy_quota_direct_mutation=0
w3b_legacy_production_runtime_importers=0
w3b_production_callers_rewired=3

w3_knowledge_complete=true

w5_analytics_state=pending_symbol_callgraph_admission
w5_baseline_candidate_count=1
w5_runtime_authorized=false
w6_institution_system=pending
trial_provisioning_classification=separate_provisioning_review
business_writer_phase_complete=false
```

唯一下一任务：

`W5 Analytics Writer symbol/callgraph audit + exact implementation allowlist admission`

<!-- BASE02_W3_KNOWLEDGE_COMPLETE_END -->

<!-- BASE02_W2_P2C_MESSAGE_DRAFT_CONTROLLED_REACHOUT_RUNTIME_START -->

## W2-P2C Message Draft / Controlled Reach-out Runtime（2026-08-10）

```text
implementation_pr=1119
implementation_head=94b86756b5e1db2515aec2de22082678422ed1d9
implementation_merge=9ee6413b0b302d89cb1eaec9a9209373afb7697f
independent_review_pr=1120
independent_review_head=eb46fd5a41608f76ad37018f2e0eaf7e7e59f3d1
independent_review_merge=2e7f0dd5f44c957d6aca204290852f254256f9e6

w2_p2c_runtime_implementation=passed
w2_p2c_runtime_independent_review=passed
w2_p2c_complete=true

runtime_file_count=17
eighteenth_runtime_file_change=false
governance_exception_change=false

canonical_owner=care
legacy_p2c_writers_blocked=6
tenant_business_message_draft_direct_mutation=0
server_side_tenant_institution_scope=true
draft_create_task_for_update=true
draft_lifecycle_expected_updated_at_cas=true
controlled_reachout_expected_metadata_json_cas=true
approval_timeline_audit_atomicity=true
controlled_reachout_cross_owner_transaction=true
real_wecom_send=false

w2_p2a_complete=true
w2_p2b_complete=true
w2_p2c_complete=true
w2_p2_complete=true
w2_care_complete=true

trial_provisioning_classification=separate_provisioning_review
ordinary_business_dual_write=false
business_writer_phase_complete=false
```

下一任务：

`Post-W2 Care business-writer fresh residual recompute / next-slice admission`

<!-- BASE02_W2_P2C_MESSAGE_DRAFT_CONTROLLED_REACHOUT_RUNTIME_END -->

<!-- BASE02_W2_P2B_FOLLOWUP_PATH_TIMELINE_RUNTIME_START -->

## W2-P2B Follow-up Task / Path / Timeline Runtime（2026-08-10）

```text
implementation_pr=1116
runtime_head=36a1c4744dadd9b5d888d7fbafa08f9cabc37cef
implementation_head=022b3ae2a831e8f912d4cbc0144d63450411945b
implementation_merge=615793eb4e5e741490553461e0accc23ef74b174
independent_review_pr=1117
independent_review_merge=01730361655939aa741c73e57ff5b770fba20407

w2_p2b_runtime_implementation=passed
w2_p2b_aq004_governance_recovery=passed
w2_p2b_runtime_independent_review=passed
w2_p2b_complete=true

runtime_file_count=12
governance_exception_file_count=1
total_changed_file_count=13
thirteenth_runtime_file_change=false

aq004_exception_path=src/modules/institution/server/followup-path-enrollment-transaction.ts
aq004_exception_owner=care
aq004_exception_review_condition=remove_when_legacy_institution_compatibility_delegate_exits

canonical_owner=care
server_side_tenant_institution_scope=true
task_transition_status_observed_updated_at_cas=true
path_cancel_active_observed_updated_at_cas=true
path_bundle_atomicity=true
required_timeline_atomicity=true
typed_timeline_source_guard=true
legacy_p2b_writers=blocked

post_p2b_residual_mutation_calls=6
post_p2b_residual_writer_methods=6
post_p2b_residual_fact_tables=1

p2c_exact_runtime_file_count=17
p2c_runtime_authorized=false

trial_provisioning_classification=separate_provisioning_review
ordinary_business_dual_write=false

w2_care_complete=false
business_writer_phase_complete=false
```

下一任务：

`W2-P2C Message Draft / Controlled Reach-out exact 17-file Runtime implementation explicit authorization`

<!-- BASE02_W2_P2B_FOLLOWUP_PATH_TIMELINE_RUNTIME_END -->

<!-- BASE02_W2_P2A_APPOINTMENTS_RUNTIME_START -->

## W2-P2A Appointments Runtime（2026-08-09）

```text
implementation_pr=1113
implementation_head=3b32f624c254610ecddcf0b662af2420f31a5df5
implementation_merge=25ae7a47f466255590cbe20f35d4243f9145442e
independent_review_pr=1114
independent_review_merge=a40fb54fe7b8816df8ad07d69cecd737ca9385fa

w2_p2a_runtime_implementation=passed
w2_p2a_runtime_independent_review=passed
w2_p2a_complete=true

canonical_owner=care
server_side_tenant_institution_scope=true
expected_updated_at_cas=true
legacy_appointment_writer=blocked
legacy_read_compatibility=retained
appointments_route_capability_off=true

post_p2a_residual_mutation_calls=13
post_p2a_residual_writer_methods=13
post_p2a_residual_fact_tables=5

p2b_exact_runtime_file_count=12
p2b_runtime_authorized=false
p2c_exact_runtime_file_count=17
p2c_runtime_authorized=false

trial_provisioning_classification=separate_provisioning_review
ordinary_business_dual_write=false

w2_care_complete=false
business_writer_phase_complete=false
```

下一任务：

`W2-P2B Follow-up Task / Path / Timeline exact 12-file Runtime implementation explicit authorization`

<!-- BASE02_W2_P2A_APPOINTMENTS_RUNTIME_END -->

<!-- BASE02_W2_P2_CARE_FOLLOWUP_ADMISSION_START -->

## W2-P2 Care / Follow-up Writer Admission（2026-08-09）

```text
admission_pr=1110
admission_merge=762aa5e4cb0f22c8b296d366be51363e9bf508a5
independent_review_pr=1111
independent_review_merge=0f5afa641ce276839a45fb2c8ec440233c1c9134

fresh_mutations=15
fresh_writer_methods=15
fresh_fact_tables=6
fresh_production_callers=5
transaction_groups=14

canonical_owner=care
timeline_evidence_owner=care
audit_owner_unchanged=true
messaging_reachout_owner_unchanged=true

p2a_exact_file_count=6
p2b_exact_file_count=12
p2c_exact_file_count=17
aggregate_unique_file_count=28

w2_p2_decomposition_frozen=true
w2_p2_runtime_authorized=false

trial_provisioning_classification=separate_provisioning_review
trial_provisioning_w2_p2_direct_mutations=2
ordinary_business_dual_write=false

w2_care_complete=false
business_writer_phase_complete=false
```

下一任务：

`W2-P2A Appointments exact 6-file Runtime implementation explicit authorization`

<!-- BASE02_W2_P2_CARE_FOLLOWUP_ADMISSION_END -->

<!-- BASE02_W2_P1_TREATMENT_SUMMARY_RUNTIME_CLOSURE_START -->

## W2-P1 Treatment Summary Runtime Closure（2026-08-09）

```text
implementation_pr=1106
implementation_merge=3679122f2ea11079660cc16a7d9871f619c81386
independent_review_pr=1107
independent_review_merge=ac66266c78c9e1263959812cbcfc8b7ac9bc632d
w2_p1_owner=care
w2_p1_complete=true
provisioning_treatment_summary_writer_review_pending=true
ordinary_business_dual_write=false
w2_p2_residual_mutation_calls=15
w2_p2_residual_writer_methods=15
w2_p2_production_callers=5
w2_p2_residual_fact_tables=6
w2_p2_runtime_authorized=false
w2_care_complete=false
business_writer_phase_complete=false
```

下一任务：`W2-P2 Care / Follow-up residual Writer transaction/callgraph admission`

<!-- BASE02_W2_P1_TREATMENT_SUMMARY_RUNTIME_CLOSURE_END -->

<!-- BASE02_W2_CARE_WRITER_ADMISSION_START -->

## W2 Care Writer Admission（2026-08-09）

```text
admission_pr=1103
admission_merge=ee724072af16d75b834ed387c66805e4423809e8
independent_review_pr=1104
independent_review_merge=db76e651475fab56f7fdd5af41622b2810846a14
w2_decomposition_frozen=true
w2_p1_owner=care
w2_p1_exact_runtime_allowlist_file_count=6
w2_p1_runtime_authorized=false
w2_p2_runtime_allowlist_frozen=false
w2_p2_runtime_authorized=false
w2_care_complete=false
business_writer_phase_complete=false
```

下一任务：`W2-P1 Treatment Summary exact 6-file Runtime implementation explicit authorization`

<!-- BASE02_W2_CARE_WRITER_ADMISSION_END -->

<!-- BASE02_W1C_COMPLETE_START -->

## W1C Customers / Messaging Writer Closure（2026-08-09）

```text
implementation_pr=1099
implementation_merge=d189ffe0998bf30ba32a47ed47a5c078614004e0
independent_review_pr=1100
independent_review_merge=1b2bd20c00537dc5ee527bc8a206f1b3a0aae3f0

w1c_p2_complete=true
w1c_complete=true
w1_customers_messaging_complete=true

frequency_single_direct_writer=true
audit_event_owner=audit
operation_frequency_audit_same_transaction=true
legacy_safety_direct_writer=blocked
legacy_real_send_direct_frequency_audit_writer=removed

business_writer_phase_complete=false
business_writer_post_w1c_pending_review_files=18

next_writer_slice=W2_CARE
w2_care_runtime_authorized=false
reader_release=false
capability_release=false
```

下一任务：

`W2 Care Writer symbol/callgraph audit + exact implementation allowlist admission`

<!-- BASE02_W1C_COMPLETE_END -->

<!-- BASE02_W1C_P2_OWNER_ATOMICITY_ADMISSION_START -->

## W1C-P2 Owner / Atomicity Admission（2026-08-08）

```text
admission_pr=1096
admission_merge=c66065762cda1c67874df3cc00e53cc773f9fd2b
independent_review_pr=1097
independent_review_merge=437108309149ab7fdae3491ad47eaeed78210ca9

reachout_fact_owner=messaging
audit_event_owner=audit
frequency_single_writer=true
frequency_writer_path=src/modules/messaging/server/wecom-reachout-command-repository.ts

transaction_composition_root=src/server/orchestration/wecom-reachout-transaction.ts
operation_frequency_audit_same_transaction=true

exact_runtime_allowlist_file_count=12
w1c_p2_runtime_authorized=false
w1c_complete=false
business_writer_phase_complete=false
```

下一任务：

`W1C-P2 Safety + Real-send exact 12-file Runtime implementation explicit authorization`

<!-- BASE02_W1C_P2_OWNER_ATOMICITY_ADMISSION_END -->

<!-- BASE02_W1C_P1_BROADCAST_RUNTIME_CLOSURE_START -->

## W1C-P1 Broadcast Outcome Runtime Closure（2026-08-08）

```text
implementation_pr=1093
implementation_merge=24e5c44888963e1a2de00cd2093a2d619385b419
independent_review_pr=1094
independent_review_merge=45b433013d237f74ce0e3d8df385ed8bbc80fac2
exact_file_count=6
canonical_owner=messaging
same_fact_source=weComCustomerBroadcastTaskProviderAttempts
full_scope_attribution_enforced=true
expected_version_cas_enforced=true
not_finalized_guard_enforced=true
legacy_read_draft_scope_compatibility=retained
legacy_parallel_writer=blocked
w1c_p1_complete=true
w1c_complete=false
business_writer_phase_complete=false
w1c_p2_runtime_authorized=false
reader_release=false
capability_release=false
```

下一任务：`W1C-P2 Safety + Real-send atomicity / Owner decision admission`

<!-- BASE02_W1C_P1_BROADCAST_RUNTIME_CLOSURE_END -->

<!-- BASE02_W1C_WRITER_ADMISSION_START -->

## W1C Writer Admission（2026-08-08）

```text
w1c_symbol_audit=passed
w1c_callgraph_audit=passed
w1c_atomicity_audit=passed
w1c_runtime_decomposition=frozen

w1c_p1_broadcast_exact_allowlist=frozen
w1c_p1_broadcast_exact_allowlist_file_count=6
w1c_p1_broadcast_runtime_authorized=false

w1c_p2_safety_real_send_blocked_pending_decision=true
w1c_p2_exact_runtime_allowlist_not_frozen=true
w1c_p2_runtime_authorized=false
```

关键原因：

`customerChannelFrequencyStates` 当前同时由 Safety 与 Real-send 写入；Real-send 还直接写 `auditEvents`，因此 P2 必须先冻结单一 Owner 与 transaction atomicity。

下一任务：`W1C-P1 Broadcast Outcome exact 6-file Runtime implementation explicit authorization`

<!-- BASE02_W1C_WRITER_ADMISSION_END -->

<!-- BASE02_W1B_WECOM_MAPPING_RUNTIME_CLOSURE_START -->

## W1B WeCom Mapping Runtime Closure（2026-08-08）

```text
implementation_pr=1087
implementation_merge=7caab67f111737607d918cb6f8b4e0e27de10d34
independent_review_pr=1088
independent_review_merge=6683f94899920e1e5d4eac916a6d8d2afcbd046b

exact_file_count=6
canonical_owner=messaging
same_fact_source=weComCustomerMappingStates
tenant_institution_proof_scope_enforced=true
expected_customer_status_guard_enforced=true
legacy_mapping_read_compatibility=retained
legacy_mapping_parallel_writer=blocked

w1b_complete=true
business_writer_phase_complete=false

mapping_route_capability_off=true
reader_release=false
capability_release=false
w1c_runtime_change=false
```

下一任务：

`W1C Trusted Reach-out / Broadcast / Real-send evidence Writer symbol audit + exact implementation allowlist admission`

<!-- BASE02_W1B_WECOM_MAPPING_RUNTIME_CLOSURE_END -->

<!-- BASE02_W1B_WECOM_MAPPING_ADMISSION_START -->

## W1B WeCom Mapping Writer Admission（2026-08-08）

```text
w1b_symbol_audit=passed
w1b_callgraph_audit=passed
w1b_canonical_owner=messaging
w1b_exact_allowlist_file_count=6
w1b_exact_allowlist=frozen
w1b_runtime_implementation_authorized=false
mapping_route_capability_off=true
w1c_read_consumer_protected=true
schema_change_required=false
migration_required=false
```

下一任务：`W1B WeCom Mapping exact 6-file Runtime implementation explicit authorization`

<!-- BASE02_W1B_WECOM_MAPPING_ADMISSION_END -->

<!-- BASE02_W1A_CUSTOMERS_CORE_RUNTIME_CLOSURE_START -->

## W1A Customers Core Runtime Closure（2026-08-08）

```text
implementation_pr=1081
implementation_merge=44c10fd548ae1881033ed0dc5f8947178be2edcc
independent_review_pr=1082
independent_review_merge=849571c10ed56b8797cea758416289870d92262c
exact_file_count=6
customers_canonical_application_service=true
customers_canonical_writer_repository=true
tenant_institution_attribution_enforced=true
cross_institution_mutation_fail_closed=true
legacy_customer_parallel_writer_disabled=true
w1a_customers_core_complete=true
business_writer_phase_complete=false
customers_route_capability_off=true
reader_release=false
capability_release=false
```

下一任务：`W1B Customer Channel / WeCom Mapping Writer symbol audit + exact implementation allowlist admission`

<!-- BASE02_W1A_CUSTOMERS_CORE_RUNTIME_CLOSURE_END -->

<!-- BASE02_W1A_CUSTOMERS_CORE_ADMISSION_START -->

## W1A Customers Core Writer Admission（2026-08-08）

```text
w1_symbol_audit=passed
w1_true_db_writer_files=7
w1_false_positive_files=5
w1a_exact_allowlist_file_count=6
w1a_runtime_implementation_authorized=false
customers_route_capability_off=true
reader_release=false
capability_release=false
```

下一任务：W1A exact allowlist Runtime implementation explicit authorization。

<!-- BASE02_W1A_CUSTOMERS_CORE_ADMISSION_END -->

<!-- BASE02_BUSINESS_WRITER_ADMISSION_START -->

## post-BASE02 Business Writer Admission（2026-08-08）

```text
base02_complete=true
business_writer_admission=passed
static_writer_inventory=complete
total_mutation_candidate_files=75
business_writer_surface_files=27
bypass_surface_review_files=3
vertical_slice_matrix=frozen
business_writer_implementation_authorized=false
reader_release=false
capability_release=false
physical_fk_strategy_resolved=false
fk_validate=false
first_recommended_slice=W1_CUSTOMERS_MESSAGING
```

下一任务：

`W1_CUSTOMERS_MESSAGING first vertical slice exact implementation allowlist / authorization decision`

<!-- BASE02_BUSINESS_WRITER_ADMISSION_END -->

<!-- BASE02_B6_COMPLETION_START -->

## BASE-B6 / BASE-02 Completion（2026-08-08）

```text
base_b1_complete=true
base_b2_complete=true
base_b3_complete=true
base_b4_complete=true
base_b5_complete=true
base_b6_completion_audit=passed
base_b6_independent_review=passed

base02_complete=true

active_authorization_orphan_count=0
active_scope_relation_orphan_count=0
retained_revoked_historical_relation_orphan_count=1

reader_release=false
capability_release=false

physical_fk_strategy_resolved=false
fk_validate=false
```

Option 1 supersedes BASE-B6 的旧 all-row relation-orphan=0 业务完成口径，但不自动放行 Reader/MIG-01C/FK VALIDATE。

下一任务：

`BASE-02 post-closure business Writer dual-write / old Writer blockade admission`

<!-- BASE02_B6_COMPLETION_END -->

<!-- BASE02_B5_EXECUTION_CLOSURE_START -->

## BASE-B5 Execution 最终收口（2026-08-08）

```text
execute_attempt_count=1
execute_status=applied_verified
outcome_classification=committed
independent_postcheck=passed
automatic_retry=false
second_execute=false

active_authorization_orphan_count=0
active_scope_relation_orphan_count=0
retained_revoked_historical_relation_orphan_count=1

base_b5_complete=true
base02_complete=false

physical_fk_strategy_resolved=false
fk_validate=false
```

下一任务：

`BASE-B6 BASE-02 completion audit、Option 1 supersession reconciliation 与 physical FK terminal strategy preplanning`

<!-- BASE02_B5_EXECUTION_CLOSURE_END -->

<!-- BASE02_B5_TRANSFER_RUNNER_IMPLEMENTATION_CLOSURE_START -->

## BASE-B5 Controlled Runner 实现收口（2026-08-08）

- Implementation PR：#1067 / `10bcaf1a7609512d32e71a212809060d91afec03`；
- Independent Review：#1068 / `d5de0603f2bde493b90939fb35522c02e5c8c1be`；
- exact files：2；
- controlled execution entry：present；
- runner type：one-shot CLI；
- database execution：未授权；
- local_acceptance dry-run：未执行；
- future manifest code SHA：绑定 Handoff 后 reviewed clean main HEAD；
- 下一任务：readonly preflight + private manifest + dry-run 独立授权。

<!-- BASE02_B5_TRANSFER_RUNNER_IMPLEMENTATION_CLOSURE_END -->

<!-- BASE02_B5_TRANSFER_RUNNER_ADMISSION_START -->

## BASE-B5 Controlled Execution Runner 准入（2026-08-08）

- runner type：one-shot CLI；
- exact allowlist：2 files；
- secure manifest：required；
- execute lease：required；
- local_acceptance only：true；
- dry-run readonly only：true；
- outcome unknown auto-retry：0；
- FK VALIDATE：forbidden；
- implementation：未授权；
- database execution：未授权；
- 下一任务：2-file runner 最小实现授权与执行。

<!-- BASE02_B5_TRANSFER_RUNNER_ADMISSION_END -->

<!-- BASE02_B5_TRANSFER_IMPLEMENTATION_CLOSURE_START -->

## BASE-B5 Cross-Tenant Transfer 4-file 实现收口（2026-08-08）

- Implementation PR：#1061 / `633f77415ea74e3456f528e650de28198cd30da9`；
- Independent Review：#1062 / `c8edb5a95cc88abb85647b9dadc34b3f4b941aff`；
- exact files：4；
- AQ007：passed；
- direct Tenancy server dependency：0；
- composition root/API/runner wiring：0；
- database execution：未授权；
- 下一任务：controlled execution runner 准入与 exact allowlist 冻结。

<!-- BASE02_B5_TRANSFER_IMPLEMENTATION_CLOSURE_END -->


<!-- BASE02_B5_TRANSFER_IMPLEMENTATION_ADMISSION_START -->

## BASE-B5 Cross-Tenant Transfer 实现准入（2026-08-07）

- implementation admission：passed；
- exact allowlist：4 files；
- new application service：1；
- new server transaction：1；
- new tests：2；
- Schema/Migration/AQ008/Writer/Port/composition root change：0；
- actual implementation authorized：false；
- DB execution authorized：false；
- 下一任务：4-file 最小实现授权与执行。

<!-- BASE02_B5_TRANSFER_IMPLEMENTATION_ADMISSION_END -->

<!-- BASE02_B5_RELATION_ORPHAN_ADR_START -->

## BASE-B5 relation-orphan 终态 ADR（2026-08-07）

- accepted option：1；
- M09-A immutable/no-delete：preserved；
- active authorization orphan：must be 0；
- active Scope relation orphan：must be 0；
- revoked + evidence-complete historical relation orphan：expected retained count 1；
- XT09：resolved_by_adr；
- XT10：execution_still_required；
- implementation/execution：未授权；
- 下一任务：cross-tenant transfer orchestration 实现准入与 exact allowlist 冻结。

<!-- BASE02_B5_RELATION_ORPHAN_ADR_END -->

<!-- BASE02_B5_XT_DECISION_START -->

## BASE-B5 Cross-Tenant Transfer 决策状态（2026-08-07）

- XT01–XT08：accepted / preplanning admitted；
- XT09：blocked_invariant_conflict；
- XT10：blocked_by_xt09；
- planned transfer：target create + source revoke；
- existing same-tenant rebind：保持不变；
- implementation authorized：false；
- execution authorized：false；
- BASE-B5 success criteria conflict：true；
- Reader／Capability：继续关闭；
- 下一任务：relation-orphan 终态处置与成功标准 ADR 决策。

<!-- BASE02_B5_XT_DECISION_END -->

<!-- BASE02_B5_CROSS_TENANT_BLOCKER_START -->

## BASE-B5 跨 tenant Membership 前置阻断（2026-08-07）

- 目标 Scope 业务关联：已确认；
- A2-P1 Triplet canonical digest：匹配；
- selected branch：`B5_DETERMINISTIC_REBIND`；
- historical orphan 与目标 Scope tenant：不一致；
- target tenant Membership：0；
- same-account target-tenant active Binding：0；
- current rebind cross-tenant support：false；
- execution ready：false；
- remediation／database write／Reader／Capability：未授权；
- 下一任务：跨 tenant Membership 权威决策与重绑语义准入。

<!-- BASE02_B5_CROSS_TENANT_BLOCKER_END -->

<!-- BASE02_B5_DETERMINISTIC_REBIND_ADMISSION_START -->

## BASE-B5 确定性重绑权威依据准入（2026-08-07）

- authority evidence submitted／admitted：`1／1`；
- admitted branch：`B5_DETERMINISTIC_REBIND`；
- live readonly reprobe：required，未执行；
- remediation／database／DML：未授权；
- Reader／Capability／BASE-02：继续关闭；
- 下一任务：执行受控 live readonly reprobe。

<!-- BASE02_B5_DETERMINISTIC_REBIND_ADMISSION_END -->

<!-- BASE02_B5_NO_AUTHORITY_SUBMISSION_START -->

## BASE-B5 无权威业务依据输入提交（2026-08-06）

- input submission received：`1`；
- input validation：`passed`；
- authority evidence submitted／admitted：`0／0`；
- selected branch：`B5_KEEP_BLOCKED`；
- live readonly reprobe：未执行；
- remediation／database／Reader／Capability：未授权；
- 下一任务：取得并提交可核验仓库外权威业务依据。

<!-- BASE02_B5_NO_AUTHORITY_SUBMISSION_END -->


<!-- BASE02_B5_EVIDENCE_INTAKE_START -->

## BASE-B5 仓库外权威业务依据提交契约（2026-08-06）

- contract／template：`ready／ready`；
- authority evidence submitted／admitted：`0／0`；
- selected branch：`B5_KEEP_BLOCKED`；
- remediation／database／Reader／Capability：未授权。

<!-- BASE02_B5_EVIDENCE_INTAKE_END -->

<!-- BASE02_B5_DECISION_GATE_START -->

## BASE-B5 historical orphan 权威处置决策门（2026-08-06）

- 权威证据提交／准入：`0／0`；
- 选择分支：`B5_KEEP_BLOCKED`；
- BASE-B5：started，未完成；
- remediation：未授权；
- live readonly reprobe：required，未执行；
- Reader／Capability／BASE-02 complete：false；
- 决策记录：[`../operations/base02-b5-historical-orphan-authoritative-decision-20260806.md`](../operations/base02-b5-historical-orphan-authoritative-decision-20260806.md)；
- 证据准入：[`../operations/base02-b5-historical-orphan-authority-evidence-admission-20260806.md`](../operations/base02-b5-historical-orphan-authority-evidence-admission-20260806.md)；
- 独立审查：[`../operations/base02-b5-historical-orphan-authority-decision-independent-review-20260806.md`](../operations/base02-b5-historical-orphan-authority-decision-independent-review-20260806.md)。

<!-- BASE02_B5_DECISION_GATE_END -->

- 任务：BASE-02 ULTRA Binding provenance accepted decision handoff（无正式 `V2-*` 编号）
- 日期：`2026-08-02 CST +0800`
- 审计基线：`85bac25f48f930f260dbed2ac9b8dd16b23cbe68`
- 状态：`current evidence + BASE-B2 binding provenance handoff`
- 文档性质：架构导航索引，不是第二套架构事实源
- 本次 BASE-B2 仅文档 handoff 差异中的 Runtime、Schema、Migration、journal、snapshot、数据库、API、UI 修改：`0`

## 1. 文档定位

本文件是 `docs/architecture/` 的统一导航入口，负责说明每份架构文档的权威级别、状态、适用范围和阅读顺序。

它不重新定义模块所有权、Migration 顺序、权限模型或发布门禁。项目总体目标架构继续由 [`architecture-v2.md`](./architecture-v2.md) 统一约束；当前代码、测试、Schema、Migration 和配置始终优先于文档描述。

## 2. 事实依据顺序

发生冲突时，按以下顺序处理：

1. 当前 `main` 的代码、测试、Schema、Migration 和配置；
2. [`architecture-v2.md`](./architecture-v2.md) 与已接受 ADR 决定最高级 `target` 约束；
3. 专项 accepted 决策记录只在既有 `target` 内解释用户选择；模块映射、架构视图、代码证据审计和本索引负责展开、导航与核验；
4. 七线技术计划、已合并 PR 和交接文档负责记录实施状态与历史；
5. 历史草案、旧系统和旧对话记录。

低优先级资料只能用于解释历史原因，不能覆盖当前实现或已接受决策。发现冲突时应记录差异、提出 ADR 或预检任务，不得静默修改权威结论。

## 3. 文档状态词

| 状态 | 含义 | 使用规则 |
|---|---|---|
| `current` | 描述当前 `main` 可验证的事实 | 必须能够追溯到代码、测试、Schema、Migration 或已合并记录 |
| `target` | 已接受的目标边界 | 不表示已经实施，也不自动授权 runtime 或数据变更 |
| `proposed` | 待确认的建议 | 形成 ADR 或明确授权前不得写成已完成事实 |
| `planned` | 已安排但尚未创建或实施 | 只能用于导航和阶段计划 |
| `historical` | 历史设计或过程证据 | 不再作为当前开发入口 |

同一份文档可以同时包含 `current` 和 `target` 内容，但每个重要结论必须明确属于哪一种状态。

## 4. 当前架构摘要

智美天工当前采用模块化单体，处于新领域边界与旧聚合 runtime 并存的过渡期。

目标架构统一为：

```text
SaaS 控制平面
+ 机构业务数据平面
+ 应用入口层
+ 业务模块层
+ 公共基础设施层
+ 外部适配器层
+ 单一 PostgreSQL／Drizzle 数据治理序列
```

机构端七条业务线为：

```text
工作台
客户中心
会话工作台
预约与随访
知识库
经营分析
管理中心
```

当前正式发布为 `0/7`。领域模型、契约、测试、Demo、Mock、旧 API 或 capability-off 页面均不能单独证明业务已经上线。

数据库演进顺序保持：

```text
MIG-01A1 Expand
→ MIG-01A2 锚点 provisioning
→ BASE-02B／BASE-02 双键上下文、scope revision、Guard
→ 全部 Writer 双写与旧 Writer 封堵
→ Audit／模板保护
→ MIG-01B 确定性回填、追赶和冲突清零
→ MIG-01C 非空、外键、attribution 与 shape enforce
→ Reader 重新核验与独立放行
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

## 5. 当前架构文档

| 文档 | 状态 | 职责 |
|---|---|---|
| [`architecture-v2.md`](./architecture-v2.md) | `target` | 总体目标架构、模块边界、写入政策、Migration 所有权和实施主序列 |
| [`architecture-v2-module-map.md`](./architecture-v2-module-map.md) | `target` | 当前路径到目标所有者和目标路径的映射 |
| [`institution-seven-stream-restart-baseline.md`](./institution-seven-stream-restart-baseline.md) | `current + target` | 七线完成度、依赖、发布门禁和重启顺序 |
| [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md) | `current + proposed` | 用当前代码、Schema、测试和历史 PR 对 V2 进行独立核验 |
| [`v2-02b-mig01-closure-preflight.md`](./v2-02b-mig01-closure-preflight.md) | `current + target + proposed` | MIG-01 A1～C 静态证据、完整影响面、阻断状态和内部候选实施切片。 |
| [`v2-mig01-a2-provisioning-preflight.md`](./v2-mig01-a2-provisioning-preflight.md) | `current + target + proposed` | A1／A2 状态、Owner 候选、Manifest 契约、P1／P2 拆分、Migration 元数据、幂等矩阵、环境门禁与实施阻断 |
| [`../operations/mig01-a2-provisioning-runbook.md`](../operations/mig01-a2-provisioning-runbook.md) | `current + proposed` | 受控 Runner 的 Manifest、输入文件、dry-run、Write Adapter 事务、Lease、审计、撤权、outcome-unknown、停止与 forward-fix 运行边界 |
| [`../operations/mig01-a2-p1-execution-plan-20260731.md`](../operations/mig01-a2-p1-execution-plan-20260731.md) | `current + proposed` | 冻结 A2-P1 Runtime、Authority／组合根与一次受控执行的分层授权、文件边界、验证和硬停止条件；不是数据库执行授权 |
| [`v2-02c-platform-auth-route-preflight.md`](./v2-02c-platform-auth-route-preflight.md) | `current + target + proposed` | 平台正式 Session、授权根、页面与 API 路由族、legacy／v1 影响面、阻断状态和候选实施切片 |
| [`../verification/github-main-hard-gate-validation-20260730.md`](../verification/github-main-hard-gate-validation-20260730.md) | `current` | Stage A 仓库硬门、Required Check、服务端拒绝探针、负向／正向 PR 验证和回退证据 |
| [`business-architecture.md`](./business-architecture.md) | `current + target` | 角色、价值流、两平面职责、七线业务闭环、AI 人工确认和正式发布尺度 |
| [`application-architecture.md`](./application-architecture.md) | `current + target` | 官网、认证、机构端、平台端、API、Webhook、权限、Capability 和应用依赖方向 |
| [`data-architecture.md`](./data-architecture.md) | `current + target + proposed` | 数据事实所有权、机构隔离、来源、证据和 MIG 序列 |
| [`software-architecture.md`](./software-architecture.md) | `current + target + proposed` | 模块分层、依赖方向、Port／Adapter 和兼容层 |
| [`deployment-architecture.md`](./deployment-architecture.md) | `current + target + proposed` | 当前仓库部署证据、目标环境、发布、回滚和待核验事项 |
| [`development-architecture.md`](./development-architecture.md) | `current + target + proposed` | 开发协作、任务与 PR 生命周期、分层开发、测试、Migration 门禁和完成定义 |
| [`../decisions/architecture-v2-decisions.md`](../decisions/architecture-v2-decisions.md) | `target` | 已接受架构决策及其约束 |

### 5.1 MIG-01A2 专项决策入口

| 文档 | 决策状态 | 职责 |
|---|---|---|
| [`../decisions/mig01-a2-provisioning-accepted-decisions.md`](../decisions/mig01-a2-provisioning-accepted-decisions.md) | `accepted` | 记录 D01～D11 已接受选择，以及 D12 仅接受最小 Anchor Bridge 方向、实施细节后置的边界 |
| [`../decisions/mig01-a2-provisioning-decision-pack.md`](../decisions/mig01-a2-provisioning-decision-pack.md) | `proposed` | 保留 D01～D12 的选项、推荐、风险、代价、证据和未决定时阻断 |

这里的 `accepted` 是专项决策生命周期状态，不等于 `current` 实现或交付完成。accepted 文件只在“用户已经选择什么”上优先解释 proposed decision pack，不得覆盖 `architecture-v2.md` 或已接受 ADR；两份文档均不表示仓库硬门、Runner、Runtime、Schema、Migration、A2-P1 或 A2-P2 已完成。

### 5.2 MIG-01A2 当前专项证据

| 文档 | 状态 | 职责 |
|---|---|---|
| [`v2-mig01-a2-environment-manifest-readonly-preflight.md`](./v2-mig01-a2-environment-manifest-readonly-preflight.md) | `current evidence` | 记录 Mac 本地安全验收环境的 Journal、A1 Shape、Manifest、CLI、备份恢复点和真实 dry-run 可用性 |
| [`../operations/mig01-a2-local-acceptance-stage-a-20260730.md`](../operations/mig01-a2-local-acceptance-stage-a-20260730.md) | `current evidence` | 记录固定 localhost-only 本地验收库推进到 0038、A1 Shape、低敏计数、迁移前后备份及两次隔离恢复验证 |
| [`../operations/mig01-a2-local-readiness-stage-b-20260730.md`](../operations/mig01-a2-local-readiness-stage-b-20260730.md) | `current evidence` | 记录本地验收 Context Policy、只读 PostgreSQL Adapter、合成测试、localhost-only smoke 和 Stage B 阻断收口 |
| [`../operations/mig01-a2-manifest-candidate-governance-20260730.md`](../operations/mig01-a2-manifest-candidate-governance-20260730.md) | `current evidence` | 记录不可变的 Candidate v1 test-only Contract、canonicalization、digest、合成 Source 与 Reviewer 生命周期 |
| [`../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md`](../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md) | `current evidence` | 记录用户授权 Source v2、Candidate v2、独立 digest 与三道治理门；不包含 Source／Candidate 实例 |
| [`../operations/mig01-a2-manifest-candidate-approval-template-20260730.md`](../operations/mig01-a2-manifest-candidate-approval-template-20260730.md) | `current + proposed` | 提供仓库外审批包的空白低敏 v2 模板；Git 文件未回填真实 Source、Candidate、digest、审批引用、路径或业务数据 |
| [`../operations/mig01-a2-local-manifest-candidate-approval-pack-20260730.md`](../operations/mig01-a2-local-manifest-candidate-approval-pack-20260730.md) | `current evidence + human reviewed` | 记录重新签发 Candidate 的低敏验证与用户人工审核结论；不包含 Candidate 正文、双键或 digest，不代表 Approved Manifest 已创建，也不授权 Stage D 或 A2-P1 |
| [`../operations/mig01-a2-approved-manifest-validation-20260730.md`](../operations/mig01-a2-approved-manifest-validation-20260730.md) | `current evidence` | 记录 Approved Manifest 的独立创建、exact-shape／`c14n-v1`／digest 校验、Candidate 隔离和职责分离；不授权 Stage D、数据库写入或 Lease |
| [`../operations/mig01-a2-approved-manifest-reissue-validation-20260731.md`](../operations/mig01-a2-approved-manifest-reissue-validation-20260731.md) | `current evidence` | 记录旧 Approved 不可用后的全新重新签发、Candidate 不变、exact shape／独立 digest、文件隔离、职责分离和零执行边界 |
| [`../operations/mig01-a2-approved-manifest-reissue-independent-review-20260731.md`](../operations/mig01-a2-approved-manifest-reissue-independent-review-20260731.md) | `current evidence` | 独立核验重新签发低敏证据与当前治理状态；只准入 handoff，不准入专用角色、Lease、Runner 或 A2-P1 execute |
| [`../operations/mig01-a2-stage-d-local-dry-run-validation-20260730.md`](../operations/mig01-a2-stage-d-local-dry-run-validation-20260730.md) | `current evidence` | 记录 Stage D 本地只读 dry-run、五项低敏计数、独立 pre／post 探针、数据库状态不变和零写入证据 |
| [`../operations/mig01-a2-stage-d-independent-review-20260730.md`](../operations/mig01-a2-stage-d-independent-review-20260730.md) | `current evidence` | 保留 F01 首轮发现与关闭历史，并记录修正 Head 的独立复审通过、Stage D handoff 准入和 A2-P1 仍未准入 |
| [`../operations/mig01-a2-p1-authority-composition-root-no-write-validation-20260731.md`](../operations/mig01-a2-p1-authority-composition-root-no-write-validation-20260731.md) | `current evidence` | 记录合成 Authority 签名活动记录、仓库外一次性组合根、合成无写验证、负向生命周期和零真实操作边界；不表示真实 Authority、Lease、权限窗口或数据库执行已开始 |
| [`../operations/mig01-a2-p1-public-temporary-acl-remediation-20260731.md`](../operations/mig01-a2-p1-public-temporary-acl-remediation-20260731.md) | `current evidence` | 记录固定 localhost-only 本地验收数据库的 `PUBLIC TEMPORARY` 单次撤销、`PUBLIC CONNECT` 不变、其他 ACL／对象／数据不变量和零 A2-P1 执行边界 |
| [`../operations/mig01-a2-p1-public-temporary-acl-independent-review-20260731.md`](../operations/mig01-a2-p1-public-temporary-acl-independent-review-20260731.md) | `current evidence` | 独立核验 ACL 证据来源、变更前后不变量、零回退与零越界结论；只准入 ACL handoff，不准入专用角色预置或 A2-P1 |
| [`../operations/mig01-a2-p1-execution-validation-20260731.md`](../operations/mig01-a2-p1-execution-validation-20260731.md) | `current evidence` | 记录固定 localhost-only 本地验收环境的一次 A2-P1 dry-run、一次 `--execute`、三张 A1 表净新增、Execution Lease、临时专用角色最小权限及完整清理；不授权 A2-P2 |
| [`../operations/mig01-a2-p1-execution-independent-review-20260731.md`](../operations/mig01-a2-p1-execution-independent-review-20260731.md) | `current evidence` | 独立核验 A2-P1 执行状态机、原子事务、数据净影响、恢复点边界、角色／权限／Lease 清理及 `fixed_table_count_drift` 裁决；只准入最终 handoff，不授权 A2-P2 |
| [`../operations/mig01-a2-p2-catalog-data-shape-readonly-preflight-20260731.md`](../operations/mig01-a2-p2-catalog-data-shape-readonly-preflight-20260731.md) | `current evidence + proposed implementation freeze` | 记录 localhost-only 显式只读 Catalog／Shape 探针、候选四分类、历史 orphan 低敏归因、精确索引／`NOT VALID` FK、metadata 串行前置和零数据库变更边界 |
| [`../operations/mig01-a2-p2-catalog-data-shape-independent-review-20260731.md`](../operations/mig01-a2-p2-catalog-data-shape-independent-review-20260731.md) | `current evidence` | 独立核验对象名称与列序、Catalog 归因、Shape、历史 orphan、P0／P1、事务／锁及 forward-fix；只准入 handoff，不授权 Schema／Migration 执行 |
| [`../operations/drizzle-migration-snapshot-strategy.md`](../operations/drizzle-migration-snapshot-strategy.md) | `current + target` | 以 journal 最后一条 tag 和实际 SQL 集合动态核验 current Migration，保护 snapshot 0026 事实、阶段性 metadata 差异与 `db:generate`／snapshot-diff 禁令 |
| [`../operations/a2-p2-p0-metadata-current-independent-review-20260731.md`](../operations/a2-p2-p0-metadata-current-independent-review-20260731.md) | `current evidence` | 独立核验 P0 两文件范围、动态 journal current 口径、snapshot 0026、零 Schema／Migration／metadata／数据库改动与 P1 未授权边界 |
| [`../operations/mig01-a2-p2-p1-implementation-independent-review-20260731.md`](../operations/mig01-a2-p2-p1-implementation-independent-review-20260731.md) | `current evidence` | 独立核验实时编号 0039、四文件实施、SQL／Schema／journal 一致性、snapshot 不变和 local_acceptance Migration 准入 |
| [`../operations/mig01-a2-p2-p1-local-acceptance-migration-validation-20260801.md`](../operations/mig01-a2-p2-p1-local-acceptance-migration-validation-20260801.md) | `current evidence` | 记录一次受控 local_acceptance Migration、精确索引与未验证外键、前后低敏计数、Lease、恢复点和零业务 DML 证据 |
| [`../operations/mig01-a2-p2-p1-local-acceptance-migration-independent-review-20260801.md`](../operations/mig01-a2-p2-p1-local-acceptance-migration-independent-review-20260801.md) | `current evidence` | 独立核验唯一 attempt、事实归因、Catalog、数据不变量、Lease／恢复点终态和 A2-P2 handoff 准入 |
| [`../operations/base02-readiness-plan-20260801.md`](../operations/base02-readiness-plan-20260801.md) | `current evidence + proposed implementation freeze` | 记录 BASE-02 静态与只读数据库准入证据、orphan 责任边界、BASE-B1～B6 实施方案、风险、测试及停止／回退条件；不授权 Runtime 或数据修复 |
| [`../operations/base02-readiness-independent-review-20260801.md`](../operations/base02-readiness-independent-review-20260801.md) | `current evidence` | 独立核验 BASE-02 方案未误纳 A2-P2、未授权 orphan 修复、未提前放行 Reader，并确认 handoff 准入、不确认实施准入 |
| [`../decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md`](../decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md) | `current evidence + proposed decisions` | 记录 BASE-B1 因缺少稳定 Membership revision 而硬停止，并冻结 Owner、生命周期、Binding version 与 Operating Context 排除边界；不构成 accepted decision |
| [`../decisions/base02-membership-revision-architecture-decision-pack.md`](../decisions/base02-membership-revision-architecture-decision-pack.md) | `proposed decision pack` | 比较 A-literal、A-full、canonical replacement 与现有字段组合；推荐 A-full，但未接受、未授权 Schema／Migration 或 Runtime |
| [`../operations/base02-membership-revision-architecture-independent-review-20260801.md`](../operations/base02-membership-revision-architecture-independent-review-20260801.md) | `current evidence` | 独立核验三方案、BASE-B1～B6、Reader／Writer 与 orphan／FK 边界；只准入决策 handoff，不准入 Schema／Migration 或 BASE-B1 Runtime |
| [`../decisions/base02-membership-revision-accepted-decision.md`](../decisions/base02-membership-revision-accepted-decision.md) | `accepted decision` | 记录用户接受 A-full：`tenant_members` 继续作为 Access Control 唯一 canonical Membership current，并绑定显式单调 revision、CAS、完整生命周期、ABA、provenance、同事务 transition evidence 与唯一 Writer；不决定具体 Schema／Migration |
| [`../operations/base02-membership-revision-acceptance-independent-review-20260801.md`](../operations/base02-membership-revision-acceptance-independent-review-20260801.md) | `current evidence` | 独立确认 A-full 接受完整、Owner 与三个版本域未漂移、未形成第二 current、未夹带物理 Schema 或 Runtime 授权；只准入 acceptance handoff |
| [`../operations/base02-membership-revision-schema-migration-preflight-20260801.md`](../operations/base02-membership-revision-schema-migration-preflight-20260801.md) | `current evidence + proposed implementation freeze` | 完整枚举 current Schema、Writer、Reader、Session／Guard 与测试影响面，并冻结 M0～M7 串行候选；不授权 Schema／Migration 或 Runtime |
| [`../decisions/base02-membership-revision-physical-model-decision-pack-20260801.md`](../decisions/base02-membership-revision-physical-model-decision-pack-20260801.md) | `proposed physical model` | 推荐规范化同表 current＋`tenant_membership_transitions` immutable evidence，冻结 P01～P12 物理候选；尚未接受 |
| [`../operations/base02-membership-revision-schema-preflight-independent-review-20260801.md`](../operations/base02-membership-revision-schema-preflight-independent-review-20260801.md) | `current evidence` | 独立核验 A-full 未重开、物理模型与影响面完整、M0～M7 可作为接受输入；只准入接受 handoff，不准入实施或 BASE-B1 Runtime |
| [`../decisions/base02-membership-revision-physical-model-accepted-decision.md`](../decisions/base02-membership-revision-physical-model-accepted-decision.md) | `accepted decision` | 记录 P01～P12 绑定接受和 M0→M7 唯一串行；不替代各切片的文件范围、Lease、恢复点、独立审查与执行门禁 |
| [`../operations/base02-membership-revision-physical-model-acceptance-independent-review-20260801.md`](../operations/base02-membership-revision-physical-model-acceptance-independent-review-20260801.md) | `current evidence` | 独立核验 P01～P12、M0～M7、A-full 与 Owner 边界完整接受；只准入 M0／M1 handoff |
| [`../operations/base02-membership-revision-m1-implementation-independent-review-20260801.md`](../operations/base02-membership-revision-m1-implementation-independent-review-20260801.md) | `current evidence` | 独立核验 `0040` Expand 四文件、accepted Shape、journal、snapshot 不变、零 legacy DML 和受控执行准入 |
| [`../operations/base02-membership-revision-m1-0040-correction-independent-review-20260801.md`](../operations/base02-membership-revision-m1-0040-correction-independent-review-20260801.md) | `current evidence` | 保留首次类型失败与完整回滚历史，独立核验未消费 `0040` 的三处精确类型纠错和零范围扩张 |
| [`../operations/base02-membership-revision-m1-local-acceptance-migration-validation-20260801.md`](../operations/base02-membership-revision-m1-local-acceptance-migration-validation-20260801.md) | `current evidence` | 记录全新恢复点、全新 Lease 下的第二次授权执行，环境 journal 41、M1 `all_exact`、数据不变量与零业务 DML |
| [`../operations/base02-membership-revision-m1-local-acceptance-migration-independent-review-20260801.md`](../operations/base02-membership-revision-m1-local-acceptance-migration-independent-review-20260801.md) | `current evidence` | 独立核验完整尝试历史、Catalog、数据不变量、恢复点／Lease 终态和 M1 handoff 准入；不授权 M2 前置越界 |
| [`../operations/base02-membership-revision-m2-implementation-independent-review-20260802.md`](../operations/base02-membership-revision-m2-implementation-independent-review-20260802.md) | `current evidence` | 独立核验 M2 Access Control 唯一 Membership Owner Writer、`expectedRevision` CAS、transaction-bound UoW、current／Binding／transition evidence 同事务原子性、重放 fail-closed 与合成／事务测试；只准入 M2 handoff，不表示 M3、数据库、Reader 或 BASE-B1 已启动 |
| [`../operations/base02-membership-revision-m3-implementation-independent-review-20260802.md`](../operations/base02-membership-revision-m3-implementation-independent-review-20260802.md) | `current evidence` | 独立核验 M3-A onboarding 单一外层事务委托、M3-B 5 个旧 Writer／Deleter fail-closed、Owner 外 direct mutation `0／0` 与 AQ008 唯一 allowlist `1`；只准入 M3 handoff，不表示 M4、Reader 或 BASE-B1 已启动 |
| [`../operations/base02-membership-revision-m4-local-acceptance-migration-validation-20260802.md`](../operations/base02-membership-revision-m4-local-acceptance-migration-validation-20260802.md) | `current evidence` | 记录 `0041` 第三次且仅一次授权目标执行、三次调用历史、`1／1／0／0／0`、current／baseline 原子终态、恢复点、Lease、清理和执行后无目标 Guard 拒绝低敏事实 |
| [`../operations/base02-membership-revision-m4-local-acceptance-migration-independent-review-20260802.md`](../operations/base02-membership-revision-m4-local-acceptance-migration-independent-review-20260802.md) | `current evidence` | 独立核验 M4 journal／数据 Shape／三次执行历史、F01 零影响、恢复点和 Lease 终态；只准入 M4 handoff，不授权 M5、BASE-B1 或 Reader |
| [`../operations/base02-membership-revision-m5-implementation-independent-review-20260802.md`](../operations/base02-membership-revision-m5-implementation-independent-review-20260802.md) | `current evidence` | 独立核验 M5 `0042` 三文件追赶 Migration、零候选合法分支、SQL／journal／测试一致性与受控执行准入；不表示环境已消费 `0042` |
| [`../operations/base02-membership-revision-m5-local-acceptance-migration-validation-20260802.md`](../operations/base02-membership-revision-m5-local-acceptance-migration-validation-20260802.md) | `current evidence` | 记录 `0042` 唯一授权 guarded 目标调用、零候选 `0／0／0／0／0`、journal `43／0042`、恢复点、Execution Lease、清理和数据不变量 |
| [`../operations/base02-membership-revision-m5-local-acceptance-migration-independent-review-20260802.md`](../operations/base02-membership-revision-m5-local-acceptance-migration-independent-review-20260802.md) | `current evidence` | 独立核验 M5 零候选执行、完整 Catalog／数据不变量、F01／F02、恢复点、Lease 与清理终态；只准入 M5 handoff，不表示 M6、BASE-B1 或业务 Reader 已启动 |
| [`../operations/base02-membership-revision-m6-implementation-independent-review-20260802.md`](../operations/base02-membership-revision-m6-implementation-independent-review-20260802.md) | `current evidence` | 独立核验 M6 42 文件、Owner Reader、`I1→M1→S1→M2→S2→I2` 双重读取、授权时间戳 fallback `0／0` 与零越界；只准入 M6 handoff，不表示 M7、BASE-B1 或业务 Reader 已启动 |
| [`../operations/base02-membership-revision-m7-write-contract-independent-review-20260802.md`](../operations/base02-membership-revision-m7-write-contract-independent-review-20260802.md) | `current evidence` | 独立核验 M7 前置写入类型收紧、完整 current envelope、legacy fail-closed 与 Owner 外 Writer `0／0`；只准入 M7 Schema／Migration |
| [`../operations/base02-membership-revision-m7-enforce-independent-review-20260802.md`](../operations/base02-membership-revision-m7-enforce-independent-review-20260802.md) | `current evidence` | 独立核验 `0043` 四文件、精确 predecessor／all-exact 状态机、七项 Enforce、零业务 DML、journal 与 snapshot 边界；只准入受控数据库执行 |
| [`../operations/base02-membership-revision-m7-local-acceptance-migration-validation-20260802.md`](../operations/base02-membership-revision-m7-local-acceptance-migration-validation-20260802.md) | `current evidence` | 记录 `0043` 唯一 guarded 调用、`7／7／0／0／0`、journal `44／0043`、六列 `NOT NULL`、数据／序列不变量、Lease、恢复点、清理与归因纠错 |
| [`../operations/base02-membership-revision-m7-local-acceptance-migration-independent-review-20260802.md`](../operations/base02-membership-revision-m7-local-acceptance-migration-independent-review-20260802.md) | `current evidence` | 独立核验已纠正的 M7 执行证据归因、公开 `0043` 契约、唯一调用、环境终态和有限恢复证明；只准入 M7 handoff |
| [`../operations/base02-b1-owner-port-revision-contract-closure-20260802.md`](../operations/base02-b1-owner-port-revision-contract-closure-20260802.md) | `current evidence` | 以最新 `main` 关闭 Access Control／Identity／Tenancy／Security 的 Owner、Port、三个独立 revision 域、双重读取和失败关闭契约；结论为 `all_exact`，无需无意义 Runtime 改动 |
| [`../operations/base02-b1-owner-port-revision-contract-independent-review-20260802.md`](../operations/base02-b1-owner-port-revision-contract-independent-review-20260802.md) | `current evidence` | 独立核验 BASE-B1 单一事实源、genuine Reader、AQ008、授权时间戳 fallback `0／0` 与多 Membership 失败关闭；只准入 BASE-B1 handoff，不表示 BASE-B2 已实施 |
| [`../decisions/base02-binding-lifecycle-provenance-accepted-decision.md`](../decisions/base02-binding-lifecycle-provenance-accepted-decision.md) | `accepted decision` | 接受 M09-A：现有 Binding 表继续作为 Access Control 唯一 canonical current／lifecycle history；另设同 Owner、同事务、append-only transition evidence，且不得成为第二 current |
| [`../operations/base02-binding-lifecycle-provenance-acceptance-independent-review-20260802.md`](../operations/base02-binding-lifecycle-provenance-acceptance-independent-review-20260802.md) | `current evidence` | 独立核验 M09-A、current／evidence 分工、F01～F05、原子性、legacy calibration 与 BASE-B2／B3 门禁；只准入 Schema／Migration 前置预检 handoff |

这里的 `human reviewed` 只表示用户允许当前重新签发的 Candidate 作为未来 Approved Manifest 准备依据。Candidate payload 仍为 `candidate`，私有 Review State 仍为 `review_pending`；它不是 Candidate `approved` 状态，也不是 Approved Manifest 的 `approved` 状态。

以下段落记录 PR #823 合并时点的阶段快照：PR #809 的只读预检报告记录了六项阻断。PR #811 随后完成本地就绪修复 Stage A，将环境 Journal 从 38 推进到 39、使 A1 三表 Shape 与仓库 0038 一致，并建立迁移前后两个已验证恢复点；`journal_not_at_0038`、`schema_shape_missing`、`backup_recovery_point_missing` 已关闭。PR #814 进一步建立只读 Adapter 与本地验收 Context Policy，关闭 `readonly_adapter_unavailable`。PR #816 建立 Candidate v1 Governance 基础并关闭 `candidate_contract_missing`；PR #817 完成 Stage C-0 handoff；PR #818 建立用户授权 Source／Candidate v2 治理合约；PR #819 完成 Source v2 handoff；PR #820 生成、重新签发并记录人工审核通过的 Candidate 低敏证据。PR #823 随后将 Approved Manifest 低敏创建与校验摘要合并到 `main`：Approved Manifest 数量为 1，version 为 `mig01-a2/v1`，`approvalStatus=approved`，`c14n-v1`、exact shape 和独立 digest 校验均通过，Candidate 与 Approved Manifest 作为独立资产保留且 Candidate digest 未复用。在该时点，`real_manifest_missing`、`approved_manifest_validation_missing` 与报告中的 `approved_manifest_independent_review_pending` 已关闭，`real_environment_dry_run_unavailable` 继续阻断，Runner、dry-run、Lease、数据库写入、Stage D 与 A2-P1 均未启动。

## 6. 架构视图完成状态

业务、应用、数据、软件、部署、开发六类架构视图已经完成 `6/6`。`V2-ARCH-DOCS-03` 已通过 PR #787 合并，开发架构、根 `README.md` 项目入口和 `CURRENT_STATUS` 同步均已完成，不再标记为 `planned`。

`V2-02B-MIG01-CLOSURE-PREFLIGHT` 已通过 PR #789 完成并合并，其预检文档现作为 MIG-01 当前静态证据和候选实施切片入口。该结果不表示 MIG-01 已实施或关闭。

`V2-MIG01-A2-PROVISIONING-PREFLIGHT-01` 已通过 PR #797 完成并合并，其专项预检文档现作为 A2 当前静态证据与决策阻断入口。该结果只完成预检，没有实施 A2；A2-P1、A2-P2 和数据库操作均未启动。

`V2-MIG01-A2-DECISION-PACK-01` 已通过 PR #799 完成并合并，proposed decision pack 继续保留为选项、推荐、风险和证据材料。用户随后明确接受 D01-A、D02-A、D03-A、D04-A、D05-A、D06-B、D07-B、D08-C、D09-A、D10-B、D11-B 和 D12-A 方向；D12 的精确名称、列序、Catalog Shape、编号、锁／timeout 和环境仍后置。该接受结果没有配置仓库硬门，没有创建 Runner 或签发 Lease，也没有启动 A2-P1／P2。

`V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT` 已通过 PR #791 完成并合并，其预检文档现作为平台正式授权与路由族的当前静态证据和候选实施切片入口。该预检确认正式平台服务端授权根为“缺失”、平台 Runtime／发布准入为“阻断”；本阶段没有实施平台 Runtime，七个平台候选实施切片均未启动。

`V2-QUALITY-CI-01-MINIMUM-ARCHITECTURE-QUALITY-GATE` 已通过 PR #794 完成并合并，最小架构与质量门禁已经进入 `main`。Stage A 随后通过 PR #804 完成仓库硬门配置与验证，并通过 PR #805 完成交接收口；PR #806 独立修复了交接门禁暴露的既有异步测试竞态。该结果只证明检查器、增量规则、现有质量命令编排和 GitHub 服务端合并门禁已建立并验证，不表示历史架构债务已清零或任何业务已正式发布。

`V2-MIG01-A2-GOVERNANCE-FOUNDATION-01-STAGE-B` 已通过 PR #807 完成并合并。Tenancy 现已拥有版本化低敏 Manifest、`c14n-v1`／SHA-256、dry-run 分类、Repository／Transaction Port、低敏 Lease 契约和一次性 CLI 治理基础，配套 Runbook 已进入 `main`。该结果不表示真实 Manifest、环境 journal、数据库 Shape、备份／恢复点、真实 Lease 或 P1 已核验、签发或执行。

`V2-MIG01-A2-ENVIRONMENT-MANIFEST-READONLY-PREFLIGHT-01` 已通过 PR #809 完成并合并，但结论为 `blocked`：本地验收库 Journal 只有 38 项且未到仓库 0038，A1 三表缺失，真实 Manifest、正式备份／恢复点和只读 Repository Adapter 缺失，真实 Runner dry-run 不可用。该报告只形成只读证据，没有修复环境或启动 A2-P1／P2。

`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-A-COMPLETE` 已通过 PR #811 完成并合并。固定本地验收库现有 39 条 Applied Migration，最新项内部匹配 0038；`tenants` 低敏计数保持 2，三个 A1 表 Shape 与仓库一致且均为空。迁移前备份 `zmtg_clean_local_acceptance-pre-0038-20260730-124114` 与迁移后备份 `zmtg_clean_local_acceptance-post-0038-20260730-124114` 均已完成隔离恢复验证并继续保留。本阶段只对本地验收环境应用仓库既有 0038，仓库 Runtime、Schema、Migration 修改均为 0。

`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B-COMPLETE` 已通过 PR #814 完成并合并。Tenancy 现有 `mig01-a2-local-acceptance-context-policy/v1`，只允许 `local_acceptance` 环境的 `Asia/Shanghai` 与 `CNY`；只读 Adapter 只访问 `public.tenants` 和三个 A1 表，所有读取使用 `REPEATABLE READ + READ ONLY` 并核验 timeout，所有写方法永久拒绝。localhost-only smoke 前后 Journal 39、`tenants` 2、三个 A1 表 0 的低敏计数不变。真实 Manifest、Runner dry-run、Lease、A2-P1／P2 仍未启动。

`V2-MIG01-A2-CANDIDATE-GOVERNANCE-01` 已通过 PR #816 完成并以 Merge Commit `eb7cde613c38e262aeb8519c53e7e3d21704b18f` 合并。Tenancy 现有独立的 `mig01-a2-candidate/v1` Candidate Contract、`zmtg.mig01-a2.provisioning-candidate-manifest` domain、Candidate canonicalization／SHA-256 digest、`mig01-a2-candidate-source/v1` Source 契约，以及 `generated → review_pending` 单向 Reviewer 生命周期。Candidate 与 `mig01-a2/v1` Approved Manifest 使用不同协议和 digest；当前没有实现 Candidate 的 `approved` 状态，也没有创建真实 Candidate 或 Approved Manifest。PR #816 精确新增 3 个 Candidate Runtime 模块、3 个测试文件和 2 个治理文档，关闭 `candidate_contract_missing`；`real_manifest_missing` 继续阻断。

`V2-MIG01-A2-STAGE-C-REAL-SOURCE-AND-CANDIDATE-01` 阶段一已通过 PR #818 完成并以 Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350` 合并。Candidate v1 继续保持 test-only 且不可变；Tenancy 新增 `mig01-a2-candidate-source/v2`／`local_acceptance_user_authorized_input` Source Contract 与 `mig01-a2-candidate/v2` Candidate Contract。Source authorization、Candidate review 与 Approved Manifest 是三个独立门。PR #818 只建立合约、测试和治理文档，没有生成 Source／Candidate 实例，没有读取数据库或运行 Runner，也没有创建 Approved Manifest；`real_manifest_missing` 继续阻断。

Source v2 handoff 已通过 PR #819 完成并以 Merge Commit `2e14cfd2cec73cd3d8dc08274ba70763402798bb` 合并。Stage C Candidate 审批包随后通过 PR #820 完成并以 Merge Commit `172526e15775fc99768e1d739fc3c0d947bc1363` 合并：最终 Head 为 `bc3ad6155df5ce071442183b85a301dd6366ec51`，Candidate 数量为 1，Source／Candidate exact shape、digest、Context Policy 与 tenant 父记录均已验证；用户人工审核结论为 `accepted_for_approved_manifest_preparation`。PR #823 已将 Approved Manifest 低敏校验报告以 Merge Commit `3f042172734c0dc9cc583a09f347e38df7db1e02` 合并；Approved Manifest 与 Candidate 的文件及 digest 均保持分离，Future Operator 仍未分配。该结果不授权 Runner、dry-run、Lease、数据库写入、Stage D 或 A2-P1。

Stage D 已通过 PR #825 完成一次获授权的本地只读 dry-run，并通过 PR #826 完成证据归因修正后的独立复审。Runner ReadOnly Adapter 只负责 tenant 存在性、Manifest 对应 triplet 分类与五项计数；Journal、实际 Shape 和四表总数来自独立临时只读探针，冻结仓库提供预期 Journal／Shape 对照。F01 已关闭，Stage D handoff 准入为 `true`，A2-P1 准入仍为 `false`。

PR #828 已将 A2-P1 受控执行计划合并到 `main`，随后 PR #829 建立当前唯一 Write Adapter、Write 合成事务测试、ReadOnly／Write parity 测试并更新 Runbook。Write Adapter 只读取 `tenants` 与三张 A1 表，只向三张 A1 表执行参数化纯 `INSERT`，并提供 `SERIALIZABLE READ WRITE`、固定 timeout 与双键事务级 advisory lock；既有 Kernel 强制 affected rows 逐项等于 1，并在提交前完成全批重检。该 Runtime 资产进入 `main` 不表示真实 Authority、组合根、Lease、数据库执行或 A2-P1 已完成。

PR #830 已完成 Runtime handoff。PR #831 随后完成 Authority／组合根无写准备与低敏证据：合成 Authority 矩阵为 1 个完整匹配允许、22 个负向用例拒绝，生命周期 12 个场景与静态边界 6 项通过，合成 Runner `--dry-run` 五项计数为 `1／1／0／0／0`。该阶段数据库连接／写入、真实 Manifest 读取、真实 Authority／Lease 操作、真实权限变更和 `--execute` 均为 0；临时资产已删除。无写准备完成不表示真实执行前置已实时满足或 A2-P1 已完成。

PR #833 已将数据库级 `PUBLIC TEMPORARY` 权限阻断的方案 A 作为 accepted 执行边界合并。随后仅对固定 localhost-only 本地验收数据库执行一次授权撤销：`PUBLIC TEMPORARY` 由 `true` 变为 `false`，`PUBLIC CONNECT` 保持 `true`，TEMPORARY allowlist 为 `0`，条件化回退未触发。PR #834 已合并低敏证据，PR #835 已完成独立审查并确认其他数据库 ACL、Schema／表／序列／Default Privileges、角色目录／成员关系、Journal、A1 Shape 与固定四表低敏计数均未变化。该结果只关闭本次数据库级权限阻断，不构成专用角色创建、表级权限、Lease 或 A2-P1 执行授权。

旧 Approved Manifest 不再可用后，PR #837 基于当前有效 Candidate v2 完成全新的 Approved Manifest 重新签发并合并低敏证据，PR #838 完成独立只读审查。当前 Candidate 与 Approved Manifest 数量均精确为 `1`；Approved Contract、exact shape、独立 digest、文件隔离、职责分离和临时资产清理均通过。该结果只准入本次 handoff；数据库连接、角色或 ACL、Lease、Runner、dry-run、`--execute` 和 A2-P1 execute 均未发生。

PR #843 已完成 A2-P2 localhost-only 显式只读 Catalog／数据 Shape 预检：`institution_scopes_pk(tenant_id, institution_id)` 是唯一引用目标，`auth_account_institution_bindings_scope_idx` 与 `auth_account_institution_bindings_scope_fk` 均为 `all_missing`，部分对象、同名异定义、等价异名和未知依赖为 `0`。Binding 总行数 `1`、NULL `0`、重复 `0`、历史 orphan `1`；该 orphan 已解释但未修复／未验证，只支持窄范围 `NOT VALID` 创建。PR #844 独立审查通过并确认 handoff 准入为 `true`、Schema／Migration 执行准入为 `false`。PR #845 handoff 进一步澄清该 orphan 不属于 MIG-01B，并把后续实施串行为先完成 metadata P0 校准与 handoff、再单独申请 P1；当时 P1 未启动、未授权。

PR #846 已完成 P0 两文件校准：current journal 由 `_journal.json` 最后一条 tag 动态推导并与实际 SQL 集合核验，snapshot 保持 `0026`，`db:generate` 与 snapshot-diff Migration 禁令未弱化。PR #847 独立审查结论为 `a2_p2_p0_review=passed`，面向 P1 的 handoff 准入为 `true`（仅可申请授权）、Schema／Migration 执行准入为 `false`。P0 实际修改为运维文档 `1`、测试文件 `1`；Runtime、Schema、Migration SQL、journal、snapshot、数据库、CI、package 和 lock 修改均为 `0`。P0 收口不批准或占用 `0039`，也不自动授权 P1。

PR #849 在唯一 Migration Lease 下实时分配并实施 `0039_mig_01a2_anchor_bridge`，只修改 Migration SQL、journal、Schema 和 Schema 测试四个文件；PR #850 独立审查通过。随后固定 localhost-only 本地验收环境通过 guarded `pnpm db:migrate` 完成一次且仅一次受控执行，PR #851 合并低敏执行证据，PR #852 完成执行独立审查。环境 Applied Migration 从 `39` 到 `40`，目标索引和外键均精确存在，外键保持 `NOT VALID`；A2-P1 三表保持 `1／1／1`，Binding 总数／NULL／重复／historical orphan 保持 `1／0／0／1`，业务 DML 为 `0`。A2-P2 已具备 handoff 收口条件，但 historical orphan 清零前不得完成 BASE-02、执行外键 `VALIDATE` 或放行 Reader。

BASE-02 准入方案已由 PR #854 以 Merge Commit `b87fad849770b83276d0572f73c7c507825c3bca` 合并；独立审查已由 PR #855 在重放后以 Merge Commit `8e3b9de6d472be9fc586b14a2eba24e51e928dfb` 合并。只读审计确认 active historical orphan 与 Scope 关系 orphan 均为 `1`，语义 Owner 为 Access Control 的 Binding 生命周期；独立数据修复专项只能作为经授权的执行载体，Tenancy 不得从 Binding 反推创建 Scope。方案冻结 BASE-B1～B6，但没有授权任何 Runtime、数据修复、外键 `VALIDATE`、Writer 或 Reader；PR #856 只负责 handoff 收口。

BASE-B1 随后因 Membership revision 证据不足硬停止。PR #857 证明 `tenant_members.updated_at` 与 Binding version 均不能替代稳定 Membership revision，并冻结 Identity／Access Control／Tenancy／Security Owner 与 Operating Context 排除边界；PR #858 提交三方案决策包，proposed 推荐 A-full；PR #859 独立审查通过。用户随后正式接受 A-full，PR #861 将 `tenant_members` 唯一 canonical current、显式严格单调 revision、`expectedRevision` CAS、完整 lifecycle、tombstone／incarnation／ABA、current provenance、同事务 immutable transition evidence 与 Access Control 唯一 Writer 记录为 accepted，PR #862 独立审查结论为 `membership_revision_acceptance_review=passed`。该接受不决定具体字段、表结构、Migration 编号、SQL 或环境；BASE-B1 Runtime 继续阻断，Schema／Migration 前置预检尚未启动，BASE-B2～B6、orphan 修复、FK `VALIDATE`、Writer 和 Reader 均未启动。

Membership Revision 物理模型已经由 PR #867 绑定接受，PR #868 独立审查通过。M1 Expand 由 PR #869 实施，PR #871 独立审查；首轮受控 Migration 因枚举聚合类型不匹配失败并完整回滚，PR #872／#873 随后完成未消费 `0040` 的精确纠错与独立审查，PR #874／#875 完成第二次授权执行和独立审查。M2 Owner Writer／CAS 已由 PR #877 实施并由 PR #878 独立审查通过。M3-A 由 PR #880 将正式 onboarding 委托给 Access Control transaction-bound Owner command；M3-B 由 PR #881 封堵 5 个旧 Writer／Deleter并建立 AQ008，Owner 外 direct mutation 为 `0／0`，唯一 allowlist 为 `1`；PR #882 独立审查通过。

M4 `0041` 经 PR #884～#892 完成实施、独立审查、两轮精确纠错、第三次受控执行、执行证据、执行独立审查与 handoff。第三次目标执行在最新 main、全新恢复点和全新唯一不可续期 Lease 下成功，目标 guarded 调用累计为 `3`、自动重试为 `0`；仓库／环境 journal 均为 `42／0041`，Membership all-null／partial／complete 为 `0／0／1`，baseline transition 为 `1`。active historical orphan／Scope relation orphan 保持 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`。

M5 `0042` 经 PR #893～#896 完成三文件实施、实施独立审查、固定 localhost-only local_acceptance 唯一 guarded 目标调用、执行证据与执行独立审查。零候选分支结果为 `planned／created／reused／conflict／unexpected=0／0／0／0／0`，环境 journal 从 `42／0041` 推进到 `43／0042`，snapshot 仍为 `0026`；Membership complete current、transition 与 exact current-head 保持 `1／1／1`，Binding／Scope／Context Version／Context Head 保持 `1／1／1／1`，业务 DML 为 `0`。执行前后恢复点和隔离恢复通过，Allocation Lease 未消费且已释放，Execution Lease `claim／consume／renewal／release／active=1／1／0／1／0`，目标调用为 `1`、自动重试为 `0`，F01／F02 已关闭。M5 已具备 handoff 收口条件；唯一下一任务为 `BASE-02 Membership Revision M6 Reader 从 updated_at 切换到显式 revision＋lifecycle`，本 handoff 内仍未启动。

M6 经 PR #898／#899 完成 authoritative Membership／Binding、Identity 与 Scope Reader 接线、Formal Session／Guard 切换和独立审查。正式链路采用 `Identity I1 → Membership／Binding M1 → Scope S1 → M2 → S2 → Identity I2` 双重读取，三个版本域保持独立，selector／lifecycle／revision／Provider 漂移全部 fail-closed；生产授权链 `tenant_members.updated_at` 读取和 Membership 时间戳兼容映射均为 `0／0`。实施范围为 42 文件（生产 24、测试 18），精确／支撑测试 22 文件、755/755，完整测试 430 文件、6341/6341，build 101/101；未连接数据库或修改 Schema／Migration。M6 已具备 handoff 收口条件，唯一下一任务为 `BASE-02 Membership Revision M7 Enforce 与旧路径退出`。

M7 经 PR #901～#908 完成前置校准、写入契约、`0043` Schema／Migration、一次受控执行、证据归因纠错与执行独立审查。固定本地验收环境的 `planned／created／reused／conflict／unexpected=7／7／0／0／0`，环境 journal 为 `44／0043`、snapshot 保持 `0026`；六个无条件 current envelope 列均为 `NOT NULL`，Membership complete／transition／exact current-head 为 `1／1／1`。全部 `public` 表数据与序列未变化，业务 DML 为 `0`；active historical orphan／Scope relation orphan 保持 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`。Execution Lease 已释放，guarded 目标调用为 `1`、自动重试为 `0`；恢复证明仅覆盖同集群空隔离数据库的选定 schema／data。PR #907 已关闭证据归因 F01，PR #908 独立审查通过。M7 已完成并具备 handoff 收口条件，唯一下一任务为 `BASE-B1 Owner／Port／revision 契约闭环`。

BASE-B1 经 PR #910／#911 完成单文件关闭证据与独立审查。最新 `main` 证明 Access Control、Identity、Tenancy 与 Security 的 Owner／Port 边界、Membership revision／Binding version／Scope revision 三个独立版本域、`I1→M1→S1→M2→S2→I2` 双重读取、多 Membership 显式选择或失败关闭、genuine Reader 与低敏引用均为 `all_exact`；Owner 外 direct Membership Writer／Deleter、生产授权 `tenant_members.updated_at` 读取与时间戳兼容映射均为 `0／0`。Operating Context 未进入授权组合，第二授权事实源为 `0`，因此 BASE-B1 不需要 Runtime 改动。BASE-B1 完成不表示 standalone Binding 生命周期、orphan、FK `VALIDATE`、对象 Guard／Action Policy 或业务 Reader 已完成；唯一下一任务为 `BASE-B2 Membership／Binding 生命周期`。

BASE-B2 已由 PR #913 完成 Membership reactivate 的 active Binding 冲突保护，存在任何 status=`active` 的 Binding 时均在事务锁内以 `binding_active_conflict` 失败关闭且写入为 `0`。PR #914 正式接受 M09-A：`auth_account_institution_bindings` 保持 Access Control 唯一 Binding canonical current／lifecycle history，Binding transition evidence 只作为同 Owner、同事务、append-only 历史，不得回答 current；PR #915 独立审查确认 F01～F05 全部关闭。BASE-B2 仍缺 transition evidence 物理模型、Migration、Owner Writer、legacy calibration、AQ008 扩展与最终独立审查，因此尚未完成；唯一下一任务为 `BASE-B2 Binding transition evidence Schema／Migration 前置预检`。

文档完成只代表同一套架构 V2 的视图与入口已经建立，不代表 runtime、Schema、Migration、API、UI、Capability、环境或七线正式发布已经完成。

### 6.1 当前架构与质量门禁

- Workflow：`.github/workflows/architecture-quality.yml`；
- 检查器：`scripts/verify/architecture-quality.mjs`；
- 差异模型：显式接收 PR `Base`／`Head`，只阻止本次差异新增的架构违规；
- 真实验证：PR #794 的 Run `30386375532`／Job `90366597304` 已完成架构自测、增量检查、lint、typecheck、完整测试和 build，结论为 `success`；
- Stage A 验证：PR #804 的最终 Run `30482219056`／Job `90678924630` 在冻结 Head `1948597d5349017485578723fd32535e84e2bd97` 上完成全部质量步骤，结论为 `success`；
- Stage A handoff：PR #805 Head `5d5c4e746f9de079088f62bb8585c1856e9f0a44`／Merge Commit `c52fef48e71f760017c8e39909b610ae6de180d8`，Run `30505641202`／Job `90754678015` 全部成功；
- Stage B Runner：PR #807 Head `d7abdc52c64be367b988db15bfbdaa251be33fd4`／Merge Commit `e50999ebc33dd07a4447fa8f9274e974e9beae63`，Run `30508177604`／Job `90762357307` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- 本地就绪修复 Stage A：PR #811 Head `50b007820b7fdb68ff35b6ef0e2a53b9e8e61880`／Merge Commit `fc08de343456a1f0d05092f1aedd389118b32b26`，Run `30514884226`／Job `90782386213` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- 本地就绪修复 Stage B：PR #814 Head `c5ad29e2775789cc28b47e0724f64e165b0eff9e`／Merge Commit `19f2dbe55799e533e609c7cece9eaad1b623babd`，Run `30519856557`／Job `90797620311` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- Candidate Governance／Stage C-0：PR #816 Base `0be5faf5b089fdf3b5e0c84f3dac09d1283368d2`／Head `4df7cac76887b5cc3336650911dfc7f0448516e5`／Merge Commit `eb7cde613c38e262aeb8519c53e7e3d21704b18f`，Run `30524750504`／Job `90813002538` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；Candidate 定向契约集 3 文件／105 个、完整测试 417 文件／5896 个、build 101／101 通过；
- Candidate Governance／Stage C-0 handoff：PR #817 Base `eb7cde613c38e262aeb8519c53e7e3d21704b18f`／Head `7ea19efccc5dd17a5e30c7c35571465d0d986f3f`／Merge Commit `c1be2e45389a74f653717a2a47a81a5559f3c35b`，Run `30526410379`／Job `90818243458` 成功；
- Source／Candidate v2 Governance：PR #818 Base `c1be2e45389a74f653717a2a47a81a5559f3c35b`／Head `29ee87fa7f7b3ab3749e4adedaf89457471d21ef`／Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350`，Run `30529676907`／Job `90828769200` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；v2 定向契约集 3 文件／225 个、完整测试 420 文件／6121 个、build 101／101 通过；
- Source v2 handoff：PR #819 Base `ff3528d703c00703998d62f69c1ded8f5f6a3350`／Head `4c964a167ad4e729681067ba319e4b9cb1940d3f`／Merge Commit `2e14cfd2cec73cd3d8dc08274ba70763402798bb`，Run `30530766787`／Job `90832302970` 成功；
- Stage C Candidate 人工审核：PR #820 Base `2e14cfd2cec73cd3d8dc08274ba70763402798bb`／Head `bc3ad6155df5ce071442183b85a301dd6366ec51`／Merge Commit `172526e15775fc99768e1d739fc3c0d947bc1363`，Run `30540499970`／Job `90863892886` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；Candidate payload 仍为 `candidate`，私有 Review State 仍为 `review_pending`；
- Approved Manifest 创建与校验：PR #823 Base `5c3e65f3757de8ee0322ea7c262e55e2b5548f96`／Head `78eff467a158baf4d70995cb59bd774c35327785`／Merge Commit `3f042172734c0dc9cc583a09f347e38df7db1e02`，Run `30548606044`／Job `90891106206` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- A2-P1 受控执行计划：PR #828 Base `24e5076a5e705ea374c9f96ad4ed3d6f53b8fe6c`／Head `77be8e4ac835ce76e77a6bf5c7026c63d83b58fc`／Merge Commit `184b0320be1bedaace5d72ff0b0e453f343ad52e`，Run `30565599037`／Job `90949208935` 的全部质量步骤成功；
- A2-P1 Write Adapter Runtime：PR #829 Base `184b0320be1bedaace5d72ff0b0e453f343ad52e`／Head `aa465a64aa146a43f766413caa53dfc88a1bd39b`／Merge Commit `bbf15be8f5acd66d80db5ac7b6e9250a57d5744e`，Run `30568943508`／Job `90960419070` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；定向 4 文件／109 个、完整 Provisioning 14 文件／510 个、完整基线 422 文件／6190 个测试与 build 101／101 通过；
- A2-P1 Runtime handoff：PR #830 Base `bbf15be8f5acd66d80db5ac7b6e9250a57d5744e`／Head `1d28b6a91bf3b7076f66478861a3a7cc46fdcb18`／Merge Commit `2ca100af132adf6676c09073f5d527c1b608d3ed`，Run `30570185023`／Job `90964638309` 的全部质量步骤成功；
- A2-P1 Authority／组合根无写证据：PR #831 Base `2ca100af132adf6676c09073f5d527c1b608d3ed`／Head `e427b57cdf810c9021d6beb1738a69f365bd7218`／Merge Commit `2da175330a4e15601c9806f75184df303e8cf2f9`，Run `30571861343`／Job `90970298323` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- A2-P2 只读预检：PR #843 Base `053108d995e5e0b1ac3cdd7d9ff6ae9e904821ec`／Head `0d5cf44273d4ca6a12c857f605c8bd07e4656759`／Merge Commit `683668a584670bb9b9431582cb5eae918d38eee1`，Run `30633506572`／Job `91165285987` 的全部质量步骤成功；
- A2-P2 独立审查：PR #844 Base `683668a584670bb9b9431582cb5eae918d38eee1`／Head `eba90d153e25f00e43651e6ce01fd8f7ef6be156`／Merge Commit `6460516d9a172a9bdaa5681b4b3407a7d212f54c`，Run `30634548162`／Job `91168725451` 的全部质量步骤成功；
- A2-P2 P0 校准：PR #846 Base `71fa600a691b2e8ee47bed34eec2cb8b94ebb2f8`／Head `df15c70436f4cda3085847e1b221202a74a2b299`／Merge Commit `daf07fbd632cb4276fde911e073521483e409baf`，Run `30637892951`／Job `91180059088` 的全部质量步骤成功；
- A2-P2 P0 独立审查：PR #847 Base `daf07fbd632cb4276fde911e073521483e409baf`／Head `b9632ab3a8c4bc1fb83e808f4ec98af2c75cb2e9`／Merge Commit `326260fec24112ffcb2ff3828c8c4398ad43f2b9`，Run `30638717649`／Job `91182885954` 的全部质量步骤成功；
- Membership Revision M2 Owner Writer／CAS：PR #877 Base `809b0e836fd5decea364726ca0ec44fdaa5b3e56`／Head `828ebb69e62267a67dff2d8cc21d7ddafb1d454b`／Merge Commit `e6add6403a7a502192c450615397304a74c4b8e7`，Run `30708477043`／Job `91391614603` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- Membership Revision M2 实现独立审查：PR #878 Base `e6add6403a7a502192c450615397304a74c4b8e7`／Head `ac76fe06ad5700d52e86f7c3622a2db65bbd441c`／Merge Commit `287b1d7cf66550424e304c6cc1354df334bb1e56`，Run `30708982932`／Job `91392949050` 的全部质量步骤成功，结论为 `base02_membership_revision_m2_implementation_review=passed`；
- Membership Revision M3-A onboarding 委托：PR #880 Base `5b8afc3d48932872714afc736f9c4f02f1fec675`／Head `c690789f341434fd7bb33e819151849e6c2a7afa`／Merge Commit `2d34177f0d2eb77ccaba0829ab3224e69911853f`，Run `30711226980`／Job `91398940037` 的全部质量步骤成功；
- Membership Revision M3-B 旧 Writer／Deleter 封堵：PR #881 Base `2d34177f0d2eb77ccaba0829ab3224e69911853f`／Head `b405403d6fea87e1d022d7e027e22d9f8600ae61`／Merge Commit `f8909e098def3810e0e336c9491facf83d4c3a57`，Run `30714150218`／Job `91406737286` 的全部质量步骤成功；
- Membership Revision M3 实现独立审查：PR #882 Base `f8909e098def3810e0e336c9491facf83d4c3a57`／Head `6f0b95b246aa115d63be49758ca66202f09ae589`／Merge Commit `df83b9527e3569c0997f0438a68d086592f3a36b`，Run `30714716713`／Job `91408247113` 的全部质量步骤成功，结论为 `base02_membership_revision_m3_implementation_review=passed`；
- Membership Revision M4 执行低敏证据：PR #890 Base `76a162005204efd74e6919541bd8cea9c72a0170`／Head `90ca634ced30c7386d5c0a3c5338fda5df6bd911`／Merge Commit `167e1193e474237e5a612a7df9860adcad8b7e8c`，Run `30725188721`／Job `91435449482` 的全部质量步骤成功；
- Membership Revision M4 执行独立审查：PR #891 Base `167e1193e474237e5a612a7df9860adcad8b7e8c`／Head `38c821ffe247306dc211e450923d0379f49036fe`／Merge Commit `4b79cdf39775fa7827be89a33fa339e8fda90faa`，Run `30725621418`／Job `91436644462` 的全部质量步骤成功，结论为 `base02_membership_revision_m4_execution_review=passed`；
- Membership Revision M5 三文件实施：PR #893 Base `9e833c9bb7eafda5e25e08a2344e1caa410877c1`／Head `43440e3f38c3c6ba3576dba1788b3fad586cfb5a`／Merge Commit `72c7568df3fd1078b813733eda472c01b0f8672d`，Run `30727616873`／Job `91442118293` 的全部质量步骤成功；
- Membership Revision M5 实施独立审查：PR #894 Base `72c7568df3fd1078b813733eda472c01b0f8672d`／Head `14c7e6e4419203dacd5d20b3bec2b3d8bc43c285`／Merge Commit `33c52ee41e20385e8541594fa92b4c5c6ce21cf9`，Run `30728269902`／Job `91443866416` 的全部质量步骤成功，结论为 `base02_membership_revision_m5_implementation_review=passed`；
- Membership Revision M5 执行低敏证据：PR #895 Base `33c52ee41e20385e8541594fa92b4c5c6ce21cf9`／Head `53e7f1c0ad257fdff935d3ce1234be0054a19b34`／Merge Commit `804444789d135903a737bc0721c452bcc74511b5`，Run `30729433131`／Job `91446923309` 的全部质量步骤成功；
- Membership Revision M5 执行独立审查：PR #896 Base `804444789d135903a737bc0721c452bcc74511b5`／Head `a768ddac965d42c96e59f2a2881a66961d9f3cf7`／Merge Commit `ea4a59df15fa14e64d7b7c5ad8a18b80452cc0c0`，Run `30729838933`／Job `91448020103` 的全部质量步骤成功，结论为 `base02_membership_revision_m5_execution_review=passed`；
- Membership Revision M6 Reader／Session／Guard 实施：PR #898 Base `3c6884a1aefbfb2dd0a9177c811f6375aef6fe2b`／Head `e1cc9e4e97c18a80d3bf8ce55ed588b259898f19`／Merge Commit `fe79267264f228cac217908365aa42f3f7408109`，Run `30734941015`／Job `91461924228` 的全部质量步骤成功；
- Membership Revision M6 实施独立审查：PR #899 Base `fe79267264f228cac217908365aa42f3f7408109`／Head `b105d566416b7d8ad5d10a38388c666d244a2f21`／Merge Commit `005f1bfee5e1d94b003feb47c5f1f091463c483c`，Run `30735331035`／Job `91462991272` 的全部质量步骤成功，结论为 `m6_implementation_review=passed`；
- 服务端硬门：`main.protected=true`，Required Check Context 为 `最小架构与质量门禁`，App ID／slug 为 `15368`／`github-actions`，`strict=true`、`enforce_admins=true`、审批数为 `0`；
- 服务端拒绝：普通 direct push、显式 force-with-lease 和删除受保护分支均被 GitHub 拒绝；不允许管理员 bypass；
- 合并策略：Stage A 验证 PR 使用 Merge Commit 合并；未启用 Linear History，仓库其他既有合并方法设置未在 Stage A 修改；
- `AQ001`：禁止新增第二套根级 `database/**`；
- `AQ002`：禁止新增机构端 legacy Route；
- `AQ003`：禁止新增平台端 legacy Route；
- `AQ004`：冻结聚合模块 `institution` 的未登记新增文件；
- `AQ005`：冻结聚合模块 `open-platform` 的未登记新增文件；
- `AQ006`：禁止 Domain 层新增对应用、数据库、集成或框架层的依赖；
- `AQ007`：禁止业务模块间新增对 `server/**` 或 Repository 实现的直接依赖。
- `AQ008`：禁止 Access Control 唯一 Owner Repository 之外的直接 Membership Writer／Deleter；内建 allowlist 精确为 `1`，rules exceptions 保持为空。

GitHub 最终只读核对结果为 `main.protected=true`，Required Check 已绑定 `github-actions` App ID `15368`，并要求分支基于最新 `main`。PR #804 已证明 Required Check 在 pending／failure 时阻断合并、在冻结 Head 的检查成功后允许正常 Merge Commit；测试、CI 或保护通过仍不得写成正式发布。

`development-architecture.md` 与 `software-architecture.md` 中“Architecture CI 尚未建立”的表述属于各自较早审计基线，不能覆盖最新 `main` 中已经合并的 Workflow 与检查器事实；本次 handoff 不越权重写这些架构正文。

## 7. 历史资料

| 文档 | 状态 | 使用方式 |
|---|---|---|
| [`zmtg-new-project-architecture-design.md`](./zmtg-new-project-architecture-design.md) | `historical` | 作为重建早期方案和需求来源，不再作为根 README 的唯一架构入口 |
| `docs/refactor/**` | `historical` | 作为目录治理、依赖、风险和试点的过程证据 |
| `docs/superpowers/plans/**` | `historical` | 作为七线和专项任务的历史设计／计划证据；与当前 `main` 冲突时以当前实现为准 |
| `docs/devlog/**` | `historical` | 开发过程和阶段记录 |

## 8. 交接文档职责

| 文档 | 只负责 |
|---|---|
| 根 `README.md` | 项目定位、当前状态摘要、快速启动、验证命令和文档导航 |
| `docs/handoff/CURRENT_STATUS.md` | 当前已合并状态、关键门禁、当前阶段和下一阶段 |
| `docs/handoff/NEXT_TASK.md` | 唯一下一任务的允许范围、禁止范围、验证和交付要求 |
| `docs/handoff/RELEASE_HISTORY.md` | 已合并历史和阶段闭环记录 |
| 本文件 | 架构文档导航、状态词和事实源关系 |

这些文件不能相互复制成长篇历史账本，也不能给出相互冲突的下一阶段。

## 9. 推荐阅读路径

### 产品和业务负责人

1. [`business-architecture.md`](./business-architecture.md)
2. [`institution-seven-stream-restart-baseline.md`](./institution-seven-stream-restart-baseline.md)
3. [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md)

### 应用和前端开发

1. [`application-architecture.md`](./application-architecture.md)
2. [`architecture-v2.md`](./architecture-v2.md)
3. [`v2-02c-platform-auth-route-preflight.md`](./v2-02c-platform-auth-route-preflight.md)
4. `src/modules/institution-contracts/v1/institution-navigation.ts`
5. `src/modules/institution-contracts/v1/institution-routes.ts`
6. `src/modules/institution-contracts/v1/institution-capability-registry.ts`

### 后端、数据和安全开发

1. [`architecture-v2.md`](./architecture-v2.md)
2. [`architecture-v2-module-map.md`](./architecture-v2-module-map.md)
3. [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md)
4. [`v2-02b-mig01-closure-preflight.md`](./v2-02b-mig01-closure-preflight.md)
5. [`v2-mig01-a2-provisioning-preflight.md`](./v2-mig01-a2-provisioning-preflight.md)
6. [`../decisions/mig01-a2-provisioning-accepted-decisions.md`](../decisions/mig01-a2-provisioning-accepted-decisions.md)
7. [`../decisions/mig01-a2-provisioning-decision-pack.md`](../decisions/mig01-a2-provisioning-decision-pack.md)
8. [`../operations/mig01-a2-provisioning-runbook.md`](../operations/mig01-a2-provisioning-runbook.md)
9. [`../operations/mig01-a2-local-acceptance-stage-a-20260730.md`](../operations/mig01-a2-local-acceptance-stage-a-20260730.md)
10. [`../operations/mig01-a2-local-readiness-stage-b-20260730.md`](../operations/mig01-a2-local-readiness-stage-b-20260730.md)
11. [`../operations/mig01-a2-manifest-candidate-governance-20260730.md`](../operations/mig01-a2-manifest-candidate-governance-20260730.md)
12. [`../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md`](../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md)
13. [`../operations/mig01-a2-manifest-candidate-approval-template-20260730.md`](../operations/mig01-a2-manifest-candidate-approval-template-20260730.md)
14. [`v2-02c-platform-auth-route-preflight.md`](./v2-02c-platform-auth-route-preflight.md)
15. [`../decisions/architecture-v2-decisions.md`](../decisions/architecture-v2-decisions.md)
16. [`data-architecture.md`](./data-architecture.md)
17. [`software-architecture.md`](./software-architecture.md)

### 部署和运维

1. [`deployment-architecture.md`](./deployment-architecture.md)
2. [`../operations/mig01-a2-provisioning-runbook.md`](../operations/mig01-a2-provisioning-runbook.md)
3. [`../operations/mig01-a2-local-acceptance-stage-a-20260730.md`](../operations/mig01-a2-local-acceptance-stage-a-20260730.md)
4. [`../operations/mig01-a2-local-readiness-stage-b-20260730.md`](../operations/mig01-a2-local-readiness-stage-b-20260730.md)
5. [`../operations/mig01-a2-manifest-candidate-governance-20260730.md`](../operations/mig01-a2-manifest-candidate-governance-20260730.md)
6. [`../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md`](../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md)
7. [`../operations/mig01-a2-manifest-candidate-approval-template-20260730.md`](../operations/mig01-a2-manifest-candidate-approval-template-20260730.md)
8. `docs/operations/production-migration-runbook.md`
9. `docs/operations/local-development.md`
10. `scripts/README.md`

### 开发与协作

1. [`development-architecture.md`](./development-architecture.md)
2. [`../../AGENTS.md`](../../AGENTS.md)
3. [`../ai-agent-governance.md`](../ai-agent-governance.md)
4. [`../agent-guardrails/zmtg-pr-gatekeeper.md`](../agent-guardrails/zmtg-pr-gatekeeper.md)

## 10. 架构文档更新规则

1. 先核对当前 `main`，再修改架构文档；
2. 新结论必须标记为 `current`、`target`、`proposed`、`planned` 或 `historical`；
3. 影响模块所有权、Migration 顺序、权限根或发布门禁的变更必须形成 ADR 或独立预检；
4. 不在多个文档维护相互独立的模块清单；
5. 不大段复制总体架构，视图文档应引用并展开；
6. 不为目录外观创建空模块或空适配器；
7. 仅文档 合并不构成 runtime、Schema、Migration、API、UI、Capability 或发布授权；
8. 发现代码与文档不一致时，优先记录差距，不把目标状态伪装为当前状态。

## 11. 当前项目级顺序

```text
就绪修复 Stage A：本地验收数据库安全恢复点与 A1 基线（已完成，PR #811）
→ 就绪修复 Stage B：只读 Repository Adapter 与 Context Policy（已完成，PR #814）
→ Candidate Governance：Candidate Contract、Source 与 Reviewer 生命周期（已完成，PR #816）
→ Stage C-0 独立 handoff（已完成，PR #817）
→ Source／Candidate v2 Governance（已完成，PR #818）
→ Source v2 handoff（已完成，PR #819）
→ Stage C：Candidate 生成、重新签发与用户人工审核（已完成，PR #820）
→ Approved Manifest 创建与校验（已完成，PR #823）
→ Approved Manifest 独立 handoff（已完成）
→ Stage D 本地只读 dry-run 验证（已完成，PR #825）
→ Stage D 独立审查（已完成，PR #826）
→ Stage D handoff（已完成，PR #827）
→ A2-P1 受控执行计划（已完成，PR #828）
→ Write Adapter Runtime（已完成，PR #829）
→ Runtime handoff（已完成，PR #830）
→ Authority／组合根无写准备与验证（已完成）
→ Authority／组合根低敏证据 PR（已完成，PR #831）
→ 独立 Authority／组合根 handoff（已完成，PR #832）
→ PUBLIC TEMPORARY 权限决策（已完成，PR #833）
→ PUBLIC TEMPORARY ACL 调整低敏证据（已完成，PR #834）
→ PUBLIC TEMPORARY ACL 独立审查（已完成，PR #835）
→ PUBLIC TEMPORARY ACL handoff（已完成）
→ Approved Manifest 重新签发低敏证据（已完成，PR #837）
→ Approved Manifest 重新签发独立审查（已完成，PR #838）
→ Approved Manifest 重新签发 handoff（已完成，PR #839）
→ 专用角色预置、A2-P1 execute 与低敏证据（已完成，PR #840）
→ A2-P1 独立审查（已完成，PR #841）
→ A2-P1 最终 handoff（已完成，PR #842）
→ A2-P2 只读 Catalog／数据 Shape 预检（已完成，PR #843）
→ A2-P2 独立审查（已完成，PR #844）
→ A2-P2 预检 handoff（已完成，PR #845）
→ A2-P2 P0 metadata current 校准（已完成，PR #846）
→ A2-P2 P0 独立审查（已完成，PR #847）
→ A2-P2 P0 handoff（已完成，PR #848）
→ A2-P2 P1 四文件实施（已完成，PR #849）
→ A2-P2 P1 实施独立审查（已完成，PR #850）
→ local_acceptance 单次受控 Migration 与执行证据（已完成，PR #851）
→ A2-P2 P1 执行独立审查（已完成，PR #852）
→ A2-P2 P1 最终 handoff（已完成，PR #853）
→ BASE-02 前置规划／准入方案（已完成，PR #854）
→ BASE-02 独立审查（已完成，PR #855）
→ BASE-02 handoff（已完成，PR #856）
→ Membership Revision 硬停止证据（已完成，PR #857）
→ Membership Revision Architecture Decision Pack（已完成，PR #858）
→ Membership Revision 独立审查（已完成，PR #859）
→ Membership Revision 决策 handoff（已完成，PR #860）
→ Membership Revision A-full Accepted Decision（已完成，PR #861）
→ Membership Revision A-full 接受独立审查（已完成，PR #862）
→ Membership Revision A-full 接受 handoff（已完成，PR #863）
→ BASE-02 Membership Revision Schema／Migration 前置预检与 proposed 物理模型（已完成，PR #864）
→ Membership Revision Schema／Migration 前置预检独立审查（已完成，PR #865）
→ Membership Revision 前置预检 handoff（已完成，PR #866）
→ P01～P12 与 M0～M7 Accepted Decision（已完成，PR #867）
→ 物理模型接受独立审查（已完成，PR #868）
→ M1 Expand 四文件实施（已完成，PR #869；独立质量修复 PR #870 后重放）
→ M1 实施独立审查（已完成，PR #871）
→ `0040` 未消费类型纠错与独立审查（已完成，PR #872／#873）
→ M1 第二次受控 Migration 与低敏证据（已完成，PR #874）
→ M1 执行独立审查（已完成，PR #875）
→ M1 handoff（已完成，PR #876）
→ M2 Access Control Owner Writer／CAS（已完成，PR #877）
→ M2 实现独立审查（已完成，PR #878）
→ M2 handoff（已完成，PR #879）
→ M3-A onboarding Owner 委托（已完成，PR #880）
→ M3-B 旧 Writer／Deleter 封堵与 AQ008（已完成，PR #881）
→ M3 实现独立审查（已完成，PR #882）
→ M3 handoff（已完成，PR #883）
→ M4 deterministic legacy calibration 实施与审查（已完成，PR #884／#885）
→ M4 Guard CLI 纠错与审查（已完成，PR #886／#887）
→ M4 `0041` record／relation alias 纠错与审查（已完成，PR #888／#889）
→ M4 第三次且仅一次受控执行与低敏证据（已完成，PR #890）
→ M4 执行独立审查（已完成，PR #891）
→ M4 handoff（已完成，PR #892）
→ M5 高水位追赶与冲突清零实施与审查（已完成，PR #893／#894）
→ M5 唯一受控执行与低敏证据（已完成，PR #895）
→ M5 执行独立审查（已完成，PR #896）
→ M5 handoff（已完成，PR #897）
→ M6 Reader 从 updated_at 切换到显式 revision＋lifecycle（已完成，PR #898／#899）
→ M6 handoff（已完成，PR #900）
→ M7 前置校准（已完成，PR #901）
→ M7 写入契约与独立审查（已完成，PR #902／#903）
→ M7 Schema／Migration 与独立审查（已完成，PR #904／#905）
→ M7 执行证据与归因纠错（已完成，PR #906／#907）
→ M7 执行独立审查（已完成，PR #908）
→ M7 handoff（已完成，PR #909）
→ BASE-B1 Owner／Port／revision 契约关闭证据与独立审查（已完成，PR #910／#911）
→ BASE-B1 handoff（已完成，PR #912）
→ BASE-B2 reactivate active Binding 冲突保护（已完成，PR #913）
→ BASE-B2 M09-A provenance accepted decision 与独立审查（已完成，PR #914／#915）
→ BASE-B2 Binding provenance handoff（本次收口）
→ BASE-B2 Binding transition evidence Schema／Migration 前置预检（唯一下一任务；handoff 合并后按当前 ULTRA 授权继续）
→ BASE-B2 transition evidence 物理实现、Owner Writer、legacy calibration、AQ008、独立审查与 handoff
→ BASE-B3～B6 独立实施与关闭
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

`V2-MIG01-A2-PROVISIONING-PREFLIGHT-01` 已通过 PR #797 完成并合并，PR #799 已将 proposed decision pack 合并到 `main`，PR #801 已记录 accepted 选择，PR #804／#805 已完成治理 Stage A 仓库硬门与交接，PR #807／#808 已完成治理 Stage B Runner 基础与交接，PR #809～#823 已完成本地只读预检、就绪修复、Candidate／Source Governance、人工审核与 Approved Manifest，PR #825～#839 已完成 Stage D、A2-P1 执行准备、权限边界与 Approved Manifest 重新签发，PR #840～#853 已完成 A2-P1 与 A2-P2 全链。PR #854～#868 已完成 BASE-02 前置方案、Membership Revision A-full 接受、物理模型预检与 P01～P12／M0～M7 绑定接受；PR #869～#909 已完成 M1～M7 全链及 handoff，PR #910～#912 已完成 BASE-B1 契约闭环。PR #913 已关闭 reactivate 安全缺口，PR #914／#915 已完成 M09-A Binding provenance 决策接受与独立审查。本 handoff 收口该决策链，唯一下一任务冻结为 `BASE-B2 Binding transition evidence Schema／Migration 前置预检`。

治理 Stage A 与治理 Stage B 已通过独立变更域和独立 PR 完成。A2-P1、A2-P2、BASE-02 前置方案、Membership Revision A-full 与 P01～P12／M0～M7 accepted 边界均已完成证据链。M1～M7 已全部收口，显式 Membership revision／lifecycle 已覆盖正式 Reader／Session／Guard，并完成无条件 current envelope Enforce 与旧路径退出；生产授权时间戳 fallback 为 `0／0`。BASE-B1 已以 `all_exact` 完成关闭且无需 Runtime 改动；BASE-B2 已启动并完成 reactivate 冲突保护及 M09-A 决策接受，但 transition evidence 全链尚未实施；BASE-B3～B6、orphan 数据修复、FK `VALIDATE` 与业务 Reader 仍未启动。

MIG-01 内部候选顺序继续保持：

```text
A2
→ BASE-02
→ Writer
→ Audit／模板
→ B
→ C
→ Reader
```

本地就绪修复 Stage A、Stage B、Candidate／Source Governance、Approved Manifest、Stage D、A2-P1 全链和 A2-P2 P0／P1 均已完成。索引和 `NOT VALID` FK 已精确进入仓库与固定本地验收环境；active historical orphan 与 Scope 关系 orphan 仍均为 `1／1`。BASE-02 前置方案、Membership Revision A-full accepted decision、P01～P12 物理模型、M1～M7 与 BASE-B1 均已完成；环境 journal 为 `44／0043`，snapshot 保持 `0026`，Membership complete current／transition／exact current-head 为 `1／1／1`，六个无条件 current envelope 列均为 `NOT NULL`。唯一下一任务为 `BASE-B2 Binding transition evidence Schema／Migration 前置预检`；BASE-B2 尚未完成，BASE-B3～B6、orphan 修复、A2-P2 FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 和业务 Reader 均未启动或继续阻断。该顺序不改变 MIG-01～MIG-06 的相对顺序。

后续既定数据顺序保持：

```text
MIG-01
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

## 12. 本文禁止的解释

- 本索引不是新架构源；
- 文档存在不代表对应目录、模块或服务已经存在；
- `target` 不等于已实施；
- `current` 不等于正式发布；
- Capability Registry 不等于授权；
- Capability 状态不等于对象或动作权限；
- 角色 Audience 不等于服务端授权；
- 代码合并、测试通过或 Demo 可用不等于七线正式上线。


<!-- BASE02_BINDING_TRANSITION_PREFLIGHT_HANDOFF_20260802 -->

## BASE-B2 Binding transition evidence 前置预检

- PR #917：Head `97c02f1250f5f5fbff468b17953074db5b67eb4c`，Merge Commit `77a626ed182230f91b6d27daeaa4b0f297b377d9`，Run `30750704426` 成功；
- 独立审查 PR #918：Head `749bb269393c50bc9638ab7f76f97b04df2a610b`，Merge Commit `32b08e5e7bca4331c421ac5a637a846a884e2bf1`，Run `30751540734` 成功；
- 结论：`binding_transition_evidence_preflight_review=passed`；
- M09-A 物理方向已冻结，不需要新增 physical model decision；
- 下一任务为 Binding transition evidence Expand DDL Schema／Migration 实施；
- 本 handoff 不表示 Schema、Migration、Lease、DDL、DML 或数据库执行已经开始。

<!-- BASE02_BINDING_TRANSITION_0044_HANDOFF_START -->

## BASE-B2 Binding transition evidence `0044` 执行收口

- `0044_base02_binding_transition_expand` 已在固定本地验收环境唯一消费；
- 环境 journal 为 `45`，Catalog 为 `all_exact`；
- 唯一执行、恢复核验和执行独立审查均已通过；
- 下一任务为 Binding Runtime Writer／same-transaction evidence 前置预检；
- legacy calibration、orphan、FK `VALIDATE`、BASE-B3 和业务 Reader继续阻断。

<!-- BASE02_BINDING_TRANSITION_0044_HANDOFF_END -->

<!-- BASE02_BINDING_RUNTIME_WRITER_PREFLIGHT_HANDOFF_START -->

## BASE-B2 Binding Runtime Writer 前置预检收口

- accepted path：`B2_W1_extend_existing_access_control_transaction_kernel`；
- standalone `create／rebind／revoke／expire`、parent Membership Binding evidence、transaction-bound Scope assertion 与 rollback／concurrency 测试已冻结；
- 精确实施 allowlist 为 `13` 个文件；
- 下一任务为 Binding Runtime Writer／same-transaction transition evidence 实施；
- Schema／Migration、数据库连接、legacy calibration、BASE-B3 与业务 Reader继续阻断。

<!-- BASE02_BINDING_RUNTIME_WRITER_PREFLIGHT_HANDOFF_END -->

<!-- BASE02_BINDING_RUNTIME_WRITER_HANDOFF_START -->

## BASE-B2 Binding Runtime Writer 实施收口

- standalone lifecycle、same-transaction evidence 与 Scope assertion 已完成；
- 实施及独立审查通过；
- 下一任务为旧 Binding 写入口与 AQ008 前置预检；
- calibration、BASE-B3 与业务 Reader继续阻断。

<!-- BASE02_BINDING_RUNTIME_WRITER_HANDOFF_END -->

<!-- BASE02_BINDING_WRITER_AQ008_PREFLIGHT_HANDOFF_START -->

## BASE-B2 Binding writer AQ008 前置预检收口

- Owner 外 Binding current／evidence 直接 Writer 为 `0`；
- legacy direct writers 按缺失即禁用收口；
- AQ008 扩展方向、唯一 Owner allowlist、两文件范围与测试矩阵已冻结；
- 下一任务为 AQ008 Binding writer gate 扩展实施；
- calibration、BASE-B3 与业务 Reader继续阻断。

<!-- BASE02_BINDING_WRITER_AQ008_PREFLIGHT_HANDOFF_END -->

<!-- BASE02_AQ008_BINDING_WRITER_GATE_HANDOFF_START -->

## BASE-B2 AQ008 Binding writer gate 实施收口

- Membership 既有 AQ008 保护保持；
- Binding current 与 Binding transition evidence 已纳入同一 Owner writer gate；
- 唯一 Owner allowlist 保持为 Access Control Membership command repository；
- 实施与独立审查均通过；
- 下一任务为 deterministic legacy Binding calibration DML Migration 前置预检；
- historical orphan、FK `VALIDATE`、BASE-B3 与业务 Reader继续阻断。

<!-- BASE02_AQ008_BINDING_WRITER_GATE_HANDOFF_END -->

<!-- BASE02_BINDING_LEGACY_CALIBRATION_PREFLIGHT_HANDOFF_START -->

## BASE-B2 legacy Binding calibration 前置预检收口

- deterministic mapping、identity、锁序、高水位与计数守恒已冻结；
- DML 只允许向 Binding transition evidence 执行 INSERT；
- Binding current、Membership、Scope、Context 与 historical orphan 保持不变；
- 三文件实施范围已冻结；
- 下一任务为 DML Migration 实施；
- 数据库执行、FK VALIDATE、BASE-B3 与业务 Reader继续阻断。

<!-- BASE02_BINDING_LEGACY_CALIBRATION_PREFLIGHT_HANDOFF_END -->

<!-- BASE02_BINDING_LEGACY_CALIBRATION_IMPLEMENTATION_HANDOFF_START -->

## BASE-B2 Binding legacy calibration Migration 实施收口

- 0045 deterministic legacy calibration Migration 已完成仓库实现；
- 唯一业务 DML 为 Binding transition evidence INSERT；
- current、Membership、Scope、Context 与 historical orphan 零 mutation；
- identity、锁序、高水位、fingerprint 与计数守恒已固化；
- 实施和独立审查均通过，但数据库尚未执行；
- 下一任务为执行准备；
- FK VALIDATE、BASE-B3 与业务 Reader继续阻断。

<!-- BASE02_BINDING_LEGACY_CALIBRATION_IMPLEMENTATION_HANDOFF_END -->

<!-- BASE02_BINDING_LEGACY_CALIBRATION_EXECUTION_HANDOFF_START -->

## BASE-B2 Binding legacy calibration 0045 执行收口

- 0045 已完成唯一 guarded target call，自动重试为 0；
- planned／created／reused／conflict／unexpected 为 1／1／0／0／0；
- Binding current 未修改，新增 exact legacy evidence 1 条，residual candidate 为 0；
- Membership、Scope、Context 与 historical orphan 保持原值；
- Scope FK 继续 NOT VALID；
- 前后恢复点、执行后隔离恢复与 Lease 清理均通过；
- 下一任务为 Binding 高水位／冲突／Owner Writer 清零复核；
- BASE-B3 与业务 Reader继续阻断。

<!-- BASE02_BINDING_LEGACY_CALIBRATION_EXECUTION_HANDOFF_END -->

<!-- BASE02_B2_FINAL_CLOSURE_HANDOFF_START -->

## BASE-B2 Membership／Binding 生命周期最终收口

- canonical current、CAS、provenance 与 append-only evidence 已完整建立；
- standalone create／rebind／revoke／expire 和 Membership side effect 同事务原子；
- legacy Binding calibration 已完成；
- residual、冲突、Owner 外 writer、destructive evidence Runtime 和第二事实源均为 0；
- AQ008 Binding current／evidence gate 已验证；
- historical orphan 未修改，Scope FK 继续 NOT VALID；
- BASE-B2 正式完成；
- 下一任务为 BASE-B3 正式 Session／上下文刷新及三类 revision 实时重读前置预检。

<!-- BASE02_B2_FINAL_CLOSURE_HANDOFF_END -->

<!-- BASE02_B3_SESSION_REVISION_PREFLIGHT_HANDOFF_START -->

## BASE-B3 正式 Session／revision 实时重读前置预检收口

- 正式登录、Session 恢复和每请求授权入口已经冻结；
- Membership revision、Binding version/status/expiry 与 Scope revision/status 均实时重读；
- 登录与 Session 恢复执行双轮 Owner fact 稳定性比较；
- cookie 与 claims 只保存 selector，不保存授权 current；
- transition evidence、缓存、Operating Context 与 updated_at fallback 不进入授权组合；
- 现有 Runtime 与测试已满足契约，Runtime 变更和 implementation allowlist 均为 0；
- 下一任务为 BASE-B3 契约关闭证据，BASE-B4 尚未启动。

<!-- BASE02_B3_SESSION_REVISION_PREFLIGHT_HANDOFF_END -->

<!-- BASE02_B3_FINAL_CLOSURE_HANDOFF_START -->

## BASE-B3 正式 Session／三类 revision 实时重读最终收口

- 正式登录、Session 恢复和每请求授权入口全部固定；
- Membership revision、Binding version/status/expiry 与 Scope revision/status 均实时读取 canonical current；
- 登录和 Session 恢复使用双轮 Owner fact 稳定性比较；
- cookie 与 claims 只保存 selector，不保存授权 current；
- transition evidence、缓存、Operating Context 与 updated_at fallback 均不参与授权 current；
- stale、过期、撤销、多 Membership、缺 Scope 和 Reader 异常全部 fail-closed；
- 现有 Runtime 已满足契约，无需制造代码修改；
- BASE-B3 正式完成，下一阶段为 BASE-B4 Guard 与绕过闭环前置预检。

<!-- BASE02_B3_FINAL_CLOSURE_HANDOFF_END -->

<!-- BASE02_B4_GUARD_BYPASS_PREFLIGHT_HANDOFF_START -->

## BASE-B4 Guard／绕过闭环前置预检收口

- Scope、Section 与 Navigation Guard 已具备；
- Object Guard、Action Policy 与对象事实消费 Port 为当前缺口；
- 入口／维护／绕过候选已形成可审计 CSV；
- Owner 外 Membership／Binding Writer 保持 0；
- 接受 capability-off Object／Action Guard 核心实施路径，精确 allowlist 为 10 文件；
- 业务 Reader、Capability、BASE-B5 与 historical orphan 处置继续阻断。

<!-- BASE02_B4_GUARD_BYPASS_PREFLIGHT_HANDOFF_END -->

<!-- BASE02_B4_OBJECT_ACTION_GUARD_CORE_HANDOFF_START -->

## BASE-B4 Action Policy／Object Guard capability-off 核心实施

- 新增版本化低敏对象事实 Port；
- 新增固定注册表 Action Policy；
- 新增 genuine Object Guard 与低敏 allow；
- request authorization 新增 action／object 两个方法；
- institution runtime 显式保持 object fact reader 为 null；
- 业务 Reader 与真实 Capability 继续关闭；
- 下一任务转入机构端入口清单校准和第一批正式 Route Guard 接线前置预检。

<!-- BASE02_B4_OBJECT_ACTION_GUARD_CORE_HANDOFF_END -->

<!-- BASE02_B4_ROUTE_GUARD_FIRST_BATCH_PREFLIGHT_START -->

## BASE-B4 第一批正式 Route Guard 接线前置预检

- 116 项入口已重新校准；
- 第一批固定为 GET-only、非动态、无直接数据库、无 demo signal 的机构 Route；
- 第一批只使用 Scope + Section Guard；
- 不误用 Object Guard，不开放业务 Reader 或新 Capability；
- 精确实施 allowlist 为 12 个文件；
- 下一任务为第一批 capability-off Route Guard 接线实施。

<!-- BASE02_B4_ROUTE_GUARD_FIRST_BATCH_PREFLIGHT_END -->

<!-- BASE02_B4_ROUTE_GUARD_FIRST_BATCH_IMPLEMENTATION_HANDOFF_START -->

## BASE-B4 第一批正式 Route Guard capability-off 接线收口

- 5 个低风险 GET-only Route 已接入统一 Scope + Section Guard；
- 共享 Guard 固定在 `src/app/api/institution/_shared`；
- 无 genuine authorization 或 Section Allow 时统一 `403 / no-store`；
- 授权通过后原 handler Response contract 保持不变；
- 最终范围为 6 个生产文件和 14 个测试文件；
- 完整测试、架构门禁、lint、typecheck、build 与 Required Check 均通过；
- 业务 Reader 与新 Capability 继续关闭；
- 下一任务转入剩余正式 Route 再校准与第二批低风险前置预检。

<!-- BASE02_B4_ROUTE_GUARD_FIRST_BATCH_IMPLEMENTATION_HANDOFF_END -->

<!-- BASE02_B4_ROUTE_GUARD_SECOND_BATCH_PREFLIGHT_START -->

## BASE-B4 第二批低风险 Route Guard 前置预检

- 剩余机构端 Route 已重新扫描，不直接沿用旧 73 项校准；
- 第二批冻结 5 个 GET-only、非动态、无 DB、无 demo、无高风险的 capability-off Route；
- 第二批继续复用 `src/app/api/institution/_shared/institution-route-guard.ts`；
- Guard 链固定为 Scope + Section；
- 共享 Guard 不修改；
- 既有 handler-contract 测试影响面已进入精确 allowlist；
- 实施必须运行完整 `pnpm test`；
- 业务 Reader 与新 Capability 继续关闭。

<!-- BASE02_B4_ROUTE_GUARD_SECOND_BATCH_PREFLIGHT_END -->

<!-- BASE02_B4_ROUTE_GUARD_SECOND_BATCH_IMPLEMENTATION_HANDOFF_START -->

## BASE-B4 第二批正式 Route Guard capability-off 接线收口

- 5 个低风险 GET-only Route 已接入统一 Scope + Section Guard；
- Guard 拒绝固定为 `403 / no-store`；
- 授权通过后原 `503 capability-off` handler contract 保持；
- 最终范围为 5 个生产 Route、5 个 colocated 测试和 5 个兼容性测试；
- 共享 Guard 未修改；
- 完整测试 446 files／6409 tests、架构门禁、lint、typecheck、build 与 Required Check 均通过；
- 业务 Reader 与新 Capability 继续关闭；
- 下一任务转入剩余 4 个低风险候选的第三批前置预检。

<!-- BASE02_B4_ROUTE_GUARD_SECOND_BATCH_IMPLEMENTATION_HANDOFF_END -->

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_PREFLIGHT_START -->

## BASE-B4 第三批低风险 Route Guard 前置预检

- 第二批实施与独立审查已完成；
- 第三批冻结 4 个 GET-only、非动态、无数据库和无高风险依赖的 capability-off Route；
- 统一复用 `src/app/api/institution/_shared` 共享 Guard；
- Guard 链继续为 Scope + Section；
- 既有 handler-contract 测试与生产调用面已纳入影响面；
- 测试调用公开 GET 时必须 `await`；
- 完整 `pnpm test`、typecheck 和 build 是强制实施门禁；
- 业务 Reader 与新 Capability 继续关闭。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_PREFLIGHT_END -->

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_SCOPE_CORRECTION_START -->

## BASE-B4 第三批 Route Guard 前置范围校正

- 补充 v1 re-export 的传递兼容性测试影响面；
- compatibility tests 从 4 校正为 5；
- implementation allowlist 从 12 校正为 13；
- 生产 Route、共享 Guard 和 v1 re-export 范围均未扩大；
- 校正独立审查通过后重新准入第三批实施。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_SCOPE_CORRECTION_END -->

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_SCOPE_CORRECTION_02_START -->

## BASE-B4 第三批 Route Guard 前置范围第二次校正

- 新增 2 个直接消费候选 Route 的兼容性测试；
- compatibility tests 从 5 校正为 7；
- implementation allowlist 从 13 校正为 15；
- 生产范围、共享 Guard 和 v1 re-export 均未扩大；
- corrected handoff 后恢复第三批实施。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_SCOPE_CORRECTION_02_END -->

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_IMPLEMENTATION_HANDOFF_START -->

## BASE-B4 第三批正式 Route Guard capability-off 接线收口

- 4 个低风险 GET-only Route 已接入 Scope + Section Guard；
- 三批累计完成 14 个正式 Route 接线；
- Guard 拒绝固定为 `403 / no-store`；
- 授权通过后原 `503 capability-off` contract 保持；
- 最终范围为 4 个生产 Route、4 个 colocated 测试和 7 个兼容性测试；
- 共享 Guard 与 v1 re-export 均未修改；
- 完整测试 446 files／6409 tests、架构门禁、lint、typecheck、build
  与 Required Check 均通过；
- 业务 Reader 与新 Capability 继续关闭；
- 下一任务进入全量入口 Guard／绕过闭环终检和剩余生命周期入口校准。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_IMPLEMENTATION_HANDOFF_END -->

<!-- BASE02_B4_FULL_ENTRY_BYPASS_CLOSURE_PREFLIGHT_START -->

## BASE-B4 全量入口 Guard／绕过闭环终检前置预检

- 从第三批收口后的 main 重建 API、Page、Server Action 和生命周期入口清单；
- formal guarded Routes：14；
- Owner outside direct Writer／Deleter：1；
- lifecycle unresolved：4；
- completion candidate：false；
- 业务 Reader 与 Capability 继续关闭；
- 下一任务：`BASE-B4 Owner 外 Membership／Binding Writer／Deleter 关闭前置预检`。

<!-- BASE02_B4_FULL_ENTRY_BYPASS_CLOSURE_PREFLIGHT_END -->

<!-- BASE02_B4_OWNER_WRITER_FALSE_POSITIVE_CALIBRATION_START -->

## BASE-B4 Owner 外 Writer／Deleter 静态误报校准

- 原 Owner outside direct Writer／Deleter `1` 校准为 `0`；
- 原 lifecycle unresolved `4` 校准为 `0`；
- 4 项均为测试夹具、治理检查器、错误码或禁用 UI 文案误报；
- 生产代码修改：0；
- 业务 Reader 与 Capability 继续关闭；
- 下一任务：`BASE-B4 剩余 capability-off 正式 Route 第四批精确校准前置预检`。

<!-- BASE02_B4_OWNER_WRITER_FALSE_POSITIVE_CALIBRATION_END -->

<!-- BASE02_B4_ROUTE_GUARD_FOURTH_BATCH_PREFLIGHT_START -->

## BASE-B4 第四批低风险 Route Guard 精确校准

- 宽口径 capability-off：70；
- 严格候选：1；
- 第四批冻结：1；
- implementation allowlist：3；
- 生产修改：0；
- 业务 Reader 与 Capability 继续关闭；
- 下一任务：`BASE-B4 第四批低风险正式 Route Guard capability-off 接线实施`。

<!-- BASE02_B4_ROUTE_GUARD_FOURTH_BATCH_PREFLIGHT_END -->

<!-- BASE02_B4_ROUTE_GUARD_FOURTH_BATCH_IMPLEMENTATION_HANDOFF_START -->

## BASE-B4 第四批正式 Route Guard capability-off 接线收口

- `ai-service-usage` 已接入 Scope + system Section Guard；
- Guard 拒绝固定为 `403 / no-store`；
- 授权通过后原 `410 capability-off` 状态、payload 与 no-store 保持；
- 最终范围为 1 个生产 Route、1 个 colocated 测试和 1 个兼容性测试；
- 共享 Guard 未修改；
- 业务 Reader 与新 Capability 继续关闭；
- 下一任务进入剩余正式入口分类校准与 BASE-B4 完成审计前置预检。

<!-- BASE02_B4_ROUTE_GUARD_FOURTH_BATCH_IMPLEMENTATION_HANDOFF_END -->

<!-- BASE02_B4_REMAINING_ENTRY_CLASSIFICATION_HANDOFF_START -->

## BASE-B4 剩余正式入口分类校准收口

- 已生成全量 inventory、完成审计缺口清单和下一窄切片证据；
- formal guarded Routes：15；
- completion audit ready：false；
- production、database、migration、DML：0；
- 唯一下一任务：`BASE-B4 剩余高风险正式入口治理决策`。

<!-- BASE02_B4_REMAINING_ENTRY_CLASSIFICATION_HANDOFF_END -->

<!-- BASE02_B4_HIGH_RISK_ENTRY_GOVERNANCE_HANDOFF_START -->

## BASE-B4 剩余高风险正式入口治理决策收口

- 剩余 66 个入口已按风险族冻结治理决策；
- broad Section Guard 不得批量套用到 mutation／mixed 或高风险入口；
- CSV 证据已恢复为真实 LF 物理行；
- 第一治理切片冻结为 9 个只读动态对象入口；
- 下一任务只进行 Scope + Section + Object Guard 精确预检；
- production、database、migration 与 DML 变化均为 0。

<!-- BASE02_B4_HIGH_RISK_ENTRY_GOVERNANCE_HANDOFF_END -->

<!-- BASE02_B4_READONLY_DYNAMIC_OBJECT_GUARD_PREFLIGHT_HANDOFF_START -->

## BASE-B4 只读动态对象 Object Guard 精确预检收口

- 9 条只读动态对象 Route 已完成分类；
- 3 条 customer 与 1 条 knowledge_item 可由现有 Object Port 表达；
- 5 条为未注册对象类型或父子复合资源；
- production Object Fact Reader Adapter 为 0；
- Runtime 继续显式 `objectFactReader: null`；
- implementation allowlist 为 0；
- 下一任务进入客户对象事实 Reader 前置设计与准入。

<!-- BASE02_B4_READONLY_DYNAMIC_OBJECT_GUARD_PREFLIGHT_HANDOFF_END -->

<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_DESIGN_HANDOFF_START -->

## BASE-B4 客户对象事实 Reader 前置设计与准入收口

- Customers 目标语义 Owner：`src/modules/customers`；
- legacy repository 只保留 scoped compatibility bridge；
- revision 来源：customers.updatedAt；
- production Reader Adapter：0；
- Runtime：`objectFactReader: null`；
- 核心实施严格限制在 8 文件 allowlist；
- 核心实施不包含 Route 接线或 Capability 开放。

<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_DESIGN_HANDOFF_END -->


<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_AQ007_AMENDMENT_START -->

## BASE-B4 客户对象事实 Reader AQ007 架构修正

- 禁止 Customers Application 直接依赖 Security Server；
- 新增 Security Application façade；
- 不新增架构规则例外；
- allowlist：7 → 8；
- Route／Policy／Schema／Migration／database execution：0。

<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_AQ007_AMENDMENT_END -->

<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_CORE_HANDOFF_START -->

## BASE-B4 客户对象事实 Reader 核心实施收口

- AQ007 已通过 Security Application façade 修正，未新增架构例外；
- Customers-owned source Port 与 genuine Reader 已实施；
- legacy repository 仅提供 scoped 低敏桥；
- revision 来源为 customers.updatedAt；
- Runtime 已懒注入 Reader；
- customer Route wiring 仍为 0；
- 业务 Capability 继续关闭；
- 下一任务仅预检 3 条 customer GET Route。

<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_CORE_HANDOFF_END -->

<!-- BASE02_B4_CUSTOMER_ROUTE_OBJECT_GUARD_PREFLIGHT_START -->

## BASE-B4 客户 Route Object Guard 前置预检收口

- 三条 customerId GET Route 当前均未接 Object Guard；
- customer Reader 与 Runtime 注入已就绪；
- Shared Guard 将新增 Section + Dynamic Object wrapper；
- Section 与 Object 必须各使用一个 fresh Authorization；
- Context 仅在 Section allow 后读取，Guard 阶段不读取 Request；
- 所有 Guard 失败统一为低敏 no-store 403；
- 首个切片仅接线客户完整时间线，共 4 文件；
- 允许后仍保留原 capability-disabled 503 Handler。

<!-- BASE02_B4_CUSTOMER_ROUTE_OBJECT_GUARD_PREFLIGHT_END -->

<!-- BASE02_B4_CUSTOMER_TIMELINE_OBJECT_GUARD_WIRING_START -->

## BASE-B4 客户完整时间线 Route Object Guard 最小接线收口

- 共享 Section + Dynamic Object Route Guard 已实施；
- Section 与 Object 各使用 fresh Authorization；
- Context 仅在 Section allow 后读取；
- 客户完整时间线已接 customers／customer／read；
- 所有 Guard 失败统一为低敏 no-store 403；
- 原 503 capability-disabled Handler 保留；
- 另外两条客户 Route 仍未接线；
- 业务 Timeline 读取能力继续关闭。

<!-- BASE02_B4_CUSTOMER_TIMELINE_OBJECT_GUARD_WIRING_END -->

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_OVERVIEW_OBJECT_GUARD_ADMISSION_START -->

## BASE-B4 客户随访概览 Object Guard 接线准入收口

- shared Object Route Guard 已就绪并通过独立审查；
- 客户随访概览当前仍未接线；
- customers／customer／read 与 customerId 来源已冻结；
- 首次实施严格限制 Route 与测试 2 文件；
- 共享 Guard 不允许修改；
- 原低敏 no-store 503 Handler 必须保留；
- 本轮未修改生产 Route，未开放业务读取能力。

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_OVERVIEW_OBJECT_GUARD_ADMISSION_END -->

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_OVERVIEW_OBJECT_GUARD_WIRING_START -->

## BASE-B4 客户随访概览 Route Object Guard 最小接线收口

- 复用既有共享 Object Route Guard，未修改共享 Guard；
- 客户随访概览已接 customers／customer／read；
- customerId 仅来自 context.params.customerId；
- 所有 Guard 失败统一为低敏 no-store 403；
- 原 503 capability-disabled Handler 保留；
- 当前客户 Section/Object Route 接线为 2／2；
- 客户随访时间线仍未接线；
- 业务随访概览读取能力继续关闭。

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_OVERVIEW_OBJECT_GUARD_WIRING_END -->

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_TIMELINE_OBJECT_GUARD_ADMISSION_START -->

## BASE-B4 客户随访时间线 Route Object Guard 接线准入收口

- 共享 Object Route Guard 已就绪并通过独立审查；
- 客户完整时间线与客户随访概览已接线；
- 当前客户 Section/Object 接线为 2／2；
- 客户随访时间线仍保持未接线的低敏 no-store 503；
- 冻结 customers／customer／read 与 context.params.customerId；
- 实施 allowlist 精确为 Route 与 Route 测试两个文件；
- 共享 Guard 不允许修改；
- 业务随访时间线读取能力继续关闭。

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_TIMELINE_OBJECT_GUARD_ADMISSION_END -->

<!-- BASE02_B4_CUSTOMER_THREE_ROUTE_OBJECT_GUARD_WIRING_START -->

## BASE-B4 客户三路动态 Route Object Guard 接线收口

- 客户完整时间线、随访概览、随访时间线均已接 customers／customer／read；
- 所有 Guard 失败统一为低敏 no-store 403；
- 三条原 503 capability-disabled Handler 均保留；
- 当前客户 Section/Object Route 接线为 3／3；
- remaining unwired customer Routes 为 0；
- 业务客户读取能力继续关闭；
- 下一步回到 BASE-B4 全量入口 Guard／绕过闭环终检复算。

<!-- BASE02_B4_CUSTOMER_THREE_ROUTE_OBJECT_GUARD_WIRING_END -->

<!-- BASE02_B4_FULL_ENTRY_BYPASS_FINAL_RECOMPUTE_START -->

## BASE-B4 全量入口 Guard／绕过闭环终检复算收口

- 81 条机构 API Route 已重新枚举；
- 18 条正式 Guard Route 与 63 条治理型 fail-closed Route 精确覆盖；
- ungoverned Route 为 0；
- 客户三条动态 Route Section/Object Guard 为 3／3；
- Owner 外直接 Writer 与 lifecycle unresolved 均为 0；
- BASE-B4 completion candidate 为 true；
- BASE-B4 仍需独立完成审计，不在本轮直接标记 complete；
- Reader、Capability、historical orphan 与 BASE-B5 均未放行。

<!-- BASE02_B4_FULL_ENTRY_BYPASS_FINAL_RECOMPUTE_END -->

<!-- BASE02_B4_COMPLETION_BASEB5_ORPHAN_PREPLAN_START -->

## BASE-B4 完成与 BASE-B5 historical orphan 决策前置规划

- BASE-B4 的 12 项完成标准已通过完成审计和独立复核；
- 81 条机构 API Route 保持 18／63／0 的正式 Guard、治理型 fail-closed、ungoverned 分布；
- 客户 Section/Object Guard 为 3／3；
- Owner 外 Writer 与 lifecycle unresolved 均为 0；
- BASE-B4 已标记 complete；
- BASE-B5 的 5 个决策分支、权威证据和停止条件已冻结；
- 保持阻断仍为默认；
- historical orphan 未处置，数据库与 DML 未授权；
- BASE-02、Reader 和 Capability 继续阻断。

<!-- BASE02_B4_COMPLETION_BASEB5_ORPHAN_PREPLAN_END -->

# 机构端七条业务线重启基线

## S37 当前入口：Knowledge 首切片已选，formal facts 与 scope 均为空

- S36：PR #1243 已合并，Care mapping ready、formal scope blocker 正式记录
- S37 首切片：`KNOWLEDGE_DOCUMENT_METADATA_LIST_BY_FORMAL_INSTITUTION_SCOPE`
- candidate：Knowledge 13 个数据 cohort、formal Scope 与 active Binding 均为 0
- 结论：document metadata 不依赖 AI/OCR/worker；authoritative provenance 与 formal authority 未闭合，Runtime allowlist=0

```text
STAGE=S37
BASELINE=ab5b4b12bac381d4eb62c554a35ff476657f7901
S36_PR=1243
S36_HEAD=a3d8f2f7c624f2eee50ac2cef94631bae813cdc5
S36_MERGE=ab5b4b12bac381d4eb62c554a35ff476657f7901
S36_FORMAL_CLOSURE=true

KNOWLEDGE_SELECTED_FIRST_SLICE=KNOWLEDGE_DOCUMENT_METADATA_LIST_BY_FORMAL_INSTITUTION_SCOPE
KNOWLEDGE_DATA_READINESS=blocked_authoritative_fact_and_formal_scope_cohorts_empty
KNOWLEDGE_SCHEMA_CHANGE_REQUIRED=true
KNOWLEDGE_MIGRATION_REQUIRED=true
KNOWLEDGE_EXTERNAL_SYSTEM_REQUIRED_FOR_SELECTED_SLICE=false
KNOWLEDGE_FORMAL_READER_API_AUTH_CHAIN_READY=false
KNOWLEDGE_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
KNOWLEDGE_EXACT_RUNTIME_FILE_COUNT=0

NEXT_KNOWLEDGE_TASK=SEVEN_STREAM_KNOWLEDGE_DOCUMENT_METADATA_FORMAL_FACT_PROVENANCE_AND_SCOPE_PROVISIONING_FRESH_ADMISSION
NEXT_KNOWLEDGE_TASK_AUTHORIZED=false
NEXT_STAGE=UNASSIGNED
NEXT_STAGE_AUTO_EXECUTION=false
```

current source kind 只能表达 `mock|seed|demo`，不能作为正式 Reader provenance；active candidate 又没有 Knowledge rows、formal Scope 或 Binding。`src/modules/knowledge-base/**` 与 legacy institution/open-platform Knowledge 只保持 compatibility，不得成为第二套 formal owner。Canonical fact/repository/read-model/presentation owner 均冻结到 `src/modules/knowledge/**`，cross-owner composition 归 orchestration。

Canonical evidence：`docs/operations/seven-stream-knowledge-formal-fresh-admission-20260815.md`。

## S36 当前入口：appointments pair 已重建，formal authority 仍为空

- S35：PR #1242 已合并，candidate 上的 formal Scope/Context/Binding cohort 均为空
- S36 candidate：appointments=5，5/5 customer authoritative pair exact-one，null/orphan/mismatch=0
- 结论：data mapping ready；formal Scope/Binding/active institution anchor 不 ready；Care Runtime allowlist 不冻结
- 当前 ultra goal：S36 合并后继续 S37 Knowledge formal fresh Admission；System/Care blocker 均未授权实施

```text
STAGE=S36
BASELINE=51e40b2a154d9d32c57e865e50cc4172da8a39a1
S35_PR=1242
S35_HEAD=f6af73e8d830278f51646bdceff5781c18388429
S35_MERGE=51e40b2a154d9d32c57e865e50cc4172da8a39a1
S35_FORMAL_CLOSURE=true

CARE_SELECTED_FIRST_SLICE=APPOINTMENTS_LIST_BY_CURRENT_INSTITUTION
APPOINTMENT_COUNT=5
APPOINTMENT_PAIR_UNIQUE_MATCH_COUNT=5
APPOINTMENT_PAIR_ZERO_MATCH_COUNT=0
APPOINTMENT_PAIR_MULTI_MATCH_COUNT=0
APPOINTMENT_FORMAL_SCOPE_ORPHAN_COUNT=5

CARE_APPOINTMENT_DATA_MAPPING_READY=true
CARE_FORMAL_SCOPE_READY=false
CARE_ACTIVE_INSTITUTION_ANCHOR_READY=false
CARE_MEMBERSHIP_READY=true
CARE_ACTION_POLICY_READY=true
CARE_READER_API_AUTH_CHAIN_READY=false
CARE_DATA_READINESS=blocked_pending_formal_scope_provisioning
CARE_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
CARE_EXACT_RUNTIME_FILE_COUNT=0

NEXT_CARE_TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_FORMAL_SCOPE_PROVISIONING
NEXT_CARE_TASK_AUTHORIZED=false
NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_FORMAL_INSTITUTION_SCOPE_CONTEXT_BINDING_PROVISIONING_SOURCE_FRESH_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_KNOWLEDGE_TASK=SEVEN_STREAM_KNOWLEDGE_FORMAL_FRESH_ADMISSION
NEXT_KNOWLEDGE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S36_merge
NEXT_STAGE=S37
NEXT_STAGE_AUTO_EXECUTION=false
```

S34 已安全重建 `appointments.institution_id`，但 persisted business pair 不能替代 request-scoped formal authority。candidate 没有 matching `institution_scopes` 或 active Binding；11 条 active membership 只证明 tenant membership，不能选定 institution。S36 不新建 Reader/API/page，也不借 current customer pair、默认机构或单机构租户假设绕过 formal authorization。

Canonical evidence：`docs/operations/seven-stream-care-appointments-post-rebuild-readmission-20260815.md`。

## S35 当前入口：candidate 已重建，SYS-01 formal facts 仍为空

- S34：PR #1241 已合并，active local database 为 candidate，original mutation count 为 0
- S35 candidate：Scope=0、Context Version=0、Context=0、Binding=0、AI usage=0、Membership=11
- 结论：空表 orphan=0 是 vacuous truth；SYS-01 Runtime allowlist 不冻结
- 并行顺序：当前 ultra goal 继续 S36 Care read-only re-admission；System provisioning prerequisite 未授权

```text
STAGE=S35
BASELINE=519d3f383f9758b17c5ee0e3bdd944717f378df8
S34_PR=1241
S34_HEAD=77ec36a489a5f3cf5c1f91187ef197871045f58f
S34_MERGE=519d3f383f9758b17c5ee0e3bdd944717f378df8
S34_FORMAL_CLOSURE=true

INSTITUTION_SCOPE_COUNT=0
OPERATING_CONTEXT_VERSION_COUNT=0
OPERATING_CONTEXT_COUNT=0
BINDING_COUNT=0
TENANT_MEMBER_COUNT=11
AI_USAGE_COUNT=0

SYS01_DATA_READINESS=blocked_target_only_formal_scope_context_binding_cohorts_empty
SYS01_TENANT_ISOLATION_SAFE=false
SYS01_INSTITUTION_ISOLATION_SAFE=false
SYS01_FORMAL_SCOPE_READY=false
SYS01_FORMAL_CONTEXT_READY=false
SYS01_BINDING_READY=false
SYS01_RUNTIME_ADMISSION_READY=false
SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_EXACT_RUNTIME_FILE_COUNT=0

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_FORMAL_INSTITUTION_SCOPE_CONTEXT_BINDING_PROVISIONING_SOURCE_FRESH_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_SYSTEM_REBUILD
NEXT_CARE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S35_merge
NEXT_STAGE=S36
NEXT_STAGE_AUTO_EXECUTION=false
```

S34 mapping contract 有意将三个 target-only formal tables 保持空，并拒绝从 membership/customer/default institution 猜 pair；binding source 也 authoritative-empty exact preserve。S35 在 candidate repeatable-read read-only transaction 内验证所有相关 orphan 为 0，但没有任何 positive formal authority，因此不能把 schema parity 或 zero-row AI cohort当作 Runtime admission。

Canonical evidence：`docs/operations/seven-stream-system-sys01-post-rebuild-data-runtime-readmission-20260815.md`。

## S34 当前入口：SYS-01 controlled rebuild 与 local cutover 已完成

- 初始基线：`2c9c6fdf209c9e5598d8ddea35922ad8ed6e01e1`
- execution Head：`cf0be4480020dcc4e22e086cb1ba11e924cc78c9`
- corrective Runtime：PR #1240，Required Check 与 post-merge sweep 通过
- 结果：十个 phase 全部 `succeeded`，active local database 已切到 candidate
- 下一阶段：S35 只读重审 formal Scope/Context/Binding 与 SYS-01 Runtime readiness

```text
STAGE=S34
TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION
S34_EXECUTION_HEAD=cf0be4480020dcc4e22e086cb1ba11e924cc78c9
S34_CORRECTIVE_RUNTIME_PR=1240
S34_CORRECTIVE_RUNTIME_HEAD=5a6621c9a0b8c3597c8018c96e53469a4e4fa078
S34_CORRECTIVE_RUNTIME_MERGE=cf0be4480020dcc4e22e086cb1ba11e924cc78c9
S34_DOCS_PR=1241
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

SOURCE_SCHEMA_FINGERPRINT=3e58d6d2e3e59af776fc81983cd9edd20b26ae9c3e0c59d50545c64594bc2379
CANDIDATE_SCHEMA_FINGERPRINT=4b93f1ce180ee48c12ded517a087fb3f6d73e7e28ff3be85f883de1d321dfb8c
SOURCE_AGGREGATE_FINGERPRINT=ee875486fe9d0c21127dcd4fe16ac9c7c9867a1df4fd178b4b257953e10edcce
CANDIDATE_AGGREGATE_FINGERPRINT=e9945f739627caf69d484b50899534b55058a3dd1b43b6b2b13c0c3d17f3370c
ORIGINAL_MUTATION_COUNT=0

ACTIVE_LOCAL_DATABASE=candidate
ORIGINAL_RETAINED=true
RESTORE_DRILL_RETAINED=true
CANDIDATE_RETAINED=true
ENCRYPTED_BACKUP_RETAINED=true
POST_CUTOVER_VERIFIED=true
S34_COMPLETE=true
S34_FORMAL_CLOSURE=true

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_POST_REBUILD_DATA_AND_RUNTIME_READMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S34_merge
NEXT_STAGE=S35
NEXT_STAGE_AUTO_EXECUTION=false
```

初次 `restore-drill` 因双重等价 cast canonicalization false mismatch 按 fail-closed contract 进入 outcome unknown 并停止；PR #1240 以 exact 3-file scope 修复正反 contract，旧 manifest/backup 保留，旧 restore resource 在 merge 后按授权清理。fresh execution 使用新 Head、新 repo-external manifest，从 `preflight` 重新开始。S34 不证明 formal Scope/Context/Binding ready，也没有实施 SYS-01/Care/Knowledge Runtime 或发布新页面。

Canonical evidence：`docs/operations/seven-stream-system-sys01-controlled-local-dev-rebuild-execution-20260815.md`。

## S33 当前入口：Care 首切片已选，data readiness 等待 SYS-01 rebuild

- S33 基线：`5b7023aa78a78ead98c25071cda99c2df978bb89`
- S32 System：PR #1230 已合并，rebuild execution Admission ready，execution 仍未授权
- S33 Care：选择 appointments list；5/5 customer pair exact-one，source 无 `institution_id`
- S33 结论：不伪造 Care Runtime allowlist；下一原子任务回到 System controlled rebuild explicit authorization

```text
STAGE=S33
STREAM=care
TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
BASELINE=5b7023aa78a78ead98c25071cda99c2df978bb89

S32_PR=1230
S32_HEAD=b5fed81fd9b976f94ac09156d1547ad94b09b9b8
S32_MERGE=5b7023aa78a78ead98c25071cda99c2df978bb89
S32_FORMAL_CLOSURE=true

S29_CORRECTIVE_PR=1232
S29_CORRECTIVE_HEAD=1d1719f82afb9959c22e5ba6d5f8df0d65fae3c4
S29_CORRECTIVE_MERGE=00e9b91382538f29764853d9fdd67ae42a9872af
S30_CORRECTIVE_DOCS_PR=1234
S30_CORRECTIVE_DOCS_HEAD=357661bf1646296174de714deee47de8abf5aa0d
S30_CORRECTIVE_DOCS_MERGE=23b1784ca61c0cdbb950cc6291fc83302b8f83a2
S31_CORRECTIVE_RUNTIME_PR=1233
S31_CORRECTIVE_RUNTIME_HEAD=dc1524cc4b3d7656bf60b3aaf10be5ab7cf85ca5
S31_CORRECTIVE_RUNTIME_MERGE=f7eefd101d05b8c07468de677d5013658816972a
S31_EXIT_AWAIT_CORRECTIVE_PR=1237
S31_EXIT_AWAIT_CORRECTIVE_HEAD=3a2a45bbe20d51a7d2a15d702bb1da2f0c777584
S31_EXIT_AWAIT_CORRECTIVE_MERGE=ca6a32212ab19a0014cb353680e612480a500a1e
S32_CORRECTIVE_DOCS_PR=1235
S32_CORRECTIVE_DOCS_HEAD=a4f07114a97fece89312cfccc166daa179f6b345
S32_CORRECTIVE_DOCS_MERGE=f981c6c06448eed2fa63edd0a8a38f9cfc3b5b1d

S29_POST_MERGE_P2_RESOLVED=2
S30_POST_MERGE_P1_RESOLVED=2
S31_POST_MERGE_P1_RESOLVED=3
S31_POST_MERGE_P2_RESOLVED=1
S32_POST_MERGE_P2_RESOLVED=1
S33_POST_MERGE_P2_RESOLVED=1
S33_EXACT_SCOPE_GOVERNANCE_THREAD_RESOLVED=1
ULTRA_GOAL_CORRECTIVE_REVIEW_THREAD_COUNT=10
ULTRA_GOAL_REVIEW_THREAD_DISPOSITION_COUNT=11
ULTRA_GOAL_ACTIONABLE_P0_P1_P2_P3=0
ULTRA_GOAL_POST_MERGE_REVIEW_DEBT=0
S33_ACTIONABLE_P0_P1_P2_P3=0
POST_MERGE_REVIEW_DEBT=0
S33_FORMAL_CLOSURE=true

CARE_SELECTED_FIRST_SLICE=APPOINTMENTS_LIST_BY_CURRENT_INSTITUTION
CARE_FORMAL_READER_EXISTS=false
CARE_CURRENT_API=/api/institution/appointments
CARE_TARGET_VERSIONED_API=/api/v1/institution/appointments
CARE_CANONICAL_PAGE=/hospital/care/appointments
CARE_CAPABILITY_KEY=page_care_appointments

APPOINTMENT_COUNT=5
APPOINTMENT_CUSTOMER_PAIR_UNIQUE_MATCH_COUNT=5
APPOINTMENT_CUSTOMER_PAIR_ZERO_MATCH_COUNT=0
APPOINTMENT_CUSTOMER_PAIR_MULTI_MATCH_COUNT=0
SOURCE_INSTITUTION_COLUMN_ABSENT=true

CARE_DATA_READINESS=blocked_pending_system_rebuild
CARE_SCHEMA_CHANGE_REQUIRED=false
CARE_MIGRATION_REQUIRED=false
CARE_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
CARE_PAGE_RELEASE_ADMISSION_READY=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_SYSTEM_REBUILD
NEXT_CARE_TASK_AUTHORIZED=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

七线当前顺序：10 条 actionable post-merge review thread 已通过 PR #1232/#1233/#1234/#1235/#1237 全部修复并 resolved，S33 exact-6 范围线程也已依据用户显式授权正式处置；System execution prerequisite 与 Admission 已闭合，但实际 controlled rebuild 需要新的显式授权；Care 的首个 read-only slice 已选，却必须等待该数据前置完成。Canonical evidence：`docs/operations/seven-stream-care-formal-fresh-admission-20260815.md`。

## S32 历史入口：System rebuild execution ready，仍待独立授权

- S32 基线：`fc3353d34e77d3704fccc70546735db84a671a24`
- S31 Runtime：PR #1229 corrective exact 3-file prerequisite implementation 已合并并 formal closure
- S32 source：original `55433` 的 56-table set 与逐表 count 均无 drift；只读事务已 ROLLBACK
- S32 key：repo-external metadata 安全门通过；value/hash 未读取或记录
- S32 结论：rebuild execution Admission ready；未执行任何 rebuild phase

```text
STAGE=S32
TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION_READMISSION
BASELINE=fc3353d34e77d3704fccc70546735db84a671a24

S31_RUNTIME_PR=1229
S31_RUNTIME_HEAD=ea3639fc8ac55c900a6bbdd2d041f1280ea29870
S31_RUNTIME_MERGE=fc3353d34e77d3704fccc70546735db84a671a24
S31_FORMAL_CLOSURE=true

SYSTEM_PREREQUISITE_IMPLEMENTED=true
SYSTEM_PREREQUISITE_EXACT_FILE_COUNT=3
DETERMINISTIC_READINESS_ISSUER_IMPLEMENTED=true
DETERMINISTIC_APPLICATION_SMOKE_ISSUER_IMPLEMENTED=true
BACKUP_KEY_PREFLIGHT_IMPLEMENTED=true
LOW_LEVEL_ADAPTER_TEST_COVERAGE_SUFFICIENT=true

SOURCE_PUBLIC_TABLE_COUNT=55
SOURCE_INVENTORY_TABLE_COUNT=56
SEMANTIC_SOURCE_DRIFT_COUNT=0
BACKUP_ENCRYPTION_KEY_SOURCE_AVAILABLE=true
BACKUP_ENCRYPTION_KEY_SOURCE_SAFE=true
REBUILD_EXECUTION_ADMISSION_READY=true
FORMAL_REBUILD_EXECUTION=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S32_merge
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

当前七线排序仍以 System execution 为下一独立授权 task；本轮 ultra-goal 只继续 Care fresh Admission，不会把 System execution 自动夹带到 S33。Canonical evidence：`docs/operations/seven-stream-system-sys01-controlled-local-dev-rebuild-execution-readmission-20260815.md`。

## S30 历史入口：prerequisite implementation Admission

- S30 基线：`707c378afffb3e3b96790a26a0de8a17a8364f3c`
- S29 Customers：PR #1227 已以 exact 11-file scope 合并，CUS-01 formal Reader 与 versioned API 已实现，page 继续隐藏
- S30 System：原始 Admission 冻结 runner/test exact 2 files；用户后续对 review corrective 明确 re-admit runner/test/baseline manifest exact 3 files
- S30 key：repo-external raw 32-byte owner-only source 已创建并通过 metadata 校验；未读取、输出或记录 value/hash
- S30 性质：docs-only Admission；未执行 rebuild、backup、restore、candidate、baseline、transfer 或 cutover

```text
STAGE=S30
TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
BASELINE=707c378afffb3e3b96790a26a0de8a17a8364f3c

S29_PR=1227
S29_HEAD=d22ee7264d400d65905521a3718dc6be7efc55c4
S29_MERGE=707c378afffb3e3b96790a26a0de8a17a8364f3c
S29_REQUIRED_CHECKS=passed
S29_ACTIONABLE_P0_P1_P2_P3=0
S29_POST_MERGE_REVIEW_DEBT=0
S29_FORMAL_CLOSURE=true
S29_CORRECTIVE_PR=1232
S29_CORRECTIVE_MERGE=00e9b91382538f29764853d9fdd67ae42a9872af

SYSTEM_PREREQUISITE_IMPLEMENTATION_ADMISSION_READY=true
SYSTEM_PREREQUISITE_EXACT_ALLOWLIST_FROZEN=true
SYSTEM_PREREQUISITE_ORIGINAL_EXACT_FILE_COUNT=2
SYSTEM_PREREQUISITE_CORRECTIVE_EXACT_FILE_COUNT=3
SYSTEM_PREREQUISITE_CORRECTIVE_EXACT_ALLOWLIST=scripts/db/sys01-controlled-local-dev-rebuild.mjs,scripts/db/sys01-controlled-local-dev-rebuild.test.mjs,drizzle/baselines/sys01-local-dev-current-schema-0045-v1.json
S31_CORRECTIVE_RUNTIME_PR=1233
S31_CORRECTIVE_RUNTIME_MERGE=f7eefd101d05b8c07468de677d5013658816972a
S31_EXIT_AWAIT_CORRECTIVE_PR=1237
S31_EXIT_AWAIT_CORRECTIVE_MERGE=ca6a32212ab19a0014cb353680e612480a500a1e
BACKUP_KEY_CONTRACT_FROZEN=true
BACKUP_KEY_SOURCE_CREATED=true
BACKUP_KEY_SOURCE_AVAILABLE=true
BACKUP_KEY_VALUE_READ_OR_LOGGED=false
LOW_LEVEL_ADAPTER_TEST_GAP_COUNT=6

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CUSTOMERS_TASK=UNASSIGNED_AFTER_CUS01_READER_API_RUNTIME
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_system_chain

DATABASE_REBUILD_EXECUTION=false
DATABASE_WRITE_ON_ORIGINAL_55433=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

- 日期：2026-08-15
- 基线：`73edd17666426dd4aedf304fcc7f89dd2b075369`
- 来源：S28 Customers CUS-01 readonly Fresh Admission
- POST-V2-R1C：正式收口
- 七线开发入口：ready
- 七线正式发布：0/7
- 已发布受治理页面切片：2/26（`page_workbench`、`page_system_audit`）
- 受控创建能力发布：0/3
- 首选业务线：`system`（S26 baseline/rebuild tooling 已实现并经隔离 PostgreSQL 实证；S27 因 evidence issuer、backup key source 与 low-level adapter behavior tests 未闭合，rebuild execution 仍未准入）
- 第二候选：`customers`（CUS-01 Reader/API exact 11-file Admission ready；page 继续隐藏）
- 本文性质：当前开发入口基线，不是 Runtime、数据库或 Migration 授权

## 零、S28 七线当前入口状态

```text
STAGE=S28
STREAM=customers
SLICE=CUS_01_READONLY
COMPLETION_MODE=ADMISSION_READY_READER_API_PAGE_HIDDEN
BASELINE=73edd17666426dd4aedf304fcc7f89dd2b075369

S27_PR=1225
S27_HEAD=d9741603cff3639032fcfd8359874204dae973da
S27_MERGE=73edd17666426dd4aedf304fcc7f89dd2b075369
S27_REQUIRED_CHECKS=passed
S27_ACTIONABLE_P0_P1_P2_P3=0
S27_POST_MERGE_REVIEW_DEBT=0
S27_COMPLETE=true
S27_FORMAL_CLOSURE=true

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

CUS01_FACT_OWNER=public.customers
CUS01_COMMAND_OWNER=src/modules/customers
CUS01_REPOSITORY_OWNER=src/modules/customers
CUS01_READ_MODEL_OWNER=src/modules/customer-center
CUS01_PRESENTATION_OWNER=src/modules/customer-center
CUS01_FORMAL_LIST_READER_EXISTS=false
CUS01_CURRENT_API=/api/institution/customers
CUS01_VERSIONED_API_EXISTS=false
CUS01_TARGET_VERSIONED_API=/api/v1/institution/customers
CUS01_CANONICAL_PAGE=/hospital/customers
CUS01_CAPABILITY_KEY=page_customer_list

ORIGINAL_PUBLIC_TABLE_COUNT=55
ORIGINAL_INVENTORY_TABLE_COUNT=56
TABLE_CLASSIFICATION_COMPLETE=true
UNKNOWN_TABLE_CLASSIFICATION_COUNT=0

CUSTOMER_COUNT=9
CUSTOMER_NULL_INSTITUTION_COUNT=0
CUSTOMER_NULL_TENANT_COUNT=0
CUSTOMER_DISTINCT_TENANT_COUNT=2
CUSTOMER_DISTINCT_TENANT_INSTITUTION_PAIR_COUNT=2
CUSTOMER_TENANT_ORPHAN_COUNT=0
CUSTOMER_DUPLICATE_PRIMARY_KEY_COUNT=0
CUS01_DATA_READINESS=ready

CUS01_SCHEMA_CHANGE_REQUIRED=false
CUS01_MIGRATION_REQUIRED=false
CUS01_READER_ADMISSION_READY=true
CUS01_API_ADMISSION_READY=true
CUS01_PAGE_RELEASE_ADMISSION_READY=false
CUS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=true
CUS01_EXACT_RUNTIME_FILE_COUNT=11
CUS01_EXACT_PRODUCTION_FILE_COUNT=6
CUS01_EXACT_TEST_FILE_COUNT=5
CUS01_RUNTIME_IMPLEMENTATION=false

REBUILD_EXECUTION_ADMISSION_READY=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CUSTOMERS_TASK=SEVEN_STREAM_CUSTOMERS_CUS_01_READONLY_EXACT_11_FILE_RUNTIME_IMPLEMENTATION
NEXT_CUSTOMERS_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=false
CARE_FORMAL_RUNTIME_BLOCKED_UNTIL_CUSTOMERS_READINESS=true
NEXT_STAGE_AUTO_EXECUTION=false
```

S20 frozen architecture 继续有效：AI usage facts、command 与正式 read source 由 `analytics` 持有，`institution-system` 持有低敏 read model 与 presentation，cross-owner composition 位于 `src/server/orchestration/**`；canonical API 为 `/api/v1/institution/ai-service-usage`，旧 `/api/institution/ai-service-usage` 保持 capability-off compatibility-only。

S21—S27 已从 source audit 推进到 baseline/rebuild tooling 实现与隔离 PostgreSQL 实证；System execution 仍因 deterministic issuer、backup key source 与 low-level adapter tests 缺口禁止。S28 fresh 证明 9/9 customer facts 的 persisted tenant/institution pair 完整，四机构角色均具 customer read policy，现有 schema 足以实现正式 list Reader 与 versioned API；exact 11-file Runtime slice 已冻结，page 不在 allowlist并继续 hidden。Canonical evidence：`docs/operations/seven-stream-customers-cus01-readonly-fresh-admission-20260815.md`。

## 一、统一完成尺度

```text
领域
→ 持久化／权威 Reader
→ API
→ canonical 页面
→ 真实数据
→ 权限与审计
→ Capability 发布
→ 测试环境验收
→ 旧实现退出
```

公共契约、领域测试、安全 Foundation、capability-off 页面或单个 released page slice 都不能单独计为一条完整业务线正式发布。`SEVEN_STREAM_FORMAL_RELEASE_COUNT=0` 与 `REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2` 是两个独立维度。

## 二、Foundation 与开发模式

S19 fresh regression 证明 formal session provenance、Scope Guard、Section Guard、Audit Writer attribution、Audit Reader、trusted role authorization、Capability Authority、Workbench exact projection 与 Architecture Quality 均安全，当前没有新的全局 P0/P1 Foundation blocker。

```text
FOUNDATION_READY=true
SEVEN_STREAM_ENTRY_GATE=passed
SEVEN_STREAM_DEVELOPMENT_READY=true
POST_R1C_DEFAULT_MODE=business_slice_delivery
NO_NEW_FOUNDATION_BY_DEFAULT=true
```

后续优先在现有 Foundation 内交付有限业务切片。只有具体业务切片证明存在真实 blocker，才可单独申请 Foundation、Schema 或 Migration；旧 MIG 名称与历史计划本身不构成执行授权。

## 三、七线 current-main 基线

| Rank | Stream | 当前 Runtime | 正式 API / 页面 | 权威数据与权限 | 当前 blocker | 下一有限切片 |
|---:|---|---|---|---|---|---|
| 1 | 管理中心 `system` | `institution-system` 36 files；Audit owner 已完成 Writer/Reader/role closure；baseline/rebuild tooling 已实现 | `/hospital/system/audit` 与 `/api/institution/audit-events` 已 admin-only release；AI usage/entitlement 仍 off | SYS-01 static Reader/role/DTO 已冻结；56-row data inventory 与 marker baseline contract 已冻结 | deterministic readiness/smoke issuers、backup key source、low-level adapter behavior tests | rebuild execution prerequisite exact Admission（未授权） |
| 2 | 客户中心 `customers` | `customer-center` 14 + `customers` 7；command/object fact 存在 | legacy API 503；versioned API 不存在；canonical page hidden | 9/9 persisted pair，null/orphan/duplicate=0；四角色 read policy成立 | formal list Reader 尚未实现；future candidate preservation待 System | CUS-01 exact 11-file Reader/API Runtime（未授权） |
| 3 | 预约与随访 `care` | `care` 30；domain/command/repository/transaction 较成熟 | appointments/followups 主 API 与页面 off | institution 历史形状 nullable；read model 未闭环 | Customer 稳定引用、正式 Reader/API/page | 人工随访只读/人工闭环 fresh Admission |
| 4 | 知识库 `knowledge` | `institution-knowledge` 8 + `knowledge` 8；旧/new runtime 并存 | items 根 API 与页面 off | 旧 preview/mock/demo 与正式事实边界未退出 | MIG-03、Reader、worker/OCR/index 与低敏授权 | 资料库只读 fresh Admission |
| 5 | 会话工作台 `conversations` | `institution-conversations` 24；domain 状态机较强 | 无正式 conversations API/page | 无正式 persistence、assignment/identity facts | MIG-04 与真实渠道后置审批 | domain/persistence Admission，不发布页面 |
| 6 | 经营分析 `analytics` | `institution-analytics` 18 + `analytics` 4；纯计算存在 | 无正式 analytics API/page | 无 authoritative facts/snapshots | MIG-05/MIG-06、统一口径与真实 Provider | facts/snapshot Admission |
| 7 | 工作台 `workbench` | `institution-workbench` 22；安全 release projection | `/hospital` 已发布状态投影；dashboard API off | 无独立数据，依赖多个正式 Provider | 至少三个真实上游 Provider 未形成 | 上游完成后再接线，不先做假聚合 |

## 四、七线精确边界

| Stream key | Primary routes | Primary APIs | Primary modules / data owner | Orchestration / authorization owner |
|---|---|---|---|---|
| `workbench` | `/hospital` | dashboard stats 当前 off；目标为 versioned providers | `src/modules/institution-workbench/**`；不拥有业务事实 | Workbench runtime + Capability Authority；Security formal scope |
| `customers` | `/hospital/customers/**` | `/api/institution/customers/**` | `src/modules/customers/**` + `customer-center/**` | future Customers composition；Security + object fact |
| `conversations` | `/hospital/conversations/**` | future `/api/institution/conversations/**` | `src/modules/institution-conversations/**` | future connector orchestration；Security + assignment/object guard |
| `care` | `/hospital/care/**` | appointments/followups/paths | `src/modules/care/**` | `care-follow-up-transaction.ts`；Security + Care preconditions |
| `knowledge` | `/hospital/knowledge/**` | knowledge-management family | `src/modules/knowledge/**` + `institution-knowledge/**` | knowledge transaction/quota writer；Security + knowledge guard |
| `analytics` | `/hospital/analytics/**` | future `/api/institution/analytics/**` | `src/modules/institution-analytics/**` | future snapshot composition；Security + analytics guard |
| `system` | `/hospital/system/**` | audit active；AI usage/entitlement off | `src/modules/institution-system/**`；Audit facts remain Audit-owned | Audit orchestration currently complete；Security + Audit-specific owner |

## 五、第一条线与首切片

```text
SELECTED_FIRST_STREAM=system
SECOND_CANDIDATE=customers
FIRST_STREAM_CAN_START=true
FIRST_STREAM_FIRST_SLICE=SYS_01_AI_USAGE_READONLY_FRESH_ADMISSION
FIRST_STREAM_FRESH_ADMISSION_COMPLETE=true
FIRST_STREAM_DB_READINESS_REAUDIT_COMPLETE=true
FIRST_STREAM_MIGRATION_ADMISSION_COMPLETE=true
FIRST_STREAM_PHASED_RECOVERY_ADMISSION_COMPLETE=true
FIRST_STREAM_CONTROLLED_REBUILD_ADMISSION_COMPLETE=true
FIRST_STREAM_BASELINE_GOVERNANCE_ADMISSION_COMPLETE=true
FIRST_STREAM_BASELINE_REBUILD_TOOL_IMPLEMENTATION_COMPLETE=true
FIRST_STREAM_REBUILD_EXECUTION_ADMISSION_COMPLETE=true
FIRST_STREAM_RUNTIME_ADMISSION_READY=false
FIRST_STREAM_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
FIRST_STREAM_EXACT_RUNTIME_FILE_COUNT=0
FIRST_STREAM_DB_READ_PREREQUISITE=false
FIRST_STREAM_CONTROLLED_REBUILD_PREREQUISITE=true
FIRST_STREAM_NEXT_ATOMIC_TASK=SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
```

`system` 是唯一已有真实、持久化、角色感知并正式发布子页的业务线，复用 Foundation 的证据最强。S20 已冻结 SYS-01 的 owner、Reader、composition、API、角色与 DTO；S21 已连接 actual DB；S22 证明不是简单运行全部 pending 即可恢复；S23 排除了原地 replay。S24 已证明 6/11/11 数据、252 条 Audit 与全部 56 个 table inventory 可保留，并冻结 side-by-side safety contract；S25 已形成正式 baseline provenance 与 future lineage 表示；S26 已实现并隔离实证 baseline/rebuild tooling。S27 只读审计未发现 source drift，但 execution 因 issuer、key source 与 low-level tests 缺口保持 blocked。

`customers` 无外部系统且是 Care/Workbench 上游，排第二。S28 已闭合 data readiness、owner、角色、DTO、pagination 与 exact Reader/API allowlist；Runtime 尚未实施，page 继续隐藏。其 exact Runtime 可在下一轮显式授权后推进，但不得把 System rebuild 等待窗口或 Care backlog解释成当前授权。

## 六、数据与 Migration 停止线

- S21 已完成 local-development loopback transaction-read-only SELECT audit；所有事务 ROLLBACK，数据库写入为 0。
- S22 已确认 journal/head/hash 无漂移且 `0038` all-missing；但 existing migrator 不支持 target，`0038` 后存在必须独立完成的 Provisioning checkpoint。
- S23 已确认正式 Provisioning 只产生 Scope/Context 三表，不会产生 0039 所需 Binding；`0041/0043` 又把 historical acceptance Membership count 冻结为 1，current=11。
- 不得删除 Membership、伪造 Binding/Scope/Context、改 journal、改 consumed SQL、reset、seed 或换用 55432 acceptance DB；continuous pending list 不是 executable chain。
- S24 已冻结 repo 外加密 backup、独立 restore drill、side-by-side candidate、data-preserving mapping 与 unknown-outcome stop/no-retry；尚未执行任何一步。
- S25 已唯一冻结 current-schema candidate baseline artifact、canonical marker/journal semantics 与 future migration lineage；marker 只引用 `0045` parent 高水位，不得伪造 `0038..0045` 已执行。
- S26 exact 6-file tooling 已实现，且 baseline artifact 在隔离 PostgreSQL 上实际 apply、marker 与 catalog fingerprint 通过；这不构成 original rebuild 授权。
- S27 证明 source contract 未漂移；下一 system 原子任务只能准入 deterministic readiness/smoke issuers、repo 外 private key/directory preflight 与 low-level adapter behavior tests。正式 rebuild 仍需后续独立授权。
- `customers`、Care 与其他旧表中的 nullable institution 形状必须逐切片 fresh 证明，不能用旧 MIG 计划自动推导完整性。
- 如下一切片确需 Schema/Migration，必须拆为独立授权、独立 PR、升级/回退验证；业务线 PR 不得顺手修改 `src/server/db/schema.ts` 或 `drizzle/**`。
- 不允许以当前单机构、默认机构、membership 当前值、mock/seed/demo 或目录位置补推历史机构归属。

## 七、目录与依赖方向

- `src/modules/institution/**` 继续只允许修复、兼容和迁出，不新增业务 ownership。
- 新业务默认进入明确 owner module 与 `src/app/api/v1/institution/**`；旧 API 只允许逐路由薄兼容。
- cross-owner composition 位于 `src/server/orchestration/**`，业务 module 不反向依赖 orchestration。
- Workbench、System 或页面不得直接读取其他领域 Repository。
- Capability 只表达发布状态，不替代 formal request、role、object 或 action authorization。
- 七线不得新增 generic Adapter、generic Repository、generic Guard 或第二套 Audit/Foundation。

## 八、下一任务

```text
NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CUSTOMERS_TASK=SEVEN_STREAM_CUSTOMERS_CUS_01_READONLY_EXACT_11_FILE_RUNTIME_IMPLEMENTATION
NEXT_CUSTOMERS_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
SEVEN_STREAM_RUNTIME_IMPLEMENTED=false
DATABASE_WRITE_EXECUTION_AUTHORIZED=false
MIGRATION_EXECUTION_AUTHORIZED=false
PROVISIONING_WRITE_EXECUTION_AUTHORIZED=false
```

S28 canonical evidence：`docs/operations/seven-stream-customers-cus01-readonly-fresh-admission-20260815.md`。S27 System execution evidence：`docs/operations/seven-stream-system-sys01-controlled-local-dev-rebuild-execution-admission-20260815.md`。

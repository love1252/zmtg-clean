# Knowledge formal Fresh Admission

- 审计日期：2026-08-16
- 阶段：S37
- 流：`knowledge`
- 选定首切片：`KNOWLEDGE_DOCUMENT_METADATA_LIST_BY_FORMAL_INSTITUTION_SCOPE`
- 基线：`ab5b4b12bac381d4eb62c554a35ff476657f7901`
- 性质：docs-only + active candidate transaction-read-only data/formal-auth audit
- 结论：首切片不依赖外部 AI/OCR，但 authoritative Knowledge facts 与 formal Scope/Binding 均为空；当前 schema 只能表达 `mock|seed|demo` source provenance，Runtime allowlist 为 0

## 一、Admission 结论

```text
STAGE=S37
STREAM=knowledge
TASK=SEVEN_STREAM_KNOWLEDGE_FORMAL_FRESH_ADMISSION
COMPLETION_MODE=ADMISSION_COMPLETE_BLOCKED_FORMAL_FACT_AND_SCOPE_PREREQUISITES
BASELINE=ab5b4b12bac381d4eb62c554a35ff476657f7901

S36_PR=1243
S36_HEAD=a3d8f2f7c624f2eee50ac2cef94631bae813cdc5
S36_MERGE=ab5b4b12bac381d4eb62c554a35ff476657f7901
S36_REQUIRED_CHECK=passed
S36_ACTIONABLE_P0_P1_P2_P3=0
S36_POST_MERGE_REVIEW_DEBT=0
S36_FORMAL_CLOSURE=true

KNOWLEDGE_SELECTED_FIRST_SLICE=KNOWLEDGE_DOCUMENT_METADATA_LIST_BY_FORMAL_INSTITUTION_SCOPE
KNOWLEDGE_DATA_READINESS=blocked_authoritative_fact_and_formal_scope_cohorts_empty
KNOWLEDGE_SCHEMA_CHANGE_REQUIRED=true
KNOWLEDGE_MIGRATION_REQUIRED=true
KNOWLEDGE_EXTERNAL_SYSTEM_REQUIRED_FOR_SELECTED_SLICE=false

KNOWLEDGE_FORMAL_SCOPE_READY=false
KNOWLEDGE_ACTIVE_INSTITUTION_ANCHOR_READY=false
KNOWLEDGE_ACTION_POLICY_READY=true
KNOWLEDGE_FORMAL_READER_EXISTS=false
KNOWLEDGE_FORMAL_READER_API_AUTH_CHAIN_READY=false

KNOWLEDGE_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
KNOWLEDGE_EXACT_RUNTIME_FILE_COUNT=0
KNOWLEDGE_EXACT_RUNTIME_ALLOWLIST=not_frozen
KNOWLEDGE_RUNTIME_IMPLEMENTATION=false
KNOWLEDGE_PAGE_RELEASE=false
```

首切片只读取 institution-scoped document metadata，不上传文件、不读取正文、不触发 parse/OCR/embedding/index worker，也不调用真实 AI。它是三个候选中 capability complexity 与外部依赖最小的用户可见切片，但 data/auth prerequisites 尚不能形成正向验收证据。

## 二、First-slice 比较

| 候选 | 读取边界 | 写入／外部依赖 | formal 风险 | 决策 |
|---|---|---|---|---|
| document metadata list | `knowledge_sources` + `knowledge_documents` 的低敏元数据 | 无写入、无 AI/OCR/worker | 需要 authoritative provenance + formal institution scope | 选择 |
| source list | source label/status/source kind | 无写入、无 AI/OCR/worker | source kind 当前仅 `mock|seed|demo`，用户价值低于 document list | 不选 |
| QA/read-only | retrieval、citation、answer preview | 依赖 search/index，正式形态还依赖受控 AI | authorization、citation freshness、provider 与 audit 边界更大 | 后置 |

```text
DOCUMENT_METADATA_READ_INCLUDED=true
FILE_UPLOAD_INCLUDED=false
FILE_DOWNLOAD_INCLUDED=false
PARSE_INCLUDED=false
OCR_INCLUDED=false
EMBEDDING_INCLUDED=false
INDEX_REBUILD_INCLUDED=false
INDEX_WORKER_INCLUDED=false
QA_AI_INCLUDED=false
REAL_EXTERNAL_AI_INCLUDED=false
```

现有 `/api/v1/knowledge-base/runtime/documents` 是 demo/runtime foundation 兼容面：它从 query parameters 接受 tenant/institution/workspace，返回 source/document/chunk/index-job 聚合，没有接入 Security formal provenance、`knowledge_item/read` role decision 或 Capability Authority。它不能原样升级为 formal institution Reader。

## 三、candidate read-only data audit

连接 URL 在创建 client 前已锁定 active candidate endpoint；随后以 repeatable-read read-only transaction 执行 aggregate SELECT，并通过 intentional rollback 显式结束。server 内部地址只作为容器身份佐证，不用来替代外部 endpoint 门禁。

```text
CANDIDATE_CONNECTION_ENDPOINT=127.0.0.1:55434/zmtg_clean_local_dev_candidate
CANDIDATE_ENDPOINT_PREFLIGHT_VERIFIED=true
CANDIDATE_CURRENT_DATABASE_VERIFIED=true
TRANSACTION_ISOLATION=repeatable_read
TRANSACTION_READ_ONLY=on
QUERY_CLASS=aggregate_select_only
TRANSACTION_END=ROLLBACK

INSTITUTION_SCOPE_COUNT=0
ACTIVE_INSTITUTION_SCOPE_COUNT=0
ACTIVE_BINDING_COUNT=0

KNOWLEDGE_SOURCE_COUNT=0
KNOWLEDGE_DOCUMENT_COUNT=0
KNOWLEDGE_CHUNK_COUNT=0
KNOWLEDGE_FOUNDATION_INDEX_JOB_COUNT=0
KNOWLEDGE_VISIBILITY_COUNT=0
KNOWLEDGE_FILE_COUNT=0
KNOWLEDGE_FILE_PARSE_COUNT=0
KNOWLEDGE_FILE_PARSE_CHUNK_COUNT=0
KNOWLEDGE_FILE_PARSE_EMBEDDING_COUNT=0
KNOWLEDGE_INDEXING_JOB_COUNT=0
KNOWLEDGE_QA_AUDIT_COUNT=0
KNOWLEDGE_QUOTA_USAGE_COUNT=0
KNOWLEDGE_FOUNDATION_EMBEDDING_COUNT=0

SOURCE_FORMAL_SCOPE_ORPHAN_COUNT=0
DOCUMENT_SOURCE_ORPHAN_COUNT=0
DOCUMENT_SOURCE_PAIR_MISMATCH_COUNT=0
DOCUMENT_FORMAL_SCOPE_ORPHAN_COUNT=0
DOWNSTREAM_ORPHAN_OR_PAIR_MISMATCH_COUNT=0
```

全部 orphan/mismatch 为 0 只是在空 cohort 上成立，不能证明 isolation 或 data readiness。S34 mapping 有意对没有 authoritative source 的 Knowledge tables保持 empty；S37 不 seed、不从 demo/mock 复制，也不由 membership/default institution 推造 formal pair。

## 四、formal facts 与 schema blocker

current schema 的 `knowledge_base_runtime_source_kind` exact enum 为：

```text
mock
seed
demo
```

历史 architecture contract 已明确：`mock|seed|demo` 与旧可覆盖 index 不得成为正式 Reader 来源。current schema 没有可区分“经正式 owner 审核的 authoritative institution document provenance”的 source kind/immutable publication pointer；`src/modules/institution-knowledge/**` 的 version/publication domain 也尚未落入正式 persistence/Reader。

因此这不是仅补一个 API 文件即可闭合的问题：下一 prerequisite 必须先 fresh Admission formal fact model、authoritative provisioning source、immutable/current publication semantics 与 scope binding。它很可能需要独立 Schema + Migration 准入；S37 只记录该判断，不设计或执行 DDL/DML。

```text
AUTHORITATIVE_KNOWLEDGE_FACT_COHORT_READY=false
AUTHORITATIVE_KNOWLEDGE_SOURCE_PROVENANCE_EXPRESSIBLE=false
IMMUTABLE_PUBLICATION_POINTER_PERSISTED=false
MEMBERSHIP_AS_INSTITUTION_ANCHOR_ALLOWED=false
QUERY_PARAM_AS_FORMAL_PROVENANCE_ALLOWED=false
MOCK_SEED_DEMO_AS_FORMAL_SOURCE_ALLOWED=false
EMPTY_COHORT_AS_READINESS_EVIDENCE_ALLOWED=false
```

`knowledge_item/read` policy 已存在，且只允许 `tenant_admin` / `tenant_operator`；role policy 成立不等于 active formal institution anchor 成立。candidate `institution_scopes=0`、active Binding=0，因此 formal Reader/API auth chain 仍缺 positive facts。

## 五、Ownership freeze

```text
KNOWLEDGE_FACT_OWNER=src/modules/knowledge
KNOWLEDGE_REPOSITORY_OWNER=src/modules/knowledge/server
KNOWLEDGE_READ_MODEL_OWNER=src/modules/knowledge/application/institution
KNOWLEDGE_PRESENTATION_OWNER=src/modules/knowledge
KNOWLEDGE_ORCHESTRATION_OWNER=src/server/orchestration

INSTITUTION_KNOWLEDGE_DOMAIN_ROLE=merge_into_canonical_knowledge_owner_when_admitted
LEGACY_INSTITUTION_KNOWLEDGE_ROLE=compatibility_only_no_new_fact_ownership
KNOWLEDGE_BASE_ROLE=protected_compatibility_only_not_formal_reader
OPEN_PLATFORM_KNOWLEDGE_ROLE=platform_surface_not_institution_fact_owner
```

Fresh file inventory：canonical `src/modules/knowledge/**`=8，`src/modules/institution-knowledge/**`=8，protected `src/modules/knowledge-base/**`=24；legacy institution Knowledge production=13、tests=18；unversioned institution Knowledge production routes=18，全部 capability-disabled；v1 knowledge-base runtime routes=6，属于兼容/runtime foundation，不构成正式 institution release。

不得新建第二套 generic Knowledge foundation，也不得让 `src/modules/institution/**` 继续新增事实所有权。未来 composition 应在 orchestration：formal scope/role → canonical Knowledge Reader → versioned institution API → presentation。

## 六、Blocker 与下一任务

```text
BLOCKING_PREREQUISITE_COUNT=2
PRIMARY_BLOCKING_PREREQUISITE=authoritative_knowledge_fact_model_and_source_provenance_missing
SECONDARY_BLOCKING_PREREQUISITE=authoritative_formal_institution_scope_context_binding_provisioning_source_missing

NEXT_KNOWLEDGE_TASK=SEVEN_STREAM_KNOWLEDGE_DOCUMENT_METADATA_FORMAL_FACT_PROVENANCE_AND_SCOPE_PROVISIONING_FRESH_ADMISSION
NEXT_KNOWLEDGE_TASK_AUTHORIZED=false
NEXT_KNOWLEDGE_TASK_RUNTIME_IMPLEMENTATION=false

DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_WRITE_EXECUTION=false
ORIGINAL_55433_DATABASE_WRITE=false
SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false

PAGE_KNOWLEDGE_LIBRARY_STATE=hidden/not_released
PAGE_RELEASE=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
NEXT_STAGE=UNASSIGNED
NEXT_STAGE_AUTO_EXECUTION=false
```

本 stage 不冻结 speculative Runtime files。只有 authoritative facts、formal scope/binding 与 schema/migration prerequisite 分别经独立授权闭合后，才 fresh 重新决定 exact Runtime allowlist。

## 七、本地验证

```text
TARGETED_TEST_FILES=7
TARGETED_TESTS=38_passed
PRODUCTION_READINESS_DOCS_TESTS=8_passed
TYPECHECK=passed
ARCHITECTURE_QUALITY_TESTS=148_passed
GIT_DIFF_CHECK=passed
```

targeted 覆盖 Knowledge runtime foundation、Knowledge MVP compatibility acceptance、legacy institution readonly service、capability-disabled items Route、`knowledge_item/read` role policy、Capability Registry 与 ProductionReadinessDocs。通过这些 regression 只证明既有 compatibility/off 状态未回归，不把 demo MVP acceptance 误记为 formal institution release。

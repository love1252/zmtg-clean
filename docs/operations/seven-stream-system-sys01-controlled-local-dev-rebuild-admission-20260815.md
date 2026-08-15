# System SYS-01 controlled local-development database rebuild 准入

- 日期：2026-08-15
- 阶段：S24
- 业务线：`system`
- 切片：`SYS_01_AI_USAGE_READONLY`
- 基线：`e29f0373e10dbab32cb307e4c61aa984e937a9b8`
- 性质：docs-only Admission；local-development PostgreSQL transaction-read-only catalog/aggregate audit
- 结论：数据资产、保留映射与 rebuild safety contract 已冻结；candidate schema baseline 尚无 repository-supported、future-migration-safe 表示，execution 不准入

## 一、正式结论

```text
STAGE=S24
STREAM=system
SLICE=SYS_01_AI_USAGE_READONLY
TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_DATABASE_REBUILD_ADMISSION
COMPLETION_MODE=CONTROLLED_REBUILD_ADMISSION_COMPLETE_BLOCKED
BASELINE=e29f0373e10dbab32cb307e4c61aa984e937a9b8

S24_ADMISSION_AUDIT=passed
TABLE_CLASSIFICATION_COMPLETE=true
UNKNOWN_TABLE_CLASSIFICATION_COUNT=0
ORIGINAL_PUBLIC_TABLE_COUNT=55
ORIGINAL_INVENTORY_TABLE_COUNT=56

MUST_PRESERVE_TABLE_COUNT=37
RECONSTRUCTABLE_TABLE_COUNT=0
DERIVED_TABLE_COUNT=5
EPHEMERAL_TABLE_COUNT=4
SECRET_SENSITIVE_TABLE_COUNT=3
DO_NOT_COPY_TABLE_COUNT=1
SPECIAL_MAPPING_TABLE_COUNT=6

OPTION_A_FEASIBLE=false
OPTION_B_FEASIBLE=false
OPTION_B_JOURNAL_SAFE=false
OPTION_B_FUTURE_MIGRATION_SAFE=false
OPTION_C_FEASIBLE=true_as_governance_design_direction_only
OPTION_C_REQUIRES_NEW_BASELINE_ARTIFACT=true
OPTION_C_GOVERNANCE_RISK=high
OPTION_D_FEASIBLE=false

SELECTED_CANDIDATE_SCHEMA_STRATEGY=blocked_no_safe_candidate_schema_strategy
SELECTED_CANDIDATE_SCHEMA_STRATEGY_REASON=no_repository_supported_candidate_baseline_can_represent_current_schema_and_remain_future_migration_safe_without_falsifying_0038_0045_history
CANDIDATE_MIGRATION_BASELINE_STRATEGY=not_frozen_blocked_pending_formal_baseline_governance

SELECTED_DATA_TRANSFER_MECHANISM=controlled_application_level_table_by_table_copy

CONTROLLED_REBUILD_TOOL_IMPLEMENTATION_REQUIRED=true
CONTROLLED_REBUILD_EXACT_ALLOWLIST_FROZEN=false
CONTROLLED_REBUILD_EXACT_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_PRODUCTION_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_TEST_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_DOC_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_ALLOWLIST=none_until_candidate_baseline_governance_is_frozen

REBUILD_EXECUTION_ADMISSION_READY=false
SYS01_RUNTIME_ADMISSION_READY=false
SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_RUNTIME_IMPLEMENTED=false

PRIMARY_BLOCKING_PREREQUISITE=no_repository_supported_candidate_baseline_can_represent_current_schema_and_remain_future_migration_safe_without_falsifying_0038_0045_history
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CANDIDATE_MIGRATION_BASELINE_GOVERNANCE_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
S24_ADMISSION_WORK_COMPLETE=true
S24_COMPLETE=false_pending_explicit_ready_merge_authorization
S24_FORMAL_MERGE_CLOSURE=false
```

`controlled_local_dev_rebuild` 继续是替代不安全原地 replay 的唯一数据保留方向；这不等于当前 rebuild execution 已可执行。S24 不生成 baseline artifact、不实现 runner、不创建 candidate、不执行 backup/restore/Migration/DDL/DML，也不修改 original。

## 二、original DB 身份与只读会话

```text
ORIGINAL_DB_HOST=127.0.0.1
ORIGINAL_DB_PORT=55433
ORIGINAL_DB_NAME=zmtg_clean_local_dev
ORIGINAL_DB_CONTAINER=zmtg-local-dev-pg
ORIGINAL_DB_VOLUME=zmtg-local-dev-pg-data
ORIGINAL_DB_POSTGRES_VERSION=16.14
ORIGINAL_DB_IMAGE=postgres:16-alpine
ORIGINAL_DB_JOURNAL_HEAD=0037_v08_05b_b3a_real_task_readiness_foundation
ORIGINAL_DB_SCHEMA_STATE=repository_0000_0037_strict_prefix_with_0038_0045_pending_and_0038_objects_all_missing

DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false
```

连接只从本地 secret source 取得 URL；文档与日志不记录 username、password 或完整 URL。client startup 固定 `default_transaction_read_only=on`，显式进入 `BEGIN TRANSACTION READ ONLY`，第一条 SQL 确认 `transaction_read_only=on`；之后仅运行 catalog 与 aggregate SELECT，最后 ROLLBACK。

## 三、全库结构 inventory

表中 `S/I` 分别表示 sequence / identity；`C/U` 分别表示 `created_at` / `updated_at`。全部 55 张 public 表均有主键；唯一非 public application table 是 Drizzle journal。

| TABLE | ROW_COUNT | HAS_PRIMARY_KEY | PRIMARY_KEY_SHAPE | FK_COUNT | S/I | C/U |
|---|---:|---|---|---:|---|---|
| `drizzle.__drizzle_migrations` | 38 | true | `id:integer` | 0 | true/false | true/false |
| `public.ai_call_usage_records` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.appointments` | 5 | true | `id:varchar` | 2 | false/false | true/true |
| `public.audit_events` | 252 | true | `event_id:varchar` | 0 | false/false | false/false |
| `public.auth_account_institution_bindings` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.auth_users` | 11 | true | `id:varchar` | 0 | false/false | true/true |
| `public.customer_channel_contact_consents` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.customer_channel_frequency_states` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.customers` | 9 | true | `id:varchar` | 1 | false/false | true/true |
| `public.follow_up_customer_timeline_events` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.follow_up_message_drafts` | 0 | true | `id:varchar` | 6 | false/false | true/true |
| `public.follow_up_message_templates` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.follow_up_path_enrollments` | 0 | true | `id:varchar` | 3 | false/false | true/true |
| `public.follow_up_path_stages` | 0 | true | `id:varchar` | 3 | false/false | true/true |
| `public.follow_up_tasks` | 4 | true | `id:varchar` | 3 | false/false | true/true |
| `public.his_connection_credential_compensation_jobs` | 0 | true | `id:varchar` | 3 | false/false | true/true |
| `public.his_connection_credential_compensation_operations` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.his_connections` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.homepage_brand_assets` | 0 | true | `id:varchar` | 0 | false/false | true/true |
| `public.homepage_brand_audit_logs` | 0 | true | `id:varchar` | 3 | false/false | true/false |
| `public.homepage_brand_config_versions` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.homepage_brand_configs` | 0 | true | `id:varchar` | 0 | false/false | true/true |
| `public.institution_channel_dry_run_snapshots` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.knowledge_chunk_embeddings` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.knowledge_chunks` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.knowledge_document_file_parse_chunk_embeddings` | 0 | true | `id:varchar` | 4 | false/false | true/true |
| `public.knowledge_document_file_parse_chunks` | 0 | true | `id:varchar` | 3 | false/false | true/true |
| `public.knowledge_document_file_parses` | 0 | true | `id:varchar` | 3 | false/false | true/true |
| `public.knowledge_document_files` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.knowledge_documents` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.knowledge_index_jobs` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.knowledge_indexing_jobs` | 0 | true | `job_id:varchar` | 1 | false/false | true/true |
| `public.knowledge_qa_audit_logs` | 0 | true | `id:varchar` | 1 | false/false | true/false |
| `public.knowledge_quota_usage_records` | 0 | true | `id:varchar` | 1 | false/false | true/false |
| `public.knowledge_sources` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.platform_ai_credit_metering_rules` | 0 | true | `id:varchar` | 0 | false/false | true/true |
| `public.platform_ai_model_config_snapshots` | 0 | true | `id:varchar` | 0 | false/false | true/true |
| `public.platform_ai_provider_configs` | 0 | true | `id:varchar` | 0 | false/false | true/true |
| `public.platform_knowledge_institution_visibility` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.tenant_authorization_snapshots` | 6 | true | `id:varchar` | 3 | false/false | true/false |
| `public.tenant_commercial_records` | 4 | true | `id:varchar` | 2 | false/false | true/true |
| `public.tenant_contacts` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.tenant_members` | 11 | true | `id:varchar` | 2 | false/false | true/true |
| `public.tenant_plan_assignments` | 6 | true | `id:varchar` | 3 | false/false | true/true |
| `public.tenant_plan_change_records` | 0 | true | `id:varchar` | 5 | false/false | true/true |
| `public.tenant_plan_versions` | 3 | true | `id:varchar` | 1 | false/false | true/true |
| `public.tenant_plans` | 3 | true | `id:varchar` | 0 | false/false | true/true |
| `public.tenant_quota_snapshots` | 6 | true | `id:varchar` | 2 | false/false | true/false |
| `public.tenants` | 6 | true | `id:varchar` | 0 | false/false | true/true |
| `public.treatment_summaries` | 7 | true | `id:varchar` | 3 | false/false | true/true |
| `public.wecom_customer_broadcast_recipient_bindings` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.wecom_customer_broadcast_task_provider_attempts` | 0 | true | `id:varchar` | 1 | false/false | true/true |
| `public.wecom_customer_mapping_states` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.wecom_real_send_production_attestations` | 0 | true | `id:varchar` | 0 | false/false | true/true |
| `public.wecom_real_send_proof_controls` | 0 | true | `id:varchar` | 2 | false/false | true/true |
| `public.wecom_real_send_proof_operations` | 0 | true | `id:varchar` | 8 | false/false | true/true |

非空 public 表共 14 张。除 journal 的 integer sequence 外，业务主键均为 application-generated `varchar`，没有 identity column。

## 四、唯一 classification inventory

`REBUILD_ACTION` 是未来执行 contract，不是本阶段执行记录。`exact_copy` 均要求先通过 target catalog compatibility 与 FK phase guard。
下表及 preservation mapping 中未显式写 schema 的业务表均指 `public` schema；Drizzle journal 始终显式写为 `drizzle.__drizzle_migrations`。

| TABLE | CLASSIFICATION | OWNER | PRESERVATION_REASON | REBUILD_ACTION | VALIDATION_METHOD |
|---|---|---|---|---|---|
| `drizzle.__drizzle_migrations` | REQUIRES_SPECIAL_MAPPING | DB migration governance | historical journal 不得伪造 | 不复制；由正式 candidate baseline 表示 | source journal exact prefix + target baseline contract |
| `ai_call_usage_records` | MUST_PRESERVE | analytics | authoritative AI usage facts | exact copy | count/PK/null/FK/fingerprint |
| `appointments` | REQUIRES_SPECIAL_MAPPING | care | 业务事实需补 current institution column | owner reconstruct | exact customer pair join + count/orphan=0 |
| `audit_events` | REQUIRES_SPECIAL_MAPPING | audit | immutable historical facts | source-column subset copy，新增 attribution 保持 NULL/NULL | count/PK/immutable aggregate |
| `auth_account_institution_bindings` | MUST_PRESERVE | security | authoritative empty Binding cohort；不得猜 Binding | exact preserve empty | source=0/target=0 |
| `auth_users` | SECRET_SENSITIVE | auth | identity/security facts + password hashes | opaque encrypted-byte preservation | count/PK/internal byte digest，禁止输出值 |
| `customer_channel_contact_consents` | MUST_PRESERVE | customer-center | consent facts | exact copy | count/PK/FK/fingerprint |
| `customer_channel_frequency_states` | MUST_PRESERVE | customer-center | frequency control facts | exact copy | count/PK/FK/unique |
| `customers` | MUST_PRESERVE | customer-center | customer + persisted institution pair | exact copy | count/PK/pair/null/FK |
| `follow_up_customer_timeline_events` | MUST_PRESERVE | care | timeline facts | exact copy | count/PK/FK/fingerprint |
| `follow_up_message_drafts` | MUST_PRESERVE | care | draft workflow facts | exact copy | count/PK/FK/status aggregate |
| `follow_up_message_templates` | MUST_PRESERVE | care | template facts | exact copy | count/PK/FK/null shape |
| `follow_up_path_enrollments` | MUST_PRESERVE | care | enrollment facts | exact copy | count/PK/FK/status aggregate |
| `follow_up_path_stages` | MUST_PRESERVE | care | stage facts | exact copy | count/PK/FK/order uniqueness |
| `follow_up_tasks` | REQUIRES_SPECIAL_MAPPING | care | task facts需补 current institution column | owner reconstruct | exact customer pair join + count/orphan=0 |
| `his_connection_credential_compensation_jobs` | EPHEMERAL | HIS integration | retry/work queue，current empty | exclude/rebuild none | source empty + target empty |
| `his_connection_credential_compensation_operations` | MUST_PRESERVE | HIS integration | compensation operation facts | exact copy | count/PK/FK/state aggregate |
| `his_connections` | SECRET_SENSITIVE | HIS integration | external credential reference | current empty；drift requires reconfiguration policy | source empty guard |
| `homepage_brand_assets` | MUST_PRESERVE | platform | asset metadata | exact copy | count/PK/reference aggregate |
| `homepage_brand_audit_logs` | MUST_PRESERVE | platform | historical governance facts | exact copy | count/PK/FK/fingerprint |
| `homepage_brand_config_versions` | MUST_PRESERVE | platform | version history | exact copy | count/PK/FK/version aggregate |
| `homepage_brand_configs` | MUST_PRESERVE | platform | current brand config | exact copy | count/PK/unique |
| `institution_channel_dry_run_snapshots` | MUST_PRESERVE | customer-center | dry-run decision facts | exact copy | count/PK/FK/fingerprint |
| `knowledge_chunk_embeddings` | DERIVED | knowledge | regenerable embedding | exclude; regenerate only in later authorized workflow | source count recorded + target empty |
| `knowledge_chunks` | DERIVED | knowledge | regenerable parse chunks | exclude; regenerate only from preserved source | source count recorded + target empty |
| `knowledge_document_file_parse_chunk_embeddings` | DERIVED | knowledge | regenerable file embedding | exclude | source count recorded + target empty |
| `knowledge_document_file_parse_chunks` | DERIVED | knowledge | regenerable parse output | exclude | source count recorded + target empty |
| `knowledge_document_file_parses` | DERIVED | knowledge | regenerable parse state | exclude | source count recorded + target empty |
| `knowledge_document_files` | MUST_PRESERVE | knowledge | file metadata/reference | exact copy | count/PK/FK/reference aggregate |
| `knowledge_documents` | MUST_PRESERVE | knowledge | document facts | exact copy | count/PK/FK/fingerprint |
| `knowledge_index_jobs` | EPHEMERAL | knowledge | current execution queue | exclude; no auto-retry | source empty + target empty |
| `knowledge_indexing_jobs` | EPHEMERAL | knowledge | current indexing queue | exclude; no auto-retry | source empty + target empty |
| `knowledge_qa_audit_logs` | MUST_PRESERVE | knowledge | audit history | exact copy | count/PK/FK/fingerprint |
| `knowledge_quota_usage_records` | MUST_PRESERVE | knowledge | quota facts | exact copy | count/PK/FK/aggregate |
| `knowledge_sources` | MUST_PRESERVE | knowledge | source facts | exact copy | count/PK/FK/fingerprint |
| `platform_ai_credit_metering_rules` | MUST_PRESERVE | platform | metering policy | exact copy | count/PK/unique/fingerprint |
| `platform_ai_model_config_snapshots` | MUST_PRESERVE | platform | model config history | exact copy | count/PK/fingerprint |
| `platform_ai_provider_configs` | SECRET_SENSITIVE | platform | encrypted provider key | preserve encrypted bytes | count/PK/internal byte digest |
| `platform_knowledge_institution_visibility` | MUST_PRESERVE | platform | visibility policy | exact copy | count/PK/FK/unique |
| `tenant_authorization_snapshots` | MUST_PRESERVE | platform | authorization history | exact copy | count/PK/FK/fingerprint |
| `tenant_commercial_records` | MUST_PRESERVE | platform | commercial facts | exact copy | count/PK/FK/fingerprint |
| `tenant_contacts` | MUST_PRESERVE | platform | tenant contact facts | exact copy | count/PK/FK/unique |
| `tenant_members` | REQUIRES_SPECIAL_MAPPING | security | 11 current memberships需映射 current lifecycle schema | formal legacy calibration mapping | count/PK/FK/pair/transition contract |
| `tenant_plan_assignments` | MUST_PRESERVE | platform | plan assignments | exact copy | count/PK/FK/effective aggregate |
| `tenant_plan_change_records` | MUST_PRESERVE | platform | plan change history | exact copy | count/PK/FK/fingerprint |
| `tenant_plan_versions` | MUST_PRESERVE | platform | plan version facts | exact copy | count/PK/FK/version aggregate |
| `tenant_plans` | MUST_PRESERVE | platform | plan catalog | exact copy | count/PK/unique |
| `tenant_quota_snapshots` | MUST_PRESERVE | platform | quota facts | exact copy | count/PK/FK/fingerprint |
| `tenants` | MUST_PRESERVE | platform | tenant identity facts | exact copy | count/PK/unique/fingerprint |
| `treatment_summaries` | REQUIRES_SPECIAL_MAPPING | care | clinical summary需补 current institution column | owner reconstruct | exact customer pair join + count/orphan=0 |
| `wecom_customer_broadcast_recipient_bindings` | MUST_PRESERVE | customer-center | recipient binding facts | exact copy | count/PK/FK/unique |
| `wecom_customer_broadcast_task_provider_attempts` | EPHEMERAL | customer-center | provider attempt queue/log，current empty | exclude; no auto-retry | source empty + target empty |
| `wecom_customer_mapping_states` | MUST_PRESERVE | customer-center | mapping decision facts | exact copy | count/PK/FK/fingerprint |
| `wecom_real_send_production_attestations` | DO_NOT_COPY | customer-center | environment-specific production attestation | exclude | target empty + explicit re-attestation required |
| `wecom_real_send_proof_controls` | MUST_PRESERVE | customer-center | proof control facts | exact copy | count/PK/FK/fingerprint |
| `wecom_real_send_proof_operations` | MUST_PRESERVE | customer-center | send operation evidence | exact copy | count/PK/FK/status aggregate |

分类总计 `37+0+5+4+3+1+6=56`，没有 `UNKNOWN`。空表 classification 仍按 owner 与 future semantics 固定，不能因 row count 为 0 从 inventory 删除。

## 五、secret-sensitive 与外部 payload

| TABLE | SECRET_DATA_KIND | COPY_POLICY |
|---|---|---|
| `auth_users` | password hash 与账户安全状态 | `preserve_encrypted_bytes` |
| `his_connections` | external credential reference | `not_applicable`（current cohort 为空；执行前 drift 则停止） |
| `platform_ai_provider_configs` | encrypted provider API key | `preserve_encrypted_bytes`（current cohort 为空） |

```text
SECRET_SENSITIVE_TABLE_COUNT=3
SECRET_VALUE_READ=false
SECRET_VALUE_LOGGED=false
```

future runner 只能在内部对 opaque bytes 做 equality digest；不得 decrypt、rehash、输出或把 secret 放入 manifest。backup 因包含 `auth_users` security/PII facts 必须加密。

```text
FILE_REFERENCE_TABLES=public.homepage_brand_assets,public.knowledge_document_files
EXTERNAL_PAYLOAD_PRESERVATION_REQUIRED=true
EXTERNAL_PAYLOAD_SOURCE=repository_local_var_homepage_brand_assets_and_var_knowledge_files_retained_in_place
EXTERNAL_PAYLOAD_COPY_REQUIRED=false
EXTERNAL_PAYLOAD_DB_RELINK_ALLOWED=false
```

source DB 两张 reference table 均为 0 行；对应本地 payload roots 存在共 14 个文件，但文件名、ID 与内容不进入文档。rebuild 只处理 DB，不复制、不删除、不重命名 payload，也不把 orphan filesystem files 猜测绑定到 DB rows。

## 六、candidate schema 四方案比较

| Option | FEASIBLE | 结论 |
|---|---|---|
| A `FULL_CURRENT_MIGRATION_REPLAY` | false | empty DB 可进入早期链，但 `0039` 需要 Scope/Context/Binding checkpoint；后续 `0041/0043` 又冻结 historical one-Membership fixture，不能成为一般 candidate bootstrap |
| B `CURRENT_SCHEMA_BASELINE_BOOTSTRAP` | false | repository 无 baseline SQL/snapshot/test bootstrap/正式 `db:push` 入口；Drizzle schema push 不创建可信 historical journal，也不能证明 custom constraints/triggers 与未来 migrations 兼容 |
| C `DERIVED_CURRENT_SCHEMA_BOOTSTRAP` | design direction only | 可设计 current schema baseline + canonical marker，但 repository 当前没有该 artifact/lineage contract；新增它是高治理风险、需单独 Admission |
| D `RESTORE_ORIGINAL_THEN_FORWARD_RECONCILE` | false | restore 只恢复 0037 shape；repository 没有能绕开不适用 historical guards、同时不伪造 journal 的 forward reconciliation mechanism |

```text
OPTION_A_FEASIBLE=false
OPTION_A_FAILURE_POINT=0039_requires_provisioned_scope_context_binding_then_0041_0043_require_historical_single_membership_shape

OPTION_B_FEASIBLE=false
OPTION_B_JOURNAL_SAFE=false
OPTION_B_FUTURE_MIGRATION_SAFE=false

OPTION_C_FEASIBLE=true_as_governance_design_direction_only
OPTION_C_REQUIRES_NEW_BASELINE_ARTIFACT=true
OPTION_C_GOVERNANCE_RISK=high

OPTION_D_FEASIBLE=false
OPTION_D_FORWARD_RECONCILIATION_REQUIRED=true

SELECTED_CANDIDATE_SCHEMA_STRATEGY=blocked_no_safe_candidate_schema_strategy
SELECTED_CANDIDATE_SCHEMA_STRATEGY_REASON=no_repository_supported_candidate_baseline_can_represent_current_schema_and_remain_future_migration_safe_without_falsifying_0038_0045_history
CANDIDATE_MIGRATION_BASELINE_STRATEGY=not_frozen_blocked_pending_formal_baseline_governance
```

current target `schema.ts` 定义 60 张 public 表；source 55 张 public 表缺 `institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts`、`tenant_membership_transitions` 与 `auth_account_institution_binding_transitions`。candidate baseline 必须真实说明这 5 张表及 `0038..0045` schema effects 如何产生，并定义未来 migration 从何处继续；不得手工填 journal、声称 `0038..0045` 已执行、改 consumed SQL 或 hash。

## 七、exact data-preservation mapping

所有 `exact_copy` 的 `COLUMN_MAPPING` 均为 source catalog 中全部列按 exact name/type/nullability 映射；执行时若 target 多出无正式 mapping 的 required column，必须停止。`FK_ORDER` 是 topological phase，不是 SQL。

| SOURCE_TABLE | TARGET_TABLE | COPY_MODE | COLUMN_MAPPING / TRANSFORM | FK_ORDER | VALIDATION |
|---|---|---|---|---|---|
| `drizzle.__drizzle_migrations` | candidate baseline journal | exclude | 不复制 source journal；由正式 baseline contract 建立 | P0 | source prefix 与 target marker 分别验证 |
| `ai_call_usage_records` | same | exact_copy | all source columns | P4 | count/PK/FK/null/fingerprint |
| `appointments` | same | owner_reconstruct | 11 source columns exact；`institution_id=customers.institution_id` on exact `(tenant_id,customer_id)` | P4 | 5/5 unique match，orphan=0 |
| `audit_events` | same | column_subset_copy | 12 source columns exact；target `institution_id=NULL`,`institution_attribution=NULL` | P3 | 252 rows，immutable source aggregate |
| `auth_account_institution_bindings` | same | exact_copy | authoritative empty cohort；不得从 Membership/customer 猜 row | P4 | source=0/target=0 |
| `customer_channel_contact_consents` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `customer_channel_frequency_states` | same | exact_copy | all source columns | P4 | count/PK/FK/unique |
| `customers` | same | exact_copy | all source columns including persisted institution pair | P3 | 9 rows，null institution=0，distinct pair=2 |
| `follow_up_customer_timeline_events` | same | exact_copy | all source columns | P5 | count/PK/FK |
| `follow_up_message_drafts` | same | exact_copy | all source columns | P5 | count/PK/FK/status |
| `follow_up_message_templates` | same | exact_copy | all source columns | P4 | count/PK/FK/null |
| `follow_up_path_enrollments` | same | exact_copy | all source columns | P5 | count/PK/FK/status |
| `follow_up_path_stages` | same | exact_copy | all source columns | P5 | count/PK/FK/order |
| `follow_up_tasks` | same | owner_reconstruct | source columns exact；`institution_id` from exact customer pair | P4 | 4/4 unique match，orphan=0 |
| `his_connection_credential_compensation_operations` | same | exact_copy | all source columns | P4 | count/PK/FK/state |
| `homepage_brand_assets` | same | exact_copy | all source columns | P3 | count/PK/reference |
| `homepage_brand_audit_logs` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `homepage_brand_config_versions` | same | exact_copy | all source columns | P3 | count/PK/FK/version |
| `homepage_brand_configs` | same | exact_copy | all source columns | P1 | count/PK/unique |
| `institution_channel_dry_run_snapshots` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `knowledge_document_files` | same | exact_copy | all source columns | P4 | count/PK/FK/reference |
| `knowledge_documents` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `knowledge_qa_audit_logs` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `knowledge_quota_usage_records` | same | exact_copy | all source columns | P4 | count/PK/FK/aggregate |
| `knowledge_sources` | same | exact_copy | all source columns | P3 | count/PK/FK |
| `platform_ai_credit_metering_rules` | same | exact_copy | all source columns | P1 | count/PK/unique |
| `platform_ai_model_config_snapshots` | same | exact_copy | all source columns | P1 | count/PK/fingerprint |
| `platform_knowledge_institution_visibility` | same | exact_copy | all source columns | P4 | count/PK/FK/unique |
| `tenant_authorization_snapshots` | same | exact_copy | all source columns | P3 | count/PK/FK |
| `tenant_commercial_records` | same | exact_copy | all source columns | P3 | count/PK/FK |
| `tenant_contacts` | same | exact_copy | all source columns | P3 | count/PK/FK/unique |
| `tenant_members` | same | column_map_copy | preserve 7 source columns；per existing row use repository legacy calibration semantics: revision 1, `active`, `legacy_calibration`, null actor/occurred, `legacy_unknown`, deterministic command/evidence IDs, recorded at source updated time | P3 | 11 source=11 target；same pair/role/timestamps；11 transitions；no extra membership |
| `tenant_plan_assignments` | same | exact_copy | all source columns | P3 | count/PK/FK/effective |
| `tenant_plan_change_records` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `tenant_plan_versions` | same | exact_copy | all source columns | P2 | count/PK/FK/version |
| `tenant_plans` | same | exact_copy | all source columns | P1 | count/PK/unique |
| `tenant_quota_snapshots` | same | exact_copy | all source columns | P3 | count/PK/FK |
| `tenants` | same | exact_copy | all source columns | P1 | 6 rows/PK/unique |
| `treatment_summaries` | same | owner_reconstruct | source columns exact；`institution_id` from exact customer pair | P4 | 7/7 unique match，orphan=0 |
| `wecom_customer_broadcast_recipient_bindings` | same | exact_copy | all source columns | P5 | count/PK/FK/unique |
| `wecom_customer_mapping_states` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `wecom_real_send_proof_controls` | same | exact_copy | all source columns | P4 | count/PK/FK |
| `wecom_real_send_proof_operations` | same | exact_copy | all source columns | P5 | count/PK/FK/status |

`tenant_members` mapping不删除、不合并、不 seed Membership；现存 source row 表示 current membership，采用 repository 已定义的 `legacy_calibration` uncertainty semantics，而不是猜 actor、occurred time 或 historical transition。该 mapping 只有在 future baseline/tool Admission 明确接受多 row deterministic calibration 后才可执行。

### 7.1 institution Scope / Context / Binding

- customer facts：9/9 具有 persisted `tenant_id + institution_id`，形成 2 个 distinct verified pairs；仅能用于同 customer owner chain 的 appointment/treatment/follow-up `institution_id` reconstruction。
- Scope/Context：customer pair 不能替代正式 Provisioning provenance。candidate 只能消费新的、current-local-development-specific approved Manifest、Context Policy 与 execution lease；在此之前不得创建 Scope/Context。
- Binding：source 为 0。candidate 必须保持 0，不得从 tenant Membership、customer pair、单机构假设或目录位置推断 Binding；未来如需 Binding，必须有独立 approved account/institution fact。
- operating context：timezone、currency、effective time、actor 与 approval 不可从现表猜测。

```text
PRESERVATION_VERIFIED_ATTRIBUTABLE_TABLE_COUNT=1
PRESERVATION_NOT_APPLICABLE_TABLE_COUNT=9
PRESERVATION_UNCLASSIFIABLE_TABLE_COUNT=1
PRESERVATION_OWNER_RECONSTRUCTABLE_TABLE_COUNT=3
PRESERVATION_EMPTY_TABLE_COUNT=41
```

以上 attribution aggregate 的 denominator 是 14 张非空 public 表：`customers` 为 verified；appointments/treatment/follow-up task 为 owner reconstructable；`audit_events` 为 unclassifiable-as-new-attribution 且原样保留；其余 9 张 tenant/platform/auth 非空表不适用单一 institution attribution。41 张空表没有历史 row 需要归因，未被伪计入任何类别。

## 八、关键 business aggregates、identity、Audit 与 AI usage

```text
TENANT_COUNT=6
AUTH_USER_COUNT=11
TENANT_MEMBER_COUNT=11
BINDING_COUNT=0

TENANT_PRESERVATION_POLICY=exact_copy_all_six_rows_and_ids
AUTH_USER_PRESERVATION_POLICY=exact_copy_all_eleven_rows_with_opaque_security_bytes
TENANT_MEMBER_PRESERVATION_POLICY=preserve_all_eleven_membership_facts_and_apply_only_formally_admitted_legacy_calibration_mapping

SEQUENCE_BACKED_TABLE_COUNT=1
BUSINESS_SEQUENCE_BACKED_TABLE_COUNT=0
IDENTITY_BACKED_TABLE_COUNT=0
ID_PRESERVATION_REQUIRED=true
SEQUENCE_RESEED_REQUIRED=false

AUDIT_PRESERVATION_MODE=column_subset_copy_exact_legacy_shape
AUDIT_ROW_COUNT=252
AUDIT_REWRITE_ALLOWED=false

AI_USAGE_PRESERVATION_MODE=exact_copy_empty_cohort_with_target_schema_validation
AI_USAGE_ROW_COUNT=0
```

source `audit_events` 没有 target 新增的 attribution columns；252 rows 的 12-column facts 原样复制，新增 `institution_id` 与 `institution_attribution` 维持 NULL/NULL，不根据当前 customer/Membership 重新解释。source journal 的 sequence 不复制且不得 `setval`；candidate journal 由未来正式 baseline mechanism 自己拥有。

## 九、data transfer、backup 与 restore drill

### 9.1 唯一 transfer mechanism

```text
SELECTED_DATA_TRANSFER_MECHANISM=controlled_application_level_table_by_table_copy
```

选择理由：只有受控 table-by-table runner 能同时执行 exact columns、特殊 owner mapping、FK phases、opaque secret handling、per-table checkpoint 与 fail-closed validation。`pg_dump/pg_restore --data-only` 不适合 source/target column shape 差异；SQL INSERT generation 有 secret/PII 泄漏风险；logical replication 不适合一次性 schema transform；`COPY` 可作为 runner 内部 transport primitive，但不能独立承担 mapping/governance。

restart contract：每 phase 写入 candidate 前验证 candidate 为空或匹配同一 frozen manifest checkpoint；partial/unknown state 必须 STOP，禁止自动 retry。original 永不被 data transfer mutation。

### 9.2 backup design

```text
BACKUP_FORMAT=PostgreSQL_16_custom_format_logical_dump_then_encrypt
BACKUP_SCOPE=entire_original_database_including_drizzle_journal_application_schemas_and_large_objects
BACKUP_DESTINATION_CLASS=repository_external_local_0700_directory_with_0600_encrypted_artifact
BACKUP_ENCRYPTION_REQUIRED=true
BACKUP_HASH_REQUIRED=true
BACKUP_VERIFICATION_METHOD=ciphertext_SHA256_plus_pg_restore_list_parse_plus_isolated_restore_drill
BACKUP_TOOL_COMPATIBILITY=source_container_pg_dump_16_14_and_pg_restore_16_14
```

live Docker volume 不是 backup。future execution 必须先从 source container 的 PostgreSQL 16.14 tooling 生成 custom-format full logical dump，通过明确批准的 local encryption key source 加密，仅保留低敏 tool version、artifact size、ciphertext digest 与 timestamp；不得输出 credentials 或 row content。

### 9.3 isolated restore drill

```text
RESTORE_DRILL_REQUIRED=true
RESTORE_DRILL_DATABASE_LOCATION=127.0.0.1:55435/zmtg_clean_local_dev_restore_drill_in_dedicated_container_and_volume
RESTORE_DRILL_CONTAINER_NAME=zmtg-local-dev-restore-drill-pg
RESTORE_DRILL_VOLUME_NAME=zmtg-local-dev-restore-drill-pg-data
RESTORE_DRILL_NETWORK_SCOPE=loopback_only
RESTORE_DRILL_SUCCESS_CRITERIA=restore_exit_success_plus_55_public_tables_plus_38_journal_rows_plus_all_table_counts_PK_FK_catalog_fingerprints_and_critical_business_aggregates_match
```

restore drill 与 candidate、original 使用不同 container/volume/database/port。它只证明 source backup 可恢复，不作为 current-schema candidate，也不得替代 candidate baseline。

## 十、side-by-side candidate、pipeline 与 validation

```text
CANDIDATE_CONTAINER_NAME=zmtg-local-dev-candidate-pg
CANDIDATE_VOLUME_NAME=zmtg-local-dev-candidate-pg-data
CANDIDATE_DATABASE_NAME=zmtg_clean_local_dev_candidate
CANDIDATE_PORT=55434
CANDIDATE_NETWORK_SCOPE=loopback_only
CANDIDATE_IDENTITY_CONFLICT_COUNT=0

ORIGINAL_DB_MUTATION_ALLOWED=false
ORIGINAL_DB_REMAINS_CANONICAL_UNTIL_CUTOVER=true
```

拟议 candidate 与 restore-drill identifiers、55434/55435 均已做 read-only host/container conflict check；S24 未创建它们。

future pipeline 必须完整按以下顺序 fail-closed：

1. P0：clean SHA、loopback identities、source read-only precheck、empty candidate/drill target、secret-safe paths。
2. P1：encrypted full logical backup + ciphertext digest。
3. P2：独立 restore drill 与 original equality validation。
4. P3：创建 isolated candidate container/volume/database。
5. P4：按未来获准的 canonical candidate baseline 建 current schema。
6. P5：按本报告 exact mapping 与 FK phases transfer。
7. P6：验证 generated/identity/sequence contract；本 cohort 不运行 source `setval`。
8. P7：catalog、enum、constraint、index、trigger、journal/baseline integrity。
9. P8：FK orphan、unique duplicate、PK distinct validation。
10. P9：business aggregates 与 low-sensitive fingerprints。
11. P10：SYS-01 journal/schema/source/institution readiness audit。
12. P11：只对 candidate 运行应用 smoke tests。
13. P12：cutover readiness 与 rollback precheck。
14. P13：必须另行显式授权 cutover。
15. P14：post-cutover read-only verification。
16. P15：retain original rollback window；禁止自动 cleanup。

```text
REBUILD_VALIDATION_MATRIX_FROZEN=true
LOW_SENSITIVE_DATA_FINGERPRINT_STRATEGY=per_table_row_count_PK_distinct_null_vector_FK_orphan_unique_duplicate_plus_canonical_SHA256_over_sorted_non_secret_structural_aggregates
```

validation matrix 至少逐表检查 `TABLE_ROW_COUNT_MATCH`、`PRIMARY_KEY_DISTINCT_COUNT_MATCH`、`NULL_SHAPE_MATCH`、`FK_ORPHAN_COUNT=0`、`UNIQUE_DUPLICATE_GROUP_COUNT=0`，并检查 tenant/member/customer/appointment/treatment/follow-up/audit/AI usage totals。secret 与 PII 不进入 canonical digest；secret-sensitive columns 只在进程内做 opaque equality proof。

## 十一、cutover、rollback 与 outcome unknown

| 方案 | 结论 |
|---|---|
| switch host port mapping | rejected：会改变 original container network identity，rollback surface 较大 |
| update `.env.local` endpoint/database | selected：只改 local config，original container/volume/port 不动 |
| rename containers | rejected：不必要且增加 name/volume confusion |
| drop/replace original | prohibited |

```text
SELECTED_CUTOVER_MECHANISM=explicit_local_env_endpoint_and_database_switch_to_127_0_0_1_55434_candidate
CUTOVER_REVERSIBLE=true
CUTOVER_REQUIRES_SECRET_CHANGE=false
CUTOVER_REQUIRES_ENV_LOCAL_CHANGE=true

ROLLBACK_TRIGGER=any_post_cutover_connection_schema_journal_integrity_business_aggregate_SYS01_readiness_or_application_smoke_failure
ROLLBACK_MECHANISM=stop_application_switch_local_env_endpoint_and_database_back_to_original_127_0_0_1_55433_restart_and_run_read_only_verification
ORIGINAL_DB_RETENTION_WINDOW=minimum_7_calendar_days_and_until_explicit_user_disposal_authorization

OUTCOME_UNKNOWN_RECOVERY_STRATEGY=STOP_NO_AUTO_RETRY_preserve_original_candidate_backup_and_all_evidence_then_read_only_reconcile_exact_phase_before_new_authorization
```

cutover 仅改变 secret-bearing `.env.local` 中的 non-secret endpoint/database components；不旋转或记录 credential。断连、container/host crash、partial transfer、unknown restore/backup status 均禁止猜成功、重复 phase、覆盖 original 或自动 restore。

## 十二、tooling judgment 与 blocker closure

repository 当前没有能完成 backup wrapper、restore drill、candidate guard、schema baseline、deterministic transfer、validation 与 cutover precheck 的正式 data-preserving workflow，因此最终 execution 必须有最小 tooling；但本阶段不能冻结 exact implementation files：baseline governance 选择会直接决定是否需要 migration/baseline artifact、journal marker、runner guard 与哪些 tests。此时填入文件名会制造虚假 allowlist。

```text
CONTROLLED_REBUILD_TOOL_IMPLEMENTATION_REQUIRED=true
CONTROLLED_REBUILD_EXACT_ALLOWLIST_FROZEN=false
CONTROLLED_REBUILD_EXACT_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_PRODUCTION_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_TEST_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_DOC_FILE_COUNT=0
CONTROLLED_REBUILD_EXACT_ALLOWLIST=none_until_candidate_baseline_governance_is_frozen

REBUILD_EXECUTION_ADMISSION_READY=false
PRIMARY_BLOCKING_PREREQUISITE=no_repository_supported_candidate_baseline_can_represent_current_schema_and_remain_future_migration_safe_without_falsifying_0038_0045_history
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CANDIDATE_MIGRATION_BASELINE_GOVERNANCE_ADMISSION
NEXT_TASK_AUTHORIZED=false
```

下一原子任务只应决定 candidate baseline artifact、canonical marker/journal semantics、future migration lineage 与 exact tooling allowlist；不得自动生成 artifact、执行 rebuild 或进入 SYS-01 Runtime。

## 十三、S24 执行边界

```text
DATABASE_REBUILD_EXECUTION=false
DATABASE_CREATE=false
DATABASE_DROP=false
DATABASE_RESET=false
BACKUP_EXECUTION=false
RESTORE_EXECUTION=false
MIGRATION_EXECUTION=false
PROVISIONING_WRITE_EXECUTION=false
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

future rebuild 若最终完成，仍须在同一 authorized execution chain 继续 candidate journal/schema verification、AI usage source verification、institution scope verification、SYS-01 cohort audit、data readiness、tenant/institution isolation 与 exact Runtime Admission；不得重做 S20-S23，也不得把 rebuild 成功当成 Runtime 授权。

## 十四、docs-only 验证

```text
TARGETED_TEST_FILES=18
TARGETED_TESTS=652/652 passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
```

targeted 只运行 Schema、MigrationGuard、SeedGuard、Provisioning contracts/adapters 与现有 DB tooling 的 fake/in-memory static unit tests；没有执行会 create/drop/backup/restore/migrate/seed 或写数据库的 command/test。

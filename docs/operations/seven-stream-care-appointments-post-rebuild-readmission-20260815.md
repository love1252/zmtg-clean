# Care appointments post-rebuild fresh 重新准入

- 审计日期：2026-08-16
- 阶段：S36
- 流：`care`
- 选定首切片：`APPOINTMENTS_LIST_BY_CURRENT_INSTITUTION`
- 基线：`51e40b2a154d9d32c57e865e50cc4172da8a39a1`
- 性质：docs-only + active candidate transaction-read-only data/formal-auth audit
- 结论：5/5 appointments 已正确持久化 customer authoritative institution pair；formal Scope/Binding/Anchor 仍为空，Reader/API authorization chain 无法闭合，Runtime allowlist 为 0

## 一、重新准入结论

```text
STAGE=S36
STREAM=care
TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_SYSTEM_REBUILD
COMPLETION_MODE=READMISSION_COMPLETE_BLOCKED_PENDING_FORMAL_SCOPE_PROVISIONING
BASELINE=51e40b2a154d9d32c57e865e50cc4172da8a39a1

S35_PR=1242
S35_HEAD=f6af73e8d830278f51646bdceff5781c18388429
S35_MERGE=51e40b2a154d9d32c57e865e50cc4172da8a39a1
S35_REQUIRED_CHECK=passed
S35_ACTIONABLE_P0_P1_P2_P3=0
S35_POST_MERGE_REVIEW_DEBT=0

CARE_SELECTED_FIRST_SLICE=APPOINTMENTS_LIST_BY_CURRENT_INSTITUTION
APPOINTMENT_COUNT=5
APPOINTMENT_NULL_TENANT_COUNT=0
APPOINTMENT_NULL_INSTITUTION_COUNT=0
APPOINTMENT_CUSTOMER_ORPHAN_COUNT=0
APPOINTMENT_PAIR_MISMATCH_COUNT=0
APPOINTMENT_PAIR_ZERO_MATCH_COUNT=0
APPOINTMENT_PAIR_MULTI_MATCH_COUNT=0
APPOINTMENT_PAIR_UNIQUE_MATCH_COUNT=5
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
CARE_EXACT_RUNTIME_ALLOWLIST=not_frozen
CARE_RUNTIME_IMPLEMENTATION=false
CARE_PAGE_RELEASE=false
```

S34 special mapping 已完成原先 source 不具备的 `appointments.institution_id`：每条 appointment 的 persisted `tenant_id + customer_id + institution_id` 都与 customer authoritative pair exact-one 匹配，没有 null、orphan、mismatch、zero-match 或 multi-match。数据 owner reconstruction blocker 已解除。

但 candidate 中 `institution_scopes=0`、active Binding=0，五条 appointment pair 全部没有 formal scope authority。数据 pair 正确不等于当前请求具备 formal institution provenance；因此不能绕过 Scope/Binding，不能冻结 Reader/API Runtime allowlist。

## 二、candidate read-only data audit

连接只从 active local secret configuration 取得；先验证 exact candidate identity，再由 startup `default_transaction_read_only=on` 与 repeatable-read read-only transaction 双重限制。第一条 statement 确认 `transaction_read_only=on`，全部 SQL 为 aggregate SELECT，最后显式 `ROLLBACK`。

```text
CANDIDATE_DATABASE_IDENTITY=127.0.0.1:55434/zmtg_clean_local_dev_candidate
CANDIDATE_IDENTITY_VERIFIED=true
CLIENT_STARTUP_DEFAULT_TRANSACTION_READ_ONLY=on
TRANSACTION=BEGIN_TRANSACTION_ISOLATION_LEVEL_REPEATABLE_READ_READ_ONLY
FIRST_SELECT_TRANSACTION_READ_ONLY=on
QUERY_CLASS=aggregate_select_only
TRANSACTION_END=ROLLBACK

DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false
ORIGINAL_55433_DATABASE_WRITE=false
```

`pair_matches` 只接受 appointment 与 customer 的 exact `tenant_id + customer_id + institution_id`；没有按当前 membership、单机构租户或目录位置推导 pair。审计只输出 aggregate counts，不输出 appointment/customer/user/tenant/institution ID、PII 或业务正文。

## 三、formal authorization dependency

```text
INSTITUTION_SCOPE_COUNT=0
ACTIVE_INSTITUTION_SCOPE_COUNT=0
OPERATING_CONTEXT_COUNT=0
ACTIVE_BINDING_COUNT=0
ACTIVE_TENANT_MEMBER_COUNT=11

TENANT_ADMIN_CARE_APPOINTMENT_READ_ALLOWED=true
TENANT_OPERATOR_CARE_APPOINTMENT_READ_ALLOWED=true
CONSULTANT_CARE_APPOINTMENT_READ_ALLOWED=true
CUSTOMER_SERVICE_CARE_APPOINTMENT_READ_ALLOWED=true
CARE_UNKNOWN_ROLE_FAILS_CLOSED=true
```

`care_task/read` formal policy 继续允许四个机构角色；这是 role/action semantics，不是 institution provenance。Membership 只证明 account 属于 tenant，不能选定或证明 institution。没有 active Binding 时无法形成可信 active institution anchor；没有 `institution_scopes` 时也无法 corroborate appointment pair。

```text
MEMBERSHIP_AS_INSTITUTION_ANCHOR_ALLOWED=false
CUSTOMER_PAIR_AS_REQUEST_SCOPE_ALLOWED=false
DEFAULT_INSTITUTION_FALLBACK_ALLOWED=false
SINGLE_INSTITUTION_TENANT_ASSUMPTION_ALLOWED=false
```

因此 S36 不能把 `APPOINTMENT_FORMAL_SCOPE_ORPHAN_COUNT=5` 描述为业务数据 orphan：appointment→customer pair 已完整，缺失的是独立 formal authority cohort。该 blocker 与 S35 一致，应由 authoritative provisioning prerequisite 闭合，而不是由 Care Runtime 临时 join 或新增 ownership query 规避。

## 四、Reader、API 与 page 边界

```text
CARE_FACT_OWNER=public.appointments
CARE_COMMAND_OWNER=src/modules/care
CARE_REPOSITORY_OWNER=src/modules/care
CARE_READ_MODEL_OWNER=src/modules/care
CARE_PRESENTATION_OWNER=src/modules/care
CARE_CROSS_OWNER_COMPOSITION_OWNER=src/server/orchestration

CARE_FORMAL_READER_EXISTS=false
CARE_CURRENT_API=/api/institution/appointments
CARE_CURRENT_API_STATE=capability_off_compatibility_only_503
CARE_TARGET_VERSIONED_API=/api/v1/institution/appointments
CARE_TARGET_VERSIONED_API_EXISTS=false
CARE_CANONICAL_PAGE=/hospital/care/appointments
CARE_CAPABILITY_KEY=page_care_appointments
CARE_CAPABILITY_DECISION=hidden
CARE_PAGE_RELEASE_ADMISSION_READY=false
```

current main 仍只有 Care command/repository；没有 formal appointment list Reader 或 versioned API。legacy GET/POST/PATCH 固定返回 `503 capability_disabled`。Capability Authority 仅对 `page_workbench` 与 `page_system_audit` 形成 readonly pilot，`page_care_appointments` 保持 hidden/not_released。S36 不修改这些 Runtime surfaces。

## 五、阻断与下一任务

```text
BLOCKING_PREREQUISITE_COUNT=1
PRIMARY_BLOCKING_PREREQUISITE=authoritative_formal_institution_scope_context_binding_provisioning_source_missing
BLOCKING_FACT=all_5_persisted_appointment_pairs_have_no_matching_formal_institution_scope_and_active_binding_count_is_zero

CARE_SCHEMA_CHANGE_REQUIRED=false
CARE_MIGRATION_REQUIRED=false
CARE_DML_REQUIRED=false

NEXT_CARE_TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_FORMAL_SCOPE_PROVISIONING
NEXT_CARE_TASK_AUTHORIZED=false
NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_FORMAL_INSTITUTION_SCOPE_CONTEXT_BINDING_PROVISIONING_SOURCE_FRESH_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
```

只有 authoritative provisioning 完成并重新验证 active formal pair、anchor、membership 与 policy 后，才可重新决定 Care exact Runtime allowlist。S36 不预先列出或实施 Reader/API/page files。

当前 ultra goal 仍授权 S36 merge 后进入 S37 Knowledge formal fresh Admission；这不会授权 Care/System blocker，也不会自动执行 Knowledge Runtime。

```text
KNOWLEDGE_RUNTIME_IMPLEMENTATION=false
PAGE_RELEASE=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0

NEXT_KNOWLEDGE_TASK=SEVEN_STREAM_KNOWLEDGE_FORMAL_FRESH_ADMISSION
NEXT_KNOWLEDGE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S36_merge
NEXT_STAGE=S37
NEXT_STAGE_AUTO_EXECUTION=false
```

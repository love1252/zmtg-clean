# System SYS-01 post-rebuild data / Runtime 重新准入

- 审计日期：2026-08-16
- 阶段：S35
- 流：`system`
- 切片：`SYS_01_AI_USAGE_READONLY`
- 基线：`519d3f383f9758b17c5ee0e3bdd944717f378df8`
- 性质：docs-only + active candidate transaction-read-only aggregate/catalog audit
- 结论：rebuild 数据与 catalog 验证通过，但 formal Scope/Context/Binding 三个 target-only cohort 均为空；SYS-01 Runtime 不准入，exact allowlist 为 0

## 一、重新准入结论

```text
STAGE=S35
TASK=SEVEN_STREAM_SYSTEM_SYS_01_POST_REBUILD_DATA_AND_RUNTIME_READMISSION
COMPLETION_MODE=READMISSION_COMPLETE_BLOCKED_PENDING_FORMAL_PROVISIONING
BASELINE=519d3f383f9758b17c5ee0e3bdd944717f378df8

S34_PR=1241
S34_HEAD=77ec36a489a5f3cf5c1f91187ef197871045f58f
S34_MERGE=519d3f383f9758b17c5ee0e3bdd944717f378df8
S34_REQUIRED_CHECK=passed
S34_REVIEW_P2_RESOLVED=1
S34_POST_MERGE_REVIEW_DEBT=0
S34_COMPLETE=true
S34_FORMAL_CLOSURE=true

INSTITUTION_SCOPE_COUNT=0
OPERATING_CONTEXT_VERSION_COUNT=0
OPERATING_CONTEXT_COUNT=0
BINDING_COUNT=0
ACTIVE_BINDING_COUNT=0
TENANT_MEMBER_COUNT=11
ACTIVE_TENANT_MEMBER_COUNT=11
AI_USAGE_COUNT=0

VERIFIED_AUDIT_ATTRIBUTION_COUNT=0
NOT_APPLICABLE_AUDIT_ATTRIBUTION_COUNT=0
LEGACY_UNATTRIBUTED_AUDIT_ATTRIBUTION_COUNT=0
NULL_AUDIT_ATTRIBUTION_COUNT=252

SYS01_DATA_READINESS=blocked_target_only_formal_scope_context_binding_cohorts_empty
SYS01_TENANT_ISOLATION_SAFE=false
SYS01_INSTITUTION_ISOLATION_SAFE=false
SYS01_FORMAL_SCOPE_READY=false
SYS01_FORMAL_CONTEXT_READY=false
SYS01_BINDING_READY=false
SYS01_RUNTIME_ADMISSION_READY=false

SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_EXACT_RUNTIME_FILE_COUNT=0
SYS01_EXACT_RUNTIME_ALLOWLIST=not_frozen
```

S34 的 controlled rebuild 已证明 baseline schema、数据映射、candidate validation 与 cutover 成功，但 runner 明确将 `institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts` 归类为 `target_empty_no_guess`，并 exact preserve 空的 `auth_account_institution_bindings`。因此 S35 的 0-row 结果是冻结策略的预期输出，不是 rebuild 缺陷；也不能把预期空 cohort 改写为 Runtime ready。

## 二、candidate 只读审计

连接只从 active local secret configuration 取得；先验证 exact candidate host、port 与 database identity，再通过 startup `default_transaction_read_only=on` 和 `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` 双重限制。第一条数据库语句确认 `transaction_read_only=on`；全部 evidence 都是 `COUNT`/catalog aggregate，最后显式 `ROLLBACK`。

```text
CANDIDATE_DATABASE_IDENTITY=127.0.0.1:55434/zmtg_clean_local_dev_candidate
CANDIDATE_IDENTITY_VERIFIED=true
CLIENT_STARTUP_DEFAULT_TRANSACTION_READ_ONLY=on
TRANSACTION=BEGIN_TRANSACTION_ISOLATION_LEVEL_REPEATABLE_READ_READ_ONLY
FIRST_SELECT_TRANSACTION_READ_ONLY=on
QUERY_CLASS=aggregate_and_catalog_select_only
TRANSACTION_END=ROLLBACK

DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false
ORIGINAL_55433_DATABASE_WRITE=false
```

没有输出数据库 credential、完整 URL、row ID、用户/机构/租户 ID、PII 或业务正文。

## 三、formal facts 与 integrity

| Cohort / 检查 | Count | 结论 |
|---|---:|---|
| `institution_scopes` | 0 | 没有正式 tenant/institution pair authority |
| `institution_operating_context_versions` | 0 | 没有 timezone/currency/effective-version 事实 |
| `institution_operating_contexts` | 0 | 没有 current formal context pointer |
| `auth_account_institution_bindings` | 0 | 没有 account→tenant/institution Binding |
| active bindings | 0 | 任何正式 account 都无法取得 active institution Binding |
| `tenant_members` | 11 | membership 存在，但不能代替 Scope/Binding |
| active tenant members | 11 | 同上；active membership 不是 institution authority |
| `ai_call_usage_records` | 0 | 当前业务 cohort 为空，不能用 vacuous zero 证明隔离闭合 |

Fresh orphan counts 均为 0：scope→tenant、context version→scope、context→scope/latest version、binding→membership/scope、membership→tenant/user、AI usage→tenant/scope、verified audit→scope。这里的 0 只证明现有 rows 没有 orphan；对 Scope/Context/Binding 与 AI usage 空表而言是 vacuous truth，不能形成 positive authorization evidence。

```text
SCOPE_TENANT_ORPHAN_COUNT=0
CONTEXT_VERSION_SCOPE_ORPHAN_COUNT=0
CONTEXT_SCOPE_ORPHAN_COUNT=0
CONTEXT_LATEST_VERSION_ORPHAN_COUNT=0
BINDING_MEMBER_ORPHAN_COUNT=0
BINDING_SCOPE_ORPHAN_COUNT=0
TENANT_MEMBER_TENANT_ORPHAN_COUNT=0
TENANT_MEMBER_USER_ORPHAN_COUNT=0
AI_USAGE_TENANT_ORPHAN_COUNT=0
AI_USAGE_SCOPE_ORPHAN_COUNT=0
AUDIT_VERIFIED_SCOPE_ORPHAN_COUNT=0
INVALID_VERIFIED_ATTRIBUTION_SHAPE_COUNT=0
INVALID_NOT_APPLICABLE_ATTRIBUTION_SHAPE_COUNT=0
```

252 条 historical audit rows 仍为 `institution_attribution IS NULL`，与 S34 冻结的 legacy-preservation policy 一致；S35 不执行 backfill，也不把它们当成 SYS-01 formal scope evidence。

## 四、阻断与下一原子任务

SYS-01 read-only Runtime 需要 formal current pair、role-aware Binding 与 context authority，才能在 tenant/institution aggregate 查询前 fail-closed。当前 11 条 membership 只表达 tenant membership；customer pair、单机构假设或默认机构同样不能生成 Scope/Binding。任何 provisioning 都必须有独立的 authoritative input 与审计责任，不属于本阶段 docs-only/read-only 授权。

```text
PRIMARY_BLOCKING_PREREQUISITE=authoritative_formal_institution_scope_context_binding_provisioning_source_missing
REQUIRED_PROVISIONING_INPUT=approved_tenant_institution_pair_plus_timezone_currency_effective_version_plus_account_binding_authority
MEMBERSHIP_AS_SCOPE_FALLBACK_ALLOWED=false
CUSTOMER_PAIR_AS_SCOPE_FALLBACK_ALLOWED=false
DEFAULT_INSTITUTION_FALLBACK_ALLOWED=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_FORMAL_INSTITUTION_SCOPE_CONTEXT_BINDING_PROVISIONING_SOURCE_FRESH_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_EXECUTED=false
SYS01_RUNTIME_IMPLEMENTATION=false
```

S35 不冻结虚假 Runtime allowlist。下一 System task 必须先 fresh 审计 authoritative provisioning source、审批责任、exact write scope、rollback 与 test closure；它没有被当前 ultra goal 授权。当前 ultra goal 仍授权 S35 merge 后继续 S36 Care candidate read-only re-admission，但不会因此绕过 System blocker。

## 五、边界与阶段交接

```text
CARE_RUNTIME_IMPLEMENTATION=false
KNOWLEDGE_RUNTIME_IMPLEMENTATION=false
PAGE_RELEASE=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0

NEXT_CARE_TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_SYSTEM_REBUILD
NEXT_CARE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_S35_merge
NEXT_STAGE=S36
NEXT_STAGE_AUTO_EXECUTION=false
```

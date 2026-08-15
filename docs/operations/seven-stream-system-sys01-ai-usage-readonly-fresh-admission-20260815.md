# SYS-01 AI 使用只读 fresh Admission

> 日期：2026-08-15
> 基线：`d2ae875cb75bda0c09aaa86d0cc410bf94f0dd78`
> 阶段：S20
> 业务线：`system`
> 切片：`SYS_01_AI_USAGE_READONLY`
> 性质：docs-only fresh Admission；不授权 Runtime、数据库写入、Schema、Migration、Staging 或 Production

## 1. 最终结论

```text
STAGE=S20
STREAM=system
SLICE=SYS_01_AI_USAGE_READONLY
TASK=SEVEN_STREAM_SYSTEM_SYS_01_AI_USAGE_READONLY_FIRST_SLICE_FRESH_ADMISSION
COMPLETION_MODE=ADMISSION_COMPLETE_BLOCKED
BASELINE=d2ae875cb75bda0c09aaa86d0cc410bf94f0dd78

SYS01_FRESH_ADMISSION=passed
SYS01_RUNTIME_ADMISSION_READY=false

AI_USAGE_FACT_DATA_OWNER=analytics
AI_USAGE_READ_MODEL_OWNER=institution-system
AI_USAGE_COMMAND_OWNER=analytics
AI_USAGE_REPOSITORY_OWNER=analytics
AI_USAGE_SYSTEM_PRESENTATION_OWNER=institution-system

SYS01_AUTHORITATIVE_READER_EXISTS=true
SYS01_AUTHORITATIVE_READER_OWNER=institution-system
SYS01_READER_SCOPE_SAFE=true
SYS01_READER_INSTITUTION_AWARE=true
SYS01_READER_TENANT_AWARE=true
SYS01_READER_SERVICE_KEY_POLICY_SAFE=true
SYS01_READER_TERMINAL_STATUS_POLICY_SAFE=true
SYS01_READER_DATA_COMPLETENESS_SEMANTICS=exact_pair_and_half_open_window_fail_closed_max_10000

LEGACY_AI_USAGE_REPOSITORY_CURRENTLY_USED_BY_SYS01=false
LEGACY_AI_USAGE_REPOSITORY_FORMAL_OWNER_SAFE=false
LEGACY_AI_USAGE_REPOSITORY_MIGRATION_REQUIRED_NOW=false

SYS01_FORMAL_COMPOSITION_OWNER=src/server/orchestration
SYS01_CROSS_OWNER_COMPOSITION_REQUIRED=true

SYS01_CANONICAL_API=/api/v1/institution/ai-service-usage
SYS01_LEGACY_API_ROLE=capability_off_compatibility_only
SYS01_V1_API_REQUIRED=true
SYS01_COMPATIBILITY_ROUTE_REQUIRED=false

SYS01_CAPABILITY_KEY=page_system_ai_usage
SYS01_CANONICAL_ROUTE=/hospital/system/ai-usage
SYS01_SECTION_ID=system
SYS01_CURRENT_CAPABILITY_STATE=hidden/not_released
SYS01_CURRENT_PAGE_STATE=shared_catch_all_capability_off
SYS01_DEDICATED_ROUTE_EXISTS=false
SYS01_PAGE_RELEASE_REQUIRED_FOR_FIRST_SLICE=true

SYS01_TARGET_AUDIENCE=tenant_admin+tenant_operator
SYS01_TENANT_ADMIN_ALLOWED=true
SYS01_TENANT_OPERATOR_ALLOWED=true
SYS01_CONSULTANT_ALLOWED=false
SYS01_CUSTOMER_SERVICE_ALLOWED=false

SYS01_LOW_SENSITIVE_DTO_SAFE=true
SYS01_DATA_READINESS=unavailable
SYS01_HISTORICAL_COVERAGE_COMPLETE=false
SYS01_PARTIAL_COVERAGE_SAFE=false
SYS01_STATIC_TENANT_ISOLATION_SAFE=true
SYS01_STATIC_INSTITUTION_ISOLATION_SAFE=true
SYS01_TENANT_ISOLATION_SAFE=unverified
SYS01_INSTITUTION_ISOLATION_SAFE=unverified

SYS01_SCHEMA_CHANGE_REQUIRED=false
SYS01_MIGRATION_REQUIRED=false
SYS01_DML_BACKFILL_REQUIRED=false

SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_EXACT_RUNTIME_FILE_COUNT=0
SYS01_EXACT_RUNTIME_EXISTING_FILE_COUNT=0
SYS01_EXACT_RUNTIME_NEW_FILE_COUNT=0
SYS01_EXACT_PRODUCTION_FILE_COUNT=0
SYS01_EXACT_TEST_FILE_COUNT=0
SYS01_EXACT_RUNTIME_ALLOWLIST=not_frozen

PRIMARY_BLOCKING_PREREQUISITE=local_development_postgresql_127_0_0_1_55433_available_for_transaction_read_only_SYS01_cohort_audit
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_AI_USAGE_READONLY_LOCAL_DEVELOPMENT_DB_READINESS_REAUDIT
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

S20 已完成代码、Git history、架构、测试与本地数据库连接门禁审计。当前唯一 blocker 不是需要新 Schema、Migration 或 DML，而是项目实际 `.env.local` 指向的 local-development PostgreSQL 当前没有监听，Docker daemon 也未运行。任何 SQL 执行前连接即以 `ECONNREFUSED` 结束，因此无法对实际 cohort、历史覆盖、未知 policy 值或 pair integrity 作出可信结论。

## 2. Ownership 决策

| 责任 | 正式 Owner | Fresh 证据 |
|---|---|---|
| `ai_call_usage_records` 业务事实 | `analytics` | canonical command 与写 Repository 已位于 `src/modules/analytics/**`；legacy `createUsageRecord` 已 fail-closed 禁用 |
| 写入 command | `analytics` | `ai-call-usage-command-service.ts` 定义 tenant / institution 双形状 scope，并校验 status、metering 与 service attribution |
| 写入 Repository | `analytics` | `ai-call-usage-command-repository.ts` 是当前唯一 canonical insert owner |
| Institution read model | `institution-system` | metrics domain、snapshot、time-window、service-key 与 terminal-status policy 全部由 `institution-system` 拥有 |
| System presentation | `institution-system` | `page_system_ai_usage` 与 `/hospital/system/ai-usage` 属于 System；不拥有 Analytics 底层事实 |
| 正式 composition | `src/server/orchestration/**` | 需要组合 formal role/scope、Analytics owner-specific read source、System authoritative Reader 与数据库客户端 |

旧 `src/modules/institution/server/institution-ai-call-usage-repository.ts` 当前同时包含 provider config、兼容读面与 platform summary；虽然它的 metrics 查询静态上按 tenant + institution + half-open window 绑定，仍不应成为新的正式 System ownership。S20 不搬迁旧文件，也不修改旧调用者；后续 Runtime 应由 Analytics 提供最小 owner-specific read source，再由 orchestration 注入 System Reader。

```text
LEGACY_AI_USAGE_REPOSITORY_CURRENTLY_USED_BY_SYS01=false
LEGACY_AI_USAGE_REPOSITORY_FORMAL_OWNER_SAFE=false
LEGACY_AI_USAGE_REPOSITORY_MIGRATION_REQUIRED_NOW=false
```

## 3. Authoritative Reader

正式 Reader 复用：

`src/modules/institution-system/server/institution-ai-usage-metrics-reader.ts`

它具备以下安全语义：

- 输入只接受 exact plain `{ scope, timeWindow }`，scope 必须同时包含非空 `tenantId` 与 `institutionId`；
- source query 参数固定为 tenant、institution 与 `[startInclusive, endExclusive)`；
- source 返回任意 cross-pair row 时整体 `scope_mismatch`，不返回部分结果；
- source 最多接受 10,000 行，10,001 sentinel 整体 fail-closed；
- service category/action 必须映射至 owner policy 的稳定 `serviceKey`；未知 tuple 整体 `invalid_service_key`；
- 六个 owner terminal status 被分类为 success/failure/rejection，其他 status 只记为 incomplete；
- 时间戳非法或越界时整体 fail-closed；
- 输出经过 immutable exact-shape snapshot，不透传底层 row。

现有 source projection 没有提供 `aiCreditsConsumed`，因此 `serviceUnits` 会稳定为 `null`，不会把 credits、cost 或 billing-like 数字误报为可靠指标。

```text
SYS01_READER_DATA_COMPLETENESS_SEMANTICS=
exact tenant/institution pair
+ half-open time window
+ owner service-key policy
+ owner terminal-status policy
+ max 10000 records
+ no partial success after malformed/unknown row
```

## 4. API、Page 与 Capability

当前 `/api/institution/ai-service-usage` 是固定 410 的 capability-off Route，只复用 System Section Guard，不读取数据库、legacy service 或 hostile request 输入。它不是正式 SYS-01 Reader。

根据当前 API governance，新实现默认进入 `src/app/api/v1/institution/**`，因此 canonical API 固定为：

```text
SYS01_CANONICAL_API=/api/v1/institution/ai-service-usage
SYS01_LEGACY_API_ROLE=capability_off_compatibility_only
SYS01_COMPATIBILITY_ROUTE_REQUIRED=false
```

首切片不需要把旧 Route 改为转发；新 dedicated page 应直接消费 v1 API 或 server-side formal reader。旧 Route 可继续保持 fail-closed 410，兼容退出另行治理。

Capability 与页面事实来自 current registry/routes/Authority：

```text
SYS01_CAPABILITY_KEY=page_system_ai_usage
SYS01_CANONICAL_ROUTE=/hospital/system/ai-usage
SYS01_SECTION_ID=system
SYS01_CURRENT_CAPABILITY_STATE=hidden/not_released
SYS01_CURRENT_PAGE_STATE=shared_catch_all_capability_off
SYS01_DEDICATED_ROUTE_EXISTS=false
SYS01_PAGE_RELEASE_REQUIRED_FOR_FIRST_SLICE=true
```

## 5. 角色策略

System navigation 与 Section Guard 当前允许 `tenant_admin`、`tenant_operator`，但它们不能单独证明数据授权。SYS-01 仍需 owner-specific read authorization；不能借用 Audit 的 admin-only owner，也不能新增 generic role framework。

Fresh 比较结果：

| 方案 | 结论 | 依据 |
|---|---|---|
| `tenant_admin_only` | 不选 | 适用于 Audit 的 actor/resource 明细；SYS-01 冻结 DTO 不含 Audit 明细、账单或 provider 技术信息 |
| `tenant_admin + tenant_operator` | 选择 | 两者均为 current System management audience；低敏指标只表达机构运营用量、失败/拒绝/未完成与稳定业务 service key |

任何 quota、billing、credits purchase、provider/model configuration 或原始调用详情均不属于 SYS-01 DTO；若未来加入，必须重新准入角色策略。

## 6. 低敏 DTO

```text
SYS01_LOW_SENSITIVE_DTO_SAFE=true
SYS01_DTO_FIELDS=
totalCallCount
serviceUnits(nullable)
failureCount
rejectionCount
incompleteCount
successRate{numerator,denominator,value}
byServiceKey[]{serviceKey,totalCallCount,serviceUnits,failureCount,rejectionCount,incompleteCount,successRate}

SYS01_FORBIDDEN_OUTPUT_FIELDS=
tenantId
institutionId
actorUserId
raw account identifier
provider/model
provider secret/API key/credential
prompt/completion/request/response
token detail
latency/error detail/internal error/stack/SQL
raw provenance/metadata/meteringDetails
cost/price/bill/quota/remaining credits
```

现有 legacy client/Shell 展示 trend、serviceName 与 fixture quota，因此不能作为新 System formal DTO 的 authority。后续 Runtime 必须围绕 `institution-system` 的 metrics contract 建立新的最小 presentation，不得直接透传旧 response 或底层数据库 row。

## 7. Local-development DB 只读门禁

### 7.1 Source shape

从 current code/schema 冻结的只读审计面如下；`tenants` 与 `institution_scopes` 只用于 aggregate integrity 检查，不进入 SYS-01 输出：

```text
SOURCE_TABLES=ai_call_usage_records,tenants,institution_scopes
SOURCE_COLUMNS_USED_BY_READER=tenant_id,institution_id,status,service_category,service_action,created_at
JOIN_KEYS=ai_call_usage_records.tenant_id->tenants.id;ai_call_usage_records.(tenant_id,institution_id)->institution_scopes.(tenant_id,institution_id)
TENANT_SCOPE_COLUMNS=ai_call_usage_records.tenant_id
INSTITUTION_SCOPE_COLUMNS=ai_call_usage_records.institution_id
SERVICE_KEY_COLUMNS=ai_call_usage_records.service_category,ai_call_usage_records.service_action
STATUS_COLUMNS=ai_call_usage_records.status
METRIC_COLUMNS=none_in_current_reader_projection
READINESS_ONLY_NUMERIC_COLUMN=ai_call_usage_records.ai_credits_consumed
TIME_COLUMNS=ai_call_usage_records.created_at
```

Current Reader 的业务 metrics 来自 row count 与 status classification；`ai_credits_consumed` 不在 source projection 内，也不进入低敏 DTO。readiness audit 原计划仅 aggregate 检查其 null/negative/invalid 形状，不输出逐行 credits 或把它冒充 `serviceUnits`。

### 7.2 非敏感目标

```text
DATABASE_CONNECTION_ATTEMPTED=true
DATABASE_CONNECTION=false
DATABASE_CONNECTION_SCOPE=local_loopback_development_only
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55433
DATABASE_NAME=zmtg_clean_local_dev
DATABASE_HOST_LOOPBACK=true
DATABASE_TRANSACTION_READ_ONLY=not_started_connection_refused
DATABASE_WRITE_EXECUTION=false
DATABASE_QUERY_EXECUTED=false
```

连接程序在创建 client 前重新校验 loopback，并准备了：

- startup `default_transaction_read_only=on`；
- `BEGIN READ ONLY`；
- 首条 `SELECT current_setting('transaction_read_only')` 必须返回 `on`；
- metadata/aggregate SELECT；
- 最终 sentinel `ROLLBACK`。

实际连接在 transaction 和任何 SQL 之前返回 `ECONNREFUSED 127.0.0.1:55433`。`lsof` 无 55433 listener，Docker client 也无法连接当前 Colima daemon。S20 未获授权启动 Docker/PostgreSQL、执行 Migration 或 Seed，因此停止环境操作。

### 7.3 Cohort 结果

```text
AI_USAGE_TOTAL_ROW_COUNT=unavailable
ATTRIBUTED_ROW_COUNT=unavailable
UNATTRIBUTED_ROW_COUNT=unavailable
DISTINCT_TENANT_COUNT=unavailable
DISTINCT_INSTITUTION_COUNT=unavailable
NULL_TENANT_SCOPE_ROW_COUNT=unavailable
NULL_INSTITUTION_SCOPE_ROW_COUNT=unavailable
ORPHAN_TENANT_ROW_COUNT=unavailable
ORPHAN_INSTITUTION_ROW_COUNT=unavailable
RECOGNIZED_SERVICE_KEY_ROW_COUNT=unavailable
UNKNOWN_SERVICE_KEY_ROW_COUNT=unavailable
RECOGNIZED_TERMINAL_STATUS_ROW_COUNT=unavailable
UNKNOWN_STATUS_ROW_COUNT=unavailable
NON_TERMINAL_ROW_COUNT=unavailable
METRIC_NULL_ROW_COUNT=unavailable
METRIC_NEGATIVE_ROW_COUNT=unavailable
METRIC_INVALID_ROW_COUNT=unavailable
PROJECT_ATTRIBUTED_ROW_COUNT=unavailable
PROJECT_UNATTRIBUTED_ROW_COUNT=unavailable
SERVICE_ATTRIBUTED_ROW_COUNT=unavailable
SERVICE_UNATTRIBUTED_ROW_COUNT=unavailable
EARLIEST_USAGE_AT=unavailable
LATEST_USAGE_AT=unavailable
```

仓库 schema 定义已经包含 tenant、nullable institution、status、credits、service attribution 与 created-at 列，以及 tenant 与 tenant/institution/time indexes；但 schema source 不能替代当前 local-development DB 的实际 table/column/cohort 证据。

## 8. Data readiness 与 Runtime Admission

```text
SYS01_DATA_READINESS=unavailable
SYS01_HISTORICAL_COVERAGE_COMPLETE=false
SYS01_PARTIAL_COVERAGE_SAFE=false
SYS01_STATIC_TENANT_ISOLATION_SAFE=true
SYS01_STATIC_INSTITUTION_ISOLATION_SAFE=true
SYS01_TENANT_ISOLATION_SAFE=unverified
SYS01_INSTITUTION_ISOLATION_SAFE=unverified
```

静态 query 与 Reader 都要求 exact tenant/institution pair，且不使用 current membership、default institution、single-institution assumption 或 demo identity 推导记录归属。但实际数据库中的 null pair、orphan pair、unknown service tuple、unknown terminal status、metric validity 与历史时间范围完全不可见，因此不能把静态安全等同于 Runtime admission ready。

当前 code schema 已能表达下一只读 slice，设计上不需要新增 Schema、Migration 或 DML；不可用数据库是 evidence prerequisite，不是写回授权。

```text
SYS01_SCHEMA_CHANGE_REQUIRED=false
SYS01_MIGRATION_REQUIRED=false
SYS01_DML_BACKFILL_REQUIRED=false
SYS01_RUNTIME_ADMISSION_READY=false
SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
```

## 9. 验证

```text
TARGETED_TEST_FILES=17
TARGETED_TESTS=486/486 passed
TEST_SKIPPED_DUE_TO_DB_WRITE_BOUNDARY=none
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
```

Targeted 覆盖 authoritative Reader、service-key/status/time-window/metrics/snapshot、legacy Repository 兼容读面、legacy API capability-off、legacy service/client/Shell、Capability Registry/Authority、RouteShell、Workbench、Scope Guard、Section Guard 与 Formal Session。所有测试均为 static/unit/mock，没有 reset、seed、truncate 或数据库写入。

## 10. 唯一 prerequisite 与边界

```text
PRIMARY_BLOCKING_PREREQUISITE=local_development_postgresql_127_0_0_1_55433_available_for_transaction_read_only_SYS01_cohort_audit

NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_AI_USAGE_READONLY_LOCAL_DEVELOPMENT_DB_READINESS_REAUDIT
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
RELEASED_GOVERNED_PAGES=page_workbench,page_system_audit
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
SYS01_RUNTIME_IMPLEMENTED=false

SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
SEED_EXECUTION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本报告不授权启动数据库、Runtime implementation 或下一任务。只有获得新的明确授权且 local-development PostgreSQL 已可用后，才能重跑 readiness audit；在实际 counts、coverage 与 pair integrity 明确前不得冻结 Runtime allowlist。

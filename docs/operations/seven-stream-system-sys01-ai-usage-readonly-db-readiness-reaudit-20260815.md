# SYS-01 AI 使用只读 local-development DB readiness 复审

> 日期：2026-08-15
> 基线：`d8293ee64c1d051b123d022a6764b0c191084ca1`
> 阶段：S21
> 业务线：`system`
> 切片：`SYS_01_AI_USAGE_READONLY`
> 性质：docs-only readiness re-audit；不授权 Runtime、数据库写入、Schema、Migration、DDL、DML、Seed、Staging 或 Production

## 1. 最终结论

```text
STAGE=S21
STREAM=system
SLICE=SYS_01_AI_USAGE_READONLY
TASK=SEVEN_STREAM_SYSTEM_SYS_01_AI_USAGE_READONLY_LOCAL_DEVELOPMENT_DB_READINESS_REAUDIT
COMPLETION_MODE=READINESS_REAUDIT_COMPLETE_BLOCKED
BASELINE=d8293ee64c1d051b123d022a6764b0c191084ca1

SYS01_DATA_READINESS=blocked
SYS01_HISTORICAL_COVERAGE_COMPLETE=false
SYS01_PARTIAL_COVERAGE_SAFE=false
SYS01_TENANT_ISOLATION_SAFE=true
SYS01_INSTITUTION_ISOLATION_SAFE=false

SYS01_SCHEMA_CHANGE_REQUIRED=false
SYS01_MIGRATION_REQUIRED=true
SYS01_DML_BACKFILL_REQUIRED=false
SYS01_RUNTIME_ADMISSION_READY=false

SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_EXACT_RUNTIME_FILE_COUNT=0
SYS01_EXACT_RUNTIME_EXISTING_FILE_COUNT=0
SYS01_EXACT_RUNTIME_NEW_FILE_COUNT=0
SYS01_EXACT_PRODUCTION_FILE_COUNT=0
SYS01_EXACT_TEST_FILE_COUNT=0
SYS01_EXACT_RUNTIME_ALLOWLIST=not_frozen

PRIMARY_BLOCKING_PREREQUISITE=local_development_schema_parity_missing_public_institution_scopes_requires_separately_authorized_migration_admission
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_SCHEMA_PARITY_MIGRATION_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

S21 已解除 S20 的环境不可用 blocker：既有 Colima profile 与既有 PostgreSQL container 安全启动，loopback 数据库可连接，所有 SQL 均在 startup read-only + `BEGIN TRANSACTION READ ONLY` 内执行并以 `ROLLBACK` 结束。实际数据库没有 `public.institution_scopes`，与 current code schema 不一致，无法完成 formal tenant/institution pair authority 验证；因此 readiness 从 `unavailable` 精确推进为 `blocked`，但不能进入 Runtime Admission。

## 2. Local runtime 与 PostgreSQL 启动证据

```text
LOCAL_RUNTIME_TYPE=colima/docker
LOCAL_RUNTIME_PROFILE=default
LOCAL_RUNTIME_PROFILE_EXISTED=true
LOCAL_RUNTIME_WAS_RUNNING_BEFORE=false
LOCAL_RUNTIME_START_EXECUTED=true

LOCAL_POSTGRES_SERVICE=zmtg-local-dev-pg
LOCAL_POSTGRES_EXISTED=true
LOCAL_POSTGRES_PREVIOUSLY_STARTED=true
LOCAL_POSTGRES_WAS_RUNNING_BEFORE=false
LOCAL_POSTGRES_START_EXECUTED=true
LOCAL_POSTGRES_LEFT_RUNNING=true

DATABASE_HOST=127.0.0.1
DATABASE_HOST_LOOPBACK=true
DATABASE_PORT=55433
DATABASE_NAME=zmtg_clean_local_dev
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false
DATABASE_TRANSACTION_END=ROLLBACK
```

启动前 `default` profile 已存在且为 Stopped；没有新建 profile/VM。目标 container 创建于既有历史，`StartedAt` 证明它此前真实运行过，标签为 `com.zmtg.local-dev=true`，端口固定映射 `127.0.0.1:55433 -> 5432`，并复用既有 `zmtg-local-dev-pg-data` volume。S21 只执行 `colima start --profile default` 与 `docker start zmtg-local-dev-pg`，没有 `docker run`、Compose create/up、pull、build、volume create、数据库初始化、Migration 或 Seed。

## 3. Read-only transaction 证据

连接前只输出 host、port 与 database name；没有输出完整 URL、username、password 或 secret。客户端 startup message 注入：

```text
default_transaction_read_only=on
statement_timeout=15000
lock_timeout=2000
```

每次 SQL 序列均为：

```text
BEGIN TRANSACTION READ ONLY
SELECT current_setting('transaction_read_only')  -> on
SELECT information_schema / pg_catalog metadata 或 aggregate-only cohort
ROLLBACK
```

没有执行 `SET`、COMMIT、row dump、SELECT `*`、locking SELECT、DDL、DML、COPY、CALL、DO、VACUUM、ANALYZE、sequence mutation 或 user-defined function。两次 Postgres.js `reserve()` startup 诊断在任何 SQL 前卡住，均由本轮终止客户端进程并让连接自动回滚；最终审计改用 `max=1` 单连接串行查询，全部成功显式 ROLLBACK。该诊断不改变数据库内容。

## 4. Actual schema

### 4.1 实际表

```text
ACTUAL_SOURCE_TABLES=public.ai_call_usage_records,public.tenants
MISSING_REQUIRED_SOURCE_TABLES=public.institution_scopes
SCHEMA_MATCHES_CURRENT_CODE=false
```

### 4.2 `ai_call_usage_records` 实际列

```text
ACTUAL_SOURCE_COLUMNS=
id
tenant_id
institution_id
actor_user_id
provider
model
prompt_tokens
completion_tokens
total_tokens
latency_ms
status
error_code
created_at
metadata
ai_credits_consumed
metering_status
metering_version
metering_details
service_category
service_name
service_source
service_action
service_version
```

Reader 必需的 `tenant_id`、`institution_id`、`status`、`service_category`、`service_action`、`created_at` 与 readiness-only `ai_credits_consumed` 均存在；`tenant_id` 非空，`institution_id` 可空。actual indexes 包含 primary key、tenant/time、tenant/institution/time 与 tenant/id unique。

Current code 的 `src/server/db/schema.ts` 与既有 `drizzle/0038_mig_01a1_institution_isolation_expand.sql` 均定义 `institution_scopes`，但本地 actual schema 没有该表。S21 不把代码 Schema 重新定义为新 change，也不猜应直接运行哪个 migration chain：

```text
SYS01_SCHEMA_CHANGE_REQUIRED=false
SYS01_MIGRATION_REQUIRED=true
SYS01_DML_BACKFILL_REQUIRED=false
```

任何 migration execution、顺序、precheck、rollback 或 scope provisioning 必须进入独立授权；S21 未执行。

## 5. Production writer inventory

```text
PRODUCTION_AI_USAGE_WRITER_COUNT=1
PRODUCTION_AI_USAGE_ATTRIBUTED_WRITER_COUNT=1
PRODUCTION_AI_USAGE_LEGACY_WRITER_COUNT=0
PRODUCTION_AI_USAGE_UNSCOPED_WRITER_COUNT=0
PRODUCTION_AI_USAGE_REACHABLE_CALLER_COUNT=0
```

唯一 physical INSERT 位于 Analytics owner 的 `createAiCallUsageCommandRepository().append()`，其上游 command 强制 discriminated `tenant | institution` scope；这里的 attributed writer 表示每次写入都显式选择 tenant-only 或 tenant+institution scope，不表示所有合法 tenant-only row 都有 institution。Legacy `createUsageRecord()` 已固定抛出 `legacy_institution_ai_call_usage_writer_disabled`，没有第二个 INSERT；current-main 也没有找到 canonical command/repository 的 production composition caller。S21 不修改 writer 或 caller。

## 6. Aggregate-only cohort

```text
TENANT_ROW_COUNT=6
AI_USAGE_TOTAL_ROW_COUNT=0

FULLY_ATTRIBUTED_ROW_COUNT=0
UNATTRIBUTED_ROW_COUNT=0
NULL_TENANT_SCOPE_ROW_COUNT=0
NULL_INSTITUTION_SCOPE_ROW_COUNT=0
DISTINCT_TENANT_COUNT=0
DISTINCT_INSTITUTION_COUNT=0
ORPHAN_TENANT_ROW_COUNT=0
ORPHAN_INSTITUTION_PAIR_ROW_COUNT=unavailable_missing_institution_scopes

RECOGNIZED_SERVICE_TUPLE_ROW_COUNT=0
UNKNOWN_SERVICE_TUPLE_ROW_COUNT=0
FULLY_ATTRIBUTED_UNKNOWN_SERVICE_TUPLE_ROW_COUNT=0

RECOGNIZED_TERMINAL_STATUS_ROW_COUNT=0
NON_TERMINAL_STATUS_ROW_COUNT=0
INVALID_STATUS_ROW_COUNT=0

METRIC_NULL_ROW_COUNT=0
METRIC_NEGATIVE_ROW_COUNT=0
METRIC_INVALID_ROW_COUNT=0

PROJECT_ATTRIBUTED_ROW_COUNT=0
PROJECT_UNATTRIBUTED_ROW_COUNT=0
SERVICE_ATTRIBUTED_ROW_COUNT=0
SERVICE_UNATTRIBUTED_ROW_COUNT=0

EARLIEST_USAGE_AT=null
LATEST_USAGE_AT=null
```

Project attribution 按 `service_category + service_name` 完整性计数；service attribution 按 `service_source + service_action` 完整性计数。Metric null 以 readiness-only `ai_credits_consumed` 为基准，negative 覆盖 credits/tokens/latency，invalid 覆盖三类 token 都存在但 total 不等于 prompt + completion。实际 cohort 为 0，因此这些分类均为 0；这不能弥补缺失的 formal institution-scope authority table。

## 7. Service 与 status policy

Recognized service tuple 只来自 current owner policy：

| `service_category` | `service_action` | stable service key |
|---|---|---|
| `ai_qa` | `direct_answer` | `conversation_ai` |
| `ai_qa` | `quota_rejected` | `conversation_ai` |
| `knowledge_base_qa` | `rag_answer` | `knowledge_qa` |

Recognized terminal status 只来自 current owner policy：`succeeded`、`failed`、`rate_limited`、`provider_unavailable`、`rejected`、`sensitive_input_rejected`。其他稳定 status 会被 Reader 计为 `incomplete`；空白、非稳定或不可表示 status 单列为 invalid。当前 cohort 没有 unknown/non-terminal/invalid row，但 S21 没有用空表推导 Runtime ready。

## 8. Pair isolation 与历史覆盖

Static Reader 继续使用 exact tenant + institution + half-open window，不读取 default institution，不用 current membership、single-institution assumption 或 demo identity 推断历史归属。实际 AI usage 表的 tenant FK shape 与 0 orphan tenant row 支持：

```text
SYS01_TENANT_ISOLATION_SAFE=true
```

但 actual DB 缺失 `institution_scopes`，无法把任何未来 `tenant_id + institution_id` 与 formal pair authority 做当前数据库级 corroboration。虽然当前 AI usage cohort 为空且没有直接反例，不能用 vacuous zero 宣称 institution isolation 或 historical coverage complete：

```text
SYS01_INSTITUTION_ISOLATION_SAFE=false
SYS01_HISTORICAL_COVERAGE_COMPLETE=false
SYS01_PARTIAL_COVERAGE_SAFE=false
SYS01_DATA_READINESS=blocked
```

## 9. Reader limit 与 canonical window

```text
SYS01_READER_MAX_ROWS=10000
MAX_ROWS_PER_PAIR_CALENDAR_MONTH=0
MAX_ROWS_PER_PAIR_ALL_TIME=0
SYS01_CANONICAL_TIME_WINDOW_STRATEGY=server_owned_fixed_presets_today_last7days_currentMonth_lastMonth_max31day_half_open_no_custom
SYS01_READER_LIMIT_SAFE=true
```

Formal v1 API/page 只允许 server-owned today、last7days、currentMonth、lastMonth，最大 calendar window 为 31 天并转换为半开区间；不接纳 legacy arbitrary custom range。Repository 保留 `limit 10001` sentinel，Reader 对超过 10,000 行整体 fail closed。当前 0-row cohort 不是未来规模保证，limit-safe 结论来自 bounded strategy + overflow fail-closed，而不是来自当前总数小于 10,000。

## 10. Runtime Admission

S21 已满足 environment/connection/read-only SELECT，但不满足 actual schema parity 与 institution isolation：

```text
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_QUERY_EXECUTED=true
DATABASE_WRITE_EXECUTION=false

SYS01_DATA_READINESS=blocked
SYS01_TENANT_ISOLATION_SAFE=true
SYS01_INSTITUTION_ISOLATION_SAFE=false
SYS01_READER_LIMIT_SAFE=true

SYS01_SCHEMA_CHANGE_REQUIRED=false
SYS01_MIGRATION_REQUIRED=true
SYS01_DML_BACKFILL_REQUIRED=false

SYS01_RUNTIME_ADMISSION_READY=false
SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_EXACT_RUNTIME_FILE_COUNT=0
SYS01_EXACT_RUNTIME_ALLOWLIST=not_frozen
```

不得为推进 SYS-01 而忽略 missing table、使用 current membership 代替 formal scope，或把 0-row cohort 改写为 complete/partial-safe。

## 11. Validation

```text
TARGETED_TEST_FILES=11
TARGETED_TESTS=331/331 passed
TEST_SKIPPED_DUE_TO_DB_WRITE_BOUNDARY=none
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
```

Targeted 覆盖 authoritative Reader、service-key/status policy、legacy capability-off API、Capability Registry/Authority、RouteShell/System navigation、Scope Guard、Section Guard 与 Formal Session。没有运行会 reset、seed、truncate 或写数据库的 test；S20 已验证且 source 未改变，因此没有机械重跑 486-test 集合。

## 12. 唯一 prerequisite 与边界

```text
PRIMARY_BLOCKING_PREREQUISITE=local_development_schema_parity_missing_public_institution_scopes_requires_separately_authorized_migration_admission
NEXT_STAGE=UNASSIGNED
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_SCHEMA_PARITY_MIGRATION_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
RELEASED_GOVERNED_PAGES=page_workbench,page_system_audit
PAGE_SYSTEM_AI_USAGE=hidden/not_released
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
SYS01_RUNTIME_IMPLEMENTED=false

DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
SEED_EXECUTION=false
RUNTIME_IMPLEMENTATION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本报告不授权下一 prerequisite、Migration 或 Runtime。本阶段仅允许创建 docs-only Draft PR；Ready、Merge 与 post-merge closure 均未授权。

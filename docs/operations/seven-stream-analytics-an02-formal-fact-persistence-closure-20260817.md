# Analytics AN-02 Formal Fact Persistence Closure

- 日期：2026-08-17
- 基线：`f5923f2cd579583231df7e1a23bf992140b5ffea`
- Schema Head：`59e2e5c1781857e23ec803ad011e56cf741d7f93`
- 任务：`ANALYTICS_AN02_FORMAL_FACT_PERSISTENCE_SCHEMA_MIGRATION_CLOSURE`
- Migration：`0048_analytics_formal_fact_persistence`
- candidate：`127.0.0.1:55434/zmtg_clean_local_dev_candidate`

## 正式持久化模型

```text
analytics_formal_sources
→ analytics_formal_ingestion_batches
→ analytics_consumption_facts
→ deterministic institution-analytics domain
```

正式 provenance 仅允许 `approved_import_manifest` 与
`approved_integration_registration`，禁止 `mock|seed|demo`。

source、batch、fact 均绑定 exact tenant + institution；fact 覆盖
source revision/correction chain、payment/refund event、eventAt/receivedAt、
amount minor、currency、stable consumption ref、customer/project attribution、
refund link 与记录人。三个正式表均为 immutable append-only。

## Local candidate migration

```text
MIGRATION_TAG=0048_analytics_formal_fact_persistence
PREDECESSOR_WHEN=1786886640000
MIGRATION_WHEN=1786900800000

LOCAL_CANDIDATE_MIGRATION=PASS
MIGRATION_EXECUTION=true
DDL_EXECUTION=true
BUSINESS_DML_EXECUTION=false
MIGRATION_JOURNAL_WRITE=true
ORIGINAL_55433_DATABASE_WRITE=false
```

## Post-migration

```text
POST_DATABASE_TRANSACTION_READ_ONLY=on
POST_MIGRATION_LATEST_WHEN=1786900800000

POST_TARGET_ACTIVE_FORMAL_SCOPE_COUNT=1
POST_TARGET_ACTIVE_BINDING_COUNT=1
POST_TARGET_OPERATING_CONTEXT_COUNT=1

ANALYTICS_FORMAL_SOURCE_COUNT=0
ANALYTICS_FORMAL_BATCH_COUNT=0
ANALYTICS_FORMAL_FACT_COUNT=0

ANALYTICS_FORMAL_ENUM_COUNT=6
ANALYTICS_IMMUTABLE_TRIGGER_COUNT=3
ANALYTICS_EXACT_PAIR_FK_COUNT=4
```

0 行是可信正式空 cohort；没有 Seed、Backfill 或平台商业记录复制。

## Runtime state

```text
ANALYTICS_FORMAL_FACT_MODEL=ready
ANALYTICS_FORMAL_PROVENANCE=ready
ANALYTICS_IMMUTABLE_FACT_MODEL=ready
ANALYTICS_DATA_READINESS=ready_empty

ANALYTICS_FORMAL_SCOPE_READY=true
ANALYTICS_OPERATING_CONTEXT_READY=true

ANALYTICS_ACTION_POLICY_READY=false
ANALYTICS_FORMAL_READER_EXISTS=false
ANALYTICS_FORMAL_API_EXISTS=false
ANALYTICS_FORMAL_PAGE_EXISTS=false
ANALYTICS_RUNTIME_IMPLEMENTATION=false
ANALYTICS_PAGE_RELEASE=false
```

下一完整目标：`ANALYTICS_OVERVIEW_FORMAL_RUNTIME_RELEASE`。

## 边界

```text
SCHEMA_CHANGE=true
MIGRATION_EXECUTION=true
DDL_EXECUTION=true
BUSINESS_DML_EXECUTION=false
DATA_SEED=false
DATA_BACKFILL=false
EXTERNAL_SYSTEM=false
AI_REPORT=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

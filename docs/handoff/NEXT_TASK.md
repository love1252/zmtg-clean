# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C Audit Writer institution attribution prerequisite fresh audit + exact Runtime admission
AUDIT_WRITER_ATTRIBUTION_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

## 继承状态

```text
POST_V2_R1C_PAGE_SYSTEM_AUDIT_RELEASE_REAUDIT=passed
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false

AUDIT_READER_SUCCESS_PATH_EXISTS=true
AUDIT_READER_READINESS=ready
AUDIT_DATA_READINESS=false

PAGE_SYSTEM_AUDIT_DATA_RELEASE_REQUIREMENT=canonical Writer emits verified institution attribution and Reader can prove an authoritative institution-scoped result or authoritative empty set
PAGE_SYSTEM_AUDIT_DATA_BLOCKER=canonical Writer omits institutionId and institutionAttribution so zero visible rows cannot distinguish no events from unattributed events

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false

WORKBENCH_MULTI_CAPABILITY_SAFE=false

CANONICAL_ROUTE=/hospital/system/audit
ROUTE_STRATEGY=dedicated_static_route_after_data_prerequisite
SHELL_READONLY_SAFE=true
AUTHORIZATION_SAFE=true
LOW_SENSITIVE_OUTPUT_SAFE=true

DATABASE_ENVIRONMENT=local_development
DATABASE_READONLY_CONNECTION=passed
AUDIT_TOTAL_ROW_COUNT=275
AUDIT_INSTITUTION_ID_PRESENT_ROW_COUNT=0
VERIFIED_ATTRIBUTED_ROW_COUNT=0
NULL_ATTRIBUTION_ROW_COUNT=275
DATABASE_WRITE_EXECUTION=false

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

BLOCKING_PREREQUISITE_COUNT=1
PRIMARY_BLOCKING_PREREQUISITE=Audit Writer institution attribution closure
BLOCKING_OWNER=src/modules/audit

PAGE_WORKBENCH_STATE=read_only/pilot_released
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25

PRODUCTION_READY_INFERRED=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

## Fresh audit 必须回答

1. 哪个 Audit Owner boundary 是 canonical Writer attribution 的唯一修改点；
2. formal `institutionId` 应从哪个已存在的可信服务端上下文进入 Writer；
3. 所有直接与事务型 Audit Writer 调用方如何保持 tenant / institution 一致性；
4. `not_applicable`、`verified`、`legacy_unattributed` 的写入规则与 fail-closed 语义；
5. Writer attribution 是否可以在不修改 Schema / Migration 的前提下闭环；
6. 是否需要单独的历史 backfill prerequisite，或通过明确时间边界治理历史不完整；
7. 精确 production / test Runtime allowlist 及 owner 边界；
8. 是否需要 Architecture exception；如需要则停止，不得修改 rules。

## 停止边界

- 本 Handoff 只授权 Writer attribution prerequisite 的 fresh audit + exact Runtime admission，不授权 Writer Runtime implementation；
- 不得实施 `page_system_audit` Runtime；
- 不得执行历史 backfill、数据库写入、Schema、Migration、DDL、DML 或 Seed；
- 不得修改 Platform Audit、第二个 capability、Architecture exception 或 AQ004；
- 不得连接 Staging / Production；
- 如果 Writer 闭环需要跨 owner 大范围重构或 generic framework，必须停止并记录 blocker；
- Writer attribution 完成后仍必须重新审计 data readiness、historical backfill 与 Workbench multi-capability，不能直接放行页面。

# POST-V2-R1C 机构范围 Audit Reader Runtime 独立验证

> 日期：2026-08-13
>
> Runtime PR：#1169
>
> Runtime Head：`c927fdfc9a37a865d3df2082ec350b7e01806c45`
>
> Runtime Merge：`2a45b74999784bdcf1a4777c9017ba15d2cef546`
>
> 类型：合并后独立验证 / 仅文档

## 1. 结论

```text
POST_V2_R1C_AUDIT_READER_RUNTIME=passed
AUDIT_READER_RUNTIME_IMPLEMENTED=true
AUDIT_READER_RUNTIME_VERIFIED=true
AUDIT_READER_RUNTIME_INDEPENDENT_VERIFICATION=passed
AUDIT_READER_RUNTIME_HANDOFF_COMPLETE=true

RUNTIME_EXACT_FILE_COUNT=8
ARCHITECTURE_EXCEPTION_REQUIRED=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25
```

机构范围 Audit Reader Foundation 已按 Admission 的 exact 8-file 闭包完成实现、合并与独立验证。该结论不等于 `page_system_audit` capability release。

## 2. Runtime PR 与精确范围

```text
RUNTIME_PR=1169
RUNTIME_HEAD=c927fdfc9a37a865d3df2082ec350b7e01806c45
RUNTIME_MERGE=2a45b74999784bdcf1a4777c9017ba15d2cef546
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0
RUNTIME_CHANGED_FILE_COUNT=8
RUNTIME_NEW_FILE_COUNT=2
```

Runtime PR 的 8 个文件严格为：

1. `src/modules/audit/domain/audit-event-query.ts`
2. `src/modules/audit/server/audit-event-repository.ts`
3. `src/server/orchestration/institution-audit-reader.ts`（新增）
4. `src/app/api/institution/audit-events/route.ts`
5. `src/modules/audit/tests/AuditEventRepository.test.ts`
6. `src/server/orchestration/institution-audit-reader.test.ts`（新增）
7. `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
8. `src/app/api/institution/audit-events/route.test.ts`

与正式 allowlist 完全一致，没有第 9 个 Runtime/Test 文件。

## 3. Reader 生产调用链

```text
AUDIT_READER_OWNER=src/modules/audit
AUDIT_READER_DATA_SOURCE=PostgreSQL audit_events
AUDIT_READER_AUTHORIZATION_BOUNDARY=system Section Guard + one-shot opaque formal institution context + tenant/institution/verified Repository scope
```

独立核验的调用链为：

```text
existing system Section Guard
-> existing query parser
-> src/server/orchestration/institution-audit-reader.ts
-> existing one-shot opaque formal institution context
-> getDatabase()
-> Audit Owner Repository
-> PostgreSQL audit_events
```

Repository 的 institution 条件为：

```text
tenant_id = formal current tenantId
AND institution_id = formal current institutionId
AND institution_attribution = 'verified'
```

没有 tenant-only、`institution_id IS NULL`、`legacy_unattributed` 或 `not_applicable` fallback。Platform Audit scope 与输出语义未修改。

## 4. HTTP 与低敏边界

- Route 继续由既有 `system` Section Guard 包裹；
- Route 只连接 query parser 与 orchestration Reader，不直接组合 Repository 或数据库；
- 客户端 `tenantId`、`institutionId`、`scope`、`role` 注入均由现有白名单 parser 拒绝；
- 成功响应为 `200 + records + pageInfo + no-store`；
- 非法查询为低敏 400；Reader、正式上下文、数据库或 Repository 不可用时为低敏 503；
- 机构响应不输出 `tenantId`、`institutionId`、`institutionAttribution`、raw session、SQL、stack、连接串或 secret；
- 未恢复 demo access context，也未重新引入 action/object authorization；
- Route 中没有 capability release claim。

## 5. 本地 PostgreSQL 只读验证

```text
DATABASE_CONNECTION_USED=true
DATABASE_CONNECTION_SCOPE=local_development_only
DATABASE_ENVIRONMENT=local_development
DATABASE_SOURCE=repository_local_acceptance_container
DATABASE_ENDPOINT_CLASS=loopback
DATABASE_READONLY_CONNECTION=passed
DATABASE_READONLY_TRANSACTION=on
DATABASE_READONLY_VERIFICATION=passed
DATABASE_WRITE_EXECUTION=false

AUDIT_SCOPE_COLUMN_COUNT=3
VERIFIED_ATTRIBUTED_ROW_COUNT=0
AUDIT_READER_DATA_READINESS=false
```

验证只连接仓库既有、映射到 loopback 的本地验收 PostgreSQL 容器，并在只读事务中读取事务状态、`information_schema` 与 `audit_events` 聚合计数。未打印连接串或凭据，未执行任何数据库写入。当前没有 `verified` 归属行，因此结果允许为空，不能推导 data readiness。

## 6. Runtime 与合并后验证

```text
TARGETED_TEST_FILES=4
TARGETED_TESTS=27
TARGETED_TESTS=passed

FULL_TEST_FILES=491
FULL_TESTS=6611
FULL_TESTS=passed

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
```

Runtime PR 合并后又以 merged `main` 为事实来源重新执行 4 个相关测试文件、typecheck 与增量架构检查；全部通过。完整测试、lint 与 build 使用同一冻结 Runtime Head 已通过的本地与 Required Check 证据。

## 7. 合并后漂移核验

```text
OPEN_PLATFORM_AUDIT_ROUTE_CHANGE=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
ARCHITECTURE_EXCEPTION_CHANGE=false
AQ004_PRESENT=true

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false

PRODUCTION_READY_INFERRED=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

Runtime merge 只包含正式 Admission 的 exact 8 files。`src/app/api/open-platform/audit-events/route.ts`、Schema、`drizzle/**` 与 `architecture-quality-rules.json` 均未漂移，AQ004 仍存在。

## 8. 页面状态与下一任务

```text
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false

NEXT_TASK=POST-V2-R1C page_system_audit readonly release fresh re-audit + exact Runtime admission
```

下一任务只能重新审计 successful Reader path、data readiness、capability authority、Workbench 多能力投影、canonical Route 与精确 Runtime scope；本交接不授权页面 Runtime 实现。

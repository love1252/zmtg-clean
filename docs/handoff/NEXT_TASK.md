# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C Audit Owner institution attribution contract exact 4-file Runtime implementation explicit authorization
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_AUTHORIZED=false
CALLER_MIGRATION_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

## 已完成前置

```text
POST_V2_R1C_AUDIT_WRITER_SCOPE_PORT_RUNTIME=passed
AUDIT_WRITER_SCOPE_PORT_RUNTIME_IMPLEMENTED=true
AUDIT_WRITER_SCOPE_PORT_RUNTIME_VERIFIED=true
AUDIT_WRITER_SCOPE_PORT_INDEPENDENT_VERIFICATION=passed
AUDIT_WRITER_SCOPE_PORT_HANDOFF_COMPLETE=true

FORMAL_SCOPE_SOURCE=formal server-session verified claims corroborated by authoritative Identity + active Membership/Binding + active Tenancy Institution Scope
PORT_OWNER=src/server/orchestration
HANDLE_OWNER=src/server/orchestration/institution-audit-writer-scope.ts
HANDLE_CREATOR=resolveInstitutionAuditWriterFormalScopeV1
HANDLE_CONSUMER=consumeInstitutionAuditWriterFormalScopeV1
CONSUMPTION_COUNT=1

WRITER_SCOPE_PORT_IS_AUTHORIZATION_REPLACEMENT=false
CAPABILITY_COUPLING=false

RUNTIME_EXACT_FILE_COUNT=2
RUNTIME_PR=1176
RUNTIME_HEAD=77f792ae29dfaf983f77d3a246ec925943e4f016
RUNTIME_MERGE=1aea18be710f32d8589a48ae7ca23aaba0c5ecb6
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

## 已完成准入

```text
AUDIT_OWNER_ATTRIBUTION_CONTRACT_FRESH_AUDIT=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_ELIGIBLE=true
ADMISSION_MODE=ADMISSION_READY
EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXACT_RUNTIME_ADMISSION=passed

RECOMMENDED_RUNTIME_DESIGN=方案 B：保留 legacy TenantAuditEvent + record 路径，新增 Audit-owned discriminated attributed contract + recordAttributed 路径
CANONICAL_ATTRIBUTION_CONTRACT_OWNER=src/modules/audit
LEGACY_CALLER_CAN_WRITE_VERIFIED=false
LEGACY_UNATTRIBUTED_NEW_WRITE_ALLOWED=false
AUDIT_CONTRACT_PROVES_FORMAL_SCOPE=false
AUDIT_OWNER_IMPORTS_SCOPE_PORT=false
PLATFORM_NOT_APPLICABLE_CONTRACT_SAFE=true
AUTH_NOT_APPLICABLE_CONTRACT_SAFE=true

EXACT_RUNTIME_FILE_COUNT=4
EXISTING_RUNTIME_FILE_COUNT=4
NEW_RUNTIME_FILE_COUNT=0
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=2

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
```

## Exact Runtime allowlist

只有用户明确授权下一 Runtime 后，才允许修改以下 4 个既有文件：

1. `src/modules/audit/domain/audit-events.ts`；
2. `src/modules/audit/server/audit-event-repository.ts`；
3. `src/modules/audit/tests/AuditEventsDomain.test.ts`；
4. `src/modules/audit/tests/AuditEventRepository.test.ts`。

不允许第 5 个 Runtime/Test 文件、新文件或删除文件。实现必须保留 legacy `TenantAuditEvent + record()` 临时兼容，新增严格 attributed contract、validator、mapper 与 `recordAttributed()`；legacy path 显式映射 `NULL/NULL`，不能产生 `verified`。

## Runtime 验收重点

1. `verified` 必须具有非空 `tenantId + institutionId`，且 base event tenant 完全一致；
2. `not_applicable` 必须 `institutionId=null`，tenant 可为非空 string 或 null；
3. unknown、非法组合与所有新 `legacy_unattributed` 写入 fail-closed，不得 silent fallback；
4. mapper / Repository 必须二次验证，cast / fake 输入不得 insert；
5. Audit contract 不证明 formal scope，Audit module 不反向 import scope port；
6. Repository 不查询业务 Owner、不调用 `getDatabase`、不自行开启 transaction；
7. 现有 19 callers、Reader queries、Platform/Auth authorization 与 transaction rollback semantics 不变。

## 停止边界

- 本 Admission 只建议 exact 4-file Runtime；未获用户当前明确授权前不得实施；
- 不得修改 19 个 production caller、S6 formal scope port 或第 5 个 Runtime/Test 文件；
- 不得实施 caller migration、历史 backfill 或 `page_system_audit` Runtime；
- 不得执行历史 backfill、数据库写入、Schema、Migration、DDL、DML 或 Seed；
- 不得修改 Workbench、Capability Authority、Platform Audit semantics、Architecture exception 或 AQ004～AQ008；
- 不得连接 Staging / Production；
- 不得把 scope port 完成误写成 Audit Writer attribution closure、历史数据就绪或页面放行；
- contract Runtime 合并后仍须对 caller migration 另行 fresh audit + Admission，不得自动启动。

# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C Audit Owner institution attribution contract fresh audit + exact Runtime admission
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

## Fresh audit 与 Admission 范围

下一任务只允许审计并形成精确 Runtime Admission，不实施 Runtime。至少重新核对：

1. `TenantAuditEvent`；
2. `createAuditEvent`；
3. `createDeniedAccessAuditEvent`；
4. `mapAuditEventToInsert`；
5. `AuditEventRepository.record`；
6. `verified / not_applicable / legacy_unattributed` contract shape；
7. Platform / Auth compatibility；
8. exact Runtime / test 文件闭包、Owner、验证与回滚边界。

审计必须回答 institution attribution 字段的 canonical Owner、formal scope handle 的消费边界、Platform / Auth 非机构事件如何保持兼容，以及下一 Runtime 是否能在不迁移 caller 的情况下成为独立原子切片。若无法形成小范围闭包，应输出 blocker / prerequisite，不得扩大为 caller migration。

## 停止边界

- 本 Handoff 只建议 fresh audit + exact Runtime Admission；不构成 Audit Owner attribution contract Runtime 授权；
- 不得修改 `TenantAuditEvent`、factory、mapper、Repository 或现有测试；
- 不得实施 caller migration、历史 backfill 或 `page_system_audit` Runtime；
- 不得执行历史 backfill、数据库写入、Schema、Migration、DDL、DML 或 Seed；
- 不得修改 Workbench、Capability Authority、Platform Audit semantics、Architecture exception 或 AQ004～AQ008；
- 不得连接 Staging / Production；
- 不得把 scope port 完成误写成 Audit Writer attribution closure、历史数据就绪或页面放行；
- caller migration 必须在 Audit Owner contract 合并后另行 fresh audit + Admission，不得随下一原子任务自动启动。

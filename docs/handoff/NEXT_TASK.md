# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C-AUDIT-READER exact 8-file Runtime implementation explicit authorization
AUDIT_READER_RUNTIME_AUTHORIZED=false
```

## 继承状态

```text
POST_V2_R1C_FAILED_RELEASE_ATTEMPT_GOVERNANCE_CLOSED=true
POST_V2_R1C_RELEASE_COMPLETE=false

POST_V2_R1C_AUDIT_READER_FRESH_AUDIT=passed
AUDIT_READER_EXISTING_ARCHITECTURE_IDENTIFIED=true
AUDIT_READER_DATA_SOURCE_IDENTIFIED=true
AUDIT_READER_AUTHORIZATION_BOUNDARY_IDENTIFIED=true
AUDIT_READER_OWNER_IDENTIFIED=true
AUDIT_READER_EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_READER_EXACT_RUNTIME_ADMISSION=passed

RECOMMENDED_RUNTIME_DESIGN=方案 C：src/server/orchestration 组合正式机构授权与 Audit Owner Repository

EXACT_RUNTIME_FILE_COUNT=8
EXISTING_RUNTIME_FILE_COUNT=6
NEW_RUNTIME_FILE_COUNT=2
DELETE_RUNTIME_FILE_COUNT=0
EXACT_TEST_FILE_COUNT=4

ARCHITECTURE_EXCEPTION_REQUIRED=false
DATABASE_CONNECTION_REQUIRED_FOR_RUNTIME=true
DATABASE_CONNECTION_REQUIRED_FOR_ADMISSION=false
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false

PR1163_WORKBENCH_P1_THREAD_RESOLVED=true
PR1163_AUDIT_READER_P1_THREAD_RESOLVED=true
PR1163_TARGET_P1_UNRESOLVED_COUNT=0

PAGE_WORKBENCH_STATE=read_only/pilot_released
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25
CONTROLLED_CREATE_RELEASE_COUNT=0

AUDIT_READER_RUNTIME_AUTHORIZED=false
AUDIT_READER_RUNTIME_IMPLEMENTED=false

PRODUCTION_READY_INFERRED=false
PRODUCTION_DEPLOYMENT=false
PRODUCTION_CHANGE=false
```

## 下一任务必须遵守的精确闭包

完整 allowlist：

`docs/operations/post-v2-r1c-audit-reader-exact-runtime-allowlist-20260813.csv`

准入依据：

`docs/operations/post-v2-r1c-audit-reader-prerequisite-admission-20260813.md`

精确生产文件：

1. `src/modules/audit/domain/audit-event-query.ts`
2. `src/modules/audit/server/audit-event-repository.ts`
3. `src/server/orchestration/institution-audit-reader.ts`（new）
4. `src/app/api/institution/audit-events/route.ts`

精确测试文件：

1. `src/modules/audit/tests/AuditEventRepository.test.ts`
2. `src/server/orchestration/institution-audit-reader.test.ts`（new）
3. `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
4. `src/app/api/institution/audit-events/route.test.ts`

## 停止边界

- 当前仍未授权 Audit Reader Runtime，不得仅凭本 handoff 开始实现；
- 获得下一任务明确授权后也只能修改 exact 8-file allowlist；出现第 9 个文件必须停止并重新准入；
- 不得把 Reader Runtime 扩大为 Writer attribution、backfill、Schema、Migration、DDL、DML 或 platform reader 重构；
- 不得修改 Architecture exception 或删除 AQ004；
- 不得重新放行 `page_system_audit`；Reader 完成不等于页面、Capability 或 data readiness 放行；
- 不得推导生产就绪，不得执行生产变更或生产部署；
- 任一真实数据库连接、Staging 或 Production 动作都需要独立授权。

# POST-V2-R1C Audit Owner 机构归因契约 Runtime 独立验证

> 日期：2026-08-13
>
> Runtime PR：#1179
>
> Runtime Head：`509140180aa95e56cccba17db4d5e65db20d6cd5`
>
> Runtime Merge：`cba79e6bad83be4eafebc6b4359e381d98eb804a`
>
> 类型：合并后独立验证 / 仅文档

## 1. 结论

```text
POST_V2_R1C_AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_IMPLEMENTED=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_VERIFIED=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_INDEPENDENT_VERIFICATION=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_HANDOFF_COMPLETE=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=true

LEGACY_CALLER_CAN_WRITE_VERIFIED=false
LEGACY_UNATTRIBUTED_NEW_WRITE_ALLOWED=false
AUDIT_CONTRACT_PROVES_FORMAL_SCOPE=false
AUDIT_OWNER_IMPORTS_SCOPE_PORT=false
```

Audit Owner 已按 S7 Admission 的方案 B 完成独立归因契约：保留 legacy `TenantAuditEvent + record()` 临时兼容，新增 Audit-owned 判别式 attributed contract、严格 factory / validator、独立 mapper 与 `recordAttributed()`。本闭环不代表 19 个生产 caller、Audit Writer attribution、历史 backfill 或页面放行已经完成。

## 2. Runtime PR 与精确范围

```text
RUNTIME_AUTHORIZATION_USED=A2 exact 4 files
RUNTIME_EXACT_FILE_COUNT=4
RUNTIME_EXISTING_FILE_COUNT=4
RUNTIME_NEW_FILE_COUNT=0
RUNTIME_DELETE_FILE_COUNT=0
RUNTIME_EXACT_PRODUCTION_FILE_COUNT=2
RUNTIME_EXACT_TEST_FILE_COUNT=2

RUNTIME_PR=1179
RUNTIME_HEAD=509140180aa95e56cccba17db4d5e65db20d6cd5
RUNTIME_MERGE=cba79e6bad83be4eafebc6b4359e381d98eb804a
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0
```

从 Admission Merge `7481ef26d53da0cef64b22ed23680c0b7a4c51df` 到 Runtime Merge 的变化恰好为以下 4 个既有文件：

1. `src/modules/audit/domain/audit-events.ts`
2. `src/modules/audit/server/audit-event-repository.ts`
3. `src/modules/audit/tests/AuditEventsDomain.test.ts`
4. `src/modules/audit/tests/AuditEventRepository.test.ts`

没有第 5 个 Runtime/Test 文件、新 Runtime 文件或删除文件。S6 scope port、19 个 production callers、Schema/Migration、Architecture rules、Workbench、Capability Authority 与 `page_system_audit` 均未修改。

## 3. Domain contract 验证

```text
ATTRIBUTED_CONTRACT_TYPE=AuditInstitutionAttributionV1 + AttributedTenantAuditEventV1
ATTRIBUTED_FACTORY=createAttributedTenantAuditEventV1
ATTRIBUTED_VALIDATOR=isAttributedTenantAuditEventV1
```

- `verified` 只接受 canonical 非空 `tenantId + institutionId`，且 base event tenant 必须完全一致；
- `not_applicable` 只接受 `institutionId=null`，tenant 为 canonical 非空 string 或 null，并要求 exact tenant 一致；
- unknown、`legacy_unattributed`、缺字段、额外字段、非法 enum、tenant mismatch、blank、cast / fake 与 Proxy 异常均 fail-closed；
- factory 使用固定字段白名单创建冻结的新对象，不保留 session、credential、scope handle、request body 或额外字段；
- contract 只验证 shape、classification 与 pair self-consistency，不证明 pair 来自 genuine formal scope。

## 4. Persistence contract 验证

```text
ATTRIBUTED_MAPPER=mapAttributedAuditEventToInsert
ATTRIBUTED_REPOSITORY_METHOD=recordAttributed
LEGACY_WRITER_COMPATIBILITY_STRATEGY=legacy TenantAuditEvent and record remain temporarily and map explicit NULL institution columns; a separate attributed contract and recordAttributed path accept only verified or not_applicable
LEGACY_RECORD_PATH_EXIT_CONDITION=classified caller migration proves PRODUCTION_LEGACY_WRITER_RESIDUAL=0 and all transaction Platform Auth and institution regressions pass then a separately authorized cleanup removes the legacy persistence entry
```

- legacy `mapAuditEventToInsert()` 与 `record()` 继续存在，并显式持久化 `institutionId=null`、`institutionAttribution=null`；
- attributed mapper 与 `recordAttributed()` 均调用 Audit-owned validator；非法 cast / fake input 抛出固定低敏错误 `INVALID_AUDIT_INSTITUTION_ATTRIBUTION`，database insert call count 为 0；
- `verified` 精确写入 tenant / institution / `verified`；tenant-scoped 或 global `not_applicable` 精确写入 tenant-or-null / null / `not_applicable`；
- Repository 只使用 caller-provided database，不调用 `getDatabase()`、不自行开启 transaction、不查询业务 Owner、不解析 session、不导入 S6 scope port；
- Institution Reader 继续强制 tenant + institution + `verified`，Platform Reader 与 caller-provided transaction semantics 未变化。

## 5. 验证证据

```text
TARGETED_TEST_FILES=16
TARGETED_TESTS=288
TARGETED_TESTS_RESULT=passed

FULL_TEST_FILES=492
FULL_TESTS=6678
FULL_TESTS_RESULT=passed

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
GIT_DIFF_CHECK=passed
STATIC_SCOPE_GUARDS=passed
```

Runtime Head 本地全门禁与 GitHub Required Check 均通过。Runtime 合并后又从 merged `main` 重新执行 16 个相关测试文件、typecheck、Architecture incremental 与静态 scope guards；全部通过。full tests、Architecture unit、lint 与 build 证据来自冻结 Runtime Head 和 Required Check。

## 6. 保持边界

```text
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1

PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本阶段未连接数据库，未执行任何真实 insert、backfill、Schema、Migration、DDL 或 DML。`recordAttributed()` 只在 unit test 中使用 fake database。未连接 Staging / Production，也未改变页面授权或发布状态。

## 7. 下一任务

```text
NEXT_TASK=POST-V2-R1C Audit Writer classified caller migration fresh audit + exact Runtime admission
CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
```

下一阶段只能重新盘点并分类 19 个 production callers（11 Institution、7 Platform、1 Auth/non-institution）和 10 个 transactional persistence / composition files，决定一次迁移还是继续拆分原子 slice，并形成 exact Runtime Admission。本文档不授权 caller migration。

# BASE-B5 Cross-Tenant Transfer Orchestration 实现准入

- 日期：2026-08-07
- 冻结 Base：`e6e56bd0dbb33447c23a21631a7ee7dcc6ff6037`
- 状态：`implementation_admission_passed`
- 本任务仅冻结实现边界与测试契约；不授权实际代码实现，不连接数据库，不执行 DDL/DML/Migration。

## 现有实现审计

1. `membership-command-service.ts` 已提供 `executeMembershipCommandWithUnitOfWork`，可复用 target Membership create + optional Binding create，以及 source Membership revoke + active Binding revoke。
2. `binding-command-service.ts` 的 standalone `rebind` 继续保持 same-tenant；cross-tenant transfer 不修改它。
3. `membership-command-repository.ts` 已提供 SERIALIZABLE READ WRITE、5s/1s/5s timeout、transaction-bound UoW、Membership/Binding locks、current mutation、append-only evidence 与 Scope assertion factory injection。
4. `membership-command-external-transaction.ts` 是 formal onboarding 专用，强制一次 create、role=tenant_admin、binding=null；禁止改造成 transfer。
5. 现有 app composition root 只服务正式 tenant onboarding；本轮 minimal foundation 不接 API/composition root。
6. AQ008 canonical writer 继续只由既有 Access Control Repository 承担；新文件禁止直接写 Membership/Binding current/evidence 表，因此无需扩大 AQ008 allowlist。

## Exact 4-file allowlist

```text
src/modules/access-control/application/cross-tenant-transfer-service.ts
src/modules/access-control/server/cross-tenant-transfer-transaction.ts
src/modules/access-control/tests/CrossTenantTransferService.test.ts
src/modules/access-control/tests/CrossTenantTransferTransaction.test.ts
```

除上述 4 文件外，未来 implementation 如需修改任何第 5 个文件，必须立即停止并重新准入。

明确禁止修改：

```text
src/modules/access-control/application/membership-command-service.ts
src/modules/access-control/application/binding-command-service.ts
src/modules/access-control/server/membership-command-repository.ts
src/modules/access-control/server/membership-command-external-transaction.ts
src/modules/access-control/ports/membership-command-unit-of-work.ts
src/app/api/v1/open-platform/tenants/_membership-command-composition.ts
scripts/verify/architecture-quality.mjs
src/server/db/schema.ts
drizzle/*
```

## Application contract

最低输入必须携带：

```text
same global account
source tenant
source membership id + expected revision
source binding id + expected binding version
target tenant
target institution
target membership id
target binding id
actor
stable reason
occurredAt
optional target expiry
```

Target role 必须从事务内重新锁定的 source Membership current 继承，不能信任调用方 role。

Target Binding：
- assignment source = `manual_admin`
- provenance = `access_control_command`

必须 fail-closed：
- source == target tenant；
- source membership/binding missing、inactive、expired、identity mismatch；
- stale Membership revision / Binding version；
- target Membership 已存在；
- target active Binding 已存在；
- target Scope missing/inactive/invalid/unavailable；
- account mismatch；
- command replay；
- affected rows != 1；
- Owner result envelope 不符合预期；
- 任一未知异常。

## Transaction contract

```text
isolation=SERIALIZABLE
access_mode=READ_WRITE
statement_timeout=5000ms
lock_timeout=1000ms
idle_in_transaction_session_timeout=5000ms
automatic_retry=0
nested_transaction=0
```

在 tenant-scoped lock 前先获取：

```text
pg_advisory_xact_lock
namespace=base02-cross-tenant-transfer
subject=global account id
```

任何 mutation 前先冻结：

```text
1 transfer/account advisory lock
2 source Membership current
3 source active Binding
4 target Membership create identity
5 target Membership current absence
6 target active Binding absence
7 target Scope active + revision
8 command replay eligibility
```

全部通过后才允许 Owner mutation：

```text
target Membership create + target Binding create
source Membership revoke + source Binding revoke
```

两侧使用同一个低敏 transfer command id。第二个 Owner command blocked/throw 时必须抛 transfer-specific error，使 outer transaction 全量回滚。

## Command / evidence correlation

本 minimal foundation 不新增 Schema。

同一 command id 在不同 tenant 可由现有 tenant-scoped uniqueness 承载，未来成功应能证明：

```text
target Membership evidence = 1
target Binding evidence = 1
source Membership evidence = 1
source Binding evidence = 1
same transfer command id = true
```

如 4-file tests 证明现有 evidence correlation 仍可能歧义，必须停下并重开 Schema ADR；禁止用日志补洞。

## 静态准入结论

```text
implementation_admission_passed=true
exact_allowlist_frozen=true
exact_file_count=4

schema_change_required=false
migration_required=false
aq008_change_required=false
existing_writer_repository_change_required=false
existing_port_change_required=false
composition_root_change_required=false

implementation_authorized=false
execution_authorized=false

database_connection=false
ddl_execution=false
dml_execution=false
migration_execution=false
membership_write_execution=false
binding_write_execution=false
historical_orphan_remediation_authorized=false
```

## 下一任务

```text
BASE-B5 跨 tenant transfer orchestration 4-file 最小实现授权与执行
```

进入下一任务前必须取得明确实际代码实现授权。

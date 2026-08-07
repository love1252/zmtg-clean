# BASE-B5 relation-orphan ADR 后续实现准入前置规划

> 日期：`2026-08-07`
>
> Base：`207804f4a4a962d10dc5c872bc952e0bb3390eac`
>
> 状态：`preplanning_only`
>
> 本文不授权 Runtime 修改或数据库写入。

## 1. 已解决的架构冲突

ADR 已接受：

```text
active authorization orphan must be zero
retained revoked evidenced historical relation orphan may remain exactly one
```

因此 XT09 从 `blocked_invariant_conflict` 转为 `resolved_by_adr`。

XT10 仍不能放行，因为 BASE-B5 尚未执行实际 cross-tenant transfer，也没有独立 post-state 复核。

## 2. 下一实现准入目标

下一任务应冻结 cross-tenant transfer orchestration 的 exact code allowlist，不直接修改数据库。

候选文件仍为：

```text
src/modules/access-control/application/cross-tenant-transfer-service.ts
src/modules/access-control/server/cross-tenant-transfer-transaction.ts
src/modules/access-control/tests/CrossTenantTransferService.test.ts
src/modules/access-control/tests/CrossTenantTransferTransaction.test.ts
```

这些只是 candidate；下一任务必须基于新的 main 重新审计现有 composition root、port、tests 和 AQ008 gate 后冻结 final allowlist。

## 3. 实现必须保持的 Owner 边界

- Identity：全局 Auth Account／Session；
- Access Control：Membership／Binding lifecycle 与 transfer orchestration；
- Tenancy：Scope／Context；
- Security：只消费 Owner Port；
- transfer orchestration 不成为第二套 current。

## 4. transaction 方向

未来实现候选继续采用：

```text
single outer SERIALIZABLE READ WRITE transaction
account/transfer transaction advisory lock
target Membership create + target Binding create
source Membership revoke + source Binding revoke
append Membership + Binding transition evidence
no nested transaction
no automatic retry
```

但本任务不创建实现文件。

## 5. Future execution admission

代码实现通过独立审查后，数据库 execution 仍需单独授权，并且必须先进行 localhost-only live readonly preflight，冻结：

```text
source membership/binding exact pre-state
target membership/binding exact pre-state
target scope exact active revision
journal/schema exact state
concurrent writer = 0
prepared transaction = 0
recovery point ready
expected transition/evidence counts
expected post-state fingerprints
```

## 6. 当前阶段安全边界

```text
implementation_authorized=false
execution_authorized=false
database_connection=false
ddl_execution=false
dml_execution=false
migration_execution=false
membership_write_execution=false
binding_write_execution=false
historical_orphan_remediation_authorized=false
reader_release=false
capability_release=false
```

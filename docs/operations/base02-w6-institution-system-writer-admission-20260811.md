# W6 Institution System Writer Formal Admission

> 日期：`2026-08-11`
>
> Baseline：`2003a226e1101009e8278a3f5effc89051c203b6`
>
> 类型：post-W5 current-main symbol / direct mutation / callgraph / transaction audit
>
> Runtime authorization：`false`

## 1. Fresh W6 result

```text
w5_complete=true

w6_canonical_owner=institution-system
w6_fresh_direct_mutation_calls=10
w6_fresh_direct_writer_files=3
w6_fresh_fact_tables=3

hisConnections=6
hisConnectionCredentialCompensationOperations=2
hisConnectionCredentialCompensationJobs=2

credential_storage_direct_mutation=0
his_connection_readonly_panel_direct_mutation=0
```

旧 post-W1C inventory 的 5 个 W6 candidate 已重新分类：

- `his-connection-credential-storage.ts` 当前是 `in_memory_test_only` provider，不是 DB Writer；
- `HisConnectionReadOnlyPanel.tsx` 是只读 UI，不是 Writer；
- current-main direct Writer 只剩 3 个 repositories。

## 2. Canonical Owner

Architecture V2 已将：

```text
src/modules/institution-system -> src/modules/institution-system
target owner = institution-system
disposition = canonical_expand
```

因此 W6 canonical Writer Owner 冻结为 `institution-system`。

## 3. Decomposition

W6 不执行一次性大爆炸迁移，冻结为：

```text
W6A = HIS Connection Core / hisConnections
W6B = Credential Compensation / operations + jobs
```

### W6A

```text
direct_mutation_calls=6
direct_writer_files=1
active_production_factory_importers=4
exact_runtime_file_count=16
runtime_authorized=false
```

4 个 active production caller：

```text
his-connection-write-service.ts
his-connection-status-service.ts
his-connection-credential-service.ts
his-connection-test-connection-service.ts
```

W6A 通过 `src/server/orchestration/his-connection-writer.ts` 构造 canonical Institution System Writer。

API Routes 不修改。

Legacy `his-connection-repository.ts` 在 caller 全部 rewire 后：

- 所有 direct `hisConnections` mutation 清零；
- Writer methods fail-closed；
- `listHisConnectionsByTenant` 保留；
- `getHisConnectionByTenant` 保留；
- `getHisConnectionCredentialSummaryByTenant` 保留。

### W6B

```text
direct_mutation_calls=4
direct_writer_files=2
active_production_factory_constructors=0
worker_uses_injected_repository_ports=true
runtime_allowlist_frozen=false
runtime_authorized=false
```

W6B 暂不冻结 Runtime allowlist，因为两个 compensation repository 仍依赖 legacy server-level：

```text
his-connection-credential-provider-failure.ts
```

worker 也仍从 legacy repository surface 获取 injected port/types。

必须先单独完成 compensation domain / port ownership admission，禁止为了赶进度让 `institution-system/server/**` 反向依赖 legacy `institution/server/**` repository/domain 实现。

## 4. W6A transaction preservation

W6A 只迁 Writer ownership，不顺带重设计 transaction：

```text
create/update:
  hisConnections Writer + Audit = same database.transaction

status:
  hisConnections Writer + Audit = same database.transaction

credential:
  synthetic test-only provider store = before DB transaction
  credentialRef Writer + allowed Audit = same database.transaction

test-connection:
  fake provider remains
  Audit and health-summary write remain current sequential behavior
  no new encompassing transaction in W6A
```

禁止 W6A 偷偷启用真实 HIS。

## 5. W6A exact Runtime allowlist

冻结：

`docs/operations/base02-w6a-his-connection-core-exact-runtime-allowlist-20260811.csv`

```text
exact_runtime_file_count=16
new_files=6
existing_files=10
seventeenth_runtime_file_requires_stop_and_readmission=true
```

## 6. Explicit exclusions

W6A 不包含：

```text
API Route changes
HisConnectionReadOnlyPanel.tsx
his-connection-credential-storage.ts
credential compensation operation repository
credential compensation job queue repository
credential compensation worker
Schema
Migration
DB execution
real HIS
Reader release
Capability release
Trial Provisioning
production deployment/change
```

## 7. Verification

W6A Runtime 后至少必须重新通过：

- canonical command/repository tests；
- orchestration tests；
- legacy repository blockade + Reader compatibility；
- write/status/credential/test-connection service tests；
- existing HIS API route regression tests；
- typecheck；
- lint；
- build；
- architecture unit；
- architecture incremental；
- full suite；
- Required Check。

## 8. Decision

```text
w6_symbol_callgraph_audit=passed
w6_transaction_audit=passed
w6_decomposition_frozen=true

w6a_his_connection_core_admission=passed
w6a_exact_runtime_file_count=16
w6a_runtime_authorized=false

w6b_compensation_audit=passed
w6b_runtime_allowlist_frozen=false
w6b_runtime_authorized=false
w6b_blocked_pending_domain_port_ownership_admission=true

business_writer_phase_complete=false
```

唯一下一任务：

`W6A HIS Connection Core exact 16-file Runtime implementation explicit authorization`

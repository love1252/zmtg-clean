# W6B Credential Compensation Domain / Port Formal Admission

> 日期：`2026-08-11`
>
> Baseline：`8d0223afa1b2c6c2aa864a996c2a86362b6316fe`
>
> 类型：post-W6A compensation domain / port / state-machine / callgraph audit
>
> Runtime authorization：`false`

## 1. Current-main result

```text
w6a_complete=true

w6b_canonical_owner=institution-system
w6b_direct_mutation_calls=4
w6b_direct_writer_files=2
w6b_fact_tables=2

operation_mutation_calls=2
job_mutation_calls=2

active_operation_factory_constructors=0
active_job_factory_constructors=0
active_worker_factory_importers=0
worker_uses_injected_ports=true
worker_database_transaction=false
```

W6B 当前没有 production activation surface。

## 2. Fact tables

W6B 只覆盖：

```text
hisConnectionCredentialCompensationOperations
hisConnectionCredentialCompensationJobs
```

不包含 `hisConnections`；W6A 已完成。

## 3. Shared provider-failure boundary

`his-connection-credential-provider-failure.ts` 不能整体迁入 W6B，因为 W6A 的 active credential service 仍使用其 provider failure mapping。

因此 Runtime 冻结为：

```text
legacy shared provider-failure file = unchanged
canonical W6B domain = copy exact compensation-only literals/contracts
canonical domain tests = test-only parity lock against legacy shared literals
```

禁止让 `institution-system/**` production Runtime 反向 import `institution/server/**`。

## 4. Retry-policy boundary

Legacy retry policy 是 pure policy，current-main 唯一 production importer 是 legacy worker。

Runtime 后：

```text
canonical worker -> canonical retry policy
legacy retry policy -> unchanged compatibility-only
legacy retry policy production importers -> 0
```

canonical retry tests 必须锁住与 legacy behavior 的 parity。

## 5. Repository ownership

新增两个 canonical Institution System server repositories：

```text
his-connection-credential-compensation-operation-repository.ts
his-connection-credential-compensation-job-queue-repository.ts
```

Runtime 后：

```text
canonical direct mutation calls=4
canonical Writer files=2
legacy direct mutation calls=0
legacy operation factory=fail-closed
legacy job factory=fail-closed
```

由于 current-main 没有 production constructors，本轮不做 caller rewire，不新增 orchestration、cron、Route 或 capability activation。

## 6. State-machine / CAS preservation

Operation：

```text
create unique violation -> conflict
transition UPDATE predicate includes current state
running/succeeded/failed/manual-review legal transitions preserved
retry count legal-state gate preserved
```

Job：

```text
create unique violation -> conflict
mutation UPDATE predicate includes current jobState
mutation UPDATE predicate includes current claimVersion
claimId / lockedUntil / claimVersion semantics preserved
requeue / dead-letter / manual-review / cancel / stale-lock recovery preserved
```

## 7. Worker coordination

Worker 当前是：

```text
operationRepository = injected
jobQueueRepository = injected
providerExecutor = injected
database transaction = none
```

本轮必须保留该边界。

不允许为了“原子化”而新建跨 operation/job 的 DB transaction；现有设计依赖 CAS、lock、retry、dead-letter 和 manual-review 做 recovery。

canonical worker 同样保持 production unconstructed。

## 8. Exact Runtime allowlist

冻结：

`docs/operations/base02-w6b-exact-runtime-allowlist-20260811.csv`

```text
exact_runtime_file_count=18
new_files=12
existing_files=6
nineteenth_runtime_file_requires_stop_and_readmission=true
```

明确排除：

```text
his-connection-credential-provider-failure.ts
his-connection-credential-compensation-retry-policy.ts
HisConnectionCredentialProviderFailure.test.ts
HisConnectionCredentialCompensationRetryPolicy.test.ts
HisConnectionCredentialService.test.ts
W6A Runtime files
API Routes
Schema
Migration
DB execution
real HIS
Trial Provisioning
production activation/deployment
```

## 9. Activation rule

```text
w6b_active_production_factory_constructors=0
w6b_canonical_production_activation=false
```

未来如果要创建 cron / worker runner / Route / queue consumer / provider executor 的 production composition，必须另开 Admission；本 W6B Runtime 授权不包含激活。

## 10. Decision

```text
w6b_domain_ownership_audit=passed
w6b_port_ownership_audit=passed
w6b_state_machine_cas_audit=passed
w6b_coordination_boundary_audit=passed

w6b_exact_runtime_file_count=18
w6b_runtime_allowlist_frozen=true
w6b_runtime_authorized=false

w6_institution_system_complete=false
business_writer_phase_complete=false
```

唯一下一任务：

`W6B Credential Compensation exact 18-file Runtime implementation explicit authorization`

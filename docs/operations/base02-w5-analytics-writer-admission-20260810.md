# W5 Analytics Writer Formal Admission

> 日期：`2026-08-10`
>
> Baseline：`81541fc989d4ba155f99873bc2e6bd2fa314ac73`
>
> Runtime authorization：`false`

## Audit

```text
w3_knowledge_complete=true
w5_canonical_owner=analytics
w5_legacy_direct_insert_calls=1
w5_direct_insert_table=aiCallUsageRecords
w5_active_production_writer_callers=0
w5_legacy_active_production_importers=1
w5_legacy_active_importer_mode=readonly_platform_summary
institution_ai_write_route_capability_off=true
```

当前唯一 production repository importer 是 `/api/v1/open-platform/ai-usage` GET，只消费平台 AI usage summary Reader。

`requestInstitutionAiCallService`、`recordKnowledgeRagAnswerUsageSuccess`、`recordAiCallQuotaRejection` 当前均无 production importer；机构 AI POST 仍为 `503 capability_disabled`。

因此 W5 **不做 caller rewire、不改 Route、不释放 capability**。

## Ownership / persistence

Architecture V2 将 `src/modules/institution-analytics` 的目标 Owner 定义为 `analytics`。

W5 canonical Writer 冻结为：

```text
src/modules/analytics/application/ai-call-usage-command-service.ts
src/modules/analytics/server/ai-call-usage-command-repository.ts
```

Scope：

```text
TenantAiCallUsageScope      = tenantId; persisted institutionId=null
InstitutionAiCallUsageScope = tenantId + non-null institutionId
```

`aiCallUsageRecords.institutionId` 当前 nullable；禁止 first-institution fallback。

Persistence：

```text
append_only=true
direct_insert_calls=1
update_delete=false
cas_required=false
transaction_coupling=none
```

## Legacy compatibility

`src/modules/institution/server/institution-ai-call-usage-repository.ts`：

- `createUsageRecord` fail-closed；
- direct `insert(aiCallUsageRecords)` 清零；
- `findVendorConfig` 保留；
- `listInstitutionUsageRecords` 保留；
- `listInstitutionUsageMetricRecords` 保留；
- `listPlatformUsageSummary` 保留。

Reader 不在 W5 迁移。

## Exact Runtime allowlist

`docs/operations/base02-w5-analytics-exact-runtime-allowlist-20260810.csv`

```text
exact_runtime_file_count=6
new_files=4
existing_files=2
seventh_runtime_file_requires_stop_and_readmission=true
```

明确不包含：

```text
src/modules/institution/server/institution-ai-call-service.ts
src/app/api/institution/knowledge-management/ai-call/route.ts
src/app/api/v1/open-platform/ai-usage/route.ts
```

## Verification / prohibitions

Implementation 必须覆盖 owner-local tests、legacy blockade、Reader compatibility、capability-off route、typecheck、lint、build、architecture unit/incremental、full tests、Required Check。

本 Admission 不授权：

```text
W5 Runtime
W6 Runtime
Trial Provisioning Runtime
Schema
Migration
DB execution
Route change
Reader migration/release
Capability release
AI provider activation
production change
```

## Decision

```text
w5_analytics_symbol_callgraph_audit=passed
w5_analytics_admission=passed
w5_exact_runtime_file_count=6
w5_runtime_authorized=false
business_writer_phase_complete=false
```

唯一下一任务：

`W5 Analytics exact 6-file Runtime implementation explicit authorization`

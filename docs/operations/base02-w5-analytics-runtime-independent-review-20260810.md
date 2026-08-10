# W5 Analytics Runtime Independent Review

> 日期：`2026-08-10`
>
> Implementation PR：#1130
>
> Implementation Base：`64b702546797680af3b36246158e8d3e506ca406`
>
> Implementation Head：`82e4cba5bfe81814dc9cef7a38eed8ebe4fb4c05`
>
> Implementation Merge：`182b9fb6e2fbd730153b5ce536e826141ab03bce`
>
> 审查类型：独立、docs-only
>
> 结论：`passed`

## 1. Scope

Implementation PR #1130 保持 Formal Admission 冻结的 exact Runtime scope：

```text
runtime_file_count=6
new_files=4
existing_files=2
seventh_runtime_file_change=false
canonical_owner=analytics
```

No 7th Runtime file occurred.

## 2. Canonical command contract

Analytics command 使用显式 scope union：

```text
TenantAiCallUsageScope:
  kind=tenant
  tenantId=required exact identifier
  persisted institutionId=null

InstitutionAiCallUsageScope:
  kind=institution
  tenantId=required exact identifier
  institutionId=required exact non-null identifier
```

使用递归 JSON object contract 承载已经计算完成的 meteringDetails / metadata，不反向依赖 Institution service/domain 类型。

Command 同时校验 status、meteringStatus、provider/model/actor/id 与 non-negative integer usage fields。

## 3. Canonical append-only Writer

`src/modules/analytics/server/ai-call-usage-command-repository.ts` 是 production 唯一直接 `aiCallUsageRecords` Writer：

```text
canonical_direct_insert_calls=1
canonical_update_calls=0
canonical_delete_calls=0
append_only=true
```

Tenant scope 持久化 `institutionId=null`；Institution scope 持久化显式 institutionId。

## 4. Legacy blockade and Reader compatibility

Legacy Institution repository：

```text
legacy_createUsageRecord=fail_closed
legacy_direct_insert_calls=0
```

保留现有兼容 Reader / config surface：

```text
findVendorConfig
listInstitutionUsageRecords
listInstitutionUsageMetricRecords
listPlatformUsageSummary
```

因此当前平台 AI usage GET Reader 不受 W5 Writer 迁移影响。

## 5. No caller rewire / no capability release

Independent production scan confirmed：

```text
active_production_writer_callers=0
caller_rewire_files=0
institution_ai_write_route_capability_off=true
```

`requestInstitutionAiCallService`、`recordKnowledgeRagAnswerUsageSuccess`、`recordAiCallQuotaRejection` 仍无 production importer。

W5 未修改：

```text
src/modules/institution/server/institution-ai-call-service.ts
src/app/api/institution/knowledge-management/ai-call/route.ts
src/app/api/v1/open-platform/ai-usage/route.ts
src/server/db/schema.ts
scripts/verify/architecture-quality-rules.json
src/modules/institution/server/trial-provisioning-service.ts
```

## 6. Verification

Implementation evidence：

```text
targeted_test_files=7
targeted_tests=73_passed
full_test_files=480_passed
full_tests=6595_passed
typecheck=passed
lint=0_errors_4_existing_warnings
build=passed
architecture_unit_tests=148_passed
architecture_incremental_check=passed
required_check=passed
```

Independent Review reran：

```text
targeted_test_files=7
targeted_tests=73_passed
typecheck=passed
architecture_incremental_check=passed
```

## 7. Decision

```text
w3_knowledge_complete=true

w5_runtime_implementation=passed
w5_runtime_independent_review=passed
w5_complete_eligible=true
w5_complete=false_before_handoff

w6_institution_system=pending
trial_provisioning_review=pending
business_writer_phase_complete=false
```

No Runtime repair is required.

唯一下一任务：

`W5 docs-only Handoff`

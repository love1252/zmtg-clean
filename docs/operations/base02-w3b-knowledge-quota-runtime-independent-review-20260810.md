# W3B Knowledge Quota Usage Runtime Independent Review

> 日期：`2026-08-10`
>
> Implementation PR：#1126
>
> Implementation Base：`6e296f885ca9ae97d30ca6030cb2c0b0946e3543`
>
> Implementation Head：`1e02824c969c81ce69208f68fb036ce0f5660951`
>
> Implementation Merge：`1e078da73e5b215c58751d7913b0856def1bd620`
>
> 审查类型：独立、docs-only
>
> 结论：`passed`

## 1. Scope

Implementation PR #1126 保持冻结的 exact Runtime scope：

```text
runtime_file_count=13
fourteenth_runtime_file_change=false
canonical_owner=knowledge
```

No 14th Runtime file occurred.

## 2. Explicit quota scope contract

Knowledge command 层使用显式 scope union：

```text
TenantKnowledgeQuotaScope:
  kind=tenant
  tenantId=required
  persisted institutionId=null

InstitutionKnowledgeQuotaScope:
  kind=institution
  tenantId=required
  institutionId=required non-null
```

Independent static review confirmed tenant / institution identifiers are exact, non-empty server-side values. No first-institution fallback or synthetic institution attribution was introduced.

## 3. Canonical append-only Writer

`src/modules/knowledge/server/knowledge-quota-usage-command-repository.ts` is the unique production owner of the direct `knowledgeQuotaUsageRecords` mutation.

```text
canonical_quota_insert_calls=1
canonical_quota_update_calls=0
canonical_quota_delete_calls=0
canonical_quota_append_only=true
```

Tenant scope persists `institutionId=null`; institution scope persists the explicit non-null institutionId.

## 4. Cross-owner orchestration

`src/server/orchestration/knowledge-quota-writer.ts` is the bridge from the existing Institution quota decision contract to the Knowledge command contract.

It:

- maps allowed/rejected decisions into low-sensitive status and safeReasonCode;
- rejects non-Knowledge quota resources;
- constructs the canonical Knowledge command repository/service;
- does not move the Knowledge Writer back into Institution.

## 5. Production caller rewire

Independent scan confirmed exactly the three admitted production callers no longer import the legacy Institution quota Writer:

```text
src/modules/institution/server/institution-knowledge-upload-service.ts
src/modules/open-platform/server/platform-knowledge-document-parsing-service.ts
src/modules/open-platform/server/platform-knowledge-indexing-job-service.ts
```

Caller scope behavior:

```text
Institution upload:
  institution scope always

Platform parsing:
  knowledge.institutionId non-null -> institution scope
  knowledge.institutionId null     -> tenant scope

Platform indexing:
  explicit scope resolver
  non-null institutionId -> institution scope
  null institutionId     -> tenant scope
```

No legacy production runtime importer remains.

## 6. Legacy blockade

The legacy compatibility API remains available only to avoid accidental type/import breakage.

Its Writer is fail-closed:

```text
legacy_quota_writer_blocked=true
legacy_quota_direct_mutation=0
legacy_production_runtime_importers=0
```

## 7. Out-of-scope verification

Implementation base/head blob comparison confirmed no change to:

```text
src/server/db/schema.ts
scripts/verify/architecture-quality-rules.json
src/modules/institution/server/trial-provisioning-service.ts
W3A Knowledge Content command/repository/orchestration
institution knowledge items Route
institution knowledge upload Route
```

Therefore:

```text
w3a_change=false
schema_change=false
migration=false
database_execution=false
route_change=false
reader_release=false
capability_release=false
trial_provisioning_change=false
governance_exception_change=false
w5_change=false
w6_change=false
production_change=false
p2b_aq004_exception_retained=true
```

## 8. Verification

Implementation evidence:

```text
targeted_test_files=6
targeted_tests=62_passed
full_test_files=478_passed
full_tests=6580_passed
lint=0_errors_4_existing_warnings
typecheck=passed
build=passed
architecture_unit_tests=148_passed
architecture_incremental_check=passed
required_check=passed
```

Independent review reran:

```text
targeted_test_files=6
targeted_tests=62_passed
typecheck=passed
architecture_incremental_check=passed
```

## 9. Decision

```text
w3a_complete=true

w3b_runtime_implementation=passed
w3b_runtime_independent_review=passed
w3b_complete_eligible=true
w3b_complete=false_before_handoff

w3_knowledge_complete=false_before_w3b_handoff
business_writer_phase_complete=false
```

No Runtime repair is required.

唯一下一任务：

`W3B docs-only Handoff`

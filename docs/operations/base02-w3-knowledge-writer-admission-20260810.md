# W3 Knowledge Writer Formal Admission

> 日期：`2026-08-10`
>
> 基线：`8d8d30cc03a369c5353cdab76c2368d6be075272`
>
> 状态：`admission_passed`
>
> Runtime：`not_authorized`

## 1. Fresh residual

Post-W2 Care fresh recompute confirmed:

```text
w2_care_complete=true
business_writer_phase_complete=false

w3_legacy_direct_mutation_calls=9
w3_legacy_direct_writer_files=2
w3_legacy_direct_writer_tables=5

w5_pending_direct_mutation_calls=1
w6_pending_direct_mutation_calls=10
trial_provisioning=separate_review
```

W3 legacy direct Writer files:

```text
src/modules/institution/server/institution-knowledge-write-repository.ts
src/modules/institution/server/knowledge-quota-usage-service.ts
```

False-positive historical W3 candidates were rechecked and have no direct DB mutation:

```text
InstitutionKnowledgeBaseCardPanel.tsx
InstitutionKnowledgeReadonlyShell.tsx
institution-knowledge-rag-answer-service.ts
knowledge-content-manifest.ts
```

## 2. Canonical owner

Architecture V2 target mapping freezes W3 owner as:

```text
owner=knowledge
target_application=src/modules/knowledge/application/institution
target_domain=src/modules/knowledge/domain
```

The existing `src/modules/knowledge-base/**` and the knowledge-classified `src/modules/open-platform/**` surfaces are Knowledge-owner-local compatibility/runtime surfaces. Their direct writes are **not** classified as cross-owner bypass merely because their physical paths have not yet been merged into `src/modules/knowledge/**`.

W3 Runtime must not add new business ownership to frozen `src/modules/institution/**` or `src/modules/open-platform/**`.

## 3. Decomposition

W3 is frozen into two independent Runtime slices:

```text
W3A Knowledge Content
legacy_direct_mutation_calls=8
legacy_direct_writer_files=1
exact_runtime_file_count=8

W3B Knowledge Quota Usage
legacy_direct_mutation_calls=1
active_legacy_runtime_importers=3
exact_runtime_file_count=13

aggregate_unique_runtime_file_count=21
```

Hard guards:

```text
W3A 9th Runtime file => STOP / re-admit
W3B 14th Runtime file => STOP / re-admit
W3 aggregate 22nd unique Runtime file => STOP / re-admit
```

Each Runtime slice requires separate explicit authorization.

## 4. W3A Knowledge Content

Target facts:

```text
knowledgeSources
knowledgeDocuments
platformKnowledgeInstitutionVisibility
knowledgeDocumentFiles
```

Institution-created source/document/visibility facts are institution scoped. Canonical command attribution must use server-side:

```text
tenantId + institutionId
```

`knowledgeDocumentFiles` does not carry institutionId directly; write scope must be derived only through an already-owned `knowledgeDocument`.

Frozen transaction groups:

```text
C1 create: source + document + visibility
C2 update: source + document
C3 archive: document + source + files
```

All groups are same transaction / same commit or rollback.

Update/archive use observed `expectedUpdatedAt` CAS on the owned document. If Runtime proves no-schema CAS or transaction strategy cannot be implemented inside the exact allowlist, stop and re-admit.

The legacy Institution repository keeps read compatibility but its four direct content Writer methods must fail closed after W3A.

Institution `items` and `upload` Routes remain `503 capability_disabled`; W3A does not release them.

## 5. W3B Knowledge Quota Usage

`knowledgeQuotaUsageRecords.institutionId` is schema-nullable and existing Knowledge-owned Platform job flows intentionally accept `institutionId: string | null`.

Therefore W3B freezes an explicit scope contract instead of forcing non-null institution globally:

```text
InstitutionQuotaScope = tenantId + non-null institutionId
TenantQuotaScope      = tenantId + explicit tenant scope; persisted institutionId = null
```

No implicit omission, default institution, first-institution fallback, or caller-supplied scope escalation is allowed.

Quota evidence is append-only. W3B does not transaction-couple quota evidence with file storage, parse, OCR, embedding, or indexing primary work. Existing failure propagation is retained.

Three active runtime callers must rewire away from the legacy Institution Writer:

```text
src/modules/institution/server/institution-knowledge-upload-service.ts
src/modules/open-platform/server/platform-knowledge-document-parsing-service.ts
src/modules/open-platform/server/platform-knowledge-indexing-job-service.ts
```

Cross-owner/cross-physical-module repository construction belongs in `src/server/orchestration/**`.

The legacy `knowledge-quota-usage-service.ts` direct Writer fails closed after caller rewire.

## 6. Existing Knowledge-owner-local writers

Existing Knowledge-owned surfaces are not migrated by W3A simply because they write the same domain tables:

```text
src/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-repository.ts
src/modules/open-platform/server/platform-knowledge-management-repository.ts
```

They remain subject to their own existing runtime boundaries and later directory migration. W3A/B is an ownership/blockade migration, not a bulk directory rewrite.

## 7. Schema / route / release boundary

```text
schema_change_required=false
migration_required=false
database_execution=false

route_change=false
reader_release=false
capability_release=false
production_change=false

p2b_aq004_exception_change=false
trial_provisioning_change=false
w5_change=false
w6_change=false
```

No governance exception is pre-authorized for W3. If architecture checks reject a proposed new dependency/path, stop and re-admit rather than weakening architecture rules.

## 8. Exact allowlists

- `docs/operations/base02-w3a-knowledge-content-exact-runtime-allowlist-20260810.csv`
- `docs/operations/base02-w3b-knowledge-quota-exact-runtime-allowlist-20260810.csv`

Transaction matrix:

- `docs/operations/base02-w3-knowledge-transaction-groups-20260810.csv`

Test matrix:

- `docs/operations/base02-w3-knowledge-test-matrix-20260810.csv`

## 9. Decision

```text
w3_knowledge_admission=passed
w3_decomposition_frozen=true

w3a_runtime_authorized=false
w3b_runtime_authorized=false
w3_runtime_authorized=false

w3a_exact_runtime_file_count=8
w3b_exact_runtime_file_count=13
w3_aggregate_unique_runtime_file_count=21

business_writer_phase_complete=false
```

唯一下一任务：

`W3A Knowledge Content exact 8-file Runtime implementation explicit authorization`

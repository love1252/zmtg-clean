# W3A Knowledge Content Runtime Independent Review

> 日期：`2026-08-10`
>
> Implementation PR：#1123
>
> Implementation Base：`5a60084646611a782041326184906082f389b01d`
>
> Implementation Head：`e336c2030e499a416114b129ea8716bee5374e45`
>
> Implementation Merge：`6ada03297115716a1e5e17536a8902ac33e89aa5`
>
> 审查类型：独立、docs-only
>
> 结论：`passed`

## Scope

```text
runtime_file_count=8
ninth_runtime_file_change=false
canonical_owner=knowledge
```

Exact Runtime paths:

```text
src/modules/knowledge/application/institution/knowledge-item-command-service.ts
src/modules/knowledge/server/institution-knowledge-command-repository.ts
src/modules/knowledge/tests/InstitutionKnowledgeCommandService.test.ts
src/modules/knowledge/tests/InstitutionKnowledgeCommandRepository.test.ts
src/server/orchestration/knowledge-institution-transaction.ts
src/server/orchestration/knowledge-institution-transaction.test.ts
src/modules/institution/server/institution-knowledge-write-repository.ts
src/modules/institution/tests/InstitutionKnowledgeManagementReadonlyService.test.ts
```

## Canonical attribution

Independent static review confirmed the command service requires exact non-empty:

```text
tenantId
institutionId
```

Identifier validation uses the canonical dynamic error contract `invalid_${field}`, with exact field arguments `tenant_id` and `institution_id`.

Create validates active `institutionScopes(tenantId, institutionId)` before any Knowledge content insert.

## Atomicity and CAS

```text
C1=create source + document + visibility
C2=update document + source
C3=archive document + source + files
```

The canonical repository is constructed from the transaction database by `runKnowledgeInstitutionTransaction`.

Update and archive each use database-level `expectedUpdatedAt` CAS on `knowledgeDocuments.updatedAt`.

Document/source ownership uses tenant + institution + object id. File archive scope is derived only after owned document/source resolution.

## Legacy blockade

```text
legacy_content_writers_blocked=4
legacy_content_direct_mutation=0
legacy_read_compatibility_retained=true
```

Blocked legacy Writers:

```text
createInstitutionKnowledgeSource
createInstitutionKnowledgeDocument
updateInstitutionKnowledgeDocument
archiveInstitutionKnowledgeDocument
```

## Capability and out-of-scope boundary

Institution Knowledge write Routes remain `503 capability_disabled`.

Independent blob comparison confirmed no changes to Schema, W3B quota Writer, Trial Provisioning, architecture-quality rules, or the two institution write Routes.

```text
schema_change=false
migration=false
database_execution=false
w3b_change=false
trial_provisioning_change=false
route_change=false
reader_release=false
capability_release=false
governance_exception_change=false
production_change=false
p2b_aq004_exception_retained=true
```

## Verification

Implementation evidence:

```text
targeted_test_files=7
targeted_tests=32_passed
full_test_files=475_passed
full_tests=6565_passed
lint=0_errors_4_existing_warnings
typecheck=passed
build=passed
architecture_unit_tests=148_passed
architecture_incremental_check=passed
required_check=passed
```

Independent review reran:

```text
targeted_test_files=7
targeted_tests=32_passed
typecheck=passed
architecture_incremental_check=passed
```

## Decision

```text
w3a_runtime_implementation=passed
w3a_runtime_independent_review=passed
w3a_complete_eligible=true
w3a_complete=false_before_handoff

w3b_runtime_authorized=false
w3_knowledge_complete=false
business_writer_phase_complete=false
```

No Runtime repair is required.

唯一下一任务：

`W3A docs-only Handoff`

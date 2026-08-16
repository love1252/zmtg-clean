# Knowledge Document Metadata Formal Runtime Release

- 日期：2026-08-16
- 基线：`c78de12759d10bb40a1aecc7dec0f65cf8fc110a`
- 任务：`KNOWLEDGE_DOCUMENT_METADATA_FORMAL_RUNTIME_RELEASE`
- Capability：`page_knowledge_library`
- Canonical API：`GET /api/v1/institution/knowledge-documents`
- Canonical Page：`/hospital/knowledge`

## Fresh Re-admission

```text
MIGRATION_0047=current
TARGET_ACTIVE_FORMAL_SCOPE_COUNT=1
TARGET_ACTIVE_BINDING_COUNT=1
FORMAL_SOURCE_COUNT=0
FORMAL_DOCUMENT_VERSION_COUNT=0
FORMAL_PUBLICATION_COUNT=0
KNOWLEDGE_DATA_READINESS=ready_empty
KNOWLEDGE_RUNTIME_ADMISSION_READY=true
```

Fresh audit 使用 local candidate 的 repeatable-read read-only transaction；0 行 formal cohort 是可信空状态，不 Seed、不复制 `mock|seed|demo`。

## 正式读取链

```text
formal signed server session
→ authoritative Identity
→ active Membership + Account→Institution Binding
→ active formal Institution Scope
→ knowledge section audience
→ knowledge_item/read action policy
→ dedicated one-shot Knowledge authorization
→ exact tenant/institution pair
→ canonical Knowledge formal Repository
→ low-sensitive metadata Reader
→ V1 API / readonly page
```

允许角色：

```text
tenant_admin=allowed
tenant_operator=allowed
consultant=forbidden
customer_service=forbidden
```

## 正式事实来源

只读取：

```text
knowledge_formal_document_publications
→ knowledge_formal_document_versions
→ knowledge_formal_sources
```

只返回：

```text
documentId
title
version
sourceLabel
publishedAt
```

禁止返回 provenance digest、document digest、actor、tenant/institution、正文、文件、Chunk、Embedding、索引任务、QA/AI 数据。

## Capability Authority

```text
page_knowledge_library:
  decision=read_only
  codeMaturity=verified
  institutionAuthorization=authorized
  connectionAvailability=not_required
  dataReadiness=ready
  productionRelease=pilot_released
  safeSummary=知识库资料仅供查看
```

最终 governed readonly pages：

```text
page_workbench
page_customer_list
page_care_appointments
page_knowledge_library
page_system_ai_usage
page_system_audit
```

Controlled Create release count 仍为 0。

## 边界

```text
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false
FILE_UPLOAD=false
FILE_DOWNLOAD=false
PARSE=false
OCR=false
EMBEDDING=false
INDEX_WORKER=false
QA_AI=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```


## Same-task corrective：TypeScript assertion parser

首轮 Targeted tests 发现两个纯语法问题：

1. `knowledge-document-metadata-reader.ts` 中的
   `record.source as InstitutionDocumentMetadataSourceV1` 被换行拆分；
2. `InstitutionKnowledgeDocumentsV1ApiRoute.test.ts` 中的
   `as URLSearchParams` 被换行拆分。

本 corrective 仅将两个 type assertion 收拢为合法 TypeScript 表达式。
没有改变 Runtime 业务语义，没有新增文件，也没有扩大 exact-20。

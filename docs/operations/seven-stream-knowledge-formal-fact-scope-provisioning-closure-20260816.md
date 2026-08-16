# Knowledge formal fact + Scope provisioning 完整闭环

- 日期：2026-08-16
- 基线：`207af4dcbfe0f43f4f54cb1cc5adfa6c0765fd00`
- 任务：`KNOWLEDGE_FORMAL_FACT_PROVENANCE_AND_SCOPE_PROVISIONING_CLOSURE`
- Migration：`0047_knowledge_formal_fact_provenance_scope`
- 本地目标：`127.0.0.1:55434/zmtg_clean_local_dev_candidate`

## 结论

```text
KNOWLEDGE_FORMAL_FACT_MODEL=ready
KNOWLEDGE_FORMAL_PROVENANCE=expressible
KNOWLEDGE_IMMUTABLE_PUBLICATION_MODEL=ready
KNOWLEDGE_DATA_READINESS=ready_empty

TARGET_ACTIVE_FORMAL_SCOPE_COUNT=1
TARGET_ACTIVE_BINDING_COUNT=1
SCOPE_PROVISIONING_STATE=reused_existing_formal_pair
SCOPE_PROVISIONING_DML_REQUIRED=false

FORMAL_SOURCE_COUNT=0
FORMAL_DOCUMENT_VERSION_COUNT=0
FORMAL_PUBLICATION_COUNT=0

MIGRATION_0047=applied_local_candidate
IMMUTABLE_VERSION_TRIGGER_COUNT=1
FORMAL_EXACT_PAIR_FK_COUNT=3
```

## 正式持久化模型

```text
knowledge_formal_sources
  → exact tenant/institution Scope
  → provenance_source =
      formal_onboarding | approved_migration_manifest

knowledge_formal_document_versions
  → exact source pair
  → immutable version row
  → UPDATE/DELETE trigger fail-closed

knowledge_formal_document_publications
  → current_version pointer
  → published | retired
  → positive publication revision
```

`mock|seed|demo` 继续只属于 compatibility/runtime foundation，不作为 formal provenance。

formal cohort 当前为可信空态；本任务没有 Seed、没有复制 demo/mock 数据、没有创建 Knowledge 业务事实。

## Same-task corrective

1. 新增 `0047` 后，历史 `Schema.test.ts` 仍把 journal 总长度锁死为 47。Corrective 保留 `0..45` 和 `0046` 原值，只显式承认 `0047` 为 index 47 的唯一新后继。
2. 首轮 full suite 继承了 Migration preflight 导出的 `DATABASE_URL`，使平台 Knowledge API 测试进入 repository 分支，并使 AI runtime smoke route 尝试数据库配置读取。Recovery-2 将数据库 URL 限定为单条 DB 命令的局部环境，测试进程显式移除 `DATABASE_URL`。该修正不修改 Runtime 代码。

## 执行边界

```text
DATABASE_CONNECTION=true
SCHEMA_CHANGE=true
MIGRATION_EXECUTION=true
DDL_EXECUTION=true
MIGRATION_JOURNAL_WRITE=true
BUSINESS_DML_EXECUTION=false
ORIGINAL_55433_DATABASE_WRITE=false

KNOWLEDGE_RUNTIME_IMPLEMENTATION=false
KNOWLEDGE_PAGE_RELEASE=false
PAGE_KNOWLEDGE_LIBRARY_STATE=hidden/not_released

STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

下一候选任务：

`KNOWLEDGE_DOCUMENT_METADATA_FORMAL_RUNTIME_FRESH_READMISSION`

未自动授权。

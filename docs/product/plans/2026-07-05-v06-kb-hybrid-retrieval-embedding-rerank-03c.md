# V0.6-KB-HYBRID-RETRIEVAL-EMBEDDING-RERANK-03C

日期：2026-07-05（本地时区）

## 1. 本轮完成能力

本轮在 03B RAG 问答治理闭环基础上补齐最小智能检索底座：

1. embedding provider contract。
2. mock / dry-run embedding provider。
3. OpenAI-compatible embeddings adapter，支持注入式 `fetchImpl`，测试只用 mock fetch。
4. parse succeeded + active file 的 chunk embedding 生成。
5. JSONB numeric array vector storage fallback。
6. keyword / vector / hybrid retrieval。
7. 按 `chunkId` 去重。
8. topK 3 / 5 / 10。
9. deterministic rerank。
10. Answer API 使用 hybrid retrieval sources。
11. 机构端检索测试台展示 keyword / vector / hybrid、matchReason、rerank 排序。
12. 片段列表展示 `embeddingStatus`。
13. 文件级“生成 / 重建向量索引”最小入口。
14. 低敏 usage / audit 延续既有白名单字段策略。

## 2. Embedding provider contract

新增/扩展位置：

- `src/modules/open-platform/server/platform-knowledge-embedding-vector-search-service.ts`

contract 只在服务端使用：

- 输入：`texts: string[]`。
- 服务端内部持有 provider / model / dimensions。
- 输出成功时返回 vectors / dimensions / provider / model。
- 输出失败时只返回低敏 `errorCode` 与 `safeMessage`。

已覆盖错误：

- `provider_disabled`
- `missing_config`
- `http_failure`
- `malformed_response`
- `timeout`
- `provider_failure`

机构端不展示：

- provider config
- provider id
- model
- token
- cost
- vendor
- baseUrl
- apiKey

## 3. Vector storage 方案

当前项目没有 pgvector / vector extension / HNSW / IVFFLAT。为避免强依赖本地未必存在的扩展，本轮采用既有最小可运行 fallback：

- 表：`knowledge_document_file_parse_chunk_embeddings`
- 字段：`embedding_vector_json jsonb`
- 类型：`number[]`
- 相似度：TypeScript 服务层 cosine similarity
- 搜索：先按 tenant / knowledge / file 取候选，再在服务层计算相似度与排序

后续若需要生产级向量索引，建议独立做 pgvector 专项：扩展安装、vector column、索引策略、迁移兼容、回填脚本与灰度策略。

## 4. DB / schema / migration

本轮新增最小 migration：

- `drizzle/0027_v06_kb_hybrid_retrieval_embedding_status.sql`

新增字段：

- `knowledge_document_file_parse_chunk_embeddings.failure_reason_code varchar(64)`

用途：

- 为 embedding 失败状态提供低敏错误码承载。
- 不保存原始 prompt、secret、provider response、API key、baseUrl 或 embedding provider 配置。

同步更新：

- `src/server/db/schema.ts`
- `drizzle/meta/_journal.json`

未新增 pgvector 依赖。

## 5. Hybrid retrieval 策略

新增/扩展：

- `searchInstitutionKnowledgeRetrievalChunksService`
- `searchPlatformKnowledgeRetrievalChunksService`

策略：

1. keyword branch：复用 parse chunk keyword 检索。
2. vector branch：复用 chunk embedding JSONB + cosine similarity。
3. hybrid：两路合并。
4. 去重：按 `chunkId`。
5. 过滤：tenant、institution visibility、active file、parse succeeded、embedding ready。
6. topK：支持 3 / 5 / 10。
7. response 字段：
   - `knowledgeId`
   - `knowledgeTitle`
   - `fileId`
   - `fileName`
   - `chunkId`
   - `chunkIndex`
   - `textPreview`
   - `retrievalMode`
   - `keywordScore`
   - `vectorScore`
   - `rerankScore`
   - `matchReason`

不返回 embedding array。

## 6. Rerank 策略

本轮不接真实外部 rerank provider。

采用 deterministic rerank：

- keyword overlap score
- normalized vector score
- chunk order score
- 综合排序

`matchReason` 标注 deterministic rerank，便于检索测试台解释排序来源。

## 7. Answer service 接入 hybrid sources

更新：

- `src/modules/institution/server/institution-knowledge-rag-answer-service.ts`
- `src/app/api/institution/knowledge-management/answer/route.ts` 保持安全壳与 usage/quota 逻辑

接入方式：

- 原 keyword-only `retrieveSources` 改为调用 institution hybrid retrieval。
- 无 sources：保持 `no_answer`，不调用 chat provider。
- quota exceeded：保持不调用 provider。
- provider disabled / failure：保持低敏文案。
- sources 对外包含 `retrievalMode` / `matchReason`。
- 不返回 prompt、messages、provider config、token、cost、vendor、embedding array。

## 8. Usage / audit 低敏策略

沿用既有：

- `knowledge_qa_audit_logs`
- `ai_call_usage_records`
- `recordKnowledgeRagAnswerUsageSuccess`

低敏策略：

- audit 写 question length / hash / topK / sourceCount / status / providerStatus 等摘要。
- usage metadata 只写知识库 source 白名单字段。
- 不写 raw prompt、raw messages、原始 provider response、embedding vector、API key、baseUrl、token、cost、vendor。

## 9. 未真实出网

本轮未真实出网。

OpenAI-compatible embeddings adapter 仅提供 contract 与注入式 fetch 能力；测试中只使用 mock fetch。

## 10. 未暴露字段

机构端 API / UI 不暴露：

- provider
- model
- token
- cost
- vendor
- apiKey
- baseUrl
- embedding array
- provider config

## 11. 未做能力

本轮明确未做：

- OCR
- PDF / Word / Excel 深度解析专项
- 生产级 worker
- cron
- queue
- 训练队列
- 真实外部 rerank provider
- 真实外部 embedding 调用
- 平台端租户 / 套餐 / 权益管理改造

## 12. 测试结果

待执行完整验证后补充最终结果。

计划运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests
node scripts/run-vitest.mjs run src/modules/open-platform/tests
node scripts/run-vitest.mjs run src/modules/knowledge-base/tests
node scripts/run-vitest.mjs run
./node_modules/.bin/eslint .
node scripts/run-next.mjs build --webpack
git diff --check
```

## 13. 风险与后续建议

1. JSONB + TypeScript cosine similarity 是最小闭环方案，不是生产级大规模向量检索方案。
2. 后续建议单独规划 pgvector migration、索引、回填与性能压测。
3. 当前 rerank 是 deterministic rerank，适合测试台和最小闭环；真实 rerank provider 应独立接入并继续保持低敏输出。
4. embedding provider 已有 OpenAI-compatible adapter contract，但本轮未配置真实凭证、未真实出网。
5. 如果要把 embedding / rerank 纳入 AI credits 单独计量，建议另起任务设计 quota resource 与 service attribution。
# V0.6-KB-END-TO-END-ACCEPTANCE-04A

日期：2026-07-06

时区：Asia/Shanghai

仓库：`love1252/zmtg-clean`

本地路径：`/Users/dongxiaolong/Documents/zmtg-clean`

分支：`docs/kb-e2e-acceptance-04a`

HEAD：`7ec0c39712492268228952365e50e7c7a0c2b7fe`

## 1. 本轮任务边界

本轮是 V0.6 知识库 03A-03G 合并后的本地 5010 端到端验收与 docs-only 收口。

本轮只做：

1. 本地 5010 验收。
2. 本地安全验收 DB migration / schema 检查。
3. 上传、解析、向量索引、hybrid retrieval、RAG answer 低敏边界、OCR-ready 边界、quota / entitlement / audit 证据检查。
4. docs-only 验收报告。

本轮明确不是：

1. 不改业务代码。
2. 不改 schema / migration。
3. 不改 `package.json` / lockfile。
4. 不连接生产库。
5. 不输出 secret、API key、`DATABASE_URL` 原值或 provider config。
6. 不接真实外部 AI provider、真实 OCR provider、真实 HIS、支付、计费、发票或生产配置。
7. 不新增 worker / queue / cron / scheduler。

## 2. 启动与同步能力检查

启动检查：

| 项 | 结果 |
| --- | --- |
| 日期 | `2026-07-06` |
| 当前分支 | `docs/kb-e2e-acceptance-04a` |
| HEAD | `7ec0c39712492268228952365e50e7c7a0c2b7fe` |
| `main` | `7ec0c39712492268228952365e50e7c7a0c2b7fe` |
| `origin/main` | `7ec0c39712492268228952365e50e7c7a0c2b7fe` |
| 初始 dirty | 仅 `next-env.d.ts`，为 Next dev 自动声明路径变化 |
| 处理方式 | 按授权仅恢复 `next-env.d.ts`，未 reset、未删除文件 |

同步能力检查：

| 检查 | 结果 |
| --- | --- |
| `.git` 写探针 | 通过 |
| `git fetch --dry-run` | 通过 |
| `gh --version` | `2.93.0` |
| GitHub auth | 已认证到 `github.com`，未输出 token |
| repo/default branch | `love1252/zmtg-clean` / `main` |

## 3. 当前合并基线

本轮验收覆盖当前 `main` 已合并的 V0.6 知识库链路：

| PR | 内容 |
| --- | --- |
| #446 | RAG answer 最小闭环 03A |
| #447 | 真实 provider 治理、metering、audit 03B |
| #448 | hybrid retrieval、embedding、rerank 03C |
| #450 | DB-backed indexing job flow 03D |
| #451 | TXT / MD / PDF / DOCX / XLSX / CSV 解析 03E |
| #452 | OCR-ready 扫描件 / 图片文字识别边界 03F |
| #453 | 知识库权益、quota、套餐联动 03G |

## 4. 本地 5010 环境

本地验收使用项目内脚本：

```bash
scripts/dev/local-acceptance-db.sh ensure
scripts/dev/local-acceptance-db.sh migrate
scripts/dev/local-acceptance-db.sh verify
scripts/dev/local-acceptance-db.sh dev
```

环境结论：

1. 本地 PostgreSQL container：`zmtg-local-acceptance-pg`。
2. 本地 DB：`zmtg_clean_local_acceptance`。
3. DB 绑定：`127.0.0.1:55432`。
4. migration 执行成功。
5. `failure_reason_code` 字段存在。
6. 5010 Next dev 进程来自当前仓库。
7. 5010 进程父进程 `DATABASE_URL` 检查结果为 localhost-only，未输出原值。
8. `GET /api/version` 返回当前 commit：`7ec0c39712492268228952365e50e7c7a0c2b7fe`。

schema 检查：

| 检查项 | 结果 |
| --- | --- |
| `knowledge_indexing_jobs` | 存在 |
| `knowledge_quota_usage_records` | 存在 |
| `knowledge_indexing_job_type = ocr_file` | 存在 |
| `knowledge_document_file_parse_chunk_embeddings.failure_reason_code` | 存在 |

## 5. 本地 5010 验收证据

登录与页面：

| 验收项 | 结果 |
| --- | --- |
| 机构端 demo 登录 | 200，`tenant_admin`，`growth-tenant-chengxing` |
| `GET /api/auth/session` | 200，`institutionId=growth-inst-chengxing` |
| `GET /hospital` | 200 |
| `GET /api/institution/knowledge-management/items` | 200 |
| `GET /api/institution/entitlement-usage` | 200，返回 12 项额度 |
| `GET /api/institution/knowledge-management/indexing-jobs` | 200 |

新建本地验收 TXT 文件：

| 步骤 | 结果 |
| --- | --- |
| `POST /api/institution/knowledge-management/upload` | 201 |
| 文件 | `zmtg-04a-fresh-aftercare.txt` |
| `knowledgeId` | `inst-doc-0cf001efd2cfa0a8858fd54b1202560161f7e501` |
| `fileId` | `kb-file-c9d734bb-328b-4e70-b742-4a665bdcb815` |
| parse status | `succeeded` |
| parser | `local-real-file-parser-v2` |
| chunk count | 1 |

向量索引：

| 步骤 | 结果 |
| --- | --- |
| `POST /items/{knowledgeId}/files/{fileId}/embeddings` | 200 |
| job type | `generate_embeddings` |
| job status | `succeeded` |
| processed / failed | `1 / 0` |
| chunk `embeddingStatus` | `ready` |

检索：

| mode | 结果 |
| --- | --- |
| `keyword` | 200，命中 1 条，`keywordScore=1` |
| `vector` | 200，命中 1 条，返回 `vectorScore`，不返回 embedding array |
| `hybrid` | 200，命中 1 条，包含 keyword + vector + deterministic rerank |

RAG answer：

| 验收项 | 结果 |
| --- | --- |
| `POST /api/institution/knowledge-management/answer` | 503 |
| status | `provider_disabled` |
| sources | 1 条，来自本轮 TXT chunk |
| 结论 | 本地未配置真实 provider 时返回低敏禁用态，保留 sources，未返回 provider config / model / token / cost / vendor |
| 机构端选择模型字段 | 400，`INSTITUTION_AI_MODEL_SELECTION_FORBIDDEN` |

OCR-ready：

| 步骤 | 结果 |
| --- | --- |
| 上传 PNG 边界文件 | 201 |
| parse status | `failed` |
| OCR status | `ocr_required` |
| safe message | 当前为 OCR-ready 最小闭环，尚未接入生产 OCR 服务 |
| chunk count | 0 |

quota / entitlement / audit：

| 验收项 | 结果 |
| --- | --- |
| entitlement usage | 12 项额度，知识库条目 / 文件 / 解析 / 向量 / OCR / RAG / 索引重建 / AI 调用均可读 |
| quota usage records | 记录 upload、parse、embedding、OCR-ready、RAG answer 等低敏决策 / 结果 |
| QA audit | 记录 question length / hash / topK / sourceCount / status / answerLength 等低敏摘要 |
| forbidden 字段扫描 | 通过 |

forbidden 字段扫描覆盖本轮响应快照：

1. `version.json`
2. `session.json`
3. `items.json`
4. `files.json`
5. `chunks.json`
6. `retrieval-hybrid.json`
7. `answer.json`
8. `entitlement.json`
9. `jobs.json`
10. `audits.json`

扫描未发现：

`apiKey`、`baseUrl`、`model`、`token`、`cost`、`vendor`、`embeddingVectorJson`、`embedding_vector_json`、`storageKey`、`signedUrl`、`authorization`、`bearer`、`DATABASE_URL`、`prompt`、`rawResponse`、`secret`。

## 6. 自动化测试

本轮执行知识库相关 Vitest 切片：

```bash
node scripts/run-vitest.mjs run \
  src/modules/institution/tests/InstitutionKnowledgeUploadService.test.ts \
  src/modules/institution/tests/InstitutionKnowledgeUploadApiRoute.test.ts \
  src/modules/institution/tests/InstitutionKnowledgeRagAnswerService.test.ts \
  src/modules/institution/tests/InstitutionKnowledgeAnswerApiRoute.test.ts \
  src/modules/institution/tests/InstitutionKnowledgeReadonlyShell.test.tsx \
  src/modules/institution/tests/InstitutionKnowledgeBaseCardPanel.test.tsx \
  src/modules/institution/tests/InstitutionEntitlementUsageApiRoute.test.ts \
  src/modules/institution/tests/EntitlementUsageView.test.ts \
  src/modules/open-platform/tests/PlatformKnowledgeIndexingJobService.test.ts \
  src/modules/open-platform/tests/PlatformKnowledgeDocumentParsingService.test.ts \
  src/modules/open-platform/tests/PlatformKnowledgeEmbeddingVectorSearchService.test.ts \
  src/modules/open-platform/tests/PlatformKnowledgeEmbeddingVectorSearchApiRoute.test.ts
```

结果：

1. Test Files：12 passed。
2. Tests：185 passed。
3. 存在既有 React test warning：部分 state update 未包裹 `act(...)`、list key warning；本轮未修改 runtime，未在本 docs-only 任务内处理。

## 7. 结论

本地 5010 验收结论：通过，带约束 Go。

可确认：

1. 当前 `main` commit 已可在本地 5010 使用 localhost-only DB 启动。
2. 本地 migration 能应用到安全验收 DB。
3. 机构端上传 TXT -> parse -> chunk -> generate embeddings -> keyword/vector/hybrid retrieval 能形成最小闭环。
4. RAG answer 在本地未配置真实 provider 时进入低敏 `provider_disabled` 边界，并保留可核对 sources。
5. OCR-ready 文件进入 `ocr_required` 边界，不生成脏 chunk。
6. entitlement / quota / indexing job / QA audit 均有本地证据。
7. API response 未暴露 secret、provider config、embedding array、prompt、raw response、token、cost 或 vendor。

约束：

1. 本地未启用真实外部 AI provider，因此本轮不证明真实模型回答质量。
2. 本地未启用真实 OCR provider，因此本轮只证明 OCR-ready 边界。
3. 本轮只证明 localhost-only 本地验收，不替代测试服、生产库、生产 provider、真实 OCR 或性能验收。
4. 本地验收 DB 中存在早先 04A 临时数据和一个旧的 `rebuild_knowledge_index` failed job；本报告结论基于 02:31 后重新执行的新 TXT / PNG 验收链路。

## 8. 后续上线前仍需单独审批

以下内容不属于本轮 04A：

1. 测试服复验。
2. 真实 provider 配置与 secret 治理。
3. 真实 OCR 服务接入。
4. pgvector / 生产级向量索引。
5. worker / queue / cron / scheduler。
6. 生产性能压测。
7. 生产 quota 并发锁与计费对账。

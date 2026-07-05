# V0.6 KB Indexing Job Pipeline 03D

日期：2026-07-05

## 目标

本轮将知识库文件解析、向量索引生成、文件级向量重建、知识条目级索引重建统一沉淀为 DB-backed minimal indexing job flow。

## 范围

- 新增 `knowledge_indexing_jobs` 表与 `knowledge_indexing_job_type` / `knowledge_indexing_job_status` enum。
- 支持 job 类型：
  - `parse_file`
  - `generate_embeddings`
  - `rebuild_embeddings`
  - `rebuild_knowledge_index`
- 支持 job 状态：
  - `pending`
  - `running`
  - `succeeded`
  - `failed`
  - `cancelled`
- API 收到请求后创建 job，并在当前请求内执行最小任务。
- 任务执行过程中更新 `running`、完成后更新 `succeeded`，失败后更新 `failed`。
- 失败只记录低敏 `failureReasonCode` 与 `safeMessage`。
- 机构端仅能查看、创建、取消本机构可见范围内的任务。

## 明确不包含

- 不做生产级 worker / queue / cron。
- 不引入 BullMQ、Redis、Sidekiq、Celery 等队列。
- 不新增 worker daemon。
- 不新增外部依赖。
- 不做 OCR。
- 不做复杂 PDF / Word / Excel 深度解析。
- 不真实调用外部 embedding provider。
- 不依赖 pgvector。
- 不展示 provider / model / token / cost / vendor / embedding array。
- 不改平台端租户 / 套餐 / 权益管理。
- 不改 auth / session 核心。

## 数据设计

新增表 `knowledge_indexing_jobs`，包含：

- `job_id`
- `tenant_id`
- `institution_id`
- `actor_user_id`
- `knowledge_id`
- `file_id`
- `job_type`
- `status`
- `total_count`
- `processed_count`
- `failed_count`
- `failure_reason_code`
- `safe_message`
- `metadata_json`
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

`metadata_json` 仅允许低敏 counts、scope、mode，不放 secret、provider、embedding array、prompt 或原始响应。

## 服务层

新增 indexing job service：

- `createKnowledgeIndexingJob`
- `runKnowledgeIndexingJob`
- `listInstitutionKnowledgeIndexingJobs`
- `getKnowledgeIndexingJob`
- `cancelKnowledgeIndexingJob`
- `createAndRunParseFileJob`
- `createAndRunGenerateEmbeddingsJob`
- `createAndRunRebuildEmbeddingsJob`
- `createAndRunRebuildKnowledgeIndexJob`

取消语义：只允许 `pending` 取消为 `cancelled`；`running` 不强杀。

## API

新增机构端 API：

- `GET /api/institution/knowledge-management/indexing-jobs`
- `POST /api/institution/knowledge-management/indexing-jobs`
- `GET /api/institution/knowledge-management/indexing-jobs/[jobId]`
- `POST /api/institution/knowledge-management/indexing-jobs/[jobId]/cancel`

保留原文件级 embeddings route，但改为创建并执行 indexing job 后返回低敏 job DTO。

## UI

机构端知识库页面新增“索引任务”区域：

- 展示最近任务列表。
- 展示 jobType、status、进度、失败低敏原因、更新时间。
- 支持刷新任务。
- pending 任务支持取消。
- 文件级“生成 / 重建向量索引”改为创建 job 并显示 job 状态。
- 知识条目新增“重建当前知识索引”入口。
- 页面明确当前为 DB-backed minimal job flow，不是生产级队列、OCR、复杂文档解析或训练系统。

## 安全边界

机构端隔离使用 `tenantId + institutionId`，并沿用知识可见性规则：

- `knowledge.institutionId === institutionId`
- 或 `visibleInstitutionIds.includes(institutionId)`

跨机构请求返回低敏 forbidden / not_found，不执行 parse、embedding、rebuild。

API response 白名单仅包含任务基础字段、状态、进度、低敏失败原因和时间字段，不返回向量数组、provider、model、token、cost、vendor、prompt、原始响应、API key、baseUrl 或 secret。

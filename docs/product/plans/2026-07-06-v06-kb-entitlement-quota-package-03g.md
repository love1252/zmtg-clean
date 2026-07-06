# V0.6-KB-ENTITLEMENT-QUOTA-PACKAGE-03G

日期：2026-07-06

## 目标

- 平台端可配置知识库 / AI / OCR / 索引任务相关套餐权益。
- 机构端上传、解析、向量、OCR、RAG 问答和索引重建在服务端受额度治理。
- 超额或能力未启用时返回低敏提示，不创建任务，不调用 parse / embedding / OCR / chat provider。
- 平台端展示租户当前权益、已用量、剩余额度。
- 机构端只展示可用额度、已用量、剩余额度和低敏不可用原因。

## 权益项

覆盖以下资源键：

- `knowledge_items`
- `knowledge_files`
- `knowledge_total_storage_mb`
- `knowledge_single_file_size_mb`
- `knowledge_parse_jobs_monthly`
- `knowledge_embedding_jobs_monthly`
- `knowledge_ocr_jobs_monthly`
- `knowledge_rag_answers_monthly`
- `knowledge_index_rebuild_jobs_monthly`
- `ai_calls`

## 服务端校验点

- 上传前检查知识条目、文件数、单文件大小、总容量；拒绝时不创建 source / document / file / job。
- `parse_file` job 创建前检查解析月额度。
- `generate_embeddings` / `rebuild_embeddings` job 创建前检查向量月额度。
- `ocr_file` job 创建前检查 OCR 能力和 OCR 月额度。
- parse 内部触发 OCR provider 前再次检查 OCR 能力和 OCR 月额度，避免绕过独立 OCR job 入口。
- `rebuild_knowledge_index` job 创建前检查索引重建月额度。
- RAG answer provider 调用前检查知识库问答月额度，并继续复用 AI 调用额度。

## 低敏 usage / audit

新增 `knowledge_quota_usage_records` 记录：

- `tenantId`
- `institutionId`
- `actorUserId`
- `resourceKey`
- `action`
- `status`
- `quantity`
- `createdAt`
- `safeReasonCode`

禁止记录：prompt 原文、完整 OCR 文本、完整解析文本、embedding 数组、provider raw response、API key、baseUrl、secret、token 成本、provider cost。

## UI 边界

平台端：

- 套餐草稿编辑支持配置知识库条目、文件数、容量、单文件、解析、向量、OCR、问答、索引重建额度和 OCR 能力开关。
- 套餐权益对照展示新增知识库额度列。
- 租户实时权益用量通过 entitlement usage items 展示新增资源。

机构端：

- “我的知识库套餐权益”仅展示额度、已用量、剩余量和状态。
- 上传、OCR、向量、问答、索引重建按钮根据额度状态禁用并显示低敏原因。
- 不展示 provider / model / token / cost / vendor / 内部计费规则。

## 非目标

- 不做真实支付。
- 不做账单扣费。
- 不做发票。
- 不接第三方支付。
- 不接真实云 OCR。
- 不真实出网。
- 不改 auth / session 核心。
- 不改 provider 密钥管理。
- 不做复杂财务系统。

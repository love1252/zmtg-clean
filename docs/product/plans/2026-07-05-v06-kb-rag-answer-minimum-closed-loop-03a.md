# V0.6-KB-RAG-ANSWER-MINIMUM-CLOSED-LOOP-03A

日期：2026-07-05

## 完成内容

本轮在机构端知识库最小闭环上新增 RAG 问答最小闭环：

1. 新增机构端独立 `AiChatProvider` contract。
2. 新增 mock / dry-run provider factory。
3. 新增机构端 RAG answer service。
4. 新增机构端 Answer API route。
5. 在机构端知识库页面新增“知识库问答”区域。
6. 补充 provider、service、API route、UI 的单元测试 / 组件测试。

## 当前召回策略

当前先使用现有 keyword / chunk 召回能力组装上下文，不接向量数据库，不做 embedding，不做 rerank。

- `question` 会先派生检索关键词。
- 只使用当前 `tenantId` 下的知识数据。
- 只使用当前 `institutionId` 自有或被授权可见的知识条目。
- 只使用 `active` 文件和 `succeeded` parse chunk。
- `topK` 默认 5，只允许 3 / 5 / 10。

## mock / dry-run provider

本轮默认使用机构端独立 mock / dry-run provider。

- 不调用真实外部 AI。
- 不读取 `.env.local`。
- 不读取或输出 `DATABASE_URL`、API key、secret。
- 不依赖 open-platform provider adapter 作为机构端最终 provider。
- 不返回 prompt 全文。
- 不返回模型、Token、成本、厂商。

## no-hit 策略

当 keyword / chunk 无命中时：

- 返回 `status=no_answer`。
- 返回 `noAnswerReason=no_retrieval_hit`。
- 返回文案：`未在当前知识库中找到足够依据。仅供内部运营参考，需人工确认`。
- 不调用 provider。
- 不编造来源。

## sources 策略

有命中时返回答案和引用来源。每个 source 至少包含：

- `knowledgeId`
- `knowledgeTitle`
- `fileId`
- `fileName`
- `chunkIndex`
- `textPreview`

UI 会在答案下方展示引用来源，包含知识条目、文件名、`chunkIndex` 和片段预览。

## 低敏失败策略

provider 失败时返回低敏错误：

- `provider_unavailable` 或 `service_unavailable`
- 文案：`知识库问答服务暂时不可用，请稍后重试`
- answer 追加 `仅供内部运营参考，需人工确认`
- 保留已召回 sources 便于运营人员核对
- 不返回 prompt、provider config、模型、Token、成本、厂商、errorCode、latency、usage

## 租户 / 机构隔离

`tenantId` / `institutionId` 只由服务端 access context 注入，前端 body 中不允许作为可信字段。

RAG answer service 会再次过滤：

- chunk `tenantId` 必须等于当前 `tenantId`
- knowledge `tenantId` 必须等于当前 `tenantId`
- knowledge 必须属于当前机构，或 `visibleInstitutionIds` 包含当前机构

## 未包含内容

本轮未包含以下能力：

- 未接真实外部 AI provider
- 未做 embedding
- 未接向量数据库
- 未做 rerank
- 未做 OCR
- 未做复杂 PDF / Word / Excel 深度解析
- 未做训练 runtime
- 未做生产级队列 / worker / cron
- 未接 usage 持久化
- 未新增 audit 持久化
- 未做 quota 扣减
- 未改平台端租户 / 套餐 / 权益管理
- 未大改 `institution-ai-call-service`

## 数据库 / 依赖边界

本轮未改 DB schema，未新增 migration，未修改 `drizzle/**`，未修改 `src/server/db/**`，未修改 `package.json`，未修改 lock 文件，未引入新依赖。

## 测试覆盖

新增和更新的测试覆盖：

- provider contract mock 调用成功
- provider 不可用低敏返回
- question 为空 validation_failed
- question 超长 validation_failed
- topK 默认 5
- topK 只允许 3 / 5 / 10
- 无 chunk 命中返回 no_answer
- 无 chunk 命中不调用 provider
- 有 chunk 命中调用 provider
- answer 返回 sources
- sources 字段完整
- provider failure 低敏错误
- 不返回 prompt 全文
- 不返回模型 / token / 成本 / 厂商
- 租户 / 机构隔离
- answer 包含 `仅供内部运营参考，需人工确认`
- Answer API 未授权 401
- Answer API 非机构 tenant scope 403
- Answer API validation_failed 400
- 问答台渲染
- 问答台提问成功
- 问答台 no_answer 状态
- 问答台 provider error 状态
- 新一轮提问清空旧答案
- sources 在 UI 展示
- 不触发 embedding / vector / rerank / OCR / training
- 现有检索测试台不回归
- 现有上传 / chunk / parse / 新建 / 编辑 / 归档不回归

## 风险与后续

1. 当前答案来自 mock / dry-run provider，只用于闭环验证，不代表真实 LLM 质量。
2. 当前召回为 keyword / chunk，尚未接向量检索，语义召回能力有限。
3. usage / audit / quota 需要后续单独设计，避免与当前最小闭环混杂。
4. 接真实 provider 前需要另行完成 secret 管理、超时、重试、审计、配额和敏感信息策略复核。

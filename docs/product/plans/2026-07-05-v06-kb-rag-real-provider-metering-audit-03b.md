# V0.6-KB-RAG-REAL-PROVIDER-METERING-AUDIT-03B

日期：2026-07-05

## 本轮完成

本轮在机构端知识库 RAG answer dry-run 基础上补齐真实调用治理闭环：

1. 保留 `mock / dry-run` provider contract。
2. 新增 OpenAI-compatible provider adapter。
3. 新增机构端最小 provider resolver contract。
4. `/api/institution/knowledge-management/answer` 接入服务端 provider resolver、quota 前置校验、usage 记录和低敏 QA audit。
5. UI 补齐 `quota_exceeded`、`provider_disabled`、`provider_failure` 状态展示。

## Provider config 解析

机构端不接收 provider / model / vendor 选择字段。Answer API 仅接受 `question` 和 `topK`，tenantId / institutionId / actorUserId 均来自服务端 access context。

服务端使用默认 vendor，并通过现有 provider config repository 查询平台已保存配置：

- missing config -> `provider_disabled`
- configured=false -> `provider_disabled`
- secret 解密失败 -> `provider_disabled`
- ready -> 创建 OpenAI-compatible adapter

adapter 使用服务端解析后的 `baseUrl`、`model`、`apiKey`，并支持注入式 `fetch`。测试使用 mock fetch，不真实出网。

## 机构端低敏边界

机构端响应不返回：

- prompt
- provider config
- API key / secret
- provider / vendor
- model
- Token
- 成本
- 原始 provider response

UI 继续提示：

- 当前仍不是向量检索
- 不展示模型、Token、成本、厂商
- 仅供内部运营参考，需人工确认

## Quota / entitlement 前置

`answerInstitutionKnowledgeRagQuestion` 先做关键词 / chunk 召回：

1. `no_answer`：不检查 quota、不调用 provider、不记录成功 usage，仅写低敏 audit。
2. 有 sources：执行 `ai_calls` quota check。
3. quota 不足：写 quota rejection usage，不调用 provider，返回 `quota_exceeded`，并写低敏 audit。
4. quota 通过：解析 provider 并调用 OpenAI-compatible adapter。

## Usage 记录

provider success 后，通过现有 `ai_call_usage_records` 写入成功 usage：

- `tenantId`
- `institutionId`
- `actorUserId`
- provider / model 仅存服务端 usage 表，不返回机构端
- prompt / completion token 仅用于服务端 usage，不返回机构端
- RAG metadata 仅保存 sources 白名单字段

provider failure 不记录成功 usage。

## QA audit 低敏记录

复用现有 `knowledge_qa_audit_logs`，不新增 schema / migration。由于既有 schema 包含 `question` / `answerPreview` 字段，本轮写入低敏摘要，不写原始问题和完整答案：

- `questionLength`
- `questionHash`
- `topK`
- `sourceCount`
- `status`
- `providerStatus`
- `answerLength`
- `createdAt`

状态覆盖：

- `answered`
- `no_answer`
- `quota_exceeded`
- `provider_disabled`
- `provider_failure`

## no_answer / failure / disabled / quota_exceeded

- `no_answer`：不调用 provider、不扣 quota、不写成功 usage、写低敏 audit。
- `quota_exceeded`：不调用 provider，写 quota rejection usage 和低敏 audit。
- `provider_disabled`：不调用 provider，写低敏 audit。
- `provider_failure`：返回低敏错误，写失败 audit，不写成功 usage。

## 未包含内容

本轮未做：

- DB schema / migration
- drizzle/** 修改
- src/server/db/** 修改
- 新依赖
- embedding
- vector database
- rerank
- OCR
- 训练 runtime
- worker / cron / queue
- 平台端租户 / 套餐 / 权益管理 UI
- 真实出网 smoke
- 部署

## 测试结果

最终验证命令均已执行：

- `node scripts/run-vitest.mjs run src/modules/institution/tests`：71 files passed，1074 tests passed。
- `node scripts/run-vitest.mjs run src/modules/open-platform/tests`：93 files passed，627 tests passed。
- `node scripts/run-vitest.mjs run src/modules/knowledge-base/tests`：11 files passed，80 tests passed。
- `node scripts/run-vitest.mjs run`：211 files passed，2135 tests passed。
- `./node_modules/.bin/eslint .`：0 errors，4 warnings；warnings 均为既有 `<img>` / `next/image` 建议，未在本任务范围内修改。
- `node scripts/run-next.mjs build --webpack`：构建通过；存在既有 `metadataBase` warning，未影响构建。

## 风险与后续建议

1. `knowledge_qa_audit_logs` 既有字段名仍为 `question` / `answerPreview`，本轮以低敏摘要填充；后续如需更清晰审计语义，建议在独立任务中评估 schema 演进。
2. quota check 与 usage 写入不是强事务锁，极端并发下仍可能存在额度竞争；后续可设计数据库级幂等 / 锁策略。
3. 本轮仍基于关键词 / chunk 召回，不是向量 RAG。

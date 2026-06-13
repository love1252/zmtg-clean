# 知识库 V1 生产级治理底座方案 01

日期 / 时区：2026-06-14 / CST +0800

任务：目标任务 9-1：知识库生产级安全策略、权限矩阵与运行配置底座

## 当前已完成内部闭环

知识库 V1 已完成内部受控闭环：

```text
平台知识库管理
→ 机构授权
→ 文件上传 / 下载 / 归档
→ 文档解析
→ chunk 切分
→ 关键词检索
→ mock embedding
→ 向量检索
→ mock/local QA
→ 引用来源
→ QA 审计写入
→ QA 审计查询
→ QA 用量限制
→ 最终验收缺口文档
```

该闭环可以用于内部受控演示、内部验收和产品评审，但仍不等同于生产级 AI 知识库。

## 本次新增生产级治理底座

本次新增生产级治理底座，目标是先把“哪些能力已启用、哪些能力仍禁用、谁能做什么、哪些字段禁止返回、QA 用量如何限制”集中成可测试、可审计的 policy，而不是直接进入真实 AI 或 runtime。

本次治理底座包括：

1. 能力开关：集中声明 `fileManagement`、`documentParsing`、`keywordSearch`、`mockEmbedding`、`vectorSearch`、`mockQa`、`qaAudit`、`qaQuota`、`realAiProvider`、`ocr`、`runtimeIngestion`、`productionVectorStore`。
2. 权限矩阵：覆盖平台端动作、机构端允许动作和机构端禁止动作。
3. QA 用量策略集中化：tenant 每日 100 次，institution 每日 30 次。
4. 低敏字段：明确允许返回的业务 ID、状态、摘要、预览和审计字段。
5. 禁止返回字段：明确禁止 `storageKey`、本地路径、全文、向量、SQL、stack、token、secret、prompt 等敏感内容。
6. capability API：平台端只读查看生产能力状态。
7. 平台端 UI：最小展示“生产能力状态”，避免把未启用能力误解为可用。

## 能力开关

当前 enabled：

1. `fileManagement`
2. `documentParsing`
3. `keywordSearch`
4. `mockEmbedding`
5. `vectorSearch`
6. `mockQa`
7. `qaAudit`
8. `qaQuota`

当前 disabled：

1. `realAiProvider`
2. `ocr`
3. `runtimeIngestion`
4. `productionVectorStore`

所有 disabled 能力必须带中文禁用原因和进入条件。系统不得用任何文案暗示真实 AI、OCR 或 runtime ingestion 已经可用。

## 权限矩阵

平台端允许：

1. 查看知识库。
2. 上传文件。
3. 归档文件。
4. 发起解析。
5. 生成 mock embedding。
6. 关键词检索。
7. 向量检索。
8. QA 问答。
9. 查看 QA 审计。
10. 管理机构授权。

机构端允许：

1. 查看授权知识库。
2. 下载授权文件。
3. 查看解析片段。
4. 关键词检索。
5. 向量检索。
6. QA 问答。
7. 查看本机构 QA 审计。

机构端明确禁止：

1. 上传平台知识库文件。
2. 归档文件。
3. 发起解析。
4. 生成 embedding。
5. 管理 visibility。
6. 查看其他机构审计。
7. 访问其他 tenant 数据。

## QA 用量策略集中化

QA 用量策略集中到 policy：

1. tenant 每日 QA：100 次。
2. institution 每日 QA：30 次。
3. 超限文案：`当前知识库问答次数已达上限，请稍后再试`。
4. 超限时不得执行召回。
5. 超限时不得执行向量计算。
6. 超限时不得进入问答编排。
7. 当前不接计费系统。

## 低敏字段

允许返回的低敏字段包括：

1. `knowledgeId`
2. `tenantId`
3. `institutionId`
4. `fileId`
5. `chunkId`
6. `auditId`
7. 标题、分类、状态、来源类型。
8. 低敏摘要或 `descriptionPreview`。
9. 文件名、mimeType、大小、hash、状态、时间。
10. `chunkIndex`、`charCount`、`textPreview`。
11. `question`、`answerPreview`。
12. `retrievalMode`、`citationCount`、`safeStatus`、`safeFailureMessage`。
13. `createdAt`、`updatedAt`。

## 禁止返回字段

禁止返回字段包括：

1. `storageKey`
2. 本地路径，例如 `/Users/`
3. `textContent`
4. `rawContent`
5. `parsedContent`
6. `embeddingVectorJson`
7. `trainingContent`
8. `SQL`
9. `stack`
10. `token`
11. `secret`
12. `DATABASE_URL`
13. 真实 AI 原始响应
14. `prompt`
15. `system prompt`

## 当前未开启真实 AI

当前未开启真实 AI，也未接入真实第三方 AI provider、模型网关或外部推理服务。当前 QA 仍是 mock/local QA，仅用于内部闭环验证。

### 真实 AI 前置条件

进入真实 AI 前必须完成：

1. provider 选型与调用边界评审。
2. 密钥治理、环境变量、轮换和最小权限策略。
3. 调用审计、限流、熔断、成本预算和告警。
4. prompt / completion 保留策略和脱敏策略。
5. QA 质量评估集、引用准确率评估和人工抽检流程。
6. 安全拒答策略、敏感信息检测和事故响应流程。

## 当前未开启 OCR

当前未开启 OCR，也未接入图片文字识别、扫描件识别或多模态解析。当前解析仍以受控文本抽取和低敏 chunk 为边界。

### OCR 前置条件

进入 OCR 前必须完成：

1. OCR provider 或本地 OCR 方案评审。
2. 文件类型、大小、病毒扫描和上传安全策略。
3. 识别质量验收、失败补偿和人工复核流程。
4. OCR 成本、限流、审计和错误文案策略。

## 当前未开启 runtime ingestion

当前未开启 runtime ingestion，也未启用队列、worker、scheduler、自动索引流水线或后台重试流程。

### runtime ingestion 前置条件

进入 runtime ingestion 前必须完成：

1. 队列、worker、scheduler 架构方案评审。
2. 幂等、重试、死信、回滚和暂停恢复方案。
3. 租户隔离、权限裁剪和审计策略。
4. 可观测性、告警、容量和灾备方案。
5. schema / migration 如有需要必须单独审批。

## Go / No-Go 判断

Go：生产级治理底座进入内部评审。

理由：

1. 能力开关、权限矩阵、QA 用量策略和敏感字段策略已经集中。
2. 平台端可只读查看 capability 状态。
3. 真实 AI / OCR / runtime ingestion / 真实向量数据库保持 disabled。

No-Go：生产级 AI 知识库上线。

理由：

1. 未接真实 AI。
2. 未接 OCR。
3. 未做 runtime ingestion。
4. 未接真实向量数据库。
5. 未完成生产级安全策略、质量评估、浏览器级 E2E 和真实客户数据合规审查。

## 下一步建议

下一阶段建议优先：

1. 生产级安全策略细化。
2. 权限矩阵评审与安全审查。
3. 真实 AI 接入方案评审。
4. QA 质量评估集和引用准确率评估。
5. 浏览器级 E2E。

不建议马上进入首页编辑、真实 AI、OCR、runtime ingestion、训练、dashboard 或非知识库模块。

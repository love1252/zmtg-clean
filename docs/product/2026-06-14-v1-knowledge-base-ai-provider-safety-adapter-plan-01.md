# 知识库 V1 AI provider 安全适配层方案 01

日期 / 时区：2026-06-14 / CST +0800

任务：目标任务 9-2：知识库 AI provider 安全适配层

## 本次只做 provider 抽象和安全适配层

本次只做 provider 抽象和安全适配层，用于把真实 AI 接入前的输入、输出、状态和降级边界先集中到可测试模块中。

本次不改变生产能力开关结论：真实 AI 仍为 disabled，平台端只能看到“真实 AI 未启用”和“适配层已准备”。

## 范围边界

本次明确：

1. 未接真实第三方 AI。
2. 未读取真实密钥。
3. 未调用外部网络。
4. 未接 OCR。
5. 未接 runtime ingestion。
6. 未接真实向量数据库。
7. 未做训练。
8. 未接计费系统。
9. 未进入首页编辑、dashboard 或非知识库模块。

## provider 抽象

AI provider 适配层包含：

1. `KnowledgeAiProvider` 抽象接口。
2. `mockLocalProvider` 默认启用，用于受控本地问答。
3. `realAiProvider` 占位，默认 disabled。
4. `openaiCompatibleProvider` 占位，默认 disabled。
5. `enterpriseModelGateway` 占位，默认 disabled。
6. `generateAnswer(input)` 统一回答生成接口。

所有真实 provider 占位均不读取环境变量、不读取 API key、不调用外部 URL、不初始化第三方 SDK。

## provider 输入低敏化

provider 输入低敏化，只允许：

1. `question`
2. `retrievalMode`
3. citation 的 `knowledgeId`
4. citation 的 `knowledgeTitle`
5. citation 的 `fileId`
6. citation 的 `fileName`
7. citation 的 `chunkId`
8. citation 的 `chunkIndex`
9. citation 的 `textPreview`
10. citation 的 `score`
11. citation 的 `matchReason`
12. `tenantId` / `institutionId`，仅用于治理范围标识

provider 输入禁止包含：

1. `storageKey`
2. 本地路径
3. `textContent`
4. `rawContent`
5. `parsedContent`
6. `embeddingVectorJson`
7. `SQL`
8. `stack`
9. `token`
10. `secret`
11. `DATABASE_URL`
12. `prompt`
13. `system prompt`
14. 内部完整 prompt

## provider 输出安全清洗

provider 输出安全清洗要求：

1. 不返回 `system prompt`。
2. 不返回真实模型原始响应。
3. 不返回密钥、环境变量、路径、SQL、stack 或 token。
4. 输出不安全时统一返回：`知识库智能问答服务暂时不可用`。
5. provider disabled 时统一返回：`真实 AI 服务尚未启用，当前使用受控本地问答能力`。
6. 输入未通过安全检查时统一返回：`知识库问答内容未通过安全检查`。

## QA service 接入

QA service 允许通过 adapter 生成回答，但默认仍使用 `mockLocalProvider`。

处理顺序：

1. 校验 tenant / institution / question。
2. 执行 QA 用量限制。
3. 未超限才执行关键词或 mock 向量召回。
4. 无 citation 时直接返回安全空答案，不进入 provider。
5. 有 citation 时构造低敏 provider 输入。
6. 通过 provider adapter 生成回答。
7. 只把安全 answer preview 写入 QA 审计。

QA service 不写入 provider 原始输出、内部 prompt、system prompt、密钥、路径或完整正文。

## capability 状态

capability 中 `realAiProvider` 继续保持：

1. `enabled: false`
2. `status: disabled`
3. 中文 disabled 原因
4. 中文进入条件
5. 摘要说明：AI provider 适配层已准备，真实 AI 未启用

平台端 UI 只展示能力状态，不展示密钥、环境变量、路径、数据库连接信息或 provider 原始响应。

## 真实 AI 上线前置条件

真实 AI 上线前置条件：

1. provider 选型和调用边界评审完成。
2. 密钥治理、环境变量、轮换、最小权限和泄露响应策略完成。
3. 网络出口、超时、重试、限流、熔断和成本预算方案完成。
4. prompt / completion 保留、脱敏和审计策略完成。
5. QA 质量评估集、引用准确率评估和人工抽检流程完成。
6. 安全拒答、敏感信息检测和事故响应流程完成。
7. 浏览器级 E2E 和真实客户数据合规审查完成。

## Go / No-Go 判断

Go：AI provider 安全适配层进入内部评审。

理由：

1. provider 抽象已形成。
2. mock/local provider 可支撑默认 QA。
3. 输入低敏化和输出安全清洗已集中。
4. capability 明确真实 AI 未启用。
5. 未读取真实密钥，未调用外部网络。

No-Go：真实 AI 生产上线。

理由：

1. 未接真实第三方 AI。
2. 未完成真实 provider 选型和密钥治理。
3. 未完成真实模型质量评估。
4. 未完成成本、限流、熔断和告警。
5. 未完成真实客户数据合规审查。

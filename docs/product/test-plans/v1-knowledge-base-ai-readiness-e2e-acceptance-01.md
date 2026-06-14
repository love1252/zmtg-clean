# 知识库 V1 真实 AI 上线前验收底座测试计划 01

日期 / 时区：2026-06-14 / CST +0800

任务：目标任务 9-3：知识库真实 AI 上线前安全评估、质量评估与 E2E 验收

## AI 上线前验收底座

本次是 AI 上线前验收底座，只补齐安全评估、质量样例、引用准确率规则、provider adapter 验收和 E2E / 准 E2E 验收。

本次明确：

1. 未接真实 AI。
2. 未读取真实密钥。
3. 未调用外部网络。
4. 未接 OCR。
5. 未进入 runtime ingestion。
6. 未接真实向量数据库。
7. 未做训练。
8. 未做计费系统、首页编辑或 dashboard。

## 安全评估范围

安全评估范围覆盖：

1. 空问题。
2. 超长问题。
3. 请求泄露系统提示词。
4. 请求泄露 prompt。
5. 请求泄露 token、secret、DATABASE_URL。
6. 请求访问其他机构数据。
7. 请求访问其他 tenant 数据。
8. 请求返回全文、`textContent`、`rawContent`、`parsedContent`。
9. 请求返回 `embeddingVectorJson`。
10. provider 输出包含系统提示词或真实模型原始响应。
11. 无引用时不得编造答案。

命中风险时返回固定中文安全文案：`知识库问答内容未通过安全检查`。安全阻断不得进入召回、provider 或 QA 审计写入。

## 质量评估样例范围

质量评估样例范围包括：

1. 有明确引用可回答。
2. 多引用合并回答。
3. 无引用安全空答案。
4. 机构授权范围回答。
5. 跨机构不可见。
6. 跨 tenant 不可见。
7. provider disabled 降级。
8. provider unsafe output 清洗。

评估字段包括：

1. `question`
2. `expectedCitationKeyword`
3. `expectedAnswerKeyword`
4. `forbiddenAnswerKeyword`
5. `expectedSafeStatus`

当前不评估真实模型准确率，只验收 mock/local provider 与 adapter 的安全边界和引用约束。

## 引用准确率规则

引用准确率规则：

1. answer 必须基于 citations。
2. citations 必须来自当前 tenant。
3. 机构端 citations 必须来自本机构归属或平台授权知识库。
4. 无 citations 时不得输出正常答案。
5. provider disabled 或 provider 输出不安全时，必须返回中文安全文案并保留 citations 约束。
6. 不要求真实 AI 准确率，只验收 mock/local 和 adapter 的引用约束。

## E2E 覆盖范围

平台端准 E2E 覆盖：

```text
上传/已有文件 → 解析 chunk → 检索 → QA → citations → QA audit → capability disabled
```

机构端准 E2E 覆盖：

```text
授权知识库 → 检索 → QA → citations → 本机构 QA audit → 不可见其他机构/tenant
```

当前项目没有在本轮引入新的浏览器 E2E 依赖。为避免扩大范围，本次使用现有 Vitest、route、service、UI 组合测试补准浏览器级验收；正式浏览器 E2E 待项目已有浏览器 E2E 框架或单独任务批准后补齐。

## 验收证据

本轮验收测试覆盖：

1. `PlatformKnowledgeAiReadinessEvaluation.test.ts`
2. `KnowledgeAiReadinessE2EAcceptance.test.ts`
3. 既有 `PlatformKnowledgeQaService.test.ts`
4. 既有 `PlatformKnowledgeQaApiRoute.test.ts`
5. 既有 `OpenPlatformKnowledgeManagementPanel.test.tsx`

这些测试共同证明：

1. 安全评估规则存在。
2. QA 质量样例集存在。
3. 引用来源约束存在。
4. 无引用不编造答案。
5. 跨机构 / 跨 tenant 不可见。
6. provider disabled 降级。
7. unsafe provider output 清洗。
8. capability 中真实 AI 仍 disabled。
9. 准 E2E 链路存在。
10. 不调用外部网络。

## Go / No-Go 判断

Go：AI provider 安全适配层继续内部评审。

理由：

1. 安全评估规则已集中。
2. 质量评估样例已形成。
3. 引用准确率规则已明确。
4. provider adapter 已纳入端到端验收。
5. 平台端和机构端准 E2E 链路已覆盖。

No-Go：真实 AI 生产上线。

理由：

1. 未接真实 AI。
2. 未读取真实密钥。
3. 未调用外部网络。
4. 未完成正式浏览器 E2E。
5. 未完成真实模型质量评估、成本评估、限流熔断、告警和合规审查。

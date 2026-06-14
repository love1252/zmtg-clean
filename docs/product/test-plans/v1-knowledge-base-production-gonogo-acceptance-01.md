# 知识库 V1 生产上线 Go/No-Go 总验收 01

日期 / 时区：2026-06-14 / CST +0800

任务：目标任务 9-4：知识库正式浏览器级 E2E 与生产上线 Go/No-Go 总验收

## 当前已完成能力总表

| 能力 | 当前状态 | 验收说明 |
| --- | --- | --- |
| 平台知识库列表 | 已完成内部闭环 | repository / service / API / UI 已接真实数据底座 |
| 机构授权可见范围 | 已完成内部闭环 | 支持平台绑定 / 解绑机构可见范围 |
| 文件管理 | 已完成内部闭环 | 上传、下载、归档、低敏元数据 |
| 文档解析与 chunk | 已完成内部闭环 | 受控文本解析、chunk 预览、解析状态 |
| 关键词检索 | 已完成内部闭环 | tenant / institution 范围过滤 |
| mock embedding 与向量检索 | 已完成内部闭环 | deterministic mock embedding，不是真实向量库 |
| mock/local QA | 已完成内部闭环 | 通过 provider adapter 默认使用本地能力 |
| QA 审计 | 已完成内部闭环 | 低敏审计字段、机构范围查询 |
| QA 用量限制 | 已完成内部闭环 | tenant 每日 100，institution 每日 30 |
| 生产级治理底座 | 已完成内部闭环 | capability、权限矩阵、安全字段策略 |
| AI provider 安全适配层 | 已完成内部闭环 | 抽象、mock/local provider、disabled 真实 provider 占位 |
| AI 上线前验收底座 | 已完成内部闭环 | 安全评估、质量样例、引用规则、准 E2E |

## 高风险能力状态

真实 AI 仍 disabled。

OCR 仍 disabled。

runtime ingestion 仍 disabled。

真实向量数据库仍 disabled。

以上能力不得通过页面文案、API payload 或测试数据暗示已经可用。

## 安全评估覆盖

安全评估覆盖：

1. 空问题。
2. 超长问题。
3. 请求泄露系统提示词。
4. 请求泄露 prompt。
5. 请求泄露 token、secret、DATABASE_URL。
6. 请求访问其他机构数据。
7. 请求访问其他 tenant 数据。
8. 请求返回全文。
9. 请求返回 embeddingVectorJson。
10. provider 输出包含系统提示词或真实模型原始响应。
11. 无引用时不得编造答案。

命中安全风险时，QA service 在召回、provider 和审计写入前阻断。

## QA 质量样例覆盖

QA 质量样例覆盖：

1. 有明确引用可回答。
2. 多引用合并回答。
3. 无引用安全空答案。
4. 机构授权范围回答。
5. 跨机构不可见。
6. 跨 tenant 不可见。
7. provider disabled 降级。
8. provider unsafe output 清洗。

当前只验收 mock/local QA 和 provider adapter 的边界，不验收真实模型准确率。

## 引用准确率规则覆盖

引用准确率规则覆盖：

1. answer 必须基于 citations。
2. citations 必须来自当前 tenant。
3. 机构端 citations 必须来自本机构归属或平台授权知识库。
4. 无 citations 时不得输出正常答案。
5. provider disabled 或 unsafe output 只能返回中文安全文案。

## 权限矩阵覆盖

权限矩阵覆盖：

1. 平台端查看知识库、上传文件、归档文件、发起解析、生成 mock embedding、关键词检索、向量检索、QA 问答、查看 QA 审计、管理机构授权。
2. 机构端查看授权知识库、下载授权文件、查看解析片段、关键词检索、向量检索、QA 问答、查看本机构 QA 审计。
3. 机构端禁止上传平台知识库文件、归档文件、发起解析、生成 embedding、管理 visibility、查看其他机构审计、访问其他 tenant 数据。

## QA 审计与用量限制覆盖

QA 审计与用量限制覆盖：

1. 平台端 QA 返回 answer、citations、auditId。
2. 机构端 QA 返回授权范围内 citations。
3. QA audit 只返回低敏字段。
4. tenant 每日 QA 限制为 100。
5. institution 每日 QA 限制为 30。
6. 超限时不执行召回、不进入 provider、不写入审计。
7. 审计 payload 不返回密钥、路径、全文、SQL、stack、token、prompt、真实模型原始响应。

## capability 状态覆盖

capability 状态覆盖：

1. `realAiProvider` disabled。
2. `ocr` disabled。
3. `runtimeIngestion` disabled。
4. `productionVectorStore` disabled。
5. 平台端 capability API 仅 platform scope 可访问。
6. 平台端 UI 只展示“真实 AI 未启用”和“适配层已准备”，不得展示真实 AI 可用。

## 浏览器 E2E 或替代验收说明

当前仓库 `package.json` 未配置 Playwright、Cypress 或其他浏览器 E2E runner：

1. 没有 active `e2e` / `playwright` / `cypress` 脚本。
2. 没有 active `@playwright/test`、`playwright` 或 `cypress` 依赖。
3. 没有 `playwright.config.*` 或 `cypress.config.*`。
4. 没有现成浏览器 E2E 目录。

因此本轮不引入大型依赖，不新增 Playwright / Cypress。

正式浏览器 E2E 待框架批准后补齐。

本轮替代验收使用现有 Vitest / route / service / UI 组合，覆盖：

平台端：

```text
capability 状态 → 知识库列表 → 文件/解析/chunk 状态 → 检索 → QA → citations → QA audit → 真实 AI disabled
```

机构端：

```text
授权知识库 → 检索 → QA → citations → 本机构 QA audit → 不可见其他机构/tenant
```

## 本轮测试证据

本轮新增或复用以下测试作为总验收证据：

1. `PlatformKnowledgeProductionGoNoGoAcceptance.test.ts`
2. `PlatformKnowledgeProductionGoNoGoDoc.test.ts`
3. `PlatformKnowledgeAiReadinessEvaluation.test.ts`
4. `KnowledgeAiReadinessE2EAcceptance.test.ts`
5. `PlatformKnowledgeQaService.test.ts`
6. `PlatformKnowledgeQaApiRoute.test.ts`
7. `OpenPlatformKnowledgeManagementPanel.test.tsx`

覆盖项：

1. capability 中真实 AI / OCR / runtime / 真实向量库仍 disabled。
2. 平台端 QA 返回 citations 和 audit。
3. 机构端 QA 只在授权范围内返回 citations。
4. 跨机构 / 跨 tenant 不可见。
5. 安全评估命中时不召回、不进 provider、不写 audit。
6. provider unsafe output 被清洗。
7. QA quota 超限不召回。
8. 审计 payload 不泄露敏感字段。
9. 准 E2E 总链路存在。
10. 文档明确 No-Go：真实 AI 生产上线。

## Go / No-Go 判断

Go：内部生产级验收评审。

理由：

1. 内部完整闭环已可验收。
2. 生产级治理底座、AI provider 安全适配层、AI 上线前验收底座已经形成。
3. 安全、质量、权限、审计、用量、capability 和准 E2E 总验收均有测试覆盖。

Go：进入真实 AI 接入方案评审。

理由：

1. 当前已有 provider 抽象和安全适配层。
2. 当前已有输入低敏化、输出清洗、引用约束和安全阻断。
3. 下一阶段可以评审 provider 选型、密钥治理、成本、限流、熔断、告警和正式浏览器 E2E。

No-Go：直接生产上线真实 AI 知识库。

理由：

1. 未接真实第三方 AI。
2. 未读取真实密钥。
3. 未调用外部网络。
4. 未完成正式浏览器 E2E。
5. 未完成真实模型质量评估、成本评估、合规审查和事故响应。

No-Go：直接启用 OCR。

理由：OCR 能力仍 disabled，未完成 OCR provider / 本地 OCR 方案、文件安全、质量验收和失败补偿。

No-Go：直接启用 runtime ingestion。

理由：runtime ingestion 仍 disabled，未完成队列、worker、scheduler、幂等、重试、死信和可观测性方案。

No-Go：直接切回首页编辑。

理由：本阶段聚焦知识库生产级能力落地，首页编辑不是本阶段授权范围。

# 知识库 V1 系统测试与真实使用流程验收报告 01

日期 / 时区：2026-06-14 / CST +0800

当前 commit：`a7dc797f2e772e955c40fa68a38e3bb8d0d4f15d`

任务：目标任务 10-1：知识库系统测试与真实使用流程验收

## 测试目标

本轮只做知识库系统测试和验收报告，确认当前知识库链路是否可进入内部演示 / 受控试用，并输出问题清单。

本轮未修代码、未新增功能、未接真实 AI、未启用 OCR、未启用 runtime ingestion、未接真实向量库、未做首页编辑。

## 启动检查结果

| 检查项 | 结果 |
| --- | --- |
| 日期 / 时区 | `2026-06-14 CST +0800` |
| 启动基线分支 | `main` |
| 启动基线 HEAD | `a7dc797f2e772e955c40fa68a38e3bb8d0d4f15d` |
| 启动基线 origin/main | `a7dc797f2e772e955c40fa68a38e3bb8d0d4f15d` |
| 启动基线 working tree | clean |
| stash | 空 |
| 本轮工作分支 | `docs/v1-kb-system-test-acceptance-01` |

## 执行命令和结果

| 命令 | 结果 | 摘要 |
| --- | --- | --- |
| `cat package.json` | 通过 | 项目脚本包含 `lint: eslint .`、`typecheck: tsc --noEmit`、`test: node scripts/run-vitest.mjs run`。未配置 Playwright / Cypress 浏览器 E2E runner。 |
| `node node_modules/vitest/vitest.mjs run ...` | 失败 | 当前 shell 中 `node` 不在 PATH，输出 `zsh:1: command not found: node`。未修改代码，改用 Codex 本地 Node 运行同一组测试。 |
| `/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run ...` | 通过 | 7 个测试文件通过，44 个测试用例通过，0 失败。 |
| `/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit` | 通过 | 退出码 0，无类型错误输出。 |
| `/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/eslint/bin/eslint.js .` | 通过，有 warning | 退出码 0；1 个既有 warning：`src/modules/auth/components/LuxuryLoginShell.tsx` 使用 `<img>` 触发 `@next/next/no-img-element`。非知识库模块，本轮不处理。 |

本轮知识库定向测试文件：

1. `src/modules/open-platform/tests/PlatformKnowledgeProductionGoNoGoAcceptance.test.ts`
2. `src/modules/open-platform/tests/PlatformKnowledgeProductionGoNoGoDoc.test.ts`
3. `src/modules/open-platform/tests/PlatformKnowledgeAiReadinessEvaluation.test.ts`
4. `src/modules/institution/tests/KnowledgeAiReadinessE2EAcceptance.test.ts`
5. `src/modules/open-platform/tests/PlatformKnowledgeQaService.test.ts`
6. `src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`
7. `src/modules/open-platform/tests/OpenPlatformKnowledgeManagementPanel.test.tsx`

## 平台端验收表

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 知识库列表 | 通过 | `OpenPlatformKnowledgeManagementRealCore.test.ts` 覆盖 repository 列表、tenant 隔离、搜索、分页、机构筛选、状态筛选和禁用状态返回。 |
| 机构授权 / 解绑 | 通过 | `OpenPlatformKnowledgeManagementRealCore.test.ts` 覆盖 visibility bind / unbind；跨 tenant 或 institution 不属于 tenant 时拒绝写入。 |
| 文件上传 / 列表 / 下载 / 归档 | 通过 | `PlatformKnowledgeFileManagementService.test.ts`、`PlatformKnowledgeFileManagementApiRoute.test.ts`、`OpenPlatformKnowledgeManagementPanel.test.tsx` 覆盖平台上传、列表、下载、归档、低敏 payload 和跨 tenant 禁止。 |
| 文档解析状态 | 通过 | `PlatformKnowledgeDocumentParsingService.test.ts`、`PlatformKnowledgeDocumentParsingApiRoute.test.ts` 覆盖平台发起解析、状态查看、失败状态、归档文件不可解析。 |
| chunk 查看 | 通过 | 文档解析 service / route 测试与平台面板测试覆盖 chunk 列表和低敏片段预览，不返回解析全文。 |
| 关键词检索 | 通过 | `PlatformKnowledgeKeywordSearchService.test.ts`、`PlatformKnowledgeKeywordSearchApiRoute.test.ts` 覆盖关键词、knowledgeId / fileId 过滤、分页、tenant mismatch 不可见。 |
| mock embedding 生成 | 通过 | `PlatformKnowledgeEmbeddingVectorSearchService.test.ts`、`PlatformKnowledgeEmbeddingVectorSearchApiRoute.test.ts` 覆盖 deterministic mock embedding，确认不调用外部 AI / 网络服务。 |
| 向量检索 | 通过 | 向量检索 service / route 测试覆盖 mock embedding 相似片段返回，响应不包含 `embeddingVectorJson`。 |
| QA 问答 | 通过 | `PlatformKnowledgeQaService.test.ts`、`PlatformKnowledgeQaApiRoute.test.ts` 覆盖 mock/local QA 回答、validation、provider disabled 和 unsafe output 处理。 |
| citations 引用 | 通过 | QA service / route / 准 E2E 测试覆盖 answer、citations、引用片段形状和无 citation 安全空答案。 |
| QA audit | 通过 | QA service / route / UI 测试覆盖低敏审计写入和查询；平台端可按 tenant / institution 范围查看。 |
| QA quota | 通过 | `PlatformKnowledgeQaService.test.ts` 覆盖 tenant 每日 100、institution 每日 30；超限不召回、不进 provider、不写 audit。 |
| capability 状态 | 通过 | `platform-knowledge-production-governance-policy.ts` 与 Go/No-Go 测试确认内部能力 enabled，高风险能力 disabled。 |

## 机构端验收表

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 授权知识库查看 | 通过 | `InstitutionKnowledgeManagementReadonlyService.test.ts`、`InstitutionKnowledgeManagementReadonlyApiRoute.test.ts` 覆盖仅返回当前 tenant 且授权给当前 institution 或归属本机构的低敏记录。 |
| 授权文件下载 | 通过 | `PlatformKnowledgeFileManagementService.test.ts`、`PlatformKnowledgeFileManagementApiRoute.test.ts` 覆盖机构端只能查看和下载本机构归属或平台授权 knowledge 下的 active 文件。 |
| 解析片段查看 | 通过 | `PlatformKnowledgeDocumentParsingApiRoute.test.ts` 覆盖机构端只读查看解析状态和 chunk，tenant / institution 来自 access context。 |
| 关键词检索 | 通过 | `PlatformKnowledgeKeywordSearchService.test.ts`、`PlatformKnowledgeKeywordSearchApiRoute.test.ts` 覆盖机构端只在 access context 可见范围检索。 |
| 向量检索 | 通过 | `PlatformKnowledgeEmbeddingVectorSearchService.test.ts`、`PlatformKnowledgeEmbeddingVectorSearchApiRoute.test.ts` 覆盖机构端只读向量检索，不暴露 embedding 生成入口。 |
| QA 问答 | 通过 | `KnowledgeAiReadinessE2EAcceptance.test.ts`、`PlatformKnowledgeQaService.test.ts` 覆盖机构端 mock/local QA 只在授权范围内回答。 |
| citations 引用 | 通过 | 准 E2E 测试确认机构端 citations 包含授权 knowledge，不包含其他机构或跨 tenant knowledge。 |
| 本机构 QA audit | 通过 | `KnowledgeAiReadinessE2EAcceptance.test.ts` 覆盖机构端只查询本机构 QA audit；平台端可看到 tenant 下审计总览。 |
| 其他机构 / 其他 tenant 不可见 | 通过 | 机构 readonly service、关键词、向量、QA、准 E2E 测试均覆盖跨机构 / 跨 tenant 不可见。 |

## 安全边界验收表

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 不返回 `storageKey`、本地路径、全文、`embeddingVectorJson` | 通过 | 文件、解析、向量、QA、Go/No-Go 测试均使用 denylist / safe payload 断言；低敏字段策略包含 denylist。 |
| 不返回 SQL / stack / token / secret / DATABASE_URL | 通过 | 生产治理策略 denylist 和 QA / Go/No-Go safe payload 覆盖这些敏感片段。 |
| 不返回 prompt / system prompt | 通过 | AI readiness 安全评估覆盖请求泄露 prompt / system prompt；provider 输出包含相关片段时阻断或返回安全文案。 |
| 无 citations 不编造答案 | 通过 | QA service 测试覆盖无召回片段返回安全空答案，answer 为固定中文文案，citations 为空。 |
| 安全评估命中时不召回、不进 provider、不写 audit | 通过 | Go/No-Go 和 QA service 测试覆盖 `safety_blocked`；命中高风险问题在召回、provider、audit 前阻断。 |
| quota 超限时不召回、不进 provider、不写 audit | 通过 | QA service 测试覆盖 tenant / institution 超限时返回 `usage_limited`，不调用检索、不写审计。 |
| 真实 AI / OCR / runtime / 真实向量库仍 disabled | 通过 | capability 状态与 Go/No-Go 测试确认 `realAiProvider`、`ocr`、`runtimeIngestion`、`productionVectorStore` 均 `enabled: false`、`status: disabled`。 |

## capability 状态确认

| capability | 当前状态 | 说明 |
| --- | --- | --- |
| `fileManagement` | enabled | 内部受控文件上传、下载、归档和元数据管理已启用。 |
| `documentParsing` | enabled | 内部受控文本解析、解析状态和失败文案已启用。 |
| `keywordSearch` | enabled | 基于已解析低敏 chunk 的关键词检索已启用。 |
| `mockEmbedding` | enabled | deterministic mock embedding 索引已启用，仅用于内部受控验证。 |
| `vectorSearch` | enabled | 基于 mock embedding 的相似片段检索已启用。 |
| `mockQa` | enabled | 基于召回片段的 mock/local QA 已启用，不代表真实 AI 能力。 |
| `qaAudit` | enabled | QA 审计写入和低敏审计查询已启用。 |
| `qaQuota` | enabled | tenant 每日 100 次、institution 每日 30 次 QA 用量限制已启用。 |
| `realAiProvider` | disabled | AI provider 适配层已准备，真实 AI 未启用。 |
| `ocr` | disabled | 未接入 OCR、图片文字识别或扫描件识别能力。 |
| `runtimeIngestion` | disabled | 未启用队列、worker、scheduler 或自动索引流水线。 |
| `productionVectorStore` | disabled | 未接入生产级向量数据库，当前仅使用本地 mock embedding 验证链路。 |

## 问题清单

| 编号 | 级别 | 模块 | 问题 | 复现方式 | 后续任务 |
| -- | -- | -- | -- | ---- | ---- |
| KB-SYS-001 | P2 | 测试环境 | 当前 shell 中 `node` 不在 PATH，按目标原始命令直接执行会失败。 | 运行 `node node_modules/vitest/vitest.mjs run ...`，出现 `zsh:1: command not found: node`。 | 统一本地/CI Node PATH，或在项目脚本中固定使用仓库认可的运行入口。 |
| KB-SYS-002 | P2 | 验收体系 | 仓库未配置 Playwright / Cypress 等正式浏览器 E2E runner，当前系统验收依赖 Vitest / route / service / UI 组合。 | 查看 `package.json` 与 Go/No-Go 测试中的浏览器 E2E 检查。 | 后续经审批后补正式浏览器 E2E 框架和关键真实浏览器流程。 |
| KB-SYS-003 | P2 | 非知识库 auth UI | ESLint 现有 warning：`LuxuryLoginShell.tsx` 使用 `<img>` 触发 Next.js no-img-element。 | 运行 ESLint，退出码 0，输出 1 个 warning。 | 非本任务范围，后续单独排期优化登录页图片组件。 |

## 风险清单

| 编号 | 风险 | 影响 | 当前判断 |
| --- | --- | --- | --- |
| R1 | 未配置正式浏览器 E2E | 真实浏览器环境下的路由、交互、样式和下载体验尚未形成自动化证据 | 不阻断内部演示；进入更大范围受控试用前建议补齐 |
| R2 | 真实 AI、OCR、runtime ingestion、真实向量库仍 disabled | 当前只能演示内部 mock/local 能力，不能宣称真实 AI 生产可用 | 必须继续 No-Go |
| R3 | 当前报告基于自动化测试和只读代码 / 文档检查 | 未进行人工真实浏览器逐项点击验收 | 内部演示前建议按报告表格进行一次人工彩排 |
| R4 | `.git/gc.log` / loose objects 维护提示曾在上一任务出现 | 可能影响本地仓库维护体验 | 本任务按要求不处理，仅作为本地维护提示 |

## 后续修复建议

1. 给知识库核心路径补正式浏览器 E2E，覆盖平台端文件上传 / 下载 / 归档、解析状态、检索、QA、审计和 capability 展示。
2. 固化 Node 执行环境，避免本地 shell PATH 缺失导致目标原始命令不可直接运行。
3. 在真实 AI 评审前补齐密钥治理、成本限额、熔断、告警、正式浏览器 E2E、真实模型质量评估和事故响应方案。
4. OCR、runtime ingestion、生产向量库分别单独做方案评审、schema / migration 审批、回滚和安全验收，不与当前系统测试报告混合推进。

## 是否可进入内部演示

结论：可以。

限定条件：

1. 仅演示当前已启用的内部知识库闭环。
2. QA 只能宣称 mock/local QA。
3. mock embedding / mock 向量检索只能宣称内部受控验证能力。
4. 真实 AI、OCR、runtime ingestion、真实向量库不得宣称可用。

## 是否可进入受控试用

结论：可以进入严格限定的内部受控试用；不可以进入真实 AI 生产受控试用。

受控试用限定：

1. 仅限内部账号和受控测试数据。
2. 真实 AI、OCR、runtime ingestion、真实向量库保持 disabled。
3. 禁止导入真实敏感正文或真实生产文件。
4. 对外演示前必须明确 mock/local QA 与真实 AI 的边界。
5. 扩大试用范围前建议补正式浏览器 E2E 和人工彩排记录。

## No-Go

以下能力继续 No-Go：

1. 真实 AI 生产上线。
2. OCR。
3. runtime ingestion。
4. 真实向量数据库。
5. 首页编辑。
6. 训练。
7. 计费系统。
8. dashboard 聚合。

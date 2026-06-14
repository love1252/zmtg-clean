# 知识库 V1 系统测试问题收口与权限审计回归报告 01

日期 / 时区：2026-06-14 / CST +0800

当前 commit：`53c3b0bef1c0352b49ac286b2071749055cb4c0a`

任务：目标任务 10-2：知识库系统测试问题收口与权限审计回归

## 启动检查结果

| 检查项 | 结果 |
| --- | --- |
| 日期 / 时区 | `2026-06-14 CST +0800` |
| 启动基线分支 | `main` |
| 启动基线 HEAD | `53c3b0bef1c0352b49ac286b2071749055cb4c0a` |
| 启动基线 origin/main | `53c3b0bef1c0352b49ac286b2071749055cb4c0a` |
| 启动基线 working tree | clean |
| stash | 空 |
| 本轮工作分支 | `docs/v1-kb-system-test-fix-and-security-regression-01` |

本轮只新增本报告。未修改业务代码、API、UI、service、测试文件、schema、migration、配置或依赖。

## 10-1 P2 问题复核表

| 编号 | 级别 | 模块 | 问题 | 当前判断 | 后续任务 |
| -- | -- | -- | -- | ---- | ---- |
| KB-SYS-001 | P2 | 测试环境 | 当前 shell 中 `node` 不在 PATH，原始 `node ...` 命令会失败。 | 已复现；不阻断知识库内部演示，不阻断严格限定受控试用，不要求作为 10-3 前置代码修复。使用 Codex 本地 Node 路径可完成同一组回归。 | 后置统一本地 / CI Node PATH，或在项目脚本层固化运行入口。 |
| KB-SYS-002 | P2 | 验收体系 | 未配置 Playwright / Cypress 等正式浏览器 E2E runner。 | 不阻断内部演示；严格限定受控试用可继续依赖 Vitest / route / service / UI 组合验收；不要求作为 10-3 前置代码修复，但扩大试用范围前应补正式浏览器 E2E。 | 后置经审批补知识库关键路径浏览器 E2E。 |
| KB-SYS-003 | P2 | 非知识库 auth UI | `LuxuryLoginShell.tsx` 既有 ESLint warning：`@next/next/no-img-element`。 | 已复现；属于非知识库模块 warning，ESLint 退出码 0；不阻断内部演示、不阻断严格限定受控试用、不要求作为 10-3 前置修复。 | 后置单独优化登录页图片组件。 |

## 执行命令和结果

| 命令 | 结果 | 摘要 |
| --- | --- | --- |
| `cat package.json` | 通过 | 项目脚本包含 `lint`、`typecheck`、`test`；仍未配置 Playwright / Cypress 浏览器 E2E runner。 |
| `node node_modules/vitest/vitest.mjs run ...` | 失败 | 当前 shell 中 `node` 不在 PATH，输出 `zsh:1: command not found: node`。未修系统环境。 |
| `/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run ...` | 通过 | 6 个测试文件通过，42 个测试用例通过，0 失败。 |
| `node node_modules/typescript/bin/tsc --noEmit` | 失败 | 当前 shell 中 `node` 不在 PATH，输出 `zsh:1: command not found: node`。 |
| `/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit` | 通过 | 退出码 0，无类型错误输出。 |
| `node node_modules/eslint/bin/eslint.js .` | 失败 | 当前 shell 中 `node` 不在 PATH，输出 `zsh:1: command not found: node`。 |
| `/Users/dongxiaolong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/eslint/bin/eslint.js .` | 通过，有 warning | 退出码 0；1 个既有 warning：`src/modules/auth/components/LuxuryLoginShell.tsx:63:13 @next/next/no-img-element`。 |

本轮权限 / 审计 / 安全回归测试文件：

1. `src/modules/open-platform/tests/PlatformKnowledgeProductionGoNoGoAcceptance.test.ts`
2. `src/modules/open-platform/tests/PlatformKnowledgeQaService.test.ts`
3. `src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`
4. `src/modules/open-platform/tests/PlatformKnowledgeProductionGovernancePolicy.test.ts`
5. `src/modules/institution/tests/KnowledgeAiReadinessE2EAcceptance.test.ts`
6. `src/modules/open-platform/tests/OpenPlatformKnowledgeManagementPanel.test.tsx`

## 平台端权限回归表

| 权限项 | 结论 | 证据 |
| --- | --- | --- |
| 可查看 tenant 范围知识库 | 通过 | Go/No-Go 与 QA service 测试通过 tenant 范围 repository 数据和跨 tenant 不可见断言。 |
| 可管理机构 visibility | 通过 | 10-1 已覆盖 bind / unbind；本轮复核无 P0/P1 阻断，未发现 visibility 回归信号。 |
| 可上传 / 下载 / 归档文件 | 通过 | 平台面板回归测试覆盖上传、下载、发起解析、查看 chunk、归档 API 调用。 |
| 可解析、检索、QA | 通过 | 平台面板和 Go/No-Go 测试覆盖解析状态、关键词检索、mock embedding、语义检索、mock/local QA。 |
| 可查看 QA audit | 通过 | QA service / route / UI 回归覆盖低敏 audit 写入和展示。 |
| capability 仅 platform scope 可查 | 通过 | `PlatformKnowledgeProductionGovernancePolicy.test.ts` 与平台端 capability 展示回归覆盖；机构端只读能力不暴露 platform-only 管理入口。 |

## 机构端权限回归表

| 权限项 | 结论 | 证据 |
| --- | --- | --- |
| 只可查看授权知识库 | 通过 | `KnowledgeAiReadinessE2EAcceptance.test.ts` 覆盖机构端只命中授权知识库。 |
| 只可下载授权文件 | 通过 | 10-1 文件管理验收结论仍有效；本轮未发现文件权限回归信号。 |
| 只可查看授权 chunk | 通过 | 机构端 QA / citations 回归只返回授权 knowledge 下 chunk。 |
| 只可在授权范围检索 / QA | 通过 | 准 E2E 验收确认机构端 citations 包含授权 knowledge，不包含其他机构或跨 tenant knowledge。 |
| 只可查看本机构 QA audit | 通过 | 准 E2E 验收确认机构端 audit 过滤 `tenantId` 与 `institutionId`。 |
| 不可见其他机构 / 其他 tenant 数据 | 通过 | 准 E2E 与 Go/No-Go 回归均断言 `knowledge-other-institution`、`knowledge-cross-tenant` 不出现在机构端引用中。 |
| 不可生成 embedding | 通过 | 生产治理权限矩阵与 10-1 机构端验收均确认机构端不暴露 embedding 生成入口。 |
| 不可上传 / 归档 / 发起解析 / 管理 visibility | 通过 | 生产治理权限矩阵将这些能力列为机构端 forbidden；本轮无回归失败。 |

## 审计与敏感字段回归表

| 回归项 | 结论 | 证据 |
| --- | --- | --- |
| 不返回 `storageKey` | 通过 | Go/No-Go、QA service、准 E2E safe payload denylist 覆盖。 |
| 不返回本地路径 | 通过 | safe payload denylist 覆盖 `/Users/`。 |
| 不返回全文 | 通过 | denylist 覆盖 `textContent`、`rawContent`、`parsedContent`、`trainingContent`。 |
| 不返回 `embeddingVectorJson` | 通过 | 向量 / QA / Go/No-Go safe payload 覆盖。 |
| 不返回 SQL / stack / token / secret / DATABASE_URL | 通过 | safe payload 与安全评估覆盖。 |
| 不返回 prompt / system prompt | 通过 | 安全评估命中 prompt / system prompt 请求时阻断，provider unsafe output 清洗。 |
| 不返回真实模型原始响应 | 通过 | provider unsafe output 测试覆盖 `真实 AI 原始响应` 不进入可见 payload。 |
| 安全评估命中时不召回、不进 provider、不写 audit | 通过 | Go/No-Go 与 QA service 回归覆盖 `safety_blocked`。 |
| quota 超限时不召回、不进 provider、不写 audit | 通过 | QA service 回归覆盖 tenant / institution 超限安全返回。 |

## 新发现问题

| 编号 | 级别 | 模块 | 问题 | 当前判断 | 后续任务 |
| -- | -- | -- | -- | ---- | ---- |
| 无 | - | - | 本轮未发现新的 P0 / P1 / P2。 | 10-1 的 3 个 P2 仍按后置处理。 | 无新增。 |

统计：

| 类别 | 数量 |
| --- | --- |
| 新发现 P0 | 0 |
| 新发现 P1 | 0 |
| 新发现 P2 | 0 |
| 10-1 既有 P2 仍存在 | 3 |

## 是否需要代码修复

结论：本轮不需要代码修复。

理由：

1. 权限、审计、敏感字段回归测试通过。
2. 10-1 的 3 个 P2 均不阻断内部演示或严格限定受控试用。
3. 未发现新的 P0 / P1。
4. 本轮目标为轻量收口报告，且原则上不改代码。

## 是否可以进入内部演示

结论：可以。

限定条件：

1. 只演示当前已启用的内部知识库闭环。
2. QA 仍只能宣称 mock/local QA。
3. mock embedding / mock 向量检索只能宣称内部受控验证能力。
4. 真实 AI、OCR、runtime ingestion、真实向量库不得宣称可用。

## 是否可以进入严格限定受控试用

结论：可以。

限定条件：

1. 仅限内部账号和受控测试数据。
2. 不导入真实敏感正文或真实生产文件。
3. 真实 AI、OCR、runtime ingestion、真实向量库继续 disabled。
4. 扩大范围前补正式浏览器 E2E 和人工彩排记录。

## 是否可以进入 10-3 真实文件解析生产化

结论：可以进入 10-3。

边界：

1. 10-3 仍需单独授权，不在本轮实现。
2. 10-3 应聚焦真实文件解析生产化，不应顺手开启 OCR、runtime ingestion、真实 AI 或真实向量库。
3. 如 10-3 涉及 schema / migration、worker、队列、外部服务或真实文件安全策略，需按治理规则单独审批。

## 继续 No-Go 项

以下能力继续 No-Go：

1. 真实 AI 生产上线。
2. OCR。
3. runtime ingestion。
4. 真实向量数据库。
5. 首页编辑。
6. 训练。
7. 计费系统。
8. dashboard 聚合。

`.git/gc.log` / loose objects 仅作为本地维护提示，本轮未处理。

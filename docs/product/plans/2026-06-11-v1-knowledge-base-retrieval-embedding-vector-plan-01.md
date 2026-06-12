# V1 知识库检索 / embedding / 向量索引计划 01

## 0. 文档元信息

- 任务编号：ZMTG-V1-KNOWLEDGE-BASE-RETRIEVAL-EMBEDDING-VECTOR-PLAN-01。
- 中文名：V1 知识库检索 / embedding / 向量索引计划。
- 日期与时区：2026-06-11 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：V1 知识库 demo readonly / searchPreview 之后，真实检索、embedding 和向量索引 runtime 之前的 docs-only 规划。
- 当前基线：`main` / `origin/main` 为 `4adc79f92d6a1879ae29280306f6ad851eb02d6a`。
- 任务性质：docs-only / plan-only / no retrieval implementation / no embedding implementation / no vector index implementation。

本文档只规划未来知识库从 mock / seed / demo 检索预览走向真实检索、embedding 和向量索引前必须满足的边界。本文档不是开发授权，不是 API / UI / DB / schema / migration 授权，不是检索、embedding、向量库、RAG 或 AI 使用知识 runtime 授权。

## 1. 本轮范围

本轮只新增一份 `docs/product/plans/**` 下的计划文档。

本轮明确不做：

- 不修改 `src/**`。
- 不写测试。
- 不新增 API route。
- 不新增 UI。
- 不接 DB。
- 不新增 schema / migration。
- 不实现 service / repository / adapter。
- 不实现真实检索 runtime。
- 不实现 embedding 调用。
- 不实现向量索引。
- 不实现重建索引、增量索引或索引清理 worker。
- 不实现 RAG runtime。
- 不接真实模型。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不写日志。
- 不自动营销、触达、创建任务、预约、成交、支付、合同或发票。

## 2. 规划目标

未来知识库检索能力必须先解决以下问题，再进入任何 runtime：

- demo `searchPreview` 如何与真实检索严格隔离。
- 从 mock / seed / demo 到真实检索需要哪些 readiness gates。
- embedding 输入字段如何白名单化，避免高敏原文进入模型或向量。
- 向量索引生命周期如何覆盖创建、更新、停用、重建、回滚和删除。
- 平台知识库与机构知识库如何隔离和组合召回。
- tenant、institution、workspace、role、visibilityScope 如何参与过滤。
- 召回结果允许返回哪些字段，禁止返回哪些字段。
- 检索成本如何归属、限额、降级和审计。
- 检索失败、embedding 失败、索引 stale 和权限拒绝如何低敏返回。

## 3. mock 到真实检索边界

当前已有 `searchPreview` 只能表达 mock / demo 预览，不代表真实检索、embedding 或向量召回。

| 阶段 | 数据来源 | 允许能力 | 禁止误读 |
| --- | --- | --- | --- |
| `mock_demo_preview` | mock / seed / demo source contract。 | 展示低敏预览、验证 UI / API contract 字段。 | 不代表真实检索，不调用模型，不建索引。 |
| `readonly_contract_preview` | 只读 facade / API contract。 | 验证字段白名单、状态和失败态。 | 不代表知识可查询，不代表内容已发布。 |
| `retrieval_contract_candidate` | 未来纯 domain contract。 | 只描述查询输入、过滤条件、召回输出。 | 不接 DB，不接 vector store。 |
| `retrieval_runtime_candidate` | 后续单独授权 runtime。 | 可评审最小只读检索。 | 当前不能实现。 |

从 mock 进入真实检索必须满足：

- 上传 / 解析 / 分块计划已完成并通过单独评审。
- chunk 字段白名单已定义。
- embedding 输入字段白名单已定义。
- 检索召回字段白名单已定义。
- tenant / RBAC / visibilityScope 过滤顺序已定义。
- 索引生命周期和回滚策略已定义。
- 成本、限额、失败态和审计口径已定义。

## 4. embedding 输入白名单

embedding 输入必须是低敏知识片段，不得直接使用文件原文、解析原文、客户原文或模型输出。

允许进入 embedding 的候选字段：

- `knowledgeItemId`
- `chunkId`
- `safeHeading`
- `safeSnippet`
- `catalogPath`
- `sourceVersion`
- `knowledgeBaseType`
- `sourceType`
- `visibilityScope`
- `reviewStatus`
- `riskFlags`

禁止进入 embedding 的内容：

- 真实客户姓名、完整手机号、身份证、地址。
- 病历正文、诊断正文、治疗记录原文、咨询对话全文。
- 订单、支付、合同、发票、成交、回款信息。
- HIS raw payload、接口导出原文、真实系统凭证。
- credential、token、secret、API key、OAuth、Webhook secret。
- DB URL、SQL、stack、worker、路径、依赖错误。
- AI prompt、completion、模型输出。
- 任何可自动触发营销、触达、任务、预约、成交、支付、合同或发票的指令。

embedding 输入必须在生成前通过低敏扫描；未通过时不得调用模型，不得写入向量索引。

## 5. 向量索引生命周期

未来索引生命周期必须可解释、可回滚、可审计。

| 生命周期 | 触发条件 | 必须保留的低敏信息 | 当前边界 |
| --- | --- | --- | --- |
| `index_pending` | chunk 通过审核，等待索引。 | chunkId、sourceVersion、visibilityScope。 | 当前不实现。 |
| `indexing` | 正在生成 embedding 或写入索引。 | 低敏状态，不展示模型或向量。 | 当前不实现。 |
| `indexed` | 索引可用于候选检索。 | indexVersion、indexedAt、scope。 | 当前不实现。 |
| `stale` | 来源更新、版本变更或权限变化。 | staleReason、sourceVersion。 | 当前不实现。 |
| `reindex_required` | chunk、可见范围、模型版本或索引策略变化。 | reindexReason。 | 当前不实现。 |
| `disabled` | 知识下架、审核撤回或 feature disabled。 | disabledReason。 | 当前不实现。 |
| `deleted` | 知识删除或合规要求清理。 | deletionReason、低敏审计摘要。 | 当前不实现。 |
| `failed` | embedding 或写入索引失败。 | 产品化 failureReason。 | 当前不实现。 |

索引不得跨 tenant 合并。平台知识索引和机构知识索引必须有清晰 scope；混合检索只能在授权过滤后组合结果。

## 6. 隔离与过滤顺序

真实检索必须先过滤，后召回，不能先召回再在 UI 层隐藏。

推荐过滤顺序：

1. `featureFlag`：能力未开启时直接返回 disabled。
2. `tenantId`：拒绝跨 tenant 请求。
3. `workspaceId` / `institutionId`：校验当前上下文。
4. `RBAC`：校验查看、检索、引用权限。
5. `knowledgeBaseType`：区分平台知识库和机构知识库。
6. `visibilityScope`：过滤机构内可见范围、角色范围和授权租户范围。
7. `reviewStatus`：只允许审核通过和已发布知识进入真实检索。
8. `indexStatus`：只允许 indexed 且非 stale 的索引进入召回。
9. `riskFlags`：高风险内容必须拒答或转人工。

隔离要求：

- 机构知识不得跨 tenant 召回。
- 机构知识不得被平台侧普通视图读取。
- 平台知识只能按适用租户、套餐、地区和角色授权召回。
- 权限拒绝时不得泄露知识是否存在。
- stale、disabled、source missing 的知识不得作为 ready 结果返回。

## 7. 召回字段白名单

未来检索结果只能返回低敏字段，用于内部只读引用和人工判断。

允许返回：

- `retrievalId`
- `knowledgeItemId`
- `chunkId`
- `knowledgeBaseType`
- `sourceType`
- `catalogPath`
- `safeTitle`
- `safeSnippet`
- `sourceVersion`
- `visibilityScope`
- `reviewStatus`
- `scoreBucket`
- `readonlyCitationSummary`
- `riskFlags`
- `stale`

禁止返回：

- 原始全文。
- embedding 向量。
- 模型输入或输出。
- prompt / completion。
- 真实客户资料。
- HIS raw payload。
- credential。
- DB URL、SQL、stack、worker、路径。
- 可执行动作参数，例如创建任务、预约、触达、营销、成交、支付、合同或发票。

相似度分数建议只返回桶化结果，例如 `high`、`medium`、`low`、`not_confident`，不得把内部模型细节包装成确定性医疗或经营结论。

## 8. 成本与限额计划

embedding 和检索会引入模型、存储、索引、计算和重建成本，必须先规划成本边界。

| 成本类型 | 成本来源 | 规划边界 |
| --- | --- | --- |
| embedding 生成成本 | chunk 进入索引前调用模型或向量服务。 | 必须按 tenant / institution / workspace 归属。 |
| 索引存储成本 | 向量、元数据、索引副本。 | 必须按知识库类型和索引版本统计。 |
| 查询成本 | 检索请求、过滤、召回、重排。 | 必须有额度、限频和降级。 |
| 重建成本 | 大批量 reindex 或模型版本切换。 | 必须有人工确认和窗口控制。 |
| 失败成本 | embedding 失败、索引写入失败、重复重试。 | 必须限制重试，不得无限循环。 |

成本失败态必须产品化：

- “当前检索能力暂不可用。”
- “当前知识库索引正在准备中。”
- “当前检索请求超过演示限制。”
- “当前知识来源需要重新整理后才能检索。”

不得展示供应商错误、模型错误全文、计费系统详情、token 费用细节或外部服务响应原文。

## 9. 失败态计划

| 状态 | 触发条件 | 用户可见文案边界 |
| --- | --- | --- |
| `disabled` | 检索能力未开启。 | 知识库检索能力暂未开启。 |
| `denied` | RBAC 不允许。 | 当前账号没有检索知识库的权限。 |
| `tenant_mismatch` | 请求上下文与目标租户不一致。 | 当前上下文无法访问该知识库。 |
| `source_missing` | 来源、chunk 或版本缺失。 | 知识来源不完整，暂无法检索。 |
| `index_missing` | 尚未建立索引。 | 知识库索引尚未准备完成。 |
| `index_stale` | 索引版本落后。 | 知识库索引需要重新整理。 |
| `embedding_failed` | embedding 生成失败。 | 知识片段暂无法进入检索。 |
| `retrieval_failed` | 检索服务失败。 | 知识库检索暂时不可用。 |
| `quota_denied` | 超出额度或限频。 | 当前检索请求超过限制，请稍后重试。 |
| `not_confident` | 召回不足或冲突。 | 暂未找到可信知识来源，请转人工确认。 |
| `risk_blocked` | 命中高风险或敏感内容。 | 当前问题需要人工确认。 |

失败态不得包含 stack、worker、文件路径、依赖错误、索引服务错误、模型供应商响应、向量库连接串、DB 连接、SQL 或 token / secret。

## 10. 审计与追踪计划

未来检索审计必须低敏记录：

- 请求场景。
- tenant / institution / workspace 的低敏标识。
- viewer role。
- feature flag 状态。
- 检索状态。
- 命中 / 未命中 / 拒答 / 转人工类别。
- 使用的知识库类型。
- 低敏来源摘要。
- indexVersion。
- failureReason 类别。
- 成本桶和限额结果。

不得记录：

- 查询全文中的高敏内容。
- 原始 chunk 全文。
- embedding 向量。
- prompt / completion。
- 模型响应全文。
- credential、HIS raw payload、DB URL、SQL、stack。

## 11. 从 mock 到 runtime 的后续切片建议

以下只是后续建议，不是开发许可：

1. 检索 / embedding / 向量索引 test plan docs-only。
2. 检索输入输出 contract test-only，只使用 mock / seed / demo 查询。
3. embedding 输入白名单 contract test-only，只做纯函数。
4. 召回字段白名单 contract test-only，只验证低敏输出。
5. 索引生命周期 contract test-only，只用 mock index metadata。
6. 成本与失败态 contract test-only，只验证状态和产品化文案。
7. 最小只读检索 API / UI / storage 评审，必须单独授权。
8. 最小 runtime，必须在 schema、索引服务、模型供应商、成本、审计和回滚方案单独批准后才可进入。

## 12. Go / No-Go

| 类型 | 结论 | 规则 |
| --- | --- | --- |
| docs-only 计划 | GO | 当前可以完成。 |
| test-plan-only | GO | 后续可单独规划。 |
| mock / seed / demo contract | CONDITIONAL-GO | 必须单独授权，且只做纯 domain / tests。 |
| 检索 runtime | NO-GO | 当前不能实现，必须单独授权。 |
| embedding 调用 | NO-GO | 当前不能实现，必须单独授权。 |
| 向量索引 | NO-GO | 当前不能实现，必须单独授权。 |
| API / UI / DB / schema / migration | NO-GO | 当前不能实现，必须单独授权。 |
| RAG / AI 使用知识 runtime | NO-GO | 当前不能实现，必须单独授权。 |
| 真实 HIS / credential / 客户数据 / 模型 | NO-GO | 当前不能接入或处理。 |

## 13. 验收标准

本计划完成的验收标准：

- 单独覆盖 mock 到真实检索的边界。
- 单独覆盖索引生命周期。
- 单独覆盖 tenant / institution / workspace / RBAC / visibilityScope 隔离。
- 单独覆盖召回字段白名单。
- 单独覆盖成本与限额。
- 单独覆盖失败态。
- 明确当前不能实现 runtime。
- 明确不触碰 API / UI / DB / schema / migration / service / repository / adapter。
- 明确不接真实 HIS / credential / 客户数据 / 模型。
- 明确后续任务只是建议，不是开发许可。
- 工作区只包含本计划文档改动。

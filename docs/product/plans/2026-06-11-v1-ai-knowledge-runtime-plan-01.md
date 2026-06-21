# V1 AI 使用知识 runtime 计划 01

## 0. 文档元信息

- 任务编号：ZMTG-V1-AI-KNOWLEDGE-RUNTIME-PLAN-01。
- 中文名：V1 AI 使用知识 runtime 计划。
- 日期与时区：2026-06-11 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：V1 知识库 demo readonly、知识库检索 / embedding / 向量索引规划之后，真实 AI 使用知识 runtime 之前的 docs-only 规划。
- 当前基线：`main` / `origin/main` 为 `4adc79f92d6a1879ae29280306f6ad851eb02d6a`。
- 任务性质：docs-only / plan-only / no AI runtime implementation / no real model integration。

本文档只规划未来 AI 如何在授权范围内使用知识库、如何避免 prompt / completion 落入敏感信息、如何控制模型权限、如何审计、如何保留人工确认边界。本文档不是开发授权，不是 API / UI / DB / schema / migration 授权，不是模型接入授权，也不是 AI runtime、RAG runtime、自动触达或自动执行授权。

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
- 不实现 AI runtime。
- 不接真实模型。
- 不实现 prompt runtime。
- 不实现 completion runtime。
- 不实现 RAG runtime。
- 不实现 embedding、向量索引或真实检索。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不写日志。
- 不自动营销、触达、创建任务、预约、成交、支付、合同或发票。

## 2. 规划目标

未来 AI 使用知识 runtime 必须先解决以下问题，再进入任何实现：

- AI 在什么场景下可以使用知识库，什么场景必须拒答或转人工。
- AI 使用平台知识库和机构知识库时如何遵守 tenant、institution、workspace、RBAC、visibilityScope 和 feature flag。
- prompt 输入如何只包含低敏任务上下文和低敏知识引用，不包含高敏原文。
- completion 输出如何只保留低敏建议、引用摘要和人工确认提示，不保存高敏全文。
- 模型权限如何按租户、角色、场景、模型能力、成本和风险分级。
- 审计如何记录调用、引用、拒答、失败和人工确认，不记录 prompt / completion 高敏全文。
- 人工确认如何阻断自动触达、自动任务、自动预约、自动成交和外部消息。

## 3. AI 使用知识的场景边界

| 场景 | 可用知识 | 输出目标 | 边界 |
| --- | --- | --- | --- |
| 客服话术草稿 | 授权平台 FAQ、机构 FAQ、机构 SOP。 | 内部候选话术。 | 必须人工确认，不自动发送。 |
| 治疗后随访建议 | 授权护理知识、机构术后注意事项、低敏治疗阶段摘要。 | 内部随访方向。 | 不替代医生判断，不自动创建任务。 |
| 复诊提醒解释 | 授权项目护理知识、复诊窗口规则摘要。 | 内部解释和人工判断提示。 | 不自动约诊，不同步 HIS。 |
| 复购机会解释 | 授权项目周期、机构服务说明、低敏生命周期摘要。 | 内部观察理由。 | 不做成交预测，不自动营销。 |
| 沉睡客户观察解释 | 授权机构 SOP、低敏客户生命周期摘要。 | 内部跟进提示。 | 不自动外呼，不自动唤醒。 |
| 运营日报草稿 | 授权低敏聚合指标和平台 SOP。 | 内部摘要草稿。 | 不等于真实 BI，不输出客户明细。 |
| 风险提示 | 授权合规禁用词、风险规则、拒答策略。 | 低敏风险提醒。 | 高风险必须转人工。 |

AI 不得用于：

- 自动医疗诊断。
- 自动客服对外发送。
- 自动营销或外呼。
- 自动创建任务、预约、成交、支付、合同或发票。
- 绕过知识库审核、发布、下架、版本和可见范围。
- 使用真实 HIS、credential、客户高敏原文或真实模型输出作为事实来源。

## 4. prompt 输入边界

未来 prompt 只能由低敏结构化输入拼装，不得直接保存或发送高敏原文。

允许进入 prompt 的候选字段：

- `tenantScopeLabel`
- `viewerRole`
- `scenario`
- `knowledgeBaseType`
- `readonlyCitationSummary`
- `safeKnowledgeSnippet`
- `safeCustomerStage`
- `safeTreatmentStage`
- `riskFlags`
- `requiredHumanConfirmation`
- `forbiddenActions`

禁止进入 prompt：

- 真实客户姓名、完整手机号、身份证、地址。
- 病历正文、诊断正文、治疗记录原文、咨询对话全文。
- 订单、支付、合同、发票、成交、回款信息。
- HIS raw payload、接口导出原文、真实系统凭证。
- credential、token、secret、API key、OAuth、Webhook secret。
- DB URL、SQL、stack、worker、路径、依赖错误。
- 文档原文、解析原文、chunk 原文。
- embedding 向量、向量索引内部字段。

prompt 构造必须先经过低敏字段白名单和 forbiddenActions 注入；模型不得被提示去执行业务动作。

## 5. completion 输出边界

未来 completion 不得直接落库为高敏全文，也不得作为自动执行指令。

允许保留的 completion 派生字段：

- `responseStatus`
- `safeSummary`
- `suggestedReadonlyAction`
- `citationSummaries`
- `riskFlags`
- `requiresHumanConfirmation`
- `refusalReason`
- `fallbackMessage`
- `auditSummary`

禁止保留：

- 模型完整原文输出。
- prompt 原文。
- 推理链、隐藏推理、模型内部解释。
- 真实客户高敏内容。
- 知识全文或 chunk 原文。
- 外部系统错误全文。
- 可自动执行的任务、预约、触达、营销、成交、支付、合同或发票参数。

completion 可用于展示前必须经过：

1. 输出低敏扫描。
2. 禁用语义检查。
3. 知识引用校验。
4. 人工确认状态标记。
5. 审计摘要生成。

## 6. 模型权限计划

模型权限必须按能力、租户、角色、场景和风险分级，不得存在全局默认可用模型。

| 权限维度 | 规划内容 | 拒绝口径 |
| --- | --- | --- |
| feature flag | 按 AI 能力和知识使用场景启停。 | 当前 AI 知识辅助能力暂未开启。 |
| tenant | 仅允许当前租户授权模型能力。 | 当前上下文无法使用该 AI 能力。 |
| role | 机构角色和平台角色分开授权。 | 当前账号没有使用该 AI 能力的权限。 |
| scenario | 话术草稿、随访建议、运营摘要等分场景授权。 | 当前场景暂不支持 AI 知识辅助。 |
| model capability | 只允许低敏摘要、草稿、分类、拒答等安全能力。 | 当前模型能力不可用于该场景。 |
| quota | 控制调用次数、成本和并发。 | 当前 AI 请求超过演示限制。 |
| risk level | 高风险医疗、营销、成交场景必须拒答或转人工。 | 当前问题需要人工确认。 |

当前不能接真实模型。任何真实模型接入都必须单独完成 credential 管理、供应商权限、成本、审计、回滚和安全评审。

## 7. 知识引用计划

AI 使用知识时必须只引用授权范围内的低敏知识摘要。

引用规则：

- 只能引用已发布、审核通过、非 stale、非 disabled 的知识。
- 只能引用当前 tenant / institution / workspace / role 可见范围内的知识。
- 平台知识必须检查适用租户、套餐、地区和角色。
- 机构知识必须限制在当前租户和机构授权范围。
- 引用必须保留低敏 `readonlyCitationSummary`。
- 引用缺失、不确定、冲突或高风险时必须拒答或转人工。

不得引用：

- 未审核知识。
- 草稿知识。
- 已下架知识。
- stale 知识。
- 来源缺失知识。
- 跨租户机构知识。
- 原始文档全文。
- embedding 向量或检索内部字段。

## 8. 审计计划

未来 AI 使用知识的审计必须只记录低敏摘要。

允许审计：

- `scenario`
- `tenantScope`
- `viewerRole`
- `featureFlagResult`
- `modelPermissionResult`
- `knowledgeCitationCount`
- `citationSourceTypes`
- `responseStatus`
- `requiresHumanConfirmation`
- `refusalReason`
- `fallbackReason`
- `costBucket`
- `quotaResult`

禁止审计：

- prompt 全文。
- completion 全文。
- 模型推理链。
- 知识全文。
- chunk 原文。
- 真实客户高敏原文。
- HIS raw payload。
- credential、token、secret。
- DB URL、SQL、stack、worker、路径。

审计必须能区分：

- 权限拒绝。
- 功能关闭。
- 知识未命中。
- 知识冲突。
- 高风险拒答。
- 模型不可用。
- 成本或额度拒绝。
- 人工确认通过、驳回、修改。

## 9. 人工确认边界

AI 输出必须默认进入人工确认，而不是自动执行。

人工确认必须覆盖：

- 客服话术是否可以对外发送。
- 随访建议是否可以转内部随访任务。
- 复诊建议是否可以形成预约意向。
- 复购建议是否可以进入内部跟进。
- 沉睡客户建议是否可以继续观察。
- 风险提示是否需要升级人工处理。

AI 输出不得直接：

- 发送微信、企微、短信、电话或任何外部消息。
- 创建任务。
- 创建预约。
- 修改客户状态。
- 推动成交。
- 发起支付、合同或发票。
- 写入 HIS。

人工确认记录本身也必须低敏，不得保存完整 prompt、completion 或高敏客户原文。

## 10. 失败态计划

| 状态 | 触发条件 | 用户可见文案边界 |
| --- | --- | --- |
| `disabled` | AI 知识辅助功能关闭。 | AI 知识辅助能力暂未开启。 |
| `denied` | RBAC 不允许。 | 当前账号没有使用 AI 知识辅助的权限。 |
| `tenant_mismatch` | 上下文与目标租户不一致。 | 当前上下文无法使用该知识来源。 |
| `model_unavailable` | 模型不可用或未配置。 | 当前 AI 能力暂不可用。 |
| `knowledge_missing` | 没有授权知识来源。 | 暂未找到可引用的知识来源。 |
| `citation_conflict` | 召回知识冲突。 | 知识来源存在冲突，请转人工确认。 |
| `risk_blocked` | 高风险医疗、营销或合规场景。 | 当前问题需要人工确认。 |
| `quota_denied` | 超限或限频。 | 当前 AI 请求超过限制，请稍后重试。 |
| `unsafe_prompt_blocked` | prompt 输入含高敏内容。 | 输入内容不适合进入 AI 处理。 |
| `unsafe_completion_blocked` | completion 输出含高敏或禁止语义。 | AI 输出需要人工复核后才能使用。 |

失败态不得包含供应商错误、模型错误全文、prompt、completion、stack、worker、文件路径、DB 连接、SQL、token、secret 或 credential。

## 11. 从计划到 runtime 的后续切片建议

以下只是后续建议，不是开发许可：

1. AI 使用知识 test plan docs-only。
2. AI 知识输入 contract test-only，只使用 mock / seed / demo 低敏上下文。
3. prompt 字段白名单 contract test-only，只做纯函数。
4. completion 输出白名单 contract test-only，只验证低敏派生字段。
5. 模型权限 contract test-only，只用 mock model permission metadata。
6. AI 引用知识审计 contract test-only，只验证低敏审计摘要。
7. 人工确认边界 contract test-only，只验证 AI 输出不能自动执行。
8. 最小 AI 知识辅助 API / UI / 模型接入评审，必须单独授权。

## 12. Go / No-Go

| 类型 | 结论 | 规则 |
| --- | --- | --- |
| docs-only 计划 | GO | 当前可以完成。 |
| test-plan-only | GO | 后续可单独规划。 |
| mock / seed / demo contract | CONDITIONAL-GO | 必须单独授权，且只做纯 domain / tests。 |
| AI runtime | NO-GO | 当前不能实现，必须单独授权。 |
| 真实模型接入 | NO-GO | 当前不能接入，必须单独授权。 |
| prompt / completion runtime | NO-GO | 当前不能实现，必须单独授权。 |
| RAG / 检索 / embedding / 向量索引 | NO-GO | 当前不能实现，必须单独授权。 |
| API / UI / DB / schema / migration | NO-GO | 当前不能实现，必须单独授权。 |
| 真实 HIS / credential / 客户数据 | NO-GO | 当前不能接入或处理。 |

## 13. 验收标准

本计划完成的验收标准：

- 单独覆盖 AI 如何使用知识库。
- 单独覆盖 prompt 不落敏感信息。
- 单独覆盖 completion 不落敏感信息。
- 单独覆盖模型权限。
- 单独覆盖审计。
- 单独覆盖人工确认边界。
- 明确当前不能接真实模型。
- 明确当前不能实现 AI runtime。
- 明确不触碰 API / UI / DB / schema / migration / service / repository / adapter。
- 明确不接真实 HIS / credential / 客户数据。
- 明确后续任务只是建议，不是开发许可。
- 工作区只包含本计划文档改动。

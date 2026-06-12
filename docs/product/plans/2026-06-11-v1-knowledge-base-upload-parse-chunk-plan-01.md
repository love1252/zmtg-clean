# V1 知识库上传 / 解析 / 分块计划 01

## 0. 文档元信息

- 任务编号：ZMTG-V1-KNOWLEDGE-BASE-UPLOAD-PARSE-CHUNK-PLAN-01。
- 中文名：V1 知识库上传 / 解析 / 分块计划。
- 日期与时区：2026-06-11 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：V1 知识库 demo readonly 能力之后、真实上传 / 解析 / 分块 runtime 之前的 docs-only 规划。
- 当前基线：`main` / `origin/main` 为 `4adc79f92d6a1879ae29280306f6ad851eb02d6a`。
- 任务性质：docs-only / plan-only / no runtime / no upload implementation / no parser implementation / no chunking implementation。

本文档只规划未来知识库上传、文档解析、文档分块、文件类型、失败态、低敏边界和安全扫描。本文档不是开发授权，不是 API / UI / DB / schema / migration 授权，不是上传、解析、分块、embedding、向量索引、检索或 AI 使用知识 runtime 授权。

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
- 不实现文件上传 runtime。
- 不实现文档解析 runtime。
- 不实现文档分块 runtime。
- 不实现 OCR、embedding、向量索引、检索 runtime 或 RAG runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不接真实模型。
- 不写日志。
- 不自动营销、触达、创建任务、预约、成交、支付、合同或发票。

## 2. 规划目标

未来知识库上传 / 解析 / 分块能力必须先解决以下问题，再进入任何 runtime：

- 文件从哪里来、由谁上传、属于平台知识库还是机构知识库。
- 文件类型、大小、数量、命名、版本和可见范围如何限制。
- 上传前、上传中、上传后如何做低敏校验和安全扫描。
- 解析产物是否只保留低敏摘要，如何避免保存高敏原文。
- 分块策略如何保留来源、版本、目录、可见范围和审计线索。
- 失败态如何产品化展示，不暴露技术栈、路径、worker、依赖错误或外部系统原文。
- 哪些内容必须人工审核后才能进入发布或检索候选。

## 3. 能力拆分

| 能力 | 未来目标 | 当前边界 |
| --- | --- | --- |
| 文件上传入口 | 支持平台或机构在权限范围内提交知识来源文件。 | 当前不实现上传 UI / API / storage。 |
| 文件类型识别 | 对扩展名、MIME、魔数和文件大小做一致性判断。 | 当前不接真实文件。 |
| 安全扫描 | 规划病毒扫描、敏感字段扫描、凭证扫描和高敏内容阻断。 | 当前不实现扫描 runtime。 |
| 文档解析 | 将允许文件解析成低敏候选结构和解析摘要。 | 当前不实现 parser / OCR。 |
| 文档分块 | 将低敏候选内容拆成可治理的知识片段。 | 当前不实现 chunking。 |
| 人工审核 | 上传、解析、分块后必须进入人工审核和发布边界。 | 当前不实现审核 workflow。 |
| 版本追踪 | 文件、解析结果、分块结果和发布内容必须可追踪。 | 当前不写 schema。 |
| 失败降级 | 所有失败只返回低敏产品文案和可人工处理建议。 | 当前不写 error mapper。 |

## 4. 文件类型计划

首批文件类型应按低风险优先级规划，不应一次性支持所有格式。

| 文件类型 | 未来候选用途 | 风险 | 规划结论 |
| --- | --- | --- | --- |
| `.txt` | 低敏 FAQ、SOP、话术草稿。 | 低，仍需敏感词和凭证扫描。 | 可作为首批候选。 |
| `.md` | 结构化内部知识、护理说明、FAQ。 | 低到中，需禁止嵌入外链凭证和高敏原文。 | 可作为首批候选。 |
| `.csv` | 批量 FAQ 或术语表。 | 中，容易夹带客户、手机号、订单。 | 首批可候选，但必须强白名单列。 |
| `.pdf` | 机构资料、培训资料。 | 中到高，解析复杂，可能含图片和扫描件。 | 后置候选，必须单独 parser 计划。 |
| `.docx` | 机构 SOP、培训文档。 | 中到高，可能含修订、批注、隐藏内容。 | 后置候选，必须处理元数据和批注。 |
| `.xlsx` | 项目表、FAQ 表。 | 高，容易夹带客户、价格、订单和隐藏 sheet。 | 不建议首批，必须单独表格计划。 |
| 图片文件 | 扫描件、海报、截图。 | 高，需要 OCR，可能含人脸和证件。 | V1 上传解析首批不支持。 |
| 压缩包 | 批量资料。 | 高，存在嵌套、炸弹文件和混合敏感内容。 | V1 上传解析首批不支持。 |

首批建议只规划 `.txt`、`.md` 和受限 `.csv`。`.pdf`、`.docx`、`.xlsx`、图片和压缩包必须后置，并单独完成解析、安全和失败态计划。

## 5. 上传前校验计划

上传前必须规划以下只读判断和拒绝口径：

- feature disabled：能力未开启，不泄露存储、解析或扫描配置。
- tenant mismatch：拒绝跨 tenant 上传，不泄露目标知识库是否存在。
- RBAC denied：只返回低敏拒绝状态，不返回目录、文件名或知识库详情。
- knowledgeBaseType invalid：拒绝未知类型，只允许平台知识库或机构知识库候选。
- unsupported file type：返回“不支持该文件类型”，不展示 parser 内部信息。
- file too large：返回“文件超过当前演示限制”，不展示底层限制配置。
- file count exceeded：返回“批次文件数量超过限制”，不创建部分上传。
- unsafe filename：拒绝路径穿越、控制字符、隐藏扩展名和可执行伪装。
- duplicate source：提示存在重复来源候选，但不得覆盖既有知识。

## 6. 安全扫描计划

安全扫描必须在解析和分块之前完成，失败时不得继续进入后续阶段。

| 扫描类型 | 未来扫描目标 | 拒绝或降级口径 |
| --- | --- | --- |
| 文件签名扫描 | 扩展名、MIME 和文件魔数一致。 | 文件类型无法确认，请更换文件。 |
| 恶意文件扫描 | 病毒、宏、脚本、嵌入可执行内容。 | 文件安全校验未通过。 |
| 凭证扫描 | token、secret、API key、OAuth、Webhook secret、私钥。 | 文件包含不允许上传的凭证信息。 |
| HIS 原文扫描 | HIS raw payload、接口响应、病历导出原文。 | 文件包含不允许进入知识库的系统原文。 |
| 真实客户数据扫描 | 姓名、完整手机号、身份证、地址、订单、支付、病历正文。 | 文件包含不允许上传的客户敏感信息。 |
| 技术信息扫描 | DB URL、SQL、stack、路径、worker、依赖错误。 | 文件包含不应进入知识库的技术细节。 |
| 合规词扫描 | 疗效保证、绝对化承诺、诱导营销表达。 | 文件包含需要人工复核的合规风险。 |

扫描结论必须只保留低敏结果，例如 `passed`、`blocked_sensitive_content`、`requires_manual_review`、`unsupported_type`。不得保存命中的高敏原文。

## 7. 文档解析计划

解析阶段只应产出低敏候选结构，不应直接进入发布或检索。

未来解析输出候选字段：

- `sourceId`
- `sourceType`
- `sourceLabel`
- `knowledgeBaseType`
- `catalogPath`
- `detectedFileType`
- `parserStatus`
- `safeTitle`
- `safeSummary`
- `sectionSummaries`
- `riskFlags`
- `reviewRequired`
- `failureReason`

解析阶段不得输出：

- 文档完整原文。
- 病历、诊断、咨询、治疗记录正文。
- 完整手机号、身份证、地址。
- 订单、支付、合同、发票。
- credential、token、secret、API key。
- HIS raw payload。
- SQL、DB URL、stack、worker、文件路径。
- AI prompt、completion、模型输出。

解析失败必须走产品化低敏文案，例如：

- “文件内容暂无法解析，请人工检查后重试。”
- “文件包含不适合进入知识库的内容，请先清理后重新上传。”
- “当前文件类型暂不支持自动解析。”

## 8. 文档分块计划

分块只能处理已通过安全扫描和解析低敏校验的候选内容。分块不是 embedding，不是检索，不是 AI 问答。

未来 chunk 候选字段：

- `chunkId`
- `sourceId`
- `knowledgeItemId`
- `chunkIndex`
- `catalogPath`
- `safeHeading`
- `safeSnippet`
- `sourceVersion`
- `visibilityScope`
- `reviewStatus`
- `riskFlags`
- `readonlyCitationSummary`

分块策略候选：

- 按标题和段落优先，不按固定字符粗暴切断。
- 每个 chunk 必须保留来源文件、版本、目录、可见范围和审核状态。
- chunk 只能保存低敏摘要或低敏片段，不保存高敏原文。
- chunk 不得跨平台知识库和机构知识库混合。
- chunk 不得跨 tenant、institution、workspace 混合。
- chunk 必须支持 stale、source missing、review required 和 disabled 状态。

## 9. 失败态计划

| 状态 | 触发条件 | 用户可见文案边界 |
| --- | --- | --- |
| `disabled` | 功能开关关闭。 | 知识库上传能力暂未开启。 |
| `denied` | RBAC 不允许。 | 当前账号没有上传知识来源的权限。 |
| `tenant_mismatch` | 请求上下文与目标租户不一致。 | 当前上下文无法访问该知识库。 |
| `unsupported_type` | 文件类型不在允许范围。 | 当前文件类型暂不支持。 |
| `file_too_large` | 文件超过限制。 | 文件超过当前上传限制。 |
| `scan_blocked` | 安全扫描阻断。 | 文件安全校验未通过。 |
| `sensitive_content_blocked` | 命中高敏客户、凭证或 HIS 原文。 | 文件包含不适合进入知识库的敏感内容。 |
| `parse_failed` | 解析失败。 | 文件内容暂无法解析，请人工检查后重试。 |
| `chunk_failed` | 分块失败。 | 文件已接收但暂无法整理为知识片段。 |
| `review_required` | 需要人工审核。 | 文件需要人工审核后才能进入知识库。 |
| `partial` | 批次中部分文件失败。 | 部分文件未通过校验，请查看低敏原因。 |

失败态不得包含 stack、worker、文件路径、依赖错误、存储桶名、DB 连接、SQL、外部扫描引擎原文或 parser 异常全文。

## 10. 低敏边界

允许进入未来上传 / 解析 / 分块链路的内容只能是低敏知识来源：

- 平台 FAQ、SOP、护理注意事项、风险提示、禁用表达。
- 机构项目介绍、服务说明、内部 FAQ、低敏客服话术。
- 不含真实客户个案的培训资料。
- 不含凭证和外部系统原文的内部流程说明。

禁止进入：

- 真实客户姓名、完整手机号、身份证、地址。
- 病历正文、诊断正文、治疗记录原文、咨询对话全文。
- 订单、支付、合同、发票、成交、回款信息。
- HIS raw payload、接口导出原文、真实系统凭证。
- DB URL、SQL、stack、worker、路径、依赖错误。
- AI prompt、completion、模型输出、embedding、向量内容。
- 可自动触发营销、触达、任务、预约、成交、支付、合同或发票的指令。

## 11. 审核和发布前置

上传、解析、分块之后，不得直接进入可用知识。必须规划以下人工审核前置：

- 上传来源审核。
- 安全扫描结论复核。
- 解析摘要复核。
- chunk 可见范围复核。
- 平台知识和机构知识边界复核。
- 合规风险和禁用表达复核。
- 版本号、发布时间和下架策略复核。

只有审核通过的内容才可作为未来 readonly 或检索候选；审核未通过内容只能保留低敏失败记录或被丢弃。

## 12. 未来任务切片建议

以下只是后续建议，不是开发许可：

1. 上传 / 解析 / 分块 test plan docs-only。
2. 上传输入 contract test-only，使用 mock / seed / demo 文件元数据，不接真实文件。
3. 文件类型与安全扫描 contract test-only，只做纯函数。
4. 解析结果低敏 contract test-only，只使用 mock 文本片段。
5. 分块 contract test-only，只验证来源、版本、可见范围和低敏字段。
6. 最小 API / UI / storage 评审，必须单独授权。
7. 最小 runtime 实现，必须在 schema、存储、安全扫描和回滚方案单独批准后才可进入。

## 13. Go / No-Go

| 类型 | 结论 | 规则 |
| --- | --- | --- |
| docs-only 计划 | GO | 当前可以完成。 |
| test-plan-only | GO | 后续可单独规划。 |
| mock / seed / demo contract | CONDITIONAL-GO | 必须单独授权，且只做纯 domain / tests。 |
| 上传 runtime | NO-GO | 当前不能实现，必须单独授权。 |
| 文档解析 runtime | NO-GO | 当前不能实现，必须单独授权。 |
| 文档分块 runtime | NO-GO | 当前不能实现，必须单独授权。 |
| API / UI / DB / schema / migration | NO-GO | 当前不能实现，必须单独授权。 |
| embedding / 向量索引 / 检索 / RAG | NO-GO | 当前不能实现，必须单独授权。 |
| 真实 HIS / credential / 客户数据 / 模型 | NO-GO | 当前不能接入或处理。 |

## 14. 验收标准

本计划完成的验收标准：

- 单独覆盖上传、文档解析、分块、文件类型、失败态、低敏边界和安全扫描。
- 明确当前不能实现 runtime。
- 明确不触碰 API / UI / DB / schema / migration / service / repository / adapter。
- 明确不接真实 HIS / credential / 客户数据 / 模型。
- 明确后续任务只是建议，不是开发许可。
- 工作区只包含本计划文档改动。

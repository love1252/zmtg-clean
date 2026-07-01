# V0.6-AI-CREDITS-10E-5A：服务项目消耗字段口径设计

## 1. 背景

平台端「AI 用量与费用」当前已完成一组低敏运营统计能力：

1. AI 积分消耗。
2. Token 总量。
3. 调用次数。
4. 成功率。
5. 厂商 / 模型统计。
6. 单日模型构成。
7. 租户排行。

这些统计可以回答「谁用了多少」「用了哪个厂商 / 模型」「消耗了多少 Token / AI 积分」等运营问题，但还不能可靠回答「这些 AI 消耗具体发生在哪些业务场景 / 服务项目中」。

原因是现有 AI usage records 主要记录调用状态、租户、厂商、模型、Token、AI 积分和低敏 RAG 使用摘要，无法稳定判断一次 AI 消耗来自「知识库文件解析」「AI 问答」「运营辅助」「自动随访」或其他服务项目。仅依赖 prompt、question、answer、metadata 原文或 provider 返回内容做归因，会引入敏感信息泄露、误判和不可审计风险。

因此，本设计只定义未来服务项目消耗统计所需的低敏字段和写入口径。它不实现 schema、API、UI 或写入链路。

## 2. 设计目标

本阶段目标是为后续平台端服务项目消耗统计建立统一口径，使平台端未来可以按低敏服务项目维度汇总：

1. 知识库文件解析。
2. AI 问答。
3. AI 运营辅助。
4. 客户自动随访。
5. 系统健康检查。
6. 其他或无法归因调用。

设计原则：

1. 服务项目归因必须由调用入口显式传入，或由服务端受控映射生成。
2. 不靠 prompt、answer、rawResponse 或 metadata 原文猜测业务场景。
3. 平台端统计只展示低敏分类、调用次数、Token 总量、AI 积分消耗、成功率和占比。
4. 机构端是否展示服务项目统计，需要后续产品决策；默认不展示内部 provider、model、Token、成本或折算规则。
5. 历史数据不强制回填，不因为旧数据缺失阻塞新字段上线。

## 3. 建议字段

建议在未来 schema-only 阶段为 AI usage record 增加一组低敏服务项目归因字段，或采用等价的低敏结构保存。字段命名可以在 10E-5B 阶段结合现有 schema 规范再最终确认。

| 字段 | 含义 | 是否必填 | 平台端可见 | 机构端可见 | 是否可为空 |
| --- | --- | --- | --- | --- | --- |
| `serviceCategory` | 服务项目一级分类，用于聚合统计和排行，例如 `knowledge_base_qa`、`ai_qa`、`auto_followup`。 | 新记录建议必填；历史记录可空。 | 是。 | 默认否，后续产品决策。 | 历史 / legacy 可空。 |
| `serviceName` | 面向运营人员的低敏展示名，例如「知识库问答」「AI 问答」「客户自动随访」。 | 建议必填；可由 category 映射默认值。 | 是。 | 默认否，后续产品决策。 | 历史 / unknown 可空或使用默认文案。 |
| `serviceSource` | 归因来源，说明该分类由哪个入口或服务端映射产生，例如 `institution_ai_call`、`knowledge_base_parser`、`system_smoke`。 | 建议必填。 | 是。 | 默认否。 | 历史可空。 |
| `serviceAction` | 可选二级动作，用于区分同一服务项目下的细动作，例如 `parse_file`、`rag_answer`、`generate_followup`。 | 可选。 | 是。 | 默认否。 | 是。 |
| `serviceVersion` | 可选归因规则版本，用于审计分类规则变化，例如 `v06-service-metering-1`。 | 可选，但建议在自动映射场景写入。 | 是。 | 默认否。 | 是。 |

字段使用约束：

1. `serviceCategory` 应优先使用稳定枚举，不建议自由文本。
2. `serviceName` 可以是中文展示名，但应由服务端映射或受控配置产生，不建议由用户输入直写。
3. `serviceSource` 用于审计来源，不等同于 provider 或 model。
4. `serviceAction` 只保存低敏动作，不保存 prompt、问题、答案、文件名原文或客户信息。
5. `serviceVersion` 用于说明归因口径版本，不用于计费版本或模型计量版本替代。

## 4. 建议枚举

建议 `serviceCategory` 至少覆盖：

1. `knowledge_base_parse`：知识库文件解析、文本抽取、切分或索引前处理相关 AI 消耗。
2. `knowledge_base_qa`：基于知识库 RAG 检索上下文的问答消耗。
3. `ai_qa`：普通 AI 问答，不依赖知识库上下文。
4. `ai_operation_assist`：运营辅助、营销文案、客户分析建议、工作台辅助生成等。
5. `auto_followup`：自动随访、随访建议生成、自动化任务中的 AI 消耗。
6. `health_check`：系统健康检查、连接状态检查、受控探活。
7. `test_smoke`：平台或测试环境中的受控 smoke 调用。
8. `other`：已知入口但暂未细分的其他服务项目。
9. `unknown`：新链路中未能归因但不是历史数据的未知分类。
10. `legacy`：字段上线前的历史数据，或无法可靠补齐来源的旧记录。

`unknown` 与 `legacy` 的区别：

1. `legacy` 用于字段上线前的数据，表达「历史上没有采集这个字段」。
2. `unknown` 用于字段上线后仍无法归因的数据，表达「新链路存在归因缺口，需要排查入口」。
3. UI 应分别展示 `legacy / 历史未归因` 与 `unknown / 未知归因`，避免把历史缺失误判为新系统故障。

## 5. 写入口径

服务项目字段不能从 prompt 内容、answer 内容、provider raw response 或 metadata 原文推断，必须由调用入口显式传入或由服务端受控映射。

### 5.1 普通 AI 问答

普通 AI 问答入口应写入：

1. `serviceCategory = ai_qa`
2. `serviceName = AI 问答`
3. `serviceSource = institution_ai_call`
4. `serviceAction = direct_answer` 或空
5. `serviceVersion = 当前归因规则版本`

适用场景：用户在机构工作台发起不带知识库上下文的普通 AI 问答。

### 5.2 知识库 RAG 问答

知识库 RAG 问答入口应由服务端根据受控参数写入：

1. `serviceCategory = knowledge_base_qa`
2. `serviceName = 知识库问答`
3. `serviceSource = institution_knowledge_qa`
4. `serviceAction = rag_answer`
5. `serviceVersion = 当前归因规则版本`

判定依据应来自受控入口或显式参数，例如 `knowledgeContextUsed = true`、知识库问答 route / service，而不是从问题文本中猜测。

### 5.3 知识库文件解析

知识库文件解析、抽取、切分或索引前处理如果发生 AI 消耗，应写入：

1. `serviceCategory = knowledge_base_parse`
2. `serviceName = 知识库文件解析`
3. `serviceSource = knowledge_base_parser`
4. `serviceAction = parse_file`、`extract_text`、`summarize_chunk` 等低敏动作
5. `serviceVersion = 当前归因规则版本`

字段不得包含文件名原文、文件内容、chunk 原文、RAG source 原文或存储 key。

### 5.4 AI 运营辅助

运营辅助类入口应写入：

1. `serviceCategory = ai_operation_assist`
2. `serviceName = AI 运营辅助`
3. `serviceSource = operation_assistant`
4. `serviceAction = generate_copy`、`customer_analysis`、`workflow_suggestion` 等低敏动作
5. `serviceVersion = 当前归因规则版本`

如果一个入口既能生成营销文案又能生成客户建议，应通过受控 action 区分，不允许从生成内容推断。

### 5.5 自动随访 / 未来自动化任务

自动随访或未来自动化任务应写入：

1. `serviceCategory = auto_followup`
2. `serviceName = 客户自动随访`
3. `serviceSource = automation_followup`
4. `serviceAction = generate_followup`、`classify_followup`、`schedule_suggestion` 等低敏动作
5. `serviceVersion = 当前归因规则版本`

自动化任务需要明确任务来源和执行入口，但不得写入客户姓名、手机号、病历详情、随访正文或消息内容。

### 5.6 provider smoke / health check

平台受控健康检查应写入：

1. `serviceCategory = health_check`
2. `serviceName = 系统健康检查`
3. `serviceSource = platform_provider_health_check`
4. `serviceAction = provider_status_check`
5. `serviceVersion = 当前归因规则版本`

如果是明确的发布前 smoke，可使用：

1. `serviceCategory = test_smoke`
2. `serviceName = 系统测试调用`
3. `serviceSource = platform_ai_runtime_smoke`
4. `serviceAction = smoke_test`

产品上需要确认 `health_check` 和 `test_smoke` 是否计入业务消耗；默认建议平台端统计可见，但不计入租户业务消耗排行，避免污染业务运营判断。

### 5.7 系统测试调用

系统测试调用应与真实业务调用区分：

1. `serviceCategory = test_smoke`
2. `serviceName = 系统测试调用`
3. `serviceSource = test_or_staging_runtime`
4. `serviceAction = smoke_test` 或 `integration_test`

测试调用不得伪装成 `ai_qa` 或 `knowledge_base_qa`。

## 6. 低敏与安全边界

严禁写入或展示：

1. `prompt` / `question`
2. `answer`
3. `rawResponse`
4. `metadata` 原样 JSON
5. `meteringDetails` 原样 JSON
6. `apiKey` / `encryptedApiKey`
7. `baseUrl`
8. `Authorization` / `Cookie` / `Token`
9. 客户姓名、手机号、身份证、病历详情
10. RAG source 原文
11. 文件内容、chunk 原文、signedUrl、storageKey
12. `.env.local`、数据库连接、密钥或任何凭据

允许平台端展示：

1. `serviceCategory`
2. `serviceName`
3. 调用次数
4. Token 总量
5. AI 积分消耗
6. 成功率
7. 占比
8. 租户低敏标识
9. 低敏 `serviceSource` / `serviceAction`，前提是产品确认需要展示

机构端展示边界：

1. 机构端是否展示服务项目统计，必须作为后续产品决策。
2. 默认不在机构端展示内部 provider、model、Token、成本、计量规则或折算规则。
3. 如果未来机构端展示服务项目消耗，也应只展示产品化文案，例如「知识库问答」「AI 问答」「自动随访」，不展示内部来源字段。

## 7. 历史数据策略

1. 历史 AI usage records 不做 backfill。
2. 字段上线前的旧数据统一视为 `legacy` 或空值，并在查询层映射为「历史未归因」。
3. 字段上线后的无法归因数据使用 `unknown`，并作为后续入口治理信号。
4. UI 需要清楚标注 `legacy / 历史未归因` 与 `unknown / 未知归因`。
5. 不因为历史数据缺失阻塞新字段上线。
6. 不建议通过 prompt、answer、rawResponse、metadata 原文对历史数据做批量归因。

## 8. 后续任务拆分

### 10E-5B：schema-only

目标：新增服务项目归因字段或等价低敏结构。

边界：

1. 只做 DB schema / migration / schema tests。
2. 字段 nullable，不写默认值，不做 backfill。
3. 不接入写入链路，不改 UI。

### 10E-5C：写入口径接入

目标：在受控 AI 调用入口写入服务项目字段。

边界：

1. 普通 AI 问答、知识库 RAG 问答、知识库解析、运营辅助、自动随访、health check / smoke 分别明确映射。
2. 不靠 prompt 内容猜测。
3. 不改变 AI credits 计量逻辑，不改变 quota enforcement。
4. 不做历史数据回填。

### 10E-5D：平台端服务项目消耗 UI

目标：在平台端「AI 用量与费用」展示服务项目消耗统计。

建议展示：

1. 服务项目排行。
2. 调用次数、Token 总量、AI 积分消耗、成功率、占比。
3. `legacy / unknown` 明确标注。
4. 可与租户、日期、厂商 / 模型筛选联动。

边界：

1. 不展示客户高敏信息。
2. 不展示 prompt / answer / rawResponse。
3. 不做真实费用结算。

### 10E-5E：机构端是否展示的产品决策，可选

目标：判断机构端是否需要看到服务项目统计。

待确认：

1. 是否只展示「AI 服务额度」下的产品化项目，不展示内部技术字段。
2. 是否需要按套餐权益展示服务项目消耗。
3. 是否会造成机构端对 provider / model / Token / 成本的误解。

## 9. 本设计 PR 明确不包含

1. 不改 DB/schema/migration。
2. 不写代码。
3. 不新增 API。
4. 不改 AI call service。
5. 不改 usage 写入链路。
6. 不做 UI。
7. 不做费用估算。
8. 不做账单导出。
9. 不做真实数据写入。
10. 不做 provider 调用。
11. 不做测试服部署。
12. 不执行 migration。
13. 不执行 db:seed。
14. 不直接改数据库。
15. 不进入 10E-5B 或后续任务。

## 10. 风险和待确认问题

1. 服务项目分类是否足够稳定：如果业务线持续变化，`serviceCategory` 需要版本化治理，避免频繁改枚举。
2. 一个调用是否可能属于多个服务项目：例如自动随访中使用知识库问答，是否按入口归因，还是支持主分类 + 辅助标签，需要产品确认。
3. `serviceName` 是否允许自由文本：默认不建议自由文本，应由服务端映射或受控配置产生。
4. 自动化任务如何归因：需要明确任务创建入口、执行入口、失败重试和系统触发调用的归因规则。
5. 知识库解析与知识库问答是否分开统计：默认建议分开，解析偏内容生产 / 索引成本，问答偏使用成本。
6. health check / smoke 是否计入业务消耗：默认建议平台可见，但不计入租户业务服务项目排行，避免污染运营数据。
7. 机构端是否需要看到服务项目统计：需要后续产品决策，默认不展示内部技术字段和成本字段。
8. 归因缺失的监控：字段上线后 `unknown` 占比过高，应作为入口治理问题，而不是 UI 展示问题。

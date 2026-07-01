# V0.6-AI-CREDITS-10E-5C-2：服务项目写入口径覆盖面盘点与缺口收口

## 1. 背景

10E-5B 已为 `ai_call_usage_records` 增加低敏服务项目归因字段。10E-5C-1 已在 AI usage record 创建链路中接入 `serviceCategory`、`serviceName`、`serviceSource`、`serviceAction`、`serviceVersion`，并覆盖普通 AI 问答与知识库 RAG 问答。

本轮只盘点当前代码中已经存在的 AI usage record 写入入口，并对能明确归因、风险低的既有写入缺口做最小收口。它不新增业务写入，不补造尚不存在的服务项目记录。

## 2. 已盘点的 usage 写入入口

1. `requestInstitutionAiCallService` 主调用链路：
   - 通过 `createMeteredUsageRecord` 写入 usage record。
   - 覆盖成功调用、provider unavailable、rate limited、failed、unsafe response、sensitive input rejected。
   - 普通 AI 问答写入 `ai_qa / AI 问答 / institution_ai_call / direct_answer`。
   - 命中知识库上下文的 RAG 问答写入 `knowledge_base_qa / 知识库问答 / institution_knowledge_qa / rag_answer`。
2. `recordAiCallQuotaRejection` 超限拒绝审计链路：
   - 通过 `createMeteredUsageRecord` 写入 `quota_exceeded_ai_calls` usage record。
   - 本轮前未写入 service project 字段。
   - 本轮补齐为 `ai_qa / AI 问答 / institution_ai_call / quota_rejected`。
3. `createAiCallUsageRepository.createUsageRecord` 底层 repository：
   - 负责把上层传入的 service project 字段写入 `ai_call_usage_records`。
   - 本身不是业务入口，不负责推断服务项目。
4. 平台端 AI usage credits 查询：
   - 仅读取和聚合 usage records。
   - 不写入 usage record。
5. 租户 quota enforcement：
   - 只读取既有 usage records 统计额度。
   - 不写入 usage record。

## 3. 已覆盖入口

1. 普通 AI 问答：
   - `serviceCategory = ai_qa`
   - `serviceName = AI 问答`
   - `serviceSource = institution_ai_call`
   - `serviceAction = direct_answer`
   - `serviceVersion = v06-service-metering-1`
2. 知识库 RAG 问答：
   - `serviceCategory = knowledge_base_qa`
   - `serviceName = 知识库问答`
   - `serviceSource = institution_knowledge_qa`
   - `serviceAction = rag_answer`
   - `serviceVersion = v06-service-metering-1`
3. 敏感输入拒绝：
   - 属于机构 AI 问答入口的受控拒绝。
   - 沿用 `ai_qa / AI 问答 / institution_ai_call` 归因。
4. provider unavailable / rate limited / failed：
   - 属于已发起的机构 AI 问答或知识库 RAG 问答。
   - 沿用调用前已解析出的普通问答或 RAG 归因。

## 4. 本轮补齐入口

1. `quota_exceeded_ai_calls`：
   - 入口：`recordAiCallQuotaRejection`。
   - 触发：机构 AI 调用 route 在 quota 检查不通过时写入受控拒绝审计记录。
   - 归因：`ai_qa / AI 问答 / institution_ai_call / quota_rejected`。
   - 原因：这是已存在的 usage record 写入入口，来源明确为机构 AI 问答入口；补充归因不改变 quota enforcement、不调用 provider、不改变 metering not_billable 口径。

## 5. 暂不补齐入口及原因

以下服务项目在 10E-5A 设计中存在，但当前代码盘点未发现对应的既有 AI usage record 写入入口，因此本轮不补造记录、不新增写入业务：

1. `knowledge_base_parse / 知识库文件解析`：
   - 当前未发现知识库文件解析会写 AI usage record。
   - 后续如解析链路真实发生 AI 消耗，应在对应入口显式传入归因。
2. `ai_operation_assist / AI 运营辅助`：
   - 当前未发现运营辅助链路写 AI usage record。
   - 后续应由运营辅助入口显式传入低敏 service project。
3. `auto_followup / 客户自动随访`：
   - 当前未发现自动随访链路写 AI usage record。
   - 后续应在自动化任务真实接入 AI usage 写入时补充。
4. `health_check / 系统健康检查`：
   - 当前未发现 provider health check 写 AI usage record。
   - 后续需产品确认是否计入业务消耗或仅作为平台运维消耗展示。
5. `test_smoke / 系统测试调用`：
   - 当前未发现 smoke 测试写 AI usage record。
   - 后续如接入，应明确区分测试调用与真实业务调用。

## 6. 低敏边界

服务项目归因字段只允许保存受控低敏枚举和展示名：

1. `serviceCategory`
2. `serviceName`
3. `serviceSource`
4. `serviceAction`
5. `serviceVersion`

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
11. `.env.local`、数据库连接、密钥或任何凭据

机构端 DTO 仍不暴露内部 provider、model、Token、AI Credits 折算规则或服务项目归因字段。

## 7. 明确不包含

本轮不包含：

1. 不改 DB / schema / migration。
2. 不新增 migration。
3. 不执行 migration。
4. 不执行 `db:seed`。
5. 不直接写数据库。
6. 不新增 API route。
7. 不改 server/API response DTO 暴露字段。
8. 不改 UI。
9. 不改机构端 UI/API。
10. 不改 quota enforcement。
11. 不新增 usage record 写入业务。
12. 不做 backfill。
13. 不部署测试服。
14. 不调用 provider。
15. 不做真实 AI smoke。
16. 不做费用估算或账单导出。

## 8. 后续建议

1. 10E-5C-3：如果后续发现知识库解析、运营辅助、自动随访、health check 或 smoke 已存在真实 usage 写入入口，再按入口逐一补 service project，不做批量猜测。
2. 10E-5D：平台端服务项目消耗 UI 只基于已写入的低敏归因字段展示，不从 prompt、answer、metadata 原文推断。
3. 10E-5E：机构端是否展示服务项目消耗需单独产品决策，默认不展示内部 provider/model/token/cost。

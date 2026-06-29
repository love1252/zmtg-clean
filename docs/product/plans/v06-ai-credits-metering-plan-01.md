# V0.6-AI-CREDITS-01 平台 AI 积分与 Token 折算体系盘点设计

任务编号：`V0.6-AI-CREDITS-01`

生成日期：2026-06-29

本文档只做只读盘点与产品 / 技术设计，不修改业务代码，不新增 schema，不新增 migration，不执行 migration，不执行 `db:seed`，不改数据库，不部署测试服，不调用 provider，不改 quota / 套餐逻辑，不实现真实积分系统。

## 1. 目标与结论

1. 目标是为后续“平台内部 Token / 成本 / AI 积分换算，机构端只看 AI 积分或 AI 使用额度”建立可落地方案。
2. 建议 V0.5 已落地的 `ai_calls` 暂时保留为“成功调用次数额度”。
3. 建议 V0.6 新增 `ai_credits` 作为“平台统一 AI 积分额度”。
4. 机构端未来逐步从“调用次数”过渡到“AI 积分”，但不直接暴露 Token、模型、厂商或成本。
5. 平台端保留 raw token、provider、model、cost、multiplier、RAG 附加成本和审计明细。
6. 历史记录不强制回填积分，可标记为旧计量记录，并在平台端按“legacy / 未折算”口径展示。

## 2. 当前事实盘点

### 2.1 当前 AI call usage record schema

1. 当前持久化表是 `ai_call_usage_records`，定义在 `src/server/db/schema.ts:1215`。
2. 字段包括：
   - `id`
   - `tenantId`
   - `institutionId`
   - `actorUserId`
   - `provider`
   - `model`
   - `promptTokens`
   - `completionTokens`
   - `totalTokens`
   - `latencyMs`
   - `status`
   - `errorCode`
   - `metadata`
   - `createdAt`
3. 当前索引包括租户 + 记录唯一约束、租户创建时间索引、租户 + 机构 + 创建时间索引，见 `src/server/db/schema.ts:1235`。
4. 当前表没有 AI 积分字段，没有成本字段，没有模型折算版本字段，没有 billable / meteringVersion / legacyMetering 字段。

### 2.2 当前 provider / model 保存字段

1. AI 调用记录中直接保存 `provider` 和 `model`，见 `src/server/db/schema.ts:1224`。
2. 调用记录 repository 在创建记录时写入 `provider`、`model`、`promptTokens`、`completionTokens`、`totalTokens`，见 `src/modules/institution/server/institution-ai-call-usage-repository.ts:40`。
3. 平台 provider 配置表是 `platform_ai_provider_configs`，字段包括 `provider`、`baseUrl`、`model`、`encryptedApiKey`、`configured`、`lastCheckStatus`、`lastCheckedAt`，见 `src/server/db/schema.ts:556`。
4. 平台模型配置快照表是 `platform_ai_model_config_snapshots`，保存 `scenarioDefaults`、`agentInheritance`、`modelStates`、`providerStates`、`dryRunResults` 等 JSON，见 `src/server/db/schema.ts:575`。
5. 平台 AI 模型配置 API 通过 `GET /api/v1/open-platform/ai-model-config` 和 `PUT /api/v1/open-platform/ai-model-config` 读取 / 保存受控持久化视图，见 `src/app/api/v1/open-platform/ai-model-config/route.ts:74` 和 `src/app/api/v1/open-platform/ai-model-config/route.ts:94`。
6. 平台 runtime provider config API 通过 `GET /api/v1/open-platform/ai-runtime/provider-config` 和 `POST /api/v1/open-platform/ai-runtime/provider-config` 读取 / 保存低敏 provider 配置状态，见 `src/app/api/v1/open-platform/ai-runtime/provider-config/route.ts:26` 和 `src/app/api/v1/open-platform/ai-runtime/provider-config/route.ts:40`。

### 2.3 当前 promptTokens / completionTokens / totalTokens 保存逻辑

1. 调用 provider 使用 OpenAI-compatible `/chat/completions` 接口，见 `src/modules/institution/server/institution-ai-call-service.ts:453`。
2. 成功响应优先读取 `body.usage.prompt_tokens`、`body.usage.completion_tokens`、`body.usage.total_tokens`，见 `src/modules/institution/server/institution-ai-call-service.ts:527`。
3. 如果 provider 未返回 usage，则使用本地 `estimateTokens` 回退估算：`text.length / 4` 向上取整，见 `src/modules/institution/server/institution-ai-call-service.ts:216` 和 `src/modules/institution/server/institution-ai-call-service.ts:528`。
4. 成功调用写入 `status: 'succeeded'`，并保存 `promptTokens`、`completionTokens`、`totalTokens`，见 `src/modules/institution/server/institution-ai-call-service.ts:536`。
5. provider 非 200、unsafe response、timeout、network error 等失败路径也会写入记录，但通常只有 prompt 估算或 null，不写 completion / total 完整 usage，见 `src/modules/institution/server/institution-ai-call-service.ts:470`、`src/modules/institution/server/institution-ai-call-service.ts:503`、`src/modules/institution/server/institution-ai-call-service.ts:575`。
6. 敏感输入拒绝记录写 `model: 'pre_call_safety_check'`，token 字段为 null，且不调用 provider，见 `src/modules/institution/server/institution-ai-call-service.ts:323`。
7. quota 超限拒绝记录写 `status: 'rejected'`、`errorCode: 'quota_exceeded_ai_calls'`，token 字段为 null，见 `src/modules/institution/server/institution-ai-call-service.ts:604`。

### 2.4 当前 AI quota 计算逻辑

1. 当前 AI quota resource 是 `ai_calls`，定义在 `TENANT_QUOTA_RESOURCES`，见 `src/modules/institution/domain/quota-enforcement.ts:0`。
2. 当前套餐兜底 quota 中 `trial-care` 为 100 次、`starter-care` 为 500 次、`growth-care` 为 2500 次，见 `src/modules/institution/domain/quota-enforcement.ts:42`。
3. 当前租户 quota snapshot 表 `tenant_quota_snapshots` 保存 `maxAiCalls` 与 `currentAiCalls`，见 `src/server/db/schema.ts:524`。
4. 当前 active quota 优先取最新 `tenantQuotaSnapshots.maxAiCalls`，否则回退到 server trusted plan code 常量，见 `src/modules/institution/server/tenant-quota-enforcement.ts:41`。
5. 当前 AI 调用本月用量计算为：统计当月 `ai_call_usage_records` 中 `tenantId` 相同且 `status = 'succeeded'` 的记录数，见 `src/modules/institution/server/tenant-quota-enforcement.ts:126`。
6. 机构端 AI call route 在调用 provider 前先执行 `checkTenantQuotaForCreate({ resource: 'ai_calls' })`，见 `src/app/api/institution/knowledge-management/ai-call/route.ts:52`。
7. quota 不允许时，route 写入超限拒绝审计记录后返回 409，不调用 provider，见 `src/app/api/institution/knowledge-management/ai-call/route.ts:58`。
8. 当前失败、拒绝、敏感输入、provider 不可用等记录不会进入成功调用额度，因为 quota 统计只看 `status = 'succeeded'`。

### 2.5 当前套餐 entitlement / quota 配置逻辑

1. 套餐版本表 `tenant_plan_versions` 已有 `monthlyAiCallLimit`、`quotaEntitlementsJson`、`connectorEntitlementsJson`、`serviceEntitlementsJson`、`featureEntitlementsJson` 等字段，见 `src/server/db/schema.ts:304`。
2. 套餐目录 draft payload 可编辑 `monthlyAiCallLimit` 与各类 entitlement JSON，见 `src/modules/open-platform/domain/plan-catalog.ts:37`。
3. 套餐目录 repository 会读写 `monthlyAiCallLimit` 与 entitlement JSON，见 `src/modules/open-platform/server/plan-catalog-repository.ts:39` 和 `src/modules/open-platform/server/plan-catalog-repository.ts:180`。
4. 租户开通 / 套餐绑定生成 authorization snapshot 时，`quotaJson` 当前包含 `monthlyAiCallLimit`，见 `src/modules/open-platform/domain/tenant-plan-binding.ts:55`。
5. 套餐变更预览中当前展示项包含 `monthlyAiCallLimit`，标签为 `AI 调用 / 月`，见 `src/modules/open-platform/domain/tenant-plan-change.ts:130`。
6. 当前 entitlement usage 服务读取 active quota，并返回客户数、员工席位、知识库文件、AI 调用本月用量，见 `src/modules/institution/server/entitlement-usage-service.ts:10`。
7. 当前 institution entitlement usage DTO 中 `ai_calls` 的 label 是 `AI 调用（本月）`，见 `src/modules/institution/domain/entitlement-usage-view.ts:101`。

### 2.6 当前平台端 AI 模型管理页面 / API

1. 平台端 AI 模型配置面板是 `OpenPlatformAiModelConfigPanel`，见 `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx:80`。
2. 该面板展示 provider、model、capability、scenario default、agent inheritance、Key 低敏状态、dry-run / sync / test 状态。
3. 模型配置 mock catalog 中有 provider、modelId、displayName、pricingLabel、contextWindowLabel、capabilityIds、enabled、testStatus，见 `src/modules/open-platform/mock/platformAiModelConfig.ts:4`。
4. 持久化逻辑允许保存 scenario 默认模型、模型启用状态、provider 状态、dry-run 结果，不解密 Key、不真实同步厂商模型、不真实测试模型，见 `src/modules/open-platform/server/platformAiModelConfigPersistence.ts:395`。
5. 当前平台模型配置侧还没有模型折算系数、inputWeight、outputWeight、modelMultiplier、成本单价、计费版本等结构。

### 2.7 当前平台端 AI 用量与费用页面 / API

1. 平台端 AI 用量与费用只读面板是 `OpenPlatformAiReadonlyPanel`，见 `src/modules/open-platform/components/OpenPlatformAiReadonlyPanel.tsx:68`。
2. 该面板当前说明“未接入真实 AI 调用日志；页面仅保留用量与费用信息架构”，见 `src/modules/open-platform/components/OpenPlatformAiReadonlyPanel.tsx:233`。
3. `GET /api/v1/open-platform/ai-readonly` 返回模型 registry + usage cost 空态，见 `src/app/api/v1/open-platform/ai-readonly/route.ts:3`。
4. usage cost contract 当前返回 `dataSource: 'unconnected'`、`usageStatus: 'not_connected'`、summary 归零、明细为空，见 `src/modules/open-platform/server/platformAiUsageCostContract.ts:126`。
5. future log field spec 已规划 provider、modelId、scenario、status、latencyMs、inputTokens、outputTokens、totalTokens、estimatedCostCny、pricingVersion、billable、createdAt 等字段，见 `src/modules/open-platform/mock/platformAiUsageCost.ts:556`。
6. 另有 `GET /api/v1/open-platform/ai-usage` 从真实 `ai_call_usage_records` 聚合 tenant 级调用数、token 总量和成功 / 失败 / 拒绝 / 超限统计，见 `src/app/api/v1/open-platform/ai-usage/route.ts:10` 和 `src/modules/institution/server/institution-ai-call-usage-repository.ts:129`。
7. 当前平台 usage summary 聚合只到 tenant 维度，没有按 provider / model / scenario / day / institution / cost / credits 的完整聚合。

### 2.8 当前机构端 AI 用量展示

1. 机构端 AI 调用入口在知识库页面中，提交给 `/api/institution/knowledge-management/ai-call`，见 `src/modules/institution/components/InstitutionKnowledgeReadonlyShell.tsx:580`。
2. 机构端展示“平台 AI 服务”，不允许机构选择模型或厂商；route 会拒绝 `vendor`、`provider`、`model`、`modelId`、`providerId` 等字段，见 `src/app/api/institution/knowledge-management/ai-call/route.ts:22`。
3. 机构端 AI models route 固定返回 403，错误说明机构端不能查看或配置 AI 模型，见 `src/app/api/v1/institution/ai-models/route.ts:11`。
4. 机构端用量 DTO 明确剔除 `provider`、`model`、`promptTokens`、`completionTokens`、`totalTokens`，并补充 `serviceName: '平台 AI 服务'`，见 `src/modules/institution/server/institution-ai-call-service.ts:50` 和 `src/modules/institution/server/institution-ai-call-service.ts:264`。
5. 机构端页面展示本月 AI 调用额度：已用、上限、剩余，见 `src/modules/institution/components/InstitutionKnowledgeReadonlyShell.tsx:1231`。
6. 机构端 AI 调用记录展示服务名、时间、状态、是否计入成功调用额度、耗时、错误码、是否使用知识库、RAG 引用片段，见 `src/modules/institution/components/InstitutionKnowledgeReadonlyShell.tsx:1283`。
7. 机构端页面当前没有展示 Token、模型、厂商、成本；这是 V0.5 已收口的边界。

### 2.9 当前 usage metadata / RAG context 保存方式

1. `AiCallUsageMetadata` 当前只允许 `knowledgeContext.used` 和 `knowledgeContext.sources`，见 `src/modules/institution/server/institution-ai-call-service.ts:17`。
2. metadata 只保存白名单字段：`knowledgeId`、`knowledgeTitle`、`fileId`、`fileName`、`chunkId`、`chunkIndex`、`textPreview`、`matchReason`，见 `src/modules/institution/server/institution-ai-call-service.ts:80`。
3. metadata 不保存原始 question、prompt、派生检索关键词、provider raw response、storageKey、bucket、signedUrl、embedding、API key、baseUrl、Authorization 等，见 `src/modules/institution/server/institution-ai-call-service.ts:9`。
4. 成功调用才写入 RAG metadata；rejected / failed / sensitive_input_rejected 不写入 RAG metadata，见 `src/modules/institution/server/institution-ai-call-service.ts:532`。
5. 返回给机构端的 `knowledgeContext` 可能含本次 question 作为运行时 UI 上下文，但持久化 metadata 不保存 question，见 `src/modules/institution/server/institution-ai-call-service.ts:552`。

### 2.10 当前测试覆盖范围

1. `InstitutionAiCallService.test.ts` 覆盖成功调用写 usage、机构 DTO 不返回 provider / model / token 字段、provider 失败安全提示、跨机构隔离、敏感输入拒绝不调用 provider、RAG prompt 注入约束、RAG metadata 白名单和不写 question / searchKeyword 等，见 `src/modules/institution/tests/InstitutionAiCallService.test.ts:29`。
2. `InstitutionAiCallApiRoute.test.ts` 覆盖机构 AI call API route 行为，包括 quota、禁止机构端模型选择、错误码等。
3. `InstitutionAiModelsRoute.test.ts` 覆盖机构端 AI models route 禁止查看 / 配置模型。
4. `TenantQuotaEnforcement.test.ts` 覆盖 quota enforcement domain / repository / service。
5. `EntitlementUsageView.test.ts` 与 `InstitutionEntitlementUsageApiRoute.test.ts` 覆盖 entitlement usage 视图与 API。
6. `OpenPlatformAiModelConfigPanel.test.tsx`、`OpenPlatformAiModelConfigContract.test.ts`、`OpenPlatformAiModelConfigPersistence.test.ts` 覆盖平台模型配置面板、contract、持久化边界。
7. `OpenPlatformAiUsageCostContract.test.ts`、`OpenPlatformAiReadonlyContract.test.ts`、`OpenPlatformAiReadonlyPanel.test.tsx` 覆盖平台 AI 用量 / 费用的未接入空态和只读 contract。
8. 当前测试尚未覆盖 AI credits 折算、模型倍率版本、成本计算、积分 ledger、机构端 credits 展示等，因为这些能力尚未实现。

## 3. 现有 AI calls quota 与未来 AI credits 的关系

1. `ai_calls` 是调用次数额度，只回答“本月成功 AI 调用发生了多少次”。
2. `ai_credits` 是统一 AI 使用额度，只回答“本月成功 AI 调用按平台折算后消耗了多少 AI 积分”。
3. V0.5 的 `ai_calls` 不应被直接重命名为 `ai_credits`，否则会破坏当前套餐、quota、机构端提示和历史记录语义。
4. V0.6 应新增 `ai_credits`，并允许一个过渡期同时存在：
   - `ai_calls`：继续作为成功调用次数 guard。
   - `ai_credits`：新增为未来成本 / token / RAG 统一折算 guard。
5. 过渡期建议先只读展示 credits，再启用软提醒，再启用 hard limit，避免一次性切换影响线上机构。
6. 当 `ai_credits` 进入 enforcement 后，建议 quota 判断顺序为：
   - 先做安全 / 权限 / active plan 检查。
   - 再做 `ai_calls` 次数 guard。
   - 预估 credits 是否可能超额，必要时阻断。
   - 成功调用后按真实 usage 记账并更新 credits ledger。
7. 对于失败、拒绝、敏感输入、quota 超限、provider 不可用记录，不进入成功消耗；平台端可以审计这些记录，但机构端只看到“未计入额度”或低敏状态。

## 4. AI 积分单位定义

1. 建议定义：`1 AI 积分 = 平台内部 1000 标准 Token`。
2. 标准 Token 是平台内部折算单位，不直接等于 provider raw token。
3. provider raw token 是底层厂商返回或平台估算的输入 / 输出 token 数，只能用于平台内部审计、成本核算和折算。
4. 标准 Token 需要通过 input / output 权重、模型倍率、RAG 附加成本、场景策略等折算而来。
5. 机构端不展示“标准 Token”与“raw token”，只展示 AI 积分。
6. 平台端可以展示 raw token、标准 Token、AI 积分、成本、折算版本和模型倍率。

## 5. 折算公式建议

### 5.1 基础公式

建议每次成功 AI 调用按以下顺序计算：

```text
weightedInput = inputTokens * inputWeight
weightedOutput = outputTokens * outputWeight
weightedRaw = weightedInput + weightedOutput
modelAdjusted = weightedRaw * modelMultiplier
ragAdjusted = modelAdjusted + ragAdditionalStandardTokens
standardTokens = ceil(ragAdjusted)
aiCredits = ceil(standardTokens / 1000)
```

### 5.2 推荐默认值

1. `inputWeight` 默认 `1.0`。
2. `outputWeight` 默认 `3.0`，因为输出通常成本和价值更高。
3. `modelMultiplier` 默认 `1.0`，高阶模型可配置为 `1.5`、`2.0`、`3.0` 等。
4. `ragAdditionalStandardTokens` 默认按 RAG 召回附加成本计算：
   - 未使用 RAG：`0`。
   - 使用 keyword-only RAG：`ragSourceCount * 50`。
   - 使用 vector / hybrid RAG：`embeddingTokens * embeddingMultiplier + ragSourceCount * 50`。
5. 最终 AI 积分向上取整，最低成功消耗建议为 `1` AI 积分，以避免超短请求在机构端显示为 0。

### 5.3 计入与不计入口径

1. `status = 'succeeded'` 且 provider 返回安全回答：计入 AI credits。
2. provider 未返回 usage 但成功：使用平台估算 tokens 计入，并标记 `tokenSource = estimated`。
3. `sensitive_input_rejected`：不计入 AI credits。
4. `rejected` 且 `errorCode = quota_exceeded_ai_calls`：不计入 AI credits。
5. provider 非 200、rate limit、timeout、network error、unsafe response：默认不计入客户 credits，但平台端保留内部失败成本审计字段；如未来 provider 已产生可量化成本，可在平台端独立记 `internalCostOnly`，不得展示给机构端。
6. RAG 检索失败且未调用 provider：不计入 AI credits。
7. RAG 检索成功但 provider 调用失败：默认不计入客户 credits，可平台内部审计检索成本。

## 6. 机构端展示口径

1. 机构端只展示：
   - AI 积分 / AI 使用额度。
   - 已用。
   - 剩余。
   - 本次是否计入额度。
   - 状态：成功、拒绝、失败、额度不足、敏感输入已拒绝等低敏状态。
   - 是否使用知识库参考。
2. 机构端不展示：
   - Token / tokens / raw token / standard token。
   - 模型 / model / modelId。
   - 厂商 / provider / vendor。
   - 成本 / cost / estimatedCost / 单价。
   - 折算系数 / multiplier / weight。
3. 机构端文案建议：
   - 额度卡片：`本月 AI 使用额度`、`已用 X 积分`、`剩余 Y 积分`、`额度上限 Z 积分`。
   - 单次记录：成功时展示 `已计入本月 AI 使用额度：N 积分`。
   - 失败 / 拒绝时展示 `已记录，未计入成功消耗`。
   - 历史旧记录展示 `旧记录未记录 AI 积分，仅保留调用状态`。
4. 机构端不需要知道某次调用为什么消耗 N 积分的模型细节；如需解释，可使用低敏文案：`消耗由平台按调用规模和服务类型统一折算`。
5. 机构端 API response 应继续沿用 DTO 白名单，新增字段只允许是：
   - `aiCreditsConsumed: number | null`
   - `quotaIncluded: boolean`
   - `meteringLabel: string`
   - `legacyMetering: boolean`
6. 机构端不得返回 provider、model、token、成本、倍率、价格版本。

## 7. 平台端管理口径

1. 平台端需要可管理 provider：provider key、baseUrl、启用状态、健康状态、低敏 last check。
2. 平台端需要可管理 model：modelId、displayName、capability、enabled、scenario default、provider 归属。
3. 平台端需要可管理 raw token：inputTokens、outputTokens、totalTokens、tokenSource、provider usage raw JSON 的低敏摘要。
4. 平台端需要可管理模型折算系数：inputWeight、outputWeight、modelMultiplier、minimumCredits、roundingMode、effectiveFrom、effectiveTo、pricingVersion。
5. 平台端需要可管理成本：input unit cost、output unit cost、embedding cost、currency、estimatedCost、internalCostOnly。
6. 平台端需要可管理套餐权益与机构额度：monthlyAiCreditLimit、trialAiCreditLimit、carryOverPolicy、overagePolicy。
7. 平台端需要可审计每次 AI 调用内部消耗：raw tokens、standardTokens、aiCredits、provider、model、scenario、RAG、status、billable、meteringVersion、calculatedAt。
8. 平台端 UI 建议在现有“AI模型”和“AI用量与费用”基础上新增：
   - `AI 计量规则`：维护折算系数、模型倍率和成本单价。
   - `AI 积分账本`：查看租户 / 机构 / 调用记录的 credits ledger。
   - `套餐 AI 积分权益`：在套餐版本中维护 monthlyAiCreditLimit。
   - `模型成本对账`：按 provider / model / day / scenario 聚合 raw token、credits、成本。
9. 平台端 API 应明确区分只读聚合 API、管理配置 API、账本审计 API，避免把管理字段泄漏到机构端。

## 8. 建议数据结构（只写设计，不建表）

### 8.1 AI 调用内部计量快照

建议未来扩展或新建内部计量表记录单次调用折算结果：

```ts
type AiCallMeteringSnapshot = {
  id: string;
  aiCallUsageRecordId: string;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string;
  scenario: string | null;
  provider: string;
  model: string;
  status: 'succeeded' | 'failed' | 'rejected' | 'sensitive_input_rejected' | 'provider_unavailable' | 'rate_limited';
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  tokenSource: 'provider_usage' | 'estimated' | 'none';
  inputWeight: number;
  outputWeight: number;
  modelMultiplier: number;
  ragAdditionalStandardTokens: number;
  standardTokens: number | null;
  aiCreditsConsumed: number | null;
  billable: boolean;
  customerVisible: boolean;
  meteringVersion: string;
  legacyMetering: boolean;
  calculatedAt: string;
};
```

设计说明：

1. `customerVisible` 只代表可向机构端展示消耗结果，不代表可展示内部 token / 模型 / 成本字段。
2. `billable` 表示是否进入额度消耗；失败 / 拒绝默认 false。
3. `legacyMetering` 用于历史记录兼容。
4. `tokenSource` 区分 provider usage 与平台估算。

### 8.2 模型计量规则

```ts
type AiModelMeteringProfile = {
  id: string;
  provider: string;
  model: string;
  capability: 'text' | 'reasoning' | 'vision' | 'embedding';
  inputWeight: number;
  outputWeight: number;
  modelMultiplier: number;
  minimumCredits: number;
  roundingMode: 'ceil';
  effectiveFrom: string;
  effectiveTo: string | null;
  pricingVersion: string;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string;
};
```

设计说明：

1. 规则要有生效时间，避免历史记录因规则变更而重算结果漂移。
2. `pricingVersion` 应进入每次 usage snapshot。
3. 规则变更必须写平台审计。

### 8.3 成本规则

```ts
type AiModelCostProfile = {
  id: string;
  provider: string;
  model: string;
  inputCostPerMillionRawTokens: number;
  outputCostPerMillionRawTokens: number;
  embeddingCostPerMillionRawTokens: number | null;
  currency: 'CNY' | 'USD';
  costVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};
```

设计说明：

1. 成本只在平台端展示，不进入机构端 API。
2. 成本与 credits 可以相关但不等价：credits 是客户可见额度，cost 是平台内部运营成本。

### 8.4 租户 AI 积分权益

```ts
type TenantAiCreditEntitlement = {
  tenantId: string;
  planAssignmentId: string;
  planVersionId: string;
  monthlyAiCreditLimit: number | null;
  currentCycleStart: string;
  currentCycleEnd: string;
  overagePolicy: 'block' | 'warn_only' | 'manual_approve';
  source: 'plan_version' | 'manual_override' | 'migration';
};
```

设计说明：

1. 短期可先把 `monthlyAiCreditLimit` 放入套餐版本 / authorization snapshot 的 quota JSON。
2. 长期可独立成表，支持手工调整、冻结、赠送、补偿、过期等 ledger 场景。

### 8.5 AI 积分账本

```ts
type AiCreditLedgerEntry = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  aiCallUsageRecordId: string | null;
  entryType: 'consume' | 'grant' | 'adjust' | 'refund' | 'expire';
  creditsDelta: number;
  balanceAfter: number | null;
  reasonCode: string;
  visibleToInstitution: boolean;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};
```

设计说明：

1. 成功调用消耗写 `consume`。
2. 失败后如未来发生补偿写 `refund`。
3. 套餐权益发放写 `grant`。
4. 平台手工修正写 `adjust`，必须有审计原因。
5. 机构端只读取 `visibleToInstitution = true` 且低敏字段。

## 9. 建议 API 设计（不实现）

### 9.1 平台端 API

1. `GET /api/v1/open-platform/ai-metering/profiles`
   - 查询模型折算规则。
   - 仅平台角色可读。
2. `PUT /api/v1/open-platform/ai-metering/profiles/:profileId`
   - 更新 inputWeight、outputWeight、modelMultiplier、minimumCredits、effectiveFrom。
   - 必须写审计。
3. `GET /api/v1/open-platform/ai-metering/usage`
   - 按 month / tenant / institution / provider / model / scenario 聚合 raw tokens、standard tokens、AI credits、cost。
4. `GET /api/v1/open-platform/ai-metering/calls/:recordId`
   - 查看单次调用内部计量快照。
   - 可展示 provider、model、raw tokens、cost、credits、RAG 附加成本。
5. `GET /api/v1/open-platform/tenants/:tenantId/ai-credit-entitlement`
   - 查询租户 AI 积分权益、余额、周期和 override。
6. `PUT /api/v1/open-platform/tenants/:tenantId/ai-credit-entitlement`
   - 调整额度 / overage policy。
   - 必须写商业 / 审计记录。

### 9.2 机构端 API

1. `GET /api/institution/ai-credits/usage`
   - 返回本月 AI 积分额度、已用、剩余、状态。
   - 不返回 token、provider、model、cost、multiplier。
2. `GET /api/institution/ai-credits/ledger`
   - 返回低敏账本：时间、服务名、消耗积分、是否计入额度、状态、知识库引用摘要。
   - 不返回内部计量规则。
3. `POST /api/institution/knowledge-management/ai-call`
   - 仍由平台选择 provider / model。
   - 响应中可新增低敏字段：`aiCreditsConsumed`、`quotaIncluded`、`legacyMetering`。
4. `GET /api/institution/entitlement-usage`
   - 过渡期可同时返回 `ai_calls` 与 `ai_credits` 两个 item。
   - 机构端 UI 逐步从 `AI 调用（本月）` 切换到 `AI 使用额度（本月）`。

## 10. 建议平台端 UI 入口

1. 在现有 `AI模型` 中增加 `计量规则` 子区：
   - provider / model。
   - inputWeight。
   - outputWeight。
   - modelMultiplier。
   - minimumCredits。
   - pricingVersion。
   - 生效时间。
2. 在现有 `AI用量与费用` 中增加 `AI 积分` 维度：
   - 总 raw tokens。
   - 总标准 Token。
   - 总 AI credits。
   - 总成本。
   - provider / model / scenario / tenant 聚合。
   - 失败 / 拒绝 / 不计入额度统计。
3. 在 `套餐目录` 中把当前 `AI 调用 / 月` 保留为 legacy quota，同时新增 `AI 积分 / 月`。
4. 在 `租户详情 / 套餐绑定 / 套餐变更` 中展示 AI 积分权益和变更 diff。
5. 在平台审计中记录：计量规则变更、租户积分调整、套餐积分权益变更、异常退款 / 修正。

## 11. 建议机构端 UI 展示

1. 额度卡片：
   - 标题：`本月 AI 使用额度`。
   - 内容：`已用 X 积分 / 上限 Y 积分 / 剩余 Z 积分`。
   - 状态：正常、接近上限、已用尽、未配置、无有效套餐。
2. AI 调用结果提示：
   - 成功：`AI 回答已生成，已计入本月 AI 使用额度 N 积分，请人工确认后再用于服务沟通`。
   - 失败：`AI 调用失败，未计入成功消耗`。
   - 敏感输入拒绝：`输入内容包含敏感信息，未计入成功消耗`。
   - 超限：`本月 AI 使用额度已用尽，请联系平台管理员调整套餐`。
3. AI 调用记录：
   - 服务名：`平台 AI 服务`。
   - 状态。
   - 消耗：`已计入 N 积分` 或 `未计入成功消耗`。
   - 耗时。
   - 是否使用知识库。
   - 知识库引用低敏摘要。
4. 历史旧记录：
   - `旧记录未记录 AI 积分，仅保留调用状态`。
5. 机构端不提供模型、厂商、Token、成本、倍率、定价版本入口。

## 12. migration / backfill 风险

1. 历史 `ai_call_usage_records` 没有 meteringVersion、credits、cost，强制回填会引入不准确账单风险。
2. 历史 token 可能来自 provider raw usage，也可能来自 `estimateTokens`，没有 `tokenSource`，不能无差别当作真实 provider usage。
3. 历史失败记录可能只有 prompt 估算或 null，不应回填为客户消耗。
4. 模型倍率如果按当前规则回填历史记录，会造成“历史账单随规则变动”的审计风险。
5. 成本单价和 provider 价格历史可能缺失，不能把回填成本当正式账单。
6. RAG metadata 只有部分成功记录有；旧记录可能没有 `knowledgeContext`，不能准确回填 RAG 附加成本。
7. 建议策略：
   - 不强制回填历史 credits。
   - 给旧记录标记 `legacyMetering = true`。
   - 平台端可提供“按当前规则试算”的只读工具，但必须标记为 `estimated_replay`，不得进入机构端额度或正式账单。
   - 新 schema 生效后只对新调用生成不可变 metering snapshot。

## 13. 与 V0.5 AI calls quota 的兼容策略

1. V0.5 `ai_calls` 保留：继续按本月 `status = 'succeeded'` 记录数计算。
2. V0.6 `ai_credits` 新增：成功调用后按 metering snapshot 计入积分。
3. 过渡期 API：
   - `entitlement-usage` 同时返回 `ai_calls` 和 `ai_credits`。
   - 机构端默认优先展示 `ai_credits`，如果没有 credits entitlement，则 fallback 展示 `ai_calls`。
4. 过渡期 quota：
   - 第一阶段：只写 credits，不阻断。
   - 第二阶段：超 credits 只提示 / warn。
   - 第三阶段：credits hard limit 生效。
   - 第四阶段：按产品决策下线或弱化 `ai_calls`。
5. 套餐配置：
   - 现有 `monthlyAiCallLimit` 不删除。
   - 新增 `monthlyAiCreditLimit`。
   - 套餐变更 diff 同时展示 legacy calls 与 credits。
6. 历史记录：
   - `ai_calls` 可继续统计历史成功调用。
   - `ai_credits` 只统计有 metering snapshot 的新记录。

## 14. 明确禁止事项

1. 不向机构端暴露 Token。
2. 不向机构端暴露模型。
3. 不向机构端暴露厂商。
4. 不向机构端暴露成本。
5. 不直接把 raw token 当客户可见额度。
6. 不把失败调用计入成功消耗。
7. 不把拒绝调用计入成功消耗。
8. 不把 provider error 原文展示给机构端。
9. 不把 prompt / question / provider raw response 持久化到计量 metadata。
10. 不让机构端选择 provider / model。
11. 不绕过平台端套餐 / quota / 计量规则。
12. 不把估算费用当正式账单。
13. 不在本 docs-only PR 中实现 schema、migration、service、UI、配置或真实调用。

## 15. 后续开发 PR 切片建议

1. `schema-only`
   - 新增 metering profile、credit ledger、metering snapshot、tenant ai credit entitlement 相关 schema / migration。
   - 只建结构，不接业务逻辑。
   - 包含 rollback / backfill 策略说明。
2. `domain/service`
   - 实现 credits 折算纯函数。
   - 实现 metering snapshot 生成。
   - 实现 ledger 写入。
   - 实现 legacy / estimated token source 标记。
   - 覆盖单元测试。
3. `platform API/UI`
   - 平台端新增计量规则管理 API / UI。
   - 平台端 AI 用量与费用接入真实 credits 聚合。
   - 平台端租户积分权益管理。
   - 平台审计接入。
4. `institution API/UI`
   - 机构端 entitlement usage 新增 `ai_credits` item。
   - 机构端 AI 调用记录展示积分消耗和 legacy 状态。
   - 确保 DTO 不泄露 token / provider / model / cost。
5. `tests`
   - domain 折算公式测试。
   - provider usage / estimated token source 测试。
   - 成功 / 失败 / 拒绝 / 敏感输入不计入测试。
   - 平台端可见内部字段测试。
   - 机构端不可见内部字段测试。
   - quota 过渡兼容测试。
6. `stage verify`
   - 测试服部署。
   - 平台端只读核查 raw token / credits / cost 可见。
   - 机构端人工 UAT 核查不出现 token / model / provider / cost。
   - 不做真实 provider smoke，除非另行明确授权。

## 16. 验收口径

1. 文档覆盖当前事实盘点。
2. 文档明确 `ai_calls` 与 `ai_credits` 的关系。
3. 文档定义 AI 积分单位和标准 Token 概念。
4. 文档给出可执行折算公式。
5. 文档给出只写设计的数据结构和 API 设计。
6. 文档明确平台端与机构端边界。
7. 文档明确 migration / backfill 风险。
8. 文档明确与 V0.5 AI calls quota 兼容策略。
9. 文档明确禁止事项。
10. 文档给出后续 PR 切片。

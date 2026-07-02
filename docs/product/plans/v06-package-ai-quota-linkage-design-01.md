# V0.6-PACKAGE-AI-QUOTA-LINKAGE-DESIGN-01：套餐权益 / AI 服务额度联动设计

## 1. 设计背景

基线日期：2026-07-02（Asia/Shanghai）

当前 main / origin/main：`8fc38ddac1a809a7ffa38f67a3200d59f1e3e8d3`

平台端 AI 用量 V0.6 已完成，平台运营人员可以查看 AI 积分消耗、Token、调用次数、成功率、厂商、模型、租户、服务项目、计量状态和明细记录等低敏运营分析。

机构端 AI 服务使用 V0.6 也已完成，机构用户可以在 `/hospital` 内查看 `AI 服务使用` 视图。该视图只调用 `GET /api/institution/ai-service-usage`，不调用平台端 AI usage API，不复用平台端 DTO，不展示 provider、model、Token、内部折算规则、真实成本、prompt、answer、rawResponse、metadata 原文、meteringDetails 原文或客户敏感字段。

当前机构端 API 返回的 `quota.isLinked=false` 是正确状态，页面展示 `套餐额度暂未接入`。这说明机构端已经能查看 AI 服务使用概览，但还不能宣称套餐额度已经真实联动，也不能宣称剩余额度真实可用。

下一阶段应先设计“套餐权益 / AI 服务额度”的产品口径和技术边界，再决定是否进入 API contract、schema、UI 或扣减实现。不能直接在前端伪造剩余额度，也不能把平台端 AI Credits 或 Token 原样开放给机构端。

## 2. 核心原则

1. 机构端只回答四个问题：我能用什么、用了多少、还剩多少、是否快用完。
2. 平台端负责管理套餐、权益、AI 服务额度、计量规则、内部成本与折算。
3. 机构端不展示 provider、model、Token、AI Credits 内部折算规则、人民币成本、真实成本或模型单价。
4. 先设计，再开发；先只读对照，再考虑软提示；最后才评估真实扣减或阻断。
5. 套餐权益与 AI 服务额度必须由服务端可信数据决定，不能由前端自行计算或伪造。
6. 额度状态必须可解释：未接入、未配置、正常、接近上限、已超额、人工调整中等状态要有稳定文案。
7. 套餐权益、AI 服务额度和真实财务结算必须分开。AI 服务额度可以用于产品限制和运营提示，但不是人民币账单。
8. 所有额度联动都必须保留审计线索，尤其是管理员手动调整、套餐变更、额度重置、超额放行和硬阻断。

## 3. 套餐权益口径

套餐建议继续使用面向机构可理解的版本表达，例如：

1. 试用版：用于短期体验和销售演示，额度较低，重点限制周期、员工席位和基础 AI 服务额度。
2. 基础版：用于小型机构的日常客户运营，包含基础客户容量、知识库容量和 AI 服务额度。
3. 专业版：用于成长型机构，增加员工席位、知识库容量、连接器和更高 AI 服务额度。
4. 旗舰版 / 定制版：用于多门店或复杂运营场景，允许人工配置更高额度、连接器和培训支持。

套餐权益建议分为四类：

1. 硬额度：达到上限后需要明确限制创建或使用，例如客户数、员工席位、知识库文件数，以及未来可能启用的 AI 服务硬额度。
2. 软提示：达到阈值后只提示，不立即阻断，例如 AI 服务额度接近上限、知识库容量接近上限。
3. 人工配置：需要平台管理员调整或销售确认的能力，例如额外 AI 服务包、培训支持、定制连接器、临时超额。
4. 只读说明：用于机构端解释当前套餐包含哪些能力，不参与实时限制，例如培训支持说明、服务等级说明。

现有代码中已存在 `monthlyAiCallLimit`、`knowledgeStorageGb`、`agentLimit`、`seatLimit`、`serviceEntitlementsJson`、`featureEntitlementsJson` 和 `quotaEntitlementsJson` 等套餐版本字段。后续设计可以复用这些方向，但不应在本轮要求 schema 或 migration。

AI 服务额度建议使用“AI 服务额度”作为机构端产品词，不使用 Token。原因：

1. Token 是模型内部计量单位，机构用户不容易理解。
2. 不同模型、服务项目和未来 provider 的 Token 口径不同，直接展示会制造误解。
3. AI 服务额度可以由平台端折算和治理，机构端只看统一产品额度。
4. 机构端可把它理解为“套餐中包含的 AI 服务使用量”，而不是模型成本或财务费用。

套餐权益分类建议：

1. 员工席位：硬额度，按有效机构成员或可登录账号计算。
2. 客户容量：硬额度或软额度，取决于当前商业策略。
3. 知识库容量：硬额度或软提示，建议先按文件数 / 存储量只读展示。
4. AI 服务额度：先只读对照，后续可升级为软提示，再评估硬扣减。
5. 连接器：人工配置或套餐权益开关，避免自动承诺真实 HIS 已接通。
6. 培训支持：只读说明或人工服务项，不参与系统扣减。

## 4. AI 服务额度口径

建议机构端额度字段使用低敏产品语义：

1. `quota.isLinked`：是否已与套餐权益联动。当前为 `false`；后续联动后可为 `true`。
2. `quota.cycle`：额度周期，例如 `monthly`。
3. `quota.periodStart` / `quota.periodEnd`：本次额度周期起止日期。
4. `quota.limit`：本周期 AI 服务额度总量，机构端可见。
5. `quota.used`：本周期已用 AI 服务额度，机构端可见。
6. `quota.remaining`：本周期剩余 AI 服务额度，只有在 `isLinked=true` 且数据可信时展示。
7. `quota.usageRate`：使用率，只有在 limit 可用时展示。
8. `quota.status`：`not_linked` / `not_configured` / `normal` / `near_limit` / `exceeded` / `temporarily_extended`。
9. `quota.resetAt`：下一次额度周期重置时间，可选。
10. `quota.note`：低敏说明，例如“套餐额度暂未接入”或“当前为只读统计，不执行扣减”。

服务项目维度建议继续复用已建立的 service project 归因口径：

1. `ai_qa`：AI 问答。
2. `knowledge_base_qa`：知识库问答。
3. `knowledge_base_parse`：知识库文件解析，需后续写入口径补齐后再展示。
4. `auto_followup`：智能随访相关服务，必须有明确 usage record 后才展示。
5. `ai_operation_assist`：AI 运营辅助，需后续写入口径补齐。
6. `unknown`：历史或无法归因数据。
7. `未归因服务`：serviceName 缺失或空值时的机构端低敏展示名。

`unknown` 与 `未归因服务` 的处理原则：

1. 不能隐藏，否则机构端看到总量与项目明细会对不上。
2. 要用低敏文案说明“部分历史记录暂未标记服务项目”。
3. 不应把 unknown 自动归为智能随访、AI 问答或知识库问答。
4. 不应因为 unknown 存在就阻塞只读额度展示。

是否允许超额需要单独产品决策。本设计建议：

1. 第一阶段不阻断，只做只读对照。
2. 第二阶段允许软超额，但给机构管理员和平台运营提示。
3. 第三阶段如要硬阻断，必须有合同、套餐、审计、客服兜底和人工放行机制。
4. 不建议立即硬扣减或阻断 AI 服务，因为这会影响机构业务体验，也需要更完整的失败文案和售后流程。

## 5. 平台端能力设计

平台端应承担套餐权益与 AI 服务额度的配置、治理和审计职责。

建议平台端能力包括：

1. 套餐配置：维护试用版、基础版、专业版、旗舰版等套餐版本，包含展示名、价格说明、员工席位、知识库容量、AI 服务额度和服务权益。
2. 套餐版本管理：草稿、发布、退役，避免直接修改已绑定租户的历史套餐口径。
3. 租户套餐绑定：为机构绑定当前套餐版本，记录生效时间、到期时间、变更原因和操作人。
4. AI 服务额度配置：在套餐版本或租户覆盖配置中定义月度 AI 服务额度。
5. 用量聚合与额度对照：基于已有 AI usage records 和机构端 AI service usage facade 计算已用额度。
6. 内部计量状态：平台端可以继续查看 AI Credits、Token、provider、model 和计量状态，用于运营治理。
7. 管理员手动调整：允许平台管理员在受控流程中添加临时额度、延长试用、人工放行或冻结。
8. 审计要求：任何额度配置、手动调整、套餐变更和超额处理都必须写入审计事件。

平台端可以展示内部字段，但必须限于平台管理员或运营人员。机构端不可见：

1. provider。
2. model。
3. Token / totalTokens。
4. AI Credits 内部折算规则。
5. provider 成本。
6. 人民币成本。
7. 模型单价。
8. 原始 prompt / answer / rawResponse。
9. metadata / meteringDetails 原文。
10. apiKey、baseUrl 或任何凭据。

## 6. 机构端能力设计

机构端只展示产品化后的 AI 服务额度，不展示内部计量细节。

建议从当前 `套餐额度暂未接入` 升级为以下层级：

1. 未接入：`quota.isLinked=false`，显示“套餐额度暂未接入，当前仅展示 AI 服务使用情况”。
2. 已接入但未配置：`quota.status=not_configured`，显示“当前套餐暂未配置 AI 服务额度，请联系平台管理员”。
3. 正常：展示本周期额度、已用、剩余、使用率和周期。
4. 接近上限：展示“AI 服务额度即将用完”，不阻断操作。
5. 已超额：展示“AI 服务额度已超出套餐范围，请联系平台管理员”，是否阻断由后续任务决定。
6. 临时扩容：展示“平台已临时调整 AI 服务额度”，并显示低敏到期说明。

机构端 AI 服务额度卡片建议包括：

1. 本周期 AI 服务额度。
2. 已用 AI 服务额度。
3. 剩余 AI 服务额度。
4. 使用率。
5. 额度周期。
6. 快用完提示。
7. 超额提示。
8. 套餐额度暂未接入提示。

机构端服务项目排行建议继续展示：

1. 服务项目。
2. 服务分类。
3. 使用次数。
4. AI 服务额度使用量。
5. 成功率。
6. 占比。

机构端不得展示：

1. provider / model。
2. Token / totalTokens。
3. AI Credits 内部折算规则。
4. RMB / `¥` / 真实成本。
5. prompt / answer / rawResponse。
6. metadata / meteringDetails 原文。
7. apiKey / baseUrl / credential。
8. 客户姓名、手机号、身份证、病历详情。
9. 治疗摘要原文、随访建议原文。

## 7. API / 数据设计建议

本轮仅做设计，不写代码，不新增 API，不要求 schema / migration。

后续如果进入 API contract，建议先定义低敏 DTO，而不是直接修改 UI：

```ts
type InstitutionAiServiceQuotaDto = {
  isLinked: boolean;
  cycle: 'monthly';
  periodStart: string | null;
  periodEnd: string | null;
  limit: number | null;
  used: number;
  remaining: number | null;
  usageRate: number | null;
  status:
    | 'not_linked'
    | 'not_configured'
    | 'normal'
    | 'near_limit'
    | 'exceeded'
    | 'temporarily_extended';
  resetAt: string | null;
  note: string;
};
```

`GET /api/institution/ai-service-usage` 可以从当前：

```ts
quota: {
  isLinked: false;
}
```

演进为：

```ts
quota: InstitutionAiServiceQuotaDto
```

演进原则：

1. `isLinked=false` 时，不返回剩余额度。
2. `isLinked=true` 但未配置 limit 时，返回 `status=not_configured`。
3. 只有 limit 与 used 均可信时，返回 remaining 和 usageRate。
4. 前端不得传 `tenantId` 覆盖登录态。
5. API 不能返回平台内部 provider、model、Token、成本或原始内容。

平台端后续可能需要套餐权益只读 API 或增强现有套餐 API：

1. 套餐列表 / 版本。
2. 套餐权益字段。
3. 租户当前套餐绑定。
4. 租户 AI 服务额度配置。
5. 租户 AI 服务额度使用情况。
6. 手动调整记录。
7. 审计事件。

但这些都应拆成独立任务，不在本设计 PR 中落地。

数据来源建议：

1. 套餐配置：现有套餐版本和权益 JSON 可作为起点。
2. 租户绑定：现有租户套餐绑定和配额快照可作为起点。
3. 已用额度：现有 AI usage records 的 `aiCreditsConsumed` 可作为服务端折算来源，但机构端不展示 AI Credits 名称。
4. 服务项目：现有 service project 归因用于服务项目排行。
5. 审计：后续手动调整和套餐变更必须进入平台审计。

## 8. 扣减策略建议

不建议立即做真实扣减。

建议分三阶段推进：

### 第一阶段：只读对照

目标：

1. 平台端能看到套餐额度配置和实际 AI 服务使用之间的对照。
2. 机构端能看到本周期额度、已用、剩余和使用率。
3. 不阻断 AI 服务调用。
4. 不影响既有 AI call service、usage 写入链路或 quota enforcement。

适合下一步任务类型：API contract / docs-only，随后拆 server / UI。

### 第二阶段：软额度提示

目标：

1. 达到 80% 或产品设定阈值时提示“即将用完”。
2. 超额后提示“已超过套餐范围，请联系平台管理员”。
3. 不立即阻断真实业务。
4. 平台端可看到超额租户和服务项目构成。

适合任务类型：API + UI + 测试，仍不做硬扣减。

### 第三阶段：硬扣减 / 阻断评估

只有在以下条件满足后才考虑：

1. 套餐合同和服务条款确认。
2. 超额处理和人工放行流程确认。
3. 审计与客服兜底确认。
4. 机构端错误文案和续费路径确认。
5. provider 调用、成本、失败重试、敏感输入拒绝等边界确认。

即便进入第三阶段，也必须单独授权，不得在额度展示或告警任务中顺手实现。

## 9. 风险与不可宣称

当前不可宣称：

1. 套餐扣减已完成。
2. 剩余额度真实可用。
3. 额度告警已完成。
4. 真实账单已完成。
5. 人民币成本核算已完成。
6. provider 成本已验收。
7. provider 真实调用已验收。
8. AI 服务额度可以作为财务结算依据。
9. 机构端可以查看 Token、provider、model、成本或内部计量规则。
10. 智能随访写入口径已完全补齐。
11. 自动随访统计已完成。
12. 生产可直接上线。

主要风险：

1. 机构端看到“额度”后会自然理解为真实可用剩余额度，因此必须避免在未联动前展示剩余值。
2. 当前 `ai_calls` 和 AI 服务额度口径可能不完全等价，需要先定义使用次数、额度单位和成功 / 失败 / 拒绝是否计入。
3. AI Credits 是平台内部计量，机构端“AI 服务额度”是产品口径，二者需要服务端映射，不能混用文案。
4. 智能随访、知识库解析、运营辅助等 service project 写入口径仍需逐项确认。
5. 套餐权益如果直接进入硬阻断，可能造成机构业务中断，需要人工放行和审计。
6. 超额提示、续费、销售跟进和客服流程尚未设计。
7. 导出和告警会放大数据解释风险，必须后置。

## 10. 推荐下一刀

建议下一刀优先做：

`V0.6-PACKAGE-AI-QUOTA-LINKAGE-CONTRACT-01：套餐权益 / AI 服务额度字段与接口 contract`

推荐任务类型：docs-only 或 API contract-only。

推荐原因：

1. 当前机构端已经展示 `套餐额度暂未接入`，下一步需要先稳定 DTO 和字段含义。
2. 直接做扣减风险太高，容易把只读运营统计误升级为真实计费系统。
3. Contract 先行可以明确 `quota.isLinked`、`limit`、`used`、`remaining`、`usageRate`、`status`、`cycle` 等字段。
4. Contract 可以同时约束平台端和机构端：平台端管理真实配置，机构端只展示低敏产品口径。
5. 后续再拆 server、UI、验收和审计任务，会比一次性做扣减更安全。

下一刀建议明确不包含：

1. 不做真实扣减。
2. 不做额度告警。
3. 不做导出。
4. 不做人民币账单。
5. 不做 provider 成本核算。
6. 不补智能随访写入口径。
7. 不执行 migration，除非后续 schema-only 任务单独授权。
8. 不修改 AI call service 或 quota enforcement。

不建议直接做：

1. 套餐扣减真实执行。
2. 额度告警。
3. 导出能力。
4. 生产上线。
5. 真实 provider 大规模调用。
6. 智能随访自动化扩展。
7. 多方向并行开发。

## 11. 本文不包含

本文仅做套餐权益 / AI 服务额度联动设计，不包含：

1. 不改代码。
2. 不改测试。
3. 不改 DB/schema/migration。
4. 不新增 API route。
5. 不改 UI。
6. 不启动 Claude Code。
7. 不执行 migration。
8. 不执行 db:seed。
9. 不写数据库。
10. 不调用 provider。
11. 不真实 AI smoke。
12. 不部署测试服或生产。
13. 不开始真实扣减。
14. 不开始额度告警。
15. 不开始导出。
16. 不补智能随访写入口径。

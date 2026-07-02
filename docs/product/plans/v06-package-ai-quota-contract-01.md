# V0.6-PACKAGE-AI-QUOTA-CONTRACT-01：套餐权益 / AI 服务额度字段与接口 Contract 设计

## 1. Contract 目标

基线日期：2026-07-02（Asia/Shanghai）

当前 main / origin/main：`8698654e59e18fec39b60b1e1fa1e002f8741adc`

本 contract 只定义套餐权益 / AI 服务额度联动的字段、DTO、接口边界和演进路径，不实现代码、不新增 API route、不改 schema、不做真实扣减。

本 contract 解决以下问题：

1. 套餐权益如何表达：平台端需要稳定描述套餐、套餐版本、权益项、额度项、周期、租户绑定和审计字段。
2. AI 服务额度如何表达：机构端只看产品化的 AI 服务额度，不看 Token、provider、model、成本或内部折算规则。
3. 平台端如何管理：平台端负责套餐、权益、AI 服务额度、计量规则、内部成本与折算，以及后续人工调整和审计。
4. 机构端如何低敏展示：机构端只展示套餐名称、额度状态、周期、总额度、已用、剩余、使用率、服务项目排行和低敏提示。
5. 如何从 `quota.isLinked=false` 演进到 `quota.isLinked=true`：先保持只读联动，展示可信额度字段，不执行真实扣减，不做硬阻断。
6. 为什么本轮不做真实扣减：真实扣减涉及合同口径、超额策略、人工放行、审计、客服兜底、失败重试、provider 调用和生产运维，必须后置并单独授权。

当前机构端 `GET /api/institution/ai-service-usage` 已返回低敏结构，但 `quota` 仍为：

```ts
quota: {
  isLinked: false;
}
```

本 contract 的目标是为后续从“套餐额度暂未接入”演进到“套餐额度只读联动”提供稳定设计，而不是在本轮把接口改成真实联动。

## 2. 字段分层

字段需要分层，避免把平台内部计量字段误开放给机构端。

### 2.1 套餐字段

用于描述平台可售卖或可绑定的套餐版本。

建议字段：

1. `packageCode`
2. `packageName`
3. `packageStatus`
4. `packageVersion`
5. `displayName`
6. `displayPrice`
7. `priceNote`
8. `effectiveAt`
9. `retiredAt`
10. `entitlements`
11. `quotas`

现有代码中已存在 `planCode`、`planName`、`versionCode`、`displayName`、`displayPrice`、`priceNote`、`monthlyAiCallLimit`、`knowledgeStorageGb`、`serviceEntitlementsJson`、`featureEntitlementsJson` 和 `quotaEntitlementsJson` 等相近字段。后续实现可选择沿用 plan 命名，也可在 API DTO 层映射为 package 语义。

### 2.2 租户套餐绑定字段

用于描述某个租户当前使用哪个套餐版本。

建议字段：

1. `tenantId`
2. `institutionId`
3. `packageCode`
4. `packageVersion`
5. `tenantPackageStatus`
6. `effectiveAt`
7. `expiresAt`
8. `assignedBy`
9. `assignmentReason`
10. `source`

### 2.3 AI 服务额度字段

用于描述套餐中包含的 AI 服务额度。

建议字段：

1. `quotaType`
2. `quotaUnit`
3. `quotaLimit`
4. `quotaCycle`
5. `rolloverPolicy`
6. `overagePolicy`
7. `warningThreshold`
8. `hardLimitEnabled`
9. `manualAdjustmentAllowed`

机构端只展示产品化字段，例如“AI 服务额度”，不展示内部折算。

### 2.4 AI 服务额度周期字段

用于描述当前额度周期。

建议字段：

1. `periodStart`
2. `periodEnd`
3. `resetAt`
4. `cycle`
5. `timezone`
6. `calculationStatus`

### 2.5 AI 用量聚合字段

用于把 usage record 与额度对照。

建议字段：

1. `used`
2. `remaining`
3. `usageRate`
4. `usageCount`
5. `succeededCount`
6. `failedCount`
7. `rejectedCount`
8. `pendingCount`
9. `notBillableCount`

机构端可见低敏聚合字段；平台端可进一步查看内部 AI Credits、Token、provider、model 和计量状态。

### 2.6 服务项目归因字段

用于按业务服务项目展示额度消耗。

建议字段：

1. `serviceCategory`
2. `serviceName`
3. `usageCount`
4. `used`
5. `usageRate`
6. `successRate`
7. `sharePercent`

机构端不得展示 `serviceSource`、`serviceAction`、`serviceVersion`，除非后续产品明确需要并确认低敏。

### 2.7 平台内部计量字段

仅平台端可见，禁止给机构端。

字段包括：

1. `provider`
2. `providerDisplayName`
3. `model`
4. `modelDisplayName`
5. `inputTokens`
6. `outputTokens`
7. `totalTokens`
8. `aiCreditsConsumed`
9. `internalMeteringPolicy`
10. `meteringStatus`
11. `meteringDetails`
12. `providerCost`
13. `costCurrency`

### 2.8 机构端低敏展示字段

机构端只应看到：

1. `packageName`
2. `packageVersion`
3. `quota.isLinked`
4. `quota.status`
5. `quota.periodStart`
6. `quota.periodEnd`
7. `quota.totalAllowance`
8. `quota.used`
9. `quota.remaining`
10. `quota.usageRate`
11. `quota.warningLevel`
12. `quota.displayUnit`
13. `quota.notes`
14. `serviceProjects[].serviceName`
15. `serviceProjects[].serviceCategory`
16. `serviceProjects[].used`
17. `serviceProjects[].usageRate`

### 2.9 审计字段

后续任何套餐变更、额度调整、超额处理都需要审计。

建议字段：

1. `auditId`
2. `actorId`
3. `actorRole`
4. `action`
5. `targetType`
6. `targetId`
7. `beforeSnapshot`
8. `afterSnapshot`
9. `adjustmentReason`
10. `createdAt`

审计字段不得包含密码、token、cookie、数据库连接串、provider key、原始 prompt、answer 或客户隐私。

## 3. 平台端字段 contract

平台端可以看到套餐和内部治理字段，但需要区分“平台可见”和“机构不可见”。

### 3.1 Package DTO

建议平台端套餐 DTO：

```ts
type PlatformPackageDto = {
  packageCode: string;
  packageName: string;
  packageStatus: 'draft' | 'published' | 'retired';
  packageVersion: string;
  displayName: string;
  displayPrice: string;
  priceNote: string;
  entitlements: PlatformPackageEntitlementDto[];
  quotas: PlatformPackageQuotaDto[];
  createdAt: string;
  updatedAt: string;
};
```

### 3.2 Entitlement DTO

建议平台端权益 DTO：

```ts
type PlatformPackageEntitlementDto = {
  entitlementKey: string;
  entitlementName: string;
  entitlementType: 'seat' | 'capacity' | 'ai_service' | 'connector' | 'support' | 'feature';
  description: string;
  visibleToInstitution: boolean;
  institutionDisplayName: string | null;
};
```

### 3.3 Quota DTO

建议平台端额度 DTO：

```ts
type PlatformPackageQuotaDto = {
  entitlementKey: string;
  quotaType: 'ai_service_units' | 'customers' | 'staff_seats' | 'knowledge_files' | 'connectors';
  quotaUnit: 'unit' | 'count' | 'seat' | 'file' | 'gb';
  quotaLimit: number | null;
  quotaCycle: 'monthly' | 'yearly' | 'lifetime' | 'manual';
  warningThreshold: number | null;
  overagePolicy: 'readonly' | 'soft_warning' | 'manual_review' | 'hard_block';
  hardLimitEnabled: boolean;
};
```

### 3.4 Tenant Package Binding DTO

建议平台端租户套餐绑定 DTO：

```ts
type PlatformTenantPackageBindingDto = {
  tenantId: string;
  institutionId: string | null;
  packageCode: string;
  packageName: string;
  packageVersion: string;
  tenantPackageStatus: 'trialing' | 'active' | 'expired' | 'suspended' | 'cancelled';
  effectiveAt: string;
  expiresAt: string | null;
  assignedBy: string;
  assignmentReason: string;
};
```

### 3.5 Tenant AI Quota Compare DTO

建议平台端租户 AI 服务额度对照 DTO：

```ts
type PlatformTenantAiQuotaCompareDto = {
  tenantId: string;
  tenantName: string;
  packageCode: string | null;
  packageName: string | null;
  packageVersion: string | null;
  quota: {
    quotaType: 'ai_service_units';
    quotaUnit: 'unit';
    quotaLimit: number | null;
    quotaCycle: 'monthly';
    periodStart: string;
    periodEnd: string;
    used: number;
    remaining: number | null;
    usageRate: number | null;
    status: 'not_linked' | 'not_configured' | 'normal' | 'near_limit' | 'over_limit' | 'manual_adjusted';
  };
  internalMeteringPolicy: {
    source: 'ai_credits';
    version: string;
    visibleToInstitution: false;
  };
  serviceProjects: PlatformTenantAiQuotaServiceProjectDto[];
};
```

平台端可见但不得给机构端的字段：

1. `tenantId` 以外的内部租户治理字段。
2. `internalMeteringPolicy`。
3. `provider` / `model`。
4. Token 与 AI Credits 内部明细。
5. provider 成本、人民币成本、模型单价。
6. `meteringDetails` 原文。
7. 管理员调整前后完整内部快照。

## 4. 机构端字段 contract

机构端字段必须低敏、可解释、产品化。

建议机构端 `quota` DTO：

```ts
type InstitutionAiServiceQuotaDto = {
  isLinked: boolean;
  status:
    | 'not_linked'
    | 'not_configured'
    | 'normal'
    | 'near_limit'
    | 'over_limit'
    | 'manual_adjusted';
  periodStart: string | null;
  periodEnd: string | null;
  totalAllowance: number | null;
  used: number;
  remaining: number | null;
  usageRate: number | null;
  warningLevel: 'none' | 'info' | 'warning' | 'critical';
  displayUnit: 'AI 服务额度';
  notes: string[];
};
```

建议机构端 response 片段：

```ts
type InstitutionAiServiceUsageResponseVNext = {
  requestId: 'institution-ai-service-usage';
  readonly: true;
  package: {
    packageName: string | null;
    packageVersion: string | null;
  };
  period: {
    from: string;
    to: string;
    preset: 'today' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom';
  };
  summary: {
    totalUsageCount: number;
    succeededCount: number;
    failedCount: number;
    rejectedCount: number;
    successRate: number;
    aiServiceUnitsUsed: number;
  };
  quota: InstitutionAiServiceQuotaDto;
  trend: Array<{
    date: string;
    usageCount: number;
    aiServiceUnitsUsed: number;
  }>;
  serviceProjects: Array<{
    serviceCategory: string;
    serviceName: string;
    usageCount: number;
    used: number;
    usageRate: number | null;
    successRate: number;
    sharePercent: number;
  }>;
  notes: string[];
};
```

机构端不得展示：

1. provider。
2. model。
3. Token / totalTokens。
4. AI Credits 内部折算规则。
5. RMB / `¥` / 真实成本。
6. prompt / answer / rawResponse。
7. metadata / meteringDetails 原文。
8. apiKey / baseUrl / credential。
9. 客户姓名、手机号、身份证、病历详情。
10. 治疗摘要原文、随访建议原文。

机构端文案建议：

1. `not_linked`：套餐额度暂未接入，当前仅展示 AI 服务使用情况。
2. `not_configured`：当前套餐暂未配置 AI 服务额度，请联系平台管理员。
3. `normal`：AI 服务额度使用正常。
4. `near_limit`：AI 服务额度即将用完。
5. `over_limit`：AI 服务额度已超过套餐范围，请联系平台管理员。
6. `manual_adjusted`：平台已临时调整 AI 服务额度。

## 5. API contract 建议

本节只做接口 contract 建议，不实现 API route。

### 5.1 平台端套餐权益只读接口

建议 endpoint：

`GET /api/v1/open-platform/packages`

query 参数：

1. `status=draft|published|retired|all`
2. `includeRetired=true|false`

response DTO：

```ts
type PlatformPackagesResponse = {
  packages: PlatformPackageDto[];
};
```

空状态：

```json
{ "packages": [] }
```

错误状态：

1. 401：未登录。
2. 403：非平台管理员。
3. 503：套餐权益数据暂时不可用。

权限边界：

1. 仅平台管理员可访问。
2. 不返回支付 token、合同正文、真实银行卡、发票税号、密钥或 webhook secret。

### 5.2 平台端租户套餐绑定只读接口

建议 endpoint：

`GET /api/v1/open-platform/tenants/{tenantId}/package-binding`

query 参数：

1. `includeHistory=true|false`

response DTO：

```ts
type PlatformTenantPackageBindingResponse = {
  tenantId: string;
  current: PlatformTenantPackageBindingDto | null;
  history: PlatformTenantPackageBindingDto[];
};
```

空状态：

```json
{ "tenantId": "tenant_xxx", "current": null, "history": [] }
```

权限边界：

1. 仅平台管理员可访问。
2. `tenantId` 必须由服务端校验存在。
3. 不返回机构端登录凭据或业务敏感字段。

### 5.3 平台端租户 AI 服务额度对照接口

建议 endpoint：

`GET /api/v1/open-platform/tenants/{tenantId}/ai-service-quota`

query 参数：

1. `period=currentMonth|lastMonth|custom`
2. `from=YYYY-MM-DD`
3. `to=YYYY-MM-DD`

response DTO：

```ts
type PlatformTenantAiServiceQuotaResponse = PlatformTenantAiQuotaCompareDto;
```

空状态：

1. 无套餐：`quota.status=not_linked`。
2. 无额度配置：`quota.status=not_configured`。
3. 无用量：`used=0`，`serviceProjects=[]`。

错误状态：

1. 400：时间范围无效。
2. 401：未登录。
3. 403：非平台管理员。
4. 404：租户不存在。
5. 503：AI 服务额度数据暂时不可用。

低敏边界：

1. 平台端可展示内部计量摘要。
2. 不返回 apiKey、baseUrl、Authorization、Cookie、prompt、answer、rawResponse 或数据库连接信息。

### 5.4 机构端 AI 服务使用 API 的 quota 演进 contract

现有 endpoint 保持：

`GET /api/institution/ai-service-usage`

query 参数保持：

1. `preset=today|last7days|currentMonth|lastMonth`
2. `from=YYYY-MM-DD`
3. `to=YYYY-MM-DD`

不允许机构端前端传入 `tenantId` 覆盖登录态。

当前 quota：

```ts
quota: {
  isLinked: false;
}
```

下一阶段只读联动 quota：

```ts
quota: InstitutionAiServiceQuotaDto
```

空状态：

1. `summary.totalUsageCount=0`。
2. `serviceProjects=[]`。
3. `quota.used=0`。
4. `quota.remaining` 仅在 `isLinked=true` 且 `totalAllowance` 可信时返回数字。

错误状态：

1. 400：时间范围无效。
2. 401：未登录。
3. 403：无机构权限。
4. 503：AI 服务使用数据暂时不可用。

低敏边界：

1. 不返回 provider / model。
2. 不返回 Token / totalTokens。
3. 不返回 AI Credits 内部折算规则。
4. 不返回 RMB / `¥` / 真实成本。
5. 不返回 prompt / answer / rawResponse。
6. 不返回 metadata / meteringDetails 原文。
7. 不返回客户姓名、手机号、身份证、病历详情、治疗摘要原文、随访建议原文。

### 5.5 后续额度调整 / 审计接口边界

后续如果需要写接口，应单独设计并授权。

建议暂不在本阶段实现：

1. `POST /api/v1/open-platform/tenants/{tenantId}/ai-service-quota-adjustments`
2. `GET /api/v1/open-platform/tenants/{tenantId}/ai-service-quota-adjustments`

写接口必须满足：

1. 仅平台管理员可操作。
2. 必须填写 `adjustmentReason`。
3. 必须写审计。
4. 必须限制调整范围。
5. 必须禁止传入敏感凭据。
6. 必须明确不触发 provider 调用。

本阶段不建议实现任何写接口，也不实现真实扣减。

## 6. `GET /api/institution/ai-service-usage` 演进

### 6.1 当前状态

当前 API 表达：

1. `quota.isLinked=false`。
2. UI 展示 `套餐额度暂未接入`。
3. 不显示剩余额度。
4. 不暗示套餐已扣减。
5. 不展示 Token、provider、model、成本或内部折算。

这是当前阶段的正确状态。

### 6.2 下一阶段只读联动

下一阶段如果进入只读联动，API 可表达：

1. `quota.isLinked=true`。
2. 展示 `totalAllowance`。
3. 展示 `used`。
4. 展示 `remaining`。
5. 展示 `usageRate`。
6. 展示 `periodStart` / `periodEnd`。
7. 展示 `warningLevel`。
8. 展示低敏 notes。

仍然必须保持：

1. 不展示 Token。
2. 不展示 provider。
3. 不展示 model。
4. 不展示成本。
5. 不展示内部折算规则。
6. 不做真实扣减。
7. 不做硬阻断。
8. 不做额度告警。
9. 不做导出。

### 6.3 只读联动计算口径

建议只读联动阶段使用服务端可信聚合：

1. `used` 可由当前周期内机构 AI 服务使用聚合得到。
2. `totalAllowance` 来自租户当前套餐或平台手动配置。
3. `remaining = max(totalAllowance - used, 0)`。
4. `usageRate = used / totalAllowance`。
5. 当 `totalAllowance` 缺失时，返回 `status=not_configured`，不返回 remaining。
6. 当无活跃套餐时，返回 `status=not_linked` 或 `not_configured`，由产品口径最终确认。

## 7. 阶段拆分建议

建议拆分如下：

1. `V0.6-PACKAGE-AI-QUOTA-CONTRACT-01`：contract docs-only，本轮，仅沉淀字段、DTO、接口边界和阶段拆分。
2. `V0.6-PACKAGE-AI-QUOTA-CONTRACT-02`：server-domain contract-only，只新增 domain type、DTO builder、mock fixture 和测试，不新增真实 API route，不接真实扣减。
3. `V0.6-PACKAGE-AI-QUOTA-PLATFORM-READONLY-03`：平台端套餐权益 / 租户额度只读 API，复用现有套餐、租户绑定和 entitlement usage 数据，只读输出。
4. `V0.6-PACKAGE-AI-QUOTA-INSTITUTION-READONLY-04`：机构端 `quota.isLinked=true` 只读展示，升级 `GET /api/institution/ai-service-usage` 的 quota DTO。
5. `V0.6-PACKAGE-AI-QUOTA-STAGING-ACCEPTANCE-05`：本地 5010 与测试服验收，确认 linked / unlinked / empty / warning 等状态。
6. 后置：软提示、额度告警、硬扣减、导出。

后置能力必须单独授权，不得混入只读 contract 或只读 API 任务。

## 8. 测试建议

后续开发应覆盖：

1. 平台端套餐字段不泄露凭据、支付 token、合同正文、数据库连接串或 webhook secret。
2. 平台端额度对照接口不返回 prompt、answer、rawResponse、metadata 原文或 provider key。
3. 机构端不展示 provider、model、Token、totalTokens、AI Credits 内部折算、RMB、`¥`、真实成本。
4. `quota.isLinked=false` 时稳定展示“套餐额度暂未接入”，不返回剩余额度。
5. `quota.isLinked=true` 时稳定展示 totalAllowance、used、remaining、usageRate。
6. empty 状态：无使用记录时返回 0 和空数组。
7. expired 状态：套餐过期时不伪造剩余额度。
8. overLimit 状态：已超过额度时返回低敏提示，不自动宣称已阻断。
9. warning 状态：接近额度时返回低敏 warningLevel。
10. service project unknown / unassigned 状态：`unknown` 与 `未归因服务` 稳定展示。
11. tenant 越权防护：机构端前端传入 `tenantId` 不得覆盖登录态。
12. DTO 稳定性：新增字段保持向后兼容，旧前端不因 quota 扩展崩溃。
13. API error 低敏返回：不展示 SQL、DB、stack trace、连接串、cookie 或 token。

## 9. 风险与不可宣称

当前不可宣称：

1. 套餐扣减已完成。
2. 剩余额度真实可用。
3. 额度告警已完成。
4. 导出能力已完成。
5. 真实财务账单已完成。
6. 人民币成本核算已完成。
7. provider 成本已验收。
8. provider 真实调用已验收。
9. 生产可直接上线。
10. 机构端可查看 Token / provider / model / 成本。
11. AI 服务额度可以作为发票、合同或财务结算依据。
12. 套餐超额后已经会自动阻断。

主要风险：

1. `AI 服务额度` 与现有 `monthlyAiCallLimit` / `ai_calls` 的口径可能不同，需要 contract 先统一。
2. `aiCreditsConsumed` 是平台内部计量，机构端 `used` 是产品化额度，不能直接展示内部名称。
3. 额度一旦展示 remaining，机构用户会理解为真实可用额度，因此必须保证来源可信。
4. 如果过早做硬扣减，可能导致机构业务中断。
5. 如果过早做告警，可能产生错误通知、销售误导或客服压力。
6. 如果导出过早上线，会放大低敏字段解释风险。

## 10. 推荐下一刀

推荐下一刀：

`V0.6-PACKAGE-AI-QUOTA-CONTRACT-02：套餐权益 / AI 服务额度 server-domain contract-only`

下一刀建议只做：

1. domain type。
2. DTO builder。
3. mock fixture。
4. contract tests。
5. linked / unlinked / not_configured / near_limit / over_limit 状态计算。
6. 低敏字段白名单测试。

下一刀明确不包含：

1. 不新增真实 API route，除非单独授权。
2. 不改 DB/schema/migration。
3. 不做真实扣减。
4. 不做额度告警。
5. 不做导出。
6. 不部署测试服或生产。
7. 不调用 provider。
8. 不真实 AI smoke。
9. 不修改 AI call service、AI usage 写入链路或 quota enforcement。

## 11. 本文不包含

本文仅做字段与接口 contract 设计，不包含：

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
13. 不做真实额度扣减。
14. 不做额度告警。
15. 不做导出。
16. 不做接口开发。

## 12. CONTRACT-02 实现说明

`V0.6-PACKAGE-AI-QUOTA-CONTRACT-02` 仅落地 server-domain contract：

1. 新增套餐权益 / AI 服务额度 domain type、低敏 DTO、mock fixture、纯 helper 和 mapper。
2. 覆盖 `trial` / `basic` / `professional` 套餐示例。
3. 覆盖 `unlinked` / `active` / `warning` / `overLimit` / `expired` quota 状态。
4. 覆盖 AI 问答、知识库问答、智能随访和未归因服务的 service project quota attribution 示例。
5. 机构端 mapper 仅输出 `AI 服务额度` 低敏视图，`unlinked` 稳定映射为 `套餐额度暂未接入`。
6. 本阶段不新增真实 API route。
7. 本阶段不改 DB / schema / migration。
8. 本阶段不做真实额度扣减、额度告警或导出。
9. 本阶段不执行 migration、db:seed 或任何数据写入。
10. 后续 API route、机构端 UI 联动和测试服验收必须拆分为独立任务并单独授权。

## 13. READONLY-03 实现说明

`V0.6-PACKAGE-AI-QUOTA-PLATFORM-READONLY-03` 新增平台端 mock/fixture-based readonly API：

1. 新增 `GET /api/v1/open-platform/package-ai-quota`。
2. API 复用 CONTRACT-02 的套餐、租户绑定、quota 状态和 service project attribution fixtures。
3. API 返回 `packages`、`entitlements`、`tenantBindings`、`tenantQuotaSummaries`、`serviceProjectQuotaAttributions`、`quotaStatuses` 和 `notes`。
4. 当前未接真实 DB。
5. 当前未改 DB / schema / migration。
6. 当前未做真实额度扣减。
7. 当前未做额度告警。
8. 当前未做导出。
9. 当前未做 UI。
10. 后续机构端 `quota.isLinked=true` readonly、机构端 UI 联动和本地 / 测试服验收仍需拆分为独立任务并单独授权。

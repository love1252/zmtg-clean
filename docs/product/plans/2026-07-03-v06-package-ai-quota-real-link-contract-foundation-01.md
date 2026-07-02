# V0.6-PACKAGE-AI-QUOTA-REAL-LINK-CONTRACT-FOUNDATION-01：真实 quota linkage server-domain contract foundation

## 1. 本轮目标

本轮在不接 DB、不改 schema / migration、不新增 API route、不改 UI 的前提下，为后续“真实套餐权益 / AI 服务额度 linkage”补齐可测试的 server-domain contract foundation。

当前平台端与机构端仍是 mock / fixture-based readonly 阶段。本轮不是上线真实额度能力，而是把未来真实数据源到机构端低敏 quota readonly DTO 的 contract、mapper、fallback、fixtures 和测试先固定下来，避免后续接 DB 时直接把内部字段、供应商字段、Token 或真实成本透传给机构端。

## 2. 本轮已完成的 contract foundation

### 2.1 新增真实 quota linkage source contract

在 `src/modules/institution/domain/package-ai-quota-contract.ts` 中新增：

1. `RealPackageAiQuotaAllowanceSource`
2. `RealPackageAiQuotaUsageSource`
3. `RealPackageAiQuotaLinkageSource`
4. `InstitutionAiQuotaReadonlyDto`
5. `INSTITUTION_AI_QUOTA_READONLY_FIELD_WHITELIST`

真实 linkage source 只表达后续真实 DB 接入所需的最小字段：

- `tenantPackage`
- `period`
- `allowance`
- `usage`
- `status`
- `warningLevel`
- `displayUnit`
- `notes`

机构端低敏 readonly DTO 白名单固定为：

- `isLinked`
- `status`
- `periodStart`
- `periodEnd`
- `totalAllowance`
- `used`
- `remaining`
- `usageRate`
- `warningLevel`
- `displayUnit`
- `notes`

## 3. 本轮已完成的 mapper / helper

新增 `mapRealPackageAiQuotaSourceToInstitutionReadonlyDto`，用于把未来真实 quota source 映射为机构端低敏 readonly DTO。

映射原则：

1. `remaining` 与 `usageRate` 由 server-domain helper 重新计算，不信任 source 传入的派生值。
2. 缺失 source、缺失绑定、未绑定、无套餐、缺失周期、缺失总额度、缺失 used 等情况回退到 `isLinked=false`。
3. fallback 不展示总额度、剩余额度或使用率，避免伪装成真实额度。
4. `displayUnit` 固定为 `AI 服务额度`。
5. 机构端 DTO 不包含 provider、model、Token、RMB、真实成本、apiKey、baseUrl、credential、prompt、answer、rawResponse、metadata、meteringDetails 或客户敏感信息。

## 4. 本轮新增 fixtures

在 `PACKAGE_AI_QUOTA_FIXTURES` 下新增：

1. `realLinkageSources.active`
2. `realLinkageSources.warning`
3. `realLinkageSources.overLimit`
4. `realLinkageSources.expired`
5. `realLinkageSources.missingBinding`
6. `realLinkageSources.invalidFallback`
7. `realLinkageSources.unlinkedCompatibility`
8. `realLinkageInstitutionReadonlyDtos.*`

这些 fixtures 仅用于 contract / mapper 测试，不代表真实业务数据，不代表真实额度扣减或真实账单。

## 5. 本轮未做事项

本轮明确未做：

1. 未接真实 DB。
2. 未改 schema。
3. 未写 migration。
4. 未执行 `pnpm db:migrate`。
5. 未执行 `pnpm db:seed`。
6. 未新增 API route。
7. 未修改现有 API URL。
8. 未改 UI 页面。
9. 未调用 provider。
10. 未做真实 AI smoke。
11. 未做真实额度扣减。
12. 未做额度告警。
13. 未做导出。
14. 未部署测试服或生产。
15. 未把 mock / fixture / contract foundation 写成真实上线能力。

## 6. 后续真实 DB 接入建议

后续接真实 DB 时，建议保持当前边界：

1. DB repository 读取真实套餐绑定、额度周期、额度总量和已用量。
2. repository 输出先落到 `RealPackageAiQuotaLinkageSource`，不要直接返回机构端 DTO。
3. 统一经 `mapRealPackageAiQuotaSourceToInstitutionReadonlyDto` 映射到机构端 quota readonly DTO。
4. 真实 source 异常、无绑定、未配置或数据不完整时，继续回退为 `isLinked=false`，不得展示伪真实剩余额度。
5. 若未来需要平台端内部 provider、model、Token、成本、折算规则或审计详情，应只保留在平台端内部 contract，不进入机构端 facade。
6. 真实扣减、告警、导出、生产上线必须另行设计并单独授权。

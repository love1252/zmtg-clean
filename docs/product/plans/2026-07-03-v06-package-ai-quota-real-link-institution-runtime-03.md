# V0.6-PACKAGE-AI-QUOTA-REAL-LINK-INSTITUTION-RUNTIME-03：机构端 runtime readonly source facade 接入

## 1. 本轮目标

本轮把 PR #431 已建立的 package AI quota readonly source foundation 接入现有机构端 AI 服务使用 server runtime。

目标是让现有 `GET /api/institution/ai-service-usage` 的 quota 来源从“server 逻辑中直接选择 fixture quota”演进为：

1. `PackageAiQuotaReadonlySourceRepository` / readonly source facade
2. `RealPackageAiQuotaLinkageSource`
3. `mapRealPackageAiQuotaSourceToInstitutionReadonlyDto`
4. `InstitutionAiQuotaReadonlyDto`
5. 现有机构端 AI 服务使用 response 的 `quota`

本轮仍是 readonly runtime foundation，不是生产真实额度上线。

## 2. 本轮实现说明

### 2.1 institution runtime 已接入 readonly source facade

`src/modules/institution/server/institution-ai-service-usage.ts` 已在 `getInstitutionAiServiceUsage` 中通过 `createPackageAiQuotaReadonlySourceFacade` 获取 quota source。

默认 runtime 使用受控 fixture-backed readonly source repository，以保持既有机构端 AI 服务使用页面/API 已验收的 linked readonly 展示口径：

- 默认 `quota.isLinked=true`
- 默认 `status=active`
- 默认展示 `totalAllowance / used / remaining / usageRate / warningLevel / displayUnit / notes`
- 这些字段仍只属于机构端低敏白名单

### 2.2 quota 来源不再直接塞 fixture DTO

本轮不再在 AI 服务使用 response 中直接把 fixture quota DTO 塞入 `quota`。

默认 source 仍是受控 fixture/source，但路径已固定为：

```text
fixture-backed readonly source repository
-> readonly source facade
-> RealPackageAiQuotaLinkageSource
-> mapRealPackageAiQuotaSourceToInstitutionReadonlyDto
-> InstitutionAiQuotaReadonlyDto
-> institution ai-service-usage response.quota
```

这样后续接真实 DB adapter 时，可以替换 repository，而不改变 API URL、route 或 UI contract。

### 2.3 controlled fallback

当 readonly source 返回 `null`、不可用、缺失绑定或 source 不完整时，仍通过 controlled fallback 输出安全未接入状态：

- `isLinked=false`
- `status=unlinked`
- 不展示伪真实总额度
- 不展示伪真实剩余额度
- 不展示伪真实使用率
- `displayUnit` 固定为 `AI 服务额度`
- `notes` 给出受控 fallback 说明

### 2.4 overLimit 仍只是 readonly 状态

`overLimit` 仅作为只读展示状态：

- 不阻断服务
- 不做真实扣减
- 不触发额度告警
- 不导出
- 不返回阻断、扣减、告警动作字段

## 3. 本轮未做事项

本轮明确未做：

1. 未新增 API route。
2. 未修改 API URL。
3. 未修改 UI / page / component。
4. 未接真实 DB。
5. 未修改 `src/server/db/**`。
6. 未修改 schema / migration。
7. 未执行 migration。
8. 未执行 `db:seed`。
9. 未写数据库。
10. 未调用 provider。
11. 未做真实 AI smoke。
12. 未做真实额度扣减。
13. 未做额度告警。
14. 未做导出。
15. 未改 AI usage 写入链路。
16. 未改 quota enforcement。

## 4. 安全与低敏边界

机构端 response 的 quota 仍不得包含：

- provider
- model
- Token / totalTokens
- 内部折算
- RMB / ¥ / 真实成本
- prompt / answer / rawResponse
- metadata / meteringDetails
- apiKey / baseUrl / credential
- 客户手机号 / 客户身份证 / 病历详情等客户敏感字段

本轮测试继续覆盖敏感字段不泄露与 `overLimit` 不阻断、不扣减、不告警。

## 5. 后续工作

后续仍需单独完成：

1. 测试服验收。
2. 真实 DB adapter 设计与实现。
3. 真实套餐绑定、额度周期、额度总量、用量聚合的数据口径确认。
4. 如需新增 API route、UI、schema / migration、真实扣减、告警或导出，必须拆成独立任务并单独授权。

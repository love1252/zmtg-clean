# V0.6-PACKAGE-AI-QUOTA-REAL-LINK-READONLY-SOURCE-02：真实套餐权益 / AI 服务额度 readonly source foundation

## 1. 本轮目标

本轮只做真实套餐权益 / AI 服务额度 readonly source 基础层。

本轮不接现有 API runtime、不改 UI、不改 schema / migration、不做真实扣减、不做额度告警、不做导出。机构端输出链路继续保持：

`RealPackageAiQuotaLinkageSource -> mapRealPackageAiQuotaSourceToInstitutionReadonlyDto -> InstitutionAiQuotaReadonlyDto`

## 2. 最小盘点范围

本轮只盘点以下范围：

1. `src/modules/institution/domain/package-ai-quota-contract.ts`
2. `src/modules/institution/server/`
3. `src/modules/institution/tests/`
4. `docs/product/plans/` 下 package-ai-quota 相关文档

未扩散到 API route、UI、schema、migration、真实环境配置或 `.env.local`。

## 3. 是否发现可复用现有结构

### 3.1 可复用结构

发现以下结构可复用为 readonly source foundation 的 contract / 输入口径参考：

1. `RealPackageAiQuotaLinkageSource`
   - 可作为本轮统一 source 输出类型。
   - 后续真实 DB adapter 也应先输出该类型，再映射机构端 DTO。

2. `InstitutionAiQuotaReadonlyDto`
   - 可作为机构端低敏 readonly DTO 的稳定目标。
   - 已有白名单字段可继续复用。

3. `mapRealPackageAiQuotaSourceToInstitutionReadonlyDto`
   - 可复用为 source 到机构端 DTO 的唯一 mapper。
   - 已具备 missing binding、invalid source、unlinked、null source fallback 行为。

4. `PACKAGE_AI_QUOTA_FIXTURES.realLinkageSources`
   - 可复用为 active、warning、overLimit、expired 与 fallback contract 测试样本。

5. `tenantPlanAssignments` / `tenantPlans` / `tenantQuotaSnapshots` 的现有读取口径
   - 在 `tenant-quota-enforcement.ts` 中已有租户套餐 / 配额快照读取思路。
   - 仅能作为“后续真实 DB adapter 的参考”，本轮不直接接入真实查询。

6. `aiCallUsageRecords` 的机构端只读聚合口径
   - `institution-ai-service-usage.ts` 中已有按时间查询机构 AI 使用记录的只读聚合。
   - 可作为“usage 聚合来源”的后续参考。
   - 但其中包含 provider、model、Token、metering 等内部字段，不能直接作为机构端 quota source 输出。

### 3.2 不可复用结构

以下结构本轮不可直接复用为真实 readonly source：

1. `institution-ai-call-usage-repository.ts` 的写入链路
   - 包含 `createUsageRecord`，属于 AI usage 写入链路。
   - 本轮禁止修改或接入 quota enforcement / 扣减 / 写入。

2. provider config / metering rule 相关结构
   - 包含 provider、model、apiKey、baseUrl、Token、内部折算等敏感或内部字段。
   - 不允许进入机构端 readonly source / DTO。

3. `tenant-quota-enforcement.ts` 的 enforcement 判断
   - 用于创建资源时的 quota 判断。
   - 本轮 overLimit 只作为 readonly 状态，不阻断、不扣减、不告警，因此不接 enforcement。

4. 现有 mock / fixture 平台 contract
   - 可用于测试和产品口径，但不能伪装成真实 DB 额度。

### 3.3 暂不确定结构

以下内容需要后续 schema / DB 设计任务单独确认：

1. 真实套餐权益与机构套餐绑定是否应沿用现有 `tenantPlanAssignments` / `tenantPlans`。
2. AI 服务额度总量是否由 `tenantQuotaSnapshots.maxAiCalls` 承载，还是需要独立 AI 服务额度周期表。
3. `aiCreditsConsumed` 与“AI 服务额度”的真实换算口径是否已经最终验收。
4. 额度周期、套餐升级 / 降级、人工加量、审计记录与过期规则如何落库。
5. 平台人工修正和审计是否需要新增独立结构。

## 4. 本轮为何不接真实 DB

本轮不接真实 DB，原因是：

1. 当前允许范围禁止修改 schema / migration，也禁止写数据库。
2. 现有结构能作为参考，但尚不能确认已完整覆盖真实套餐权益、额度周期、额度变更、人工修正和审计口径。
3. 直接硬写 DB 查询容易把 `provider`、`model`、Token、内部折算、成本或 metadata 带入机构端链路。
4. 本轮目标是先固定 readonly source contract / facade 与 fallback 行为，而不是上线真实额度能力。
5. 真实 DB 接入需要单独 schema / repository / API 接入任务，并经过测试服验收。

## 5. 本轮实现内容

新增：

`src/modules/institution/server/package-ai-quota-readonly-source.ts`

包含：

1. `PackageAiQuotaReadonlySourceRepository`
   - readonly source repository contract。

2. `PackageAiQuotaReadonlySourceDependencies`
   - dependency-injected readonly adapter 的依赖 contract。
   - 由调用方提供绑定、周期、总额度、使用量读取能力。
   - 本轮测试使用 mock dependency，不连接真实 DB。

3. `createPackageAiQuotaDependencyInjectedReadonlySourceRepository`
   - dependency-injected readonly adapter。
   - 输出统一为 `RealPackageAiQuotaLinkageSource`。
   - 支持 `active`、`warning`、`overLimit`、`expired`。
   - `overLimit` 仅为 readonly 状态，不阻断、不扣减、不告警。

4. `createControlledFallbackPackageAiQuotaReadonlySource`
   - controlled fallback source。
   - 输出 `status='unlinked'`、`allowance=null`、`usage=null`、`period=null`。
   - 不伪装真实额度。

5. `createPackageAiQuotaControlledFallbackReadonlySourceRepository`
   - 默认 fallback repository。
   - 用于没有可靠 DB source 时的安全只读兜底。

6. `createPackageAiQuotaReadonlySourceFacade`
   - facade 输出 `RealPackageAiQuotaLinkageSource`。
   - 可继续通过 `mapRealPackageAiQuotaSourceToInstitutionReadonlyDto` 得到 `InstitutionAiQuotaReadonlyDto`。

## 6. controlled fallback

本轮仍使用 controlled fallback。

触发场景包括：

1. missing binding。
2. invalid source。
3. unlinked。
4. null / unavailable source。
5. allowance 缺失或非非负数。
6. usage 缺失或非非负数。
7. period 缺失。

fallback 明确不展示总额度、已用、剩余、使用率或真实周期，避免伪装成真实额度。

## 7. 测试覆盖

新增：

`src/modules/institution/tests/PackageAiQuotaReadonlySource.test.ts`

覆盖：

1. readonly source contract 输出稳定。
2. source 输出统一为 `RealPackageAiQuotaLinkageSource`。
3. `RealPackageAiQuotaLinkageSource -> mapRealPackageAiQuotaSourceToInstitutionReadonlyDto -> InstitutionAiQuotaReadonlyDto` 兼容。
4. missing / invalid / unlinked / null source fallback。
5. active / warning / overLimit / expired。
6. 没有可复用 DB 结构时走 controlled fallback。
7. dependency-injected adapter 使用 mock dependency，不连接真实 DB。
8. 不写数据库。
9. 不调用 provider。
10. 不触发扣减 / 告警 / 导出。
11. 不泄露敏感字段。
12. 现有机构端 AI 服务使用 contract 测试可继续一起运行。

## 8. 本轮明确未做

1. 未新增 API route。
2. 未接真实 DB。
3. 未改 schema / migration。
4. 未改 UI / page / component。
5. 未做真实额度扣减。
6. 未做额度告警。
7. 未做导出。
8. 未改 AI usage 写入链路。
9. 未改 quota enforcement。
10. 未执行 migration / db:seed。
11. 未写数据库。
12. 未调用 provider。
13. 未做真实 AI smoke。
14. 未部署测试服或生产。

## 9. 后续工作

后续仍需单独任务处理：

1. API 接入：把机构端 AI 服务使用 API 的 quota source 从 fixture 演进到 readonly facade。
2. UI 验收：确认机构端页面展示低敏字段且不误导为真实扣减。
3. 真实 DB schema / repository 设计：明确套餐绑定、额度周期、额度变更、人工修正、审计字段。
4. 测试服验收：使用隔离测试数据验证 API / UI 链路。
5. 额度扣减、告警、导出：必须各自单独设计、授权和实现。

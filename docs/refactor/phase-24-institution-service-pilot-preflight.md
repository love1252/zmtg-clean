# 第二十四阶段：机构端服务边界试点预检

- 日期：2026-07-26
- 分支：`refactor/institution-entitlement-service-pilot-20260726-221222`
- 基线：`cbe14e660b8d31f864dde2854211dddc0feb2d15`
- 阶段性质：单一服务边界试点
- 第二十四阶段授权：是
- 源码移动必须晚于本预检输出完成

## 唯一候选

- 当前路径：`src/modules/institution/server/package-ai-quota-readonly-source.ts`
- 建议目标：`src/modules/institution/entitlement/package-ai-quota-readonly-source.ts`
- 当前职责：`server_service`
- 领域所有者：`entitlement`
- 文件 blob：`177ad4c2d5ef7fb849d955996755beba12b3cc0f`
- 文件行数：287
- 直接调用方：2
- 直接测试调用方：1

## 选择依据

候选同时满足：

1. 领域所有者明确，且不是 `shared`；
2. 只依赖机构端 domain 契约；
3. 不读取数据库；
4. 不读取环境变量或真实凭证；
5. 不调用网络、HIS 或企业微信；
6. 不依赖 React、页面、测试或 API route；
7. 跨模块出向依赖为 0；
8. 反向依赖为 0；
9. 不属于循环依赖；
10. 全部直接调用方和测试可完整列出；
11. 目标路径当前不存在；
12. 可通过单一文件恢复和两处 import 回退。

## Import 契约

候选当前恰好只有一个 import：

- `@/modules/institution/domain/package-ai-quota-contract`

移动后保持不变。

## Export 契约

候选恰好导出 10 个符号：

### Type exports

1. `PackageAiQuotaReadonlySourceFallbackReason`
2. `PackageAiQuotaReadonlySourceLookupInput`
3. `PackageAiQuotaReadonlySourceRepository`
4. `PackageAiQuotaReadonlySourceDependencies`

### Function exports

1. `createControlledFallbackPackageAiQuotaReadonlySource`
2. `createPackageAiQuotaControlledFallbackReadonlySourceRepository`
3. `createPackageAiQuotaFixtureBackedReadonlySource`
4. `createPackageAiQuotaFixtureBackedReadonlySourceRepository`
5. `createPackageAiQuotaDependencyInjectedReadonlySourceRepository`
6. `createPackageAiQuotaReadonlySourceFacade`

移动后名称、数量、类型和运行时行为全部保持不变。

## 全部直接调用方

1. 运行时服务：
   `src/modules/institution/server/institution-ai-service-usage.ts`
2. 直接测试：
   `src/modules/institution/tests/PackageAiQuotaReadonlySource.test.ts`

只允许将上述两个文件中的 import 从：

- `@/modules/institution/server/package-ai-quota-readonly-source`

修改为：

- `@/modules/institution/entitlement/package-ai-quota-readonly-source`

## 精确白名单

机器可读白名单：

- `docs/refactor/phase-24-institution-service-pilot-allowed-files.csv`

白名单路径共 9 个；GitHub 将纯重命名按一个 changed file 计算，
因此 PR changed files 预期为 8。

## 依赖方向

移动前：

`institution-ai-service-usage.ts`
→ `server/package-ai-quota-readonly-source.ts`
→ `domain/package-ai-quota-contract.ts`

移动后：

`institution-ai-service-usage.ts`
→ `entitlement/package-ai-quota-readonly-source.ts`
→ `domain/package-ai-quota-contract.ts`

依赖方向保持单向，不新增循环或反向依赖。

## 回退

1. 将 `src/modules/institution/entitlement/package-ai-quota-readonly-source.ts` 恢复至
   `src/modules/institution/server/package-ai-quota-readonly-source.ts`；
2. 将两个直接调用方 import 恢复为旧路径；
3. 删除本阶段新增预检文档和白名单；
4. 恢复 3 个交接文件；
5. 不涉及 API、数据库、环境变量或外部服务。

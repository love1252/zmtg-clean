# 第二十七阶段：开放平台唯一低风险候选

- 生成阶段：第二十六阶段
- 当前授权：否
- 候选选择方式：对全部开放平台文件执行固定安全规则后排序，选择唯一首位候选
- 符合最低安全边界的候选总数：2

## 唯一候选

- 当前路径：`src/modules/open-platform/domain/tenant-plan-change.ts`
- 建议目标：`src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`
- 职责：`domain`
- 领域所有者：`commercial_entitlement`
- 文件 blob：`59c7d6bed836ed8b56cc0376b3203b156c41eb88`
- 文件行数：244
- type-only：no
- import 数量：1
- runtime import 数量：0
- 直接调用方：4
- 直接测试：1
- 跨模块出向依赖：0
- 跨模块入向依赖：0
- 反向依赖：0
- 循环依赖：0
- 运行时边界 token：0

## Import 契约

- `@/modules/open-platform/domain/tenant-plan-binding`

## Export 契约

共 7 个显式 export：

- `type TenantPlanChangePayload`
- `type TenantPlanChangeParseResult`
- `type TenantPlanChangeDiffItem`
- `type TenantPlanChangePreview`
- `function parseTenantPlanChangePayload`
- `function buildTenantPlanChangePreview`
- `function buildInitialPlanAssignmentPreview`

## 全部直接调用方

- `src/modules/open-platform/client/platform-tenant-management-client.ts`
- `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- `src/modules/open-platform/server/tenant-plan-change-service.ts`
- `src/modules/open-platform/tests/TenantPlanChangeDomain.test.ts`

## 全部直接测试

- `src/modules/open-platform/tests/TenantPlanChangeDomain.test.ts`

## 精确允许文件

- `docs/refactor/phase-26-open-platform-phase27-allowed-files.csv`
- 白名单路径数：9

第二十七阶段只能修改该白名单内文件。

## 必须保持

- 文件 blob 在纯移动前后保持一致；
- import、export 名称、数量、类型和运行时行为保持不变；
- 直接调用方只允许修正 import；
- 不新增 barrel 扩散；
- 不产生新的跨模块依赖、循环依赖或反向依赖；
- 不改变 API、数据库、权限、租户隔离或错误响应；
- 不读取或输出真实凭证。

## 回退

1. 将 `src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts` 恢复至 `src/modules/open-platform/domain/tenant-plan-change.ts`；
2. 恢复全部直接调用方 import；
3. 恢复 3 个交接文件；
4. 不涉及 Schema、Migration、package、锁文件或真实外部服务。

## 授权边界

第二十七阶段未授权。必须在第二十六阶段 PR 合并后单独授权。

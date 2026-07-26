# 下一任务

## 当前任务

执行第二十七阶段：开放平台唯一低风险试点。

## 唯一候选

- 当前路径：`src/modules/open-platform/domain/tenant-plan-change.ts`
- 建议目标：`src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`
- 职责：`domain`
- 领域所有者：`commercial_entitlement`
- 文件 blob：`59c7d6bed836ed8b56cc0376b3203b156c41eb88`
- import 数量：1
- runtime import 数量：0
- export 数量：7
- 直接调用方：4
- 直接测试：1
- 第二十七阶段当前授权：否

## 全部直接调用方

- `src/modules/open-platform/client/platform-tenant-management-client.ts`
- `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- `src/modules/open-platform/server/tenant-plan-change-service.ts`
- `src/modules/open-platform/tests/TenantPlanChangeDomain.test.ts`

## 全部直接测试

- `src/modules/open-platform/tests/TenantPlanChangeDomain.test.ts`

## 精确白名单

- `docs/refactor/phase-26-open-platform-phase27-allowed-files.csv`
- 白名单路径：9

## 必须保持

- 只移动唯一候选；
- 文件内容、blob、import、export 和运行时行为保持不变；
- 直接调用方只允许修正 import；
- 不新增 barrel 扩散；
- 不新增跨模块依赖、循环依赖或反向依赖；
- 可独立回退。

## 禁止范围

- 不扩大到第二个开放平台候选；
- 不修改白名单外源码；
- 不修改 API；
- 不修改 `file-migration-matrix.csv`；
- 不修改 Schema、Migration、package 或锁文件；
- 不连接真实数据库或外部服务；
- 不读取或输出真实凭证；
- 不改变权限、租户隔离、错误响应或真实渠道行为；
- 不提前进入第二十八阶段；
- 当前未授权，不得直接实施。

## 验证

1. `git diff --check`
2. 移动前后 blob 一致
3. import 和 export 契约一致
4. 旧 import 归零且新 import 覆盖全部直接调用方
5. 无新增跨模块依赖、循环依赖或反向依赖
6. 全部直接测试
7. 开放平台代表性测试
8. `pnpm typecheck`
9. `pnpm lint`
10. `pnpm build`

## 回退

1. 将目标文件恢复至原路径；
2. 恢复全部调用方 import；
3. 恢复 3 个交接文件；
4. 删除第二十七阶段新增的边界测试。

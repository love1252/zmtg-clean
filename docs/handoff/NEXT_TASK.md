# 下一任务

## 当前任务

执行第二十阶段：WeCom official dry-run 单一版本化兼容入口试点实施。

## 当前入口

- URL：`/api/institution/wecom-official-dry-run`
- 文件：`src/app/api/institution/wecom-official-dry-run/route.ts`
- 方法：`GET`
- 修改权限：只读，不得修改

## 新版本化入口

- URL：`/api/v1/institution/wecom-official-dry-run`
- 文件：`src/app/api/v1/institution/wecom-official-dry-run/route.ts`
- 方法：`GET`

新路由必须只包含：

```ts
export { GET } from '@/app/api/institution/wecom-official-dry-run/route';
```

## 精确文件白名单

1. `src/app/api/v1/institution/wecom-official-dry-run/route.ts`
2. `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`
3. `docs/handoff/CURRENT_STATUS.md`
4. `docs/handoff/NEXT_TASK.md`
5. `docs/handoff/RELEASE_HISTORY.md`

## 必须保持

- HTTP `503`
- `code=capability_disabled`
- `Cache-Control=no-store`
- Request 读取为 0
- 下游、数据库和外部调用为 0
- 旧入口继续可用

## 禁止范围

- 不修改旧路由、任何现有测试或调用方；
- 不新增 Wrapper、重定向、代理或弃用 Header；
- 不扩大到 `/evaluate`、config、snapshot 或其他路由；
- 不修改迁移矩阵、Schema、Migration、package 或锁文件；
- 不连接数据库或真实外部服务；
- 不扩大到第二个路由族。

## 后续阶段

第二十一阶段审计该试点结果并形成剩余 API 分批治理计划。

# 第十九阶段：WeCom official dry-run 试点验证与回退计划

## 第二十阶段静态约束

`src/app/api/v1/institution/wecom-official-dry-run/route.ts` 必须只包含：

```ts
export { GET } from '@/app/api/institution/wecom-official-dry-run/route';
```

禁止 Wrapper、NextResponse 新实现、Request 读取、重定向、代理、Header 注入、环境变量、数据库和外部调用。

## 定向测试

```zsh
pnpm test -- \
  src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts \
  src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts \
  src/modules/institution/tests/WeComDryRunSnapshotApiRoute.test.ts \
  src/modules/institution/tests/WeComOfficialDryRunConfigApiRoute.test.ts
```

## 完整验证

```zsh
git diff --check
pnpm typecheck
pnpm lint
pnpm build
```

build 必须同时列出旧入口和新版本化入口。

## 回退步骤

1. 删除 `src/app/api/v1/institution/wecom-official-dry-run/route.ts`；
2. 删除 `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`；
3. 恢复 3 个交接文件；
4. 重新执行完整验证；
5. 确认旧入口仍返回固定低敏 503。

# 第四阶段：运行命令与测试命令入口分层

- 日期：2026-07-25
- 分支：`refactor/runtime-testing-entrypoints-20260725-235624`
- 基线：`a2f69cce3d91188581226974b43946bda2778b60`

## 目标

在不修改 `package.json` 命令路径的前提下，将 Next.js 和 Vitest 的稳定入口与实际实现分离。

## 已完成

1. Next.js 命令：
   - 保留兼容入口：
     `scripts/run-next.mjs`
   - 实际实现移动到：
     `scripts/runtime/run-next.mjs`

2. Vitest 命令：
   - 保留兼容入口：
     `scripts/run-vitest.mjs`
   - 实际实现移动到：
     `scripts/testing/run-vitest.mjs`

3. 更新：
   - `scripts/README.md`
   - `docs/refactor/file-migration-matrix.csv`

## 兼容性

- `pnpm dev` 的入口路径保持不变。
- `pnpm build` 的入口路径保持不变。
- `pnpm start` 的入口路径保持不变。
- `pnpm test` 的入口路径保持不变。
- `pnpm test:watch` 的入口路径保持不变。
- Next.js 与 Vitest 的命令行参数仍原样转发。

## 安全边界

- 未修改 `package.json`。
- 未修改 `pnpm-lock.yaml`。
- 未执行真实服务器部署。
- 未运行数据库迁移或 Seed。
- 未读取或输出真实凭证。
- 未修改 Schema、Migration、认证、权限或租户隔离。
- 未移动业务模块、Demo、Mock 或 Fixture 文件。

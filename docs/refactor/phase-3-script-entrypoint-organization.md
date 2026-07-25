# 第三阶段：脚本入口与实现文件分层

- 日期：2026-07-25
- 分支：`refactor/script-entrypoints-20260725-232644`
- 基线：`085588ce6326ee24e4a9a61f5f46be39b2140066`

## 目标

在不修改 `package.json` 命令路径的前提下，将脚本稳定入口与实际实现分离。

## 已完成

1. 测试服务器部署脚本：
   - 保留兼容入口：
     `scripts/deploy-test-server.mjs`
   - 实际实现移动到：
     `scripts/deploy/test-server.mjs`

2. Node 运行时解析脚本：
   - 保留兼容入口：
     `scripts/runtime-node.mjs`
   - 实际实现移动到：
     `scripts/runtime/resolve-runtime-node.mjs`

3. 新增：
   - `scripts/README.md`

4. 更新逐文件迁移矩阵中的两条脚本记录。

## 兼容性

- `pnpm deploy:test-server` 的入口路径保持不变。
- `pnpm dev`、`pnpm build` 和 `pnpm start` 的入口路径保持不变。
- `pnpm test` 和 `pnpm test:watch` 的入口路径保持不变。
- `run-next.mjs` 与 `run-vitest.mjs` 仍通过原路径导入运行时解析器。

## 安全边界

- 未修改 `package.json`。
- 未修改 `pnpm-lock.yaml`。
- 未执行真实服务器部署。
- 未运行数据库迁移或 Seed。
- 未读取或输出真实凭证。
- 未修改 Schema、Migration、认证、权限或租户隔离。
- 未移动业务模块。

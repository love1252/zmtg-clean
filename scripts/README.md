# 脚本目录说明

## 目录原则

根目录脚本属于稳定兼容入口。`package.json`、开发命令或外部操作指令可以继续使用原路径，不需要随内部目录调整而改变。

实际实现按职责放入子目录：

- `scripts/db/`：数据库迁移保护与数据库操作入口。
- `scripts/demo/`：演示数据和低敏示例数据脚本。
- `scripts/deploy/`：部署实现。
- `scripts/dev/`：本地开发与验收辅助脚本。
- `scripts/runtime/`：Node、Next.js、Vitest 等运行时辅助实现。

## 稳定入口

- `scripts/deploy-test-server.mjs`
  - 测试服务器部署兼容入口。
  - 实际实现位于 `scripts/deploy/test-server.mjs`。

- `scripts/runtime-node.mjs`
  - Node 运行时解析兼容入口。
  - 实际实现位于 `scripts/runtime/resolve-runtime-node.mjs`。

- `scripts/run-next.mjs`
  - Next.js 命令入口。
  - 路径暂时保持不变。

- `scripts/run-vitest.mjs`
  - Vitest 命令入口。
  - 路径暂时保持不变。

## 安全边界

- 不在脚本整理过程中修改真实凭证。
- 不在脚本整理过程中执行真实部署。
- 不自动运行数据库迁移或 Seed。
- 不修改生产环境配置。
- 不改变 `package.json` 中现有命令入口。

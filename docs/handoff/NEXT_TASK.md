# 下一任务

## 当前任务

执行第三十阶段 B：Demo Seed CLI 守卫策略与核心 Seed Guard 对齐。

## 前置结论

- 第三十阶段预审已完成；
- R06 决策：`fix_in_dedicated_branch`；
- R07 决策：`update_test_only_preserve_unique_route_coverage_in_dedicated_branch`；
- 本任务只处理 R06；
- 不并行处理 `DemoAuthRoutes`；
- 第三十阶段剩余正式分支：2。

## 精确允许修改文件

1. `scripts/demo/seed-v06-low-sensitive-demo.ts`
2. `scripts/demo/seed-v06-low-sensitive-demo.test.ts`

除此之外，任何 `src/`、scripts、测试、文档或配置文件均不得修改，阶段证据和交接文档除外。

## 只读契约证据

- `src/server/db/seed-guard.ts`
- `src/server/db/tests/SeedGuard.test.ts`
- `src/server/db/seed-demo-data.ts`
- `docs/refactor/phase-30-seed-guard-allowed-files.csv`
- `docs/refactor/phase-30-legacy-safety-preflight.md`

## 必须实现

1. Demo CLI 写入／清理守卫复用 `assertDemoSeedAllowed`；
2. 移除非 loopback Demo／Preview 标记放行；
3. 旧 `ZMTG_ALLOW_DEMO_SEED=1` 单独存在时不得放行；
4. 必须要求：
   - `ZMTG_DEMO_SEED_TARGET=local`
   - `ZMTG_DEMO_SEED_CONFIRMATION=SEED_LOCAL_DEMO`
   - PostgreSQL URL
   - loopback host
   - 安全数据库名
5. 守卫必须继续位于 PostgreSQL Client 创建之前；
6. 错误信息不得包含完整连接串或密码；
7. dry-run 默认行为、Seed 数据形状、写入顺序和 cleanup 范围不得改变。

## 必须测试

- production／staging／preview／test 环境拒绝；
- 远程 Demo host 拒绝；
- target 缺失拒绝；
- confirmation 缺失或错误拒绝；
- unsafe database name 拒绝；
- loopback＋安全数据库名允许；
- 守卫失败时不创建数据库 Client；
- 拒绝错误不泄露密码；
- 现有低敏、确定性 ID、cleanup 范围测试继续通过。

## 禁止范围

- 不执行 dry-run、apply、cleanup 或正式 Seed；
- 不连接数据库；
- 不读取 `.env.local`、`DATABASE_URL` 或真实凭证；
- 不修改 `src/server/db/seed-guard.ts`；
- 不修改 `src/server/db/seed-demo-data.ts`；
- 不修改 Schema、Migration、package 或锁文件；
- 不处理认证测试；
- 不转入第三十一阶段。

## 退出条件

- R06 修复并有静态与测试证据；
- 源码修改严格限于 1 个脚本文件；
- 测试修改严格限于 1 个脚本测试文件；
- typecheck、lint、定向测试和 build 通过；
- 下一任务转为第三十阶段 C；
- Ready 和合并仍需分别授权。

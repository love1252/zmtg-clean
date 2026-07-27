# 第三十阶段 B：Demo Seed CLI 守卫对齐

- 日期：2026-07-27
- 启动基线：`69657fa8decf448bf0e575827a8542262ad2c948`
- 风险编号：`R06`
- 处置：`resolved`
- 允许修改源码：`scripts/demo/seed-v06-low-sensitive-demo.ts`
- 允许修改测试：`scripts/demo/seed-v06-low-sensitive-demo.test.ts`
- 核心 Seed Guard：只读
- 正式 Seed 入口：只读
- Seed／Migration／数据库连接：0

## 修复结果

1. Demo CLI 写入和清理统一复用 `assertDemoSeedAllowed`；
2. 删除 `demo_marker` 非 loopback 放行策略；
3. 旧 `ZMTG_ALLOW_DEMO_SEED=1` 不再作为写入条件，单独存在不能放行；
4. 写入必须满足：
   - local target；
   - 固定人工确认；
   - PostgreSQL URL；
   - loopback host；
   - 安全数据库名；
5. PostgreSQL Client 只使用核心守卫返回的 `databaseUrl`；
6. 守卫失败发生在 Client 创建之前；
7. dry-run 默认行为、Seed 数据形状、写入顺序和 cleanup 范围保持不变；
8. 错误信息不输出密码或完整连接串。

## 测试覆盖

- production／staging／preview／test 环境拒绝；
- 远程 Demo host 拒绝；
- target 缺失拒绝；
- confirmation 缺失或错误拒绝；
- 非 PostgreSQL URL 和危险数据库名拒绝；
- localhost、IPv4、IPv6 loopback 与安全数据库名允许；
- 守卫失败不创建 Client；
- Client 使用守卫校验后的同一 URL；
- 既有低敏、确定性 ID、cleanup 范围测试保留。

## 操作指南同步

- `docs/product/demo/2026-07-07-v06-demo-seed-low-sensitive-01.md` 已同步到核心 Seed Guard 契约；
- apply／cleanup 示例改为 local target、固定人工确认、PostgreSQL loopback 和安全数据库名；
- 旧 `ZMTG_ALLOW_DEMO_SEED` 与远程 `demo` host 放行说明已删除。

## 安全边界

- 未执行 CLI dry-run、apply 或 cleanup；
- 未执行正式 Seed；
- 未创建真实数据库 Client；
- 未连接数据库；
- 未读取 `.env.local` 或真实 `DATABASE_URL`；
- 未修改 `src/server/db/seed-guard.ts`；
- 未修改 `src/server/db/seed-demo-data.ts`；
- 未修改 Schema、Migration、package 或锁文件；
- 未处理认证测试。

## 下一步

第三十阶段 C：`DemoAuthRoutes.test.ts` 测试治理、R07 修复、R08 最终解释与第三十阶段闭环。

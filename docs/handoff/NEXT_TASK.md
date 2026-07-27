# 下一任务

## 当前任务

执行第三十阶段 C：`DemoAuthRoutes.test.ts` 测试治理、遗留风险最终解释与第三十阶段闭环。

## 前置结论

- R06 已在第三十阶段 B 修复；
- Demo Seed CLI 已统一复用核心 Seed Guard；
- R06 对第三十一阶段不再构成阻断；
- R07 仍需修正旧认证测试契约漂移；
- R08 仍需完成迁移矩阵与遗留风险最终解释；
- 第三十阶段剩余正式分支：1。

## 唯一允许修改的测试文件

- `src/modules/auth/tests/DemoAuthRoutes.test.ts`

生产认证源码、路由、Demo Session 实现、FormalAuthRoutes 测试均只读。

## R07 必须实现

1. 逐案分类现有 `DemoAuthRoutes` 测试；
2. 保留 Demo Session 签名、篡改拒绝、来源枚举和 legacy cookie 单元契约；
3. 保留 `FormalAuthRoutes.test.ts` 尚未覆盖的 Demo 专属路由行为：
   - 缺少 Demo Session 密钥的受控错误；
   - 关闭 Demo 认证后的会话拒绝；
   - 平台 Demo 用户 scope；
   - logout 清理 Demo cookie；
4. 为保留的路由用例补齐当前数据库 Mock 和显式 `scope`；
5. 仅删除与 `FormalAuthRoutes.test.ts` 完全重复的断言；
6. 不修改生产认证行为、Cookie 契约、权限、租户范围或错误响应。

## R08 必须完成

- 复核 1509 条迁移矩阵记录及状态计数；
- 解释 pending 记录为何属于已分类、保护、延期或后续 backlog；
- 更新第三十阶段风险处置和最终闭环证据；
- 原迁移矩阵不得批量重写；
- 原遗留风险登记仅允许精确更新 R06、R07、R08；
- 下一任务在闭环后转入第三十一阶段。

## 允许的阶段证据与交接文档

- `docs/handoff/CURRENT_STATUS.md`
- `docs/handoff/NEXT_TASK.md`
- `docs/refactor/phase-30-risk-disposition.csv`
- `docs/refactor/phase-30-residual-risk-preaudit.csv`
- 新增第三十阶段 C／阶段闭环证据文档
- `docs/refactor/phase-10-residual-risk-register.csv` 仅限精确更新 R06、R07、R08

## 必须测试

- `DemoAuthRoutes.test.ts`
- `FormalAuthRoutes.test.ts`
- 认证安全相关代表性测试
- typecheck、lint 和 build

所有数据库访问必须 Mock，不连接真实数据库。

## 禁止范围

- 不修改认证生产源码；
- 不修改 API route；
- 不修改核心 Seed Guard 或 Demo Seed CLI；
- 不执行 Seed、Migration 或数据库连接；
- 不读取 `.env.local`、`DATABASE_URL` 或真实凭证；
- 不修改 Schema、Migration、package 或锁文件；
- 不批量修改迁移矩阵；
- 不自动启动第三十一阶段源码工作。

## 退出条件

- R07 修复或有明确退役证据；
- 独有 Demo 路由测试覆盖不退化；
- R08 获得可追溯的最终解释；
- R06、R07、R08 均不再是第三十一阶段未解释阻断；
- 第三十阶段闭环；
- Ready 和合并仍需分别授权。

# 第三十阶段：遗留安全治理与闭环预审

- 日期：2026-07-27
- 启动基线：`dd03a38374250e4bedf5ad610773be2ad977360c`
- 模式：`audit_only_preflight`
- 源码修改：0
- Seed／Migration／数据库连接：0
- 真实凭证读取：0
- 第三十阶段预计剩余正式分支：2

## 路线图目标

1. 处理 Demo Seed CLI 守卫与核心 Seed Guard 不一致；
2. 处理旧 `DemoAuthRoutes` 测试与当前认证契约漂移；
3. 对迁移矩阵和遗留风险进行最终预审；
4. 第三十一阶段不得存在未解释高风险阻断。

## R06：Demo Seed CLI 守卫不一致

### 现状证据

- `scripts/demo/seed-v06-low-sensitive-demo.ts` 允许 `localhost` 或带 Demo／Preview 标记的非 loopback 地址；
- `src/server/db/seed-guard.ts` 只允许 loopback；
- 核心守卫还要求：
  - `ZMTG_DEMO_SEED_TARGET=local`；
  - 固定人工确认；
  - PostgreSQL 协议；
  - 数据库名含 local／demo／dev／test；
  - 数据库名不得含 production／staging；
- 正式 Seed 入口在创建 Client 前复用核心守卫；
- Demo CLI 当前也在创建 Client 前执行守卫，但守卫策略更宽。

### 决策

`fix_in_dedicated_branch`

下一分支仅允许修改：

- `scripts/demo/seed-v06-low-sensitive-demo.ts`
- `scripts/demo/seed-v06-low-sensitive-demo.test.ts`

核心 Seed Guard、正式 Seed 入口及其测试全部只读。修复必须复用核心守卫，不复制第二套地址策略。

## R07：DemoAuthRoutes 测试契约漂移

### 现状证据

- `src/modules/auth/tests/DemoAuthRoutes.test.ts` 直接导入 login／logout／session 路由；
- 该测试未 Mock 数据库运行时；
- 机构演示登录请求仍省略 `scope`；
- `src/modules/auth/tests/FormalAuthRoutes.test.ts` 已固定当前契约：
  - `scope` 缺失返回 400；
  - DB 可用但正式账号不存在时才允许 Demo fallback；
  - formal／demo cookie 互斥；
  - `Cache-Control=no-store`；
- `src/modules/auth/server/demo-session.ts` 已提供可独立测试的 Demo 用户、会话创建、签名和解码能力。
- 旧测试还包含当前 `FormalAuthRoutes.test.ts` 未完全覆盖的 Demo 专属行为：
  - 生产环境缺少 Demo Session 密钥时返回受控 `503`；
  - 生产关闭 Demo 认证时拒绝 Demo／legacy 会话；
  - 平台 Demo 用户必须显式使用 platform scope；
  - logout 清理 Demo cookie。

### 决策

`update_test_only_in_dedicated_branch`

后续只允许修改：

- `src/modules/auth/tests/DemoAuthRoutes.test.ts`

生产认证路由、Demo Session 实现和 `FormalAuthRoutes.test.ts` 全部只读。旧测试必须逐案分类：保留 Demo Session／Demo 用户单元契约；保留 `FormalAuthRoutes.test.ts` 尚未覆盖的 Demo 专属路由行为，并在 `DemoAuthRoutes.test.ts` 内补齐当前 DB Mock 与显式 `scope`；仅删除与 `FormalAuthRoutes.test.ts` 完全重复的路由断言。

### 本预审不运行 DemoAuthRoutes

该文件直接调用当前认证路由且未 Mock 数据库边界。本预审禁止数据库连接，因此只做静态审计，不执行该测试。后续测试治理完成后再与 `FormalAuthRoutes.test.ts` 一起执行。

## 迁移矩阵预审

- 矩阵总记录：1509
- 状态计数：`{'boundary_confirmed': 5, 'completed': 10, 'dormant_boundary_confirmed': 1, 'ownership_confirmed': 25, 'pending': 1455, 'runtime_boundary_confirmed': 10, 'script_boundary_confirmed': 1, 'seed_entry_boundary_confirmed': 1, 'seed_guard_boundary_confirmed': 1}`
- 动作计数：`{'API_VERSION_REVIEW': 146, 'BOUNDARY_CONFIRMED_KEEP_CURRENT': 5, 'DORMANT_DOMAIN_MOCK_CONFIRMED_KEEP_CURRENT': 1, 'GUARDED_DB_SEED_ENTRY_CONFIRMED_KEEP_CURRENT': 1, 'GUARDED_DEMO_SCRIPT_CONFIRMED_KEEP_CURRENT': 1, 'KEEP_CANONICAL': 3, 'KEEP_ENTRYPOINT_MOVE_IMPLEMENTATION': 4, 'KEEP_LOCKED': 62, 'KEEP_MODULE_REVIEW': 77, 'KEEP_OR_DEDUPLICATE': 9, 'KEEP_OR_RECLASSIFY': 355, 'KEEP_REVIEW': 123, 'KEEP_WITH_MODULE': 84, 'MOVE_CANDIDATE': 53, 'OWNERSHIP_CONFIRMED_KEEP_CURRENT': 25, 'REMOVE_DUPLICATE': 3, 'RESPONSIBILITY_REVIEW': 50, 'RUNTIME_BOUNDARY_CONFIRMED_KEEP_CURRENT': 10, 'SEED_SECURITY_GUARD_CONFIRMED_KEEP_CURRENT': 1, 'SPLIT_REVIEW': 496}`
- 风险计数：`{'high': 693, 'low': 574, 'medium': 242}`
- 本阶段目标文件逐项证据：`docs/refactor/phase-30-migration-matrix-preaudit.csv`
- 本预审不修改迁移矩阵。

大量 pending 记录本身不等于第三十一阶段阻断。第三十阶段闭环必须按“已分类、保护、延期或仍需处理”解释，而不是强制移动全部文件。

## 遗留风险预审

- 风险预审：`docs/refactor/phase-30-residual-risk-preaudit.csv`
- R01：机构端已在第二十五阶段分类闭环；
- R02：开放平台已在第二十八阶段分类闭环；
- R03：API 已形成治理批次和非阻断 backlog；
- R04：第二十九阶段结论为 `no_safe_candidate`；
- R05：数据库／Schema／Migration／Seed 保持保护边界；
- R06：第三十阶段 B 修复；
- R07：第三十阶段 C 测试治理；
- R08：第三十阶段 C 与阶段闭环一并解释。

## 分支安排

1. 第三十阶段 B：Seed Guard 对齐；
2. 第三十阶段 C：DemoAuthRoutes 测试治理＋第三十阶段闭环。

不得并行修改两项代码治理，不额外创建无关分支。

## 禁止范围

- 不执行 Demo Seed、正式 Seed、Migration 或数据库连接；
- 不读取 `.env.local`、`DATABASE_URL` 或真实凭证；
- 不修改 Schema、Migration、package 或锁文件；
- 不修改认证路由行为、权限、租户隔离、Cookie 契约或错误响应；
- 不修改核心 Seed Guard；
- 不修改迁移矩阵；
- 不启动第三十一阶段。

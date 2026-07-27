# 第三十阶段：遗留安全治理最终闭环

- 日期：2026-07-27
- 阶段 C 启动基线：`6720a6511f38a7b23ade9960723eaf309a3644df`
- 正式认证源码修改：2（login route 平台 Demo scope 与 session route 结构一致性）
- API route 修改：2（`src/app/api/auth/login/route.ts`、`src/app/api/auth/session/route.ts`）
- 测试修改：2
  - `src/modules/auth/tests/DemoAuthRoutes.test.ts`
  - `src/modules/auth/tests/FormalAuthRoutes.test.ts`
- Seed／Migration／数据库连接：0
- 第三十阶段剩余正式分支：0

## R06：Demo Seed Guard

- 状态：`resolved_in_phase30b`
- 证据：`docs/refactor/phase-30b-seed-guard-alignment.md`
- 第三十一阶段门禁：`nonblocking`

## R07：DemoAuthRoutes 测试治理

### 保留的单元契约

- Demo Session 签名与解码；
- 篡改拒绝；
- 未知来源枚举拒绝；
- legacy cookie 仍可由底层解码器读取；
- 六个机构 Demo 用户映射；
- 平台 Demo 用户只匹配 `platform` scope；
- 错误凭据拒绝。

### 保留的当前路由契约

- 所有机构登录请求显式携带 `scope: institution`；
- 通过 Mock 正式账号仓库返回 `null` 后进入真实 Demo fallback；
- 生产缺少 Demo Session 密钥返回受控低敏 503；
- 关闭 Demo 认证后，demo 和 legacy cookie 均 fail-closed；
- 当前 session route 不再接受缺少来源的 legacy cookie；
- `platform` scope 只进入受 Demo 开关控制的 Demo 分支，成功或失败均不读取数据库；
- logout 继续清理 Demo cookie。

### 平台 Demo 登录链路修复

- `/platform-login` 继续提交 `scope: platform`；
- login route 接受 `institution | platform` 两种精确 scope；
- `platform` scope 在数据库认证之前进入 Demo-only 分支；
- 平台 Demo 分支继续受 `isDemoAuthEnabled()` 控制；
- 平台 Demo 用户成功登录后签发原有 Demo cookie，并可通过 session route 恢复会话；
- Demo 认证关闭、未知用户、错误密码或异常结果继续返回低敏拒绝；
- 平台 Demo 成功和失败路径均不读取数据库；
- 未新增正式平台数据库认证，机构正式账号认证路径保持不变。

### 真实 Demo Session 路由缺陷修复

- `createDemoSession` 与 `decodeDemoSession` 的真实结果包含 `user + expiresAt + source`；
- 原 session route 只接受 `source + user`，会把真实登录签发的 Demo cookie 错误判为 401；
- session route 现只接受精确的 `user + expiresAt + source` 结构；
- `source` 必须为 `demo_session`；
- `expiresAt` 必须是未来的安全整数；
- legacy、过期、缺字段、额外字段或 malformed user 继续 fail-closed；
- FormalAuthRoutes 的 Demo decoder Mock 已同步真实结构；
- 真实登录 → Demo cookie → session 200 的回归测试继续保留。

### 退役或替换的旧断言

- 删除无数据库 Mock 的直接 route 调用方式；
- 删除缺少显式 scope 的机构登录请求；
- 六机构账号映射从重复 route 流程测试收敛为 Demo 用户单元契约；
- 恢复平台 Demo 登录成功断言，并增加 Demo 关闭时的 fail-closed 证据；
- 与 `FormalAuthRoutes.test.ts` 完全重复的 formal cookie、数据库故障和通用路由安全断言不在本文件重复维护。

R07 状态：`resolved_in_phase30c`。

## R08：迁移矩阵最终解释

- 原矩阵：`docs/refactor/file-migration-matrix.csv`
- SHA-256：`5827e216946b9d94e34b91bdbffda2b026106ef2b5a75ab0a13d5df007afa8db`
- 数据行：1509
- 状态分布：`boundary_confirmed` 5、`completed` 10、`dormant_boundary_confirmed` 1、`ownership_confirmed` 25、`pending` 1455、`runtime_boundary_confirmed` 10、`script_boundary_confirmed` 1、`seed_entry_boundary_confirmed` 1、`seed_guard_boundary_confirmed` 1
- 风险分布：`high` 693、`low` 574、`medium` 242
- 高风险且 pending：688
- pending 且需要人工复核：1455
- 汇总证据：`docs/refactor/phase-30-migration-matrix-final-audit.csv`

### 解释

1. `pending` 是历史迁移规划状态，不是执行授权，也不代表必须在第三十阶段移动文件；
2. R01-R05 已分别形成分类、保护、延期或无安全候选结论；
3. R06、R07 已在独立白名单分支中修复；
4. high risk 是行级迁移风险标记，继续要求保护边界或独立授权，不自动构成当前活动阻断；
5. 原矩阵在第三十阶段 C 保持只读，第三十一阶段将把它作为最终目录审计输入；
6. 因此 R08 处置为 `explained_governed_backlog`，不再属于未解释的第三十一阶段前置阻断。

## 第三十阶段退出结论

- R06：`resolved`
- R07：`resolved`
- R08：`explained_governed_backlog`
- 未解释高风险阻断：0
- 第三十阶段：`closed`
- 下一阶段：第三十一阶段最终目录重构闭环审计

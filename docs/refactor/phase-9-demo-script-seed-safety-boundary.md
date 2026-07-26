# 第九阶段：Demo 脚本与 Seed 安全边界审核

- 日期：2026-07-26
- 分支：`refactor/demo-seed-safety-boundary-20260726-103153`
- 基线：`dc4bc53778c473ce34a1fd948e95c1a844275192`
- 审核候选：3 个
- Demo 脚本：1 个
- 数据库 Seed 入口：1 个
- Seed 安全守卫：1 个
- 高风险边界：2 个
- 中风险边界：1 个
- 本阶段执行 Seed：0 次
- 本阶段数据库连接：0 次
- 本阶段移动文件：0 个

## 审核结论

- 3 个候选均属于可执行脚本或数据库安全边界，不能按名称直接移动。
- Demo CLI 默认 `dry-run`，写入和清理需要显式参数及内部写入守卫。
- Demo CLI 当前允许带 Demo 标记的非 loopback 地址，安全策略比核心 Seed Guard 更宽。
- 数据库 Seed 入口在创建数据库 Client 前先执行核心 Seed Guard。
- 核心 Seed Guard 只允许 loopback、本地目标、固定人工确认和安全数据库名。
- 所有候选的 `move_now` 均为 `no`。
- 第五阶段 `audit_completed` 候选已归零。

## 安全策略对比

| 边界 | 默认行为 | 写入条件 | 数据库目标限制 | 当前结论 |
|---|---|---|---|---|
| Demo CLI | dry-run | `--apply` / `--cleanup` + `ZMTG_ALLOW_DEMO_SEED=1` | localhost 或带 Demo 标记 | 后续应统一收紧到核心守卫 |
| 数据库 Seed 入口 | 不直接运行时无写入 | 核心守卫通过后创建 Client | 由核心守卫决定 | 保持数据库入口位置 |
| Seed Guard | 纯校验 | target=local + 固定 confirmation | 仅 loopback 且数据库名安全 | 作为统一安全边界保留 |

## 逐文件审核

### `scripts/demo/seed-v06-low-sensitive-demo.ts`

- 分类：Demo脚本
- 执行角色：V0.6 低敏 Demo Seed CLI
- 边界分类：`guarded_demo_cli_boundary`
- 入口方式：`direct_cli_dry_run_default`
- 写入能力：`explicit_apply_or_cleanup`
- 守卫依赖：`internal_assertWriteGuards`
- 守卫顺序确认：yes
- 守卫策略：`broader_than_core_loopback_guard`
- 测试值导入数：1
- 候选链值导入数：0
- 风险：medium
- 当前结论：默认仅 dry-run；apply 或 cleanup 需要显式参数和写入守卫，但当前地址策略允许带 Demo 标记的非 loopback 主机，比核心 Seed Guard 更宽。
- 后续建议：保持 scripts/demo；后续统一接入核心 Seed Guard，收紧为 loopback、本地目标和人工确认三重条件。

### `src/server/db/seed-demo-data.ts`

- 分类：Seed入口
- 执行角色：正式数据库 Demo Seed 写入入口
- 边界分类：`guarded_database_seed_entry_boundary`
- 入口方式：`direct_database_seed_entry`
- 写入能力：`multi_table_upsert_and_legacy_cleanup`
- 守卫依赖：`seed_security_guard`
- 守卫顺序确认：yes
- 守卫策略：`core_loopback_guard`
- 测试值导入数：3
- 候选链值导入数：0
- 风险：high
- 当前结论：属于真实数据库写入入口；创建数据库 Client 前先调用核心守卫，并具有多表 upsert 与旧 Demo 数据清理能力。
- 后续建议：保持 src/server/db 数据库边界；禁止与普通 Demo 文件混合移动，后续变更必须独立安全审查。

### `src/server/db/seed-guard.ts`

- 分类：Seed守卫
- 执行角色：Demo Seed 环境与数据库目标安全守卫
- 边界分类：`seed_security_guard_boundary`
- 入口方式：`imported_security_guard`
- 写入能力：`environment_and_target_validation_only`
- 守卫依赖：`self_contained_guard`
- 守卫顺序确认：yes
- 守卫策略：`strict_loopback_explicit_confirmation`
- 测试值导入数：1
- 候选链值导入数：1
- 风险：high
- 当前结论：拒绝 production、staging、preview 和 test 等环境，要求 target=local、固定人工确认、loopback 主机及安全数据库名。
- 后续建议：保持数据库安全边界；所有 Demo Seed 写入入口应统一复用该守卫，不得复制更宽松的地址判断。

## 后续治理原则

1. 不执行 Seed 来证明边界，验证只能采用静态检查和依赖注入测试。
2. Demo CLI 后续应统一复用核心 Seed Guard，取消宽松的远程 Demo 标记放行。
3. 数据库 Seed 入口必须始终在创建 Client 前执行安全守卫。
4. Seed Guard 不得与普通 Demo 数据或测试 Fixture 混合移动。
5. 任何 Seed 写入、清理、Schema 或 Migration 变更必须单独授权。
6. 日志和错误信息不得输出数据库密码或完整连接串。

## 安全边界

- 未执行 Demo Seed 的 dry-run、apply 或 cleanup 命令。
- 未执行正式数据库 Seed。
- 未创建数据库 Client。
- 未执行 Migration。
- 未连接数据库、HIS、企业微信或服务器。
- 未读取或输出 `.env.local`、`DATABASE_URL` 或真实凭证。
- 未修改或移动脚本、Seed、守卫、测试、Schema 或依赖配置。

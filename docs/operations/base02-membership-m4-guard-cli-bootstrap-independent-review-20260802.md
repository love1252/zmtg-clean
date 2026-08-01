# BASE-02 Membership Revision M4 受控 Migration CLI 启动纠错独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查基线：PR #886 Merge Commit `3c96c60a9e27fb5fe2facba44d7b4914a1457182`
>
> 被审查纠错：PR #886，Head `1683fa8a88b52f33846987dd72419f8b2dac8e56`

## 1. 审查定位

本审查独立核对 M4 首次受控 Migration 在进入 PostgreSQL 前退出的根因，以及 PR #886 是否以
最小范围修复 `guarded-migrate` 的 CLI 启动边界。审查只读取仓库 diff、guard／测试契约、Drizzle
入口和既有低敏执行状态，不连接数据库，不运行 Migration，不创建恢复点或 Lease，也不执行第二次
M4 Migration。

M4 的 `0041` SQL、journal、Schema、数据库、Membership 数据和 transition evidence 均不在本纠错
范围。M5～M7、BASE-B1～B6、项目级 Writer／Audit／MIG-01B／C 与 Reader 继续阻断。

## 2. 首次尝试与回滚状态

首次 guarded `pnpm db:migrate` 尝试满足以下低敏事实：

- 执行 attempt 为 `1`，自动重试为 `0`；
- guard 已通过，Drizzle 子进程返回非零，但 PostgreSQL 在该 attempt 后没有记录 0041 执行错误；
- 环境 journal 仍停留在已消费 `0040`，`0041` 未消费；
- Membership all-null／complete／partial、transition、Binding、Scope、Context Version、Context Head、
  active historical orphan 与 Scope relation orphan 均与尝试前一致；
- Execution Lease 已消费并释放，当前无活动 Lease 或全局执行锁；
- 因此该尝试未形成数据库净变化，也未获得自动重试资格。

本审查不复述连接参数、私有路径、恢复点标识、Lease 标识或其他私有引用。

## 3. 根因归因

纠错前的 `guarded-migrate` 通过 `node_modules/.bin/drizzle-kit` shell shim 启动 CLI，并把调用者的
收窄环境原样传给子进程。该 shim 需要通过 shell `PATH` 解析辅助命令和 Node；收窄执行环境并不
保证这些隐式依赖，因此会在 Drizzle 配置与 PostgreSQL 连接前退出。

使用不连接数据库的相同参数族完成了固定状态对照：

| 启动方式 | `--version` | `migrate --help` |
|---|---:|---:|
| `.bin/drizzle-kit` shell shim | 失败 | 失败 |
| `process.execPath + drizzle-kit/bin.cjs` | 成功 | 成功 |

该结果只记录状态，不输出环境值或命令路径。0041 与 journal 一一对应；Drizzle 将 0041 解析为单一
SQL chunk，postgres-js 对无参数 unsafe query 使用 simple protocol。0040 也采用相同单 chunk
形态并已被环境消费。因此没有证据把本次数据库前失败归因于 0041 SQL、journal、metadata 或
Drizzle 的分号解析。

## 4. 纠错范围

PR #886 精确修改两个文件：

1. `scripts/db/guarded-migrate.mjs`；
2. `src/server/db/tests/MigrationGuard.test.ts`。

PR #886 已使用 Merge Commit 合并；两个父提交分别为冻结 Base
`29bedeab6a1b868a7aaaeaffd9a866fbcafab153` 与纠错 Head，Merge tree 与纠错 Head tree 精确一致。

纠错将启动契约改为：

- command 固定为当前 Node 进程 `process.execPath`；
- args 固定为仓库内 `node_modules/drizzle-kit/bin.cjs` 与 `migrate`；
- 继续使用 `shell: false`；
- 继续忽略子进程 stdin／stdout／stderr；
- 继续只返回固定低敏错误，不转发原始异常、堆栈、连接参数或凭证；
- 环境、工作目录与既有 guard 规则不放宽。

该修改消除了 shell shim 与 `PATH` 的隐式依赖，没有增加 Migration 绕过入口。local guard 对唯一
pending／exact current／target 的核对仍由执行 helper、恢复点和 Execution Lease 前置硬门承担；
本 PR 不扩大 guard 的职责。

## 5. 不变边界

以下范围的修改均为 `0`：

- `drizzle/0041_base02_membership_revision_legacy_calibration.sql`；
- `drizzle/meta/_journal.json` 与所有 snapshot；
- `src/server/db/schema.ts`；
- 其他 Runtime、测试、CI、package 与 lock；
- 数据库 Schema、Migration journal 和业务数据。

本纠错不构成第二次 Migration 执行、恢复点、Execution Lease、M5 或 Reader 授权。纠错合并后仍须
重新冻结最新 main 与固定 localhost-only local_acceptance，创建并验证全新恢复点，签发全新短期
不可续期 Execution Lease，并把后续执行明确记录为独立第二次 attempt；不得自动重试首次 attempt。

## 6. 验证证据

| 门禁 | 结果 |
|---|---|
| Migration Guard 定向测试 | `23／23` |
| 架构检查器自测 | `125／125` |
| 增量架构检查 | 通过 |
| lint | 0 error；4 条既有图片 warning |
| typecheck | 通过 |
| 完整测试 | 426 文件／6254 项通过 |
| build | 101／101 |
| `git diff --check` | 通过 |

真实 Required Check 绑定 PR #886 冻结 Head：Run `30719350111`／Job `91420402208` 成功；环境、
依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 均实际执行，build 未跳过且没有
`continue-on-error`。

## 7. 独立审查结论

```text
base02_membership_m4_guard_cli_bootstrap_review=passed
m4_first_attempts=1
m4_automatic_retries=0
m4_first_attempt_entered_postgresql=false
m4_first_attempt_database_net_change=0
m4_0041_consumed=false
m4_first_execution_lease_released=true
guard_fix_files=2
guard_shell_shim_dependency_removed=true
guard_shell_false_preserved=true
guard_child_output_suppressed=true
guard_sensitive_output=0
guard_fix_merge_commit_recorded=true
runtime_outside_guard_changes=0
schema_changes=0
migration_changes=0
database_changes=0
eligible_for_m4_guard_fix_merge=true
eligible_for_m4_execution_reprepare_after_merge=true
eligible_for_m4_second_execution=false
eligible_for_m5=false
eligible_for_reader=false
```

PR #886 对数据库前启动失败形成了可复现、低敏且范围收敛的根因修复；未发现需要修改 0041 或扩大
到其他 Runtime 的证据。只有 PR #886 与本审查均完成 Merge Commit、最新 main 和数据库状态重新
冻结、全新恢复点隔离恢复通过、全新 Execution Lease 有效后，才可把 M4 第二次执行从 `false`
提升为单次可执行；本审查本身不执行或授权该操作。

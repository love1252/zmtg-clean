# BASE-02 Membership Revision M4 `0041` 本地验收 Migration 执行低敏证据

## 1. 文档定位

- 任务：BASE-02 ULTRA Membership Revision M0～M7、BASE-B1～B6 全链实施。
- 当前切片：M4 deterministic legacy calibration 的第三次且仅一次受控 Migration。
- 日期与时区：`2026-08-02`，`Asia/Shanghai`。
- 执行 Base：`76a162005204efd74e6919541bd8cea9c72a0170`。
- 状态：`current low-sensitive execution evidence`。
- 当前结论：`base02_membership_revision_m4_local_acceptance_migration_validation=passed`。
- 后续准入：`eligible_for_m4_execution_independent_review=true`。

本文记录固定 localhost-only `local_acceptance` 环境已完成的第三次受控 Migration。本文不触发再次
执行，不完成 M4 handoff，也不授权 M5～M7、BASE-B1～B6、historical orphan 处置、A2-P2 外键
`VALIDATE`、项目级 Writer／Audit／MIG-01B／C 或业务 Reader。

本文不记录数据库真实标识符、连接参数、容器标识、Lease 标识、Holder、恢复点路径或摘要、原始
Catalog／SQL 行、tenant／institution 双引用、Membership／角色引用、凭证、Secret、Token、密码、
私钥或 PII。

## 2. 证据来源与归因边界

| 证据来源 | 本文采用的证明范围 | 不得扩大为 |
|---|---|---|
| 当前仓库 `0041`、journal、Schema 与测试 | M4 accepted 语义、DML allowlist、仓库 journal 与禁止项 | 环境已经执行 |
| PR #884～#889 及 Required Check | 实施、两轮纠错、静态审查和执行 Base 已交付 | 数据库终态 |
| 第三次 guarded `pnpm db:migrate` 与不可覆盖 marker | 本轮唯一受控调用、进程终态和自动重试为 `0` | 单独证明数据 Shape |
| 执行前后显式 `REPEATABLE READ + READ ONLY` 探针 | 环境 journal、完整 Catalog 指纹、Membership、A2 资产和 orphan 低敏终态 | 全库逐行等价 |
| 第二次恢复资产的隔离恢复 | 当前目标与既有获授权目标的稳定数据和完整 Catalog 连续性 | 公开数据库身份或额外环境授权 |
| 全新 Migration Lease 私有记录 | Base、前驱、`0041`、目标、恢复点、第三次 attempt 及 claim／consume／release 终态 | M5 或其他 Migration 授权 |
| PostgreSQL custom-format 恢复点工具 | 归档非空、parse、完整性与隔离恢复状态 | 对原目标执行 Restore |

所有数据库探针只输出固定状态码、布尔值和低敏聚合计数。guard、Migrator、备份和恢复工具的原始
stdout／stderr 均未进入对话、Git 或 PR。

## 3. Git、实施与纠错链冻结

| 项目 | 结果 |
|---|---|
| M4 实施 PR | #884，Head `c5ac1e9a3c9850886a1d9b2fae59dac8ee810df7` |
| M4 实施 Required Check | Run `30717337986`／Job `91415088190`，成功 |
| M4 实施 Merge Commit | `b59c4470af9473109fd7c499b26d9a8790df208e` |
| M4 实施独立审查 PR | #885，Head `a1e44e6c6e6f8f21bcf70c49ea4490ca187c1c25` |
| M4 实施审查 Required Check／Merge Commit | Run `30718064356`／Job `91417028339`，成功／`29bedeab6a1b868a7aaaeaffd9a866fbcafab153` |
| guard CLI 纠错 PR | #886，Head `1683fa8a88b52f33846987dd72419f8b2dac8e56` |
| guard CLI 纠错 Required Check／Merge Commit | Run `30719350111`／Job `91420402208`，成功／`3c96c60a9e27fb5fe2facba44d7b4914a1457182` |
| guard CLI 纠错独立审查 PR | #887，Head `4f88462b3777f4b7266cf4f4707f8aad05717fa0` |
| guard 审查 Required Check／Merge Commit | Run `30720044097`／Job `91422190231`，成功／`026ffe0cf78e593224ca63ce577b3a07d91db6d5` |
| `0041` 记录别名纠错 PR | #888，Head `35c0d224454e1e471db203591e2f18d211a3b18d` |
| 别名纠错 Required Check／Merge Commit | Run `30721169377`／Job `91425129494`，成功／`d446ff84497fbadd023e30f96225857cc805f731` |
| 别名纠错独立审查 PR | #889，Head `f53120c72e5298c7441d6384bd1cf673b1ceffcb` |
| 别名审查 Required Check／Merge Commit／执行 Base | Run `30721756897`／Job `91426580871`，成功／`76a162005204efd74e6919541bd8cea9c72a0170` |
| 工作树／并发仓库写入 | 干净／`0` |

第三次执行前，仓库 journal 与 SQL 文件集合为 `42／42`，最新为唯一 `0041`；snapshot 仍停留在
`0026`。环境 Applied Migration 为 `41／0040`，前驱 when 与 SQL hash 均和仓库 `0040` 精确一致，
因此唯一 pending 为 `0041`。

## 4. 三次尝试历史

历史不得因本轮成功而被覆盖：

1. 第一次 guarded 调用因 shell shim 启动边界失败，未进入 PostgreSQL；数据库、环境 journal 和
   业务数据净变化均为 `0`，Lease 已释放；
2. 第二次 guarded 调用进入 PostgreSQL 事务后因 PL/pgSQL 未赋值 record 与关系别名冲突失败；事务
   完整回滚，环境仍为 `41／0040`，Membership 仍为 `1／1／0／0`，transition 仍为 `0`，Lease 已
   释放；
3. PR #888／#889 在所有获授权环境均未消费 `0041` 的前提下完成原 Migration 原子纠错和独立
   审查；本轮用户随后明确授权第三次且仅一次执行。

本轮终态：

```text
target_guarded_migration_call_current=1
target_guarded_migration_call_cumulative=3
non_target_guard_bootstrap_rejection_post_execution=1
automatic_retry_count=0
first_and_second_failure_history_preserved=true
```

第三次执行不是自动重试：它使用最新 main、全新执行前恢复点、独立隔离恢复、全新唯一且不可续期
Lease，以及新的不可覆盖 attempt marker。

## 5. 第三次执行前硬门

| 硬门 | 执行前结果 |
|---|---:|
| 固定 localhost-only 目标 | 通过 |
| 与第二次获授权目标的恢复资产连续性 | digest、archive parse、隔离恢复、稳定数据和完整 Catalog 指纹均一致 |
| PostgreSQL major | `16` |
| 仓库 journal／SQL | `42／42`，最新 `0041` |
| snapshot | `0026`，未修改 |
| 环境 Applied Migration | `41／0040`，前驱 when／hash 精确一致 |
| 唯一 pending | `0041` |
| Membership total／all-null／partial／complete／transition | `1／1／0／0／0` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` |
| tenant／user parent 缺失 | `0／0` |
| active historical orphan／Scope relation orphan | `1／1` |
| A2-P2 Scope FK | `NOT VALID`／`convalidated=false` |
| 并发 client／冲突锁 | `0／0` |
| 既有活动 Lease／执行锁／隔离库 | `0／0／0` |

完整 Catalog 指纹覆盖列、类型、nullable、default、enum、约束、索引、trigger、rule、RLS、relation、
inheritance、函数及 A2-P2 Scope FK。新执行前恢复点完成后、Lease claim 后和 consume 前均重新运行
同口径只读冻结，结果未漂移。

## 6. 恢复点、Lease 与唯一入口

执行前和执行后各建立一份全新 PostgreSQL custom-format 恢复点，均满足：

- 私有根权限 `0700`，归档、Lease、marker 和低敏记录权限 `0600`；
- 归档非空、archive parse 与完整性校验通过；
- 恢复到随机隔离临时数据库后，同口径只读状态分别精确等于执行前和执行后目标；
- 隔离库已严格删除并确认不存在；
- 没有 Restore 原目标数据库。

加上既有第二次恢复资产用于目标连续性的独立隔离恢复，本窗口共完成 `3／3` 次隔离恢复验证；本轮
新建恢复点为 `2／2`。

全新 Lease 最长十分钟、不可续期，绑定当前任务、执行 Base、仓库 `42／0041`、环境 `41／0040`、
目标、执行前恢复点、第三次 attempt 和唯一 guarded 命令。终态：

```text
lease_claim=1
lease_consume=1
lease_renewal=0
lease_release=1
lease_active=0
```

唯一执行入口为 guarded `pnpm db:migrate`。本轮只调用 `1` 次，没有直接执行 `0041` SQL，没有修改
Guard、Migrator 或环境配置，没有第二次调用或自动重试。

## 7. 执行结果

```text
planned=1
created=1
reused=0
conflict=0
unexpected=0
planned=created+reused
```

guarded 命令正常退出，进程组已终止，Lease 仍在有效窗口；随后独立只读终态精确通过，先释放 Lease，
再建立并隔离恢复验证执行后恢复点。

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| 环境 Applied Migration | `41／0040` | `42／0041` | `+1` metadata |
| Membership total | `1` | `1` | `0` |
| all-null／partial／complete | `1／0／0` | `0／0／1` | `-1／0／+1` |
| transition evidence | `0` | `1` | `+1` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` | `1／1／1／1` | `0／0／0／0` |
| tenant／user parent 缺失 | `0／0` | `0／0` | `0／0` |
| active historical orphan／Scope relation orphan | `1／1` | `1／1` | `0／0` |
| Scope FK | `NOT VALID` | `NOT VALID` | 未 `VALIDATE` |

执行后唯一 Membership current 为 revision `1`、lifecycle `active`、source／reason 为
`legacy_calibration／legacy_unknown`；actor 与 occurred-at 为空，recorded-at 已建立。它与恰好一条
revision `1` baseline transition 在同一事务原子形成。Membership identity、tenant／user 归属、role、
display name、created-at 与 updated-at 的稳定指纹未变化。

`0041` 的业务 DML 精确为对 `tenant_members` 更新 `1` 行、向
`tenant_membership_transitions` 插入 `1` 行；Binding、Scope、Context 和其他业务表写入为 `0`。

## 8. 清理与低敏边界

| 项目 | 结果 |
|---|---:|
| Migration client／进程组 | 已退出，残留 `0` |
| Lease／run lock | 已释放／已删除，活动残留 `0` |
| attempt marker | terminal 形成后已删除，残留 `0` |
| 不可覆盖 terminal record | 保留 `1` |
| 执行 Helper | 已删除，残留 `0` |
| 隔离数据库 | 全部删除，残留 `0` |
| 当前执行窗口新增自动运维元数据回显事件 | `0` |
| 历史本地运维元数据回显事件 | `1`，只保留事件计数 |
| 当前主动私有参数披露 | `0` |
| Secret／Token／密码／私钥／PII／真实凭证披露 | `0` |
| 非 localhost 连接 | `0` |

历史事件只涉及仓库脚本的本地默认运维参数自动回显；本文不复述任何具体值。Approved Manifest、
恢复资产或其他私有资产无需因此撤销或轮换。

### 8.1 执行后 PR 描述维护事件

真实质量门禁首次成功后，更新 PR 描述的本地 shell 引号处理发生错误，命令解释器误触发一次**不带
目标参数**的 Migration Guard 启动。Guard 在要求 `ZMTG_DB_MIGRATION_TARGET` 的第一道门禁即拒绝，
发生在读取 `DATABASE_URL`、解析数据库目标、连接 PostgreSQL、创建或消费 Lease、调用 Migrator
之前。低敏只读代码核验与工作树核验确认：

```text
post_execution_guard_bootstrap_rejection=1
target_selected=0
database_url_read=0
database_connection=0
lease_claim_consume=0/0
migrator_spawn=0
sql_ddl_dml=0/0/0
repository_change=0
database_change=0
```

该事件不是固定 `local_acceptance` 目标的 Migration 执行，不属于第三次目标调用的自动重试，也不
改变 `guarded_migration_call_cumulative=3` 的目标执行计数。受损 PR 描述已立即纠正；事件永久保留
在本证据中，交由独立审查确认。本文不复述 shell 输出中的本地路径或任何具体运维参数。

## 9. 零越界与后续边界

| 禁止项 | 结果 |
|---|---:|
| 直接 SQL／第二次目标 Migration 调用／自动重试 | `0／0／0` |
| 执行后非目标 Guard 启动拒绝 | `1`，数据库连接和数据库变化均为 `0` |
| Schema／Migration／journal／snapshot 仓库修改 | `0／0／0／0` |
| `db:generate`／Seed／回填／额外 DDL／额外 DML | `0／0／0／0／0` |
| FK `VALIDATE`／`SET NOT NULL` | `0／0` |
| 本执行窗口及本证据 PR 的 Runtime／scripts／tests／CI／package／lock 修改 | `0` |
| M5～M7／BASE-B1～B6 | 未启动 |
| 项目级 Writer／Audit／MIG-01B／C／业务 Reader | 未启动 |

`0041` 已被固定获授权环境消费，后续不得改写该 SQL 或 journal；如发现新问题，只能通过独立
forward-fix 处理。

## 10. 结论

```text
base02_membership_revision_m4_local_acceptance_migration_validation=passed
m4_migration=0041
m4_environment_journal_entries=42
m4_current_envelope_complete=1
m4_baseline_transition_count=1
m4_planned=1
m4_created=1
m4_reused=0
m4_conflict=0
m4_unexpected=0
m4_target_guarded_migration_calls_cumulative=3
m4_automatic_retry_count=0
m4_post_execution_guard_bootstrap_rejection=1
m4_lease_active=false
m4_outcome_known=true
eligible_for_m4_execution_independent_review=true
eligible_for_m4_handoff=false
eligible_for_m5=false
eligible_for_reader=false
```

下一步只能由独立审查冻结本证据 Head，核对三次尝试历史、最新 main、环境 journal、完整 Catalog、
数据不变量、恢复点、Lease、清理和低敏边界。本证据本身不完成 M4，也不授权 M5。

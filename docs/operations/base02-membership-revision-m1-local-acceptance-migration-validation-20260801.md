# BASE-02 Membership Revision M1 `0040` 本地验收 Migration 执行低敏证据

## 1. 文档定位

- 任务：BASE-02 ULTRA Membership Revision M0～M7、BASE-B1～B6 全链实施。
- 当前切片：M1 Expand 的纠错后第二次受控 Migration。
- 日期与时区：`2026-08-01`，`Asia/Shanghai`。
- 执行 Base：`781fde457c38a28dc9fd8f4d8e05bd16198f46db`。
- 状态：`current low-sensitive execution evidence`。
- 当前结论：`base02_membership_revision_m1_local_acceptance_migration_validation=passed`。
- 后续准入：`eligible_for_m1_execution_independent_review=true`。

本文记录固定 localhost-only `local_acceptance` 环境已经完成的一次纠错后受控
Migration。本文不触发再次执行，不完成 M1 handoff，也不授权 M2～M7、BASE-B1～B6、
historical orphan 处置、A2-P2 外键 `VALIDATE`、项目级 Writer 或业务 Reader。

本文不记录数据库真实标识符、连接参数、容器标识、Lease 标识、Holder、恢复点路径、hash、
原始 Catalog／SQL 行、tenant／institution 双引用、凭证、Secret、Token、密码、私钥或 PII。

## 2. 证据来源与归因边界

| 证据来源 | 本文采用的证明范围 | 不得扩大为 |
|---|---|---|
| 当前仓库 `0040`、Schema、journal 与测试 | M1 目标定义、仓库 journal、禁止项与回归边界 | 环境已经执行 |
| PR #869、#871、#872、#873 与 Required Check | M1 实现、首轮审查、原子纠错和纠错复审已交付 | 数据库终态 |
| guarded `pnpm db:migrate` 与不可覆盖 marker | 本轮唯一 Migration 调用、进程结果和无自动重试 | 单独证明 Catalog 或数据 Shape |
| 执行前后显式 `READ ONLY` 白名单探针 | 环境 journal、Catalog、A2-P1、Membership／Binding 与 orphan 低敏计数 | 全库逐行等价 |
| 全新 Migration Lease 私有记录 | Base、journal、目标 Migration、唯一授权及 claim／consume／release 终态 | M2 或后续 Migration 授权 |
| PostgreSQL custom-format 恢复点工具 | 归档非空、parse、完整性与隔离恢复状态 | 对原目标执行 Restore |

所有数据库探针均在显式 `REPEATABLE READ + READ ONLY` 事务中执行，只输出固定状态码、
布尔值和低敏聚合计数。

## 3. Git 与纠错链冻结

| 项目 | 结果 |
|---|---|
| M1 实施 PR／Merge Commit | #869／`314af071bb180ce0a1095c5d21f31baa3cc15e4a` |
| M1 首轮实施审查 PR／Merge Commit | #871／`eb71d2ab628032ef39182a96ea0b82f89b6dd49e` |
| `0040` 原子纠错 PR | #872，Head `fea420a03f793a8aeb1d33f1cfacbe914ce21423` |
| 纠错 Required Check | Run `30703279028`／Job `91377908764`，成功 |
| 纠错 Merge Commit | `75f3c6663e7decce63634b1ee05579a454fb97ac` |
| 纠错独立审查 PR | #873，最终 Head `cb600fb3ea9c15f84f920c57af6e75a0b6487bcb` |
| 纠错审查 Required Check | Run `30703993626`／Job `91379807583`，成功 |
| 纠错审查 Merge Commit／执行 Base | `781fde457c38a28dc9fd8f4d8e05bd16198f46db` |
| 工作树／并发仓库写入 | 干净／`0` |

PR #872 只在尚未被允许环境消费的 `0040` 中增加三处显式 `enumlabel::text`，并补充精确
回归测试；没有修改 journal、Schema 声明、snapshot 或其他 Migration，也没有创建 `0041`。

## 4. 完整尝试历史

首轮数据库尝试的历史永久保留：

- 首轮实际数据库 Migration 尝试为 `1`；自动重试为 `0`；
- 首轮因 PostgreSQL `name[] = text[]` 类型比较失败；
- 显式只读终态证明事务完整回滚，环境 journal 仍为 `40`、M1 Catalog 仍为
  `all_missing`，业务数据净变化为 `0`；
- 首轮 Lease 已完成 `claim／consume／release=1／1／1`，活动 Lease 为 `0`；
- PR #872／#873 只修正并审查未消费的原 Migration，不抹去首轮失败。

纠错后第二次执行前，私有 Helper 曾因模块导入错误在模块实例化阶段拒绝 `1` 次。该拒绝发生在
目标发现、只读探针、恢复点、Lease、marker 和数据库命令之前，因此新增数据库 attempt 为 `0`；
修正私有 Helper 后重新通过静态语法、freshness gate 和独立安全复核。

本轮获授权的数据库执行结果为：

```text
current_authorized_database_attempt=1
actual_database_attempt_cumulative=2
automatic_retry_count=0
first_failure_history_preserved=true
```

第二次执行使用全新恢复点、全新唯一 Lease 和全新 attempt marker，不是自动重试。

## 5. 第二次执行前硬门

| 硬门 | 执行前结果 |
|---|---:|
| 固定 localhost-only 目标与精确环境身份 | 通过 |
| 仓库 journal／SQL 文件集合 | `41／41`，最新为 `0040` |
| snapshot | 仍为 `0026` |
| 环境 Applied Migration | `40`，前序 when／hash 与仓库 `0039` 精确一致 |
| 唯一 pending Migration | `0040`，数量 `1` |
| M1 Catalog | `all_missing` |
| A2-P1 Scope／Context Version／Context Head | `1／1／1` |
| Membership／Binding | `1／1` |
| Binding NULL／重复 | `0／0` |
| Scope relation orphan／active historical orphan | `1／1` |
| A2-P2 索引／`NOT VALID` FK | 精确定义一致／`convalidated=false` |
| 完整 envelope／transition evidence 行 | `0／0` |
| 并发 Migration 执行者／Writer | `0／0` |
| 私有执行资产 freshness | 全部不存在；通过不可覆盖创建 |

执行前在生成恢复点后、签发 Lease 前再次运行相同只读冻结，所有硬门仍一致。不存在部分 M1
对象、同名异定义或未解释漂移。

## 6. 全新执行前恢复点

执行前恢复点满足：

- PostgreSQL custom format；
- 私有根权限 `0700`，Helper、记录、marker 与归档权限 `0600`；
- 归档非空、archive parse 和完整性校验通过；
- 已恢复到随机隔离临时数据库；
- 隔离恢复库的环境 journal `40`、M1 `all_missing`、A2-P1、Membership／Binding 与
  orphan 低敏状态精确一致；
- 隔离恢复库已删除，没有 Restore 原目标数据库。

## 7. 全新 Migration Lease 与唯一执行

全新 Lease 精确绑定当前任务、执行 Base、仓库 journal `41`、环境 journal `40`、唯一 pending
`0040`、固定本地目标和不可覆盖 attempt marker。Lease 最长十分钟、不可续期；Migration 子进程
最长五分钟，执行前和完成前均复核有效期。

终态如下：

```text
lease_claim=1
lease_consume=1
lease_renewal=0
lease_release=1
lease_active=0
lease_consumed=true
lease_released=true
```

执行入口且仅有：

```text
guarded pnpm db:migrate
```

本轮调用 `1` 次，退出成功；没有直接执行 `0040` SQL，没有自动重试，没有创建 `0041`。纠错前
首轮失败和本轮成功合计实际数据库尝试 `2` 次，自动重试始终为 `0`。

## 8. 执行后 Journal 与 Catalog

| 状态／对象类别 | 执行后结果 |
|---|---:|
| 环境 Applied Migration | `41` |
| 环境最新项 | when／hash 与仓库当前 `0040` 精确一致 |
| pending Migration | `0` |
| M1 Catalog | `all_exact` |
| enum | `3` |
| `tenant_members` current envelope 新列 | `10` |
| `tenant_members` 新约束 | `2` |
| transition table | `1` |
| transition 列 | `16` |
| transition 约束 | `8` |
| transition 显式普通索引 | `1` |
| append-only trigger function | `1` |
| append-only trigger | `2` |

独立只读终态不仅核对名称和数量，还核对 enum labels、列类型／长度／nullable／default、
PK／FK／UNIQUE 键序与动作、CHECK 关键语义、索引列序与属性、function 属性／函数体、trigger
函数／事件／状态及 table persistence。Migration 自身在单一事务提交前执行同一 accepted Shape 的
完整 postcheck；部分对象、同名异定义或定义漂移均 fail-closed。

上述对象类型异质，当前 M1 没有已冻结的统一 `planned／created／reused` 相加口径，因此本文按
类别记录，不虚构单一对象总数。

## 9. 数据与 metadata 不变量

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| 环境 Applied Migration | `40` | `41` | `+1` metadata |
| Membership | `1` | `1` | `0` |
| Binding | `1` | `1` | `0` |
| A2-P1 Scope／Context Version／Context Head | `1／1／1` | `1／1／1` | `0／0／0` |
| 完整 current envelope 行 | `0` | `0` | `0` |
| transition evidence 行 | `0` | `0` | `0` |
| Scope relation orphan | `1` | `1` | `0` |
| active historical orphan | `1` | `1` | `0` |
| 业务 DML | `0` | `0` | `0` |

准确口径是：环境 Migrator journal metadata 增加 `1`；仓库 journal 在执行前已经是 `41`，不归因
于数据库执行。legacy Membership 继续保持 all-null，M1 只完成 Expand，不执行 calibration；
historical orphan 未处理，A2-P2 外键继续保持 `NOT VALID`。

## 10. 执行后恢复点与私有资产清理

执行后新恢复点再次满足 custom archive 非空、parse、完整性和随机隔离恢复验证；隔离恢复库确认
环境 journal `41`、M1 `all_exact`、数据不变量与 orphan 状态一致后已删除。没有 Restore 原目标。

| 项目 | 结果 |
|---|---:|
| 执行前／后恢复点 | 均通过 archive、parse、完整性、隔离恢复和隔离目标清理 |
| Lease | inactive／consumed／released |
| attempt marker | 已删除，残留 `0` |
| run lock | 已删除，残留 `0` |
| 不可覆盖 completion marker | 保留 `1`，阻断误调用覆盖成功证据 |
| 私有 Helper | 已删除，残留 `0` |
| 低敏执行记录与恢复点 | 按治理保留 |
| 执行结果 | `outcomeKnown=true` |

## 11. 低敏与零越界

| 类别 | 数量／结果 |
|---|---:|
| 本恢复阶段自动本地运维元数据回显事件 | `2` |
| 当前主动私有参数披露 | `0` |
| Secret／Token／密码／私钥／PII／真实凭证披露 | `0` |
| 非 localhost 连接 | `0` |
| 直接 SQL／第二次本轮 Migration 调用 | `0／0` |
| Seed／业务 DML／回填 | `0／0／0` |
| `VALIDATE`／`SET NOT NULL`／snapshot／`db:generate` | `0／0／0／0` |
| M2～M7／BASE-B1～B6 | 未启动 |

两次事件只累计次数，不在本文复述具体值；它们只涉及本地运维元数据，不含真正敏感信息或非本地
连接信息。当前主动输出严格限制为固定状态码、布尔值和低敏计数。

## 12. 结论与下一步边界

```text
base02_membership_revision_m1_local_acceptance_migration_validation=passed
m1_expand_migration_executed=true
m1_environment_journal_entries=41
m1_catalog_state=all_exact
m1_first_failure_history_preserved=true
m1_database_attempt_cumulative=2
m1_automatic_retry_count=0
eligible_for_m1_execution_independent_review=true
eligible_for_m1_handoff=false
eligible_for_m2=false
```

`0040` 已被本任务唯一允许的固定本地验收环境消费，后续不得再改写该 SQL 或 journal；如发现新
问题，只能建立独立 forward-fix。下一步只能由独立审查冻结本证据 Head，核对完整尝试历史、
环境 journal、精确 Catalog、数据不变量、Lease、恢复点和低敏边界。本证据本身不完成 M1，也
不授权 M2。

# BASE-02 Membership Revision M4 本地验收 Migration 执行独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查基线：`167e1193e474237e5a612a7df9860adcad8b7e8c`
>
> 被审查 PR：#890
>
> 被审查 Head：`90ca634ced30c7386d5c0a3c5338fda5df6bd911`
>
> Required Check：Run `30725188721`／Job `91435449482`，成功
>
> 被审查 Merge Commit：`167e1193e474237e5a612a7df9860adcad8b7e8c`

## 1. 审查定位

本审查独立核对 Membership Revision M4 `0041` 的三次目标执行历史、第三次且仅一次授权执行终态、
Journal、数据不变量、恢复点、Lease、清理和低敏边界，并审查执行后 PR 描述维护期间发生的一次
**无目标 Guard 启动拒绝**，判断 M4 是否具备进入最终 handoff 的条件。

审查只读取已合并仓库证据、Git／GitHub 证据、Migration Guard 静态控制流和既有低敏终态记录；
不连接数据库，不运行 Migration、Runner、DDL、DML、Restore 或新探针，不创建或消费 Lease，
也不启动 M5。

本文不记录数据库真实标识符、连接参数、私有路径、Lease 标识、Holder、恢复点路径或摘要、原始
Catalog／SQL 行、tenant／institution 双引用、Membership／角色引用、凭证、Secret、Token、密码、
私钥或 PII。

## 2. 被审查交付冻结

PR #890 相对 Base `76a162005204efd74e6919541bd8cea9c72a0170` 精确为 1 个提交、1 个文件：

`docs/operations/base02-membership-revision-m4-local-acceptance-migration-validation-20260802.md`

冻结结果：

| 项目 | 结果 |
|---|---|
| PR #890 最终 Head | `90ca634ced30c7386d5c0a3c5338fda5df6bd911` |
| 证据 blob | `33cc3e69dd0c5d7a51509b9b0391766ee5af76cb` |
| 提交／文件 | `1／1` |
| Required Check | Run `30725188721`／Job `91435449482`，成功 |
| 评论／Review／未解决 thread | `0／0／0` |
| Merge Commit | `167e1193e474237e5a612a7df9860adcad8b7e8c` |
| Merge 父提交 | 被审查 Base 与被审查 Head |
| Merge tree | 与被审查 Head tree 完全一致 |

PR #890 只纳入低敏执行证据；Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、
package 与 lock 修改均为 0。环境核对、依赖安装、架构检查器自测、增量架构检查、lint、typecheck、
完整测试和 build 均在冻结 Head 上实际执行并成功，build 未跳过。

## 3. 证据来源与归因限制

| 证据 | 可证明 | 不得扩大为 |
|---|---|---|
| 已消费 `0041`、Schema 与测试 | accepted 数据校准语义、目标行和禁止项 | 单独证明数据库终态 |
| PR #884～#889 | 实施、两轮纠错、静态审查和执行 Base | 第三次执行已成功 |
| PR #890 低敏证据 | 执行编排器记录的前后状态、恢复点、Lease 与清理终态 | 全库逐行等价 |
| 执行前后只读探针 | Journal、完整 Catalog 指纹、Membership、A2 资产与 orphan 聚合终态 | 公开数据库身份 |
| 恢复点隔离恢复 | 获授权目标连续性与执行前后恢复资产可恢复 | 对原目标执行 Restore |
| Guard 静态控制流与测试 | 无目标参数时在读取连接参数和启动 Migrator 前拒绝 | 证明其他任意命令均安全 |
| Git／GitHub | 文件范围、Head、Run、Merge 与 tree 一致性 | 数据库业务事实 |

## 4. 实施、纠错与审查链

| 阶段 | PR／Head | Run／Job | Merge Commit |
|---|---|---|---|
| M4 实施 | #884／`c5ac1e9a3c9850886a1d9b2fae59dac8ee810df7` | `30717337986`／`91415088190` | `b59c4470af9473109fd7c499b26d9a8790df208e` |
| 实施独立审查 | #885／`a1e44e6c6e6f8f21bcf70c49ea4490ca187c1c25` | `30718064356`／`91417028339` | `29bedeab6a1b868a7aaaeaffd9a866fbcafab153` |
| Guard CLI 纠错 | #886／`1683fa8a88b52f33846987dd72419f8b2dac8e56` | `30719350111`／`91420402208` | `3c96c60a9e27fb5fe2facba44d7b4914a1457182` |
| Guard 纠错审查 | #887／`4f88462b3777f4b7266cf4f4707f8aad05717fa0` | `30720044097`／`91422190231` | `026ffe0cf78e593224ca63ce577b3a07d91db6d5` |
| `0041` record／relation alias 纠错 | #888／`35c0d224454e1e471db203591e2f18d211a3b18d` | `30721169377`／`91425129494` | `d446ff84497fbadd023e30f96225857cc805f731` |
| alias 纠错独立审查 | #889／`f53120c72e5298c7441d6384bd1cf673b1ceffcb` | `30721756897`／`91426580871` | `76a162005204efd74e6919541bd8cea9c72a0170` |
| 第三次执行低敏证据 | #890／`90ca634ced30c7386d5c0a3c5338fda5df6bd911` | `30725188721`／`91435449482` | `167e1193e474237e5a612a7df9860adcad8b7e8c` |

全部 Required Check 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 均成功。

## 5. 三次目标执行历史与授权边界

历史没有因第三次成功而被覆盖：

1. 第一次目标 guarded 调用因 shell shim 启动边界失败，未进入 PostgreSQL；数据库、环境 journal、
   Membership 和业务数据净变化均为 0，Lease 已释放；
2. 第二次目标 guarded 调用进入 PostgreSQL 事务后因 PL/pgSQL record 未赋值与关系别名冲突失败；
   事务完整回滚，环境仍为 `41／0040`，Membership 仍为 `1／1／0／0`，transition 仍为 0，Lease
   已释放；
3. PR #888／#889 在所有获授权环境均未消费 `0041` 的前提下完成原 Migration 原子纠错与独立
   审查；用户随后明确授权使用最新 main、全新恢复点和全新 Lease 进行第三次且仅一次目标执行。

目标执行终态：

```text
target_guarded_migration_call_current=1
target_guarded_migration_call_cumulative=3
automatic_retry_count=0
first_and_second_failure_history_preserved=true
```

第三次执行不是自动重试，没有直接执行 SQL，也没有第二次本轮目标调用。

## 6. 第三次执行状态机

审查确认执行顺序为：

```text
最新 main 与目标连续性冻结
→ 全新执行前恢复点
→ 隔离恢复验证
→ 全新唯一不可续期 Lease claim
→ consume 前完整只读重检
→ 一次 guarded pnpm db:migrate
→ 精确只读终态
→ release Lease
→ 全新执行后恢复点
→ 隔离恢复验证
→ terminal evidence
```

成功计数精确为：

```text
planned=1
created=1
reused=0
conflict=0
unexpected=0
planned=created+reused
```

guarded 命令正常退出，进程组终止且执行结果已知；没有 retry 分支。

## 7. Journal、数据 Shape 与原子 current／evidence

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| 环境 Applied Migration | `41／0040` | `42／0041` | `+1` metadata |
| Membership total | `1` | `1` | `0` |
| all-null／partial／complete | `1／0／0` | `0／0／1` | `-1／0／+1` |
| baseline transition | `0` | `1` | `+1` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` | `1／1／1／1` | `0／0／0／0` |
| tenant／user parent 缺失 | `0／0` | `0／0` | `0／0` |
| active historical orphan／Scope relation orphan | `1／1` | `1／1` | `0／0` |
| Scope FK | `NOT VALID` | `NOT VALID` | 未 `VALIDATE` |

唯一 Membership current 形成 revision 1、active lifecycle 和 legacy calibration provenance，并与唯一
baseline transition 在同一事务原子形成。Membership identity、tenant／user 归属、role、display name、
created-at、updated-at 稳定指纹未改变。目标业务 DML 仅为 Membership update 1 行和 transition insert
1 行；Binding、Scope、Context 与其他业务表写入为 0。完整 Catalog 指纹前后相同。

## 8. 恢复点、Lease 与终态清理

- 既有第二次恢复资产用于目标连续性的隔离恢复：`1／1`；
- 全新执行前恢复点及隔离恢复：`1／1`；
- 全新执行后恢复点及隔离恢复：`1／1`；
- 本窗口隔离恢复合计：`3／3`，原目标 Restore 为 0；
- 新恢复点：`2／2`，均完成非空、parse、完整性和随机隔离恢复；
- 全新 Lease `claim／consume／renewal／release／active=1／1／0／1／0`；
- Migration client、进程组、Lease lock、run lock、attempt marker、Helper 和隔离数据库残留均为 0；
- 不可覆盖 terminal record 保留 1，执行结果为已知。

`0041` 已由固定获授权环境消费，后续不得改写 SQL 或 journal；新问题只能使用独立 forward-fix。

## 9. 执行后无目标 Guard 启动拒绝审查

PR #890 首轮 Required Check 成功后，更新 PR 描述的本地 shell 引号处理发生错误，命令解释器误触发
一次不带目标参数的 Guard 启动。该事件没有被隐藏，已纳入被审查证据。

静态控制流核验：`assertMigrationAllowed` 首先要求 `ZMTG_DB_MIGRATION_TARGET`，下一步才访问
`DATABASE_URL`；只有 `assertMigrationAllowed` 成功返回后才会 spawn Migrator。既有 Guard 测试也锁定
空环境先因目标参数缺失而拒绝。因此本事件终态为：

```text
non_target_guard_bootstrap_rejection=1
target_selected=0
database_url_read=0
database_connection=0
lease_claim=0
lease_consume=0
migrator_spawn=0
sql_ddl_dml=0/0/0
repository_change=0
database_change=0
fourth_target_migration_started=false
```

该事件是执行完成后的本地 PR 维护缺陷，不是固定目标 Migration、第四次数据库 attempt 或第三次
目标执行的自动重试。目标执行累计仍为 3，自动重试仍为 0。受损 PR 描述已立即纠正，证据 Head
重写后由新的完整 Required Check 验证成功。

## 10. 低敏、零越界与后续边界

| 边界 | 结果 |
|---|---:|
| 当前主动私有参数披露 | `0` |
| Secret／Token／密码／私钥／PII／真实凭证披露 | `0` |
| 非 localhost 连接 | `0` |
| 直接 SQL／第二次本轮目标调用／自动重试 | `0／0／0` |
| Schema／Migration／journal／snapshot 仓库修改 | `0／0／0／0` |
| `db:generate`／Seed／额外 DDL／额外 DML | `0／0／0／0` |
| FK `VALIDATE`／`SET NOT NULL` | `0／0` |
| M5～M7／BASE-B1～B6 | 未启动 |
| 项目级 Writer／Audit／MIG-01B／C／业务 Reader | 未启动 |

本文不复述历史自动本地运维元数据回显的具体值，也不复述执行后维护事件的本地 shell 输出。

## 11. 发现项与资格边界

- `F01`：执行后无目标 Guard 启动拒绝。归因、控制流和零影响证据完整，结论为 `closed`；该发现不
  改变第三次目标执行终态，但必须在 handoff 中保留低敏事实；
- 没有发现 Journal、Membership、A2 资产、orphan、Scope FK、恢复点、Lease 或清理终态矛盾；
- `eligible_for_m4_handoff=true` 只允许进入 M4 最终 handoff，不授权 M5；
- historical orphan `1／1` 与 Scope FK `NOT VALID` 继续阻断后续 Enforce／Reader；
- M6 前既有 Auth Reader 仍兼容 `updated_at`，M4 没有提前切换 Reader。

## 12. 独立审查结论

```text
base02_membership_revision_m4_execution_review=passed
m4_execution_complete=true
m4_handoff_complete=false
m4_migration=0041
m4_outcome_known=true
m4_environment_journal_entries=42
m4_current_envelope_complete=1
m4_baseline_transition_count=1
m4_target_guarded_migration_calls_cumulative=3
m4_automatic_retry_count=0
m4_post_execution_guard_bootstrap_rejection_review=passed
m4_non_target_guard_bootstrap_rejections=1
m4_fourth_target_migration_started=false
m4_post_execution_database_url_read=0
m4_post_execution_database_connection=0
m4_post_execution_lease_claim_consume=0/0
m4_post_execution_migrator_spawn=0
m4_active_historical_orphan=1
m4_scope_relation_orphan=1
m4_scope_fk_validated=false
eligible_for_m4_handoff=true
eligible_for_m5=false
eligible_for_base_b1_runtime=false
eligible_for_reader=false
```

PR #890 的低敏证据与仓库、GitHub、恢复点、Lease 和既有低敏终态记录相互一致，能够证明 M4
`0041` 已在唯一允许环境完成第三次且仅一次授权目标执行，并保持 A2 资产、orphan、未验证外键和
后续阶段边界不变。M4 可以进入最终 handoff；M5 尚未启动，也未由本审查授权。

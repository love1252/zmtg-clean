# BASE-02 Membership Revision M5 `0042` 本地验收 Migration 执行低敏证据

## 1. 文档定位

- 任务：BASE-02 ULTRA Membership Revision M0～M7、BASE-B1～B6 全链实施。
- 当前切片：M5 高水位追赶与冲突清零的受控 Migration。
- 日期与时区：`2026-08-02`，`Asia/Shanghai`。
- 执行 Base：`33c52ee41e20385e8541594fa92b4c5c6ce21cf9`。
- 状态：`current low-sensitive execution evidence`。
- 当前结论：`base02_membership_revision_m5_local_acceptance_migration_validation=passed`。
- 后续准入：`eligible_for_m5_execution_independent_review=true`。

本文记录固定 localhost-only `local_acceptance` 环境已完成的 M5 `0042` 单次受控 Migration。本文
不再次运行 Migration，不完成 M5 handoff，也不授权 M6、M7、BASE-B1～B6、historical orphan
处置、A2-P2 外键 `VALIDATE`、项目级 Writer／Audit／MIG-01B／C 或业务 Reader。

本文不记录数据库真实标识符、连接参数、容器标识、Lease 标识、Holder、恢复点路径或摘要、原始
Catalog／SQL 行、tenant／institution 双引用、Membership／角色引用、凭证、Secret、Token、密码、
私钥或 PII。

## 2. 证据来源与归因边界

| 证据来源 | 本文采用的证明范围 | 不得扩大为 |
|---|---|---|
| 当前仓库 `0042`、journal、Schema 与测试 | M5 accepted 语义、稳定高水位、DML allowlist 和禁止项 | 环境已经执行 |
| PR #893／#894 及 Required Check | M5 实施和实施独立审查已交付 | 数据库终态 |
| guarded `pnpm db:migrate` 与不可覆盖 terminal record | 唯一目标调用、退出终态、调用次数和自动重试为 `0` | 单独证明数据 Shape |
| 执行前后 `REPEATABLE READ + READ ONLY` 探针 | 环境 journal、Catalog、Membership、A2 资产和 orphan 聚合终态 | 全库逐行等价 |
| 关键业务表执行前后私有稳定指纹 | 受影响表与只读依赖的稳定内容未变化 | 公开行值或摘要 |
| 全新 Execution Lease 私有记录 | Base、前驱、`0042`、恢复点、单次 attempt 和终态 | M6 或其他 Migration 授权 |
| PostgreSQL custom-format 恢复点工具 | 归档非空、parse、完整性和隔离恢复状态 | 对原目标执行 Restore |

数据库探针、恢复工具和执行编排器只对外输出固定状态码、布尔值与低敏计数。Migration 子进程的
stdout／stderr 被编排器内部捕获，没有进入对话、Git 或 PR。

## 3. Git 与实施链冻结

| 项目 | 结果 |
|---|---|
| M5 实施 PR | #893，Head `43440e3f38c3c6ba3576dba1788b3fad586cfb5a` |
| M5 实施 Required Check | Run `30727616873`／Job `91442118293`，成功 |
| M5 实施 Merge Commit | `72c7568df3fd1078b813733eda472c01b0f8672d` |
| M5 实施独立审查 PR | #894，Head `14c7e6e4419203dacd5d20b3bec2b3d8bc43c285` |
| M5 实施审查 Required Check | Run `30728269902`／Job `91443866416`，成功 |
| M5 实施审查 Merge Commit／执行 Base | `33c52ee41e20385e8541594fa92b4c5c6ce21cf9` |
| 实施文件范围 | `0042` SQL、journal、Schema 测试，精确 3 文件 |
| 工作树／并发仓库写入 | 干净／`0` |

执行 Base 上仓库 journal 与 SQL 文件集合为 `43／43`，最新 idx 为 `42`；snapshot 仍停留在
`0026`。环境 Applied Migration 为 `42／0041`，前驱时间与 SQL 指纹和仓库前缀逐项一致，唯一
pending 为 `0042`。

## 4. `0042` 实施边界

M5 使用稳定 `(created_at, id COLLATE "C")` 高水位，只处理执行前 current envelope 全空的
Membership。每个候选在同一事务内先形成 revision `1` current，再形成匹配的 immutable transition
evidence，并在提交前重新核验完整 Catalog、数据 Shape、parent、identity、duplicate、orphan 和
journal。

仓库静态边界为：

- 唯一业务 `UPDATE` 目标是 `tenant_members`；
- 唯一业务 `INSERT` 目标是 `tenant_membership_transitions`；
- 禁止 `DELETE`、`TRUNCATE`、回填其他表、`VALIDATE`、`SET NOT NULL`、`DROP` 和第三个对象；
- 零候选是合法成功分支，必须仍完成事务内全部前后检查；
- `planned = created + reused`，且 `conflict = unexpected = 0` 才允许提交。

## 5. 执行前动态硬门

| 硬门 | 执行前结果 |
|---|---:|
| 固定 localhost-only 目标 | 通过 |
| PostgreSQL major／事务模式 | `16`／`REPEATABLE READ + READ ONLY` |
| 仓库 journal／SQL／latest | `43／43／0042` |
| 环境 Applied Migration／唯一 pending | `42／0041`／`0042` |
| journal 全前缀时间与 SQL 指纹 | 精确一致 |
| snapshot | `0026`，未修改 |
| M1 Catalog／enum／函数／trigger／FK | 精确一致 |
| Membership total／all-null／partial／complete | `1／0／0／1` |
| transition／exact current-head／M4 baseline | `1／1／1` |
| duplicate command／revision | `0／0` |
| command／evidence identity mismatch | `0／0` |
| tenant／user parent 缺失 | `0／0` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` |
| active historical orphan／Scope relation orphan | `1／1` |
| A2-P2 Scope FK | `NOT VALID`／`convalidated=false` |
| Migration executor／并发 Writer／冲突锁 | `0／0／0` |
| 活动 Allocation／Execution Lease | `0／0` |

Allocation Lease 已在执行前释放且从未消费。Execution Lease claim 后、consume 前再次执行同口径
只读冻结，并比较八张关键业务表的私有稳定指纹；结果与 claim 前完全一致。

## 6. 恢复点与隔离恢复

执行前和执行后各保留一份全新 PostgreSQL custom-format 恢复点，均满足：

- 私有治理根权限为 `0700`，归档、状态和 Lease 为 `0600`；
- 归档非空，archive parse 与完整性校验通过；
- 恢复到随机 localhost-only 隔离数据库后，journal、Catalog 和低敏数据 Shape 与对应目标终态一致；
- 隔离数据库全部删除，活动残留为 `0`；
- 原目标 Restore 为 `0`。

PostgreSQL dump／restore 对 `tenant_membership_transitions_revision_shape_check` 的公开表达式去除了恰好
一对冗余括号。执行编排器只在以下条件同时成立时把它归类为 round-trip equivalent：标识符与操作
符 token 序列完全一致、长度差精确为 `-2`、validated 状态不变、其余列、enum、约束、索引、
trigger、函数、FK、relation envelope 和数据 Shape 全部精确一致。该差异不放宽原目标执行前的
Catalog 硬门；原目标始终要求并通过静态精确指纹。

在形成最终执行前恢复点前，隔离恢复 helper 校准有 `9` 次未满足最终门禁的临时验证，分别暴露了
恢复所有权／ACL 和上述 deparser 表达差异。每次均在签发 Lease 和目标调用前停止并删除隔离库；
原目标 Restore、目标 Migration 调用和数据库写入均为 `0`。第 `10` 次形成并通过最终执行前恢复
点；执行后恢复点另完成 `1／1` 次隔离恢复。最终保留恢复点为 `2／2`。

## 7. Execution Lease 与唯一执行入口

全新 Execution Lease 最长十分钟、不可续期，绑定当前任务、执行 Base、仓库 `43／0042`、环境
`42／0041`、固定目标、执行前恢复点、attempt `1` 和唯一 guarded 命令。终态：

```text
lease_claim=1
lease_consume=1
lease_renewal=0
lease_release=1
lease_active=0
```

唯一执行入口为 `pnpm db:migrate`，对应 `node scripts/db/guarded-migrate.mjs`。没有直接执行 SQL，
没有第二次目标调用或自动重试。

首次启动编排器因输入的仓库本地配置脚本权限为可执行模式而在读取目标和连接数据库前 fail-closed；
该次终态为 target call `0`、Lease claim／consume `0／0`、数据库连接 `0`、DDL／DML `0／0`，并
保留独立的零调用终态记录。随后只把该既有配置机械复制到仓库外 `0600` 私有状态，再从头重跑全部
硬门。该事件不是 Migration attempt，也不是自动重试。

## 8. 执行结果

```text
planned=0
created=0
reused=0
conflict=0
unexpected=0
planned=created+reused
zero_candidate_branch=true
membership_update_rows=0
transition_insert_rows=0
```

guarded 命令正常退出，执行结果已知。`0042` 在零候选分支完成完整事务内硬门并只推进 Migration
metadata；未进入 Membership `UPDATE` 或 transition `INSERT` 循环。

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| 环境 Applied Migration | `42／0041` | `43／0042` | `+1` metadata |
| Membership total | `1` | `1` | `0` |
| all-null／partial／complete | `0／0／1` | `0／0／1` | `0／0／0` |
| transition／exact current-head | `1／1` | `1／1` | `0／0` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` | `1／1／1／1` | `0／0／0／0` |
| tenant／user parent 缺失 | `0／0` | `0／0` | `0／0` |
| active historical orphan／Scope relation orphan | `1／1` | `1／1` | `0／0` |
| Scope FK | `NOT VALID` | `NOT VALID` | 未 `VALIDATE` |

`tenant_members`、transition、Binding、Scope、Context Version、Context Head、tenants 与 auth_users
八张关键业务表的执行前后私有稳定指纹完全一致。结合 `0042` 静态 DML allowlist，可以确认本次
业务 DML 为 `0`。

## 9. 清理与低敏边界

| 项目 | 结果 |
|---|---:|
| Migration client／进程组 | 已退出，残留 `0` |
| Execution Lease／lease lock／run lock | 已释放／已删除，活动残留 `0` |
| attempt marker | terminal 形成后删除，残留 `0` |
| 不可覆盖 terminal record | 保留 `1` |
| 执行 Helper／私有配置副本 | 已删除，残留 `0` |
| 隔离数据库 | 全部删除，残留 `0` |
| 当前执行窗口自动运维元数据回显事件 | `0` |
| 历史本地运维元数据回显事件 | `1`，只保留事件计数 |
| 当前主动私有参数披露 | `0` |
| Secret／Token／密码／私钥／PII／真实凭证披露 | `0` |
| 非 localhost 连接 | `0` |

历史事件只涉及仓库脚本中的本地默认运维参数自动回显，本文不复述任何具体值。

## 10. 零越界与不可变边界

| 禁止项 | 结果 |
|---|---:|
| 直接 SQL／第二次目标调用／自动重试 | `0／0／0` |
| Schema／Migration／journal／snapshot 仓库修改 | `0／0／0／0` |
| `db:generate`／Seed／额外 DDL／额外 DML | `0／0／0／0` |
| FK `VALIDATE`／`SET NOT NULL` | `0／0` |
| 本证据 PR 的 Runtime／scripts／tests／CI／package／lock 修改 | `0` |
| M6／M7／BASE-B1～B6 | 未启动 |
| historical orphan 修复 | 未启动 |
| 项目级 Writer／Audit／MIG-01B／C／业务 Reader | 未启动 |

`0042` 已被固定获授权环境消费，后续不得改写该 SQL 或 journal；如发现新问题，只能通过独立
forward-fix 处理。

## 11. 结论

```text
base02_membership_revision_m5_local_acceptance_migration_validation=passed
m5_migration=0042
m5_environment_journal_entries=43
m5_zero_candidate_branch=true
m5_planned=0
m5_created=0
m5_reused=0
m5_conflict=0
m5_unexpected=0
m5_post_all_null=0
m5_post_partial=0
m5_post_complete=1
m5_post_transition_count=1
m5_exact_current_head_count=1
m5_target_guarded_migration_call_current=1
m5_target_guarded_migration_calls_cumulative=1
m5_automatic_retry_count=0
m5_pre_execution_orchestrator_rejection_target_calls=0
m5_allocation_lease_consumed=false
m5_allocation_lease_active=false
m5_execution_lease_active=false
m5_outcome_known=true
eligible_for_m5_execution_independent_review=true
eligible_for_m5_handoff=false
eligible_for_m6=false
eligible_for_reader=false
```

下一步只能由独立审查冻结本证据 Head，核对唯一目标调用、零候选成功语义、journal、Catalog、
数据不变量、恢复点、Lease、清理和低敏边界。本证据本身不完成 M5，也不授权 M6。

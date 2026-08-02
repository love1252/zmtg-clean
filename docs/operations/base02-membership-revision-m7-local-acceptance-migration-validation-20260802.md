# BASE-02 Membership Revision M7 `0043` 本地验收 Migration 执行低敏证据

## 1. 文档定位

- 任务：BASE-02 ULTRA Membership Revision M0～M7、BASE-B1～B6 全链实施。
- 当前切片：M7 Enforce 与旧路径退出的受控 Migration。
- 日期与时区：`2026-08-02`，`Asia/Shanghai`。
- 执行 Base：`ffafaa8ac0c70f74cbf9b73ed0e43bd5aa7e6e56`。
- 状态：`current low-sensitive execution evidence`。
- 当前结论：`base02_membership_revision_m7_local_acceptance_migration_validation=passed`。
- 后续准入：`eligible_for_m7_execution_independent_review=true`。

本文记录固定 localhost-only `local_acceptance` 环境已经完成的 M7 `0043` 单次受控 Migration。本文
不再次运行 Migration，不完成 M7 handoff，也不授权 BASE-B1～B6、historical orphan 处置、A2-P2
Scope FK `VALIDATE`、项目级 Writer／Audit／MIG-01B／C 或业务 Reader。

本文不记录数据库真实标识符、连接参数、容器标识、Lease 标识、Holder、恢复点路径或摘要、原始
Catalog／SQL 行、tenant／institution 双引用、Membership／角色引用、凭证、Secret、Token、密码、
私钥或 PII。

## 2. 证据来源与归因边界

| 证据来源 | 本文采用的证明范围 | 不得扩大为 |
|---|---|---|
| 当前仓库 `0043`、journal、Schema 与测试 | M7 最终约束、入口状态机、禁止项和计数契约 | 环境已经执行 |
| PR #904／#905 与真实 Required Check | M7 实施和实施独立审查已交付 | 数据库终态 |
| guarded `pnpm db:migrate` 与不可覆盖 terminal record | 唯一目标调用、退出终态、调用次数和自动重试为 `0` | 单独证明数据 Shape |
| 执行前后 `REPEATABLE READ + READ ONLY` 探针 | 环境 journal、Catalog、Membership、A2 资产和 orphan 聚合终态 | 全库逐行等价 |
| 全部 `public` 表与序列的私有稳定指纹 | 业务数据与序列执行前后守恒 | 公开原始行、双引用或摘要 |
| 全新 Execution Lease 私有记录 | Base、前驱、`0043`、恢复点、单次 attempt 和终态 | BASE-B1 或其他 Migration 授权 |
| PostgreSQL custom-format 恢复点工具 | 选定 schema／data 的同集群空库隔离恢复 | ACL、全局角色、异集群或完整灾备演练 |

数据库探针、恢复工具和执行编排器只对外输出固定状态码、布尔值与低敏计数。Migration 子进程的
stdout／stderr 被编排器内部捕获，没有进入对话、Git 或 PR。

## 3. Git 与实施链冻结

| 项目 | 结果 |
|---|---|
| M7 实施前 handoff 修正 PR | #901，Head `7120e4d5f36e09b5b0121f4c2aafb58b8ddd2d3b`，Merge Commit `22a1e6cdba2b81fb8aa743c253cec1e66a28136b` |
| M7 写入契约实施 PR | #902，Head `0b09b329012100386b8bc7638eaf818fb89cf8c6`，Merge Commit `24aba48ced5eb1c0588de88b45757958222cc010` |
| M7 写入契约独立审查 PR | #903，Head `2e22955c77e0d086e1de38ffe66adba930f6960a`，Merge Commit `5de9dc694b0de072eb68d43f2fbccab49c5bcb37` |
| M7 Schema／Migration 实施 PR | #904，Head `f43ce1b9ba554ca034441440c1a57781cbddc198`，Merge Commit `65d12f7e0f9a47df3279a9052b9b21fb54a8e3ad` |
| M7 实施 Required Check | Run `30739072657`／Job `91473075000`，成功 |
| M7 Schema／Migration 独立审查 PR | #905，Head `7f39cc27c7cbfd5f9587cc8881d725f767a8ac27`，Merge Commit／执行 Base `ffafaa8ac0c70f74cbf9b73ed0e43bd5aa7e6e56` |
| M7 实施审查 Required Check | Run `30739700515`／Job `91474768876`，成功 |
| 实施文件范围 | `0043` SQL、journal、Schema、Schema 测试，精确 4 文件 |
| 执行前工作树／并发仓库写入 | 干净／`0` |

执行 Base 上仓库 journal 与 SQL 集合的最新状态为 `44／0043`；snapshot 仍停留在 `0026`。环境
Applied Migration 为 `43／0042`，前驱与仓库前缀一致，唯一 pending 为 `0043`。

独立审查在 PR #906 合并后发现上述四个历史 PR 的部分手工转录 SHA 有字符偏差。本次已按 GitHub
原生 PR 记录逐项校准；该修正只涉及公开 Git 证据归因，不改变 M7 执行 Base、执行计数、Catalog、
数据不变量、Lease、恢复点或清理结论。

## 4. `0043` 实施边界

M7 只把已完成校准、追赶和 Reader 切换的 Membership current envelope 收紧为 accepted 最终 Shape：

- 同名重建 `tenant_members_current_envelope_shape_check`；
- 对 `revision`、`lifecycle_status`、`current_provenance_source`、
  `current_provenance_reason_code`、`current_provenance_command_id`、
  `current_provenance_recorded_at` 六列执行 `SET NOT NULL`；
- 条件可空 actor／occurred time／revoked／deleted 语义保持不变；
- transition、Binding、Scope、Context、A2-P2 Scope FK 和全部业务数据不在写入范围；
- 禁止业务 DML、回填、`VALIDATE CONSTRAINT`、orphan 修复、`CASCADE`、自动重试和范围外对象。

入口只接受 `expected_m1_predecessor` 或精确 `all_exact`。目标环境本次从前者进入，计划对象数为
`7`；必须满足 `planned = created + reused` 且 `conflict = unexpected = 0` 才允许提交。

## 5. 执行前动态硬门

| 硬门 | 执行前结果 |
|---|---:|
| 固定 localhost-only 目标 | 通过 |
| 仓库 journal／latest | `44／0043` |
| 环境 journal／latest | `43／0042` |
| 唯一 pending | `0043` |
| snapshot | `0026`，未修改 |
| Catalog 状态 | `expected_m1_predecessor` |
| Membership total／all-null／partial／complete | `1／0／0／1` |
| transition／exact current-head | `1／1` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` |
| active historical orphan／Scope relation orphan | `1／1` |
| A2-P2 Scope FK | `NOT VALID`／`convalidated=false` |
| Migration executor／并发 Writer | `0／0` |
| 活动 Allocation／Execution Lease | `0／0` |
| helper 外 Migration 进程 | `0` |

执行窗口内没有其他 Agent 写入，也没有 helper 外的 Migration 或数据库写入者。Allocation Lease 已
释放且活动数为 `0`；Execution Lease claim 后、consume 前再次完成相同口径只读冻结，结果未漂移。

## 6. 恢复点与隔离恢复

执行前和执行后各形成一份全新 PostgreSQL custom-format 恢复点，并分别完成同一 PostgreSQL 集群
内随机空数据库的选定 schema／data 隔离恢复：

- 私有治理根为 `0700`，归档和状态为 `0600`；
- 归档非空、可解析，恢复后 journal、Catalog 与低敏数据 Shape 对应各自源状态；
- 全部 `public` 表数据和序列状态均纳入私有源状态绑定与恢复比对；
- 隔离数据库删除，残留为 `0`；
- 原目标 Restore 为 `0`，恢复操作未改变原目标。

既有 transition revision CHECK 在 dump／restore 后仅出现一处冗余括号的 deparser 差异；只有标识符、
操作符、validated 状态及其余 Catalog 全部一致时才归类为 round-trip equivalent，例外计数为 `1`。
该隔离证明不得扩大为 ACL、全局角色、异集群或完整灾备恢复证明。

## 7. Execution Lease 与唯一执行

全新 Execution Lease 最长十分钟、不可续期，绑定当前任务、执行 Base、仓库与环境前驱、`0043`、
执行前恢复点、attempt `1` 和唯一 guarded 命令。终态：

```text
lease_claim=1
lease_consume=1
lease_renewal=0
lease_release=1
lease_active=0
```

唯一目标调用为一次 `pnpm db:migrate`，对应现有 guarded 入口。没有直接执行 SQL，没有第二次目标
调用，没有自动重试；本次唯一执行权已经消费，后续不得再次调用目标 Migration。

## 8. 执行结果与不变量

```text
planned=7
created=7
reused=0
conflict=0
unexpected=0
planned=created+reused
guarded_command_invocations=1
automatic_retry_count=0
```

guarded 命令正常退出，执行结果确定。提交后的 Catalog 为精确 `all_exact`：六个 current envelope
列均为 `NOT NULL`，同名 CHECK 为最终精确指纹，transition DDL 未变化。

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| 环境 journal／latest | `43／0042` | `44／0043` | `+1` metadata |
| current envelope `NOT NULL` 列 | `0` | `6` | `+6` |
| Membership total | `1` | `1` | `0` |
| all-null／partial／complete | `0／0／1` | `0／0／1` | `0／0／0` |
| transition／exact current-head | `1／1` | `1／1` | `0／0` |
| Binding／Scope／Context Version／Context Head | `1／1／1／1` | `1／1／1／1` | `0／0／0／0` |
| active historical orphan／Scope relation orphan | `1／1` | `1／1` | `0／0` |
| Scope FK | `NOT VALID` | `NOT VALID` | 未 `VALIDATE` |

全部 `public` 表数据和序列的执行前后私有稳定指纹一致，因此业务 DML、序列推进和其他表写入均为
`0`。journal 与目标 DDL 是唯一持久化变化。

## 9. 清理、残留与低敏边界

| 项目 | 结果 |
|---|---:|
| Migration client／进程组／helper 外 Migration 进程 | 已退出，残留 `0` |
| Execution Lease／lease lock／run lock | 已释放／已删除，活动残留 `0` |
| 不可覆盖 terminal record | 保留 `1` |
| 执行 Helper | 已删除，残留 `0` |
| 隔离数据库 | 全部删除，残留 `0` |
| 执行前／执行后恢复点 | 已验证并保留 `1／1` |
| 自动运维元数据回显事件累计 | `2`，只保留事件计数 |
| 当前主动私有参数披露 | `0` |
| Secret／Token／密码／私钥／PII／真实凭证披露 | `0` |
| 非 localhost 连接 | `0` |

历史自动回显只涉及仓库脚本中的本地默认运维元数据；本文不复述任何具体值。

编排器的崩溃恢复边界和恢复证明范围已在执行前静态复核中显式收窄。本次未出现 pre-spawn 解析
失败、release rename 崩溃、partial private state 或结果不确定状态；这些 fail-closed 边界不改变
本次确定成功的执行终态，也不得被表述成一般化的自动恢复能力。

## 10. 零越界

| 禁止项 | 结果 |
|---|---:|
| 直接 SQL／第二次目标调用／自动重试 | `0／0／0` |
| 执行证据 PR 的 Schema／Migration／journal／snapshot 修改 | `0／0／0／0` |
| `db:generate`／Seed／额外 DDL／业务 DML | `0／0／0／0` |
| Scope FK `VALIDATE`／orphan 处置 | `0／0` |
| Runtime／scripts／tests／CI／package／lock 修改 | `0` |
| BASE-B1～B6 | 未启动 |
| 项目级 Writer／Audit／MIG-01B／C／业务 Reader | 未启动 |

`0043` 已被固定获授权环境消费，后续不得改写 SQL 或 journal；如发现新问题，只能通过独立
forward-fix 处理。

## 11. 结论

```text
base02_membership_revision_m7_local_acceptance_migration_validation=passed
m7_migration=0043
m7_environment_journal_entries=44
m7_planned=7
m7_created=7
m7_reused=0
m7_conflict=0
m7_unexpected=0
m7_current_envelope_not_null_columns=6
m7_post_all_null=0
m7_post_partial=0
m7_post_complete=1
m7_post_transition_count=1
m7_exact_current_head_count=1
m7_target_guarded_migration_calls_cumulative=1
m7_automatic_retry_count=0
m7_execution_lease_active=false
m7_outcome_known=true
eligible_for_m7_execution_independent_review=true
eligible_for_m7_handoff=false
eligible_for_base_b1=false
eligible_for_business_reader=false
```

下一步只能由独立审查冻结本证据 Head，核对唯一目标调用、七项 Enforce、journal、Catalog、数据与
序列不变量、恢复点、Lease、清理和低敏边界。本证据本身不完成 M7，也不授权 BASE-B1。

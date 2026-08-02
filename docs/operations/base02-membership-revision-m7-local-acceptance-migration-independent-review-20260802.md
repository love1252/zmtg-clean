# BASE-02 Membership Revision M7 本地验收 Migration 执行独立审查

## 1. 文档定位

- 审查日期与时区：`2026-08-02`，`Asia/Shanghai`。
- 审查 Base：`ceb7f8c3f75c06c93a845c2769cd59b199a46ebe`。
- 被审查执行证据 PR：#906，Head `097a0e837c7afaf4a89c818cf5c6860aac0f08c9`，Merge Commit `58521283d6c28f3b7b6b0b4254109bb1340c5066`。
- 证据归因纠错 PR：#907，Head `571bbbdc8fe0a3b881edff25d1fbe10c27c81bd6`，Merge Commit `ceb7f8c3f75c06c93a845c2769cd59b199a46ebe`。
- 状态：`current independent review evidence`。

本文独立复核 M7 `0043` 在固定 localhost-only `local_acceptance` 环境中的单次受控执行低敏证据。
本文不连接数据库，不运行 Migration，不创建或消费 Lease，不修改被审查证据，也不授权 BASE-B1～
B6、historical orphan 处置、A2-P2 Scope FK `VALIDATE`、项目级 Writer／Audit／MIG-01B／C 或业务
Reader。

## 2. 审查材料与归因边界

审查材料包括：

1. `docs/operations/base02-membership-revision-m7-local-acceptance-migration-validation-20260802.md`；
2. `drizzle/0043_base02_membership_revision_enforce.sql`；
3. `drizzle/meta/_journal.json`；
4. `src/server/db/schema.ts`；
5. `src/server/db/tests/Schema.test.ts`；
6. M7 PR #901～#907 的 GitHub 原生 PR、Git commit 与 Actions 记录。

仓库公开静态证据能够独立验证 SQL／Schema／journal 契约、Git 归因和质量门禁。运行期
`7／7／0／0／0`、环境 journal、全表与序列守恒、orphan、唯一调用、Lease、恢复点和清理状态，
均明确归因于已纠正的 PR #906 低敏记录；本审查只验证这些记录彼此一致且符合 `0043` 公开契约，
不宣称重新访问或公开私有 terminal、Lease、恢复点或数据库事实。

## 3. F01 证据归因纠错复审

首轮独立审查发现 PR #906 手工转录的 6 个历史 SHA 无法解析，F01 因而阻断。PR #907 只修改执行
证据文件，按 GitHub 原生记录校准：

| PR | Head | Merge Commit | Required Check |
|---|---|---|---|
| #901 | `7120e4d5f36e09b5b0121f4c2aafb58b8ddd2d3b` | `22a1e6cdba2b81fb8aa743c253cec1e66a28136b` | Run `30736438955`／Job `91465972519` |
| #902 | `0b09b329012100386b8bc7638eaf818fb89cf8c6` | `24aba48ced5eb1c0588de88b45757958222cc010` | Run `30737402318`／Job `91468617520` |
| #903 | `2e22955c77e0d086e1de38ffe66adba930f6960a` | `5de9dc694b0de072eb68d43f2fbccab49c5bcb37` | Run `30737726950`／Job `91469473175` |
| #904 | `f43ce1b9ba554ca034441440c1a57781cbddc198` | `65d12f7e0f9a47df3279a9052b9b21fb54a8e3ad` | Run `30739072657`／Job `91473075000` |
| #905 | `7f39cc27c7cbfd5f9587cc8881d725f767a8ac27` | `ffafaa8ac0c70f74cbf9b73ed0e43bd5aa7e6e56` | Run `30739700515`／Job `91474768876` |
| #906 | `097a0e837c7afaf4a89c818cf5c6860aac0f08c9` | `58521283d6c28f3b7b6b0b4254109bb1340c5066` | Run `30741583818`／Job `91479870752` |
| #907 | `571bbbdc8fe0a3b881edff25d1fbe10c27c81bd6` | `ceb7f8c3f75c06c93a845c2769cd59b199a46ebe` | Run `30741960782`／Job `91480843159` |

表中 Head 和 Merge Commit 均可解析为当前仓库 commit，并逐项匹配 GitHub PR 记录。PR #907 单提交、
单文件，只修正公开归因并增加纠错说明；数据库重新执行、Runtime、Schema、Migration、journal、
snapshot、scripts、tests、CI、package 与 lock 修改均为 `0`。F01 已关闭。

## 4. Git、范围与质量门禁

| 核对项 | 结论 |
|---|---|
| PR #906／#907 状态 | 均已使用 Merge Commit 合并 |
| PR #906／#907 范围 | 各自单提交、单文件 |
| PR #906 Merge tree | 与证据 Head tree 一致 |
| PR #907 Merge tree | 与纠错 Head tree 一致 |
| PR #906 Required Check | Run `30741583818`／Job `91479870752`，全部步骤成功 |
| PR #907 Required Check | Run `30741960782`／Job `91480843159`，全部步骤成功 |
| 完整测试／build | 两轮均实际执行并通过，未跳过 |
| 两个 docs PR 的 Runtime／Schema／Migration／journal／snapshot 修改 | `0` |

M7 实施范围仍精确为 PR #904 的 `0043` SQL、journal、Schema 与 Schema 测试四文件；证据与纠错
没有改写已消费 Migration，也没有创建 forward-fix、snapshot 或第二套执行资产。

## 5. 唯一执行与结果一致性审查

PR #906 的低敏记录固定：

```text
guarded_command_invocations=1
automatic_retry_count=0
planned=7
created=7
reused=0
conflict=0
unexpected=0
planned=created+reused
```

记录中的唯一目标调用使用现有 guarded `pnpm db:migrate`；直接 SQL、第二次调用和自动重试均为
`0`。结果为确定成功，环境 journal 从 `43／0042` 推进到 `44／0043`，与仓库 `44／0043`
对齐；snapshot 保持 `0026`。

该低敏结果与公开 `0043` 状态机一致：目标从精确 M1 predecessor 进入，固定执行同名 CHECK 重建
和六列 `SET NOT NULL`，因此首次执行的 planned／created 为 `7／7`。静态 SQL 不包含业务 DML、
`VALIDATE`、`CASCADE`、自动重试或范围外 DDL。

## 6. Catalog、数据与跨域不变量

公开静态证据验证：

- Drizzle Schema 的六个无条件 current envelope 列均为 `.notNull()`；
- `tenant_members_current_envelope_shape_check` 为 M7 最终表达；
- `0043` 不修改 transition DDL、Binding、Scope、Context 或业务数据；
- A2-P2 Scope FK 继续由 `0039` 定义为 `NOT VALID`，`0043` 明确要求 `convalidated=false`；
- journal 为 `44／0043`，snapshot `0026` blob 未变化。

PR #906 的低敏记录报告执行前后：Membership total／all-null／partial／complete 为 `1／0／0／1`，
transition／exact current-head 为 `1／1`，Binding／Scope／Context Version／Context Head 为
`1／1／1／1`，active historical orphan／Scope relation orphan 为 `1／1`；全部 `public` 表数据和
序列私有稳定指纹一致。公开实现没有与这些记录冲突的写入路径，因此可将其作为已纠正的低敏执行
证据接受，但不得扩大为本审查重新读取数据库或公开原始行。

## 7. Lease、恢复点与清理审查

PR #906 的低敏记录报告 Execution Lease claim／consume／renewal／release／active 为
`1／1／0／1／0`，Allocation Lease 已释放且活动数为 `0`。执行前后恢复点各 `1` 份，均完成同
集群随机空库的选定 schema／data 隔离恢复，round-trip 仅有既有 transition CHECK 的一处冗余括号
等价差异；原目标 Restore 为 `0`，隔离数据库残留为 `0`。

该恢复证据只证明同集群空库的选定 schema／data 恢复，不证明 ACL、全局角色、异集群或完整灾备。
执行 Helper、client、进程组、run lock、lease lock、attempt marker 与隔离数据库活动残留均记录为
`0`；不可覆盖 terminal record 和两份已验证恢复点按治理要求保留。

执行编排器仍有 fail-closed 人工恢复边界：pre-spawn 解析失败或 release rename 期间崩溃可能遗留
需要人工核验的私有状态。本次低敏记录明确这些分支未发生，不能据此宣称一般化自动恢复能力。

## 8. 低敏与零越界

| 项目 | 结果 |
|---|---:|
| 自动运维元数据回显事件累计 | `2`，只记录次数 |
| 当前主动私有参数披露 | `0` |
| Secret／Token／密码／私钥／PII／真实凭证披露 | `0` |
| 数据库重新执行 | `0` |
| Scope FK `VALIDATE`／orphan 处置 | `0／0` |
| BASE-B1～B6／项目级 Writer／Audit／MIG-01B／C／业务 Reader | 未启动 |

审查材料没有复述数据库名、角色名、连接参数、私有路径、恢复点摘要、Lease 标识、Holder、原始行、
双引用或凭证。M7 执行证据与归因纠错没有扩大已接受 Owner、事实源或发布门禁。

## 9. 独立审查结论

```text
base02_membership_revision_m7_execution_review=passed
m7_execution_evidence_attribution=passed
m7_execution_evidence_correction_pr=907
m7_database_reexecution=0
m7_private_records_publicly_disclosed=false
m7_execution_complete=true
m7_handoff_complete=false
m7_migration=0043
m7_outcome_known=true
m7_environment_journal_entries=44
m7_planned=7
m7_created=7
m7_reused=0
m7_conflict=0
m7_unexpected=0
m7_target_guarded_migration_calls_cumulative=1
m7_automatic_retry_count=0
m7_allocation_lease_released=true
m7_execution_lease_active=false
m7_current_envelope_not_null_columns=6
m7_current_envelope_complete=1
m7_transition_count=1
m7_active_historical_orphan=1
m7_scope_relation_orphan=1
m7_scope_fk_validated=false
eligible_for_m7_handoff=true
eligible_for_base_b1=false
eligible_for_business_reader=false
```

F01 已由 PR #907 关闭。已纠正的证据归因、公开 `0043` 契约、执行低敏记录、质量门禁和零越界边界
内部一致，M7 执行独立审查通过。下一步仅允许 M7 handoff；BASE-B1、orphan 处置、Scope FK
`VALIDATE` 和业务 Reader仍未由本审查启动。

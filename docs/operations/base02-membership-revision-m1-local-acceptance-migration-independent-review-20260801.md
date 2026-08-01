# BASE-02 Membership Revision M1 本地验收 Migration 执行独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-01，Asia/Shanghai
>
> 审查基线：`17e1a1d04691878809d0caf533960b99705529dd`
>
> 被审查 PR：#874
>
> 被审查 Head：`5f7a5f64dfb48768193ca8510392d8a9146a1b7b`
>
> Required Check：Run `30705415873`／Job `91383565350`，成功
>
> 被审查 Merge Commit：`17e1a1d04691878809d0caf533960b99705529dd`

## 1. 审查定位

本审查独立核对 Membership Revision M1 `0040` 的完整尝试历史、原子纠错、第二次受控
Migration 终态、Catalog、数据不变量、恢复点、Lease 与低敏边界，判断 M1 是否具备进入独立
handoff 的条件。

审查只读取已合并仓库证据、Git／GitHub 证据和仓库外低敏终态记录；不连接数据库，不运行
Migration、Runner、DDL、DML、Restore 或新探针，不创建或消费 Lease，也不启动 M2。

本文不记录数据库真实标识符、连接参数、私有路径、Lease 标识、Holder、恢复点路径或 hash、
原始 Catalog／SQL 行、tenant／institution 双引用、凭证、Secret、Token、密码、私钥或 PII。

## 2. 被审查交付冻结

PR #874 相对 Base `781fde457c38a28dc9fd8f4d8e05bd16198f46db` 精确为 1 个提交、
1 个文件：

`docs/operations/base02-membership-revision-m1-local-acceptance-migration-validation-20260801.md`

冻结结果：

| 项目 | 结果 |
|---|---|
| PR #874 最终 Head | `5f7a5f64dfb48768193ca8510392d8a9146a1b7b` |
| 提交／文件 | `1／1` |
| Required Check | Run `30705415873`／Job `91383565350`，成功 |
| 评论／Review／未解决 thread | `0／0／0` |
| Merge Commit | `17e1a1d04691878809d0caf533960b99705529dd` |
| Merge 父提交 | 被审查 Base 与被审查 Head |
| Merge tree | 与被审查 Head tree 完全一致 |

PR #874 只纳入低敏执行证据；Runtime、Schema、Migration、journal、snapshot、scripts、tests、
CI、package 与 lock 修改均为 0。环境核对、依赖安装、架构检查器自测、增量架构检查、lint、
typecheck、完整测试和 build 均在冻结 Head 上实际执行并成功，build 未跳过。

## 3. 首轮失败历史未被抹除

审查确认首轮历史被永久保留：

- 首轮 pre-entry 曾因缺少显式本地目标门禁而拒绝，发生在数据库调用前，数据库 attempt 增量为 0；
- 首轮实际数据库 Migration 尝试为 1，因 `pg_enum.enumlabel` 聚合类型不匹配失败；
- 事务完整回滚，环境 journal 保持 40，M1 Catalog 保持严格 `all_missing`；
- Membership／Binding、A2-P1 三表和 orphan 低敏计数均未变化，业务 DML 为 0；
- 首轮 Lease `claim／consume／release=1／1／1`，活动 Lease 为 0；
- 自动重试为 0。

PR #872 只在未被允许环境消费的 `0040` 中增加三处显式 `enumlabel::text` 并补精确测试；
PR #873 独立确认纠错没有修改 journal、Schema、snapshot，没有创建 `0041`，也没有扩大 M1。
纠错 PR／审查 PR 的 Merge Commit 分别为
`75f3c6663e7decce63634b1ee05579a454fb97ac` 与
`781fde457c38a28dc9fd8f4d8e05bd16198f46db`。

## 4. 第二次执行授权与尝试计数

纠错后执行使用全新恢复点、全新唯一 Lease 和全新不可覆盖 marker，不是自动重试。私有 Helper
曾在模块实例化阶段因导入错误拒绝 1 次；该拒绝发生在目标发现、探针、恢复点、Lease、marker
和数据库命令前，新增数据库 attempt 为 0。修正 Helper 后重新完成静态安全复核。

终态计数为：

```text
actual_database_attempt_cumulative=2
automatic_retry_count=0
first_failure_history_preserved=true
```

第二次执行只调用一次 guarded `pnpm db:migrate`，没有直接执行 SQL，没有第二次本轮调用，没有
创建 `0041`。执行成功后 `0040` 已被唯一允许的固定 localhost-only 验收环境消费；此后不得再
改写该 Migration 或对应 journal，后续问题只能独立 forward-fix。

## 5. 执行前后 Journal 与 Catalog

执行前硬门冻结为：仓库 journal／SQL 集合 `41／41`，环境 journal 40，唯一 pending 为
`0040`，snapshot 仍为 `0026`，M1 Catalog 严格 `all_missing`。A2-P1 三表、A2-P2 精确索引和
未验证外键、Membership／Binding、orphan 与无并发执行者均无漂移。

执行后独立低敏终态为：

| 状态／对象类别 | 结果 |
|---|---:|
| 环境 journal | `41` |
| pending Migration | `0` |
| M1 Catalog | `all_exact` |
| enum | `3` |
| current envelope 新列 | `10` |
| current 新约束 | `2` |
| transition table | `1` |
| transition 列 | `16` |
| transition 约束 | `8` |
| transition 显式普通索引 | `1` |
| append-only function | `1` |
| append-only trigger | `2` |

终态探针不仅核对名称与数量，还核对 enum labels、列类型／长度／nullable／default、键与动作、
CHECK 关键语义、索引列序与属性、function 属性／函数体、trigger 事件／状态和 table persistence。
环境 journal 最新 when／hash 与仓库当前 `0040` 精确一致。

M1 对象类型异质，accepted 设计没有冻结可相加的统一 `planned／created／reused` 口径，因此按
对象类别记录，不虚构总对象数。

## 6. 数据不变量与未越界范围

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| Membership／Binding | `1／1` | `1／1` | `0／0` |
| A2-P1 Scope／Context Version／Context Head | `1／1／1` | `1／1／1` | `0／0／0` |
| 完整 current envelope 行 | `0` | `0` | `0` |
| transition evidence 行 | `0` | `0` | `0` |
| Scope relation orphan | `1` | `1` | `0` |
| active historical orphan | `1` | `1` | `0` |
| 业务 DML | `0` | `0` | `0` |

审查确认：

- M1 只完成 Expand，没有执行 legacy calibration；
- A2-P2 索引保持精确，外键继续 `convalidated=false`；
- historical orphan 没有处理、删除或反向补 Scope；
- 没有 Seed、回填、`VALIDATE`、`SET NOT NULL`、snapshot、`db:generate`；
- 没有启动 M2～M7、BASE-B1～B6、项目级 Writer 或业务 Reader。

## 7. 恢复点、Lease 与终态清理

执行前和执行后均创建全新 custom-format 恢复点，完成非空、archive parse、完整性及随机隔离恢复
验证；隔离恢复库验证对应 journal、Catalog 与数据不变量后已删除，从未 Restore 原目标。

全新 Lease 绑定执行 Base、仓库／环境 journal、唯一 pending `0040`、固定本地目标和不可覆盖
attempt marker，最长十分钟且不可续期。终态为：

```text
lease_claim=1
lease_consume=1
lease_renewal=0
lease_release=1
lease_active=0
```

执行后 attempt marker、run lock 和临时 Helper 均已删除；不可覆盖 completion marker、低敏终态
记录和恢复点按治理保留，执行结果为已知。没有无法解释的连接、并发 Writer 或临时执行资产残留。

## 8. 低敏与信息安全复核

本恢复阶段自动本地运维元数据回显事件累计 2 次，只累计次数，不复述具体值。当前主动私有参数
披露为 0；Secret、Token、密码、私钥、PII、真实凭证或非 localhost 连接信息披露为 0。

审查文件与 PR 描述没有包含私有路径、连接参数、数据库真实标识符、Lease／恢复点标识、原始
Catalog 行、tenant／institution 双引用或业务数据。

## 9. 风险与后续边界

- `0040` 现已是已消费 Migration，不得 amend、重写或重新执行；新问题必须使用独立 forward-fix。
- M1 current envelope 与 transition evidence 仍为空，这是 Expand 完成后的预期状态，不代表
  Membership 生命周期 Writer 已建立。
- M2 必须从 Access Control 唯一命令边界建立 CAS、同事务 current／Binding／evidence 写入和
  immutable evidence；不得让 Binding version 或 Scope revision 替代 Membership revision。
- M2 仍需独立 handoff 明确冻结后才能启动；本审查本身不授权 M2。
- historical orphan `1／1` 与 A2-P2 未验证外键继续是后续门禁；本审查不处理它们。

## 10. 独立审查结论

```text
base02_membership_revision_m1_execution_review=passed
m1_expand_migration_executed=true
m1_environment_journal_entries=41
m1_catalog_state=all_exact
m1_first_failure_history_preserved=true
m1_database_attempt_cumulative=2
m1_automatic_retry_count=0
eligible_for_m1_handoff=true
eligible_for_m2=false
```

PR #874 的低敏证据与仓库、GitHub、私有终态记录相互一致，能够证明 M1 `0040` 已在唯一允许
环境中完成一次纠错后受控执行，并保持数据、orphan、A2-P2 未验证外键及后续阶段边界不变。
M1 可以进入独立 handoff；M2 尚未启动，也未由本审查授权。

# BASE-02 Membership Revision M4 `0041` 记录别名纠错独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查基线：`026ffe0cf78e593224ca63ce577b3a07d91db6d5`
>
> 被审查纠错：PR #888，Head `35c0d224454e1e471db203591e2f18d211a3b18d`

## 1. 审查定位

本审查独立核对 M4 第二次受控 Migration 的事务失败根因、`0041` 在全部获授权环境中的未消费状态，
以及 PR #888 是否以原子范围修复 PL/pgSQL 记录变量与关系别名冲突。本审查只读取仓库 diff、测试、
低敏执行终态和 GitHub 证据，不连接数据库，不运行 Migration，不创建恢复点或 Lease，也不发起第三次
guarded Migration。

M4 校准数据语义、M5～M7、BASE-B1～B6、项目级 Writer／Audit／MIG-01B／C 与 Reader 均不在本审查
的实施授权范围内。

## 2. 第二次执行终态与未消费证明

第二次受控执行满足以下低敏事实：

- 累计实际受控调用为 `2`，自动重试为 `0`；
- 第二次调用进入 PostgreSQL 事务后因 `record_not_assigned` 失败，事务完整回滚；
- 固定 localhost-only `local_acceptance` 是本阶段唯一获授权数据库环境；
- 环境 journal 仍为 `41／0040`，`0041` 未消费；
- Membership current 总数／全空校准行／完整校准行／transition 仍为 `1／1／0／0`；
- Binding、Scope、Context Version、Context Head 仍为 `1／1／1／1`；
- active historical orphan／Scope relation orphan 仍为 `1／1`；
- Scope FK 继续保持 `NOT VALID`；
- 第二次调用前后的数据库对象、业务数据和 journal 净变化均为 `0`；
- 两次 Lease 均已释放，活动 Lease 与执行锁为 `0`；
- 没有直接执行 SQL，没有第三次调用，也没有其他环境消费 `0041` 的证据。

临时隔离恢复资产已按既有执行治理完成验证和清理，不构成额外获授权环境。本审查不记录私有路径、
连接参数、恢复点标识、Lease 标识、角色引用或原始数据库结果。

## 3. 根因复核

`0041` 在声明区定义了循环记录变量 `candidate_row record`。纠错前的 parent-check 查询在循环赋值前，
又把 `candidate_row` 用作 `tenant_members` 的关系别名并访问其字段。PL/pgSQL 将该限定名解析到尚未赋值
的 record 变量，因此在事务内触发 `record_not_assigned`。

循环中的 `candidate_row` 只有在 `FOR candidate_row IN` 开始后才具有行结构；另一记录变量
`updated_row` 在字段访问前已由 `INTO updated_row` 赋值，不属于本次根因。未发现需要改变校准算法、
稳定排序、父记录判定或 DML allowlist 的证据。

## 4. 原子纠错范围

PR #888 精确修改两个文件：

1. `drizzle/0041_base02_membership_revision_legacy_calibration.sql`；
2. `src/server/db/tests/Schema.test.ts`。

纠错只把 parent-check 的关系别名改为 `candidate_member`，同步其字段引用；循环记录变量
`candidate_row`、稳定排序、校准写入、transition evidence、计数与不变量均保持不变。

以下范围修改均为 `0`：

- `drizzle/meta/_journal.json`；
- 所有 snapshot；
- `src/server/db/schema.ts`；
- 其他 Migration、Runtime、CI、package 与 lock；
- 数据库 Schema、环境 journal 与业务数据。

没有创建 `0042`，没有修改已消费的 `0040`，也没有预先分配新的 Migration 编号。

## 5. 回归门禁复核

`Schema.test.ts` 新增静态约束：

- `candidate_row.*` 的首次字段访问必须晚于 `FOR candidate_row IN`；
- parent-check 必须使用独立的 `candidate_member` 关系别名；
- 禁止重新出现 `FROM public.tenant_members candidate_row`；
- 循环 record 与 parent-check 关系别名不得重名。

这些断言只锁定本次名称解析缺陷，不修改 Schema、Migration 业务语义或 accepted 生命周期约束。

验证结果：

| 门禁 | 结果 |
|---|---|
| Schema 定向测试 | `67／67` |
| 架构检查器自测 | `125／125` |
| 增量架构检查 | 通过 |
| lint | 0 error；4 条既有图片 warning |
| typecheck | 通过 |
| 完整测试 | 426 文件／6254 项通过 |
| build | 101／101 |
| `git diff --check` | 通过 |

真实 Required Check 绑定 PR #888 冻结 Head：Run `30721169377`／Job `91425129494` 成功；环境、依赖、
架构自测、增量检查、lint、typecheck、完整测试和 build 均实际执行，build 未跳过且没有
`continue-on-error`。

## 6. 合并证明与后续边界

PR #888 已使用 Merge Commit 合并，Merge Commit 为
`d446ff84497fbadd023e30f96225857cc805f731`。其两个父提交分别为审查基线与被审查 Head，Merge tree
与被审查 Head tree 一致。

该合并只使仓库中的未消费 `0041` 具备重新准备资格，不构成第三次数据库执行授权。后续如获用户明确
授权，仍必须从最新 main 重新冻结全部硬门，创建并隔离恢复验证全新恢复点，签发全新且不可续期的唯一
Lease，并把后续调用明确记录为第三次实际 attempt；不得复用既有恢复点或 Lease，不得自动重试。

## 7. 独立审查结论

```text
m4_0041_unconsumed_correction_review=passed
all_authorized_environments_0041_consumed=false
m4_journal_unchanged=true
m4_snapshot_unchanged=true
m4_correction_files=2
m4_attempts=2
m4_automatic_retries=0
m4_second_attempt_rolled_back=true
m4_second_attempt_database_net_change=0
m4_existing_leases_released=true
m4_third_attempt_started=false
eligible_for_m4_reprepare=true
eligible_for_m4_third_execution=false
eligible_for_m5=false
eligible_for_reader=false
```

PR #888 的两文件纠错与已确认根因精确对应；未发现范围扩大、数据语义改变、journal／snapshot 漂移或
未解释的环境消费。M4 可以在未来明确授权下重新准备，但本审查不授权第三次执行，也不启动任何后续
阶段。

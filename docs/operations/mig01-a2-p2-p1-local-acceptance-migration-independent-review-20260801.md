# MIG-01A2 A2-P2 P1 local_acceptance Migration 执行独立审查

## 1. 文档定位

- 内部任务：A2-P2 P1 核心 Schema／Migration 实施、执行、独立审查与 handoff
- 日期与时区：`2026-08-01`，`Asia/Shanghai`
- 审查 Base：`e93d180fb7e34a33d2f7e2e70eb4f2eed66790cf`
- 审查方式：docs-only、独立只读复核
- 状态：`current independent review`
- 审查结论：`passed`

本审查只核对已经合并的执行低敏证据、仓库中的 P1 SQL／Schema／journal／测试、实施独立审查
以及 GitHub 交付事实。审查没有重新连接数据库，没有运行 Migration、SQL、Runner、Seed、Restore，
也没有读取或重新取得 Migration Lease。

本文不记录数据库真实标识符、连接参数、容器标识、角色名、Lease 标识或 Holder、恢复点路径、
原始 digest、tenant／institution 双引用、原始 SQL／Catalog 行、凭证、Secret、Token、私钥或 PII。

## 2. 冻结审查对象

| 项目 | 冻结值 |
|---|---|
| 执行证据 PR | #851 |
| PR Base | `57b77a76e55846d14a28bfdf3a8794ba67241a54` |
| PR Head | `1a832883b20f8e37879f3f740db0cc9cb098aea8` |
| Merge Commit | `e93d180fb7e34a33d2f7e2e70eb4f2eed66790cf` |
| Required Check | Run `30648638669`／Job `91216191655`，成功 |
| 提交／文件 | `1／1` |
| 合并方式 | Merge Commit |
| 证据文件 | `docs/operations/mig01-a2-p2-p1-local-acceptance-migration-validation-20260801.md` |
| 证据 blob | `0f1caaf3c4954f0a5c94b0aee4fba6041f3ca644` |
| 评论／Review／未解决 thread | `0／0／0` |

Merge Commit 的两个父提交分别为 PR Base 与 PR Head，Merge tree 与 PR Head tree 一致。Required
Check 的环境核对、依赖安装、架构检查器自测、增量架构检查、lint、typecheck、完整测试和
build 均实际成功；build 未跳过，Workflow 无 `continue-on-error`。

## 3. 审查方法与事实归因

| 来源 | 可证明事实 | 审查限制 |
|---|---|---|
| GitHub PR／Actions | 证据文件身份、范围、交付与质量门禁 | 不能证明数据库终态 |
| 仓库 SQL／Schema／journal／测试 | 两个目标对象定义与仓库 metadata | 不能证明环境已执行 |
| 合并低敏执行证据 | 唯一 attempt、前后低敏状态、Lease 与恢复点终态 | 不能替代原始 SQL 审计记录 |
| READ ONLY 白名单探针归因 | 环境 journal、Catalog、A2-P1 与 Binding 聚合状态 | 不等于全库逐行 bit-for-bit 证明 |
| Lease Authority／恢复点工具归因 | 唯一执行授权／归档与隔离恢复验证 | 不授权后续 Migration 或 Restore 原目标 |

本审查逐项复算计数守恒，交叉核对前后状态、静态对象定义、Migration 元数据和阶段禁止范围，
没有把 GitHub、仓库文件、Migrator 或数据库探针任一单独来源提升为全部事实证明。

## 4. 发现项

```text
blocking_findings=0
non_blocking_findings=0
```

历史／自动本地运维元数据回显事件已按恢复授权只累计为 `2` 次；证据没有复述具体值，当前主动
私有参数披露为 `0`，Secret、Token、密码、私钥、PII 或真实凭证披露为 `0`。该事件不改变
Catalog、Journal、Shape、恢复点、Lease 或 Migration 结果。

## 5. 实施与执行前置审查

| 前置项 | 冻结证据 | 审查 |
|---|---|---|
| P1 实施 PR #849 | Head `4b0a0f89…`，Run `30645227980`，Merge `036c3198…` | 通过 |
| 实施独立审查 PR #850 | Head `24370a00…`，Run `30646526891`，Merge `57b77a76…` | 通过 |
| Migration 编号 | `0039`，与唯一 Lease、SQL、journal 绑定 | 通过 |
| snapshot | 停留在 `0026`，blob 未变化 | 通过 |
| localhost-only 与目标身份 | 固定且重新核验 | 通过 |
| 仓库／环境 journal | 仓库 `40`；环境前态 `39`，前缀精确 | 通过 |
| 唯一 pending | `0039`，数量 `1` | 通过 |
| 前态 Catalog | `all_missing` | 通过 |
| A2-P1 三表 | `1／1／1` | 通过 |
| Binding 总数／NULL／重复／orphan | `1／0／0／1` | 通过 |
| 并发 Migration／Writer | `0／0` | 通过 |
| Migration Lease | 有效、唯一，任务／Base／journal／编号绑定通过 | 通过 |
| 执行前恢复点 | custom archive、完整性、archive parse、隔离恢复通过 | 通过 |

环境 journal relation 在执行前已存在，因而 Drizzle 在外层事务之外执行的 relation
`IF NOT EXISTS` preamble 没有产生本轮新增对象或范围外漂移。

## 6. 唯一执行状态机审查

```text
migration_attempt=1
migration_retry=0
entrypoint=guarded pnpm db:migrate
planned=2
created=2
reused=0
conflict=0
unexpected=0
```

- attempt marker 在命令前不可覆盖地建立；
- guarded 入口只调用一次，没有循环、自动重试或第二个执行入口；
- 没有直接运行 SQL 文件或裸 `drizzle-kit`；
- 目标 SQL 不写显式事务边界，由 Drizzle 外层单一事务承载；
- SQL 内按固定顺序锁定源表和目标表，并在创建前完成 Catalog、Shape、A2-P1 与 predecessor
  journal 重检；
- `created=2／reused=0` 由 `all_missing → all_exact`、命令成功和环境完整 journal 匹配推导，
  不是把 Migrator stdout 改写为对象计数。

计数满足 `planned=created+reused`，且 `conflict=unexpected=0`。

## 7. Catalog 与范围审查

| 目标对象 | 最终证据 | 审查 |
|---|---|---|
| `auth_account_institution_bindings_scope_idx` | 普通非唯一 btree；`tenant_id, institution_id`；无 predicate／include／expression | 精确 |
| `auth_account_institution_bindings_scope_fk` | 源双列到 `institution_scopes` 同序双列；`MATCH SIMPLE`；更新／删除 `NO ACTION`；非 deferrable | 精确 |
| FK validation | `convalidated=false` | 保持 `NOT VALID` |
| 部分对象／同名异定义 | `0／0` | 通过 |
| 第三个人工对象／未知用户依赖 | `0／0` | 通过 |

PostgreSQL 的 FK 内部依赖归属于目标约束，不构成第三个人工目标对象。执行没有夹带
`VALIDATE`、回填、`SET NOT NULL`、`DROP`、`CASCADE` 或范围外关系。

## 8. 数据与 metadata 审查

| 状态 | 前态 | 后态 | 审查 |
|---|---:|---:|---|
| 环境 Applied Migration | `39` | `40` | 完整 journal 匹配 |
| A2-P1 三表 | `1／1／1` | `1／1／1` | 无变化 |
| Binding 总数／NULL／重复／historical orphan | `1／0／0／1` | `1／0／0／1` | 无变化 |
| 全部公开业务表低敏行数 | 基线 | 相同 | 业务 DML `0` |
| snapshot | `0026` | `0026` | blob 未变化 |

准确口径为环境 Migration journal metadata `+1`、业务 DML `0`。仓库 journal 在数据库执行前已为
40 项，不能把仓库文件变化再次归因给本次环境执行。historical orphan `1` 未回填、未清零，也
没有被 `NOT VALID` 外键拒绝或隐藏。

## 9. Lease、恢复点与结果终态审查

| 项目 | 证据结果 | 审查 |
|---|---:|---|
| Lease claim／consume／release | `1／1／1` | 通过 |
| Lease renewal／retry | `0／0` | 通过 |
| Lease 最终 active／consumed／released | `false／true／true` | 不可复用 |
| 执行结果 | `outcomeKnown=true` | 通过 |
| 执行前恢复点／隔离恢复 | 通过／通过 | 通过 |
| 执行后恢复点／隔离恢复 | 通过／通过 | 通过 |
| attempt marker／私有日志／单次 Helper 残留 | `0／0／0` | 通过 |

执行前后恢复均在随机隔离数据库完成并删除隔离库，没有 Restore 原目标数据库。获批恢复点继续
按治理要求保留；临时执行资产已清理。

## 10. 低敏与零越界审查

| 类别 | 数量／结果 |
|---|---:|
| 当前主动私有参数披露 | `0` |
| 真正敏感信息披露 | `0` |
| 非 localhost 连接 | `0` |
| 第二次 Migration／直接 SQL | `0／0` |
| Seed／业务 DML／回填 | `0／0／0` |
| FK `VALIDATE`／`SET NOT NULL`／snapshot／`db:generate` | `0／0／0／0` |
| BASE-02／Writer／MIG-01B／C／Reader | 未启动 |

## 11. 审查限制

- 本审查没有重新连接数据库，不能把执行时点低敏终态写成永久环境事实；
- 全部公开表行数和固定 Catalog 探针支持限定不变量，不等于全库逐行证明；
- 恢复点证据证明归档完整性和本轮隔离恢复可用性，不是对原目标的 Restore 演练；
- 独立审查通过只准入最终 handoff，不构成 BASE-02、FK `VALIDATE`、回填或 Reader 授权。

## 12. 结论

```text
a2_p2_p1_execution_review=passed
a2_p2_complete=true
eligible_for_base02_handoff=true
eligible_for_base02_implementation=false
```

A2-P2 可以进入最终 handoff；historical orphan `1` 未清零前，不得完成 BASE-02、执行 FK
`VALIDATE` 或放行 Reader。BASE-02 当前仍未启动、未授权。

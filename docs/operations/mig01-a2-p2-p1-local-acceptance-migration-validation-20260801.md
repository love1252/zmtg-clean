# MIG-01A2 A2-P2 P1 local_acceptance Migration 执行低敏证据

## 1. 文档定位

- 内部任务：A2-P2 P1 核心 Schema／Migration 实施、执行、独立审查与 handoff
- 恢复任务：`A2-P2-P1-RESUME-AFTER-LOCAL-METADATA-DISCLOSURE-01`
- 日期与时区：`2026-08-01`，`Asia/Shanghai`
- 执行 Base：`57b77a76e55846d14a28bfdf3a8794ba67241a54`
- 状态：`current low-sensitive execution evidence`
- 当前结论：`a2_p2_p1_local_acceptance_migration_validation=passed`
- 后续准入：`eligible_for_a2_p2_p1_execution_independent_review=true`

本文记录固定 localhost-only `local_acceptance` 环境的一次受控 A2-P2 P1 Migration。本文不是
BASE-02、Writer、MIG-01B／C、Reader、外键 `VALIDATE`、回填或其他环境的授权；只有执行独立
审查和最终 handoff 完成后，才能按各自结论更新阶段状态。

本文不记录数据库真实标识符、连接参数、容器标识、角色名、Lease 标识或 Holder、恢复点路径、
原始 digest、tenant／institution 双引用、Manifest 正文、原始 SQL／Catalog 行、凭证、Secret、
Token、私钥或 PII。

## 2. 证据来源与归因边界

| 证据来源 | 本文采用的证明范围 | 不得扩大为 |
|---|---|---|
| 当前仓库 SQL、Schema、journal 与测试 | 目标对象定义、仓库 journal 目标态、snapshot 身份 | 环境已执行证明 |
| PR #849、#850 与 GitHub Actions | 四文件实现和独立审查已交付、质量门禁成功 | 数据库终态证明 |
| guarded `pnpm db:migrate` 与不可覆盖 attempt marker | 唯一执行入口、调用次数、进程结果 | 单独证明 Catalog／数据 Shape |
| 执行前后独立 READ ONLY 白名单探针 | 环境 journal、Catalog、A2-P1 与 Binding 低敏计数 | 全库逐行 bit-for-bit 等价 |
| Migration Lease Authority | 编号、Base、journal、时窗、唯一 attempt 的授权与终态 | 后续 Migration 或 BASE-02 授权 |
| PostgreSQL custom-format 恢复点工具 | 归档完整性、archive parse、隔离恢复可用性 | 对原目标执行 Restore |

所有数据库探针均在显式 READ ONLY 事务中执行，只输出固定布尔值、状态码和低敏聚合计数。

## 3. Git 与仓库前置冻结

| 项目 | 冻结值／结果 |
|---|---|
| P1 实施 PR | #849 |
| P1 实施 Head | `4b0a0f89f5aa36a9c2283a6a8af18a18fd12fe08` |
| P1 实施 Run／Job | `30645227980`／`91204848506`，成功 |
| P1 实施 Merge Commit | `036c3198ee038186c36d19f8f57a7a45b965b963` |
| 实施独立审查 PR | #850 |
| 实施独立审查 Head | `24370a0071dd40e01b5d601013e45a28f45d285c` |
| 实施独立审查 Run／Job | `30646526891`／`91209147172`，成功 |
| 实施独立审查 Merge Commit／执行 Base | `57b77a76e55846d14a28bfdf3a8794ba67241a54` |
| Required Check | “最小架构与质量门禁”，成功 |
| 工作树／并发仓库写入 | 干净／`0` |
| Migration | `0039_mig_01a2_anchor_bridge` |
| 仓库 journal | `40` 项，最新为 `0039` |
| snapshot | 仍为 `0026`，blob 未变化 |

P1 实施实际只修改一个 Migration SQL、`drizzle/meta/_journal.json`、Schema 和 Schema 测试；
没有修改 snapshot，也没有运行 `db:generate` 或创建第三个目标对象。

## 4. 执行前硬门

| 硬门 | 执行前结果 |
|---|---:|
| 固定 localhost-only 目标与数据库身份 | 通过 |
| 仓库 journal／SQL 集合 | `40／40`，完整一致 |
| 环境 Applied Migration | `39`，与仓库前 39 项精确一致 |
| 唯一 pending Migration | `0039`，数量 `1` |
| 目标 Catalog | `all_missing` |
| A2-P1 Scope／Context Version／Context Head | `1／1／1` |
| Binding 总数／NULL／重复／historical orphan | `1／0／0／1` |
| 并发 Migration 执行者／Writer | `0／0` |
| `PUBLIC TEMPORARY`／`PUBLIC CONNECT` | `false／true` |
| Migration Lease | 有效、唯一、Base／journal／编号绑定通过 |
| Migration attempt | 未存在 |

不存在部分对象、同名异定义、等价异名或未知用户依赖。historical orphan `1` 是已知历史数据，
本轮不回填、不删除、不修正，也不用于放宽外键定义。

## 5. 执行前恢复点

执行前恢复点满足：

- PostgreSQL custom format；
- 私有根目录 `0700`，归档、metadata 与日志 `0600`；
- 归档非空、archive parse 和完整性校验通过；
- 已恢复到随机隔离临时数据库；
- 隔离恢复库的 journal 前 39 项、Catalog、A2-P1、Binding 与全部公开表低敏计数通过；
- 隔离恢复库已删除，没有 Restore 原目标数据库。

## 6. 唯一受控 Migration

Migration Lease 在执行前再次核验后，先建立不可覆盖的私有 attempt marker，再且仅再调用一次：

```text
guarded pnpm db:migrate
```

执行结果：

```text
migration_attempt=1
migration_retry=0
planned=2
created=2
reused=0
conflict=0
unexpected=0
```

没有直接执行 SQL 文件、没有自动重试，也没有第二次 Migration 调用。`created／reused` 不是
Drizzle 原生 stdout：它由执行前 `all_missing`、唯一命令成功、执行后精确 `all_exact` 和
完整 journal 匹配共同推导；因此 `planned=created+reused=2`。

Migration SQL 在 Drizzle 外层单一事务中按固定顺序锁定 Binding 源表与 Scope 目标表，重新核对
Catalog、数据 Shape、A2-P1 和 predecessor journal 后创建两个对象；环境 journal 的目标项由
Migrator 在同一事务内写入。没有业务 DML、回填、`VALIDATE`、`SET NOT NULL`、`DROP`、
`CASCADE` 或第三个对象。

## 7. 执行后 Catalog

| 对象 | 执行后结果 |
|---|---|
| `auth_account_institution_bindings_scope_idx` | 精确存在 `1` 个；普通非唯一 btree；列序 `tenant_id, institution_id`；无 predicate、include 或 expression |
| `auth_account_institution_bindings_scope_fk` | 精确存在 `1` 个；源列序 `tenant_id, institution_id`；目标为 `institution_scopes(tenant_id, institution_id)`；`MATCH SIMPLE`；更新／删除均为 `NO ACTION`；非 deferrable |
| 外键 validation | `convalidated=false`，保持 `NOT VALID` |
| 部分对象／同名异定义／第三个人工对象／未知用户依赖 | `0／0／0／0` |

PostgreSQL 为外键生成的内部依赖属于目标 FK 的派生对象，不计为第三个人工目标对象。

## 8. 数据与 Migration metadata 终态

| 低敏状态 | 执行前 | 执行后 | 净变化 |
|---|---:|---:|---:|
| 环境 Applied Migration | `39` | `40` | `+1` metadata |
| A2-P1 Scope | `1` | `1` | `0` |
| A2-P1 Context Version | `1` | `1` | `0` |
| A2-P1 Context Head | `1` | `1` | `0` |
| Binding 总数 | `1` | `1` | `0` |
| Binding NULL | `0` | `0` | `0` |
| Binding 重复复合键 | `0` | `0` | `0` |
| historical orphan | `1` | `1` | `0` |
| 全部公开业务表行数 | 逐表比较 | 逐表一致 | `0` |

准确口径是“业务 DML 为 `0`；环境 Migration journal metadata 增加 `1`”。仓库 journal 在执行
前已为 40 项，不因环境执行再次修改；snapshot 继续停留在 `0026`，blob 未变化。

## 9. Lease、执行后恢复点与清理

| 项目 | 结果 |
|---|---:|
| Lease claim／consume | `1／1` |
| Migration attempt／retry | `1／0` |
| Lease renewal | `0` |
| Lease release | `1`，终态为 inactive／consumed／released |
| 执行后恢复点 | custom archive、parse、完整性与隔离恢复验证通过 |
| attempt marker | 已删除，残留 `0` |
| 私有执行日志 | 已删除，残留 `0` |
| 单次执行 Helper | 已删除，残留 `0` |
| 执行结果状态 | `outcomeKnown=true` |

执行后恢复点在随机隔离数据库中复核完整 40 项 journal、`all_exact` Catalog、FK 未验证状态、
A2-P1／Binding 与全部公开表低敏计数；隔离恢复库随后删除。获批恢复点与低敏终态记录按既定治理
保留，不属于临时泄露资产。

## 10. 披露事件与零越界

| 类别 | 数量／结果 |
|---|---:|
| 历史／自动本地运维元数据回显事件 | `2` |
| 当前主动私有参数披露 | `0` |
| Secret／Token／密码／私钥／PII／真实凭证披露 | `0` |
| 非 localhost 连接 | `0` |
| 第二次 Migration／直接 SQL 执行 | `0／0` |
| Seed／业务 DML／回填 | `0／0／0` |
| `VALIDATE`／`SET NOT NULL`／snapshot／`db:generate` | `0／0／0／0` |
| BASE-02／Writer／MIG-01B／C／Reader | 未启动 |

两次事件只累计次数，不在本文复述具体值。恢复任务后所有主动 stdout／stderr 均限定为固定状态码、
布尔值和低敏计数；没有发现真正敏感信息或非本地连接信息披露。

## 11. 结论与下一步边界

```text
a2_p2_p1_local_acceptance_migration_validation=passed
eligible_for_a2_p2_p1_execution_independent_review=true
eligible_for_a2_p2_p1_handoff=false
eligible_for_base02=false
```

下一步只能由独立审查 PR 冻结本证据 Head，复核唯一 attempt、环境 journal、精确 Catalog、业务
数据不变量、Lease、恢复点和低敏边界。本证据本身不完成 A2-P2，也不授权 BASE-02。

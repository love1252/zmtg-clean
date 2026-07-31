# 智美天工唯一下一任务

## 当前交接状态

A2-P2 复合键／索引／`NOT VALID` 关系的只读预检、P0 metadata current 校准和两轮独立审查已经完成：

- 预检 PR #843：Head `0d5cf44273d4ca6a12c857f605c8bd07e4656759`，Merge Commit
  `683668a584670bb9b9431582cb5eae918d38eee1`，Run `30633506572`／Job `91165285987` 成功；
- 独立审查 PR #844：Head `eba90d153e25f00e43651e6ce01fd8f7ef6be156`，Merge Commit
  `6460516d9a172a9bdaa5681b4b3407a7d212f54c`，Run `30634548162`／Job `91168725451` 成功；
- P0 校准 PR #846：Head `df15c70436f4cda3085847e1b221202a74a2b299`，Merge Commit
  `daf07fbd632cb4276fde911e073521483e409baf`，Run `30637892951`／Job `91180059088` 成功；
- P0 独立审查 PR #847：Head `b9632ab3a8c4bc1fb83e808f4ec98af2c75cb2e9`，Merge Commit
  `326260fec24112ffcb2ff3828c8c4398ad43f2b9`，Run `30638717649`／Job `91182885954` 成功；
- 预检使用固定 localhost-only `local_acceptance`、显式 `READ ONLY` 事务和固定 SELECT 白名单；
- P0 实际修改为运维文档 `1`、测试文件 `1`；Runtime、Schema、Migration SQL、journal、snapshot、
  数据库、CI、package 和 lock 修改均为 `0`；
- 独立审查结论为 `a2_p2_preflight_review=passed`；
- P0 独立审查结论为 `a2_p2_p0_review=passed`；面向 P1 的 handoff 准入为 `true`（仅可申请授权），Schema／Migration
  执行准入仍为 `false`。

本交接完成 P0 收口并冻结 P1 的精确对象、文件和授权边界，不构成 Schema、Migration、
数据库连接、Migration Lease、DDL 或任何后续任务的授权。

## 唯一下一任务

```text
A2-P2 P1 核心 Schema／Migration 实施
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动、尚未授权**。

P0 metadata current 口径校准、独立审查与 handoff 已完成，只关闭 P1 的一个串行前置，不表示
可以立即修改 Schema 或创建 Migration。未来仍须重新取得用户对 P1 四文件、Schema、Migration、
环境、Migration Lease、锁窗口和数据库执行的明确授权。

## 一、已冻结的 current 事实

### 1.1 目标复合主键

- 表：`public.institution_scopes`；
- 主键：`institution_scopes_pk`；
- 列序：`tenant_id, institution_id`；
- 两列均为 `varchar(64) NOT NULL`；
- backing index 为 unique btree，无 predicate／expression，状态 valid／ready；
- 未来必须复用该主键，不新增第二个 UNIQUE。

### 1.2 Binding Catalog

- 表：`public.auth_account_institution_bindings`；
- tenant／institution 列的 Catalog 序位为 `3／4`，类型均为 `varchar(64) NOT NULL`；
- 现有主键、tenant-account FK、两个业务索引和四个 CHECK 已核对；
- 用户 trigger、rule、RLS／policy、inheritance、publication、dependent view 和未知依赖均为 `0`；
- 现有两个 FK internal trigger 归因明确。

### 1.3 候选分类与数据 Shape

```text
candidate_object_classification=all_missing
planned=2
created=0
reused=0
conflict=0
unexpected=0
```

- 两个候选名称均缺失；部分对象、同名异定义、等价异名和未知依赖均为 `0`；
- Binding 总行数为 `1`；tenant／institution NULL 为 `0／0`；重复复合键为 `0`；
- 找不到 Scope 的历史关系为 `1`；它早于 A2-P1，tenant 父对象和 membership 完整；
- 该 orphan 已解释但未修复／未验证，只支持窄范围 `NOT VALID` 创建；
- Scope、Context Version 1、Context Head 1 为 `1／1／1`，三类关系异常为 `0／0／0`；
- Applied Migration 为 `39`，环境 latest 与仓库 0038 一致，A1 Schema Shape 未漂移；
- 仓库 journal 到 0038，snapshot 到 0026。

上述事实都是 PR #843 探针窗口的冻结证据。未来任务必须基于届时最新 `main` 和目标环境实时
重检，不能把它们当作永久环境状态。

## 二、精确对象 allowlist

### 2.1 普通索引

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_idx` |
| 表 | `public.auth_account_institution_bindings` |
| access method | `btree` |
| key columns | `tenant_id, institution_id` |
| unique／primary | `false／false` |
| include／predicate／expression | 无／无／无 |

### 2.2 `NOT VALID` 外键

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_fk` |
| 源 | `public.auth_account_institution_bindings(tenant_id, institution_id)` |
| 目标 | `public.institution_scopes(tenant_id, institution_id)` |
| match | `MATCH SIMPLE` |
| `ON UPDATE`／`ON DELETE` | `NO ACTION／NO ACTION` |
| deferrable／initially deferred | `false／false` |
| validation | `NOT VALID`，必须保持未验证 |

不得增加第三个对象、重复 UNIQUE、额外 CHECK、回填、重绑、`VALIDATE CONSTRAINT`、
`SET NOT NULL` 或 Reader 放行。

## 三、强制串行实施切片

### 3.1 P0：metadata current 口径校准（已完成）

P0 已通过独立授权、独立分支、独立 PR、独立 Required Check、独立审查和本 handoff 收口，实际只修改：

1. `docs/operations/drizzle-migration-snapshot-strategy.md`；
2. `src/server/db/tests/ProductionReadinessDocs.test.ts`。

P0 已删除仍停留在 0035／“不新增 0036”的旧 current 口径；current journal 改为从 `_journal.json`
最后一条 tag 动态推导并与实际 SQL 集合核验。P0 未修改 Schema、Migration、journal、snapshot 或
数据库；snapshot 0026 与 `db:generate`／snapshot-diff Migration 禁令继续保留。

### 3.2 P1：A2-P2 核心 Schema／Migration

P0 及其 handoff 已合并，但用户尚未授权 P1。未来 P1 exact file allowlist 仅为：

1. `drizzle/<Migration Lease 实时分配编号>_mig_01a2_anchor_bridge.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/schema.ts`；
4. `src/server/db/tests/Schema.test.ts`。

`0039` 只是当前下一数值候选，未批准、未预留、未占用。P1 编号必须在新的 Migration Lease 下，
以届时最新 `main`、journal 和远端并发状态实时分配。P0 与 P1 保持独立 PR。

## 四、P1 启动硬门

P1 获得明确授权后，仍须在任何改动或连接前实时证明：

1. 最新 `main`／`origin/main`、工作树、Required Check 与受保护分支无漂移；
2. P0 及其独立 handoff 已合并，且已证明没有修改 Schema／Migration／journal／snapshot；
3. A2-P1 三表继续为 `1／1／1`，关系异常为 `0／0／0`；
4. journal 仍与目标环境 latest 一致，A1 Schema Shape 未漂移；
5. 候选对象只允许为严格 `all_missing` 或严格 `all_exact`；
6. 当前 historical orphan 数量和低敏归因未发生未解释变化；
7. 当前环境、恢复点、维护窗口、执行者、权限和并发状态均获授权且可证明；
8. Migration Lease 唯一，编号、Holder、Base、journal、环境、开始、失效、释放和交接完整；
9. `lock_timeout`、`statement_timeout`、固定取锁顺序、事务、回滚和 forward-fix 已按目标环境重评；
10. P1 四文件和测试范围获得用户逐项批准。

任一项不满足时必须保持零 Schema、零 Migration、零 DDL 并停止。

## 五、事务、锁和计数边界

当前锁定版 Drizzle PostgreSQL migrator 使用外层事务包住 pending SQL 与对应 journal insert。
未来 Migration SQL 文件禁止显式 `BEGIN`、`COMMIT` 或 `ROLLBACK`，且只能通过 guarded
`pnpm db:migrate` 执行。

获批 P1 的外层事务顺序必须是：

```text
SET LOCAL lock_timeout
→ SET LOCAL statement_timeout
→ 固定顺序以 SHARE ROW EXCLUSIVE 锁定 Binding 源表与 Scope 目标表
→ 锁内重做 exact Catalog、Shape、A2-P1 与 journal guard
→ 创建／复用普通索引
→ 创建／复用 NOT VALID FK
→ 提交前复核 Catalog、convalidated=false 与 Shape
→ 同一外层事务写入 journal
→ commit
```

成功必须满足：

```text
planned = created + reused
planned=2
conflict=0
unexpected=0
```

当前固定本地小数据集的冻结候选值为 `lock_timeout=1s`、`statement_timeout=5s`；其他环境必须
重新评估，不能直接复用。不得使用 `IF NOT EXISTS`、`duplicate_object` catch、自动重试或
`CREATE INDEX CONCURRENTLY` 绕过锁和定义核验。

## 六、测试与交付门禁

P0 验证已经完成；未来 P1 至少验证：

- P0 历史证据：只改两文件、current journal 口径不再硬编码陈旧编号、snapshot 0026 和 `db:generate` 禁令保留；
- P1 Schema：索引名、非唯一、列序、无 predicate／include／expression；
- P1 Schema：FK 名、源／目标列序、引用目标、`NO ACTION／NO ACTION`；
- P1 SQL：精确索引和 `ADD CONSTRAINT ... NOT VALID`；
- 负向：无 `VALIDATE`、`SET NOT NULL`、DML、回填、DROP、CASCADE 或第二关系；
- Catalog：全缺、全量一致、部分对象、同名异定义、等价异名和未知依赖；
- 事务：失败时净对象变化 `0`，不自动重试；
- 数据：Binding 总数、NULL、重复与 orphan 计数不被 P1 改写；
- metadata：journal shape、idx／when 连续性、tag／SQL stem 一致，snapshot 文件与 blob 不变；
- `git diff --check`、架构自测、增量检查、lint、typecheck、完整测试、build 和真实 Required Check。

每个切片都必须经过独立审查和 handoff。未经用户对当次任务的 Ready／Merge 授权，不得自动
进入正式审查或合并。

## 七、停止、回滚与 forward-fix

出现以下任一情况立即停止：

- Base、Catalog、Shape、A2-P1、journal、环境或 Required Check 漂移；
- 部分对象、同名异定义、等价异名、未知 trigger／rule／RLS／依赖；
- historical orphan 数量或低敏归因发生未解释变化；
- 需要回填、重绑、`VALIDATE`、`SET NOT NULL`、第三个对象或 Reader 放行；
- P0／P1 未独立评审，或需要各自 allowlist 以外的文件；
- 编号、Migration Lease、恢复点、锁窗口、权限或数据库环境未获授权；
- 出现并发 writer、敏感输出或无法证明事务回滚。

commit 前失败必须整体回滚，净对象变化为 `0`。共享环境 commit 后发现错误时，不得修改已消费
SQL／journal 或破坏性删除对象；必须取得新编号、新 Migration Lease、新授权和新 PR，以独立
forward-fix 处理。

## 八、后续边界

- historical orphan 的修复 Owner／动作尚未授权；只能由未来独立授权的 Access Control／
  BASE-02 Binding 生命周期或专项数据修复任务明确处理；
- 禁止从 Binding 反推创建 Scope，也不得由 A2-P2／MIG-01B 静默接管；
- 清零前不得完成 BASE-02，MIG-01C 不得执行 `VALIDATE`；
- A2-P2 不启动 BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader；
- 正式平台服务端授权根继续是独立缺口，七线正式发布继续为 `0/7`；
- Schema／Migration、P1 和任何后续任务均未由本 handoff 启动或授权。

```text
A2-P2 只读预检与独立审查（已完成）
→ A2-P2 preflight handoff（已完成）
→ P0 metadata current 口径校准与独立审查（已完成，PR #846／#847）
→ P0 handoff（本次收口）
→ A2-P2 P1 核心 Schema／Migration、独立审查与 handoff（唯一下一任务，未启动、未授权）
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

未来任务不得自动启动 A2-P2 P1 核心 Schema／Migration 实施或任何后续任务。

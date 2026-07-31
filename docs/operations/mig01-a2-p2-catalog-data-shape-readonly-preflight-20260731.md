# MIG-01A2 A2-P2 Catalog／数据 Shape 只读预检

## 1. 文档定位

- 任务：`A2-P2 复合键／索引／NOT VALID 关系只读预检、独立审查与实施冻结`
- 正式任务编号：无；本轮不新增 `V2-*` 编号
- 日期与时区：2026-07-31，`Asia/Shanghai`
- 审计 Base：`053108d995e5e0b1ac3cdd7d9ff6ae9e904821ec`
- 状态：`current read-only preflight evidence + proposed implementation freeze`
- 当前结论：`a2_p2_readonly_preflight=passed`

本文只记录固定 localhost-only `local_acceptance` 环境的只读 Catalog／数据 Shape 预检，并冻结
未来 A2-P2 Schema／Migration 实施所需的 exact allowlist。本文不是 Schema、Migration、DDL、
Migration Lease、数据库写入、Reader 或其他后续阶段的授权。

本文不记录连接参数、数据库或角色标识、原始行、tenant／institution 双键、digest、凭证、
私有路径、SQL 原始结果或 PII。所有数据库输出只保留规范化对象定义、布尔值和低敏计数。

## 2. 权威事实与范围

### 2.1 `current` 事实

当前实现与环境事实依次来自：

1. `src/server/db/schema.ts`；
2. `drizzle/0037_v08_05b_b3a_real_task_readiness_foundation.sql`；
3. `drizzle/0038_mig_01a1_institution_isolation_expand.sql`；
4. `drizzle/meta/_journal.json` 与 `drizzle/meta/0026_snapshot.json`；
5. 本轮固定目标上的显式 `READ ONLY` Catalog／聚合计数探针；
6. 已合并的 A2-P1 执行证据、独立审查与最终 handoff。

### 2.2 `target` 与 accepted 边界

`docs/architecture/architecture-v2.md` 与已接受 ADR 继续决定最高级目标约束。
`docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 的 D12-A 当前只接受最小 Anchor
Bridge 方向：

- 复用 `institution_scopes(tenant_id, institution_id)` 当前复合主键；
- 为 `auth_account_institution_bindings(tenant_id, institution_id)` 增加一个普通索引；
- 增加指向 Scope 复合主键的 `NOT VALID` 外键；
- 不回填、不执行 `VALIDATE CONSTRAINT`、不执行 `SET NOT NULL`；
- 不放行 Reader，不启动 BASE-02、Writer、MIG-01B／C，也不收紧 Audit attribution／shape。

本预检只把上述已接受方向冻结为一个索引和一个外键，不建立第二套 Scope 或 Membership 事实源。

## 3. 只读探针与安全硬门

### 3.1 目标和并发

| 硬门 | 结果 |
|---|---:|
| 受控目标数量 | `1` |
| 目标身份与既有 localhost-only 冻结证据一致 | `true` |
| 回环地址以外的发布映射 | `0` |
| 本机 Docker Unix context | `true` |
| 探针前其他目标数据库 client | `0` |
| 探针前其他写锁持有者 | `0` |
| Prepared Transaction | `0` |
| 探针窗口观察到的并发 writer | `0` |

该结论只证明本次探针窗口没有观察到并发 writer；只读探针没有建立数据库排他执行 Lease，不能
把结果扩大为其他时间窗口的全局证明。未来实施仍须取得独立 Migration Lease 并重新核验并发。

### 3.2 事务与白名单

探针固定使用：

```text
REPEATABLE READ
+ READ ONLY
+ statement_timeout=5s
+ lock_timeout=1s
+ idle_in_transaction_session_timeout=5s
+ SELECT-only Catalog／聚合计数白名单
→ ROLLBACK
```

事务内核验结果：

| 项目 | 结果 |
|---|---:|
| `transaction_read_only=on` | `true` |
| isolation 为 `repeatable read` | `true` |
| 三项 timeout 精确匹配 | `true` |
| `txid_current_if_assigned()` 为空 | `true` |
| 探针结束仍为只读且未分配 transaction id | `true` |

固定 `SELECT` 白名单只覆盖：

- `pg_class`、`pg_namespace`、`pg_attribute`、`pg_type`；
- `pg_constraint`、`pg_index`、`pg_am`；
- `pg_trigger`、`pg_rewrite`、`pg_policy`、`pg_inherits`、`pg_publication_rel`；
- 与两个候选列相关的 `pg_depend`；
- `pg_stat_activity`、`pg_locks`、Prepared Transaction 和维护进度计数；
- 两张目标表、`tenants`／`tenant_members` 父事实存在性 join 及 A2-P1 三表的聚合计数；
- Drizzle migration journal 的条目数和最新项内存比对。

本轮没有运行 Runner、Adapter、Migration、Seed、Restore、`db:generate` 或 snapshot diff。

## 4. `institution_scopes` 当前 Catalog

### 4.1 双键列

| 列 | Catalog 序位 | 类型 | nullable |
|---|---:|---|---:|
| `tenant_id` | `1` | `varchar(64)` | `false` |
| `institution_id` | `2` | `varchar(64)` | `false` |

### 4.2 唯一目标

| 对象 | 类型 | 列序 | valid | deferrable |
|---|---|---|---:|---:|
| `institution_scopes_pk` | composite primary key | `tenant_id, institution_id` | `true` | `false` |

该主键的 backing index 为 `btree`、唯一、无 predicate、无 expression，状态为 valid／ready。
A2-P2 必须复用它作为外键目标，不新增重复 UNIQUE。

现有 Scope 关系还包括：

- `institution_scopes_tenant_fk`：`tenant_id → tenants.id`，`NO ACTION／NO ACTION`；
- `institution_scopes_revision_positive_check`；
- `institution_scopes_provisioning_reference_digest_length_check`。

上述约束均已验证，且与 `schema.ts` 和 0038 一致。

## 5. `auth_account_institution_bindings` 当前 Catalog

### 5.1 双键列

| 列 | Catalog 序位 | 类型 | nullable | identity／generated |
|---|---:|---|---:|---:|
| `tenant_id` | `3` | `varchar(64)` | `false` | `false／false` |
| `institution_id` | `4` | `varchar(64)` | `false` | `false／false` |

源列顺序与 Scope 目标列顺序都唯一冻结为 `tenant_id, institution_id`。

### 5.2 当前索引

| Catalog 对象 | 列序 | 类型 | predicate |
|---|---|---|---:|
| `auth_account_institution_bindings_pkey` | `id` | unique primary btree | 无 |
| `auth_account_institution_bindings_account_tenant_status_idx` | `account_id, tenant_id, status` | 普通 btree | 无 |
| `auth_account_institution_bindings_active_account_tenant_unique_` | `account_id, tenant_id` | unique btree | `status = 'active'` |

第三个名称是 PostgreSQL 对仓库声明长标识符的 63-byte Catalog 截断；其列序、唯一性和 predicate
与 0037／`schema.ts` 一致。该既有可解释差异不占用本次两个候选名称，也不构成同名异定义。

当前不存在以 `tenant_id, institution_id` 为精确 key columns 的普通、无 predicate btree 索引。

### 5.3 当前约束与辅助对象

现有约束精确为：

| 名称 | 类型／定义 | validated | deferrable |
|---|---|---:|---:|
| `auth_account_institution_bindings_pkey` | `PRIMARY KEY (id)` | `true` | `false` |
| `auth_account_institution_bindings_tenant_account_fk` | `(tenant_id, account_id) → tenant_members(tenant_id, user_id)`，`NO ACTION／NO ACTION` | `true` | `false` |
| `auth_account_institution_bindings_status_shape_check` | active／revoked 状态形状 | `true` | `false` |
| `auth_account_institution_bindings_expiry_check` | expiry 晚于 assigned | `true` | `false` |
| `auth_account_institution_bindings_source_authority_check` | active 来源白名单 | `true` | `false` |
| `auth_account_institution_bindings_version_positive_check` | version 为正数 | `true` | `false` |

| 辅助对象 | 计数／状态 |
|---|---:|
| 用户 trigger | `0` |
| 既有 FK 生成的 internal trigger | `2` |
| rule | `0` |
| RLS enabled／forced | `false／false` |
| policy | `0` |
| inheritance／partition dependency | `0` |
| publication membership | `0` |
| 双键列 dependent view | `0` |
| 未知依赖 | `0` |

因此当前 Catalog 没有未知 trigger、rule、RLS、view、publication 或依赖阻断。

## 6. 候选对象四分类

本轮使用 proposed decision pack 已存在、且没有超出 PostgreSQL 标识符长度限制的名称：

- `auth_account_institution_bindings_scope_idx`；
- `auth_account_institution_bindings_scope_fk`。

精确名称、等价异名和 schema 范围名称冲突计数均为 `0`。分类结果：

```text
candidate_object_classification=all_missing
planned=2
created=0
reused=0
conflict=0
unexpected=0
```

`created=0／reused=0` 是本次只读预检的零 DDL 结果，不是未来实施计数。未来实施成功必须满足
`planned = created + reused`，且 `conflict=unexpected=0`。

未来不得使用 `CREATE INDEX IF NOT EXISTS` 或捕获 `duplicate_object` 后静默成功；这两种写法只
比较名称，可能掩盖同名异定义。未来 Catalog guard 必须先比较对象类型、名称、列序、引用目标、
predicate、validation 状态和依赖，再选择全缺创建或全量一致复用。部分对象、同名异定义、等价
异名或未知依赖一律停止，不得改名绕过。

## 7. 数据 Shape 低敏计数

### 7.1 Binding 聚合

| 计数 | 结果 |
|---|---:|
| 总行数 | `1` |
| `tenant_id` NULL | `0` |
| `institution_id` NULL | `0` |
| 任一双键 NULL | `0` |
| 重复复合键分组 | `0` |
| 重复涉及行 | `0` |
| 重复 excess 行 | `0` |
| 找不到 Scope 锚点的历史关系 | `1` |

### 7.2 历史关系归因

孤儿关系只做低敏、无值归因：

| 核验 | 结果 |
|---|---:|
| distinct orphan pair | `1` |
| 全部早于 A2-P1 Scope 创建 | `true` |
| tenant 父对象缺失 | `0` |
| tenant membership 缺失 | `0` |
| active／revoked | `1／0` |

该行是 A2-P1 前已存在、仍满足当前 tenant/member FK 的历史 Binding，不是本轮或 A2-P1 新增。
它解释了为什么目标关系必须保持 `NOT VALID`：创建时不扫描或改写历史行，后续新增／相关双键
更新才立即受约束。该历史行同时意味着：

- A2-P2 不得夹带回填、重绑、`VALIDATE` 或删除；
- BASE-02 对缺少 active Scope 的 Binding 必须继续 fail-closed；
- MIG-01B／C 前仍须通过独立归属与回填流程清零，再申请验证关系；
- 若未来实施前孤儿计数、时间归因或 tenant/member 完整性发生变化，必须停止并重新审计。

因此当前 Shape 支持“只新增 `NOT VALID` 关系”的窄范围方案，但不支持验证该关系，也不支持
Reader 放行。普通索引不是 UNIQUE，未来即使出现重复组也不能用该索引宣称业务唯一性。

## 8. A2-P1、Journal 与 Schema Shape 不变量

| 项目 | 结果 |
|---|---:|
| Institution Scope | `1` |
| Context Version | `1` |
| Context Head | `1` |
| Version → Scope orphan | `0` |
| Head → Scope orphan | `0` |
| Head → Version orphan | `0` |
| 环境 Applied Migration | `39` |
| 环境最新 migration 与仓库 0038 一致 | `true` |
| A1 核心 PK／FK 数 | `7` |
| A1 三表、enum、列、PK／FK／CHECK shape | 与 0038／`schema.ts` 一致 |

A2-P1 三表继续保持 `1／1／1` 收口状态，Journal 与 A1 Schema Shape 未漂移。本轮没有改变
tenant 父表、A2-P1 三表、Binding 或任何其他数据。

## 9. 冻结的 exact implementation allowlist

### 9.1 普通索引

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_idx` |
| 表 | `public.auth_account_institution_bindings` |
| access method | `btree` |
| key columns | `tenant_id, institution_id` |
| include columns | 无 |
| unique／primary | `false／false` |
| predicate／expression | 无／无 |

### 9.2 `NOT VALID` 外键

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_fk` |
| 源表 | `public.auth_account_institution_bindings` |
| 源列序 | `tenant_id, institution_id` |
| 目标表 | `public.institution_scopes` |
| 目标列序 | `tenant_id, institution_id` |
| match | `MATCH SIMPLE` |
| `ON UPDATE`／`ON DELETE` | `NO ACTION／NO ACTION` |
| deferrable／initially deferred | `false／false` |
| validation | `NOT VALID`，必须保持未验证 |

Scope 当前复合主键已提供唯一引用目标；不得新增第二个 UNIQUE、CHECK 或其他关系。未来 Schema
配置负责表达逻辑 FK，但 Drizzle 配置没有 `NOT VALID` 表达位，因此必须由获审手写 SQL 锁定
未验证状态，禁止用 `db:generate` 或 snapshot diff 生成默认 validated FK。

## 10. Future Migration、metadata 与编号

### 10.1 当前 metadata

- 仓库 journal 共 `39` 项，最新为 `0038_mig_01a1_institution_isolation_expand`；
- 最新 snapshot 仍为 `0026_snapshot.json`，不覆盖 0037／0038；
- `docs/operations/drizzle-migration-snapshot-strategy.md` 及其锁定测试仍停在 0035／“不新增
  0036”的旧 current 口径；
- 该文档漂移必须在首个 journal-backed A2 切片**之前**，通过独立前置任务和独立 PR 纠正；
  不得与业务 Schema／Migration 同一 PR 评审，也不得借机生成或伪造 snapshot。

当前 `_journal.json` 结构精确为：

| 维度 | 当前值 |
|---|---|
| 顶层键 | `version, dialect, entries` |
| `version`／`dialect` | `7／postgresql` |
| entry 键 | `idx, version, when, tag, breakpoints` |
| idx | `0..38` 连续 |
| entry version／breakpoints | 全部 `7／true` |
| `when` | 严格递增 |
| tag／SQL | 39 项一一对应 |

### 10.2 冻结策略

未来必须按两个独立评审单元串行交付：

```text
P0：独立校准 current metadata 策略文档与锁定测试
→ 独立 handoff
→ 重新取得 Migration Lease 并实时分配编号
→ P1：获审手写 SQL + journal 新条目 + schema.ts 逻辑定义 + 精确 Schema／SQL 测试
```

`0026_snapshot.json` 及所有既有 snapshot blob 必须保持不变。继续禁止 `db:generate`、
snapshot-diff Migration、手改已消费 SQL／journal 或全量 metadata 重建。

Migration 编号必须在未来用户授权的 Migration Lease 下，基于届时最新 `main`、journal 和远端
并发状态实时分配。`0039` 只是当前下一数值候选，本预检不批准、不预留、不占用该编号。

未来 journal entry 必须保持顶层 `version=7`、`dialect=postgresql`，entry 仍只含上述五个键；
`idx` 与文件编号在 Lease 下实时分配，`tag` 必须与 SQL 文件 stem 完全一致，`version=7`、
`breakpoints=true`，`when` 在分配时生成且严格大于当前最后一项。不得为预占编号提前写 entry。

## 11. 未来实施文件 allowlist

### 11.1 P0：metadata current 口径独立前置 PR

P0 只允许：

1. `docs/operations/drizzle-migration-snapshot-strategy.md`；
2. `src/server/db/tests/ProductionReadinessDocs.test.ts`。

P0 必须独立授权、独立分支、独立 PR、独立 Required Check 和独立 handoff；不得修改 Schema、
Migration、journal 或 snapshot。它应把策略改为从当前 journal 事实取值、避免继续硬编码陈旧
latest 编号，同时保留 snapshot 0026 与 `db:generate` 禁令。

### 11.2 P1：A2-P2 Schema／Migration 核心 PR

P0 及其 handoff 合并后，P1 才能申请 Schema／Migration、环境与 Migration Lease 授权。P1
只允许：

1. `drizzle/<Lease 实时分配编号>_mig_01a2_anchor_bridge.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/schema.ts`；
4. `src/server/db/tests/Schema.test.ts`。

两个 allowlist 都是精确路径，不是通配写权限；P0 与 P1 不得合并为同一 PR。不得修改任何
snapshot、Runtime、API、UI、Runner、Adapter、package、lock、CI、BASE-02、Writer、Audit、
MIG-01B／C 或 Reader。任一单元需要其 allowlist 外文件时，必须停止并重新授权。

## 12. DDL 事务、锁与失败边界

### 12.1 冻结顺序

当前锁定版 Drizzle PostgreSQL migrator 会用外层 transaction 包住 pending SQL 与对应 journal
insert。未来 migration SQL 文件禁止自带 `BEGIN`、`COMMIT` 或 `ROLLBACK`，并且只能通过
guarded `pnpm db:migrate` 执行。外层事务内必须按以下顺序执行：

```text
Drizzle migrator 外层 transaction
→ SET LOCAL lock_timeout = 1000ms
→ SET LOCAL statement_timeout = 5000ms
→ 按固定顺序锁定 bindings 源表与 institution_scopes 目标表
→ 在锁内重做 exact Catalog、低敏 Shape、A2-P1 与 journal guard
→ 创建／复用普通 btree 索引
→ 创建／复用 NOT VALID FK
→ 提交前复核 exact Catalog、convalidated=false 与 Shape 计数不漂移
→ 同一外层事务写入 migration journal
→ 外层 transaction commit
```

Catalog 为当前 `all_missing` 时，未来预计 `planned=2／created=2／reused=0`；如果实施时变为
`all_exact`，只能在同一外层事务内完成严格定义一致核验，不执行 DDL，预计
`planned=2／created=0／reused=2`。guard、创建／复用、postcheck 和 journal insert 之间不得
脱离该事务；不得使用名称级 `IF NOT EXISTS` 或 `duplicate_object` catch。

### 12.2 锁窗口

- 普通 `CREATE INDEX` 与 `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` 均必须在已批准低流量
  窗口执行；
- 先以固定顺序取得源表、目标表所需的 `SHARE ROW EXCLUSIVE` 级锁，关闭 Catalog guard 到
  DDL 的并发窗口；
- 先建立支持索引，再添加外键；
- `lock_timeout=1s`，取锁超时立即整体失败；
- `statement_timeout=5s`，不得自动重试或切换 `CONCURRENTLY`；
- 未来非当前固定本地环境必须重新评估 timeout 和维护窗口，不得直接沿用。

本预检只冻结语义，不执行上述 DDL。

### 12.3 回滚与 forward-fix

- commit 前任一步失败：事务整体回滚，净对象变化必须为 `0`；
- 不得使用破坏性 down、删除历史数据、回填或修改旧 journal；
- 已在共享环境提交后发现错误：停止使用旧编号，以新 Migration、新 Lease、新授权和新 PR 做
  forward-fix；
- 不得通过改名创建第二套等价对象来规避冲突。

## 13. 必测清单

未来实施至少必须覆盖：

1. Schema：索引名、普通非唯一、列序、无 predicate／include／expression；
2. Schema：FK 名、源／目标列序、目标表、`NO ACTION／NO ACTION`；
3. SQL：精确索引与 `ADD CONSTRAINT ... NOT VALID`；
4. SQL 负向：无 `VALIDATE`、`SET NOT NULL`、DML、回填、DROP、CASCADE 或第二关系；
5. Catalog：全缺、全量一致、部分对象、同名异定义、等价异名和未知依赖；
6. 计数：`planned = created + reused`，`conflict=unexpected=0`；
7. 事务：失败时净对象变化 `0`，不自动重试；
8. 数据：Binding 总数、NULL、重复和 orphan 聚合计数不被实施改写；
9. A2-P1：三表 `1／1／1`、关系异常 `0`、Journal／Shape 不变；
10. metadata P0：仅两文件、旧 current 口径完成校准、独立 handoff，不伪造 snapshot；
11. metadata P1：journal 顶层／entry shape、idx／when 连续性、tag 与 SQL stem 一致，snapshot
    文件集合与 0026 blob 不变；
12. `git diff --check`、架构自测、增量架构检查、lint、typecheck、完整测试、build 和真实
    Required Check 全部实际通过。

## 14. 实施停止条件

未来出现任一情况必须保持零 DDL 并停止：

- Base、A2-P1 `1／1／1`、Journal、Schema Shape 或 Required Check 漂移；
- 候选不再是 `all_missing` 或严格 `all_exact`；
- 部分对象、同名异定义、等价异名、未知 trigger／rule／RLS／依赖；
- Binding NULL、重复或 orphan 计数发生未解释变化；
- 当前 1 条历史 orphan 不再满足“早于 A2-P1 且 tenant/member 完整”的低敏归因；
- 需要回填、重绑、`VALIDATE`、`SET NOT NULL`、Reader 放行或新增第三个对象；
- Migration 编号、Lease、执行环境、恢复点、锁窗口或权限未获明确授权；
- P0／P1 未分开评审，或需要修改各自 exact allowlist 外内容、运行 `db:generate`；
- 出现数据库并发 writer、敏感输出或无法证明事务回滚。

## 15. 零越界与预检结论

| 类别 | 结果 |
|---|---:|
| Schema／Migration／journal／snapshot 修改 | `0` |
| DDL／DML／Migration／Seed／Restore | `0` |
| Migration Lease／编号占用 | `0／0` |
| 角色／ACL／Runner／Adapter 修改 | `0` |
| Runtime／tests／CI／package／lock 修改 | `0` |
| 原始行、双键、连接参数、凭证或 PII 输出 | `0` |
| BASE-02／Writer／MIG-01B／C／Reader | 未启动 |

```text
a2_p2_readonly_preflight=passed
eligible_for_a2_p2_independent_review=true
eligible_for_a2_p2_implementation_handoff=false
eligible_for_schema_migration_execution=false
```

当前 Catalog 为 `all_missing`，对象名称、列序和关系定义已经唯一；A2-P1、Journal 与 Shape 未
漂移；既有 1 条历史 orphan 的低敏归因可解释，支持只创建 `NOT VALID` 关系，但继续阻断
`VALIDATE`、回填、BASE-02 和 Reader。本预检只能进入独立审查，不能直接进入 Schema／Migration
实施或数据库执行。

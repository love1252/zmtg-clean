# MIG-01A2 A2-P2 P1 Schema／Migration 实施独立审查

## 1. 文档定位

- 审查日期：2026-07-31（Asia/Shanghai）。
- 审查对象：PR #849。
- PR Base：`f2e380e6a2efc5893cf160994ecc52a8fcc05cdd`。
- PR Head：`4b0a0f89f5aa36a9c2283a6a8af18a18fd12fe08`。
- PR tree：`4dab6d0244030fdf36e2a7a7ada0f7fc28fc0bb0`。
- Merge Commit：`036c3198ee038186c36d19f8f57a7a45b965b963`。
- Required Check：Run `30645227980`／Job `91204848506`，结论为 `success`。
- 本文只记录仓库低敏静态审查证据，不是数据库 Migration 执行证据，也不授权 BASE-02。

审查冻结 PR #849 的四文件实现，核对实时 Migration 编号与 Lease 边界、Schema／SQL／journal
一致性、snapshot 不变量、失败事务、对象 allowlist、历史 orphan 和禁止项。审查未连接数据库，
未运行 `pnpm db:migrate`、`db:generate`、Migration、Seed、DDL 或 DML。

## 2. 审查范围与文件身份

PR #849 相对冻结 Base 精确为 1 个提交、4 个文件：

| 文件 | blob | 审查结论 |
|---|---|---|
| `drizzle/0039_mig_01a2_anchor_bridge.sql` | `29d341a7812088c3fe89ff9302a50696c6c1e38a` | 允许 |
| `drizzle/meta/_journal.json` | `b261e8d3f62fcc897000dc89739657cfeb931c2c` | 允许 |
| `src/server/db/schema.ts` | `8ba412665b8083541be9b111a0586eb06a9a1966` | 允许 |
| `src/server/db/tests/Schema.test.ts` | `63b6125328cd6570de034b8deb6bafbcb4027337` | 允许 |

未修改 Runtime、API、UI、Runner、Adapter、package、lock、CI 或其他测试。最新 snapshot
`drizzle/meta/0026_snapshot.json` 在 Base 与 Head 的 blob 均为
`426d116ca1dbe355d3312a66acb3277c890a9909`，没有生成或修改 snapshot。

## 3. 实时编号与 Migration Lease

实时冻结确认仓库 journal、SQL 文件集合与固定 local_acceptance 环境 latest 在实施前均停留于既有
0038，下一可用编号唯一为 `0039`。PR #849 使用：

- 编号：`0039`；
- tag：`0039_mig_01a2_anchor_bridge`；
- journal idx：`39`；
- SQL stem、journal idx／tag／when 相互一致；
- 没有预先沿用 P0 或预检阶段的候选编号。

Lease 只按低敏布尔项审查：

```text
lease_unique=true
task_bound=true
holder_bound=true
base_bound=true
journal_bound=true
sql_set_bound=true
environment_bound=true
number_bound=true
file_allowlist_bound=true
expiry_bound=true
handoff_bound=true
```

审查未记录 Holder、Lease 标识、私有路径、签名、连接参数或其他私有引用。Lease 在数据库执行前
仍须重新核验有效性、唯一性和当前修订；本审查不构成 Lease 消费。

## 4. 精确对象审查

### 4.1 普通索引

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_idx` |
| 表 | `public.auth_account_institution_bindings` |
| access method | `btree` |
| key columns | `tenant_id, institution_id` |
| unique／primary | `false／false` |
| include／predicate／expression | 无／无／无 |

### 4.2 `NOT VALID` 外键

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_fk` |
| 源 | `public.auth_account_institution_bindings(tenant_id, institution_id)` |
| 目标 | `public.institution_scopes(tenant_id, institution_id)` |
| match | `MATCH SIMPLE` |
| update／delete | `NO ACTION／NO ACTION` |
| deferrable／initially deferred | `false／false` |
| validation | `NOT VALID`，必须保持未验证 |

Schema 表达普通双键索引和 Scope 双键关系；手写 SQL 单独锁定 `NOT VALID`。两处定义的对象名称、
源列序、目标列序和动作一致，没有第三个索引、约束或关系。

## 5. SQL 事务、锁与 fail-closed 审查

SQL 文件依赖受控 migrator 的单一外层事务，没有显式 `BEGIN`、`COMMIT` 或 `ROLLBACK`。事务内：

1. 设置 `lock_timeout='1s'` 与 `statement_timeout='5s'`；
2. 固定 `search_path=pg_catalog,public`；
3. 先锁定 Binding 源表，再锁定 Scope 目标表；
4. 锁内重新核验 predecessor journal、Catalog、列 Shape、约束／索引已知集合、A2-P1 终态、
   Binding 数据 Shape和 historical orphan 归因；
5. 只在严格 `all_missing` 时创建两个对象；
6. 只在严格 `all_exact` 时复用两个对象；
7. 创建或复用后再次核验对象定义、计数与数据 Shape。

以下状态均 fail-closed：部分对象、同名异定义、等价异名、未知对象／依赖、锁超时、predecessor
journal 不一致、Shape 漂移、A2-P1 漂移、orphan 归因漂移或提交前重检失败。事务失败时目标对象净变化
应为 0；不得自动重试，也不得以 `IF NOT EXISTS` 或 duplicate catch 掩盖冲突。

## 6. Catalog 与 Shape 守卫审查

静态守卫覆盖并锁定：

- `institution_scopes` 复合主键名称、列序、唯一 btree backing index、validation 与 deferrable；
- Binding 主键、tenant-account 外键、既有索引和四个 CHECK 的精确已知集合；
- PostgreSQL 63-byte Catalog 截断后的既有长索引名；
- Binding 与 Scope 目标列的名称、序位、类型和 nullable；
- trigger、rule、RLS／policy、inheritance、publication 和未知依赖均无额外对象；
- A2-P1 Scope／Context Version／Context Head 保持 `1／1／1`，三类关系异常为 0；
- Binding 总数 1、NULL 0、重复 0、historical orphan 1；
- historical orphan 为 active、早于现有 Scope，且 tenant 与 membership 父对象完整。

historical orphan 只被识别、归因和守恒核对，未被回填、重绑、删除或验证。它继续阻断 BASE-02
完成、FK `VALIDATE` 和 Reader 放行。

## 7. Schema／SQL／journal 一致性

- journal 顶层 version／dialect 保持不变，idx `0..39` 连续且 tag 与 SQL 集合一一对应；
- 0039 `when` 严格晚于 0038，idx／tag 与 SQL stem 一致；
- SQL 锁定 predecessor journal 的条目数、latest `when` 与 predecessor 文件摘要；
- Schema 与 SQL 的索引名称、列序、引用目标和更新／删除动作一致；
- `NOT VALID` 只存在于手写 SQL，避免把逻辑 Schema 误写成已验证环境事实；
- snapshot 未修改，未运行 `db:generate` 或 snapshot-diff Migration。

## 8. 禁止项与测试审查

SQL 不包含：

- DML、回填或历史数据验证；
- `VALIDATE CONSTRAINT`；
- `SET NOT NULL`；
- `DROP` 或 `CASCADE`；
- `CREATE INDEX CONCURRENTLY`；
- `IF NOT EXISTS`、duplicate catch 或自动重试；
- UPDATE／DELETE／INSERT／UPSERT／TRUNCATE；
- 第三个目标对象。

`Schema.test.ts` 共 69 项定向断言，锁定四文件范围、journal 连续性与 predecessor 身份、snapshot
不变量、对象名称、列序、普通非唯一索引、无 predicate、`NOT VALID`、`NO ACTION`、锁顺序、
timeout、all-missing／all-exact、known-set 前后边界、完整 CHECK 表达式、historical orphan 归因及
全部禁止项。全局只允许两次动态 `EXECUTE`，对应一个索引和一个外键。

## 9. 验证与 Required Check

PR #849 冻结 Head 已通过：

- 定向 Schema 测试：69／69；
- 架构检查器自测：67／67；
- 增量架构检查；
- lint（0 error）；
- typecheck；
- 完整测试：422 个文件、6192 个测试；
- build：101／101；
- `git diff --check`。

Required Check Run `30645227980`／Job `91204848506` 对应冻结 Head，环境核对、依赖安装、架构
自测、增量检查、lint、typecheck、完整测试和 build 均实际执行并成功；build 未跳过，也没有
`continue-on-error`。

PR #849 已使用 Merge Commit 合并；该 Merge Commit 的两个父提交分别为冻结 Base 与冻结 Head，
Merge tree 与冻结 Head tree 一致。

## 10. 发现项与边界

```text
blocking_findings=0
non_blocking_findings=0
```

独立复核没有发现需要修改第五个文件、改变对象定义、放宽关系或连接数据库的发现。运行时 Catalog
若与冻结事实不符，Migration 必须由精确守卫整体拒绝；当前静态通过不把预检时点数据库事实扩大为
永久事实。

本审查没有执行数据库 Migration，没有创建目标索引或 FK，没有写环境 migration journal，也没有
处理 historical orphan。只有 PR #849 与本审查均合并、Lease／恢复点／环境硬门重新通过后，才可
进入固定 local_acceptance 的唯一 guarded Migration。

## 11. 审查结论

```text
a2_p2_p1_implementation_review=passed
eligible_for_local_acceptance_migration=true
eligible_for_base02=false
```

该结论只表示四文件实现具备进入后续 local_acceptance 执行硬门的静态条件。它不授权直接执行
SQL、不允许第二次 Migration 尝试，也不授权 BASE-02、Writer、MIG-01B／C、FK `VALIDATE` 或
Reader 放行。

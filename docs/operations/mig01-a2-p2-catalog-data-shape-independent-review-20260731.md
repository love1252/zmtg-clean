# MIG-01A2 A2-P2 Catalog／数据 Shape 预检独立审查

## 1. 文档定位

- 任务：`A2-P2 复合键／索引／NOT VALID 关系只读预检、独立审查与实施冻结`
- 正式任务编号：无；本轮不新增 `V2-*` 编号
- 阶段：A2-P2 只读预检独立审查
- 日期与时区：2026-07-31，`Asia/Shanghai`
- 审查 Base：`683668a584670bb9b9431582cb5eae918d38eee1`
- 审查方式：docs-only、独立只读复核
- 审查结论：`passed`

本审查冻结已合并的 A2-P2 只读预检证据，独立核对 Catalog 归因、对象名称与列序、数据 Shape、
`NOT VALID` 边界、metadata 前置拆分、未来事务与锁方案及 exact file allowlist。审查没有重新
连接数据库，没有运行 Catalog 探针，也没有执行 Schema、Migration、DDL、DML、Seed、Restore、
`db:generate` 或 Migration Lease。

本文不记录连接参数、数据库或角色标识、原始行、tenant／institution 双键、digest、凭证、
私有路径、SQL 原始结果或 PII。

## 2. 冻结审查对象

| 项目 | 冻结值 |
|---|---|
| 预检 PR | #843 |
| PR Base | `053108d995e5e0b1ac3cdd7d9ff6ae9e904821ec` |
| PR Head | `0d5cf44273d4ca6a12c857f605c8bd07e4656759` |
| Merge Commit | `683668a584670bb9b9431582cb5eae918d38eee1` |
| Required Check | Run `30633506572`／Job `91165285987`，成功 |
| 提交／文件 | `1／1` |
| 合并方式 | Merge Commit |
| 预检文件 | `docs/operations/mig01-a2-p2-catalog-data-shape-readonly-preflight-20260731.md` |
| 预检 blob | `80a03d36d2c1441c5dc15e04c9c939aa662dc487` |

Merge Commit 的两个父提交分别为冻结 PR Base 与 PR Head，Merge tree 与 PR Head tree 一致。
PR #843 合并前没有评论、Review 或未解决 thread；环境核对、依赖安装、架构检查器自测、增量
架构检查、lint、typecheck、完整测试和 build 均实际成功，build 未跳过。

## 3. 审查方法与事实边界

独立审查采用四层交叉核对：

1. 以冻结 blob 逐项核对只读事务、SELECT 白名单、Catalog、Shape、A2-P1 与 journal 计数；
2. 以 `schema.ts`、0037、0038 和 journal／snapshot 静态证据核对对象定义与 metadata 归因；
3. 以 accepted decisions、decision pack 和 A2-P1 handoff 核对 `NOT VALID`、P0／P1 和阶段边界；
4. 以当前锁定版 Drizzle PostgreSQL migrator 行为核对外层事务、journal insert 和 SQL 文件限制。

审查只判断预检证据是否完整、一致且足以进入 handoff。预检时点的数据库事实不是长期保证，
未来任一实施单元仍必须重新冻结 Base、环境、Catalog、Shape、journal、并发和权限。

## 4. 发现项

```text
blocking_findings=0
non_blocking_findings=0
```

审查过程中识别出的 metadata 独立评审边界、SQL 文件显式事务控制、Catalog guard 的 TOCTOU、
timeout 顺序、SELECT 白名单和 journal shape 问题，均已在 PR #843 的冻结 Head 中关闭。没有遗留
需要修正预检报告、扩大文件范围或重新连接数据库的发现。

## 5. Catalog 与对象身份审查

### 5.1 目标复合键

| 核验项 | 冻结值 | 审查 |
|---|---|---|
| 目标表 | `public.institution_scopes` | 通过 |
| 目标主键 | `institution_scopes_pk` | 通过 |
| 列序 | `tenant_id, institution_id` | 通过 |
| 类型／nullable | 两列均为 `varchar(64)`／非空 | 通过 |
| backing index | unique btree、无 predicate／expression | 通过 |
| validation／deferrable | `true／false` | 通过 |

目标复合主键已提供唯一引用目标，不需要也不允许新建第二个 UNIQUE。

### 5.2 Binding 当前 Shape

`auth_account_institution_bindings` 的 `tenant_id`／`institution_id` 分别处于 Catalog 序位 3／4，
均为 `varchar(64) NOT NULL`。现有主键、tenant-account 外键、两个业务索引和四个 CHECK 的名称、
列序、predicate、validation 与 deferrable 状态均已冻结；长索引名的 63-byte Catalog 截断与仓库
定义一致，未占用候选名称。

辅助对象核验结果为：用户 trigger 0、rule 0、RLS／policy 0、inheritance 0、publication 0、
dependent view 0、未知依赖 0。现有 internal trigger 2 均由既有外键生成，归因明确。

### 5.3 候选四分类

```text
candidate_object_classification=all_missing
planned=2
created=0
reused=0
conflict=0
unexpected=0
```

两个精确候选名称均缺失，等价异名、schema 范围同名冲突和未知依赖均为 0；不存在部分对象或
同名异定义。未来不得使用 `IF NOT EXISTS` 或 `duplicate_object` catch 掩盖定义冲突。

## 6. 数据 Shape 与历史 orphan 审查

| 低敏计数 | 冻结值 | 审查 |
|---|---:|---|
| Binding 总行数 | `1` | 通过 |
| tenant／institution NULL | `0／0` | 通过 |
| 任一双键 NULL | `0` | 通过 |
| 重复复合键分组／行／excess | `0／0／0` | 通过 |
| 找不到 Scope 的历史关系 | `1` | 已解释 |

该历史 orphan 早于 A2-P1 Scope 创建，tenant 父对象与 tenant membership 均存在，且不是 A2-P1
或本预检新增。它是“已解释但未修复／未验证”的历史完整性缺口，不属于无法解释的数据 Shape。

PostgreSQL `NOT VALID` 关系创建时不扫描既有行，但约束后续新增或相关双键更新。因此该 Shape：

- 支持本次冻结的窄范围 `ADD ... NOT VALID`；
- 不支持 `VALIDATE`、回填、重绑、删除、`SET NOT NULL` 或 Reader 放行；
- 继续阻断 BASE-02 完成及对该 Binding 签发授权上下文；
- 必须由未来 MIG-01B 的独立授权归属、回填与冲突清零流程处理，并在 MIG-01C 前清零；
  清零前不得完成 BASE-02，也不得在 MIG-01C 执行 `VALIDATE`。

未来实施前若 orphan 计数或低敏归因发生变化，必须停止并重新审计，不能沿用本结论。

## 7. 精确索引与 `NOT VALID` 外键审查

### 7.1 普通索引

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_idx` |
| 表 | `public.auth_account_institution_bindings` |
| access method | `btree` |
| key columns | `tenant_id, institution_id` |
| unique／primary | `false／false` |
| include／predicate／expression | 无／无／无 |

### 7.2 外键

| 属性 | 冻结值 |
|---|---|
| 名称 | `auth_account_institution_bindings_scope_fk` |
| 源表／列序 | `public.auth_account_institution_bindings(tenant_id, institution_id)` |
| 目标表／列序 | `public.institution_scopes(tenant_id, institution_id)` |
| match | `MATCH SIMPLE` |
| `ON UPDATE`／`ON DELETE` | `NO ACTION／NO ACTION` |
| deferrable／initially deferred | `false／false` |
| validation | `NOT VALID`，必须保持未验证 |

对象名称、源列序和目标列序均唯一，关系没有夹带额外 CHECK、UNIQUE 或第三个对象。Drizzle Schema
只表达逻辑关系，手写 SQL 必须锁定 `NOT VALID`；禁止 `db:generate` 和 snapshot-diff Migration。

## 8. A2-P1 与 metadata 不变量审查

| 项目 | 冻结值 | 审查 |
|---|---:|---|
| Scope／Context Version／Context Head | `1／1／1` | 通过 |
| 三类 A2-P1 关系异常 | `0／0／0` | 通过 |
| 环境 Applied Migration | `39` | 通过 |
| 环境 latest 与仓库 0038 | 一致 | 通过 |
| A1 核心 PK／FK | `7` | 通过 |
| A1 Schema Shape | 与 0038／`schema.ts` 一致 | 通过 |

仓库 journal 顶层为 `version=7`、`dialect=postgresql`，39 项 entry 的 idx 为 `0..38`，tag 与 SQL
一一对应，`when` 严格递增；snapshot 仍停在 0026。`0039` 仅是当前数值候选，没有被批准、
预留或占用。

已接受的 metadata 策略必须分两个独立评审单元：

```text
P0：独立校准 current metadata 策略文档与锁定测试
→ 独立 handoff
→ 重新取得 Migration Lease 并实时分配编号
→ P1：A2-P2 Schema／Migration 核心 PR
```

P0 只允许策略文档与锁定测试两个文件；P1 只允许获 Lease 编号的 SQL、`_journal.json`、
`schema.ts` 和 `Schema.test.ts`。两者不得合并评审，snapshot 0026 及既有 snapshot blob 保持不变。

## 9. 未来事务、锁与计数审查

当前锁定版 Drizzle PostgreSQL migrator 以外层事务包住 pending SQL 和对应 journal insert。
Migration SQL 文件不得包含显式 `BEGIN`、`COMMIT` 或 `ROLLBACK`，且只能经 guarded
`pnpm db:migrate` 执行。

外层事务内顺序已冻结为：先设置 `lock_timeout=1s` 和 `statement_timeout=5s`，再按固定顺序取得
源表与目标表的 `SHARE ROW EXCLUSIVE` 级锁，然后在锁内重做 exact Catalog、低敏 Shape、A2-P1
与 journal guard，创建／复用索引和外键，提交前复核 Catalog、`convalidated=false` 与 Shape，
最后由同一外层事务写 journal 并提交。

成功计数必须满足：

```text
planned = created + reused
planned=2
conflict=0
unexpected=0
```

`all_missing` 预计 `created=2／reused=0`；严格 `all_exact` 预计 `created=0／reused=2` 且不执行
DDL。部分对象、同名异定义、等价异名、未知依赖、锁超时或提交前漂移均必须整体回滚且不重试。
共享环境 commit 后的问题只能在新 Lease、新编号、新授权和新 PR 下 forward-fix。

## 10. 范围与零执行审查

| 类别 | 结果 |
|---|---:|
| 预检 PR 修改文件 | `1` 个 Markdown |
| Schema／Migration／journal／snapshot 修改 | `0` |
| DDL／DML／Migration／Seed／Restore | `0` |
| Migration Lease／编号占用 | `0／0` |
| Runtime／脚本／测试／CI／package／lock 修改 | `0` |
| 角色／ACL／Runner／Adapter 修改 | `0` |
| 原始行、双键、连接参数、凭证或 PII 输出 | `0` |
| BASE-02／Writer／MIG-01B／C／Reader | 未启动 |

一次只读复核命令中的 shell 引号问题曾意外触发 guarded `pnpm db:migrate` 入口；guard 因缺少
目标授权变量在创建数据库 client 前立即拒绝。该事件没有读取连接参数、没有连接数据库、没有
执行 Migration，数据库及仓库净变化均为 0。本文保留该透明记录，不把入口调用误写成 Migration
执行成功。

## 11. 审查限制与停止条件

- 本审查没有重新连接数据库，不能替代未来实施时的实时 hard gate。
- 当前 Shape 支持 `NOT VALID` 创建，不代表历史关系已经验证或归属已经修复。
- 未来必须在 P0 handoff 后重新取得 Migration Lease 和实时编号，不能沿用当前 `0039` 候选。
- 任一 Base、Catalog、Shape、A2-P1、journal、并发、环境、权限或 Required Check 漂移都必须停止。
- 独立审查通过只允许进入 handoff，不授权 Schema、Migration、DDL 或数据库执行。

## 12. 结论

```text
a2_p2_preflight_review=passed
eligible_for_a2_p2_implementation_handoff=true
eligible_for_schema_migration_execution=false
```

预检证据的 Catalog 归因、对象名称与列序、数据 Shape、`NOT VALID` 范围、metadata 串行前置、
文件 allowlist、事务、锁、回滚和 forward-fix 方案均可执行。下一步只允许完成 handoff，把
“A2-P2 Schema／Migration 实施”冻结为唯一下一任务；仍不得修改 Schema／Migration、取得
Migration Lease、连接数据库或启动 A2-P2 执行。

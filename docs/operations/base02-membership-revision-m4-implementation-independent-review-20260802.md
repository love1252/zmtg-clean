# BASE-02 Membership Revision M4 实施独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查交付基线：PR #884 Merge Commit `b59c4470af9473109fd7c499b26d9a8790df208e`
>
> 被审查实施：PR #884，Head `c5ac1e9a3c9850886a1d9b2fae59dac8ee810df7`

## 1. 审查定位

本审查独立核对 Membership Revision M4 deterministic legacy calibration 的实施是否严格收敛为
一个手写数据 Migration、一个 journal 追加项和一个 Schema 门禁测试文件，并判断该冻结 Head
是否具备进入固定 localhost-only local_acceptance 一次受控 Migration 的静态条件。

审查只读取实施 diff、仓库 Schema／Migration／journal、测试、已接受 A-full／P01～P12 决策、
M3 handoff、只读 Catalog／数据 Shape 冻结和低敏 Lease 状态。本审查不连接数据库，不执行
Migration、DDL、DML、Seed，不创建恢复点，不消费或释放执行 Lease，不启动 M5～M7、
BASE-B1～B6、项目级 Writer／Audit／MIG-01B／C 或 Reader。

## 2. 冻结实施证据

- PR：#884；
- Base：`a92269ea48c7c498a0f95dccb0fe65178f740c08`；
- Head：`c5ac1e9a3c9850886a1d9b2fae59dac8ee810df7`；
- 提交数：`1`；
- 修改文件数：`3`；
- 实时 Migration 编号：`0041`；
- Allocation Lease：唯一、有效、未消费；绑定任务、Base、journal、固定环境、编号、时窗、
  失效、释放和交接；
- Required Check：Run `30717337986`／Job `91415088190`，成功；环境、依赖、架构自测、
  增量检查、lint、typecheck、完整测试与 build 均实际执行；
- Merge Commit：`b59c4470af9473109fd7c499b26d9a8790df208e`；两个父提交分别为冻结 Base 与
  实施 Head，Merge tree 与实施 Head tree 精确一致。

精确文件范围：

1. `drizzle/0041_base02_membership_revision_legacy_calibration.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/tests/Schema.test.ts`。

`src/server/db/schema.ts`、snapshot、Runtime、scripts、CI、package 与 lock 修改均为 `0`。

## 3. 启动冻结与编号／Lease

文件修改前的低敏只读冻结确认：

- 仓库 journal、SQL 文件集合与固定 local_acceptance 环境 latest 均为已消费 `0040`；
- snapshot 仍为 `0026`；
- M1 Catalog 为 `all_exact`；
- legacy all-null candidate 为 `1`，partial／complete envelope 与 baseline transition 均为 `0`；
- candidate tenant／user parent 缺失均为 `0`；
- deterministic command／evidence identity collision 均为 `0`；
- Binding、Scope、Context Version、Context Head 均为 `1`；
- active historical orphan／Scope relation orphan 保持 `1／1`；
- Scope FK 继续 `NOT VALID`；
- 并发 Writer／Migration 执行者为 `0`；
- 固定 PostgreSQL 16 内建 SHA-256 与 canonicalization 所需函数签名可用。

编号 `0041` 是在上述冻结后按 journal 与 SQL 集合实时分配，并由唯一 Allocation Lease 占用；
不是 handoff 预留编号。Lease 未被用作数据库执行授权，当前 guarded Migration 执行 attempt 与
数据库写入均为 `0`；此前仅执行显式 READ ONLY 的低敏冻结探针。

## 4. SQL 范围与事务边界

实施 SQL 满足以下边界：

1. 不写显式 `BEGIN`、`COMMIT`、`ROLLBACK` 或 `SAVEPOINT`，只依赖 guarded migration 的单一外层事务；
2. 固定 `lock_timeout='1s'`、`statement_timeout='30s'` 和 `search_path=pg_catalog, public`；
3. 固定先锁 `tenant_members`，再锁 `tenant_membership_transitions`，均为
   `SHARE ROW EXCLUSIVE`；两把锁后才捕获高水位；
4. 以 `(created_at ASC, id ASC)` 稳定排序，并用 inclusive lexicographic
   `(created_at,id) <= (upper_created_at,upper_id)` 冻结批次；
5. 全批只捕获一次 `recordedAt`，current 与 transition evidence 使用同一记录时间；
6. 唯一业务 DML 是一次 `UPDATE public.tenant_members`，随后一次
   `INSERT INTO public.tenant_membership_transitions`；
7. current 只写 accepted envelope 十列，保留 `id`、tenant／user、role、display_name、
   `created_at` 与 `updated_at`；
8. transition 精确写入 16 列，使用独立 `mcal1_` command identity 与 `mtcl1_` evidence identity
   domain，并与 current command／recorded time 对齐；
9. update／insert affected rows、created／planned 和 postcheck 必须全部守恒；
10. 其他表 DML、UPSERT、`ON CONFLICT`、DELETE、TRUNCATE、DDL、动态 SQL、自动重试、
    FK `VALIDATE`、SET NOT NULL、DROP、CASCADE、GRANT／REVOKE 均被禁止。

SQL 不处理 Binding、Scope、historical orphan 或业务归属，也不删除 M6 前的 `updated_at`
兼容 Reader 输入。

## 5. Catalog 与 fail-closed 归因

Migration 在事务内精确冻结：

- `tenant_members` 的 17 列、全部约束、索引与 relation 属性；
- `tenant_membership_transitions` 的 16 列、全部约束、索引、trigger、trigger function 与
  relation 属性；
- Membership user FK 与 Scope FK 的源／目标列序、`MATCH SIMPLE`、`NO ACTION`、
  非 deferrable 和 `NOT VALID` 语义；
- journal 前驱 count、when 与前驱 SQL SHA-256；
- current／transition pre 与 post 低敏计数、parent、identity、duplicate 和 orphan 不变量。

`pg_get_constraintdef`、`pg_get_indexdef`、`pg_get_triggerdef` 与 `pg_get_functiondef` 指纹来自固定
PostgreSQL 16 目标的同口径 READ ONLY 冻结。若 PostgreSQL 16 minor 版本改变 deparser 文本，
该设计会安全阻断并要求重新审计，不会在未知 Shape 上继续写入；这是可接受的 fail-closed 风险，
不构成自动放宽指纹的理由。

## 6. 测试与质量证据

实施门禁锁定：

- 唯一 `0041` SQL 与唯一 journal entry，journal idx／when／tag 连续且 SQL 集合一一对应；
- 已消费 `0040` 与 `0026_snapshot.json` blob 不变；
- Catalog 指纹数组、function hash predicate、两组 FK 精确出现次数与列序；
- all-null eligibility、锁后高水位、稳定排序、inclusive 边界和单一 `recordedAt`；
- current 十列 UPDATE、七项 immutable 字段和 transition 16 列／16 值；
- deterministic identity domain、UTF-8、NUL byte、SHA-256、hex 与公开合成向量；
- DML allowlist、UPDATE→affected rows→INSERT→affected rows 顺序、planned 守恒及禁止项；
- Binding、Scope、Context Version、Context Head、两个 orphan 与 Scope FK 的 pre／post 不变量。

本地验证结果：

| 门禁 | 结果 |
|---|---|
| Schema 定向测试 | `67／67` |
| Schema + MigrationGuard 定向测试 | `90／90` |
| 架构检查器自测 | `125／125` |
| 增量架构检查 | 通过 |
| lint | 0 error；4 条既有图片 warning |
| typecheck | 通过 |
| 完整测试 | 426 文件／6254 项通过 |
| build | 101／101 |
| `git diff --check` | 通过 |

真实 GitHub Required Check 已绑定 PR #884 冻结 Head，并实际执行完整测试和 build；Run
`30717337986`／Job `91415088190` 成功，build 未跳过且没有 `continue-on-error`。

## 7. 数据执行准入与持续阻断

本审查通过只表示实施 artifact 具备申请一次 local_acceptance guarded Migration 的静态条件，
不表示数据库已执行。实施与本审查 PR 合并后，执行前仍必须：

1. 释放 Allocation Lease，并在最新 main／环境重新冻结后签发全新、短期、不可续期的 Execution Lease；
2. 创建最新执行前恢复点并完成隔离恢复验证；
3. 证明环境 latest 仍为 `0040`，仓库只多出唯一 `0041` pending；
4. 重新核验 Catalog、Shape、candidate、parent、identity、orphan、Scope FK 和并发状态；
5. 只通过一次 guarded `pnpm db:migrate` 执行，不直接运行 SQL，不自动重试。

expected low-sensitive success counts 为：

```text
planned=1
created=1
reused=0
conflict=0
unexpected=0
planned=created+reused
```

M5、M6、M7、BASE-B1～B6、项目级 Writer、Audit／模板、MIG-01B／C 与 Reader 均继续阻断。
historical orphan 不在 M4 范围，Scope FK 不得提前 `VALIDATE`。

## 8. 独立审查结论

```text
base02_membership_revision_m4_implementation_review=passed
m4_migration_number=0041
m4_allocation_lease_unique=true
m4_allocation_lease_consumed=false
m4_files=3
m4_guarded_migration_attempts=0
m4_database_writes=0
m4_catalog_fingerprints_exact=true
m4_current_update_tables=1
m4_transition_insert_tables=1
m4_other_table_dml=0
m4_expected_planned=1
m4_expected_created=1
m4_expected_reused=0
m4_expected_conflict=0
m4_expected_unexpected=0
m4_required_checks_passed=true
eligible_for_m4_local_acceptance_migration=true
eligible_for_m5=false
eligible_for_reader=false
```

PR #884 的冻结实施在文件范围、编号／Lease、SQL／journal／test 一致性、Catalog fail-closed、
deterministic identity、事务与 DML allowlist、计数守恒和持续阻断方面符合 M3 handoff。

该结论已与 PR #884 当前 Head 的真实 Required Check 成功共同成立。完成实施与本审查 PR 的
Merge Commit、同步最新 main、重新冻结环境、创建恢复点和全新 Execution Lease 前，不得执行
Migration；本审查不授权 M5、Reader、orphan 修复或 FK `VALIDATE`。

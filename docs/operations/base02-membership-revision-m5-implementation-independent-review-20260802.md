# BASE-02 Membership Revision M5 实施独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查交付基线：PR #893 Merge Commit `72c7568df3fd1078b813733eda472c01b0f8672d`
>
> 被审查实施：PR #893，Head `43440e3f38c3c6ba3576dba1788b3fad586cfb5a`

## 1. 审查定位

本审查独立核对 BASE-02 Membership Revision M5 高水位追赶候选实现，判断其是否严格收敛为
一个手写数据 Migration、一个 journal 追加项和一个 Schema 门禁测试文件，并判断冻结 Head 是否
具备在完成实施与审查 Merge Commit 后申请固定 localhost-only local_acceptance 一次受控
Migration 的静态条件。

本审查只读取实施 diff、仓库 Schema／Migration／journal、测试、已接受 A-full／P01～P12 决策、
M4 handoff、启动只读冻结和低敏 Allocation Lease 状态。本审查不执行 Migration、DDL、DML、Seed，
不创建恢复点，不签发或消费 Execution Lease，不启动 M6、M7、BASE-B1～B6、orphan 修复、
FK `VALIDATE`、项目级 Writer／Audit／MIG-01B／C 或 Reader。

## 2. 冻结实施证据

- PR：#893；
- Base：`9e833c9bb7eafda5e25e08a2344e1caa410877c1`；
- Head：`43440e3f38c3c6ba3576dba1788b3fad586cfb5a`；
- 提交数：`1`；
- 修改文件数：`3`；
- 实时 Migration 编号：`0042`；
- Required Check：Run `30727616873`／Job `91442118293`，成功；环境、依赖、架构自测、
  增量检查、lint、typecheck、完整测试与 build 均实际执行；
- Merge Commit：`72c7568df3fd1078b813733eda472c01b0f8672d`；两个父提交分别为冻结 Base 与实施
  Head，Merge tree 与实施 Head tree 精确一致。

精确文件范围：

1. `drizzle/0042_base02_membership_revision_high_water_catch_up.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/tests/Schema.test.ts`。

`src/server/db/schema.ts`、snapshot、Runtime、scripts、CI、package 与 lock 修改均为 `0`。

## 3. 启动冻结、编号与 Lease

文件修改前的低敏只读冻结确认：

- 仓库 journal、SQL 文件集合与固定 local_acceptance 环境 latest 均为已消费 `0041`；
- snapshot 仍为 `0026`，M1 Catalog 与 M4 current／transition Shape 保持精确一致；
- Membership all-null／partial／complete 为 `0／0／1`，transition 与 exact current-head 均为 `1`；
- duplicate command／revision、identity collision、parent missing 均为 `0`；
- Binding、Scope、Context Version、Context Head 均为 `1`；
- active historical orphan／Scope relation orphan 保持 `1／1`；
- Scope FK 继续 `NOT VALID`；
- 并发 Writer／Migration 执行者与冲突锁均为 `0`。

编号 `0042` 是在上述冻结后按 journal 与 SQL 集合实时分配，并由唯一、短期、不可续期且未消费的
Allocation Lease 占用；Lease 绑定 M5、冻结 Base、前驱 `0041`、编号、时窗、失效、释放和交接，
且签发早于 `0042` 文件与 journal 追加。仓库无第二个 `0042` SQL、journal entry 或竞争分支。

Allocation Lease 不是数据库执行授权。实施与审查 PR 合并后必须先释放它；执行时只能在最新
`main`、全新恢复点及隔离恢复验证后，另行签发全新唯一、短期、不可续期的 Execution Lease。

## 4. M4 baseline 与候选边界

Migration 在事务内显式证明继承的 M4 baseline 未丢失：

- pre 阶段要求恰好一个 accepted `legacy_calibration` revision `1` current 与确定性 baseline
  transition 精确配对；
- command／evidence identity 由独立 domain、UTF-8、单字节 NUL、SHA-256 与 lowercase hex
  确定性形成；
- post 阶段要求 legacy exact head 数等于 pre baseline 加本批 `created`；
- 全部 complete current 仍须与 exact current-head evidence 一一对应；
- 本批单一 `recordedAt` 的 exact evidence 另行计数，只等于本批 `created`，不会误计既有 M4 evidence。

因此，M4 canonical current 与 baseline transition 同时丢失、partial envelope、complete/evidence
不一致、parent 缺失、duplicate 或 identity collision 均会 fail-closed，不会被 M5 静默重建。

## 5. 零候选、高水位与事务边界

实施 SQL 满足以下边界：

1. all-null residual 为 `0` 时显式置空 high-water／recordedAt，`planned=0`，不进入循环且不执行 DML；
2. 非零候选只选择 current envelope 十列全部为 `NULL` 且 tenant／user parent 完整的 legacy residual；
3. 固定先锁 `tenant_members`，再锁 `tenant_membership_transitions`，均为
   `SHARE ROW EXCLUSIVE`；
4. 以 `(created_at,id COLLATE "C")` 捕获稳定 inclusive 高水位，并按同一键升序处理；
5. 全批只捕获一个 `recordedAt`；每条候选先 UPDATE canonical current，再 INSERT immutable
   baseline transition；
6. current 只写 accepted envelope 十列，保留 `id`、tenant／user、role、display_name、
   `created_at` 与 `updated_at`；
7. transition 精确写入 16 列，current 与 evidence 的 command／revision／role／recorded time 对齐；
8. update／insert affected rows 必须各为 `1`，`planned=created+reused` 且
   `created=planned`、`reused=conflict=unexpected=0`；
9. Membership 总行数守恒，transition 净增 `created`，all-null／partial／duplicate／conflict 清零；
10. Binding、Scope、Context、两个 orphan 与 Scope FK 状态保持不变。

SQL 不写显式事务，不允许其他 DML、UPSERT、`ON CONFLICT`、DDL、动态 SQL、自动重试、
`SKIP LOCKED`、FK `VALIDATE`、SET NOT NULL、DROP、CASCADE、GRANT 或 REVOKE。

## 6. Journal、Catalog 与不可改写边界

- journal 只在 42 个既有 entry 后追加 `idx=42` 的 `0042`，旧 entry 字节内容不变；
- `0041` 是精确前驱，SQL 在事务前后核验环境 count、when 与前驱 SQL 内容指纹；
- SQL 与 journal 均为 43 项，编号、stem、idx、when、tag 一一对应；
- `0026_snapshot.json` blob 未变化，未运行 `db:generate`；
- Membership current／transition Catalog、enum、trigger function、user FK 与 A2-P2 Scope FK
  继续使用精确 fail-closed 指纹和列序／动作核验；
- PostgreSQL major、required relation、identity function／公开合成向量或 Catalog 任一漂移均停止。

实施未修改已消费的 `0041` SQL／journal，不预先处理 M6 Reader、M7 Enforce、historical orphan
或 Scope FK validation。

## 7. 测试与质量证据

Schema 门禁锁定：

- 唯一 `0042` SQL、唯一 journal 追加、精确 `0041` 前驱与 snapshot blob；
- M4 legacy baseline pre／post offset 与本批 exact evidence 分离计数；
- 零候选合法分支、完整 all-null predicate、稳定高水位、双侧 C collation 和 inclusive predicate；
- record alias 首次使用晚于循环声明，parent／collision 使用独立 alias；
- current 十列精确 UPDATE 值、七项 immutable 字段和 transition 16 列／16 值；
- command／evidence／membership revision 三类 collision、tenant／auth-user parent；
- Membership、transition、Binding、Scope、Context、orphan 全量 pre／post 守恒；
- 所有 fail-closed code、DML／DDL allowlist、事务与重试禁止项。

验证结果：

| 门禁 | 结果 |
|---|---|
| Schema 定向测试 | `68／68` |
| 架构检查器自测 | `125／125` |
| 增量架构检查 | 通过 |
| lint | 0 error；4 条既有图片 warning |
| typecheck | 通过 |
| 完整测试 | 426 文件／6255 项通过 |
| build | 101／101 |
| `git diff --check` | 通过 |

真实 GitHub Required Check 已绑定 PR #893 冻结 Head；Run `30727616873`／Job `91442118293`
成功，完整测试与 build 均实际执行，build 未跳过且没有 `continue-on-error`。

## 8. 数据执行准入与持续阻断

本审查通过只表示冻结 artifact 具备在完成实施／审查 Merge Commit 后申请一次
local_acceptance guarded Migration 的静态条件，不表示数据库已执行。执行前仍必须：

1. PR #893 已使用 Merge Commit 合并；本审查 PR 已重放至该最新 `main` 并回填实际合并证据，
   仍须由重放后新 Head 的 Required Check 成功；
2. 本审查 PR 使用 Merge Commit 合并后，释放 Allocation Lease及全局编号锁；
3. 从最新 `main` 重新确认仓库只比环境多唯一 pending `0042`，stem／when／内容精确；
4. 创建全新执行前恢复点并完成隔离恢复验证；
5. 重新冻结 Catalog、M4 baseline、residual、parent、collision、orphan、Scope FK 和并发状态；
6. 签发全新唯一、短期、不可续期 Execution Lease；
7. 只运行一次 guarded `pnpm db:migrate`，不直接运行 SQL，不自动重试。

当前只读冻结下 residual 为 `0`，因此若执行前数据仍无漂移，预期低敏计数为
`planned／created／reused／conflict／unexpected=0／0／0／0／0`。执行前必须动态重算，不能把该
计数写成永久假设；若出现合法 residual，`planned` 必须精确等于该冻结批次并满足全部守恒。

M6、M7、BASE-B1～B6、orphan 修复、FK `VALIDATE`、项目级 Writer／Audit、MIG-01B／C 与
Reader 均继续阻断。

## 9. 独立审查结论

```text
base02_membership_revision_m5_implementation_review=passed
m5_migration_number=0042
m5_files=3
m5_allocation_lease_unique=true
m5_allocation_lease_consumed=false
m5_guarded_migration_attempts=0
m5_database_writes=0
m5_zero_candidate_supported=true
m5_m4_baseline_preserved=true
m5_current_update_tables=1
m5_transition_insert_tables=1
m5_other_table_dml=0
m5_required_checks_passed=true
eligible_for_m5_local_acceptance_migration_after_merge=true
eligible_for_m6=false
eligible_for_reader=false
```

PR #893 冻结实施在文件范围、编号／Lease、M4 baseline、零候选、高水位、SQL／journal／test
一致性、Catalog fail-closed、确定性 identity、事务与 DML allowlist、计数守恒和持续阻断方面通过
独立审查。

该结论只有在 PR #893 Merge Commit、本审查 PR 重放与 Merge Commit、最新环境重新冻结、全新
恢复点及隔离恢复验证、全新 Execution Lease 全部完成后，才构成一次 guarded Migration 的申请
条件。本审查不授权 M6、BASE-B1、Reader、orphan 修复或 FK `VALIDATE`。

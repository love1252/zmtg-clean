# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision M3 已完成实现与独立审查：

- PR #880 完成 M3-A 正式 onboarding Owner 委托，Head `c690789f341434fd7bb33e819151849e6c2a7afa`，Run `30711226980`／Job `91398940037`，Merge Commit `2d34177f0d2eb77ccaba0829ab3224e69911853f`；
- PR #881 完成 M3-B 旧 Writer／Deleter 封堵与 `AQ008_MEMBERSHIP_DIRECT_WRITER`，Head `b405403d6fea87e1d022d7e027e22d9f8600ae61`，Run `30714150218`／Job `91406737286`，Merge Commit `f8909e098def3810e0e336c9491facf83d4c3a57`；
- PR #882 完成 M3 独立审查，Head `6f0b95b246aa115d63be49758ca66202f09ae589`，Run `30714716713`／Job `91408247113`，Merge Commit `df83b9527e3569c0997f0438a68d086592f3a36b`；
- 正式 onboarding 已在既有单一外层事务中委托 Access Control transaction-bound Owner command；
- 1 个旧 Writer 已委托，5 个旧 Writer／Deleter 已固定 fail-closed；
- Owner 外 direct Membership mutation 文件数／符号数为 `0／0`；唯一 Owner allowlist 文件数为 `1`；
- `AQ008_MEMBERSHIP_DIRECT_WRITER` 已进入 `main`，rules exceptions 保持为空；
- `base02_membership_revision_m3_implementation_review=passed`；
- M3 没有连接数据库，Schema、Migration、journal、snapshot 与数据库修改均为 `0`。

继承且未被 M3 改变的冻结事实：

- 仓库／环境 journal 为 `41`，最新 Migration 为已消费且不可改写的 `0040`；
- snapshot 仍为 `0026`；
- M1 Catalog 为 `all_exact`；
- legacy complete current envelope／transition evidence 环境计数为 `0／0`；
- active historical orphan／Scope relation orphan 为 `1／1`；
- A2-P2 Scope FK 为 `NOT VALID`／`convalidated=false`；
- M6 Reader 切换前，现有 Auth Reader 继续保留 `updated_at` 兼容读取；对 legacy all-null Membership，M2 Owner command 的非 create 写命令继续 fail-closed 为 `legacy_membership_not_calibrated`。

## 唯一下一任务

```text
BASE-02 Membership Revision M4 deterministic legacy calibration
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动；已由当前 ULTRA 用户指令授权在本 handoff 合并后启动**。

M4 只完成一件事：以独立手写数据 Migration，在受控短事务内将冻结批次中的 legacy all-null
Membership 确定性校准为 revision `1`／active current，并为每条 current 原子建立恰好一条
`legacy_calibration` baseline transition。

M4 不执行 M5 高水位追赶、M6 Reader 切换、M7 Enforce、BASE-B1～B6、historical orphan 修复、
A2-P2 FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

## 一、不得重开的 accepted 约束

1. `tenant_members` 继续是 Access Control 唯一 canonical Membership current；`tenant_membership_transitions` 只保存 append-only immutable evidence。
2. Identity、Access Control、Tenancy 与 Security Owner 边界不重开；Membership revision、Binding version 与 Scope revision 继续是三个独立版本域。
3. M4 只选择 current envelope 十列全部为 `NULL` 的 legacy row；partial envelope、已完整 current 或证据矛盾必须 fail-closed。
4. 每条目标 current 固定写入：
   - `revision=1`；
   - `lifecycle_status=active`；
   - `current_provenance_source=legacy_calibration`；
   - `current_provenance_actor_id=NULL`；
   - `current_provenance_reason_code=legacy_unknown`；
   - `current_provenance_command_id=<对应 mcal1_ 确定性 command identity>`；
   - `current_provenance_occurred_at=NULL`；
   - `current_provenance_recorded_at=<本次实际校准记录时间>`；
   - `revoked_at=NULL`、`deleted_at=NULL`。
5. 同一事务为每条 current 精确追加一条 baseline transition：
   - `id=<对应 mtcl1_ 确定性 evidence identity>`；
   - `tenant_id=<current tenant_id>`、`membership_id=<current id>`；
   - `command_id=<与 current_provenance_command_id 相同的 mcal1_ identity>`；
   - `transition_type=legacy_calibration`、`source=legacy_calibration`；
   - `actor_id=NULL`、`reason_code=legacy_unknown`；
   - `from_revision=NULL`、`to_revision=1`；
   - `from_lifecycle_status=NULL`、`to_lifecycle_status=active`；
   - `from_role=NULL`、`to_role=<legacy current 的既有 role>`；
   - `occurred_at=NULL`、`recorded_at=<与 current 相同的本次实际校准记录时间>`。
6. M4 不修改 Membership `id`、tenant／user 归属、role、display_name、created_at，不修改 Binding、Scope、historical orphan 或任何业务表。M4 是建立 legacy baseline 的数据校准，不是业务授权命令；本阶段明确保留原 `updated_at`，避免在 M6 切换前改变现有 Auth Reader 的兼容输入。该选择必须由测试锁定，M6 仍须删除 `updated_at` 授权 fallback。
7. 校准时间只能表示本次记录时间，不得伪造成员创建、授权或业务事件发生时间；不得伪造 actor 或自由文本 reason。
8. current mutation 与 baseline transition 必须在同一 guarded Migration 事务中原子形成；任一行数、唯一性、Shape 或 postcheck 失败，整批回滚。
9. 共享环境消费后不得改写 SQL／journal，不得自动重试，只允许独立 forward-fix。

## 二、确定性 identity 与批次冻结

### 2.1 command／evidence identity

沿用已接受 P08 公式：

- current command identity：`mcal1_` 加 SHA-256 小写十六进制；
- transition evidence identity：`mtcl1_` 加 SHA-256 小写十六进制；
- 两者使用不同固定 domain；
- 输入按 UTF-8 编码，以单个 NUL 分隔 domain、tenant ID 与 Membership ID；
- 固定目标 PostgreSQL 16，并在启动只读冻结中证明 `pg_catalog.sha256(bytea)` 及所需内建函数签名存在；不得创建或依赖 extension；
- 精确 bytea 公式使用 `pg_catalog.convert_to(...,'UTF8')` 拼接 `pg_catalog.decode('00','hex')` 的单字节 NUL，再以 `pg_catalog.sha256(bytea)` 和 `pg_catalog.encode(...,'hex')` 输出 lowercase hex；禁止把 NUL 构造成 text，所有函数均显式限定 `pg_catalog`；
- 相同不可变输入必须得到相同 identity，不同 domain 不得复用 digest；
- 实施测试必须锁定公开合成向量、长度、字符集、domain 与分隔规则，不能使用真实双键或环境数据。

### 2.2 稳定排序与冻结批次

- M4 实施排序冻结为 `(created_at ASC, id ASC)`；两列均为已接受不可变字段，并与 M5 高水位候选口径一致；
- 在取得两张表的冻结锁后，从严格 all-null 候选捕获最大 `(created_at,id)` 作为批次上界；后续只处理满足 all-null 且 `(created_at,id) <= (<upper_created_at>,<upper_id>)` 的行，边界为 inclusive lexicographic predicate；
- 同一批次使用一次捕获的实际 `recordedAt`，current 与 evidence 必须精确一致；
- M4 批次外或冻结后出现的合法 residual 只能由 M5 独立追赶，M4 不扩大选择范围。

## 三、启动只读冻结与 Migration Lease

开始任何文件修改前必须动态确认：

1. 日期、时区、`main`／`origin/main`、工作树、分支保护与 Required Check；
2. journal、SQL 文件集合与固定 localhost-only local_acceptance 环境 latest 一致，当前仍为 `41／0040`；
3. snapshot 仍为 `0026`，不运行 `db:generate`，不创建 snapshot-diff Migration；
4. M1 Catalog 仍为 `all_exact`，M3 Owner 外 direct writer 为 `0／0`，唯一 allowlist 为 `1`；
5. legacy all-null、partial、complete current、baseline transition、deterministic identity 冲突与唯一性均可用低敏计数解释；
6. 每条候选的 tenant parent 与 `auth_users` parent 均存在，缺失计数分别为 `0／0`；既有 `tenant_members_user_id_auth_users_id_fk` 为 `NOT VALID` 的事实不构成豁免，M4 不补 parent、不 `VALIDATE`；
7. 固定 localhost-only 目标为 PostgreSQL 16，`pg_catalog.sha256(bytea)`、`convert_to`、`decode` 与 `encode` 的精确签名可只读证明，且不依赖 extension；
8. active historical orphan／Scope relation orphan 仍为 `1／1`，Scope FK 仍为 `NOT VALID`；
9. 没有活动 Migration 执行者、并发 Writer、编号冲突或其他 Agent 写入；
10. 固定 localhost-only 目标、恢复点能力与 guarded `pnpm db:migrate` 唯一入口可证明。

`AQ008_MEMBERSHIP_DIRECT_WRITER` 的 `0／0／1` 只能在文件修改前和 Required Check 中作为 Git／CI 硬门核验，不能伪装成 SQL 事务内可查询的数据库事实。

只在以上事实全部稳定后，创建一个绑定任务、Holder、Base、journal、环境、实时编号、时窗、失效、
释放和交接的唯一 Migration Lease。不得预留或假定下一编号；编号必须在取得 Lease 时按实时 journal
与 SQL 集合分配。

## 四、M4 实施 PR 精确文件范围

实施 PR 只允许修改三个文件：

1. `drizzle/<实时编号>_base02_membership_revision_legacy_calibration.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/tests/Schema.test.ts`。

不得修改 `src/server/db/schema.ts`、任何 snapshot、Runtime、Access Control command、AQ008、scripts、
package、lock、CI 或 handoff。journal 只手工追加实时编号的一项，`idx／when／tag` 必须与 SQL stem
及前驱严格一致。

## 五、SQL、事务与 DML allowlist

- SQL 不写显式 `BEGIN`／`COMMIT`／`ROLLBACK`，只由 guarded migration 外层事务承载；
- 固定 `SET LOCAL lock_timeout='1s'` 与 `SET LOCAL statement_timeout='30s'`；
- 固定锁序为 `LOCK TABLE public.tenant_members IN SHARE ROW EXCLUSIVE MODE` 后 `LOCK TABLE public.tenant_membership_transitions IN SHARE ROW EXCLUSIVE MODE`；取得两把锁后才捕获批次上界，业务写入顺序固定为 current `UPDATE` 后 transition `INSERT`，且不得触碰 Binding；
- 在 guarded 入口与事务内分别重新核验环境已应用 journal 前驱、M1 Catalog、current Shape、候选 parent、identity 冲突与冻结批次；SQL 不尝试核验 AQ008；
- 唯一允许的业务 DML 为 `UPDATE tenant_members` 和 `INSERT tenant_membership_transitions`；
- 禁止其他表 DML、upsert、`ON CONFLICT`、DELETE、TRUNCATE、DDL、回填归属、FK `VALIDATE`、SET NOT NULL、DROP、CASCADE、SAVEPOINT、自动重试或动态 SQL；
- current UPDATE 与 evidence INSERT affected rows 必须分别精确等于冻结目标数，并满足 `update_count=insert_count=created=planned`；任一不一致计入 `conflict` 或 `unexpected` 并整批回滚；
- 不允许 exact reuse：执行前发现任何目标 row 已存在 current／baseline 的混合或部分状态即视为漂移并停止，不能静默吞掉。

## 六、计数与成功门

必须记录并证明以下低敏计数：

```text
planned=<冻结批次 all-null legacy 数>
created=<current 与 baseline evidence 同时完成的 Membership 数>
reused=0
conflict=0
unexpected=0
planned=created+reused
```

同时必须证明：

- 校准前后 Membership 总行数守恒；
- `created` 条 current 均为完整 accepted envelope，且每条恰好一条 revision 1 baseline transition；
- duplicate command、duplicate membership revision、partial envelope 与 identity collision 均为 `0`；
- role、display_name、tenant／user 归属、Binding、Scope、orphan 与 A2-P2 FK 状态均不变化；
- M1 Catalog、snapshot 与非目标表保持预期状态；实施合并后、执行前，仓库 journal 必须只比环境 latest 多出本次唯一待执行项；执行后环境 latest 必须与该新项一致，仓库 journal 总计只新增这一项；
- conflict 或 unexpected 任一非零即失败，不得通过放宽计数继续。

## 七、测试与独立审查

`Schema.test.ts` 必须锁定：

- 唯一实时 SQL 文件与 journal entry；
- 两个 identity domain／prefix、UTF-8、NUL 分隔、SHA-256、hex 与公开合成向量；
- 锁后捕获的 inclusive `(created_at,id)` 高水位、稳定排序、单一 recordedAt、精确 current 十列赋值与 transition 全列 Shape；
- legacy baseline 保留原 `updated_at`，并锁定 M6 前 Auth Reader 兼容读取不因 M4 被提前改变；
- 两张表的精确 `SHARE ROW EXCLUSIVE` 锁、current UPDATE→transition INSERT 顺序、候选 tenant／user parent 完整性；
- planned／created／reused／conflict／unexpected 守恒与 postcheck；
- timeout、锁序、allowed DML 与禁止项；
- 前驱 SQL／journal 不被改写、snapshot blob 不变化。

实施 PR 必须通过定向测试、Migration Guard、架构自测、增量架构检查、lint、typecheck、完整测试、
build 与真实 Required Check，先保持 Draft。随后建立单文件独立实施审查 PR，冻结实施 Head、Lease、
编号、文件范围、SQL／journal／test 一致性、零范围扩张和受控执行准入。

审查通过时记录：

```text
base02_membership_revision_m4_implementation_review=passed
eligible_for_m4_local_acceptance_migration=true
eligible_for_m5=false
eligible_for_reader=false
```

实施与审查 PR 均在检查成功后按当前 ULTRA 授权 Ready、Merge Commit、同步 main并清理工作分支。

## 八、固定 local_acceptance 一次受控执行

从最新 main 重新冻结 journal、Catalog、Shape、批次、唯一 Lease 与并发状态。执行前创建最新恢复点并
完成隔离恢复验证；只允许固定 localhost-only local_acceptance，且 guarded `pnpm db:migrate` 是唯一
执行入口。

只运行一次 guarded Migration。事务开始后的失败不自动重试；结果不确定时只允许 READ ONLY 核验
并硬停止，不得直接执行 SQL、改写已消费 Migration 或破坏性删除对象。

成功后释放 Lease，创建并验证执行后恢复点；依次完成：

1. M4 执行低敏证据 PR；
2. M4 执行独立审查 PR；
3. M4 最终 handoff PR。

执行审查必须冻结 attempt、计数、journal、数据不变量、恢复点与 Lease 终态。每个 PR 均须真实
Required Check、Ready、Merge Commit、同步 main、清理工作分支并保留全部 `backup/*`。

## 九、回退与 forward-fix

- 事务前门禁失败：零数据库 attempt，释放未消费 Lease并停止；
- 事务内失败：依赖单一外层事务整批回滚，随后只做 READ ONLY 低敏核验；
- 实施 PR 合并但环境未消费：可由独立 PR修正，必须重新审查并取得新 Lease；
- 共享环境已消费：SQL／journal 不可改写，只能创建全新编号、全新 Lease、全新恢复点的独立 forward-fix；
- 禁止自动重试、复用已消费 Lease、破坏性 down migration 或恢复旧 direct Writer。

## 十、持续阻断与硬停止

以下任一情况必须停止：

- Migration 编号、Lease、恢复点、固定 localhost-only 目标或执行结果无法证明；
- journal、SQL、Catalog、Shape、M3 Writer 归零、legacy 批次或 orphan 计数发生未解释漂移；
- 出现 partial envelope、deterministic identity 冲突、重复 baseline、未知依赖或并发 Writer；
- 需要三个实施文件之外的修改，或需要 Schema、snapshot、`db:generate`、额外 Runtime／脚本；
- 需要修改 role、业务归属、Binding、Scope、orphan 或执行 FK `VALIDATE`；
- conflict／unexpected 非零，planned 守恒或同事务原子性无法证明；
- 需要第二次执行、自动重试、非 localhost 环境或敏感信息输出；
- Git 状态无法安全恢复。

M5～M7、BASE-B1～B6、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader继续未启动。

## 十一、交付判定

```text
next_task=BASE-02 Membership Revision M4 deterministic legacy calibration
next_task_started=false
next_task_authorized_under_ultra=true
m0_complete=true
m1_complete=true
m2_complete=true
m3_complete=true
m3_owner_outside_direct_writer_files=0
m3_owner_outside_direct_writer_symbols=0
m3_owner_allowlist_files=1
m4_started=false
m4_migration_number_allocated=false
m4_migration_lease_created=false
m4_database_attempts=0
m5_started=false
m6_started=false
m7_started=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
active_historical_orphan_count=1
scope_relation_orphan_count=1
a2_p2_scope_fk_validated=false
project_writer_started=false
reader_started=false
eligible_for_reader=false
```

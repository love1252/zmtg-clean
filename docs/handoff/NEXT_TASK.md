# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision M4 deterministic legacy calibration 已完成执行、独立审查与 handoff：

- M4 执行证据 PR #890：Head `90ca634ced30c7386d5c0a3c5338fda5df6bd911`，Run `30725188721`／Job `91435449482`，Merge Commit `167e1193e474237e5a612a7df9860adcad8b7e8c`；
- M4 执行独立审查 PR #891：Head `38c821ffe247306dc211e450923d0379f49036fe`，Run `30725621418`／Job `91436644462`，Merge Commit `4b79cdf39775fa7827be89a33fa339e8fda90faa`；
- Migration `0041` 已在固定 localhost-only local_acceptance 环境完成第三次且仅一次授权目标执行；环境 journal 为 `42／0041`，snapshot 保持 `0026`；
- `planned／created／reused／conflict／unexpected=1／1／0／0／0`；Membership all-null／partial／complete 为 `0／0／1`，baseline transition 为 `1`；
- 目标 guarded Migration 累计调用为 `3`，自动重试为 `0`，执行结果已知；Lease、client、进程、锁、marker、Helper 和隔离数据库活动残留均为 `0`；
- active historical orphan／Scope relation orphan 保持 `1／1`，A2-P2 Scope FK 保持 `NOT VALID`；
- 执行后一次无目标 Guard 启动在首道目标门禁拒绝，数据库连接和数据库变化均为 `0`，F01 已由独立审查关闭；
- M4 交付不启动 M5、M6、M7、BASE-B1～B6、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

## 唯一下一任务

```text
BASE-02 Membership Revision M5 高水位追赶与冲突清零
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**仅冻结且尚未启动；M4 handoff 合并后已由当前 ULTRA 用户指令授权继续**。

M5 只负责以独立手写追赶数据 Migration 处理 M4 冻结后遗留的合法 all-null Membership，复用已接受的
`legacy_calibration` current／transition 语义和确定性 identity，并证明 all-null、partial、duplicate、
conflict 与 unexpected 全部清零。M5 不是 MIG-01B 业务回填，不处理 Binding、Scope 或 historical orphan。

## 一、不得重开的 accepted 约束

1. `tenant_members` 继续是 Access Control 唯一 canonical Membership current；`tenant_membership_transitions` 只保存 append-only immutable evidence。
2. Identity、Access Control、Tenancy 与 Security Owner 边界不重开；Membership revision、Binding version 与 Scope revision 继续是三个独立版本域。
3. M5 只处理 current envelope 十列全部为 `NULL` 的合法 legacy residual；partial envelope、complete current／evidence 不一致、parent 缺失或未知归属必须 fail-closed。
4. 每条合法 residual 固定形成 revision `1`、active、`legacy_calibration／legacy_unknown` current，actor／occurredAt 为 `NULL`，并在同一事务原子追加恰好一条 revision `1` baseline transition。
5. M5 不修改 Membership `id`、tenant／user 归属、role、display_name、created_at、updated_at，不修改 Binding、Scope、Context 或 orphan。
6. M5 必须允许 `planned=0`；无 residual 时仍须完成冲突清零证明，不能因零候选失败。
7. M5 不允许 exact reuse：all-null current 已存在 command、evidence 或 revision `1` transition 属于证据矛盾。
8. 共享环境消费后不得改写 SQL／journal；新问题只能使用独立 forward-fix，禁止自动重试。

## 二、启动只读冻结

M4 handoff 合并后开始 M5 时，改文件前必须动态确认：

1. 最新 `main=origin/main`、工作树干净、分支保护和 Required Check 状态稳定；
2. M4 handoff 已合并，`base02_membership_revision_m4_execution_review=passed`；
3. 仓库 journal、SQL 集合与固定 localhost-only local_acceptance 环境 latest 一致；预期继承 `42／0041`，但不得写死，必须实时核验；
4. snapshot 仍为 `0026`，禁止 `db:generate` 和 snapshot-diff Migration；
5. 已消费 `0041` SQL／journal 不可改写，M1 Catalog 仍为 `all_exact`；
6. AQ008 Owner 外 direct Writer／Deleter 仍为 `0／0`，唯一 allowlist 为 `1`；
7. Membership total、all-null、partial、complete、transition、duplicate command、duplicate membership revision 和 identity collision 均能由低敏计数解释；
8. 所有 all-null residual 的 tenant 与 `auth_users` parent 缺失数均为 `0`；
9. Binding／Scope／Context Version／Context Head、A2-P1 资产与 M4 终态未漂移；
10. active historical orphan／Scope relation orphan 仍为 `1／1`，Scope FK 仍为 `NOT VALID`；
11. PostgreSQL major 及 `pg_catalog.sha256／convert_to／decode／encode` 精确签名未漂移；
12. 无活动 Migration 执行者、并发 Writer、编号冲突或其他 Agent 写入；
13. guarded `pnpm db:migrate` 仍为唯一执行入口。

AQ008 只作为 Git／CI 门禁，不能伪装成 SQL 事务内数据库事实。

## 三、候选实施文件范围

M5 候选实施 PR 只允许以下三个文件类型，文件 stem 与编号必须在未来启动冻结中最终确认：

1. `drizzle/<实时编号>_base02_membership_revision_high_water_catch_up.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/tests/Schema.test.ts`。

M5 不改变物理 Schema，因此不修改 `src/server/db/schema.ts`；不得修改 snapshot、Runtime、scripts、
package、lock、CI 或 handoff 之外的文件。Migration 编号不得由本 handoff 预留或批准。

## 四、Migration Lease、恢复点与环境边界

- 只在启动冻结全部通过后实时分配下一 Migration 编号；
- 创建全新、唯一、短时、不可续期且不可复用的 Migration Lease；
- Lease 绑定任务、Holder、Base、前驱 journal／SQL hash、固定目标、实时编号、执行前恢复点、时窗、失效、消费、释放和交接；
- 实施与独立审查合并后，从最新 main 重新冻结全部事实；
- 执行前创建全新恢复点并完成隔离恢复验证；成功后再创建并验证执行后恢复点；
- 自动重试为 `0`，不得复用 M4 Lease、恢复点、attempt 或 terminal record；
- 仅固定 localhost-only local_acceptance 可作为未来授权候选，任何其他环境均不在范围。

## 五、高水位与事务边界

- SQL 不写显式 `BEGIN／COMMIT／ROLLBACK`；
- 固定 `SET LOCAL lock_timeout='1s'` 与 `SET LOCAL statement_timeout='30s'`；
- 固定锁序为 `tenant_members` 后 `tenant_membership_transitions`，均使用 `SHARE ROW EXCLUSIVE`；
- 取得两把锁后再冻结 residual 集合；
- 稳定排序与高水位使用 `(created_at ASC, id COLLATE "C" ASC)`；
- residual 非零时捕获最大 `(created_at,id)` 并使用 inclusive lexicographic predicate；为零时允许空批次；
- 单批次只捕获一个 `recordedAt`；业务写入顺序固定为 current `UPDATE` 后 transition `INSERT`；
- 唯一允许 DML 为 `UPDATE tenant_members` 与 `INSERT tenant_membership_transitions`；
- 禁止其他表 DML、upsert、`ON CONFLICT`、DELETE、TRUNCATE、DDL、动态 SQL、SAVEPOINT、自动重试、FK `VALIDATE`、SET NOT NULL、DROP 或 CASCADE；
- affected rows 必须逐项精确，任一不一致整批回滚。

## 六、成功计数与数据不变量

```text
planned=created+reused
created=planned
reused=0
conflict=0
unexpected=0
post_all_null=0
post_partial=0
duplicate_command=0
duplicate_membership_revision=0
identity_collision=0
```

若无 residual，则 `planned=created=0`。同时必须证明：

- Membership 总行数守恒，transition 总行数净增 `created`；
- 每条新 complete current 恰好对应一条 revision `1` baseline transition；
- role、display_name、tenant／user、created_at、updated_at 均不变化；
- Binding、Scope、Context、A2-P1、orphan 与 Scope FK validation 状态均不变化；
- M1 Catalog 和 snapshot 不变化；
- 环境执行后 latest 与新 journal 项一致。

## 七、测试与质量门禁

`Schema.test.ts` 至少锁定：

- 唯一新增 SQL 与唯一 journal entry，前驱和 snapshot blob 未变化；
- 实时编号、stem、`idx／when／tag` 一致；
- 两个确定性 identity domain、UTF-8、单字节 NUL、SHA-256、lowercase hex 和公开合成向量；
- Catalog 聚合使用稳定显式类型，避免再次出现多态 enum 聚合漂移；
- all-null residual 选择、零候选合法分支、稳定排序、高水位和 inclusive predicate；
- 单一 `recordedAt`、精确 current／transition Shape 与不修改 `updated_at`；
- 两表锁序、timeout、`UPDATE→INSERT`、DML allowlist 与全部禁止项；
- `planned／created／reused／conflict／unexpected` 守恒及 post 状态清零；
- 已消费 `0041` SQL／journal 未被改写。

未来验证链必须包含定向 Schema／Migration 测试、Migration Guard、架构检查器自测、增量架构检查、
lint、typecheck、完整测试、build 和真实 Required Check。

## 八、未来交付链

M4 handoff 合并后按当前 ULTRA 授权执行的交付顺序为：

1. 三文件 Draft 实施 PR；
2. 单文件实施独立审查 PR；
3. 实施 PR Ready 并使用 Merge Commit 合并；
4. 审查 PR 重放至最新 main，经新 Required Check 后 Ready 并使用 Merge Commit 合并；
5. 最新 main 上重新冻结环境、全新恢复点、隔离恢复和 Lease；
6. 固定 localhost-only local_acceptance 运行一次且仅一次 guarded `pnpm db:migrate`；
7. M5 执行低敏证据 PR；
8. M5 执行独立审查 PR；
9. M5 handoff PR；只在该 handoff 中冻结 M6，不启动 M6。

上述链路已由当前 ULTRA 目标授权连续执行，但仍必须逐项通过本文件的动态冻结、文件范围、恢复点、
Lease、数据库目标、独立审查和 Required Check 硬门；任何硬门失败均不得以 ULTRA 授权为由绕过。

## 九、失败、回退与 forward-fix

- 事务前门禁失败：数据库 attempt 为 `0`，释放未消费 Lease；
- 事务内失败：依赖 guarded 外层事务整批回滚，只做 READ ONLY 低敏核验；
- 结果不确定：立即停止，只读分类，不得第二次执行；
- 实施已合并但环境未消费：独立纠错 PR、重新审查、全新 Lease 与恢复点；
- 环境已消费：SQL／journal 不可改写，只能使用全新编号的独立 forward-fix；
- 禁止破坏性 down migration、自动重试或恢复旧 Writer。

## 十、真正硬停止

- M4 handoff、journal、SQL、Catalog、Shape、AQ008、Membership 数据或 orphan 出现未解释漂移；
- residual 无法证明为 accepted all-null legacy Shape，或 parent 缺失；
- 出现 partial envelope、重复 baseline、command／revision／identity 冲突；
- Migration 编号、Lease、恢复点、固定 localhost-only 目标、事务回滚或执行结果无法证明；
- 出现并发 Writer／Migration 执行者；
- 需要三个候选文件之外修改，或需要 Schema、snapshot、`db:generate`、额外 Runtime／脚本；
- 需要修改业务语义、role、归属、Binding、Scope、orphan 或 FK validation；
- `conflict`／`unexpected` 非零，或守恒、原子性无法证明；
- 需要第二次执行、自动重试、非 localhost 环境或敏感信息输出；
- Git 状态无法安全恢复。

## 十一、持续阻断

- M6 Reader 切换、M7 Enforce 未启动；
- BASE-B1～B6 未启动；
- Auth Reader 继续使用既有 `updated_at` 兼容读取，M6 前不得提前删除 fallback；
- active historical orphan／Scope relation orphan 保持 `1／1`；
- A2-P2 Scope FK 保持 `NOT VALID／convalidated=false`；
- 不启动 orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader；
- 不改变 Identity／Access Control／Tenancy／Security Owner 和三个独立 revision 域；
- 七线正式发布继续为 `0/7`。

```text
next_task=BASE-02 Membership Revision M5 高水位追赶与冲突清零
next_task_started=false
next_task_authorized_under_ultra=true
m5_started=false
m5_authorized_under_ultra=true
m6_started=false
m7_started=false
eligible_for_base_b1_runtime=false
eligible_for_reader=false
```

# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision M6 Reader／Session／Guard 切换已经完成实施、独立审查与合并：

- M6 实施 PR #898：Base `3c6884a1aefbfb2dd0a9177c811f6375aef6fe2b`，Head `e1cc9e4e97c18a80d3bf8ce55ed588b259898f19`，Run `30734941015`／Job `91461924228`，Merge Commit `fe79267264f228cac217908365aa42f3f7408109`；
- M6 实施独立审查 PR #899：重放后 Base `fe79267264f228cac217908365aa42f3f7408109`，Head `b105d566416b7d8ad5d10a38388c666d244a2f21`，Run `30735331035`／Job `91462991272`，Merge Commit `005f1bfee5e1d94b003feb47c5f1f091463c483c`；
- 实施范围为单提交 42 文件，其中生产文件 24 个、测试文件 18 个；独立审查为单提交、单个 operations Markdown；
- M6 精确／支撑测试矩阵为 22 文件、755/755，完整测试为 430 文件、6341/6341，build 为 101/101；两轮真实 Required Check 的完整测试和 build 均实际执行并成功；
- `fresh_membership_reader_cutover=true`、`session_restore_refresh_reread=true`、`guard_reference_cutover=true`、`explicit_membership_revision_lifecycle_source=true`；
- `authorization_tenant_members_updated_at_reads=0`、`authorization_membership_updated_at_compatibility_mappings=0`；
- M6 未连接数据库、未创建 Migration Lease，Schema、Migration、journal、snapshot 与数据库变化为 `0`；
- active historical orphan／Scope relation orphan 继承为 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`。

M6 完成不等于 M7、BASE-B1 或业务 Reader 已完成，也不改变项目级 Writer、Audit／模板、MIG-01B／C 和七线发布门禁。

## 唯一下一任务

```text
BASE-02 Membership Revision M7 Enforce 与旧路径退出
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创建编号。

当前状态：**仅冻结且尚未启动；本 handoff 合并后按当前 ULTRA 用户授权继续**。

M7 是 M0→M7 唯一串行的最终物理 Enforce 切片。它只在 M1～M6 全证据通过后，收紧 Membership current envelope、transition 最终约束并完成旧路径退出证明；不处理 historical orphan，不 `VALIDATE` A2-P2 FK，不放行项目业务 Reader，也不启动 BASE-B1。

## 一、不得重开的 accepted 约束

1. `tenant_members` 继续是 Access Control 唯一 canonical Membership current；`tenant_membership_transitions` 只保存 append-only immutable evidence。
2. `revision` 为严格正整数、初值 `1`、每次授权事实变化严格 `+1`；Membership revision、Binding version 与 Scope revision 三个版本域互不替代。
3. current envelope 的 accepted 列、lifecycle `active／revoked／deleted`、provenance Shape、tombstone／incarnation 与 ABA 规则不变。
4. `expectedRevision` CAS、current 与 transition 同事务原子形成、Owner 外 direct Writer／Deleter 为 `0` 的规则不变。
5. `updated_at` 只保留普通更新时间语义，不得恢复为授权 revision 或兼容 fallback。
6. M7 不新增第二套 current，不改变 Identity／Access Control／Tenancy／Security Owner，不把 Operating Context 纳入授权组合。
7. historical orphan 与 A2-P2 Scope FK 不属于 M7；不得通过 M7 回填、删除、rebind、创建 Scope 或执行 `VALIDATE`。
8. transition evidence 的键、FK、UNIQUE、CHECK、append-only trigger 与 Runtime 最小权限不能由 Repository 约定替代。

## 二、启动只读冻结

改文件或申请 Lease 前，必须从最新 main 动态确认：

1. `main=origin/main`、工作树干净、分支保护与 Required Check 稳定，没有其他 Agent 或 Migration 执行者；
2. M1～M6 的实施、独立审查、执行证据和 handoff 全部已合并，M6 六项完成旗标保持不变；
3. 仓库 journal、SQL 文件集合与固定 localhost-only local_acceptance 环境 latest 精确一致；snapshot 仍保持独立旧基线且不参与生成；
4. current envelope all-null／partial 为 `0／0`，complete／transition／exact current-head 保持一致，duplicate、identity mismatch、parent missing、conflict、unexpected 均为 `0`；
5. current 每行都有唯一 exact transition head，transition Shape、append-only trigger、键、FK、UNIQUE 与 CHECK 均无漂移；
6. Owner 外 direct Membership Writer／Deleter 文件和符号为 `0／0`，AQ008 通过；生产授权链时间戳 fallback 为 `0／0`；
7. active historical orphan／Scope relation orphan 仍为 `1／1`，A2-P2 Scope FK 仍为 `NOT VALID`；这些值只作为排除范围证据；
8. 固定环境没有并发 Writer、未解释 Catalog／Shape／journal 漂移或非 localhost 目标；
9. 能证明全新执行前恢复点、隔离恢复、唯一 Migration Lease、编号分配和受控执行结果。

任一事实无法证明时，保持数据库零变化，只做低敏只读核验并按 ULTRA 硬停止规则处理。

## 三、默认实施文件范围

M7 默认只允许一个 Schema／Migration 回退域，精确候选为：

1. `drizzle/<实时分配编号>_base02_membership_revision_enforce.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/schema.ts`；
4. `src/server/db/tests/Schema.test.ts`。

实时审计若证明必须增加第五个测试或 AQ 规则文件，应拆为独立原子 PR，不得静默扩大四文件 Migration PR。不得修改 snapshot，不运行 `db:generate`，不得预留或预先批准编号。

## 四、M7 Enforce 目标

1. 将 `tenant_members` current envelope 的无条件必填列收紧为 `NOT NULL`：`revision`、`lifecycle_status`、`current_provenance_source`、`current_provenance_reason_code`、`current_provenance_command_id`、`current_provenance_recorded_at`。
2. 保留 actor、occurred、revoked、deleted 的 accepted 条件 nullability；最终 CHECK 只接受完整 lifecycle／provenance Shape，不再接受全 NULL legacy envelope。
3. `revision` 继续限制在 `1..2147483647`；不添加 default，不由 trigger 自动推进 revision。
4. transition 最终约束必须与 accepted 六种 transition、`from+1`、role、lifecycle、provenance 与 legacy null Shape 精确一致；不得引入第二套 current 或墙钟排序。
5. append-only UPDATE／DELETE／TRUNCATE 拒绝、复合 FK、两项 UNIQUE 与顺序索引保持精确；不得删除、放宽或以 Runtime 约定替代。
6. 旧路径退出以仓库静态门禁证明：Owner 外 Writer／Deleter `0／0`，生产 `updated_at` 授权 fallback `0／0`，Session／Guard 已使用显式 Membership revision＋lifecycle。
7. M7 只实施约束，不执行历史回填、业务 DML、orphan 修复、Binding／Scope 变更、FK `VALIDATE`、Reader 放行或 BASE-B1 Runtime。

## 五、SQL、事务与 Lease 边界

- 实时分配唯一 Migration 编号，并创建绑定任务、Holder、Base、journal、环境、编号、时窗、失效、释放和交接的唯一不可复用 Lease。
- SQL 不写显式外层 `BEGIN／COMMIT／ROLLBACK`；使用 `SET LOCAL lock_timeout='1s'` 与有界 `statement_timeout`。
- 固定顺序锁定 `tenant_members` 与 `tenant_membership_transitions`，并在同一事务内重新核验 journal、Catalog、Shape、M1～M6 终态和零候选条件。
- 严格支持三个合法入口：`all_missing` 创建、`all_exact` 复用，或精确 `expected_m1_predecessor` 收紧。`expected_m1_predecessor` 必须同时证明六个无条件必填列仍 nullable 且无 default，并且同名 `tenant_members_current_envelope_shape_check` 精确等于已接受的 M1 “全 NULL 或完整 envelope”定义；只有该 predecessor 才允许在同一受控事务中删除同名旧 CHECK、以同名最终 complete-only CHECK 重建，并完成六列 `SET NOT NULL`。
- 除精确 `expected_m1_predecessor` 外，部分对象、未知同名异定义、等价异名、未知依赖或 Shape 漂移全部 fail-closed。禁止 `IF NOT EXISTS`、duplicate catch、自动重试、`CREATE INDEX CONCURRENTLY`、DML、回填、A2-P2 FK `VALIDATE`、`CASCADE` 或范围外对象。
- 事务开始后的失败不得自动重试；结果不确定时只做显式 READ ONLY 核验并停止，已消费 Migration 不得改写，只允许后续独立 forward-fix。

## 六、测试与完成门

至少锁定：

- Schema 与 SQL 的六个 current `NOT NULL`、最终 CHECK、条件 nullability、revision 上下界和无 default；
- transition 六种状态机、`from+1`、role、provenance、legacy null Shape、FK／UNIQUE／索引与 append-only trigger；
- SQL 无 DML、回填、`VALIDATE`、`SET NOT NULL` 之外的范围外 DDL、`DROP TABLE`、`CASCADE`、显式事务或自动重试；仅允许精确 `expected_m1_predecessor` 分支删除并同名重建 `tenant_members_current_envelope_shape_check`，任何其他 `DROP CONSTRAINT` 均失败；
- Owner 外 Writer／Deleter `0／0`、AQ008 通过、授权 fallback `0／0`；
- historical orphan 与 A2-P2 FK 保持排除，项目业务 Reader／Capability 未启动。

实施 PR、独立审查 PR、执行证据 PR、执行独立审查 PR 和 handoff PR 均须执行：

- 定向 Schema／Migration／Owner／Reader 测试；
- `git diff --check`；
- 架构检查器自测与 Base→Head 增量检查；
- lint、typecheck、完整测试、build；
- 对冻结 Head 的真实 Required Check，完整测试与 build 不得跳过。

## 七、交付顺序

1. 最新 main 上完成 M7 Catalog／Shape、精确对象、文件和测试冻结，实时分配编号并签发唯一 Migration Lease；
2. 创建单一四文件 Draft Schema／Migration PR，完成本地静态验证；
3. 创建单文件独立实施审查 PR，冻结实施 Head、编号、Lease、Schema／SQL／journal／测试一致性和零越界结论；
4. 两个 PR 检查成功后先 Merge Commit 合并实施，再重放审查 PR、重新跑检查并 Merge Commit 合并；
5. 从最新 main 创建全新执行前恢复点并完成隔离恢复验证，重新核验 Lease 和固定 localhost-only 环境；
6. 只通过 guarded `pnpm db:migrate` 完成一次授权目标调用；自动重试为 `0`，失败或结果不确定时只读核验并停止；
7. 释放 Lease，创建并验证执行后恢复点；依次完成执行低敏证据 PR 与执行独立审查 PR；
8. 创建四文件 M7 handoff PR，回填全部 Head、Run、Job、Merge Commit 与环境终态，冻结 BASE-B1；
9. 每个 PR 在真实 Required Check 成功后按当前 ULTRA 授权转 Ready、使用 Merge Commit 合并、同步 main并清理工作分支；全部 `backup/*` 保留。

## 八、硬停止与未启动范围

- Migration 编号、Lease、恢复点、事务回滚或执行结果无法证明时停止；
- current、Schema、journal、Writer、Reader 或数据发生未解释漂移时停止；
- 需要 snapshot、`db:generate`、回填、业务 DML、orphan 处置、FK `VALIDATE`、第二套 current、生产／非 localhost 环境时停止；
- Secret、Token、密码、私钥、PII 或真实凭证泄漏时停止；
- M7 handoff 合并前 BASE-B1～B6 不得启动；
- 项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与业务 Reader／Capability 不在本切片范围。

```text
next_task=BASE-02 Membership Revision M7 Enforce 与旧路径退出
next_task_started=false
next_task_authorized_under_ultra=true
m6_complete=true
m6_handoff_complete=true
eligible_for_m7_after_handoff=true
m7_started=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
active_historical_orphan_count=1
scope_relation_orphan_count=1
a2_p2_scope_fk_validated=false
project_writer_started=false
business_reader_started=false
```

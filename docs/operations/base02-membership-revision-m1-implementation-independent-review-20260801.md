# BASE-02 Membership Revision M1 Expand 实施独立审查

> 状态：`current evidence`
>
> 审查日期：2026-08-01
>
> 审查基线：`314af071bb180ce0a1095c5d21f31baa3cc15e4a`
>
> 实施 Base：`17840a7a90d712b2776256a19e90127bf3deeb89`
>
> 冻结交付：PR #869
>
> 冻结 Head：`2b57222beb0c8734853bbef184f8566bbd032074`
>
> Required Check：Run `30701389089`／Job `91372887624`，`success`
>
> Merge Commit：`314af071bb180ce0a1095c5d21f31baa3cc15e4a`
>
> Migration 编号：`0040`

## 1. 审查定位

本审查独立核对 Membership Revision M1 是否只完成 accepted Expand：建立 canonical current
envelope 与 immutable transition evidence 的物理载体，同时保留 legacy all-null 数据，不夹带校准、
Runtime Writer／Reader、历史数据修复或最终 Enforce。

审查只读取 PR #869、accepted decision、Schema／Migration、journal、测试和既有低敏冻结证据；不修改
被审查实现，不连接数据库，不执行 Migration、DDL、DML、校准或后续阶段。

## 2. 冻结范围与基线

PR #869 相对实施 Base 精确为 1 个提交、4 个文件：

1. `drizzle/0040_base02_membership_revision_expand.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/schema.ts`；
4. `src/server/db/tests/Schema.test.ts`。

PR #869 在独立质量修复 PR #870 合并后无冲突重放；重放前后上述四个文件的 Git blob 均完全一致。
PR #870 只修复既有测试异步 teardown 竞态，不触碰 M1 Schema、Migration、journal 或测试范围。

实时冻结结果：

- 前驱 `main` journal 共有 40 项，最新为 `0039`；
- M1 手工追加唯一 `0040_base02_membership_revision_expand`，SQL 集合与 journal 连续；
- snapshot 仍停留在 `0026`，没有修改；
- 编号没有提前预留；绑定两个历史实施 Base 的 Lease 均已在未消费状态释放；
- 当前 active Migration Lease 为 0，累计消费次数为 0；只有实施 PR 与本审查合并并重新冻结环境、
  恢复点和最新 Base 后，才可签发唯一执行 Lease。

## 3. accepted 物理模型一致性

审查确认 M1 实现没有重开 P01～P12：

- `tenant_members` 继续是 Access Control 唯一 canonical Membership current；
- 新增 accepted 10 列 current envelope，全部 nullable、无 default；
- CHECK 只允许 legacy all-null 或满足 revision、lifecycle、provenance 和时间 Shape 的完整 current；
- revision 为 `integer`，范围 `1..2147483647`；正式 onboarding 只允许 revision 1＋active；
- revoked／deleted 至少为 revision 2，deleted 保持终态 Shape；
- 新建 `tenant_membership_transitions` 16 列 append-only evidence，不成为第二 current；
- transition 包含 create／refresh／revoke／reactivate／delete／legacy_calibration；
- `(tenant_id,membership_id)` 复合 FK、两组 UNIQUE、确定性 revision 索引和四组 Shape CHECK
  与 accepted decision 一致；
- UPDATE／DELETE／TRUNCATE 拒绝 trigger 已建立；稳定 Runtime role ACL 仍明确后置，没有虚报关闭；
- identity、`display_name`、Binding version、Scope revision 与 Operating Context 没有被 M1 改写。

## 4. Migration 安全边界

手写 Migration 已锁定：

- `lock_timeout='1s'`、`statement_timeout='5s'` 和固定 `search_path`；
- 锁序从 `tenant_members` 开始，再只读锁定 Binding 与 A2 锚点表；
- 事务内核对前驱 journal、现有 Schema、A2-P1 三表、A2-P2 索引／NOT VALID FK、Binding
  Shape 与 historical orphan；
- 目标 Catalog 只接受严格 `all_missing`；任何部分存在、同名异定义或等价异名唯一对象均
  fail-closed；
- 执行前后 Membership 与 Binding 行数守恒；
- 不写显式事务控制，不使用 `IF NOT EXISTS`、duplicate catch、自动重试或并发索引；
- 不包含 INSERT、UPDATE、UPSERT、DELETE、TRUNCATE、legacy calibration、回填、NOT NULL、
  VALIDATE、DROP、CASCADE、GRANT、REVOKE 或第三个业务对象；
- 不修改 snapshot，不运行 `db:generate`。

historical orphan 继续为既有阻断事实；M1 只核对其未漂移，不修复、不删除、不反向创建 Scope，
A2-P2 Scope FK 继续保持 `NOT VALID`。

## 5. Schema、journal 与测试证据

独立静态复核确认：

- Drizzle Schema、SQL、journal、对象名称、列序、类型、nullability、键和约束一致；
- journal `idx／when／tag` 与 SQL stem、前驱数量、时间和 hash 一致；
- `Schema.test.ts` 锁定 3 个 enum、10 列 current envelope、16 列 transition evidence、FK、
  UNIQUE、索引、CHECK、trigger、严格 `all_missing` 和全部禁止项；
- 定向 Schema 测试 71/71 通过；
- 架构检查器自测 67/67、增量架构检查、lint（0 error）、typecheck 与 `git diff --check` 通过；
- 三轮独立静态复核均未发现 PostgreSQL 16 或 Drizzle 的明确实现阻断；
- PR #869 新 Head 的真实 Required Check 已完整成功；环境核对、依赖安装、架构检查器自测、
  增量架构检查、lint、typecheck、完整测试和 build 均实际执行，build 未跳过；
- PR #869 已使用 Merge Commit 合并；两个父提交分别为实施 Base 与冻结 Head，Merge tree 与
  冻结 Head tree 完全一致。

真实 Catalog 中 trigger function／trigger 属性、事务回滚净变化、创建后对象定义与数据守恒，必须在
实施 PR 合并后的固定 local_acceptance 受控 Migration 中再次证明；静态审查不把这些写成已执行事实。

## 6. 未执行与停止条件

当前冻结事实：

- `m1_migration_executed=false`；
- `migration_lease_consumed=false`；
- `legacy_calibration_executed=false`；
- `runtime_writer_changed=false`；
- `runtime_reader_changed=false`；
- `historical_orphan_modified=false`；
- `a2_p2_scope_fk_validated=false`；
- `m2_started=false`。

发生以下任一情况必须停止：Required Check 失败、Base／Head／四文件范围漂移、Lease 或编号不唯一、
journal／Catalog／Shape／A2 终态／orphan 数量出现未解释漂移、恢复点或事务回滚无法证明、需要 legacy
DML／NOT NULL／VALIDATE／snapshot／`db:generate`、目标不是固定 localhost-only，或出现敏感信息泄漏。

## 7. 审查结论

```text
base02_membership_revision_m1_implementation_review=passed
m1_expand_design_complete=true
m1_migration_number=0040
m1_file_scope_exact=true
m1_required_check_pending=false
m1_implementation_merge_complete=true
migration_lease_active=false
migration_lease_consumed=false
eligible_for_local_acceptance_execution_refreeze_after_merge=true
eligible_for_m2=false
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
```

本结论只允许在本审查合并后重新冻结 local_acceptance、恢复点和唯一执行 Lease，再调用一次 guarded
Migration。它不构成提前启动 M2、校准 legacy 数据或放行任何 Reader 的授权。

# BASE-02 Membership Revision M7 最终约束实施独立审查

## 1. 文档定位

本文对 M7 最终约束实施 PR #904 进行独立、只读审查，冻结以下证据：

- 实施 Base：`5de9dc694b0de072eb68d43f2fbccab49c5bcb37`；
- 实施 Head：`f43ce1b9ba554ca034441440c1a57781cbddc198`；
- 实施 Merge Commit：`65d12f7e0f9a47df3279a9052b9b21fb54a8e3ad`；
- Required Check：Run `30739072657`／Job `91473075000`，结论为成功；
- 实施范围：单提交、四文件。

本文不修改实施文件，不构成数据库执行、Migration Lease 消费、historical orphan 处置、Scope FK
`VALIDATE`、BASE-B1 或任何后续 Runtime 的授权。审查期间目标数据库 DDL／DML 与 Migration 调用均为
0。

## 2. 前置阶段与范围审查

M1 Expand、M2 Owner Writer／CAS、M3 旧 Writer 封堵、M4 deterministic calibration、M5 高水位
追赶和 M6 Reader 切换均已有独立实施、验证、审查与 handoff 证据。M7 Runtime 类型收紧 PR #902
及独立审查 PR #903 已合并；实施前 handoff 修正 PR #901 明确 M7 Migration 只接受精确 M1
predecessor 或精确 all-exact。

PR #904 的修改精确为：

1. `drizzle/0043_base02_membership_revision_enforce.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/schema.ts`；
4. `src/server/db/tests/Schema.test.ts`。

snapshot、其他 Migration、Runtime、API、Session、Guard、Binding 生命周期、Scope FK 和业务模块修改
均为 0。Migration Allocation Lease 的候选编号为实时分配的 `0043`，当前唯一、不可续期；该 Lease
只保护编号，不构成目标数据库执行权。

## 3. Catalog 状态机与 DDL 审查

Migration 的入口状态只有两种：

- `expected_m1_predecessor`：六个必填 current 列仍可空，且同名 current CHECK 为冻结的 M1
  predecessor 精确指纹；
- `all_exact`：六列均为 `NOT NULL`，且同名 current CHECK 为 M7 最终精确指纹。

任何全缺、部分存在、同名异定义、列类型／default 漂移、约束、索引、trigger、rule、RLS、继承、
publication 或关键依赖漂移均 fail-closed。DDL 精确为：

- 删除并同名重建 `tenant_members_current_envelope_shape_check`；
- 对 `revision`、`lifecycle_status`、`current_provenance_source`、
  `current_provenance_reason_code`、`current_provenance_command_id`、
  `current_provenance_recorded_at` 六列执行 `SET NOT NULL`；
- `current_provenance_actor_id`、`current_provenance_occurred_at`、`revoked_at`、`deleted_at`
  保持 accepted 条件可空语义。

planned 为 7，首次创建要求 `created=7／reused=0`，all-exact 复用要求
`created=0／reused=7`；两种状态均要求 `planned=created+reused`、`conflict=0`、
`unexpected=0`。

## 4. accepted 生命周期语义一致性

最终 CHECK 保留并收紧已接受语义：

- revision 为 1 至 2147483647 的稳定正整数；
- legacy calibration 只能是 revision 1、active、无伪造 actor／occurred time；
- formal onboarding 只能从 revision 1 active 形成；
- Access Control command 必须带 actor 与 occurred time；
- active 不带 revoked／deleted tombstone；
- revoked 从 revision 2 起，且 revoked time 与当前 provenance occurred time 一致；
- deleted 从 revision 2 起，deleted time 与当前 provenance occurred time 一致，且不得早于已有
  revoked time。

SQL 与 Drizzle Schema 的最终 CHECK 归一化 token 完全一致。M7 不改变 Membership identity、role、
display name、current provenance 值或 immutable transition evidence，也不形成第二套 Membership
current。

## 5. 数据、transition 与跨域边界

静态审查确认 Migration：

- 业务 `INSERT／UPDATE／DELETE／TRUNCATE` 为 0；
- 回填、`VALIDATE CONSTRAINT`、`SET NOT NULL` 以外的 shape 扩张、`DROP` 其他对象、`CASCADE`、
  动态 SQL、自动重试、`IF NOT EXISTS` 和 `CREATE INDEX CONCURRENTLY` 为 0；
- transition DDL 为 0，并继续精确核对 16 列、8 个约束、4 个索引、2 个 append-only trigger、
  trigger function 与无未验证 transition 约束；
- Scope FK 不变并继续 `NOT VALID`；
- Membership、transition、Binding、Scope、Context Version、Context Head 在迁移前后按稳定全行
  指纹守恒；
- historical active orphan／Scope relation orphan 继续为 `1／1`，未在 M7 处置；
- A2-P1 三表、A2-P2 对象、journal predecessor 和 snapshot `0026` 均保持冻结边界。

因此，M7 没有夹带 BASE-B5、A2-P2 FK `VALIDATE`、项目级 Writer／Audit／MIG-01B／MIG-01C
或业务 Reader 放行。

## 6. 隔离恢复与幂等验证

仓库外 0600 临时验证器以 fixed localhost-only 目标的 custom archive 建立随机隔离数据库，在不修改
原目标的前提下完成：

1. M1 predecessor 首次执行；
2. M7 all-exact 第二次复用；
3. 六列最终不可空、最终 CHECK 指纹、关键行数、orphan、Scope FK 与 journal predecessor 核对；
4. 隔离数据库删除和残留为 0。

PostgreSQL dump／restore 仅对既有
`tenant_membership_transitions_revision_shape_check` 去掉一对冗余括号。验证器只有在原目标完整
constraint 指纹仍精确、唯一差异名称固定、文本长度差精确 2、标识符／操作符 token 相同、直接
删除恰好一对括号后文本完全一致、约束类型／validated／no-inherit 状态相同且其余 Catalog 全部
精确时，才在内存验证副本中替换一次该指纹。仓库 Migration 与真实目标 Catalog 硬门未放宽。

隔离验证结果为首次执行通过、all-exact 复用通过、round-trip exception 1、原目标变化 0、隔离
残留 0。最终 current CHECK 指纹来自实际隔离 DDL 结果，不是由 SQL 文本猜测。

## 7. 测试与 Required Check

- `git diff --check`：通过；
- 架构检查器自测：125／125；
- 增量架构检查：通过；
- `Schema.test.ts`：69／69；
- lint：通过，只有 4 条既有 warning；
- typecheck：通过；
- 完整测试：430 文件、6345 测试全部通过；
- build：101／101，实际执行并通过；
- Required Check Run `30739072657`／Job `91473075000`：全部步骤成功，完整测试和 build 未跳过。

## 8. 风险、执行前硬门与结论

本审查不把静态实现成功等同于目标环境执行成功。实施 PR 合并后仍必须：

1. 从最新 main 重新冻结 journal、Catalog、Shape、M1～M6 终态、orphan 和并发状态；
2. 释放 Allocation Lease，并创建全新执行前恢复点，完成隔离恢复验证；
3. 创建全新、唯一、不可续期的 Execution Lease；
4. 通过 guarded `pnpm db:migrate` 执行一次且仅一次，自动重试为 0；
5. 失败或结果不确定时只做 READ ONLY 核验并停止，不改写已消费 Migration；
6. 成功后验证 `planned=7`、`planned=created+reused`、`conflict=0`、`unexpected=0`，数据与跨域
   指纹不变，再形成执行证据和独立执行审查。

独立审查结论：

```text
m7_schema_migration_review=passed
eligible_for_m7_implementation_merge=true
eligible_for_m7_database_execution=false
eligible_for_base_b1=false
```

PR #904 可以进入合并前冻结复核；目标数据库执行仍须等待实施与本审查 PR 合并、最新 main 重冻结、
全新恢复点和全新 Execution Lease。BASE-B1 仍未启动。

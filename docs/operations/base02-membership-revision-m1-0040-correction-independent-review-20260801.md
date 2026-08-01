# BASE-02 Membership Revision M1 `0040` 纠错独立审查

## 1. 审查定位

- 审查日期：2026-08-01（Asia/Shanghai）。
- 仓库：`love1252/zmtg-clean`。
- 审查基线：`eb71d2ab628032ef39182a96ea0b82f89b6dd49e`。
- 被审查 PR：#872。
- 被审查 Head：`fea420a03f793a8aeb1d33f1cfacbe914ce21423`。
- 被审查提交数：1。
- 被审查文件数：2。
- Required Check：Run `30703279028` / Job `91377908764`，结论为成功。
- PR #872 已于审查通过后使用 Merge Commit 合并，Merge Commit 为 `75f3c6663e7decce63634b1ee05579a454fb97ac`；其两个父提交分别为审查基线与上述被审查 Head，Merge tree 与被审查 Head tree 一致。

本审查只判断纠错是否精确修复首轮 Migration 的类型错误，以及是否具备合并条件；不构成数据库执行、恢复点、Migration Lease 或 M2 授权。

## 2. 首轮失败与终态证据

首轮固定 localhost-only `local_acceptance` 实际数据库 Migration 尝试为 1，自动重试为 0。失败原因是 `pg_enum.enumlabel` 的 PostgreSQL 类型为 `name`，原 SQL 对其直接 `array_agg` 后得到 `name[]`，再与显式 `text[]` 比较，产生 `name[] = text[]` 类型错误。

失败后的显式 `READ ONLY` 核验确认：

- 环境 journal 仍为 40；
- M1 Catalog 严格为 `all_missing`；
- Membership／Binding 行数仍为 `1／1`；
- A2-P1 三表仍为 `1／1／1`；
- Scope relation orphan／active historical orphan 仍为 `1／1`；
- M1 DDL 与业务 DML 的已提交变化均为 0；
- 首轮 Lease 已按 `claim／consume／release=1／1／1` 释放，活动 Lease 为 0；
- 事务完整回滚，不需要 Restore。

本任务允许的数据库环境只有上述固定 localhost-only `local_acceptance`。纠错前它没有消费旧 `0040`；其他环境不在本任务授权范围内。

## 3. 两文件范围复核

PR #872 精确修改：

1. `drizzle/0040_base02_membership_revision_expand.sql`；
2. `src/server/db/tests/Schema.test.ts`。

未修改：

- `drizzle/meta/_journal.json`；
- `src/server/db/schema.ts`；
- snapshot；
- 其他 Migration；
- Runtime、package、lock、CI 或数据库。

没有创建 `0041`，也没有预留新的 Migration 编号。

## 4. SQL 纠错复核

三个枚举 postcheck 分别覆盖：

1. `membership_lifecycle_status`；
2. `membership_provenance_source`；
3. `membership_transition_type`。

三处均从：

```sql
array_agg(enum_row.enumlabel ORDER BY enum_row.enumsortorder)
```

改为：

```sql
array_agg(enum_row.enumlabel::text ORDER BY enum_row.enumsortorder)
```

因此左侧聚合结果与右侧显式数组均为 `text[]`。枚举顺序仍由 `enumsortorder` 决定，accepted 枚举内容、M1 DDL、锁顺序、timeout、Catalog 分类和数据不变门禁均未改变。

## 5. 回归测试复核

`Schema.test.ts` 新增两项约束：

- 精确要求 cast 后的聚合出现 3 次；
- 拒绝旧的未 cast 聚合写法。

该断言只锁定本次 PostgreSQL 类型缺陷，不改变其他 Schema 或 Migration 断言。

验证结果：

- `git diff --check`：通过；
- Schema 定向测试：71/71；
- 架构检查器自测：67/67；
- 增量架构检查：通过；
- lint：0 error，4 个既有 warning；
- typecheck：通过；
- 完整测试：422 文件、6194 测试全部通过；
- build：101/101；
- GitHub Required Check：成功，完整测试和 build 均实际执行。

## 6. 风险与执行边界

- 首轮失败历史必须永久保留，不得改写为首次成功。
- PR #872 合并不等于数据库已执行。
- 第二次执行必须使用新的执行前恢复点、独立隔离恢复验证、全新的唯一 Migration Lease 和不可覆盖 attempt marker。
- 第二次执行前必须重新冻结环境 journal 40、唯一 pending `0040`、M1 Catalog `all_missing`、业务计数及无并发 Writer。
- 第二次执行完成后的累计实际数据库尝试应记录为 2；自动重试仍为 0。
- 不得复用首轮 Lease，不得创建 `0041`，不得修改 journal 或 snapshot。
- M2～M7 与 BASE-B1～B6 尚未启动。

## 7. 独立结论

```text
base02_membership_m1_0040_correction_review=passed
eligible_for_0040_correction_merge=true
eligible_for_second_local_acceptance_migration=false
eligible_for_m2=false
```

PR #872 的两文件纠错精确、可审查且没有扩大 accepted 范围，可以进入正式审查并使用 Merge Commit 合并。数据库第二次执行仍须等待纠错合并、审查记录回填以及执行前全量重新冻结。

## 8. 合并后回填

- PR #872 最终状态：已合并（Merged）。
- PR #872 Merge Commit：`75f3c6663e7decce63634b1ee05579a454fb97ac`。
- 本回填不改变首轮 F01 历史、回滚事实或独立审查结论。
- 本回填不构成数据库执行；新的恢复点、唯一 Migration Lease 与第二次受控 Migration 仍须在独立审查合并后的最新 `main` 上重新冻结。

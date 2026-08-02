# BASE-02 Binding transition evidence Expand 实施独立审查

> 状态：`current evidence + independent implementation review`
>
> 审查日期：`2026-08-02`
>
> 实施 PR：#920
>
> 实施 Head：`0649e5f43ff1ea318ba67a10420ffb995b8c78f0`
>
> 实施 Merge Commit：`a4b99e6a6384bdc1ee43047be5ebef644eeff90a`
>
> Required Check：Run `30753647994`／Job `91511975780`

## 1. 审查结论

```text
base02_binding_transition_expand_implementation_review=passed
migration_0044_implementation_merge_complete=true
migration_0044_repository_journal_entries=45
migration_0044_database_execution=false
migration_0044_consumed=false
binding_transition_expand_catalog_execution_state=not_executed
eligible_for_0044_local_acceptance_execution_refreeze_after_review=true
eligible_for_binding_runtime_writer=false
base_b2_complete=false
eligible_for_base_b3=false
```

## 2. 冻结范围

PR #920 为单提交、四文件范围：

1. `drizzle/0044_base02_binding_transition_expand.sql`
2. `drizzle/meta/_journal.json`
3. `src/server/db/schema.ts`
4. `src/server/db/tests/Schema.test.ts`

未修改 snapshot、Runtime、API、UI、package、lock 或业务数据。

## 3. Migration 审查

`0044_base02_binding_transition_expand`：

- predecessor count／when／hash 固定为已消费 `0043`；
- 只接受目标对象全部缺失；
- 校验 Membership 关系、Binding Shape、active 重复和既有 Scope FK；
- Scope FK 必须继续 `NOT VALID`；
- 新增 Binding transition enum；
- 新增 append-only transition evidence 表；
- 新增 Binding `UNIQUE (tenant_id,id)`；
- 建立原 Binding 与 replacement Binding 的 tenant-bound FK；
- 建立 command replay、Binding version、Shape 和 provenance 约束；
- evidence UPDATE／DELETE／TRUNCATE 均被拒绝；
- Binding current identity／tuple／assignment／expiry 被保护；
- Binding current 只允许 active→revoked、version+1；
- Binding current DELETE／TRUNCATE 被拒绝；
- 不包含 legacy calibration、业务 DML、FK VALIDATE、CONCURRENTLY 或 destructive DDL。

## 4. PostgreSQL 类型安全复核

枚举 postcheck 已显式使用：

`enumlabel::text`

不存在历史 `name[] = text[]` 比较错误。Schema 回归测试同时要求 cast 存在并拒绝未 cast 写法。

## 5. Journal 与历史测试

- repository journal：`44 → 45`；
- last tag：`0044_base02_binding_transition_expand`；
- predecessor：`0043_base02_membership_revision_enforce`；
- snapshot `0026` hash 保持不变；
- M7 测试继续精确核验历史 `0043`，但不再错误要求 `0043` 永远是 journal 最后一项。

## 6. 持续阻断

本审查与实施 PR 均未连接数据库、未执行 Migration、未创建执行 Lease、未建立执行前后恢复点，也未消费 `0044`。

下一步只能重新冻结固定 localhost-only `local_acceptance`、Catalog、journal、并发状态、恢复点与唯一执行 Lease，然后进行一次 guarded Migration。不得直接启动 Binding Runtime Writer。

historical orphan 保持原值；A2-P2 Scope FK 继续 `NOT VALID`；BASE-B3～B6、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader继续阻断。

# Drizzle migration snapshot 策略

## 当前策略

本项目当前采用“已审查手写 SQL + `drizzle/meta/_journal.json` 登记”的 Migration 执行策略。仓库 `current journal` 由 `drizzle/meta/_journal.json` 的最后一项 `tag` 唯一决定，并由测试动态核对 journal 条目与 `drizzle/*.sql` 文件集合；不得在本文另立不受核验的固定编号口径。生产 Migration 的 SQL 内容只允许来自仓库中已评审的 `drizzle/*.sql`，执行顺序与集合由 journal 约束；journal 记录也不等于任一环境已经执行，环境实际状态仍须单独核验。

最新 snapshot 当前仍为 `drizzle/meta/0026_snapshot.json`。journal 与 snapshot 可以阶段性不同步，且历史 snapshot 链并非每个 Migration 都有对应文件；snapshot 不作为生产执行来源，也不得用于推断生产数据库已经执行的 Migration。因此：

- 不生成、补写或伪造 snapshot；
- 不原地修改已存在 Migration、journal 或 Schema；
- snapshot 缺口作为后续独立 metadata 治理项处理；
- 除未来独立且明确授权的 snapshot baseline 治理在隔离临时环境中的验证外，禁止运行 `db:generate`；
- 禁止把未审查的 generate 结果直接用于 production Migration；
- 禁止新增 snapshot-diff Migration；
- production 只执行 runbook 中 allowlist 覆盖的已审查 SQL。
- 本文不批准、预留或占用下一个 Migration 编号；未来编号必须在独立 Migration Lease 下依据届时的 main、journal 与远端并发状态实时分配。

## 后续 `db:generate` 前置条件

未来任何 `db:generate` 任务开始前，必须先独立完成 snapshot baseline 治理：

1. 盘点 journal、SQL、schema 和现有 snapshot 的对应关系；
2. 使用与仓库锁定版本一致的 Drizzle Kit，在隔离的本地临时环境验证 baseline 方案；
3. 检查 generate 是否会重复生成最新 snapshot 之后、截至 current journal（含）的已由手写 SQL 建立的对象；
4. 对 baseline 结果进行逐对象评审，不手工伪造 snapshot `id` / `prevId`；
5. 增加 journal/SQL/snapshot 一致性检查；
6. 将 metadata 治理与业务 schema 变更拆分评审；
7. 未完成上述步骤前，不新增 snapshot-diff Migration。

若发现某环境已执行过与当前仓库内容不同的 migration，应停止并创建新的 forward-fix migration；不得原地修改已执行 SQL 或手改生产 journal。

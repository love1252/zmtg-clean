# Drizzle migration snapshot 策略

## 当前策略

本项目当前采用“已审查手写 SQL + `drizzle/meta/_journal.json` 登记”的 migration 执行策略。`0034_v08_04f_ea_customer_mapping_data_foundation` 与 `0035_v08_04f_fa_trusted_reachout_safety_foundation` 均是经评审的手写 SQL，并已登记到 journal。生产 migration 的唯一执行输入是仓库中已评审的 `drizzle/*.sql`；snapshot 不作为生产执行来源，也不用于推断生产数据库已执行状态。

当前 journal 已登记到 `0035`，但最新 snapshot 停在 `0026`，且历史 snapshot 链并非每个 migration 都有对应文件。因此：

- 本任务不新增 `0036`，不生成或伪造 snapshot；
- 不修改已存在 migration、journal 或 schema；
- snapshot 缺口作为后续独立治理项处理；
- production 禁止运行 `db:generate`；
- 禁止把未审查的 generate 结果直接用于 production migration；
- production 只执行 runbook 中 allowlist 覆盖的已审查 SQL。

## 后续 `db:generate` 前置条件

未来任何 `db:generate` 任务开始前，必须先独立完成 snapshot baseline 治理：

1. 盘点 journal、SQL、schema 和现有 snapshot 的对应关系；
2. 使用与仓库锁定版本一致的 Drizzle Kit，在隔离的本地临时环境验证 baseline 方案；
3. 检查 generate 是否会重复生成 `0027` 至 `0035` 已有对象；
4. 对 baseline 结果进行逐对象评审，不手工伪造 snapshot `id` / `prevId`；
5. 增加 journal/SQL/snapshot 一致性检查；
6. 将 metadata 治理与业务 schema 变更拆分评审；
7. 未完成上述步骤前，不新增基于 snapshot 差异的生产 migration。

若发现某环境已执行过与当前仓库内容不同的 migration，应停止并创建新的 forward-fix migration；不得原地修改已执行 SQL 或手改生产 journal。

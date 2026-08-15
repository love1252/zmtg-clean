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

## SYS-01 current-schema candidate baseline 治理

S25 fresh 读取当前安装的 `drizzle-orm@0.45.2` 后确认，PostgreSQL migrator 只读取 `drizzle.__drizzle_migrations` 中 `created_at` 最大的一行，并以 `database.created_at < repository entry.when` 决定 pending；`hash` 会被写入但不参与 pending 判断，原生实现也不支持 external baseline marker 或 baseline metadata。基于该语义，SYS-01 side-by-side local-development candidate 的唯一受准入表示为：

- 一份 `drizzle/baselines/sys01-local-dev-current-schema-0045-v1.sql` reviewed schema-only artifact；
- 一份同名 `.json` immutable manifest，记录 S26 frozen base commit、parent、artifact/schema fingerprint 与受审查 tooling blob identity；marker hash由 manifest exact bytes 外部计算，manifest 不记录自身 digest；
- `drizzle.__drizzle_migrations` 中恰好一条 formal marker row，以 `0045_base02_binding_legacy_calibration` 的 `when=1785738060856` 为 parent 高水位，`hash` 为 manifest exact bytes 的 SHA-256；
- marker hash 不等于 `0045` SQL hash，不写入 `0000..0045` 的伪历史，也不声明这些 Migration 曾在 candidate 执行；
- existing legacy-chain DB 不加 marker、不 rebase、不改 journal；两种 origin 只在 guard provenance 上分流，之后消费同一 repository future tail。

future common-tail Migration 的 SQL/precheck 必须同时接受 exact legacy prefix 与 exact marker+tail prefix；不得只以 legacy journal row count 作为唯一 predecessor 条件。两种 origin 都必须通过 migration-specific catalog/data preconditions 后才可执行。

baseline schema 的 source of truth 是 current `schema.ts` model 加逐对象审查的 hand-written catalog additions。后者必须覆盖 model 未完整表达的 `NOT VALID`／validation state、functions、triggers 等对象。artifact 只可在隔离空白 loopback PostgreSQL 中验证，不得从 outdated local-development DB、acceptance/production 数据或业务行导出。

fingerprint 使用 deterministic canonical catalog JSON 的 UTF-8 SHA-256，覆盖 schemas、tables、columns、types、enums、PK、FK、unique、checks、indexes、triggers、defaults、nullability、sequences 与 application functions；排除 OID、owner、数据库名、timestamp、环境标识、secret、PII 与业务数据。artifact 自身使用 exact UTF-8/LF bytes SHA-256。

该 candidate baseline 独立于 Drizzle snapshot lineage：

- 最新 snapshot 继续是 `0026_snapshot.json`，不新建、不修改、不伪造 `id`／`prevId`；
- baseline SQL/manifest 不是 snapshot，也不关闭 snapshot drift；
- `NEW_DRIZZLE_SNAPSHOT_REQUIRED=false_for_selected_candidate_baseline`；
- future `db:generate` 仍须独立、version-locked、isolated snapshot baseline 治理与逐对象审查；
- 本文仍不批准、预留或占用下一 Migration 编号。

marker missing/mismatch、manifest/artifact/schema fingerprint mismatch、unknown version、mixed legacy+baseline lineage、journal drift、repository SHA drift 或 production target 必须 fail closed，不得自动 repair。正式 contract 与 exact tooling allowlist 见 `docs/operations/seven-stream-system-sys01-candidate-migration-baseline-governance-admission-20260815.md`；该文档不构成 artifact、tooling、数据库或 Migration 执行授权。

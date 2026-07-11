# Production migration runbook

## 1. 适用范围

本 runbook 适用于 `0034_v08_04f_ea_customer_mapping_data_foundation`、`0035_v08_04f_fa_trusted_reachout_safety_foundation` 以及未来经评审并进入 allowlist 的 migration。它只约束数据库变更执行，不构成真实发送授权。

生产环境禁止直接运行裸 `drizzle-kit migrate`，禁止运行 `pnpm db:seed`，禁止运行 `db:generate` 后未经 SQL 审查直接迁移。生产执行只允许使用仓库内已审查 SQL 和 `pnpm db:migrate` guarded 入口。

## 2. 职责与变更单

每次执行必须记录但不得包含凭证：

- 执行人：具备限时 migration 权限的 operator；
- 复核人：与执行人不同的 database reviewer；
- change ticket / approval ref：已批准且可审计；
- 执行窗口、影响范围、预期最新 migration、停止条件；
- 备份或恢复点标识。

owner 和 approver 必须在 change ticket 中明确。不得由同一人同时完成申请、批准和生产执行。

## 3. 执行前核验

### 3.1 数据库身份

通过 secret manager 注入当前 shell 所需变量，不写入 `.env.local`，不在工单、终端日志或截图中记录值。核验：

- 数据库平台/集群身份与 change ticket 一致；
- host 和 database 名分别与经批准的预期值完全匹配；
- 当前账户为限时、最小权限账户；
- 当前 shell 不含与本次任务无关的长期凭证。

只允许报告 masked host/database 身份核验结果，不输出 `DATABASE_URL`。

### 3.2 备份与恢复点

执行前确认最近备份可用，并创建或确认本次变更对应的恢复点。记录恢复点标识、保留期、恢复负责人和预计恢复时间。无法验证恢复能力时停止。

### 3.3 journal、pending 与 SQL

- 核对 `drizzle/meta/_journal.json` 与 `drizzle/*.sql` 一一对应；
- 核对生产当前 journal/pending 状态，确认不存在未知、跳号或部分执行 migration，并将当前已执行的最后一个 journal tag 作为 expected current；
- 审查从当前状态到预期目标的全部 SQL；
- 确认 expected target 是仓库 journal 最新项；
- 将 expected current 之后、expected target 之前（含 target）的全部 pending migration 加入 allowlist；allowlist 必须与该 pending 集合精确一致，不得遗漏或夹带额外 migration；
- 发现已经执行过但仓库 SQL 后续被修改时立即停止，改走独立 forward-fix migration 评审。

当前 snapshot 只到 `0026`。生产执行不以 snapshot 为来源，生产环境禁止运行 `db:generate`；具体策略见 `docs/operations/drizzle-migration-snapshot-strategy.md`。

### 3.4 lock window、timeout 与停止条件

在低峰 lock window 执行，并预先设置经 DBA 评审的 statement timeout、lock timeout 和监控告警。出现任一情况立即停止，不重试写操作：

- 数据库身份、pending 集合或 allowlist 不一致；
- 无可验证备份/恢复点；
- 获取锁超过批准窗口；
- 活跃请求、复制延迟、错误率或资源使用超过阈值；
- SQL 与评审版本不一致；
- migration 出现非零退出、未知状态或部分成功；
- 任何日志可能暴露凭证或客户数据。

## 4. 0034 / 0035 专项检查

### 4.1 0034 复合 UNIQUE 风险

`0034` 为 customers 增加机构字段及复合 `UNIQUE`，创建约束/索引可能扫描表并持有较强锁。执行前应：

- 评估 customers 表大小、写入流量和预计锁时长；
- 检查目标复合键是否存在重复；
- 确认 nullable 字段语义和历史行影响；
- 在 lock timeout 内无法完成时停止，不反复抢锁；
- 不在本任务中进行历史数据回填。

### 4.2 0035 新表与 CHECK

`0035` 新增可信事实、频控和 dry-run 快照表。执行后核验：

- 预期表、enum、索引、外键存在且归属正确；
- permission status/source、频控上限与窗口的 `CHECK` 生效；
- dry-run 快照中的真实网络、真实发送和 proof 开关仍 fail-closed；
- route allowlist 及 self-built/mock-ready/proof-eligible 组合限制生效；
- 不存在非预期客户数据写入。

## 5. guarded 执行

生产执行前，在当前 shell 显式提供以下**变量名称**对应的临时值：

- `DATABASE_URL`
- `ZMTG_DB_MIGRATION_TARGET`
- `ZMTG_DB_MIGRATION_CONFIRMATION`
- `ZMTG_DB_MIGRATION_APPROVAL_REF`
- `ZMTG_DB_MIGRATION_EXPECTED_HOST`
- `ZMTG_DB_MIGRATION_EXPECTED_DATABASE`
- `ZMTG_DB_MIGRATION_ALLOWLIST`
- `ZMTG_DB_MIGRATION_EXPECTED_CURRENT`
- `ZMTG_DB_MIGRATION_EXPECTED_TARGET`

确认 target 为 production、人工确认字符串符合脚本要求、approval ref 已批准，host/database 与目标一致，expected current 与数据库已执行状态一致，expected target 是仓库 journal 最新项，且 allowlist 精确覆盖两者之间的全部 pending migration。然后执行：

```bash
pnpm db:migrate
```

不得绕过 wrapper，不得将变量值拼入命令、shell history、日志或工单。wrapper 不转发 `drizzle-kit` 的 stdout/stderr；执行失败只返回固定低敏错误，禁止输出连接串、密码或 secret。

## 6. postcheck

由执行人和复核人共同确认：

- migration 进程成功退出，journal/pending 状态符合预期；
- 0034/0035 专项对象和约束核验通过；
- 应用只读健康检查、错误率和数据库指标正常；
- 无未知对象、额外数据写入或权限扩张；
- `ZMTG_WECOM_REAL_NETWORK_ENABLED` 与 `ZMTG_WECOM_REAL_SEND_ENABLED` 继续保持关闭；
- 记录脱敏结果、时间与变更单引用，不记录 secret、`DATABASE_URL` 或客户数据。

## 7. 失败处理

失败后先停止应用级写入或进入批准的维护状态，保留脱敏证据并升级 DBA/owner。由 change owner、DBA 和 approver 根据实际事务状态决定：

- 优先通过新的、已审查 migration 做 forward-fix；
- 禁止执行破坏性 down migration；只有已预演、可证明安全且得到批准的恢复方案才可用于 rollback；
- 涉及数据一致性或未知部分成功时，使用已验证恢复点恢复；
- 禁止临场手改 journal、原地修改已执行 SQL 或重复执行未知步骤。

数据库 migration 成功不代表渠道可上线。真实网络与真实发送必须继续关闭，后续阶段另行授权。

# MIG-01A2 本地验收数据库 Stage A 基线与恢复点证据

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-A-COMPLETE`
- 审计与执行日期：2026-07-30
- 时区：`Asia/Shanghai`（CST，UTC+08:00）
- 冻结 Base：`16363eb4093e72fdd8371821c12df363d624ee86`
- 目标环境：Mac localhost-only 本地安全验收环境
- 状态：`current evidence`
- 本阶段结果：Stage A 本地基线与恢复点完成

本报告只记录固定本地验收数据库的迁移前后低敏证据、两个受控备份及其隔离恢复验证。它不包含数据库正文、备份 hash 原值、真实 Manifest、双键、凭证或业务数据，也不构成 Stage B、A2-P1 或 A2-P2 的启动授权。

## 2. 环境身份与授权边界

| 项目 | 冻结结果 |
|---|---|
| 容器 | `zmtg-local-acceptance-pg` |
| 受控标签 | `com.zmtg.local-acceptance=true` |
| 镜像 | `postgres:16-alpine` |
| Docker Context | 本机 Unix socket |
| Host | `127.0.0.1` |
| 端口 | 仅 `127.0.0.1:55432` 映射至容器 `5432/tcp` |
| 数据库 | `zmtg_clean_local_acceptance` |
| PostgreSQL 数据目录 | 受控 Docker volume |
| 容器结束状态 | 保持运行 |

本阶段获得的授权只包括：

- 启动或复用上述受控本地容器；
- 为固定本地验收数据库创建迁移前、迁移后备份；
- 在同一受控容器的独立临时数据库中验证恢复；
- 使用仓库已有 Migration 将本地验收库推进到 0038；
- 读取 Journal、Catalog metadata 和低敏聚合计数；
- 创建本报告并完成独立 PR。

本阶段未连接测试服务器、生产数据库、其他 PostgreSQL 容器、HIS、企业微信或业务外部环境；未读取 `.env.local`、非本地 `DATABASE_URL`、Secret、Token、PII 或真实 Manifest。

## 3. 仓库静态门禁

迁移前对冻结 Base 完成以下静态复核：

- `drizzle/meta/_journal.json` 共 39 项，`idx` 为 0～38 的连续序列；
- 最新项为 `0038_mig_01a1_institution_isolation_expand`；
- 0038 新增 4 个 enum、3 张 A1 表、4 个新表外键和 5 个既有表可空字段；
- 0038 不包含 INSERT、UPDATE、DELETE、MERGE、Seed、回填、DROP、RENAME、既有列 `SET NOT NULL` 或 `VALIDATE CONSTRAINT`；
- 新增到既有表的 5 个字段均可空且无默认值；
- `drizzle/0038_mig_01a1_institution_isolation_expand.sql` 与 `src/server/db/schema.ts` 的 A1 Shape 一致；
- 当前没有 0038 之后的 Migration。

因此 0038 只属于 A1 Expand，不表示归属、Provisioning、回填、Enforce 或 Reader 放行已经完成。

## 4. 迁移前冻结结果

所有数据库读取均设置：

```text
default_transaction_read_only=on
statement_timeout=5s
lock_timeout=1s
BEGIN TRANSACTION READ ONLY
ROLLBACK
```

迁移前结果：

| 项目 | 结果 |
|---|---|
| Journal 表 | 存在 |
| 环境 Applied Migration | 38 |
| 仓库 Journal | 39 |
| 严格前缀比对 | 通过 |
| 唯一缺失项 | `0038_mig_01a1_institution_isolation_expand` |
| `tenants` | 存在，低敏计数 2 |
| `institution_scopes` | 缺失 |
| `institution_operating_context_versions` | 缺失 |
| `institution_operating_contexts` | 缺失 |
| A1 enum 已存在数量 | 0 |
| 0038 既有表新增字段已存在数量 | 0 |
| 非空闲并发会话 | 0 |
| 其他打开事务 | 0 |

环境 Journal 的前 38 行通过 `created_at + SQL SHA-256` 在内存中逐项匹配仓库前缀；原始 Journal hash 未写入文件、报告或 PR。三表、enum 和既有表新增字段均未部分存在，不存在无法解释的部分应用状态。

## 5. 迁移前备份与隔离恢复

- 备份标识：`zmtg_clean_local_acceptance-pre-0038-20260730-124114`
- 格式：PostgreSQL custom format
- 选项：`--no-owner --no-privileges`
- 文件位置：仓库外受控本地备份目录
- 目录权限：`0700`
- dump、hash、metadata 权限：`0600`
- dump 非空：是
- archive parse：通过
- SHA-256 本地完整性校验：`hash verified`
- 隔离恢复验证：通过
- 恢复库 Journal：38，且仍为仓库严格前缀
- 恢复库 `tenants`：2
- 恢复库 A1 三表：均缺失
- 临时恢复数据库：验证后已删除

备份未恢复到原数据库，未上传 GitHub，未输出正文或 hash 原值。

## 6. 唯一 Migration 命令

在再次确认远端 Base、容器身份、备份完整性、唯一 pending Migration 和零活动事务后，执行了唯一写入命令：

```bash
env \
  -u DATABASE_URL \
  -u ZMTG_LOCAL_ACCEPTANCE_CONTAINER \
  -u ZMTG_LOCAL_ACCEPTANCE_DB \
  -u ZMTG_LOCAL_ACCEPTANCE_PORT \
  -u ZMTG_LOCAL_ACCEPTANCE_IMAGE \
  -u DOTENV_KEY \
  -u DOTENV_CONFIG_DOTENV_KEY \
  DOTENV_CONFIG_PATH=/dev/null \
  DOTENV_CONFIG_OVERRIDE=false \
  scripts/dev/local-acceptance-db.sh migrate
```

- 命令退出码：0
- 执行目标：固定 localhost-only 本地验收数据库
- 执行内容：只应用仓库已有的 0038
- stdout／stderr：未写入报告或 PR
- dotenv：通过 `DOTENV_CONFIG_PATH=/dev/null` 阻止 Drizzle CLI 读取仓库 dotenv 文件

没有创建新 Migration，没有运行 `db:generate`、Seed、Reset、Drop，也没有手写 SQL 修复 Shape。

## 7. 迁移后 Journal 与低敏计数

| 项目 | 迁移前 | 迁移后 |
|---|---:|---:|
| Applied Migration | 38 | 39 |
| `tenants` | 2 | 2 |
| `institution_scopes` | 不存在 | 0 |
| `institution_operating_context_versions` | 不存在 | 0 |
| `institution_operating_contexts` | 不存在 | 0 |

迁移后数据库 Journal 的 39 行通过 `created_at + SQL SHA-256` 在内存中与仓库 Journal 完整逐项匹配，最新项唯一内部匹配 0038。`tenants` 前后均为 2；三个 A1 表均为空，没有 A2 Provisioning 行。

0038 静态 SQL 不包含业务 DML；本阶段观察到的数据库写入只包括 0038 的 Expand DDL 和 Drizzle Journal 记录，没有 Seed、回填或 P1 数据写入。

## 8. A1 三表 Shape 矩阵

| 表 | 列 | 主键／唯一键 | 外键 | CHECK | 索引 | 行数 | 结论 |
|---|---:|---|---:|---:|---:|---:|---|
| `institution_scopes` | 10 | 双键主键 | 1 | 2 | 1 | 0 | 与 0038／Schema 一致 |
| `institution_operating_context_versions` | 11 | 三键主键 + effective_at 复合唯一 | 1 | 3 | 2 | 0 | 与 0038／Schema 一致 |
| `institution_operating_contexts` | 7 | 双键主键 | 2 | 2 | 1 | 0 | 与 0038／Schema 一致 |

逐项核验结果：

- 28 个列定义的列名、顺序、类型、长度、可空性和默认值全部一致；
- 只有 `institution_operating_context_versions.migration_provenance` 允许为空；
- `created_at`／`updated_at` 的默认值为 `now()`，其他业务字段无隐式默认；
- 4 个 enum 的名称、值和顺序全部一致；
- 15 个约束名称、类型和定义全部一致，均为 validated、non-deferrable；
- 4 个索引仅来自主键和 Context Version effective_at 唯一约束，没有未知额外索引；
- revision／version／latest_version 正值约束存在；
- provisioning digest 64 位长度约束存在；
- timezone 非空白与 currency 三位大写格式约束存在；
- Context Version 复合唯一键存在；
- Context Head 指向 Context Version 的三列复合外键存在；
- tenant、Scope、Version、Head 孤儿计数均为 0。

0038 对既有表的 5 个字段也与 Schema 一致：

- `appointments.institution_id`：`varchar(64)`，可空，无默认；
- `treatment_summaries.institution_id`：`varchar(64)`，可空，无默认；
- `follow_up_tasks.institution_id`：`varchar(64)`，可空，无默认；
- `audit_events.institution_id`：`varchar(64)`，可空，无默认；
- `audit_events.institution_attribution`：`audit_institution_attribution`，可空，无默认。

## 9. 迁移后备份与隔离恢复

- 备份标识：`zmtg_clean_local_acceptance-post-0038-20260730-124114`
- 格式：PostgreSQL custom format
- 选项：`--no-owner --no-privileges`
- 文件位置：仓库外受控本地备份目录
- 目录权限：`0700`
- dump、hash、metadata 权限：`0600`
- dump 非空：是
- archive parse：通过
- SHA-256 本地完整性校验：`hash verified`
- 隔离恢复验证：通过
- 恢复库 Journal：39，完整匹配 0038
- 恢复库 `tenants`：2
- 恢复库 A1 三表：均存在且为空
- 恢复库 A1 Catalog：与原验收库一致
- 临时恢复数据库：验证后已删除

迁移前、迁移后两个备份及各自 hash、metadata 均保留。metadata 只记录获批低敏字段；两个备份的保留策略均为至少保留至 A2-P1 是否启动完成独立决策，后续删除必须另行授权。

## 10. 零越界与仓库变更

| 项目 | 结果 |
|---|---|
| 原数据库 Restore | 0 |
| 新 Migration | 0 |
| `db:generate` | 0 |
| Seed／Reset／Drop 原数据库 | 0 |
| 真实 Manifest 创建／读取／批准 | 0 |
| Repository Adapter | 0 |
| Runner dry-run／execute | 0 |
| 执行 Lease／Migration Lease | 0 |
| A2-P1／A2-P2 | 未启动 |
| Runtime 仓库文件修改 | 0 |
| Schema 仓库文件修改 | 0 |
| Migration／journal／snapshot 仓库文件修改 | 0 |
| scripts／tests／CI／package／lock 修改 | 0 |

本阶段只修改本地验收数据库的 Schema 基线并创建仓库外备份；仓库中只新增本低敏 Markdown 报告。

## 11. 阻断状态

本阶段关闭：

- `journal_not_at_0038`
- `schema_shape_missing`
- `backup_recovery_point_missing`

仍未关闭：

- `real_manifest_missing`
- `readonly_adapter_unavailable`
- `real_environment_dry_run_unavailable`

Stage A 完成不表示 Stage B、Stage C、Stage D 或 A2-P1 已获授权。

## 12. 回退与后续边界

- 本任务没有对原数据库执行自动 Restore；
- 迁移前备份可以提供 0038 前恢复点，迁移后备份可以提供已验证的 0038 基线恢复点；
- 如后续需要恢复原数据库，必须独立冻结目标、影响、停机、数据保留和 destructive restore 授权；
- 正常后续仍优先使用经过评审的 forward-fix，不根据本报告自动回退；
- 唯一候选后续阶段是 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B`；
- Stage B 必须通过独立 handoff 和用户授权后才能启动。

# V2-MIG01-A2 环境、Manifest 与 Dry-run 本地只读预检

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-ENVIRONMENT-MANIFEST-READONLY-PREFLIGHT-01`
- 审计日期：2026-07-30
- 时区：`Asia/Shanghai`（CST，UTC+08:00）
- 冻结 Base：`3fe7d0991fa9d530410261270e70c9af46215222`
- 目标环境：Mac 本地安全验收环境，仅限 `127.0.0.1`
- 交付性质：`docs-only + readonly preflight`
- 状态：本地只读预检报告

本报告只记录仓库静态期望、本地验收数据库的只读元数据与聚合计数、临时合成 Manifest 契约验证，以及 Stage B CLI 的离线 fail-closed 结果。它不是 A2-P1／A2-P2 实施，不是 Migration、Seed、数据库修复、真实 Manifest 审批、执行 Lease、备份创建或恢复演练，也不构成 P1 启动授权。

事实源包括：

- `drizzle/0038_mig_01a1_institution_isolation_expand.sql`
- `drizzle/meta/_journal.json`
- `drizzle/meta/0026_snapshot.json`
- `src/server/db/schema.ts`
- `docs/decisions/mig01-a2-provisioning-accepted-decisions.md`
- `docs/operations/mig01-a2-provisioning-runbook.md`
- `src/modules/tenancy/provisioning/**`
- `scripts/db/mig01-a2-provisioning-runner.mjs`
- `package.json`

仓库静态期望与环境只读结果在本文中分开记录；代码、Migration 或测试存在不代表目标环境已经具备相同状态。

## 2. 授权和禁止范围

本轮获得的环境授权仅包括：

- 使用 `env -u DATABASE_URL scripts/dev/local-acceptance-db.sh ensure` 启动或复用受控本地验收容器；
- 通过固定容器内 `psql -X` 命令连接 `127.0.0.1` 映射的本地验收数据库；
- 只读检查 Drizzle Journal、四个白名单表的 metadata 和低敏聚合计数；
- 只在 `/tmp/zmtg-mig01-a2-readonly-preflight/` 顶层检查真实 Manifest 候选；
- 生成临时低敏合成 Manifest，并以 `--dry-run` 调用现有 Stage B CLI；
- 创建本报告。

本轮禁止并且未执行：

- 读取或打印 `.env.local`、`DATABASE_URL`、Secret、Token、私钥、真实连接串、PII 或真实 Manifest 正文；
- 连接非 localhost 数据库或任何业务外部环境；
- Migration、`db:generate`、Seed、DDL、DML、Restore、Reset、Drop、`pg_dump`、数据库文件读取或卷修改；
- `--execute`、真实 Repository Adapter、真实 Context Policy、真实批准集合或执行 Lease；
- 修改 Schema、Migration、Runtime、脚本、测试、CI、package 或 lock；
- 启动 A2-P1、A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务。

## 3. 环境身份

| 项目 | 只读核验结果 |
|---|---|
| 容器 | `zmtg-local-acceptance-pg` |
| 容器状态 | 已存在并由本轮复用；创建时间早于本轮，`container_reused=true` |
| 受控标签 | `com.zmtg.local-acceptance=true`，匹配 |
| 镜像 | `postgres:16-alpine`，匹配 |
| Host | `127.0.0.1` |
| 端口 | `127.0.0.1:55432` 唯一映射至容器 `5432/tcp` |
| 数据库 | `zmtg_clean_local_acceptance` |
| 数据卷 | 存在，并挂载到 PostgreSQL 数据目录 |
| 连接串 | 未构造、未读取、未输出 |

Docker daemon 启动前无法列出停止状态容器；受控脚本启动 Colima 后，本轮重新核验了容器实际创建时间、名称、标签、镜像、端口和挂载，确认该容器为既有受控本地验收容器而非本轮新建。任务结束时不停止、不删除该容器或数据卷。

## 4. 仓库静态期望

### 4.1 Journal 与 A1 范围

- 仓库 Journal 共 39 项，最新项为 `0038_mig_01a1_institution_isolation_expand`。
- `0038_mig_01a1_institution_isolation_expand.sql` 只提供 Expand 结构，不证明归属、Provisioning、回填或 Enforce 已完成。
- `drizzle/meta/0026_snapshot.json` 只到旧 snapshot 基线，不包含 A1 新三表；该 metadata 漂移不能用于证明环境 Shape。

### 4.2 四表静态期望

| 对象 | 主要静态期望 |
|---|---|
| `tenants` | `id`、`name`、`status`、`created_at`、`updated_at`；`id` 主键；状态为 `active / suspended / trialing / expired` |
| `institution_scopes` | 10 列；`tenant_id + institution_id` 主键；tenant 外键；正 revision；64 位 digest；Scope status 与 provisioning source 枚举 |
| `institution_operating_context_versions` | 11 列；三列主键；Scope 外键；`tenant_id + institution_id + effective_at` 唯一；正 version；时区与币种检查 |
| `institution_operating_contexts` | 7 列；双键主键；Scope 外键；指向 Context Version 的三列外键；正 revision 与 latest version |

`institution_operating_context_versions.migration_provenance` 是四表静态契约中唯一允许为空的业务列。0038 未创建额外业务索引；环境预期索引来自主键和唯一约束。

### 4.3 Stage B 契约

- Manifest version：`mig01-a2/v1`
- Canonicalization version：`c14n-v1`
- dry-run 五项低敏计数：`input`、`insertedCandidate`、`reusedCandidate`、`conflict`、`unexpected`
- 五项计数必须满足输入守恒。
- 当前 CLI 未组合真实 Context Policy、Repository／Transaction Adapter 或 Lease Authority。
- 直接 CLI 预期先以固定低敏错误码 fail-closed；这不等于真实环境 Runner dry-run。

## 5. Journal 结果

状态：`not_at_0038`

| 项目 | 环境只读结果 |
|---|---|
| Journal 表 | `drizzle.__drizzle_migrations` 存在 |
| Applied Migration 数量 | 38 |
| 仓库期望数量 | 39 |
| 0038 内部匹配 | 未匹配 |
| 最后一项内部匹配 0038 | 否 |
| 结论 | `journal_not_at_0038` |

内部比对使用仓库 0038 的时间标识和 SQL SHA-256；本文、临时低敏摘要和 PR 描述均不记录原始 hash。由于环境未到 0038，本轮没有运行 Migration，也没有修改 Journal。

## 6. Shape 矩阵

| 对象 | 是否存在 | 列 | 主键／唯一键 | 索引 | 约束 | 与仓库期望 |
|---|---|---|---|---|---|---|
| `tenants` | 存在 | 5/5：`id`、`name`、`status`、`created_at`、`updated_at` | `tenants_pkey` | `tenants_pkey` | 非空与状态 enum 可核验 | 一致 |
| `institution_scopes` | 缺失 | 无法核验 | 无法核验 | 无法核验 | 无法核验 | `schema_shape_missing` |
| `institution_operating_context_versions` | 缺失 | 无法核验 | 无法核验 | 无法核验 | 无法核验 | `schema_shape_missing` |
| `institution_operating_contexts` | 缺失 | 无法核验 | 无法核验 | 无法核验 | 无法核验 | `schema_shape_missing` |

`tenants` 的列类型、长度、可空性、默认值存在性、主键和 `tenant_status` 四个枚举值与当前仓库静态期望一致。A1 三张新表均不存在，因此本轮没有对不存在的关系发送列、约束、索引或业务计数查询；总体 Shape 不能判定为就绪。

## 7. 低敏计数

| 计数 | 结果 |
|---|---:|
| `tenants` 总数 | 2 |
| `institution_scopes` 总数 | 未查询（表缺失） |
| `institution_operating_context_versions` 总数 | 未查询（表缺失） |
| `institution_operating_contexts` 总数 | 未查询（表缺失） |
| 完整三元组数量 | 无法核验（A1 三表缺失） |
| 部分存在数量 | 无法核验（A1 三表缺失） |
| 重复双键／三键组数量 | 无法核验（A1 三表缺失） |
| 非法 revision／version 数量 | 无法核验（A1 三表缺失） |
| 未知 status／source 数量 | 无法核验（A1 三表缺失） |
| digest 格式异常数量 | 无法核验（`institution_scopes` 缺失） |
| tenant 父记录缺失关联数量 | 无法核验（`institution_scopes` 与真实 Manifest 均缺失） |

以上只包含总数和状态，不包含 tenantId、institutionId、digest、审批引用、原始时间或任何业务行。该表是 `environment_classification_summary`，不是 Stage B Runner dry-run。

## 8. Manifest 结果

### 8.1 真实 Manifest

- 检查范围严格限制为 `/tmp/zmtg-mig01-a2-readonly-preflight/` 的顶层普通文件。
- 在创建本轮临时合成文件前，候选数量为 0。
- 状态：`real_manifest_missing`
- 未搜索 Home、Desktop、Downloads、其他 Documents、iCloud、系统目录或整个磁盘。
- 未读取或输出真实 Manifest、PII、Secret、Token、连接串、审批引用、digest 或双键。

### 8.2 合成 Manifest

- 合成文件权限：`0600`
- 只使用明显的 synthetic ID、固定低敏字段和当前代码计算的 digest。
- Parser：通过
- exact shape：通过
- canonicalization：通过
- digest validation：通过
- 双键去重：通过
- 重复双键拒绝负例：通过
- 结果：`synthetic_contract_validation=pass`

合成 Manifest 的 `approvalStatus=approved` 只是契约测试输入，不代表真实审批、真实 Manifest 或执行授权。合成正文和 digest 未进入 Git、报告、PR 描述或保留日志。

## 9. CLI 结果

执行模式仅为 `--dry-run`，结果如下：

| 项目 | 结果 |
|---|---|
| 退出码 | 3 |
| 固定错误码 | `runner_context_policy_unavailable` |
| stdout 业务计数 | 无 |
| 数据库连接 | 否 |
| 数据库写入 | 否 |
| fail-closed | 是 |

当前 CLI 在检查到缺少真实 Context Policy 后、读取 Manifest 和调用 Repository Adapter 前即退出；Runner 也未组合数据库 Adapter。合成 Manifest 的 Parser／digest 通过来自独立的临时 helper 验证，不能错误解释为本次 CLI 已完成真实 Manifest 或数据库分类。

## 10. Dry-run 状态

| 层次 | 状态 | 说明 |
|---|---|---|
| synthetic／offline 契约 | 通过 | Parser、exact shape、canonicalization、digest 与重复双键拒绝均通过 |
| environment classification | 部分完成 | Journal、四表存在性、`tenants` Shape 与允许的聚合计数已只读核验 |
| real Runner dry-run | `blocked_real_manifest_and_adapter_missing` | 真实 Manifest 缺失，Stage B 无真实 Repository Adapter |

直接 SQL 聚合不等于 Runner 的五项 dry-run 分类。本轮结论同时记录 `readonly_adapter_unavailable` 与 `real_environment_dry_run_unavailable`，不得据此签发 Lease、取得 Migration lease 或启动 P1。

## 11. 备份与恢复点

| 项目 | 结果 |
|---|---|
| 受控本地容器 | 存在 |
| PostgreSQL 数据卷 | 存在 |
| 数据目录挂载 | 存在 |
| 与本容器／数据库绑定的正式备份标识 | 未发现 |
| 已验证恢复点 | 未发现 |
| 隔离恢复演练记录 | 未发现 |
| 结论 | `backup_recovery_point_missing` |

本轮只读查看 Docker Mount／Volume metadata，没有读取数据文件、复制数据库文件、创建 snapshot、运行 `pg_dump`、Restore 或修改卷。数据卷存在只证明持久化载体存在，不等于正式、可识别、经过验证的备份或恢复点。

## 12. 零写入证据

| 门禁 | 结果 |
|---|---|
| 容器动作 | 仅按授权启动并复用既有受控容器；未停止、删除或修改卷 |
| Migration | 未运行 |
| `db:generate` | 未运行 |
| Seed | 未运行 |
| DDL | 未执行 |
| DML | 未执行 |
| SQL 会话 | 每次均设置 `default_transaction_read_only=on` |
| SQL 事务 | 每次均为 `BEGIN TRANSACTION READ ONLY` |
| SQL 结束 | 每次均执行 `ROLLBACK` |
| 只读状态 | 每次查询前均确认 `transaction_read_only=on` |
| CLI | 仅 `--dry-run`，未使用 `--execute` |
| Adapter／数据库连接 | CLI 未连接数据库 |
| Lease | 未签发、未读取、未验证 |
| 前后低敏复核 | CLI 前后 Journal 均为 38，`tenants` 均为 2，A1 三表均缺失 |

“零写入”指本任务未发起任何应用 Schema、Migration、Journal、业务数据或执行资产写入。启动既有 PostgreSQL 容器是用户明确批准的本地基础设施动作，不构成 A2-P1 数据操作或环境就绪证明。

## 13. 阻断矩阵

| 阻断代码 | 状态 | 证据 | 对 P1 的影响 |
|---|---|---|---|
| `journal_not_at_0038` | 阻断 | 环境 Applied Migration 为 38，未内部匹配仓库 0038 | 不得执行 A2-P1 |
| `schema_shape_missing` | 阻断 | `institution_scopes`、Context Version、Context Head 三表缺失 | 不得执行 Provisioning |
| `real_manifest_missing` | 阻断 | 受控临时目录在合成文件创建前无真实候选 | 无法形成真实输入或核验 tenant 父记录 |
| `backup_recovery_point_missing` | 阻断 | 只有数据卷，无正式备份标识、恢复点或演练证据 | 不得进行环境写入 |
| `readonly_adapter_unavailable` | 阻断 | Stage B 未组合真实只读 Repository Adapter | 不能形成 Runner 五项分类 |
| `real_environment_dry_run_unavailable` | 阻断 | 真实 Manifest 与 Adapter 均缺失，环境 Journal／Shape 也未满足 | 不得把 SQL 摘要冒充真实 dry-run |

当前未形成 `tenant_parent_missing`、`partial_existing_state` 或 `conflicting_existing_state` 的肯定结论：A1 三表和真实 Manifest 缺失使这些分类无法安全计算。不得把“无法核验”写成计数为 0。

## 14. 最终结论

本轮最终结论为以下阻断组合：

```text
journal_not_at_0038
+ schema_shape_missing
+ real_manifest_missing
+ backup_recovery_point_missing
+ readonly_adapter_unavailable
+ real_environment_dry_run_unavailable
```

因此当前不是 `ready_for_independent_handoff`。本报告只完成已授权的 Mac 本地验收环境只读预检；A2 未完成，P1 未获批准，正式 Manifest 未获批准，数据库未达到 0038／A1 Shape，正式备份与恢复点未具备，真实 Runner dry-run 不可用。

后续任何状态推进都必须由独立任务重新冻结 Base、环境、真实 Manifest、Journal、Shape、备份／恢复点、Adapter、Operator／Reviewer 与授权边界。本报告合并也不会自动启动该独立任务。

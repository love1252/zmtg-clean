# MIG-01A2 Stage D 本地只读 dry-run 验证报告

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-STAGE-D-LOCAL-DRY-RUN-VALIDATION-01-RESUME`
- 日期与时区：`2026-07-30`，`Asia/Shanghai`
- 冻结 Base：`898d53fb5ba7605081e6f7319e11d46601830922`
- 环境边界：Mac localhost-only 本地安全验收环境
- 交付范围：docs-only；仓库内只新增本低敏 Markdown
- 结论：`ready_for_stage_d_independent_review`

本报告只记录既有 Runner 的一次本地只读 dry-run、数据库前后低敏计数、私有资产校验和执行后清理结果。它不是 A2-P1／A2-P2、`--execute`、Migration Lease、数据库写入、仓库设置或任何后续任务的授权。

## 2. 历史本地运维元数据事件

- 历史事件分类：`historical_local_operational_metadata_disclosure`。
- 历史事件只涉及固定 localhost 运维元数据的自动工具回显，不涉及私有资产正文、tenant／institution 双引用、digest、当前角色引用、Secret、Token、凭证、PII 或非本地连接。
- 该事件不使 Candidate 或 Approved Manifest 失效；本次使用前仍重新执行了内容、Contract、digest、权限和文件身份校验。
- 当前任务中自动工具输出产生的受保护本地运维元数据回显事件：`2`。
- 当前任务主动写入报告、PR 描述或聊天的私有路径／连接参数：`0`。
- 本报告不复述历史或当前的具体路径、端口、数据库名、用户、连接参数或私有引用。

## 3. 启动与冻结证据

| 项目 | 结果 |
|---|---|
| 本地日期／时区 | `2026-07-30`／`Asia/Shanghai` |
| 本地、系统 UTC 与 Node UTC 时间一致性 | `通过，差值小于 1 秒` |
| 启动 main／origin/main | `898d53fb5ba7605081e6f7319e11d46601830922` |
| PR #823 | `已合并` |
| PR #823 Merge Commit | `3f042172734c0dc9cc583a09f347e38df7db1e02` |
| PR #824 | `已合并` |
| PR #824 Merge Commit | `898d53fb5ba7605081e6f7319e11d46601830922` |
| 启动工作树 | `干净` |
| Git 操作、锁与并发写入 | `未发现` |
| `.git` 写入与 GitHub 同步能力 | `通过` |
| main 保护 | `已启用` |
| Required Check | `最小架构与质量门禁` |

## 4. 私有资产与恢复点复核

所有私有内容均只在权限受控的临时 Helper 内存或仓库外私有区域处理，未进入 Git、PR、日志正文或本报告。

| 校验项 | 结果 |
|---|---|
| Candidate 内容、Contract、digest、权限与文件身份 | `通过` |
| Approved Manifest 内容、Contract、digest、权限与文件身份 | `通过` |
| Approved Manifest 数量 | `1` |
| Candidate 当前有效性 | `通过` |
| Candidate／Approved 相互独立 | `通过` |
| Context Policy | `通过` |
| 只读 PostgreSQL Adapter | `通过` |
| 迁移前恢复点存在、权限、归档、hash 与元数据 | `通过` |
| 迁移后恢复点存在、权限、归档、hash 与元数据 | `通过` |

恢复点校验只执行归档清单、hash 和元数据验证，没有执行 Restore。两次准备期 Helper 因恢复点校验能力或定位前提不满足而在访问数据库、分配 Operator 和运行 Runner 前 fail-closed，且均完成自清理；随后使用可用的本地容器工具完成独立只读校验。

## 5. Operator 分离与临时授权

| 项目 | 结果 |
|---|---|
| Operator 与既有角色引用分离 | `true` |
| Operator 引用是否输出 | `false` |
| 临时授权窗口 | `低敏向上取整 1 秒` |
| 临时授权是否撤销 | `true` |
| 私有 Operator 审计摘要 | `已保留，权限 0600` |
| 临时 Approved Manifest 副本 | `已删除` |
| 临时输入目录 | `已删除` |
| 临时 Helper | `已删除` |
| 原 Candidate／Approved 是否修改 | `false` |

临时授权只允许一次 Stage D 本地 dry-run。它未授予 `--execute`、Lease、Migration、数据库写入、A2-P1 或 A2-P2 权限。

## 6. Runner dry-run 结果

本次复用现有资产：

- Runner：`scripts/db/mig01-a2-provisioning-runner.mjs`
- Context Policy：`src/modules/tenancy/provisioning/provisioning-context-policy.ts`
- 只读 Adapter：`src/modules/tenancy/provisioning/server/provisioning-readonly-postgres-adapter.ts`
- Kernel 与 Contract：`src/modules/tenancy/provisioning/**`

Runner 仅使用私有内存参数传入 Approved Manifest 副本并执行 `--dry-run`；未使用 `--execute` 或任何 Lease 参数。Runner 注入既有 ReadOnly Adapter，该 Adapter 只负责指定 tenant 的存在性核对和 Manifest 对应 tenant／institution triplet 的分类读取，进而产生五项 dry-run 计数。它不负责 Migration Journal、数据库 Schema Shape 或四张表全表总数的采集。

| 低敏计数 | 结果 |
|---|---:|
| Approved Manifest | `1` |
| input | `1` |
| insertedCandidate | `1` |
| reusedCandidate | `0` |
| conflict | `0` |
| unexpected | `0` |
| 计数守恒 | `true` |

`insertedCandidate` 是 dry-run 的候选计划分类，不代表实际数据库插入。Runner 没有产生状态变更、事实写入或 Provisioning 行。

## 7. 数据库前后只读证据

本节证据来自三个明确分离的来源：

| 证据来源 | 只允许的职责 |
|---|---|
| Runner + 既有 ReadOnly Adapter | 指定 tenant 存在性、Manifest 对应 triplet 分类和五项 dry-run 计数 |
| 独立临时 pre／post 只读探针 | 本地数据库 Applied Migration 元数据、A1 Shape 元数据，以及 `tenants` 与三张 A1 表的全表总数 |
| 冻结仓库 | `drizzle/meta/_journal.json` 的 39 项记录、最新 `0038` 与预期 A1 Shape |

独立探针与 Runner／Adapter 调用分离，在 dry-run 前后分别使用显式 `REPEATABLE READ + READ ONLY` 事务。其查询是固定 SELECT-only 白名单，只覆盖：

1. Migration 应用状态元数据；
2. A1 表、字段与约束的 Shape 元数据；
3. `tenants`、`institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts` 四张表的全表总数。

探针没有通用 SQL 入口，没有向 Runner 或 ReadOnly Adapter 扩展 Journal、Catalog 或全表统计能力；DDL、DML 和数据库写入均为 `0`。探针实现未进入仓库，完成 pre／post 比较后与临时 Helper 一同删除。本报告只保留允许公开的布尔结果和低敏总数。

| 项目 | dry-run 前 | dry-run 后 |
|---|---:|---:|
| Applied Migration | `39` | `39` |
| 最新仓库 Migration | `0038` | `0038` |
| tenants | `2` | `2` |
| institution_scopes | `0` | `0` |
| institution_operating_context_versions | `0` | `0` |
| institution_operating_contexts | `0` | `0` |
| 结构核验 | `通过` | `通过` |

表中 Applied Migration、四表总数和结构核验来自独立 pre／post 探针；“最新仓库 Migration”来自冻结仓库并用于对照。前后状态精确一致：`databaseStateUnchanged=true`。

## 8. 零执行与零泄漏证据

| 类别 | 结果／数量 |
|---|---:|
| Runner dry-run | `1` |
| `--execute` | `0` |
| Lease 签发、读取、验证或消费 | `0` |
| DDL／DML | `0` |
| Migration／Seed／Provisioning 执行 | `0` |
| 数据库写入 | `0` |
| Runtime／Schema／Migration 修改 | `0` |
| 脚本／测试／CI／package／lock 修改 | `0` |
| 私有资产正文输出 | `0` |
| tenant／institution 双引用输出 | `0` |
| Candidate／Approved digest 输出 | `0` |
| 当前角色引用输出 | `0` |
| Secret／Token／凭证／PII 输出 | `0` |
| 非本地连接 | `0` |
| 当前主动私有路径／连接参数披露 | `0` |

低敏扫描只记录计数，不输出匹配值。历史本地运维元数据事件与当前自动工具回显已在第 2 节单独记录，不被错误表述为“从未发生”。

## 9. 本地质量验证

| 验证 | 结果 |
|---|---|
| Provisioning 定向契约集 | `12 个文件、442 个测试通过` |
| lint | `通过；仅 4 条既有 <img> 警告` |
| typecheck | `通过` |
| 完整测试 | `420 个文件、6121 个测试通过` |
| build | `通过；101／101 静态页面生成` |
| git diff --check | `通过` |
| 增量架构检查 | `通过；未发现新增架构违规` |

构建过程中没有主动读取、搜索或输出任何环境变量值或凭证。

## 10. 结论与后续边界

本地只读 dry-run 的私有资产、Operator 分离、恢复点、计数守恒、数据库前后不变、临时授权撤销和清理证据均已形成。Stage D 当前结论为：

`ready_for_stage_d_independent_review`

该结论只允许本报告进入独立审查。报告合并后仍需独立 handoff 冻结唯一下一任务；不得自动签发 Lease、运行 `--execute`、创建 Migration、启动 A2-P1／A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务。

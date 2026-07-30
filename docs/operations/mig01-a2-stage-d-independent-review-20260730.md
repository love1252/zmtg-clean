# MIG-01A2 Stage D 本地只读 dry-run 独立审查

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-STAGE-D-INDEPENDENT-REVIEW-01`
- 日期与时区：`2026-07-30`，`Asia/Shanghai`
- 冻结 main：`898d53fb5ba7605081e6f7319e11d46601830922`
- 被审查 PR：#825
- 被审查 Head：`feb39156443f0142c22e9748a21485b78c66211b`
- 被审查报告 blob：`3765f8009688e8f66a01215aadcab5f30103c852`
- 审查方式：docs-only、公开仓库证据与低敏交付证据交叉核对
- 审查结论：`needs_correction`
- 下一阶段准入：`false`

本报告是对 PR #825 冻结 Head 的独立只读审查证据，不是对私有 Manifest、角色引用、digest、恢复点文件或数据库的重新执行验证。它不修改 PR #825，不授权 Ready、Merge、Runner、dry-run、`--execute`、Lease、Migration、数据库写入或任何后续阶段。

## 2. 审查边界

本次只执行：

- 读取 PR #825 元数据、描述、唯一报告和 Required Check；
- 读取已合并的 Stage A／Stage B／Candidate／Approved Manifest 低敏报告；
- 读取公开 Runner、Manifest Contract、Context Policy、Kernel、Port 与 ReadOnly Adapter；
- 核对五项低敏计数、计数守恒、数据库前后低敏状态和零执行边界；
- 形成独立审查结论。

本次没有：

- 运行 Runner 或新的 dry-run；
- 使用 `--execute`；
- 签发、读取、验证或消费 Lease；
- 连接任何数据库或外部环境；
- 读取私有 Manifest、Candidate、digest、角色引用、路径、连接参数、凭证或 PII；
- 执行 Migration、Seed、DDL、DML 或 Provisioning；
- 修改 Runtime、Schema、Migration、Runner、脚本、测试、CI、package 或 lock；
- 启动 A2-P1、A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务。

## 3. PR #825 冻结状态

| 项目 | 结果 |
|---|---|
| 状态 | `开放（Open）＋草稿（Draft）` |
| Base | `898d53fb5ba7605081e6f7319e11d46601830922` |
| Head | `feb39156443f0142c22e9748a21485b78c66211b` |
| 提交数 | `1` |
| 文件数 | `1` |
| 唯一文件 | `docs/operations/mig01-a2-stage-d-local-dry-run-validation-20260730.md` |
| 技术可合并 | `true` |
| 评论／Review／未解决 thread | `0／0／0` |
| Required Check | `成功` |
| Actions Run／Job | `30555444247／90914595066` |

Required Check 对应冻结 Head；环境核对、依赖安装、架构检查器自测、增量检查、lint、typecheck、完整测试和 build 均实际执行成功，build 未跳过，Workflow 未配置 `continue-on-error`。该结果只证明仓库质量门禁成功，不独立证明本地数据库 dry-run 事实。

## 4. 独立核对矩阵

| 核对项 | 结论 | 审查说明 |
|---|---|---|
| Approved Manifest 状态 | `证据一致` | PR #825 报告的数量 1、Contract 与 digest 复核结果，与已合并 Approved Manifest 低敏报告和公开 `parseProvisioningManifest` 的 `approved` 门禁一致；本次未重新读取私有正文 |
| Candidate 隔离 | `证据一致` | Candidate／Approved 文件与 digest 分离、原资产未修改的低敏声明，与已合并报告一致；本次未重新计算私有 digest |
| Operator 分离 | `证据一致` | 报告明确记录 Operator 与既有角色引用分离、引用未输出、临时授权已撤销；公开 Runner 不承担角色分离验证，因此该项属于私有治理层低敏证据 |
| Context Policy | `通过` | 公开实现冻结 `local_acceptance`、`Asia/Shanghai` 与 `CNY` exact-shape Policy，且不从环境或运行时推断默认值 |
| ReadOnly Adapter | `通过但有证据归因限制` | 公开实现使用 `REPEATABLE READ + READ ONLY`、固定 timeout、静态四表查询，并永久拒绝 Repository insert 与 Transaction Port write |
| Recovery Point | `证据一致` | Stage A／B 与 PR #825 报告均记录迁移前后恢复点、hash 与元数据校验；本次没有重新打开恢复点文件或执行 Restore |
| 五项低敏计数 | `通过` | `1／1／0／0／0`，满足 `input = insertedCandidate + reusedCandidate + conflict + unexpected` |
| dry-run 前后状态 | `数值一致，来源说明需修正` | 报告中的 Applied Migration、最新 Migration、tenants、三张 A1 表与结构核验前后完全相同，但取得这些值的探针边界未与 Adapter 能力明确区分 |
| 零执行边界 | `通过` | 报告明确 `--execute`、Lease、DDL／DML、Migration／Seed／Provisioning 和数据库写入均为 0 |
| 后续授权边界 | `通过` | 报告只给出 `ready_for_stage_d_independent_review`，没有把 dry-run、测试或 CI 通过写成 A2-P1／P2 授权 |

## 5. 五项计数与数据库状态复核

五项计数：

| 项目 | 数量 |
|---|---:|
| input | `1` |
| insertedCandidate | `1` |
| reusedCandidate | `0` |
| conflict | `0` |
| unexpected | `0` |

守恒关系：

`1 = 1 + 0 + 0 + 0`

`insertedCandidate` 只表示 dry-run 对未来候选操作的分类，不表示已经执行 INSERT。

报告中的前后低敏状态：

| 项目 | dry-run 前 | dry-run 后 |
|---|---:|---:|
| Applied Migration | `39` | `39` |
| 最新仓库 Migration | `0038` | `0038` |
| tenants | `2` | `2` |
| institution_scopes | `0` | `0` |
| institution_operating_context_versions | `0` | `0` |
| institution_operating_contexts | `0` | `0` |
| 结构核验 | `通过` | `通过` |

数值与 Shape 结论在报告内部前后一致，也与五项分类结果不冲突。当前阻断不是数值不守恒，而是这些全局低敏值与结构证据的取得机制没有被准确归因。

## 6. 阻断项 F01：pre／post 探针与 Adapter 能力未区分

PR #825 报告第 7 节写明：

> 前后核验均使用显式只读事务和既有只读 Adapter。

公开 `ProvisioningRepositoryV1` 与 ReadOnly Adapter 只提供：

- 按指定 `tenantId` 执行 `tenantExists`；
- 按指定 `tenantId + institutionId` 执行 `readTriplet`；
- 对 `tenants` 与三张 A1 表的静态白名单访问；
- 永久拒绝三个 insert 方法和 Transaction Port write。

该 Adapter 不提供：

- Migration Journal／Applied Migration 查询；
- PostgreSQL Catalog／Schema Shape 查询；
- `tenants` 或三张 A1 表的全表计数。

因此，公开 Adapter 无法单独产生第 5 节所列的 Journal、Shape 与全表总数证据。当前报告没有明确说明这些证据是否来自独立的只读低敏探针，造成证据来源与公开 Adapter 能力之间的歧义。

## 7. F01 关闭条件

PR #825 必须在其原单文件范围内澄清以下事实之一：

1. 如果实际使用了独立只读探针：
   - 明确 Runner dry-run 通过既有 ReadOnly Adapter 分类；
   - 明确 Journal、Shape 与全表总数由独立低敏只读探针取得；
   - 记录该探针使用显式只读事务、固定查询白名单和零写入边界；
   - 不写入原始 SQL、私有路径、连接参数、双引用、digest、角色引用或数据库原始输出。
2. 如果没有独立只读探针：
   - 删除或降级无法由既有 Adapter 支撑的 Journal、Shape 与全表计数结论；
   - 不得继续把这些结论描述为已由 Adapter 独立证明。

修正后必须：

- 重新冻结 PR #825 Head；
- 保持单提交、单报告文件；
- 重新通过 `git diff --check`、增量架构检查和真实 Required Check；
- 由独立任务重新审查修正后的 Head。

本任务不代替 PR #825 选择事实版本，也不修改其报告。

## 8. Handoff 结论

当前独立审查状态：

`stage_d_independent_review=needs_correction`

当前下一阶段准入：

`eligible_for_next_stage=false`

除 F01 外，Approved Manifest、Candidate 隔离、Operator 分离、Context Policy、ReadOnly Adapter 只读与拒写边界、Recovery Point 低敏证据、五项计数守恒、pre／post 数值一致性、零执行和后续授权边界未发现新的公开矛盾。

PR #825 必须继续保持草稿。F01 关闭并完成新 Head 的独立复审前，不得进入 Ready 或 Merge，也不得启动 A2-P1、A2-P2、BASE-02、Writer、Reader、Migration、数据库写入或任何其他后续任务。

本任务不修改 `CURRENT_STATUS.md`、`NEXT_TASK.md` 或 `RELEASE_HISTORY.md`：PR #825 尚未合并，唯一下一任务也未获得重新冻结授权，提前更新 canonical handoff 会把未接受证据写成当前事实。

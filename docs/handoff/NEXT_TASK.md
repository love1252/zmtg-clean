# 下一任务

## 当前交接状态

MIG-01A2 的治理决策、仓库硬门、Runner 治理基础和本地环境只读预检已经分别通过独立 PR 完成：

- accepted 决策：PR #801；
- 治理 Stage A 仓库硬门：PR #804，handoff PR #805；
- 治理 Stage B Runner 基础：PR #807，handoff PR #808；
- 本地环境只读预检：PR #809；
- PR #809 Head：`7ccd75a9fd20e48d424920c7545d3b8d99838cf6`；
- PR #809 Merge Commit：`e6b0a23ba3b30003f0327493b350a1929030e4fc`；
- PR #809 Required Check：Run `30511790906`／Job `90773241559`，全部质量步骤成功；
- 当前 `main` 保护和“最小架构与质量门禁”Required Check 继续生效。

只读预检报告已经进入 `main`，但结论为 `blocked`。报告合并没有修复环境、创建真实 Manifest、建立 Adapter、创建备份、签发 Lease 或授权 A2-P1／P2。

## 唯一下一任务

```text
V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01
MIG-01A2 本地验收环境基线、Adapter、Manifest 候选与 Dry-run 就绪修复
```

这是一个 Ultra 大目标，但必须拆成四个原子阶段。每个阶段都需要独立用户授权、冻结 Base、精确文件／环境范围、独立分支、独立验证和独立 PR；禁止把四个阶段混入一个 PR。

本 handoff 只冻结大目标和顺序，不执行任何阶段。

## 一、事实源与 accepted 边界

后续四个阶段必须遵守以下权威关系：

1. 最新 `main` 的代码、测试、Schema、Migration、配置和已合并记录决定仓库 `current` 事实；
2. 经独立授权取得的本地验收环境证据只决定该指定环境的 `current` 事实；
3. `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`；
4. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 在既有 `target` 内记录 D01～D12 的用户选择；
5. proposed 决策包、六类架构视图、模块映射、架构索引和 handoff 只负责解释、展开、核验与记录状态，不得独立改写事实所有权、Migration 顺序或发布门禁；
6. `docs/architecture/v2-mig01-a2-environment-manifest-readonly-preflight.md` 是本地环境 `current evidence`，不构成实施授权。

以下 accepted 结果不得在本地就绪修复中静默重开：

- D01-A：Tenancy 是 Scope、Context Version／Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的唯一语义 Owner；
- D02-A：Access Control 通过版本化 Port／Reader 和低敏投影单向消费；
- D03-A：Manifest 使用严格版本、审批状态和低敏白名单；
- D04-A：固定位置 JSON 数组 canonicalization + SHA-256；
- D05-A：Context 字段显式提供，禁止隐式默认；
- D06-B／D07-B／D11-B：仓库外真实 Manifest、唯一一次性受控 Runner 和 Runner 文件集绑定；
- D08-C：Metadata 分阶段治理，继续禁止 `db:generate` 和 snapshot-diff Migration；
- D09-A：用户授权的任务级排他执行／Migration Lease；
- D10-B：`main` 保护和 Required Check 是 P1／P2 启动硬门；
- D12-A：只接受最小 Anchor Bridge 方向，精确实施细节继续后置。

如需改变 accepted 选择、`architecture-v2.md` 或既有 ADR，必须停止当前阶段并创建独立决策／ADR 任务。

## 二、只读预检已确认的阻断

PR #809 只读确认：

- 仓库 Journal 共 39 项，最新为 `0038_mig_01a1_institution_isolation_expand`；
- localhost 本地验收库 Applied Migration 为 38，未到 0038；
- `tenants` Shape 与仓库期望一致，低敏计数为 2；
- `institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts` 三表缺失；
- 缺失表的计数和 tenant 父关联无法核验，未伪报为 0；
- real Manifest 缺失；
- synthetic Manifest 契约验证通过；
- CLI 只使用 `--dry-run`，固定返回 `runner_context_policy_unavailable`，未连接数据库；
- Docker 数据卷存在，但正式备份／恢复点和恢复演练证据缺失；
- 只读 Repository Adapter 缺失；
- 真实 Runner dry-run 不可用。

因此当前六项阻断保持：

1. `journal_not_at_0038`
2. `schema_shape_missing`
3. `real_manifest_missing`
4. `backup_recovery_point_missing`
5. `readonly_adapter_unavailable`
6. `real_environment_dry_run_unavailable`

## 三、就绪修复阶段 A：本地验收数据库安全恢复点与 A1 基线

### 3.1 目标

在未来独立授权后，为固定 localhost-only 本地验收数据库建立可识别、可验证的安全恢复点，并使用仓库已有 Migration 将环境基线推进到 0038。

### 3.2 未来独立任务允许

- 只针对用户再次冻结的 localhost-only 本地验收容器和数据库；
- 创建受控备份或恢复点；
- 在隔离临时数据库中验证恢复，不覆盖原数据库；
- 记录恢复点标识、保留期、恢复责任人与低敏验证结果；
- 使用现有安全脚本应用仓库已经存在的 Migration 到 0038；
- 核验环境 Journal 与仓库 39 项内部一致；
- 核验 `tenants` 与 A1 三表的列、主键／唯一键、索引、外键、检查约束和 enum；
- 只输出低敏前后计数和状态码。

### 3.3 禁止与停止条件

- 不创建新 Migration，不占用新编号；
- 不运行 `db:generate`，不生成 snapshot-diff Migration；
- 不执行 Seed、Reset、Drop 或生产环境操作；
- 不读取 `.env.local`、非 localhost `DATABASE_URL`、Secret、Token 或真实业务数据；
- 备份不可验证、恢复失败、Journal 不是严格可解释的前缀、Shape 与 0038 不一致或目标不是 localhost 时立即停止；
- 阶段 A 完成只关闭本地基线与恢复点阻断，不自动启动阶段 B。

## 四、就绪修复阶段 B：只读 Repository Adapter 与 Context Policy

### 4.1 目标

通过未来独立代码 PR，为 MIG-01A2 Runner 的真实 dry-run 提供最小只读 Repository Adapter 和受控 Context Policy。

### 4.2 未来独立任务允许

- Adapter 最小读取范围只包括：
  - `tenants`
  - `institution_scopes`
  - `institution_operating_context_versions`
  - `institution_operating_contexts`
- 复用 Stage B 已接受的 Repository／Transaction Port 和五项守恒计数；
- 实现明确批准的 IANA timezone 与 ISO 4217 currency 子集 Context Policy；
- 使用固定低敏错误码、超时、只读事务和 fail-closed；
- 增加必要的合成测试、Adapter 定向测试和架构门禁验证。

### 4.3 禁止与停止条件

- 不实现 execute Adapter；
- 不提供 INSERT、UPDATE、DELETE、UPSERT、DDL 或 Migration 能力；
- 不签发或伪造执行 Lease／Migration Lease；
- 不修改业务 API、UI、正式 Reader 或 Capability；
- 不连接生产、测试服务器或业务外部环境；
- 无法证明只读事务、白名单表范围、低敏输出或 Context Policy 来源时停止；
- 阶段 B 完成不自动启动阶段 C 或授权 A2-P1。

## 五、就绪修复阶段 C：本地验收 Manifest 候选与审批包

### 5.1 目标

在阶段 A 的固定本地基线和阶段 B 的只读边界均完成后，形成低敏本地验收 Manifest 候选及供用户决策的审批摘要。

### 5.2 未来独立任务允许

- 只依据获批的本地验收环境、accepted Manifest 契约和 Context Policy 生成候选；
- Manifest 正文只保存在用户批准的受控临时路径；
- 核验 exact shape、version、approval status、canonicalization、digest、重复双键和 Context Policy；
- 只输出候选数量、规则版本、布尔验证结果、阻断代码和审批摘要；
- 用户在独立决策中确认是否批准候选。

### 5.3 禁止与停止条件

- Manifest 正文不得进入 Git、PR、Issue、日志、argv、环境变量或聊天；
- 不输出双键、digest、approvedByReference、原始时间、PII、Secret、Token 或连接串；
- 不从数据库业务行、Demo、Mock 或 Seed 自动推断审批；
- 不自动将候选标记为 `approved`；
- 用户批准前保持 `real_manifest_missing` 或等价审批阻断；
- 阶段 C 完成不自动启动阶段 D。

## 六、就绪修复阶段 D：真实本地 Runner dry-run

### 6.1 启动硬门

阶段 D 只有在以下条件全部由独立证据证明后才可申请启动：

- 阶段 A 的恢复点、Journal 0038 和 A1 Shape 已完成；
- 阶段 B 的只读 Adapter 与 Context Policy 已合并并通过 Required Check；
- 阶段 C 的本地验收 Manifest 已由用户明确批准；
- `main` 保护和 Required Check 继续生效；
- 目标仍是冻结的 localhost-only 本地验收环境。

### 6.2 未来独立任务允许

- 使用获批本地验收 Manifest；
- 使用只读 Repository Adapter 和批准的 Context Policy；
- 只运行 `--dry-run`；
- 输出 `input`、`insertedCandidate`、`reusedCandidate`、`conflict`、`unexpected` 五项低敏计数；
- 验证计数守恒；
- 核对 dry-run 前后 Journal、Shape 和低敏行数未变化；
- 形成独立只读报告和后续 handoff。

### 6.3 禁止与停止条件

- 不使用 `--execute`；
- 不签发执行 Lease 或取得 Migration Lease；
- 不写数据库，不提交事务；
- 不输出 Manifest 正文、双键、digest、审批引用或数据库原始异常；
- 任一计数不守恒、出现 conflict／unexpected、状态漂移或只读边界无法证明时停止；
- 阶段 D 完成后仍须独立 handoff，不自动启动 A2-P1。

## 七、项目级顺序

本文冻结的项目级顺序为：

```text
就绪修复阶段 A：本地基线
→ 就绪修复阶段 B：只读 Adapter
→ 就绪修复阶段 C：Manifest 审批
→ 就绪修复阶段 D：真实本地 dry-run
→ 独立 handoff
→ A2-P1 受控执行
→ 独立 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

这里的就绪修复阶段 A／B 与已完成的治理 Stage A／B 不是同一任务。四个阶段只描述 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01` 的内部原子顺序，不得混成一个 PR，也不得跳过独立授权。

该顺序不改变 MIG-01～MIG-06 的相对顺序：

```text
MIG-01
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

## 八、本 handoff 的完成与禁止范围

本 handoff 只允许更新：

- `docs/architecture/README.md`
- `docs/handoff/CURRENT_STATUS.md`
- `docs/handoff/NEXT_TASK.md`
- `docs/handoff/RELEASE_HISTORY.md`

本 handoff 不执行：

- 创建备份或恢复点；
- 运行 Migration、`db:generate`、Seed、Restore、Reset 或 Drop；
- 创建只读或 execute Adapter；
- 创建、读取或批准真实 Manifest；
- 执行 synthetic 或真实 Runner dry-run；
- 签发执行 Lease／Migration Lease；
- 修改 Schema、journal、snapshot、Runtime、脚本、测试、CI、package、lock 或仓库设置；
- 启动 A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务。

只有本 handoff 以单主题文档 PR 通过真实 Required Check 并合并后，唯一下一任务才正式冻结为 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01`。合并本 handoff 仍不自动授权四个修复阶段中的任何一个。

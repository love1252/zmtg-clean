# 智美天工架构文档索引

- 任务：`V2-MIG01-A2-P1-MANIFEST-PROVISIONING-END-TO-END-01`（Write Adapter Runtime handoff 收口）
- 日期：`2026-07-31 CST +0800`
- 审计基线：`bbf15be8f5acd66d80db5ac7b6e9250a57d5744e`
- 状态：`current`
- 文档性质：架构导航索引，不是第二套架构事实源
- 本次 Runtime handoff 文档差异中的 Runtime、Schema、Migration、API、UI 修改：`0`

## 1. 文档定位

本文件是 `docs/architecture/` 的统一导航入口，负责说明每份架构文档的权威级别、状态、适用范围和阅读顺序。

它不重新定义模块所有权、Migration 顺序、权限模型或发布门禁。项目总体目标架构继续由 [`architecture-v2.md`](./architecture-v2.md) 统一约束；当前代码、测试、Schema、Migration 和配置始终优先于文档描述。

## 2. 事实依据顺序

发生冲突时，按以下顺序处理：

1. 当前 `main` 的代码、测试、Schema、Migration 和配置；
2. [`architecture-v2.md`](./architecture-v2.md) 与已接受 ADR 决定最高级 `target` 约束；
3. 专项 accepted 决策记录只在既有 `target` 内解释用户选择；模块映射、架构视图、代码证据审计和本索引负责展开、导航与核验；
4. 七线技术计划、已合并 PR 和交接文档负责记录实施状态与历史；
5. 历史草案、旧系统和旧对话记录。

低优先级资料只能用于解释历史原因，不能覆盖当前实现或已接受决策。发现冲突时应记录差异、提出 ADR 或预检任务，不得静默修改权威结论。

## 3. 文档状态词

| 状态 | 含义 | 使用规则 |
|---|---|---|
| `current` | 描述当前 `main` 可验证的事实 | 必须能够追溯到代码、测试、Schema、Migration 或已合并记录 |
| `target` | 已接受的目标边界 | 不表示已经实施，也不自动授权 runtime 或数据变更 |
| `proposed` | 待确认的建议 | 形成 ADR 或明确授权前不得写成已完成事实 |
| `planned` | 已安排但尚未创建或实施 | 只能用于导航和阶段计划 |
| `historical` | 历史设计或过程证据 | 不再作为当前开发入口 |

同一份文档可以同时包含 `current` 和 `target` 内容，但每个重要结论必须明确属于哪一种状态。

## 4. 当前架构摘要

智美天工当前采用模块化单体，处于新领域边界与旧聚合 runtime 并存的过渡期。

目标架构统一为：

```text
SaaS 控制平面
+ 机构业务数据平面
+ 应用入口层
+ 业务模块层
+ 公共基础设施层
+ 外部适配器层
+ 单一 PostgreSQL／Drizzle 数据治理序列
```

机构端七条业务线为：

```text
工作台
客户中心
会话工作台
预约与随访
知识库
经营分析
管理中心
```

当前正式发布为 `0/7`。领域模型、契约、测试、Demo、Mock、旧 API 或 capability-off 页面均不能单独证明业务已经上线。

数据库演进顺序保持：

```text
MIG-01A1 Expand
→ MIG-01A2 锚点 provisioning
→ BASE-02B／BASE-02 双键上下文、scope revision、Guard
→ 全部 Writer 双写与旧 Writer 封堵
→ Audit／模板保护
→ MIG-01B 确定性回填、追赶和冲突清零
→ MIG-01C 非空、外键、attribution 与 shape enforce
→ Reader 重新核验与独立放行
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

## 5. 当前架构文档

| 文档 | 状态 | 职责 |
|---|---|---|
| [`architecture-v2.md`](./architecture-v2.md) | `target` | 总体目标架构、模块边界、写入政策、Migration 所有权和实施主序列 |
| [`architecture-v2-module-map.md`](./architecture-v2-module-map.md) | `target` | 当前路径到目标所有者和目标路径的映射 |
| [`institution-seven-stream-restart-baseline.md`](./institution-seven-stream-restart-baseline.md) | `current + target` | 七线完成度、依赖、发布门禁和重启顺序 |
| [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md) | `current + proposed` | 用当前代码、Schema、测试和历史 PR 对 V2 进行独立核验 |
| [`v2-02b-mig01-closure-preflight.md`](./v2-02b-mig01-closure-preflight.md) | `current + target + proposed` | MIG-01 A1～C 静态证据、完整影响面、阻断状态和内部候选实施切片。 |
| [`v2-mig01-a2-provisioning-preflight.md`](./v2-mig01-a2-provisioning-preflight.md) | `current + target + proposed` | A1／A2 状态、Owner 候选、Manifest 契约、P1／P2 拆分、Migration 元数据、幂等矩阵、环境门禁与实施阻断 |
| [`../operations/mig01-a2-provisioning-runbook.md`](../operations/mig01-a2-provisioning-runbook.md) | `current + proposed` | 受控 Runner 的 Manifest、输入文件、dry-run、Write Adapter 事务、Lease、审计、撤权、outcome-unknown、停止与 forward-fix 运行边界 |
| [`../operations/mig01-a2-p1-execution-plan-20260731.md`](../operations/mig01-a2-p1-execution-plan-20260731.md) | `current + proposed` | 冻结 A2-P1 Runtime、Authority／组合根与一次受控执行的分层授权、文件边界、验证和硬停止条件；不是数据库执行授权 |
| [`v2-02c-platform-auth-route-preflight.md`](./v2-02c-platform-auth-route-preflight.md) | `current + target + proposed` | 平台正式 Session、授权根、页面与 API 路由族、legacy／v1 影响面、阻断状态和候选实施切片 |
| [`../verification/github-main-hard-gate-validation-20260730.md`](../verification/github-main-hard-gate-validation-20260730.md) | `current` | Stage A 仓库硬门、Required Check、服务端拒绝探针、负向／正向 PR 验证和回退证据 |
| [`business-architecture.md`](./business-architecture.md) | `current + target` | 角色、价值流、两平面职责、七线业务闭环、AI 人工确认和正式发布尺度 |
| [`application-architecture.md`](./application-architecture.md) | `current + target` | 官网、认证、机构端、平台端、API、Webhook、权限、Capability 和应用依赖方向 |
| [`data-architecture.md`](./data-architecture.md) | `current + target + proposed` | 数据事实所有权、机构隔离、来源、证据和 MIG 序列 |
| [`software-architecture.md`](./software-architecture.md) | `current + target + proposed` | 模块分层、依赖方向、Port／Adapter 和兼容层 |
| [`deployment-architecture.md`](./deployment-architecture.md) | `current + target + proposed` | 当前仓库部署证据、目标环境、发布、回滚和待核验事项 |
| [`development-architecture.md`](./development-architecture.md) | `current + target + proposed` | 开发协作、任务与 PR 生命周期、分层开发、测试、Migration 门禁和完成定义 |
| [`../decisions/architecture-v2-decisions.md`](../decisions/architecture-v2-decisions.md) | `target` | 已接受架构决策及其约束 |

### 5.1 MIG-01A2 专项决策入口

| 文档 | 决策状态 | 职责 |
|---|---|---|
| [`../decisions/mig01-a2-provisioning-accepted-decisions.md`](../decisions/mig01-a2-provisioning-accepted-decisions.md) | `accepted` | 记录 D01～D11 已接受选择，以及 D12 仅接受最小 Anchor Bridge 方向、实施细节后置的边界 |
| [`../decisions/mig01-a2-provisioning-decision-pack.md`](../decisions/mig01-a2-provisioning-decision-pack.md) | `proposed` | 保留 D01～D12 的选项、推荐、风险、代价、证据和未决定时阻断 |

这里的 `accepted` 是专项决策生命周期状态，不等于 `current` 实现或交付完成。accepted 文件只在“用户已经选择什么”上优先解释 proposed decision pack，不得覆盖 `architecture-v2.md` 或已接受 ADR；两份文档均不表示仓库硬门、Runner、Runtime、Schema、Migration、A2-P1 或 A2-P2 已完成。

### 5.2 MIG-01A2 当前专项证据

| 文档 | 状态 | 职责 |
|---|---|---|
| [`v2-mig01-a2-environment-manifest-readonly-preflight.md`](./v2-mig01-a2-environment-manifest-readonly-preflight.md) | `current evidence` | 记录 Mac 本地安全验收环境的 Journal、A1 Shape、Manifest、CLI、备份恢复点和真实 dry-run 可用性 |
| [`../operations/mig01-a2-local-acceptance-stage-a-20260730.md`](../operations/mig01-a2-local-acceptance-stage-a-20260730.md) | `current evidence` | 记录固定 localhost-only 本地验收库推进到 0038、A1 Shape、低敏计数、迁移前后备份及两次隔离恢复验证 |
| [`../operations/mig01-a2-local-readiness-stage-b-20260730.md`](../operations/mig01-a2-local-readiness-stage-b-20260730.md) | `current evidence` | 记录本地验收 Context Policy、只读 PostgreSQL Adapter、合成测试、localhost-only smoke 和 Stage B 阻断收口 |
| [`../operations/mig01-a2-manifest-candidate-governance-20260730.md`](../operations/mig01-a2-manifest-candidate-governance-20260730.md) | `current evidence` | 记录不可变的 Candidate v1 test-only Contract、canonicalization、digest、合成 Source 与 Reviewer 生命周期 |
| [`../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md`](../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md) | `current evidence` | 记录用户授权 Source v2、Candidate v2、独立 digest 与三道治理门；不包含 Source／Candidate 实例 |
| [`../operations/mig01-a2-manifest-candidate-approval-template-20260730.md`](../operations/mig01-a2-manifest-candidate-approval-template-20260730.md) | `current + proposed` | 提供仓库外审批包的空白低敏 v2 模板；Git 文件未回填真实 Source、Candidate、digest、审批引用、路径或业务数据 |
| [`../operations/mig01-a2-local-manifest-candidate-approval-pack-20260730.md`](../operations/mig01-a2-local-manifest-candidate-approval-pack-20260730.md) | `current evidence + human reviewed` | 记录重新签发 Candidate 的低敏验证与用户人工审核结论；不包含 Candidate 正文、双键或 digest，不代表 Approved Manifest 已创建，也不授权 Stage D 或 A2-P1 |
| [`../operations/mig01-a2-approved-manifest-validation-20260730.md`](../operations/mig01-a2-approved-manifest-validation-20260730.md) | `current evidence` | 记录 Approved Manifest 的独立创建、exact-shape／`c14n-v1`／digest 校验、Candidate 隔离和职责分离；不授权 Stage D、数据库写入或 Lease |
| [`../operations/mig01-a2-stage-d-local-dry-run-validation-20260730.md`](../operations/mig01-a2-stage-d-local-dry-run-validation-20260730.md) | `current evidence` | 记录 Stage D 本地只读 dry-run、五项低敏计数、独立 pre／post 探针、数据库状态不变和零写入证据 |
| [`../operations/mig01-a2-stage-d-independent-review-20260730.md`](../operations/mig01-a2-stage-d-independent-review-20260730.md) | `current evidence` | 保留 F01 首轮发现与关闭历史，并记录修正 Head 的独立复审通过、Stage D handoff 准入和 A2-P1 仍未准入 |

这里的 `human reviewed` 只表示用户允许当前重新签发的 Candidate 作为未来 Approved Manifest 准备依据。Candidate payload 仍为 `candidate`，私有 Review State 仍为 `review_pending`；它不是 Candidate `approved` 状态，也不是 Approved Manifest 的 `approved` 状态。

以下段落记录 PR #823 合并时点的阶段快照：PR #809 的只读预检报告记录了六项阻断。PR #811 随后完成本地就绪修复 Stage A，将环境 Journal 从 38 推进到 39、使 A1 三表 Shape 与仓库 0038 一致，并建立迁移前后两个已验证恢复点；`journal_not_at_0038`、`schema_shape_missing`、`backup_recovery_point_missing` 已关闭。PR #814 进一步建立只读 Adapter 与本地验收 Context Policy，关闭 `readonly_adapter_unavailable`。PR #816 建立 Candidate v1 Governance 基础并关闭 `candidate_contract_missing`；PR #817 完成 Stage C-0 handoff；PR #818 建立用户授权 Source／Candidate v2 治理合约；PR #819 完成 Source v2 handoff；PR #820 生成、重新签发并记录人工审核通过的 Candidate 低敏证据。PR #823 随后将 Approved Manifest 低敏创建与校验摘要合并到 `main`：Approved Manifest 数量为 1，version 为 `mig01-a2/v1`，`approvalStatus=approved`，`c14n-v1`、exact shape 和独立 digest 校验均通过，Candidate 与 Approved Manifest 作为独立资产保留且 Candidate digest 未复用。在该时点，`real_manifest_missing`、`approved_manifest_validation_missing` 与报告中的 `approved_manifest_independent_review_pending` 已关闭，`real_environment_dry_run_unavailable` 继续阻断，Runner、dry-run、Lease、数据库写入、Stage D 与 A2-P1 均未启动。

## 6. 架构视图完成状态

业务、应用、数据、软件、部署、开发六类架构视图已经完成 `6/6`。`V2-ARCH-DOCS-03` 已通过 PR #787 合并，开发架构、根 `README.md` 项目入口和 `CURRENT_STATUS` 同步均已完成，不再标记为 `planned`。

`V2-02B-MIG01-CLOSURE-PREFLIGHT` 已通过 PR #789 完成并合并，其预检文档现作为 MIG-01 当前静态证据和候选实施切片入口。该结果不表示 MIG-01 已实施或关闭。

`V2-MIG01-A2-PROVISIONING-PREFLIGHT-01` 已通过 PR #797 完成并合并，其专项预检文档现作为 A2 当前静态证据与决策阻断入口。该结果只完成预检，没有实施 A2；A2-P1、A2-P2 和数据库操作均未启动。

`V2-MIG01-A2-DECISION-PACK-01` 已通过 PR #799 完成并合并，proposed decision pack 继续保留为选项、推荐、风险和证据材料。用户随后明确接受 D01-A、D02-A、D03-A、D04-A、D05-A、D06-B、D07-B、D08-C、D09-A、D10-B、D11-B 和 D12-A 方向；D12 的精确名称、列序、Catalog Shape、编号、锁／timeout 和环境仍后置。该接受结果没有配置仓库硬门，没有创建 Runner 或签发 Lease，也没有启动 A2-P1／P2。

`V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT` 已通过 PR #791 完成并合并，其预检文档现作为平台正式授权与路由族的当前静态证据和候选实施切片入口。该预检确认正式平台服务端授权根为“缺失”、平台 Runtime／发布准入为“阻断”；本阶段没有实施平台 Runtime，七个平台候选实施切片均未启动。

`V2-QUALITY-CI-01-MINIMUM-ARCHITECTURE-QUALITY-GATE` 已通过 PR #794 完成并合并，最小架构与质量门禁已经进入 `main`。Stage A 随后通过 PR #804 完成仓库硬门配置与验证，并通过 PR #805 完成交接收口；PR #806 独立修复了交接门禁暴露的既有异步测试竞态。该结果只证明检查器、增量规则、现有质量命令编排和 GitHub 服务端合并门禁已建立并验证，不表示历史架构债务已清零或任何业务已正式发布。

`V2-MIG01-A2-GOVERNANCE-FOUNDATION-01-STAGE-B` 已通过 PR #807 完成并合并。Tenancy 现已拥有版本化低敏 Manifest、`c14n-v1`／SHA-256、dry-run 分类、Repository／Transaction Port、低敏 Lease 契约和一次性 CLI 治理基础，配套 Runbook 已进入 `main`。该结果不表示真实 Manifest、环境 journal、数据库 Shape、备份／恢复点、真实 Lease 或 P1 已核验、签发或执行。

`V2-MIG01-A2-ENVIRONMENT-MANIFEST-READONLY-PREFLIGHT-01` 已通过 PR #809 完成并合并，但结论为 `blocked`：本地验收库 Journal 只有 38 项且未到仓库 0038，A1 三表缺失，真实 Manifest、正式备份／恢复点和只读 Repository Adapter 缺失，真实 Runner dry-run 不可用。该报告只形成只读证据，没有修复环境或启动 A2-P1／P2。

`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-A-COMPLETE` 已通过 PR #811 完成并合并。固定本地验收库现有 39 条 Applied Migration，最新项内部匹配 0038；`tenants` 低敏计数保持 2，三个 A1 表 Shape 与仓库一致且均为空。迁移前备份 `zmtg_clean_local_acceptance-pre-0038-20260730-124114` 与迁移后备份 `zmtg_clean_local_acceptance-post-0038-20260730-124114` 均已完成隔离恢复验证并继续保留。本阶段只对本地验收环境应用仓库既有 0038，仓库 Runtime、Schema、Migration 修改均为 0。

`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B-COMPLETE` 已通过 PR #814 完成并合并。Tenancy 现有 `mig01-a2-local-acceptance-context-policy/v1`，只允许 `local_acceptance` 环境的 `Asia/Shanghai` 与 `CNY`；只读 Adapter 只访问 `public.tenants` 和三个 A1 表，所有读取使用 `REPEATABLE READ + READ ONLY` 并核验 timeout，所有写方法永久拒绝。localhost-only smoke 前后 Journal 39、`tenants` 2、三个 A1 表 0 的低敏计数不变。真实 Manifest、Runner dry-run、Lease、A2-P1／P2 仍未启动。

`V2-MIG01-A2-CANDIDATE-GOVERNANCE-01` 已通过 PR #816 完成并以 Merge Commit `eb7cde613c38e262aeb8519c53e7e3d21704b18f` 合并。Tenancy 现有独立的 `mig01-a2-candidate/v1` Candidate Contract、`zmtg.mig01-a2.provisioning-candidate-manifest` domain、Candidate canonicalization／SHA-256 digest、`mig01-a2-candidate-source/v1` Source 契约，以及 `generated → review_pending` 单向 Reviewer 生命周期。Candidate 与 `mig01-a2/v1` Approved Manifest 使用不同协议和 digest；当前没有实现 Candidate 的 `approved` 状态，也没有创建真实 Candidate 或 Approved Manifest。PR #816 精确新增 3 个 Candidate Runtime 模块、3 个测试文件和 2 个治理文档，关闭 `candidate_contract_missing`；`real_manifest_missing` 继续阻断。

`V2-MIG01-A2-STAGE-C-REAL-SOURCE-AND-CANDIDATE-01` 阶段一已通过 PR #818 完成并以 Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350` 合并。Candidate v1 继续保持 test-only 且不可变；Tenancy 新增 `mig01-a2-candidate-source/v2`／`local_acceptance_user_authorized_input` Source Contract 与 `mig01-a2-candidate/v2` Candidate Contract。Source authorization、Candidate review 与 Approved Manifest 是三个独立门。PR #818 只建立合约、测试和治理文档，没有生成 Source／Candidate 实例，没有读取数据库或运行 Runner，也没有创建 Approved Manifest；`real_manifest_missing` 继续阻断。

Source v2 handoff 已通过 PR #819 完成并以 Merge Commit `2e14cfd2cec73cd3d8dc08274ba70763402798bb` 合并。Stage C Candidate 审批包随后通过 PR #820 完成并以 Merge Commit `172526e15775fc99768e1d739fc3c0d947bc1363` 合并：最终 Head 为 `bc3ad6155df5ce071442183b85a301dd6366ec51`，Candidate 数量为 1，Source／Candidate exact shape、digest、Context Policy 与 tenant 父记录均已验证；用户人工审核结论为 `accepted_for_approved_manifest_preparation`。PR #823 已将 Approved Manifest 低敏校验报告以 Merge Commit `3f042172734c0dc9cc583a09f347e38df7db1e02` 合并；Approved Manifest 与 Candidate 的文件及 digest 均保持分离，Future Operator 仍未分配。该结果不授权 Runner、dry-run、Lease、数据库写入、Stage D 或 A2-P1。

Stage D 已通过 PR #825 完成一次获授权的本地只读 dry-run，并通过 PR #826 完成证据归因修正后的独立复审。Runner ReadOnly Adapter 只负责 tenant 存在性、Manifest 对应 triplet 分类与五项计数；Journal、实际 Shape 和四表总数来自独立临时只读探针，冻结仓库提供预期 Journal／Shape 对照。F01 已关闭，Stage D handoff 准入为 `true`，A2-P1 准入仍为 `false`。

PR #828 已将 A2-P1 受控执行计划合并到 `main`，随后 PR #829 建立当前唯一 Write Adapter、Write 合成事务测试、ReadOnly／Write parity 测试并更新 Runbook。Write Adapter 只读取 `tenants` 与三张 A1 表，只向三张 A1 表执行参数化纯 `INSERT`，并提供 `SERIALIZABLE READ WRITE`、固定 timeout 与双键事务级 advisory lock；既有 Kernel 强制 affected rows 逐项等于 1，并在提交前完成全批重检。该 Runtime 资产进入 `main` 不表示真实 Authority、组合根、Lease、数据库执行或 A2-P1 已完成。

文档完成只代表同一套架构 V2 的视图与入口已经建立，不代表 runtime、Schema、Migration、API、UI、Capability、环境或七线正式发布已经完成。

### 6.1 当前架构与质量门禁

- Workflow：`.github/workflows/architecture-quality.yml`；
- 检查器：`scripts/verify/architecture-quality.mjs`；
- 差异模型：显式接收 PR `Base`／`Head`，只阻止本次差异新增的架构违规；
- 真实验证：PR #794 的 Run `30386375532`／Job `90366597304` 已完成架构自测、增量检查、lint、typecheck、完整测试和 build，结论为 `success`；
- Stage A 验证：PR #804 的最终 Run `30482219056`／Job `90678924630` 在冻结 Head `1948597d5349017485578723fd32535e84e2bd97` 上完成全部质量步骤，结论为 `success`；
- Stage A handoff：PR #805 Head `5d5c4e746f9de079088f62bb8585c1856e9f0a44`／Merge Commit `c52fef48e71f760017c8e39909b610ae6de180d8`，Run `30505641202`／Job `90754678015` 全部成功；
- Stage B Runner：PR #807 Head `d7abdc52c64be367b988db15bfbdaa251be33fd4`／Merge Commit `e50999ebc33dd07a4447fa8f9274e974e9beae63`，Run `30508177604`／Job `90762357307` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- 本地就绪修复 Stage A：PR #811 Head `50b007820b7fdb68ff35b6ef0e2a53b9e8e61880`／Merge Commit `fc08de343456a1f0d05092f1aedd389118b32b26`，Run `30514884226`／Job `90782386213` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- 本地就绪修复 Stage B：PR #814 Head `c5ad29e2775789cc28b47e0724f64e165b0eff9e`／Merge Commit `19f2dbe55799e533e609c7cece9eaad1b623babd`，Run `30519856557`／Job `90797620311` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- Candidate Governance／Stage C-0：PR #816 Base `0be5faf5b089fdf3b5e0c84f3dac09d1283368d2`／Head `4df7cac76887b5cc3336650911dfc7f0448516e5`／Merge Commit `eb7cde613c38e262aeb8519c53e7e3d21704b18f`，Run `30524750504`／Job `90813002538` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；Candidate 定向契约集 3 文件／105 个、完整测试 417 文件／5896 个、build 101／101 通过；
- Candidate Governance／Stage C-0 handoff：PR #817 Base `eb7cde613c38e262aeb8519c53e7e3d21704b18f`／Head `7ea19efccc5dd17a5e30c7c35571465d0d986f3f`／Merge Commit `c1be2e45389a74f653717a2a47a81a5559f3c35b`，Run `30526410379`／Job `90818243458` 成功；
- Source／Candidate v2 Governance：PR #818 Base `c1be2e45389a74f653717a2a47a81a5559f3c35b`／Head `29ee87fa7f7b3ab3749e4adedaf89457471d21ef`／Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350`，Run `30529676907`／Job `90828769200` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；v2 定向契约集 3 文件／225 个、完整测试 420 文件／6121 个、build 101／101 通过；
- Source v2 handoff：PR #819 Base `ff3528d703c00703998d62f69c1ded8f5f6a3350`／Head `4c964a167ad4e729681067ba319e4b9cb1940d3f`／Merge Commit `2e14cfd2cec73cd3d8dc08274ba70763402798bb`，Run `30530766787`／Job `90832302970` 成功；
- Stage C Candidate 人工审核：PR #820 Base `2e14cfd2cec73cd3d8dc08274ba70763402798bb`／Head `bc3ad6155df5ce071442183b85a301dd6366ec51`／Merge Commit `172526e15775fc99768e1d739fc3c0d947bc1363`，Run `30540499970`／Job `90863892886` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；Candidate payload 仍为 `candidate`，私有 Review State 仍为 `review_pending`；
- Approved Manifest 创建与校验：PR #823 Base `5c3e65f3757de8ee0322ea7c262e55e2b5548f96`／Head `78eff467a158baf4d70995cb59bd774c35327785`／Merge Commit `3f042172734c0dc9cc583a09f347e38df7db1e02`，Run `30548606044`／Job `90891106206` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- A2-P1 受控执行计划：PR #828 Base `24e5076a5e705ea374c9f96ad4ed3d6f53b8fe6c`／Head `77be8e4ac835ce76e77a6bf5c7026c63d83b58fc`／Merge Commit `184b0320be1bedaace5d72ff0b0e453f343ad52e`，Run `30565599037`／Job `90949208935` 的全部质量步骤成功；
- A2-P1 Write Adapter Runtime：PR #829 Base `184b0320be1bedaace5d72ff0b0e453f343ad52e`／Head `aa465a64aa146a43f766413caa53dfc88a1bd39b`／Merge Commit `bbf15be8f5acd66d80db5ac7b6e9250a57d5744e`，Run `30568943508`／Job `90960419070` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；定向 4 文件／109 个、完整 Provisioning 14 文件／510 个、完整基线 422 文件／6190 个测试与 build 101／101 通过；
- 服务端硬门：`main.protected=true`，Required Check Context 为 `最小架构与质量门禁`，App ID／slug 为 `15368`／`github-actions`，`strict=true`、`enforce_admins=true`、审批数为 `0`；
- 服务端拒绝：普通 direct push、显式 force-with-lease 和删除受保护分支均被 GitHub 拒绝；不允许管理员 bypass；
- 合并策略：Stage A 验证 PR 使用 Merge Commit 合并；未启用 Linear History，仓库其他既有合并方法设置未在 Stage A 修改；
- `AQ001`：禁止新增第二套根级 `database/**`；
- `AQ002`：禁止新增机构端 legacy Route；
- `AQ003`：禁止新增平台端 legacy Route；
- `AQ004`：冻结聚合模块 `institution` 的未登记新增文件；
- `AQ005`：冻结聚合模块 `open-platform` 的未登记新增文件；
- `AQ006`：禁止 Domain 层新增对应用、数据库、集成或框架层的依赖；
- `AQ007`：禁止业务模块间新增对 `server/**` 或 Repository 实现的直接依赖。

GitHub 最终只读核对结果为 `main.protected=true`，Required Check 已绑定 `github-actions` App ID `15368`，并要求分支基于最新 `main`。PR #804 已证明 Required Check 在 pending／failure 时阻断合并、在冻结 Head 的检查成功后允许正常 Merge Commit；测试、CI 或保护通过仍不得写成正式发布。

`development-architecture.md` 与 `software-architecture.md` 中“Architecture CI 尚未建立”的表述属于各自较早审计基线，不能覆盖最新 `main` 中已经合并的 Workflow 与检查器事实；本次 handoff 不越权重写这些架构正文。

## 7. 历史资料

| 文档 | 状态 | 使用方式 |
|---|---|---|
| [`zmtg-new-project-architecture-design.md`](./zmtg-new-project-architecture-design.md) | `historical` | 作为重建早期方案和需求来源，不再作为根 README 的唯一架构入口 |
| `docs/refactor/**` | `historical` | 作为目录治理、依赖、风险和试点的过程证据 |
| `docs/superpowers/plans/**` | `historical` | 作为七线和专项任务的历史设计／计划证据；与当前 `main` 冲突时以当前实现为准 |
| `docs/devlog/**` | `historical` | 开发过程和阶段记录 |

## 8. 交接文档职责

| 文档 | 只负责 |
|---|---|
| 根 `README.md` | 项目定位、当前状态摘要、快速启动、验证命令和文档导航 |
| `docs/handoff/CURRENT_STATUS.md` | 当前已合并状态、关键门禁、当前阶段和下一阶段 |
| `docs/handoff/NEXT_TASK.md` | 唯一下一任务的允许范围、禁止范围、验证和交付要求 |
| `docs/handoff/RELEASE_HISTORY.md` | 已合并历史和阶段闭环记录 |
| 本文件 | 架构文档导航、状态词和事实源关系 |

这些文件不能相互复制成长篇历史账本，也不能给出相互冲突的下一阶段。

## 9. 推荐阅读路径

### 产品和业务负责人

1. [`business-architecture.md`](./business-architecture.md)
2. [`institution-seven-stream-restart-baseline.md`](./institution-seven-stream-restart-baseline.md)
3. [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md)

### 应用和前端开发

1. [`application-architecture.md`](./application-architecture.md)
2. [`architecture-v2.md`](./architecture-v2.md)
3. [`v2-02c-platform-auth-route-preflight.md`](./v2-02c-platform-auth-route-preflight.md)
4. `src/modules/institution-contracts/v1/institution-navigation.ts`
5. `src/modules/institution-contracts/v1/institution-routes.ts`
6. `src/modules/institution-contracts/v1/institution-capability-registry.ts`

### 后端、数据和安全开发

1. [`architecture-v2.md`](./architecture-v2.md)
2. [`architecture-v2-module-map.md`](./architecture-v2-module-map.md)
3. [`architecture-v2-evidence-audit-20260728.md`](./architecture-v2-evidence-audit-20260728.md)
4. [`v2-02b-mig01-closure-preflight.md`](./v2-02b-mig01-closure-preflight.md)
5. [`v2-mig01-a2-provisioning-preflight.md`](./v2-mig01-a2-provisioning-preflight.md)
6. [`../decisions/mig01-a2-provisioning-accepted-decisions.md`](../decisions/mig01-a2-provisioning-accepted-decisions.md)
7. [`../decisions/mig01-a2-provisioning-decision-pack.md`](../decisions/mig01-a2-provisioning-decision-pack.md)
8. [`../operations/mig01-a2-provisioning-runbook.md`](../operations/mig01-a2-provisioning-runbook.md)
9. [`../operations/mig01-a2-local-acceptance-stage-a-20260730.md`](../operations/mig01-a2-local-acceptance-stage-a-20260730.md)
10. [`../operations/mig01-a2-local-readiness-stage-b-20260730.md`](../operations/mig01-a2-local-readiness-stage-b-20260730.md)
11. [`../operations/mig01-a2-manifest-candidate-governance-20260730.md`](../operations/mig01-a2-manifest-candidate-governance-20260730.md)
12. [`../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md`](../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md)
13. [`../operations/mig01-a2-manifest-candidate-approval-template-20260730.md`](../operations/mig01-a2-manifest-candidate-approval-template-20260730.md)
14. [`v2-02c-platform-auth-route-preflight.md`](./v2-02c-platform-auth-route-preflight.md)
15. [`../decisions/architecture-v2-decisions.md`](../decisions/architecture-v2-decisions.md)
16. [`data-architecture.md`](./data-architecture.md)
17. [`software-architecture.md`](./software-architecture.md)

### 部署和运维

1. [`deployment-architecture.md`](./deployment-architecture.md)
2. [`../operations/mig01-a2-provisioning-runbook.md`](../operations/mig01-a2-provisioning-runbook.md)
3. [`../operations/mig01-a2-local-acceptance-stage-a-20260730.md`](../operations/mig01-a2-local-acceptance-stage-a-20260730.md)
4. [`../operations/mig01-a2-local-readiness-stage-b-20260730.md`](../operations/mig01-a2-local-readiness-stage-b-20260730.md)
5. [`../operations/mig01-a2-manifest-candidate-governance-20260730.md`](../operations/mig01-a2-manifest-candidate-governance-20260730.md)
6. [`../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md`](../operations/mig01-a2-manifest-real-source-v2-governance-20260730.md)
7. [`../operations/mig01-a2-manifest-candidate-approval-template-20260730.md`](../operations/mig01-a2-manifest-candidate-approval-template-20260730.md)
8. `docs/operations/production-migration-runbook.md`
9. `docs/operations/local-development.md`
10. `scripts/README.md`

### 开发与协作

1. [`development-architecture.md`](./development-architecture.md)
2. [`../../AGENTS.md`](../../AGENTS.md)
3. [`../ai-agent-governance.md`](../ai-agent-governance.md)
4. [`../agent-guardrails/zmtg-pr-gatekeeper.md`](../agent-guardrails/zmtg-pr-gatekeeper.md)

## 10. 架构文档更新规则

1. 先核对当前 `main`，再修改架构文档；
2. 新结论必须标记为 `current`、`target`、`proposed`、`planned` 或 `historical`；
3. 影响模块所有权、Migration 顺序、权限根或发布门禁的变更必须形成 ADR 或独立预检；
4. 不在多个文档维护相互独立的模块清单；
5. 不大段复制总体架构，视图文档应引用并展开；
6. 不为目录外观创建空模块或空适配器；
7. docs-only 合并不构成 runtime、Schema、Migration、API、UI、Capability 或发布授权；
8. 发现代码与文档不一致时，优先记录差距，不把目标状态伪装为当前状态。

## 11. 当前项目级顺序

```text
就绪修复 Stage A：本地验收数据库安全恢复点与 A1 基线（已完成，PR #811）
→ 就绪修复 Stage B：只读 Repository Adapter 与 Context Policy（已完成，PR #814）
→ Candidate Governance：Candidate Contract、Source 与 Reviewer 生命周期（已完成，PR #816）
→ Stage C-0 独立 handoff（已完成，PR #817）
→ Source／Candidate v2 Governance（已完成，PR #818）
→ Source v2 handoff（已完成，PR #819）
→ Stage C：Candidate 生成、重新签发与用户人工审核（已完成，PR #820）
→ Approved Manifest 创建与校验（已完成，PR #823）
→ Approved Manifest 独立 handoff（已完成）
→ Stage D 本地只读 dry-run 验证（已完成，PR #825）
→ Stage D 独立审查（已完成，PR #826）
→ Stage D handoff（已完成，PR #827）
→ A2-P1 受控执行计划（已完成，PR #828）
→ Write Adapter Runtime（已完成，PR #829）
→ Runtime handoff（本次收口）
→ Authority／组合根无写准备（唯一下一阶段）
→ Authority／组合根无写验证
→ Authority／组合根低敏证据 PR
→ 独立 Authority／组合根 handoff
→ 一次受控 local_acceptance execute
→ 低敏执行证据
→ 独立审查
→ A2-P1 最终 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

`V2-MIG01-A2-PROVISIONING-PREFLIGHT-01` 已通过 PR #797 完成并合并，PR #799 已将 proposed decision pack 合并到 `main`，PR #801 已记录 accepted 选择，PR #804／#805 已完成治理 Stage A 仓库硬门与交接，PR #807／#808 已完成治理 Stage B Runner 基础与交接，PR #809 已完成本地环境只读预检，PR #811／#812 已完成本地就绪修复 Stage A 与交接，PR #814 已完成本地就绪修复 Stage B，PR #816／#817 已完成 Candidate Governance／Stage C-0 与 handoff，PR #818／#819 已完成 Source／Candidate v2 Governance 与 handoff，PR #820 已完成 Candidate 生成、重新签发和用户人工审核，PR #823 已完成 Approved Manifest 创建与低敏校验报告合并，PR #825／#826／#827 已完成 Stage D 与 handoff，PR #828／#829 已完成受控执行计划和 Write Adapter Runtime。唯一下一阶段沿用 Runbook 名称 `Authority／组合根无写准备`，仓库尚无正式任务编号，本 handoff 不自行创建编号。

治理 Stage A 与治理 Stage B 已通过独立变更域和独立 PR 完成。PR #809 只读连接了受控 localhost 本地验收库并确认六项阻断；PR #811 关闭本地环境 Journal、A1 Shape 与恢复点三项阻断；PR #814 建立只读 Adapter 与 Context Policy 并关闭 `readonly_adapter_unavailable`；PR #816 建立 Candidate v1 test-only 契约并关闭 `candidate_contract_missing`；PR #818 建立用户授权 Source／Candidate v2 治理合约；PR #820 记录当前 Candidate 的低敏验证与人工审核结论；PR #823 记录 Approved Manifest 创建、独立 digest 校验和 Candidate／Approved 分离事实；PR #825／#826 完成 Stage D 只读 dry-run、F01 关闭和独立复审；PR #829 已建立 Write Adapter，但未连接数据库、读取真实 Manifest、签发或消费 Lease、使用 `--execute` 或执行数据库写入。A2-P1 仍未完成，A2-P2 尚未启动。

MIG-01 内部候选顺序继续保持：

```text
A2
→ BASE-02
→ Writer
→ Audit／模板
→ B
→ C
→ Reader
```

本地就绪修复 Stage A、Stage B、Candidate Governance／Stage C-0、Source／Candidate v2 Governance、Stage C Candidate 人工审核、Approved Manifest 创建／校验、Stage D 只读 dry-run 与独立审查、A2-P1 受控执行计划及 Write Adapter Runtime 已完成。Runtime 存在不代表 A2-P1 已执行或数据库写入可以开始；仍须依次完成 Authority／组合根无写准备及 handoff，再重新冻结一次受控执行的环境、Manifest、Operator／Reviewer、Execution Lease、权限、恢复点和事务边界。该顺序不改变 MIG-01～MIG-06 的相对顺序。

后续既定数据顺序保持：

```text
MIG-01
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

## 12. 本文禁止的解释

- 本索引不是新架构源；
- 文档存在不代表对应目录、模块或服务已经存在；
- `target` 不等于已实施；
- `current` 不等于正式发布；
- Capability Registry 不等于授权；
- Capability 状态不等于对象或动作权限；
- 角色 Audience 不等于服务端授权；
- 代码合并、测试通过或 Demo 可用不等于七线正式上线。

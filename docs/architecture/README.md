# 智美天工架构文档索引

- 任务：BASE-02 ULTRA Membership Revision M4 deterministic legacy calibration 受控执行、独立审查与 handoff（无正式 `V2-*` 编号）
- 日期：`2026-08-02 CST +0800`
- 审计基线：`4b79cdf39775fa7827be89a33fa339e8fda90faa`
- 状态：`current evidence + M4 handoff`
- 文档性质：架构导航索引，不是第二套架构事实源
- 本次 M4 docs-only handoff 差异中的 Runtime、Schema、Migration、journal、snapshot、数据库、API、UI 修改：`0`

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
| [`../operations/mig01-a2-approved-manifest-reissue-validation-20260731.md`](../operations/mig01-a2-approved-manifest-reissue-validation-20260731.md) | `current evidence` | 记录旧 Approved 不可用后的全新重新签发、Candidate 不变、exact shape／独立 digest、文件隔离、职责分离和零执行边界 |
| [`../operations/mig01-a2-approved-manifest-reissue-independent-review-20260731.md`](../operations/mig01-a2-approved-manifest-reissue-independent-review-20260731.md) | `current evidence` | 独立核验重新签发低敏证据与当前治理状态；只准入 handoff，不准入专用角色、Lease、Runner 或 A2-P1 execute |
| [`../operations/mig01-a2-stage-d-local-dry-run-validation-20260730.md`](../operations/mig01-a2-stage-d-local-dry-run-validation-20260730.md) | `current evidence` | 记录 Stage D 本地只读 dry-run、五项低敏计数、独立 pre／post 探针、数据库状态不变和零写入证据 |
| [`../operations/mig01-a2-stage-d-independent-review-20260730.md`](../operations/mig01-a2-stage-d-independent-review-20260730.md) | `current evidence` | 保留 F01 首轮发现与关闭历史，并记录修正 Head 的独立复审通过、Stage D handoff 准入和 A2-P1 仍未准入 |
| [`../operations/mig01-a2-p1-authority-composition-root-no-write-validation-20260731.md`](../operations/mig01-a2-p1-authority-composition-root-no-write-validation-20260731.md) | `current evidence` | 记录合成 Authority 签名活动记录、仓库外一次性组合根、合成无写验证、负向生命周期和零真实操作边界；不表示真实 Authority、Lease、权限窗口或数据库执行已开始 |
| [`../operations/mig01-a2-p1-public-temporary-acl-remediation-20260731.md`](../operations/mig01-a2-p1-public-temporary-acl-remediation-20260731.md) | `current evidence` | 记录固定 localhost-only 本地验收数据库的 `PUBLIC TEMPORARY` 单次撤销、`PUBLIC CONNECT` 不变、其他 ACL／对象／数据不变量和零 A2-P1 执行边界 |
| [`../operations/mig01-a2-p1-public-temporary-acl-independent-review-20260731.md`](../operations/mig01-a2-p1-public-temporary-acl-independent-review-20260731.md) | `current evidence` | 独立核验 ACL 证据来源、变更前后不变量、零回退与零越界结论；只准入 ACL handoff，不准入专用角色预置或 A2-P1 |
| [`../operations/mig01-a2-p1-execution-validation-20260731.md`](../operations/mig01-a2-p1-execution-validation-20260731.md) | `current evidence` | 记录固定 localhost-only 本地验收环境的一次 A2-P1 dry-run、一次 `--execute`、三张 A1 表净新增、Execution Lease、临时专用角色最小权限及完整清理；不授权 A2-P2 |
| [`../operations/mig01-a2-p1-execution-independent-review-20260731.md`](../operations/mig01-a2-p1-execution-independent-review-20260731.md) | `current evidence` | 独立核验 A2-P1 执行状态机、原子事务、数据净影响、恢复点边界、角色／权限／Lease 清理及 `fixed_table_count_drift` 裁决；只准入最终 handoff，不授权 A2-P2 |
| [`../operations/mig01-a2-p2-catalog-data-shape-readonly-preflight-20260731.md`](../operations/mig01-a2-p2-catalog-data-shape-readonly-preflight-20260731.md) | `current evidence + proposed implementation freeze` | 记录 localhost-only 显式只读 Catalog／Shape 探针、候选四分类、历史 orphan 低敏归因、精确索引／`NOT VALID` FK、metadata 串行前置和零数据库变更边界 |
| [`../operations/mig01-a2-p2-catalog-data-shape-independent-review-20260731.md`](../operations/mig01-a2-p2-catalog-data-shape-independent-review-20260731.md) | `current evidence` | 独立核验对象名称与列序、Catalog 归因、Shape、历史 orphan、P0／P1、事务／锁及 forward-fix；只准入 handoff，不授权 Schema／Migration 执行 |
| [`../operations/drizzle-migration-snapshot-strategy.md`](../operations/drizzle-migration-snapshot-strategy.md) | `current + target` | 以 journal 最后一条 tag 和实际 SQL 集合动态核验 current Migration，保护 snapshot 0026 事实、阶段性 metadata 差异与 `db:generate`／snapshot-diff 禁令 |
| [`../operations/a2-p2-p0-metadata-current-independent-review-20260731.md`](../operations/a2-p2-p0-metadata-current-independent-review-20260731.md) | `current evidence` | 独立核验 P0 两文件范围、动态 journal current 口径、snapshot 0026、零 Schema／Migration／metadata／数据库改动与 P1 未授权边界 |
| [`../operations/mig01-a2-p2-p1-implementation-independent-review-20260731.md`](../operations/mig01-a2-p2-p1-implementation-independent-review-20260731.md) | `current evidence` | 独立核验实时编号 0039、四文件实施、SQL／Schema／journal 一致性、snapshot 不变和 local_acceptance Migration 准入 |
| [`../operations/mig01-a2-p2-p1-local-acceptance-migration-validation-20260801.md`](../operations/mig01-a2-p2-p1-local-acceptance-migration-validation-20260801.md) | `current evidence` | 记录一次受控 local_acceptance Migration、精确索引与未验证外键、前后低敏计数、Lease、恢复点和零业务 DML 证据 |
| [`../operations/mig01-a2-p2-p1-local-acceptance-migration-independent-review-20260801.md`](../operations/mig01-a2-p2-p1-local-acceptance-migration-independent-review-20260801.md) | `current evidence` | 独立核验唯一 attempt、事实归因、Catalog、数据不变量、Lease／恢复点终态和 A2-P2 handoff 准入 |
| [`../operations/base02-readiness-plan-20260801.md`](../operations/base02-readiness-plan-20260801.md) | `current evidence + proposed implementation freeze` | 记录 BASE-02 静态与只读数据库准入证据、orphan 责任边界、BASE-B1～B6 实施方案、风险、测试及停止／回退条件；不授权 Runtime 或数据修复 |
| [`../operations/base02-readiness-independent-review-20260801.md`](../operations/base02-readiness-independent-review-20260801.md) | `current evidence` | 独立核验 BASE-02 方案未误纳 A2-P2、未授权 orphan 修复、未提前放行 Reader，并确认 handoff 准入、不确认实施准入 |
| [`../decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md`](../decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md) | `current evidence + proposed decisions` | 记录 BASE-B1 因缺少稳定 Membership revision 而硬停止，并冻结 Owner、生命周期、Binding version 与 Operating Context 排除边界；不构成 accepted decision |
| [`../decisions/base02-membership-revision-architecture-decision-pack.md`](../decisions/base02-membership-revision-architecture-decision-pack.md) | `proposed decision pack` | 比较 A-literal、A-full、canonical replacement 与现有字段组合；推荐 A-full，但未接受、未授权 Schema／Migration 或 Runtime |
| [`../operations/base02-membership-revision-architecture-independent-review-20260801.md`](../operations/base02-membership-revision-architecture-independent-review-20260801.md) | `current evidence` | 独立核验三方案、BASE-B1～B6、Reader／Writer 与 orphan／FK 边界；只准入决策 handoff，不准入 Schema／Migration 或 BASE-B1 Runtime |
| [`../decisions/base02-membership-revision-accepted-decision.md`](../decisions/base02-membership-revision-accepted-decision.md) | `accepted decision` | 记录用户接受 A-full：`tenant_members` 继续作为 Access Control 唯一 canonical Membership current，并绑定显式单调 revision、CAS、完整生命周期、ABA、provenance、同事务 transition evidence 与唯一 Writer；不决定具体 Schema／Migration |
| [`../operations/base02-membership-revision-acceptance-independent-review-20260801.md`](../operations/base02-membership-revision-acceptance-independent-review-20260801.md) | `current evidence` | 独立确认 A-full 接受完整、Owner 与三个版本域未漂移、未形成第二 current、未夹带物理 Schema 或 Runtime 授权；只准入 acceptance handoff |
| [`../operations/base02-membership-revision-schema-migration-preflight-20260801.md`](../operations/base02-membership-revision-schema-migration-preflight-20260801.md) | `current evidence + proposed implementation freeze` | 完整枚举 current Schema、Writer、Reader、Session／Guard 与测试影响面，并冻结 M0～M7 串行候选；不授权 Schema／Migration 或 Runtime |
| [`../decisions/base02-membership-revision-physical-model-decision-pack-20260801.md`](../decisions/base02-membership-revision-physical-model-decision-pack-20260801.md) | `proposed physical model` | 推荐规范化同表 current＋`tenant_membership_transitions` immutable evidence，冻结 P01～P12 物理候选；尚未接受 |
| [`../operations/base02-membership-revision-schema-preflight-independent-review-20260801.md`](../operations/base02-membership-revision-schema-preflight-independent-review-20260801.md) | `current evidence` | 独立核验 A-full 未重开、物理模型与影响面完整、M0～M7 可作为接受输入；只准入接受 handoff，不准入实施或 BASE-B1 Runtime |
| [`../decisions/base02-membership-revision-physical-model-accepted-decision.md`](../decisions/base02-membership-revision-physical-model-accepted-decision.md) | `accepted decision` | 记录 P01～P12 绑定接受和 M0→M7 唯一串行；不替代各切片的文件范围、Lease、恢复点、独立审查与执行门禁 |
| [`../operations/base02-membership-revision-physical-model-acceptance-independent-review-20260801.md`](../operations/base02-membership-revision-physical-model-acceptance-independent-review-20260801.md) | `current evidence` | 独立核验 P01～P12、M0～M7、A-full 与 Owner 边界完整接受；只准入 M0／M1 handoff |
| [`../operations/base02-membership-revision-m1-implementation-independent-review-20260801.md`](../operations/base02-membership-revision-m1-implementation-independent-review-20260801.md) | `current evidence` | 独立核验 `0040` Expand 四文件、accepted Shape、journal、snapshot 不变、零 legacy DML 和受控执行准入 |
| [`../operations/base02-membership-revision-m1-0040-correction-independent-review-20260801.md`](../operations/base02-membership-revision-m1-0040-correction-independent-review-20260801.md) | `current evidence` | 保留首次类型失败与完整回滚历史，独立核验未消费 `0040` 的三处精确类型纠错和零范围扩张 |
| [`../operations/base02-membership-revision-m1-local-acceptance-migration-validation-20260801.md`](../operations/base02-membership-revision-m1-local-acceptance-migration-validation-20260801.md) | `current evidence` | 记录全新恢复点、全新 Lease 下的第二次授权执行，环境 journal 41、M1 `all_exact`、数据不变量与零业务 DML |
| [`../operations/base02-membership-revision-m1-local-acceptance-migration-independent-review-20260801.md`](../operations/base02-membership-revision-m1-local-acceptance-migration-independent-review-20260801.md) | `current evidence` | 独立核验完整尝试历史、Catalog、数据不变量、恢复点／Lease 终态和 M1 handoff 准入；不授权 M2 前置越界 |
| [`../operations/base02-membership-revision-m2-implementation-independent-review-20260802.md`](../operations/base02-membership-revision-m2-implementation-independent-review-20260802.md) | `current evidence` | 独立核验 M2 Access Control 唯一 Membership Owner Writer、`expectedRevision` CAS、transaction-bound UoW、current／Binding／transition evidence 同事务原子性、重放 fail-closed 与合成／事务测试；只准入 M2 handoff，不表示 M3、数据库、Reader 或 BASE-B1 已启动 |
| [`../operations/base02-membership-revision-m3-implementation-independent-review-20260802.md`](../operations/base02-membership-revision-m3-implementation-independent-review-20260802.md) | `current evidence` | 独立核验 M3-A onboarding 单一外层事务委托、M3-B 5 个旧 Writer／Deleter fail-closed、Owner 外 direct mutation `0／0` 与 AQ008 唯一 allowlist `1`；只准入 M3 handoff，不表示 M4、Reader 或 BASE-B1 已启动 |
| [`../operations/base02-membership-revision-m4-local-acceptance-migration-validation-20260802.md`](../operations/base02-membership-revision-m4-local-acceptance-migration-validation-20260802.md) | `current evidence` | 记录 `0041` 第三次且仅一次授权目标执行、三次调用历史、`1／1／0／0／0`、current／baseline 原子终态、恢复点、Lease、清理和执行后无目标 Guard 拒绝低敏事实 |
| [`../operations/base02-membership-revision-m4-local-acceptance-migration-independent-review-20260802.md`](../operations/base02-membership-revision-m4-local-acceptance-migration-independent-review-20260802.md) | `current evidence` | 独立核验 M4 journal／数据 Shape／三次执行历史、F01 零影响、恢复点和 Lease 终态；只准入 M4 handoff，不授权 M5、BASE-B1 或 Reader |

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

PR #830 已完成 Runtime handoff。PR #831 随后完成 Authority／组合根无写准备与低敏证据：合成 Authority 矩阵为 1 个完整匹配允许、22 个负向用例拒绝，生命周期 12 个场景与静态边界 6 项通过，合成 Runner `--dry-run` 五项计数为 `1／1／0／0／0`。该阶段数据库连接／写入、真实 Manifest 读取、真实 Authority／Lease 操作、真实权限变更和 `--execute` 均为 0；临时资产已删除。无写准备完成不表示真实执行前置已实时满足或 A2-P1 已完成。

PR #833 已将数据库级 `PUBLIC TEMPORARY` 权限阻断的方案 A 作为 accepted 执行边界合并。随后仅对固定 localhost-only 本地验收数据库执行一次授权撤销：`PUBLIC TEMPORARY` 由 `true` 变为 `false`，`PUBLIC CONNECT` 保持 `true`，TEMPORARY allowlist 为 `0`，条件化回退未触发。PR #834 已合并低敏证据，PR #835 已完成独立审查并确认其他数据库 ACL、Schema／表／序列／Default Privileges、角色目录／成员关系、Journal、A1 Shape 与固定四表低敏计数均未变化。该结果只关闭本次数据库级权限阻断，不构成专用角色创建、表级权限、Lease 或 A2-P1 执行授权。

旧 Approved Manifest 不再可用后，PR #837 基于当前有效 Candidate v2 完成全新的 Approved Manifest 重新签发并合并低敏证据，PR #838 完成独立只读审查。当前 Candidate 与 Approved Manifest 数量均精确为 `1`；Approved Contract、exact shape、独立 digest、文件隔离、职责分离和临时资产清理均通过。该结果只准入本次 handoff；数据库连接、角色或 ACL、Lease、Runner、dry-run、`--execute` 和 A2-P1 execute 均未发生。

PR #843 已完成 A2-P2 localhost-only 显式只读 Catalog／数据 Shape 预检：`institution_scopes_pk(tenant_id, institution_id)` 是唯一引用目标，`auth_account_institution_bindings_scope_idx` 与 `auth_account_institution_bindings_scope_fk` 均为 `all_missing`，部分对象、同名异定义、等价异名和未知依赖为 `0`。Binding 总行数 `1`、NULL `0`、重复 `0`、历史 orphan `1`；该 orphan 已解释但未修复／未验证，只支持窄范围 `NOT VALID` 创建。PR #844 独立审查通过并确认 handoff 准入为 `true`、Schema／Migration 执行准入为 `false`。PR #845 handoff 进一步澄清该 orphan 不属于 MIG-01B，并把后续实施串行为先完成 metadata P0 校准与 handoff、再单独申请 P1；当时 P1 未启动、未授权。

PR #846 已完成 P0 两文件校准：current journal 由 `_journal.json` 最后一条 tag 动态推导并与实际 SQL 集合核验，snapshot 保持 `0026`，`db:generate` 与 snapshot-diff Migration 禁令未弱化。PR #847 独立审查结论为 `a2_p2_p0_review=passed`，面向 P1 的 handoff 准入为 `true`（仅可申请授权）、Schema／Migration 执行准入为 `false`。P0 实际修改为运维文档 `1`、测试文件 `1`；Runtime、Schema、Migration SQL、journal、snapshot、数据库、CI、package 和 lock 修改均为 `0`。P0 收口不批准或占用 `0039`，也不自动授权 P1。

PR #849 在唯一 Migration Lease 下实时分配并实施 `0039_mig_01a2_anchor_bridge`，只修改 Migration SQL、journal、Schema 和 Schema 测试四个文件；PR #850 独立审查通过。随后固定 localhost-only 本地验收环境通过 guarded `pnpm db:migrate` 完成一次且仅一次受控执行，PR #851 合并低敏执行证据，PR #852 完成执行独立审查。环境 Applied Migration 从 `39` 到 `40`，目标索引和外键均精确存在，外键保持 `NOT VALID`；A2-P1 三表保持 `1／1／1`，Binding 总数／NULL／重复／historical orphan 保持 `1／0／0／1`，业务 DML 为 `0`。A2-P2 已具备 handoff 收口条件，但 historical orphan 清零前不得完成 BASE-02、执行外键 `VALIDATE` 或放行 Reader。

BASE-02 准入方案已由 PR #854 以 Merge Commit `b87fad849770b83276d0572f73c7c507825c3bca` 合并；独立审查已由 PR #855 在重放后以 Merge Commit `8e3b9de6d472be9fc586b14a2eba24e51e928dfb` 合并。只读审计确认 active historical orphan 与 Scope 关系 orphan 均为 `1`，语义 Owner 为 Access Control 的 Binding 生命周期；独立数据修复专项只能作为经授权的执行载体，Tenancy 不得从 Binding 反推创建 Scope。方案冻结 BASE-B1～B6，但没有授权任何 Runtime、数据修复、外键 `VALIDATE`、Writer 或 Reader；PR #856 只负责 handoff 收口。

BASE-B1 随后因 Membership revision 证据不足硬停止。PR #857 证明 `tenant_members.updated_at` 与 Binding version 均不能替代稳定 Membership revision，并冻结 Identity／Access Control／Tenancy／Security Owner 与 Operating Context 排除边界；PR #858 提交三方案决策包，proposed 推荐 A-full；PR #859 独立审查通过。用户随后正式接受 A-full，PR #861 将 `tenant_members` 唯一 canonical current、显式严格单调 revision、`expectedRevision` CAS、完整 lifecycle、tombstone／incarnation／ABA、current provenance、同事务 immutable transition evidence 与 Access Control 唯一 Writer 记录为 accepted，PR #862 独立审查结论为 `membership_revision_acceptance_review=passed`。该接受不决定具体字段、表结构、Migration 编号、SQL 或环境；BASE-B1 Runtime 继续阻断，Schema／Migration 前置预检尚未启动，BASE-B2～B6、orphan 修复、FK `VALIDATE`、Writer 和 Reader 均未启动。

Membership Revision 物理模型已经由 PR #867 绑定接受，PR #868 独立审查通过。M1 Expand 由 PR #869 实施，PR #871 独立审查；首轮受控 Migration 因枚举聚合类型不匹配失败并完整回滚，PR #872／#873 随后完成未消费 `0040` 的精确纠错与独立审查，PR #874／#875 完成第二次授权执行和独立审查。M2 Owner Writer／CAS 已由 PR #877 实施并由 PR #878 独立审查通过。M3-A 由 PR #880 将正式 onboarding 委托给 Access Control transaction-bound Owner command；M3-B 由 PR #881 封堵 5 个旧 Writer／Deleter并建立 AQ008，Owner 外 direct mutation 为 `0／0`，唯一 allowlist 为 `1`；PR #882 独立审查通过。

M4 `0041` 经 PR #884～#889 完成实施、独立审查和两轮精确纠错。第三次且仅一次目标执行在最新 main、全新恢复点和全新唯一不可续期 Lease 下成功，目标 guarded 调用累计为 `3`、自动重试为 `0`；PR #890 记录低敏执行证据，PR #891 独立审查通过。仓库／环境 journal 均为 `42／0041`，snapshot 仍为 `0026`；Membership all-null／partial／complete 为 `0／0／1`，baseline transition 为 `1`，planned／created／reused／conflict／unexpected 为 `1／1／0／0／0`。active historical orphan／Scope relation orphan 保持 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`。执行后一次无目标 Guard 启动在首道目标门禁拒绝，数据库连接和数据库变化均为 `0`，F01 已关闭。M4 已具备 handoff 收口条件；M5 尚未启动，本 handoff 合并后按当前 ULTRA 授权和动态硬门继续。

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
- A2-P1 Runtime handoff：PR #830 Base `bbf15be8f5acd66d80db5ac7b6e9250a57d5744e`／Head `1d28b6a91bf3b7076f66478861a3a7cc46fdcb18`／Merge Commit `2ca100af132adf6676c09073f5d527c1b608d3ed`，Run `30570185023`／Job `90964638309` 的全部质量步骤成功；
- A2-P1 Authority／组合根无写证据：PR #831 Base `2ca100af132adf6676c09073f5d527c1b608d3ed`／Head `e427b57cdf810c9021d6beb1738a69f365bd7218`／Merge Commit `2da175330a4e15601c9806f75184df303e8cf2f9`，Run `30571861343`／Job `90970298323` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- A2-P2 只读预检：PR #843 Base `053108d995e5e0b1ac3cdd7d9ff6ae9e904821ec`／Head `0d5cf44273d4ca6a12c857f605c8bd07e4656759`／Merge Commit `683668a584670bb9b9431582cb5eae918d38eee1`，Run `30633506572`／Job `91165285987` 的全部质量步骤成功；
- A2-P2 独立审查：PR #844 Base `683668a584670bb9b9431582cb5eae918d38eee1`／Head `eba90d153e25f00e43651e6ce01fd8f7ef6be156`／Merge Commit `6460516d9a172a9bdaa5681b4b3407a7d212f54c`，Run `30634548162`／Job `91168725451` 的全部质量步骤成功；
- A2-P2 P0 校准：PR #846 Base `71fa600a691b2e8ee47bed34eec2cb8b94ebb2f8`／Head `df15c70436f4cda3085847e1b221202a74a2b299`／Merge Commit `daf07fbd632cb4276fde911e073521483e409baf`，Run `30637892951`／Job `91180059088` 的全部质量步骤成功；
- A2-P2 P0 独立审查：PR #847 Base `daf07fbd632cb4276fde911e073521483e409baf`／Head `b9632ab3a8c4bc1fb83e808f4ec98af2c75cb2e9`／Merge Commit `326260fec24112ffcb2ff3828c8c4398ad43f2b9`，Run `30638717649`／Job `91182885954` 的全部质量步骤成功；
- Membership Revision M2 Owner Writer／CAS：PR #877 Base `809b0e836fd5decea364726ca0ec44fdaa5b3e56`／Head `828ebb69e62267a67dff2d8cc21d7ddafb1d454b`／Merge Commit `e6add6403a7a502192c450615397304a74c4b8e7`，Run `30708477043`／Job `91391614603` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- Membership Revision M2 实现独立审查：PR #878 Base `e6add6403a7a502192c450615397304a74c4b8e7`／Head `ac76fe06ad5700d52e86f7c3622a2db65bbd441c`／Merge Commit `287b1d7cf66550424e304c6cc1354df334bb1e56`，Run `30708982932`／Job `91392949050` 的全部质量步骤成功，结论为 `base02_membership_revision_m2_implementation_review=passed`；
- Membership Revision M3-A onboarding 委托：PR #880 Base `5b8afc3d48932872714afc736f9c4f02f1fec675`／Head `c690789f341434fd7bb33e819151849e6c2a7afa`／Merge Commit `2d34177f0d2eb77ccaba0829ab3224e69911853f`，Run `30711226980`／Job `91398940037` 的全部质量步骤成功；
- Membership Revision M3-B 旧 Writer／Deleter 封堵：PR #881 Base `2d34177f0d2eb77ccaba0829ab3224e69911853f`／Head `b405403d6fea87e1d022d7e027e22d9f8600ae61`／Merge Commit `f8909e098def3810e0e336c9491facf83d4c3a57`，Run `30714150218`／Job `91406737286` 的全部质量步骤成功；
- Membership Revision M3 实现独立审查：PR #882 Base `f8909e098def3810e0e336c9491facf83d4c3a57`／Head `6f0b95b246aa115d63be49758ca66202f09ae589`／Merge Commit `df83b9527e3569c0997f0438a68d086592f3a36b`，Run `30714716713`／Job `91408247113` 的全部质量步骤成功，结论为 `base02_membership_revision_m3_implementation_review=passed`；
- Membership Revision M4 执行低敏证据：PR #890 Base `76a162005204efd74e6919541bd8cea9c72a0170`／Head `90ca634ced30c7386d5c0a3c5338fda5df6bd911`／Merge Commit `167e1193e474237e5a612a7df9860adcad8b7e8c`，Run `30725188721`／Job `91435449482` 的全部质量步骤成功；
- Membership Revision M4 执行独立审查：PR #891 Base `167e1193e474237e5a612a7df9860adcad8b7e8c`／Head `38c821ffe247306dc211e450923d0379f49036fe`／Merge Commit `4b79cdf39775fa7827be89a33fa339e8fda90faa`，Run `30725621418`／Job `91436644462` 的全部质量步骤成功，结论为 `base02_membership_revision_m4_execution_review=passed`；
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
- `AQ008`：禁止 Access Control 唯一 Owner Repository 之外的直接 Membership Writer／Deleter；内建 allowlist 精确为 `1`，rules exceptions 保持为空。

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
→ Runtime handoff（已完成，PR #830）
→ Authority／组合根无写准备与验证（已完成）
→ Authority／组合根低敏证据 PR（已完成，PR #831）
→ 独立 Authority／组合根 handoff（已完成，PR #832）
→ PUBLIC TEMPORARY 权限决策（已完成，PR #833）
→ PUBLIC TEMPORARY ACL 调整低敏证据（已完成，PR #834）
→ PUBLIC TEMPORARY ACL 独立审查（已完成，PR #835）
→ PUBLIC TEMPORARY ACL handoff（已完成）
→ Approved Manifest 重新签发低敏证据（已完成，PR #837）
→ Approved Manifest 重新签发独立审查（已完成，PR #838）
→ Approved Manifest 重新签发 handoff（已完成，PR #839）
→ 专用角色预置、A2-P1 execute 与低敏证据（已完成，PR #840）
→ A2-P1 独立审查（已完成，PR #841）
→ A2-P1 最终 handoff（已完成，PR #842）
→ A2-P2 只读 Catalog／数据 Shape 预检（已完成，PR #843）
→ A2-P2 独立审查（已完成，PR #844）
→ A2-P2 预检 handoff（已完成，PR #845）
→ A2-P2 P0 metadata current 校准（已完成，PR #846）
→ A2-P2 P0 独立审查（已完成，PR #847）
→ A2-P2 P0 handoff（已完成，PR #848）
→ A2-P2 P1 四文件实施（已完成，PR #849）
→ A2-P2 P1 实施独立审查（已完成，PR #850）
→ local_acceptance 单次受控 Migration 与执行证据（已完成，PR #851）
→ A2-P2 P1 执行独立审查（已完成，PR #852）
→ A2-P2 P1 最终 handoff（已完成，PR #853）
→ BASE-02 前置规划／准入方案（已完成，PR #854）
→ BASE-02 独立审查（已完成，PR #855）
→ BASE-02 handoff（已完成，PR #856）
→ Membership Revision 硬停止证据（已完成，PR #857）
→ Membership Revision Architecture Decision Pack（已完成，PR #858）
→ Membership Revision 独立审查（已完成，PR #859）
→ Membership Revision 决策 handoff（已完成，PR #860）
→ Membership Revision A-full Accepted Decision（已完成，PR #861）
→ Membership Revision A-full 接受独立审查（已完成，PR #862）
→ Membership Revision A-full 接受 handoff（已完成，PR #863）
→ BASE-02 Membership Revision Schema／Migration 前置预检与 proposed 物理模型（已完成，PR #864）
→ Membership Revision Schema／Migration 前置预检独立审查（已完成，PR #865）
→ Membership Revision 前置预检 handoff（已完成，PR #866）
→ P01～P12 与 M0～M7 Accepted Decision（已完成，PR #867）
→ 物理模型接受独立审查（已完成，PR #868）
→ M1 Expand 四文件实施（已完成，PR #869；独立质量修复 PR #870 后重放）
→ M1 实施独立审查（已完成，PR #871）
→ `0040` 未消费类型纠错与独立审查（已完成，PR #872／#873）
→ M1 第二次受控 Migration 与低敏证据（已完成，PR #874）
→ M1 执行独立审查（已完成，PR #875）
→ M1 handoff（已完成，PR #876）
→ M2 Access Control Owner Writer／CAS（已完成，PR #877）
→ M2 实现独立审查（已完成，PR #878）
→ M2 handoff（已完成，PR #879）
→ M3-A onboarding Owner 委托（已完成，PR #880）
→ M3-B 旧 Writer／Deleter 封堵与 AQ008（已完成，PR #881）
→ M3 实现独立审查（已完成，PR #882）
→ M3 handoff（已完成，PR #883）
→ M4 deterministic legacy calibration 实施与审查（已完成，PR #884／#885）
→ M4 Guard CLI 纠错与审查（已完成，PR #886／#887）
→ M4 `0041` record／relation alias 纠错与审查（已完成，PR #888／#889）
→ M4 第三次且仅一次受控执行与低敏证据（已完成，PR #890）
→ M4 执行独立审查（已完成，PR #891）
→ M4 handoff（本次收口）
→ M5 高水位追赶与冲突清零（唯一下一任务；尚未启动，handoff 合并后按当前 ULTRA 授权继续）
→ M6 Reader 切换
→ M7 Enforce
→ BASE-B1 Runtime 重新准入与关闭
→ BASE-B2～B6 独立实施与关闭
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

`V2-MIG01-A2-PROVISIONING-PREFLIGHT-01` 已通过 PR #797 完成并合并，PR #799 已将 proposed decision pack 合并到 `main`，PR #801 已记录 accepted 选择，PR #804／#805 已完成治理 Stage A 仓库硬门与交接，PR #807／#808 已完成治理 Stage B Runner 基础与交接，PR #809～#823 已完成本地只读预检、就绪修复、Candidate／Source Governance、人工审核与 Approved Manifest，PR #825～#839 已完成 Stage D、A2-P1 执行准备、权限边界与 Approved Manifest 重新签发，PR #840～#853 已完成 A2-P1 与 A2-P2 全链。PR #854～#868 已完成 BASE-02 前置方案、Membership Revision A-full 接受、物理模型预检与 P01～P12／M0～M7 绑定接受；PR #869～#876 已完成 M1，PR #877～#879 已完成 M2，PR #880～#883 已完成 M3。PR #884～#891 已完成 M4 实施、独立审查、两轮精确纠错、第三次且仅一次受控执行、低敏证据和执行独立审查。本 handoff 收口 M4，唯一下一任务冻结为 `BASE-02 Membership Revision M5 高水位追赶与冲突清零`；M5 尚未启动，handoff 合并后按当前 ULTRA 授权和动态硬门继续。

治理 Stage A 与治理 Stage B 已通过独立变更域和独立 PR 完成。A2-P1、A2-P2、BASE-02 前置方案、Membership Revision A-full 与 P01～P12／M0～M7 accepted 边界均已完成证据链。M1 Expand、M2 Owner Writer／CAS、M3 onboarding 委托与旧 Writer／Deleter 封堵均已收口。M4 `0041` 已在固定本地验收环境形成唯一 revision `1` current 与 baseline transition；目标调用累计 `3`、自动重试 `0`，F01 无目标 Guard 拒绝已关闭。BASE-B1 Runtime、M5～M7、orphan 数据修复、FK `VALIDATE` 与 Reader 仍未启动。

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

本地就绪修复 Stage A、Stage B、Candidate／Source Governance、Approved Manifest、Stage D、A2-P1 全链和 A2-P2 P0／P1 均已完成。索引和 `NOT VALID` FK 已精确进入仓库与固定本地验收环境；active historical orphan 与 Scope 关系 orphan 仍均为 `1／1`。BASE-02 前置方案、Membership Revision A-full accepted decision、P01～P12 物理模型、M1 Expand、M2 Owner Writer／CAS、M3 Writer 收口与 M4 deterministic legacy calibration 均已完成；环境 journal 为 `42／0041`，M1 Catalog 保持 `all_exact`，Membership complete current／baseline transition 为 `1／1`。唯一下一任务为 `BASE-02 Membership Revision M5 高水位追赶与冲突清零`；M5 尚未启动，handoff 合并后按当前 ULTRA 授权和动态硬门继续。M6～M7、BASE-B1～B6、orphan 修复、A2-P2 FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 和业务 Reader 均未启动或继续阻断。该顺序不改变 MIG-01～MIG-06 的相对顺序。

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

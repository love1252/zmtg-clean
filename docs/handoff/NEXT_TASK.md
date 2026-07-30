# 智美天工唯一下一任务

## 当前交接状态

MIG-01A2 的 accepted 决策、仓库硬门、受控 Runner 治理基础、本地环境只读预检、本地就绪修复 Stage A／B、Candidate Governance／Stage C-0 和 Source／Candidate v2 Governance 已分别通过独立 PR 完成：

- Stage C-0 handoff：PR #817，Head `7ea19efccc5dd17a5e30c7c35571465d0d986f3f`，Merge Commit `c1be2e45389a74f653717a2a47a81a5559f3c35b`；
- PR #817 Required Check：Run `30526410379`／Job `90818243458`，结论为成功；
- Source／Candidate v2 Governance：PR #818，Base `c1be2e45389a74f653717a2a47a81a5559f3c35b`，Head `29ee87fa7f7b3ab3749e4adedaf89457471d21ef`，Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350`；
- PR #818 Required Check：Run `30529676907`／Job `90828769200`，环境核对、安装依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- PR #818 精确新增 3 个 v2 合约模块、3 个 v2 测试文件和 1 份治理文档，并更新 1 份空白审批模板；
- v2 定向契约测试 3 文件／225 个场景、完整测试 420 文件／6121 个测试和 build 101／101 均通过；
- 当前 `main` 保护与“最小架构与质量门禁”Required Check 继续生效。

Candidate v1 与 Source v1 继续是不可变的 test-only 合约。Source／Candidate v2 Governance 只建立用户授权来源的版本化契约，没有生成 Source／Candidate 实例，没有创建 Approved Manifest，没有运行 Runner dry-run，没有签发 Lease，也没有启动 A2-P1／P2。`real_manifest_missing` 与 `real_environment_dry_run_unavailable` 继续阻断。

## 唯一下一任务

```text
V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-C
使用 Source v2 生成本地验收 Candidate 并提交低敏审批包
```

当前 Ultra 任务已经明确授权：本 handoff 合并后，必须在新的独立分支上串行执行 Stage C。该授权只覆盖本文冻结的只读来源核验、Source／Candidate v2 生成、私有资产保管、`review_pending` 转换、低敏审批包、单提交、草稿 PR 和真实 Required Check；不扩大到 Approved Manifest、Runner、dry-run、Lease、数据库写入、Stage D 或 A2-P1／P2。

## 一、事实源与既有边界

1. 最新 `main` 的代码、测试、Schema、Migration、配置和已合并记录决定仓库 `current` 事实。
2. 经任务授权取得的 localhost-only 本地验收环境证据，只决定该指定环境的 `current` 事实。
3. `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`。
4. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 记录 D01～D12 的 accepted 选择。
5. 架构视图、证据报告、索引和 handoff 只负责解释、核验与记录状态，不得独立改写事实所有权、Migration 顺序或发布门禁。

以下边界不得在 Stage C 中重开：

- Tenancy 是 Scope、Context Version／Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的唯一语义 Owner；
- Access Control 只通过版本化 Port／Reader 和低敏投影单向消费，不建立第二套事实源；
- Approved Manifest 继续使用 `mig01-a2/v1`、`c14n-v1` 与独立 SHA-256 digest，本任务不得修改或创建它；
- Candidate digest 不得复用为 Approved Manifest digest；
- Context 字段必须显式提供，禁止从数据库现状、系统时区、执行时钟、Demo、Seed 或模型偏好补全；
- `main` 保护与 Required Check 继续是后续 P1／P2 的硬门；
- Metadata 继续禁止 `db:generate` 和 snapshot-diff Migration。

## 二、v1 与 v2 合约边界

### 2.1 v1 保持不可变

- Candidate version：`mig01-a2-candidate/v1`；
- Source version：`mig01-a2-candidate-source/v1`；
- Source type：`local_acceptance_fixture`；
- 性质：test-only，不得作为 Stage C 真实来源；
- v1 实现、测试、治理文档与固定向量均不得修改。

### 2.2 Stage C 只能使用 v2

- Candidate version：`mig01-a2-candidate/v2`；
- Candidate canonicalization：`candidate-canonicalization-v2`；
- Source version：`mig01-a2-candidate-source/v2`；
- Source type：`local_acceptance_user_authorized_input`；
- Source canonicalization：`candidate-source-canonicalization-v1`；
- Source authorization、Candidate review、Approved Manifest 是三个独立门；
- “真实 Source”只表示其低敏来源由用户明确授权，不表示 Candidate 已经人工审核，更不表示 Approved Manifest 已创建。

## 三、授权来源与只读核验

Stage C 只有两组用户已授权的固定 tenant／institution 配对。出于低敏边界，本文不记录双 reference 原值；执行时必须使用当前 Ultra 任务中已经冻结的首选和备用值。

核验顺序固定为：

1. 只调用 Stage B 只读 Adapter 的 `tenantExists`；
2. 先核验首选 tenant；
3. 首选存在时立即停止来源核验并使用其对应的固定 institution；
4. 只有首选不存在时才核验备用 tenant；
5. 备用存在时使用其对应的固定 institution；
6. 不得枚举、查询、输出或选择任何其他 tenant；
7. institution 必须使用任务授权的对应固定值，不得从数据库推断。

两组授权 tenant 均不存在时：

- Candidate 数量必须为 0；
- 不创建 Source／Candidate／Review 私有正文；
- 使用固定阻断码 `authorized_candidate_tenant_missing`；
- 只创建低敏 blocked 审批 Markdown、单提交和开放（Open）＋草稿（Draft）PR；
- Required Check 完成后立即停止，不得 Ready、Merge 或启动任何后续任务。

## 四、固定 Context 与角色边界

每个 Source entry 的用户授权值固定为：

- `scopeStatusCandidate=active`；
- `contextCandidate=product_default`；
- `timezone=Asia/Shanghai`；
- `currency=CNY`；
- `effectiveFromBusinessDate=2026-07-30`；
- `effectiveAt=2026-07-29T16:00:00.000Z`。

这些值不得由数据库、系统时钟、环境变量、Demo、Seed 或模型偏好替换。

- Source Authority、Candidate Generator 与 Human Reviewer 已由当前任务冻结为低敏 opaque reference，本文不记录原值；
- Generator 与 Reviewer 必须不同；
- Source authorization time 已在当前 Ultra 任务启动时按真实 UTC 毫秒时间冻结；
- Candidate `generatedAt` 必须使用实际生成时的真实 UTC 毫秒时间；
- Candidate 保留期为生成后 7 个自然日；
- 用户拒绝，或 Source、Base、Policy、Candidate 内容、私有文件权限／身份、digest、Reviewer 发生变化时，Candidate 提前失效；
- 到期后不得自动删除，删除或延期需要后续明确任务。

## 五、受控私有资产

- Source、Candidate、Review State 与低敏 approval summary 只能写入仓库外受控私有目录；
- 私有根目录和本次独立子目录权限必须为 `0700`；
- 四个私有 JSON 文件权限必须为 `0600`；
- 独立子目录名不得包含 tenant 或 institution reference；
- 私有正文、双 reference、digest、角色引用、连接信息和实际路径不得进入 Git、PR、Issue、日志、argv、环境变量、测试 fixture、handoff、聊天或最终报告；
- 私有目录最终只能包含 `authorized-source.json`、`candidate.json`、`review-state.json` 和 `approval-summary.json`；
- 任何临时 helper 必须位于该子目录之外，权限为 `0600`，使用后删除。

## 六、成功生成链

成功路径严格为：

```text
Source v2
→ parse
→ Source digest 校验
→ Candidate v2
→ Candidate digest 校验
→ generated Review State
→ review_pending
```

必须确认：

- Candidate 数量为 1；
- Source 与 Candidate exact shape 通过；
- Source digest 与 Candidate digest 校验通过；
- Context Policy 通过；
- duplicate 与 sensitive 字段拒绝仍生效；
- Generator 与 Reviewer 分离；
- Source／Candidate 正文没有进入普通输出；
- Candidate 只到 `review_pending`，不存在 Candidate `approved` 状态；
- 没有创建 Approved Manifest。

## 七、仓库交付范围

Stage C 在仓库内只允许新增：

`docs/operations/mig01-a2-local-manifest-candidate-approval-pack-20260730.md`

该 Markdown 只允许记录：

- 冻结 Base；
- Candidate 数量；
- Candidate／Source／Policy version；
- Source type；
- Source authorization 已确认、tenant 父记录存在、exact shape、Source／Candidate digest、Context Policy 的布尔验证结果；
- `reviewStatus=review_pending`；
- `generatedAt` 与 `expiresAt`；
- Candidate 正文位于仓库外受控私有目录，但不得记录路径；
- 需要用户人工审核；
- `real_manifest_missing` 仍未关闭；
- Stage D 仍不可启动。

不得记录 Source／Candidate 正文、双 reference、digest 原值、角色引用原值、私有路径、连接信息、原始数据库行、PII 或 Approved Manifest 内容。

## 八、启动硬门与验证

Stage C 开始前必须重新确认：

- `main=origin/main`，工作树干净，且本 handoff 已通过 Merge Commit 合并；
- `main` 保护和 Required Check 继续启用；
- 本地验收容器身份与 localhost-only 端口未漂移；
- Journal 为 39，`tenants` 低敏计数为 2，三个 A1 表计数均为 0；
- 两个 Stage A 恢复点继续存在且 hash 通过；
- Stage B Context Policy、只读 Adapter、v1 不可变集合和 v2 合约未漂移；
- 私有目录不存在并发写入；
- 只使用当前任务授权的首选／备用来源与固定字段。

生成后必须执行 Candidate v1、Candidate v2 与 Approved Manifest Contract 定向测试，并执行：

```text
pnpm lint
pnpm typecheck
TZ=Asia/Shanghai pnpm test
TZ=Asia/Shanghai pnpm build
git diff --check
pnpm check:architecture -- --base <SOURCE_V2_HANDOFF_MAIN> --head HEAD
```

验证必须确认仓库只新增一个 Markdown；Runtime、Schema、Migration、journal、snapshot、Runner、Adapter、Policy、CI、package、lock 修改均为 0；数据库写入、Runner、dry-run、Lease 和 Approved Manifest 均为 0。

## 九、PR 状态与停止边界

- 提交信息固定为：`docs(operations): 提交 MIG-01A2 本地 Candidate 审批包`；
- 创建开放（Open）＋草稿（Draft）PR；
- PR 描述只记录低敏摘要；
- 等待真实“最小架构与质量门禁”完整执行并通过；
- 即使检查全部通过，PR 仍必须保持开放（Open）＋草稿（Draft）；
- 不得 Ready、Merge、创建 handoff、关闭 `real_manifest_missing` 或启动 Approved Manifest／Stage D。

Stage C 严格禁止：

- 创建、修改或批准 `mig01-a2/v1` Approved Manifest；
- 运行 Runner、synthetic／真实 dry-run 或 `--execute`；
- 签发、读取、验证或消费执行 Lease／Migration Lease；
- 运行 `db:generate`、Migration、Seed、Reset、Restore、DDL、DML 或 Provisioning；
- 连接非 localhost 数据库、测试服务器、生产数据库或业务外部环境；
- 读取 `.env.local`、非本地 `DATABASE_URL`、Secret、Token、PII 或真实业务数据；
- 修改 Schema、Migration、journal、snapshot、Context Policy、Adapter、Runner、CI、package、lock、业务 API／UI；
- 启动 Stage D、A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务。

## 十、项目级顺序

```text
Stage A：本地验收数据库安全恢复点与 A1 基线（已完成）
→ Stage B：只读 Repository Adapter 与 Context Policy（已完成）
→ Candidate Governance／Stage C-0（已完成）
→ Source／Candidate v2 Governance（已完成，PR #818）
→ Source v2 handoff（本任务）
→ Stage C：使用 Source v2 生成本地验收 Candidate 并提交低敏审批包（当前 Ultra 任务已授权，尚未执行）
→ 独立 handoff
→ Approved Manifest 创建／校验的独立授权任务
→ 独立 handoff
→ Stage D：真实本地 Runner dry-run
→ 独立 handoff
→ A2-P1
→ 独立 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

该顺序不改变 MIG-01～MIG-06 的相对顺序。Stage C 只交付待用户人工审核的 Candidate，不会自动接受、批准、转换或执行任何资产。

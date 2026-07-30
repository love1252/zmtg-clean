# 下一任务

## 当前交接状态

`V2-MIG01-A2-GOVERNANCE-FOUNDATION-01-STAGE-A` 已通过 PR #804 完成并合并：

- Stage A Base：`56638dc3595d7bd60a47b08810c50df256d0b87c`
- PR Head：`1948597d5349017485578723fd32535e84e2bd97`
- Merge Commit：`97a21fa6ba8517a9d5dd5ab28e90670b371e52cb`
- 验证文档：`docs/verification/github-main-hard-gate-validation-20260730.md`
- Required Check Context：`最小架构与质量门禁`
- Required Check App：ID `15368`／slug `github-actions`
- Branch Protection：`main.protected=true`、`strict=true`、`enforce_admins=true`、required approvals `0`
- 服务端拒绝：普通 direct push、显式 force-with-lease 和删除受保护分支均被 GitHub 拒绝
- Negative Run／Job：`30481398548`／`90676107324`
- Final Positive Run／Job：`30482219056`／`90678924630`
- Final Positive Head：`1948597d5349017485578723fd32535e84e2bd97`
- Runtime、Schema、Migration、CI、package、lock 修改均为 `0`

Stage A 已完成，不再是阻断。仓库硬门通过独立无害 PR 验证，不代表 Stage B、真实 Manifest、环境、数据库、Lease、A2-P1 或 A2-P2 已经启动。

## 唯一下一任务

```text
V2-MIG01-A2-GOVERNANCE-FOUNDATION-01-STAGE-B
MIG-01A2 受控 Runner 治理、Runbook 与实现
```

Stage B 必须在最新 `main` 上使用独立分支、精确文件 allowlist、单主题提交和独立 PR。本 handoff 不夹带 Stage B 实现。

## 一、事实源与 accepted 边界

Stage B 必须以启动时最新 `main` 为 `current` 事实：

1. 当前代码、测试、Schema、Migration、配置和已合并记录决定仓库事实；
2. `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`；
3. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 在既有 `target` 内记录 D01～D12 的用户选择；
4. proposed decision pack、架构视图、模块映射、索引和 handoff 只负责解释、展开、核验与记录状态。

以下 accepted 结果不得在 Stage B 中静默重开：

- D01-A：Tenancy 是 Scope、Context Version／Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的唯一语义 Owner；
- D02-A：Access Control 通过版本化 Port／Reader 和低敏投影单向消费；
- D03-A：Manifest 采用严格版本化、审批状态和低敏白名单；
- D04-A：固定位置 JSON 数组 canonicalization + SHA-256；
- D05-A：Context 字段必须显式，禁止隐式默认；
- D06-B／D07-B／D11-B：仓库外真实 Manifest、唯一一次性受控 Runner 和 Runner 文件集绑定；
- D08-C：Metadata 分阶段治理，继续禁止 `db:generate` 和 snapshot-diff Migration；
- D09-A：任务级排他执行／Migration Lease；
- D10-B：`main` 保护和 Required Check 是 P1／P2 启动硬门，Stage A 已完成；
- D12-A：只接受最小 Anchor Bridge 方向，精确实施细节后置。

如需要改变上述 accepted 选择、`architecture-v2.md` 或既有 ADR，必须停止并创建独立决策／ADR 任务。

## 二、Stage A 已完成证据

### 2.1 GitHub 服务端硬门

- `main` 只能通过 PR 更新；
- Required Check 唯一绑定 `最小架构与质量门禁`，App ID 为 `15368`；
- `strict=true`，分支必须基于最新 `main`；
- `enforce_admins=true`，管理员不得绕过；
- required approvals 为 `0`，不强制外部 Reviewer；
- 禁止 force push 和删除 `main`；
- 未启用 Linear History；
- Stage A 未修改 Workflow、CI 或仓库合并方法设置。

### 2.2 探针与 PR 验证

- 普通 direct push、显式 force-with-lease 和受保护分支删除均被服务端拒绝；
- PR #804 在 Required Check pending 时为阻断；
- Negative Head `4f65ce0170817d8928abe1e41319fbf22a8251eb` 因 `AQ001_SECOND_DATABASE_ROOT` 失败并保持阻断；
- 负向文件和提交已从最终 PR 历史移除；
- Final Positive Head 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- PR #804 通过正常 Merge Commit 合并，未使用 `--admin`、Auto-merge、squash 或 rebase；
- 临时探针和验证分支均已清理，全部 `backup/*` 保留。

Stage B 不得修改 Stage A 的保护规则、Required Check、Workflow 或仓库设置。

## 三、Stage B 精确范围

### 3.1 启动前静态复核

修改任何文件前必须复核：

- accepted decisions；
- proposed decision pack；
- A2 provisioning preflight；
- Stage A 验证文档；
- `src/server/db/schema.ts`；
- `scripts/db/**`；
- `docs/operations/**`；
- `package.json`；
- 当前测试结构和 TypeScript／Node 模块规范。

必须先冻结不超过 12 个文件的最终 allowlist。候选范围只限：

- `src/modules/tenancy/provisioning/**`
- `scripts/db/mig01-a2-provisioning-runner.mjs`
- `scripts/db/mig01-a2-provisioning-runner.test.mjs`
- `docs/operations/mig01-a2-provisioning-runbook.md`
- `package.json`

若仓库规范证明候选路径不能成立，只能采用满足以下条件的等价精确路径：

- Tenancy 仍是业务 Owner；
- `scripts/db` 只是一致性 CLI 入口；
- 共享数据库和 Runner 不成为第二套事实 Owner；
- 不修改业务 API／UI；
- 总文件数不超过 12。

### 3.2 Manifest 契约与输入安全

必须实现：

- 显式 `version`；
- 只接受 `approved`；
- approver 与 operator 不同；
- exact shape、未知字段拒绝、整批 fail-closed；
- 固定低敏字段白名单；
- 拒绝 PII、Secret、Token、连接串和自由文本；
- `tenantId + institutionId` 重复封堵；
- 真实 Manifest 不进入 Git、PR 描述、argv、环境变量、日志或测试 fixture；
- CLI 只从普通、非符号链接、权限合规、大小受限的 UTF-8 JSON 文件读取；
- 测试只使用合成低敏数据。

候选低敏字段为：

```text
tenantId
institutionId
scopeStatus
scopeRevision
scopeSource
contextVersion
contextHeadRevision
latestVersion
contextSource
timezone
currency
effectiveFromBusinessDate
effectiveAt
manifestVersion
digest
approvedByReference
approvedAt
```

精确名称可按当前 Schema 调整，但必须形成固定白名单并由测试锁定。

### 3.3 Canonicalization 与 Digest

必须：

- 按 `tenantId`、`institutionId` 稳定排序；
- 使用固定位置 JSON 数组；
- nullable 字段显式为 `null`；
- 字符串必须已是 NFC，非 NFC 或非法 Unicode直接拒绝；
- 日期、时间、数字和枚举格式固定；
- 使用 UTF-8 和 SHA-256；
- 外部 digest 格式为 `sha256:<64 lowercase hex>`；
- 内部 digest 为 `64 lowercase hex`；
- 提供固定 canonicalization 和 digest 测试向量。

### 3.4 Dry-run、执行内核与事务 Port

Dry-run 只输出低敏计数：

- `input`
- `insertedCandidate`
- `reusedCandidate`
- `conflict`
- `unexpected`

必须满足：

```text
input = insertedCandidate + reusedCandidate + conflict + unexpected
```

执行内核使用可测试的 Repository／Transaction Port，覆盖全缺、全一致、部分存在、字段冲突、revision 冲突、digest 冲突、事务失败、回滚、幂等重放和计数守恒。

本阶段不连接真实数据库、不实现真实数据库 Adapter、不执行真实写入。CLI 默认只能 dry-run；execute 模式必须在缺少有效执行 Lease 时 fail-closed。

### 3.5 Lease 契约

仅实现低敏 Lease 类型和校验：

```text
taskId
branch
frozenBase
journal
holder
operator
targetEnvironment
scope
startsAt
expiresAt
renewal
invalidation
release
```

本阶段不签发真实 Lease，测试只使用合成 Lease。任何 execute 路径都不得将测试 Lease 解释为真实执行授权。

### 3.6 Runbook

`docs/operations/mig01-a2-provisioning-runbook.md` 至少记录：

- Operator／Reviewer 分离；
- Manifest 文件权限、注入和安全删除；
- dry-run 与执行前置条件；
- Lease、计数核验和事务；
- 日志脱敏；
- 权限授予与撤销；
- 保留期；
- 失败停止和 forward-fix；
- Stage B 不执行 P1。

只有 package 命令确有稳定价值时才允许新增一个命令；不得新增依赖或修改 `pnpm-lock.yaml`。

## 四、验证与交付

至少验证：

- Parser 正负、exact-shape、白名单、版本和 approved 状态；
- approver／operator 分离；
- Unicode／NFC、日期、时间、货币和时区；
- canonicalization 与 digest 固定向量；
- 重复双键；
- dry-run 分类与计数守恒；
- 全缺、全一致、部分存在、字段／revision／digest 冲突；
- 事务失败与回滚；
- Lease 缺失、过期、错分支和错 Base；
- argv／环境变量／日志不泄漏 Manifest 正文。

随后执行：

```bash
pnpm lint
pnpm typecheck
TZ=Asia/Shanghai pnpm test
TZ=Asia/Shanghai pnpm build
git diff --check
pnpm check:architecture -- --base "$STAGE_A_HANDOFF_MAIN" --head HEAD
```

Stage B 使用独立 Draft PR，等待真实 Required Check 全部通过后方可转 Ready 和使用 Merge Commit 合并。

## 五、严格禁止与停止条件

Stage B 不得：

- 读取真实 Manifest、`.env.local`、`DATABASE_URL`、Token、Secret、PII 或环境变量值；
- 连接数据库、服务器、生产环境或业务外部系统；
- 修改 `src/server/db/schema.ts`、`drizzle/**`、journal、snapshot 或任何 Migration；
- 修改业务 API／UI、CI、Workflow、Branch Protection、Required Check 或仓库设置；
- 运行 `db:generate`、Migration、Seed、部署或数据库命令；
- 签发真实执行 Lease／Migration Lease；
- 分配或占用 `0039`；
- 执行 A2-P1、创建 A2-P2 Migration；
- 启动 BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务；
- 创建第二套 `database/**` 或 `src/database/**`；
- 将推荐、测试通过或 dry-run 写成真实环境已经批准或执行。

出现 accepted 决策漂移、需要扩大到禁止范围、发现真实敏感信息、并发写入或无法安全恢复 Git 状态时必须停止。

## 六、项目级顺序

```text
V2-MIG01-A2-GOVERNANCE-FOUNDATION-01-STAGE-B
→ 独立 handoff
→ V2-MIG01-A2-ENVIRONMENT-MANIFEST-READONLY-PREFLIGHT-01
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

该顺序不改变 MIG-01～MIG-06 的相对顺序。Stage B 完成不自动授权真实 Manifest／环境／数据库 Shape 预检；只读预检完成也不自动授权 P1。

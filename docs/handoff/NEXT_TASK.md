# 下一任务

## 当前交接状态

Stage A 与 Stage B 已通过独立 PR 完成并合并：

- Stage A 设置／验证 PR：#804
- Stage A PR Head：`1948597d5349017485578723fd32535e84e2bd97`
- Stage A Merge Commit：`97a21fa6ba8517a9d5dd5ab28e90670b371e52cb`
- 验证文档：`docs/verification/github-main-hard-gate-validation-20260730.md`
- Stage A handoff PR：#805
- Stage A handoff Head：`5d5c4e746f9de079088f62bb8585c1856e9f0a44`
- Stage A handoff Merge Commit：`c52fef48e71f760017c8e39909b610ae6de180d8`
- Stage A handoff 初始 Run `30504427490`／Job `90750966473` 因既有异步测试竞态失败，四份 handoff 文档不是失败原因
- 独立竞态修复 PR：#806，Head `6f2dac34e4a74ee9e62c67444c0afc88d3185971`，Merge Commit `08acc2f0b5f6a10df5e7adde457c050c10bd79dd`
- Stage A handoff 重放后的 Run `30505641202`／Job `90754678015` 成功，四份文档内容未改变
- Stage B Runner PR：#807
- Stage B PR Head：`d7abdc52c64be367b988db15bfbdaa251be33fd4`
- Stage B Merge Commit：`e50999ebc33dd07a4447fa8f9274e974e9beae63`
- Stage B Actions：Run `30508177604`／Job `90762357307`，全部质量步骤成功
- Required Check Context：`最小架构与质量门禁`
- Required Check App：ID `15368`／slug `github-actions`
- Branch Protection：`main.protected=true`、`strict=true`、`enforce_admins=true`、required approvals `0`
- 服务端拒绝：普通 direct push、显式 force-with-lease 和删除受保护分支均被 GitHub 拒绝
- Stage A Negative Run／Job：`30481398548`／`90676107324`
- Stage A Final Positive Run／Job：`30482219056`／`90678924630`
- Stage B Schema、Migration、journal、snapshot 修改均为 `0`
- Stage B 未读取真实 Manifest、未连接数据库、未签发真实 Lease、未执行 P1

Stage A 与 Stage B 均已完成，不再是阻断。Stage B 只建立受控 Runner 的治理基础、Port、合成测试与 Runbook，不代表真实 Manifest、环境、数据库、Lease、A2-P1 或 A2-P2 已经核验、授权或执行。

## 唯一下一任务

```text
V2-MIG01-A2-ENVIRONMENT-MANIFEST-READONLY-PREFLIGHT-01
真实 Manifest、环境 Journal、数据库 Shape、备份恢复点与 Dry-run 只读预检
```

本任务尚未启动，仍需用户对真实目标、允许读取的字段、读取方式、脱敏输出和环境边界进行独立明确授权。本 handoff 不读取真实 Manifest、不连接数据库，也不执行 dry-run。

## 一、事实源与 accepted 边界

只读预检必须以启动时最新 `main` 和经独立授权取得的只读环境证据为 `current` 事实：

1. 当前代码、测试、Schema、Migration、配置和已合并记录决定仓库事实；
2. `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`；
3. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 在既有 `target` 内记录 D01～D12 的用户选择；
4. proposed decision pack、架构视图、模块映射、索引和 handoff 只负责解释、展开、核验与记录状态。

以下 accepted 结果不得在只读预检中静默重开：

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

如需要改变上述 accepted 选择、`architecture-v2.md` 或既有 ADR，必须停止并创建独立决策／ADR 任务。Stage B 已实现的契约是预检输入，不是读取真实环境、签发 Lease 或执行 P1 的授权。

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

后续只读预检不得修改 Stage A 的保护规则、Required Check、Workflow 或仓库设置。

## 三、Stage B 已完成证据

### 3.1 精确文件范围

PR #807 以 1 个提交修改 12 个文件：

- `docs/operations/mig01-a2-provisioning-runbook.md`
- `package.json`
- `scripts/db/mig01-a2-provisioning-runner.mjs`
- `scripts/db/mig01-a2-provisioning-runner.test.mjs`
- `src/modules/tenancy/provisioning/provisioning-canonicalization.ts`
- `src/modules/tenancy/provisioning/provisioning-kernel.ts`
- `src/modules/tenancy/provisioning/provisioning-lease.ts`
- `src/modules/tenancy/provisioning/provisioning-manifest.ts`
- `src/modules/tenancy/provisioning/provisioning-ports.ts`
- `src/modules/tenancy/provisioning/tests/ProvisioningKernel.test.ts`
- `src/modules/tenancy/provisioning/tests/ProvisioningLeaseContract.test.ts`
- `src/modules/tenancy/provisioning/tests/ProvisioningManifestContract.test.ts`

`pnpm-lock.yaml` 未修改，新增依赖为 0；Schema、Migration、journal 和 snapshot 修改均为 0。

### 3.2 契约与执行边界

- Manifest 版本为 `mig01-a2/v1`，只接受 `approved`、exact shape、固定低敏白名单和不重复的 `tenantId + institutionId`；
- canonicalization 版本为 `c14n-v1`，采用固定位置 JSON 数组、UTF-8 稳定排序、NFC／非法 Unicode 拒绝和 SHA-256；
- 固定 digest 向量为 `sha256:a42fda705e6256a3fd36d74f2d243f27fefcb19dc0ad63c3a00970d42d16de1a`；
- dry-run 只产生 `input`、`insertedCandidate`、`reusedCandidate`、`conflict`、`unexpected` 五项低敏守恒计数；
- Repository／Transaction Port 要求稳定视图、Scope → Version → Head 原子顺序、受影响行数为 1、提交前全批重检和失败回滚；
- Lease 版本为 `mig01-a2-execution-lease/v1`，绑定任务、分支、Base、journal、环境、持有者、执行者和 Manifest scope；
- 直接 CLI 在缺少批准 Context Policy 时以 `runner_context_policy_unavailable` fail-closed；即使未来具备 Context Policy，缺少真实 Repository Adapter 时仍以 `runner_repository_adapter_unavailable` fail-closed；
- Stage B 未实现真实数据库 Adapter 或真实 Lease Authority，未读取真实 Manifest，未连接数据库，未对真实环境执行 dry-run 或 execute。

### 3.3 验证

- 定向测试：4 个文件、63 个测试通过；
- lint：通过，仅保留既有 `<img>` 警告；
- typecheck：通过；
- 完整测试：412 个文件、5742 个测试通过；
- build：通过，101/101 页面生成完成；
- `git diff --check` 与增量架构检查：通过；
- Required Check：Run `30508177604`／Job `90762357307`，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部实际执行并成功。

以上验证只证明仓库内治理基础与合成测试通过，不证明真实 Manifest、环境、数据库、备份或授权已经核验。

## 四、只读预检目标

只有在用户对精确目标和读取边界重新授权后，下一任务才可以只读核验：

1. 真实 Manifest 的版本、审批状态、批准引用、字段白名单、双键集合、canonicalization 输入与 digest 是否符合 `mig01-a2/v1`；
2. Manifest 文件来源、审批链、权限、所有者、保留期和销毁要求是否满足 Runbook，且正文不会进入 Git、PR、argv、环境变量或日志；
3. 目标环境实际 journal 是否到达 `0038_mig_01a1_institution_isolation_expand`，并记录与仓库 `_journal.json`／snapshot `0026` 的差异；
4. 目标数据库中 tenant 父记录和 Scope／Context Version／Context Head 的只读 Shape、约束、索引与当前行分类；
5. 空缺、全一致、部分存在、字段／revision／digest 冲突、额外行和未知状态的低敏计数；
6. 备份／恢复点是否存在、是否可识别、恢复责任人与停止条件是否明确；
7. Operator／Reviewer、目标环境、受信时钟、只读身份、审计位置和最小权限是否可冻结；
8. 在不提交事务的前提下，是否具备对真实目标执行 dry-run 的安全输入、只读 Adapter 与可审计输出条件。

环境 journal、数据库 Shape、备份／恢复点和 dry-run 结果在实际只读核验前一律为“待确认”，不得从仓库代码、测试或 Stage B 契约推断为已具备。

## 五、独立授权与交付边界

下一任务启动前必须由用户明确冻结：

- 精确环境和数据库标识；
- 允许读取的 Manifest 路径与字段；
- 只读数据库身份和允许查询的表／列；
- 是否允许使用 Stage B CLI 或只读 Adapter，以及精确命令；
- 允许输出的低敏计数、证据路径和脱敏规则；
- 备份／恢复点的只读核验方式；
- 工作分支、Base、唯一报告文件和 PR 范围。

未取得上述授权时不得读取真实 Manifest、环境变量、凭证或数据库。预检交付只能是低敏只读证据和阻断结论；仓库写入范围必须在下一任务中冻结为单一报告文件，不得夹带 Adapter、Runtime、Schema、Migration、脚本、测试或配置。

## 六、严格禁止

只读预检不得：

- 提交数据库事务、执行写入、锁定业务表或改变任何环境状态；
- 使用 `--execute`，签发或伪造执行 Lease／Migration Lease；
- 执行 A2-P1、创建 A2-P2 Migration、分配或占用 `0039`；
- 运行 `db:generate`、Migration、Seed、部署、恢复或破坏性命令；
- 修改 Schema、Migration、journal、snapshot、Runtime、Adapter、脚本、测试、CI、package、lock 或仓库设置；
- 把真实 Manifest 正文、双键、PII、Secret、Token、连接串、数据库原始异常或凭证写入 Git、PR、日志或报告；
- 自动进入 A2-P1，或启动 BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务。

若需要写权限、事务提交、真实 Lease、扩大读取字段或仓库文件范围，必须停止并请求新授权。

## 七、停止条件

出现以下任一情况必须停止：

- Manifest 版本、审批、digest、双键或低敏白名单与契约不一致；
- 环境 journal 与仓库证据无法解释地冲突；
- 数据库 Shape、tenant 父记录或 Scope／Version／Head 行出现冲突、额外行或未知状态；
- 备份／恢复点、Operator／Reviewer、只读身份或审计路径无法确认；
- 任何命令需要写权限、提交事务、签发 Lease 或暴露敏感内容；
- 需要改变 accepted D01～D12、`architecture-v2.md` 或既有 ADR；
- 出现并发写入、基线漂移或无法安全恢复的 Git 状态。

停止时只能报告低敏类别、证据位置和所需用户决策，不得输出真实 Manifest、凭证、连接串、双键或数据库内容。

## 八、完成定义与项目级顺序

只读预检只有在所有获批证据已完成低敏核验、dry-run 保持只读且五项计数守恒、阻断与待确认项被明确记录后，才能提交独立 Draft PR。该 PR 仍不得自动 Ready 或合并；合并后必须再通过独立 handoff 冻结是否申请 A2-P1。

```text
V2-MIG01-A2-ENVIRONMENT-MANIFEST-READONLY-PREFLIGHT-01
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

该顺序不改变 MIG-01～MIG-06 的相对顺序。Stage B 已完成不自动授权只读预检；只读预检完成也不自动授权 P1。

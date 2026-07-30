# MIG-01A2 Manifest Candidate 治理基础

> 任务编号：`V2-MIG01-A2-MANIFEST-CANDIDATE-GOVERNANCE-01`
>
> 审计基线：`0be5faf5b089fdf3b5e0c84f3dac09d1283368d2`
>
> 日期：2026-07-30
>
> 状态：Candidate governance foundation；不表示 Stage C、Candidate 生成、人工批准或 A2 实施已经启动

## 1. 文档定位

本文冻结 MIG-01A2 Manifest Candidate 的独立契约、canonicalization、digest、低敏 Source 模型和人工审核生命周期，为未来独立授权的 Stage C 提供稳定输入。

本文不是：

- ADR 或 D01～D12 accepted 决策变更；
- `mig01-a2/v1` Approved Manifest；
- 真实 Candidate、真实 fixture 或审批记录；
- Runner、dry-run、Lease、Provisioning 或数据库执行授权；
- Stage C、Stage D、A2-P1 或 A2-P2 的启动记录。

## 2. 权威关系与不可变边界

本治理基础遵守以下既有关系：

1. 当前 `main` 的代码、测试、Schema、Migration、配置和已合并记录决定仓库 `current` 事实；
2. `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`；
3. `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 记录 D01～D12 已接受选择；
4. Tenancy 继续是 Scope、Context Version／Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的唯一语义 Owner；
5. Access Control 只单向消费，不建立第二套事实源。

本任务没有修改或复用 Approved Manifest 实现：

- `src/modules/tenancy/provisioning/provisioning-manifest.ts`
- `src/modules/tenancy/provisioning/provisioning-canonicalization.ts`
- `src/modules/tenancy/provisioning/provisioning-kernel.ts`
- `src/modules/tenancy/provisioning/provisioning-lease.ts`

Candidate 不提供 `toProvisioningManifest`、`toProvisioningExpectedTriplet`、Candidate → Approved 转换或任何 Repository／Runner 入口。

## 3. 独立 Candidate 协议

### 3.1 版本与 domain

| 项目 | 固定值 |
|---|---|
| Candidate Manifest version | `mig01-a2-candidate/v1` |
| Candidate canonicalization | `candidate-canonicalization-v1` |
| Candidate domain | `zmtg.mig01-a2.provisioning-candidate-manifest` |
| Candidate Source version | `mig01-a2-candidate-source/v1` |
| Candidate Source type | `local_acceptance_fixture` |
| Digest | SHA-256，外部表示为 `sha256:<64 lowercase hex>` |

Candidate version、domain、canonicalization 和 digest preimage 均与 Approved `mig01-a2/v1`／`c14n-v1` 分离。

### 3.2 Candidate exact shape

`ProvisioningCandidateManifestV1` 顶层只允许：

```text
manifestVersion
candidateStatus
candidateSource
generatedAt
generatedByReference
entries
candidateDigest
```

其中：

- `candidateStatus` 唯一允许值为 `candidate`；
- `candidateSource` 只包含 `sourceVersion` 与 `sourceType`；
- `generatedAt` 必须由调用方显式提供，格式为 UTC 毫秒 instant；
- `generatedByReference` 必须为固定低敏引用；
- `entries` 必须非空；
- `candidateDigest` 必须匹配独立 Candidate preimage；
- `approvalStatus`、`approvedAt`、`approvedByReference` 和全部未知字段整批拒绝。

### 3.3 Entry exact shape

每个 Candidate entry 只允许：

```text
tenantReference
institutionReference
scopeStatusCandidate
contextCandidate
timezone
currency
effectiveFromBusinessDate
effectiveAt
```

字段语义：

- `tenantReference`、`institutionReference` 是低敏候选引用，不是数据库字段推断结果；
- `scopeStatusCandidate` 只允许 `active | suspended`；
- `contextCandidate` 只表示未来 Approved Manifest `contextSource` 的候选值，只允许 `institution_config | product_default`；
- `mig01-a2-candidate/v1` 固定绑定 `mig01-a2-local-acceptance-context-policy/v1`、`local_acceptance`、`Asia/Shanghai` 和 `CNY`，调用方不能替换批准集合；
- `effectiveFromBusinessDate` 必须为真实日历日期；
- `effectiveAt` 必须为 UTC 毫秒 instant，转换到 Candidate timezone 后必须落在对应业务日期。

不得包含 PII、手机号、邮箱、密码、Token、Secret、URL、连接串、自由文本或旁路数据库字段。任何缺失字段、未知字段、非 NFC、非法 Unicode、重复双 reference、未批准 timezone／currency、非法日期或 instant 均整批 fail-closed。

## 4. Candidate canonicalization 与 digest

Candidate preimage 使用固定位置 JSON 数组：

```text
[
  Candidate domain,
  Candidate canonicalization version,
  Candidate manifest version,
  "candidate",
  Candidate Source version,
  Candidate Source type,
  generatedAt,
  generatedByReference,
  entry count,
  sorted entries
]
```

每个 entry 的固定位置为：

```text
[
  tenantReference,
  institutionReference,
  scopeStatusCandidate,
  contextCandidate,
  timezone,
  currency,
  effectiveFromBusinessDate,
  effectiveAt
]
```

规则：

- entries 按 `tenantReference`、`institutionReference` 的 UTF-8 字节序排序；
- JSON 不增加额外空白；
- 以 UTF-8 字节计算 SHA-256；
- 不静默执行 Unicode normalization，Parser 对非 NFC 输入直接拒绝；
- `candidateDigest` 自身不进入 preimage；
- Review 状态、Reviewer、Approver 和全部 approval 字段不进入 preimage；
- Source version／type 进入 preimage，fixture 路径、数据库状态和环境变量不进入；
- `generatedAt` 进入 preimage，同一正文重新生成会产生新的 Candidate 身份。

`candidateDigest` 只标识 Candidate 内容，不得写入 Approved Manifest 的 digest 字段，也不得替代未来人工审批。

Candidate v1 通过协议版本固定绑定上述 Context Policy。任何 Policy version、目标环境、timezone 或 currency 集合变化，都必须先建立新的 Candidate 协议版本并重新生成 digest；不得在同一 Candidate v1 下静默替换 Policy。

## 5. Candidate Source 模型

`ProvisioningCandidateSourceV1` 只接受：

```text
sourceVersion = mig01-a2-candidate-source/v1
sourceType = local_acceptance_fixture
entries = 全字段显式提供的低敏合成 fixture
```

Source 模型采用 capability restriction：

- 不接受 SQL client、Repository、数据库 snapshot、查询回调或环境变量；
- 不导入 Schema、Adapter、Runner、Server 或数据库模块；
- 不接受 `tenantId`／`institutionId` 作为数据库字段别名；
- 不从 tenant 推断 institution；
- 不从数据库现状、系统时钟、系统时区、Demo、Seed 或模型偏好补全字段；
- `generatedAt` 与 Generator 引用必须由调用方显式传入；
- 实际 fixture 正文不得成为仓库文件、PR 内容、Runner 输入或 Approved Manifest。

仓库测试只在测试函数内构造明显虚假的低敏 synthetic object；没有新增 fixture 文件。该模型仅关闭 Candidate Source 的契约与依赖边界缺口，不提供未来 Stage C 的真实 institution／context 来源。

## 6. Candidate 与审核生命周期

Candidate 内容类型与人工审核流程是两个独立轴：

```text
Candidate payload：candidateStatus = candidate

Review lifecycle：
generated
→ review_pending
→ approved（未来人工流程，本任务未实现）
```

本任务只实现：

- `generated`：Candidate 已由 Parser 颁发并完成 digest；
- `review_pending`：已指定低敏 Reviewer 引用，等待人工审核；
- `generated → review_pending` 单向转换；
- Candidate digest 在上述转换中保持不变。

本任务不实现：

- `approved` Review State；
- Approver Runtime、审批存储或审批记录入库；
- Candidate 原地修改为 Approved；
- 自动批准或 Candidate → Approved 转换函数。

未来人工批准必须：

1. 由用户明确指定 Reviewer 与 Approver；
2. 保持 Reviewer、Approver、未来 Operator 职责分离；
3. 对冻结 Candidate、Source、Context Policy、digest、失效时间和敏感字段结果进行独立核验；
4. 另行生成并校验新的 `mig01-a2/v1` Approved Manifest；
5. 使用 Approved Contract 自己的 approval 字段、canonicalization 和 digest；
6. 不复用 Candidate digest，不修改原 Candidate。

Codex 不是 Approver，未来 Operator 也不是 Approver。

## 7. 拒绝、失效与保留

真实 Candidate 只能在未来独立授权的仓库外受控路径生成和保管。以下任一变化都会使当前审核失效：

- Candidate 正文、Source、Context Policy、Generator 或生成时间变化；
- digest、exact shape、NFC、日期、instant 或敏感字段检查失败；
- Reviewer／Approver 职责不清；
- Candidate 到达 expiration；
- 用户拒绝 Candidate；
- 保管路径、权限或 retention 证据无法确认。

仓库与普通日志只允许记录固定低敏状态、数量、版本、布尔验证结果、固定拒绝原因码和受控删除结果，不得记录 Candidate 正文、双 reference、digest 原值、审批引用或真实路径。

## 8. 审批包模板

空白模板：

`docs/operations/mig01-a2-manifest-candidate-approval-template-20260730.md`

模板的 Git 版本不得回填真实 Candidate ID、digest、双 reference、审批引用、路径或正文。未来每个真实审批包必须复制到独立授权的仓库外受控位置，并与对应 Candidate 一起执行权限、expiration、retention 和删除控制。

## 9. 测试证据

新增测试：

| 测试集 | 场景数 | 结果 |
|---|---:|---|
| Candidate Manifest Contract／Review lifecycle | 56 | 通过 |
| Candidate canonicalization／digest | 24 | 通过 |
| Candidate Source | 25 | 通过 |
| 合计 | 105 | 通过 |

覆盖：

- exact shape、未知／缺失字段、Candidate／Approved 分离；
- approval 字段拒绝、空 entries、重复 entry；
- 低敏引用、敏感字段、Unicode／NFC；
- timezone、currency、业务日期、canonical instant；
- 固定排序、固定测试向量、digest 稳定与 Candidate／Approved 隔离；
- Source 只允许 synthetic `local_acceptance_fixture`；
- 禁止数据库推断、tenant 推 institution 和隐式时钟；
- `generated → review_pending` 单向生命周期。
- 固定 Context Policy 防伪造，且 Generator 不能兼任 Reviewer。

绿色测试只证明契约与治理基础健康，不表示 Candidate 已生成、人工审批已完成或 Stage C 已启动。

## 10. 状态边界

本治理基础合并并由冻结 Head 的 Required Check 通过后，可以关闭：

- `candidate_contract_missing`
- `candidate_canonicalization_missing`
- `candidate_digest_missing`
- `candidate_source_model_missing`（仅 test-only fixture 模型）
- `candidate_review_lifecycle_foundation_missing`
- `candidate_approval_template_missing`

继续保持：

- `real_manifest_missing`
- `institution_context_real_candidate_source_missing`
- `candidate_human_approval_missing`
- `real_environment_dry_run_unavailable`

本任务没有生成、持久化或审批真实 Candidate，没有批准 Manifest，没有运行 Runner／dry-run／`--execute`，没有签发 Lease，没有连接数据库或业务外部环境，没有修改 Schema／Migration，也没有启动 Stage C、Stage D、A2-P1 或 A2-P2。

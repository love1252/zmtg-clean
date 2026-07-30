# MIG-01A2 用户授权 Source／Candidate v2 治理合约

> 任务编号：`V2-MIG01-A2-STAGE-C-REAL-SOURCE-AND-CANDIDATE-01`
>
> 审计基线：`c1be2e45389a74f653717a2a47a81a5559f3c35b`
>
> 日期：2026-07-30
>
> 状态：Source／Candidate v2 治理合约；不表示 Candidate 已生成、人工审核已通过、Approved Manifest 已创建或 Stage C 已启动

## 1. 文档定位

本文冻结 MIG-01A2 的用户授权 Source v2、Candidate v2、canonicalization、digest 与人工审核入口，为后续独立 Stage C 提供可校验的输入合约。

本文中的“真实”只表示 Source 候选值由用户针对当前任务明确授权，不表示：

- Candidate 已由人工审核；
- Candidate 已转化为 Approved Manifest；
- Runner、dry-run、Lease、Provisioning 或数据库写入已获授权；
- `real_manifest_missing` 已关闭；
- Stage C、Stage D、A2-P1 或 A2-P2 已启动。

Candidate v1 继续是 test-only 合约，保持不可变：

| 项目 | 固定值 | 状态 |
|---|---|---|
| Candidate | `mig01-a2-candidate/v1` | test-only，不扩展、不重解释 |
| Candidate Source | `mig01-a2-candidate-source/v1` | test-only synthetic fixture |
| Source type | `local_acceptance_fixture` | 仅测试 |

## 2. 权威关系与三道独立门

本合约不改变已接受 D01～D12，也不修改 Approved Manifest `mig01-a2/v1`。三道门必须独立：

```text
Source authorization
≠ Candidate review
≠ Approved Manifest
```

1. Source authorization 只证明某组低敏候选输入获得当前任务授权；
2. Candidate review 只核验冻结的 Candidate、Source 绑定、Context Policy、digest、权限与失效边界；
3. Approved Manifest 必须是未来独立生成和校验的新资产，使用 Approved Contract 自己的 approval 字段、canonicalization 与 digest。

Source 获得授权不能代替 Reviewer；Candidate 进入 `review_pending` 不能代替 Approved Manifest；Candidate digest 不能复用为 Approved digest。

## 3. v2 协议版本

| 项目 | 固定值 |
|---|---|
| Candidate Manifest version | `mig01-a2-candidate/v2` |
| Candidate canonicalization | `candidate-canonicalization-v2` |
| Candidate domain | `zmtg.mig01-a2.provisioning-candidate-manifest-v2` |
| Candidate Source version | `mig01-a2-candidate-source/v2` |
| Candidate Source type | `local_acceptance_user_authorized_input` |
| Candidate Source canonicalization | `candidate-source-canonicalization-v1` |
| Candidate Source domain | `zmtg.mig01-a2.provisioning-candidate-source` |
| Digest | SHA-256，表示为 `sha256:<64 lowercase hex>` |

v2 实现不导入 Candidate v1。Candidate v1、Candidate v2 与 Approved Manifest 使用不同版本、domain 和 digest preimage。

## 4. Source v2 exact shape

Source v2 顶层只允许六个字段：

```text
sourceVersion
sourceType
sourceAuthorizationReference
sourceAuthorizedAt
entries
sourceDigest
```

约束：

- `sourceVersion` 与 `sourceType` 必须等于本合约固定值；
- `sourceAuthorizationReference` 必须是 NFC、低敏、固定 opaque reference；
- `sourceAuthorizedAt` 必须是 canonical UTC 毫秒 instant；
- `entries` 必须非空；
- `sourceDigest` 必须匹配 Source v2 preimage；
- 顶层字段和 entry 均 exact-shape，未知或缺失字段整批拒绝；
- 不补默认值，不从数据库、系统时钟、系统时区、Demo、Seed 或模型偏好推断字段。

Source v2 entry 只允许：

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

禁止 Source v2 包含：

- approval、Candidate review、Lease 或 execute 状态；
- Operator 凭证、连接串、`DATABASE_URL`、URL；
- PII、Secret、Token、自由文本；
- 数据库结果、Repository、Adapter 或 Runner 对象。

## 5. Source v2 canonicalization 与 digest

Source digest preimage 是固定位置 JSON 数组：

```text
[
  Source domain,
  Source canonicalization version,
  Source version,
  Source type,
  sourceAuthorizationReference,
  sourceAuthorizedAt,
  entry count,
  sorted entries
]
```

每个 entry 固定为八个位置：

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
- Parser 拒绝非 NFC、非法 Unicode、重复双 reference 与敏感引用；
- JSON 不增加额外空白，以 UTF-8 字节计算 SHA-256；
- `sourceDigest` 不进入自身 preimage；
- Source digest 与 Candidate digest、Approved digest 完全隔离；
- Source 授权引用或授权时间变化必须产生新的 Source digest。

## 6. Candidate v2 exact shape

Candidate v2 顶层只允许七个字段：

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

- `manifestVersion` 固定为 `mig01-a2-candidate/v2`；
- `candidateStatus` 唯一允许值为 `candidate`；
- `generatedAt` 必须由调用方显式提供 canonical UTC 毫秒 instant；
- `generatedByReference` 必须为 NFC、低敏、固定 opaque reference；
- `entries` 必须非空，并重新经过 exact-shape 与 Context Policy 校验；
- `candidateDigest` 必须匹配 Candidate v2 preimage；
- Candidate 不允许任何 Approved Manifest 字段、Lease 或 execute 信息。

`candidateSource` 只允许四个字段：

```text
sourceVersion
sourceType
sourceAuthorizationReference
sourceDigest
```

Candidate v2 preimage 必须绑定上述四项。Source 授权引用、Source digest、Generator、生成时间或任一 entry 变化，都会产生新的 Candidate digest。

## 7. Context Policy

Candidate v2 复用且只接受当前本地验收 Context Policy：

| 字段 | 固定值 |
|---|---|
| Policy version | `mig01-a2-local-acceptance-context-policy/v1` |
| Target environment | `local_acceptance` |
| Timezone | `Asia/Shanghai` |
| Currency | `CNY` |

`UTC`、`USD`、伪造 Policy version 或额外批准集合均 fail-closed。`effectiveAt` 转换到 entry timezone 后，必须与 `effectiveFromBusinessDate` 一致。

复用 Context Policy 不表示 Candidate v2 可以修改该 Policy；Policy 变化必须另立任务和协议版本。

## 8. Candidate canonicalization 与 digest

Candidate digest preimage 是固定位置 JSON 数组：

```text
[
  Candidate domain,
  Candidate canonicalization version,
  Candidate manifest version,
  "candidate",
  Source version,
  Source type,
  sourceAuthorizationReference,
  sourceDigest,
  generatedAt,
  generatedByReference,
  entry count,
  sorted entries
]
```

规则：

- entry 固定位置和排序与 Source v2 一致；
- `candidateDigest` 不进入自身 preimage；
- Review、Reviewer 和 approval 字段不进入 Candidate preimage；
- Review 转换不能修改 Candidate payload 或 digest；
- Candidate digest 只标识 Candidate 内容，不提供审批或执行授权。

## 9. Review lifecycle

Candidate v2 只实现：

```text
generated
→ review_pending
```

要求：

- `generated` 只能由已通过 Parser 的 Candidate 创建；
- `review_pending` 必须使用低敏 Reviewer opaque reference；
- Generator 与 Reviewer 必须不同；
- 重复转换、伪造 Review State 或敏感 Reviewer 引用均拒绝；
- 转换后 Candidate digest 保持不变。

本合约不实现：

- `approved` Review State；
- Candidate → Approved 转换；
- Approver Runtime、审批存储或审批入库；
- 自动批准或将 Candidate 原地改写为 Approved。

未来 Approved Manifest 是独立新资产，不是 Candidate 的 `approved` 状态。

## 10. 存储、输出与失效边界

真实 Source 正文和 Candidate 正文只能位于当次任务明确授权的仓库外受控位置：

- 不进入 Git、PR、Issue、附件、普通日志、argv 或环境变量；
- 仓库文档只记录版本、数量、布尔验证结果、固定状态和固定阻断码；
- 不记录双 reference、digest 原值、授权／审核引用或私有路径；
- 权限、身份、Source、Base、Policy、Candidate 内容、Reviewer 或 digest 变化时，既有审核失效；
- 到期、用户拒绝或校验失败时不得继续消费。

保留、删除和延期均必须服从后续明确授权，不由本合约自动执行。

## 11. 依赖与执行边界

Source／Candidate v2 模块只处理内存中的显式输入：

- 不读取数据库；
- 不调用只读 Adapter；
- 不读取环境变量或凭证；
- 不导入 Schema、Migration、Repository、Runner 或 Server 模块；
- 不运行 Runner、dry-run、Lease、Provisioning、Migration 或 Seed；
- 不创建 Approved Manifest；
- 不关闭 `real_manifest_missing`；
- 不启动 Stage C。

未来 Stage C 必须在独立 handoff 完成后，按其精确授权生成仓库外 Source／Candidate，并只提交低敏审批包。

## 12. 测试证据

新增测试覆盖 225 个场景：

| 测试集 | 场景数 |
|---|---:|
| Source／Candidate v2 canonicalization 与 digest | 41 |
| Candidate v2 Manifest 与 Review lifecycle | 108 |
| 用户授权 Source v2 | 76 |
| 合计 | 225 |

覆盖：

- exact shape、unknown／missing 字段、非对象输入；
- Source／Candidate version、type、authorization reference 与时间；
- UTF-8 排序、NFC、固定向量、entry count 和 digest tamper；
- 空 entries、重复 entries、敏感字段、非法日期／instant；
- Source descriptor 四字段绑定；
- Context Policy、`Asia/Shanghai`、`CNY` 及 `UTC`／`USD` 拒绝；
- v1／v2／Approved 协议隔离；
- `generated → review_pending`、Generator／Reviewer 分离；
- approval／approved 拒绝，且不存在 Candidate → Approved 能力。

绿色测试只证明治理合约健康，不表示真实 Source 或 Candidate 已生成，也不表示任何人工审核、Approved Manifest 或实施门禁已经完成。

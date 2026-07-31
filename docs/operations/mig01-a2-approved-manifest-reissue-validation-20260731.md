# MIG-01A2 Approved Manifest 重新签发低敏证据

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-P1-APPROVED-MANIFEST-REISSUE-AND-REAPPROVAL-01`
- 日期与时区：`2026-07-31`，`Asia/Shanghai`
- 冻结 Base：`3e4180d7327ae055f6d5d9264d75ae9da3704fe6`
- 交付性质：Approved Manifest 私有重签的低敏证据；仓库内仅新增本文档
- 当前结论：`approved_manifest_reissue_validation=passed`
- 后续准入：`eligible_for_approved_manifest_reissue_independent_review=true`
- A2-P1 execute 准入：`false`

本文不包含私有路径、Source／Candidate／Approved Manifest 正文、tenant／institution 双引用、digest、Generator／Reviewer／Approver 引用、连接参数、凭证或 PII。本文不是 Runner、dry-run、Lease、数据库写入、A2-P1 execute 或 A2-P2 的授权。

## 2. 重签原因与历史边界

- PR #823 的 Approved Manifest 创建与校验摘要保留为其历史时点证据，不原地改写。
- 当前任务启动时，既有私有治理根仍存在，但旧 Approved Manifest 已不可读取，当前有效数量为 `0`。
- 本轮没有从备份、日志、旧 digest、旧审批引用、旧路径或临时副本恢复旧 Approved Manifest。
- 旧 Approved Manifest 正文、digest、审批引用和文件身份均未被读取或复用。
- 当前仍有效的 Candidate v2 经用户明确授权用于重新签发新的 Approved Manifest。

旧资产不可读取不等于历史报告失实；它只表示旧资产不能继续作为当前 A2-P1 输入。本轮重新签发形成全新的文件身份、审批引用、审批时刻和 Approved digest。

## 3. Candidate 启动硬门

重新签发前完成以下只读核验：

| 核验项 | 结果 |
|---|---|
| 私有治理根数量 | `1` |
| 私有治理根权限 | `0700` |
| Candidate v2 数量 | `1` |
| Candidate 文件身份 | 普通文件、非符号链接、单硬链接、当前用户所有、`0600` |
| Source v2 数量 | `1` |
| Review State | `review_pending` |
| Candidate version | `mig01-a2-candidate/v2` |
| Source version | `mig01-a2-candidate-source/v2` |
| Context Policy | `mig01-a2-local-acceptance-context-policy/v1`，通过 |
| Source／Candidate exact shape | `true` |
| Source／Candidate digest 校验 | `true` |
| Source 与 Candidate 绑定 | `true` |
| Review State 与 Candidate 绑定 | `true` |
| Source authorization | `true` |
| tenant 父记录既有低敏证据 | `true` |
| 用户人工审核依据 | `accepted_for_approved_manifest_preparation`，有效 |
| Candidate 有效期 | 未到期 |
| Candidate 撤销／拒绝／失效标记 | `0` |
| 当前 Approved Manifest 数量 | `0` |

Candidate、Source、Review State 的内容 digest、文件身份和当前私有状态在生成前已冻结。任一门禁不满足都将保持零新资产并停止；本次未触发停止条件。

## 4. 重新签发方式

私有处理由一次性单进程、不回显 Helper 完成。Helper 只调用当前仓库的公开 Contract、Context Policy 与 canonicalization 实现；未复制旧 Approved Manifest，也未修改 Runner、Kernel、Port 或 Adapter。

Candidate entry 到 Approved entry 使用显式映射：

- `tenantReference` → `tenantId`；
- `institutionReference` → `institutionId`；
- `scopeStatusCandidate` → `scopeStatus`；
- `contextCandidate` → `contextSource`；
- timezone、currency、business date 与 effective instant 原样保持；
- `scopeRevision`、`contextVersion`、`contextHeadRevision`、`latestVersion` 固定为 `1`；
- `provisioningSource` 固定为 `approved_migration_manifest`。

新 Approved Manifest 使用：

| 项目 | 结果 |
|---|---|
| Contract | `mig01-a2/v1` |
| approvalStatus | `approved` |
| canonicalization | `c14n-v1` |
| entry 数量 | `1` |
| exact shape | `true` |
| 独立 SHA-256 digest | `true` |
| Candidate digest 复用 | `false` |
| Source digest 复用 | `false` |
| 旧 Approved digest 输入或复用 | `false` |
| 旧 Approved 审批引用输入或复用 | `false` |
| 旧 Approved 路径复用 | `false` |

新资产先写入同一新任务目录内的 `0600` staging，完成 fsync、文件身份检查、原子 rename 和重新打开校验后才成为稳定资产。staging 不计入 Approved Manifest 数量。

## 5. 职责分离

| 角色边界 | 结果 |
|---|---|
| Candidate Generator 与 Candidate Reviewer | 分离 |
| 新 Approver 与 Generator | 分离 |
| 新 Approver 与 Reviewer | 分离 |
| Future Operator | 未分配 |
| 新 Approver 与 Future Operator | 分离 |
| Operator 执行授权 | `0` |

新 Approver 使用全新的低敏 opaque reference；本文不记录该引用。Candidate payload 继续为 `candidate`，Review State 继续为 `review_pending`，没有伪造 Candidate 的 `approved` 状态。

## 6. 生成后验证

生成完成后重新打开新文件，并由第二个独立只读进程重新执行 Contract、digest、文件身份与职责分离校验。

| 验证项 | 结果 |
|---|---|
| Approved Manifest 数量 | `1` |
| Candidate 数量 | `1` |
| Approved 文件身份 | 普通文件、非符号链接、单硬链接、当前用户所有、`0600` |
| Approved 任务目录 | `0700` |
| Approved Contract／exact shape | `true` |
| Approved canonicalization／digest | `true` |
| Candidate／Approved 目录分离 | `true` |
| Candidate／Approved 文件身份分离 | `true` |
| Candidate／Approved digest 分离 | `true` |
| Candidate 内容与文件身份前后不变 | `true` |
| Source 内容与文件身份前后不变 | `true` |
| Review State 内容与文件身份前后不变 | `true` |
| 临时 staging／副本／Helper 残留 | `0` |

权威 Candidate、Source、Review State、新 Approved Manifest 与必要私有治理元数据继续保留。普通文件删除不被表述为介质级物理擦除。

## 7. 零执行与范围证据

| 类别 | 数量／状态 |
|---|---:|
| 数据库连接 | `0` |
| 数据库角色创建或 ACL 修改 | `0` |
| Runner | `0` |
| dry-run | `0` |
| `--execute` | `0` |
| Lease 签发、读取、验证或消费 | `0` |
| Migration／Seed／DDL／DML | `0` |
| Runtime／Schema／scripts／tests／CI 修改 | `0` |
| package／lock 修改 | `0` |
| 私有正文、路径、双引用、digest 或角色引用输出 | `0` |
| Future Operator 分配 | `0` |

## 8. 结论与后续边界

- `approved_manifest_reissue_validation=passed`
- `candidate_count=1`
- `approved_manifest_count=1`
- `candidate_unchanged=true`
- `candidate_approved_file_separation=true`
- `candidate_digest_reused=false`
- `approved_manifest_reissue_independent_review_pending=true`
- `eligible_for_approved_manifest_reissue_independent_review=true`
- `eligible_for_a2_p1_resume_handoff=false`
- `eligible_for_a2_p1_execute=false`

本结论只允许本文进入独立审查。独立审查和后续 handoff 完成前，不得创建专用角色、修改 ACL、签发 Lease、运行 Runner／dry-run／`--execute`、连接数据库、启动 A2-P1 execute 或 A2-P2。

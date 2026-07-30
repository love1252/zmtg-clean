# MIG-01A2 Approved Manifest 低敏创建与校验摘要

## 1. 文档定位

- 任务编号：`V2-MIG01-A2-APPROVED-MANIFEST-CREATION-VALIDATION-01-PRIVATE-PATH-SAFE-RESUME`
- 日期与时区：`2026-07-30`，`Asia/Shanghai`
- 冻结 Base：`5c3e65f3757de8ee0322ea7c262e55e2b5548f96`
- 交付范围：docs-only；仓库内只新增本低敏 Markdown，Approved Manifest 及其治理元数据保存在仓库外受控私有区域。
- 任务结果：完成仓库外 Approved Manifest 创建、Contract 校验、digest 校验和文件隔离校验。
- 本文不是 Runner、dry-run、Stage D、A2-P1 或 A2-P2 的授权，也不表示 Approved Manifest 已完成独立用户审核。

## 2. 路径回显事件

- 历史本地终端曾发生一次私有目录路径回显，事件发生在私有资产访问前。
- 该事件未回显 Candidate、Source 或 Review State 正文，未回显 tenant／institution 双引用、digest、Secret、Token、连接串或 PII。
- 该路径未进入 Git、PR、GitHub、Issue 或本报告。
- 上一次执行在访问私有资产前停止；本次重新核验了私有资产内容、digest、权限和文件身份。
- 历史事件已如实记录，不表述为“从未发生”。
- 本次执行新增私有路径回显数量：`0`。

## 3. Candidate 前置证据

- PR #820 已合并，当前用户人工审核结论为 `accepted_for_approved_manifest_preparation`。
- Candidate 数量：`1`。
- Candidate payload 继续为 `candidate`，私有 Review State 继续为 `review_pending`。
- Candidate 在 Approved Manifest 创建时仍处于有效期内。
- Source v2 exact shape 与 digest：`通过`。
- Candidate v2 exact shape 与 digest：`通过`。
- Context Policy：`通过`。
- Generator 与 Reviewer 职责分离：`通过`。
- 私有文件内容、权限和文件身份重新核验：`通过`。
- Candidate、Source、Review State 和原低敏审批摘要均未被修改或重新签发。

## 4. Approved Manifest 状态

| 项目 | 结果 |
|---|---|
| Approved Manifest 数量 | `1` |
| Manifest version | `mig01-a2/v1` |
| approvalStatus | `approved` |
| approvedByReference | `存在` |
| approvedAt | `存在，UTC 毫秒 canonical instant` |
| canonicalization | `c14n-v1` |
| exact shape | `通过` |
| Approved digest 校验 | `通过` |
| entry count | `1` |
| Candidate digest 复用 | `false` |
| Source digest 复用 | `false` |
| Candidate／Approved 文件隔离 | `true` |

字段映射只在私密 Helper 内存中完成，低敏结果如下：

| 映射类别 | 结果 |
|---|---|
| tenant／institution 双引用显式映射 | `true` |
| scope status 映射 | `true` |
| revision／version 固定值 | `true` |
| provisioning source 固定值 | `true` |
| context source 映射 | `true` |
| timezone／currency 保持 | `true` |
| business date／effectiveAt 保持 | `true` |

## 5. 私有保管

- Candidate 与 Approved Manifest 位于彼此分离的私有任务目录，并作为两个独立资产继续保留。
- 私有治理根、Candidate 任务目录和 Approved Manifest 任务目录权限均为 `0700`。
- Candidate 与 Approved Manifest 相关私有 JSON 文件权限均为 `0600`。
- Candidate 未被移动、删除、覆盖或原地转换，Candidate digest 未发生变化。
- Future Operator 仍未分配；后续 Operator 必须使用与本次 Approver 不同的私有引用。
- Candidate 与 Approved Manifest 至少保留到 Approved Manifest 独立用户审核及后续 handoff 完成；删除、延期或撤销均需另行授权。
- 本报告不记录任何私有路径或角色引用。

## 6. 零泄漏结果

| 类别 | 命中数量 |
|---|---:|
| 历史路径事件已记录 | `true` |
| 本次新增私有路径回显 | `0` |
| Source Authority／Generator／Reviewer／Approver 私有引用 | `0` |
| tenant／institution 双引用 | `0` |
| Candidate digest | `0` |
| Approved Manifest digest | `0` |
| Source／Candidate／Review State／Approved Manifest 正文 | `0` |

扫描范围仅包括当前 Git diff、本报告、PR 描述草稿、低敏 validation summary 和本任务低敏命令状态；扫描只记录计数，不输出匹配值。

## 7. 阻断状态

- `real_manifest_missing`：已解决；仓库外 Approved Manifest 已创建并通过 Contract 与 digest 校验。
- `approved_manifest_independent_review_pending`：继续阻断；独立用户审核尚未完成。
- `real_environment_dry_run_unavailable`：继续阻断。
- 在独立用户审核及后续 handoff 完成前，不得把本次 Approved Manifest 视为可供 Stage D 消费。
- Candidate payload 与私有 Review State 均保持原状态；本任务不关闭或启动 Stage D。

## 8. 零执行证据

- Runner：未运行。
- synthetic／真实 dry-run：未运行。
- `--execute`：未使用。
- Lease：未签发、未读取、未验证、未消费。
- 数据库连接：`0`。
- 数据库写入：`0`。
- Migration、Seed、DDL、DML、Provisioning：均未运行。
- Runtime、Schema、Migration 修改：均为 `0`。
- Stage D、A2-P1、A2-P2：均未启动。

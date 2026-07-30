# MIG-01A2 Manifest Candidate 审批包模板

> 模板版本：`mig01-a2-candidate-approval-pack-template/v1`
>
> 状态：空白治理模板
>
> 禁止：不得在本 Git 文件中回填真实 Candidate、digest、双 reference、审批引用、受控路径或业务数据

## 1. 使用说明

本模板只定义未来仓库外审批包的低敏字段和人工流程。Candidate v1 `local_acceptance_fixture` 继续仅用于 test-only；当前 Source／Candidate v2 治理合约允许后续独立 Stage C 接收用户明确授权的低敏 Source。所有字段仍必须留空，使用本模板不表示 Source 或 Candidate 已生成、Reviewer／Approver 已指定、人工审核已完成、Approved Manifest 已创建或 Stage C 已启动。

未来真实审批包必须：

- 在独立授权的仓库外受控路径创建；
- 使用 `0600` 文件权限和受控父目录；
- 与 Candidate 正文分开控制展示和输出；
- 不进入 Git、PR、Issue、日志、argv、环境变量或测试 fixture；
- 不由 Codex、Generator 或未来 Operator 自动批准；
- 过期、拒绝或内容变化后失效，不得继续消费。

## 2. Candidate 基本信息

| 字段 | 待填写值 | 规则 |
|---|---|---|
| Task ID | `[留空]` | 必须对应独立授权任务 |
| Frozen Base | `[留空]` | 只记录 Commit SHA |
| Candidate ID | `[留空]` | 低敏跟踪引用，不替代 digest |
| Candidate Version | `[留空]` | Stage C 必须为 `mig01-a2-candidate/v2`；v1 继续 test-only |
| Candidate Canonicalization | `[留空]` | Stage C 必须为 `candidate-canonicalization-v2` |
| Candidate Source Version | `[留空]` | Stage C 必须为 `mig01-a2-candidate-source/v2` |
| Candidate Source Type | `[留空]` | Stage C 必须为 `local_acceptance_user_authorized_input` |
| Candidate Source Canonicalization | `[留空]` | Stage C 必须为 `candidate-source-canonicalization-v1` |
| Source Authorization Status | `[留空]` | 只允许记录低敏布尔状态，不回填授权引用 |
| Source Authorization Time | `[留空]` | UTC 毫秒 instant；不得写入未来时间 |
| Source Digest | `[仓库外填写]` | `sha256:<64 lowercase hex>`；不得回填到本 Git 模板 |
| Source | `[留空]` | v2 Source 正文只允许位于仓库外受控位置 |
| Target Environment | `[留空]` | 必须由任务明确授权，不得从环境推断 |
| Generated Time | `[留空]` | UTC 毫秒 instant |
| Generator Reference | `[留空]` | 低敏引用；Generator 不是 Approver |
| Entry Count | `[留空]` | 只记录数量，不记录双 reference |
| Candidate Digest | `[仓库外填写]` | `sha256:<64 lowercase hex>`；不得回填到本 Git 模板 |
| Digest Algorithm | `SHA-256` | 固定 |

## 3. Context Policy

| 字段 | 待填写值 | 规则 |
|---|---|---|
| Policy Version | `[留空]` | 未来 Stage C 当前预期为 `mig01-a2-local-acceptance-context-policy/v1` |
| Timezone Set | `[留空]` | 只能记录获批集合摘要，不记录业务数据 |
| Currency Set | `[留空]` | 只能记录获批集合摘要，不记录业务数据 |
| Context Source | `[留空]` | 必须逐 entry 显式提供，审批包只记录布尔汇总 |
| Business Date Policy | `[留空]` | 必须与 timezone 下的 `effectiveAt` 对齐 |

## 4. 静态验证结果

仅填写 `pass | fail | not_run`：

| 检查 | 结果 |
|---|---|
| Source version／type／authorization | `[留空]` |
| Source exact shape | `[留空]` |
| Source digest | `[留空]` |
| Candidate exact shape | `[留空]` |
| Entry exact shape | `[留空]` |
| UTF-8／NFC | `[留空]` |
| 固定排序 | `[留空]` |
| Candidate digest | `[留空]` |
| Candidate／Approved domain 隔离 | `[留空]` |
| Context Policy | `[留空]` |
| timezone／currency | `[留空]` |
| 业务日期／instant | `[留空]` |
| 空 entries 拒绝 | `[留空]` |
| 重复 entry 拒绝 | `[留空]` |
| 敏感字段拒绝 | `[留空]` |
| approval 字段不存在 | `[留空]` |

任何一项为 `fail` 或 `not_run` 时不得进入人工审核。

## 5. Reviewer／Approver 生命周期

Candidate payload 的 `candidateStatus` 始终为 `candidate`。审核状态独立记录：

```text
generated
→ review_pending
```

| 字段 | 待填写值 | 规则 |
|---|---|---|
| Review Status | `[留空]` | 本治理阶段只允许 `generated | review_pending` |
| Reviewer | `[留空]` | 必须由用户指定；不得是 Generator |
| Review Time | `[留空]` | UTC 毫秒 instant |
| Approver | `[留空]` | 属于未来独立 Approved Manifest 流程；本模板必须留空 |
| Decision Time | `[留空]` | 属于未来独立 Approved Manifest 流程；本模板必须留空 |
| Future Operator | `[留空]` | 不得兼任 Approver；本任务不授权 |

Reviewer、Approver 和 Future Operator 只能使用低敏、稳定的 opaque reference；禁止填写姓名、邮箱、手机号、PII 或自由文本。本 Git 模板中的真实身份引用必须保持空白。Candidate v2 只允许 `generated → review_pending`；未来 Approved Manifest 是独立新资产，不是 Candidate 的 `approved` 状态。

Codex 不是 Approver。未来 Operator 不是 Approver。Reviewer 与 Approver 必须职责分离；Candidate 不得原地修改为 Approved。

## 6. 拒绝、失效与撤销

Reject Reason 只允许以下固定低敏码：

```text
source_invalid
shape_invalid
context_policy_invalid
digest_invalid
sensitive_field_detected
duplicate_entry
candidate_expired
reviewer_rejected
governance_boundary_invalid
```

| 字段 | 待填写值 | 规则 |
|---|---|---|
| Reject Reason | `[留空]` | 禁止自由文本 |
| Expiration | `[留空]` | UTC 毫秒 instant；到期即失效 |
| Revocation Status | `[留空]` | `not_revoked | revoked` |
| Revocation Reason | `[留空]` | 固定低敏码 |

任一 Candidate 字段、Source、Context Policy、Generator、生成时间或 digest 变化，都必须生成新的 Candidate 和新的审批包。

## 7. Retention 与受控删除

| 字段 | 待填写值 | 规则 |
|---|---|---|
| Retention Policy | `[留空]` | 必须由独立任务授权 |
| Retention Deadline | `[留空]` | UTC 毫秒 instant |
| Candidate Storage Status | `[留空]` | 只记录低敏状态，不记录路径 |
| Approval Pack Storage Status | `[留空]` | 只记录低敏状态，不记录路径 |
| Controlled Deletion Status | `[留空]` | `not_due | deleted | deletion_blocked` |
| Deletion Evidence | `[留空]` | 只记录低敏布尔值和时间 |

正文不得长期保留到未授权位置。删除动作本身也必须服从当次任务授权，不得由本模板自动触发。

## 8. 本模板不提供的授权

以下项目在本 Git 模板中必须保持未执行、未批准：

- Approved Manifest；
- Candidate → Approved 自动转换；
- Runner、dry-run、`--execute`；
- 执行 Lease／Migration Lease；
- 数据库读取或写入；
- Schema／Migration；
- Stage C／Stage D；
- A2-P1／A2-P2；
- BASE-02、Writer、Reader 或机构端旧任务。

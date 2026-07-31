# MIG-01A2 Approved Manifest 重新签发独立审查

## 1. 文档定位

- 当前任务：`V2-MIG01-A2-P1-APPROVED-MANIFEST-REISSUE-AND-REAPPROVAL-01`
- 阶段：Approved Manifest 重新签发低敏证据独立审查
- 日期与时区：`2026-07-31`，`Asia/Shanghai`
- 审查 Base：`18bb00356a0f282ca3a9cd75c3f9c6b23f9c10e1`
- 审查方式：docs-only、独立只读复核
- 审查结论：`passed`

本审查只核对已经合并的重新签发低敏证据、当前私有治理资产的低敏状态、仓库公开 Contract 与 GitHub 交付事实。审查没有连接数据库，没有重新生成或修改 Candidate／Approved Manifest，也没有运行 Runner、dry-run、`--execute` 或 Lease 操作。

本文不记录私有路径、Source／Candidate／Approved Manifest 正文、tenant／institution 双引用、digest、Generator／Reviewer／Approver 引用、审批引用、连接参数、凭证或 PII。

## 2. 冻结审查对象

| 项目 | 冻结值 |
|---|---|
| 证据 PR | #837 |
| Head | `f1c0a92c40eb2de99cb064231c76a201ebfb36eb` |
| Merge Commit | `18bb00356a0f282ca3a9cd75c3f9c6b23f9c10e1` |
| Required Check | Run `30624937873`／Job `91137882392`，成功 |
| 提交／文件 | `1／1` |
| 合并方式 | Merge Commit |
| 证据文件 | `docs/operations/mig01-a2-approved-manifest-reissue-validation-20260731.md` |

Merge Commit 的两个父提交分别为冻结 Base 与 PR Head，Merge tree 与 PR Head tree 一致。PR #837 合并前无评论、Review 或未解决 thread；环境核对、依赖安装、架构检查器自测、增量架构检查、lint、typecheck、完整测试和 build 均实际成功，build 未跳过。

## 3. 审查方法与事实来源

独立审查分为三层：

1. 读取合并后的低敏证据，核对重新签发原因、Candidate 门禁、Approved 输出、职责分离、清理和零执行边界；
2. 使用仓库公开 Contract、canonicalization 和 Context Policy 对证据中的版本、exact shape、字段映射与 digest 规则进行静态复核；
3. 由独立只读进程对当前私有治理资产进行低敏复核，只返回数量、Contract、文件身份、绑定、有效期、撤销、职责分离和临时资产清理结论。

独立只读复核没有把私有正文或引用带入仓库，也没有把历史报告当作当前私有资产。当前私有状态只用于审查重新签发结果，不构成 A2-P1 execute 的长期环境事实。

## 4. 发现项

```text
blocking_findings=0
non_blocking_findings=0
```

没有发现需要修正重新签发证据、阻断 handoff 或扩大本轮范围的事实、归因、数量、Contract、职责分离或授权边界问题。

## 5. Candidate 前置状态审查

| 核验项 | 审查结果 |
|---|---|
| 私有治理根权限 | `0700`，通过 |
| Source／Candidate／Review State 数量 | 各 `1`，通过 |
| Candidate v2 数量 | `1`，通过 |
| Candidate 文件身份 | regular file、`0600`、单硬链接，审核通过 |
| Source／Candidate exact Contract 与 digest | 通过 |
| Source／Candidate／Review State 绑定 | 通过 |
| Context Policy | 通过 |
| 人工审核依据 | 有效 |
| Candidate 有效期 | 未到期 |
| Candidate 撤销／拒绝／失效 | 未命中 |
| 重新签发前 Approved Manifest | `0`，与证据一致 |

Candidate、Source 和 Review State 在重新签发前后均未发现内容或文件身份漂移。Candidate payload 继续保持 `candidate`，Review State 继续保持 `review_pending`；本轮没有把 Candidate 状态伪造成 `approved`。

## 6. 新 Approved Manifest 审查

| 核验项 | 审查结果 |
|---|---|
| 最终 Approved Manifest 数量 | `1` |
| Contract | `mig01-a2/v1` |
| approvalStatus | `approved` |
| canonicalization | `c14n-v1` |
| exact shape | 通过 |
| Approved digest 校验 | 通过 |
| Candidate／Source digest 复用 | `false` |
| 旧 Approved digest、审批引用或路径复用 | `false` |
| Candidate／Approved 文件与目录隔离 | 通过 |
| Approved 文件身份 | regular file、`0600`、单硬链接 |
| Approved 任务目录权限 | `0700` |

公开 Contract 的字段映射与证据一致：Candidate 的 tenant、institution、scope status 和 context candidate 被显式映射到 Approved entry；版本与 head revision 固定为首次 provisioning 的 `1`；`provisioningSource` 固定为 `approved_migration_manifest`。审查未发现把旧文件恢复、把 Candidate 原地转换或复用旧审批身份的迹象。

## 7. Digest、文件身份与清理审查

- Source、Candidate、Approved 使用不同 Contract 与 digest 域；独立校验确认三者 digest 分离。
- Candidate 与 Approved 的目录、文件身份和稳定资产生命周期分离。
- 新 Approved 在独立任务目录中完成 staging、fsync、原子 rename 与重新打开校验后才计为有效资产。
- 最终 staging、Helper 与临时副本残留为 `0`。
- Candidate、Source、Review State、Approved Manifest 与必要治理元数据继续保留。
- 证据没有把普通文件删除表述为介质级物理擦除。

## 8. 职责分离审查

| 角色边界 | 审查结果 |
|---|---|
| Generator 与 Reviewer | 分离 |
| Approver 与 Generator | 分离 |
| Approver 与 Reviewer | 分离 |
| Future Operator | 未分配 |
| 当前 Operator 授权 | `0` |

当前职责分离满足重新签发与 handoff 的低敏审查要求。Future Operator 仍未分配；未来任务如分配 Operator，必须再次确认其与既有 Approver 分离。该后续核验不能由本审查预先替代。

## 9. 零执行与授权边界审查

| 类别 | 数量／状态 |
|---|---:|
| 数据库连接 | `0` |
| 数据库角色创建或 ACL 修改 | `0` |
| Lease 签发、读取、验证、消费或释放 | `0` |
| Runner／dry-run／`--execute` | `0／0／0` |
| Migration／Seed／DDL／DML | `0` |
| Runtime／Schema／scripts／tests／CI 修改 | `0` |
| package／lock 修改 | `0` |
| A2-P1 execute／A2-P2 启动 | `0／0` |

用户对本任务的授权只覆盖 Approved Manifest 重新签发、低敏证据、独立审查与 handoff。它没有授权角色创建、ACL、Lease、Runner、dry-run、`--execute` 或任何数据库操作。

## 10. 审查限制

- 本审查没有连接数据库，不能替代未来任务的数据库实时硬门。
- 当前 Approved Manifest 的低敏状态是本次审查时点事实；未来任务必须重新核验数量、权限、有效期、撤销状态、Context Policy、Candidate 隔离与职责分离。
- 独立审查通过只允许进入 handoff，不等于 A2-P1 execute 已获授权。
- Future Operator 未分配不是长期职责分离保证，分配时必须再次核验。

## 11. 结论与后续边界

```text
approved_manifest_reissue_review=passed
approved_manifest_count=1
eligible_for_a2_p1_resume_handoff=true
eligible_for_a2_p1_execute=false
```

重新签发证据与当前低敏状态足以进入独立 handoff。handoff 只能记录重新签发和审查已经完成，并重新冻结唯一下一任务；不得创建专用角色、修改 ACL、签发 Lease、运行 Runner／dry-run／`--execute`、连接数据库、启动 A2-P1 execute 或 A2-P2。

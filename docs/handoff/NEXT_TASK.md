# 智美天工唯一下一任务

## 当前交接状态

MIG-01A2 Source／Candidate v2 Governance、Source v2 handoff 与 Stage C Candidate 人工审核已经分别通过独立 PR 完成：

- PR #818 建立 Source／Candidate v2 Governance，Head `29ee87fa7f7b3ab3749e4adedaf89457471d21ef`，Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350`；
- PR #819 完成 Source v2 handoff，Head `4c964a167ad4e729681067ba319e4b9cb1940d3f`，Merge Commit `2e14cfd2cec73cd3d8dc08274ba70763402798bb`；
- PR #820 完成 Candidate 生成、重新签发和用户人工审核记录，Head `bc3ad6155df5ce071442183b85a301dd6366ec51`，Merge Commit `172526e15775fc99768e1d739fc3c0d947bc1363`；
- PR #820 Required Check：Run `30540499970`／Job `90863892886`，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功；
- Candidate 数量为 1，Candidate version 为 `mig01-a2-candidate/v2`，Source version 为 `mig01-a2-candidate-source/v2`，Source type 为 `local_acceptance_user_authorized_input`；
- Context Policy version 为 `mig01-a2-local-acceptance-context-policy/v1`，tenant 父记录存在，Source／Candidate exact shape、digest 与 Context Policy 校验全部通过；
- 用户人工审核结论为 `accepted_for_approved_manifest_preparation`；
- Candidate payload 状态仍为 `candidate`，私有 Review State 仍为 `review_pending`；没有 Candidate `approved` 状态；
- Candidate digest 不得复用为 Approved Manifest digest；
- `candidate_human_approval_missing` 已关闭；`real_manifest_missing` 与 `real_environment_dry_run_unavailable` 继续阻断；
- Approved Manifest、Runner、dry-run、`--execute`、Lease、数据库写入、Stage D、A2-P1 与 A2-P2 均未启动。

## 唯一下一任务

```text
V2-MIG01-A2-APPROVED-MANIFEST-CREATION-VALIDATION-01
基于已审核 Candidate 创建并校验独立 Approved Manifest
```

该任务尚未启动。本 handoff 只冻结下一任务范围，不创建 Approved Manifest，不授权 Runner、dry-run、Lease、Stage D 或 A2-P1。

## 一、启动前必须重新冻结

未来任务启动前必须重新确认：

1. 最新 `main` 与 `origin/main`；
2. PR #820 的 Head、Merge Commit 与 Required Check；
3. 私有 Candidate 文件仍存在且权限未漂移；
4. Candidate 尚未到期；
5. Candidate、Source、Context Policy 和各自 digest 均未漂移；
6. 用户人工审核结论仍为 `accepted_for_approved_manifest_preparation`；
7. 未来 Approver 的低敏 opaque reference，并确认其与未来 Operator 职责分离；
8. Approved Manifest 的仓库外受控私有目录；
9. Approved Manifest 与 Candidate 的保留期限；
10. 两类资产各自的删除、失效和撤销规则；
11. 唯一 Draft 审批／校验报告路径；本 handoff 不凭空指定该路径。

任一项无法确认时必须停止，不得创建 Approved Manifest。

## 二、未来任务唯一允许事项

未来任务只允许：

1. 重新校验已审核 Candidate；
2. 创建全新的、仓库外独立 Approved Manifest；
3. Approved Manifest version 固定为 `mig01-a2/v1`；
4. `approvalStatus` 固定为 `approved`；
5. `approvedByReference` 与 `approvedAt` 必须显式提供并通过 Contract 校验；
6. 使用 Approved Manifest Contract 自己的 `c14n-v1`；
7. 计算新的 Approved Manifest SHA-256 digest；
8. 不复用 Candidate digest；
9. Candidate 与 Approved Manifest 作为两个独立文件保留，不能原地转换；
10. 只输出不含双键、digest、审批引用或私有路径的低敏验证摘要；
11. 创建独立草稿（Draft）审批／校验报告，并等待真实 Required Check。

推荐的静态链路为：

```text
重新校验 Candidate
→ 冻结 Approver 与受控私有目录
→ 独立构造 mig01-a2/v1 Approved Manifest
→ c14n-v1
→ 新 Approved digest
→ Approved Contract exact-shape 校验
→ Candidate／Approved 文件隔离核验
→ 低敏 Draft 审批／校验报告
```

该链路只创建和校验 Approved Manifest，不消费它。

## 三、严格禁止

未来任务不得：

- 修改 Candidate 或 Source 内容；
- 将 Candidate payload 状态改成 `approved`；
- 将私有 Review State 伪造成 `approved`；
- 复用 Candidate digest；
- 运行 Runner；
- 运行 synthetic 或真实 dry-run；
- 使用 `--execute`；
- 签发、读取、验证或消费执行 Lease／Migration Lease；
- 写数据库或运行 Migration、Seed、Reset、Restore、DDL、DML 或 Provisioning；
- 启动 Stage D、A2-P1、A2-P2、BASE-02、Writer、Reader 或其他下游任务；
- 将 Approved Manifest 正文、digest、tenant／institution 双键、审批引用、私有路径或连接信息写入 Git、PR、Issue、日志或聊天；
- 读取 `.env.local`、非本地 `DATABASE_URL`、Secret、Token、PII 或真实业务数据；
- 修改 Candidate Contract、Approved Manifest Contract、Context Policy、Runner、Adapter、Schema、Migration、CI、package 或 lock；
- 自动进入正式审查（Ready）或自动合并。

## 四、过期与漂移停止条件

出现以下任一情况必须停止：

- Candidate 已到期；
- Candidate、Source、Context Policy、digest、Base、Reviewer 或文件权限发生漂移；
- 私有 Candidate 文件缺失或无法完整验证；
- 用户人工审核结论无法确认；
- Approver 与未来 Operator 无法职责分离；
- 需要输出私有值、扩大文件范围或连接未授权环境。

Candidate 到期时不得创建 Approved Manifest，必须先重新签发 Candidate 并重新完成人工审核。

## 五、未来任务完成后的门禁

Approved Manifest 创建与校验完成后仍必须：

1. 由用户独立审核 Approved Manifest 的低敏摘要；
2. 创建独立 handoff，回填 Approved Manifest 的低敏验证结果；
3. 重新冻结 Approved Manifest 是否仍有效；
4. 重新冻结是否允许启动 Stage D；
5. 明确 Runner、dry-run、Lease 与数据库读取范围。

Approved Manifest 的创建、校验或 Required Check 通过均不自动授权 Stage D、Runner、dry-run、Lease 或 A2-P1。

## 六、项目级顺序

```text
Source／Candidate v2 Governance（已完成，PR #818）
→ Source v2 handoff（已完成，PR #819）
→ Stage C Candidate 生成、重新签发与人工审核（已完成，PR #820）
→ V2-MIG01-A2-APPROVED-MANIFEST-CREATION-VALIDATION-01（唯一下一任务，尚未启动）
→ 独立 handoff
→ 用户独立审核 Approved Manifest 低敏摘要
→ 重新冻结 Stage D
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

该顺序不改变 MIG-01～MIG-06 的相对顺序。当前只完成 Stage C handoff，Approved Manifest 创建与校验尚未启动。

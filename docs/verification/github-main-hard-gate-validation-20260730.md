# GitHub `main` 仓库硬门验证记录

## 1. 文档定位

- 任务：`V2-MIG01-A2-GOVERNANCE-FOUNDATION-01-STAGE-A-COMPLETE`
- 日期：2026-07-30
- 时区：`Asia/Shanghai`
- 仓库：`love1252/zmtg-clean`
- 启动基线：`56638dc3595d7bd60a47b08810c50df256d0b87c`
- 仓库可见性：公开（`public`）
- 执行账号：`love1252`
- 仓库权限：`ADMIN`

本文只记录 Stage A 的低敏配置与验证证据，不记录 Token、认证 Header、Cookie、环境变量值、真实 Manifest、数据库信息或个人隐私。

## 2. 启动前状态

- `main` 与 `origin/main` 均为启动基线；
- `main.protected=false`；
- `GET /branches/main/protection` 返回 `404 Branch not protected`；
- 仓库 Ruleset 数量为 `0`；
- 对 `main` 实际生效的 Ruleset 数量为 `0`；
- 仓库允许 Merge Commit、Squash Merge 和 Rebase Merge；
- Auto-merge 未启用；
- 本阶段未修改仓库级合并方式。

启动前回退语义为：如验证 PR 成功合并前 Stage A 无法完整验证，则删除本阶段创建的 `main` Branch Protection，并确认 `main.protected=false`。

## 3. Required Check 唯一身份

Required Check 从 PR #801 的成功 Head 与真实 GitHub Actions Run 中读取，不使用记忆值。

| 项目 | 证据 |
|---|---|
| Context／Job | `最小架构与质量门禁` |
| Check Run ID | `90656349787` |
| GitHub App ID | `15368` |
| GitHub App slug | `github-actions` |
| Workflow | `架构与质量门禁` |
| Run ID | `30475582456` |
| Event | `pull_request` |
| Head | `2a62d65393b4f96a3ead7ec6daeed5708f5a2b62` |
| Conclusion | `success` |

同一 Head 上该 Context 与 App 来源唯一。

## 4. `main` Branch Protection

最终读回配置为：

- `main.protected=true`；
- Required Status Checks 精确为一个：
  - Context：`最小架构与质量门禁`；
  - App ID：`15368`；
- `strict=true`，要求 PR 分支基于最新 `main`；
- `enforce_admins=true`；
- Pull Request Review Protection 已启用；
- `required_approving_review_count=0`；
- 不要求 Code Owner Review；
- 不要求 Last Push Approval；
- 无 Pull Request Bypass Allowance；
- 无推送白名单；
- `required_linear_history=false`；
- `allow_force_pushes=false`；
- `allow_deletions=false`；
- `block_creations=false`；
- `required_conversation_resolution=false`；
- `lock_branch=false`；
- `allow_fork_syncing=false`。

首次配置请求同时提交 legacy `contexts` 与精确 `checks`，GitHub 当前 API 以 `422` 拒绝，未创建保护。随后改用 `checks + app_id` 的精确来源绑定并成功应用；读回响应会同时物化对应 `contexts`。

## 5. 回退能力

回退调用为：

```text
DELETE /repos/love1252/zmtg-clean/branches/main/protection
```

一次保守的探针脚本异常曾触发原子回退；随后实时读回 `main.protected=false`，证明当前账号具备回退能力。完整探针重新开始前已重新应用并逐字段核对同一目标配置。

该回退只用于验证 PR 合并前 Stage A 无法原子完成的场景。验证 PR 成功合并后不自动回退；后续设置变更必须另行授权。

## 6. 一次性探针分支

- 分支：`governance-hard-gate-probe-20260730`
- 远端原始 SHA：`56638dc3595d7bd60a47b08810c50df256d0b87c`
- 本地空提交：`ed623e8690a6aa84c2a9ad2fe44ddee11ca7a170`

| 操作 | 退出码 | 结果 | 低敏服务端原因 |
|---|---:|---|---|
| 普通直接 Push | `1` | 被拒绝，远端 SHA 未变化 | `GH006`；必须通过 PR；Required Check 尚未满足 |
| 显式 `force-with-lease` | `1` | 被拒绝，远端 SHA 未变化 | `GH006`；必须通过 PR；Required Check 尚未满足 |
| 删除分支 | `1` | 被拒绝，远端分支仍存在 | `GH006`；`Cannot delete this branch` |

三项拒绝验证完成后，探针保护、本地分支和远端分支均已删除；`main` 保护保持启用。

## 7. 验证 PR 负向阶段

- PR：#804
- Base：`56638dc3595d7bd60a47b08810c50df256d0b87c`
- 负向 Head：`4f65ce0170817d8928abe1e41319fbf22a8251eb`
- 临时违规文件：`database/hard-gate-probe-20260730.txt`
- 负向 Run：`30481398548`
- 负向 Job：`90676107324`

Pending 证据：

- Required Check 状态为 `IN_PROGRESS`；
- PR `mergeStateStatus=BLOCKED`；
- 未执行合并。

Failure 证据：

- Run 与 Job 的结论均为 `failure`；
- 失败步骤为“执行增量架构检查”；
- 失败规则为 `AQ001_SECOND_DATABASE_ROOT`；
- 失败路径为 `database/hard-gate-probe-20260730.txt`；
- lint、typecheck、完整测试和 build 因前序失败被跳过；
- PR `mergeStateStatus=BLOCKED`；
- `main` 未变化。

负向验证完成后已从最新 `main` 重建同名分支。负向文件和负向提交不属于最终分支历史。

## 8. 验证 PR 正向阶段

第一轮正向证据：

- Head：`b53036f0e90ac535ee77f89a0f6b9a9f2119ad42`；
- Run：`30481588037`；
- Job：`90676753313`；
- Run、Job 与 Required Check 结论均为 `success`；
- 环境核对、安装依赖、架构检查器自测、增量架构检查、lint、typecheck、完整测试和 build 均实际执行并成功；
- build 未跳过；
- 成功后 PR `mergeStateStatus=CLEAN`。

本段证据回填会生成新的最终 Head。最终 Head 对应的 Run／Job 记录在 PR #804 与 Stage A 交付报告中，不在本提交中自引用；合并前该新 Run 必须再次完成全部质量步骤并成功。

最终阶段必须满足：

- PR 保持 Open + Ready；
- 相对最新 `main` 精确为一个提交；
- 唯一修改文件为本文；
- 环境核对、安装依赖、架构检查器自测、增量架构检查、lint、typecheck、完整测试和 build 均实际执行并成功；
- build 未跳过；
- Required Check 对最终 Head 为 `success`；
- PR 基于最新 `main`；
- `mergeStateStatus=CLEAN` 或 GitHub 等价可正常 Merge Commit 状态；
- 不需要 Reviewer、Admin Bypass 或 Auto-merge。

## 9. 禁止范围与零改动

Stage A 未修改：

- 业务代码、API、UI 或 Runtime；
- Schema、Migration、journal 或 snapshot；
- Workflow、CI、package 或 lock；
- 既有架构、accepted 决策或 handoff；
- 仓库级合并方式。

Stage A 未读取真实 Manifest、Secret、Token、PII 或环境变量值，未连接数据库、服务器或业务外部环境。

Stage B、Runner、Parser、Runbook、Manifest 投影、执行 Lease、Migration Lease、A2-P1、A2-P2 及其他下游任务均未启动。

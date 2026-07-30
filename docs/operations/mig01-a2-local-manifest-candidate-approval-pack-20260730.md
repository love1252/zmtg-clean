# MIG-01A2 本地验收 Candidate 低敏审批包

## 1. 文档定位

- 原始交付任务：`V2-MIG01-A2-STAGE-C-REAL-SOURCE-AND-CANDIDATE-01`
- 重新签发任务：`V2-MIG01-A2-STAGE-C-CANDIDATE-PRIVATE-OUTPUT-REISSUE-01`
- 阶段：Stage C
- 冻结 Base：`2e14cfd2cec73cd3d8dc08274ba70763402798bb`
- 状态：`review_pending`
- 用户决策状态：`accepted_for_approved_manifest_preparation`
- 交付方式：用户人工审核已完成；经用户授权进入正式审查（Ready）并使用 Merge Commit 合并
- 文档性质：低敏审批摘要，不包含 Source／Candidate 正文，不是 Approved Manifest

## 2. 低敏验证结果

| 项目 | 结果 |
|---|---|
| Candidate 数量 | `1` |
| Candidate version | `mig01-a2-candidate/v2` |
| Source version | `mig01-a2-candidate-source/v2` |
| Source type | `local_acceptance_user_authorized_input` |
| Policy version | `mig01-a2-local-acceptance-context-policy/v1` |
| Source authorization 已确认 | `true` |
| tenant 父记录存在 | `true` |
| Source／Candidate exact shape | `true` |
| Source digest 校验 | `true` |
| Candidate digest 校验 | `true` |
| Context Policy 校验 | `true` |
| reviewStatus | `review_pending` |
| generatedAt | `2026-07-30T11:07:17.231Z` |
| expiresAt | `2026-08-06T11:07:17.231Z` |

## 3. Candidate 重新签发记录

- 旧 Candidate 因一次本地普通输出中的低敏引用回显而失效。
- 未确认 Secret、Token、密码、连接串或 PII 泄漏。
- 旧 Candidate 私有正文与私有文件未进入 Git、PR 附件或 GitHub。
- `old_candidate_logical_deletion=complete`。
- 新 Candidate 已轮换 Source Authority、Generator、Reviewer、时间和 digest；本文件不记录任何原值。
- 新 Candidate 数量仍为 `1`，审核状态仍为 `review_pending`。
- 普通文件删除不等于介质级物理擦除。
- 新 Candidate 已由用户人工审核通过，可作为未来独立 Approved Manifest 创建任务的审核依据；重新签发本身不等于用户批准。

## 4. 正文保管与人工审核

- Source、Candidate 与 Review State 正文位于仓库外受控私有目录；本文件不记录实际路径。
- Source、Candidate 与 Review State 私有正文未进入 Git、PR 附件或 GitHub。
- 低敏引用曾在一次本地普通输出中回显；未进入 Git、PR、GitHub 或最终报告，该事件已通过旧 Candidate 失效与重新签发处理。
- Candidate payload 仍为 `candidate`，私有 Review State 仍为 `review_pending`；用户人工审核结论作为独立低敏治理记录，不伪造 Candidate 或 Review State 的状态迁移。
- Candidate 人工审核不等于创建、批准或接受 `mig01-a2/v1` Approved Manifest。
- 本次重新签发后的 Candidate 在生成完成后，如 Candidate 内容、Base、Policy、文件权限或身份、digest、Reviewer 发生变化，或用户拒绝时，则提前失效。
- 到达 `expiresAt` 后不得自动删除；删除或延期需要后续明确任务。

## 5. 重新签发后、Required Check 前验证

- 旧私有 Candidate 内存验证：`pass`。
- tenant 父记录存在：`true`。
- Source／Candidate exact shape、Source／Candidate digest 与 Context Policy 校验：全部 `true`。
- Candidate 数量：`1`；审核状态：`review_pending`。
- 私有根目录与新任务目录权限：`0700`；4 个私有 JSON 文件权限：全部 `0600`。
- 本地数据库前后只读计数一致：Journal `39`、tenants `2`、三张 A1 表均为 `0`。
- Candidate v1、v2、Source v2 与 Approved Contract 定向测试：7 个文件、344/344 项通过。
- `pnpm lint`：通过，0 error；保留 4 个既有 warning。
- `pnpm typecheck`：通过。
- `TZ=Asia/Shanghai pnpm test`：420/420 个测试文件、6121/6121 项测试通过。
- `TZ=Asia/Shanghai pnpm build`：通过，101/101 个静态页面生成。
- `git diff --check`：通过；仓库修改范围仍为唯一审批 Markdown。
- 零泄漏扫描：私有 reference、tenant／institution 引用原值、Source／Candidate digest 原值、私有路径及 Source／Candidate／Review State 正文命中均为 `0`。
- 数据库写入、Runner、dry-run、Lease 与 Approved Manifest 创建数量均为 `0`。

## 6. 用户人工审核结论

- 用户已经人工审核通过当前重新签发的 Candidate v2。
- 决策时间：`2026-07-30T11:55:06.576Z`。
- 低敏决策状态：`accepted_for_approved_manifest_preparation`。
- Candidate payload 的 `candidateStatus` 继续为 `candidate`。
- 私有 Review State 继续保持 `review_pending`；未新增或伪造 `approved` Review State。
- 本次结论只允许当前 Candidate 作为未来独立 Approved Manifest 创建与校验任务的审核依据，不表示 Approved Manifest 已创建。
- Candidate digest 不得复用为 Approved Manifest digest。
- 下一步只允许在独立任务中创建并校验新的 `mig01-a2/v1` Approved Manifest。
- Approved Manifest 必须使用自己的 approval 字段、`c14n-v1` 和新的 SHA-256 digest。
- 未来 Approver 与未来 Operator 必须职责分离。
- Candidate 继续受 `expiresAt` 和提前失效条件约束。
- 本次人工审核不授权 Runner、dry-run、`--execute`、Lease、Stage D、A2-P1、A2-P2 或数据库写入。

## 7. 当前阻断与禁止推进

- `candidate_human_approval_missing` 已关闭。
- `real_manifest_missing` 仍未关闭。
- `real_environment_dry_run_unavailable` 仍未关闭。
- 本阶段没有创建 Approved Manifest。
- 本阶段没有运行 Runner、dry-run、Migration、Seed、Provisioning 或数据库写入。
- 本阶段没有签发或消费执行 Lease／Migration Lease。
- Stage D、A2-P1、A2-P2、BASE-02、Writer、Reader 与其他下游任务均不可启动。
- 单提交、单文件范围、Candidate 最终私有复核和新 Head 的 Required Check 通过后，经用户授权，本 PR 进入正式审查（Ready）并使用 Merge Commit 合并。

# Phase 23 HIS 连接配置凭证补偿 dead letter manual review recovery 边界规划

## 范围声明

- 本文档只规划 job `dead_lettered` 与 operation `compensation_failed` 的短暂不一致识别、恢复策略和后续拆分，不实现运行时代码。
- 本次不修改 `src/**`、`drizzle/**`、schema / migration、API route、service、audit runtime、worker runtime、job queue runtime、operation repository runtime、runner / scheduler / cron、provider、真实凭证、测试连接、真实 HIS adapter、package / lockfile、`.env` 或 `.codex/**`。
- 当前 main 基线为 `b2bacb61591e9dfef1c7cf44a83e9694ad793685`。
- 本文档承接 retry exhausted dead letter runtime、operation failed manual review repository runtime 和 retry exhausted manual review worker runtime 最小边界；目标是给后续 recovery / review flow 拆分清楚边界。

## 开始前只读盘点结论

1. 当前 job queue repository 能通过 `getCredentialCompensationJobByOperation` / `getCredentialCompensationJobByConnection` 单条读取并识别 `dead_lettered` job，但没有批量列出 `dead_lettered` job 的专用入口。
2. 当前 operation repository 能通过 `getCredentialCompensationOperationByOperationId` / `getCredentialCompensationOperationByConnection` 单条读取并识别 `compensation_failed` operation，但没有批量列出 `compensation_failed` operation 的专用入口。
3. 当前没有直接根据 job + operation 组合批量识别 job `dead_lettered` + operation `compensation_failed` 短暂不一致的能力；只能由调用方分别单条读取后判断。
4. 后续 runtime 若要自动 recovery，建议新增 repository 查询方法；该查询只返回安全状态组合，不应暴露 provider 原始错误或凭证信息。
5. 本次 Plan 不需要新增 schema / migration；现有表已有 job state、dead letter reason、operation state、三元 scope 和基础索引。
6. 本次不需要修改 worker；后续 recovery 不应塞回 worker 主执行路径。
7. 本次不需要修改 job queue repository；后续只读查询能力应单独 PR 实现。
8. 本次不需要修改 operation repository；后续 recovery 写回可复用 `markFailedCredentialCompensationOperationManualReviewRequired`，查询能力可按需要单独补。
9. 当前应先做文档规划，而非 runtime。
10. recovery / review flow 应独立于 worker 主执行路径。
11. recovery 写回应调用 `markFailedCredentialCompensationOperationManualReviewRequired`，只推进 operation 到 `manual_review_required`。
12. recovery 不允许 requeue。
13. recovery 不允许重新调用 provider。
14. recovery 后续需要 audit integration，但 audit 应后置单独规划与实现。
15. recovery 后续可能需要 service / route 或人工复核视图，但本次不实现。
16. runner / scheduler / cron 应后置，不在本次文档 PR 实现。
17. 可以不接真实 provider。
18. 可以不处理真实凭证、测试连接或真实 HIS adapter。
19. 本次 docs-only Plan 没有阻塞；如果进入 runtime，repository 查询、audit、service / route、runner / scheduler 都应拆后续 PR。

## 问题定义

retry exhausted manual review worker runtime 已在 job dead letter 成功后尝试推进 operation manual review。该写回如果失败，系统允许短暂出现以下安全不一致：

- job 已进入 `dead_lettered`。
- job 的 `deadLetterReason` 为 `retry_exhausted`。
- operation 仍停留在 `compensation_failed`。
- job 不再自动 requeue。
- operation 尚未进入 `manual_review_required`，人工复核入口可能暂时看不到这条业务状态。

该状态不代表补偿成功，也不应触发新的 provider 调用。它代表调度终止已完成，但业务复核终态写回未完成，需要独立 recovery / review flow 识别并幂等推进。

## 默认恢复方向

- recovery / review flow 独立于 worker 主路径。
- 只识别安全状态组合，不自动重新执行 provider。
- 优先恢复 job `dead_lettered` + operation `compensation_failed` 的不一致。
- 恢复动作只推进 operation manual review。
- 不回滚 job dead letter。
- 不 requeue。
- 不递增 operation retry count。
- 不新增 schema / migration，除非后续 runtime 证明现有查询无法稳定表达。
- audit integration 后置。
- runner / scheduler 后置。
- service / route 后置。
- real provider、real credential、test connection、HIS adapter 后置。

## 安全状态组合识别

后续查询或 review flow 只应识别以下组合：

- `tenantId`、`connectionId`、`operationId` 三元 scope 完全一致。
- job `jobState` 为 `dead_lettered`。
- job `deadLetterReason` 为 `retry_exhausted`。
- operation `state` 为 `compensation_failed`。
- operation `manualReviewRequired` 为 `false`。
- job 与 operation 的 `failureCategory` 均属于已知安全枚举。

以下组合不应进入该 recovery：

- job 仍为 `queued`、`claimed`、`running`、`failed`、`manual_review_required`、`succeeded` 或 `cancelled`。
- job dead letter reason 不是 `retry_exhausted`。
- operation 已为 `manual_review_required`，应视为已恢复或由人工复核继续处理。
- operation 为 `compensation_pending`、`compensation_running` 或 `compensation_succeeded`。
- scope 不一致、缺少 connectionId / operationId、tenant 不一致或枚举不安全。

## repository 查询能力规划

当前单条读取方法足够支持人工指定 operationId 的点查恢复，但不适合批量 recovery 或复核列表。后续建议新增窄语义只读查询，名称可按实现风格确定，例如：

- job queue repository 新增按租户列出 retry exhausted dead letter job 的方法。
- operation repository 新增按租户列出 compensation failed operation 的方法。
- 或新增组合查询方法，直接返回 job `dead_lettered` + operation `compensation_failed` 的 recovery candidate。

推荐优先考虑组合查询，原因是 recovery 目标本身依赖 job 与 operation 的一致 scope；由 repository 层筛掉不安全组合，可以减少上层重复判断。

查询输入建议：

- `tenantId`
- `now`
- `limit`
- 可选 `updatedBefore` 或 `deadLetteredBefore`，用于避免刚写入后的瞬时竞争。

查询输出建议：

- `tenantId`
- `connectionId`
- `operationId`
- job state
- job dead letter reason
- operation state
- operation manual review flag
- 安全 failure category
- job completedAt
- operation updatedAt

查询输出不应包含：

- raw HIS payload。
- provider raw error。
- SQL。
- stack。
- `DATABASE_URL`。
- 凭证明文、token、secret path。
- request、header、query、localStorage 内容。

## 幂等恢复动作

恢复动作只调用：

`operationRepository.markFailedCredentialCompensationOperationManualReviewRequired({ tenantId, connectionId, operationId })`

幂等策略：

- 如果 operation 仍是 `compensation_failed`，写入 `manual_review_required`。
- 如果 operation 已经是 `manual_review_required`，后续 runtime 可按安全已恢复处理；是否让 repository 返回 `ok` 或由 service 映射为 skipped，应在 runtime PR 明确。
- 如果 operation 是 `compensation_succeeded`，不恢复，返回稳定拒绝结果。
- 如果 operation 是 `compensation_pending` 或 `compensation_running`，不恢复，交由对应 worker / stale recovery 边界处理。
- 如果 job 已不是 `dead_lettered`，不恢复。
- 如果 job reason 不是 `retry_exhausted`，不恢复。

恢复失败时：

- 不回滚 job dead letter。
- 不 requeue。
- 不重新调用 provider。
- 不递增 operation retry count。
- 不写入凭证、provider 原始错误或 HIS 原始响应。
- 返回稳定 repository / recovery result，供后续 audit 或人工视图展示安全摘要。

## 人工复核视图规划

后续可以新增人工复核视图，但应晚于 repository 查询与 recovery service 的最小实现。人工视图只展示安全字段：

- 租户内 connection 名称或 connectionId。
- operationId。
- job dead letter reason。
- failure category。
- job completedAt。
- operation updatedAt。
- 当前 operation state。
- 可执行动作：推进 operation manual review。

人工视图不展示：

- 凭证明文。
- provider raw payload。
- raw HIS payload。
- SQL、stack、连接串。
- 外部系统 token 或 secret path。

人工操作应先走 service / route 白名单，并在 audit integration 完成后记录审计事件。本次不实现该视图。

## audit integration 规划

recovery 最终应有 audit，但应独立拆分：

- 记录 recovery candidate 被识别。
- 记录 operation manual review 推进成功。
- 记录 repository_error / conflict / invalid_state_transition 等失败结果的安全摘要。
- metadata 只允许白名单字段。
- 不写 raw HIS payload、provider raw error、SQL、stack、`DATABASE_URL` 或凭证信息。

audit 是否 fail closed 需要后续单独决策。推荐在 runtime 最小能力完成后再接 audit，避免一个 PR 同时引入 recovery、人工操作和审计失败收口。

## service / route 规划

service / route 应后置，并分两类：

- 后台 recovery service：按 tenant 扫描 candidate，幂等推进 operation manual review。
- 人工 review route：只允许有权限的租户内用户查看 candidate 并触发恢复动作。

两类入口都必须：

- 使用可信租户上下文。
- 白名单解析输入。
- 不从 request、header、query 或 localStorage 推断敏感业务字段。
- 不返回 repository 原始异常。
- 不暴露 SQL / stack / DATABASE_URL。

本次不新增 API route，不修改 service。

## runner / scheduler 规划

runner / scheduler 后置。后续若要自动运行，应满足：

- 每次按 tenant 分批处理。
- 使用 `limit` 限制批量规模。
- 对同一 candidate 重复执行保持幂等。
- repository_error 不阻塞后续 candidate。
- conflict / invalid_state_transition 输出安全结果。
- 不启动后台常驻进程，除非另开 runner / scheduler / cron PR。

本次不实现 runner / scheduler / cron。

## 与 worker 主路径的关系

recovery 不应回到 worker 主执行路径：

- worker 主路径负责一次 job 的 claim、provider 结果处理、requeue、dead letter 和最小 operation manual review 尝试。
- recovery 负责 job dead letter 已经成功但 operation manual review 未成功的后续补偿。
- recovery 不应再次 claim job。
- recovery 不应修改 job retry count、claimId、claimVersion、lockedUntil 或 nextAttemptAt。
- recovery 不应再次调用 provider。

该拆分能避免 worker 主路径承担人工复核列表、审计补写、批量扫描和运营操作入口。

## 后续 PR 拆分建议

1. repository 查询能力最小 PR：只新增安全 candidate 查询与测试，不做 service / route / audit / runner。
2. recovery service 最小 PR：调用 candidate 查询和 `markFailedCredentialCompensationOperationManualReviewRequired`，覆盖幂等和失败收口。
3. 人工复核视图规划或实现 PR：展示 candidate 和安全动作入口。
4. audit integration PR：记录 recovery 识别、成功、失败和人工操作。
5. runner / scheduler PR：按租户批量执行 recovery。
6. service / route PR：如需人工触发或后台触发，单独接入权限和输入白名单。
7. real provider / real credential / test connection / HIS adapter Plan：继续后置，不与 recovery 混合。

## 验证建议

后续 runtime PR 至少覆盖：

- job `dead_lettered` + reason `retry_exhausted` + operation `compensation_failed` 被识别为 candidate。
- job reason 非 `retry_exhausted` 不被识别。
- operation 已 `manual_review_required` 不重复恢复。
- operation `compensation_succeeded` 不恢复。
- scope 不一致不恢复。
- tenant 隔离。
- limit 生效。
- recovery 成功只推进 operation manual review。
- recovery 失败不回滚 job dead letter。
- recovery 失败不 requeue。
- recovery 失败不调用 provider。
- recovery 失败不递增 operation retry count。
- 结果不暴露 SQL、stack、`DATABASE_URL`、raw HIS payload、provider raw error 或凭证信息。

## 本次结论

- 本次满足 docs-only Plan 条件。
- 当前不应实现 runtime。
- 当前不需要 schema / migration。
- 当前不需要修改 `src/**` 或 `drizzle/**`。
- recovery / review flow 应独立于 worker 主执行路径。
- recovery 只推进 operation manual review，不回滚 job dead letter，不 requeue，不重新调用 provider。
- audit、service / route、runner / scheduler、人工复核视图和真实外部系统都应后置拆分。

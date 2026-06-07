# Phase 23 HIS 连接配置凭证补偿 retry exhausted dead letter 边界规划

> 日期：2026-06-07
> 状态：仅文档规划。本轮只规划 retry exhausted dead letter runtime 最小边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不修改 job queue repository 或 operation repository，不新增 API route，不接 service，不接 audit，不接 runner / scheduler / cron，不调用真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

## 当前已完成能力

- retry policy helper 已覆盖 `retryable_failure`、`provider_unavailable`、`timeout`、`unsafe_unknown`、`validation_failed`、`repository_error` 和 `success`。
- worker 已在 `retryable_failure` 与 `provider_unavailable` 的 failed completion 后调用 retry policy helper。
- worker 已能在 retry policy 返回 `requeue` 时调用 `requeueCredentialCompensationJob`。
- requeue 成功后，worker 已调用 `incrementCredentialCompensationOperationRetryCount` 对齐 operation retry count。
- job queue repository 已有 `markCredentialCompensationJobDeadLettered`。
- job queue repository 已有 `retry_exhausted` dead letter reason。
- job queue repository dead letter 写回已绑定 `tenantId + connectionId + operationId + claimId + claimVersion`。
- operation repository 已能把 running operation 标记为 `compensation_failed` 或 `manual_review_required`。

## 当前缺口

- retry policy helper 已能返回 `dead_letter`，但 worker 尚未实现 retry exhausted dead letter runtime。
- 当前 worker 在 retry policy 返回非 `requeue` 且非 `validation_failed` 时返回 `null`，调用方随后返回稳定 `ok`，因此 retry exhausted 目前只停留在 job failed + operation failed。
- retry exhausted 后是否进入 manual review 尚未规划为 runtime。
- compensation audit integration 尚未实现。
- service 创建 operation + job queue 尚未接入。
- runner / scheduler / cron 尚未实现。
- 真实 provider、真实凭证、测试连接和真实 HIS adapter 均尚未接入。

## 只读盘点结论

1. 当前 retry policy helper 仅在输入 jobState 为 `failed`、retry counter 合法、provider result 不是 `success` / `timeout` / `unsafe_unknown` / `validation_failed` / `repository_error`，且 `retryCount >= maxRetryCount` 时返回 `dead_letter`，reason 为 `retry_exhausted`。
2. 在当前 worker 可达路径里，`dead_letter` 只对应 `retryable_failure` 或 `provider_unavailable` 达到上限。
3. 当前 worker 对 `dead_letter` 尚未写 dead letter，实际收口为 job failed + operation failed 后返回 `ok`。
4. job queue repository 已有 `markCredentialCompensationJobDeadLettered`，可复用。
5. dead letter 写回必须携带 `tenantId + connectionId + operationId + claimId + claimVersion + now + deadLetterReason`。
6. retry exhausted dead letter 最小 runtime 可以只 dead letter job。
7. operation 建议保持 `compensation_failed`，不在 dead letter runtime 中推进 `manual_review_required`。
8. retry exhausted manual review 必须另开 PR。
9. dead letter 后不递增 operation retry count，因为没有发生新的 requeue 或新的补偿尝试。
10. 现有 dead letter repository 会清理 `lockedUntil` 并写入 `completedAt`；`claimId`、`claimedBy`、`claimedAt` 和 `claimVersion` 保留为终态上下文。
11. dead letter reason 使用现有 `retry_exhausted`。
12. 不需要新增 dead letter reason、enum 或 schema。
13. 不需要新增 schema / migration。
14. 不需要修改 job queue repository。
15. 不需要修改 operation repository。
16. 不需要接 audit。
17. 不需要接 service / route。
18. 不需要接 runner / scheduler。
19. 可以不接真实 provider。
20. 可以不处理真实凭证、测试连接或真实 HIS adapter。
21. 必须另开的内容包括 retry exhausted manual review runtime、compensation audit integration、service 创建 operation + job queue、runner / scheduler / cron、真实 provider / 测试连接 / 真实 HIS adapter。

## 触发条件

后续 dead letter runtime 只处理 retry policy 返回 `dead_letter` 的场景：

- provider result 为 `retryable_failure` 或 `provider_unavailable`。
- worker 已成功写回 job failed。
- worker 已成功写回 operation failed。
- failed job 读取模型的 `jobState` 为 `failed`。
- failed job 读取模型的 `retryCount >= maxRetryCount`。
- retry policy 返回 `{ decision: 'dead_letter', reason: 'retry_exhausted' }`。

以下场景不进入 dead letter：

- `timeout`：继续归入 manual review 方向。
- `unsafe_unknown`：继续归入 manual review 方向。
- `validation_failed`：不 retry，不 dead letter。
- retry policy `validation_failed`：返回 worker `validation_failed`，不 dead letter。
- `repository_error`：不 retry，不 dead letter，留给恢复流程或人工排查。
- requeue 成功路径：已经由 requeue runtime 和 operation retry count 对齐 runtime 处理。

## job dead letter 与 operation 状态边界

job 是 dead letter runtime 的唯一写入目标：

- job 从 `failed` 写为 `dead_lettered`。
- `deadLetterReason` 写为 `retry_exhausted`。
- `lockedUntil` 清空。
- `completedAt` 写入当前时间。
- 不创建新 job。
- 不修改 `retryCount`、`maxRetryCount` 或 `nextAttemptAt`。
- 不保存 provider raw error 或 raw HIS payload。

operation 在最小 runtime 中保持 `compensation_failed`：

- 不推进 `manual_review_required`。
- 不回滚 `compensation_failed`。
- 不递增 operation retry count。
- 不写额外 operation metadata。

这样可以把“已达重试上限”与“是否人工复核”拆开，避免一个 PR 同时引入 dead letter runtime、manual review runtime 和 operation 状态联动。

## dead letter 写回边界

后续 worker runtime 建议在 retry policy `dead_letter` 分支调用：

- `jobQueueRepository.markCredentialCompensationJobDeadLettered`
- 输入包含 `tenantId + connectionId + operationId + claimId + claimVersion + now`
- `deadLetterReason` 固定为 `retry_exhausted`

写回结果建议映射：

- `ok`：worker 返回稳定 `ok`，providerResult 保留原始安全分类。
- `repository_error`：worker 返回 `repository_error`。
- `not_found`：worker 返回 `not_found`。
- `conflict`：worker 返回 `conflict`。
- `invalid_state_transition`：worker 返回 `invalid_state_transition`。
- `validation_failed`：worker 返回 `validation_failed`。

所有结果都不得透传 raw error、SQL、stack 或 `DATABASE_URL`。

## 失败收口与短暂不一致

dead letter 写回失败时，不回滚 operation failed。

允许的短暂状态：

- job 已经从 running 写为 `failed`。
- operation 已经写为 `compensation_failed`。
- dead letter 写回因为 repository_error、旧 claim conflict 或状态冲突失败。

这种状态仍是安全的失败状态，不代表补偿成功，也不会重新排队。后续可以由恢复流程、manual review runtime 或人工排查处理。本轮不实现恢复流程。

## claimId / claimVersion 边界

- dead letter 写回必须继续使用 claim 写回保护。
- `claimId + claimVersion` 来自当前执行输入和 job failed 写回后的 read model 语义。
- 旧 claim 写回应由 repository 返回 `conflict`。
- worker 不应绕过 claim 校验直接按 operationId 写终态。
- worker 不从 request、header、query 或 localStorage 获取 claim。

## dead letter reason 边界

最小 runtime 只使用现有 `retry_exhausted`。

不新增 reason：

- 不新增 `provider_timeout_exhausted`。
- 不新增 `unsafe_unknown_exhausted`。
- 不新增 `manual_review_exhausted`。
- 不新增 audit 专用 reason。

如果后续 audit integration 需要更细的 action / reason / result，应在 compensation audit PR 中规划，不在 dead letter runtime 中扩展 enum。

## operation retry count 边界

dead letter 后不递增 operation retry count：

- operation retry count 对齐只发生在 requeue 成功之后。
- retry exhausted 没有产生新的 requeue。
- retry exhausted 没有产生新的 provider attempt。
- job `retryCount` 已经达到上限，不应再通过 operation retry count 制造新的尝试次数。

如果后续业务希望在 dead letter 时记录“耗尽次数快照”，应另开 operation read model 或 audit 规划，不复用 operation retry count 递增。

## manual review 后置边界

retry exhausted dead letter runtime 与 manual review runtime 分开：

- dead letter runtime 只把 job 终止在 `dead_lettered`。
- manual review runtime 才决定是否把 operation 推进 `manual_review_required`。
- manual review runtime 应单独规划触发条件、operation 状态、job 状态、人工复核原因、恢复策略和 audit 语义。

本轮不实现 retry exhausted manual review runtime。

## 租户隔离与敏感信息边界

- 所有写回继续绑定可信 `tenantId + connectionId + operationId`。
- dead letter 写回继续受 `claimId + claimVersion` 保护。
- 不读取 request、header、query 或 localStorage。
- 不保存 raw HIS payload。
- 不保存 provider raw error。
- 不暴露 SQL、stack 或 `DATABASE_URL`。
- 不把真实凭证、secret path、provider raw payload 或 HIS adapter 响应写入 job / operation。

## 不接入范围

本轮和后续 dead letter 最小 runtime 都不应顺手接入：

- 不新增 schema / migration。
- 不修改 job queue repository。
- 不修改 operation repository。
- 不新增 API route。
- 不修改 service、parser / DTO、provider / storage、权限、audit domain / reason / query whitelist 或 audit repository。
- 不实现 retry exhausted manual review runtime。
- 不接 compensation audit。
- 不接 runner / scheduler / cron。
- 不调用真实 provider。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。

## 测试拆分建议

后续 retry exhausted dead letter runtime PR 建议只修改 worker 与 worker 测试：

- `retryable_failure` 达到上限时调用 `markCredentialCompensationJobDeadLettered`。
- `provider_unavailable` 达到上限时调用 `markCredentialCompensationJobDeadLettered`。
- dead letter 写回必须携带 `tenantId + connectionId + operationId + claimId + claimVersion + now + deadLetterReason`。
- `deadLetterReason` 固定为 `retry_exhausted`。
- dead letter 写回发生在 job failed 与 operation failed 之后。
- dead letter 成功时 worker 返回 `ok`。
- dead letter `repository_error` 时不回滚 operation failed，并返回 `repository_error`。
- dead letter `conflict` 时返回 `conflict`。
- dead letter `invalid_state_transition` 时返回 `invalid_state_transition`。
- dead letter `validation_failed` 或 `not_found` 时返回稳定结果。
- dead letter 后不调用 `requeueCredentialCompensationJob`。
- dead letter 后不调用 `incrementCredentialCompensationOperationRetryCount`。
- dead letter 后不调用 operation manual review。
- `timeout` 与 `unsafe_unknown` 不进入 dead letter。
- `validation_failed` 不进入 dead letter。
- retry policy `validation_failed` 不进入 dead letter。
- 不调用真实 provider、不写 audit、不读 request / header / query / localStorage。
- result 不暴露 SQL、stack 或 `DATABASE_URL`。

repository 测试不需要在该 runtime PR 中扩展，除非运行时实现发现现有 repository 行为无法稳定表达 worker 结果。

## 后续 PR 拆分建议

1. retry exhausted dead letter runtime 最小实现。
2. retry exhausted manual review runtime 规划。
3. retry exhausted manual review runtime 最小实现。
4. dead letter / manual review 恢复流程规划。
5. compensation audit integration。
6. runner / scheduler / cron 独立规划与最小实现。
7. service 创建 operation + job queue 接入。
8. 真实 provider / 测试连接 / 真实 HIS adapter Plan Mode。

拆分原则：

- dead letter runtime 不夹带 manual review。
- dead letter runtime 不夹带 audit。
- dead letter runtime 不夹带 service / route。
- dead letter runtime 不夹带 runner / scheduler。
- dead letter runtime 不夹带真实 provider、真实凭证、测试连接或真实 HIS adapter。

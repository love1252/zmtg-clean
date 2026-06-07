# Phase 23 HIS 连接配置凭证 compensation retry exhausted manual review 边界规划

## 范围声明

- 本文档只规划 retry exhausted manual review 运行时边界，不实现运行时代码。
- 本次不修改 `src/**`、`drizzle/**`、package / lockfile、`.env` 或 `.codex/**`。
- 本次不新增 schema / migration，不新增 API route，不新增 service，不修改 parser / DTO / provider / storage / 权限 / audit / runner / scheduler。
- 当前 main 基线为 `1ac26d4617b97a4fbdf6352dd8f3f09829cf812a`。

## 当前已完成能力

- retry policy helper 已在 failed job 且 `retryCount >= maxRetryCount` 时返回 `dead_letter`，reason 为 `retry_exhausted`。
- worker 已在 `retryable_failure` / `provider_unavailable` 的 job failed + operation failed 成功后调用 `markCredentialCompensationJobDeadLettered`。
- dead letter 写回已绑定 `tenantId + connectionId + operationId + claimId + claimVersion + now + deadLetterReason`。
- dead letter 成功后当前不 requeue、不递增 operation retry count、不推进 job manual review 或 operation manual review。
- job queue repository 已有 `markCredentialCompensationJobManualReviewRequired`，但它只允许 `claimed`、`running`、`failed` job，并要求 `claimId + claimVersion` 匹配。
- operation repository 已有 `markCredentialCompensationOperationManualReviewRequired`，输入为 `tenantId + connectionId + operationId`。

## 只读盘点结论

- retry exhausted manual review 的业务触发点可以放在 dead letter 成功之后，但工程落地应作为单独 recovery / review 流程或独立运行时 PR，不应混入当前 dead letter 最小运行时。
- dead letter 成功后，job 已进入 `dead_lettered`，不应再调用 job manual review；现有 job manual review repository 也不接受 `dead_lettered` 状态。
- operation manual review 可以作为 retry exhausted 的未来最终业务状态，但当前 operation 已先被 worker 写成 `compensation_failed`。
- 现有 operation manual review repository 方法只允许 `compensation_running` 进入 `manual_review_required`，不能直接复用来完成 `compensation_failed` 到 `manual_review_required` 的写回。
- 因此，如果后续运行时要求 dead letter 成功后推进 operation 到 `manual_review_required`，必须先单独规划并实现 operation repository 状态转换边界。
- operation manual review 写回在目标能力上只需要绑定 `tenantId + connectionId + operationId`；不应引入外部传入租户、连接或 operation 之外的定位字段。
- 当前已有 `retry_exhausted` dead letter reason；operation manual review 当前没有 reason 字段，本阶段不新增 manual review reason。
- 如果后续业务要求记录 manual review reason，需要另开 schema / migration / audit Plan Mode；不应在本次文档 PR 中实现。
- 当前不需要修改 job queue repository。
- 当前运行时实现前需要修改 operation repository 状态转换边界；该修改必须另开 PR，本次只记录为阻塞条件。
- 当前不需要扩展 worker result status；manual review 写回失败可以继续映射为既有 `repository_error`、`invalid_state_transition`、`not_found`、`conflict` 或 `validation_failed`。

## 建议触发条件

- 仅当 retry policy 返回 `dead_letter` 且 reason 为 `retry_exhausted` 时，才允许进入 retry exhausted manual review 后续处理。
- 在当前 worker 可达路径中，该条件只对应 `retryable_failure` 或 `provider_unavailable` 达到 `retryCount >= maxRetryCount`。
- `timeout` 与 `unsafe_unknown` 已属于现有 manual review 分支，不应复用 retry exhausted dead letter 后处理。
- `validation_failed`、`repository_error`、retry policy validation failed 或 job / operation 写回失败，不进入 retry exhausted manual review 后处理。

## job dead letter 与 operation manual review 边界

- job dead letter 是调度终态，表示该 job 已耗尽重试并退出 job queue 自动重试。
- operation manual review 是业务终态，表示该补偿 operation 需要人工查看和后续处理。
- job 进入 `dead_lettered` 后，不再调用 job manual review，也不再重排 job。
- operation 是否进入 `manual_review_required` 应由独立的 operation 状态转换负责，不应借 job manual review 间接表达。
- 当前最小可运行状态保持为 job `dead_lettered` + operation `compensation_failed`。
- 未来具备 operation 状态转换能力后，建议在 dead letter 成功后再尝试写回 operation `manual_review_required`。

## operation manual review 写回边界

- 写回输入只使用 `tenantId + connectionId + operationId`。
- 不携带 raw HIS payload、provider raw error、SQL、stack、`DATABASE_URL`、凭证明文、token 或外部系统原始响应。
- 不依赖 `claimId` 或 `claimVersion` 推进 operation manual review；`claimId + claimVersion` 只属于 job dead letter 写回保护。
- 不递增 operation retry count；retry exhausted 已经代表当前 job 调度重试结束。
- 不新增 manual review reason 字段；如需 reason，另开 schema / audit 规划。

## manual review 写回失败收口

- 如果 job dead letter 成功，而 operation manual review 写回失败，不回滚 job dead letter。
- 允许短暂出现 job `dead_lettered` 但 operation 仍为 `compensation_failed` 的不一致。
- 失败结果映射为现有稳定 worker result，不新增 worker result status。
- 后续可由 recovery / review flow 或人工运营视图识别该不一致并重试 operation manual review 写回。
- 不把 repository 异常细节、SQL、stack、连接串、凭证明文或 provider 原始错误写入日志或响应。

## 不接入内容

- 不接 compensation audit；audit integration 后置。
- 不接 service / route；service 创建 operation + job queue 后置。
- 不接 runner / scheduler / cron；常驻调度后置。
- 不接真实 provider。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不保存 raw HIS payload。
- 不保存 provider raw error。

## 测试拆分建议

- operation repository 状态转换 PR：覆盖 `compensation_failed` 到 `manual_review_required` 的允许路径、租户隔离、连接隔离、operationId 隔离、非法状态拒绝和 repository_error 脱敏。
- worker retry exhausted manual review PR：覆盖 dead letter 成功后尝试 operation manual review、失败不回滚 dead letter、失败映射既有 worker result、不调用 job manual review、不递增 operation retry count。
- recovery / review flow PR：覆盖 job `dead_lettered` + operation `compensation_failed` 的不一致识别和幂等重试。
- audit integration PR：覆盖 reason、action、result、metadata 白名单、audit fail closed 或 best effort 取舍，并确认不写敏感信息。
- runner / scheduler PR：覆盖批量处理、limit、租户隔离、锁竞争、重复执行和稳定退出。

## 后续 PR 拆分建议

- PR A：operation repository 状态转换边界，明确是否允许 `compensation_failed` 推进到 `manual_review_required`。
- PR B：retry exhausted manual review 运行时最小实现，只在 job dead letter 成功后推进 operation manual review。
- PR C：dead letter / manual review recovery 或人工复核视图规划，处理短暂不一致。
- PR D：compensation audit integration，单独规划 reason、metadata 和失败收口。
- PR E：service / route 接入 operation + job queue 创建。
- PR F：runner / scheduler / cron 接入。
- PR G：真实 provider、真实凭证、测试连接和真实 HIS adapter Plan Mode。

## 本次结论

- 本次满足 docs-only Plan Mode 条件。
- 当前不满足直接实现 retry exhausted manual review 运行时的条件，因为 operation repository 不能从 `compensation_failed` 直接写回 `manual_review_required`。
- 本次不实现 runtime，只把该 repository 状态转换前置条件和后续 PR 拆分写入计划。

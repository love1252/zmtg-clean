# Phase 23 HIS 连接配置凭证补偿 operation retry count 对齐边界规划

> 日期：2026-06-07
> 状态：仅文档规划。本轮只规划 operation retry count 对齐边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不新增 API route，不修改 service、parser / DTO、provider / storage、权限、audit domain / reason / query whitelist 或 audit repository，不实现 operation retry count 运行时，不实现 dead letter / manual review 运行时，不接入 compensation audit，不调用真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter，不新增 runner / scheduler / cron。

## 当前已完成能力

- worker 已在 `retryable_failure` 与 `provider_unavailable` 的 failed completion 后接入 `decideHisConnectionCredentialCompensationRetry`。
- worker 已能在 retry policy 返回 `requeue` 时调用 `requeueCredentialCompensationJob`。
- requeue 写回已携带 `tenantId + connectionId + operationId + claimId + claimVersion + now`。
- job queue repository 已在 requeue 成功时把 job 从 `failed` 回到 `queued`，递增 job `retryCount`，写入 `nextAttemptAt`，并清理 claim、lock、heartbeat、dead letter 与 manual review 元数据。
- job queue repository 已拒绝旧 claim 写回，并在 `retryCount >= maxRetryCount` 时拒绝 requeue。
- operation repository 已有 `incrementCredentialCompensationOperationRetryCount`，按 `tenantId + connectionId + operationId` 绑定 operation。
- operation retry count 递增仅允许在 `compensation_failed` 或 `manual_review_required` 状态执行。
- 当前 worker retry / requeue 运行时未调用 `incrementCredentialCompensationOperationRetryCount`。

## 当前缺口

- requeue 成功后，job `retryCount` 会前进，但 operation `retryCount` 暂不前进。
- worker 尚未定义 job requeue 成功而 operation retry count 递增失败时的稳定结果。
- 当前 worker 结果白名单没有单独表达“job 已重新排队但 operation retry count 对齐失败”的状态。
- retry exhausted 后 dead letter / manual review 运行时尚未实现。
- compensation audit 接入尚未实现。
- runner / scheduler / cron 尚未实现。
- service 创建 operation + job queue 尚未接入。

## 只读盘点结论

1. job `retryCount` 与 operation `retryCount` 应分工明确：job `retryCount` 是调度事实，operation `retryCount` 是业务状态展示与补偿事实对齐。
2. operation retry count 只作为 operation 状态展示和后续排障依据，不参与 job queue 调度，不参与 retry policy 上限判断。
3. requeue 成功后再递增 operation retry count 可以允许短暂不一致。
4. operation retry count 递增失败时不建议回滚 job requeue。
5. operation retry count 递增失败时，worker 应返回稳定 `repository_error` 或后续新增的安全部分对齐状态；当前最小运行时更适合先复用 `repository_error`，是否新增部分对齐状态另开运行时 PR 论证。
6. 短暂不一致需要由后续恢复流程、人工复核和可观测性兜底。
7. 不建议用一个长事务包住 provider execution、job failed、operation failed、job requeue 和 operation retry count 对齐。
8. 本规划不需要新增 schema / migration。
9. 本规划不需要修改 job queue repository。
10. 本规划不需要修改 operation repository。
11. 本规划不接入 audit；audit 语义应在 compensation audit integration 中单独规划。
12. 本规划不接入 service；service 创建 operation + job queue 仍需单独 PR。
13. 本规划不接入 runner / scheduler；调度仍由 job `nextAttemptAt` 和 due list 语义承载。
14. operation retry count 对齐必须另开 runtime PR 实现。
15. retry exhausted dead letter、manual review 分流、audit metadata 和真实 provider / HIS adapter 风险必须后置到各自独立 PR。

## 对齐目标

operation retry count 对齐的目标不是参与调度，而是让 operation 读取模型能反映补偿尝试已经重新排队的次数，便于后续人工排障、运营视图、审计规划和状态恢复判断。

最小目标：

- 只在 job requeue 成功后递增 operation retry count。
- 不让 operation retry count 决定是否 retry。
- 不让 operation retry count 参与 `nextAttemptAt` 计算。
- 不让 operation repository 调用 job queue repository。
- 不让 job queue repository 调用 operation repository。
- 不保存 provider raw error、raw HIS payload、SQL、stack 或 `DATABASE_URL`。

## job retryCount 与 operation retryCount 职责划分

job `retryCount`：

- 是 job queue 的调度事实。
- 由 `requeueCredentialCompensationJob` 在 requeue 成功时递增。
- 与 `maxRetryCount` 一起决定是否允许下一次 requeue。
- 与 `nextAttemptAt` 一起决定 job 何时再次被 due list 取出。
- 必须受 `claimId + claimVersion` 保护。

operation `retryCount`：

- 是 operation read model 的业务状态事实。
- 只用于展示、排障和后续 recovery / manual review 判断。
- 不决定 job 是否可 requeue。
- 不计算 backoff。
- 不替代 job queue 的 `retryCount`、`maxRetryCount` 或 `nextAttemptAt`。
- 可以短暂落后于 job `retryCount`，但应被后续 recovery / manual review / observability 捕获。

## 推荐运行时方案

后续运行时 PR 建议在 worker 的 requeue 成功分支内追加 operation retry count 对齐：

1. provider result 为 `retryable_failure` 或 `provider_unavailable`。
2. worker 完成 job failed 写回。
3. worker 完成 operation failed 写回。
4. retry policy 返回 `requeue`。
5. worker 调用 `requeueCredentialCompensationJob`。
6. job requeue 返回 `ok` 后，worker 调用 `incrementCredentialCompensationOperationRetryCount`。
7. operation retry count 返回 `ok` 时，worker 返回稳定 `ok`。
8. operation retry count 返回 `repository_error`、`invalid_state_transition`、`not_found`、`conflict` 或 `validation_failed` 时，worker 不回滚 job requeue，并返回稳定结果。

当前最小建议：

- `repository_error`：返回 `repository_error`。
- `invalid_state_transition` / `not_found` / `conflict` / `validation_failed`：优先返回对应稳定 worker 结果；如果 worker 结果白名单不够表达，运行时 PR 应先扩展或映射，不在文档 PR 中实现。
- 不新增 raw error 透传。
- 不暴露数据库内部信息。

## 不回滚 job requeue 的理由

job requeue 成功代表下一次补偿调度已经安全落库，且 job queue repository 已完成：

- job state 回到 `queued`。
- job `retryCount` 递增。
- `nextAttemptAt` 更新。
- claim 与 lock 元数据清理。

如果 operation retry count 对齐失败后再尝试回滚 job requeue，会引入新的竞态：

- queued job 可能已经被后续 worker 领取。
- 回滚可能破坏 job queue repository 的 claimVersion 保护。
- 回滚需要新增状态语义或额外事务边界。
- 回滚失败会制造更复杂的不一致。

因此推荐不回滚 job requeue。短暂不一致应被视为可恢复的对齐缺口，而不是调度失败。

## 短暂不一致与兜底

允许的不一致：

- job `retryCount` 已递增，operation `retryCount` 尚未递增。
- job 已回到 `queued`，operation 仍为 `compensation_failed`。
- worker 返回稳定失败结果，但下一次 job 仍可按 `nextAttemptAt` 被调度。

兜底建议：

- 后续恢复流程可以扫描 job / operation 组合，识别 queued job 的 retry count 超前 operation retry count 的场景。
- 后续 manual review 运行时可以在 operation 对齐长期失败、状态不一致或 retry exhausted 时进入人工复核。
- 后续可观测性可以记录安全计数或安全状态，不保存 provider raw error。
- 后续 compensation audit 接入可以为 requeue 与 retry count 对齐定义稳定 action / reason / result。

本轮不实现恢复流程、manual review、可观测性或 audit。

## 事务边界

不建议单个长事务覆盖 provider execution 到 operation retry count 对齐的完整链路。

推荐短事务边界：

- job failed 写回由 job queue repository 独立完成。
- operation failed 写回由 operation repository 独立完成。
- job requeue 写回由 job queue repository 独立完成。
- operation retry count 递增由 operation repository 独立完成。

这样可以保留 repository 边界清晰、claimVersion 保护明确、错误收口稳定，也避免真实 provider 或未来 adapter 调用被包进数据库事务。

## 租户隔离与 claimVersion 保护

- worker 继续只使用可信 `tenantId + connectionId + operationId`。
- requeue 必须继续携带 `claimId + claimVersion`。
- operation retry count 递增必须继续绑定 `tenantId + connectionId + operationId`。
- 不从 request、header、query 或 localStorage 读取租户或 claim。
- 不保存 raw HIS payload。
- 不保存 provider raw error。
- 不暴露 SQL、stack 或 `DATABASE_URL`。

## 不接入范围

本轮和后续 operation retry count 最小运行时都不应顺手接入以下能力：

- 不新增 schema / migration。
- 不修改 job queue repository。
- 不修改 operation repository，除非运行时 PR 发现现有结果无法稳定表达。
- 不新增 API route。
- 不接 service。
- 不接 runner / scheduler / cron。
- 不写 audit。
- 不实现 retry exhausted dead letter 运行时。
- 不实现 retry exhausted manual review 运行时。
- 不接真实 provider。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。

## 测试拆分建议

operation retry count 对齐运行时 PR 建议只修改 worker 与 worker 测试：

- requeue 成功后调用 `incrementCredentialCompensationOperationRetryCount`。
- operation retry count 对齐发生在 requeue 成功之后。
- requeue 失败时不调用 operation retry count。
- operation retry count 成功时返回 `ok`。
- operation retry count `repository_error` 时不回滚 job requeue，并返回稳定结果。
- operation retry count `invalid_state_transition` 时不回滚 job requeue，并返回稳定结果。
- operation retry count `not_found` / `conflict` / `validation_failed` 时不暴露敏感信息。
- 继续验证 `retryCount >= maxRetryCount` 不 requeue，也不递增 operation retry count。
- 继续验证 `timeout`、`unsafe_unknown`、`validation_failed` 不 requeue，也不递增 operation retry count。
- 继续验证不调用真实 provider、不写 audit、不读 request / header / query / localStorage。

repository 测试不需要在该运行时 PR 中扩展，除非发现现有 repository 结果不能满足 worker 收口。

## 后续 PR 拆分建议

1. operation retry count 对齐运行时最小实现。
2. operation retry count 对齐失败恢复流程 / 人工复核规划。
3. retry exhausted dead letter 运行时。
4. retry exhausted manual review 运行时。
5. compensation audit 接入。
6. runner / scheduler / cron 规划与最小实现。
7. service 创建 operation + job queue 接入。
8. 真实 provider / 测试连接 / 真实 HIS adapter 规划。

拆分原则：

- operation retry count 对齐不夹带 dead letter。
- operation retry count 对齐不夹带 manual review。
- operation retry count 对齐不夹带 audit。
- operation retry count 对齐不夹带 service 或 runner。
- 真实 provider、真实凭证和真实 HIS adapter 必须继续独立规划。

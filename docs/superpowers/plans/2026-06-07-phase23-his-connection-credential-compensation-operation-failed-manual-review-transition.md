# Phase 23 HIS 连接配置凭证补偿 operation failed manual review 状态转换边界规划

> 日期：2026-06-07
> 状态：仅文档规划。本轮只规划 operation 从 `compensation_failed` 推进到 `manual_review_required` 的 repository 边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不修改 operation repository，不修改 worker，不修改 job queue repository，不接 audit，不接 service / route，不接 runner / scheduler / cron，不调用真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

## 当前已完成能力

- retry policy helper 已在 failed job 且 `retryCount >= maxRetryCount` 时返回 `dead_letter`，reason 为 `retry_exhausted`。
- worker 已在 `retryable_failure` / `provider_unavailable` 的 job failed + operation failed 成功后调用 `markCredentialCompensationJobDeadLettered`。
- dead letter 成功后当前不 requeue、不递增 operation retry count、不推进 job manual review、不推进 operation manual review。
- 当前 retry exhausted dead letter 路径已经先把 operation 写为 `compensation_failed`。
- operation repository 已有 `markCredentialCompensationOperationManualReviewRequired`，输入为 `tenantId + connectionId + operationId`。
- operation repository 已有 `markCredentialCompensationOperationFailed`，只允许 running operation 写为 `compensation_failed`。
- operation repository 已有 `incrementCredentialCompensationOperationRetryCount`，只允许 `compensation_failed` 或 `manual_review_required` 递增 retry count。
- job queue repository 已有 dead letter 写回，且写回绑定 `tenantId + connectionId + operationId + claimId + claimVersion`。

## 当前缺口

- 现有 `markCredentialCompensationOperationManualReviewRequired` 复用 running completion 判断，只允许 `compensation_running` 进入 `manual_review_required`。
- 现有 operation repository 没有专门表达 `compensation_failed -> manual_review_required` 的方法。
- retry exhausted dead letter 后，job 已进入 `dead_lettered`，operation 仍停在 `compensation_failed`。
- retry exhausted manual review runtime 仍未实现。
- compensation audit integration 未实现。
- service 创建 operation + job queue 未接入。
- runner / scheduler / cron 未实现。
- 真实 provider、真实凭证、测试连接和真实 HIS adapter 均未接入。

## 问题结论

1. 当前 `markCredentialCompensationOperationManualReviewRequired` 只允许 `compensation_running` 进入 `manual_review_required`。
2. 当前实现通过 `canCompleteRunningOperation` 明确拒绝非 running 状态，因此 `compensation_failed -> manual_review_required` 会返回 `invalid_state_transition`，不会写库。
3. retry exhausted dead letter 后 operation 会停在 `compensation_failed`，因为 worker 在 failed completion 中先写 job failed，再写 operation failed；retry policy 返回 `dead_letter` 后只 dead letter job，成功后直接返回稳定 `ok`，没有继续调用 operation manual review。
4. 应该允许 `compensation_failed -> manual_review_required`，但只应作为 retry exhausted 后的业务复核终态推进能力，不应扩大为任意 failed operation 自动复核。
5. 不建议复用现有 `markCredentialCompensationOperationManualReviewRequired` 来承载 failed 状态；推荐新增专用方法。
6. 如果复用现有方法并把允许状态扩大到 `compensation_failed`，会模糊 stale running recovery 与 retry exhausted 后处理的语义边界；stale running recovery 当前依赖 running 到 manual review 的窄边界，扩大后容易让其他调用方误以为 failed 也属于同一类 running completion。
7. 推荐新增 `markFailedCredentialCompensationOperationManualReviewRequired`，职责只覆盖已失败 operation 的人工复核推进，且只允许 `compensation_failed -> manual_review_required`。
8. 本轮不需要新增 manual review reason；当前 operation 表没有 reason 字段，新增 reason 会牵涉 schema / migration 或 audit 规划。
9. 本轮不需要新增 schema / migration；现有 state enum 已包含 `manual_review_required`，现有 `manualReviewRequired` 布尔字段可表达复核标记。
10. 本轮不修改 operation repository；后续 repository runtime PR 才实现专用方法和测试。
11. 本轮不修改 worker；后续 retry exhausted manual review runtime PR 才在 dead letter 成功后调用专用 operation 方法。
12. 本轮不修改 job queue repository；job 已 `dead_lettered` 后不再调用 job manual review。
13. 本轮不接 audit；audit integration 后置到独立规划。
14. 本轮不接 service / route；service 创建 operation + job queue 后置到独立规划。
15. 本轮不接 runner / scheduler；常驻调度后置到独立规划。
16. 本轮可以不接真实 provider。
17. 本轮可以不处理真实凭证、不做测试连接、不接真实 HIS adapter。
18. 需要另开 Plan Mode 或独立 PR 的内容包括 operation repository runtime、retry exhausted manual review worker runtime、dead letter / manual review recovery、compensation audit integration、service / route 接入、runner / scheduler / cron、真实 provider、真实凭证、测试连接和真实 HIS adapter。

## operation 状态机现状

当前 operation repository 的核心状态边界如下：

- `compensation_pending -> compensation_running`：允许。
- `compensation_failed -> compensation_running`：允许，由上层确认重试后重新运行。
- `manual_review_required -> compensation_running`：允许，由上层确认复核后重新运行。
- `compensation_running -> compensation_succeeded`：允许。
- `compensation_running -> compensation_failed`：允许。
- `compensation_running -> manual_review_required`：允许。
- `compensation_failed -> manual_review_required`：当前不允许。
- `compensation_succeeded -> manual_review_required`：当前不允许，也不应在本能力中允许。

## failed 推进 manual review 的业务理由

- retry exhausted 表示自动补偿已经耗尽 job 调度重试，不应继续自动 requeue。
- job `dead_lettered` 是调度终态，只能说明该 job 不再自动执行，不能完整表达业务上需要人工查看 operation。
- operation `manual_review_required` 是业务终态，能把“补偿失败且需要人工复核”明确暴露给后续恢复流程或运营界面。
- 从 `compensation_failed` 推进到 `manual_review_required` 可以保留自动失败事实，同时给人工介入一个明确状态。
- 该推进不代表补偿成功，不读取真实凭证，不调用 provider，不保存 provider raw error，不保存 raw HIS payload。

## 复用现有方法的风险

不推荐把 `markCredentialCompensationOperationManualReviewRequired` 扩大为同时接受 running 与 failed：

- 方法名当前更像“运行中补偿遇到不安全结果后进入人工复核”。
- stale running recovery 当前调用该方法，语义是“running 太久或状态不一致，停止自动补偿并复核”。
- retry exhausted dead letter 后的语义是“已经失败并 dead letter，业务终态改为复核”，与 stale running recovery 不同。
- 扩大现有方法后，调用方无法从方法名看出 failed 状态也被允许，未来更容易误用。
- 测试需要覆盖两类完全不同的入口，边界会变宽。

## 推荐方案

推荐新增语义更窄的 repository 方法：

```ts
markFailedCredentialCompensationOperationManualReviewRequired(input)
```

该方法职责：

- 只处理 `compensation_failed -> manual_review_required`。
- 输入只使用 `tenantId + connectionId + operationId`。
- 成功时写入 `state: 'manual_review_required'`。
- 成功时写入 `manualReviewRequired: true`。
- 成功时更新 `updatedAt` 与 `completedAt`。
- 不修改 `retryCount`。
- 不修改 `lastAttemptAt`。
- 不读取或写入 job claim 字段。
- 不接 audit。
- 不保存 raw HIS payload、provider raw error、SQL、stack、`DATABASE_URL` 或凭证明文。

现有 `markCredentialCompensationOperationManualReviewRequired` 保持不变：

- 继续只允许 `compensation_running -> manual_review_required`。
- 继续服务 unsafe unknown、timeout 和 stale running recovery。
- 不承载 retry exhausted failed operation 后处理。

## 状态转换允许范围

后续专用方法只允许：

- 当前状态为 `compensation_failed`。
- 输入通过可信字段校验。
- 数据库记录匹配 `tenantId + connectionId + operationId`。
- 写回仍受当前状态条件保护，避免并发状态变化被覆盖。

成功后：

- operation state 为 `manual_review_required`。
- `manualReviewRequired` 为 true。
- `completedAt` 为当前时间。
- `updatedAt` 为当前时间。
- `retryCount` 保持不变。
- `lastAttemptAt` 保持不变。

## 状态转换拒绝范围

后续专用方法应拒绝：

- `compensation_pending -> manual_review_required`。
- `compensation_running -> manual_review_required`，该路径继续由现有方法负责。
- `compensation_succeeded -> manual_review_required`。
- `manual_review_required -> manual_review_required`。
- tenant 不匹配。
- connectionId 不匹配。
- operationId 不匹配。
- 输入字段为空、超长、包含敏感模式或不符合安全 operationId 规则。
- repository 异常细节需要脱敏为稳定 `repository_error`。

## 隔离与并发边界

- 写回必须绑定 `tenantId + connectionId + operationId`。
- 不允许只按 operationId 写回。
- 不允许信任外部传入 tenant 替代服务端可信 tenant。
- 不需要 `claimId + claimVersion`；claim 只属于 job 写回保护。
- operation 写回应继续采用先读当前状态、再按当前状态条件 update 的模式。
- 并发下如果状态已被其他流程推进，应返回 `conflict` 或 `invalid_state_transition`，不得覆盖成功态。

## manual review reason 边界

本轮不新增 manual review reason：

- operation schema 当前没有 manual review reason 字段。
- job dead letter reason 已有 `retry_exhausted`，足以表达调度侧原因。
- operation 只需要表达业务终态 `manual_review_required`。
- 如果后续需要在 operation 或 audit 中记录 `retry_exhausted` 复核原因，必须另开 schema / migration 或 audit Plan Mode。

## schema 与 migration 边界

本轮不需要 schema / migration：

- operation state enum 已包含 `manual_review_required`。
- operation 表已有 `manualReviewRequired`。
- operation 表已有 `completedAt`、`updatedAt`、`lastAttemptAt` 和 `retryCount`。
- 新增专用 repository 方法只改变允许的状态转换，不需要新增字段或 enum。

## repository 边界

后续 operation repository runtime PR 建议只修改 operation repository 和对应测试：

- 新增 `markFailedCredentialCompensationOperationManualReviewRequired`。
- 保持 `markCredentialCompensationOperationManualReviewRequired` 不变。
- 复用现有 normalize、scope 校验、稳定 result 和脱敏模式。
- 新增 failed 到 manual review 正向测试。
- 新增 pending / running / succeeded / manual review 状态拒绝测试。
- 新增 tenant、connectionId、operationId 隔离测试。
- 新增 repository error 脱敏测试。

本轮不实现这些 runtime。

## worker 边界

后续 retry exhausted manual review worker runtime PR 才应改 worker：

- 只在 job dead letter 成功后进入 operation manual review 写回。
- 只处理 retry policy `dead_letter` 且 reason 为 `retry_exhausted`。
- 只处理 `retryable_failure` / `provider_unavailable` 达到上限。
- 调用 `markFailedCredentialCompensationOperationManualReviewRequired`。
- 不调用 job manual review。
- 不 requeue。
- 不递增 operation retry count。
- operation manual review 写回失败不回滚 job dead letter。

本轮不修改 worker。

## job queue repository 边界

本轮和后续专用 operation repository PR 都不需要修改 job queue repository：

- job dead letter 已有 `markCredentialCompensationJobDeadLettered`。
- job dead letter 写回继续使用 `claimId + claimVersion`。
- job 已 `dead_lettered` 后不应再写 job manual review。
- operation manual review 是业务状态写回，不应通过 job manual review 间接表达。

## audit、service、route 与调度边界

- 不接 audit；后续 compensation audit integration 需单独规划 action、reason、result、metadata 白名单和失败收口。
- 不接 service / route；service 创建 operation + job queue 需单独规划。
- 不接 runner / scheduler / cron；批量执行、租户轮询、limit、锁竞争和退出策略需单独规划。
- 不接真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

如果任何后续需求要求 schema / migration、service、route、audit、real provider、真实凭证、测试连接、真实 HIS adapter、runner / scheduler，本轮结论都是停止实现并另开 Plan Mode。

## 测试拆分建议

operation repository runtime PR：

- 先补 `markFailedCredentialCompensationOperationManualReviewRequired` 的失败态正向测试。
- 覆盖写回字段：state、manualReviewRequired、updatedAt、completedAt。
- 覆盖不修改 retryCount 和 lastAttemptAt。
- 覆盖 pending、running、succeeded、manual_review_required 拒绝。
- 覆盖 tenant / connectionId / operationId 隔离。
- 覆盖 validation_failed、not_found、conflict、repository_error。
- 覆盖敏感字符串不进入响应。

worker retry exhausted manual review runtime PR：

- 覆盖 dead letter 成功后调用专用 operation 方法。
- 覆盖 dead letter 失败时不调用 operation manual review。
- 覆盖 operation manual review 失败不回滚 job dead letter。
- 覆盖不调用 job manual review。
- 覆盖不 requeue、不递增 operation retry count。
- 覆盖 timeout、unsafe_unknown、validation_failed、repository_error 不进入 retry exhausted manual review。

recovery / review flow PR：

- 覆盖 job `dead_lettered` + operation `compensation_failed` 的短暂不一致识别。
- 覆盖幂等重试 operation manual review 写回。
- 覆盖人工处理前不重新执行 provider。

audit integration PR：

- 单独定义 audit action / reason / result。
- 单独定义 metadata 白名单。
- 单独确认 audit 失败时 fail closed 或 best effort。
- 单独确认不写 raw HIS payload、provider raw error、SQL、stack、`DATABASE_URL` 或凭证明文。

## 后续 PR 拆分建议

1. operation repository failed manual review 状态转换 runtime：新增专用方法与 repository tests。
2. retry exhausted manual review worker runtime：dead letter 成功后调用专用 operation 方法。
3. dead letter / manual review recovery：处理 job `dead_lettered` + operation `compensation_failed` 的短暂不一致。
4. compensation audit integration：单独接 action、reason、result 和 metadata 白名单。
5. service 创建 operation + job queue：接入凭证补偿 operation 与 job 创建。
6. runner / scheduler / cron：接入批量执行与调度。
7. 真实 provider / 真实凭证 / 测试连接 / 真实 HIS adapter：单独 Plan Mode。

## 本次结论

- 本轮只做 docs-only Plan Mode。
- 推荐允许 `compensation_failed -> manual_review_required`。
- 推荐新增 `markFailedCredentialCompensationOperationManualReviewRequired`，不扩大现有 `markCredentialCompensationOperationManualReviewRequired`。
- 现有 running 到 manual review 方法继续服务 unsafe unknown、timeout 和 stale running recovery。
- 本轮不新增 schema / migration，不新增 manual review reason，不接 audit，不接 service / route，不接 runner / scheduler，不接真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter。
- repository runtime、worker runtime、recovery、audit、service、runner 和真实外部系统能力均后置到独立 PR 或 Plan Mode。

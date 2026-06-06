# Phase 23 HIS 连接配置凭证补偿 worker claim lock 与 stale recovery 边界规划

> 日期：2026-06-07
> 状态：docs-only Plan Mode。本文只规划 Phase 23 HIS 连接配置凭证补偿 worker claim / lock / stale recovery 边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不新增 API route，不实现 worker runtime，不实现 provider 调用，不实现 stale recovery runtime，不实现 retry runtime，不实现 dead letter / manual review runtime，不实现 compensation audit，不接 service，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

## 只读盘点结论

1. 当前 operation repository 足以支撑 worker 的状态推进基础：可创建、读取、标记 running / succeeded / failed / manual review、递增 retry count，并可按 tenant 查询 pending 与 stale running operation。
2. 当前 job queue repository 足以支撑 claim / lock：可列出 due queued jobs、claim due job、写入 `claimId`、递增 `claimVersion`、记录 `claimedBy`、`claimedAt`、`lockedUntil`，并拒绝旧 claim 写回。
3. 当前 job queue repository 足以支撑 stale locked job 的发现和重新领取入口：可列出 expired locked jobs，也允许锁过期的 claimed / running job 被重新 claim。
4. 当前 job queue repository 足以支撑 retry / requeue 的 repository 边界：只允许 failed job 在 claim 匹配且 `retryCount < maxRetryCount` 时 requeue，并在成功时清理 claim 元数据。
5. 当前 job queue repository 足以支撑 dead letter / manual review 的状态写回，但不决定业务分流原因。
6. 后续需要新增 worker runtime，负责把 operation repository 与 job queue repository 编排起来。
7. 后续需要新增 worker runner / scheduler，负责触发 worker 扫描和批处理节奏。
8. 后续需要新增 service integration，让凭证 service 在补偿需要持久化时写入 operation + job queue。
9. 后续需要 compensation audit integration，负责在状态推进处写入审计。
10. 本轮可以先只做 Plan Mode，不改代码。
11. 本轮未发现必须立即另开 schema / migration PR 才能写本文档；若后续要增加 attempt 明细、manual review 独立队列或 audit metadata，则必须单独开 schema / migration PR。
12. worker runtime 必须另开实现 PR。
13. audit integration 必须另开实现 PR。

## 背景与当前状态

Phase 23 HIS 连接配置凭证补偿链路当前已完成以下基础：

- compensation operation metadata / operationId schema 最小边界。
- compensation operation repository 最小边界。
- compensation outbox / job queue Plan Mode。
- compensation job queue schema / migration 最小边界。
- compensation job queue repository 最小边界。

当前仍未完成：

- worker runtime。
- worker runner / scheduler。
- service 接入 operation + job queue 创建。
- compensation audit integration。
- provider 执行边界。
- stale recovery runtime。
- retry / dead letter / manual review runtime 闭环。
- 真实 provider、真实 secret manager、真实 HIS adapter 或测试连接。

本轮文档的重点是明确 worker 应如何组合既有 repository，而不是实现 worker。

## 目标

本轮目标是为后续 worker claim / lock / stale recovery 实现 PR 提供清晰边界：

- 明确 worker 职责和非职责。
- 明确 operation repository 与 job queue repository 的职责边界。
- 明确 claim / lock、running、completion、stale recovery、retry、dead letter 和 manual review 的推荐流程。
- 明确 `claimId` / `claimVersion` 的写回约束。
- 明确 transaction / consistency、tenant isolation、audit、provider、observability 和敏感信息禁区。
- 给出测试拆分建议和后续 PR 拆分建议。
- 明确哪些内容必须另开实现 PR。

## 非目标

本轮明确不做：

- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不新增 schema / migration。
- 不新增 API route。
- 不修改 service。
- 不修改 parser / DTO。
- 不修改 provider / storage。
- 不修改权限。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不实现 worker runtime。
- 不实现 worker 主循环。
- 不实现 provider 调用。
- 不实现 stale recovery runtime。
- 不实现 retry runtime。
- 不实现 dead letter / manual review runtime。
- 不实现 compensation audit。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不接 KMS / Vault / secret manager。
- 不修改 package、lockfile、`.env` 或 `.codex`。

## 当前已完成能力

operation repository 已完成：

- `createCredentialCompensationOperation`。
- `getCredentialCompensationOperationByOperationId`。
- `getCredentialCompensationOperationByConnection`。
- `markCredentialCompensationOperationRunning`。
- `markCredentialCompensationOperationSucceeded`。
- `markCredentialCompensationOperationFailed`。
- `markCredentialCompensationOperationManualReviewRequired`。
- `incrementCredentialCompensationOperationRetryCount`。
- `listPendingCredentialCompensationOperations`。
- `listStaleRunningCredentialCompensationOperations`。

job queue schema 已完成：

- 单表承载 outbox 投递语义和 job queue 执行语义。
- job state enum。
- dead letter reason enum。
- `tenantId + connectionId + operationId` 绑定 operation。
- `operationId` unique。
- `nextAttemptAt`。
- `lockedUntil`。
- `claimId`。
- `claimVersion`。
- `claimedBy`。
- `claimedAt`。
- `lastHeartbeatAt`。
- `retryCount`。
- `maxRetryCount`。
- `deadLetterReason`。
- `manualReviewRequired`。

job queue repository 已完成：

- `createCredentialCompensationJob`。
- `getCredentialCompensationJobByOperation`。
- `getCredentialCompensationJobByConnection`。
- `listDueCredentialCompensationJobs`。
- `claimDueCredentialCompensationJob`。
- `markCredentialCompensationJobRunning`。
- `markCredentialCompensationJobSucceeded`。
- `markCredentialCompensationJobFailed`。
- `requeueCredentialCompensationJob`。
- `markCredentialCompensationJobDeadLettered`。
- `markCredentialCompensationJobManualReviewRequired`。
- `listExpiredLockedCredentialCompensationJobs`。

## 当前缺口

当前缺口集中在编排层：

- 没有 worker runner / scheduler。
- 没有 worker 主循环。
- 没有 worker 配置入口。
- 没有 claim 成功后推进 operation running 的编排。
- 没有 provider 安全执行抽象接入。
- 没有 completion 阶段的 job + operation 双写收口。
- 没有 stale locked job recovery runtime。
- 没有 stale running operation recovery runtime。
- 没有 retry 策略执行器。
- 没有 retry exhausted 后进入 dead letter 的 runtime。
- 没有 unsafe / unknown provider result 后进入 manual review 的 runtime。
- 没有 compensation audit integration。
- 没有 observability / safe logging 规范实现。

## worker 职责边界

worker 应负责：

- 按 tenant scope 查询 due jobs。
- 逐条 claim due job。
- claim 成功后推进 job running 与 operation running。
- 在 provider 安全执行完成后推进 job 和 operation 结果。
- 对 retryable failure 执行 failed + requeue。
- 对 retry exhausted 执行 dead letter。
- 对自动判断不安全或结果未知的场景执行 manual review。
- 定期扫描 stale locked jobs。
- 定期扫描 stale running operations。
- 保证旧 claim 不得写回结果。
- 保证 provider 调用不在长事务内。
- 保证输出日志只包含安全摘要。

worker 不应负责：

- 不创建真实凭证。
- 不解析凭证输入。
- 不做 HTTP route 权限判断。
- 不直接修改 audit domain / reason。
- 不绕过 repository 直接写表。
- 不把 provider 原始交互内容写入 job、operation、日志或审计。
- 不接真实 HIS adapter。
- 不做测试连接。

## operation repository 与 job queue repository 职责边界

operation repository：

- 是补偿事实状态的持久化边界。
- 表达 operation 当前是否 pending、running、succeeded、failed 或 manual review。
- 记录 retry count 与 lastAttemptAt。
- 支持 stale running operation 只读查询。
- 不持有 claim。
- 不调度 worker。
- 不调用 provider。
- 不写 audit。

job queue repository：

- 是 worker 可领取任务的持久化边界。
- 表达 queued、claimed、running、succeeded、failed、dead_lettered、manual_review_required 或 cancelled。
- 记录 claim / lock / retry / nextAttemptAt。
- 通过 `claimId` 和 `claimVersion` 拒绝旧 worker 写回。
- 支持 expired locked job 查询。
- 不决定 provider 行为。
- 不决定 audit reason。
- 不推进 operation state。

worker：

- 是 operation repository 与 job queue repository 的编排者。
- 必须以 `tenantId + connectionId + operationId` 同时绑定两个 repository。
- 必须在 claim 成功后才推进 operation running。
- 必须根据 provider 安全结果推进 job 与 operation。
- 必须把不可安全自动判断的场景分流到 manual review。

## claim / lock 流程

推荐 claim 流程：

1. worker 以 tenant scope 调用 `listDueCredentialCompensationJobs`。
2. 对每条 due job 生成新的 `claimId` 和 worker 安全标识。
3. 调用 `claimDueCredentialCompensationJob`。
4. 若返回 `ok`，使用返回记录中的 `claimVersion` 作为后续写回凭证。
5. 若返回 `conflict` 或 `invalid_state_transition`，该 job 本轮跳过。
6. 若返回 `repository_error`，worker 记录安全摘要并退出当前批次。
7. claim 成功后再调用 `markCredentialCompensationJobRunning`。
8. job running 成功后再调用 `markCredentialCompensationOperationRunning`。

约束：

- claim 更新必须绑定 `tenantId + connectionId + operationId`。
- worker 后续写回必须携带同一个 `claimId` 和 `claimVersion`。
- 旧 claim 写回必须稳定返回，不得覆盖新 claim。
- lock 时间必须短于 stale recovery 阈值。
- 长任务如需续租，后续必须另开 heartbeat / extend lock 实现 PR。

## running 阶段流程

推荐 running 阶段：

1. job 进入 `running`。
2. operation 进入 `compensation_running`。
3. worker 在事务外执行安全 provider 动作。
4. provider 成功后进入 completion。
5. provider 可重试失败后进入 failed + retry 判断。
6. provider 结果未知或自动处理不安全时进入 manual review。

本轮不实现 provider 调用。后续实现 PR 的 provider 只能先接 test-only provider 或 no-op provider，真实 provider 必须另开 Plan Mode。

## completion 阶段流程

provider 成功：

- `markCredentialCompensationJobSucceeded`。
- `markCredentialCompensationOperationSucceeded`。
- 后续 audit integration 写 compensation succeeded audit。

provider 可重试失败：

- `markCredentialCompensationJobFailed`。
- `markCredentialCompensationOperationFailed`。
- 若 `retryCount < maxRetryCount`，计算下一次 `nextAttemptAt` 并调用 `requeueCredentialCompensationJob`。
- 若已经达到上限，调用 `markCredentialCompensationJobDeadLettered`。
- 后续 audit integration 写安全的失败或 dead letter 审计。

provider 结果未知或自动处理不安全：

- `markCredentialCompensationJobManualReviewRequired`。
- `markCredentialCompensationOperationManualReviewRequired`。
- 后续 audit integration 写 manual review 审计。

## stale locked job recovery

stale locked job 指 job 处于 claimed / running 且 lock 已过期。

推荐流程：

1. worker 按 tenant scope 调用 `listExpiredLockedCredentialCompensationJobs`。
2. 对 claimed 且 operation 仍 pending 的 job，可重新 claim 后继续推进。
3. 对 claimed 且 operation 已 running 的 job，先读取 operation，再按 running 风险处理。
4. 对 running 且 lock 过期的 job，不应盲目重复 provider 动作。
5. 若无法证明 provider 未产生副作用，应进入 manual review。
6. 若只是在 job running 前崩溃，可重新 claim 后恢复。

禁止：

- 不根据过期 lock 直接判定 provider 未执行。
- 不在 recovery 中绕过 `claimId` / `claimVersion`。
- 不直接把 stale running job 改回 queued，除非后续实现 PR 明确证明没有副作用风险。

## stale running operation recovery

stale running operation 指 operation 仍处于 `compensation_running`，且 `lastAttemptAt` 早于阈值。

推荐流程：

1. worker 按 tenant scope 调用 `listStaleRunningCredentialCompensationOperations`。
2. 读取对应 job。
3. 若 job 已 succeeded，尝试补齐 operation succeeded。
4. 若 job 已 failed 且仍可 requeue，按 retry 策略继续。
5. 若 job 已 dead_lettered，同步 operation 到 failed 或 manual review 的策略必须另开实现 PR 明确。
6. 若 job 缺失，进入 manual review，不自动新建执行任务。
7. 若 job running 且 lock 已过期，但 provider 副作用未知，进入 manual review。

约束：

- operation stale recovery 不应由 HTTP route 触发。
- stale 阈值由 worker 配置传入。
- 不能因为 operation running 超时就重复不可证明幂等的 provider 动作。

## retry / requeue 策略

retry 策略建议：

- 只对明确 retryable 的失败重试。
- worker 不得直接修改 retryCount。
- retryCount 由 `requeueCredentialCompensationJob` 递增。
- `retryCount >= maxRetryCount` 时进入 dead letter，不再 requeue。
- backoff 计算由 worker 策略层负责。
- `nextAttemptAt` 只保存下一次可领取时间。
- retry 时 operation 可保持 failed，直到下一次 claim 成功后再进入 running。

本轮不实现 retry runtime。

## dead letter 策略

进入 dead letter 的推荐场景：

- retry exhausted。
- claim 冲突无法安全恢复。
- stale recovery 冲突。
- provider 结果未知且无法人工前自动判断。
- audit 写入不可用且后续 audit integration 要求 fail closed。
- operation state 冲突。
- 安全摘要不足以继续自动处理。

dead letter 边界：

- job queue repository 只负责写入 dead letter 状态和安全 reason。
- worker 负责判断何时进入 dead letter。
- dead letter 不等于人工复核完成。
- 后续若需要运营界面或人工处置 API，必须另开 Plan Mode。

## manual review 策略

进入 manual review 的推荐场景：

- provider 结果未知。
- 旧 claim 与新 claim 冲突后无法证明当前状态。
- stale running job 或 operation 无法证明可安全重试。
- operation 与 job 状态不一致且无法自动收口。
- audit integration 失败后需要人工判断。
- 安全摘要不足以继续自动执行。

manual review 边界：

- operation 与 job 都应进入 manual review 相关状态。
- manual review read model 只允许安全摘要。
- 普通机构用户默认不可见内部处置细节。
- 人工处理权限、API、UI 和操作审计必须另开 Plan Mode。

## worker 幂等边界

worker 幂等依赖：

- `tenantId + connectionId + operationId` 绑定。
- job `operationId` unique。
- claim 写回必须带 `claimId` + `claimVersion`。
- operation state transition 必须校验当前状态。
- provider 执行必须后续证明可重试或可安全分流。

worker 不应假设：

- lock 过期等于 provider 未执行。
- operation running 超时等于自动失败。
- failed job 必然可重试。
- manual review 可以自动回退。

## `claimId` / `claimVersion` 写回边界

推荐写回要求：

- claim 成功返回的 `claimVersion` 是本次 worker 执行的唯一版本。
- mark running、mark succeeded、mark failed、requeue、dead letter、manual review 都必须携带同一组 claim 信息。
- requeue 成功时保留 `claimVersion`，不回退版本号。
- stale recovery 重新 claim 后会产生新的 claim 版本。
- 旧 worker 的迟到写回必须被 repository 拒绝。

## transaction / consistency 边界

推荐一致性边界：

- claim job 是短事务。
- mark job running 与 mark operation running 可以由 worker 顺序执行；若中间失败，进入下一轮 recovery。
- provider 调用不在长事务内。
- provider 成功后的 job succeeded 与 operation succeeded 应尽量在短事务或明确顺序内收口。
- job failed + operation failed + requeue 可拆成短步骤，并由 recovery 兜底。
- audit 写入另开 integration PR 后再决定是否同事务。

不得做：

- 不把 provider 调用包进数据库长事务。
- 不在 repository 内调用 provider。
- 不在 provider 内直接写 operation 或 job。

## provider 调用边界

本轮不实现 provider 调用。

后续最小实现建议：

- 先接 test-only provider 或 no-op provider。
- 输入只来自 server-side 安全上下文和 operation/job 安全字段。
- provider 返回必须是稳定分类结果。
- 真实 provider、真实 secret manager、真实 HIS adapter 和测试连接必须另开 Plan Mode。
- provider 结果未知时优先 manual review，不盲目重试。

## audit 边界

本轮不实现 compensation audit。

后续 audit integration 建议：

- audit 写入发生在 worker 或 compensation domain/service 的状态推进处。
- operation repository 不写 audit。
- job queue repository 不写 audit。
- provider 不写 audit。
- route 不写 worker 状态推进 audit。
- audit reason / action / result 不在 worker runtime PR 中临时新增，必须先有独立评审。
- audit 写入失败后的 fail closed、retry、dead letter 或 manual review 策略必须在 audit integration PR 中明确。

## tenant isolation

tenant isolation 要求：

- worker 查询必须以 tenant scope 执行。
- 每条 job 执行必须绑定 `tenantId + connectionId + operationId`。
- operation 读取与写入必须绑定同一组 scope。
- job 读取与写入必须绑定同一组 scope。
- cross tenant 与 cross connection 写回应返回稳定失败。
- worker 日志只记录安全摘要，不输出跨租户数据。

## observability / 日志边界

建议记录：

- worker run id。
- tenant scope。
- job state。
- operation state。
- operationId。
- claimVersion。
- 稳定 failure category。
- 稳定 repository result。
- retryCount 与 maxRetryCount。
- 是否进入 dead letter 或 manual review。

禁止记录：

- 真实认证材料。
- 外部系统原始交互内容。
- 外部错误原文。
- 内部密钥定位信息。
- 数据库内部语句或连接细节。
- 执行异常调用细节。
- 不可公开的 provider 内部路径。

## 敏感信息禁区

Plan / Spec / README / roadmap / devlog / PR 描述，以及后续 runtime 日志、audit metadata、job payload、manual review read model 中，都不得展示或持久化：

- 真实凭证或真实认证材料。
- 可直接访问外部系统的密钥类材料。
- 外部系统原始交互内容。
- 外部错误原文。
- 内部 provider 路径或外部密钥存放路径。
- 数据库连接材料、内部语句或异常调用细节。
- 可被误用为重放依据的幂等材料。
- 任意未经白名单审查的 payload。

## 测试拆分建议

worker claim / lock runtime PR：

- due job claim 成功。
- active lock 拒绝。
- expired lock 重新 claim。
- claim 成功后 job running。
- claim 成功后 operation running。
- job running 成功但 operation running 失败进入 recovery。
- 旧 claim 写回被拒绝。

worker completion PR：

- provider success 后 job succeeded + operation succeeded。
- provider retryable failure 后 job failed + operation failed。
- retry 未达上限时 requeue。
- retry 达上限时 dead letter。
- provider unknown result 进入 manual review。

stale recovery PR：

- stale claimed job recovery。
- stale running job recovery。
- stale running operation 与 job 状态一致时收口。
- stale running operation 缺失 job 时 manual review。
- provider 副作用未知时不重复执行。

audit integration PR：

- 状态推进写 audit。
- audit 写入失败的 fail closed / retry / manual review 分流。
- repository 不写 audit。
- provider 不写 audit。
- route 不写 worker 状态推进 audit。

## 后续 PR 拆分建议

建议后续至少拆成七个 PR：

1. worker claim / lock / stale recovery runtime 最小实现。
2. worker test-only provider / no-op execution 最小实现。
3. compensation audit integration。
4. service 接入 operation + job queue 创建。
5. retry / dead letter / manual review runtime 最小闭环。
6. observability / safe logging。
7. 真实 provider / secret manager / HIS adapter Plan Mode。

## 必须另开实现 PR 的内容

必须另开实现 PR：

- worker runtime。
- worker runner / scheduler。
- provider execution。
- heartbeat / extend lock。
- stale locked job recovery runtime。
- stale running operation recovery runtime。
- retry runtime。
- dead letter runtime。
- manual review runtime。
- compensation audit integration。
- service 接入 operation + job queue 创建。
- observability / safe logging 实现。
- 真实 provider / secret manager / HIS adapter 规划。

必须另开 schema / migration PR 的内容：

- attempt 明细表。
- manual review 独立队列。
- audit metadata schema。
- 更细粒度 worker lease 表。
- 任何新的 job state 或 reason enum。

## 本轮 Plan Mode 判定

本轮满足 Plan Mode 条件：

- 已完成只读盘点。
- 现有 schema 与 repository 已足以进入 worker 规划。
- 可以不修改 `src/**`。
- 可以不修改 `drizzle/**`。
- 可以不新增 schema / migration。
- 可以不实现任何 runtime 代码。
- worker、service、audit、provider、dead letter / manual review runtime 均已明确拆到后续 PR。

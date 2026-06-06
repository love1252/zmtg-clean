# Phase 23 HIS 连接配置凭证补偿 outbox 与 job queue 边界规划

> 日期：2026-06-06
> 状态：docs-only Plan Mode。本文只规划 Phase 23 HIS 连接配置凭证补偿 outbox / job queue 边界，不写 runtime 代码，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不新增 API route，不实现 outbox / job queue，不实现 worker / claim / lock，不实现 dead letter，不实现 compensation audit，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

## 背景与当前状态

当前 main 已完成 Phase 23 HIS 连接配置凭证 compensation operation repository 最小边界：

- 已有 `his_connection_credential_compensation_operations` 表。
- 已有安全 `operationId` 生成与校验 helper。
- 已有 compensation operation repository factory。
- repository 只操作 compensation operation 表。
- repository 覆盖 create、tenant scoped get、state transition、retry count、pending query、stale running query、manual review state 和安全 read model。
- audit reason / query whitelist 已包含 provider failure 与 compensation reason。
- credential service 已能对已知 safe provider failure 写 provider failure denied audit。
- 仍未实现 compensation audit。
- 仍未实现 outbox / job queue。
- 仍未实现 worker、claim、lock、stale recovery、dead letter 或 manual review 闭环。
- 仍未接真实 provider、真实 secret manager、真实 HIS adapter 或测试连接。

只读盘点结论：

1. 当前 compensation operation 表能承载补偿状态事实，但不足以独立承担 outbox / job queue。
2. 后续需要新增 outbox 表或等价持久化载体。
3. 后续需要新增 job queue 表，或把 outbox 设计为兼具 job queue 的单表。
4. 后续需要 dead letter / manual review 载体。
5. 后续需要 claim / lock / stale running recovery。
6. operation repository 与 outbox / job queue 必须分责。
7. credential service 与 worker 必须分责。
8. compensation audit 应在 worker 或 compensation domain/service 的状态推进处写入。
9. 本轮可以先只做 Plan Mode，不改 schema / migration。
10. 本轮可以不实现任何 runtime 代码。
11. outbox / job queue schema / migration 必须另开实现 PR。
12. service / worker / audit integration 必须另开实现 PR。

## 本轮目标

本轮目标是把 outbox / job queue 的最小边界讲清楚，为后续实现 PR 降低歧义：

- 明确 compensation operation 表与 outbox / job queue 的关系。
- 明确 outbox 和 job queue 的职责拆分。
- 明确 job 生命周期和 operation state 生命周期。
- 明确 claim / lock、stale running recovery、retry、dead letter 和 manual review 策略。
- 明确 tenant isolation、idempotency、transaction / consistency 和 audit 边界。
- 明确 provider 调用边界、敏感信息禁区、failure category 边界和 observability / 日志边界。
- 给出测试拆分建议。
- 给出后续 PR 拆分建议，并标明哪些内容必须另开实现 PR。

## 非目标

本轮明确不做：

- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不新增 schema / migration。
- 不新增 API route。
- 不修改 service、parser、DTO、provider、storage、权限或 audit repository。
- 不修改 audit domain / reason / query whitelist。
- 不实现 outbox / job queue。
- 不实现 worker / claim / lock。
- 不实现 stale running recovery。
- 不实现 retry / dead letter / manual review 闭环。
- 不实现 compensation audit。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不接 KMS / Vault / secret manager。
- 不修改 package、lockfile、`.env` 或 `.codex`。

## 当前已完成能力

已完成的安全基础：

- HIS 连接配置 schema、只读 API、只读 UI、写入 repository、状态 repository、写入 service、状态 API、凭证 API route / permission / audit 最小边界。
- fake in-memory credential storage 与 `HisConnectionCredentialProvider` test-only 抽象。
- provider failure 白名单分类。
- domain-only compensation summary。
- provider failure 到稳定 service result 的映射。
- provider failure audit / service audit 最小实现。
- compensation audit reason / query whitelist 最小扩展。
- compensation operation metadata / operationId schema。
- compensation operation repository。

operation repository 当前能力：

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

## 当前缺口

当前缺口集中在异步任务和一致性收口：

- 没有 outbox 表。
- 没有 job queue 表。
- 没有 job payload 安全白名单。
- 没有 `nextAttemptAt`。
- 没有 `lockedUntil`。
- 没有 claim owner / worker id。
- 没有 lease 版本。
- 没有 job attempt 记录。
- 没有 deadLetterReason。
- 没有 manual review queue / review state / review actor。
- 没有 worker 领取、执行、续租、释放或抢占。
- 没有 stale running 自动恢复。
- 没有 compensation audit 写入幂等。
- 没有 provider cleanup 的异步执行边界。
- 没有 audit 写入失败后的 outbox retry 或人工处理入口。

## outbox / job queue 职责拆分

推荐三层职责：

| 载体 | 职责 | 不做 |
| --- | --- | --- |
| compensation operation 表 | 记录补偿链路事实状态，承载 `operationId`、tenant / connection、operation type、state、failure category、retry count、manual review 标记和时间戳。 | 不承担 worker claim，不保存 job payload，不直接调用 provider，不写 audit。 |
| outbox 表 | 记录需要异步处理的安全事件或任务投递意图，承载 operation 与任务之间的关联、投递状态、去重键和可调度时间。 | 不直接表达 worker lease 的全部细节，不保存真实凭证或 provider raw error。 |
| job queue 表 | 承载 worker 可领取任务，记录 claim / lock、attempt、retry、nextAttemptAt、dead letter 和 manual review 分流。 | 不替代 operation 事实状态，不替代 audit event，不保存 request / response body。 |

最小实现可选择 operation 表 + job queue 表两层，但必须保留 outbox 语义：

- service 在事务内创建 operation，并写入可调度任务。
- worker 只领取可调度任务。
- worker 推进 operation state。
- worker 写 compensation audit。
- job queue 记录执行与重试状态。

如果未来要支持跨系统投递、更多补偿类型或多 worker 分发，建议保留独立 outbox 表。

## compensation operation 表与 outbox / job queue 的关系

关系建议：

- operation 表是补偿链路的事实来源。
- outbox / job queue 是执行载体。
- `operationId` 是三者之间的安全关联 key。
- `tenantId + connectionId + operationId` 必须始终一起校验。
- operation state 只表达补偿链路当前事实，不表达 worker 是否持有 lock。
- job state 表达任务调度与执行状态，不替代 operation state。
- audit event 表达可审计事实，不替代 operation state 或 job state。

后续实现时，service 应在同一数据库事务内完成：

- 创建 compensation operation。
- 创建 outbox / job queue 记录。

如果事务失败：

- 不能调用 provider。
- 不能写 compensation audit。
- 不能返回补偿已排队。

如果 provider 已发生外部副作用但数据库事务失败：

- 当前没有安全持久化载体时只能 fail closed。
- 后续必须通过独立异常入口或人工处理策略承接，不能在本轮实现。

## job 生命周期

推荐 job 状态：

| job 状态 | 含义 | 允许后续 |
| --- | --- | --- |
| `queued` | 已创建，等待到达 `nextAttemptAt`。 | `claimed`、`cancelled` |
| `claimed` | worker 已领取，lock 未过期。 | `running`、`queued`、`dead_lettered` |
| `running` | worker 已开始执行补偿动作。 | `succeeded`、`failed`、`manual_review_required`、`dead_lettered` |
| `succeeded` | job 执行完成，operation 应进入 `compensation_succeeded`。 | 终态 |
| `failed` | 单次 attempt 失败，仍可能重试。 | `queued`、`dead_lettered`、`manual_review_required` |
| `dead_lettered` | 达到重试上限或不可安全自动处理。 | 终态，后续由人工流程处理 |
| `manual_review_required` | 自动执行不安全或证据不足。 | 人工处理流程 |
| `cancelled` | 后续人工取消或 operation 已由其他路径收口。 | 终态 |

本轮不新增这些 enum。后续 schema / migration PR 必须决定是否用 job state enum、文本白名单或独立表约束。

## operation state 生命周期

当前 operation state 已存在：

- `compensation_pending`
- `compensation_running`
- `compensation_succeeded`
- `compensation_failed`
- `manual_review_required`

推荐状态推进：

| 当前状态 | 目标状态 | 触发者 |
| --- | --- | --- |
| `compensation_pending` | `compensation_running` | worker 成功 claim job 后 |
| `compensation_running` | `compensation_succeeded` | worker 自动补偿成功后 |
| `compensation_running` | `compensation_failed` | worker 自动补偿失败且仍可由 job retry 重新排队前 |
| `compensation_running` | `manual_review_required` | worker 判断自动处理不安全后 |
| `compensation_failed` | `compensation_running` | retry job 再次执行前 |
| `manual_review_required` | `compensation_running` | 人工复核允许重新执行后 |

必须禁止：

- `compensation_succeeded` 自动回退。
- 不带 tenant / connection scope 的状态更新。
- 未持有有效 claim 的 worker 推进 running operation。
- repository 自行决定进入 dead letter。
- provider 层直接改 operation state。

## claim / lock 机制

后续 job queue schema 至少需要评估：

- `claimId`：每次领取生成安全随机值。
- `claimedBy`：worker 安全标识，不含主机敏感信息。
- `lockedUntil`：lease 到期时间。
- `claimVersion`：防止过期 worker 写回。
- `claimedAt`：领取时间。
- `lastHeartbeatAt`：可选，用于长任务续租。

领取规则：

- 只领取 `queued` 且 `nextAttemptAt <= now` 的 job。
- 领取必须绑定 `tenantId + connectionId + operationId`。
- 更新条件必须包含当前 job state、未锁或 lock 已过期。
- 领取成功后返回 job 安全 read model。
- 同一 job 同一时间只能有一个有效 claim。
- worker 写回结果必须提交 `claimId` 或 `claimVersion`。
- 过期 claim 不得写 succeeded / failed / manual review。

本轮不实现 claim / lock。

## stale running recovery

stale recovery 需要分两层：

- operation stale：`compensation_running` 且 `lastAttemptAt <= staleBefore`。
- job stale：job 仍处于 `claimed` / `running`，但 `lockedUntil < now` 或 heartbeat 超时。

恢复策略建议：

- 先查询 stale job，再校验 operation state。
- 若 job lock 过期且 operation 仍 running，可重新排队或生成新 claim。
- 若 operation running 但没有对应有效 job，应创建 recovery job 或进入 manual review。
- 若 worker 过期后旧 claim 写回，必须拒绝。
- stale 阈值由 worker config 传入，不写死在 repository。
- 每次 recovery 只能处理安全字段，不写 provider raw error。

风险边界：

- provider cleanup 是否已经成功可能无法判断，不能盲目重复危险动作。
- 对不可幂等 provider 操作，应进入 manual review。
- stale recovery 不应由 HTTP route 触发。

## retry 策略

推荐 retry 策略：

- 只对 retryable failure category 自动重试。
- retry 次数有限，建议最小实现从 `maxRetryCount = 3` 开始评估。
- 使用退避时间，例如短间隔递增，具体数值在实现 PR 再固定。
- retry count 同步到 operation 和 job 时必须保持一致性边界清晰。
- 每次 retry 前必须重新校验 tenant / connection / operation 绑定。
- retry 不得改变 operationId。
- retry 不得创建新的 provider secret version，除非 provider 操作具备幂等 key 且已另行规划。

可重试候选：

- `provider_unavailable`
- `timeout`
- `provider_revoke_failed`
- `provider_describe_failed`
- `provider_health_failed`

不建议自动重试：

- `validation_failed`
- `tenant_connection_mismatch`
- `idempotency_conflict`
- `invalid_state`
- `repository_after_provider_failed`，除非能证明数据库恢复后重放安全。
- `audit_after_provider_failed`，除非 audit outbox 已单独设计。

## dead letter 策略

需要 dead letter 载体。最小策略：

- job 达到 retry 上限进入 `dead_lettered`。
- operation 进入 `compensation_failed` 或 `manual_review_required`，由 worker 根据安全性决定。
- deadLetterReason 只能是稳定枚举。
- dead letter 只能保存安全摘要。
- dead letter 不保存 provider raw error、stack、SQL、request body、response body 或真实凭证。

deadLetterReason 候选：

- `retry_exhausted`
- `claim_conflict`
- `stale_recovery_conflict`
- `provider_result_unknown`
- `audit_write_unavailable`
- `operation_state_conflict`
- `unsafe_payload_summary`

本轮不新增 enum 或字段。

## manual review 策略

需要 manual review 载体。最小策略：

- `manual_review_required` 不是普通业务失败，而是自动补偿不安全或证据不足。
- manual review 可由 job queue 终态或独立 review 表承载。
- 普通机构用户默认不可见内部补偿详情。
- 平台安全治理角色是否可见必须另开权限和 UI / API 规划。
- 人工处理动作必须写独立 audit，不应复用自动 compensation audit。

进入 manual review 的候选场景：

- provider timeout 后状态未知。
- idempotency conflict 无法证明同一请求。
- tenant / connection 绑定无法证明。
- 自动 cleanup 可能影响有效凭证。
- audit 写入持续失败。
- stale recovery 无法判断 provider 副作用。

manual review 安全可见字段：

- tenantId。
- connectionId。
- operationId。
- operationType。
- failureCategory。
- operation state。
- job state。
- retryCount。
- createdAt、updatedAt、lastAttemptAt。
- stable deadLetterReason。

## tenant isolation

tenant isolation 是硬边界：

- service 创建 operation / job 时只使用 access context 的可信 tenantId。
- worker 读取 job 后必须再次校验 `tenantId + connectionId + operationId`。
- repository 查询不得只按 operationId。
- job queue claim 不得跨 tenant 扫描后返回给非平台授权上下文。
- 平台 worker 可以处理多 tenant，但每条 job 的执行必须带 tenant scope。
- cross tenant / not found 统一稳定结果，不暴露其他 tenant 是否存在。
- audit 写入必须使用 operation 所属 tenantId。

后续如果平台安全治理 UI 需要查询 manual review：

- 必须另开权限 PR。
- 必须只返回安全摘要。
- 必须禁止真实凭证、provider path、`credentialRef` 或 raw payload。

## idempotency 边界

幂等必须以安全 key 设计：

- `operationId` 是补偿链路幂等 key。
- job 可以有独立 `jobId`，但不能替代 `operationId`。
- provider 操作如果需要幂等 key，必须是 server scoped、不可逆且不含 request idempotencyKey 明文。
- 同一 operationId 重复执行不得重复创建 provider secret version。
- 同一 operation state transition 不得重复写 compensation audit。
- stale recovery 后旧 claim 不得写回终态。

禁止：

- 用 request body、raw credential、`credentialRef`、provider path、secret path、idempotencyKey 或 scoped idempotency key 构造 operationId。
- 把 operationId 塞进 audit `resourceId`。
- 用 provider raw error 文本作为幂等依据。

## transaction / consistency 边界

需要明确三类事务边界：

1. 数据库内事务：operation create 和 outbox / job create 应在同一 transaction 内完成。
2. 外部 provider 副作用：provider 不在数据库事务内，必须通过 compensation operation + job queue 追踪。
3. audit 写入：audit event 可以与 operation state transition 同事务，也可以进入 audit outbox，但必须明确失败策略。

建议最小原则：

- service 初始写 operation + job 必须同事务。
- worker claim job 和 mark operation running 可同事务。
- worker provider 调用不应持有数据库长事务。
- provider 调用后写 operation final state 与 compensation audit 时，应优先使用短事务。
- provider 成功但 final state 或 audit 失败，必须进入 dead letter / manual review 或 audit retry，不得静默吞掉。

本轮不选择具体实现路径，只规划边界。

## audit 边界

现有边界保持不变：

- route 层只写 permission denied、parser failure、malformed JSON 等 route denied audit。
- credential service 继续写 provider failure denied audit 和成功 allowed audit。
- provider 层不写 audit。
- operation repository 不写 audit。
- outbox / job queue repository 不决定 audit reason。

compensation audit 建议：

- 由 worker 或 compensation domain/service 在 operation state transition 成功后写入。
- resource 继续使用 `open_connection`。
- action 继续使用 `manage_credentials`。
- reason 复用 `compensation_pending`、`compensation_running`、`compensation_succeeded`、`compensation_failed`、`manual_review_required`。
- `compensation_succeeded` 建议 result 使用 `allowed`。
- 其他 compensation 状态建议 result 使用 `denied`。
- 同一 operationId + state transition 最多写一次 compensation audit。
- 若需要 audit metadata，必须另开 schema / migration 与 audit repository PR。

本轮不实现 compensation audit。

## provider 调用边界

provider 调用必须留在 worker 或 service orchestrator，不进入 repository：

- outbox / job queue repository 不调用 provider。
- operation repository 不调用 provider。
- provider 不接收 raw HTTP request。
- provider 不读取 localStorage、header tenantId 或 query tenantId。
- provider 调用只能使用可信 tenant / connection scope 和安全 provider 摘要。
- provider 返回的 raw error 不入库、不入 audit、不入日志。
- 真实 KMS / Vault / secret manager 仍需后续 Plan Mode。
- 真实 HIS adapter 和测试连接仍需后续 Plan Mode。

## 敏感信息禁区

以下内容不得进入 outbox、job queue、operation read model、dead letter、manual review、audit、日志、README、roadmap、devlog 或 PR 描述：

- 真实凭证。
- token。
- secret。
- API key。
- connection string。
- OAuth access token。
- OAuth refresh token。
- basic auth 用户名密码组合。
- private key。
- signing key。
- raw credential。
- raw HIS payload。
- provider internal path。
- external secret path。
- KMS key material。
- `credentialRef`。
- idempotencyKey。
- scoped idempotency key。
- synthetic placeholder。
- request body。
- response body。
- provider raw error。
- SQL。
- stack。
- `DATABASE_URL`。

## failure category 边界

继续复用现有 provider failure category 白名单：

- `provider_unavailable`
- `timeout`
- `retry_exhausted`
- `circuit_open`
- `validation_failed`
- `tenant_connection_mismatch`
- `idempotency_conflict`
- `invalid_state`
- `provider_write_failed`
- `provider_revoke_failed`
- `provider_describe_failed`
- `provider_health_failed`
- `repository_after_provider_failed`
- `audit_after_provider_failed`

边界要求：

- job / dead letter 不保存自由文本 failure category。
- retry 策略只能基于白名单 category 和稳定 job state。
- 新增 category 必须另开 audit reason / query whitelist 评估。
- 不把 provider raw error 映射成新自由文本 category。

## observability / 日志边界

允许的日志字段：

- operationId。
- jobId。
- tenantId。
- connectionId。
- operation state。
- job state。
- failureCategory。
- retryCount。
- claimVersion。
- 时间戳。
- stable deadLetterReason。

禁止的日志字段：

- 真实凭证。
- provider path。
- secret path。
- `credentialRef`。
- request body。
- response body。
- provider raw error。
- SQL。
- stack。
- `DATABASE_URL`。

日志策略：

- worker 领取、失败、重试、dead letter、manual review 只记录安全摘要。
- 结构化日志字段必须白名单化。
- 不做自由文本错误透传。
- alert / monitor 如后续实现，也只能基于安全摘要。

## 测试拆分建议

schema / migration 测试：

- outbox / job queue 表字段存在。
- claim / lock 字段存在。
- tenant / connection / operationId 索引存在。
- 不存在 raw payload、request body、response body、provider raw error、credentialRef 明文字段。
- deadLetterReason 和 manualReviewRequired 字段安全。

repository 测试：

- create outbox / job success。
- tenant scope 读取。
- claim queued job success。
- 同一 job 并发 claim 只有一个成功。
- expired lock 可重新 claim。
- 旧 claim 写回被拒绝。
- nextAttemptAt 未到不领取。
- retry count 上限。
- dead letter transition。
- manual review transition。
- 不写 audit。
- 不调用 provider。

worker 测试：

- pending job claim 后 operation running。
- provider cleanup success 后 operation succeeded。
- provider retryable failure 后重新排队。
- retry exhausted 后 dead letter。
- unsafe failure 后 manual review。
- stale running recovery。
- audit 写入幂等。
- audit failure 进入安全收口。
- 不处理真实凭证。
- 不调用真实 HIS。

service integration 测试：

- provider / repository 不一致时创建 operation + job。
- operation + job 同事务。
- job 创建失败时不声称补偿已排队。
- route 不写 compensation audit。
- provider failure audit 现有行为不回归。
- allowed audit 现有行为不回归。

## 后续 PR 拆分建议

建议至少拆为：

1. outbox / job queue schema / migration 最小边界。
2. outbox / job queue repository 最小实现。
3. worker claim / lock / stale recovery 最小实现。
4. compensation audit repository / service integration。
5. service 接入 compensation operation + outbox 写入。
6. dead letter / manual review 最小闭环。
7. 后续真实 provider / secret manager / HIS adapter Plan Mode。

额外可选拆分：

- audit metadata schema / query parser Plan Mode。
- manual review API / 权限 / UI Plan Mode。
- observability / alert Plan Mode。
- provider cleanup 幂等 Plan Mode。

## 必须另开实现 PR 的内容

必须另开 schema / migration PR：

- outbox 表或 job queue 表。
- claim / lock / lease 字段。
- nextAttemptAt / lockedUntil / claimedBy / claimVersion 字段。
- deadLetterReason 字段。
- manual review 载体。
- audit metadata schema，如果选择把 compensation metadata 放入 audit event。

必须另开 repository PR：

- outbox repository。
- job queue repository。
- claim / lock repository 方法。
- dead letter / manual review repository 方法。

必须另开 worker PR：

- worker 主循环。
- claim / lock。
- stale running recovery。
- retry / backoff。
- provider cleanup 调用。
- dead letter / manual review 分流。

必须另开 service / audit integration PR：

- credential service 写 operation + outbox。
- compensation audit helper。
- compensation audit 写入幂等。
- audit failure 收口策略。
- provider failure audit 与 compensation audit 关联策略。

必须另开 provider / secret / HIS Plan Mode：

- 真实 provider。
- 真实 KMS / Vault / secret manager。
- 真实 HIS adapter。
- 测试连接。
- 真实凭证一次性材料 parser / service。

# Phase 23 HIS 周期健康检查 runner scheduler 边界规划

> 日期：2026-06-07
> 状态：docs-only Plan Mode。本文只规划 Phase23-TC-12 周期健康检查 runner / scheduler 边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现 runner runtime，不实现 scheduler runtime，不新增 cron / queue / worker，不接真实 credential provider，不读取真实凭证，不接真实 HIS adapter，不发起外部网络请求，不回到 compensation / recovery runtime，不修改 package / lockfile。

## 只读盘点结论

1. 手动测试连接链路已经具备 route、权限、空 body parser、安全 DTO、fake provider、健康摘要写回和 audit runtime。
2. 健康摘要 repository 已有 `healthStatus / lastCheckedAt / lastErrorCode / updatedAt` 写回能力，足以作为周期健康检查的最终写回收口。
3. HIS 连接 read model 已返回 `status / credentialConfigured / healthStatus / lastCheckedAt / lastErrorCode / updatedAt / deletedAt`，足以支撑最小候选筛选规划。
4. 当前状态枚举已有 `draft / active / paused / revoked / deleted / error`，周期健康检查候选只能选择 `active` 且未软删除连接。
5. TC-10 只完成真实 credential provider 读取边界规划，尚未实现 runtime，因此 TC-12 不能假设真实凭证读取已经可用。
6. TC-11 只完成真实 HIS adapter 测试连接边界规划，尚未实现 runtime 或出站网络，因此 TC-12 不能假设真实外部探测已经可用。
7. compensation worker / retry 文档已经规划了 claim、lock、retry、manual review 和 recovery 概念，但周期健康检查不应复用 compensation job queue，也不应回到 compensation runtime。
8. 周期健康检查必须由服务端可信上下文驱动，不能使用前端传入的 tenant、候选列表、健康结果、provider result、凭证字段、endpoint 或调度参数。
9. 周期健康检查需要独立的 system actor / service actor 语义，不能冒充人工操作者。
10. audit 当前已支持手动 `test_connection` action / reason；周期健康检查是否复用或新增 `scheduled_health_check` action 必须单独进入 whitelist 与测试覆盖。
11. 当前字段能规划最小候选查询和健康摘要写回，但生产级多实例 runner 仍需要后续评估 durable lock、lease、backoff、run source 和幂等记录是否需要 schema / migration。
12. 本轮可以只做 Plan Mode，不改运行时代码。

## 当前上下文

- 当前阶段：Phase 23 HIS 连接配置 / 凭证 / 测试连接 / 真实 HIS adapter 前置能力。
- 当前任务编号：Phase23-TC-12。
- 当前任务名称：周期健康检查 runner / scheduler Plan Mode。
- 当前 main 基线：`df7aa33b59b6284796dcea06f92e25fbe913ee24`。
- 前置已完成：TC-08 fake provider route runtime、TC-09 测试连接 audit runtime、TC-10 真实 credential provider 读取边界 Plan Mode、TC-11 真实 HIS adapter 测试连接 Plan Mode。
- 本轮产物：只新增本文档，并更新 `docs/devlog/2026-06-07.md`。

## 本轮范围

本轮只明确后续周期健康检查的规划边界：

- runner / scheduler 定位。
- 推荐调用链。
- candidate query 候选筛选规则。
- 调度节奏、批次和并发边界。
- 锁、并发和幂等边界。
- 健康状态写回边界。
- 错误码与 provider result 映射边界。
- audit action / reason / system actor 边界。
- 与手动测试连接的关系。
- 与真实 credential provider / real HIS adapter 的关系。
- 安全 denylist。
- 后续 PR 拆分建议。

本轮明确不做：

- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不新增 schema / migration。
- 不实现 runner runtime。
- 不实现 scheduler runtime。
- 不新增 cron / queue / worker。
- 不新增后台常驻进程。
- 不接真实 credential provider。
- 不读取真实凭证。
- 不解析真实 `credentialRef` 明文。
- 不接 secret manager / KMS / Vault。
- 不接真实 HIS adapter。
- 不发起外部网络请求。
- 不回到 compensation / recovery runtime。
- 不修改 route / service / provider / adapter / audit runtime。
- 不修改 UI。
- 不修改 package / lockfile。

## runner / scheduler 定位

scheduler 的定位：

- 只负责按服务端配置触发周期任务。
- 只传入可信调度上下文，例如 `runId`、`scheduledAt`、批次上限、租户 allowlist 或全局 allowlist。
- 不查询前端请求。
- 不接收前端传入 tenant。
- 不接收前端传入候选连接。
- 不接收前端传入健康结果。
- 不接收前端传入 provider result。
- 不持有真实凭证。
- 不直接调用 HIS 外部系统。
- 不在进程内开启无限循环。

runner 的定位：

- 只负责一次批次运行的服务端编排。
- 读取候选连接。
- 对每个候选连接重新读取服务端快照。
- 串起 credential provider 与 real HIS adapter 的后续 runtime。
- 将归一化健康结果写回 repository。
- 写入周期健康检查 audit。
- 返回安全批次摘要。
- 不承担 route、DTO、前端交互、真实凭证存储、secret manager 接入、adapter 细节或外部同步职责。

周期健康检查不是：

- 不是手动测试连接按钮的后台版本。
- 不是 compensation job queue 的复用。
- 不是 credential compensation recovery。
- 不是 HIS 数据同步。
- 不是 Webhook。
- 不是 UI polling。
- 不是患者、预约、病历、处方或收费数据拉取。
- 不是外部系统可用性监控平台的替代品。
- 不是凭证轮换或凭证修复流程。

## 推荐调用链边界

后续 runtime 推荐调用链：

1. 服务端 scheduler 根据安全配置触发一次 run。
2. scheduler 构造 `runId / scheduledAt / maxBatchSize / tenantAllowlist / sourceAllowlist / timeoutMs` 等安全上下文。
3. runner 接收安全上下文并生成 service actor。
4. runner 通过 candidate query 获取候选连接 id 列表。
5. runner 对每个候选连接按 `tenantId + connectionId` 重新读取连接快照。
6. runner 校验连接仍为 `active`、未删除、凭证已配置、厂商和系统类型在 allowlist 内。
7. runner 调用真实 credential provider 读取服务端 credential handle。
8. runner 将连接快照、安全 credential handle 和超时配置传给 real HIS adapter。
9. real HIS adapter 执行受控 test connection probe，并返回安全 provider result。
10. runner 将 provider result 映射为 `healthStatus / lastCheckedAt / lastErrorCode`。
11. runner 调用 `writeHisConnectionHealthSummaryForTenant` 写回健康摘要。
12. runner 写入周期健康检查 audit。
13. runner 聚合批次摘要，只返回计数、稳定状态和安全错误码。

调用链约束：

- route 不参与周期调度。
- 前端不参与 candidate query。
- 前端不传 tenant。
- 前端不传候选连接。
- 前端不传 credential。
- 前端不传 endpoint。
- 前端不传 provider result。
- runner 不把真实凭证写入日志、audit、DTO 或健康摘要。
- adapter 不直接写 repository。
- credential provider 不直接写健康状态。
- audit 不保存 raw HIS payload。

## candidate query 边界

candidate query 应只读取服务端可信数据，并返回最小候选集合。

必须满足的条件：

- `tenantId` 来自服务端可信租户枚举、租户 allowlist 或内部调度上下文。
- `connectionId` 来自数据库。
- `status = active`。
- `deletedAt is null`。
- `credentialConfigured = true`。
- `sourceSystem` 在服务端 allowlist 内。
- `vendorType` 在服务端 allowlist 内。
- `systemType` 在服务端 allowlist 内。
- `lastCheckedAt is null`，或 `lastCheckedAt` 早于服务端配置的健康检查阈值。
- 当前连接没有同一来源的 running health task。
- 当前连接没有未释放的健康检查 lock。
- 最近连续失败达到保护阈值时，必须进入 backoff 或人工复核，不得立即重复探测。

必须排除的连接：

- `draft`。
- `paused`。
- `revoked`。
- `deleted`。
- `error`，除非后续明确 error 状态可被调度修复。
- `deletedAt` 非空。
- `credentialConfigured = false`。
- 凭证缺失、凭证被撤销或 credential provider 明确不可用。
- 不在 allowlist 的 `sourceSystem / vendorType / systemType`。
- 已有同一连接健康检查任务在运行。
- 处于 backoff 保护窗口内的连接。
- 最近刚被手动测试连接检查过且未超过阈值的连接。

candidate query 不得做：

- 不从前端请求读取候选列表。
- 不从 query string 或 request body 读取 tenant。
- 不读取真实凭证内容用于筛选。
- 不返回 credentialRef、secret path、endpoint 或 adapter class。
- 不跨租户查询。
- 不返回已删除连接。
- 不返回非 active 连接。
- 不把 provider result 当成查询条件从前端传入。
- 不把健康结果交给前端决定。

候选查询输出建议：

- `tenantId`。
- `connectionId`。
- `lastCheckedAt`。
- `healthStatus`。
- `lastErrorCode`。
- `updatedAt`。
- 用于后续幂等或乐观校验的快照版本字段；若当前字段不足，应单独规划 schema / migration。

## 调度节奏与批次边界

调度节奏建议：

- 由服务端配置控制周期，例如每 N 分钟或每 N 小时。
- 默认关闭或低频启用，直到真实 credential provider 与 real HIS adapter runtime 稳定。
- 支持租户级 allowlist 灰度。
- 支持 source / vendor / system allowlist 灰度。
- 支持全局开关和租户级开关。
- 支持运行窗口，避免在业务高峰自动打满外部系统。

批次边界建议：

- 每次 run 有全局最大候选数。
- 每个租户有最大候选数。
- 每个厂商或系统类型有最大候选数。
- 每个连接同一时间只允许一个健康检查。
- 每个 run 有最大运行时长。
- 每个 adapter probe 有固定超时。
- 每个 run 到达时长上限后停止领取新候选，已在执行的 probe 按超时规则收口。

并发边界建议：

- 全局并发上限。
- 租户级并发上限。
- 厂商级并发上限。
- 单连接互斥。
- 失败或 timeout 不得无限重试。
- retry / backoff 另开 PR。
- 不复用 compensation runner。
- 不新增无限循环。
- 不把 scheduler 运行嵌入 request lifecycle。

## 锁 / 并发 / 幂等边界

后续 runtime 必须先明确锁模型：

- 单实例最小实现可以先用进程内批次保护，但不得声称支持多实例互斥。
- 多实例生产实现需要 durable lock 或 lease。
- lock 必须绑定 `tenantId + connectionId + runId`。
- lock 必须有过期时间。
- lock 写回必须防止旧 run 覆盖新 run。
- 同一连接同一来源只允许一个 running health task。
- run 结束、失败或超时后必须释放或过期 lock。

幂等建议：

- 每次连接检查生成稳定 idempotency key。
- key 至少包含 `tenantId / connectionId / runId / scheduledAt` 或服务端生成的等价字段。
- 写回前重新读取连接快照。
- 写回时校验连接仍为 active、未删除、凭证状态仍符合预期。
- 如后续引入 `expectedUpdatedAt` 或版本字段，健康摘要写回应携带乐观校验。
- 旧快照不得覆盖新手动测试连接结果，除非后续明确优先级规则。

字段风险：

- 当前健康摘要字段足以记录最终状态。
- 当前字段不足以完整表达 durable health task、lease owner、lease expires、run source、连续失败次数和 backoff 到期时间。
- 若要支持多实例、可观测 run 历史、严格幂等或 backoff，需要后续 schema / migration 规划。
- 本轮不新增这些字段。

## 状态写回边界

周期健康检查只能写健康摘要：

- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `updatedAt`。
- 可选 `updatedBy`，必须使用 service actor 或 system actor。

写回必须满足：

- 只通过 repository 写回。
- where 条件绑定 `tenantId + connectionId + deletedAt is null`。
- 写回前确认连接仍为 active。
- 写回前确认凭证仍已配置。
- 写回前确认候选来源仍在 allowlist。
- provider result 必须先归一化为稳定健康状态和稳定错误码。
- repository 写回失败时不能声称健康检查成功。
- audit 写入失败的 fail open / fail closed 策略必须单独明确；建议对安全审计相关失败 fail closed，对运行摘要可记录安全失败计数。

状态映射建议：

| provider result | healthStatus | lastErrorCode |
| --- | --- | --- |
| `healthy` | `healthy` | `null` |
| `degraded` | `degraded` | `limited_health_probe` 或稳定外部错误码 |
| `missing_credential` | `failed` | `missing_credential` |
| `credential_unavailable` | `failed` | `credential_unavailable` |
| `credential_revoked` | `failed` | `credential_revoked` |
| `external_auth_failed` | `failed` | `external_auth_failed` |
| `provider_timeout` | `failed` | `provider_timeout` |
| `external_unreachable` | `failed` | `external_unreachable` |
| `external_rate_limited` | `degraded` 或 `failed` | `external_rate_limited` |
| `external_service_unavailable` | `degraded` 或 `failed` | `external_service_unavailable` |
| `unsupported_vendor` | `failed` | `unsupported_vendor` |
| `unsafe_external_response` | `failed` | `unsafe_external_response` |
| `connection_not_active` | 不写或写 `unknown`，需单独规则 | `connection_not_active` |
| `service_unavailable` | `failed` | `service_unavailable` |
| `validation_failed` | 不写健康摘要 | `validation_failed` |

## 错误码边界

周期健康检查只能使用稳定内部错误码：

- `missing_credential`。
- `credential_provider_unavailable`。
- `credential_unavailable`。
- `credential_revoked`。
- `provider_timeout`。
- `external_unreachable`。
- `external_auth_failed`。
- `external_rate_limited`。
- `external_service_unavailable`。
- `unsupported_vendor`。
- `unsafe_external_response`。
- `connection_not_active`。
- `limited_health_probe`。
- `service_unavailable`。
- `validation_failed`。

不得保存：

- provider raw error。
- HIS raw response。
- HTTP status text 原文。
- endpoint 原文。
- external headers。
- request body。
- response body。
- SQL。
- stack。
- `DATABASE_URL`。
- credentialRef 原值。
- secret path。
- token。
- api key。
- password。
- authorization header。

## audit 边界

推荐后续把周期健康检查与手动测试连接区分：

- 手动测试连接保留 `test_connection` action。
- 周期健康检查建议新增 `scheduled_health_check` action。
- 若新增 action，必须同步 audit events domain、reason whitelist、query parser allowlist 和测试。
- 若短期复用 `test_connection`，必须明确 reason 能区分 scheduled 来源，且不能误导为人工操作。
- audit actor 必须是 system actor 或 service actor。
- audit 不能冒充当前登录用户。
- audit source 应区分 `manual` 与 `scheduled`。
- audit resource 仍可绑定 `open_connection`。
- audit resourceId 使用连接 id。
- audit tenantId 来自服务端可信上下文。

周期健康检查建议 reason：

- `scheduled_health_check_requested`。
- `scheduled_health_check_candidate_selected`。
- `scheduled_health_check_skipped_not_due`。
- `scheduled_health_check_skipped_not_active`。
- `scheduled_health_check_skipped_missing_credential`。
- `scheduled_health_check_provider_healthy`。
- `scheduled_health_check_provider_degraded`。
- `scheduled_health_check_external_unreachable`。
- `scheduled_health_check_external_auth_failed`。
- `scheduled_health_check_provider_timeout`。
- `scheduled_health_check_external_rate_limited`。
- `scheduled_health_check_external_service_unavailable`。
- `scheduled_health_check_unsupported_vendor`。
- `scheduled_health_check_unsafe_external_response`。
- `scheduled_health_check_completed`。
- `scheduled_health_check_repository_failed`。

audit 不得保存：

- raw credential。
- raw credentialRef。
- secret path。
- token。
- api key。
- password。
- authorization header。
- endpoint 原文。
- external headers。
- request body。
- response body。
- provider raw error。
- raw HIS payload。
- 患者资料。
- 预约资料。
- 病历资料。
- 处方资料。
- 收费资料。
- SQL。
- stack。
- `DATABASE_URL`。

## 与手动测试连接的关系

手动测试连接：

- 由用户触发。
- 走 route 权限与 parser。
- 使用当前 `open_connection:test_connection` 权限。
- audit actor 是用户。
- 可用于即时验证当前连接配置。
- DTO 返回给前端，字段严格安全。

周期健康检查：

- 由服务端 scheduler 触发。
- 不走前端 route。
- 不使用前端请求中的 tenant 或 connectionId。
- audit actor 是 system actor 或 service actor。
- 只写健康摘要和安全 audit。
- 返回批次安全摘要，不返回单个外部响应细节。

二者可复用：

- 连接快照读取规则。
- credential provider 后续安全读取能力。
- real HIS adapter 的 test connection probe。
- provider result 到健康摘要的稳定映射。
- `writeHisConnectionHealthSummaryForTenant`。
- 安全 DTO / 安全 summary 的 denylist 思路。

二者不能混用：

- 手动 route 权限不能替代 scheduler 安全上下文。
- 手动 audit actor 不能用于周期任务。
- 周期任务不能接受前端 body。
- 周期任务不能覆盖刚刚完成的手动测试结果，除非后续定义优先级和幂等规则。

## 与真实 credential provider 的关系

周期健康检查依赖 TC-10 后续 runtime，但不能越界实现：

- runner 只能使用服务端 credential handle。
- credential provider 负责解析 `credentialRef`。
- credential provider 负责读取 secret manager / KMS / Vault 或后续选定的安全存储。
- credential provider 只返回 adapter 所需的最小 credential material 或安全 handle。
- runner 不记录 credential material。
- runner 不把 credential material 放入 audit。
- runner 不把 credential material 放入 DTO。
- runner 不把 credential material 写入健康摘要。
- candidate query 不能因为读取真实凭证而做筛选。
- credential provider 不可用时映射为稳定错误码。

本轮不实现：

- credential provider runtime。
- server-only credential handle resolver。
- secret manager / KMS / Vault adapter。
- credential cache。
- credential rotation。
- credential repair。

## 与 real HIS adapter 的关系

周期健康检查依赖 TC-11 后续 runtime，但不能越界实现：

- real HIS adapter 负责执行受控 test connection probe。
- adapter 输入由 runner / service 从服务端快照构造。
- adapter 输出只能是稳定 provider result。
- adapter 不写 repository。
- adapter 不写 audit。
- adapter 不返回 raw HIS response。
- adapter 不返回 raw external error。
- adapter 不暴露 endpoint 原文、headers、request body、response body 或内部异常。
- adapter 必须有固定超时。
- adapter 不得无限重试。
- adapter 必须执行 SSRF 防护和 outbound allowlist / denylist。
- adapter 必须限制 TLS、重定向和响应大小等外部风险。

本轮不实现：

- real HIS adapter interface。
- 任一厂商 adapter。
- outbound HTTP client。
- network allowlist。
- provider result mapper runtime。
- adapter 测试连接切换 runtime。

## 安全 denylist

周期健康检查全链路不得出现在日志、audit、DTO、健康摘要、批次摘要或错误消息中的内容：

- `credentialRef` 原值。
- secret path。
- secret manager path。
- Vault path。
- KMS key id。
- token。
- api key。
- password。
- authorization header。
- basic auth。
- oauth token。
- private key。
- client secret。
- connection string。
- `DATABASE_URL`。
- HIS 账号。
- HIS 密码。
- HIS 厂商认证响应体。
- HIS 原始响应体。
- HIS 请求体。
- endpoint 原文。
- external headers。
- raw credential。
- raw HIS payload。
- provider raw error。
- patient data。
- appointment data。
- medical record data。
- prescription data。
- billing data。
- SQL。
- stack。

调度层额外不得接收：

- 前端 tenant。
- 前端候选列表。
- 前端健康结果。
- 前端 provider result。
- 前端 credential。
- 前端 endpoint。
- 前端 retry 参数。
- 前端 batch size。
- 前端 concurrency。

## 后续 PR 拆分建议

建议不要直接进入 runner runtime。后续拆分顺序：

1. 周期健康检查 candidate query 边界与最小 repository / query 规划。
2. 周期健康检查 audit action / reason / query whitelist 规划。
3. system actor / service actor 审计上下文规划。
4. 真实 credential provider interface runtime。
5. server-only credential handle resolver runtime。
6. real HIS adapter interface runtime。
7. 单厂商 real adapter 最小 runtime。
8. 周期健康检查 provider result mapper 规划与 runtime。
9. 单实例 runner 最小 runtime，只处理 fake 或受控 provider。
10. scheduler 触发层最小 runtime。
11. durable lock / lease / backoff schema 规划，如确认为生产级多实例必需。
12. 多实例 scheduler / runner 幂等与 observability runtime。

## 规划验收口径

本文档完成后，后续实现不得默认具备以下能力：

- 不得默认已有真实 credential provider。
- 不得默认已有真实凭证读取。
- 不得默认已有 secret manager / KMS / Vault。
- 不得默认已有 real HIS adapter。
- 不得默认允许出站网络。
- 不得默认已有 durable health task lock。
- 不得默认已有 backoff 字段。
- 不得默认可以复用 compensation worker。
- 不得默认可以复用手动测试连接的用户 actor。
- 不得默认可以直接做 runner runtime。

后续进入实现前必须先回答：

- candidate query 是否已有足够字段。
- 多实例锁是否需要 schema / migration。
- audit action 是复用 `test_connection` 还是新增 `scheduled_health_check`。
- system actor 如何表达。
- real credential provider runtime 是否已合并。
- real HIS adapter runtime 是否已合并。
- 出站网络 allowlist / denylist 是否已合并。
- 手动测试连接结果与周期健康检查结果冲突时谁优先。

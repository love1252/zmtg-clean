# Phase 23 HIS 连接配置凭证 provider 失败审计边界规划

> 日期：2026-06-06
> 状态：Phase 23 HIS 连接配置凭证 provider failure audit / service audit Plan Mode 文档。本 PR 只做 docs-only 规划，不写代码、不修改 `src/**`、不新增 audit reason / action / result、不新增 metadata schema、不修改 audit repository、不新增 schema / migration、不处理真实凭证、不做测试连接、不接真实 HIS。

## 本次范围

本 PR 只规划 HIS 连接配置凭证 provider failure audit 与 service audit 的最小边界，承接已完成的 provider failure / compensation domain 最小边界和 audit reason / query whitelist 最小边界。

本 PR 明确只做：

- docs-only Plan Mode。
- 规划 provider failure audit 写入职责、写入时机、去重、fail closed 和敏感信息禁区。
- 规划 service audit 的成功路径保持、provider failure 失败路径、audit 失败映射和事务顺序边界。
- 规划 route audit 与 service audit 的职责拆分，避免 provider failure 被 route 重复审计。
- 规划 compensation audit 的后续进入条件、职责归属、metadata / schema 前置条件和敏感信息禁区。
- 规划已存在 audit reason 的使用时机，不新增 reason / action / result。
- 规划无 metadata schema 时的字段使用边界。
- 规划 fail closed / best effort 取舍和后续 outbox 可能改变的策略。
- 规划后续测试拆分建议。
- 同步 README、roadmap 和当天 devlog。

本 PR 明确不做：

- 不写代码。
- 不修改 `src/**`。
- 不新增 API route。
- 不修改 route、service、parser、DTO、provider、storage、repository 或权限。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不新增 audit action。
- 不新增 audit result。
- 不新增 audit metadata schema。
- 不新增 schema / migration。
- 不修改测试。
- 不实现 provider failure audit。
- 不实现 compensation audit。
- 不修改 service allowed audit 逻辑。
- 不修改 route denied audit 逻辑。
- 不实现 job queue / outbox / cleanup。
- 不接真实 KMS / Vault / provider。
- 不处理真实凭证。
- 不保存 token、secret、API key、connection string 或 raw HIS payload。
- 不让 HTTP route 接收真实凭证明文。
- 不改造 parser 放行真实凭证材料。
- 不做测试连接。
- 不接真实 HIS。
- 不创建自动治疗摘要、自动随访任务或自动触达。
- 不接企微。
- 不接 AI / RAG / Agent。

## 前置状态

当前已完成：

- HIS 连接配置凭证 API route / permission / audit 最小实现。
- `open_connection:manage_credentials` 权限动作。
- route denied audit：权限拒绝和 parser failure 写 denied audit。
- service allowed audit：repository 成功后写 allowed audit。
- 凭证 provider abstraction。
- provider failure / compensation domain 最小实现。
- provider failure 白名单分类。
- domain-only compensation summary。
- provider failure 到现有 service result code 的稳定映射。
- audit reason / query whitelist Plan Mode。
- audit reason / query whitelist 最小实现。
- provider failure / compensation reason 已进入 `AuditReason` 和 `AUDIT_REASON_VALUES`。

当前仍未完成：

- provider failure audit 写入。
- compensation audit 写入。
- audit metadata schema。
- audit repository 改造。
- compensation 持久化。
- job queue / outbox。
- real provider。
- real credential parser / service。
- 测试连接。
- 真实 HIS adapter。

现有审计事件字段仍是标准字段：actor、tenant、resource、resourceId、action、result、reason、occurredAt、source。现有 query parser 仍只接受 `from`、`to`、`resource`、`resourceId`、`action`、`result`、`reason`、`actorId`、`limit`、`cursor`，并通过白名单枚举校验 action、result 和 reason。

现有凭证 service 事实：

- 成功路径在 repository `ok` 后写 allowed audit。
- allowed audit 写入失败时按现有行为 fail closed 为 `service_unavailable`。
- 已知 provider failure 当前只映射为稳定 service status，不写 provider failure audit。
- 未知异常当前映射为 `service_unavailable`，不泄露异常详情。

现有 route 事实：

- 权限拒绝写 route denied audit。
- parser failure 写 route denied audit。
- route 将 service result 映射为稳定 DTO / HTTP response。
- route 不应接触 provider failure 原始对象、provider path、`credentialRef` 或 `idempotencyKey`。

## provider failure audit 写入边界

provider failure audit 是未来 service 层对凭证 provider 失败路径的安全审计记录，不是 provider 底层直接写 audit，也不是 route 层重复写 denied audit。

建议未来需要写 audit 的 provider failure category：

| provider failure category | 建议写 audit | 建议 reason | 建议 result | 写入说明 |
| --- | --- | --- | --- | --- |
| `provider_unavailable` | 是 | `provider_unavailable` | `denied` | provider 暂不可用，凭证操作未完成，记录稳定可用性失败。 |
| `timeout` | 是 | `provider_timeout` | `denied` | 超时结果可能未知，必须为后续补偿或人工复核保留稳定审计信号。 |
| `retry_exhausted` | 是 | `provider_retry_exhausted` | `denied` | 已达到重试上限，当次请求 fail closed。 |
| `circuit_open` | 是 | `provider_circuit_open` | `denied` | circuit open 时不应继续调用 provider，记录运行保护状态。 |
| `validation_failed` | 是 | `provider_validation_failed` | `denied` | provider 层拒绝安全输入或策略校验失败，不写原始 message。 |
| `provider_write_failed` | 是 | `provider_write_failed` | `denied` | store / rotate 未产出可用安全引用。 |
| `provider_revoke_failed` | 是 | `provider_revoke_failed` | `denied` | clear / revoke 失败可能留下可用凭证，风险较高。 |
| `provider_describe_failed` | 视场景 | `provider_describe_failed` | `denied` | 如 describe 是写入或补偿关键路径，则写 audit；只读健康摘要失败可后续单独评估。 |
| `provider_health_failed` | 视场景 | `provider_health_failed` | `denied` | 写入前 health gate 失败可写 audit；周期健康检查需后续单独规划。 |
| `repository_after_provider_failed` | 是 | `repository_after_provider_failed` | `denied` | provider 已成功但 repository 失败，存在 orphan secret 风险。 |
| `audit_after_provider_failed` | 是 | `audit_after_provider_failed` | `denied` | provider / repository 成功但 allowed audit 失败，需进入一致性处理。 |
| `tenant_connection_mismatch` | 暂不新增专用 audit | `not_found_or_not_owned` 或 `provider_validation_failed` | `denied` | 避免暴露租户 / 连接存在性，v1 不新增 reason。 |
| `idempotency_conflict` | 暂不新增专用 audit | `provider_validation_failed` | `denied` | 不新增 idempotency 专用 reason；不得写 idempotencyKey。 |
| `invalid_state` | 暂不新增专用 audit | `invalid_transition` | `denied` | 复用既有状态流转 reason，不新增 provider 专用 reason。 |

暂不写 audit 的场景：

- provider health / describe 的非关键后台探测，如果不影响用户请求，不应混入凭证管理 service audit。
- provider 内部自动 retry 的中间失败，在最终成功时不写失败 audit，避免噪声和重复。
- 被 parser 拒绝的真实凭证材料、provider path 或 external secret path，仍由 route parser failure denied audit 覆盖，不进入 provider failure audit。
- 权限拒绝、缺失 tenant、跨租户等 access decision，仍由 route denied audit 覆盖。

职责归属：

- provider failure audit 应由 service 层或 service 编排的安全 audit helper 写入。
- provider layer 不允许直接写 audit。
- route layer 不允许写 provider failure audit。
- provider failure audit 使用 `resource: "open_connection"`、`action: "manage_credentials"`。
- v1 继续使用现有 `denied` result，不新增 `failure` result。

fail closed 边界：

- provider failure audit 写入失败建议 fail closed。
- 返回稳定 `service_unavailable`，不得泄露 audit repository 异常。
- 没有 outbox 前不建议 best effort，因为凭证失败路径是安全敏感路径，丢 audit 会降低可追溯性。

重复写入边界：

- 同一次 service 请求最多写一条 provider failure audit。
- route denied audit 与 provider failure audit 不应同时覆盖同一失败。
- 权限拒绝或 parser failure 在 route 层终止，不进入 service，因此不会写 provider failure audit。
- provider failure 发生在 service 内，不回到 route 层补写 denied audit。
- provider 内部 retry 的多次失败不应逐次写 audit，只在最终失败分类确定后写一次。

与 allowed audit 的先后关系：

- store / rotate 成功路径：provider store 成功 -> repository 写入事务 -> allowed audit -> 返回成功。
- provider store 失败：provider failure audit -> 返回稳定失败；不得写 allowed audit。
- repository after provider failed：provider 已成功但 repository 失败 -> provider failure audit -> 触发后续 compensation 规划；不得写 allowed audit。
- audit after provider failed：provider 与 repository 成功但 allowed audit 失败 -> 当前仍 fail closed；后续如写 provider failure audit 或 compensation audit，必须避免递归审计失败。

敏感信息禁区：

- provider failure audit 不得写真实 provider path。
- 不得写 `credentialRef`。
- 不得写 idempotencyKey 或 scoped idempotency key。
- 不得写 request body。
- 不得写 response body。
- 不得写 provider 原始错误全文。
- 不得写 token、secret、API key、connection string、raw credential 或 raw HIS payload。
- 不得把 provider 细节拼接进 reason。
- 不得把 failure category、compensation state、provider path 或 `credentialRef` 塞进 `resourceId`。

## service audit 边界

service 成功路径：

- allowed audit 保持现状。
- 成功 audit 继续使用 `resource: "open_connection"`、`action: "manage_credentials"`、`result: "allowed"`、`reason: "allowed_by_policy"`。
- allowed audit 继续在 repository `ok` 后写入。
- allowed audit 写入失败继续 fail closed。

provider failure 路径：

- provider failure 时未来可写 provider failure denied audit。
- 写入位置建议在 service catch 已知 safe provider failure 后、返回 service status 前。
- provider failure audit 的 reason 来自现有 `AuditReason`。
- provider failure audit 的 result 使用现有 `denied`。
- provider failure audit 不改变 route DTO 结构，只影响审计记录和稳定 service status。

repository failure 路径：

- repository 返回非 ok 的业务结果，不等同 provider failure。
- create / update / rotate / clear / revoke 的 repository 非 ok 结果应按现有 service result 返回。
- 是否为 repository 非 ok 写 provider failure audit，需要限定在 provider 已经成功但 repository 失败的情况。
- 单纯 `not_found`、`validation_failed`、`invalid_state_transition` 不应伪装成 provider failure。

audit failure 路径：

- allowed audit failure 当前已 fail closed 为 `service_unavailable`。
- provider failure audit 写入失败建议同样映射为 `service_unavailable`。
- route denied audit failure 继续由 route 层映射为 `service_unavailable`。
- audit failure 的错误对象不得进入 DTO、audit、devlog 或日志。

helper 边界：

- 后续可新增 service 内部 helper 统一创建 credential audit event。
- helper 输入必须是安全枚举和可信 `tenantId + connectionId + accessContext`。
- helper 不接收 provider 原始 error。
- helper 不接收 request body / response body。
- helper 不接收真实凭证材料。
- helper 不接收 provider path、`credentialRef` 或 idempotencyKey。

事务顺序边界：

- `runStoredCredentialReferenceService` 需要协调 provider store 与 repository transaction 的不可同事务问题。
- provider store 在 repository transaction 前完成时，repository 失败可能产生 orphan secret，需要后续 compensation。
- repository `ok` 后 allowed audit 失败时，当前 fail closed；后续需决定是否触发 `audit_after_provider_failed` 和 compensation。
- `runClearCredentialReferenceService` 当前不调用 provider revoke；如果未来接入 provider revoke，必须明确 repository clear / revoke 与 provider revoke 的顺序。
- clear / revoke 不得在 provider revoke 未确认时把前端展示为彻底完成。

## route audit 边界

route denied audit 继续只处理：

- permission denied。
- missing tenant。
- cross tenant denied。
- parser failure。
- malformed JSON。

route 不处理：

- provider failure audit。
- service provider failure 原始对象。
- service allowed audit 失败补写。
- compensation audit。
- provider path / secret path。
- `credentialRef`。
- idempotencyKey。
-真实凭证明文。

route 职责保持：

- 解析 path `connectionId`。
- 获取 access context。
- 做 permission guard。
- 读取并解析 body。
- 调用 service。
- 将 service result 映射为稳定 DTO / HTTP status。
- route denied audit 失败时 fail closed。

route 与 service 去重：

- route 层权限拒绝和 parser failure 不调用 service，因此不产生 service audit。
- service 内 provider failure 不回到 route 层写 denied audit。
- service returned status 只做 DTO mapping，不触发新的 route denied audit。

## compensation audit 边界

compensation audit 是后续阶段，不在本 PR 实现。

可能写 audit 的 compensation 状态：

| compensation state | 是否建议写 audit | 建议 reason | 建议 result | 前置条件 |
| --- | --- | --- | --- | --- |
| `compensation_pending` | 是 | `compensation_pending` | `denied` | 识别到 provider / repository / audit 不一致且已持久化或可追踪。 |
| `compensation_running` | 视场景 | `compensation_running` | `denied` | 如果有 job / outbox 状态，记录开始执行。 |
| `compensation_succeeded` | 是 | `compensation_succeeded` | `allowed` | 已安全清理或禁用风险状态。 |
| `compensation_failed` | 是 | `compensation_failed` | `denied` | 自动补偿失败，需要重试或人工处理。 |
| `manual_review_required` | 是 | `manual_review_required` | `denied` | 无法自动判断或自动处理不安全。 |

职责归属：

- compensation audit 应由 compensation domain / job 层写入。
- 如果当前没有 job queue / outbox，service 不应假装实现完整 compensation audit。
- service 可在发现 provider / repository 不一致时写 provider failure audit，并返回稳定失败；后续 compensation audit 需单独阶段接入。
- compensation job 写 audit 前必须有可追踪的 compensation state 或 operation id。

当前没有 job queue / outbox 时：

- 暂不写 compensation audit。
- 不新增 compensation 状态持久化。
- 不新增 audit metadata schema。
- 不新增 schema / migration。
- 不把 compensation internal key 塞进 audit。

metadata / schema 前置：

- compensation audit 如果需要记录 failure category、state、retry count、operation、version digest，需要 metadata schema 或独立 compensation 表。
- 没有 metadata schema 前，只能使用现有 reason 粗粒度表达，不得滥用 `resourceId`。
- 如果需要 outbox、retry、人工处理状态，必须单独 Plan Mode 评估 schema / migration。

provider failure audit 关联方式：

- v1 可通过同一 `tenantId + connectionId + operation` 和时间窗口关联，但这只能作为内部排查辅助，不能作为正式数据模型。
- 正式关联需要后续 metadata schema 或 compensation 表。
- 不允许把 compensation internal key 写进 audit event 的现有字段。
- 不允许把 provider path、`credentialRef`、idempotencyKey 写进 audit。

## audit reason 使用边界

已存在 provider failure / compensation reason：

- `provider_unavailable`
- `provider_timeout`
- `provider_retry_exhausted`
- `provider_circuit_open`
- `provider_validation_failed`
- `provider_write_failed`
- `provider_revoke_failed`
- `provider_describe_failed`
- `provider_health_failed`
- `repository_after_provider_failed`
- `audit_after_provider_failed`
- `compensation_pending`
- `compensation_running`
- `compensation_succeeded`
- `compensation_failed`
- `manual_review_required`

写入时机规划：

- `provider_unavailable`：provider 不可用导致 store / rotate / clear / revoke / describe / health 关键路径失败。
- `provider_timeout`：provider 调用超时且结果未知或不可确认。
- `provider_retry_exhausted`：可重试 provider failure 达到上限。
- `provider_circuit_open`：circuit breaker 打开，service 不再调用 provider。
- `provider_validation_failed`：provider 层拒绝安全输入或内部参数违反 provider policy。
- `provider_write_failed`：store / rotate 写入 provider 失败。
- `provider_revoke_failed`：clear / revoke 时 provider revoke / disable 失败或未知。
- `provider_describe_failed`：describe 是关键路径且失败影响一致性判断。
- `provider_health_failed`：health gate 是关键路径且失败导致写入被拒绝。
- `repository_after_provider_failed`：provider 成功后 repository set / rotate / clear / revoke 失败。
- `audit_after_provider_failed`：provider 和 repository 成功后 allowed audit 失败，且需进入一致性处理。
- `compensation_pending`：已识别不一致且等待补偿。
- `compensation_running`：补偿任务开始执行。
- `compensation_succeeded`：补偿安全完成。
- `compensation_failed`：补偿失败。
- `manual_review_required`：自动补偿不安全或无法判断。

使用要求：

- v1 不新增新 reason。
- v1 不新增 action。
- v1 不新增 result。
- v1 不新增 metadata schema。
- reason 只能表达稳定分类。
- 不得把 provider 内部细节塞进 reason。
- 不得把多个维度拼接成新 reason。
- 不得把 provider path、secret path、`credentialRef`、idempotencyKey、raw payload、SQL、stack 或 provider 原始错误塞进 reason。

## audit metadata 边界

当前无 metadata schema。

因此当前不得：

- 写 metadata。
- 把 provider failure category 塞进 `resourceId`。
- 把 compensation state 塞进 `resourceId`。
- 把 provider path 塞进任何现有字段。
- 把 `credentialRef` 塞进任何现有字段。
- 把 idempotencyKey 塞进任何现有字段。
- 把 request body / response body 塞进任何字段。
- 把 provider 原始错误塞进任何字段。

未来如果需要 metadata schema，必须单独 Plan Mode。

未来允许的安全摘要可包括：

- provider type。
- provider mode。
- failure category。
- compensation state。
- retry count。
- operation。
- version digest 短摘要。
- occurredAt。

未来仍禁止字段：

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
- external secret path。
- provider internal path。
- KMS key material。
- `credentialRef`。
- idempotencyKey。
- scoped idempotency key。
- synthetic placeholder。
- SQL。
- stack。
- `DATABASE_URL`。
- request body。
- response body。
- provider error full text。

## fail closed / best effort 边界

provider failure audit 写入失败：

- 建议 fail closed。
- 返回稳定 `service_unavailable`。
- 不泄露 audit repository 异常。
- 不重试写 audit 到不受控目标。
- 不降级为 best effort。

allowed audit 写入失败：

- 保持现状，继续 fail closed。
- 继续返回稳定 `service_unavailable`。
- 不泄露 audit repository 异常。

route denied audit 写入失败：

- 保持现状，继续 fail closed。
- 权限拒绝或 parser failure 的 audit 失败时返回稳定 `service_unavailable`。
- 不继续调用 service。

compensation audit 写入失败：

- 当前不实现 compensation audit。
- 未来如果已有 compensation job / outbox，compensation audit 失败应进入 `manual_review_required` 或等价安全状态。
- 没有 outbox 前，不建议把 compensation audit 作为 best effort。
- 如果无法记录 compensation audit，不得假装 compensation 已成功。

没有 outbox 前：

- 不允许 best effort 用于 provider failure audit。
- 不允许 best effort 用于 allowed audit。
- 不允许 best effort 用于 route denied audit。
- compensation audit 暂不进入实现。

未来引入 outbox 后：

- 可重新评估 provider failure audit 和 compensation audit 是否由同步 fail closed 改为事务性 outbox。
- outbox 必须有持久化状态、重试次数、死信 / manual review 状态和安全摘要。
- outbox payload 仍不得包含真实凭证、provider path、`credentialRef`、idempotencyKey、request body、response body 或 provider error full text。
- outbox schema / migration 必须单独 Plan Mode。

## 测试拆分建议

本 PR 不写测试，只规划后续测试拆分。

provider failure audit service tests：

- 已知 provider failure 时 service 写一条 `manage_credentials` / `denied` audit。
- 每类 provider failure category 映射到既有 reason。
- `provider_unavailable`、`provider_timeout`、`provider_retry_exhausted`、`provider_circuit_open` 使用对应 reason。
- provider write / revoke / describe / health 失败使用对应 reason。
- provider failure audit payload 不包含 provider path、`credentialRef`、idempotencyKey、request body、response body、raw credential、raw HIS payload 或 provider 原始错误。

service provider failure 不触发 route denied audit tests：

- route permission denied 仍只写 route denied audit，不调用 service。
- parser failure 仍只写 route denied audit，不调用 service。
- service 返回 provider failure 映射状态时 route 不补写 denied audit。
- route 不接触 provider failure 原始对象。

provider failure audit uses manage_credentials tests：

- 所有 provider failure audit 均使用 `resource: "open_connection"`。
- 所有 provider failure audit 均使用 `action: "manage_credentials"`。
- 不新增 provider / compensation 专用 action。

provider failure audit uses existing reason tests：

- service 只使用已存在 reason。
- 不新增 reason。
- 不新增 action。
- 不新增 result。
- 不新增 metadata schema。

no duplicate audit tests：

- 同一次 provider failure 只写一条 failure audit。
- provider retry 内部中间失败不逐条写 audit。
- provider failure 后不写 allowed audit。
- route denied audit 和 provider failure audit 不同时覆盖同一请求。

audit failure fail closed tests：

- provider failure audit 写入失败返回 `service_unavailable`。
- allowed audit 写入失败继续返回 `service_unavailable`。
- route denied audit 写入失败继续返回 `service_unavailable`。
- audit repository error 不出现在响应、audit event 或日志快照。

route permission denied / parser failure audit unchanged tests：

- `manage_credentials` 权限拒绝仍写 route denied audit。
- parser failure 仍写 `invalid_his_connection_payload` route denied audit。
- malformed JSON 不调用 service。
- parser 拒绝 token、secret、API key、connection string、raw credential、raw payload、external secret path。

service allowed audit unchanged tests：

- repository `ok` 后仍写 allowed audit。
- allowed audit 不包含 placeholder、idempotencyKey 或 `credentialRef`。
- 成功 DTO 仍只返回 `ok` 和 `credentialConfigured`。

compensation audit Plan tests：

- 当前不实现 compensation audit。
- 如果后续进入实现，先写 pending / running / succeeded / failed / manual review 的 domain 或 service tests。
- 没有 metadata schema 前不得断言 metadata 字段。

schema / metadata 回归检查：

- no metadata schema regression checks：不新增 audit metadata 字段。
- no schema migration regression checks：不新增 schema / migration。
- docs-only PR 检查：本阶段不得修改 `src/**` 或测试文件。

## 后续阶段边界

本 PR 不进入：

- provider failure audit 实现。
- compensation audit 实现。
- metadata schema。
- audit repository 改造。
- schema / migration。
- job queue / outbox。
- real provider。
- real credential parser / service。
- 测试连接。
- 真实 HIS adapter。
- webhook / 同步任务。
- 患者身份匹配。
- 自动治疗摘要。
- 自动随访任务。
- 自动触达。
- 企微。
- AI / RAG / Agent。
- 经营智能中心。
- 图表 / 导出。

## 下一阶段建议

建议后续顺序：

1. provider failure audit / service audit 最小实现。
2. provider failure audit tests。
3. compensation audit Plan Mode。
4. real credential one-time material parser / service Plan Mode。
5. 测试连接 Plan Mode。
6. 真实 HIS adapter Plan Mode。

下一阶段 provider failure audit / service audit 最小实现仍应保持小边界：

- 只接入已知 safe provider failure。
- 只使用现有 reason。
- 只使用现有 action / result。
- 不新增 metadata schema。
- 不修改 audit repository。
- 不接真实 provider。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS。

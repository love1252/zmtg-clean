# Phase 23 HIS 连接配置凭证补偿审计 metadata 与 outbox 边界规划

> 日期：2026-06-06
> 状态：Phase 23 HIS 连接配置凭证 compensation audit 最小实现前置评估后的 docs-only Plan Mode 文档。本 PR 只做只读盘点结论和 metadata / outbox 边界规划，不写代码、不修改 `src/**`、不新增 metadata schema、不新增 schema / migration、不实现 outbox / job queue、不实现 compensation audit、不处理真实凭证、不做测试连接、不接真实 HIS。

## 本次结论

只读盘点结论：当前不满足 compensation audit 最小实现条件。

阻塞原因：

- 当前没有 compensation state 持久化位置。
- 当前没有 compensation operationId 或等价 safe operation key。
- 当前没有 outbox / job queue。
- 当前没有 audit metadata schema。
- 当前 audit repository 只落标准审计字段，不落 metadata。
- 当前 query parser 不支持 metadata filter，也显式拒绝 `metadata`、`compensationState`、`failureCategory` 等非白名单字段。
- 当前只有 domain-only compensation summary，不能表达 pending、running、retry、dead letter、manual review 的生命周期。
- 如果只用现有 audit 字段强行写 compensation audit，会把状态、关联、重试、人工复核和补偿链路压扁成孤立事件，容易误导平台侧判断。

因此本阶段停止实现路径，改做 metadata / outbox docs-only Plan Mode。后续必须先明确 metadata schema、compensation state、operationId、outbox / job queue、dead letter / manual review、audit repository 和 query parser 边界，再评估 compensation audit 最小实现。

## 只读盘点结果

当前是否已有 compensation state 持久化位置：否。仅有 `hisConnectionCredentialCompensationStates` 枚举和 domain-only summary。

当前是否已有 compensation operationId：否。现有审计事件没有 operationId 字段，service 也没有生成 safe operation id。

当前是否已有 outbox / job queue：否。凭证 service 只做同步 provider / repository / audit 编排。

当前是否已有 audit metadata schema：否。`TenantAuditEvent` 只有标准字段，audit repository insert 也只写标准字段。

当前是否可以只用现有 audit 字段表达 compensation audit：否。现有字段只能表达 resource、resourceId、action、result、reason、occurredAt、actor 和 source，无法安全表达 operationId、compensation state、failure category、retry、dead letter 或 manual review。

是否可以不新增 schema / migration：否。只要需要保存 compensation operation、state、retry、dead letter 或 manual review，就需要 schema / migration。

是否可以不修改 audit repository：否。若 metadata 进入审计事件，需要 audit repository 明确落库、过滤和输出边界；若 metadata 不进 audit repository，则 compensation operation / outbox 仍需要独立 repository。

是否可以不新增 metadata schema：否。没有 metadata schema 时不能正式关联 provider failure audit、compensation state 和 job execution。

是否可以不新增 audit reason / action / result：是。现有 compensation reason、`manage_credentials` action、`allowed` / `denied` result 足够作为事件枚举。

是否可以不修改 route / parser / DTO：当前 compensation audit 实现不应修改 route / parser / DTO；未来 metadata query 如进入平台查询，需要单独评估 audit query parser 和 DTO。

是否可以不修改 provider / storage：是。metadata / outbox 规划不要求修改 provider / storage，也不接真实 provider。

是否可以不实现 job queue / outbox：否。若要表达 pending、running、retry、dead letter 或 manual review，需要 outbox / job queue 或等价持久化机制。

是否可以不处理真实凭证：是，且必须继续不处理真实凭证。

是否可以不做测试连接：是，且必须继续不做测试连接。

是否可以不接真实 HIS：是，且必须继续不接真实 HIS。

下一步是否应改做 metadata schema / outbox Plan Mode：是。本 PR 即为该边界规划。

## 为什么不能无 metadata / outbox 安全完成

无 metadata 的问题：

- provider failure audit 与 compensation audit 只能靠 `tenantId + connectionId + occurredAt` 粗略人工排查，不能形成正式链路。
- 不能记录 safe operation id，无法区分同一连接上的多次凭证操作。
- 不能记录 failure category，平台侧无法判断是 provider timeout、repository after provider failed，还是 audit after provider failed。
- 不能记录 retry count、lastAttemptAt、manual review flag，无法表达补偿进展。
- 如果把这些信息塞入 `resourceId`、`action`、`reason` 或 `source`，会破坏现有审计模型并引入敏感信息风险。

无 outbox / job queue 的问题：

- service 只能表达同步请求结果，不能表达后台补偿生命周期。
- 不能稳定表示 `compensation_pending` 到 `compensation_running` 到最终态的状态变化。
- 不能做有限重试、退避、dead letter 或人工复核。
- compensation audit 写入失败时没有 retry / alert 承载，只能 fail closed 或丢失审计，两者都不能安全代表补偿完成。
- provider cleanup 成功但 audit 写入失败时，没有持久化告警和人工处理入口。

无 compensation state 持久化的问题：

- pending / running / failed / manual review 只能成为一次性 audit reason，不能表示当前状态。
- 多次重复请求或重复 job 无法去重。
- 平台侧无法判断哪条补偿链路已经完成、失败或需要人工处理。
- 后续真实 provider、真实凭证和测试连接进入后，缺少状态表会让风险清理不可追踪。

## metadata 字段边界

后续允许评估的安全 metadata 字段：

- `operationId`：安全随机值或不可逆摘要，用于关联同一补偿链路。
- `operation`：`store`、`rotate`、`clear`、`revoke`、`repository`、`audit` 等安全枚举。
- `compensationState`：`pending`、`running`、`succeeded`、`failed`、`manual_review_required` 等安全状态。
- `failureCategory`：现有 provider failure 白名单分类。
- `providerType`：安全 provider 类型摘要，例如 `in_memory_test_only`、未来 `kms` 或 `vault` 的稳定枚举。
- `providerMode`：安全模式摘要，例如 `test_only`、`managed_secret`。
- `retryCount`：非负整数，上限有限。
- `maxRetryCount`：非负整数，上限有限。
- `lastAttemptAt`：ISO 时间。
- `nextAttemptAt`：ISO 时间。
- `manualReviewRequired`：布尔值。
- `deadLetterReason`：稳定枚举，不是原始错误。
- `versionDigest`：不可逆短摘要，不是 provider path，不是 `credentialRef`。

metadata 字段原则：

- 只允许安全枚举、布尔值、有限整数、ISO 时间和不可逆短摘要。
- 不允许自由文本 provider error。
- 不允许 request body、response body 或真实凭证材料。
- 不允许把 `credentialRef`、provider path、idempotencyKey 或 secret path 作为 operationId。
- 所有 metadata 字段必须有白名单校验和敏感词测试。

## compensation state 边界

后续需要评估的持久化 state：

| state | 含义 | 是否终态 | audit result 建议 | 人工处理 |
| --- | --- | --- | --- | --- |
| `pending` | 已识别补偿需求，尚未被 worker 领取。 | 否 | `denied` | 可能 |
| `running` | worker 已领取并正在处理。 | 否 | `denied` | 运行失败后可能 |
| `succeeded` | 自动补偿完成。 | 是 | `allowed` | 通常否 |
| `failed` | 自动补偿失败并停止重试。 | 是 | `denied` | 是 |
| `manual_review_required` | 自动补偿不安全或无法判定，需要人工复核。 | 是或人工处理前状态 | `denied` | 是 |
| `cancelled` | 后续若支持人工取消，需要单独评估。 | 是 | `denied` | 是 |

本阶段不新增 state 枚举到代码。后续如果需要新增 `cancelled` 或其他 state，必须单独评估是否需要 audit reason 扩展；当前 compensation audit 事件仍优先复用既有 reason。

## operationId 边界

需要 operationId：是。

用途：

- 关联 provider failure audit。
- 关联 compensation operation / state。
- 关联 outbox job execution。
- 支撑去重和幂等。
- 支撑平台侧人工排查。

生成边界：

- operationId 必须由 server 生成。
- operationId 必须是安全随机值或不可逆摘要。
- operationId 不得来自 request body。
- operationId 不得包含 `tenantId`、`connectionId`、`credentialRef`、provider path、secret path 或 idempotencyKey 的明文。
- operationId 不得塞进 audit `resourceId`。

关联边界：

- audit `resourceId` 继续使用 connectionId。
- operationId 放入 metadata 或 compensation operation 表。
- provider failure audit 与 compensation audit 通过 operationId 关联。
- 如果 audit metadata 暂不实现，operationId 至少应在 compensation operation 表中持久化，再由 audit event 安全关联策略单独规划。

## outbox 表边界

是否需要 outbox 表：需要。

原因：

- provider / repository / audit 不在同一事务边界内。
- provider store 成功但 repository 失败可能产生 orphan secret 风险。
- repository 成功但 allowed audit fail closed 可能需要一致性处理。
- compensation audit 写入失败需要 retry、dead letter 或 operator alert。
- 后台补偿必须有可追踪、可去重、可重试的安全任务载体。

outbox 表建议字段：

- `id`：安全任务 id。
- `tenantId`：租户 id。
- `connectionId`：HIS 连接配置 id。
- `operationId`：安全补偿链路 id。
- `operation`：安全枚举。
- `failureCategory`：安全枚举。
- `state`：pending / running / succeeded / failed / manual_review_required。
- `providerType`：安全枚举。
- `providerMode`：安全枚举。
- `retryCount`：有限整数。
- `maxRetryCount`：有限整数。
- `nextAttemptAt`：ISO 时间。
- `lastAttemptAt`：ISO 时间或 null。
- `createdAt`：ISO 时间。
- `updatedAt`：ISO 时间。
- `deadLetterReason`：稳定枚举或 null。
- `manualReviewRequired`：布尔值。
- `versionDigest`：不可逆短摘要或 null。

outbox payload 禁区：

- 真实凭证。
- token。
- secret。
- API key。
- connection string。
- OAuth token。
- private key。
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

## job queue 边界

是否需要 job queue：需要，或至少需要等价 worker 轮询机制。

job queue 职责：

- 领取 pending compensation operation。
- 将 state 变为 running。
- 调用后续安全补偿动作。
- 写 compensation audit。
- 根据结果转为 succeeded、failed 或 manual_review_required。
- 对可重试失败进行有限重试。
- 对不可重试失败进入 dead letter 或 manual review。

job queue 不做：

- 不接真实 HIS。
- 不做测试连接。
- 不读取 HTTP request body。
- 不保存真实凭证。
- 不把 provider raw error 写入数据库或 audit。
- 不绕过租户边界。

幂等边界：

- 同一 operationId 多次执行必须幂等。
- 同一 state transition 最多写一条 compensation audit。
- 重复 job 不得重复创建 provider secret version。
- 重复 cleanup 不得清理其他租户资源。
- worker 必须检查 tenantId + connectionId + operationId 绑定关系。

## dead letter / manual review 边界

需要 dead letter：需要。

进入 dead letter 的场景：

- 可重试 provider failure 超过重试上限。
- compensation audit 持续写入失败。
- compensation state transition 冲突。
- operationId 幂等冲突。
- provider 返回不可判定结果。

需要 manual review：需要。

进入 manual review 的场景：

- provider timeout 后状态未知。
- idempotency conflict 无法证明同一请求。
- tenant / connection 绑定无法证明。
- 自动 cleanup 可能删除有效凭证。
- audit 写入失败但 provider cleanup 已成功。
- worker 发现 outbox payload 安全摘要不足以继续自动处理。

manual review 可见字段：

- tenantId。
- connectionId。
- operationId。
- operation。
- failureCategory。
- compensation state。
- retryCount。
- providerType。
- providerMode。
- createdAt。
- updatedAt。
- lastAttemptAt。
- deadLetterReason 稳定枚举。

manual review 禁止字段：

- 真实凭证。
- provider path。
- `credentialRef`。
- idempotencyKey。
- request body。
- response body。
- provider raw error。
- SQL。
- stack。

## schema / migration 边界

后续需要 schema / migration：需要。

可能新增：

- compensation operation / outbox 表。
- operationId 唯一索引。
- tenantId + connectionId + operationId 组合索引。
- state + nextAttemptAt worker 领取索引。
- deadLetterReason 和 manualReviewRequired 查询索引。
- audit metadata JSON 或独立 audit metadata 表。

schema 禁区：

- 不新增 raw payload 字段。
- 不新增 request body / response body 字段。
- 不新增 provider raw error 字段。
- 不新增 credentialRef 明文字段。
- 不新增 secret path / provider path 字段。
- 不新增真实凭证材料字段。
- 不新增无限自由文本 metadata。

迁移测试要求：

- schema 测试必须继续阻断 `metadata` 任意落库。
- 若新增 metadata，必须是白名单 schema，并补敏感字段禁止测试。
- migration SQL 不得包含 token、secret、raw payload、request body、response body 或 provider raw error 字段。

## audit repository 改造边界

若 metadata 进入 audit event：

- `TenantAuditEvent` 需要安全 metadata 类型。
- `createAuditEvent` 需要接收白名单 metadata。
- `mapAuditEventToInsert` 需要过滤和落库 metadata。
- `mapAuditEventRowToListItem` 和 API DTO 需要明确是否返回 metadata。
- audit repository tests 需要覆盖恶意 metadata 被拒绝或过滤。

若 metadata 不进入 audit event：

- compensation operation / outbox repository 需要承担关联。
- audit event 只记录 reason / result / resourceId。
- 平台详情查询需要通过 operation 表安全关联，不从 audit list 直接暴露内部状态。

本 PR 不选择具体实现，只规划两条路径的边界。下一阶段应优先评估：metadata 放入 audit event，还是放入 compensation operation 表并在平台详情页按权限关联。

## query parser 边界

当前 query parser 不支持 metadata filter，且应继续拒绝：

- `metadata`
- `compensationState`
- `failureCategory`
- `providerPath`
- `secretPath`
- `credentialRef`
- `idempotencyKey`
- `rawProviderFilter`

后续如果平台侧需要 metadata filter：

- 只能支持白名单字段。
- 只能支持安全枚举、布尔值、有限整数和 ISO 时间范围。
- 不支持任意 JSON path。
- 不支持 provider raw error 搜索。
- 不支持 credentialRef / idempotencyKey / provider path 搜索。
- 不支持 SQL 片段、排序表达式或自由文本 search。
- 需要权限边界，机构侧默认不看 compensation metadata，平台安全治理角色才可看安全摘要。

## audit reason / action / result 边界

当前不需要新增 audit reason / action / result。

继续复用：

- resource：`open_connection`
- action：`manage_credentials`
- result：`allowed`、`denied`
- reason：`compensation_pending`、`compensation_running`、`compensation_succeeded`、`compensation_failed`、`manual_review_required`

建议 result：

- pending：`denied`
- running：`denied`
- succeeded：`allowed`
- failed：`denied`
- manual review required：`denied`

不允许：

- 新增 `failure` result。
- 把 state 拼进 action。
- 把 operationId 塞进 resourceId。
- 把 failureCategory 拼成 reason 之外的自由文本。

## 敏感信息禁区

以下内容不得进入 audit、metadata、outbox、dead letter、manual review、devlog 或 PR 描述：

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
- request body。
- response body。
- provider raw error。
- SQL。
- stack。
- `DATABASE_URL`。

## 后续测试拆分

metadata schema 测试：

- 允许字段白名单测试。
- 禁止字段黑名单测试。
- operationId 不含 tenantId、connectionId、credentialRef、provider path 或 idempotencyKey。
- metadata 不接受 request body、response body 或 provider raw error。
- metadata DTO 不向机构侧默认暴露。

outbox / job queue 测试：

- pending 入队测试。
- running 领取测试。
- succeeded 终态测试。
- failed 终态测试。
- manual review 终态测试。
- retry count 上限测试。
- nextAttemptAt 退避测试。
- dead letter 安全摘要测试。
- 同一 operationId 幂等测试。
- 同一 state transition audit 去重测试。

audit repository 测试：

- compensation audit 写入 metadata 安全摘要测试。
- compensation audit 不写敏感字段测试。
- audit repository 落库过滤测试。
- audit list DTO 不泄露 metadata 禁区测试。
- audit 写入失败进入 outbox retry 或 manual review 的边界测试。

query parser 测试：

- metadata filter 默认拒绝测试。
- 白名单 metadata filter 测试。
- 任意 JSON path 拒绝测试。
- credentialRef / idempotencyKey / provider path filter 拒绝测试。
- SQL / orderBy / free text search 拒绝测试。

service / route 回归测试：

- route 不写 compensation audit。
- provider layer 不写 compensation audit。
- provider failure audit 现有行为不变。
- allowed audit 现有行为不变。
- route denied audit 现有行为不变。
- 不调用真实 provider。
- 不调用真实 HIS。
- 不做测试连接。

## 下一阶段建议

建议下一阶段拆为三个小 PR：

1. metadata / operationId schema Plan 或最小实现：只建立安全字段模型和测试，不写 compensation worker。
2. compensation outbox / state Plan 或最小实现：只建立 operation 表、state transition、幂等和 dead letter，不接真实 provider。
3. compensation audit 最小实现：基于 operationId 和 outbox state 写既有 reason / result audit，保持 route / parser / DTO / provider / storage 不变。

真实 provider、真实凭证、测试连接、真实 HIS adapter、webhook / sync、患者身份匹配、自动摘要、自动任务、自动触达、企微和 AI / RAG / Agent 继续在本链路之外，必须单独规划。

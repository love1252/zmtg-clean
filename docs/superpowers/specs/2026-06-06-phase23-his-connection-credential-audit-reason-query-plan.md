# Phase 23 HIS 连接配置凭证审计 reason 与查询边界规划

> 日期：2026-06-06
> 状态：Phase 23 HIS 连接配置凭证 audit reason / query whitelist 扩展 Plan Mode 文档。本 PR 只做 docs-only 规划，不写代码、不新增 audit reason / action、不修改 audit query whitelist、不修改 audit repository、不新增 schema / migration、不处理真实凭证、不做测试连接、不接真实 HIS。

## 本次范围

本 PR 只规划 HIS 连接配置凭证 provider failure / compensation 相关 audit reason、action、query whitelist、metadata、一致性和测试拆分边界。

本 PR 明确只做：

- docs-only Plan Mode。
- 规划凭证 provider failure / compensation 的 audit action 边界。
- 规划 provider failure / compensation 候选 audit reason。
- 规划 audit query parser 白名单扩展边界。
- 规划 audit metadata 的安全摘要和禁止字段。
- 规划 route / service / compensation audit 写入职责。
- 规划 consistency / migration 边界。
- 规划后续测试拆分和阶段顺序。
- 同步 README、roadmap 和当天 devlog。

本 PR 明确不做：

- 不写代码。
- 不新增 audit reason。
- 不新增 audit action。
- 不修改 audit query whitelist。
- 不修改 audit domain。
- 不修改 audit repository。
- 不新增 audit metadata schema。
- 不新增 schema / migration。
- 不实现 provider failure audit。
- 不实现 compensation audit。
- 不实现 job queue / outbox / cleanup。
- 不接真实 KMS / Vault / cloud provider。
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
- provider failure / compensation / audit Plan Mode。
- provider failure / compensation domain 最小实现。
- safe provider failure category 白名单。
- domain-only compensation summary。
- provider failure 到现有 service result code 的 stable service result mapping。

当前仍未完成：

- provider failure audit reason。
- compensation audit reason。
- audit query whitelist 扩展。
- audit metadata schema。
- audit repository 改造。
- compensation 持久化。
- job queue / outbox。
- real provider。
- real credential parser / service。
- 测试连接。
- 真实 HIS adapter。

当前 audit domain 只有标准字段：actor、tenant、resource、resourceId、action、result、reason、occurredAt、source。当前 query parser 只接受 `from`、`to`、`resource`、`resourceId`、`action`、`result`、`reason`、`actorId`、`limit`、`cursor`，并通过显式枚举白名单校验 action、result 和 reason。

## audit action 边界

v1 建议继续复用 `manage_credentials` action。

理由：

- 当前凭证 create / update / rotate / clear / revoke route 已全部使用 `open_connection:manage_credentials`。
- provider failure / compensation 是凭证管理流程内的执行结果，不是新的用户可执行权限动作。
- 继续复用 `manage_credentials` 可以避免权限模型和 audit action 白名单同时扩展。
- action 只表达“用户或系统尝试管理凭证”这一行为，不承载 failure category、provider 类型、compensation state 或 provider path。

暂不建议新增 provider / compensation 专用 action。

新增 action 的风险：

- 需要同步权限模型、audit domain、query whitelist、测试和 UI 筛选文案。
- 容易把运行时失败分类误建模为权限动作，导致 action 语义不稳定。
- 如果 action 名包含 provider 或 compensation 细节，可能诱导后续把 provider path、secret path 或内部状态塞入 action。
- action 一旦进入审计查询和运营报表，后续重命名成本高。

action 与 permission 的关系：

- `manage_credentials` 仍对应凭证管理权限。
- provider failure / compensation audit 不应引入新的用户授权动作。
- 如果未来需要平台安全运营人员处理 compensation，需要单独规划平台侧权限和独立 audit action。

action 与 query whitelist 的关系：

- v1 如果继续复用 `manage_credentials`，action whitelist 不需要新增。
- 如果未来新增 action，必须同步 `ACCESS_ACTIONS`、audit query parser action 校验和对应测试。

action 禁区：

- 不得表达真实 provider path。
- 不得表达 external secret path。
- 不得承载 failure category。
- 不得承载 compensation state。
- 不得承载 credentialRef、idempotencyKey 或 request body。

## audit reason 候选边界

以下 reason 仅为候选规划，不在本 PR 实现。当前系统没有 `failure` result；如不新增 result，provider failure / compensation failure 在 v1 可先以 `denied` 表达“请求未完成”，但必须在文案和测试中说明不是权限拒绝。是否新增 `failure` result 需要后续单独评估，默认不新增。

| 候选 reason | 适用场景 | 建议 result | 用户侧是否可查 | 平台端是否应筛选 | 是否暴露 provider 内部信息 | 是否需要 metadata 支撑 | 是否需要 schema / migration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `provider_unavailable` | provider 不可用或临时网络不可达，凭证写入 / 撤销无法完成 | `denied`，未来可评估 `failure` | 可查安全摘要 | 是，用于可用性聚合 | 否 | 可选，记录 provider type / retry count 更稳 | reason 本身不需要；metadata 需要单独评估 |
| `provider_timeout` | provider 请求超时，结果可能未知 | `denied`，未来可评估 `failure` | 可查安全摘要 | 是，用于超时聚合和 manual review | 否 | 建议，需要 retry count、operation 和是否 unknown outcome | reason 本身不需要；metadata 需要单独评估 |
| `provider_retry_exhausted` | 临时错误达到重试上限 | `denied`，未来可评估 `failure` | 可查安全摘要 | 是，用于告警和补偿聚合 | 否 | 建议，需要 retry count | reason 本身不需要；metadata 需要单独评估 |
| `provider_circuit_open` | circuit breaker 打开，不继续调用 provider | `denied`，未来可评估 `failure` | 可查安全摘要 | 是，用于 provider 健康聚合 | 否 | 可选，需要 provider type / mode | reason 本身不需要；metadata 需要单独评估 |
| `provider_validation_failed` | provider 层拒绝安全输入或内部参数不满足 provider policy | `denied` | 可查，但不得暴露 provider message | 是，用于实现质量和配置策略分析 | 否 | 可选，记录 failure category 即可 | reason 本身不需要；metadata 需要单独评估 |
| `provider_write_failed` | provider store / rotate 写入失败，未能产出可用安全引用 | `denied`，未来可评估 `failure` | 可查安全摘要 | 是 | 否 | 建议，需要 operation / provider type | reason 本身不需要；metadata 需要单独评估 |
| `provider_revoke_failed` | clear / revoke 后 provider revoke / disable 失败或状态未知 | `denied`，未来可评估 `failure` | 可查安全摘要 | 是，风险较高 | 否 | 建议，需要 operation、retry count、compensation state | reason 本身不需要；metadata 需要单独评估 |
| `provider_describe_failed` | describe 安全摘要失败，影响一致性检查或补偿判断 | `denied` 或仅平台内部记录 | 用户侧默认不查，除非影响用户请求 | 是 | 否 | 建议，需要 operation / provider type | reason 本身不需要；metadata 需要单独评估 |
| `provider_health_failed` | provider health 失败；不等同测试连接 | `denied` 或平台内部记录 | 用户侧默认不查，避免误读为 HIS 健康 | 是 | 否 | 建议，需要 provider mode / checkedAt | reason 本身不需要；metadata 需要单独评估 |
| `repository_after_provider_failed` | provider 已成功但 repository 写入失败，存在 orphan secret 风险 | `denied`，未来可评估 `failure` | 可查安全摘要 | 是，必须进入风险筛选 | 否 | 建议，需要 version digest 短摘要和 compensation state | reason 本身不需要；metadata 需要单独评估 |
| `audit_after_provider_failed` | provider / repository 已成功但 allowed audit 失败 | `denied` 或后续 correction / outbox 记录 | 用户侧默认只看到稳定失败 | 是，必须进入一致性筛选 | 否 | 建议，需要 operation 和 outbox / compensation 状态 | reason 本身不需要；metadata / outbox 需要单独评估 |
| `compensation_pending` | 已识别不一致，等待补偿 | `denied` 或平台内部记录 | 用户侧默认不查；可在未来安全状态页展示 | 是 | 否 | 建议，需要 compensation state、operation、retry count | reason 本身不需要；状态持久化需要 schema / migration |
| `compensation_running` | 补偿执行中 | `denied` 或平台内部记录 | 用户侧默认不查 | 是 | 否 | 建议，需要 compensation state | reason 本身不需要；状态持久化需要 schema / migration |
| `compensation_succeeded` | 补偿成功，风险状态已清理或禁用 | `allowed` 或平台内部记录，需后续统一语义 | 用户侧默认不查；平台可查 | 是 | 否 | 建议，需要 previous failure category 和 operation | reason 本身不需要；状态持久化需要 schema / migration |
| `compensation_failed` | 补偿失败，需要重试或人工处理 | `denied` 或平台内部记录 | 用户侧默认不查 | 是，风险最高 | 否 | 建议，需要 retry count、manual review 标志 | reason 本身不需要；状态持久化需要 schema / migration |
| `manual_review_required` | 无法自动判定或自动补偿不安全，需要人工复核 | `denied` 或平台内部记录 | 用户侧默认不查 | 是，必须可筛选 | 否 | 建议，需要安全摘要和复核状态 | reason 本身不需要；人工处理状态需要 schema / migration |

reason 使用原则：

- reason 必须来自白名单枚举。
- reason 只表达稳定分类，不表达 provider path、credentialRef、secret id 或原始错误。
- 不得把多个维度拼接进 reason，例如 `provider_timeout_vault_path_xxx`。
- 没有 metadata schema 前，不得为了查询需求滥增过细 reason。
- 如果新增 reason，必须同步 audit domain、query whitelist、domain tests、query parser tests 和 route / service tests。

## query whitelist 边界

新 reason 是否进入 audit query parser 白名单：

- 如果后续实现 provider failure / compensation audit reason，必须同步加入 audit reason 白名单。
- 不允许 domain 已能写入某 reason，但 query parser 无法查询该 reason 的半成品状态。
- 不允许 query parser 接受未在 audit domain 中定义的 reason。

action 边界：

- v1 继续使用 `manage_credentials`。
- action query whitelist 不新增 provider / compensation action。
- 如果未来新增 action，必须同步权限动作、audit action 白名单和 query parser tests。

result 边界：

- 继续使用现有 `allowed` / `denied` / `transitioned`。
- provider failure / compensation 默认不新增 `failure` result。
- 如果未来新增 `failure` result，必须单独规划 audit result enum、repository、DTO、UI 和历史数据兼容。

provider failure category 查询：

- 没有 metadata schema 前，不能新增 `failureCategory` query 参数。
- 不能把 failure category 塞进 `resourceId`。
- 可先通过 reason 查询粗粒度分类，例如 `provider_timeout` 或 `provider_revoke_failed`。
- 如果需要跨 reason 聚合 provider failure category，应先规划 metadata schema。

compensation state 查询：

- 没有 compensation state 持久化前，不能新增 `compensationState` query 参数。
- 不得把 compensation state 塞进 `resourceId`、actorId、cursor 或非结构化 reason 后缀。
- 如需要按 state 查询，必须先规划 metadata schema 或 compensation 持久化表。

query parser 禁区：

- 必须继续拒绝 `tenantId`，租户范围由服务端上下文决定。
- 必须继续拒绝 `sql`、`orderBy`、raw filter、provider filter。
- 不得支持 provider path / secret path 搜索。
- 不得支持 credentialRef、idempotencyKey、synthetic placeholder 搜索。
- 不得支持 request body / response body 搜索。
- `resourceId` 仍只能表达安全业务资源 id，例如 `his_conn_*`，不得承载 provider 内部路径。

## audit metadata 边界

当前没有 audit metadata schema。

在没有 metadata schema 前：

- 不得把 provider failure category 塞进 `resourceId`。
- 不得把 compensation state 塞进 reason 之外的非结构化字符串。
- 不得把 provider path 塞进任何现有字段。
- 不得把 credentialRef 塞进任何现有字段。
- 不得把 request body / response body 塞进任何现有字段。
- 不得把 provider 原始错误塞进 `reason`、`resourceId`、`source` 或 actor 字段。

如后续需要 metadata schema，必须单独 Plan Mode。

未来 metadata 允许的安全摘要：

- provider type。
- provider mode。
- credential type。
- failure category。
- compensation state。
- retry count。
- version digest 短摘要。
- occurredAt。

metadata 禁止字段：

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
- credentialRef。
- idempotencyKey。
- scoped idempotency key。
- synthetic placeholder。
- SQL。
- stack。
- DATABASE_URL。
- request body。
- response body。
- provider error full text。

## route / service audit 边界

route denied audit：

- route 层继续只处理 permission denied 和 parser failure 的 denied audit。
- permission denied 仍使用 `role_denied`、`missing_tenant`、`cross_tenant_denied` 等既有 access reason。
- parser failure 仍使用 `invalid_his_connection_payload`。
- provider failure 不写 route denied audit。
- service failure 不重复写 route denied audit。
- route 不接触 provider internal path、credentialRef、idempotencyKey 或真实凭证明文。

service audit：

- service 层继续负责成功后的 allowed audit。
- service allowed audit 继续使用 `resource: "open_connection"`、`action: "manage_credentials"`、`result: "allowed"`、`reason: "allowed_by_policy"`。
- provider failure audit 如后续实现，应由 service 层或 service 编排的安全 audit helper 产生，而不是 route 层或 provider 底层直接写入。
- provider layer 不应直接知道 HTTP request、route parser、权限或 audit repository。

compensation audit：

- compensation audit 如后续实现，应由 compensation domain / job 的服务端编排层产生。
- domain-only compensation summary 不直接写 audit。
- compensation job / outbox 如果出现，必须单独定义幂等、重试、fail closed 和人工处理 audit。

audit failure 边界：

- 当前 route denied audit 失败会 fail closed。
- 当前 service allowed audit 失败会 fail closed。
- provider / repository 已成功但 allowed audit 失败时，必须 fail closed；除非未来有可靠 outbox 保证 audit 最终一致。
- 如果未来实现 outbox，必须单独规划 schema / migration、重放、幂等和重复 audit 避免策略。

不得重复写 audit：

- permission denied 和 parser failure 只由 route 写 denied audit。
- service provider failure 不应触发 route 再写 denied audit。
- 同一个业务操作的 provider failure audit 与 compensation audit 必须有清晰关联和去重策略。

## consistency / migration 边界

reason 扩展：

- 新增 reason enum 本身不需要 schema / migration。
- 但新增 reason 必须同步 audit domain、query whitelist、tests 和 UI 文案。

metadata：

- 当前没有 metadata schema。
- 如果后续需要 provider type、failure category、compensation state、retry count 或 version digest 查询，必须单独评估 metadata schema / migration。
- metadata 引入必须包含数据兼容策略：旧事件没有 metadata 时应安全降级。

compensation state 持久化：

- 只要需要保存 compensation state、retry count、manual review 状态、operation id 或 version digest，就必须单独评估 schema / migration。
- 不得把持久化状态伪装进 audit reason 或 resourceId。

outbox：

- outbox / inbox / job queue 都需要单独 schema / migration 评估。
- outbox 需要幂等 key、重放状态、失败次数、最后错误安全摘要和清理策略。
- 本 PR 不实现 outbox，也不为 outbox 预留代码。

audit repository：

- 如果只新增 reason 并继续写标准字段，audit repository 可能不需要结构改造。
- 如果新增 metadata、failure result 或 compensation state 查询，audit repository 需要单独兼容策略。
- repository 改造必须覆盖旧事件、分页、筛选和导出边界。

query whitelist 测试：

- 每个新增 reason 都必须有 query parser accepts tests。
- provider path、credentialRef、raw provider filter、tenantId、SQL、orderBy 必须有 rejects tests。
- 本 PR 不写测试，只规划测试拆分。

## 测试拆分建议

后续实现时建议拆为独立测试，不在本 PR 编写：

- audit reason whitelist tests：确认新 reason 进入 `AuditReason` 和 `AUDIT_REASON_VALUES`。
- audit query parser accepts new reason tests：确认 `manage_credentials` + 新 reason 可查询。
- audit query parser rejects provider path / credentialRef / raw filter tests：拒绝 provider path、secret path、credentialRef、tenantId、SQL、orderBy、raw provider filter。
- audit domain supports reason tests：创建安全 audit event，不包含敏感字段。
- route denied audit unchanged tests：权限拒绝和 parser failure 仍只由 route 写 denied audit。
- service provider failure audit tests：provider failure 由 service 层写安全 audit，route 不重复写。
- compensation audit tests：compensation pending / succeeded / failed / manual review 按职责写 audit。
- audit metadata no sensitive data tests：metadata 不包含 provider path、credentialRef、idempotencyKey、secret、request / response body、SQL、stack、DATABASE_URL。
- no duplicate audit tests：同一操作不会同时由 route 和 service 重复写同类 failure audit。
- audit failure fail closed tests：audit repository 失败时保持 fail closed 或进入后续 outbox 策略。
- no schema migration regression checks：reason-only 实现不引入 schema / migration。

## 后续阶段边界

本 PR 不进入：

- audit reason 实现。
- audit query whitelist 实现。
- audit repository 改造。
- metadata schema。
- schema / migration。
- provider failure audit 实现。
- compensation audit 实现。
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

如果后续实现需要真实 provider、真实凭证材料、测试连接或真实 HIS adapter，必须拆为独立 Plan Mode 或独立实现 PR。

## 下一阶段建议

建议顺序：

1. audit reason / query whitelist 最小实现。
2. provider failure audit tests。
3. compensation audit Plan Mode 或实现。
4. real credential one-time material parser / service Plan Mode。
5. 测试连接 Plan Mode。
6. 真实 HIS adapter Plan Mode。

不要把 real provider、真实凭证材料、测试连接或真实 HIS adapter 混入当前 PR。

## 边界确认

- 是否 docs-only：是。
- 是否修改 `src/**`：否。
- 是否新增 API route：否。
- 是否修改 route / service / parser / DTO / provider / repository：否。
- 是否修改权限：否。
- 是否修改 audit domain / reason / query whitelist：否。
- 是否修改 audit repository：否。
- 是否修改 schema / migration：否。
- 是否修改测试：否。
- 是否实现 audit reason / query whitelist：否。
- 是否实现 provider failure audit：否。
- 是否实现 compensation audit：否。
- 是否接真实 KMS / Vault / provider：否。
- 是否处理真实凭证：否。
- 是否保存 token / secret / API key / connection string：否。
- 是否做测试连接：否。
- 是否接真实 HIS：否。
- 是否保存 raw HIS payload：否。

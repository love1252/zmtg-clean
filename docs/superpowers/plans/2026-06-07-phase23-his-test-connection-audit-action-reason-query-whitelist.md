# Phase 23 HIS 测试连接审计动作、原因与查询白名单边界规划

## 范围声明

- 本文档只规划 Phase23-TC-04：HIS 测试连接 audit action / reason / query whitelist 边界。
- 本轮不实现 audit runtime，不新增 audit action runtime，不新增 audit reason runtime，不修改 query parser / whitelist runtime。
- 本轮不新增 route、service、parser、DTO、repository 写回、test connection runtime、fake provider runtime、real provider、真实凭证、真实 secret manager / KMS / Vault、真实 HIS adapter、Webhook / 同步任务、recovery runtime 或 runner / scheduler / cron。
- 本轮不修改 `src/**`、`drizzle/**`、schema / migration、package / lockfile、`.env` 或 `.codex/**`。
- 本文档承接 `docs/superpowers/plans/2026-06-07-phase23-his-test-connection-permission-route.md` 和 Phase23-TC-03 权限 action 最小实现，默认权限语义为 `open_connection:test_connection`。

## 开始前只读盘点结论

1. 本地 `main` 已同步 `origin/main`，两者均位于 `c09b871908e9d46330a525fc81a588f683de203b`。
2. 建分支前 working tree 为 clean。
3. `ACCESS_ACTIONS` 已包含 `test_connection`，`tenant_admin` 已具备 `open_connection:test_connection`。
4. 当前 audit event 的 `action` 类型来自 `ProtectedAction`，因此类型层面已经能承载 `test_connection`。
5. 当前 audit query parser 的 action 白名单直接使用 `ACCESS_ACTIONS`，因此 PR #195 合并后，查询参数 `action=test_connection` 已具备未来被 parser 接受的前置条件。
6. 当前 audit domain / query reason 白名单已有 access decision reason：`allowed_by_policy`、`missing_tenant`、`cross_tenant_denied`、`role_denied`、`sensitive_detail_denied`。
7. 当前 audit reason 已有 HIS 连接 parser 可复用 reason：`invalid_his_connection_payload`。
8. 当前 audit reason 已有不可见资源可复用 reason：`not_found_or_not_owned`。
9. 当前 audit reason 已有 provider failure / compensation 相关 reason，但这些 reason 主要服务凭证管理与补偿链路，测试连接失败是否复用需要按语义逐项评估。
10. 当前 audit 测试覆盖 HIS 写入、状态、凭证管理和 provider failure / compensation 查询，但还没有测试连接专门的 action / reason / query 组合测试。
11. 本轮满足 docs-only Plan Mode 条件；后续如需新增 audit action / reason / query whitelist runtime，必须另开实现 PR。

## 审计动作规划

测试连接建议使用独立 audit action：

```text
test_connection
```

完整语义为：

```text
open_connection:test_connection
```

该 action 应与权限 action 保持一致，表达“机构内受控用户手动触发某条 HIS 连接配置测试连接”。它不表达读取配置、不表达更新元数据、不表达管理凭证、不表达启停连接、不表达删除连接，也不表达真实同步或周期健康检查。

使用独立 action 的原因：

- 测试连接会触发服务端受控流程，未来可能读取受控凭证并调用 provider，风险高于只读。
- 测试连接结果可能影响健康状态、失败 reason 和后续排障，需要可独立查询。
- 测试连接不等于凭证管理，不能混入 create / update / rotate / clear / revoke credential 审计。
- 测试连接不等于状态管理，不能混入 pause / resume / revoke / delete 生命周期审计。
- 测试连接不是普通元数据 update，不能让 update 查询结果混入外部探测行为。

## 不复用既有审计动作

不允许复用 `read_own_tenant`：

- `read_own_tenant` 只表达读取本租户安全摘要。
- 测试连接会产生副作用，不能被只读审计动作覆盖。

不允许复用 `update`：

- `update` 表达连接配置元数据变更。
- 测试连接不应被误解为修改连接配置本身。

不允许复用 `manage_credentials`：

- `manage_credentials` 表达凭证创建、更新、轮换、清空或撤销。
- 测试连接最多通过受控 provider 读取凭证，不等于管理凭证。

不允许复用 `manage_status`：

- `manage_status` 表达 pause / resume / revoke 等生命周期状态动作。
- 测试连接不改变连接生命周期状态。

不允许复用 `delete`：

- `delete` 表达软删除连接配置。
- 测试连接不删除资源，也不应进入删除审计查询。

## route denied audit 边界

后续 route runtime 中，route 层只负责进入 service 前的拒绝类审计，建议覆盖：

- 缺失可信 `tenantId`：写 denied audit，reason 使用 `missing_tenant`。
- 明确跨租户 target：写 denied audit，reason 使用 `cross_tenant_denied`。
- 角色无 `open_connection:test_connection` 权限：写 denied audit，reason 使用 `role_denied`。
- parser failure：写 denied audit，reason 优先复用 `invalid_his_connection_payload`，除非后续单独新增测试连接专用 parser reason。

route denied audit 建议固定字段：

- resource：`open_connection`。
- resourceId：path 中通过基础校验后的 `connectionId`。
- action：`test_connection`。
- result：`denied`。
- reason：来自 access decision 或 parser 的稳定 reason。

route denied audit 不负责：

- provider 调用失败。
- 缺失凭证。
- 外部认证失败。
- 外部网络超时。
- 健康状态写回失败。
- service / repository 内部错误。

这些业务失败应由 service 层按稳定分类写 audit，避免 route 和 service 重复写同一失败。

## parser failure audit 边界

v1 测试连接 route 建议无 body；如果后续 route parser / DTO Plan Mode 决定接受极薄 body，则 parser failure audit 只覆盖：

- malformed JSON。
- 非普通 JSON object。
- 未知字段。
- body 中出现 `tenantId`、`connectionId`、`credentialRef`、`status`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`。
- body 中出现 token、secret、API key、OAuth token、basic auth、private key、signing key、connection string。
- body 中出现 provider path、secret manager path、endpoint override、header override 或 raw HIS payload。

parser failure audit 使用：

- action：`test_connection`。
- result：`denied`。
- reason：优先复用 `invalid_his_connection_payload`。

parser failure audit 不回显非法输入，不写 request body，不写未知字段原值，不写外部 endpoint 或凭证类字段。

## test requested / success / failure 边界

测试连接建议至少区分三类 service 层审计：

1. test requested：权限通过且进入 service，记录用户发起了测试连接请求。
2. test success：provider / fake provider 返回测试通过，记录安全成功摘要。
3. test failure：测试未通过或无法完成，记录稳定失败 reason。

test requested、success、failure 均建议由 service 层统一写，而不是 route 层写 success / failure：

- service 层掌握 provider result、健康状态写回、repository 结果和稳定失败分类。
- route 层只掌握认证、权限和 parser 边界。
- route 和 service 同时写成功或业务失败会造成重复审计和查询噪音。

推荐语义：

- test requested：`result=allowed`，`reason=allowed_by_policy`。
- test success：`result=allowed`，`reason=allowed_by_policy`，metadata 可含 `healthStatus=healthy` 和 `checkedAt`。
- test failure：`result=denied` 或后续评估后的稳定 result，reason 使用稳定失败 code。

是否将 requested 与 success 合并为一条 audit，可在后续 audit runtime PR 中结合健康写回事务边界决定；默认建议保留独立规划能力，但首个 runtime 可以选择“进入 service 后只写最终 success / failure”作为最小实现，只要文档和测试明确。

## 审计原因复用边界

可以复用的既有 reason：

- `allowed_by_policy`：权限通过、test requested 或 test success 的默认成功 reason。
- `missing_tenant`：机构上下文缺失可信 tenant。
- `cross_tenant_denied`：明确跨租户 target 被拒绝。
- `role_denied`：角色不具备 `open_connection:test_connection`。
- `sensitive_detail_denied`：如后续出现平台敏感详情保护场景，可复用；v1 不主动引入平台代管。
- `invalid_his_connection_payload`：parser failure。
- `not_found_or_not_owned`：连接不存在、已删除或不属于当前租户时的稳定不可见结果。
- `provider_unavailable`：provider 不可用，且后续确认该 reason 不会与凭证管理语义混淆时可复用。
- `provider_timeout`：provider 超时，且后续确认测试连接可安全分类为超时时可复用。
- `provider_validation_failed`：provider 输入或配置验证失败，且后续确认不会暴露内部细节时可复用。
- `provider_health_failed`：provider 健康探测失败，适合评估为测试连接失败的候选 reason。
- `repository_after_provider_failed`：provider 已执行但 repository 写回失败时可复用。
- `audit_after_provider_failed`：provider 已执行但 audit 写入失败时可复用。

不建议直接复用的 reason：

- `provider_write_failed`：偏凭证写入或外部写动作，测试连接默认不是写入 provider。
- `provider_revoke_failed`：偏凭证撤销，不适合测试连接。
- `provider_describe_failed`：偏凭证描述或 provider 描述能力，是否适合测试连接需另行评估。
- `compensation_pending`、`compensation_running`、`compensation_succeeded`、`compensation_failed`、`manual_review_required`：偏补偿链路，不应作为测试连接首选 reason。

## 审计原因新增边界

如后续测试连接需要更清晰的失败分类，建议新增专用 reason，候选包括：

- `test_connection_failed`：测试连接未通过的通用安全失败。
- `test_connection_missing_credential`：缺失可用凭证。
- `test_connection_external_auth_failed`：外部认证失败。
- `test_connection_external_timeout`：外部连接超时。
- `test_connection_unsupported_vendor`：厂商或连接类型暂不支持测试。
- `test_connection_invalid_state`：连接状态不允许测试。

新增 reason 的前置要求：

- 同步 audit domain 的 `AuditReason`。
- 同步 `AUDIT_REASON_VALUES`。
- 同步 audit query parser 允许值测试。
- 同步 audit domain / route / service 相关测试。
- 同步文档和 devlog。
- 不允许 audit domain 已可写但 query whitelist 无法查询。

首个 audit runtime 可以先复用 `invalid_his_connection_payload`、`not_found_or_not_owned`、`provider_unavailable`、`provider_timeout`、`provider_health_failed` 等既有 reason，但必须在 runtime PR 中用测试说明复用范围，避免把凭证管理失败和测试连接失败混在一起。

## 查询白名单边界

当前 audit query parser 的 action 枚举来自 `ACCESS_ACTIONS`。因此 `test_connection` 合并到 `ACCESS_ACTIONS` 后，未来查询参数 `action=test_connection` 已有基础白名单来源。

后续如果新增 audit action：

- 必须同步权限 action 或明确与权限 action 的映射。
- 必须同步 query parser / whitelist 测试。
- 必须确保机构侧和平台侧 audit events API 都能稳定筛选。

后续如果新增 audit reason：

- 必须同步 `AUDIT_REASON_VALUES`。
- 必须补充 query parser 接受新 reason 的测试。
- 必须补充拒绝越界 reason 的测试。

query 不允许新增以下筛选字段：

- `tenantId` 由服务端 scope 决定，不由 query 任意传入机构侧列表。
- `credentialRef`。
- `providerPath`。
- `secretPath`。
- `endpoint`。
- `rawProviderStatus`。
- `rawHisPayload`。
- `requestBody`。
- `responseBody`。
- `sql`。
- 任意 provider 参数透传字段。

## audit metadata allowlist

后续如 audit repository 支持 metadata，测试连接 metadata 只允许安全摘要字段：

- `actorId`。
- `actorRole`。
- `tenantId`。
- `connectionId`。
- `resource`。
- `action`。
- `result`。
- `reason`。
- `healthStatus`。
- `checkedAt`。
- `durationMs`。
- `providerType` 的安全枚举值。
- `failureCode` 的稳定安全枚举值。
- `requestMode` 的安全枚举值，例如 `manual`。

metadata 中的 `tenantId` 只能来自服务端 access context，不接受 body / query / header / localStorage。

## audit metadata denylist

audit metadata 禁止写入：

- 凭证明文。
- token、secret、API key、OAuth access token、OAuth refresh token。
- basic auth 用户名密码。
- private key、signing key、connection string。
- 完整 `credentialRef`。
- provider path。
- secret manager path。
- KMS key id。
- external endpoint。
- 外部请求体。
- 外部响应体。
- 外部 HTTP headers。
- raw HIS payload。
- provider raw error。
- SQL。
- stack。
- `DATABASE_URL`。
- request body。
- response body。
- 患者、治疗、预约、病历、门店或外部业务原文。
- 浏览器 header、cookie、localStorage 中的租户或凭证信息。

如需排障关联，只能写稳定短 code、脱敏 hash 或内部 request id，且不得可逆推出凭证或外部业务原文。

## fail closed 边界

route denied audit 写入失败时应 fail closed：

- 权限拒绝、缺失可信 tenant、跨租户 target、parser failure 等 route denied audit 写入失败，应返回 `503 service_unavailable`。
- 不应在审计写入失败时继续进入 test connection service。

service 层 audit 写入失败也应 fail closed：

- 如果 provider 尚未执行，应停止并返回稳定服务不可用。
- 如果 provider 已执行但 audit 写入失败，应使用稳定 reason，例如 `audit_after_provider_failed`，并进入后续补偿或人工处理规划。
- 不得因为 audit 不可用而静默返回测试成功。

## 401 与空 connectionId 边界

401 未登录不写 audit：

- 没有可信 actor。
- 没有可信 tenant。
- 写 audit 可能制造伪 actor 或噪音。

空 path `connectionId` 不写 audit：

- path 本身不构成有效资源。
- route 应返回稳定 `404 not_found` 或 route parser 边界指定结果。
- 不应写入 resourceId 为空但看似针对某条连接的审计。

如果 path `connectionId` 通过基础格式校验但后续 repository 查不到，则由 service 层或 route/service 边界规划写 `not_found_or_not_owned`，避免泄漏是否存在。

## service 层 audit 边界

service 层负责：

- test requested / allowed audit。
- test success audit。
- test failure audit。
- 缺失凭证。
- 连接不存在、已删除或不属于当前租户。
- 连接状态不允许测试。
- fake provider result 映射。
- real provider result 映射。
- health status 写回后的最终状态审计。
- repository 写回失败和 audit 写入失败的稳定收口。

service 层不负责：

- 未登录 401。
- route path 为空。
- route parser failure。
- route 权限拒绝。

## 健康状态写回与 audit 顺序

后续需要在健康状态写回 Plan Mode 中收敛事务顺序。默认建议：

1. 权限与 parser 通过后进入 service。
2. service 写 test requested audit 或准备在同一流程中写最终 audit。
3. 调用 fake provider 或 real provider。
4. 计算安全 `healthStatus`、`checkedAt`、`lastErrorCode`。
5. repository 写回健康状态。
6. 写 test success / failure audit，metadata 只包含安全摘要。
7. 返回 DTO。

如果 provider 已执行但健康状态写回失败：

- 不返回测试成功。
- 不把外部响应全文写入 audit。
- 使用稳定 repository failure reason，并在后续补偿或人工处理规划中收口。

如果 audit 写入失败：

- fail closed。
- 使用稳定错误响应。
- 后续可评估补偿审计，但不在本轮实现。

## fake provider audit 后置边界

fake provider runtime 阶段建议先接入安全 audit：

- fake provider 不出站。
- fake provider 不读真实凭证。
- fake provider result 只返回稳定分类。
- audit action 使用 `test_connection`。
- success / failure reason 使用本 Plan 认可的既有 reason 或后续新增 reason。
- metadata 只写安全摘要。
- 测试覆盖无 token、secret、credentialRef、provider path、raw payload、SQL、stack、`DATABASE_URL`。

fake provider route runtime 不应绕过 audit 规划直接返回测试结果。

## 真实 provider audit 后置边界

真实 provider 阶段必须单独 Plan Mode：

- 明确出站网络、超时、重试、限流和熔断。
- 明确凭证读取 audit 与测试连接 audit 的关系。
- 明确外部认证失败、网络失败、厂商不支持、payload validation failed 的稳定 reason。
- 明确 provider raw error 脱敏。
- 明确 health status 写回与 audit 的事务关系。
- 明确 audit 写入失败后的 fail closed 和补偿策略。

真实 provider 不得把凭证明文、外部请求、外部响应、raw HIS payload 或 provider internal path 写入 audit、日志、DTO 或前端。

## 测试拆分建议

后续实现建议拆分测试：

- audit domain tests：覆盖新增 reason 或 action 的稳定枚举。
- audit query parser tests：覆盖 `action=test_connection`、新增 reason、拒绝越界 query 字段。
- route tests：覆盖 401 不写 audit、空 connectionId 不写 audit、权限拒绝写 denied audit、parser failure 写 denied audit、audit failure fail closed。
- service tests：覆盖 test requested、success、failure、missing credential、not found、invalid state、provider unavailable、provider timeout、health writeback failure、audit failure fail closed。
- fake provider route tests：覆盖无真实凭证、无出站、无 raw payload、无敏感 metadata。
- real provider tests：后续单独规划，不能与 fake provider 最小 runtime 混在一个 PR。

## 后续 PR 拆分建议

1. Phase23-TC-05：测试连接 route parser / DTO Plan Mode。
2. Phase23-TC-06：健康状态 repository 写回 Plan Mode。
3. Phase23-TC-07：fake provider service Plan Mode。
4. Phase23-TC-08：fake provider route runtime 最小实现，接入 `open_connection:test_connection` 权限和安全 DTO。
5. Phase23-TC-09：测试连接 audit runtime，按本 Plan 实现 action / reason / query whitelist 与 denied / success / failure audit。
6. Phase23-TC-10：真实 credential provider 读取边界 Plan Mode。
7. Phase23-TC-11：真实 HIS adapter 测试连接 Plan Mode。
8. Phase23-TC-12：周期健康检查 runner / scheduler Plan Mode。

如果后续决定先实现 audit runtime，则必须在同一 PR 内同步 audit domain、query whitelist、tests 和文档，不允许只写 audit 但不能查询。

## 本次结论

- 测试连接建议使用独立 audit action：`test_connection`。
- audit action 应与权限 action `open_connection:test_connection` 保持一致。
- 不复用 `read_own_tenant`、`update`、`manage_credentials`、`manage_status` 或 `delete` 表达测试连接审计。
- route denied audit 覆盖权限拒绝、缺失可信 tenant、跨租户 target 和 parser failure。
- 401 未登录不写 audit。
- 空 path `connectionId` 不写 audit。
- service 层业务失败不由 route 重复写 denied audit。
- test requested / success / failure audit 建议由 service 层统一写。
- parser failure 可优先复用 `invalid_his_connection_payload`。
- not found / not owned 可复用 `not_found_or_not_owned`。
- provider failure reason 可按语义复用，但凭证管理和补偿专用 reason 不应默认混入测试连接。
- 如新增测试连接专用 reason，必须同步 audit domain、query parser whitelist、测试和文档。
- audit metadata 只允许安全摘要，禁止凭证、provider path、secret manager path、外部请求 / 响应、raw HIS payload、SQL、stack、`DATABASE_URL` 和业务原文。
- audit 写入失败应 fail closed。
- audit runtime、route / parser / DTO、service / repository 写回、fake provider runtime、真实 provider、真实凭证、真实 secret manager 和真实 HIS adapter 全部后置。

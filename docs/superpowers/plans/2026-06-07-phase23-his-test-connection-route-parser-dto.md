# Phase 23 HIS 测试连接 route parser 与 DTO 边界规划

## 范围声明

- 本文档只规划 Phase23-TC-05：HIS 测试连接 route parser / DTO 边界。
- 本轮不实现 route runtime，不实现 parser runtime，不实现 DTO runtime。
- 本轮不新增 service、repository 写回、audit runtime、audit action / reason / query whitelist runtime、permission runtime、test connection runtime、fake provider runtime、real provider、真实凭证、真实 secret manager / KMS / Vault、真实 HIS adapter、Webhook / 同步任务、recovery runtime 或 runner / scheduler / cron。
- 本轮不修改 `src/**`、`drizzle/**`、schema / migration、package / lockfile、`.env` 或 `.codex/**`。
- 本文档承接测试连接权限与 route 边界规划，以及测试连接 audit action / reason / query whitelist 边界规划。

## 开始前只读盘点结论

1. 本地 `main` 已同步 `origin/main`，两者均位于 `f37d1998e0c4d4b489bd504f5236fa1b467ad50a`。
2. 建分支前 working tree 为 clean。
3. 当前没有 `POST /api/institution/his-connections/[connectionId]/test-connection` route runtime。
4. 当前没有测试连接专用 route parser。
5. 当前没有测试连接专用 DTO helper。
6. 现有 HIS connection create / update parser 使用严格字段白名单，只允许 `connectionName`、`sourceSystem`、`vendorType`、`systemType`。
7. 现有 HIS connection create / update parser 会拒绝 `tenantId`、`connectionId`、`credentialRef`、`credentialConfigured`、状态字段、健康字段、凭证字段、raw payload、request body、response body、SQL、stack 和 `DATABASE_URL`。
8. 现有 credential parser 使用更窄的 mutation / reason 字段集合，并通过 normalized forbidden field 阻止凭证、secret path、raw credential、raw HIS payload 等字段进入。
9. 现有 status route parser 接受可省略 body；如果有 body，只允许极窄 `reasonCode` 字段，未知字段和非 object 均返回 `validation_failed`。
10. 现有 HIS connection route 稳定错误码包括 `unauthorized`、`forbidden`、`not_found`、`validation_failed`、`conflict`、`invalid_transition` 和 `service_unavailable`。
11. 现有 route 对 malformed JSON 或 parser failure 返回 `400 validation_failed`，不回显原始 payload 或敏感值。
12. 现有空 path `connectionId` 返回 `404 not_found`，且不读取 access context、不写 audit、不调用 service。
13. 现有 401 未登录返回 `unauthorized`，且不写 tenant audit、不读取 body、不调用 service。
14. 本轮满足 docs-only Plan Mode 条件；后续如需实现 route / parser / DTO，必须另开 runtime PR。

## route 路径规划

测试连接 route 继续规划为：

```text
POST /api/institution/his-connections/[connectionId]/test-connection
```

继续使用该路径的原因：

- `POST` 表达该动作会触发受控服务端流程，未来可能写 audit、写健康状态或调用 provider。
- 路径绑定单条 HIS connection，避免从 body 或 query 传入 `connectionId`。
- `test-connection` 窄语义，避免混入凭证管理、状态管理、真实同步或周期健康检查。

本轮不新增该 route 文件，不注册 handler，不实现任何 runtime。

## v1 body 边界

v1 推荐无 body。

无 body 的原因：

- 测试连接所需可信信息应来自服务端 access context、path `connectionId`、repository 和后续受控 credential provider。
- body 不应承载租户、凭证、provider、endpoint、健康状态或外部系统参数。
- 无 body 能减少 parser 攻击面，并让首个 route runtime 更容易验证“前端不能影响 provider 选择和凭证定位”。

后续 route runtime 可以接受 request body 为 null，并把它视为默认测试模式；如果收到非空 body，建议在首个 v1 runtime 中直接拒绝，或者只在明确规划后允许极薄白名单。

## future body 白名单

如果未来确需 body，只允许可省略的极薄字段：

- `mode`：只允许固定值 `manual`，默认可省略。
- `clientRequestId`：短字符串安全摘要，仅用于前端去重或日志关联，不参与 provider 幂等、凭证定位、租户判定或健康状态写回。

白名单字段要求：

- 所有字段都必须可省略。
- 所有字符串都必须 trim。
- 字符串长度必须有限制。
- 值只能是安全枚举或短 id。
- 不得包含 token、secret、endpoint、provider path、raw payload、SQL、stack 或业务原文。

首个 runtime 可以不实现 future body；如果实现，必须补 parser tests。

## query 边界

测试连接 route 不使用 query 参数。

明确拒绝或忽略未知 query 二选一；推荐拒绝未知 query 并返回 `400 validation_failed`，以免前端或外部调用者误以为 query 生效。

禁止 query 字段：

- `tenantId`。
- `connectionId`。
- `credentialRef`。
- `credentialConfigured`。
- `provider`。
- `endpoint`。
- `mode` override。
- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- 任意 token、secret、API key、raw payload 或 provider 参数。

机构侧可信 tenant 不能来自 query；只能来自服务端 access context。

## header / cookie / localStorage 边界

route 不从 header、cookie 或 localStorage 读取租户或凭证。

允许使用的请求上下文只限现有服务端认证 / demo access context 机制。禁止：

- header 中传 `tenantId`。
- header 中传 `connectionId`。
- header 中传 provider 或 endpoint override。
- header / cookie 中传 token、secret、API key、OAuth token、basic auth、private key、signing key、connection string。
- localStorage 参与服务端 route 判定。

测试连接 route runtime 应与既有 route 一样，不调用 `localStorage`。

## tenantId 来源边界

可信 `tenantId` 只能来自服务端 access context。

route 不接受：

- body `tenantId`。
- query `tenantId`。
- header `tenantId`。
- cookie 中非认证系统定义的租户值。
- localStorage。
- 外部 HIS payload、厂商机构号、门店号或测试连接响应中的租户标识。

service 调用时只传 access context 中的 `tenantId`；如果 access context 缺失可信 tenant，应在 route denied audit 规划中使用 `missing_tenant`，并返回 `403 forbidden` 或后续统一稳定映射。

## connectionId 来源边界

可信 `connectionId` 只来自 path：

```text
[connectionId]
```

处理规则：

1. 从 path 读取。
2. trim。
3. 为空时返回 `404 not_found`。
4. 空 path 不读取 access context。
5. 空 path 不写 audit。
6. 空 path 不调用 service。
7. body 和 query 中的 `connectionId` 一律不可信。

后续 service / repository 必须继续用 `tenantId + connectionId` 做租户绑定。连接不存在、已删除或跨租户应统一返回不可见结果，不泄漏资源存在性。

## parser allowlist

v1 推荐没有 body parser；如果未来引入 parser，只允许：

- 普通 JSON object。
- 可省略 `mode`，且值只能是 `manual`。
- 可省略 `clientRequestId`，且必须是短字符串安全摘要。

parser 应拒绝：

- array。
- null。
- string / number / boolean。
- Date、Blob、FormData 或其他非普通 JSON object。
- 未知字段。
- 空字符串或超长字符串。
- 任意敏感内容 pattern。

parser 输出必须是安全 DTO，不保留原始 body。

## parser denylist

parser 必须拒绝以下字段和同义变体：

- `tenantId`。
- `id`。
- `connectionId`。
- `credentialRef`。
- `credentialConfigured`。
- `credentialStatus`。
- `status`。
- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `createdAt`、`updatedAt`、`createdBy`、`updatedBy`、`revokedAt`、`deletedAt`。
- `token`。
- `secret`。
- `apiKey`、`API key`、`api_key`。
- `oauthToken`、`OAuth token`、`oauth_token`。
- `basicAuth`、`basic auth`、`basic_auth`。
- `privateKey`、`private key`、`private_key`。
- `signingKey`、`signing key`、`signing_key`。
- `connectionString`、`connection string`、`connection_string`。
- `rawCredential`、`raw credential`、`raw_credential`。
- `rawPayload`、`raw payload`、`raw_payload`。
- `rawHisPayload`、`raw HIS payload`。
- `requestBody`。
- `responseBody`。
- `externalRequestBody`。
- `externalResponseBody`。
- `endpoint`、`endpointOverride`。
- `headerOverride`、`headers`。
- `provider`、`providerPath`、`providerConfig`。
- `secretPath`、`secretManagerPath`、`externalSecretPath`。
- `kmsKeyId`。
- `sql`、`SQL`。
- `stack`。
- `DATABASE_URL`。

parser 也应拒绝字段值中出现上述敏感内容，即使字段名是白名单字段。

## parser failure code

parser failure HTTP response 使用：

```json
{
  "code": "validation_failed",
  "error": "请求格式不正确"
}
```

HTTP status 使用 `400`。

audit reason 可按前序 Plan 复用：

```text
invalid_his_connection_payload
```

本轮不新增 parser runtime，也不新增 audit runtime。

## parser failure audit 边界

后续 route runtime 中，parser failure 应写 denied audit：

- resource：`open_connection`。
- resourceId：trim 后 path `connectionId`。
- action：`test_connection`。
- result：`denied`。
- reason：`invalid_his_connection_payload`。

audit 写入失败时 fail closed，返回 `503 service_unavailable`。

parser failure audit 不写：

- 原始 body。
- 未知字段原值。
- 凭证字段值。
- endpoint。
- provider path。
- raw HIS payload。
- SQL、stack 或 `DATABASE_URL`。

## DTO success shape

成功 DTO 只返回安全摘要：

```json
{
  "ok": true,
  "healthStatus": "healthy",
  "checkedAt": "2026-06-07T00:00:00.000Z"
}
```

可选扩展字段只能是安全枚举或短 code，例如：

- `code`：如果后续需要稳定业务 code，可为 `test_connection_passed`。

首个 runtime 不必新增 `code`，以保持成功 DTO 极简。

## DTO failure shape

失败 DTO 只返回安全摘要：

```json
{
  "ok": false,
  "code": "external_auth_failed",
  "error": "连接测试未通过，请检查配置或稍后重试",
  "healthStatus": "failed",
  "checkedAt": "2026-06-07T00:00:00.000Z"
}
```

失败 DTO 的 `code` 必须是稳定安全枚举，不得直接使用 provider raw error。

可规划的安全 code：

- `validation_failed`。
- `unauthorized`。
- `forbidden`。
- `not_found`。
- `conflict`。
- `missing_credential`。
- `invalid_state_transition`。
- `provider_unavailable`。
- `provider_timeout`。
- `external_auth_failed`。
- `unsupported_vendor`。
- `service_unavailable`。

错误文案应保持中文、稳定、脱敏，不回显外部响应。

## DTO allowlist

DTO 允许字段：

- `ok`。
- `code`。
- `error`。
- `healthStatus`。
- `checkedAt`。

字段说明：

- `ok`：布尔值，表达测试是否通过或请求是否成功收口。
- `code`：稳定安全 code，仅失败时必需。
- `error`：稳定中文文案，仅失败时必需。
- `healthStatus`：安全健康状态枚举，后续应复用 `unknown`、`healthy`、`degraded`、`failed`。
- `checkedAt`：服务端时间 ISO 字符串。

DTO 不应返回完整连接详情；连接详情仍由既有 read API 提供。

## DTO denylist

DTO 禁止字段：

- `tenantId`。
- `credentialRef`。
- `credentialConfigured` 的内部依据。
- `credentialStatus` 的内部依据。
- token、secret、API key、OAuth token、basic auth、private key、signing key、connection string。
- provider path。
- secret manager path。
- KMS key id。
- endpoint。
- external endpoint。
- request body。
- response body。
- external request body。
- external response body。
- raw HIS payload。
- provider raw error。
- 外部 HTTP headers。
- SQL。
- stack。
- `DATABASE_URL`。
- 患者、治疗、预约、病历、门店或外部业务原文。
- internal repository row。
- raw audit event。
- raw provider result。

如果需要排障，只能返回稳定 code，不能返回 provider 或数据库原始错误。

## HTTP 错误映射边界

### 401 边界

未登录或无可信 actor：

- HTTP status：`401`。
- DTO：`{ code: "unauthorized", error: "请先登录" }`。
- 不读取 body。
- 不写 audit。
- 不调用 service。

### 403 边界

权限拒绝、缺失可信 tenant 或显式跨租户 target：

- HTTP status：`403`。
- DTO：`{ code: "forbidden", error: "没有访问权限" }`。
- 写 route denied audit，reason 使用 access decision reason。
- audit 写入失败时返回 `503 service_unavailable`。
- 不调用 service。

### 404 边界

空 path `connectionId`：

- HTTP status：`404`。
- DTO：`{ code: "not_found", error: "记录不存在" }`。
- 不读取 access context。
- 不写 audit。
- 不调用 service。

连接不存在、已删除或不属于当前租户：

- 建议统一 `404 not_found`。
- 是否写 audit 由 service / audit runtime 规划收敛，reason 可用 `not_found_or_not_owned`。
- 不泄漏资源存在性。

### 400 边界

parser failure、malformed JSON、未知字段或禁用字段：

- HTTP status：`400`。
- DTO：`{ code: "validation_failed", error: "请求格式不正确" }`。
- 写 denied audit，reason 使用 `invalid_his_connection_payload`。
- 不调用 service。

### 409 边界

业务状态冲突：

- HTTP status：`409`。
- 可用 code：`conflict`、`invalid_state_transition`、`missing_credential`。
- 文案示例：`当前连接状态不允许测试`、`凭证未配置或已不可用`。
- 由后续 service result 到 HTTP response 映射决定。

### 503 边界

服务不可用：

- HTTP status：`503`。
- DTO：`{ code: "service_unavailable", error: "服务暂不可用" }` 或沿用现有 `数据服务暂时不可用`。
- 适用于 audit 写入失败、repository 不可用、provider 不可用或内部稳定收口。
- 不暴露 thrown error、SQL、stack、`DATABASE_URL`、provider raw error。

## service result 映射边界

后续 service result 建议使用稳定状态枚举，再由 route 映射 HTTP：

- `success` 或 `passed`：`200`，返回 success DTO。
- `failed`：`200` 或 `409` 需后续收敛；默认建议业务测试未通过返回 `200` + `ok=false`，前提是请求本身成功完成。
- `validation_failed`：`400 validation_failed`。
- `not_found`：`404 not_found`。
- `missing_credential`：`409 missing_credential`。
- `invalid_state_transition`：`409 invalid_state_transition`。
- `provider_unavailable`：`503 service_unavailable` 或 `200 ok=false` 需后续 fake provider service Plan 收敛。
- `provider_timeout`：`503 service_unavailable` 或 `200 ok=false` 需后续 fake provider service Plan 收敛。
- `repository_error`：`503 service_unavailable`。
- `audit_error`：`503 service_unavailable`。

route 不直接判断 provider raw result；只能映射 service 的稳定 result。

## external response body 边界

不允许返回外部 response body。

外部响应可能包含：

- 患者信息。
- 门店信息。
- 内部错误栈。
- token 或 session。
- 厂商接口结构。
- 业务原文。

DTO、audit、日志和前端都不得暴露这些内容。

## provider raw error 边界

不允许返回 provider raw error。

provider raw error 必须在 provider / service 层脱敏为稳定 code，例如：

- `provider_unavailable`。
- `provider_timeout`。
- `external_auth_failed`。
- `unsupported_vendor`。
- `provider_health_failed`。

route DTO 只返回稳定 code 和中文文案。

## credentialRef 边界

测试连接 DTO 不返回 `credentialRef`。

route body / query / header 也不接受 `credentialRef`。后续真实 credential provider 读取只能由 service 使用受控 repository / provider 通过 `tenantId + connectionId` 间接完成，不能由前端指定。

`credentialConfigured` 可作为连接详情 read API 的安全摘要存在，但测试连接 request body 不接受该字段，测试连接 DTO 默认也不返回该字段。

## SQL / stack / DATABASE_URL 边界

route parser / DTO / error mapping 禁止返回：

- SQL。
- database constraint。
- stack。
- thrown error message。
- `DATABASE_URL`。
- provider path。
- secret path。
- raw error。

所有内部异常统一稳定映射为 `service_unavailable`。

## healthStatus / checkedAt DTO 边界

测试连接 DTO 需要规划 `healthStatus` 和 `checkedAt`：

- `healthStatus` 复用 `unknown`、`healthy`、`degraded`、`failed`。
- `checkedAt` 使用服务端生成 ISO 字符串。
- `checkedAt` 不从前端 body、query、header 或 provider 原文直接透传。
- `lastCheckedAt` 是 repository 字段，不作为 request body 输入。

是否写回 `healthStatus / lastCheckedAt / lastErrorCode` 后置到 Phase23-TC-06。

首个 route runtime 如尚无 repository 写回，可以返回 fake provider service 生成的安全 `healthStatus` / `checkedAt`，但必须明确不代表真实 HIS adapter。

## 后续 parser / DTO runtime 拆分建议

建议后续 runtime 拆分：

1. 新增 test connection parser 单元测试，先覆盖无 body、拒绝未知字段和拒绝敏感字段。
2. 新增 parser helper，只输出极薄安全输入。
3. 新增 DTO helper 单元测试，覆盖 success / failure allowlist 和 denylist。
4. 新增 DTO helper，只返回 `ok`、`code`、`error`、`healthStatus`、`checkedAt`。
5. route runtime 引入 parser / DTO helper，但不直接接真实 provider。

如果 route runtime 先于 parser / DTO helper 实现，必须在 route tests 中覆盖同等白名单和敏感字段禁区。

## 后续 route runtime 前置条件

后续 route runtime 不应在以下规划完成前接真实 provider：

- Phase23-TC-06：健康状态 repository 写回 Plan Mode。
- Phase23-TC-07：fake provider service Plan Mode。
- Phase23-TC-09：测试连接 audit runtime 或至少 route denied audit runtime 明确边界。
- Phase23-TC-10：真实 credential provider 读取边界 Plan Mode。
- Phase23-TC-11：真实 HIS adapter 测试连接 Plan Mode。

如果 TC-08 先做 fake provider route runtime，则必须满足：

- 不出站。
- 不读取真实凭证。
- 不接真实 secret manager。
- 不接真实 HIS adapter。
- 使用 `open_connection:test_connection` 权限。
- 使用安全 parser / DTO。
- 不从 body / query / header / cookie / localStorage 读取租户或凭证。
- 覆盖 route denied audit 或明确 audit runtime 后置时的行为。

## 后续 PR 拆分建议

1. Phase23-TC-06：健康状态 repository 写回 Plan Mode。
2. Phase23-TC-07：fake provider service Plan Mode。
3. Phase23-TC-08：fake provider route runtime 最小实现，包含 route、parser、DTO 和 fake provider service 接入。
4. Phase23-TC-09：测试连接 audit runtime，补齐 denied / requested / success / failure audit。
5. Phase23-TC-10：真实 credential provider 读取边界 Plan Mode。
6. Phase23-TC-11：真实 HIS adapter 测试连接 Plan Mode。
7. Phase23-TC-12：周期健康检查 runner / scheduler Plan Mode。

不建议从 TC-05 直接跳到真实 route runtime；应先完成健康状态写回和 fake provider service 规划。

## 本次结论

- route 路径继续使用 `POST /api/institution/his-connections/[connectionId]/test-connection`。
- v1 推荐无 body。
- 如未来允许 body，只允许可省略的 `mode: manual` 或 `clientRequestId` 等极薄安全字段。
- parser 必须拒绝未知字段、外部租户、外部连接 ID、凭证、状态写回字段、endpoint override、provider 参数和 raw payload。
- route 不使用 query 参数。
- route 不从 body / query / header / cookie / localStorage 读取租户或凭证。
- 可信 `tenantId` 只来自服务端 access context。
- `connectionId` 只来自 path，trim 后为空返回 `404 not_found`，不写 audit，不调用 service。
- 成功 DTO 只允许 `ok`、`healthStatus`、`checkedAt` 等安全字段。
- 失败 DTO 只允许 `ok`、`code`、`error`、`healthStatus`、`checkedAt` 等安全字段。
- DTO 不返回 `tenantId`、`credentialRef`、provider path、secret manager path、endpoint、外部请求体、外部响应体、raw HIS payload、SQL、stack、`DATABASE_URL`、凭证明文或业务原文。
- parser failure 使用 `400 validation_failed`，audit reason 可复用 `invalid_his_connection_payload`。
- 401 未登录不写 audit。
- 空 path `connectionId` 不写 audit。
- 权限拒绝、parser failure、缺失可信 tenant、跨租户 target 的 denied audit 后置到 route runtime。
- service result 到 HTTP response 的映射后置到 service / route runtime。
- 本轮不实现 route、parser、DTO、service、repository、audit 或 provider。
- 下一步仍是 Phase23-TC-06：健康状态 repository 写回 Plan Mode，不跳到 route runtime。

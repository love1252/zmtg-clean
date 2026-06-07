# Phase 23 HIS 测试连接权限与 route 边界规划

## 范围声明

- 本文档只规划 Phase 23 HIS 测试连接权限与 route 边界，不实现运行时代码。
- 本次不修改 `src/**`、`drizzle/**`、schema / migration、API route、service、repository runtime、permission runtime、audit runtime、parser runtime、DTO runtime、credential provider runtime、test connection runtime、health check runtime、real provider、真实凭证、真实 secret manager / KMS / Vault、真实 HIS adapter、Webhook / 同步任务、recovery runtime、runner / scheduler / cron、package / lockfile、`.env` 或 `.codex/**`。
- 当前 main 基线为 `534a45bbc52289e8ad61ef948affeb4eb8fd1f7e`。
- 本文档承接 `docs/superpowers/plans/2026-06-07-phase23-his-connection-test-connection-health-check.md`，只细化权限、route、parser、DTO 和 audit 的边界，不进入测试连接执行、健康状态写回或 provider 调用。

## 开始前只读盘点结论

1. 本地 `main` 已同步 `origin/main`，两者均位于 `534a45bbc52289e8ad61ef948affeb4eb8fd1f7e`。
2. 建分支前 working tree 为 clean。
3. README、roadmap 和 2026-06-07 devlog 已确认：Phase 23 HIS 连接配置测试连接 / 健康检查 Plan Mode 已完成，但测试连接权限、route、service、repository 写回、fake provider runtime 和真实 provider 均未实现。
4. 上一轮测试连接 / 健康检查 Plan 已明确：测试连接建议使用单独权限，不复用只读权限；route 建议采用 `POST /api/institution/his-connections/[connectionId]/test-connection`；DTO 只返回安全字段。
5. 既有状态权限规划已经形成高风险动作的通用口径：不能复用 `read_own_tenant` 放行写入或生命周期动作，v1 默认仅 `tenant_admin` 可触发，普通机构角色、平台角色和审计角色默认拒绝。
6. 既有凭证 API 权限与审计规划已经形成凭证相关高风险动作的通用口径：`manage_credentials` 不能被只读、普通 update 或状态管理动作替代。
7. 既有 route denied audit 规划已经形成分层口径：route 层负责权限拒绝和 parser 失败 denied audit；service 层负责成功 allowed audit、业务失败或 repository 失败审计，避免重复审计。
8. 本轮只做 docs-only Plan，没有阻塞；如果后续需要实现权限、route、parser、DTO、service、repository 写回、audit 或 fake provider，必须另开后续 PR。

## 权限是否需要独立动作

测试连接需要单独权限。

原因：

- 测试连接会触发服务端受控流程，未来可能读取受控凭证并发起外部探测，风险高于只读连接配置。
- 测试连接不是凭证管理动作，不能由凭证创建、轮换、清空或撤销权限顺带放行。
- 测试连接也不是状态生命周期动作，不能由 pause / resume / revoke / delete 权限顺带放行。
- 测试连接结果可能写回健康状态和审计记录，不能被普通只读权限触发。

候选权限建议为：

```text
open_connection:test_connection
```

该权限只表达“允许机构内受控用户手动触发某条 HIS 连接配置的测试连接”。它不表达读取凭证明文、不表达管理凭证、不表达启停连接、不表达真实 HIS 同步、不表达自动健康检查。

## 不复用既有权限

不允许复用 `open_connection:read_own_tenant`：

- 只读权限只能查看安全连接摘要。
- 只读权限不能触发 provider 调用、凭证读取、健康状态写回或 audit 副作用。
- 拥有只读权限的角色不应因为能看连接配置就能测试外部连接。

不建议复用 `open_connection:manage_credentials`：

- 凭证管理负责 create / update / rotate / clear / revoke。
- 测试连接负责验证当前连接配置是否可用。
- 管理凭证和测试连接应可独立授权，便于后续将“录入凭证”和“验证连接”拆给不同运营角色。

不建议复用 `open_connection:update`：

- 普通连接元数据更新不应扩大为外部探测能力。
- update 的审计语义会混淆测试连接结果和元数据变更。

不建议复用 `open_connection:manage_status` 或 `open_connection:delete`：

- 状态权限只表达连接生命周期动作。
- 测试连接不应被 pause / resume / revoke / delete 的权限隐式放行。

## 角色边界

v1 默认仅 `tenant_admin` 可触发测试连接。

建议角色策略：

- `tenant_admin`：默认允许触发，但只在本租户、未删除连接、route 权限通过后生效。
- 普通机构角色：默认拒绝，包括顾问、客服、普通运营或只读人员。
- 平台角色：默认拒绝，包括平台管理员和平台运营；平台代管触发测试连接不进入 v1。
- 审计角色：默认拒绝；审计角色只查看审计或安全摘要，不触发外部探测。
- 未登录或无可信 actor：返回 `401 unauthorized`，不写 route denied audit。
- 缺失可信 `tenantId`：返回 `403 forbidden`，后续应写 denied audit，reason 使用 `missing_tenant`。
- 跨租户 target：返回 `403 forbidden` 或稳定拒绝结果，后续应写 denied audit，reason 使用 `cross_tenant_denied`。
- 角色不具备权限：返回 `403 forbidden`，后续应写 denied audit，reason 使用 `role_denied` 或 access decision 返回的稳定 reason。

后续如需平台代管触发测试连接，必须单独规划平台侧 tenant 选择、审批、强制 reason、双人复核、审计增强和安全展示，不进入 v1。

## route 路径规划

推荐 v1 route：

```text
POST /api/institution/his-connections/[connectionId]/test-connection
```

选择 POST 的原因：

- 测试连接会产生副作用，例如 audit、健康状态写回或 provider 调用。
- 该动作不是读取详情，不应使用 GET。
- 路径窄语义，避免和凭证管理、状态管理或真实同步混在一起。

route 接入顺序建议：

1. 读取 path `connectionId`，trim 后为空则返回 `404 not_found`，不写 route audit。
2. 获取服务端 access context。
3. 未登录返回 `401 unauthorized`，不写 route audit。
4. 从 access context 获取可信 `tenantId`。
5. 检查 `open_connection:test_connection` 权限。
6. 权限拒绝时写 route denied audit；audit 写入失败时 fail closed 为 `503 service_unavailable`。
7. 如 v1 无 body，则跳过 body 解析。
8. 如后续需要 body，则只用极薄 parser 白名单。
9. 调用后续 test connection service。
10. 映射 service result 为稳定 HTTP 响应和安全 DTO。

本轮不新增 route，不修改现有 route。

## body / query / header 边界

v1 推荐无 body。

如果后续确需 body，只允许极薄白名单，例如：

- `mode`：只允许固定枚举，例如 `manual`，且默认可省略。
- `clientRequestId`：如需要前端去重，只能是短字符串安全摘要，不能参与 provider 幂等或凭证定位。

必须拒绝：

- body `tenantId`。
- body `connectionId`。
- body `credentialRef`。
- body `credentialConfigured`。
- body `status`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`。
- body token、secret、API key、OAuth token、basic auth、private key、signing key、connection string。
- body raw HIS payload。
- body external endpoint、provider path、secret manager path、KMS key id。
- 任意 endpoint override、header override、vendor 参数透传。

query 参数边界：

- v1 route 不需要 query。
- query `tenantId`、`connectionId`、`credentialRef`、endpoint、provider、mode override 均不可信，必须拒绝或忽略；推荐拒绝未知 query。

header / cookie / localStorage 边界：

- 不从 header、cookie 或 localStorage 读取租户、凭证、provider、endpoint 或外部系统参数。
- route 只能使用服务端认证和 access context。

## tenantId 来源边界

可信租户来源只有服务端 access context。

route 不接受：

- body `tenantId`。
- query `tenantId`。
- header `tenantId`。
- cookie 中非认证系统定义的租户值。
- localStorage。
- 外部 HIS payload、厂商机构号、门店号或测试连接响应中的租户标识。

service 调用时只传入 access context 中的 `tenantId` 和 path `connectionId`。后续 repository / service 必须继续绑定 `tenantId + connectionId`，跨租户、已删除或不存在统一返回稳定不可见结果。

## 凭证边界

测试连接 route 不接收凭证明文。

route 禁止出现：

- token。
- secret。
- API key。
- OAuth access token。
- OAuth refresh token。
- basic auth 用户名密码。
- private key。
- signing key。
- connection string。
- raw credential。
- `credentialRef`。
- provider internal path。
- secret manager path。

后续测试连接 service 如需受控凭证访问，只能通过 credential provider，并且 provider 不得把凭证明文返回给 route、DTO、audit、日志或前端。

## parser 边界

v1 可以没有 body parser。

如果后续需要 parser，应保持极薄：

- 只接受普通 JSON object。
- 只接受小型白名单字段。
- 拒绝未知字段。
- 拒绝任何凭证、租户、状态写回、endpoint override、provider 参数和 raw payload。
- parser 失败不回显输入。
- malformed JSON 返回稳定 `validation_failed`。
- parser failure route denied audit reason 建议复用 `invalid_his_connection_payload`，除非后续单独评估新增测试连接专用 reason。

parser 不做：

- 不解析真实凭证。
- 不解析外部响应体。
- 不解析 raw HIS payload。
- 不根据 body 决定 provider 或 endpoint。
- 不生成健康状态写回值。

## DTO 边界

成功 DTO 只允许返回安全摘要，例如：

```json
{
  "ok": true,
  "healthStatus": "healthy",
  "checkedAt": "2026-06-07T00:00:00.000Z"
}
```

失败 DTO 只允许返回安全摘要，例如：

```json
{
  "ok": false,
  "code": "external_auth_failed",
  "error": "连接测试未通过，请检查配置或稍后重试",
  "healthStatus": "failed",
  "checkedAt": "2026-06-07T00:00:00.000Z"
}
```

DTO 可选字段：

- `ok`
- `code`
- `error`
- `healthStatus`
- `checkedAt`

DTO 禁止字段：

- `tenantId`
- `credentialRef`
- `credentialConfigured` 的内部依据
- provider path
- secret manager path
- endpoint
- request body
- response body
- raw HIS payload
- 外部 HTTP header
- SQL
- stack
- `DATABASE_URL`
- 凭证明文、token、secret、API key、OAuth token、connection string
- 患者、预约、治疗、病历或门店原始业务数据

## route 层错误映射边界

route 层只做稳定映射，不暴露内部异常。

建议映射：

- 未登录：`401 unauthorized`。
- path `connectionId` 为空：`404 not_found`。
- 权限拒绝：`403 forbidden`。
- parser 失败：`400 validation_failed`。
- 连接不存在、跨租户、已删除：`404 not_found` 或 service 稳定不可见结果。
- 连接状态不允许测试：`409 conflict` 或 `400 validation_failed`，需后续 service Plan Mode 收敛。
- 缺失凭证：`409 conflict`，code 可用 `missing_credential`。
- provider / 外部系统不可用：`503 service_unavailable` 或稳定测试失败 DTO，具体由后续 service 规划。
- 内部 repository / audit 不可用：`503 service_unavailable`。

route 不返回：

- thrown error message。
- database constraint。
- SQL。
- stack。
- `DATABASE_URL`。
- provider raw error。
- 外部响应体。
- raw HIS payload。

## 前端展示边界

前端可展示：

- “连接测试通过”。
- “连接测试未通过，请检查配置或稍后重试”。
- “当前账号无权测试连接”。
- “凭证未配置或已不可用”。
- “当前连接状态不允许测试”。
- `unknown / healthy / degraded / failed` 的中文状态。
- 最近检查时间。
- 稳定 code，供内部支持排障。

前端不展示：

- 凭证明文。
- `credentialRef`。
- provider path。
- secret manager path。
- external endpoint。
- 外部请求或响应全文。
- raw HIS payload。
- SQL、stack、`DATABASE_URL`。
- 患者、治疗、预约、病历或外部业务原文。

## audit 边界

本轮只规划 audit，不实现 audit runtime。

route denied audit 应规划：

- 权限拒绝写 denied audit。
- 缺失可信 tenant 写 denied audit。
- parser failure 写 denied audit。
- audit 写入失败时 fail closed，返回 `503 service_unavailable`。
- 401 未登录不写 audit。
- 空 path `connectionId` 不写 audit。
- service 层业务失败不由 route 重复写 denied audit。

success / failure audit 应规划：

- 测试连接发起成功进入 service 后，应记录 test requested 或等价 allowed audit，具体由后续 audit Plan Mode 决策。
- 测试连接成功应记录安全 success audit。
- 测试连接失败应记录安全 failure audit。
- provider failure、external failure、missing credential 和 unsupported vendor 只记录稳定 reason。
- audit metadata 只允许安全字段，不写外部响应和凭证明文。

## audit action / reason / query whitelist 边界

推荐新增或评估 action：

```text
test_connection
```

候选完整语义为 `open_connection:test_connection`。

是否新增 audit action：

- 推荐与权限 action 保持一致，便于审计查询和前端排障。
- 如果复用既有 `read_own_tenant`、`update`、`manage_credentials` 或 `manage_status`，会混淆只读、元数据写入、凭证管理、状态管理与测试连接，因此不推荐。

是否新增 audit reason：

- 权限拒绝可复用 access decision reason：`missing_tenant`、`cross_tenant_denied`、`role_denied`、`sensitive_detail_denied`。
- parser failure 可复用 `invalid_his_connection_payload`。
- not found / not owned 可复用 `not_found_or_not_owned`。
- 测试连接失败 reason 可后续评估是否复用上一轮规划的 reason code，或新增专门 audit reason；本轮不修改。

是否新增 query whitelist：

- 如果新增 `test_connection` action 或新增测试连接 reason，必须同步 audit domain、query parser 白名单、测试和审计查询文档。
- 不允许出现 audit domain 已写入但 query whitelist 无法查询的半成品。
- 本轮不新增 action、reason 或 query whitelist。

## 健康状态写回边界

测试连接 route 可以规划触发健康状态写回，但不实现。

健康状态写回应由后续 service / repository 边界决定：

- repository 只写 `healthStatus`、`lastCheckedAt`、`lastErrorCode`、`updatedAt`。
- 写回必须绑定 `tenantId + connectionId`。
- route 不接受前端传入的 `healthStatus`、`lastCheckedAt` 或 `lastErrorCode`。
- route 不直接写 repository。
- route 不把 service result 里的外部错误文本写入数据库。

健康状态写回 Plan Mode 应独立于本轮权限与 route Plan，或作为后续测试连接 fake provider runtime 的前置小 PR。

## fake provider 与真实 provider 后置边界

fake provider runtime 后置：

- 首个 runtime 应优先使用 fake provider / test-only result mapper。
- fake provider 不出站、不读真实凭证、不接真实 secret manager。
- fake provider route runtime 应覆盖权限、parser、DTO、audit 和健康状态写回的安全路径。

真实 provider 后置：

- 真实 provider 需要单独 Plan Mode。
- 真实 provider 需要明确出站网络、超时、重试、限流、熔断、错误脱敏、凭证读取审计和租户隔离。
- 真实 provider 不应与权限 / route 首个实现混在同一 PR。

真实凭证后置：

- 本轮不处理真实凭证。
- 后续真实凭证只能通过 credential provider 受控读取，不能由 route body 传入测试连接。

真实 secret manager 后置：

- 不接 KMS / Vault / cloud secret manager。
- 后续如接入必须单独规划 provider 配置、密钥轮换、错误脱敏和补偿。

真实 HIS adapter 后置：

- 不接真实 HIS adapter。
- 后续真实 adapter 测试 endpoint、厂商差异、raw payload 禁区和外部响应映射必须单独规划。

Webhook / 同步任务后置：

- 测试连接 route 不启动 Webhook。
- 测试连接 route 不启动同步任务。
- 周期健康检查、runner / scheduler / cron 必须单独规划。

recovery 后置：

- 本轮不进入 compensation recovery、dead letter / manual review recovery、runner / scheduler 或人工复核视图。

## 后续 PR 拆分建议

1. 测试连接权限 action Plan Mode 或最小实现：新增 `open_connection:test_connection`，默认仅 `tenant_admin`，普通机构角色、平台角色和审计角色拒绝。
2. 测试连接 audit action / reason / query whitelist Plan Mode：评估 `test_connection` action、reason 复用和 query whitelist。
3. 测试连接 route parser / DTO Plan Mode：收敛无 body 或极薄 body、DTO 字段和错误映射。
4. 健康状态 repository 写回 Plan Mode：只规划 `healthStatus / lastCheckedAt / lastErrorCode` 写回。
5. fake provider service Plan Mode：只规划 fake provider result mapper，不出站、不读真实凭证。
6. fake provider route runtime 最小实现：接入权限、route、parser、DTO、service 和安全测试。
7. 测试连接 audit runtime：接入 denied / success / failure audit，不写敏感信息。
8. 真实 credential provider 读取边界 Plan Mode。
9. 真实 HIS adapter 测试连接 Plan Mode。
10. 周期健康检查 runner / scheduler Plan Mode。

## 本次结论

- 本次满足测试连接权限与 route docs-only Plan Mode 条件。
- 测试连接应使用单独权限，候选为 `open_connection:test_connection`。
- v1 默认仅 `tenant_admin` 可触发。
- 普通机构角色、平台角色和审计角色默认拒绝。
- 平台代管触发测试连接不进入 v1。
- route 推荐 `POST /api/institution/his-connections/[connectionId]/test-connection`。
- v1 推荐无 body；如后续需要 body，只允许极薄白名单。
- route 不接受外部 `tenantId`，不从 body / query / header / localStorage 读取租户或凭证。
- DTO 只返回 `ok`、`code`、`error`、`healthStatus`、`checkedAt` 等安全字段。
- denied audit、parser failure audit、test success / failure audit 都应规划，但 audit runtime 后置。
- 权限实现、route 实现、parser、DTO、service、repository 写回、fake provider runtime 全部后置。
- 不接真实 provider、真实凭证、真实 secret manager、真实 HIS adapter、Webhook / 同步任务、recovery runtime 或 runner / scheduler。

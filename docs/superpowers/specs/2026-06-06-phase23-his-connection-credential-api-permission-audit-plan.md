# Phase 23 HIS 连接配置凭证 API 权限与审计边界规划

> 日期：2026-06-06
> 状态：Phase 23 HIS 连接配置凭证 API route / permission / audit Plan Mode 文档。本 PR 只做 docs-only 规划，不写代码、不新增 API、不修改 `src/**`、不处理真实凭证、不做测试连接、不接真实 HIS、不接真实 secret manager、不新增 schema / migration。

## 本次范围

本 PR 只规划 HIS 连接配置凭证 API route、permission 和 audit 边界，承接已完成的凭证 repository / storage 最小实现，以及凭证 parser / service / DTO 最小实现。

本 PR 明确只做：

- docs-only Plan Mode。
- 规划凭证 create / update / rotate / clear / revoke route 边界。
- 规划凭证管理权限动作、角色边界和拒绝口径。
- 规划 route 层 denied audit、service 成功 audit、错误映射和测试拆分。
- 规划后续实现时的敏感信息禁区。
- 同步 README、roadmap 和当天 devlog。

本 PR 明确不做：

- 不写代码。
- 不新增 API。
- 不修改现有 API。
- 不修改 `src/**`。
- 不新增 API route。
- 不修改 route、service、repository、parser、DTO、权限实现、权限测试、audit domain、audit reason、audit query whitelist、audit repository、schema、migration、测试或 demo seed。
- 不接真实 KMS / Vault / secret manager。
- 不保存、处理或演示真实凭证。
- 不保存 token、secret、API key、connection string 或 external secret path。
- 不做测试连接。
- 不接真实 HIS 或机构系统。
- 不保存 raw HIS payload。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达客户。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做经营智能中心、图表或导出。

如果后续实现必须新增 API route、权限动作、audit action / reason / domain / query whitelist、schema / migration、真实 secret manager、测试连接或真实 HIS adapter，必须拆分为独立 Plan Mode 或独立实现 PR，不能混入当前 docs-only PR。

## 前置状态

当前已完成：

- HIS 连接配置凭证管理总边界 Plan Mode。
- HIS 连接配置凭证 repository / storage 边界 Plan Mode。
- HIS 连接配置凭证 repository / storage 最小实现。
- HIS 连接配置凭证 parser / service / DTO Plan Mode。
- HIS 连接配置凭证 parser / service / DTO 最小实现。
- fake in-memory storage 测试抽象。
- repository 安全 `credentialRef` set / rotate / clear / revoke 最小方法。
- `credentialConfigured` 从安全 read model / summary 派生。
- fake storage 的 idempotency key 已绑定 `tenantId + connectionId + idempotencyKey`，避免跨租户 / 跨连接复用安全引用。
- repository 与 storage 均拒绝 `sk_live`、`sk_test`、raw credential、token、secret、API key、connection string 和 raw payload 形态的敏感 ref 或输入。
- parser 只接受合成 `synthetic_placeholder_*`。
- parser 拒绝 body `tenantId`、`credentialRef`、`credentialConfigured`、`status`、`healthStatus`、raw HIS payload、external secret path 和真实凭证材料。
- service 只接收服务端可信 `accessContext`、path / route 层可信 `connectionId`、database、repository、storage 和 parsed input。
- service 不读取 request、header、query、localStorage、body tenantId 或 external HIS payload。
- DTO 不返回 `credentialRef`、idempotencyKey、scoped key、storage provider 内部信息或敏感字段。

当前仍未完成：

- 凭证 API route。
- 凭证 permission / route access guard。
- 凭证 audit action / reason / domain / query whitelist。
- 凭证 route denied audit。
- 凭证 route tests。
- 凭证 permission tests。
- 凭证 audit tests。
- 测试连接。
- 连接健康检查。
- 真实 HIS adapter。
- 真实 secret manager。

当前 parser / service / DTO 最小实现只说明“服务端内部已经能编排合成 placeholder 到安全引用的最小流程”，不代表可以接收 HTTP 真实凭证明文，不代表已能测试连接，不代表已能调用真实 HIS。

## API route 边界

后续建议规划但本 PR 不实现以下 route：

| 操作 | HTTP method | path | body parser | service 调用 | 成功 DTO |
| --- | --- | --- | --- | --- | --- |
| create credential | `POST` | `/api/institution/his-connections/[connectionId]/credentials` | `parseCreateHisConnectionCredentialInput` | `createHisConnectionCredentialForTenantService` | `{ ok: true, credentialConfigured: true }` |
| update credential | `PATCH` | `/api/institution/his-connections/[connectionId]/credentials` | `parseUpdateHisConnectionCredentialInput` | `updateHisConnectionCredentialForTenantService` | `{ ok: true, credentialConfigured: true }` |
| rotate credential | `POST` | `/api/institution/his-connections/[connectionId]/credentials/rotate` | `parseRotateHisConnectionCredentialInput` | `rotateHisConnectionCredentialForTenantService` | `{ ok: true, credentialConfigured: true }` |
| clear credential | `POST` | `/api/institution/his-connections/[connectionId]/credentials/clear` | `parseClearHisConnectionCredentialInput` | `clearHisConnectionCredentialForTenantService` | `{ ok: true, credentialConfigured: false }` |
| revoke credential | `POST` | `/api/institution/his-connections/[connectionId]/credentials/revoke` | `parseRevokeHisConnectionCredentialInput` | `revokeHisConnectionCredentialForTenantService` | `{ ok: true, credentialConfigured: false }` |

每个 route 后续实现必须明确：

- HTTP method 使用上表规划。
- path `connectionId` 只来自 route params，trim 后作为可信 path ID。
- 空 `connectionId` 返回 `404 not_found`，不写 route audit。
- access context 只通过服务端 session / demo access context 获取。
- 权限判断只使用服务端 `accessContext` 和 path `connectionId`，不读取 body / query / header / localStorage 的 tenant 信息。
- body parser 复用已实现的凭证 parser。
- permission guard 失败时不得读取或解析 body。
- parser failure 不得回显 payload。
- service 调用只传可信 `accessContext`、path `connectionId`、database、dependencies 和 parsed input。
- success DTO 继续使用凭证 DTO helper。
- error DTO 只返回稳定 code / error。
- permission denied 后续实现应写 route denied audit。
- parser failure 后续实现应写 route denied audit。
- service failure 默认不写 route denied audit，避免和 service / repository 审计重复。
- 所有 route 都不进入测试连接。
- 所有 route 都不进入真实 HIS。
- 所有 route 都不接真实 secret manager。

route 输入必须拒绝：

- body `tenantId`。
- query `tenantId`。
- header `tenantId`。
- localStorage `tenantId`。
- body `credentialRef`。
- body `credentialConfigured`。
- body `status`。
- body `healthStatus`。
- body raw HIS payload。
- body external secret path。
- body storage provider 内部字段。
- body token、secret、API key、connection string、raw credential。

## permission 边界

当前 `ACCESS_ACTIONS` 已包含 `read_own_tenant`、`create`、`update`、`delete`、`manage_status` 等动作，但还没有凭证管理专用动作。

后续建议优先规划单独权限：

```text
open_connection:manage_credentials
```

原因：

- 凭证管理风险高于普通连接元数据 update。
- `open_connection:read_own_tenant` 只能读连接安全元数据，不可替代凭证管理权限。
- `open_connection:update` 不应默认替代凭证管理权限，避免普通元数据编辑权限扩大到凭证写入。
- `open_connection:manage_status` 只表达 pause / resume / revoke / delete 等状态控制，不可替代凭证管理权限。
- 凭证 create / update / rotate / clear / revoke 应共享一个最小凭证管理动作，除非后续合规要求再拆分细动作。

v1 建议：

- 仅 `tenant_admin` 具备 `open_connection:manage_credentials`。
- 普通机构角色、顾问、客服、平台运营、审计角色默认拒绝。
- 平台管理员默认不允许代管写入机构凭证。
- 如果未来需要平台代管凭证写入，必须单独 Plan Mode，评估双人审批、强制 reason、审计增强、租户授权和操作留痕。
- 权限判断只使用服务端 access context。
- 权限拒绝写 route denied audit。
- 权限拒绝 reason 复用 `canAccessResource` 返回的 `missing_tenant`、`cross_tenant_denied`、`role_denied` 或 `sensitive_detail_denied`。

如果后续决定暂时复用 `open_connection:update`，必须额外说明如何区分普通 update 与凭证管理，并补足测试证明 `read_own_tenant` 和 `manage_status` 不能放行凭证 route。默认推荐不复用。

## audit action / reason / domain 边界

本 PR 不新增 audit action，不新增 audit reason，不修改 audit domain，不修改 query whitelist。

后续实现前建议评估：

- 是否新增 audit action：推荐候选 `manage_credentials`。
- 是否复用既有 action：如复用 `update`，必须说明如何在 audit 查询和报表中区分普通连接元数据更新与凭证管理。
- parser failure reason：可复用 `invalid_his_connection_payload`，或后续新增凭证专用 reason；本 PR 不实现。
- not_found reason：建议复用 `not_found_or_not_owned`。
- permission denied reason：复用 `canAccessResource` reason。
- invalid state reason：建议复用 `invalid_transition`。
- storage failure reason：后续评估，不在本 PR 实现。
- repository failure reason：后续评估，不在本 PR 实现。

候选映射：

| 场景 | 候选 action | 候选 reason | 本 PR 是否实现 |
| --- | --- | --- | --- |
| create credential 成功 | `manage_credentials` | `allowed_by_policy` | 否 |
| update credential 成功 | `manage_credentials` | `allowed_by_policy` | 否 |
| rotate credential 成功 | `manage_credentials` | `allowed_by_policy` | 否 |
| clear credential 成功 | `manage_credentials` | `allowed_by_policy` | 否 |
| revoke credential 成功 | `manage_credentials` | `allowed_by_policy` | 否 |
| permission denied | `manage_credentials` | 权限决策 reason | 否 |
| parser failure | `manage_credentials` | `invalid_his_connection_payload` 或凭证专用 reason | 否 |
| not found / not owned | `manage_credentials` | `not_found_or_not_owned` | 否 |
| invalid state | `manage_credentials` | `invalid_transition` | 否 |
| storage / repository failure | 待评估 | 待评估 | 否 |

约束：

- 本 PR 不新增 action。
- 本 PR 不新增 reason。
- 本 PR 不修改 audit domain。
- 本 PR 不修改 query whitelist。
- 本 PR 不修改 audit repository。
- 后续如新增 action / reason，必须同步 domain、query parser、repository / DTO 测试和审计查询文档。

## route denied audit 边界

后续凭证 route 层 denied audit 建议覆盖：

- permission denied。
- access context 存在但缺失可信 `tenantId`。
- parser failure。
- body `tenantId` 被拒绝。
- body `credentialRef` / `credentialConfigured` 被拒绝。
- body `status` / `healthStatus` 被拒绝。
- unsupported `credentialType`。
- body raw HIS payload / external secret path 被拒绝。
- malformed JSON。
- body 不是普通 JSON object。

后续凭证 route 层 denied audit 不覆盖：

- `401 unauthorized`：没有可信 actor，不写 route audit。
- 空 `connectionId`：返回 `404 not_found`，不写 route audit。
- service 返回 `not_found`：应由 service / repository 失败审计规划处理，route 不重复写。
- service 返回 `invalid_state_transition`：应由 service / repository 失败审计规划处理，route 不重复写。
- service 返回 `validation_failed`：若来自 service 内部可信输入校验，route 不重复写；若来自 parser，route 写。
- storage failure：后续应由 service / audit 规划处理，route 不直接写真实 storage 细节。
- repository failure：避免 route 和 service 重复审计。
- `service_unavailable`：不写 route denied audit，避免记录异常细节。

audit 写入失败必须 fail closed：

- permission denied audit 写入成功：返回 `403 forbidden`。
- permission denied audit 写入失败：返回 `503 service_unavailable`。
- parser failure audit 写入成功：返回 `400 validation_failed`。
- parser failure audit 写入失败：返回 `503 service_unavailable`。
- audit 写入失败后不得继续调用 service。

route denied audit metadata 禁止记录：

- request body。
- response body。
- credential material。
- synthetic placeholder。
- token。
- secret。
- API key。
- connection string。
- `credentialRef`。
- idempotencyKey。
- scoped idempotency key。
- raw HIS payload。
- external secret path。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。

route denied audit 最多记录：

- audit event id。
- actor id / role / scope / source。
- tenantId 来自 access context。
- resource 固定 `open_connection`。
- resourceId 使用 path `connectionId`。
- action 使用后续确认的凭证管理 action。
- result 为 `denied`。
- reason 使用稳定 reason。
- occurredAt。

## route success audit 边界

后续凭证成功路径建议写 allowed audit：

- create credential 成功写 allowed audit。
- update credential 成功写 allowed audit。
- rotate credential 成功写 allowed audit。
- clear credential 成功写 allowed audit。
- revoke credential 成功写 allowed audit。

建议口径：

- allowed audit 优先由 service 负责。
- route 层负责 permission denied / parser failure denied audit。
- 不重复写 audit。
- repository 写入与 allowed audit 应尽量在同一 transaction 内完成。
- 如果 allowed audit 写入失败，应 fail closed，返回稳定 `service_unavailable`，不得让业务状态和审计状态不一致。
- audit metadata 只记录安全字段。
- audit metadata 不记录 `credentialRef`、placeholder、idempotencyKey、scoped key、storage provider 内部信息或真实凭证材料。

如后续选择 route 层写 allowed audit，必须证明不会与 service 成功 audit 重复，并补充事务一致性和失败补偿边界。默认推荐 service 写 allowed audit。

## route DTO / error mapping 边界

成功响应继续使用：

```json
{ "ok": true, "credentialConfigured": true }
```

或清空 / 撤销后：

```json
{ "ok": true, "credentialConfigured": false }
```

成功响应不得返回：

- `credentialRef`。
- idempotencyKey。
- scoped key。
- storage provider 内部信息。
- token。
- secret。
- API key。
- connection string。
- raw credential。
- raw HIS payload。
- external secret path。

错误响应建议：

| HTTP status | code | 使用场景 |
| --- | --- | --- |
| 400 | `validation_failed` | malformed JSON、parser failure、禁止字段、unsupported credentialType |
| 401 | `unauthorized` | 无 access context |
| 403 | `forbidden` | 权限拒绝或缺失可信 tenant |
| 404 | `not_found` | 空 path ID、连接不存在或不属于当前租户 |
| 409 | `invalid_state_transition` 或 `conflict` | 当前连接状态不允许凭证操作或后续冲突场景 |
| 503 | `service_unavailable` | database、audit、storage 或 service 异常 |

错误响应必须：

- 只返回稳定 code / error。
- 不回显输入原文。
- 不回显敏感字段。
- 不回显 `credentialRef`。
- 不回显 idempotencyKey。
- 不回显 scoped key。
- 不回显 storage provider 内部信息。
- 不回显 SQL、stack 或 `DATABASE_URL`。

## route / service 调用顺序

凭证 route 后续实现推荐顺序：

1. 从 path params 读取并 trim `connectionId`。
2. 空 `connectionId` 返回 `404 not_found`，不写 audit。
3. 获取服务端 access context。
4. access context 缺失返回 `401 unauthorized`，不写 route audit。
5. 使用服务端 access context 做 permission guard。
6. permission denied 写 route denied audit；audit 成功后返回 `403 forbidden`，audit 失败返回 `503 service_unavailable`。
7. 权限通过后读取 JSON body。
8. 调用凭证 parser。
9. parser failure 写 route denied audit；audit 成功后返回 `400 validation_failed`，audit 失败返回 `503 service_unavailable`。
10. 调用凭证 service。
11. 将 service result 映射到 HTTP status。
12. 返回 success DTO 或 error DTO。

必须避免：

- 无权限时解析或处理敏感 payload。
- 从 body / query / header / localStorage 读取 tenantId。
- parser failure 泄露 payload。
- service failure 重复 route audit。
- route 层接触真实凭证。
- route 层调用真实 HIS。
- route 层做测试连接。
- route 层写 storage provider 内部信息。

如果后续实现复用现有 status route 的顺序，应保持“空 path ID 先 404、未登录 401、不写 audit；权限拒绝和 parser failure 写 route denied audit；service failure 不重复 route audit”的安全口径。

## 测试拆分建议

本 PR 只规划，不写测试。

后续凭证 API route / permission / audit 实现建议覆盖：

- route auth tests。
- route permission tests。
- `open_connection:manage_credentials` 权限矩阵 tests。
- `read_own_tenant` 不可替代凭证管理权限 tests。
- `update` 不默认替代凭证管理权限 tests。
- `manage_status` 不可替代凭证管理权限 tests。
- 平台管理员默认不能代管写入 tests。
- parser failure route tests。
- body `tenantId` reject tests。
- query / header tenantId 不参与租户判断 tests。
- body `credentialRef` / `credentialConfigured` reject tests。
- body `status` / `healthStatus` reject tests。
- raw HIS payload / external secret path reject tests。
- success DTO tests。
- error DTO tests。
- route denied audit tests。
- allowed audit tests。
- audit metadata 敏感信息禁区 tests。
- permission denied 不读取 body、不调用 parser、不调用 service tests。
- parser failure 不调用 service tests。
- service failure 不重复 route audit tests。
- `401 unauthorized` 不写 route audit tests。
- 空 `connectionId` 404 不写 route audit tests。
- audit failure fail closed tests。
- API route 不调用真实 HIS tests。
- API route 不做测试连接 tests。
- API route 不接真实 secret manager tests。

测试 fixture 禁止使用看起来像真实 token、secret、API key、connection string、raw credential 或 raw HIS payload 的字符串。

## 敏感信息禁区

以下内容不得进入 response、DTO、read model、audit metadata、logs、测试 fixture 或文档样例：

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
- `credentialRef`。
- idempotencyKey。
- scoped idempotency key。
- synthetic placeholder。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。

文档中如需要示例，只能使用字段名或稳定 code，不写任何看起来像真实密钥、连接串或 payload 的值。

## 后续阶段边界

本 PR 不进入：

- API route 实现。
- permission 实现。
- audit action / reason / domain 实现。
- route tests。
- service audit 实现。
- schema / migration。
- 测试连接。
- 连接健康检查。
- 真实 HIS adapter。
- webhook / 同步任务。
- 患者身份匹配。
- 人工复核 / 预览。
- 自动治疗摘要。
- 自动随访任务。
- 自动触达。
- 企微。
- AI / RAG / Agent。
- 经营智能中心。
- 图表 / 导出。

这些能力必须在后续独立 Plan Mode 中逐项拆分，不能和凭证 route / permission / audit 最小实现混在同一 PR。

## 下一阶段建议

建议顺序：

1. 凭证 API route / permission / audit 最小实现。
2. 凭证 route tests / permission tests / audit tests。
3. 凭证闭环文档收尾。
4. 测试连接 Plan Mode。
5. 真实 HIS adapter Plan Mode。

测试连接和真实 HIS adapter 不应混入凭证 API route / permission / audit 最小实现；真实凭证加密和 secret manager 也必须单独规划。

## 边界确认

- 是否 docs-only：是。
- 是否修改 `src/**`：否。
- 是否新增 API：否。
- 是否修改 route：否。
- 是否修改 service：否。
- 是否修改 parser / DTO：否。
- 是否修改 repository：否。
- 是否修改权限：否。
- 是否修改 audit domain / reason / query whitelist：否。
- 是否修改 schema / migration：否。
- 是否修改测试：否。
- 是否修改 demo seed：否。
- 是否修改 package / lockfile：否。
- 是否实现 API route / permission / audit：否。
- 是否处理真实凭证：否。
- 是否保存 token / secret / API key / connection string：否。
- 是否做测试连接：否。
- 是否接真实 HIS：否。
- 是否保存 raw HIS payload：否。
- 是否接企微 / AI / RAG / Agent：否。
- 是否创建自动摘要 / 自动随访 / 自动触达：否。

# Phase 23 HIS 连接配置创建更新 API route 设计

> 日期：2026-06-04
> 状态：Plan Mode 文档。本 PR 只规划后续 HIS 连接配置 create / update API route 接入，不新增 API route，不修改 `src/**`，不修改 service、parser、repository、权限、audit domain、audit repository、schema、migration、凭证能力或真实 HIS 接入。

## 本次定位

当前 Phase 23 已经完成 HIS 连接配置写入链路的若干前置能力：

- 写入 repository 已支持 create / update，并绑定可信 `tenantId`。
- 写入 parser 已支持 `parseCreateHisConnectionInput` 和 `parseUpdateHisConnectionInput`。
- `tenant_admin` 已具备 `open_connection:create` 和 `open_connection:update`，其他角色默认不具备写入。
- 写入 service 已导出 `createHisConnectionForTenantService` 和 `updateHisConnectionForTenantService`。
- service 成功路径已在事务内写 allowed audit。
- service 已接入 repository 失败路径 denied audit。
- audit reason 已支持 `invalid_his_connection_payload`、`his_connection_name_conflict`，并继续复用 `not_found_or_not_owned`、`role_denied`、`missing_tenant`、`cross_tenant_denied`。

当前缺口是 create / update HTTP route 尚未接入。本文档只规划后续 route 接入顺序、权限判断、parser 边界、service result 映射、route 层 denied audit、DTO 边界、错误响应和测试拆分。

本 PR 不进入运行时代码：

- 不新增 API route。
- 不修改现有 API route。
- 不修改 `src/**`。
- 不修改 service。
- 不修改 parser。
- 不修改 repository。
- 不修改权限实现或权限测试。
- 不修改 audit domain、audit reason、query whitelist 或 audit repository。
- 不修改 schema / migration。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 不创建治疗摘要或随访任务。
- 不修改 demo seed 数据。
- 不修改 `package.json` 或 lockfile。
- 不修改 `.codex`、Superpowers 缓存目录或技能文件。

## 只读检查结论

本次只读检查范围：

- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- 邻近治疗摘要和客户写入 route。
- 既有 Phase 23 parser、权限、service、reason 和 denied audit 文档。

已确认的代码事实：

- 当前 main commit 为 `8eed4e90a8932c656f26b0aabded7a09415fbdd0`。
- `GET /api/institution/his-connections` 已存在，只负责本租户连接配置只读列表。
- `GET /api/institution/his-connections/[connectionId]` 已存在，只负责本租户连接配置只读详情。
- 现有只读 route 使用 `open_connection:read_own_tenant`，不包含 create / update。
- create / update route 目前尚未实现。
- 写入 parser 只接受 `connectionName`、`sourceSystem`、`vendorType`、`systemType` 四个安全元数据字段。
- parser 已拒绝 body 中的 `tenantId`、状态字段、凭证字段、raw payload、完整请求 / 响应体、SQL、stack、`DATABASE_URL` 和敏感内容。
- 写入 service 只接收服务端 access context、parser 输出、path `connectionId`、database transaction 入口和 repository factory。
- service 成功 DTO 为 `{ ok: true }`。
- service 已在 repository `validation_failed`、`conflict`、update `not_found` 路径写 denied audit。
- repository thrown error 不写 denied audit，service 返回 `service_unavailable`。

## 后续 route 范围

后续最小 route 只包含：

- `POST /api/institution/his-connections`
- `PATCH /api/institution/his-connections/[connectionId]`

后续 route 不包含：

- pause / resume / revoke / delete 状态 API。
- 凭证创建、更新、轮换、撤销或展示。
- 测试连接、健康检查或真实 HIS adapter 调用。
- Webhook、同步任务、文件导入或外部系统回调。
- 治疗摘要创建、随访任务创建或自动触达。
- UI 写入入口。

## POST 接入顺序

`POST /api/institution/his-connections` 后续建议顺序：

1. 从 request 获取服务端 access context。
2. 无登录或无 access context 时返回 `401 unauthorized`，不读取 JSON，不调用 service。
3. 用 `canAccessResource` 判断 `resource=open_connection`、`action=create`。
4. `targetTenantId` 只能来自 `accessContext.tenantId`。
5. 权限拒绝时返回 `403 forbidden`。
6. 有 access context 但权限拒绝时，建议写 route 层 denied audit，reason 来自 access decision：`role_denied`、`missing_tenant` 或 `cross_tenant_denied`。
7. 权限拒绝 audit 不读取 request body，不记录 body / query / header tenantId，不记录外部租户值。
8. 权限通过后读取 JSON。
9. 使用 `parseCreateHisConnectionInput` 解析。
10. parser 失败时返回 `400 validation_failed`。
11. parser 失败时写 route 层 denied audit，reason 为 `invalid_his_connection_payload`，create 不写 resourceId。
12. parser 成功后调用 `createHisConnectionForTenantService`。
13. route 只把 access context、parser 输出、database transaction 入口和 repository factory 传给 service。
14. 根据 service result 映射 HTTP 状态和安全响应。

## PATCH 接入顺序

`PATCH /api/institution/his-connections/[connectionId]` 后续建议顺序：

1. 从 path 读取并 trim `connectionId`。
2. 从 request 获取服务端 access context。
3. 无登录或无 access context 时返回 `401 unauthorized`，不读取 JSON，不调用 service。
4. 用 `canAccessResource` 判断 `resource=open_connection`、`action=update`。
5. `targetTenantId` 只能来自 `accessContext.tenantId`。
6. 权限拒绝时返回 `403 forbidden`。
7. 有 access context 但权限拒绝时，建议写 route 层 denied audit，reason 来自 access decision：`role_denied`、`missing_tenant` 或 `cross_tenant_denied`。
8. 权限拒绝 audit 可以使用 path `connectionId` 作为 resourceId，但不得说明目标是否存在或归属。
9. 权限通过后读取 JSON。
10. 使用 `parseUpdateHisConnectionInput` 解析。
11. parser 失败时返回 `400 validation_failed`。
12. parser 失败时写 route 层 denied audit，reason 为 `invalid_his_connection_payload`，resourceId 使用 path `connectionId`。
13. parser 成功后调用 `updateHisConnectionForTenantService`。
14. route 只把 access context、path `connectionId`、parser 输出、database transaction 入口和 repository factory 传给 service。
15. 根据 service result 映射 HTTP 状态和安全响应。

空 `connectionId` 建议返回 `404 not_found`，不暴露目标存在性。是否写 parser / route denied audit 需要以后续实现时的实际 helper 能力为准，但不得读取 body 或记录外部输入。

## 权限判断边界

后续 route 必须遵守：

- create 使用 `open_connection:create`。
- update 使用 `open_connection:update`。
- 不得复用 `open_connection:read_own_tenant` 放行写入。
- `targetTenantId` 只能取 `accessContext.tenantId`。
- 不接受 body `tenantId`。
- 不接受 query `tenantId`。
- 不接受 header `tenantId`。
- 不接受 localStorage `tenantId`。
- platform scope v1 不引入代管写入。
- `tenant_admin` 是 v1 唯一授权写入角色。
- `tenant_operator`、`consultant`、`customer_service`、`platform_admin`、`platform_operator`、`security_auditor` 默认拒绝 create / update。
- 缺失 `tenantId` 返回 `403 forbidden`，审计 reason 复用 `missing_tenant`。
- 跨租户 targetTenantId 如被构造出来，必须返回 `403 forbidden`，审计 reason 复用 `cross_tenant_denied`。

## parser 边界

后续 route 只能把普通 JSON body 交给 parser，且只能信任 parser 输出。

允许 parser 输出字段：

- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`

route 和 service 不得接受或传递：

- body / query / header / localStorage `tenantId`。
- `credentialRef`。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串。
- raw HIS payload。
- 完整请求体。
- 完整响应体。
- SQL、stack、`DATABASE_URL`。
- 状态字段、健康字段、凭证配置字段。
- 时间字段、actor 字段、删除 / 撤销字段。

parser 失败响应不得回显原始 payload、原始字段值、敏感字段值或内部 parser 细节。

## service result 映射

后续 route 应把 service result 映射成稳定 HTTP 响应：

| service result | POST HTTP | PATCH HTTP | response code | 说明 |
| --- | --- | --- | --- | --- |
| `created` | `201` | 不适用 | 无错误 | 返回 `{ ok: true }` |
| `updated` | 不适用 | `200` | 无错误 | 返回 `{ ok: true }` |
| `validation_failed` | `400` | `400` | `validation_failed` | parser 或 repository 防御性校验失败 |
| `conflict` | `409` | `409` | `conflict` | 租户内未删除连接名冲突 |
| `not_found` | 不适用 | `404` | `not_found` | 不存在、跨租户或已软删除统一处理 |
| `service_unavailable` | `503` | `503` | `service_unavailable` | 数据服务、事务或审计失败 |

`not_found` 不得区分不存在、属于其他租户或已软删除。`conflict` 不得暴露数据库 constraint、索引名或冲突行详情。

## route denied audit 边界

route 层只负责写两类 denied audit：

- 有 access context 但权限拒绝。
- JSON 可读但 parser 拒绝 payload。

route 层不应重复 service 已处理的 repository 失败 audit：

- repository `validation_failed` 已由 service 写 `invalid_his_connection_payload`。
- repository `conflict` 已由 service 写 `his_connection_name_conflict`。
- update repository `not_found` 已由 service 写 `not_found_or_not_owned`。

权限拒绝 reason：

- 无权限复用 `role_denied`。
- 缺失租户复用 `missing_tenant`。
- 跨租户 targetTenantId 复用 `cross_tenant_denied`。

parser 失败 reason：

- create 使用 `invalid_his_connection_payload`，不写 resourceId。
- update 使用 `invalid_his_connection_payload`，resourceId 使用 path `connectionId`。

未登录且无 tenant 的请求：

- 返回 `401 unauthorized`。
- v1 可以不写 tenant audit。
- 如需安全审计，应单独规划平台 / 安全审计，不混入本 route 最小实现。

denied audit 严禁记录：

- payload。
- 完整 request body。
- response body。
- body / query / header tenantId。
- `credentialRef`。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串。
- raw HIS payload。
- SQL、stack、`DATABASE_URL`。
- 医疗、治疗、咨询或文件原文。
- 数据库约束、索引或冲突细节。

## DTO 边界

成功响应建议统一为：

```json
{ "ok": true }
```

成功响应不得返回：

- `connectionId` 或 `id`。
- `tenantId`。
- `status`。
- `credentialRef`。
- `credentialConfigured`。
- `healthStatus`。
- 时间字段。
- actor 字段。
- `deletedAt`。
- `revokedAt`。
- repository read model。
- repository command。
- 原始 request body。

错误响应不得返回：

- SQL。
- stack。
- `DATABASE_URL`。
- exception message。
- request / response body。
- 凭证或连接串。
- raw HIS payload。
- 跨租户目标存在性。
- 数据库 constraint、索引名或冲突行详情。

## 测试规划摘要

后续 route 测试至少覆盖：

- POST 成功返回 `201` 和 `{ ok: true }`。
- PATCH 成功返回 `200` 和 `{ ok: true }`。
- 未登录 POST / PATCH 返回 `401`，不调用 service。
- 无权限 POST / PATCH 返回 `403`，不读取 body，不调用 service。
- 缺失 tenantId 返回 `403`，reason 为 `missing_tenant`。
- 跨租户 targetTenantId 被拒绝，reason 为 `cross_tenant_denied`。
- body / query / header tenantId 注入不生效。
- create parser 拒绝未知字段、凭证字段、状态字段、raw payload、SQL、stack、`DATABASE_URL`。
- update parser 拒绝空更新、未知字段、凭证字段、状态字段、raw payload、SQL、stack、`DATABASE_URL`。
- create parser 失败写 `invalid_his_connection_payload`，不写 resourceId。
- update parser 失败写 `invalid_his_connection_payload`，resourceId 使用 path `connectionId`。
- service `validation_failed` 映射 `400`，route 不重复写 repository failure audit。
- service `conflict` 映射 `409`。
- service `not_found` 映射 `404`。
- service `service_unavailable` 映射 `503`。
- 成功 DTO 不返回 id、tenantId、status、credentialRef、healthStatus、时间字段或 actor 字段。
- 错误响应不泄露 SQL、stack、`DATABASE_URL`、凭证、raw HIS payload 或完整 request / response body。
- route 不调用真实 HIS、机构系统、企微、AI、RAG、Agent、自动触达、治疗摘要创建、随访任务创建或测试连接。

## 后续拆分建议

建议继续小 PR 拆分：

1. route 最小实现。
   - 接入 POST / PATCH。
   - 完成 access context、权限、parser、service result 到 HTTP 映射。
   - 不做 UI，不接真实 HIS。
2. route 测试补强。
   - 覆盖成功、401、403、400、409、404、503、DTO 和敏感字段禁区。
3. route permission / parser denied audit。
   - 覆盖权限拒绝和 parser 失败 audit。
   - 不重复 service repository failure audit。
4. smoke / 文档收尾。
   - 确认 read API 与 write API 边界共存。
   - 确认无凭证、测试连接、真实 HIS 或自动触达。

## 停止条件

后续任何 PR 如出现以下需要，必须停止并拆分：

- 为本 route 引入凭证字段。
- 为本 route 处理 `credentialRef`。
- 为本 route 调用真实 HIS 或测试连接。
- 为本 route 保存 raw HIS payload。
- 为本 route 返回 id、tenantId、status、credentialRef、healthStatus 或 repository read model。
- 为本 route 接入自动创建治疗摘要、随访任务或自动触达。
- 为本 route 引入平台代管写入。
- 为本 route 修改 schema / migration。
- 为本 route 修改权限模型、audit reason 或 repository，除非对应 PR 明确把该能力作为唯一范围。

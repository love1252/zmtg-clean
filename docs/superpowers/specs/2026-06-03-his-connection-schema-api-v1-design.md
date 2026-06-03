# HIS 连接配置 schema / API v1 设计

> 日期：2026-06-03
> 状态：连接配置 schema / API Plan Mode 文档。本 PR 只做文档规划，不写代码、不改测试、不新增 API、不改数据库 schema / migration、不保存真实凭证、不接真实 HIS / 机构系统 / 企微 / AI，也不做测试连接实现、自动摘要、自动任务或自动触达。

## 0. 本次定位

本 PR 是 **连接配置 schema / API Plan Mode**，目标是在未来 HIS / 机构系统连接配置进入实现前，先规划 schema、API、权限、审计、DTO、错误态、凭证引用和租户隔离边界。

本 PR 明确不是：

- 不是 schema 实现。
- 不是 migration。
- 不是 API 实现。
- 不是凭证存储。
- 不是测试连接。
- 不是 HIS adapter。
- 不连接真实 HIS。
- 不连接任何机构系统。
- 不处理真实客户数据。
- 不写代码。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不保存任何真实凭证。
- 不保存 raw HIS payload。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

如果后续发现必须改代码、改 schema、加 API、接外部系统、处理真实凭证或处理真实数据，必须停止当前 docs-only 范围并单独进入对应 Plan Mode。

## 1. 与前序 HIS 规划的关系

本规划承接两个已合并的前序 docs-only PR：

- 真实 HIS adapter 前置评估：明确真实 adapter 不能绕过 Phase 22 mapper，不能保存 raw HIS payload，不能自动创建摘要、任务或触达。
- 连接配置与凭证边界：明确连接配置只表达安全元数据和状态，凭证明文不得返回前端、写审计、写日志、进入错误信息或 demo seed。

本 PR 只进一步细化未来连接配置的 schema / API 边界。它仍然不实现连接配置、凭证加密、测试连接、Webhook、同步任务或真实 adapter。

建议未来依赖顺序保持为：

```text
连接配置 schema / API 规划
-> schema / migration 实现规划
-> 只读 list / detail API
-> create / update API
-> pause / resume / revoke 状态 API
-> 凭证引用集成
-> 测试连接 Plan Mode
-> 真实 HIS adapter Plan Mode
```

## 2. 连接配置 schema 规划

以下字段是未来 schema 规划，不是当前数据库 schema，也不是本 PR 的真实 API 契约。

| 字段 | 建议语义 | 边界 |
| --- | --- | --- |
| `id` | 内部连接配置 ID，由服务端生成。 | 不使用外部系统 ID 作为内部主键；对外 DTO 可命名为 `connectionId`。 |
| `tenantId` | 连接归属租户。 | 只能来自服务端可信上下文、平台受控选择或后续可信连接上下文；不得来自 body、query、header、localStorage 或外部 payload。 |
| `connectionName` | 机构可识别的连接名称。 | 安全短文本，不包含凭证明文、连接串、真实客户信息、完整外部响应或 raw payload。 |
| `sourceSystem` | 来源系统大类，例如 `his`、`institution_system`、`sftp_import`、`manual_import`、`other`。 | 稳定枚举或安全短文本，不携带厂商字段全集。 |
| `vendorType` | 厂商或集成来源类型。 | 只作为治理标签，不代表已认证或已接入。 |
| `systemType` | HIS、机构自研系统、导入网关等系统类型。 | 只用于后续适配策略，不作为权限依据。 |
| `status` | 连接生命周期状态。 | 建议候选：`draft`、`active`、`paused`、`revoked`、`deleted`；状态变化必须可审计。 |
| `credentialRef` | 凭证引用。 | 只能是凭证引用，不是凭证明文；不得包含 token、secret、API key、OAuth token、basic auth、签名密钥、连接串或私钥。 |
| `healthStatus` | 最近健康状态。 | 建议候选：`unknown`、`healthy`、`degraded`、`failed`；只记录稳定状态和 reason code。 |
| `lastCheckedAt` | 最近一次健康检查或测试连接时间。 | 只记录时间，不保存外部响应体、请求体或测试连接详情全文。 |
| `lastErrorCode` | 最近一次安全错误码。 | 只允许稳定 reason code，不保存外部错误响应全文、SQL、stack、连接串或凭证相关内容。 |
| `createdBy` | 创建操作者引用。 | 记录安全 actor ID，不记录会话内容或凭证。 |
| `updatedBy` | 最近更新操作者引用。 | 记录安全 actor ID，不记录敏感输入内容。 |
| `createdAt` | 创建时间。 | 用于治理和审计。 |
| `updatedAt` | 更新时间。 | 用于治理和审计。 |
| `revokedAt` | 撤销时间。 | `revoked` 后不能通过普通 resume 直接恢复为 `active`。 |
| `deletedAt` | 软删除或归档时间。 | 删除优先软删除 / 归档，历史审计仍需可追溯。 |

### 2.1 字段命名建议

内部数据库字段可使用 `id`，对外 DTO 建议使用 `connectionId`，避免前端把连接 ID 和外部系统事件 ID 混淆。

`credentialRef` 只表示“有一个受控凭证引用”，不表示凭证明文、凭证密文或可调用密钥。凭证创建、更新、加密、轮换、撤销和销毁应拆到凭证管理 Plan Mode。

### 2.2 明确禁止保存

连接配置 schema、DTO、审计、错误信息和日志都不得保存：

- raw HIS payload。
- 完整请求体。
- 完整响应体。
- 完整治疗正文。
- 完整病历正文。
- 诊疗原文。
- 咨询全文。
- 图片 / 文件原文。
- token。
- secret。
- API key。
- OAuth access token。
- OAuth refresh token。
- basic auth 用户名和密码组合。
- 签名密钥。
- 私钥。
- 连接串。
- SQL。
- stack。
- `DATABASE_URL`。
- 外部系统错误响应全文。

如未来确需排障片段，必须单独评估脱敏、保留时间、权限、审计、删除策略和客户数据风险，不能混入连接配置 schema / API 实现。

### 2.3 租户隔离原则

连接配置必须按单一 `tenantId` 归属。机构端所有读写都只能使用服务端 access context 推导的 `tenantId`。平台端如需要按租户查看或代配置，也只能使用平台受控选择和明确权限判断，不得允许任意客户端字段成为可信租户上下文。

跨租户访问必须不可见。对机构端而言，其他租户连接应表现为 `not_found` 或权限拒绝的稳定错误，不返回目标连接存在性、厂商信息、健康状态或错误原因。

## 3. API 边界规划

以下 API 仅为未来规划，本 PR 不新增 API route，不改现有 API。

### 3.1 机构端候选 API

| 方法 | 路径 | 建议用途 | 边界 |
| --- | --- | --- | --- |
| `GET` | `/api/institution/his-connections` | 列出本租户连接配置安全摘要。 | 不接受可信 `tenantId` 参数；不返回凭证明文或 raw payload。 |
| `POST` | `/api/institution/his-connections` | 创建本租户连接配置元数据。 | 只创建连接配置，不创建或保存凭证明文。 |
| `GET` | `/api/institution/his-connections/[connectionId]` | 查看本租户连接配置详情。 | 只返回安全 DTO；跨租户不可见。 |
| `PATCH` | `/api/institution/his-connections/[connectionId]` | 更新低风险连接元数据或受控 `credentialRef`。 | 不接受凭证明文；凭证创建 / 更新另行规划。 |
| `POST` | `/api/institution/his-connections/[connectionId]/pause` | 暂停连接。 | 高危操作，必须写审计。 |
| `POST` | `/api/institution/his-connections/[connectionId]/resume` | 恢复暂停连接。 | 需重新校验权限、状态和凭证引用有效性。 |
| `POST` | `/api/institution/his-connections/[connectionId]/revoke` | 撤销连接。 | 高危操作，建议触发凭证撤销流程，必须写审计。 |
| `DELETE` | `/api/institution/his-connections/[connectionId]` | 删除或归档连接配置。 | 默认高风险；建议软删除 / 归档，必须写审计。 |

### 3.2 平台端候选 API

平台端管理如未来需要，也只能规划为受控视图，不在本 PR 实现。候选方向：

- `GET /api/open-platform/his-connections`
- `GET /api/open-platform/his-connections/[connectionId]`
- `POST /api/open-platform/his-connections/[connectionId]/pause`
- `POST /api/open-platform/his-connections/[connectionId]/revoke`

平台端 API 只应展示安全元数据、状态和 reason code。平台管理员也不得看到凭证明文、raw HIS payload、完整外部响应体、连接串或客户业务明细。

### 3.3 API 禁止项

未来 API 必须遵守：

- API 不得返回凭证明文。
- API 不得返回 raw payload。
- API 不得返回完整请求体或响应体。
- API 不得返回 token、secret、API key、OAuth token、basic auth、签名密钥、连接串或私钥。
- API 不得允许客户端传入可信 `tenantId`。
- 机构端 API 不得通过 body、query、header 或 localStorage 切换租户。
- API 错误态不得泄露 token、secret、连接串、SQL、stack 或 `DATABASE_URL`。
- API 错误态不得返回外部系统错误响应全文。
- 创建 / 更新凭证应拆到凭证管理 Plan Mode，不混在连接配置 API 里实现。

## 4. 权限与租户隔离

以下权限为未来规划，本 PR 不改权限、认证或租户隔离。

| 操作 | 建议角色 | 边界 |
| --- | --- | --- |
| 查看连接列表 | 机构管理员可查看本租户完整安全摘要；普通机构人员默认只可查看简化连接状态，是否开放需单独评估。 | 不展示凭证明文、raw payload 或外部错误全文。 |
| 查看连接详情 | 机构管理员可查看本租户安全详情；平台管理员可查看受控安全元数据。 | 跨租户不可见，平台运营默认只看聚合健康。 |
| 创建连接配置 | 机构管理员可为本租户创建；平台管理员可在受控流程中为指定租户配置。 | `tenantId` 来自服务端上下文或平台受控选择，不来自请求任意字段。 |
| 更新连接配置 | 机构管理员可更新本租户低风险元数据；平台管理员可更新受控平台配置。 | `credentialRef` 更新必须拆到凭证引用集成；不接受凭证明文。 |
| 暂停连接 | 机构管理员、平台管理员。 | 高危操作，必须审计。 |
| 恢复连接 | 机构管理员、平台管理员。 | 恢复前校验状态、权限和凭证引用；`revoked` 不应直接恢复。 |
| 撤销连接 | 平台管理员或具备授权的机构管理员。 | 高危操作，必须审计，建议触发凭证撤销流程。 |
| 删除连接 | 默认仅平台管理员或具备授权的机构管理员。 | 高危操作，建议软删除 / 归档，必须审计。 |
| 发起测试连接 | 默认仅机构管理员、平台管理员或被授权的集成 / 安全角色。 | 本 PR 不实现；后续测试连接 Plan Mode 必须先规划安全返回值。 |

租户隔离硬边界：

- 机构端连接配置只读 / 写当前服务端 access context 的 `tenantId`。
- 普通机构人员如能查看，也只看本租户简化状态。
- 平台管理员查看租户连接状态必须经过平台权限判断和受控筛选。
- 平台运营默认不查看凭证元数据细节。
- 跨租户连接不可见。
- `tenantId` 不来自 body、query、header、localStorage 或外部 payload。
- 高危操作必须写审计。

## 5. 审计事件规划

未来连接配置 API 必须写安全审计。审计事件建议使用稳定 action：

- `his_connection:create`
- `his_connection:update`
- `his_connection:pause`
- `his_connection:resume`
- `his_connection:revoke`
- `his_connection:delete`
- `his_connection:test_requested`
- `his_connection:test_succeeded`
- `his_connection:test_failed`
- `his_connection:credential_ref_updated`

### 5.1 审计允许记录

审计只记录安全元数据：

- `tenantId`
- `connectionId`
- `sourceSystem`
- `status`
- `reasonCode`
- `actor`
- `createdAt`

如未来需要记录 `vendorType`、`systemType`、`healthStatus`、`lastErrorCode` 或凭证版本号，也必须确保它们是安全元数据，不包含凭证明文、连接串或外部 payload。

### 5.2 审计禁止记录

审计禁止记录：

- 凭证明文。
- token。
- secret。
- API key。
- OAuth access token。
- OAuth refresh token。
- basic auth。
- 签名密钥。
- 私钥。
- 连接串。
- raw HIS payload。
- 完整请求体。
- 完整响应体。
- 外部系统错误响应全文。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。
- SQL。
- stack。
- `DATABASE_URL`。

## 6. DTO 边界

以下 DTO 仅为未来规划。

### 6.1 list DTO

`GET /api/institution/his-connections` 建议只返回列表安全摘要：

- `connectionId`
- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`
- `status`
- `healthStatus`
- `lastCheckedAt`
- `lastErrorCode`
- `credentialConfigured`
- `createdAt`
- `updatedAt`

机构端 list DTO 默认不返回 `tenantId`。平台端受控视图可返回 `tenantId` 作为归属字段。

### 6.2 detail DTO

detail DTO 可在 list DTO 基础上增加：

- `credentialRefStatus`，例如 `configured`、`missing`、`expired`、`revoked`。
- `revokedAt`
- `deletedAt`
- `createdBy`
- `updatedBy`
- `allowedActions`

detail DTO 仍不得返回凭证明文、连接串、raw payload、完整外部响应体或客户业务明细。

### 6.3 create payload

create payload 建议只允许：

- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`

如未来允许同时绑定 `credentialRef`，该引用必须来自已完成的凭证管理流程，并按租户、状态和权限重新校验。create payload 不接受 `tenantId`、`id`、`createdBy`、`updatedBy`、`status`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`revokedAt`、`deletedAt` 或任何凭证明文。

### 6.4 update payload

update payload 建议只允许低风险元数据：

- `connectionName`
- `vendorType`
- `systemType`

如果未来允许更新 `credentialRef`，必须作为高危 `his_connection:credential_ref_updated` 审计事件，并确认凭证引用属于同一租户、状态可用且调用者具备权限。update payload 不接受凭证明文、raw payload、完整 endpoint 带敏感参数或外部响应体。

### 6.5 status transition payload

暂停、恢复、撤销和删除 payload 建议只允许安全 reason code 和短备注：

- `reasonCode`
- `reasonNote`

`reasonNote` 必须是安全短文本，不得包含凭证明文、token、secret、API key、连接串、raw HIS payload、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、SQL、stack 或 `DATABASE_URL`。

## 7. 错误态边界

未来 API 应使用稳定 error code，不泄露内部异常细节或外部系统错误全文。

建议稳定错误码：

| HTTP | 稳定错误码 | 场景 |
| --- | --- | --- |
| `401` | `unauthorized` | 未登录或 access context 缺失。 |
| `403` | `forbidden` | 当前 actor 无权限执行操作。 |
| `404` | `not_found` | 连接不存在、已删除或跨租户不可见。 |
| `409` | `conflict` | 状态冲突，例如 revoked 不能 resume。 |
| `409` | `invalid_status_transition` | 非法状态流转。 |
| `409` | `credential_ref_invalid` | 凭证引用不存在、跨租户、过期或已撤销。 |
| `400` | `validation_failed` | payload 字段非法、未知字段或格式错误。 |
| `503` | `service_unavailable` | 数据库或内部依赖不可用，已脱敏。 |

错误响应不得包含：

- token、secret、API key、OAuth token、basic auth、签名密钥或连接串。
- SQL、stack、`DATABASE_URL`。
- raw HIS payload。
- 外部系统错误响应全文。
- 凭证引用背后的任何敏感内容。
- 完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。

外部系统错误只允许映射成安全 reason code，例如 `credential_invalid`、`credential_expired`、`network_unreachable`、`external_timeout`、`vendor_scope_denied`、`tls_handshake_failed`、`ip_not_allowlisted`、`vendor_error_degraded`。

## 8. 安全边界结论

连接配置 schema / API 的核心结论：

- 连接配置只能保存安全元数据和凭证引用。
- `tenantId` 只能来自服务端可信上下文或平台受控选择。
- `credentialRef` 只能是引用，不是凭证明文。
- 连接配置 API 不负责创建、更新、展示或返回凭证明文。
- API、DTO、审计、日志和错误态都不得保存或返回 raw HIS payload。
- 高危状态流转必须审计。
- 测试连接必须单独进入 Plan Mode。
- 真实 HIS adapter 必须在连接配置、凭证引用、健康检查、Webhook / 同步、患者身份匹配和人工复核边界完成后，再单独规划。

## 9. 后续 PR 拆分建议

建议后续拆成：

- PR A：schema / API Plan Mode（当前 PR）。
- PR B：schema / migration 实现 Plan Mode。
- PR C：只读 list / detail API 实现。
- PR D：create / update API 实现。
- PR E：pause / resume / revoke 状态 API。
- PR F：凭证引用集成。
- PR G：测试连接 Plan Mode。
- PR H：真实 HIS adapter Plan Mode。

真实 HIS adapter 和测试连接不得混在 schema / API 实现 PR 里。凭证创建、更新、加密、轮换、撤销和销毁也不得混在连接配置 API PR 里。

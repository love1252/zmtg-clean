# HIS 连接配置 schema / migration v1 设计

> 状态：连接配置 schema / migration 实现 Plan Mode 文档。本 PR 只做文档规划，不写代码、不改测试、不新增真实 schema、不新增 migration、不新增 API、不改权限、认证或租户隔离、不保存真实凭证、不接真实 HIS / 机构系统 / 企微 / AI，也不做测试连接实现、自动摘要、自动任务或自动触达。

## 1. 本次定位

本 PR 是 **连接配置 schema / migration 实现 Plan Mode**，目标是在未来真正新增 HIS / 机构系统连接配置表之前，先规划表结构、字段边界、状态枚举、索引 / 唯一约束、软删除、审计关联、凭证引用和 migration 拆分方式。

本 PR 明确不是：

- schema 实现。
- migration 实现。
- API route 实现。
- repository 实现。
- 权限、认证或租户隔离实现。
- 凭证存储、凭证加密、KMS、轮换或销毁实现。
- 测试连接实现。
- 真实 HIS adapter。
- 真实 HIS / 机构系统接入。
- Webhook、同步任务、文件导入或外部系统任务实现。
- 患者身份匹配。
- 自动治疗摘要生成。
- 自动随访任务创建。
- AI 解析、RAG 或 Agent。
- raw HIS payload 入库。
- 真实客户数据导入或处理。
- 图表、导出或经营智能中心。

如果未来 schema / migration PR 发现必须同时改 API、权限、凭证存储、测试连接、真实 adapter 或处理真实数据，应停止并拆分 PR，不应在 schema / migration PR 中继续扩大范围。

## 2. 已有上下文

当前项目已经完成：

- PR #114：真实 HIS adapter 前置评估 Plan Mode。
- PR #115：连接配置与凭证边界 Plan Mode。
- PR #116：连接配置 schema / API 边界 Plan Mode。

当前仍未进入真实连接配置实现：

- 未新增 `his_connections` schema。
- 未新增 Drizzle migration。
- 未新增连接配置 API。
- 未新增连接配置 repository。
- 未保存任何真实凭证。
- 未保存 raw HIS payload。
- 未接真实 HIS / 机构系统。

本规划承接 PR #116 的 API / DTO / 权限边界，只进一步细化未来 schema 和 migration 实现前应固定的数据库侧约束。

## 3. 候选表：`his_connections`

未来可考虑新增 `his_connections` 表，作为每个机构租户下 HIS / 机构系统连接配置的安全元数据表。

候选字段：

| 字段 | 候选含义 | 边界 |
| --- | --- | --- |
| `id` | 内部连接 ID。 | 内部生成，不使用外部系统 ID 作为主键。 |
| `tenantId` | 连接归属租户。 | 只能来自服务端可信上下文、平台受控选择或后续可信连接上下文；不得来自 body、query、header、localStorage 或外部 payload。 |
| `connectionName` | 机构内可读连接名称。 | 仅保存短名称，不保存 URL 中的敏感参数、账号、token 或连接串。 |
| `sourceSystem` | 来源系统类型，例如 HIS、机构系统、文件导入占位。 | 使用稳定短码；不保存 raw payload。 |
| `vendorType` | 厂商 / 产品类型短码。 | 使用白名单短码或受控文本；不保存凭证、endpoint secret 或连接串。 |
| `systemType` | 系统类别，例如 `his`、`crm`、`erp`、`sftp_import`。 | 仅描述类型，不表示已经接入对应系统。 |
| `status` | 连接配置生命周期状态。 | 使用稳定枚举；状态变更必须可审计。 |
| `credentialRef` | 凭证引用。 | 只能是凭证引用，不是凭证明文、密文或可调用密钥；草稿态可为空。 |
| `healthStatus` | 最近一次健康状态摘要。 | 只保存稳定状态，不保存外部系统响应全文。 |
| `lastCheckedAt` | 最近一次检查时间。 | 仅表示检查时间，不表示本 PR 实现测试连接。 |
| `lastErrorCode` | 最近一次稳定错误码。 | 只保存白名单 reason code，不保存 SQL、stack、token、secret、连接串或外部响应全文。 |
| `createdBy` | 创建操作人。 | 保存 actor ID / system actor，不保存个人敏感凭证。 |
| `updatedBy` | 最近更新操作人。 | 保存 actor ID / system actor。 |
| `createdAt` | 创建时间。 | 使用服务端时间。 |
| `updatedAt` | 更新时间。 | 使用服务端时间。 |
| `revokedAt` | 撤销时间。 | 撤销后不应普通恢复为 `active`。 |
| `deletedAt` | 软删除 / 归档时间。 | 用于软删除，不表示物理删除 raw payload，因为本表不应保存 raw payload。 |

未来 schema 实现应继续遵循现有仓库风格：

- 使用服务端生成的内部 ID。
- `tenantId` 与 `tenants.id` 建立租户归属关系。
- 常用读取路径使用 `tenantId + id` 或 `tenantId + status`。
- 机构端 DTO 默认不返回 `tenantId`，平台受控视图可返回归属 `tenantId`。
- 不新增跨租户唯一约束。
- 不把外部系统 ID 作为内部主键。

## 4. 明确禁止保存的内容

`his_connections`、相关 DTO、审计、日志和错误态均不得保存或返回：

- token。
- secret。
- API key。
- OAuth token。
- basic auth。
- 签名密钥。
- 私钥。
- 连接串。
- 完整 endpoint 中的敏感 query。
- 凭证明文。
- 凭证密文。
- KMS key material。
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
- 其他租户信息。

如未来确需排障材料，必须另行进入数据最小化、安全保留期、脱敏、权限、审计和删除策略 Plan Mode，不能混入连接配置 schema / migration PR。

## 5. 状态枚举规划

未来可规划连接配置状态枚举：

| 状态 | 含义 | 迁移 / API 边界 |
| --- | --- | --- |
| `draft` | 已创建安全元数据，但尚未完成凭证引用或启用条件。 | `credentialRef` 可为空；不得执行真实连接。 |
| `active` | 配置被允许用于后续受控同步或 adapter。 | 仅表示配置状态，不表示本 PR 已实现 adapter。 |
| `paused` | 暂停使用。 | 可由具备权限的操作人恢复；状态变更必须审计。 |
| `revoked` | 撤销连接。 | 不应作为普通可恢复状态直接回到 `active`；通常需要新凭证引用或新连接配置。 |
| `deleted` | 软删除 / 归档。 | 应配合 `deletedAt`；默认列表不展示。 |
| `error` | 配置存在稳定错误状态。 | 只保存 `lastErrorCode` 等安全 reason code，不保存外部错误正文。 |

边界：

- 状态枚举只是未来 schema 约束规划，不是本 PR 的 enum 实现。
- 状态变化不等于测试连接实现。
- `error` 仅表示稳定状态，不可存储外部系统响应全文。
- `revoked` 与 `deleted` 都应避免普通恢复路径误用。
- 高危状态变更必须写审计事件。

## 6. `credentialRef` 边界

`credentialRef` 只表示“连接配置引用某个受控凭证记录”。它不是：

- 凭证明文。
- 凭证密文。
- 可调用 token。
- API key。
- OAuth token。
- Basic Auth 账号密码。
- 签名密钥。
- 连接串。
- KMS key。

规划要求：

- `credentialRef` 可在 `draft` 阶段为空。
- `credentialRef` 如未来存在，应只引用凭证管理模块内的受控记录。
- 凭证创建、更新、加密、轮换、撤销、销毁和泄露应急必须单独 Plan Mode / 独立 PR。
- 连接配置 schema / API / DTO / audit 不返回凭证明文，不返回凭证密文，不返回可调用凭证。
- 更新 `credentialRef` 应作为高危操作审计。

本 PR 不实现凭证表、不实现加密、不实现 KMS、不保存真实凭证。

## 7. 索引与唯一约束规划

未来 schema / migration PR 应在真实查询路径确定后再落地索引。当前建议评估：

| 候选索引 / 约束 | 用途 | 边界 |
| --- | --- | --- |
| `tenantId + id` unique | 支持所有机构端按本租户读取 / 更新单连接。 | 不用全局外部 ID 查连接；跨租户不可见。 |
| `tenantId + status` index | 支持按状态筛选列表。 | 不泄露其他租户状态数量。 |
| `tenantId + sourceSystem` index | 支持机构内按来源系统筛选。 | 只在有查询需求时实现。 |
| `tenantId + deletedAt` index | 支持默认隐藏软删除连接。 | `deletedAt is null` 为常用读取路径时再实现。 |
| `tenantId + credentialRef` index | 支持未来凭证影响范围查询。 | `credentialRef` 不应成为跨租户唯一或可枚举入口。 |
| `tenantId + lastCheckedAt` index | 支持健康检查运营视图。 | 本 PR不实现测试连接；无查询需求时可暂缓。 |
| `tenantId + connectionName` partial unique | 防止同租户未删除连接重名。 | 应使用 `deletedAt is null` 或等效软删除条件；不做跨租户唯一。 |
| `tenantId + sourceSystem + vendorType + connectionName` partial unique | 更细粒度地允许同名但不同来源 / 厂商连接。 | 与产品体验取舍相关，需在实现 PR 前确认。 |

软删除唯一约束处理：

- 如果允许删除后复用连接名，唯一约束应考虑 `deletedAt is null`。
- 如果使用 `status = 'deleted'` 与 `deletedAt` 双字段，应明确哪个字段作为唯一约束条件。
- 冲突错误对客户端只能返回稳定 code，例如 `his_connection_name_conflict`，不得泄露其他租户记录、底层 SQL 或完整 constraint 细节。

避免项：

- 不新增跨租户 unique。
- 不把外部系统 ID 作为 primary key。
- 不用 `credentialRef` 作为全局唯一可枚举入口。
- 不为尚无查询路径的字段过早堆叠索引。

## 8. 审计关系规划

未来连接配置操作应复用现有审计安全元数据思路。审计事件建议包括：

- `his_connection:create`
- `his_connection:update`
- `his_connection:pause`
- `his_connection:resume`
- `his_connection:revoke`
- `his_connection:delete`
- `his_connection:credential_ref_updated`
- `his_connection:health_status_changed`
- `his_connection:test_requested`
- `his_connection:test_succeeded`
- `his_connection:test_failed`

审计只记录安全元数据：

- `tenantId`
- `connectionId`
- `sourceSystem`
- `status`
- `reasonCode`
- `actor`
- `createdAt`

可考虑用现有审计 `resourceId` 关联 `connectionId`，资源类型和 action 命名如需扩展，必须在后续权限 / 审计实现 PR 中单独落地。

审计禁止记录：

- 凭证明文。
- 凭证密文。
- token。
- secret。
- API key。
- OAuth token。
- basic auth。
- 签名密钥。
- 私钥。
- 连接串。
- raw HIS payload。
- 完整请求体。
- 完整响应体。
- 外部系统错误响应全文。
- SQL。
- stack。
- `DATABASE_URL`。

## 9. migration 顺序规划

后续真实实现建议拆分：

1. schema / migration 实现 Plan Mode（当前 PR）。
2. schema / migration 实现 PR：只新增表、enum、索引、约束和 Drizzle meta，不新增 API / repository / 凭证存储。
3. schema / migration 测试 PR：覆盖字段、敏感字段禁止、约束、索引和 migration SQL 风险。
4. 只读 repository PR：只按 `tenantId` 读取安全元数据。
5. list / detail API PR：只读 API，机构端不接受可信 `tenantId`。
6. create / update API PR：只写安全元数据，不接凭证管理明文。
7. pause / resume / revoke 状态 API PR：只做状态流转和审计。
8. `credentialRef` 集成 Plan Mode / PR：只集成引用，不保存明文。
9. 测试连接 Plan Mode：单独评估外部调用、错误脱敏和审计。
10. 真实 HIS adapter Plan Mode：单独评估真实外部系统接入。

重要边界：

- migration PR 不实现 API。
- API PR 不处理凭证存储。
- `credentialRef` 集成不等于凭证加密实现。
- 测试连接不得混入 schema / migration PR。
- 真实 HIS adapter 不得混入 schema / migration PR。

## 10. 数据最小化与错误边界

schema 只能保存安全配置元数据：

- 内部 ID。
- 租户归属。
- 来源系统短码。
- 厂商 / 系统类别短码。
- 状态。
- 凭证引用。
- 健康状态摘要。
- 稳定错误码。
- 操作人和时间。

schema 不保存客户业务明细，不保存外部请求 / 响应，不保存凭证，不保存完整治疗 / 病历 / 咨询正文。

未来 repository / API 暴露错误时：

- `401` / `403` / `404` / `409` / validation failed / service unavailable 使用稳定错误码。
- DB constraint error 只映射到安全 reason code。
- 不返回 SQL、stack、constraint 原文、连接串、凭证、`DATABASE_URL`、外部系统错误全文或其他租户信息。
- 跨租户查不到应表现为 `not_found` 或权限拒绝，不得泄露目标连接存在性。

## 11. 后续 PR 拆分建议

- PR A：schema / migration Plan Mode（当前 PR）。
- PR B：schema / migration 实现。
- PR C：schema / repository tests。
- PR D：只读 repository。
- PR E：list / detail API。
- PR F：create / update API。
- PR G：pause / resume / revoke API。
- PR H：`credentialRef` 集成 Plan Mode。
- PR I：测试连接 Plan Mode。
- PR J：真实 HIS adapter Plan Mode。

真实 HIS adapter 和测试连接不得混在 schema / migration 实现 PR 里。凭证创建、更新、加密、轮换、撤销、销毁和泄露应急也不得混在连接配置 schema / migration PR 里。

## 12. 结论

未来 `his_connections` 表应只承担“连接配置安全元数据”的职责：

- `tenantId` 只能来自服务端可信上下文。
- `credentialRef` 只能是凭证引用，不是凭证明文。
- 状态枚举、索引和唯一约束都必须按租户隔离设计。
- 审计只记录安全元数据。
- migration 实现必须与 API、凭证、测试连接和真实 adapter 分离。
- 不保存 raw HIS payload、真实凭证、完整业务正文或外部错误全文。

当前 PR 到此为止，只完成 schema / migration 规划，不进入任何真实实现。

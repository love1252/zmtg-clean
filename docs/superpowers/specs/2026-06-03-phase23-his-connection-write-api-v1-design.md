# Phase 23 HIS 连接配置写入 API 与状态流转边界设计

> 日期：2026-06-03
> 状态：Phase 23 Plan Mode 文档。本 PR 只做文档规划，不写代码、不改测试、不新增 API、不改现有 API、不改 schema / migration、不做写入 repository、不做凭证管理、不做测试连接、不接真实 HIS / 机构系统 / 企微 / AI，也不处理真实客户数据。

## 0. 本次定位

本 PR 是 **Phase 23 Plan Mode：HIS 连接配置写入 API 与状态流转边界**。

目标是在当前只读链路已经闭环后，规划未来如果要新增连接配置写入能力，create / update / pause / resume / revoke / delete API、写入 repository、权限、审计、状态流转、错误态和数据最小化应如何设计。

当前已完成的只读链路是：

```text
schema / migration
-> read repository
-> list / detail GET API
-> workspace 只读入口
-> 只读 UI
-> smoke / 文档收尾
```

本 PR 明确不是：

- 不是写入 API 实现。
- 不是写入 repository 实现。
- 不是 schema / migration。
- 不是凭证管理。
- 不是测试连接。
- 不是真实 HIS adapter。
- 不连接真实 HIS。
- 不连接任何机构系统。
- 不处理真实客户数据。
- 不写代码。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改 UI。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不保存 raw HIS payload。
- 不保存或返回任何真实凭证。
- 不返回 `credentialRef`。
- 不展示凭证明文。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

如果后续发现必须新增 API、改 schema、改权限模型、做凭证存储、接外部系统或处理真实数据，必须停止当前 docs-only 范围并单独进入对应 Plan Mode。

## 1. 与现有实现的关系

本规划承接已合并的连接配置 schema / migration、只读 repository、list / detail 只读 API、只读 UI 和只读 UI smoke / 文档收尾。

当前代码事实：

- `src/server/db/schema.ts` 已有 `his_connections` 安全元数据表。
- 状态枚举已包含 `draft`、`active`、`paused`、`revoked`、`deleted` 和 `error`。
- 健康状态枚举已包含 `unknown`、`healthy`、`degraded` 和 `failed`。
- `credentialRef` 在 schema 中是 nullable 引用字段，但现有 API 不返回该字段。
- `src/modules/institution/server/his-connection-repository.ts` 只提供 `listHisConnectionsByTenant` 和 `getHisConnectionByTenant`。
- `GET /api/institution/his-connections` 和 `GET /api/institution/his-connections/[connectionId]` 只读，复用 `open_connection:read_own_tenant`。
- 现有 list / detail DTO 不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw payload。
- 当前权限模型中只有 `tenant_admin` 具备 `open_connection:read_own_tenant`。

因此 Phase 23 只规划未来写入边界，不宣称当前系统已经具备写入能力。

## 2. 拟规划 API

以下 API 仅为未来规划，本 PR 不新增 route，不改现有 GET API。

```text
POST /api/institution/his-connections
PATCH /api/institution/his-connections/[connectionId]
POST /api/institution/his-connections/[connectionId]/pause
POST /api/institution/his-connections/[connectionId]/resume
POST /api/institution/his-connections/[connectionId]/revoke
DELETE /api/institution/his-connections/[connectionId]
```

### 2.1 创建 API

`POST /api/institution/his-connections` 未来只应创建本租户连接配置安全元数据。

建议规则：

- `tenantId` 只来自服务端 access context。
- `id`、`createdBy`、`updatedBy`、`createdAt` 和 `updatedAt` 由服务端生成或写入。
- 初始 `status` 建议由服务端固定为 `draft`。
- v1 create payload 不接受 `credentialRef`，避免把凭证绑定混入写入 API。
- create API 不处理凭证明文，不做测试连接，不调用真实 HIS。
- create API 成功后只返回安全 DTO，不返回 `tenantId`、`credentialRef`、`deletedAt`、凭证明文或 raw payload。

如未来业务要求创建时直接绑定凭证，必须先完成凭证管理 Plan Mode，再以独立 PR 规划凭证引用绑定流程。

### 2.2 更新 API

`PATCH /api/institution/his-connections/[connectionId]` 未来只应更新低风险连接元数据。

建议规则：

- 只按 `tenantId + connectionId` 查找目标。
- 跨租户、不存在或已软删除目标统一返回稳定 `not_found`。
- 不允许客户端更新 `tenantId`、`id`、审计字段、生命周期时间戳或凭证字段。
- v1 update payload 不接受 `credentialRef`。
- update API 不处理凭证明文，不做测试连接，不调用真实 HIS。
- update API 不应修改 `status`；状态变化走独立状态 API。

### 2.3 暂停 API

`POST /api/institution/his-connections/[connectionId]/pause` 未来用于暂停连接。

建议规则：

- 只允许对当前租户可见且未删除的连接操作。
- `active` 和 `error` 可进入 `paused`。
- `draft` 是否允许 pause 应保守评估，建议 v1 不允许，返回 `invalid_state_transition`。
- `revoked` 和 `deleted` 不允许 pause。
- 必须写审计。
- 不调用真实 HIS，不主动撤销凭证。

### 2.4 恢复 API

`POST /api/institution/his-connections/[connectionId]/resume` 未来用于恢复暂停连接。

建议规则：

- 只允许 `paused` 恢复为 `active`。
- `revoked` 不应普通恢复为 `active`。
- `deleted` 不允许恢复。
- `draft` 不应通过 resume 变成 `active`，除非未来单独规划 activate 流程。
- `error` 是否可恢复必须单独评估，建议 v1 先要求人工处理后进入 `paused` 或重新配置。
- 恢复只代表系统状态变更，不代表测试连接成功，不代表真实 HIS 调用已实现。
- 必须写审计。

### 2.5 撤销 API

`POST /api/institution/his-connections/[connectionId]/revoke` 未来用于撤销连接配置。

建议规则：

- `draft`、`active`、`paused` 和 `error` 可进入 `revoked`。
- `revoked` 重复撤销可返回 `conflict` 或幂等成功，v1 建议返回稳定 `conflict` 并写审计。
- `deleted` 不允许 revoke。
- 设置 `revokedAt`。
- `revoked` 不应通过普通 resume 恢复。
- 凭证撤销必须由凭证管理 Plan Mode 单独设计；本 API 不处理凭证明文、不调用外部系统。
- 必须写审计。

### 2.6 删除 API

`DELETE /api/institution/his-connections/[connectionId]` 未来用于软删除 / 归档连接配置。

建议规则：

- delete 是软删除 / 归档语义，设置 `deletedAt` 并使连接对机构端 list / detail 不可见。
- 不硬删除历史审计。
- `deleted` 记录不再允许 pause / resume / revoke / update。
- 删除不代表凭证材料已销毁；凭证销毁必须由凭证管理 Plan Mode 单独设计。
- 必须写审计。

## 3. 输入字段边界

### 3.1 create 允许字段

create payload v1 建议只允许安全元数据：

- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`

`status` 初始值不从客户端接收，由服务端固定为 `draft`。

`credentialRef` 在 Phase 23 v1 写入 API 中建议暂不允许写入，只作为后续凭证管理集成点规划。未来如果要写入凭证引用，必须单独完成凭证管理 Plan Mode，确认引用归属、状态、权限、审计和回滚策略。

### 3.2 update 允许字段

update payload v1 建议只允许安全元数据：

- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`

update payload 不允许直接修改 `status`。pause / resume / revoke / delete 必须走对应状态 API。

### 3.3 状态 API 允许字段

pause / resume / revoke / delete payload 建议只允许：

- `reasonCode`
- `reasonNote`

`reasonCode` 必须是稳定安全枚举。`reasonNote` 必须是安全短文本，不得包含凭证、外部响应全文、SQL、stack、客户完整内容或 raw payload。

### 3.4 严禁输入字段和内容

所有 write / status API 都严禁接受以下字段或内容作为业务输入：

- `tenantId`
- `id`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `revokedAt`
- 凭证明文
- token
- secret
- API key
- OAuth token
- basic auth
- 签名密钥
- 私钥
- 连接串
- raw HIS payload
- 完整请求体 / 响应体
- 完整治疗正文
- 完整病历正文
- 咨询全文
- 图片 / 文件原文
- SQL
- stack
- `DATABASE_URL`

如果 payload 包含未知字段或禁止字段，建议返回 `validation_failed`，并写安全审计。错误响应和审计都不得回显原始 payload。

## 4. 租户与权限边界

### 4.1 租户来源

未来所有机构端写入都必须遵守：

- `tenantId` 只来自服务端 access context。
- 不接受 body / query / header / localStorage 中的 `tenantId`。
- 不接受外部 HIS payload 中的 `tenantId`。
- 所有写入必须绑定当前租户。
- repository 方法必须以 `tenantId + connectionId` 定位目标。
- 跨租户目标统一返回稳定错误，建议机构端目标类 API 使用 `not_found`，不泄露目标是否存在。

### 4.2 机构角色边界

当前系统只给 `tenant_admin` `open_connection:read_own_tenant`。未来写入能力需要单独评估权限模型。

建议方向：

- 机构管理员：可规划 create / update / pause / resume，revoke / delete 是否开放需谨慎评估。
- 普通机构人员：默认不允许写入连接配置；如可见，也只应为只读安全状态。
- 客服、顾问等业务角色：默认不允许写入连接配置。
- 高危操作：pause / resume / revoke / delete 必须要求更高权限并写审计。

本 PR 不改现有权限模型。若未来需要新增 `open_connection:create`、`open_connection:update`、`open_connection:manage_status` 或更细资源，必须在独立 Plan Mode 中评估。

### 4.3 平台代管边界

平台管理员代管能力需要后续单独评估。

建议原则：

- 平台管理员不得绕过审计直接修改机构连接。
- 平台代管必须有明确 tenant target、授权来源、操作原因和审计。
- 平台运营默认只看聚合或安全状态，不接触凭证、raw payload 或客户业务明细。
- 若平台端需要 create / update / pause / revoke / delete API，必须单独进入 Plan Mode。

## 5. 状态流转边界

规划状态：

```text
draft
active
paused
revoked
deleted
error
```

### 5.1 状态语义

| 状态 | 建议语义 | 边界 |
| --- | --- | --- |
| `draft` | 元数据草稿，尚未进入可用连接状态。 | create 默认状态；不代表凭证已配置，不代表可连接 HIS。 |
| `active` | 系统允许该连接作为可用配置参与后续流程。 | 不代表测试连接成功，不代表真实 HIS 调用已实现。 |
| `paused` | 人工暂停，后续流程不应使用该连接。 | 可由 `active` 或经确认的 `error` 进入。 |
| `revoked` | 撤销语义，普通流程不可恢复。 | 不应通过 resume 直接恢复为 `active`。 |
| `deleted` | 软删除 / 归档语义。 | list / detail 默认不可见，历史审计保留。 |
| `error` | 连接出现稳定错误态。 | 只能保存安全 reason code，不保存外部错误全文。 |

### 5.2 推荐流转

建议 v1 流转：

```text
draft -> active
draft -> revoked
draft -> deleted
active -> paused
active -> revoked
active -> deleted
active -> error
paused -> active
paused -> revoked
paused -> deleted
error -> paused
error -> revoked
error -> deleted
revoked -> deleted
```

禁止或需单独 Plan Mode 的流转：

- `revoked -> active`
- `deleted -> active`
- `deleted -> paused`
- `deleted -> revoked`
- `draft -> paused`
- `draft -> error`
- `error -> active`，除非后续测试连接 / 健康检查 Plan Mode 明确恢复策略

### 5.3 状态边界说明

- `revoked` 不应普通恢复为 `active`。
- `deleted` 是软删除 / 归档语义，不是硬删除。
- `error` 不能保存外部错误全文，只能保存稳定错误码。
- `pause / resume / revoke / delete` 必须有审计。
- 状态流转不代表测试连接或真实 HIS 调用已实现。
- 状态流转不代表凭证创建、凭证撤销、凭证销毁或密钥轮换已实现。

## 6. 审计规划

未来写入 API 必须写安全审计。建议语义审计事件：

```text
his_connection:create
his_connection:update
his_connection:pause
his_connection:resume
his_connection:revoke
his_connection:delete
```

现有审计模型使用 resource / action / reason 结构。未来实现时如需把上述语义事件落到现有 `open_connection` resource 和 `create` / `update` / `delete` / `manage_status` action，应保持事件语义清晰；如需扩展审计枚举或字段，必须单独评估 schema / migration 和权限影响。

### 6.1 审计允许记录

审计只记录安全元数据：

- `tenantId`
- `connectionId`
- `sourceSystem`
- `status`
- `reasonCode`
- `actor`
- `createdAt`

如未来需要记录 `vendorType`、`systemType`、`healthStatus`、`lastErrorCode` 或状态前后值，必须确认这些字段不含凭证、连接串、外部 payload 或客户完整内容。

### 6.2 审计禁止记录

审计禁止记录：

- 凭证明文
- token
- secret
- API key
- OAuth token
- basic auth
- 签名密钥
- 私钥
- 连接串
- raw HIS payload
- SQL
- stack
- `DATABASE_URL`
- 外部系统错误响应全文
- 完整请求体 / 响应体
- 完整治疗正文
- 完整病历正文
- 咨询全文
- 图片 / 文件原文

审计事件不应回显原始 payload。非法 payload 只记录稳定 reason code，例如 `validation_failed`、`invalid_state_transition` 或 `forbidden_field_present`。

## 7. 错误态边界

未来写入 API 应使用稳定错误码：

```text
unauthorized
forbidden
not_found
validation_failed
conflict
invalid_state_transition
service_unavailable
```

### 7.1 建议 HTTP 映射

| HTTP | 稳定错误码 | 场景 |
| --- | --- | --- |
| `401` | `unauthorized` | 未登录或 access context 缺失。 |
| `403` | `forbidden` | 当前 actor 无权限执行操作。 |
| `404` | `not_found` | 连接不存在、已删除或跨租户不可见。 |
| `400` | `validation_failed` | payload 非法、未知字段、禁止字段或格式错误。 |
| `409` | `conflict` | 重复操作、唯一约束冲突或并发状态冲突。 |
| `409` | `invalid_state_transition` | 非法状态流转。 |
| `503` | `service_unavailable` | 数据库或内部依赖不可用，已脱敏。 |

### 7.2 错误响应禁止项

错误响应不得泄露：

- SQL
- stack
- token
- secret
- API key
- OAuth token
- basic auth
- signing key
- private key
- connection string
- `DATABASE_URL`
- raw HIS payload
- external response body
- 凭证明文
- 完整请求体 / 响应体
- 完整治疗正文
- 完整病历正文
- 咨询全文
- 图片 / 文件原文

外部系统错误只允许映射为安全 reason code。本阶段不做测试连接和真实 HIS 调用，因此不应产生外部系统错误响应。

## 8. 数据最小化结论

Phase 23 的写入 API 边界结论：

- create / update 只能处理连接配置安全元数据。
- create / update / status API 不处理凭证明文。
- `credentialRef` v1 不允许从 write payload 写入，也不返回给前端；后续只作为凭证管理集成点规划。
- 凭证录入、加密、轮换、撤销必须单独 Plan Mode。
- 测试连接必须单独 Plan Mode。
- 真实 HIS adapter 必须单独 Plan Mode。
- 所有机构端写入都必须绑定服务端 access context 的 `tenantId`。
- 跨租户目标不可见。
- 状态流转不代表外部系统可用性，不代表真实 HIS 已接入。
- 审计、DTO、错误态和日志只允许安全元数据。

## 9. 后续 PR 拆分建议

建议拆成：

- PR A：Phase 23 写入 API Plan Mode（当前 PR）。
- PR B：写入 repository Plan Mode。
- PR C：create / update repository 实现。
- PR D：create / update API 实现。
- PR E：pause / resume / revoke / delete 状态 API。
- PR F：审计补强。
- PR G：凭证管理 Plan Mode。
- PR H：测试连接 Plan Mode。
- PR I：真实 HIS adapter Plan Mode。

后续每个实现 PR 都必须继续确认：

- 是否 docs-only。
- 是否新增 API。
- 是否做写入能力。
- 是否改 schema / migration。
- 是否改权限 / 认证 / 租户隔离。
- 是否接 HIS / 企微 / AI / 自动触达。
- 是否返回 / 展示真实凭证。
- 是否展示 raw HIS payload。
- 是否修改 demo seed 数据。

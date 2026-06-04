# Phase 23 HIS 连接配置 create / update API v1 设计

> 日期：2026-06-03
> 状态：Phase 23 Plan Mode 文档。本 PR 只做文档规划，不实现 API、route、服务层、repository、schema、权限、审计、凭证管理或测试连接。

## 本次定位

本 PR 聚焦 **HIS 连接配置 create / update API v1 的实现前规划**。当前 repository 已具备 `createHisConnectionForTenant` 和 `updateHisConnectionForTenant`，也已具备 pause、resume、revoke、softDelete 等状态流转方法；本次只规划未来 HTTP create / update API 如何安全接入这些既有能力。

本 PR 不进入任何运行时代码变更：

- 不新增 API route。
- 不新增或修改服务层。
- 不新增或修改 repository。
- 不新增 parser。
- 不改 schema 或 migration。
- 不改权限、认证或租户隔离。
- 不写审计实现。
- 不做凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、自动触达或外部系统。
- 不保存或返回真实凭证、raw HIS payload、完整病历、完整治疗正文或咨询全文。
- 不自动创建治疗摘要或随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

如果后续发现 create / update API 必须先改权限、审计模型、凭证模型或 schema，必须停止 API 实现并拆独立 Plan Mode。

## 只读检查结论

本次只读检查了 HIS route、repository、测试、docs 以及邻近写入 API 风格：

- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
- `src/modules/institution/server/treatment-summary-write-input.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/security/domain/access-control.ts`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-api-v1.md`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-repository-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-repository-v1.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

已确认的代码事实：

- 当前 main commit 为 `fdcbe47161a23411c1157dba6745b787039d3586`。
- HIS 连接配置当前已有 list / detail 只读 API：`GET /api/institution/his-connections` 和 `GET /api/institution/his-connections/[connectionId]`。
- 现有只读 API 只使用服务端 access context 的 `tenantId`，不信任 query、header 或 body 中的租户信息。
- 现有只读 DTO 不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw payload。
- repository 已具备 `createHisConnectionForTenant` 和 `updateHisConnectionForTenant`。
- repository create 固定写入 `draft` 和 `unknown`，只写安全元数据与 actor 字段。
- repository update 只允许更新 `connectionName`、`sourceSystem`、`vendorType`、`systemType`，并绑定 `tenantId + connectionId + deletedAt is null`。
- repository 测试已覆盖安全字段白名单、跨租户不可见、软删除不可写、唯一冲突、空更新、敏感字段不写入、无外部调用、无治疗摘要 / 随访任务 / 自动触达和 demo seed 不修改。
- 当前权限模型中 `tenant_admin` 对 `open_connection` 只有 `read_own_tenant`，尚没有 `create` 或 `update` 授权。
- 现有治疗摘要写入 API 风格是：服务端 access context、JSON body 读取、payload parser 白名单、`canAccessResource` 权限判断、事务内 repository 写入、审计写入、安全 DTO、稳定错误响应和异常 503。

## create / update API 边界

未来 create / update API v1 只处理安全元数据字段：

- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`

`tenantId` 只能来自服务端 access context。客户端传入的 body、query、header、localStorage、外部 HIS payload 或任何其他来源中的 `tenantId` 都不可信，必须忽略或拒绝。

create API 建议路径：

```text
POST /api/institution/his-connections
```

update API 建议路径：

```text
PATCH /api/institution/his-connections/[connectionId]
```

create 成功建议返回 `201`，update 成功建议返回 `200`。两者都只返回安全 DTO，不回显完整请求体，不返回内部 repository command。

create 不接受客户端传入 `status`、`healthStatus`、`credentialRef`、`createdBy`、`updatedBy`、`createdAt`、`updatedAt`、`revokedAt` 或 `deletedAt`。初始状态继续由服务端 / repository 固定为 `draft`，健康状态固定为 `unknown`。

update 不允许修改 `status`。pause / resume / revoke / delete 必须留给后续状态 API PR。

## 严禁返回和记录的内容

create / update API、错误响应、审计事件、日志、测试 fixture 和文档示例均严禁返回或展示：

- `credentialRef`
- token
- secret
- API key
- OAuth token
- basic auth
- 签名密钥
- 私钥
- 连接串
- raw HIS payload
- 完整请求体
- 完整响应体
- SQL
- stack
- `DATABASE_URL`
- 完整病历正文
- 完整治疗正文
- 咨询全文
- 图片 / 文件原文

允许对外返回的凭证相关信息只限现有派生布尔值 `credentialConfigured`。该字段只表达是否已有凭证引用，不泄露引用值、凭证类型或凭证明文。

## HTTP 载荷解析器规划

后续 parser PR 建议新增独立解析器，位置可为：

```text
src/modules/institution/server/his-connection-write-input.ts
```

解析器职责：

- 只接受 JSON object。
- create payload 必须包含四个安全元数据字段。
- update payload 允许四个安全元数据字段的非空子集，至少提供一个字段。
- 所有字符串必须 trim。
- 长度限制对齐 repository：`connectionName` 不超过 160，`sourceSystem`、`vendorType`、`systemType` 不超过 64。
- 未知字段返回 `validation_failed`。
- 禁止字段返回 `validation_failed`。
- 空字符串、超长字符串、非字符串字段返回 `validation_failed`。
- 含有凭证、连接串、raw payload、SQL、stack、`DATABASE_URL`、完整正文等敏感内容的字符串返回 `validation_failed`。
- parser 不读取 request，不读取 access context，不接触数据库，不写审计。

必须拒绝的输入字段包括：

- `tenantId`
- `id`
- `connectionId`
- `credentialRef`
- `status`
- `healthStatus`
- `lastCheckedAt`
- `lastErrorCode`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`
- `revokedAt`
- `deletedAt`
- `token`
- `secret`
- `apiKey`
- `oauthToken`
- `basicAuth`
- `signingKey`
- `privateKey`
- `connectionString`
- `rawPayload`
- `requestBody`
- `responseBody`
- `sql`
- `stack`

## 权限判断规划

当前代码事实是：`open_connection` 只有 `read_own_tenant` 权限，没有 create / update 权限。因此后续 API route 不得临时复用 read 权限来放行写入。

建议拆分原则：

- 如果权限模型仍未补齐，create / update route 必须通过 `canAccessResource` 得到拒绝，并返回 `forbidden`。
- 若要真正允许写入，必须先在独立权限 Plan Mode / PR 中评估是否为 `open_connection:create` 和 `open_connection:update` 授权 `tenant_admin`。
- 普通机构人员、顾问、客服、平台只读角色默认不得写入 HIS 连接配置。
- 平台代管写入不纳入 v1 create / update API，后续如需要必须单独设计平台 scope、目标租户选择、审计和双重确认。

未来 route 的权限判断顺序建议为：

1. 从 request 取得服务端 access context；缺失返回 `unauthorized`。
2. 使用 `canAccessResource` 检查 `resource: 'open_connection'` 与 `action: 'create'` 或 `action: 'update'`。
3. 要求 access context 中存在 `tenantId`。
4. 拒绝时写安全 denied audit，但不得写 payload 原文。
5. 只有权限允许后才进入 repository 写入事务。

## 服务层事务规划

后续 API route 实现不应把所有写入和审计逻辑散落在 route 中。建议新增服务层承接事务编排，位置可为：

```text
src/modules/institution/server/his-connection-write-service.ts
```

服务层输入只接收：

- 服务端 access context 中的可信 `tenantId`
- 服务端 access context 中的 `actorUserId`
- route path 中 trim 后的 `connectionId`，仅 update 使用
- parser 输出的安全元数据
- transaction database
- HIS connection repository
- audit repository

服务层事务边界：

- create：在同一个数据库事务中调用 `createHisConnectionForTenant`，成功后写 allowed audit。
- update：在同一个数据库事务中调用 `updateHisConnectionForTenant`，成功后写 allowed audit。
- repository 返回 `conflict`、`validation_failed` 或 `not_found` 时写 denied audit，审计 reason 使用安全枚举或后续补强后的 HIS 连接专用 reason。
- 事务内不调用真实 HIS，不调用 fetch，不做测试连接，不做凭证存取，不创建治疗摘要，不创建随访任务。
- 审计失败时不应留下“业务写入成功但无审计”的状态，除非后续明确设计补偿队列；v1 建议事务一起回滚。

## 审计写入规划

当前审计模型已有 `resource: 'open_connection'` 和 `action: 'create' | 'update'` 类型能力。后续 create / update API 应优先复用这个资源与动作组合，而不是临时新增不兼容的审计资源。

建议审计事件：

- create 成功：`resource: 'open_connection'`，`action: 'create'`，`result: 'allowed'`，`resourceId: connectionId`
- update 成功：`resource: 'open_connection'`，`action: 'update'`，`result: 'allowed'`，`resourceId: connectionId`
- 权限拒绝：`result: 'denied'`，reason 使用 `role_denied`、`missing_tenant` 或 `cross_tenant_denied`
- payload 非法：`result: 'denied'`，reason 需要后续审计 reason 补强后使用安全枚举
- not_found：`result: 'denied'`，reason 可复用或补强为 `not_found_or_not_owned`
- conflict：`result: 'denied'`，reason 需要后续补强为安全冲突枚举

审计允许记录：

- actor id
- actor role
- tenantId
- resource
- resourceId
- action
- result
- reason
- occurredAt
- source

审计不记录：

- 完整请求体
- 完整响应体
- payload 原文
- 凭证明文
- `credentialRef`
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串
- raw HIS payload
- 外部系统错误全文
- SQL、stack、`DATABASE_URL`
- 完整病历、完整治疗正文、咨询全文、图片 / 文件原文

## DTO 数据最小化规划

create / update 成功响应应复用当前只读安全 DTO 形状，允许字段为：

- `connectionId`
- `connectionName`
- `sourceSystem`
- `vendorType`
- `systemType`
- `status`
- `credentialConfigured`
- `healthStatus`
- `lastCheckedAt`
- `lastErrorCode`
- `createdAt`
- `updatedAt`
- `revokedAt`

响应不得包含：

- `tenantId`
- `deletedAt`
- `credentialRef`
- actor 字段
- 内部数据库列名
- 原始 request body
- repository command
- 任何凭证、连接串、raw payload 或外部错误全文

## API 错误映射规划

建议稳定错误响应：

| 场景 | HTTP 状态 | 响应 code | 响应 error |
| --- | --- | --- | --- |
| 未登录 | 401 | `unauthorized` | `请先登录` |
| 无权限或无租户上下文 | 403 | `forbidden` | `没有访问权限` |
| JSON 格式错误 | 400 | `validation_failed` | `请求格式不正确` |
| payload 非法 | 400 | `validation_failed` | parser 返回的安全中文错误 |
| update 目标不存在、跨租户或已删除 | 404 | `not_found` | `记录不存在` |
| 租户内未删除连接名冲突 | 409 | `conflict` | `连接名称已存在` |
| repository 返回空更新 | 400 | `validation_failed` | `请求至少包含一个可更新字段` |
| 数据服务异常 | 503 | `service_unavailable` | `数据服务暂时不可用` |

错误响应不得包含内部异常 message、SQL、stack、数据库连接信息、`DATABASE_URL`、payload 原文、凭证明文或 raw HIS payload。

## create / update API 测试规划

后续测试 PR 建议覆盖：

- create 合法 payload 返回 `201` 和安全 DTO。
- update 合法 payload 返回 `200` 和安全 DTO。
- create / update 只把服务端 access context 的 `tenantId` 传给 repository。
- body / query / header 中的 `tenantId` 不生效。
- 未登录返回 `401`，不初始化数据库，不调用 repository。
- 无权限返回 `403`，不写业务数据。
- 权限模型未补齐时不得绕过 `canAccessResource`。
- 非 JSON body 返回 `400 validation_failed`。
- 未知字段和禁止字段返回 `400 validation_failed`。
- create 缺少四个安全字段之一返回 `400 validation_failed`。
- update 空对象返回 `400 validation_failed`。
- 敏感字段和敏感内容不写入、不返回、不写审计。
- update 空 `connectionId` 或不存在 / 跨租户 / 已软删除返回 `404 not_found`。
- repository `conflict` 映射为 `409 conflict`。
- repository `validation_failed` 映射为 `400 validation_failed`。
- repository 抛错映射为 `503 service_unavailable` 且不泄露内部错误。
- 成功写入和 allowed audit 在同一事务中完成。
- denied audit 不包含完整 payload 或凭证材料。
- API 不调用真实 HIS、不调用 fetch、不做测试连接。
- API 不创建治疗摘要、不创建随访任务、不自动触达。
- API 不修改 demo seed 数据。

## 后续 PR 拆分建议

建议拆分为小 PR，避免把权限、审计、凭证和真实 HIS 接入揉进 create / update API：

- PR 1：HTTP 载荷解析器和 parser 测试，只新增解析器与单元测试。
- PR 2：权限模型补强 Plan Mode，评估 `open_connection:create` 和 `open_connection:update`。
- PR 3：create / update API route 与服务层事务实现，不处理凭证、不接外部系统。
- PR 4：create / update API route 测试，覆盖权限、租户、错误映射、审计和 DTO 最小化。
- PR 5：pause / resume / revoke / delete 状态 API 规划与实现拆分。
- PR 6：审计 reason 补强和审计查询展示边界。
- PR 7：凭证管理 Plan Mode，包括凭证加密、轮换、撤销和 `credentialRef` 绑定。
- PR 8：测试连接 Plan Mode，包括健康检查、错误码降级和不保存外部响应全文。
- PR 9：真实 HIS adapter Plan Mode，包括租户绑定、幂等、重试、Webhook / 同步和人工复核。

## 当前验收清单

- 本文档明确当前 PR 只做 Plan Mode。
- 本文档明确不实现 API、route、服务层、repository、schema、权限、审计、凭证或测试连接。
- 本文档明确 create / update API 只处理 `connectionName`、`sourceSystem`、`vendorType`、`systemType`。
- 本文档明确 `tenantId` 只来自服务端 access context。
- 本文档明确严禁返回 `credentialRef`、token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串、raw HIS payload、完整请求体 / 响应体、SQL、stack、`DATABASE_URL`。
- 本文档规划 HTTP 载荷解析器、权限判断、服务层事务、审计写入、DTO 数据最小化、API 错误映射和 create / update API 测试。
- 本文档给出后续 PR 拆分建议。

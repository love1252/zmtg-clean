# Phase 23 HIS 连接配置写入 service v1 设计

> 日期：2026-06-04
> 状态：Phase 23 Plan Mode 文档。本 PR 只规划后续 HIS 连接配置 create / update API 的 service 层事务边界、repository 结果映射、审计写入边界、DTO 边界和 API 错误映射，不实现 service 代码，不新增 API route，不修改 parser、repository、权限、schema、migration、审计实现、凭证能力或真实 HIS 接入。

## 本次定位

本 PR 承接已合并链路：

- PR #129 已规划 HIS 连接配置 create / update API v1。
- PR #130 已完成写入 payload parser / DTO helper。
- PR #132 已完成 `tenant_admin` 的 `open_connection:create` 和 `open_connection:update` 最小权限模型。

当前仍缺少 create / update API 接入前的 service 层事务与错误映射规划。本 PR 只把后续 service 的职责、输入边界、事务边界、repository result 映射、审计写入边界、成功 DTO 和测试规划拆清楚。

本 PR 不进入运行时代码变更：

- 不新增或修改 `src/**`。
- 不写 service 代码。
- 不新增 API route。
- 不修改现有 API route。
- 不修改 parser。
- 不修改 repository。
- 不修改权限实现或权限测试。
- 不改 schema 或 migration。
- 不写审计实现。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存或返回真实凭证。
- 不返回 `credentialRef` 给前端 DTO。
- 不展示凭证明文。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要或随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。
- 不修改 `package.json` 或 lockfile。
- 不修改 `.codex`、Superpowers 缓存目录或技能文件。

## 只读检查结论

本次只读检查了当前 main、HIS 连接配置 parser / repository / 测试、权限模型、审计模型、邻近治疗摘要写入 API 风格和已合并文档：

- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-create-update-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-create-update-api-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-permission-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-permission-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

已确认的代码事实：

- 当前 main commit 为 `3a65928b89234bf4804e8f0a4075f997002bc50f`。
- HIS 连接配置写入 parser 已存在，只接受 `connectionName`、`sourceSystem`、`vendorType`、`systemType` 四个安全元数据字段。
- parser 已拒绝外部 `tenantId`、`connectionId`、状态字段、凭证字段、raw payload、完整请求 / 响应体、SQL、stack、`DATABASE_URL` 和敏感内容。
- `mapHisConnectionWriteMetadataToDto` 只返回四个安全元数据字段。
- repository 已存在 `createHisConnectionForTenant` 和 `updateHisConnectionForTenant`。
- repository create 固定写入 `draft` / `unknown`，绑定可信 `tenantId`，写入 `createdBy` / `updatedBy`，返回 `ok` / `conflict` / `validation_failed`。
- repository update 绑定 `tenantId + connectionId + deletedAt is null`，只更新四个安全元数据字段和 `updatedBy`，返回 `ok` / `not_found` / `conflict` / `validation_failed`。
- repository 抛错会转为脱敏错误，不暴露 SQL、stack、`DATABASE_URL` 或凭证材料。
- 权限模型已授予 `tenant_admin` `open_connection:read_own_tenant`、`open_connection:create` 和 `open_connection:update`。
- `tenant_operator`、`consultant`、`customer_service`、`platform_admin`、`platform_operator`、`security_auditor` 均未获得 `open_connection:create` 或 `open_connection:update`。
- 缺失 `tenantId` 时 `canAccessResource` 返回 `missing_tenant`；跨租户 `targetTenantId` 返回 `cross_tenant_denied`。
- 审计模型已支持 `resource: 'open_connection'` 与 `action: 'create' | 'update'` 的类型组合，但尚未补充 HIS 连接配置 payload 非法、连接名冲突等专用安全 reason。
- 现有治疗摘要写入 API 采用服务端 access context、parser 白名单、`canAccessResource`、事务内 repository 写入、事务内 audit、稳定错误响应和安全 DTO 的模式。

## 后续 service 目标

后续 service 最小实现应只承担 create / update API 写入编排，不扩展到状态流转、凭证、测试连接或真实 HIS。

service 目标：

- 组织 access context 中的可信 `tenantId`。
- 使用 access context 中的 `userId` 作为 actor。
- 接收 route path 中 trim 后的 `connectionId`，仅 update 使用。
- 接收 parser 输出的安全元数据。
- 调用既有 repository create / update 方法。
- 统一处理 repository result。
- 在成功路径写 allowed audit。
- 在拒绝路径规划 denied audit。
- 在同一事务中编排业务写入和 allowed audit。
- 生成最小成功 DTO 或 `{ ok: true }`。
- 输出 route 可稳定映射的结果，不把内部 exception message 或 repository 原始异常传给 API 响应。

service 不负责：

- 从 request 读取 JSON。
- 解析 body、query 或 header。
- 信任客户端提供的 `tenantId`。
- 绕过 `canAccessResource` 做角色硬编码。
- 创建 API route。
- 修改 repository、parser、schema 或权限。
- 管理凭证、测试连接、健康检查或真实 HIS adapter。
- 创建治疗摘要、随访任务或自动触达。

## service 输入边界

后续 service 输入只能来自服务端可信来源。

允许输入：

- `accessContext.tenantId`，且必须是非空字符串。
- `accessContext.userId`，作为 actor id。
- `accessContext.role`、`accessContext.scope`、`accessContext.source`，仅用于审计上下文。
- route path 中 trim 后的 `connectionId`，仅 update 使用。
- parser 输出的 `connectionName`、`sourceSystem`、`vendorType`、`systemType`。
- 已由 route 或 service 调用 `canAccessResource` 得到的权限决策。
- 事务数据库实例。
- 基于同一事务数据库实例创建的 HIS connection repository 和 audit repository。

禁止输入：

- body `tenantId`。
- query `tenantId`。
- header `tenantId`。
- localStorage `tenantId`。
- 外部 HIS payload 中的 `tenantId`。
- `credentialRef`。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串。
- raw HIS payload。
- 完整请求体。
- 完整响应体。
- SQL、stack、`DATABASE_URL`。
- `status`、`healthStatus`、`credentialConfigured`、`lastCheckedAt`、`lastErrorCode`。
- `createdAt`、`updatedAt`、`createdBy`、`updatedBy`、`revokedAt`、`deletedAt`。

如果 route 已经读取 request body，service 也只能接收 parser 的安全输出，不能接收原始 body 作为 debug、审计或错误映射材料。

## 权限与租户边界

create / update API 后续仍必须通过统一 `canAccessResource` 判断权限。

建议顺序：

1. route 从 request 获取服务端 access context。
2. 无 access context 时直接返回 `401 unauthorized`，不初始化写入 service。
3. route 或 service 使用 `canAccessResource` 判断 `open_connection:create` 或 `open_connection:update`。
4. access context 无 `tenantId` 时拒绝为 `403 forbidden`，审计 reason 使用 `missing_tenant`。
5. `targetTenantId` 必须来自 `accessContext.tenantId`。
6. create / update 不接受 body、query、header 或 localStorage 中的 `tenantId`。
7. platform scope v1 不引入代管写入。
8. 只有权限 allowed 后才允许进入业务写入事务。

## service 事务边界

create 事务建议：

1. 在 route 层完成登录、权限、JSON 读取和 parser 校验。
2. 开启数据库事务。
3. 在事务内创建 HIS connection repository 和 audit repository。
4. 调用 `createHisConnectionForTenant`，传入可信 `tenantId`、actorUserId 和 parser 输出字段。
5. repository 返回 `ok` 时，在同一事务中写 allowed audit。
6. allowed audit 写入成功后提交事务。
7. 返回 `201` 对应的最小成功结果。

update 事务建议：

1. 在 route 层完成登录、权限、path `connectionId` trim、JSON 读取和 parser 校验。
2. 空 `connectionId` 建议直接映射为 `404 not_found`，不暴露存在性。
3. 开启数据库事务。
4. 在事务内创建 HIS connection repository 和 audit repository。
5. 调用 `updateHisConnectionForTenant`，传入可信 `tenantId`、path `connectionId`、actorUserId 和 parser 输出字段。
6. repository 返回 `ok` 时，在同一事务中写 allowed audit。
7. allowed audit 写入成功后提交事务。
8. 返回 `200` 对应的最小成功结果。

repository 返回非 `ok` 时：

- `validation_failed`：不写业务数据；可规划 denied audit；映射为 `400 validation_failed`。
- `conflict`：不写业务数据；可规划 denied audit；映射为 `409 conflict`。
- `not_found`：不写业务数据；可规划 denied audit；映射为 `404 not_found`。
- thrown error：不写业务成功响应；不回显内部错误；映射为 `503 service_unavailable`。

审计失败时：

- v1 建议事务整体回滚。
- 不留下“业务写入成功但无审计”的状态。
- 不在错误响应中暴露审计写入异常 message、SQL、stack 或数据库连接信息。

事务内严禁：

- 调用真实 HIS。
- 调用 `fetch`。
- 做测试连接。
- 处理凭证或 `credentialRef`。
- 创建治疗摘要。
- 创建随访任务。
- 自动触达客户。
- 写 raw HIS payload。

## repository 结果映射

后续 service 应把 repository result 映射成 route 可消费的稳定结果。

| repository result | create HTTP | update HTTP | 响应 code | 响应 error | 说明 |
| --- | --- | --- | --- | --- | --- |
| `ok` | `201` | `200` | 不需要错误 code | 不需要错误文案 | 返回最小成功结果或安全元数据 |
| `validation_failed` | `400` | `400` | `validation_failed` | `请求格式不正确` 或 parser 安全文案 | repository 防御性校验失败，不回显输入 |
| `conflict` | `409` | `409` | `conflict` | `连接名称已存在` | 租户内未删除连接名冲突 |
| `not_found` | 不适用 | `404` | `not_found` | `记录不存在` | update 不存在、跨租户或已软删除统一处理 |
| thrown error | `503` | `503` | `service_unavailable` | `数据服务暂时不可用` | 不暴露内部异常 |

`not_found` 不得区分目标不存在、属于其他租户或已软删除。`conflict` 不得暴露数据库 constraint、索引名或冲突行信息。

## API 错误响应边界

错误响应可以返回稳定中文文案和稳定 code，但不得泄露：

- 内部 exception message。
- SQL。
- stack。
- `DATABASE_URL`。
- payload 原文。
- body / query / header 中的租户信息。
- 凭证明文。
- `credentialRef`。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串。
- raw HIS payload。
- 完整请求体。
- 完整响应体。
- 其他租户目标是否存在。
- repository command。
- transaction 内部状态。

建议错误响应：

| 场景 | HTTP 状态 | 响应 code | 响应 error |
| --- | --- | --- | --- |
| 未登录 | `401` | `unauthorized` | `请先登录` |
| 无权限或无租户上下文 | `403` | `forbidden` | `没有访问权限` |
| JSON 格式错误 | `400` | `validation_failed` | `请求格式不正确` |
| payload 非法 | `400` | `validation_failed` | parser 返回的安全中文错误 |
| repository `validation_failed` | `400` | `validation_failed` | `请求格式不正确` |
| update 目标不存在、跨租户或已删除 | `404` | `not_found` | `记录不存在` |
| 租户内未删除连接名冲突 | `409` | `conflict` | `连接名称已存在` |
| 数据服务异常 | `503` | `service_unavailable` | `数据服务暂时不可用` |

## 审计写入边界

成功审计：

- create 成功：`resource: 'open_connection'`，`action: 'create'`，`result: 'allowed'`。
- update 成功：`resource: 'open_connection'`，`action: 'update'`，`result: 'allowed'`。
- create 成功后如需要 `resourceId`，只能使用 repository 返回记录中的 `connectionId`，不得使用客户端提交的 id。
- update 成功后 `resourceId` 使用 path `connectionId` 或 repository 返回记录中的 `connectionId`，两者必须指向同一目标。
- reason 可使用权限 allowed decision 的 `allowed_by_policy`。

拒绝审计规划：

- 权限拒绝：建议写 denied audit，reason 使用 `role_denied`、`missing_tenant` 或 `cross_tenant_denied`。
- payload 非法：建议写 denied audit，但当前 `AuditReason` 尚无 HIS 连接配置 payload 专用 reason；需要后续审计 reason 补强。
- `not_found`：建议写 denied audit，reason 可评估复用 `not_found_or_not_owned`，不得暴露目标是否属于其他租户。
- `conflict`：建议写 denied audit，但当前 `AuditReason` 尚无 HIS 连接配置连接名冲突专用 reason；需要后续审计 reason 补强。
- repository `validation_failed`：建议写 denied audit，但需要安全 reason 补强，不能记录原始 values。

审计只允许记录：

- actor id。
- actor role。
- tenantId。
- scope。
- source。
- resource。
- resourceId。
- action。
- result。
- reason。
- occurredAt。

审计严禁记录：

- 完整 payload。
- 完整请求体。
- 完整响应体。
- body / query / header 中的 `tenantId`。
- `credentialRef`。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串。
- raw HIS payload。
- 外部系统错误全文。
- SQL、stack、`DATABASE_URL`。
- 完整病历、完整治疗正文、咨询全文、图片 / 文件原文。

## DTO 边界

create / update v1 成功响应只能选择以下两类之一。

方案一：最小安全元数据 DTO：

```json
{
  "record": {
    "connectionName": "星澜 HIS 连接",
    "sourceSystem": "his",
    "vendorType": "demo_vendor",
    "systemType": "his"
  }
}
```

方案二：最小完成信号：

```json
{
  "ok": true
}
```

v1 推荐优先使用方案二或仅返回四个安全元数据字段，避免 create / update 成功响应提前承诺只读详情 DTO。

成功响应不得返回：

- `connectionId`。
- `id`。
- `tenantId`。
- `status`。
- `credentialRef`。
- `credentialConfigured`。
- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `createdAt`。
- `updatedAt`。
- `createdBy`。
- `updatedBy`。
- `revokedAt`。
- `deletedAt`。
- actor 字段。
- repository read model。
- repository command。
- 原始 request body。

如后续产品需要 create 返回 `connectionId` 以便跳转详情，必须单独评审 DTO 扩展，不应混入 service 最小实现。

## 后续测试规划

service tests 建议先独立于 API route 测试完成：

- create ok：调用 repository create，写 allowed audit，返回 `created` 或最小成功结果。
- update ok：调用 repository update，写 allowed audit，返回 `updated` 或最小成功结果。
- service 使用 `accessContext.tenantId`，不接受外部 `tenantId`。
- create command 只包含 `tenantId`、actorUserId 和四个安全元数据字段。
- update command 只包含 `tenantId`、`connectionId`、actorUserId 和四个安全元数据字段的非空子集。
- repository `validation_failed` 映射为 `400 validation_failed`。
- repository `conflict` 映射为 `409 conflict`。
- repository `not_found` 映射为 `404 not_found`。
- repository thrown error 映射为 `503 service_unavailable`。
- allowed audit 使用 `open_connection`、`create` / `update`、`allowed`。
- denied audit 不包含 payload 原文、凭证、raw HIS payload、SQL、stack 或 `DATABASE_URL`。
- 成功 DTO 最小化，不返回 `tenantId`、`connectionId`、`status`、`credentialRef`、健康状态或时间字段。
- service 不调用真实 HIS。
- service 不调用 `fetch`。
- service 不做测试连接。
- service 不创建治疗摘要。
- service 不创建随访任务。
- service 不自动触达。

API route tests 后续应单独覆盖：

- 未登录不初始化 service。
- 权限拒绝不调用 service。
- body / query / header `tenantId` 不进入 service。
- parser 失败时不调用 service。
- service 稳定结果映射为 HTTP response。
- service thrown error 映射为 `503 service_unavailable`。

## 后续小步拆分建议

- service 最小实现。
- service tests。
- 审计 reason 补强。
- create / update API route Plan Mode 或实现。
- API route tests。
- pause / resume / revoke / delete API 权限 Plan Mode。
- 凭证管理 Plan Mode。
- 测试连接 Plan Mode。
- 真实 HIS adapter Plan Mode。

## 当前验收清单

- 本文档明确当前 PR 是 Plan Mode。
- 本文档明确只规划 service 边界，不实现代码。
- 本文档明确 service 输入只能来自服务端可信来源和 parser 输出。
- 本文档明确 service 不接受 body / query / header / localStorage `tenantId`。
- 本文档明确 service 不接受凭证、raw HIS payload、完整请求 / 响应体、SQL、stack 或 `DATABASE_URL`。
- 本文档规划 create / update 事务边界。
- 本文档规划 repository result 到 API 错误的映射。
- 本文档规划审计写入边界和审计 reason 补强缺口。
- 本文档规划 DTO 最小化边界。
- 本文档规划 service tests 和 API route tests 拆分。
- 本文档明确不新增 API、不改 route / service / repository / parser、不改权限、不改 schema / migration、不写审计实现、不处理凭证、不接真实 HIS。

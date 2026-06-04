# Phase 23 HIS 连接配置状态 API v1 设计

> 日期：2026-06-04
> 状态：Phase 23 Plan Mode 文档。本 PR 只规划后续 HIS 连接配置 pause / resume / revoke / delete 状态 API 的 API 边界、权限边界、service 边界、审计边界、DTO 边界和测试拆分，不新增 API route，不修改 `src/**`，不修改 service、parser、repository、权限、audit domain、schema 或 migration。

## 本次定位

当前 create / update API 主链路已基本闭环，本 PR 进入 Phase 23 的状态 API 规划：只为后续 pause、resume、revoke、delete / softDelete API 明确边界，不实现任何运行时代码。

本 PR 不进入：

- 不新增 route。
- 不修改现有 `GET / POST / PATCH`。
- 不修改 service。
- 不修改 parser。
- 不修改 repository。
- 不修改权限实现或权限测试。
- 不修改 audit domain、audit reason、query whitelist 或 audit repository。
- 不修改 schema / migration。
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
- 不引入新的 npm 依赖。

## 只读检查结论

本次从最新 `main` 执行只读检查，确认当前 commit 为：

```text
99b754a7eb02ee7b8d812364a59b2575e4cd7ac5
```

已检查范围：

- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- 已合并的 Phase 23 create / update API、route、service、权限和审计 reason 文档。
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

已确认的代码事实：

- 当前 HIS 连接配置 route 已有 `GET /api/institution/his-connections`、`POST /api/institution/his-connections`、`GET /api/institution/his-connections/[connectionId]` 和 `PATCH /api/institution/his-connections/[connectionId]`。
- 当前尚未存在 pause / resume / revoke / delete 状态 API route。
- 写入 parser 已只接受 create / update 的安全元数据字段，不覆盖状态 API。
- create / update service 已返回 `{ ok: true }`，并在成功路径和 repository 失败路径写安全 audit。
- 权限模型中 `tenant_admin` 目前具备 `open_connection:read_own_tenant`、`open_connection:create` 和 `open_connection:update`；尚未为 `open_connection` 授予 `delete` 或 `manage_status`。
- `ACCESS_ACTIONS` 已有 `delete` 和 `manage_status`，但没有 `pause`、`resume`、`revoke` 这类细分 action。
- audit action 类型复用 `ProtectedAction`，因此当前 audit domain 也不能直接记录 `action: 'pause' | 'resume' | 'revoke'`，除非后续单独扩展权限 / audit action 类型。
- `AuditReason` 已包含 `invalid_transition`、`not_found_or_not_owned`、`invalid_his_connection_payload` 和 `his_connection_name_conflict`，但尚未有状态 API 专用 reason。
- 只读搜索未发现已经存在的状态 API 专用 route 或状态 API 专用 plan；已有内容主要集中在 repository 状态方法和早期生命周期规划。

现有 repository 已具备状态方法：

- `pauseHisConnectionForTenant`
- `resumeHisConnectionForTenant`
- `revokeHisConnectionForTenant`
- `softDeleteHisConnectionForTenant`

## API 路径规划

后续状态 API v1 建议先评估以下路径：

| 状态操作 | 推荐 HTTP 路径 | 推荐方法 | 说明 |
| --- | --- | --- | --- |
| pause | `POST /api/institution/his-connections/[connectionId]/pause` | `POST` | 状态动作不是资源局部更新字段，独立子路径可减少和 metadata `PATCH` 混淆。 |
| resume | `POST /api/institution/his-connections/[connectionId]/resume` | `POST` | 与 pause 对称，保持明确动作语义。 |
| revoke | `POST /api/institution/his-connections/[connectionId]/revoke` | `POST` | revoke 是不可逆生命周期动作，不等同于 metadata `PATCH`。 |
| delete / softDelete | `DELETE /api/institution/his-connections/[connectionId]` | `DELETE` | 与现有 detail route 组织适配，语义上表达对连接配置资源执行软删除。 |

`DELETE /api/institution/his-connections/[connectionId]` 与现有 route 组织适配：同一资源的 `GET / PATCH / DELETE` 可共用 `[connectionId]/route.ts`。v1 仍必须明确 softDelete，不做物理删除，不删除外部系统数据。

如果后续认为 `DELETE` 携带可选 `reasonCode` 的 body 在客户端、测试或审计上不稳定，可以评估替代方案：

```text
POST /api/institution/his-connections/[connectionId]/delete
```

替代方案的代价是 HTTP 语义较弱，并且会让四个状态动作全部变成 action subroute。是否采用替代方案必须在 route Plan Mode 或实现 PR 中说明原因；本轮推荐先保留 `DELETE`。

## 可信输入边界

状态 API 只允许接收以下可信输入：

- `accessContext.tenantId`。
- `accessContext.userId`，作为 actor。
- `accessContext.role`、`accessContext.scope`、`accessContext.source`，仅用于权限和审计上下文。
- route path 中 trim 后的 `connectionId`。
- 可选 `reasonCode`。如 v1 接收，必须是安全枚举或短字符串，建议长度不超过 repository 当前 `reasonCode` 限制，并由 parser 白名单或安全正则约束。

状态 API 不接受以下租户来源：

- body `tenantId`。
- query `tenantId`。
- header `tenantId`。
- localStorage `tenantId`。
- 外部 HIS payload 中的 `tenantId`。

如果 v1 选择支持可选 body，只能接受如下最小 JSON object：

```json
{ "reasonCode": "manual_pause" }
```

body 缺失应等价于无 `reasonCode`。body 不是 object、含未知字段、含敏感字段、`reasonCode` 为空、过长或不符合安全枚举时，统一返回 `validation_failed`。route、service、audit 和 error response 都不得保存或回显原始 body。

## 禁止接收或透传的内容

状态 API、状态 service、审计事件、错误响应和测试 fixture 都不得接受、透传、记录或返回：

- `credentialRef`
- `credentialConfigured`
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
- 完整治疗正文
- 完整病历正文
- 咨询全文
- 图片 / 文件原文

revoke 不处理凭证撤销，不删除凭证明文，不接凭证管理。delete 不物理删除，不接真实 HIS，不删除外部系统数据。

## 权限边界

pause / resume / revoke / delete 不得复用 `open_connection:read_own_tenant`。

后续权限方案需要单独 Plan Mode 或最小权限实现 PR 评审，不得在 route 实现 PR 中顺手扩大权限模型。候选方案如下：

| 候选方案 | 覆盖范围 | 优点 | 风险 |
| --- | --- | --- | --- |
| 复用 `open_connection:update` | pause / resume / revoke / delete 都使用 update | 改动最小，create / update 链路已有权限 | 会把 metadata 更新和生命周期状态动作混在一起，delete 语义过宽，不推荐作为默认选择。 |
| 使用现有 `open_connection:manage_status` 和 `open_connection:delete` | pause / resume / revoke 使用 `manage_status`，delete 使用 `delete` | 复用现有 action 枚举，语义比 update 更清晰 | 仍无法在权限层区分 pause、resume、revoke 三个动作。 |
| 新增细分权限 `open_connection:pause`、`open_connection:resume`、`open_connection:revoke`、`open_connection:delete` | 四个状态 API 各自独立 | 最清晰，便于未来精细授权 | 需要扩展 `ACCESS_ACTIONS`、权限测试、audit action 查询白名单和相关类型，改动面更大。 |

本轮建议：

- 先进入状态 API 权限 Plan Mode，优先评估 `manage_status + delete` 的最小复用策略。
- 如产品明确需要细分授权，再新增 `pause / resume / revoke / delete` 四个 action。
- 无论采用哪种方案，v1 默认只允许 `tenant_admin`。
- `tenant_operator`、`consultant`、`customer_service`、`platform_admin`、`platform_operator`、`security_auditor` 默认不允许。
- 平台代管写入不进入 v1。

## 状态流转边界

状态流转以当前 repository 约束为准。API 和 service 不应在 route 层重写状态机。

| 操作 | 当前 repository 允许 | 当前 repository 稳定拒绝 | 副作用边界 |
| --- | --- | --- | --- |
| pause | `active` / `error` -> `paused` | 已 `paused` 返回 `conflict`；`draft` / `revoked` / `deleted` 返回稳定拒绝或不可见 | 只写 `status`、`updatedAt`、`updatedBy`。不测试连接，不刷新健康状态。 |
| resume | `paused` -> `active` | 已 `active` 返回 `conflict`；`draft` / `error` / `revoked` / `deleted` 返回稳定拒绝或不可见 | 只写 `status`、`updatedAt`、`updatedBy`。不测试连接，不刷新健康状态。 |
| revoke | `draft` / `active` / `paused` / `error` -> `revoked` | 已 `revoked` 返回 `conflict`；已 `deleted` 不可见 | 写 `status`、`revokedAt`、`updatedAt`、`updatedBy`。不撤销凭证，不调用外部系统。 |
| delete / softDelete | `draft` / `active` / `paused` / `revoked` / `error` -> `deleted` | 已 `deleted` 不可见或稳定拒绝 | 写 `status`、`deletedAt`、`updatedAt`、`updatedBy`。不硬删，不删除外部系统数据。 |

稳定错误边界：

- 已 deleted、跨租户、不存在统一返回 `not_found`，不暴露目标存在性。
- revoked 在 pause / resume / revoke / delete 中按上表进入稳定响应：pause / resume 可映射 `invalid_transition`，重复 revoke 可映射 `conflict`，delete 可执行 softDelete。
- `conflict` 和 `invalid_state_transition` 均映射到 HTTP `409`，但 response code 应稳定区分为 `conflict` 与 `invalid_transition`。
- route 不得通过先读详情再判断状态来暴露跨租户、已删除或不存在差异。

## service 边界

后续建议先做状态 service Plan Mode 或状态 service 最小实现，再接 API route。

状态 service 职责：

- 接收 route 已解析的 access context。
- 从 access context 取可信 `tenantId`。
- 从 access context 取 `userId` 作为 actor。
- 接收 path `connectionId`。
- 接收 parser 输出的可选 `reasonCode`。
- 调用对应 repository 状态方法。
- 映射 repository result 为 route 可消费的稳定 service result。
- 在成功路径写 allowed audit。
- 在 repository 非 ok 结果写安全 denied audit。
- 审计失败时返回稳定 `service_unavailable`，避免业务成功但无审计。

route 职责：

- 获取 access context。
- 判断 401。
- 执行权限判断。
- 解析 path `connectionId`。
- 解析可选最小 body。
- 调用状态 service。
- 做 HTTP 映射。

route 不应直接调用 repository 状态方法，除非后续实现 PR 明确说明项目现有模式要求这样做。若必须直接调用 repository，需要在文档中说明风险和拆分方案：

- route 会承担过多事务与审计职责。
- route 容易重复 repository result 映射。
- route 容易遗漏 allowed / denied audit。
- route 容易在实现状态 API 时顺手扩大权限模型。

## 审计边界

状态 API 的审计语义目标如下：

| 场景 | resource | action 语义 | result |
| --- | --- | --- | --- |
| pause 成功 | `open_connection` | `pause` | `allowed` |
| resume 成功 | `open_connection` | `resume` | `allowed` |
| revoke 成功 | `open_connection` | `revoke` | `allowed` |
| delete 成功 | `open_connection` | `delete` 或 `soft_delete` | `allowed` |

当前代码中 audit action 类型来自 `ProtectedAction`，还不能直接表达 `pause / resume / revoke / soft_delete`。后续必须在权限 / audit Plan Mode 中二选一：

- 扩展 action 类型和查询白名单，让 audit 直接记录 `pause / resume / revoke / delete`。
- 或者先使用现有 `manage_status` 表达 pause / resume / revoke，使用 `delete` 表达 softDelete，并在 reason 或文档中保留语义说明。

denied audit 边界：

- 权限拒绝复用 `role_denied`、`missing_tenant`、`cross_tenant_denied`。
- 目标不可见复用 `not_found_or_not_owned`。
- `invalid_transition` / `conflict` 是否新增 HIS 状态 API 专用 reason，需要单独评审。
- 本 PR 不新增 audit reason。
- 本 PR 不实现 audit 写入。

route denied audit 规划：

- 有 access context 但权限拒绝时，可在 route 层写 denied audit。
- path `connectionId` 可作为 `resourceId`。
- 未登录 `401` 可不写 tenant audit。
- 空 `connectionId` 可直接返回 `not_found`，不写 audit。
- 不记录 body / query / header `tenantId`。
- 不记录 payload 原文或禁止字段值。

service audit 规划：

- 成功路径写 allowed audit。
- repository `not_found` 写 denied audit，reason 复用 `not_found_or_not_owned`。
- repository `validation_failed` 写 denied audit，reason 可复用 `invalid_his_connection_payload` 或单独评审。
- repository `conflict` / `invalid_state_transition` 写 denied audit 的 reason 需要单独评审。
- repository thrown error 不写 denied audit，直接返回 `service_unavailable`，避免内部异常进入审计。

## HTTP 映射

成功响应推荐统一 `{ "ok": true }`，贴近 create / update API 成功 DTO。`204` 无 body 可作为备选，但 v1 不推荐，避免前端对不同 HIS 写入 API 形成两套成功处理。

| 场景 | HTTP | response code | 响应体 |
| --- | --- | --- | --- |
| 成功 | `200` | 无错误 code | `{ "ok": true }` |
| 未登录 | `401` | `unauthorized` | `{ "code": "unauthorized", "error": "请先登录" }` |
| 无权限 | `403` | `forbidden` | `{ "code": "forbidden", "error": "没有访问权限" }` |
| payload 或 path 校验失败 | `400` | `validation_failed` | `{ "code": "validation_failed", "error": "请求格式不正确" }` |
| 不存在、跨租户、已删除 | `404` | `not_found` | `{ "code": "not_found", "error": "记录不存在" }` |
| 重复动作或状态冲突 | `409` | `conflict` | `{ "code": "conflict", "error": "状态已变更" }` |
| 非法状态流转 | `409` | `invalid_transition` | `{ "code": "invalid_transition", "error": "当前状态不允许执行该操作" }` |
| 数据服务或审计失败 | `503` | `service_unavailable` | `{ "code": "service_unavailable", "error": "数据服务暂时不可用" }` |

错误响应不得回显：

- 原始 request body。
- parser 细节。
- repository result 原始对象。
- SQL、stack、`DATABASE_URL`。
- 连接名冲突细节、数据库 constraint 或索引名。
- 凭证、连接串或 raw HIS payload。
- 跨租户目标是否真实存在。

## DTO 边界

成功响应优先：

```json
{ "ok": true }
```

成功响应不得返回：

- `connectionId`
- `tenantId`
- `status`
- `credentialRef`
- `credentialConfigured`
- `healthStatus`
- `lastCheckedAt`
- `lastErrorCode`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `revokedAt`
- `deletedAt`
- repository read model
- 原始 request body

## 测试规划摘要

后续状态 API route / service 测试至少覆盖：

- pause 成功。
- resume 成功。
- revoke 成功。
- delete / softDelete 成功。
- 未登录返回 `401`。
- 无权限返回 `403`。
- body / query / header `tenantId` 注入无效。
- 空 `connectionId` 返回 `not_found`。
- not_found 不暴露跨租户、已删除、不存在差异。
- invalid transition / conflict 映射为稳定 `409`。
- service unavailable 映射为 `503`。
- route denied audit。
- allowed audit。
- DTO 最小化。
- 不调用真实 HIS。
- 不调用 `fetch`。
- 不做测试连接。
- 不处理凭证。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达。
- 不修改 demo seed。

需要覆盖的敏感字段禁区：

- `credentialRef`
- `credentialConfigured`
- token / secret / API key
- OAuth token / basic auth
- 签名密钥 / 私钥 / 连接串
- raw HIS payload
- 完整请求体 / 完整响应体
- SQL / stack / `DATABASE_URL`
- 完整治疗正文 / 完整病历正文 / 咨询全文
- 图片 / 文件原文

## 后续拆分建议

建议继续小步拆分：

- PR S1：状态 API Plan Mode，也就是当前 PR。
- PR S2：状态 API 权限 Plan Mode 或权限最小实现。
- PR S3：状态 service Plan Mode。
- PR S4：状态 service 最小实现。
- PR S5：pause / resume API route 最小实现。
- PR S6：revoke / delete API route 最小实现。
- PR S7：状态 API route tests。
- PR S8：状态 API 审计补强。
- PR S9：状态 API 文档收尾。
- 后续再进入凭证管理 Plan Mode。

每个实现 PR 都必须保持单一职责。任何涉及凭证、测试连接、真实 HIS、schema、权限模型扩展、audit reason 扩展或 UI 写入入口的需求，都必须单独进入 Plan Mode。

## 停止条件

后续任何 PR 如出现以下需要，必须停止并拆分：

- 需要新增或修改 schema / migration。
- 需要保存、返回或展示 `credentialRef` 或凭证明文。
- 需要接入凭证管理、凭证撤销、凭证轮换或测试连接。
- 需要调用真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 需要保存 raw HIS payload、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 需要做患者身份匹配。
- 需要自动创建治疗摘要或随访任务。
- 需要修改 demo seed 数据。
- 需要扩大平台代管写入。
- 需要在 route 实现 PR 中顺手修改权限模型或 audit action / reason。

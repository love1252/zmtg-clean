# Phase 23 HIS 连接配置状态 service v1 设计

> 日期：2026-06-04
> 状态：Phase 23 Plan Mode 文档。本 PR 只规划后续 HIS 连接配置 pause / resume / revoke / delete / softDelete 状态 service，不新增 service 代码，不新增 API route，不修改 `src/**`、parser、repository、权限、audit domain、schema、migration、凭证、测试连接或真实 HIS 能力。

## 本次定位

本 PR 聚焦 **HIS 连接配置状态 service v1 规划**。此前状态 API 已明确推荐路径和 DTO 边界，状态权限已明确 v1 使用 `open_connection:manage_status` 与 `open_connection:delete`。本轮只规划 route 与 repository 之间的状态 service 编排，不实现运行时代码。

本 PR 不进入：

- 不修改 `src/**`。
- 不新增 service。
- 不新增 API route。
- 不修改现有 GET / POST / PATCH。
- 不修改 parser。
- 不修改 repository。
- 不修改权限实现或权限测试。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不修改 schema / migration。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 不保存或返回真实凭证、raw HIS payload、完整病历、完整治疗正文、咨询全文、图片或文件原文。
- 不自动创建治疗摘要或随访任务。
- 不修改 demo seed 数据。
- 不修改 `package.json` 或 lockfile。
- 不修改 `.env*`、`.codex`、Superpowers 缓存目录或技能文件。

如果后续发现状态 service 必须同时扩展 schema、audit action、audit reason、权限枚举、凭证撤销、测试连接或真实 HIS adapter，必须停止 service 实现并拆独立 Plan Mode。

## 只读检查结论

本次从最新 `main` 执行只读检查，确认当前 commit 为：

```text
f4617a1855010a6c5c2a9bd31ef224b8e42dde18
```

已检查范围：

- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-api-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-permission-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-permission-v1.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

已执行用户指定状态 service 术语只读搜索；该普通 `grep` 命令未返回匹配行。

已确认的代码事实：

- 当前尚未存在 HIS 连接配置状态 service。
- 当前 create / update service 已在事务内编排 repository 写入与 audit 写入，并返回 `{ ok: true }` 最小成功 DTO。
- 当前 create / update service 对缺失可信 tenant / actor / connectionId 使用稳定 `validation_failed`。
- 当前 create / update service 对 repository thrown error 与 audit 写入失败均返回 `service_unavailable`。
- 当前 repository 已具备 `pauseHisConnectionForTenant`、`resumeHisConnectionForTenant`、`revokeHisConnectionForTenant` 和 `softDeleteHisConnectionForTenant`。
- 当前 repository 状态命令类型只需要 `tenantId`、`connectionId`、`actorUserId` 和可选 `reasonCode`。
- 当前 repository 状态方法返回 `ok`、`not_found`、`conflict`、`invalid_state_transition`、`validation_failed`。
- 当前 repository 不调用真实 HIS，不处理凭证，不做测试连接，不写 audit。
- 当前权限模型中 `tenant_admin` 已具备 `open_connection:read_own_tenant`、`create`、`update`、`manage_status` 和 `delete`。
- 当前 `ACCESS_ACTIONS` 未新增 `pause`、`resume`、`revoke` 或 `soft_delete`。
- 当前 audit action 类型复用 `ProtectedAction`，可记录 `manage_status` 与 `delete`，不可直接记录 `pause`、`resume`、`revoke` 或 `soft_delete`。

## 状态 service 范围

状态 service v1 只覆盖：

- pause
- resume
- revoke
- delete / softDelete

推荐导出函数：

- `pauseHisConnectionForTenantService`
- `resumeHisConnectionForTenantService`
- `revokeHisConnectionForTenantService`
- `softDeleteHisConnectionForTenantService`

命名说明：

- service 函数名保留 `ForTenant`，强调可信 `tenantId` 来自服务端 access context。
- delete 对外可对应 HTTP `DELETE`，service 与 repository 层仍使用 `softDelete`，避免误解为物理删除。
- revoke 不处理凭证撤销，只处理连接配置状态。

## service 输入边界

状态 service 只接收后端可信输入：

- `accessContext`。
- route path 中已解析的 `connectionId`。
- database 或 transaction entry。
- repository factory 或 repository instance。
- audit repository factory 或 audit repository instance。
- 可选 `reasonCode`，且只能来自后续 parser / route 的安全解析结果。

`accessContext` 中只使用：

- `tenantId`，作为唯一可信租户来源。
- `userId`，作为 actor。
- `role`、`scope`、`source`，仅用于审计上下文或错误上下文，不作为重新授权替代品。

状态 service 不接受：

- body `tenantId`。
- query `tenantId`。
- header `tenantId`。
- localStorage `tenantId`。
- raw request。
- raw response。
- 完整 body。
- `credentialRef`。
- `credentialConfigured`。
- token。
- secret。
- API key。
- OAuth token。
- basic auth。
- 签名密钥。
- 私钥。
- 连接串。
- raw HIS payload。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片或文件原文。

后续 route 已执行 `canAccessResource` 后再调用 service。service 不重复做角色策略判断，但必须防御性拒绝缺失 `tenantId`、缺失 actor 或缺失 `connectionId`，建议沿用 create / update service 的稳定 `validation_failed`。

## repository 调用边界

状态 service 对 repository 的调用必须一一对应：

| service 函数 | repository 方法 | 权限 action | audit action |
| --- | --- | --- | --- |
| `pauseHisConnectionForTenantService` | `pauseHisConnectionForTenant` | `manage_status` | `manage_status` |
| `resumeHisConnectionForTenantService` | `resumeHisConnectionForTenant` | `manage_status` | `manage_status` |
| `revokeHisConnectionForTenantService` | `revokeHisConnectionForTenant` | `manage_status` | `manage_status` |
| `softDeleteHisConnectionForTenantService` | `softDeleteHisConnectionForTenant` | `delete` | `delete` |

repository command 只允许包含：

- `tenantId`
- `connectionId`
- `actorUserId`
- 可选 `reasonCode`

repository command 不得包含：

- 客户端传入的 `tenantId`
- 客户端传入的 status
- 客户端传入的 health status
- 客户端传入的时间字段
- 凭证字段或凭证引用
- raw request body
- raw HIS payload
- 外部系统响应
- read model

service 不应直接拼接 SQL，不应绕过 repository，不应在 route 中直接调用 repository 状态方法。route 到 repository 之间应优先保留状态 service，以集中处理事务、审计、稳定结果映射和 DTO 边界。

## 事务边界

每个状态 service 调用应在一个事务内完成：

1. 调用对应 repository 状态方法。
2. 对 `ok` 写 allowed audit。
3. 对需要审计的稳定非 ok 结果写 denied audit。
4. 事务成功后返回稳定 service result。

约束：

- repository 写入和 allowed / denied audit 必须同事务。
- audit 写入失败时返回 `service_unavailable`。
- audit 写入失败不得返回业务成功。
- repository thrown error 返回 `service_unavailable`。
- repository thrown error 不写带异常细节的 audit。
- service 不把 stack、SQL、`DATABASE_URL`、完整错误对象或外部系统响应写入 audit 或响应。
- service 不调用真实 HIS，不调用 fetch，不做测试连接，不处理凭证，不创建治疗摘要或随访任务。

## allowed audit 边界

状态 service 成功后写 allowed audit：

| 操作 | resource | action | result | reason | resourceId |
| --- | --- | --- | --- | --- | --- |
| pause | `open_connection` | `manage_status` | `allowed` | `allowed_by_policy` | `connectionId` |
| resume | `open_connection` | `manage_status` | `allowed` | `allowed_by_policy` | `connectionId` |
| revoke | `open_connection` | `manage_status` | `allowed` | `allowed_by_policy` | `connectionId` |
| delete / softDelete | `open_connection` | `delete` | `allowed` | `allowed_by_policy` | `connectionId` |

allowed audit 不得包含：

- `credentialRef`
- `credentialConfigured`
- token / secret / API key / OAuth / basic auth
- raw request body
- raw HIS payload
- 外部系统响应
- SQL
- stack
- `DATABASE_URL`
- 完整治疗、病历、咨询正文
- 图片或文件原文

audit metadata 如需记录操作种类，应先评估是否需要安全短字段；当前 PR 不新增 audit domain、reason、query whitelist 或 audit repository。

## denied audit 边界

状态 service 对 repository 稳定非 ok 结果的 denied audit 建议如下：

| repository result | service result | denied reason 规划 | 说明 |
| --- | --- | --- | --- |
| `not_found` | `not_found` | `not_found_or_not_owned` | 不存在、跨租户、已删除统一不可见。 |
| `conflict` | `conflict` | `invalid_transition` | 状态 API 中 conflict 本质为当前状态不适合重复或继续执行该生命周期动作，v1 先复用既有 `invalid_transition`，不新增 status conflict reason。 |
| `invalid_state_transition` | `invalid_transition` | `invalid_transition` | repository 结果命名与 service 结果命名需要映射。 |
| `validation_failed` | `validation_failed` | `invalid_his_connection_payload` | 状态 service 只接收安全解析后的 path / reasonCode / access context；validation failed 复用既有 HIS payload / input 非法 reason，不记录 payload 原文。 |

额外约束：

- repository thrown error 不写 denied audit。
- audit 失败返回 `service_unavailable`。
- route 权限拒绝的 denied audit 不由状态 service 负责，应由 route / access layer 按权限决策写入。
- parser 失败的 denied audit 是否进入 route 层，需要后续 route PR 独立确认。
- 当前 PR 不新增 audit action、reason、query whitelist 或 audit repository。
- 状态 service audit reason 映射已由 `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-audit-reason-v1-design.md` 收敛；如果后续产品需要区分“重复动作冲突”和“非法流转”，再单独进入 audit reason / query whitelist 增强 PR。

## service result 规划

状态 service v1 推荐稳定结果：

- `paused`
- `resumed`
- `revoked`
- `deleted`
- `validation_failed`
- `not_found`
- `conflict`
- `invalid_transition`
- `service_unavailable`

现有 repository 使用 `invalid_state_transition`。后续 service 实现必须把 repository 的 `invalid_state_transition` 映射为 service 的 `invalid_transition`，不要凭空在 repository 运行时类型中发明新值。

HTTP 映射由 route 负责，service 可提供稳定 code：

| service result | HTTP | 响应边界 |
| --- | --- | --- |
| `paused` | 200 | `{ "ok": true }` |
| `resumed` | 200 | `{ "ok": true }` |
| `revoked` | 200 | `{ "ok": true }` |
| `deleted` | 200 | `{ "ok": true }` |
| `validation_failed` | 400 | 不回显原始 body 或敏感字段 |
| `not_found` | 404 | 不暴露跨租户或已删除差异 |
| `conflict` | 409 | 不返回完整 read model |
| `invalid_transition` | 409 | 不返回完整 read model |
| `service_unavailable` | 503 | 不返回 stack、SQL、外部错误或凭证 |

## DTO 边界

状态 API 成功响应优先：

```json
{ "ok": true }
```

成功响应不返回：

- `connectionId`
- `id`
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
- actor 字段
- repository read model
- repository command
- raw request body
- 外部系统响应

错误响应也不得泄露连接是否属于其他租户、是否已删除、凭证是否配置、真实 HIS 连接状态、SQL、stack、`DATABASE_URL`、完整请求体或外部错误全文。

## 状态流转边界

service 只编排状态写入，不在 service 中重写 repository 状态机。

| 操作 | 当前 repository 允许 | service 处理 |
| --- | --- | --- |
| pause | `active` / `error` -> `paused` | 返回 `paused`，写 `manage_status` allowed audit。 |
| resume | `paused` -> `active` | 返回 `resumed`，写 `manage_status` allowed audit。 |
| revoke | `draft` / `active` / `paused` / `error` -> `revoked` | 返回 `revoked`，写 `manage_status` allowed audit；不处理凭证撤销。 |
| delete / softDelete | 未删除状态 -> `deleted` | 返回 `deleted`，写 `delete` allowed audit；只 softDelete。 |

delete 只 softDelete：

- 不物理删除数据库记录。
- 不删除外部系统数据。
- 不调用真实 HIS。
- 不删除凭证。
- 不修改 demo seed。

revoke 不处理凭证撤销：

- 不删除凭证。
- 不吊销 OAuth token。
- 不调用外部 HIS。
- 不调用机构系统。
- 不做测试连接。

## 测试规划

后续状态 service 最小实现测试建议覆盖：

- pause 成功：调用 `pauseHisConnectionForTenant`，写 `manage_status` allowed audit，返回 `{ ok: true }` 对应的成功 result。
- resume 成功：调用 `resumeHisConnectionForTenant`，写 `manage_status` allowed audit。
- revoke 成功：调用 `revokeHisConnectionForTenant`，写 `manage_status` allowed audit，不处理凭证撤销。
- delete 成功：调用 `softDeleteHisConnectionForTenant`，写 `delete` allowed audit，只 softDelete。
- `not_found`：返回稳定 not found，并写 `not_found_or_not_owned` denied audit。
- `conflict`：返回稳定 conflict，并写 `invalid_transition` denied audit。
- `invalid_state_transition`：映射为 `invalid_transition`，HTTP 规划为 409。
- `validation_failed`：返回稳定 validation failed，并写 `invalid_his_connection_payload` denied audit。
- repository thrown error：返回 `service_unavailable`，不写包含异常细节的 audit。
- audit 写入失败：返回 `service_unavailable`。
- 缺失 `tenantId`：返回 `validation_failed`，不调用 repository。
- 缺失 actor：返回 `validation_failed`，不调用 repository。
- 缺失 `connectionId`：返回 `validation_failed`，不调用 repository。
- repository command 只包含 `tenantId`、`connectionId`、`actorUserId`、可选 `reasonCode`。
- 成功 DTO 只为 `{ ok: true }`。
- 不调用 fetch。
- 不调用真实 HIS。
- 不做测试连接。
- 不接机构系统、企微、AI、RAG、Agent 或自动触达。
- 不处理凭证。
- 不创建治疗摘要或随访任务。
- 不修改 demo seed。

## 后续拆分建议

建议后续小步拆分：

1. S4：状态 service 最小实现，覆盖 pause / resume / revoke / softDelete service、事务、allowed audit、稳定 result 和 service tests。
2. S5：pause / resume route 最小实现，接入权限、parser、service result 映射和 route tests。
3. S6：revoke / delete route 最小实现，确认 revoke 不处理凭证撤销，delete 只 softDelete。
4. S7：状态 API route tests 补齐权限拒绝、parser 失败、DTO、not found、conflict、invalid transition 和 service unavailable。
5. S8：如状态冲突或 validation reason 不足，单独评估 audit reason / query whitelist 补强。
6. S9：状态 API 文档收尾。
7. 后续独立规划凭证管理、凭证撤销、测试连接、真实 HIS adapter、机构系统、企微、AI / RAG / Agent、自动触达、治疗摘要和随访任务。

## 当前验收清单

- [x] 明确状态 service 范围仅包含 pause / resume / revoke / delete / softDelete。
- [x] 明确推荐导出函数。
- [x] 明确 service 只接收可信 access context、path `connectionId`、database / transaction、repository / audit repository 和安全 `reasonCode`。
- [x] 明确 service 不接收 body / query / header / localStorage `tenantId`。
- [x] 明确 service 不接收凭证、raw HIS payload、SQL、stack、`DATABASE_URL` 或完整治疗 / 病历 / 咨询正文。
- [x] 明确 repository 方法一一对应。
- [x] 明确 repository command 最小字段。
- [x] 明确 route 不应直接调用 repository 状态方法。
- [x] 明确 repository 写入与 allowed / denied audit 同事务。
- [x] 明确 audit 失败和 repository thrown error 返回 `service_unavailable`。
- [x] 明确 allowed audit 使用 `manage_status` 与 `delete`。
- [x] 明确 denied audit 的 not found、conflict、invalid transition 和 validation failed reason 边界。
- [x] 明确 service result 与 HTTP 映射参考。
- [x] 明确成功响应只返回 `{ ok: true }`。
- [x] 明确 revoke 不处理凭证撤销。
- [x] 明确 delete 只 softDelete。
- [x] 明确测试规划和后续拆分。

# Phase 23 HIS 连接配置状态 API route denied audit v1 设计

> 日期：2026-06-05
> 状态：Phase 23 Plan Mode 文档。本 PR 只规划后续 HIS 连接配置状态 API route 层 denied audit 补强，不实现代码，不修改 `src/**`，不新增 API，不修改 route、status service、parser、repository、权限、audit domain、schema、migration、凭证、测试连接或真实 HIS 能力。

## 本次定位

本轮只收敛状态 API route 层的 denied audit 口径，面向后续实现 PR 明确哪些拒绝发生在 route 层、哪些失败继续由 status service 负责，避免状态 API 出现审计遗漏或重复审计。

本 PR 不进入：

- 不写代码。
- 不修改 `src/**`。
- 不新增 API route。
- 不修改现有 route。
- 不修改 status service。
- 不修改 parser。
- 不修改 repository。
- 不修改权限实现或权限测试。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不修改 schema / migration。
- 不新增 audit reason。
- 不新增 audit action。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存或返回真实凭证。
- 不修改 demo seed 数据。

如果后续发现 route denied audit 必须新增 audit reason、细分 action、schema、权限枚举、凭证撤销、测试连接或真实 HIS adapter，必须停止实现并拆独立 Plan Mode。

## 只读检查结论

本次从最新 `main` 执行只读检查，确认当前 main commit 为：

```text
358392bc48066f53a96cecbda8d040c6d469a1c5
```

已执行基础检查：

```bash
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git status --short
```

检查结论：

- `git rev-parse HEAD` 等于 `358392bc48066f53a96cecbda8d040c6d469a1c5`。
- `git rev-parse origin/main` 等于 `358392bc48066f53a96cecbda8d040c6d469a1c5`。
- 建分支前工作区干净。

已只读检查：

- `src/app/api/institution/his-connections/[connectionId]/pause/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/resume/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/revoke/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/app/api/institution/his-connections/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/server/his-connection-status-service.ts`
- `src/modules/institution/tests/HisConnectionStatusService.test.ts`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- 前序 Phase 23 状态 API、状态权限、状态 service、状态 service audit reason 文档。
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

已确认代码事实：

- pause / resume / revoke route 已存在，均使用 `open_connection:manage_status` 做权限判断。
- DELETE route 已存在，使用 `open_connection:delete` 做权限判断。
- 状态 route 当前顺序为先 trim path `connectionId`，空 ID 返回 `404 not_found`，再读取 access context，未登录返回 `401 unauthorized`，再做权限判断，权限允许后读取安全 JSON body 并调用 status service。
- 状态 route 当前 body 只允许可选 `reasonCode`，malformed JSON、未知字段、非 string `reasonCode` 等 parser 失败统一返回 `400 validation_failed`。
- 状态 route 当前权限拒绝返回 `403 forbidden`，尚未在 route 层写 denied audit。
- 状态 route 当前 parser 失败返回 `400 validation_failed`，尚未在 route 层写 denied audit。
- create / update route 已有 route denied audit helper，覆盖权限拒绝和 parser 失败，并在 audit 写入失败时返回稳定失败。
- status service 已在成功路径写 allowed audit。
- status service 已对 repository 稳定非 ok 结果写 denied audit。
- status service 对 repository thrown error 返回 `service_unavailable`，不写 denied audit。
- `tenant_admin` 已具备 `open_connection:manage_status` 与 `open_connection:delete`。
- `ACCESS_ACTIONS` 未新增 `pause`、`resume`、`revoke` 或 `soft_delete`。
- `AuditReason` 已包含 `role_denied`、`missing_tenant`、`cross_tenant_denied`、`invalid_his_connection_payload`、`not_found_or_not_owned` 和 `invalid_transition`，本轮无需新增 reason。

## 适用 route

本次规划只适用于以下状态 API：

| 操作 | HTTP 路径 | route 权限动作 | route audit 动作 |
| --- | --- | --- | --- |
| pause | `POST /api/institution/his-connections/[connectionId]/pause` | `open_connection:manage_status` | `manage_status` |
| resume | `POST /api/institution/his-connections/[connectionId]/resume` | `open_connection:manage_status` | `manage_status` |
| revoke | `POST /api/institution/his-connections/[connectionId]/revoke` | `open_connection:manage_status` | `manage_status` |
| delete / softDelete | `DELETE /api/institution/his-connections/[connectionId]` | `open_connection:delete` | `delete` |

本轮不修改 create / update route。create / update 的 route denied audit 已由前序 PR 覆盖；后续状态 API 补强应复用相同安全原则，但不能改动 create / update 行为。

## 覆盖范围

后续状态 API route denied audit 只覆盖 route 层可判定且不会暴露目标存在性的拒绝：

- 有 access context 但权限拒绝时写 denied audit。
- access context 存在但 `tenantId` 缺失，权限决策返回 `missing_tenant` 时写 denied audit。
- 权限允许后，安全 JSON body parser 失败时写 denied audit。
- parser 失败包括 malformed JSON、body 不是 object、未知字段、body `tenantId` 注入、非 string `reasonCode`、空白 `reasonCode` 或不符合安全约束的 `reasonCode`。
- route denied audit 写入失败时返回 `503 service_unavailable`，不得继续调用 status service。

## 不覆盖范围

后续状态 API route denied audit 不覆盖：

- access context 缺失导致的 `401 unauthorized`。
- path `connectionId` trim 后为空导致的 `404 not_found`。
- status service 成功路径 allowed audit。
- status service 对 repository `not_found`、`conflict`、`invalid_state_transition`、`validation_failed` 的 denied audit。
- repository thrown error。
- status service 内部 audit 失败。
- 外部 HIS 调用、测试连接、凭证处理、凭证撤销或真实外部系统错误。
- create / update route 已有 denied audit 行为。

这些场景不由 route 层重复审计，避免同一次请求产生重复 denied event 或泄露目标存在性。

## audit action 映射

状态 API v1 不新增 audit action。

| 状态操作 | audit resource | audit action | 说明 |
| --- | --- | --- | --- |
| pause | `open_connection` | `manage_status` | 沿用状态权限动作，不新增 `pause`。 |
| resume | `open_connection` | `manage_status` | 沿用状态权限动作，不新增 `resume`。 |
| revoke | `open_connection` | `manage_status` | 沿用状态权限动作，不新增 `revoke`。 |
| delete / softDelete | `open_connection` | `delete` | 表达连接配置软删除权限，不新增 `soft_delete`。 |

如果后续需要在 audit 查询中直接区分 pause / resume / revoke，必须拆独立 action 增强 PR，并同步评估 `ACCESS_ACTIONS`、`ProtectedAction`、audit domain、query parser、测试和文档。

## audit reason 映射

后续 route denied audit 只能使用既有 reason：

| route 场景 | 推荐 reason | 说明 |
| --- | --- | --- |
| 角色权限拒绝 | `role_denied` | 直接沿用 `canAccessResource` 的权限决策 reason。 |
| 缺失可信租户 | `missing_tenant` | access context 存在但没有可信 `tenantId`。 |
| 跨租户拒绝 | `cross_tenant_denied` | 仅当权限层明确返回该 reason；状态 route 不得从 body / query / header 取目标租户。 |
| parser 失败 | `invalid_his_connection_payload` | 复用既有 HIS 连接配置安全 payload reason，不新增状态专用 reason。 |

route 层不得使用：

- `not_found_or_not_owned`，该 reason 继续由 status service 对 repository `not_found` 负责。
- `invalid_transition`，该 reason 继续由 status service 对 repository 状态流转失败负责。
- `his_connection_name_conflict`，该 reason 只属于 create / update 命名冲突。
- 不存在的 HIS 状态 API 专用 reason。

## resource 与 resourceId 边界

route denied audit 的 resource 固定为：

```text
open_connection
```

route denied audit 的 resourceId 固定为 trim 后的 path `connectionId`：

```text
params.connectionId
```

约束：

- 不从 body、query、header、localStorage 或外部 HIS payload 读取 resourceId。
- 不记录 body `tenantId`、query `tenantId` 或 header `tenantId`。
- path `connectionId` 为空时 route 已返回 `404 not_found`，不写 route denied audit。
- resourceId 只表达请求试图操作的连接配置 ID，不证明目标存在、属于当前租户或可见。

## actor 与租户边界

route denied audit 的 actor 只来自服务端 access context：

- `actorUserId = accessContext.userId`
- `tenantId = accessContext.tenantId`
- `source = accessContext.source`

access context 缺失时不写 route denied audit，因为没有可信 actor 和 tenant。

access context 存在但缺失 `tenantId` 时，可以在权限拒绝后记录 `missing_tenant` denied audit；audit 事件不得从请求 body、query、header 或外部 payload 补 tenant。

## audit 失败处理

后续 route denied audit 写入失败时必须 fail closed：

- 权限拒绝 audit 写入成功：返回原本的 `403 forbidden`。
- 权限拒绝 audit 写入失败：返回 `503 service_unavailable`。
- parser 失败 audit 写入成功：返回原本的 `400 validation_failed`。
- parser 失败 audit 写入失败：返回 `503 service_unavailable`。

audit 失败响应不得包含：

- audit repository error message。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整请求体。
- 外部系统错误。
- 凭证或连接串。

audit 写入失败时不得继续调用 status service，不得让业务状态变化发生。

## 禁止重复审计边界

route denied audit 与 status service audit 的职责必须拆开：

- route 层只记录权限拒绝和 parser 失败。
- status service 继续记录成功 allowed audit。
- status service 继续记录 repository 稳定非 ok 结果的 denied audit。
- route 不得对 service `not_found`、`conflict`、`invalid_transition`、`validation_failed` 再写第二条 denied audit。
- route 不得对 service `service_unavailable` 写 denied audit。
- route 不得对 repository thrown error 写 denied audit。

这条边界是后续测试必须覆盖的核心，防止一条请求产生多条语义重复的 denied audit。

## parser 失败 audit 边界

parser 失败的 route audit 必须发生在权限允许之后、调用 status service 之前。

推荐顺序：

1. trim path `connectionId`。
2. 空 `connectionId` 返回 `404 not_found`，不写 audit。
3. 读取服务端 access context。
4. access context 缺失返回 `401 unauthorized`，不写 audit。
5. 调用 `canAccessResource`。
6. 权限拒绝写 route denied audit。
7. 权限拒绝 audit 成功后返回 `403 forbidden`。
8. 权限拒绝 audit 失败后返回 `503 service_unavailable`。
9. 权限允许后读取和解析安全 JSON body。
10. parser 失败写 route denied audit。
11. parser 失败 audit 成功后返回 `400 validation_failed`。
12. parser 失败 audit 失败后返回 `503 service_unavailable`。
13. parser 成功后调用 status service。

权限拒绝时不得读取 body，避免无权限请求触发 JSON parser、敏感字段处理或额外副作用。

## 敏感信息禁区

route denied audit、错误响应和测试 fixture 都不得记录、返回或断言以下内容：

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
- 完整 request body
- 完整 response body
- body / query / header `tenantId`
- SQL
- stack
- `DATABASE_URL`
- 数据库 constraint、索引名或冲突行详情
- 完整治疗正文
- 完整病历正文
- 咨询全文
- 图片 / 文件原文

`reasonCode` 也不得原样写入 audit metadata，除非后续单独评估为安全短字段并补充测试；本轮默认不记录。

## 后续实现 PR 允许范围

后续实现 PR 可在最小范围内修改：

- `src/app/api/institution/his-connections/[connectionId]/pause/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/resume/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/revoke/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`

如需抽取共享 route denied audit helper，可在 route 所属模块内最小新增，且必须保持输入为安全字段，不得接收 raw request body 或凭证字段。

## 后续实现 PR 禁止范围

后续实现 PR 不得顺手修改：

- status service。
- parser 公共契约。
- repository。
- 权限模型。
- audit domain。
- audit reason。
- audit query whitelist。
- audit repository schema。
- database schema / migration。
- 凭证管理。
- 测试连接。
- 真实 HIS adapter。
- demo seed。
- `package.json` 或 lockfile。

如果测试证明必须改上述任一范围，停止实现并拆独立 Plan Mode。

## 测试规划

后续 `HisConnectionApiRoutes.test.ts` 至少覆盖：

- pause 权限拒绝写 `open_connection + manage_status + role_denied` denied audit。
- resume 权限拒绝写 `open_connection + manage_status + role_denied` denied audit。
- revoke 权限拒绝写 `open_connection + manage_status + role_denied` denied audit。
- DELETE 权限拒绝写 `open_connection + delete + role_denied` denied audit。
- access context 存在但缺失 tenant 时写 `missing_tenant` denied audit。
- 权限拒绝 audit 失败返回 `503 service_unavailable`，不调用 status service。
- 权限拒绝时不读取 body。
- parser 失败写 `invalid_his_connection_payload` denied audit。
- parser 失败 audit 失败返回 `503 service_unavailable`，不调用 status service。
- parser 失败 audit 使用 path `connectionId` 作为 resourceId。
- 401 不写 route audit。
- 空 path `connectionId` 的 404 不写 route audit。
- service `not_found` / `conflict` / `invalid_transition` / `validation_failed` 不重复写 route audit。
- service `service_unavailable` 不写 route audit。
- audit event 和响应不包含敏感信息。

## 后续拆分建议

建议后续 PR 顺序：

1. 当前 PR：状态 API route denied audit Plan Mode。
2. 后续实现 PR：状态 route 403 权限拒绝 route denied audit。
3. 后续实现 PR：状态 route parser 失败 route denied audit。
4. 后续收尾 PR：如有必要，补充审计查询 smoke 或文档收尾。

如果实现时 helper 抽取导致 diff 变大，优先拆成权限拒绝补强和 parser 失败补强两个 PR，避免影响已稳定的状态 API 主链路。

## 当前验收清单

- [x] 明确当前 PR 是 docs-only Plan Mode。
- [x] 明确适用状态 route。
- [x] 明确 route denied audit 覆盖 403 权限拒绝和 parser 失败。
- [x] 明确 401、空 ID 404、service repository 失败和 service unavailable 不由 route 重复审计。
- [x] 明确 action 映射为 `manage_status` / `delete`，不新增 action。
- [x] 明确 reason 映射使用既有 reason，不新增 reason。
- [x] 明确 resource / resourceId / actor / tenant 可信边界。
- [x] 明确 audit 写入失败返回 `503 service_unavailable`。
- [x] 明确敏感信息禁区。
- [x] 明确后续测试规划。
- [x] 明确后续实现 PR 允许范围和禁止范围。

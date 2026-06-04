# Phase 23 HIS 连接配置状态权限 v1 设计

> 日期：2026-06-04
> 状态：Phase 23 Plan Mode 文档。本 PR 只规划后续 HIS 连接配置 pause / resume / revoke / delete / softDelete 状态 API 所需权限边界，不实现权限代码，不新增 API route，不修改 service、parser、repository、audit domain、schema、migration、凭证、测试连接或真实 HIS 能力。

## 本次定位

本 PR 聚焦 **HIS 连接配置状态 API v1 权限规划**。PR #142 已规划状态 API 的路径、可信输入、状态流转、service、审计、DTO 和测试拆分；本轮只把状态写入权限从 API 规划中拆出来单独确认。

本 PR 不进入运行时代码变更：

- 不修改 `src/**`。
- 不新增 API route。
- 不修改现有 GET / POST / PATCH。
- 不新增或修改 service。
- 不新增或修改 parser。
- 不新增或修改 repository。
- 不真正修改权限实现或权限测试。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不改 schema 或 migration。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 不保存或返回真实凭证、raw HIS payload、完整病历、完整治疗正文或咨询全文。
- 不自动创建治疗摘要或随访任务。
- 不修改 demo seed 数据。
- 不修改 `package.json` 或 lockfile。
- 不修改 `.codex`、Superpowers 缓存目录或技能文件。

如果后续发现状态 API 权限必须同时调整平台代管、凭证撤销、测试连接、audit action 类型、schema 或真实 HIS adapter，必须停止权限实现并拆独立 Plan Mode。

## 只读检查结论

本次从最新 `main` 执行只读检查，确认当前 commit 为：

```text
d3ea842620fb7c8f98b65a8c4f8310e115121f2a
```

已检查范围：

- `src/modules/security/domain/access-control.ts`
- `src/modules/security/tests/AccessControlDomain.test.ts`
- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-permission-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-permission-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-api-v1.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-04.md`

已执行用户指定的状态权限术语只读搜索；该普通 `grep` 命令未返回匹配行。

已确认的代码事实：

- `ACCESS_ACTIONS` 已包含 `delete` 和 `manage_status`。
- `ACCESS_ACTIONS` 尚未包含 `pause`、`resume`、`revoke` 或 `soft_delete` 等细分状态动作。
- `ACCESS_RESOURCES` 已包含 `open_connection`。
- `ProtectedAction` 来自 `ACCESS_ACTIONS`。
- `TenantAuditEvent.action` 使用 `ProtectedAction`，当前仓库没有单独的 `AUDIT_ACTION_VALUES` 常量。
- 当前 `tenant_admin` 对 `open_connection` 已具备 `read_own_tenant`、`create` 和 `update`，尚未具备 `manage_status` 或 `delete`。
- `tenant_operator`、`consultant`、`customer_service`、`platform_admin`、`platform_operator`、`security_auditor` 当前均未具备 `open_connection` 状态写入权限。
- 当前 HIS 连接配置已有 create / update route、parser、service 和 repository 写入链路，但尚未存在 pause / resume / revoke / delete 状态 API route。
- 当前 repository 已具备 `pauseHisConnectionForTenant`、`resumeHisConnectionForTenant`、`revokeHisConnectionForTenant` 和 `softDeleteHisConnectionForTenant`。
- 当前 repository 状态方法绑定可信 `tenantId + connectionId + deletedAt is null`，跨租户、不存在和已删除目标统一不可见。

## 状态 API 范围

状态 API 权限范围仅包含：

- pause
- resume
- revoke
- delete
- softDelete

推荐路径仍沿用 PR #142 的状态 API 规划：

| 状态操作 | 推荐路径 | 权限动作 |
| --- | --- | --- |
| pause | `POST /api/institution/his-connections/[connectionId]/pause` | `open_connection:manage_status` |
| resume | `POST /api/institution/his-connections/[connectionId]/resume` | `open_connection:manage_status` |
| revoke | `POST /api/institution/his-connections/[connectionId]/revoke` | `open_connection:manage_status` |
| delete / softDelete | `DELETE /api/institution/his-connections/[connectionId]` | `open_connection:delete` |

`POST /api/institution/his-connections/[connectionId]/delete` 仅作为后续需要说明原因的备选路径。只有当 `DELETE` 携带可选 reason 的客户端、测试或审计约束不稳定时，后续 route Plan Mode 或实现 PR 才能切换到该备选路径，并必须说明原因。

## 权限禁止项

状态 API 不得使用以下策略：

- 不得复用 `open_connection:read_own_tenant` 放行 pause / resume / revoke / delete。
- 不得用任何只读权限表达状态写入。
- 不得把 `open_connection:update` 直接默认扩展为状态写入。
- 不得在 route 实现 PR 中顺手扩大权限模型。
- 不得在 route 内硬编码角色判断替代统一 `canAccessResource`。
- 不得让平台代管写入进入 v1。
- 不得默认给平台角色写入租户 HIS 连接状态。
- 不得因为状态 API 不处理凭证明文而降低权限等级。

## 权限方案评估

| 方案 | 覆盖范围 | 优点 | 风险 | v1 结论 |
| --- | --- | --- | --- | --- |
| 复用 `open_connection:update` | pause / resume / revoke / delete 都使用 update | 改动最小，已有 create / update 权限实现 | 混淆安全元数据更新和生命周期动作；delete 语义过宽；不利于后续审计区分 | 不作为默认方案 |
| 复用 `open_connection:manage_status` 与 `open_connection:delete` | pause / resume / revoke 使用 `manage_status`，delete / softDelete 使用 `delete` | 复用现有 action 枚举，不扩展权限枚举、权限类型和 audit action；语义比 update 清晰 | 无法在权限层区分 pause、resume、revoke 三个动作 | 推荐 v1 |
| 新增细分状态权限 | `open_connection:pause`、`open_connection:resume`、`open_connection:revoke`、`open_connection:delete` | 语义最清晰，便于未来精细授权和审计查询 | 需要扩展 `ACCESS_ACTIONS`、权限测试、audit action 类型、查询白名单和相关文档 | 作为未来增强，不进入当前默认方案 |

v1 推荐策略：

- pause / resume / revoke 使用 `open_connection:manage_status`。
- delete / softDelete 使用 `open_connection:delete`。
- 不新增 `pause`、`resume`、`revoke`、`soft_delete` action。
- 不修改 audit action 类型。
- 不修改 audit reason。
- 不修改 audit query whitelist。
- 不修改 audit repository。

## 授权角色边界

建议后续权限最小实现只授予：

| 角色 | `manage_status` | `delete` | v1 结论 |
| --- | --- | --- | --- |
| `tenant_admin` | 可授权 | 可授权 | v1 唯一默认授权角色，且必须存在可信租户上下文 |
| `tenant_operator` | 默认拒绝 | 默认拒绝 | 普通机构操作员不管理 HIS 连接生命周期 |
| `consultant` | 拒绝 | 拒绝 | 顾问不管理连接配置 |
| `customer_service` | 拒绝 | 拒绝 | 客服不管理连接配置 |
| `platform_admin` | v1 拒绝 | v1 拒绝 | 平台代管写入不进入 v1 |
| `platform_operator` | 拒绝 | 拒绝 | 平台运营不写租户连接状态 |
| `security_auditor` | 拒绝 | 拒绝 | 审计角色只读审计，不写业务配置 |
| 其他只读或非管理员角色 | 拒绝 | 拒绝 | 默认不允许 |

平台代管写入不进入 v1。后续如需要平台代管，必须单独评估目标租户选择、平台 actor 记录、双人复核、凭证可见性和审计责任。

## 租户边界

状态 API 权限判断必须使用服务端 access context：

1. access context 缺失时返回 `401 unauthorized`。
2. `accessContext.tenantId` 缺失时返回 `403 forbidden`，权限 reason 可落为 `missing_tenant`。
3. `targetTenantId` 必须等于 `accessContext.tenantId`。
4. 不接受 body、query、header、localStorage 或外部 HIS payload 中的 `tenantId`。
5. 若权限层收到不同 `targetTenantId`，必须返回 `cross_tenant_denied`。
6. 连接 ID 指向其他租户时，不在权限层暴露目标存在性，后续 service / repository 统一映射为 `not_found`。

route 不得通过先读详情再判断租户来暴露跨租户、已删除或不存在差异。

## route 权限顺序

后续状态 API route 建议顺序如下：

1. 获取服务端 access context。
2. access context 缺失时返回 `401 unauthorized`。
3. 校验 `accessContext.tenantId` 存在。
4. pause / resume / revoke 调用 `canAccessResource`，resource 为 `open_connection`，action 为 `manage_status`，`targetTenantId` 为 `accessContext.tenantId`。
5. delete 调用 `canAccessResource`，resource 为 `open_connection`，action 为 `delete`，`targetTenantId` 为 `accessContext.tenantId`。
6. 权限拒绝时返回 `403 forbidden`，并不得读取 body，不得调用状态 service，不得调用 repository。
7. 权限允许后再解析 path `connectionId` 和可选安全 reason。
8. 调用状态 service。
9. service 统一映射 repository result 到 HTTP 响应。

无权限路径必须短路：不读取 body、不初始化业务写入、不调用 `pauseHisConnectionForTenant` / `resumeHisConnectionForTenant` / `revokeHisConnectionForTenant` / `softDeleteHisConnectionForTenant`，不调用真实 HIS、不调用 fetch、不做测试连接、不处理凭证。

## 审计动作边界

当前 audit action 类型来自 `ProtectedAction`。在 v1 推荐策略下，allowed / denied audit 可使用：

- pause：`action = manage_status`
- resume：`action = manage_status`
- revoke：`action = manage_status`
- delete / softDelete：`action = delete`

具体操作语义保留在 route / service 上下文、resourceId、文档和测试命名中。当前 PR 不新增 audit action，不新增 audit reason，不修改 query whitelist，不修改 audit repository。

如果后续要让 audit 查询直接区分 pause / resume / revoke，必须进入细分 action 增强方案，并同步评估 `ACCESS_ACTIONS`、`ProtectedAction`、审计事件类型、查询解析、测试和文档。

## 状态流转边界

权限只决定能否发起状态动作，不在 route 层重写状态机。

| 操作 | 当前 repository 状态机 | 权限动作 | 副作用边界 |
| --- | --- | --- | --- |
| pause | `active` / `error` -> `paused` | `manage_status` | 不测试连接，不刷新健康状态，不处理凭证 |
| resume | `paused` -> `active` | `manage_status` | 不测试连接，不刷新健康状态，不调用真实 HIS |
| revoke | `draft` / `active` / `paused` / `error` -> `revoked` | `manage_status` | 不撤销凭证，不删除凭证，不调用外部系统 |
| delete / softDelete | 未删除状态 -> `deleted` | `delete` | 只软删除，不物理删除，不删除外部系统数据 |

delete 只表达 softDelete：设置删除状态并让 list / detail 默认不可见，不物理删除数据库记录，不删除外部系统数据，不处理外部 HIS 侧连接。

## DTO 边界

状态 API 成功响应优先使用：

```json
{ "ok": true }
```

成功响应不返回：

- `connectionId`
- `tenantId`
- `status`
- `credentialRef`
- `credentialConfigured`
- `healthStatus`
- 时间字段
- actor 字段
- read model
- raw HIS payload
- 凭证或凭证引用
- 外部系统响应

权限拒绝、状态冲突、无效流转和目标不可见响应也不得泄露连接是否存在于其他租户，不得泄露凭证、SQL、stack、`DATABASE_URL`、完整请求体或外部错误全文。

## 权限测试规划

权限模型测试建议覆盖：

- `tenant_admin` 对 `open_connection:manage_status` allowed。
- `tenant_admin` 对 `open_connection:delete` allowed。
- `tenant_admin` 既有 `open_connection:read_own_tenant`、`open_connection:create`、`open_connection:update` 不回退。
- `tenant_operator` 对 `manage_status` / `delete` denied。
- `consultant` 对 `manage_status` / `delete` denied。
- `customer_service` 对 `manage_status` / `delete` denied。
- `platform_admin` 对 `manage_status` / `delete` v1 denied。
- `platform_operator` 对 `manage_status` / `delete` denied。
- `security_auditor` 对 `manage_status` / `delete` denied。
- 缺失 `tenantId` 返回 `missing_tenant`。
- 跨租户 `targetTenantId` 返回 `cross_tenant_denied`。
- 只有 `open_connection:read_own_tenant` 不能替代 `manage_status` 或 `delete`。
- `open_connection:update` 不能替代 `manage_status`。
- `open_connection:update` 不能替代 `delete`。

状态 API route 权限测试建议覆盖：

- 未登录返回 401，且不读取 body、不调用 service。
- 缺失 tenant context 返回 403，且不读取 body、不调用 service。
- 无 `manage_status` 时 pause / resume / revoke 返回 403。
- 无 `delete` 时 delete 返回 403。
- 权限拒绝时不调用状态 service。
- 权限拒绝时不调用 repository。
- 权限拒绝时不调用 fetch、真实 HIS、测试连接或凭证处理。
- body / query / header 注入 `tenantId` 无效。
- 跨租户连接 ID 最终映射为 `not_found`，不暴露存在性。
- 成功响应只返回 `{ ok: true }`。
- 成功响应不返回 read model、状态字段、租户字段、凭证字段或 actor 字段。

## 后续拆分建议

建议继续小步拆分：

1. 当前 PR：状态 API 权限 Plan Mode。
2. 权限最小实现：给 `tenant_admin` 增加 `open_connection:manage_status` 与 `open_connection:delete`，不新增 API。
3. 状态 service Plan Mode。
4. 状态 service 最小实现。
5. pause / resume API route 最小实现。
6. revoke / delete API route 最小实现。
7. 状态 API route tests。
8. 状态 API 审计补强。
9. 状态 API 文档收尾。
10. 凭证管理、凭证撤销、测试连接和真实 HIS adapter 单独 Plan Mode。

## 当前验收清单

- 本文档明确当前 PR 是 Plan Mode。
- 本文档明确状态 API 范围仅包含 pause / resume / revoke / delete / softDelete。
- 本文档明确推荐路径包含 pause、resume、revoke 三个 `POST` 子路径和 `DELETE /api/institution/his-connections/[connectionId]`。
- 本文档明确 `POST /delete` 仅为需说明原因的备选。
- 本文档明确 pause / resume / revoke / delete 不得复用 `open_connection:read_own_tenant`。
- 本文档评估 `open_connection:update`、`manage_status + delete` 和细分 action 三种方案。
- 本文档明确 v1 推荐 pause / resume / revoke 使用 `manage_status`，delete / softDelete 使用 `delete`。
- 本文档明确 v1 默认仅 `tenant_admin` 可写，其他角色默认拒绝，平台代管写入不进入 v1。
- 本文档明确 route 不应直接调用 repository 状态方法，后续优先规划状态 service。
- 本文档明确成功响应优先 `{ ok: true }`，不返回 read model、凭证、租户、状态、时间或 actor 字段。
- 本文档明确 revoke 不处理凭证撤销，delete 只 softDelete。
- 本文档明确不调用真实 HIS / fetch / 测试连接 / 机构系统 / 企微 / AI / RAG / Agent / 自动触达。

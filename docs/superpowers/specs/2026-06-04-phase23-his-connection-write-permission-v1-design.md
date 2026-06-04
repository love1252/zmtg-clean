# Phase 23 HIS 连接配置写入权限 v1 设计

> 日期：2026-06-04
> 状态：Phase 23 Plan Mode 文档。本 PR 只规划后续 HIS 连接配置 create / update API 所需写入权限，不实现权限代码，不新增 API route，不修改 parser、service、repository、schema、migration、审计或凭证能力。

## 本次定位

本 PR 聚焦 **HIS 连接配置 create / update API v1 的写入权限模型补强规划**。PR #129 已完成 create / update API Plan Mode，PR #130 已完成写入 payload parser 与最小 DTO helper；当前仍缺少 `open_connection:create` 和 `open_connection:update` 的权限模型评审与后续实现边界。

本 PR 只写文档，不进入运行时代码变更：

- 不修改 `src/**`。
- 不新增 API route。
- 不新增或修改 service。
- 不新增或修改 repository。
- 不改 schema 或 migration。
- 不真正修改权限、认证或租户隔离实现。
- 不写审计实现。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、自动触达或外部系统。
- 不保存或返回真实凭证、raw HIS payload、完整病历、完整治疗正文或咨询全文。
- 不自动创建治疗摘要或随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

如果后续发现 create / update API 必须同时调整认证、租户隔离、平台代管、审计 reason、凭证模型或 schema，必须停止权限实现并拆独立 Plan Mode。

## 只读检查结论

本次只读检查了当前 main、权限模型、HIS 连接配置 parser / repository / 测试，以及已合并文档：

- `src/modules/security/domain/access-control.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-create-update-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-create-update-api-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

已确认的代码事实：

- 当前 main commit 为 `799a299ebdb8d7e88a45551098fb9ef247e7396b`。
- `ACCESS_ACTIONS` 已存在通用动作 `create` 和 `update`。
- `ACCESS_RESOURCES` 已存在资源 `open_connection`。
- 当前 `accessPolicies` 只给 `tenant_admin` 配置了 `open_connection:read_own_tenant`。
- 当前没有任何角色具备 `open_connection:create` 或 `open_connection:update`。
- `tenant_operator`、`consultant`、`customer_service`、`platform_admin`、`platform_operator`、`security_auditor` 当前都没有 `open_connection` 写入权限。
- 当前 HIS 连接配置只读 API 复用 `open_connection:read_own_tenant`，且只实现 list / detail GET。
- 当前 HIS 连接配置写入 parser 只接受 `connectionName`、`sourceSystem`、`vendorType`、`systemType`，拒绝 `tenantId`、`credentialRef`、状态字段、凭证字段、raw payload、SQL、stack 和 `DATABASE_URL`。
- 当前 repository 已有 `createHisConnectionForTenant` 和 `updateHisConnectionForTenant`，但 API route 尚未接入这些写入方法。
- 当前 repository 写入绑定可信 `tenantId`，create 固定写入 `draft` / `unknown`，update 只允许安全元数据并绑定 `tenantId + connectionId + deletedAt is null`。
- PR #129 已明确 create / update API 不得复用只读 DTO，也不得默认复用 `read_own_tenant` 放行写入。
- PR #130 已完成 parser / DTO helper，不读取 request、header、query、localStorage、access context、db、audit、repository 或真实 HIS。

## 权限现状判断

当前权限模型具备表达写入动作的基础枚举，但尚未授予 HIS 连接配置写入能力。结论如下：

- `tenant_admin` 当前只有 `open_connection:read_own_tenant`。
- `open_connection:read_own_tenant` 只能用于 list / detail 只读查询。
- create / update 必须使用独立写入权限，不得临时复用 `read_own_tenant`。
- 在权限实现 PR 合并前，未来 create / update route 即使存在 parser 和 repository，也必须返回 `forbidden`，不得绕过 `canAccessResource`。
- `open_connection` 不应因为不是 `sensitiveResources` 就放宽写入；连接配置影响真实 HIS 接入前置能力，必须按高风险配置项处理。

## 未来权限动作规划

后续权限实现建议使用既有资源和动作组合：

- `resource: 'open_connection'`
- `action: 'create'`
- `action: 'update'`

文档中可简称为：

- `open_connection:create`
- `open_connection:update`

动作语义：

- `open_connection:create`：允许在当前租户内创建 HIS 连接配置安全元数据，不包含凭证创建、测试连接、启用、暂停、恢复、撤销或删除。
- `open_connection:update`：允许在当前租户内更新 HIS 连接配置安全元数据，不包含状态流转、凭证更新、测试连接、健康检查或真实 HIS 调用。

本轮不规划下列动作的实现：

- `open_connection:manage_status`
- `open_connection:delete`
- 平台代管写入动作
- 凭证管理动作
- 测试连接动作
- 真实 HIS adapter 调用权限

pause / resume / revoke / softDelete 状态 API 需要后续单独评审是否使用 `manage_status`，不得混入 create / update v1。

## 角色边界规划

建议后续权限实现采用保守角色边界：

| 角色 | create | update | v1 结论 |
| --- | --- | --- | --- |
| `tenant_admin` | 可评估授予 | 可评估授予 | 建议 v1 仅授予该角色，且仍需租户上下文 |
| `tenant_operator` | 默认不允许 | 默认不允许 | 普通机构人员不应配置 HIS 连接 |
| `consultant` | 不允许 | 不允许 | 顾问只处理业务协作，不管理连接配置 |
| `customer_service` | 不允许 | 不允许 | 客服不管理连接配置 |
| `platform_admin` | v1 不允许 | v1 不允许 | 平台代管写入不进入 v1 |
| `platform_operator` | 不允许 | 不允许 | 平台运营不管理租户 HIS 连接写入 |
| `security_auditor` | 不允许 | 不允许 | 审计角色只读审计，不写业务配置 |

`tenant_admin` 是否最终授予 create / update，应在后续权限实现 PR 中只修改 `accessPolicies` 的 `open_connection` 策略，并配套权限测试。不能通过 route 内硬编码角色判断替代统一 `canAccessResource`。

平台代管写入不进入 v1。后续如需要平台代管，必须单独设计：

- 平台 scope 如何选择目标租户。
- 谁可以发起代管写入。
- 是否需要双人复核或二次确认。
- 审计如何记录平台 actor 和目标租户。
- 如何避免平台角色越权读取或写入租户凭证。

## API 权限判断顺序规划

后续 create / update API route 必须按统一顺序判断权限。建议顺序如下：

1. 从 request 取得服务端 access context。
2. access context 缺失时返回 `401 unauthorized`，响应错误为 `请先登录`。
3. 从服务端 access context 读取 `tenantId`。
4. 若 access context 无 `tenantId`，返回 `403 forbidden`，响应错误为 `没有访问权限`。
5. 明确不接受 body、query、header、localStorage 或外部 HIS payload 中的 `tenantId` 作为可信租户。
6. create 使用 `canAccessResource({ resource: 'open_connection', action: 'create', targetTenantId: accessContext.tenantId })`。
7. update 使用 `canAccessResource({ resource: 'open_connection', action: 'update', targetTenantId: accessContext.tenantId })`。
8. `canAccessResource` 返回拒绝时返回 `403 forbidden`，不得初始化写入 service，不得调用 repository，不得写业务数据。
9. 权限允许后，create 才进入 payload parser 和后续 service / repository 流程。
10. 权限允许后，update 才读取 path 中的 `connectionId`，再进入 payload parser 和后续 service / repository 流程。
11. update 对不存在、跨租户或已软删除记录统一返回 `404 not_found`，响应错误为 `记录不存在`，不得暴露目标连接是否存在于其他租户。

body、query、header 中出现 `tenantId` 时，route 不得用它做权限判断。body 中的 `tenantId` 仍应由 PR #130 parser 作为禁止字段拒绝；query / header 中的 `tenantId` 只能被忽略或用于测试证明不可信，不能成为目标租户来源。

## 错误响应边界

权限相关错误建议保持稳定、最小化：

| 场景 | HTTP 状态 | 响应 code | 响应 error |
| --- | --- | --- | --- |
| 未登录 | 401 | `unauthorized` | `请先登录` |
| 无租户上下文 | 403 | `forbidden` | `没有访问权限` |
| 无 create 权限 | 403 | `forbidden` | `没有访问权限` |
| 无 update 权限 | 403 | `forbidden` | `没有访问权限` |
| update 不存在 / 跨租户 / 已删除 | 404 | `not_found` | `记录不存在` |

错误响应不得包含：

- 内部权限策略细节。
- 角色枚举以外的内部判断路径。
- SQL、stack、`DATABASE_URL`。
- payload 原文。
- `credentialRef`。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥或连接串。
- raw HIS payload。
- 完整病历、完整治疗正文、咨询全文、图片 / 文件原文。

## 权限测试规划

后续权限实现 PR 和 API route PR 应拆开测试。权限模型测试建议覆盖：

- `tenant_admin` 在未授予 create / update 前，对 `open_connection:create` 返回 `role_denied`。
- `tenant_admin` 在授予 create 后，对 `open_connection:create` 返回 allowed。
- `tenant_admin` 在授予 update 后，对 `open_connection:update` 返回 allowed。
- 只有 `open_connection:read_own_tenant` 时，create / update 仍返回 `role_denied`。
- `tenant_operator` 对 create / update 返回 `role_denied`。
- `consultant` 对 create / update 返回 `role_denied`。
- `customer_service` 对 create / update 返回 `role_denied`。
- `platform_admin` 在 v1 对 create / update 返回 `role_denied` 或无租户上下文下拒绝。
- tenant scope 但缺失 `tenantId` 时返回 `missing_tenant`。
- tenant scope 尝试指定其他 `targetTenantId` 时返回 `cross_tenant_denied`。

API 权限测试建议覆盖：

- 未登录返回 `401 unauthorized`，不初始化数据库，不调用 repository。
- 无 tenant context 返回 `403 forbidden`，不写业务数据。
- `tenant_admin` 未授权 create / update 时返回 `403 forbidden`。
- 具备 `open_connection:create` 时，create 可进入后续 parser / service 流程。
- 具备 `open_connection:update` 时，update 可进入后续 parser / service 流程。
- 只有 `read_own_tenant` 时不可写入。
- body 中注入 `tenantId` 无效，且不得传给 repository。
- query / header 中注入 `tenantId` 无效，且不得传给 repository。
- update 跨租户、不存在、已软删除统一 `404 not_found`，不暴露存在性。
- 无权限时不调用 `createHisConnectionForTenant` 或 `updateHisConnectionForTenant`。
- 无权限时不调用真实 HIS、不调用 fetch、不做测试连接、不处理凭证。
- 权限拒绝错误不泄露 payload 原文、凭证、raw HIS payload、SQL、stack 或 `DATABASE_URL`。

## 后续 PR 拆分建议

建议继续小步拆分，避免把权限、审计、服务层、API route 和真实 HIS 接入揉在一起：

- PR 1：权限模型实现，只给 `tenant_admin` 增加 `open_connection:create` 和 `open_connection:update`，不改 API。
- PR 2：权限模型测试，覆盖 allowed / denied / missing tenant / cross tenant。
- PR 3：create / update API service Plan Mode 或最小实现，规划事务、审计和 repository 结果映射。
- PR 4：审计 reason 补强，增加 create / update payload 非法、权限拒绝、not found、conflict 等安全 reason。
- PR 5：create / update API route 实现，接入 access context、parser、权限判断、service 和错误映射。
- PR 6：create / update API tests，覆盖权限、租户、payload、DTO、repository 结果和越界防护。
- PR 7：pause / resume / revoke / delete 状态 API 权限 Plan Mode。
- PR 8：凭证管理 Plan Mode。
- PR 9：测试连接 Plan Mode。
- PR 10：真实 HIS adapter Plan Mode。

## 当前验收清单

- 本文档明确当前 PR 是 Plan Mode。
- 本文档明确当前 PR 只规划写入权限，不实现权限代码。
- 本文档明确 `tenant_admin` 当前只有 `open_connection:read_own_tenant`。
- 本文档明确不得复用 `read_own_tenant` 放行 create / update。
- 本文档规划 `open_connection:create` 与 `open_connection:update`。
- 本文档规划角色边界、平台代管边界和普通机构角色默认拒绝。
- 本文档规划 API 权限判断顺序。
- 本文档规划未登录、无租户上下文、无权限、read-only 权限不可写入、body tenantId 注入无效和跨租户 update 不暴露存在性的测试。
- 本文档明确不新增 API、不改 parser、不改 repository、不写审计、不接真实 HIS。

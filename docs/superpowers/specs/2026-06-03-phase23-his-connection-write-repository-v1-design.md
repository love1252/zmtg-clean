# Phase 23 HIS 连接配置写入 repository 边界设计

> 日期：2026-06-03
> 状态：Phase 23 写入 repository Plan Mode 文档。本 PR 只做文档规划，不写代码、不改测试、不新增 repository 方法、不新增 API、不改 schema / migration、不做凭证管理、不做测试连接、不接真实 HIS / 机构系统 / 企微 / AI，也不处理真实客户数据。

## 0. 本次定位

本 PR 是 **Phase 23 Plan Mode：HIS 连接配置写入 repository 边界**。

目标是在当前 HIS 连接配置只读链路和写入 API 边界规划已经完成后，进一步规划未来如果要实现写入 repository，repository 层应该如何拆分 create / update / pause / resume / revoke / delete 方法、输入模型、状态流转、租户边界、审计衔接、错误返回和数据最小化。

当前只读链路已经闭环：

```text
his_connections schema / migration
-> 只读 repository
-> list / detail GET API
-> workspace 只读入口
-> 只读 UI
-> smoke / 文档收尾
```

当前 Phase 23 写入 API 与状态流转边界也已完成 Plan Mode，但写入能力仍未实现。

本 PR 明确不是：

- 不是 repository 实现。
- 不是 API 实现。
- 不是 schema / migration。
- 不是凭证管理。
- 不是测试连接。
- 不是真实 HIS adapter。
- 不连接真实 HIS。
- 不连接任何机构系统。
- 不处理真实客户数据。
- 不写代码。
- 不改测试。
- 不新增 repository 方法。
- 不新增 API。
- 不改现有 API。
- 不改 UI。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不保存 raw HIS payload。
- 不保存或返回任何真实凭证。
- 不返回 `credentialRef` 给前端 DTO。
- 不展示凭证明文。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

如果后续发现必须新增 API、改 schema、改权限模型、做凭证存储、接外部系统或处理真实数据，必须停止当前 docs-only 范围并单独进入对应 Plan Mode。

## 1. 现有事实

本规划承接以下已落地或已规划事实：

- `src/server/db/schema.ts` 已有 `his_connections` 表。
- `his_connections.status` 已包含 `draft`、`active`、`paused`、`revoked`、`deleted` 和 `error`。
- `his_connections.healthStatus` 已包含 `unknown`、`healthy`、`degraded` 和 `failed`。
- `credentialRef` 是 nullable 引用字段，不保存凭证明文。
- `revokedAt` 和 `deletedAt` 已存在，支持撤销与软删除 / 归档语义。
- `tenantId + id` 已有唯一约束，租户内连接名在未软删除范围内保持唯一。
- `src/modules/institution/server/his-connection-repository.ts` 当前只提供 `listHisConnectionsByTenant` 和 `getHisConnectionByTenant`。
- 当前只读 repository 默认过滤软删除记录，按可信 `tenantId` 读取，详情绑定 `tenantId + connectionId`。
- 当前只读 read model 派生 `credentialConfigured`，不返回 `credentialRef`。
- 当前机构端 GET API 不接受 query / header / body `tenantId` 切换租户。
- 当前权限模型中 `tenant_admin` 对 `open_connection` 只有 `read_own_tenant`，尚未实现写入权限。
- 当前 audit repository 只负责记录安全审计事件，审计 DTO 和测试均要求不泄露 token、secret、SQL、stack、`DATABASE_URL` 或 raw payload。

因此，未来写入 repository 必须只在现有安全元数据表边界内规划，不应把凭证、外部系统连接、测试连接或真实 HIS 调用混入 repository。

## 2. repository 职责边界

未来 HIS 连接配置写入 repository 建议只负责 **tenant-scoped 数据访问和状态持久化**：

- 接收服务端已确认的可信 `tenantId`。
- 绑定 `tenantId + connectionId` 查找、更新和状态变更。
- 默认拒绝或隐藏已软删除记录。
- 按白名单写入安全元数据。
- 按稳定状态机执行 pause / resume / revoke / softDelete。
- 把数据库行映射成内部安全 write/read model。
- 把可预期冲突映射为稳定 repository 结果。

repository 不负责：

- 不解析 HTTP request。
- 不读取 cookie、header、query 或 localStorage。
- 不判断当前用户是否有权限。
- 不决定角色策略。
- 不把其他租户目标暴露给调用方。
- 不写审计本身，除非未来明确引入 service 事务封装。
- 不保存凭证明文。
- 不生成、轮换、撤销或验证凭证。
- 不调用真实 HIS。
- 不做测试连接或健康检查。
- 不解析 raw HIS payload。
- 不创建治疗摘要。
- 不创建随访任务。
- 不触发企微、短信、电话外呼、AI / RAG / Agent 或自动触达。

权限判断应由 API / service 层完成。repository 只接受已经由上层从 access context 提取出来的可信 `tenantId` 和 `actorUserId`，并继续用 `tenantId` 作为所有写入条件的一部分。

## 3. 输入边界分层

为避免把客户端 payload 与 repository command 混淆，未来实现应区分三层输入：

- **客户端 payload**：来自 HTTP body，不可信，严禁包含 `tenantId`、`id`、`status`、`credentialRef` 或生命周期字段。
- **服务端 access context**：由 session / gateway 得出，提供可信 `tenantId`、`actorUserId` 和角色信息。
- **repository command**：由 service 层组装，必须显式带上可信 `tenantId`，并只包含安全元数据和必要 actor 信息。

本文后续说的“create / update 输入允许字段”，默认指客户端 payload 或业务 values 允许字段；`tenantId` 只能由服务端 access context 注入 repository command，不允许来自客户端。

## 4. 拟规划 repository 方法

未来可在 `createHisConnectionRepository(database)` 返回对象中拆分以下方法。方法名可按实现时项目风格微调，但职责边界不应混合。

### 4.1 `createHisConnectionForTenant`

用途：为当前租户创建一条 HIS / 机构系统连接配置安全元数据记录。

repository command 必须显式接收：

- 可信 `tenantId`。
- `connectionName`。
- `sourceSystem`。
- `vendorType`。
- `systemType`。
- `actorUserId`。

服务端生成或写入：

- `id`。
- `tenantId`。
- `status = draft`。
- `createdAt`。
- `updatedAt`。
- `createdBy = actorUserId`。
- `updatedBy = actorUserId`。

create 不允许来自客户端或业务 values 的字段：

- `tenantId`。
- `id`。
- `credentialRef`。
- `status`。
- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `createdAt`。
- `updatedAt`。
- `revokedAt`。
- `deletedAt`。
- 凭证明文、token、secret、API key、OAuth token、basic auth、签名密钥、私钥或连接串。
- raw HIS payload、完整请求体 / 响应体、SQL、stack 或 `DATABASE_URL`。

建议结果：

- 创建成功返回 `ok` 和安全模型。
- 租户内未删除连接名冲突返回 `conflict`。
- 字段校验失败返回 `validation_failed`。

create 不应写入 `credentialRef`，也不应把 `healthStatus` 标成连接可用；默认 `healthStatus` 应维持 schema 默认 `unknown`。

### 4.2 `updateHisConnectionForTenant`

用途：更新当前租户连接配置的低风险元数据。

repository command 必须显式接收：

- 可信 `tenantId`。
- `connectionId`。
- 可更新 values：
  - `connectionName`。
  - `sourceSystem`。
  - `vendorType`。
  - `systemType`。
- `actorUserId`。

update 不允许修改：

- `tenantId`。
- `id`。
- `status`。
- `credentialRef`。
- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `createdBy`。
- `createdAt`。
- `revokedAt`。
- `deletedAt`。

update 必须绑定 `tenantId + connectionId`，已软删除记录默认不可写。跨租户、不存在和已软删除目标都应返回稳定 `not_found`，不得暴露其他租户是否存在该 `connectionId`。

状态变化不应通过 update 实现，必须走独立状态方法。

### 4.3 `pauseHisConnectionForTenant`

用途：把可暂停的连接配置从可运行状态转为 `paused`。

repository command 必须显式接收：

- 可信 `tenantId`。
- `connectionId`。
- `actorUserId`。
- 可选安全 `reasonCode`。

允许流转：

- `active -> paused`。
- `error -> paused`。

建议 v1 禁止：

- `draft -> paused`。
- `paused -> paused`，可返回 `conflict`。
- `revoked -> paused`。
- `deleted -> paused`。

pause 只表示内部状态暂停，不代表已经通知真实 HIS，也不代表凭证被撤销。

### 4.4 `resumeHisConnectionForTenant`

用途：把暂停中的连接配置恢复为 `active`。

repository command 必须显式接收：

- 可信 `tenantId`。
- `connectionId`。
- `actorUserId`。
- 可选安全 `reasonCode`。

允许流转：

- `paused -> active`。

禁止流转：

- `draft -> active`：不通过 resume；未来如需启用草稿，应单独规划 `activate`。
- `error -> active`：建议 v1 不通过 resume，需先单独评估错误处理和人工确认。
- `revoked -> active`。
- `deleted -> active`。

resume 不表示测试连接成功，不调用真实 HIS，不刷新 `healthStatus`。

### 4.5 `revokeHisConnectionForTenant`

用途：撤销连接配置，使其不可普通恢复。

repository command 必须显式接收：

- 可信 `tenantId`。
- `connectionId`。
- `actorUserId`。
- 可选安全 `reasonCode`。

允许流转：

- `draft -> revoked`。
- `active -> revoked`。
- `paused -> revoked`。
- `error -> revoked`。

禁止流转：

- `revoked -> revoked`，建议 v1 返回 `conflict`。
- `deleted -> revoked`。
- `revoked -> active`，必须禁止。

revoke 可设置 `revokedAt` 和 `updatedAt`。凭证材料的撤销、销毁或轮换不属于 repository 职责，必须由凭证管理 Plan Mode 单独设计。

### 4.6 `softDeleteHisConnectionForTenant`

用途：软删除 / 归档连接配置，使其从默认 list / detail 中不可见。

repository command 必须显式接收：

- 可信 `tenantId`。
- `connectionId`。
- `actorUserId`。
- 可选安全 `reasonCode`。

允许流转：

- 任意未删除状态 `draft / active / paused / error / revoked -> deleted`。

禁止流转：

- `deleted -> 任意状态`。
- 已软删除记录继续 update / pause / resume / revoke / delete。

soft delete 可设置 `status = deleted`、`deletedAt` 和 `updatedAt`。它不是硬删除，不删除审计历史，也不表示凭证材料已销毁。

## 5. 状态流转表

| 当前状态 | pause | resume | revoke | softDelete |
| --- | --- | --- | --- | --- |
| `draft` | 禁止，v1 返回 `invalid_state_transition` | 禁止，未来如需启用单独规划 `activate` | 允许 | 允许 |
| `active` | 允许，进入 `paused` | 禁止 | 允许 | 允许 |
| `paused` | 建议返回 `conflict` | 允许，进入 `active` | 允许 | 允许 |
| `error` | 允许，进入 `paused` | 禁止，v1 不直接恢复 | 允许 | 允许 |
| `revoked` | 禁止 | 禁止 | 建议返回 `conflict` | 允许 |
| `deleted` | 禁止并默认不可见 | 禁止并默认不可见 | 禁止并默认不可见 | 禁止并默认不可见 |

每个状态方法都必须：

- 绑定 `tenantId + connectionId`。
- 先检查当前状态。
- 返回稳定结果。
- 不保存外部错误全文。
- 不调用真实 HIS。
- 不处理凭证撤销。
- 不表示测试连接成功。
- 不展示其他租户目标是否存在。

## 6. 返回结果规划

repository 建议返回稳定 union result，不直接把内部错误原文透传给 API 层。

建议稳定结果：

- `ok`：写入成功，返回安全模型。
- `not_found`：目标不存在、跨租户或已软删除。
- `conflict`：租户内连接名冲突、重复 revoke、重复 pause 等可预期冲突。
- `invalid_state_transition`：状态流转不允许。
- `validation_failed`：服务端二次校验失败或 values 为空 / 超限。

repository 返回结果不得包含：

- SQL。
- stack。
- 数据库异常原文。
- 其他租户是否存在该目标。
- raw payload。
- 凭证明文。
- `credentialRef` 给前端 DTO。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥或连接串。
- `DATABASE_URL`。

如果数据库唯一约束报错，repository 或 service 层只应映射为稳定 `conflict`。如果出现未知数据库异常，API 层可返回稳定 `service_unavailable`，但不得把异常原文写入响应、审计或前端 DTO。

## 7. 数据最小化

repository 内部安全模型可保留实现需要的字段，但对 API DTO 的输出必须继续最小化。

未来写入成功后返回给 API 层的安全模型建议包含：

- `connectionId`。
- `connectionName`。
- `sourceSystem`。
- `vendorType`。
- `systemType`。
- `status`。
- `credentialConfigured`。
- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `createdAt`。
- `updatedAt`。
- `revokedAt`。

面向前端 DTO 默认不返回：

- `tenantId`。
- `deletedAt`。
- `credentialRef`。
- 凭证明文。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥或连接串。
- raw HIS payload。
- 完整请求体 / 响应体。
- 外部系统错误响应全文。
- SQL、stack 或 `DATABASE_URL`。

`lastErrorCode` 只能是稳定短码，不得保存外部系统错误全文。

## 8. 租户边界

所有未来写入方法都必须显式接收可信 `tenantId`，且该 `tenantId` 只能来自上层服务端 access context。

必须遵守：

- API payload 不接受 `tenantId`。
- query、header、localStorage 中的 `tenantId` 不可信。
- detail / update / status 方法必须绑定 `tenantId + connectionId`。
- 跨租户目标不得可见。
- 已软删除记录默认不可写。
- repository 不处理权限判断，只执行 tenant-scoped 数据访问。
- 权限判断由 API / service 层完成。

平台代管、跨租户运维或安全审计只读查询如果未来需要写入或状态管理，必须另开 Plan Mode，不得复用机构端 repository 写入入口绕过 access context。

## 9. 审计衔接

推荐审计归属：

```text
API route / service 层
-> 权限判断
-> payload 白名单解析
-> repository 写入
-> audit repository 记录安全审计
```

repository 默认不直接写审计。原因是权限判断、actor、访问来源、denied / allowed 语义和 HTTP 错误映射都在 API / service 层更清楚。

如果未来实现需要数据库写入和审计写入强事务一致性，建议单独设计 service 层事务协调，而不是让 HIS connection repository 直接依赖 audit repository。

建议审计事件：

- `his_connection:create`。
- `his_connection:update`。
- `his_connection:pause`。
- `his_connection:resume`。
- `his_connection:revoke`。
- `his_connection:delete`。

现有 `auditEvents.action` 是通用 action 枚举，未来实现时可能需要在 action / resource / reason 层做兼容映射或扩展。该扩展属于后续实现 PR 范围，不在当前 PR 修改。

审计只记录安全元数据：

- `tenantId`。
- `connectionId`。
- `sourceSystem`。
- `status`。
- `reasonCode`。
- actor。
- `createdAt` / occurredAt。

审计禁止记录：

- 凭证明文。
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
- 外部系统错误响应全文。

## 10. 未来测试规划

当前 PR 不新增测试。未来 repository 实现 PR 至少应覆盖：

- create 只写当前租户。
- create 不接受客户端 `tenantId`。
- create 默认 `draft`。
- create 不写 `credentialRef`。
- create 写入 `createdBy` 和 `updatedBy`。
- create 租户内未删除连接名冲突返回 `conflict`。
- update 只能更新当前租户。
- update 跨租户返回 `not_found`。
- update 已软删除返回 `not_found`。
- update 不修改 `status`。
- update 不修改 `credentialRef`。
- pause / resume / revoke / softDelete 状态流转正确。
- `draft -> paused` v1 禁止。
- `paused -> active` 允许。
- `revoked` 不能恢复 `active`。
- `deleted` 不能再操作。
- softDelete 后 list / detail 不可见。
- 不写 raw payload。
- 不写凭证明文。
- 不返回 `credentialRef` 给 API DTO。
- 不修改 demo seed。
- 不调用外部系统。
- 不创建治疗摘要。
- 不创建随访任务。

状态方法测试应使用 `tenantId + connectionId` 条件断言，避免只按 `id` 更新。

## 11. 后续 PR 拆分建议

建议后续拆分为：

- PR A：写入 repository Plan Mode（当前 PR）。
- PR B：create / update repository 实现。
- PR C：状态流转 repository 实现。
- PR D：repository 写入测试收尾。
- PR E：create / update API 实现。
- PR F：pause / resume / revoke / delete API 实现。
- PR G：审计补强。
- PR H：凭证管理 Plan Mode。
- PR I：测试连接 Plan Mode。
- PR J：真实 HIS adapter Plan Mode。

凭证录入、加密、轮换、撤销、测试连接、健康检查、真实 HIS adapter、Webhook / 同步、患者身份匹配、自动摘要、自动任务和自动触达都不得混入当前写入 repository docs-only PR。

## 12. 边界结论

未来写入 repository 的核心边界是：**repository 只做可信租户范围内的安全元数据持久化和状态机更新，不做权限、不做审计决策、不碰凭证、不接外部系统、不保存 raw HIS payload。**

只要这些边界保持稳定，后续 create / update API、状态 API、凭证管理、测试连接和真实 HIS adapter 才能分阶段安全推进。
